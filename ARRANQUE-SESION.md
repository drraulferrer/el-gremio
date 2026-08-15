# Arranque de sesión · El Gremio

Documento de continuidad. Si abres una sesión nueva sobre este proyecto,
lee esto primero: dice dónde está todo, qué está hecho, qué falta y qué
trampas tiene. Última actualización: **15 de agosto de 2026**, con la app
desplegada y funcionando.

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
| Web | https://drraulferrer.github.io/el-gremio/ |
| Repo (público) | https://github.com/drraulferrer/el-gremio |
| Código local | `~/el-gremio` |
| Supabase | proyecto `chfbrawsoulfiywiqhpe`, Postgres 17.6, región EU |
| Versión publicada | ver `npm run health`; cada despliegue deja etiqueta `deploy-AAAA-MM-DD-HHMM` |
| Tests | 190, en 11 ficheros, todos en verde |

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
⏳ 012  juego de globos: tabla bonuses + grant_daily_bonus · SIN EJECUTAR
⏳ 013  target_roles[]: misiones para varios roles · SIN EJECUTAR
```

**Las migraciones 012 y 013 están escritas y desplegado el cliente, pero
NO se han ejecutado en la base.** Mientras no se ejecuten: el juego de
globos avisa de que falta la 012 en vez de dar la estrella, y los grupos
de roles («Los peques y la junior») se guardan pero no filtran. La app no
se rompe por ello, degrada. Se ejecutan pegando los dos ficheros en el
SQL Editor, en orden.

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
src/lib/evidencia.js       Principios y referencias
src/lib/miembros.js        Reglas de alta, edición y baja de perfiles
src/lib/pin.js             Reglas del PIN parental
src/lib/tareas.js          Catálogo doméstico por roles, sin puntos
src/lib/log.js             Registro JSON con redacción de credenciales
src/lib/monitoring.js      Captura y agrupación de errores; adaptador de Sentry
src/lib/flags.js           Banderas de funcionalidad
src/lib/fakeBackend.js     Backend simulado del modo demo
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
- Build servida bajo `/el-gremio/` con las rutas correctas.
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

## 8. Pendientes

### Lo primero al retomar: preguntar, no suponer

Tres cosas que un agente **no puede comprobar desde fuera** y que
condicionan todo lo demás:

1. **¿Se creó ya la cuenta familiar y se fundó el gremio?** Requiere
   registrar cuenta y teclear contraseña, así que lo hace la familia. Sin
   eso, la app enseña el asistente de alta.
2. **¿Se ejecutaron el `update` de títulos (007b) y los índices (008)?**
   Ver §2 para las consultas que lo resuelven.
3. **¿Lo están usando de verdad?** De la respuesta depende qué merece la
   pena tocar: si llevan dos semanas usándolo, lo siguiente es mirar el
   diagnóstico de economía con datos reales, no añadir funciones.

### Un detalle que va a morder

Para que la peque vea premios en su tienda tienen que estar marcados como
**nivel 1**. Los premios creados antes de que existieran los niveles se
guardaron como nivel 2 por defecto. Síntoma: su tarro tiene estrellas y la
tienda le sale vacía. Se arregla en Panel → Premios → editar → nivel 1.

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
