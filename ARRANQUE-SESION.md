# Arranque de sesión · El Gremio

Documento de continuidad. Si abres una sesión nueva sobre este proyecto,
lee esto primero: dice dónde está todo, qué está hecho, qué falta y qué
trampas tiene. Última actualización: **16 de agosto de 2026**, con la app
en su propio dominio, **elgremioapp.com**, y el correo cerrado de punta a
punta (SMTP propio, plantillas en español y confirmación de correo
encendida).

Si solo vas a leer un párrafo: la app está **en producción y estable**; lo
que queda no es código, es uso. Antes de añadir nada, lee §8 y pregunta
las tres cosas de ahí.

---

## 1. Qué es

Webapp de misiones familiares con XP, niveles, monedas, premios reales,
insignias y una meta cooperativa, para una familia de cuatro (dos adultos,
una junior de 11 años y una peque de 3). La peque tiene **pantalla propia**
adaptada a su edad. Sin ranking entre miembros: la única comparación es la
meta compartida.

Nació de un prototipo que llegó en `~/Downloads/files.zip` el 15-ago-2026
(Vite + React + Supabase, 2.371 líneas) y se amplió ese mismo día con el
modo peque, la capa de producción y la gestión de miembros.

---

## 2. Estado: en producción

| Cosa | Dónde |
|---|---|
| Web | https://elgremioapp.com/ (la dirección vieja redirige sola) |
| Exposición pública | https://elgremioapp.com/narrativa/ |
| Dominio y correo | Hostinger, cuenta de Raúl; el sitio lo sigue sirviendo GitHub Pages |
| Repo (público) | https://github.com/drraulferrer/el-gremio |
| Código local | `~/el-gremio` |
| Supabase | proyecto `chfbrawsoulfiywiqhpe`, Postgres 17.6, región EU |
| Versión publicada | ver `npm run health`; cada despliegue deja etiqueta `deploy-AAAA-MM-DD-HHMM` |
| Tests | 416, en 24 ficheros, todos en verde |

Comprobar que sigue vivo:

```bash
cd ~/el-gremio && npm run health
```

Debe salir 🟢 en `web` y en `supabase`. Si `web` falla, mira GitHub Pages;
si falla `supabase`, casi seguro que el proyecto está pausado (ver §7).

**Estado del esquema**, comprobado contra la base el 15-ago:

```
✅ 003  profiles.active
✅ 004  challenges.skill · rewards.tier · completions.praise
✅ 005  una sola versión de resolve_completion (la sobrecarga, retirada)
✅ 006  undo_completion responde
✅ 007  profiles.gender
✅ 007b reescritura de los títulos con marca de género
✅ 008  los cinco índices
✅ 009  dos índices redundantes retirados (15-ago)
✅ 010  habilidad asignada a las 16 misiones que no la tenían (15-ago)
✅ 011  target_role (superada por la 013, no ejecutar suelta)
✅ 012  juego de globos: tabla bonuses + grant_daily_bonus (15-ago)
✅ 013  target_roles[]: misiones para varios roles (15-ago)
✅ 014  premio a mano: bonuses.motivo/otorgado_por + grant_manual_bonus (15-ago)
✅ 015  poderes que se gastan + insignias únicas (15-ago, noche)
✅ 016  camino de rachas: claim_streak (15-ago, noche)
✅ 017  lo que hace falta para MUCHAS familias (16-ago, madrugada)
✅ 018  zona horaria por familia + borrado de cuenta (16-ago)
```

La 018 se ejecutó y se comprobó con el `select` del final del fichero:
columna `timezone`, disparador `families_zona_valida`, `zona_de_perfil`,
`delete_my_account`, y `claim_streak` y `grant_daily_bonus` reescritas con
la zona (`v_tz`), todo a 1. El gremio quedó en `Europe/Madrid`, que es lo
que era de facto. Comprobado además desde fuera: `families?select=timezone`
responde 200 y una columna inventada responde 400, así que la columna está
de verdad.

**Trampa del trayecto, que costó un rato y va a volver a pasar:** pegar el
SQL en el editor de Supabase desde el navegador **destroza los acentos**
(el UTF-8 se lee como MacRoman: `ó` acaba siendo `√≥`). En los comentarios
sería feo; en la 018 se colaba dentro de un DATO —«Racha de N días», que
se escribe en `bonuses.motivo`— y encima los comentarios viajan dentro del
cuerpo de las funciones y se quedan en `pg_proc` para siempre. La solución
que funciona es copiar el fichero **pre-codificado en MacRoman**, y así el
viaje lo deshace:

```bash
python3 -c "import subprocess;s=open('migracion-0NN.sql',encoding='utf-8').read().replace('⚠ ','OJO: ');subprocess.run(['pbcopy'],input=s.encode('mac_roman'))"
```

(El `⚠` es el único carácter del fichero que MacRoman no tiene.) Y antes
de pulsar Run, comprobar en la consola de la pestaña que el texto llegó
bien: `monaco.editor.getModels()[0].getValue().includes('días')`.

La 017 se ejecutó y se comprobó con el `select` del final del fichero:
índice único por `owner`, `user_limits` con RLS, `rate_guard_user`,
`purge_logs` ya `security definer`, los cuatro topes de filas, las siete
restricciones de longitud y **cero políticas sin rol declarado**.

Ese último contador cazó un despiste en el primer pase: `logs_escritura`
estaba actualizada en `schema.sql` y sin espejar en la migración. Para eso
está la comprobación, y por eso conviene pegarla siempre.

La 016 se ejecutó y se comprobó desde fuera: `claim_streak` contesta
`no_existe` a un perfil inventado y `hito_invalido` a un hito que no está
en la tabla, que son las dos respuestas correctas.

**La 015 costó dos intentos, y conviene saber por qué.** El primero se dio
por hecho y la base no la tenía: `power_uses` y `spend_power` salían NULL
con `to_regclass`, mientras `bonuses` respondía por el mismo camino. La
causa casi seguro fue el diálogo **«Potential issue detected · This query
includes destructive operations»** que el SQL Editor levanta ante cualquier
`drop policy` o `revoke`, aunque no toquen un solo dato: si se cierra sin
pulsar «Run query», el editor no ejecuta nada y tampoco avisa de que no lo
ha hecho. Con cualquier migración de este proyecto va a salir. **Hay que
pulsar «Run query» y esperar el «Success. No rows returned».**

Comprobado tras ejecutarla: índice único de las únicas, RLS de
`power_uses`, su política de lectura y su alta en realtime, los cuatro a 1.
Y de paso, `select tablename, rowsecurity from pg_tables where schemaname
= 'public'` no devuelve ni una tabla en `false`: producción nunca estuvo
expuesta por el agujero de `schema.sql`, que solo afectaba a bases nuevas.

Para comprobarlo desde fuera sin abrir el panel, que es más rápido:

```bash
U=$VITE_SUPABASE_URL; K=$VITE_SUPABASE_ANON_KEY
curl -s -o /dev/null -w '%{http_code}\n' "$U/rest/v1/power_uses?select=id&limit=1" \
  -H "apikey: $K" -H "Authorization: Bearer $K"    # 200 = la tabla existe
```

De la 013 queda **sin ejecutar y a propósito** el `drop column target_role`
que va comentado al final. No lo lances hasta comprobar que
`target_role is not null and target_roles is null` da 0 y que no hay
clientes viejos en la calle: sin la columna, esas misiones se leerían como
«para todos» y las de adultos saldrían en la pantalla de la peque.

Verificado en el SQL Editor el 15-ago: los once índices `idx_%_family%`
están, y `titulos_con_marca = 1`.

**Ese 1 es el número correcto, no un déficit.** En las 119 misiones del
catálogo solo hay DOS cuyo título concuerda con quien la hace, y las dos
llevan ya su marca: «Vestirse {solo|sola|sin ayuda}» y «Resolver un
problema {solo|sola|sin ayuda}». La familia tiene activada la primera y
no la segunda, que es semanal y de la junior. Las demás son infinitivos
(«Recoger juguetes», «Poner servilletas»): no hay nada con lo que
concordar. Cuidado con los falsos amigos —«Higiene completa», «Limpieza
completa de inodoros»— donde el adjetivo concuerda con el sustantivo, no
con la persona: marcarlos sería un error.

Para volver a comprobarlo, en el SQL Editor. **No uses el patrón
`idx_%_family%`**: deja fuera `idx_challenges_skill` y esconde justo la
mitad de cada comparación de redundancia.

```sql
select count(*) as titulos_con_marca from public.challenges where title like '%{%|%|%}%';
select indexname, indexdef from pg_indexes where schemaname = 'public'
  and indexname like 'idx_%' order by indexname;
```

Las migraciones son idempotentes: volver a ejecutar `007` y `008` no hace
daño. La app degrada con aviso concreto si falta alguna, no se rompe.

Comprobación rápida del esquema desde fuera, sin sesión:

```bash
U=$VITE_SUPABASE_URL; K=$VITE_SUPABASE_ANON_KEY
curl -s -o /dev/null -w '%{http_code}\n' "$U/rest/v1/profiles?select=gender&limit=1" \
  -H "apikey: $K" -H "Authorization: Bearer $K"   # 200 = la columna existe
```

---

## 3. Lo que hay que saber para no romper nada

### El despliegue no usa GitHub Actions

El token de `gh` de esta máquina tiene scopes `gist, read:org, repo`, **sin
`workflow`**: no puede subir ficheros de Actions. Por eso se compila en
local y se publica en la rama `gh-pages`:

```bash
npm run deploy                              # compila, publica, etiqueta
npm run rollback -- --lista                 # ver versiones
npm run rollback -- deploy-2026-08-15-0813  # volver a una
```

Si algún día hace falta CI/CD: `gh auth refresh -s workflow` (interactivo,
lo tiene que hacer el usuario) y montar el workflow. Los scripts seguirán
sirviendo como salida de emergencia.

**Ese mismo `npm run deploy` es el que actualiza elgremioapp.com**: el
dominio no cambió quién sirve el sitio, solo cómo se llama. No hay un
segundo despliegue a Hostinger, ni FTP, ni nada que subir a mano.

### El dominio va dentro de la build, en `public/CNAME`

Cada publicación **vacía la rama `gh-pages`** antes de copiar la build. Si
el `CNAME` viviera suelto en esa rama, el primer despliegue lo borraría,
GitHub daría el dominio por retirado y elgremioapp.com dejaría de
responder hasta que alguien lo volviera a escribir a mano en Settings.
Por eso vive en `public/`, lo copia Vite, y `prepararDist` **aborta** si
no lo encuentra en `dist/`. `urlDePages()` lee ese mismo fichero, así que
despliegue, `health` y QR no pueden discrepar sobre cuál es la URL buena.

### El repo tiene que ser público

GitHub Pages en repositorio privado exige plan de pago. Es seguro porque el
código **no contiene ni un dato familiar**: nombres, emojis y colores se
introducen en el asistente y viven en Supabase con RLS. Mantener esa
propiedad: nunca meter nombres reales en el repo, ni en fixtures ni en
ejemplos de documentación.

### Cada cambio de esquema se escribe dos veces

En `schema.sql` (fuente de verdad completa, para bases nuevas) **y** en un
`migracion-00N-<tema>.sql` idempotente (para la base que ya existe). Las
dos, siempre. Detalle en `docs/RUNBOOK.md` §6b.

### Se puede trabajar sin Supabase

```bash
npm run dev:demo
```

Backend simulado en `localStorage` (`src/lib/fakeBackend.js`). Sirve para
desarrollar y para verificar la interfaz en un navegador sin tocar datos
reales. **Cuidado**: si añades una columna con `default` en el esquema,
hay que replicarla en `DEFECTOS_TABLA` del backend simulado. Ya pasó una
vez: sin el `status` por defecto, las estrellas de la peque se insertaban
sin estado y no se aprobaban nunca.

---

## 3b. La lista de arquitectura, revisada

Punto por punto sobre la lista clásica de "detalles que se descubren
demasiado tarde", con lo que aplica de verdad a ESTA app.

| Punto | Estado | Detalle honesto |
|---|---|---|
| Connection pooling | ✅ lo pone la plataforma | El cliente habla por HTTP con PostgREST; no abre conexiones a Postgres. Supabase pone Supavisor delante. Nada que hacer aquí. |
| Capa de caché | ✅ hecho a la medida | Validar disparaba realtime en dos tablas y provocaba 3 recargas completas de 7 tablas por acción. Ahora se agrupan en 250 ms y no se solapan: 2 por acción (una inmediata para que la interfaz responda, otra de confirmación). |
| Índices | ✅ migración 008 | Faltaban cinco, y los que había no cubrían la ordenación. A esta escala no arregla ninguna lentitud: es seguro para cuando haya dos años de historial. |
| Manejo de errores real | ✅ hecho | `mensajeDeError` traduce, `operacion` registra con id de petición, y ninguna acción se traga un fallo en silencio. |
| CDN | ✅ lo pone la plataforma | GitHub Pages sirve por CDN. Las fuentes, por Google Fonts. |
| Escalado horizontal | ➖ no aplica | Frontend estático y backend gestionado. No hay servidor propio que escalar. |
| Pruebas de carga | ⚠️ traducidas | Simular 100 usuarios en una app de cuatro no dice nada. Lo que importa son las CARRERAS: `npm run prueba:concurrencia` lanza validaciones, canjes y deshaceres simultáneos contra la base real y comprueba que la XP se abona una sola vez. Requiere la cuenta familiar y **aún no se ha ejecutado**. |
| Logs y monitoreo | ✅ hecho | JSON estructurado con id de petición, tabla `app_logs`, captura de errores globales y pantalla de Estado. |

El riesgo real de este proyecto no está en esa lista: es que el plan
gratuito de Supabase pause el proyecto, y que la novedad se apague en la
semana tres.

## 4. Arquitectura y decisiones, con su porqué

- **Una sola cuenta de autenticación para toda la familia**, perfiles
  internos estilo consola. Las niñas no necesitan ni deben tener cuentas.
- **El PIN parental no es seguridad**: SHA-256 en cliente, cerrojo doméstico
  dentro de la sesión. Documentado como tal; no cambiar el discurso.
- **La clave `anon`/`publishable` es pública por diseño** y va en el bundle.
  Lo que protege los datos es RLS. La `service_role` no sale del panel.
- **La peque recibe la estrella al momento**, sin validación: a los tres
  años la recompensa diferida no funciona. Es una excepción deliberada, no
  un descuido.
- **Su pantalla rompe a propósito con el diseño del resto** (papel crema y
  colores saturados frente al tablero nocturno). No busca combinar, busca
  que reconozca su sitio al encenderlo.
- **Siempre debe quedar una persona adulta activa.** Sin esa invariante
  nadie valida y el gremio se queda sin salida desde la propia app.
- **Las bajas son retiradas, no borrados**: borrar arrastra en cascada
  historial, canjes e insignias, y con ellos la XP aportada a metas ya
  cerradas.
- **Sin servidor propio**: todo lo que en una arquitectura clásica viviría
  en el backend (límite de ritmo, health, retención) está en Postgres, que
  es el único punto que no se puede saltar desde la consola del navegador.
- **Habilidades, no tareas** (agosto 2026). Cada misión entrena una de ocho
  competencias. No es cosmética: es lo que separa un sistema que aguanta de
  uno que se apaga en la semana tres. Razonado en
  `docs/FUNDAMENTO-CIENTIFICO.md` con seis referencias.
- **El tutorial son dos bloques, no uno.** «Por qué funciona así» (seis
  pasos) y «Dónde está cada cosa» (cinco). En el primer arranque van
  seguidos; se saltan de una vez y se reabren por separado desde ⚙️ →
  Evidencia. Se marca como visto también al saltarlo, a propósito.
- **El elogio específico no puede costar un toque más.** Cada sugerencia ES
  el botón de validar. Si alguna vez se convierte en un formulario aparte,
  se dejará de validar y el sistema entero se cae.
- **Los títulos del catálogo son los que escribió la familia, literales.**
  `tests/catalogo.test.js` los fija uno a uno: si alguien "mejora" un
  nombre, el test cae. Para cambiarlo hay que tocar las dos partes, a
  propósito. Como algunos títulos son sustantivos ("Encimera", "Ejercicio"),
  cada tarea puede llevar un campo `a` con la acción en infinitivo, que es
  lo que usan las frases de elogio.
- **Concordancia de género con tres formas, nunca con arroba ni barra.**
  `{masculino|femenino|neutra}` en `src/lib/genero.js`. La neutra va
  reescrita, no es "solo/a": tiene que poder leerse en voz alta, porque a
  la peque le leen la pantalla. Hay un test que recorre catálogo, rangos,
  insignias, roles y elogios comprobando que ninguna marca se quedó con
  dos formas: si se queda con dos, quien no ha dicho su género acaba
  leyendo el masculino.
- **Un cambio de plantilla no toca lo ya guardado.** Los títulos viven en
  la base, así que cambiar el catálogo no cambia las misiones existentes:
  hace falta un UPDATE en la migración. Pasó con "Vestirse sola".
- **Nada animado puede montarse dentro de una rama condicional del
  `return`.** La luz ambiental del fondo estaba en cada rama; al cambiar
  de pantalla React la desmontaba, la animación CSS volvía a cero y el
  fondo saltaba casi cien píxeles. Eso era el «parpadeo». Se monta una
  vez, por encima de `contenido()`, y hay tests en `tests/fondo.test.js`
  que fijan esa estructura exacta.
- **Nada de `background-attachment: fixed`.** Safari de iOS lo repinta
  mal al hacer scroll. El degradado vive en `.ambiente`, que se promueve
  a capa propia con `translateZ(0)`.
- **Nunca animar un elemento con `filter: blur()`.** La luz ambiental
  eran tres capas de ~400 px con `blur(80px)` en movimiento, y encima hay
  19 reglas de `backdrop-filter` que vuelven a muestrear ese fondo en cada
  cuadro: el móvil perdía cuadros y se veía como un tintineo. Ahora las
  manchas son `radial-gradient` que se desvanecen a transparente (misma
  suavidad, coste cero) y la deriva es la mitad de larga. También hay un
  grano finísimo encima para romper el bandeado, que al desplazarse muy
  despacio se percibe como titileo aunque no falte ningún cuadro.
- **Si el fondo vuelve a dar guerra**, hay dos banderas en ⚙️ → Estado:
  `luzEnMovimiento` (la deja quieta, conservando el color que el cristal
  necesita) y `luzAmbiental` (la apaga entera). No hace falta desplegar.
- **La peque tiene tarro y tienda propios.** Sus monedas se dibujan como
  estrellas (una por misión, `MONEDAS_POR_ESTRELLA = 5`) y solo se le
  enseñan premios de nivel 1. Dos decisiones que conviene no deshacer: el
  tarro **no** se vacía cada día (el contador de la cabecera sí, y esa
  diferencia es a propósito), y los premios que no alcanza **se ven
  apagados** en vez de esconderse, porque ver lo que viene es lo que
  sostiene la espera.
- **La economía está derivada, no puesta a ojo.** `src/lib/economia.js`
  declara los supuestos (60 % de adherencia, 5 misiones activas, cadencias
  de 2 / 7 / 30 días por nivel y 12 días por meta) y de ahí salen las
  bandas de precio. Medición inicial: el nivel 3 caía en 11-18 días en vez
  de 30, y la meta en 4,4 días en vez de 12. Hay tests que fallan si
  alguien cambia los puntos de las misiones y descuadra la cadencia. El
  panel ⚙️ → Estado enseña el diagnóstico con las misiones ACTIVAS reales:
  activar quince misiones por persona dispara la economía aunque los
  precios sean correctos.
- **La pulsación mantenida no puede depender de requestAnimationFrame.**
  Un `setTimeout` decide cuándo se completa y rAF solo pinta la barra: con
  la pestaña en segundo plano rAF se congela y el gesto se quedaba a
  medias. Vive en `src/lib/mantenerPulsado.js`.

---

## 5. Mapa del código

```
schema.sql                 Fuente de verdad del esquema (tablas, RLS, funciones, realtime)
migracion-00N-*.sql        Migraciones idempotentes para bases ya creadas
src/lib/supabase.js        Cliente, economía, insignias, plantillas, traducción de errores
src/lib/acciones.js        Acciones de dominio con registro y mensajes presentables
src/lib/habilidades.js     Las 8 competencias, progreso y rangos
src/lib/elogio.js          Sugerencias de elogio específico y rachas
src/lib/premios.js         Catálogo de recompensas por nivel
src/lib/temporadas.js      Rango del gremio, subida de precios por temporada
src/lib/insignias.js       Las 16 insignias, sus clases y sus poderes
src/lib/meritos.js         Lo que cada persona lleva hecho (racha, hitos)
src/lib/resumen.js         Cifras del cuadro de mando parental
src/lib/rachas.js          Hitos del camino, racha viva y qué falta cobrar
src/lib/latido.js          Cuándo late el avatar de la peque, y cuándo deja de latir
src/lib/evidencia.js       Principios y referencias
src/lib/miembros.js        Reglas de alta, edición y baja de perfiles
src/lib/pin.js             Reglas del PIN parental
src/lib/tareas.js          Catálogo doméstico por roles, sin puntos
src/lib/log.js             Registro JSON con redacción de credenciales
src/lib/monitoring.js      Captura y agrupación de errores; adaptador de Sentry
src/lib/flags.js           Banderas de funcionalidad
src/lib/fakeBackend.js     Backend simulado del modo demo
src/components/Poderes.jsx Poderes activos y pantalla de gastarlos
src/screens/Cuadro.jsx     Cuadro de mando del panel (detrás del PIN)
src/screens/FichaPeque.jsx «Mi ficha» de la peque, sin un solo número
src/components/CaminoRacha.jsx  Racha con hitos y cobro automático
src/screens/               Login, Onboarding, Tutorial, ProfilePicker, Home, KidHome,
                           ParentPanel, Ajustes (Miembros · PIN · Dispositivos ·
                           Evidencia · Estado)
scripts/                   deploy, rollback, publicar, health-check, secrets-check,
                           qr, prueba-concurrencia
supabase/functions/health/ Edge Function de salud (escrita, NO desplegada)
docs/RUNBOOK.md            Diagnóstico, logs, ritmo, health, rollback, migraciones
docs/ROTACION-SECRETOS.md  Calendario y procedimiento de rotación
docs/PROMPT-SUPABASE.md    Instrucciones para recrear el backend con un asistente
docs/FUNDAMENTO-CIENTIFICO.md  Por qué el sistema es así, con referencias
SPEC.md                    Especificación; fuente de verdad del producto
```

---

## 6. Qué está hecho y verificado

Verificado **en navegador**, no solo compilando:

- Flujo completo de la peque: un toque → completion aprobada al momento,
  XP y monedas abonadas, celebración, contador de estrellas.
- Salida por pulsación mantenida (1,5 s) con barra de progreso.
- Panel parental con PIN, validación de misiones, Estado del sistema.
- Miembros: alta, rechazo de nombre duplicado, retirada, sección de
  retirados, y el guardarraíl del último adulto (la base no cambió).
- Un dispositivo que recordaba un perfil retirado vuelve al selector.
- Editar las misiones de la peque desde la pestaña Peque del panel
  (5 lápices, formulario completo, XP de 10 a 25 guardada).
- Panel de equilibrio con el diagnóstico en vivo, que detectó por su
  cuenta que la meta vieja de 600 XP «se consigue demasiado rápido».
- Cambio de PIN completo: PIN actual erróneo rechazado, PIN nuevos que no
  coinciden, aviso de PIN trivial, cambio correcto, y después el PIN viejo
  ya no abre el panel y el nuevo sí **sin recargar la página**.
- Los dos QR (el de la app y el imprimible) decodificados con
  `BarcodeDetector`: devuelven exactamente la URL esperada.
- Zonas seguras simuladas (iPhone 15 Pro vertical 59/34 px, horizontal
  59 px laterales, Android 24/24): ningún contenido bajo la barra de
  estado ni bajo el indicador de inicio, en las cinco pantallas.
- 360, 375, 834 y 844×390 px sin scroll horizontal; ningún objetivo
  táctil por debajo de 44 pt; rótulos de pestaña en una sola línea.
- Contraste medido en 13 pares de color: todos por encima de 4,5:1.
- Tienda de la peque de punta a punta: 40 monedas → 8 estrellas → pide el
  cuento (6) → quedan 12 monedas y 2 estrellas, canje creado, y los cuatro
  premios pasan a apagados con su progreso parcial a la vista.
- Deshacer en los tres sitios: mantener pulsada la baldosa (XP 10→0 y
  monedas 5→0, incluso con rAF congelado), «Hecho hoy» en el panel
  (XP 20→10) y cancelar una petición pendiente.
- Concordancia de género en las tres formas sobre el mismo título
  guardado: «Vestirse sola / solo / sin ayuda».
- El fondo ya no reinicia su animación al cambiar de pantalla: el reloj
  avanza sin cortes (12862 → 15862 → 16862 → 17862 ms) con una sola capa.
- Build servida en la raíz de elgremioapp.com con las rutas correctas
  (antes, bajo `/el-gremio/`; las dos con el mismo código).
- RLS real: escritura anónima rechazada con `42501`.

---

## 7. Trampas conocidas

- **El plan gratuito de Supabase pausa el proyecto tras 7 días sin
  actividad.** Es el fallo más probable de todos. Se reactiva a mano desde
  el panel, tarda un par de minutos, y no hay forma de automatizarlo.
- **Un rollback de frontend no deshace una migración de esquema.** Si el
  problema es del esquema, hay que revertirlo a mano en el SQL Editor.
- **`purge_logs(30)` no se ejecuta solo.** Correrlo cada pocos meses.
- **Los logs se envían por lotes cada 5 s**; un cierre brusco puede perder
  los últimos, aunque hay vaciado en `pagehide`.
- **Sin modo offline.** Sin red la app no funciona.
- Los emoji del selector de miembros son una lista fija en `EMOJIS`
  (`src/lib/supabase.js`); si alguien quiere otro, hay que añadirlo ahí.
- **No se ha podido probar en un iPhone real**: este Mac no tiene Xcode
  completo, así que el simulador de iOS no arranca. Las zonas seguras se
  verificaron simulando los insets en Chrome, lo que cubre la geometría
  pero no el render real de la barra de estado. Para probarlo de verdad:
  instalar Xcode y `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- **`idx_challenges_skill` e `idx_profiles_family_active` sostienen el
  RLS entero.** Desde la migración 009 son los únicos índices por
  `family_id` de sus tablas, y `family_id` es la columna por la que filtra
  la política `familia_miembro`, o sea, todas las lecturas de la app. Sus
  nombres suenan a caso particular («skill», «active») e invitan a
  borrarlos en una limpieza; si algún día se hace, hay que crear ANTES el
  índice simple por `family_id`. Primero el create, después el drop.
- **El orden importa en `styles.css`**: las reglas de `@media` para el
  modo peque tienen que ir DESPUÉS de las reglas base, porque comparten
  especificidad y gana la última. Ya se coló un bug así con la altura de
  las baldosas en horizontal.

---

## 7b. Lo que se hizo el 15 de agosto (tarde)

Sesión larga. Por orden, y lo que hay que saber de cada cosa:

**Observabilidad.** `redactar` tiraba `code`, `details` y `hint` de los
errores de PostgREST; ahora los conserva. Los éxitos dejaron de
registrarse con el nombre del evento de error (`*.error` → `*.ok`): ocho
«mision.deshecha.error» eran ocho deshaceres correctos. Y los errores
globales guardan `fichero`, `linea`, `columna` y `ajeno`, que sirvió el
mismo día para localizar un `ReferenceError` en dos minutos.

**Índices.** Retirados `idx_profiles_family` e `idx_challenges_family` por
redundantes (migración 009). **Los que quedan sostienen el RLS entero**:
ver la trampa en §7.

**Habilidades.** Las 16 misiones sin `skill` quedaron asignadas
(migración 010). Las ocho competencias tienen misiones activas.

**Misiones por rol** (`target_roles[]`, migraciones 011 y 013). Una misión
puede ir a una persona, a un rol o a un grupo («Los peques y la junior»).
El predicado vive SOLO en `src/lib/misiones.js`; antes estaba copiado en
cinco ficheros. Queda pendiente y comentado el `drop column target_role`.

**Pantalla de la peque.** Tres minijuegos que rotan por fecha (globos,
estrellas, bichitos), tira del siguiente premio siempre visible, y fiesta
al completar todas las misiones del día. El juego da una estrella al día,
con el tope en un índice único de Postgres: en el cliente, recargar daría
globos infinitos.

**Validación.** «Todavía no» pide motivo obligatorio y quien la hizo lo ve
en rojo en su tablero, solo ese día.

**Historial.** Progreso enseña una semana cada vez con navegación hacia
atrás. Nada se borra: archivar es salir de la vista.

**Economía, recalculada dos veces.** Cadencias de premio a 15/30/45 días y
meta a 60. Presupuesto de carga subido de 5 a 8 (la familia quería 6-7
diarias), lo que obligó a subir los precios un 60 %. Topes por persona:
**7 diarias, 5 semanales, 8 mensuales**, con aviso en la pestaña Misiones
para quien se pase. La peque salió del sistema de niveles: su tienda
filtra por precio (`TECHO_PEQUE`), porque con nivel 1 a 15 días su premio
más barato le quedaba a dieciocho.

**Premio a mano** (migración 014): monedas por algo excepcional, sin XP,
con motivo obligatorio y registro de qué adulto lo concede. Las tres
reglas se comprueban en Postgres, no solo en el formulario.

**Temporadas e insignias con poder**: modelo construido y con tests
(`src/lib/temporadas.js`, `src/lib/insignias.js`). Se cableó esa misma
noche; ver §7c.

---

## 7c. Lo que se hizo el 15 de agosto (noche): temporadas cableadas

Las temporadas dejaron de ser un modelo suelto y ya funcionan de punta a
punta. Verificado en el navegador, no solo compilando.

**El sello del gremio** (rango + metas logradas + XP de por vida) va
ENCIMA de la barra de la meta, y el bloque sobrevive a que no haya meta
activa. Las dos cosas son la misma decisión: la barra se vacía al cerrar
una meta, y si con ella desaparecía el rango, cerrar una meta se sentía
como perder el progreso, que es justo lo que las temporadas venían a
arreglar. Se vio abriendo la app, no leyendo el código.

**Cerrar la meta cierra la temporada**, y eso son tres cosas: la insignia
🏰 para el gremio, «Mano derecha» que cambia de dueño (se calcula ANTES de
cerrar, porque al marcarla lograda ya no hay contra qué medir), y la
subida de precios. La subida **se pregunta, no se aplica sola**, con el
ejemplo concreto en el aviso: una tienda que sube sola de precio se siente
como una trampa aunque el motivo sea bueno. **Los premios al alcance de la
peque (≤ `TECHO_PEQUE`) quedan fuera**: ella no va por temporadas, va por
distancia, y gana lo mismo cada día pase lo que pase, así que subirle el
precio no le añade dificultad, le quita el premio.

**Los dos poderes gastables hacen algo de verdad:**

- El **comodín** tapa un día en el cálculo de la racha
  (`rachaMaxima` en `src/lib/meritos.js`). Sin eso sería un botón que
  gasta un uso y no cambia nada, que es peor que no tenerlo.
- La **voz de mando** CREA la misión, dentro de la misma transacción que
  gasta el uso (`spend_power`). Aparece en el tablero de quien la recibe
  como una misión única más, sin una línea de interfaz nueva. En dos
  llamadas desde el navegador, un fallo de red entre medias habría dejado
  el uso gastado y a nadie encargado de nada.

**Los otros dos poderes NO se anuncian todavía** (`PODERES_LISTOS` en
`insignias.js`): `monedas_x` tendría que multiplicar lo que abona
`resolve_completion`, que vive en Postgres y no sabe nada de insignias, y
`abre_premio` necesita que un premio pueda tener dueño, columna que
`rewards` no tiene. El modelo se queda escrito y probado, pero enseñar un
×1,25 que no llega a las monedas sería mentirle a quien se lo ha ganado.

**Los méritos se calculan, no se guardan** (`src/lib/meritos.js`): racha
máxima histórica, habilidades tocadas, validadas antes de las nueve, quién
aporta más a la meta. Nada de contadores en `profiles`: se
desincronizarían el día que alguien deshace una misión, y deshacer aquí es
una operación normal, no una excepción.

**Repaso de código sin usar, y ahora es repetible con `npm run muertos`.**
El detector (`scripts/muertos.mjs`) separa tres clases: muerto de verdad,
vivo solo en los tests, y exportado de más. Se validó contra la versión
anterior del panel: señalaba `PremioAMano` y nada más, que era justo el
fallo. Lo que salió y qué se hizo:

- **`BADGES` en `supabase.js`**: el catálogo viejo de 8 insignias
  sobrevivió a la mudanza a `insignias.js` (16) sin que lo usara la app…
  pero **sí lo usaba el test de género**. O sea que las ocho insignias
  nuevas nunca se habían revisado. Retirado, y los dos tests apuntan ya al
  catálogo bueno.
- De ahí salió un fallo de contenido real: **«Pionera»** se la lleva quien
  primero llega al nivel 10, que en esta casa puede ser el padre. Marcada
  como `{Pionero|Pionera|Quien abrió camino}`, igual que «Completo». Ojo:
  las DESCRIPCIONES se pintan sin `flex`, así que se reescribieron para no
  necesitar marca («Nadie del gremio llegó antes al nivel 10»). Si algún
  día se marca una desc, hay que pasarla por `flex` en `Home.jsx` o se
  leerá el `{a|b|c}` en crudo.
- **La cuenta de usos de un poder estaba copiada a mano** en
  `Poderes.jsx`. Ahora sale de `usosRestantes`, que es también la que usa
  `usosDisponibles`. Una copia de una regla es una regla que se
  desincroniza.
- Borrados por muertos: `ICONOS`, `MONEDAS_DEL_JUEGO` (alias de
  `MONEDAS_POR_ESTRELLA`) y `limpiarContexto`.
- `reiniciarDemo` estaba exportada y era inalcanzable justo desde el único
  sitio donde sirve. Ahora el modo demo expone `window.gremio.reiniciar()`
  y `window.gremio.volcar()`, que ahorran editar `localStorage` a mano.
- `techoDe` y `techoFamiliar` NO se borraron: son el cálculo con el que se
  dimensionó la meta del gremio. Se fijaron con tests, porque un modelo
  que nadie ejecuta se pudre sin que nadie se entere.

Quedan diez en la clase «solo tests» y son correctos: modelo escrito por
delante de la interfaz (temporadas, poderes sin cablear) y ayudantes de
los propios tests. `npm run muertos` solo sale con error si aparece algo
en la clase A.

**Cuadro de mando en el panel parental** (`Cuadro.jsx` + `resumen.js`),
sexta pestaña. Por persona: misiones asignadas por frecuencia, hechas hoy
y esta semana, aportación a la meta, premios entregados y en camino,
pendientes de validar, devueltas de la semana y el aviso de carga.

Dos decisiones que conviene no deshacer:

- **El reparto de la meta es UNA barra con segmentos, no una barra por
  persona.** Cuatro barras enfrentadas son una clasificación, y esta app
  no tiene ranking a propósito. Por lo mismo, las fichas van ordenadas por
  rol y nunca por lo aportado: quien mira el panel de noche lee el primer
  nombre como «el que va ganando».
- **Vive detrás del PIN y no se asoma a ningún tablero.** Para un adulto
  la comparación es información —quién carga con todo, quién lleva una
  semana sin aparecer—; entre hermanas es otra cosa.

Comprobado a 360 px: seis pestañas, ninguna etiqueta partida ni cortada,
sin scroll horizontal.

**La peque tiene su propia ficha**, en su idioma y sin un solo número
(`FichaPeque.jsx`): siete casillas de lunes a domingo con estrella en los
días que hizo algo, sus estrellas de la semana, la barra del gremio sin
cifras y sus premios con emoji. Se abre tocando su propio avatar —el
gesto más descubrible para quien no lee— y **solo se ve a sí misma**.

Tres detalles que costaron y conviene no deshacer:

- **El futuro se dibuja distinto de lo fallado.** Un día que aún no ha
  llegado pintado como hueco se lee como un suspenso, así que va en
  discontinuo y atenuado.
- **El día hecho lleva el oro DE FONDO y la estrella oscura encima.** Con
  la estrella dorada sobre el papel crema el contraste era de 1,6:1 y la
  marca que sostiene la pantalla no se veía; ahora 6,83:1.
- **`.kid-premio` ya existía en su tienda**: las clases de la ficha van
  con prefijo `kid-ficha-`. Un nombre repetido habría roto la otra
  pantalla, que es donde nadie habría mirado.

**Camino de rachas al estilo Duolingo** (`rachas.js` + `CaminoRacha.jsx`),
en la pestaña Progreso de adultos y junior. Hitos a 3, 7, 14, 21, 30, 50 y
100 días, con lo logrado, lo que falta y el cobro automático.

Cuatro decisiones que sostienen todo lo demás:

- **Cada hito se paga UNA VEZ EN LA VIDA, no una por racha.** Si no,
  romper la racha a propósito cada semana sería la forma más rentable de
  jugar. Lo garantiza un índice único en Postgres.
- **La racha la verifica `claim_streak`, no el cliente.** La pantalla que
  dibuja el contador no puede ser también la que lo certifique. El importe
  también lo decide la base: si viajara como argumento, el tope no sería
  un tope.
- **Hoy no rompe la racha hasta que se acaba el día.** Marcarla rota a
  mediodía sería castigar por adelantado; en su lugar sale el aviso «hoy
  todavía no», que es lo que hace levantarse.
- **El cobro es automático, sin botón de reclamar.** Un botón deja sin
  premio a quien no lo pulsa y convierte la recompensa en un examen de
  atención.
- Las cifras están dimensionadas contra `economia.js`: el camino entero
  paga 445 monedas en cien días, ~11 % de lo que gana la junior en ese
  tiempo y solo si no falla ni un día. Hay un test que lo fija y otro que
  compara la tabla de hitos con el `case` de Postgres.

**El latido del avatar de la peque** (`latido.js`): señala el gesto de
abrir su ficha, que no tenía ninguna pista visual, y **se apaga solo** en
cuanto lo abre tres veces o a los diez días. Una animación permanente deja
de comunicar en dos días y pasa a ser ruido. Con `prefers-reduced-motion`
no desaparece: se queda el halo quieto, porque quitarla del todo dejaría
sin pista justo a quien más la necesita.

**El tutorial se puso al día** con todo lo anterior: un paso nuevo, «La
racha y las temporadas», en el bloque del porqué, y actualizados los de
Progreso, la pantalla de la peque, el panel (Cuadro, Devuelto hoy, monedas
a mano, subida de precios) y el de deshacer. Los dos bloques comparten las
mismas listas, así que el tutorial del arranque y el que se reabre desde
⚙️ → Evidencia quedan iguales sin tocar dos sitios.

**El premio a mano estaba escrito y sin enganchar.** El componente
`PremioAMano` existía entero desde la sesión anterior, `GestionPremios`
tenía hasta su `useState`, pero nadie lo renderizaba: funcionalidad
completa e invisible, que es la peor clase de código muerto porque no
salta en ningún test ni en el build. Ahora está en Panel → Premios, en el
botón «🪙 Monedas a mano». Merece la pena buscar más casos así: un
`grep` de cada componente exportado contra su uso real.

Detalles menores del mismo pase: el nombre de una insignia llevaba un
carácter chino colado («完 Completo»), corregido; el backend simulado no
tenía el `grant_manual_bonus` de la 014, así que el premio a mano no se
podía probar en demo; y las insignias son **16**, no 17 como decía este
documento.

---

## 7d. La exposición pública (15 de agosto, noche)

`public/narrativa/index.html`: una página estática autocontenida que
cuenta el sistema entero —el problema, las ocho habilidades, el bucle del
día, el elogio como control, las dos monedas y la curva de nivel, los
topes por persona, la economía con sus cifras medidas, la pantalla de la
peque, las temporadas, los siete principios, las seis referencias, las
ausencias deliberadas y una comparativa con BusyKid, Greenlight, Homey,
OurHome, Habitica y Sweepy.

**Todas sus cifras salen de ejecutar `src/lib/economia.js`, no de citarlo
de memoria.** Se hizo así después de meter la pata: la primera versión del
gráfico daba como objetivo las cadencias ORIGINALES (2/7/30/12) en vez de
las vigentes (15/30/45/60). Si se vuelven a tocar los supuestos, hay que
volver a ejecutar el modelo y actualizar la página; no hay test que las
ate, y ese es su punto débil conocido.

Vive en `public/` y **no** en el bundle a propósito: no necesita React ni
sesión, así que se puede pasar a alguien de fuera sin que entre en el
gremio. Enlazada desde ⚙️ → Evidencia con `BASE_URL`, igual que el QR.

Tres cosas que conviene saber si se toca:

- **Las fuentes van incrustadas como data-URI** (subconjunto latino de
  Fredoka y Nunito, ~90 KB). No es capricho: sin CDN la página se sostiene
  sola, y sirve igual dentro de un Artifact con CSP estricta. El fichero
  pesa 149 KB en total.
- **La luz ambiental usa `radial-gradient`, nunca `filter: blur()` en
  movimiento.** Es la misma lección que costó cara en la app (§4).
- **Un solo tema, el nocturno, y declarado explícitamente.** No hay bloque
  `prefers-color-scheme`: una versión clara sería otro producto.

- **Lleva su propia salida** (16-ago). Dentro de la app instalada en el
  móvil no hay barra de navegador: quien abría la página desde ⚙️ →
  Evidencia se quedaba encerrado en ella, sin nada que pulsar para volver.
  Ahora hay un enlace fijo arriba a la derecha, «← Volver a la app», que
  apunta a `../` —la raíz del sitio— y por tanto vale igual dentro de la
  app que para quien llegue de fuera por el QR. Va **sin
  `backdrop-filter`** a propósito: el fondo de esta página se mueve, y un
  cristal fijo encima obliga a remuestrearlo en cada cuadro, que es la
  lección de §4. Comprobado en el navegador: 44 px de alto, fijo tras
  3.000 px de scroll, 13,4:1 de contraste, y el clic aterriza en la app.

**OJO con `~/el-gremio-narrativa/`: es un borrador viejo, no el fuente.**
Este documento decía que ahí vivía el original con marcadores de fuente;
comparados hoy, difieren en 406 líneas —esa copia es anterior al pase de
estilo del texto—. **La fuente de verdad es
`public/narrativa/index.html`**, que es además lo que se publica. Editar
la copia de fuera sería trabajar para nadie.

---

## 7e. De una familia a muchas (15 de agosto, cierre)

Repaso completo con una pregunta distinta: **qué se rompe el día que esto
no sea la app de una casa.** La app funciona —416 tests, build limpio,
`health` en verde—, así que lo de aquí abajo no son fallos de hoy: son
supuestos de «una sola familia» incrustados en sitios donde no se ven.

Van en orden de lo que muerde primero.

### Lo que descubrió la propia migración al ejecutarse

El paso 0 —la comprobación de cuentas con más de un gremio, escrita
pensando que era una formalidad— **paró la migración: había una de
verdad.** No era un supuesto teórico, era el estado de la base.

Y contaba una historia entera. Una segunda cuenta se había dado de alta
ese mismo día y tenía DOS gremios idénticos creados con diez segundos de
diferencia, los dos con sus perfiles y los dos con **cero misiones, cero
premios y cero meta**. O sea: el alta le falló justo después de crear los
perfiles, dos veces seguidas y de la misma manera, se quedó con dos
cascarones vacíos y no volvió a entrar.

La causa más probable es que a esa hora el bundle publicado iba por
delante de la base: las migraciones 010 a 016 se ejecutaron esa misma
tarde, y el alta escribe columnas que hasta entonces no existían. Ese
hueco ya está cerrado —se comprobó con un ensayo que mete las cinco
escrituras del alta contra el esquema real dentro de una transacción que
termina en excepción, así que no deja ni una fila—, pero la lección no es
esa. La lección es que **desplegar el frontend y ejecutar la migración son
dos actos separados, y entre uno y otro la app está rota para quien entre
por primera vez**. La familia que ya está dentro no lo nota.

Se retiró solo el duplicado, con una sentencia que se negaba a borrar si
el gremio hubiera tenido cualquier contenido.

### Lo que se arregló esta noche

**1. `families` no tenía índice por `owner`.** Todas las políticas RLS del
esquema terminan en la misma subconsulta —`select id from families where
owner = auth.uid()`—, así que sin ese índice cada petición de cada
dispositivo recorre la tabla de familias entera. Con una dentro cuesta
cero; con cien mil, lo pagan todas las casas en cada toque. Es el cuello
de botella número uno y se arregla con una línea (migración 017).

**2. Una cuenta podía tener dos gremios, y la app carga con `limit 1` sin
orden.** Postgres devuelve el que quiera: la familia abre la app y ve su
gremio vacío. No es hipotético: el alta son cinco inserts encadenados y
quien reintente tras un fallo a mitad se deja un gremio fantasma detrás.
Ahora el índice es ÚNICO y la carga va ordenada por fecha.

**3. Los logs sin familia no tenían ningún límite.** `rate_guard` se rinde
cuando la familia es nula y la política de `app_logs` admite familia nula
a propósito (hay errores anteriores a saber de qué casa es la sesión).
Entre las dos decisiones razonables quedaba el hueco: cualquier cuenta
registrada —y registrarse lo hace cualquiera desde la propia app— podía
insertar filas sin tope con el `jsonb` que quisiera dentro. Y no salían:
`purge_logs` corría con RLS, así que una fila sin familia no la veía ni la
borraba nadie. Ahora hay una cuenta por CUENTA (`user_limits`, 60/h), el
`datos` desmesurado se recorta a 8 KB y `purge_logs` es `security definer`
—barre huérfanas incluidas— y ya no la puede llamar la app.

**4. `profiles`, `rewards` y `family_goals` se insertaban sin freno.** Solo
cuatro tablas tenían límite de ritmo. Ahora hay topes de cordura por
gremio (15 perfiles, 120 premios, 500 metas, 600 misiones) y longitud
máxima en todo lo que escribe el cliente. No es antifraude: es lo que
evita que una cuenta llene la base de la que dependen las demás casas.

**5. No había forma de recuperar la contraseña.** Ni enlace, ni pantalla,
ni nada: la única llave de un gremio entero, sin repuesto. Con una familia
lo resuelve el llavero del móvil; con mil cuentas es el ticket de soporte
número uno y además irreparable desde fuera. Ahora está el bucle completo
—«He olvidado la contraseña» → correo → pantalla de contraseña nueva— y
verificado en el navegador de punta a punta.

Y con él, el hermano callado del mismo problema: **`signUp` devuelve
`error: null` y `session: null` cuando el proyecto pide confirmar el
correo**, así que el alta dejaba la pantalla EXACTAMENTE igual que antes de
pulsar. Nadie se enteraba de que había un correo en camino. Ahora lo dice.
Las reglas están en `src/lib/acceso.js` con sus tests; la pantalla solo
pinta.

### El panel de Supabase, que también tenía lo suyo

Al configurar la vuelta del correo apareció lo que habría dejado la
recuperación en papel mojado: **el «Site URL» seguía siendo
`http://localhost:3000`**, el valor por defecto que trae un proyecto
recién creado. Es el destino de CUALQUIER enlace de correo que no
coincida con la lista de permitidas, y la lista estaba vacía. Un enlace
de recuperación habría llevado a una dirección que no existe en el móvil
de quien lo abriera.

Queda así (16-ago):

```
Site URL       https://elgremioapp.com/                 (16-ago, con la mudanza)
Redirect URLs  https://elgremioapp.com/**
               https://drraulferrer.github.io/el-gremio/**   (dirección vieja,
                          se deja por los correos que ya salieron con ella)
               http://localhost:5173/**          (para npm run dev)
Contraseña     mínimo 8 (era 6, que es el mínimo que deja Supabase)
```

Y lo que sigue abierto ahí dentro, por orden de importancia:

- ~~**«Confirm email» está APAGADO**~~ **RESUELTO el 16-ago**: encendido,
  una vez que el SMTP propio subió el tope a 30 correos/hora. Estaba
  apagado a propósito hasta entonces, porque con el remitente por defecto
  de Supabase —un puñado de correos por hora para TODO el proyecto—
  encenderlo habría convertido el alta en una cola. Ese era el orden
  correcto y se respetó: SMTP propio primero, confirmación después. Ver
  §7i.
- **El registro está abierto a cualquiera y sin captcha.** El captcha pide
  cuenta de hCaptcha o Turnstile y su clave secreta, así que es una
  decisión con dueño, no un interruptor.
- «Prevent use of leaked passwords» solo está en el plan Pro.

### Lo que queda, y por qué no se ha tocado

**6. Las fechas están clavadas en `Europe/Madrid`.** Lo están en Postgres
(`bonuses.dia`, `claim_streak`) mientras el cliente usa la hora del
dispositivo (`dayKey`). Para una familia en Madrid las dos coinciden y no
se nota nada. Para una familia en México, el día del servidor y el del
móvil se separan siete horas: la estrella diaria de la peque se puede
pedir dos veces o ninguna, y una racha viva se lee como rota. Es el fallo
más feo de la lista porque **da resultados incorrectos en silencio**.
Arreglarlo pide una decisión, no solo código: una columna `timezone` en
`families`, elegida en el alta, y pasarla por todos los sitios donde hoy
hay una zona escrita a mano. Tanda propia.

**7. Nadie puede ver los errores de nadie.** `app_logs` está bajo RLS por
familia, que es lo correcto para la privacidad y deja al operador ciego:
si mañana falla el alta de trescientas casas, no hay una sola consulta que
lo diga sin la clave de servicio. Hace falta una vista agregada y anónima
(cuenta por evento y por día, sin `family_id`) o encender Sentry, que está
escrito y apagado en `monitoring.js`.

**8. Lo legal es un bloqueo real, no un trámite.** Esto guarda nombres y
actividad diaria de menores de edad. Para una familia con su propia cuenta
de Supabase es un cuaderno privado; publicado y abierto a registro es
tratamiento de datos de menores: hace falta política de privacidad,
términos, base legal del consentimiento parental, y —esto sí es código—
**exportar y borrar la cuenta entera desde la app**. Hoy no existe ninguna
de las dos cosas. Nada de lo demás importa si esto no está.

**9. El alta no es transaccional.** Cinco inserts encadenados sin vuelta
atrás. El índice único del paso 2 convierte el reintento en un error
claro, que es mejor que un gremio fantasma, pero lo correcto es una
función `security definer` que funde el gremio entero o no funde nada.

**10. Cosas de plataforma, en cuanto haya volumen.** El plan gratuito de
Supabase pausa el proyecto a los 7 días sin actividad (con muchas familias
deja de ser un riesgo y pasa a ser un coste: hay que pagar plan). Cada
dispositivo abre una conexión de realtime y el plan tiene tope. El bundle
son 580 KB en un solo trozo sin trocear, y no hay modo sin conexión: sin
red, la app no funciona. Ninguna de las cuatro se arregla escribiendo
mejor código; se arreglan decidiendo cuánto se paga.

**11. La app solo habla español, y la economía está calibrada para una
casa concreta** (dos adultos, una junior, una peque, 60 % de adherencia).
Los números de `economia.js` son honestos porque están medidos contra ESTA
familia. Otra familia con otro ritmo no los rompe, pero tampoco los
hereda.

---

## 7f. Lo que se hizo el 16 de agosto: licencia, zona horaria y borrado

Tres piezas que no añaden juego y sin las cuales esto no se le puede
enseñar a nadie de fuera. Salen del repaso de la competencia
(`docs/COMPETENCIA.md`) y del plan de negocio, que vive **fuera del repo**
en `~/el-gremio-negocio/` porque este es público y allí hay precios.

**1. El repo era público y no tenía `LICENSE`**, o sea, «todos los
derechos reservados»: cualquiera podía leerlo y nadie podía usarlo. Es lo
contrario de lo que promete la exposición pública. Ahora es **AGPL-3.0**:
quien despliegue esto como servicio tiene que publicar sus cambios, y la
frase «si esto se cierra, tus datos salen contigo y el código sigue siendo
de todos» pasa a ser cierta en vez de una intención. Es también la
respuesta a lo que le pasó a OurHome, que es el argumento comercial más
fuerte que tiene el proyecto.

**2. La zona horaria vive en la familia** (migración 018). Hasta ahora
Postgres contaba en `Europe/Madrid` y el navegador en la hora del aparato,
y nadie comparaba las dos. Con la familia en Madrid coinciden; con la
familia en México se separan siete horas y entonces la estrella diaria se
puede pedir dos veces o ninguna, y una racha viva se lee como rota.

- `families.timezone`, validada contra `pg_timezone_names` con un
  disparador (un `check` no puede consultar una tabla) y **detectada en el
  alta, no preguntada**: el alta ya tiene cuatro pasos y nadie se equivoca
  al decir en qué país vive. Se cambia en ⚙️ → Datos, que es cuando
  importa: una mudanza.
- En el cliente, `configurarZona()` se llama **una vez, al cargar la
  familia**, y `dayKey`/`weekKey`/`monthKey` mantienen su firma. Así no
  hubo que tocar un solo sitio de llamada, que eran veintitantos.
- El formato de `dayKey` sigue **sin ceros a la izquierda** a propósito:
  hay claves comparadas con él por toda la app y el juego de globos casa
  el `dia` de Postgres contra eso.

**3. Se puede llevar los datos y borrar la cuenta** (⚙️ → Datos). Las dos
son obligación legal en cuanto esto lo use alguien que no sea esta casa
—aquí hay actividad diaria de menores— y las dos son, además, el argumento
de venta del punto 1.

- La copia es un JSON con las nueve tablas de la familia. **No lleva el
  hash del PIN** (hay un test que lo comprueba) y **no lleva `app_logs`**:
  son diagnósticos, no historia de la familia, y ahogarían el fichero.
- El borrado es `delete_my_account()`, `security definer`, **sin
  argumentos**: no acepta ningún identificador de fuera, así que no hay
  forma de pedir el borrado de otra cuenta. Se lleva el gremio (y en
  cascada todo lo demás) y después la fila de `auth.users`, que es lo que
  una Edge Function haría con una clave de servicio guardada en algún
  sitio. Aquí no hace falta ni la CLI ni la clave.
- Para confirmar hay que escribir el nombre del gremio, y se acepta sin
  acentos ni mayúsculas: la confirmación existe para obligar a mirar la
  lista de lo que se pierde, no para ganar un examen de mecanografía.

Verificado en el navegador de punta a punta en modo demo: alta con
`timezone` puesta sola, descarga del JSON (4 miembros, 20 misiones, 7
premios, 1 meta, sin PIN dentro) y borrado que deja el almacén a cero y
devuelve a la pantalla de entrada. 441 tests, `muertos` en cero.

---

## 7g. El arranque dejó de ser un tutorial y pasó a ser un setup (16 de agosto)

Once diapositivas antes de haber visto nada, y después un tablero idéntico
para todo el mundo con las misiones que escribió UNA familia. Las dos
mitades del problema se arreglan con lo mismo: **preguntar**.

Ahora el alta son **ocho pasos con barra de progreso** (nombre, miembros,
cuatro preguntas, PIN, resumen), al estilo de los onboarding de Deepstash
y compañía. Cada pregunta lleva debajo el principio que la sostiene, así
que **se aprende el sistema configurándolo** en vez de leyéndolo:

| Pregunta | Qué construye |
|---|---|
| ¿Qué queréis que cambie primero? (hasta 3) | Las habilidades de las que salen las misiones |
| ¿Cuánto abarcáis la primera semana? | 3, 5 o 7 misiones por persona |
| ¿Qué funciona en vuestra casa? | Qué llena la tienda |
| ¿Qué queréis conseguir juntos? | El título de la meta |

**El plan vive en `src/lib/setup.js` y no toca la red**, que es lo que
permite fijarlo con tests (26). Cuatro decisiones que conviene no
deshacer:

- **Reparto por turnos entre las habilidades elegidas.** «Las N primeras
  que coincidan» daba cinco misiones del primer foco y ninguna de los
  otros dos: la familia contestaba tres veces y solo se usaba una.
- **El suelo de tres premios de nivel 1 se aplica DESPUÉS y el recorte
  respeta el nivel.** Cortar por la cola a siete deshacía el suelo, y
  quien contestaba «planes fuera» acababa con dos. Salió en un test, no
  en la pantalla.
- **La cifra de la meta no se pregunta**: sale de `metaObjetivo()` con los
  roles reales, para que caiga alrededor de los 60 días con dos personas
  o con seis.
- **Es determinista.** El resumen que se enseña antes de fundar tiene que
  ser exactamente lo que se funda.

**Y de paso se arregló el fallo que estaba anotado en §8 como "un detalle
que va a morder", que era peor de lo que decía:** no es que los premios
se guardaran con el nivel equivocado, es que **ninguno del catálogo cabía
en la tienda de la peque**. Su tienda filtra por precio (`TECHO_PEQUE`,
72 monedas) y el premio más barato cuesta 325: a cinco monedas al día,
trece días. Su tarro se llenaba de estrellas y su tienda salía vacía.
Ahora, si hay peque en casa, el setup crea **sus** premios (15 a 55
monedas) y la tienda de los demás filtra al revés (`premiosParaMayores`),
o en el tablero de la junior serían gratis. El ámbito lo marca el precio
porque `rewards` no tiene columna de dueño; el día que la tenga —la misma
que hace falta para `abre_premio`— esto se sustituye por lo evidente.

**Lo que se retiró**, para que no queden dos formas de sembrar un gremio:
`ARRANQUE_TITULOS` y `misionesDeArranque` (tareas.js), `PREMIOS_INICIALES`
(premios.js) y `META_INICIAL` (supabase.js). Los tests que los defendían
ahora defienden lo mismo sobre el setup. `npm run muertos` en cero.

**El tutorial largo no ha desaparecido**: se lee entero desde ⚙️ →
Evidencia y sigue abriéndose solo en un dispositivo NUEVO de una familia
que ya existe, que es donde de verdad hace falta. Lo que ya no hace es
salir después del setup —se marca visto al fundar— porque sería contar
por segunda vez lo que se acaba de contestar. Ojo con el detalle que
costó verlo: marcar la bandera no basta, hay que apagar también el estado
de `App.jsx`, que se calculó en el primer render.

---

## 7h. Emojis de premio (16 de agosto)

Había **doce** escritos a mano dentro del formulario, y con doce todos los
premios de una casa acaban pareciéndose. Importa más de lo que parece:
en la tienda de la peque el emoji es **lo único que se ve** —ahí no hay
texto ni cifras—, así que dos premios con el mismo dibujo son, para ella,
el mismo premio.

Ahora son **88 de premio y 107 de misión**, en ocho grupos cada uno
(`src/lib/emojis.js`), con nombre en castellano y sinónimos de andar por
casa («peli» además de «película»). El mismo selector
(`components/SelectorEmoji.jsx`) sirve en los tres sitios que llevan
emoji:

- **Premios** y **meta del gremio** usan el catálogo de premio: una meta
  es un premio compartido, no una tarea.
- **Misiones** usa el suyo, agrupado **por las ocho habilidades** y no por
  zona de la casa, que es la misma decisión que gobierna el resto del
  sistema: lo que se entrena no es la tarea, es la competencia.

Cuatro decisiones:

- **El nombre no es documentación, es el buscador.** Con ochenta y ocho,
  agrupar no basta: quien crea un premio sabe cuál es, lo que no sabe es
  en qué grupo lo hemos metido nosotros. Se busca por «piscina», «abuela»
  o «peli», sin acentos y sin mayúsculas.
- **El emoji se sugiere al escribir el título** y deja de sugerirse en
  cuanto alguien elige uno a mano; al editar algo que ya existe no se
  sugiere nunca, que su emoji ya lo decidió alguien. Gana la palabra más
  larga que case y, **en caso de empate, la que aparece más tarde**:
  «Limpiar el inodoro» es 🚽 y no 🧽, porque en castellano el objeto va
  detrás del verbo y es el objeto el que manda.
- **La caja tiene altura máxima y se desplaza dentro.** Sin eso el
  formulario medía tres pantallas y el botón de guardar no se veía.

Hay dos tests de cobertura, uno por catálogo: si un premio de
`CATALOGO_PREMIOS` o una tarea de `CATALOGO` usa un emoji que no está en
su rejilla, editarlo desde el panel lo cambiaría sin querer, porque no
habría ninguno marcado. El de premios saltó a la primera con 🍽️ y 🌟.

---

## 7d. Avisos push (16-ago) · MONTADO ENTERO

Cadena completa y comprobada de punta a punta. Lo único que falta no es
código: que cada persona active los avisos en su móvil desde Ajustes →
🔔 Avisos, **con la app instalada desde el dominio nuevo** (una suscripción
push pertenece al origen, así que la instalación vieja de
`drraulferrer.github.io` no vale).

### Lo que ya está

- `public/sw.js` — service worker. No cachea nada a propósito: una caché
  mal puesta sirve una versión vieja durante días y se diagnostica fatal
  desde el sofá. Busca la ventana por `registration.scope`, no por una
  ruta fija, así que sobrevivió a la mudanza a dominio propio.
- `src/lib/push.js` — permiso, suscripción y alta en la base.
- `src/screens/Avisos.jsx` — Ajustes → 🔔 Avisos. Se enciende por aparato.
- **Migración 019, ejecutada y comprobada**: `push_subs` (aparatos, no
  personas: la clave es el endpoint), `push_log` (índice único
  perfil+día = el tope de uno al día), la vista `push_pendientes` con
  `security_invoker` y `streak_days`, que saca la cuenta de la racha de
  dentro de `claim_streak` para que haya UNA sola definición.
- `supabase/functions/notificar/` — la función de envío y su banco de
  mensajes, con tests que rechazan cualquier frase que riña y cualquier
  marca de género.
- Claves VAPID generadas y guardadas en `.env` (fuera de git).

### Lo que quedó montado en el panel (16-ago)

- **Función `notificar` desplegada** desde el editor del navegador, con
  `index.ts` y `mensajes.ts`. **«Verify JWT» está en OFF** a propósito: se
  protege con un secreto propio en la cabecera, y así el cron no tiene que
  llevar encima la clave de servicio. Comprobado: sin cabecera responde
  401, con ella reparte.
- **Los cuatro secretos** puestos (`VAPID_PUBLIC`, `VAPID_PRIVATE`,
  `VAPID_SUBJECT`, `GREMIO_CRON_SECRET`). Sus valores están en `.env`,
  fuera de git.
- **Cron `gremio-avisos`, cada hora en punto** (`cron.job` lo confirma). El
  fichero `supabase/cron-notificar.sql` lleva `<SECRETO>` como marcador
  porque el repositorio es público: al reejecutarlo hay que sustituirlo.

Prueba de humo hecha: `?forzar=1` (salta la franja de la tarde, pero NO el
tope de uno al día) devolvió `candidatos: 2, avisados: 2, enviados: 0`,
correcto porque aún no hay ningún aparato suscrito. **Esas dos filas de
`push_log` se borraron después**: dejarlas habría silenciado el aviso real
de ese día. Si se vuelve a probar, hay que volver a limpiarlas:
`delete from public.push_log where dia = current_date and enviados = 0;`

### El primer envío real (16-ago, 10:58) · FUNCIONA

Los dos iPhone de los adultos activaron los avisos y quedaron en
`push_subs` (`web.push.apple.com`, `activa`, `fallos = 0`). Un `?forzar=1`
devolvió `candidatos: 2, avisados: 2, enviados: 1` y **la notificación
llegó al móvil**: la cadena base → Apple → teléfono está probada, que era
lo único que quedaba por ver.

Ese `enviados: 1` con dos avisados **no es un fallo**, y conviene saber
leerlo o el día que pase de verdad se buscará donde no es: los dos
candidatos eran la junior y una adulta; la adulta tiene aparato y lo
recibió, la junior todavía no tiene el suyo activado, así que su aviso se
apuntó y no salió a ninguna parte. Se distingue mirando `push_subs`: un
envío fallido deja `fallos` a 1, y ahí los dos siguen a cero.

**A media mañana entró el tercer aparato, el de la junior** (11:17), y con
la función ya corregida recibió el suyo: `avisados: 1, enviados: 1`. Los
tres teléfonos de la casa están dentro y los tres han recibido algo de
verdad. Cuidado con el orden, que es el que puede confundir: su fila de
`push_log` de esa mañana era anterior a tener aparato, y **una fila así
silencia el aviso del día aunque el teléfono ya esté puesto**. Hubo que
borrarla (`enviados = 0`) para que el reparto volviera a contar con ella.

**Lo que sí destapó el envío fue un fallo de contenido**: a la junior, con
un día de racha, la frase compuesta era «**1 días seguidos**». Cuatro de
las cinco plantillas de `racha_riesgo` interpolaban `${n} días` sin forma
singular; el banco de `sin_validar` sí la cuidaba. Arreglado con `dias()`
y `diasSeguidos()`, con un test que recorre `todasLasPlantillas()` y
rechaza «1 días» y «1 misiones». **El test podría haberlo cazado desde el
primer día**: `todasLasPlantillas()` ya pintaba cada frase con `n = 1` y
nadie miraba el resultado.

**Redesplegada y comprobada el mismo día.** Las Edge Functions no salen
del `npm run deploy` ni se despliegan solas: se pegan en el editor del
panel (esta máquina no tiene CLI de Supabase). Y la comprobación no fue
leer el editor, sino esta, que sirve para cualquier cambio futuro de los
mensajes: **la función escribe en `push_log.titulo` la frase que compone**,
así que basta con borrar la fila del día, volver a lanzarla y leer la
columna. Salió «**1 día seguido**», con su acento. De paso quedó probado
que el tope aguanta: a la adulta ya avisada la saltó con
`saltados: ["Carol: ya avisado hoy"]` en vez de mandarle un segundo aviso.

**La trampa de los acentos también vive en el editor de Edge Functions, no
solo en el SQL Editor.** El primer pegado dejó el fichero lleno de
`d√≠as`, `ni√±a` y `G√âNERO`: el UTF-8 llega leído como MacRoman. El
remedio es el mismo de §2 —copiar el fichero pre-codificado en MacRoman
para que el viaje lo deshaga— y **hay que mirar el resultado antes de
pulsar Deploy**, porque el editor pinta la basura tan tranquilo:

```bash
python3 -c "import subprocess;s=open('supabase/functions/notificar/mensajes.ts',encoding='utf-8').read();subprocess.run(['pbcopy'],input=s.encode('mac_roman'))"
```

**Y una ventana en la que un aviso no llega a nadie, descubierta al
repetir el test.** Una consulta devolvió de pronto **dos aparatos de Raúl
y ninguno de Irene**, y un minuto después uno por persona. No era un
fallo: el teléfono de la junior tenía seleccionado el perfil de un adulto
en ese momento, y `apuntarPerfil` **reasigna la suscripción al cambiar de
perfil**, que es justo lo que se quiere en una tablet compartida. El envío
cayó dentro de esa ventana, así que Irene se quedó sin aparato y su aviso
se apuntó en `push_log` sin salir a ninguna parte.

Consecuencia práctica, que no es teórica: **si el móvil de alguien se
queda con otro perfil abierto, esa persona deja de recibir avisos y el
otro los recibe por duplicado**, y el rastro no lo delata —`fallos` sigue
a cero, porque no hubo ningún envío fallido—. Se diagnostica mirando de
quién es cada fila de `push_subs` AHORA, no de quién la creó:

```sql
select p.name, to_char(s.created_at at time zone 'Europe/Madrid','HH24:MI') as alta,
       s.ultimo_ok, s.fallos
from public.push_subs s join public.profiles p on p.id = s.profile_id
order by s.created_at;
```

Con cada aparato en su sitio, el test se repitió y salió limpio:
`avisados: 1, enviados: 1`, con la adulta ya avisada saltada por el tope.

### Decisiones que conviene no deshacer

- **Se apunta en `push_log` ANTES de enviar.** Al revés, un fallo a mitad
  dejaría el día sin apuntar y el cron de la hora siguiente escribiría
  otra vez a quien ya recibió el aviso. Perder un aviso es molesto; mandar
  dos es lo que hace que se silencie la app.
- **El «a quién y por qué» vive en SQL** (`push_pendientes`), no en la
  función: así se corrige desde el editor sin volver a desplegar.
- **Los mensajes pican, no riñen.** Hay un test que rechaza «has fallado»,
  «llevas X sin» y compañía. Otro prohíbe marcas de género, porque la
  función no pasa por `flex` y llegarían como `{a|b|c}` al móvil.
- **La peque no recibe avisos.** A los tres años el teléfono no es suyo.
- La franja es de 17 a 20 en **hora de la familia** (`families.timezone`),
  no del servidor.

---

## 7i. La mudanza a elgremioapp.com (16 de agosto)

El dominio y un plan de correo se compraron en Hostinger. **Lo que NO se
compró es alojamiento**, y está bien así: el sitio lo sigue sirviendo
GitHub Pages y Hostinger solo pone el nombre. Comprar hosting habría
significado subir ficheros por FTP en cada cambio y perder el despliegue
versionado con etiquetas y rollback, que es justo lo que hace que esto se
pueda tocar sin miedo.

**DNS en Hostinger** (nameservers `*.dns-parking.com`, sin tocar):

```
A     @    185.199.108.153 · .109.153 · .110.153 · .111.153   (GitHub Pages)
CNAME www  drraulferrer.github.io
```

Se retiró el `A @ → 2.57.91.91`, que era la página de aparcamiento. Los
cuatro A con el mismo nombre son lo correcto aquí, aunque el panel avise
de que «puede dejar tu web inaccesible»: son las cuatro entradas del CDN
de GitHub.

**En GitHub**: dominio tomado del `CNAME` de la build, certificado emitido
para el ápice y para `www`, y **HTTPS forzado** (`https_enforced`, que hay
que encender aparte y no se enciende solo).

Lo que se comprobó desde fuera, ya en verde: `https://elgremioapp.com/`
responde 200 con el `version.json` del despliegue de hoy, `www` redirige
al ápice, `/narrativa/` responde 200 y **la dirección vieja
`drraulferrer.github.io/el-gremio/` redirige sola al dominio nuevo**, así
que los QR impresos y los enlaces que ya circulan siguen valiendo.

Tres cosas que conviene saber, y que muerden en este orden:

- **Todo el mundo tiene que volver a entrar.** La sesión de Supabase vive
  en el `localStorage` del ORIGEN, y el origen cambió: los dispositivos de
  casa aparecen deslogueados aunque nadie haya cerrado sesión. No es un
  fallo. Lo mismo vale para el perfil recordado en cada aparato.
- **Quien tuviera la app instalada desde la dirección vieja tiene que
  volver a instalarla.** Un PWA queda atado al origen donde se instaló, y
  ese origen ahora redirige fuera de su ámbito.
- **Ninguna de estas dos cosas se toca con «Reset DNS records»**, que
  devuelve la zona al estado de aparcamiento y se lleva por delante el
  sitio y el correo a la vez. Es el único botón peligroso de esa página.

**IPv6 puesto** el mismo día: los cuatro `AAAA` de GitHub Pages
(`2606:50c0:800{0,1,2,3}::153`), que conviven con los `A` sin más.

**El correo del dominio quedó dado de alta** (plan Starter Business Email
de Hostinger, buzón `noreply@elgremioapp.com`), y con él sus registros:
`MX` a `mx1`/`mx2.hostinger.com`, SPF, tres `CNAME` de DKIM, `_dmarc` en
`p=none` y los `autodiscover`/`autoconfig`. Todos comprobados desde
fuera. Que el remitente pueda ir en la **raíz** del dominio es un efecto
de la mudanza: el plan viejo pedía un subdominio `send.` porque
`raulferrer.org` ya enviaba correo y un dominio solo admite un SPF;
`elgremioapp.com` no envía nada más, así que ese rodeo sobra. La receta
al día está en `docs/CORREOS.md`.

**El SMTP propio quedó encendido y probado el mismo día.** Un
`POST /auth/v1/recover` contra la app publicada contestó 200 y el correo
llegó **al instante y a la bandeja de entrada, no a spam**, remitido por
`noreply@elgremioapp.com` y con el `redirect_to` apuntando a
`https://elgremioapp.com/`. Que el remitente sea ese y no
`noreply@mail.app.supabase.io` es la prueba de que salió por Hostinger y
no por el remitente por defecto de Supabase.

Los tres puntos que quedaban de aquí están **cerrados el 16-ago**:

1. ✅ **Las plantillas, en español.** Las tres de `docs/CORREOS.md`,
   pegadas y guardadas (poder editarlas es, de paso, la prueba de que el
   SMTP propio quedó activo: sin él Supabase las bloquea).
2. ✅ **El enlace del correo, probado de verdad** por la familia: abre la
   pantalla de contraseña nueva, no el tablero. O sea que la Redirect URL
   es correcta y la cadena entera —petición, SMTP, plantilla, enlace,
   pantalla— funciona de punta a punta.
3. ✅ **«Confirm email» encendido**, que es lo que §7e dejaba esperando a
   tener SMTP propio. Comprobado el tope en Authentication → Rate Limits:
   **30 correos/hora**, que es el que trae el SMTP propio y ahora también
   consumen las altas.

**Lo que cambia a partir de ahora**: toda alta nueva exige confirmar el
correo antes del primer acceso. `signUp` ya devolvía `session: null` en
ese caso y la pantalla lo dice (§7e), así que no hay nada que tocar en el
código; pero si algún día alguien «se registra y no puede entrar», la
respuesta es esa y no un fallo. El alta de prueba, si se hace, tiene que
ir con un correo distinto al de la familia, crea un gremio de verdad y hay
que borrarlo después (desde la 017, una cuenta solo puede tener uno).

---

## 7e. Correo propio y dominio (16-ago)

**El dominio ya estaba al día** cuando lo revisé: `Site URL` y las
`Redirect URLs` de Supabase apuntan a `https://elgremioapp.com`. Las
referencias a `drraulferrer.github.io` que quedan en el repo son
históricas a propósito —comentarios que explican por qué el código es como
es, y un test que fija el comportamiento de cuando colgaba de
`/el-gremio/`—, así que no se tocan.

**La redirect URL vieja se deja puesta a propósito.** Mientras alguien
tenga instalada la app antigua en el móvil, quitarla le rompería un
cambio de contraseña a mitad. Se retira cuando todos los aparatos estén
reinstalados desde el dominio nuevo.

`VAPID_SUBJECT` pasó a `mailto:noreply@elgremioapp.com`, en `.env` y en
los secretos de la Edge Function (comprobado por el digest: cambió de
`95ba2615…` a `b3a06df1…`).

### SMTP y plantillas: hecho

Authentication → Emails → SMTP Settings: remitente
`noreply@elgremioapp.com`, nombre «El Gremio», `smtp.hostinger.com`,
puerto 465, usuario la dirección completa. **La contraseña la escribió una
persona**: manejar contraseñas ajenas no entra en lo que hace el agente,
ni siquiera para pegarlas en el panel de su dueño. Ese sigue siendo el
reparto si algún día hay que rotarla.

Las **tres plantillas de `docs/CORREOS.md` están pegadas y guardadas** —
«Confirma tu gremio», «Tu contraseña del gremio» y «Confirma tu correo
nuevo»—, comprobado que el cuerpo es el nuestro y que conserva
`{{ .ConfirmationURL }}`. Que se dejaran editar es, de paso, la prueba de
que el SMTP propio quedó activo: sin él Supabase las bloquea.

**Dos trampas de esta prueba, que costaron un rato:**

1. **Un correo pedido ANTES de guardar las plantillas llega con la
   plantilla vieja**, en inglés, aunque el remitente ya sea el propio. Es
   lo que pasó: había cuatro `/recover` en los logs, unos anteriores a
   guardar y otros posteriores, y Gmail los agrupa por asunto en hilos
   distintos. Si algo «no se ha aplicado», mira la HORA del correo contra
   la del guardado antes de tocar nada.
2. **Comprobar el editor recién pegado no prueba que se haya guardado.**
   Leer la página después de pegar devuelve lo que uno mismo acaba de
   escribir. Hay que RECARGAR y volver a leer; es la única lectura que
   viene de la base.

**Prueba de humo hecha y correcta el 16-ago**: `POST /auth/v1/recover`
devolvió 200, los Auth Logs registraron `/recover · request completed` sin
error de SMTP, y el correo llegó bien —remitente, asunto, formato y
enlace—. Un error de contraseña, puerto o host habría salido en ese log en
vez de un «completed»; es el sitio donde mirar si algún día deja de
llegar.

Para repetirla sin pasar por la app, con el mismo `redirectTo` que usa
`Login.jsx`:

```bash
curl -s -X POST \
  "$VITE_SUPABASE_URL/auth/v1/recover?redirect_to=https%3A%2F%2Felgremioapp.com%2F" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"<la cuenta>"}'
```

**El `redirect_to` va en la QUERY, no en el cuerpo.** GoTrue lo lee de la
URL y en el JSON lo ignora en silencio: el enlace sale igualmente, pero
apuntando al «Site URL». Comprobado el 16-ago mandando uno con
`{"redirect_to":"http://localhost:5173/"}` dentro del cuerpo —una
dirección que está en la lista de permitidas, así que no la filtró nadie—
y el correo llegó con `redirect_to=https://elgremioapp.com/`. Hoy los dos
valores coinciden y por eso el fallo no se nota; el día que se pruebe un
destino distinto (localhost para depurar, una rama), el enlace se iría al
sitio equivocado y parecería un problema de Redirect URLs.

---

## 7f. La dirección buena sale del CNAME, no del origen (16-ago)

Hasta ahora Dispositivos calculaba la URL del origen del navegador. Con
un solo sitio publicado eso valía; con la mudanza dejó de valer, y de una
forma que no salta a la vista: **la dirección vieja sigue redirigiendo,
así que la app abierta desde ahí funciona igual**, pero esa pantalla
ENSEÑA la dirección a los demás. Un QR impreso o una URL copiada desde un
aparato con la PWA vieja propagaba la dirección heredada a gente nueva.

Ahora la fuente de verdad es `public/CNAME`, que es donde ya vivía la
decisión: `vite.config.js` lo lee y lo mete en el bundle como
`__DOMINIO__`, y `src/lib/dominio.js` decide. En local sigue mandando el
origen real, o un QR de `npm run dev` no serviría para probar nada.
Fijado en `tests/dominio.test.js`, incluido el caso de que un dominio
público no se confunda con uno local (`localhost.attacker.com`).

Si algún día se vuelve a publicar bajo subcarpeta, borrar el CNAME
devuelve el comportamiento antiguo sin tocar código.

**Trampa de desarrollo:** `/narrativa/` **no funciona con `npm run dev`**.
El servidor de Vite no sirve el índice de un directorio de `public/`: cae
en el fallback de la SPA y devuelve la app otra vez, así que el enlace
parece roto justo cuando vas a comprobarlo. En producción GitHub Pages sí
resuelve el directorio. Por eso `urlDeLaNarrativa()` pide
`narrativa/index.html` en local y la dirección corta fuera.

**Dónde se ve la exposición, por orden de visibilidad:** en la pantalla de
entrada (delante de la sesión, que es lo primero que ve quien abre el
dominio), en ⚙️ → Dispositivos con su botón de copiar enlace, y en
⚙️ → Evidencia. Estaba solo en la última, que son cinco toques y un PIN.

---

## 8. Pendientes

### El correo ya no está pendiente

La cadena entera está hecha y probada: dominio, buzón, SMTP propio, las
tres plantillas en español, el enlace de recuperación abierto de verdad
y «Confirm email» encendido (§7i). Si algún día un correo deja de llegar,
el sitio donde mirar es **Authentication → Auth Logs** —un fallo de SMTP
sale ahí en vez de un «request completed»— y después el tope de 30/hora
en Rate Limits.

### Lo primero al retomar: los avisos en los móviles

**Activar Ajustes → 🔔 Avisos en cada teléfono, con la app reinstalada
desde elgremioapp.com.** Un PWA queda atado al origen donde se instaló, y
el viejo ahora redirige fuera de su ámbito: sin reinstalar, la suscripción
push no vale. Es lo único que le falta a una funcionalidad que ya está
montada y comprobada de punta a punta.

### Y después: mirar el cuadro de mando con datos reales

Un par de semanas de uso **antes de añadir nada más**. El diagnóstico de
economía y el cuadro de mando parental están para eso, y con datos reales
dicen lo que ninguna sesión de código puede adivinar: si la carga está
repartida, si alguien lleva una semana sin aparecer y si las cadencias de
premio se parecen a las calculadas. Añadir funciones antes de esa lectura
es decidir a ciegas.

### Y lo segundo: desplegar y migrar dejaron de ser dos actos sueltos

Lo de §7e —una familia que se quedó fuera porque el bundle iba por delante
del esquema— no se arregla con código, se arregla con orden: **la
migración va SIEMPRE antes del `npm run deploy`**, nunca después. Merece
una línea en el propio `deploy.mjs` que avise si hay un `migracion-0NN`
más nuevo que la última etiqueta de despliegue.

### Los dos poderes que faltan por cablear

Ninguno es urgente y los dos tocan sitios delicados:

- **`monedas_x`**: multiplicar las monedas al validar exige tocar
  `resolve_completion`, que es la función que usa toda la app. Haría falta
  una tabla de consulta con el factor por insignia (el catálogo vive en
  JavaScript y Postgres no lo ve) y hacerlo en su propia tanda.
- **`abre_premio`**: `rewards` necesitaría una columna de dueño y la
  tienda, filtrarla.

Hasta entonces siguen sin dibujarse, que es lo correcto.

### Lo demás al retomar: preguntar, no suponer

Tres cosas que un agente **no puede comprobar desde fuera** y que
condicionan todo lo demás:

1. **¿Se creó ya la cuenta familiar y se fundó el gremio?** Requiere
   registrar cuenta y teclear contraseña, así que lo hace la familia. Sin
   eso, la app enseña el asistente de alta.
2. **¿Lo están usando de verdad?** De la respuesta depende qué merece la
   pena tocar: si llevan dos semanas usándolo, lo siguiente es mirar el
   diagnóstico de economía con datos reales, no añadir funciones.

Ya no hay nada pendiente en la base: las quince migraciones están
ejecutadas y comprobadas.

### Un detalle que mordía, ya arreglado

La tienda de la peque salía vacía con el tarro lleno de estrellas. La
causa real no era el nivel del premio sino el precio: su tienda filtra por
`TECHO_PEQUE` (72 monedas) y el premio más barato del catálogo cuesta 325.
Resuelto en el setup (§7g): si hay peque, se le crean premios a su alcance
y la tienda de los demás filtra por encima de ese techo.

**En el gremio que ya está en producción esto NO se arregla solo**, porque
su tienda se creó antes. Hay que crearle tres o cuatro premios de 15 a 55
monedas desde Panel → Premios.

### Escrito pero no activado

- **Edge Function de health**: está en `supabase/functions/health/`, sin
  desplegar. Requiere la CLI de Supabase. Solo hace falta si se quiere un
  monitor externo tipo UptimeRobot.
- **`npm run prueba:concurrencia`**: escrito y sin ejecutar nunca. Necesita
  `GREMIO_EMAIL` y `GREMIO_PASSWORD` de la cuenta familiar, crea una misión
  temporal, comprueba la atomicidad y limpia lo que creó.
- **Sentry**: adaptador listo en `monitoring.js`, apagado. Sin
  `VITE_SENTRY_DSN` no se carga nada ni sale un byte hacia terceros.
  Instrucciones en `docs/RUNBOOK.md` §3.

### Nadie entrena la creatividad

Tras la migración 010 las 19 misiones tienen habilidad, pero el reparto
deja una competencia a cero: **creatividad**. No es un fallo de etiquetado,
es que no existe ninguna misión que la entrene. El catálogo tiene
candidatas listas —«Dibujar», «Juego libre sin pantallas»— y activarlas es
cosa de dos toques en Misiones. Mientras tanto, esa rama del progreso por
competencias no se mueve nunca, y una barra que nunca sube desmotiva más
que no tenerla.

### Huecos reales del producto

- **Cuarto rol** (un adolescente que ya no encaja en "junior"): implica
  cambiar el `check` de `profiles.role` y decidir su comportamiento.
- **`npm audit` marca 5 vulnerabilidades** (vite, vitest, esbuild). Todas
  afectan al **servidor de desarrollo local**, no al bundle publicado, que
  es HTML y JS estático servido por GitHub Pages. Arreglarlas exige subir a
  vite 7 y vitest 3, que son cambios con rotura: hacerlo en su propia tanda
  y volver a verificar, no de paso en otra tarea.
- **Rotación de credenciales**: fijada el 15-ago-2026, toca el **13 de
  noviembre de 2026**. `npm run secrets:check` avisa.

### Backlog de producto (SPEC §9, por valor estimado)

1. Rachas con "protector de racha" para la junior.
2. Resumen semanal del gremio (XP, misiones, gráfico simple).
3. Rotación mensual sugerida de misiones desde la biblioteca.
4. Foto opcional como evidencia al pedir una misión.
5. Notificaciones push (requiere service worker).
6. Modo offline básico con cola de peticiones.
7. Exportación CSV del historial.
8. Ajuste estacional de dificultad (vacaciones frente a curso).

El riesgo real del producto **no es técnico sino motivacional**: el decaimiento
de la novedad hacia la semana 3 o 4. Las contramedidas ya integradas son la
validación en un toque, la meta cooperativa renovable, los premios reales y
las plantillas para rotar sin esfuerzo. Si en octubre la app está abandonada,
el sitio por donde atacar es ese, no el rendimiento.

---

## 9. Credenciales

`~/el-gremio/.env`, **fuera de git** (verificado con `git check-ignore`).
Contiene la URL del proyecto, la clave pública, la fecha de rotación y la
URL publicada para `npm run health`.

Si se pierde ese fichero: los dos valores se recuperan del panel de Supabase
(*Project Settings → API*). Nada más es secreto en este proyecto.

---

## 10. Arrancar a trabajar

```bash
cd ~/el-gremio
npm install          # si es una máquina nueva
npm test             # 190 tests, deben pasar
npm run dev:demo     # trastear sin tocar producción
npm run dev          # contra la Supabase real
```

Antes de dar nada por terminado:

```bash
npm run verify       # tests + build + revisión de credenciales
npm run deploy
npm run health
```

---

## 7j. Auditoría de producción masiva (16 de agosto)

Repaso del correo en el dominio nuevo y de todo lo que se rompe al abrir
esto a mucha gente. **El informe completo, con los comandos para repetir
cada comprobación, está en `docs/PRODUCCION.md`.** Aquí solo lo que hay
que saber para no repetir el trabajo.

**Se encontró un agujero de verdad, y ya está cerrado (migración 021).**
`revoke all on function ... from public` NO deja la función solo para
quien tiene sesión: Supabase concede EXECUTE a `anon` y `authenticated`
por privilegios por defecto al crearla, y ese `revoke` retira el pseudo-rol
PUBLIC, no los permisos que esos dos roles ya tienen por su nombre. Con la
clave anon del bundle y sin sesión, `purge_logs` respondía 200: borraba
`app_logs` de todas las familias y —lo peor— vaciaba `rate_limits` y
`user_limits`, o sea que **cualquiera podía poner a cero todos los topes de
ritmo a voluntad**. Reprobado después del arreglo: 401.

Regla nueva, y va en `schema.sql` al final: al crear una función
`security definer` hay que retirar `anon` explícitamente. El bloque del
final del esquema lo hace para todas de una vez; volver a lanzarlo tras
añadir una función es la forma barata de no olvidarse.

**La 020** arregló tres cosas de escala: siete claves ajenas sin índice
(lo que más las nota es borrar una cuenta, que es justo lo que el RGPD
obliga a ofrecer), las dos políticas de la 019 que se quedaron sin
`to authenticated`, y `purge_logs`, que existía desde la 002 y **nunca se
había ejecutado** porque no estaba programada. Ahora corre en `pg_cron` a
las 4:10.

**El correo en `elgremioapp.com` está bien montado**: SPF y DKIM
verificados por DNS (el selector es `hostingermail-a`; los otros dos son
marcadores vacíos, es lo normal en Hostinger), remitente y redirect URLs
correctos, confirmación encendida, plantillas sin URLs fijas. Los dos
peros: **DMARC en `p=none` y sin `rua=`**, o sea sin un solo informe; y el
techo de **30 correos/hora** sobre un buzón de Hostinger, que no es un
servicio transaccional. Cada alta consume uno: son 30 familias nuevas por
hora en el mejor caso.

**Lo que bloquea abrir el registro** no es técnico: no hay política de
privacidad, ni términos, ni edad mínima, ni registro de consentimiento
parental, y aquí se guardan nombres y actividad diaria de menores. El
borrado y la exportación de datos sí funcionan (`delete_my_account`
comprobada), que es la mitad difícil.

**Y un dato que conviene mirar**, porque cambió durante la propia
auditoría: a media mañana no había **ninguna** suscripción a los avisos
push, con el sistema montado y el cron corriendo; dos horas después había
dos activas, dadas de alta por la sesión paralela. La ceguera es el
problema de fondo: desde dentro no había forma de distinguir «nadie lo ha
activado» de «la suscripción falla en silencio».

Al volver a contar apareció además que **hay dos avisos apuntados en
`push_log` y un solo envío real**. Uno se dio por avisado sin llegar a
ningún aparato. Es el comportamiento previsto —se apunta antes de enviar
para no duplicar—, pero solo se ve si alguien escribe la consulta.

---

## 7k. Legal, captcha y correo autenticado (16 de agosto, tarde)

**Los textos legales existen y se aceptan en el alta.** Privacidad y
condiciones de uso en `public/legal/`, como páginas sueltas fuera del
bundle: hay que poder leerlas SIN cuenta, porque se leen justo antes de
decidir si se crea una. Responsable: Raúl Ferrer, persona física;
contacto `info@elgremioapp.com`.

Tres decisiones que conviene no deshacer:

- **La casilla bloquea el botón**, y los dos enlaces van dentro de la
  frase, no en el pie. Una casilla debajo del botón se marca sin leer y un
  enlace en el pie no lo abre nadie.
- **Se guarda la VERSIÓN aceptada, no un `true`.** Dentro de un año
  «aceptó las condiciones» no dice nada si nadie sabe qué decían entonces.
  Vive en `src/lib/legal.js` (`VERSION_LEGAL`) y encabeza los dos HTML;
  hay un test que falla si cambian los textos y no la versión.
- **Se apunta en dos sitios**: en los metadatos del alta (existen desde
  antes de confirmar el correo, cuando todavía no hay gremio) y en
  `families.legal_version` / `legal_at` al fundarlo (migración 022,
  primer momento con sesión). Los gremios anteriores quedan a **null a
  propósito**: `select id from families where legal_version is null` es
  justo la consulta que encuentra a quién habrá que volver a preguntar.
  Hoy da 1, que es el gremio de casa.

**El captcha está escrito y apagado**, y así se queda hasta que alguien
cree la cuenta de Cloudflare Turnstile: sin `VITE_TURNSTILE_SITE_KEY` no
dibuja nada, no carga ningún script de terceros y el alta funciona igual
que siempre. Receta completa, con el orden correcto de encendido y las
claves de prueba, en `docs/CAPTCHA.md`. **El orden importa**: primero
desplegar la clave pública, después exigirla en Supabase; al revés hay una
ventana en la que nadie puede registrarse ni recuperar su contraseña.

**El correo, ya autenticado del todo.** El DMARC pasó de `p=none` pelado a
`v=DMARC1; p=none; rua=mailto:info@elgremioapp.com`, o sea que a partir de
ahora llegan los informes agregados y se puede ver quién manda en nombre
del dominio antes de subir a `quarantine`. Nota que costó despejar: el
`rua` puede apuntar a `info@elgremioapp.com` aunque ese buzón reenvíe a
otro sitio, porque lo que exige la norma es que la dirección esté **en el
mismo dominio** que el registro; una de Gmail habría necesitado un
registro de autorización en `gmail.com` que no se puede publicar.

Y `https://www.elgremioapp.com/**` añadida a las Redirect URLs de
Supabase, que faltaba: quien llegara por `www` y pidiera recuperar la
contraseña habría visto rebotar el enlace.
