# Qué falta para abrir esto a mucha gente

Auditoría del **16 de agosto de 2026** contra la base, el panel y el DNS
reales, no contra el código. Todo lo que dice «comprobado» aquí abajo se
comprobó con `curl`, `dig` o una consulta a Postgres, y el comando queda
escrito para poder repetirlo.

El resumen en una línea: **la app funciona y es sólida para las familias
que la usan hoy; lo que impide abrirla a miles no es la app, es la
plataforma que hay debajo y tres cosas que no existen todavía.**

---

## 0. Lo que se arregló durante esta auditoría

### El rol anónimo podía llamar a las funciones (grave, cerrado)

Todas las funciones `security definer` terminaban con el patrón
`revoke all ... from public; grant execute ... to authenticated;`. **Eso
no hace lo que parece**: Supabase concede EXECUTE a `anon` y a
`authenticated` por privilegios por defecto al crear la función, y
`revoke from public` retira el pseudo-rol PUBLIC, no los permisos que esos
dos roles ya tienen por su nombre.

Comprobado desde fuera, con la clave pública del bundle y sin sesión:

```
POST /rest/v1/rpc/purge_logs {"dias":100000}   →  HTTP 200
```

Se pidieron 100.000 días a propósito, que no borra nada. Con `dias: 0`
esa misma llamada —al alcance de cualquiera que lea la clave, que es
pública por diseño— hacía dos cosas:

1. Borrar `app_logs` entera, de **todas** las familias: el único rastro
   de qué pasó cuando algo falla.
2. Vaciar `rate_limits` y `user_limits`, que es peor: los topes de ritmo
   de la migración 017 se cuentan por ventana en esas tablas, así que
   borrarlas devuelve **todos los contadores a cero**. Bastaba alternar
   «gasto la cuota / la reseteo» para que los topes dejaran de existir.

Las demás no eran explotables porque empiezan comprobando `auth.uid()`,
pero eso es dejar la puerta abierta confiando en que dentro hay otra.
Migración **021**: retirado el permiso a `anon` de las ocho. Reprobado
después:

```
purge_logs        →  401 permission denied for function purge_logs
claim_streak      →  401 (antes: 200 y "no_existe")
lectura normal    →  200  (la app sigue igual)
```

### Tres cosas que solo duelen al crecer (migración 020)

- **Siete claves ajenas sin índice.** Postgres no indexa solo el lado
  hijo: al borrar del padre recorre la tabla hija entera, y con `on
  delete cascade` se encadena. Lo que más arrastra es **borrar una
  cuenta**, que es justo lo que el RGPD obliga a ofrecer.
- **Dos políticas de la 019 sin `to authenticated`.** La 017 lo había
  dejado como convención; la migración siguiente ya la rompió. Una
  convención sin comprobación automática dura exactamente una migración.
- **`purge_logs` no se había ejecutado nunca**: existía desde la 002 y no
  estaba programada. Ahora va en `pg_cron` (`purga-logs`, 4:10), que ya
  estaba instalado para los avisos.

Estado tras las dos: `fk_sin_indice = 0`, `politicas_sin_rol = 0`,
dos trabajos en cron.

---

## 1. El correo, revisado en el dominio nuevo

Todo correcto, con un matiz que es el que importa a escala.

| Pieza | Estado | Comprobado con |
|---|---|---|
| SPF | ✅ `v=spf1 include:_spf.mail.hostinger.com ~all` | `dig TXT elgremioapp.com` |
| DKIM | ✅ `hostingermail-a` con clave RSA real | `dig TXT hostingermail-a._domainkey.elgremioapp.com` |
| DMARC | ⚠️ `v=DMARC1; p=none`, **sin `rua=`** | `dig TXT _dmarc.elgremioapp.com` |
| Remitente | ✅ `noreply@elgremioapp.com` · «El Gremio» | panel |
| Servidor | ✅ `smtp.hostinger.com:465` | panel |
| Site URL | ✅ `https://elgremioapp.com/` | panel |
| Redirect URLs | ✅ dominio nuevo, viejo y localhost | panel |
| Confirmar correo | ✅ encendido | panel |
| Plantillas | ✅ sin URLs fijas: solo `{{ .ConfirmationURL }}` | `grep` |
| Dominio viejo | ✅ 301 al nuevo | `curl -I` |

**Los dos peros:**

- **DMARC en `p=none` y sin dirección de informes.** `p=none` es la
  postura correcta para empezar, pero sin `rua=` no llega ni un informe:
  no hay forma de saber si alguien está suplantando el dominio ni si los
  correos legítimos pasan la alineación. Añadir `rua=mailto:...` cuesta un
  registro TXT y da visibilidad desde el primer día; subir a `quarantine`
  después, con datos.
- **El techo real son 30 correos/hora** (Authentication → Rate Limits), y
  detrás hay un **buzón de Hostinger, no un servicio transaccional**. Cada
  alta consume un correo de confirmación, y las recuperaciones compiten
  por el mismo cupo. Eso pone el límite en **30 familias nuevas por hora
  en el mejor caso**, sin telemetría de entrega, sin webhooks de rebote y
  con la reputación del dominio atada a un buzón compartido.

---

## 2. Los problemas de producción masiva, por orden de mordida

### 1. El correo es el primer cuello de botella

Ver arriba. Mientras sean decenas de familias, sobra. A partir de ahí hay
que mover los correos de autenticación a un servicio transaccional
(Resend, Postmark, SES) y subir el tope. La señal de que llegó el momento
no es el número de usuarios: es el primer «no me ha llegado el correo».

### 2. Las copias de seguridad no dan para un descuido

El plan Free hace copia diaria con **7 días de retención y sin
point-in-time recovery**. Traducido: un `delete` equivocado a las 10:00 se
recupera con los datos de ayer, y se pierde un día entero de todas las
familias. Con historial de menores dentro eso no es un riesgo asumible.
**Es la razón más sólida para pasar a Pro**, por encima del rendimiento.

### 3. El registro está abierto y sin captcha

Comprobado: «Enable Captcha protection» apagado y altas abiertas. Cada
registro es una fila en `auth.users` **y un correo del cupo de 30/hora**.
Un script trivial deja a las familias reales sin poder darse de alta, y no
hace falta ni malicia: basta un rastreador. Encenderlo exige cuenta de
hCaptcha o Turnstile —decisión con dueño, no un interruptor.

### 4. Todo depende de una persona y un portátil

El dominio, el proyecto de Supabase, el repositorio, el token de
despliegue, el buzón del remitente y la clave VAPID cuelgan de una sola
cuenta. **No hay CI**: comprobado, no existe `.github/workflows`, así que
`npm run deploy` sale de un portátil concreto y los tests solo corren si
alguien se acuerda. Si ese portátil se pierde, no hay quien despliegue un
arreglo urgente.

Lo barato: MFA en Supabase y en el registrador, la clave VAPID y las
credenciales en un gestor compartido con alguien de confianza, y el
workflow de Actions (necesita `gh auth refresh -s workflow`, que solo
puede hacer el usuario).

### 5. Nadie puede ver los fallos de nadie

`app_logs` está bajo RLS por familia —correcto para la privacidad— y eso
deja al operador ciego: no hay una sola consulta que diga «cuántas altas
fallaron hoy». Sentry sigue apagado.

**La prueba de que esto ya muerde**, y salió sola durante la auditoría. A
media mañana la tabla de suscripciones estaba a cero con el sistema entero
montado y el cron corriendo cada hora: imposible saber, desde dentro, si
era que nadie los había activado o que la suscripción fallaba en silencio.
Dos horas después había dos suscripciones activas —las había dado de alta
la otra sesión mientras tanto—, o sea que la respuesta era la primera.

Pero al volver a mirar apareció lo siguiente: **dos avisos apuntados en
`push_log` y un solo envío real**. Uno de los dos se marcó como avisado y
no llegó a ningún aparato. Es el comportamiento previsto —la función
apunta antes de enviar a propósito, porque perder un aviso es mejor que
mandar dos—, pero que sea previsto no quiere decir que se vea: solo
aparece si alguien escribe la consulta. Multiplicado por mil familias, la
diferencia entre «se entregó» y «se dio por entregado» no la va a notar
nadie.

Hace falta una vista agregada y anónima (contadores por evento y día, sin
`family_id`) o encender Sentry, que está escrito y esperando en
`monitoring.js`.

### 6. La app no manda una sola cabecera de seguridad

Comprobado: sin CSP, sin HSTS, sin `X-Frame-Options`. La sesión de
Supabase vive en `localStorage`, así que **cualquier XSS se lleva el token
de la familia entera**. GitHub Pages no permite añadir cabeceras: o CSP por
`<meta http-equiv>` —que cubre lo esencial— o mover el alojamiento a algo
que sí las permita (Cloudflare Pages, Netlify) sin cambiar nada más.

### 7. El reparto de avisos no escala como está escrito

La Edge Function recorre los pendientes **en un bucle secuencial**, con un
`await` de envío por suscripción. Con decenas va sobrado; con miles se
come el límite de tiempo de la función y se corta a media lista, y como el
apunte en `push_log` va **antes** del envío (decisión correcta para no
duplicar), las familias del final se quedan marcadas como avisadas sin
haber recibido nada. Hay que trocear por lotes y paralelizar antes de que
eso pase, no después.

### 8. Los límites del plan Free llegan antes de lo que parece

500 MB de base (hoy: 1,3 MB), egress mensual, y **conexiones de realtime**:
cada dispositivo abierto mantiene una. Una familia son dos o tres
aparatos. Ese es el contador que se agota primero, y su síntoma no es un
error claro sino que las validaciones dejan de aparecer solas.

### 9. Lo legal: la mitad hecha, la otra mitad no existe

Bien: **exportar los datos y borrar la cuenta funcionan de verdad**
(`Datos.jsx`, `delete_my_account`, comprobada `security definer` y con
guarda de sesión). Eso es más de lo que tienen la mayoría de las apps de
esta categoría, y es obligación legal en cuanto la use alguien de fuera.

Falta lo demás, y es lo que bloquea abrir el registro de verdad: **no hay
política de privacidad, ni términos, ni edad mínima, ni registro de
consentimiento parental** en ningún sitio. Aquí se guardan nombres y
actividad diaria de menores. Sin esos textos, cada familia nueva es una
exposición legal, no un usuario.

### 10. Lo que hace que esto sea de una familia y no de muchas

- **El historial no se borra nunca, por diseño.** Es bueno para el
  producto y es una política de retención indefinida sobre datos de
  menores. Hay que decidirlo y escribirlo, aunque la decisión sea
  conservarlo.
- **Solo español**, y la economía está calibrada contra una casa concreta
  (dos adultos, una junior, una peque, 60 % de adherencia). Los números
  son honestos porque están medidos; otra familia no los hereda.
- **`www.elgremioapp.com` no está en las Redirect URLs.** Si alguien llega
  por ahí y pide recuperar la contraseña, el enlace rebota.

---

## 3. Por dónde empezar

Si mañana hubiera que abrirlo, en este orden:

1. **Privacidad, términos y consentimiento parental.** Sin esto no se
   abre, y no depende de nadie más.
2. **Plan Pro de Supabase**, por las copias con PITR antes que por el
   rendimiento.
3. **Captcha en el registro**, o el cupo de correo lo quema el primer bot.
4. **Correo transaccional de verdad** y DMARC con informes.
5. **Ojos**: Sentry o una vista agregada. Hoy no se ve nada, y los avisos
   push a cero son la prueba.
6. **CI y un segundo par de manos** con acceso a todo.

Lo de después: CSP, lotes en el reparto de avisos, `www` en las redirect,
y trocear el bundle.
