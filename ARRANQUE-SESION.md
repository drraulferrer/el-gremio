# Arranque de sesión · El Gremio

Documento de continuidad. Si abres una sesión nueva sobre este proyecto,
lee esto primero: dice dónde está todo, qué está hecho, qué falta y qué
trampas tiene.

> **Y si solo vas a leer una línea antes de ponerte:** la **2.34.0 está EN
> PRODUCCIÓN** (§7bp): el gremio activo y su selector. Con ella, una persona
> puede tener más de un gremio de punta a punta. Lo siguiente es la **6.3, las
> pantallas**: el servidor tiene forjar, invitar y aceptar desde la 056 y la
> 057, y **nadie los llama todavía**.

Última actualización: **30 de agosto de 2026**, al cierre de la
sesión de **recuperación ante desastres y terreno firme** (§7bb): migraciones
**041, 042 y 043 ejecutadas** y **2.33.3 publicada y comprobada**. Esa sesión
descubrió que **la restauración de un respaldo nunca había funcionado** y
arregló seis defectos del camino de vuelta; empieza por ahí si vas a tocar
respaldos o el esquema. La sesión anterior fue la de **limpieza de código**
(§7ba): sin cambio de
comportamiento, en una rama a la espera de revisión. La sesión del
19-ago construyó el **modo limpieza** (§7x): campañas de limpieza como
misión secundaria, con reloj por tarea y botín de cierre. Ese mismo día,
en sesiones anteriores, llegaron los sellos de oficio (§7u), su motor
(§7v) y las migraciones 028-030 (§7w).

Si solo vas a leer un párrafo: la app está **en producción y estable**, en
elgremioapp.com, servida por **Vercel**, con las cabeceras de seguridad
que antes no se podían poner y con un cron diario que impide que Supabase
se pause. **Las migraciones 028-031 se ejecutaron el 19-ago por la
tarde** (métodos y comprobaciones en §7w-§7x) y el bundle 2.9.0 está
publicado: las piezas van a la vez otra vez. El modo limpieza (§7x) está
VIVO de punta a punta. Antes de añadir nada, lee §8.

**Y lo primero que hay que saber:** publicar no es `npm run deploy`. Es
empujar y después `npm run vercel` (§7n), y SIEMPRE con la migración
ejecutada antes que el bundle.

**Lo segundo, al 21-ago:** la migración **033 está EJECUTADA y la 2.14.0
publicada** (§7z, el buzón de fallos), en ese orden. Desde ahora hay un
sitio nuevo que mirar cada pocos días: la tabla `informes_fallo`, que es
donde la familia cuenta lo que va mal (RUNBOOK §3b).

**Lo tercero, al 24-ago:** la **2.22.0** (§7aj) trae la gramática de
respuesta de Duolingo —los números suben en vez de saltar, la celebración
en tres escalones, la llama que solo se mueve el día que hay algo que
hacer y el háptico—. **Sin migración: solo bundle.** Y una nota que
ahorra media hora: sembrar `completions` en la demo con `approved_at` /
`status:'approved'` revienta la app entera; los campos buenos son
`requested_at` / `resolved_at` y el estado es `'aprobado'`.

**Y lo que hay que hacer al abrir sesión, si nadie lo ha hecho ya:** la
2.22.0 está **mezclada en `main` y sin publicar**, y con ella viajan las
copias cifradas del 23-ago, que tampoco se publicaron nunca. Producción
sigue en `754fcd2`. Una sola orden, sin migración de por medio:
`npm run vercel && npm run health` (el detalle, al final de §7aj).

**Y lo último, al 29-ago: la 2.33.2 está EN PRODUCCIÓN.** La limpieza
(§7ba) se revisó y se mezcló el 27. El intento de publicarla ese día con
`npm run vercel` desde el portátil **no llegó a Vercel** —no consta
ningún despliegue posterior al del 26, ni siquiera uno fallido; la causa
no se llegó a ver—, así que el 29 se publicó desde la sesión remota con
el truco de la bandera: dos commits seguidos que abren y cierran
`git.deploymentEnabled.main` en `vercel.json` (el porqué y las
precauciones, al final de §7ba). Comprobado desde fuera:
`version.json` del dominio responde **2.33.2 · `748701d`**, y la bandera
quedó otra vez en `false`, o sea que publicar sigue siendo un acto
deliberado (§7n). El «sin subir» de §7az también quedó resuelto: las
2.33.0 y 2.33.1 sí se habían publicado el 26.

**Si abres sesión nueva, empieza por §8.** Los **803 tests y el CI están
en verde** (el CI estuvo roto unas horas por un test que parcheaba el
cliente nulo; arreglado en `ed0a311` con inyección). Producción sirve la
**2.9.0**. Lo que queda es de uso, no código a medias.

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
| Quién sirve el sitio | **Vercel** (proyecto `el-gremio`), desde el 18-ago · §7n |
| DNS y correo | Hostinger. `A @` a las IPs de Vercel, `www` por CNAME a Vercel con 308 al ápice; MX y DKIM sin tocar |
| Repo (público) | https://github.com/drraulferrer/el-gremio |
| Código local | `~/el-gremio` |
| Supabase | proyecto `chfbrawsoulfiywiqhpe`, Postgres 17.6, región EU |
| Edge Function | `notificar`, versión 5, `verify_jwt` en false |
| Versión publicada | ver `npm run health` (lee `version.json`, que ahora se emite en el build) |
| Tests | 1.138, en 64 ficheros, todos en verde (27-ago). `npm run verify` empieza por `npm run lint` desde la 2.27.0 |

### Por dónde seguir · escrito al cerrar el 25-ago

Todo lo del 24 y el 25 está **desplegado y documentado** (§7an a §7ax). La
versión en producción es la 2.32.0. No hay nada a medias en el repo: el
árbol está limpio y `origin/main` al día.

Las cuatro comprobaciones que dependían de la familia **están hechas y
salieron bien** (25-ago, confirmado por Raúl):

- ✅ **Entrar con Google**, en el gremio de verdad y no en uno vacío.
- ✅ **El correo del enlace de entrada llega en castellano**, así que la
  plantilla quedó bien pegada.
- ✅ **Los pasos de iPhone salen correctamente**, que era la única rama de
  `GuiaInstalar` que no se pudo ver en pantalla desde aquí.
- ✅ **El editor del retrato funciona.**

Con eso, **las cuatro maneras de entrar están probadas en producción**:
contraseña, enlace por correo, Google y —para salir— el botón de Panel →
⚙️ → Datos. Y el retrato está completo de punta a punta.

**No queda nada abierto de lo de agosto.** Lo único que sigue en el aire es
una decisión, no una tarea: las plantillas de **notificación de seguridad**
siguen en inglés y **desactivadas**. Si algún día se encienden, hay que
traducirlas ANTES de encenderlas, o salen en inglés el mismo día. La tabla
de cuáles son y por qué hoy no se envían está en `docs/CORREOS.md`.

Comprobar que sigue vivo:

```bash
cd ~/el-gremio && npm run health
```

Debe salir 🟢 en `web` y en `supabase`. Si `web` falla, mira el panel de
Vercel; si falla `supabase`, casi seguro que el proyecto está pausado
—aunque desde el 18-ago eso es mucho menos probable, porque hay un cron
diario que lo mantiene despierto (§7n)—.

**Estado del esquema**, comprobado contra la base el 18-ago:

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
✅ 019  notificaciones: streak_days y push_pendientes (16-ago)
✅ 020  escala · 021 anon no ejecuta · 022 aceptación legal (16-ago)
✅ 023  salud diaria (16-ago)
✅ 024  días de la semana en las misiones (16-ago, tarde)
✅ 025  plan_diario: programar las diarias del día siguiente (18-ago)
✅ 026  franja de noche + aviso sin_programar (18-ago)
✅ 027  perfiles de mascota (18-ago)
✅ 028  familias de misión · 029 snapshot histórico
✅ 030  sellos por temporada · 031 modo limpieza · 032 zonas de la casa
✅ 033  informes de fallo · 034 reconocimientos
✅ 035  retrato: piezas + xp_maxima con trigger (24-ago)
✅ 036  «sin pelo» (24-ago)
✅ 037  gafas, túnica y CATÁLOGO ABIERTO: el CHECK pasa a ser de forma (24-ago)
✅ 038  barba (24-ago) · ✅ 039  flequillo (24-ago)
```

**Ya no queda ninguna migración pendiente.** Las cinco del retrato
(035-039) se ejecutaron el 24-ago y están comprobadas contra la base: 7
columnas `retrato_*`, 8 CHECK y el trigger de la marca de agua, probado
bajando la XP de un perfil dentro de un bloque que aborta solo. **Desde la
037 el CHECK del catálogo es de FORMA**, así que añadir una pieza nueva ya
no pide migración: el catálogo vive en `src/lib/retratos.js`. La 027
(mascotas) se ejecutó el 18-ago; el esquema está listo aunque todavía no haya interfaz que lo
use, que es el orden bueno (§7e). Comprobado desde fuera: `species` y
`target_role` responden 200, una columna inventada responde 400 y la
lectura anónima sigue dando `[]`. La 025 y la 026 se
ejecutaron el 18-ago con el método del repo —traer el fichero con la
consola del SQL Editor y cotejar el SHA-256 antes de pulsar Run: las dos
coincidieron byte a byte (8.543 y 5.630) y los acentos salieron intactos—.
Comprobadas: la 025 con sus cinco contadores a 1 y el guardarraíl
rechazando de verdad una fecha a 30 días (P0001 · `fuera_de_rango`); la
026 con los tres a 1 y el índice viejo `idx_push_log_uno_al_dia` ya a 0. Y
desde fuera: `plan_diario` responde 400 a una columna inventada —o sea que
existe— y `[]` a la lectura anónima, así que el RLS aguanta.

La Edge Function `notificar` se había quedado atrás —lo desplegado era de
dos días antes— y **también está ya al día** (versión 5, `verify_jwt` en
false). Ojo con la bandera al redesplegarla: §8.

La 024 sí se ejecutó y se comprobó: los cinco contadores del final del fichero a 1, el array vacío
rechazado de verdad, 51 misiones con **cero patrones puestos** —o sea,
nadie notó nada, que es lo que tenía que pasar— y la vista de avisos
respondiendo con `dia_libre` en false para los cuatro perfiles.

**Y hay una forma mejor de pegar una migración, que jubila el truco de
MacRoman.** El repo es público, así que la propia página del SQL Editor
puede traerse el fichero y ponerlo en el editor sin que el portapapeles lo
toque. Se acabó el viaje de codificaciones y la comprobación de acentos a
posteriori:

```js
// En la consola del SQL Editor. Se pone el HASH DEL COMMIT, no `main`:
const r = await fetch('https://raw.githubusercontent.com/drraulferrer/el-gremio/8fdb487/migracion-0NN-loquesea.sql')
const sql = await r.text()
monaco.editor.getModels()[0].setValue(sql)
```

**Con el hash del commit, no con `main`.** El 18-ago, al corregir una
migración y volver a traerla, `main` devolvió durante minutos la versión
ANTIGUA: la CDN de raw.githubusercontent la tenía cacheada y `cache:
'no-store'` no la salta. Con el hash en la ruta el contenido es inmutable,
llega siempre fresco, y además queda dicho exactamente qué versión se
ejecutó.

Conviene comparar el SHA-256 de lo traído con el del fichero local
(`shasum -a 256`) antes de pulsar Run: confirma que se ejecuta EXACTAMENTE
lo que hay en el repo, que es más de lo que garantizaba pegar a mano.
Pegar con ⌘V desde una automatización no funciona —el portapapeles del
sistema no llega—, y `navigator.clipboard.readText()` se queda colgado
esperando un permiso que nadie concede.

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

### Publicar es un acto deliberado, y desde el 18-ago va por Vercel

**Lo que actualiza elgremioapp.com es Vercel**, no `npm run deploy` (§7n).
El orden importa y no es cosmético:

```bash
npm run verify           # tests + build + credenciales
git push origin main     # PRIMERO: Vercel construye desde el REMOTO
npm run vercel           # y entonces publica
npm run health           # y se comprueba
```

Publicar sin haber empujado publica lo que hubiera en `origin/main`, que
es una forma silenciosa de desplegar algo distinto de lo que tienes
delante. El script avisa —rama, divergencia con el remoto, cambios sin
confirmar— pero avisar no es impedir.

**No hay despliegue automático, a propósito.** Conectar el repositorio
hizo que Vercel publicara en cada empujón, y el 18-ago producción acabó
sirviendo un commit de solo documentación. Está apagado con
`git.deploymentEnabled.main = false` en `vercel.json`, por la razón de
siempre: aquí se empuja documentación varias veces al día.

`npm run deploy` y `npm run rollback` **siguen existiendo y funcionando**,
pero publican en `gh-pages`, que hoy es solo la red de seguridad y no el
sitio que ve la familia. Ojo con lo que eso implica para un rollback de
verdad: está explicado en §7n, y no es lo que parece.

**Una afirmación de este documento que quedó obsoleta el 18-ago:** decía
que el token de `gh` no tenía scope `workflow` y que por eso no se podían
empujar ficheros de Actions. Ya no es cierto: ese día se empujó un cambio
a `.github/workflows/desplegar.yml` sin ningún problema.

### El dominio va dentro de la build, en `public/CNAME`

Cada publicación **vacía la rama `gh-pages`** antes de copiar la build. Si
el `CNAME` viviera suelto en esa rama, el primer despliegue lo borraría,
GitHub daría el dominio por retirado y elgremioapp.com dejaría de
responder hasta que alguien lo volviera a escribir a mano en Settings.
Por eso vive en `public/`, lo copia Vite, y `prepararDist` **aborta** si
no lo encuentra en `dist/`. `urlDePages()` lee ese mismo fichero, así que
despliegue, `health` y QR no pueden discrepar sobre cuál es la URL buena.

### El repo es público, pero ya no por la razón que decía aquí

**El motivo original caducó el 18-ago.** Era que GitHub Pages en
repositorio privado exige plan de pago; ahora sirve Vercel, y su plan
Hobby funciona igual con repositorios privados. Si algún día se quiere
cerrar el repo, ese obstáculo ya no existe.

Lo que sí depende hoy de que sea público es el **método bueno de ejecutar
migraciones** (§2): la consola del SQL Editor se trae el fichero desde
`raw.githubusercontent.com`, y eso solo funciona sin autenticación en un
repo público. Es el método que evita la trampa de los acentos, así que
cerrarlo tendría un coste real.

**La regla de privacidad no cambia y hay que tomársela en serio:** nunca
meter nombres reales en el repo, ni en fixtures ni en ejemplos de
documentación. El código no contiene ni un dato familiar —nombres, emojis
y colores se introducen en el asistente y viven en Supabase con RLS—, pero
**la documentación sí llegó a contenerlos**: el 18-ago se encontraron tres
nombres de pila en §7d, colados al pegar la salida real de la función al
documentar los avisos. Sustituidos por el rol. **Siguen en el historial de
git**, que esto no lo arregla.

De ahí la regla práctica: cuando pegues una salida real en la
documentación, **anonimízala en el mismo gesto**, no después.

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
| CDN | ✅ lo pone la plataforma | Vercel sirve por su red desde el 18-ago (antes, GitHub Pages). Las fuentes, por Google Fonts. |
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

## 6b. CORS y cabeceras de seguridad: lo que aquí NO se puede configurar

Medido el 16-ago, no supuesto. Conviene tenerlo escrito porque es la
clase de tarea que se pide, se «hace», y no hace nada.

**CORS no es una palanca en este proyecto.** Hay tres superficies y dos no
se tocan:

| Dónde | Qué responde | ¿Configurable? |
|---|---|---|
| REST de Supabase | `access-control-allow-origin: *` | **No.** Es el diseño: protege RLS + la clave, no el origen |
| Auth de Supabase | refleja *cualquier* Origin, con `allow-credentials: true` | **No** |
| GitHub Pages | `access-control-allow-origin: *` | **No.** No sirve cabeceras propias |
| Edge Function `health` | nuestra | **Sí**, y es la única |

Y aunque se pudiera: **CORS es una regla del NAVEGADOR**. Un `curl`, un
script o una app de móvil la ignoran. No defiende una API de nadie; solo
impide que la página de un tercero lea la respuesta desde el navegador de
quien la visita. Lo que protege los datos del gremio es RLS, y eso está
comprobado desde fuera (lectura anónima: `[]` en las cinco tablas;
escritura: 401; funciones: 401/404).

**Cabeceras de seguridad: RESUELTO el 18-ago.** elgremioapp.com envía
ahora HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
`Permissions-Policy` y la CSP **como cabecera de verdad** —lo que activa
`frame-ancestors`, que en un `<meta>` se ignora—. Las sirve `vercel.json`.

Lo que sigue se conserva porque explica **por qué** hubo que mudarse y
porque su diagnóstico sobre CORS sigue siendo válido: durante meses esto
no tuvo salida dentro de GitHub Pages, que no sirve cabeceras propias, y
como meta se ignoran todas salvo CSP y `referrer`. Escribirlas en el HTML
habría sido teatro.

Las dos salidas reales, las dos son una decisión, no código:

1. **Poner Cloudflare delante del dominio** (ya hay cuenta, por Turnstile).
   Con el DNS proxeado, las Transform Rules añaden todas las cabeceras sin
   tocar el proyecto. Implica mover el DNS desde Hostinger.
2. **Mudar el alojamiento a Cloudflare Pages o Netlify**, que leen un
   fichero `_headers`. El sitio es estático: la mudanza es el CNAME y poco
   más.

> **Se eligió la segunda, con Vercel, y ya está hecho (18-ago). Ver §7n.**
> El DNS se cortó ese mismo día y las cabeceras llegan de verdad:
>
> ```
> curl -sI https://elgremioapp.com/ | grep -i strict-transport
> strict-transport-security: max-age=31536000
> ```

El hueco que de verdad mordía —el clickjacking del formulario de entrada
y del panel— lo tapaba `src/lib/marco.js` desde JavaScript. **Sigue ahí y
conviene que siga**, pero ya no es la única defensa: ahora hay
`X-Frame-Options: DENY` y `frame-ancestors 'none'` por cabecera, que
funcionan aunque alguien
desactiva JS, no hay defensa. Pero cubre el caso real.

---

## 7. Trampas conocidas

- **Un `CHECK` que evalúa a NULL NO rechaza nada.** Solo rechaza cuando da
  FALSE. La 027 llevaba `(role='mascota' and species in (...)) or
  (role<>'mascota' and species is null)`, que con `species` nulo da
  `TRUE and NULL` = NULL en la primera rama y FALSE en la segunda: `NULL
  or FALSE` = NULL, y **pasa**. Aceptaba una mascota sin especie. Se
  arregla con `case ... then ... else ... end`, que sí es NULL-seguro. La
  cazó la comprobación adversarial de la propia migración —la que intenta
  meter los estados absurdos y espera que reboten—, y por eso esas
  comprobaciones no son adorno: el fallo estaba en la mitad que uno cree
  cubierta.
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
- **El backend simulado solo entiende `eq`.** Su constructor de consultas
  (`fakeBackend.js`) implementa `eq()` y nada más: `.in()`, `.neq()` y
  compañía **compilan, pasan los 524 tests y revientan en la pantalla**
  con un «update(...).in is not a function». Pasó el 16-ago al revivir
  misiones pausadas desde la biblioteca: en producción habría funcionado
  y en demo no, que es la peor combinación porque el modo demo es donde
  se prueba. Si hace falta un filtro nuevo, o se escribe con `eq` en un
  bucle, o se añade al backend simulado; lo que no vale es suponer.
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

**7. Ver los errores del conjunto: la parte agregada, RESUELTA.** `app_logs`
sigue bajo RLS por familia —correcto para la privacidad—, así que el
detalle de un fallo concreto solo se ve con la clave de servicio en el SQL
Editor. Pero el hueco que de verdad dejaba ciego al operador —«¿cuántos
errores hubo hoy en TODO el sistema?»— lo cierra `salud_diaria`
(migración 023): una fila al día, `security definer`, con el recuento de
errores de todas las familias sin `family_id` a la vista. Se mira con
`select * from salud_diaria order by dia desc`. Lo que NO hay, y sería lo
siguiente si hiciera falta, son **avisos en el momento**: hoy es una foto
diaria, no un empujón cuando algo se rompe. Para eso está Sentry escrito y
apagado en `monitoring.js` (ver §8 y «Escrito pero no activado»), pero a
esta escala no compensa el coste legal.

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
`saltados: ["<perfil>: ya avisado hoy"]` en vez de mandarle un segundo aviso.

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
repetir el test.** Una consulta devolvió de pronto **dos aparatos de un
adulto y ninguno de la junior**, y un minuto después uno por persona. No
era un fallo: el teléfono de la junior tenía seleccionado el perfil de un
adulto en ese momento, y `apuntarPerfil` **reasigna la suscripción al
cambiar de perfil**, que es justo lo que se quiere en una tablet
compartida. El envío cayó dentro de esa ventana, así que la junior se
quedó sin aparato y su aviso se apuntó en `push_log` sin salir a ninguna
parte.

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
parece roto justo cuando vas a comprobarlo. En producción sí se resuelve
el directorio: lo hacía GitHub Pages y lo sigue haciendo Vercel
—comprobado el 18-ago, `/narrativa/` responde 200—. Por eso `urlDeLaNarrativa()` pide
`narrativa/index.html` en local y la dirección corta fuera.

**Dónde se ve la exposición, por orden de visibilidad:** en la pantalla de
entrada (delante de la sesión, que es lo primero que ve quien abre el
dominio), en ⚙️ → Dispositivos con su botón de copiar enlace, y en
⚙️ → Evidencia. Estaba solo en la última, que son cinco toques y un PIN.

---

## 7m. Encender misiones en un toque y premios de arranque (18 de agosto)

Dos peticiones de la familia tras los primeros días de uso real. Las dos
verificadas **en el navegador** con `npm run dev:demo`, no solo
compilando. Versión **2.1.0**; falta desplegar.

### Encender una misión dejó de ser un formulario

El camino viejo para reactivar una misión pausada de la peque era: lápiz →
bajar al par Activa/Pausada del final del formulario → pulsarlo →
Guardar. Cuatro pasos y un modal para cambiar un booleano, en la pantalla
donde cada mañana se decide qué le toca.

- **Panel → Peque**: cada misión lleva su ▶/⏸ junto al lápiz —el mismo
  botón que ya tenían los premios, así que no es un idioma nuevo—. Las
  activas se ordenan arriba y la cabecera de cada peque dice cuántas
  están en pausa.
- **Panel → Misiones**: las pausadas se despliegan en un `<details>` al
  final, con destino y puntos, y se reencienden con «▶ Activar». **Siguen
  fuera de las listas por persona a propósito**: esa decisión (§7 de esta
  misma sección, cuando se quitaron) era buena —eran treinta tarjetas al
  50 % de opacidad de cosas que no están pasando— y lo que estaba mal no
  era esconderlas, era que el único camino de vuelta fuera la biblioteca,
  que es un catálogo para crear misiones nuevas, no para revivir las que
  ya existen.

Verificado en el navegador: pausar desde Peque escribe `active=false`, la
misión baja al final de la lista, el chip dice «1 en pausa», el
`aria-label` pasa de «Pausar X» a «Activar X» y el `aria-pressed` de
`true` a `false`; volver a tocarlo la revive y el chip desaparece. Lo
mismo desde Misiones, donde además se comprobó que pausar allí la manda al
bloque plegado y «▶ Activar» la devuelve a la lista de su persona (la
cuenta de Bruno pasó de 2 a 3). Todos los objetivos táctiles nuevos miden
44 px y a 375 px no hay scroll horizontal.

Dos ajustes de maqueta que solo se vieron mirando la pantalla: el botón
«▶ Activar» llevaba `crece` y se comía la fila, con «Estudiar violín»
partido en dos líneas; y esas tarjetas no llevan el avatar grande de las
listas de arriba, porque avatar + botón con texto + lápiz no caben en
375 px. El emoji va en línea con el título.

### Premios de arranque: el hueco de los primeros días

El premio más barato del catálogo cuesta **325 monedas ≈ 8-9 días** de la
junior. Los primeros días son los que deciden si esto se sigue usando, y
en esos días la tienda no le daba nada: una estantería de cosas que no
puede tocar. La SPEC ya nombraba el decaimiento de la novedad como el
riesgo real del producto; el arranque no tenía contramedida.

**La respuesta NO fue bajar los precios del catálogo.** Eso convierte la
tienda en una máquina expendedora, que es justo lo que se decidió evitar
al espaciar las cadencias a 15/30/45 días. Se añadió una banda aparte,
`PREMIOS_DE_ARRANQUE` en `src/lib/premios.js`: seis premios de 80 a 240
monedas, o sea de dos a seis días, encadenando con las 325 del catálogo
sin dejar salto. Son **decisiones, no cosas**, la misma regla que gobierna
el nivel 1.

La banda **(72, 324)** no es estética y conviene no moverla:

- por debajo de **72** (`TECHO_PEQUE`) caerían en la tienda de la peque,
  que filtra por precio;
- a partir de **324** (suelo del nivel 1) competirían con los premios de
  verdad en vez de dar el primer empujón.

Y son andamio de verdad, no un nivel nuevo, así que:

- **No entran en el diagnóstico de la economía** (`fueraDelModelo`). Esto
  destapó un fallo que ya existía: **los premios de la peque sí entraban**,
  y en una casa con peque el nivel 1 salía con un precio medio de ~190
  monedas mientras el panel avisaba de que «se consigue demasiado rápido»
  un premio que cuesta 325. Arreglado de paso.
- **No suben con la temporada.** `premiosQueSuben` recibía el techo de la
  peque (72) y ahora recibe el suelo del modelo (324): el arranque estaba
  justo en el hueco y se encarecía hasta dejar de llegar en tres días, que
  es lo único que lo justifica. **Ojo, el parámetro cambió de sentido**:
  era un techo excluyente y ahora es un suelo incluyente.
- **Se retiran** cuando el hábito aguante solo. La pantalla lo dice, y
  pausarlos es un toque.
- `Estado` los cuenta en su propia tarjeta. Sin eso, una tienda de diez
  premios de arranque salía como «Sin premios activos» en los tres
  niveles y parecía vacía.

Se añaden desde **Panel → Premios**. El aviso solo sale si de verdad hace
falta y lleva la cifra delante —cuántos días cuesta lo más barato que
hay—, y **una tienda vacía cuenta como el caso peor, no como el caso sin
problema**: si el aviso pidiera un precio para salir, el gremio que más lo
necesita sería justo el que no lo vería. La misma pantalla ofrece los
premios de la peque cuando faltan, que cierra el pendiente de §8.

**Uno para mirar con ojo de familia**: «🎟️ Comodín: hoy te libras de una
misión» (240, el más caro de la banda). Motiva mucho y es una decisión,
pero es el único que juega en contra del hábito. Si no encaja, se pausa
desde la lista y ya está.

20 tests nuevos en `tests/arranque.test.js`, que fijan la banda, la rampa
sin salto, que ninguno tarda más de una semana y que ni el diagnóstico ni
la temporada los tocan. Dos tests viejos se actualizaron: usaban premios
de 40 monedas como si fueran de nivel 1, que con el suelo del modelo ya no
lo son. Lo que defendían —solo cuentan los activos, el andamio no sube de
precio— sigue comprobándose.

---

## 7n. La mudanza a Vercel (18 de agosto) · HECHA Y VERIFICADA

**Estado: terminada y comprobada en el dominio real el 18-ago a las
10:46.** `elgremioapp.com` responde con `server: Vercel`, las cinco
cabeceras puestas, `npm run health` en verde por partida doble (web
190 ms · supabase 394 ms), la reescritura SPA devolviendo 200 donde antes
salía 404, las páginas estáticas intactas y **la app funcionando con
sesión abierta y datos cargando**, que es la prueba que de verdad cuenta.
`www` responde 301 al ápice. La propagación tardó unos 35 minutos, no las
4 horas del TTL viejo. Lo que sigue explica por qué se hizo y con qué se
tropezó.

### Por qué Vercel y no seguir en GitHub Pages

No es por velocidad. Es porque **§6b dejó escrito un problema sin salida
dentro de Pages**: elgremioapp.com no envía ninguna cabecera de seguridad
y no se pueden añadir, porque Pages no sirve cabeceras propias. Aquella
sección daba dos salidas —Cloudflare delante, o mudarse a un alojamiento
que lea un fichero de cabeceras—. **Vercel es la segunda salida.**

Lo que gana la app, en concreto:

1. **Cabeceras de verdad** (`vercel.json`): HSTS, `X-Frame-Options`,
   `X-Content-Type-Options`, `Permissions-Policy` y la CSP **como
   cabecera**, que es lo que activa `frame-ancestors`. Con eso,
   `src/lib/marco.js` pasa a ser un refuerzo en vez de la única defensa
   contra clickjacking — hoy, si alguien desactiva JS, no hay ninguna.
2. **Reescritura SPA de verdad.** El truco de copiar `index.html` a
   `404.html` funciona pero responde **HTTP 404** en toda ruta profunda.
3. **Rollback instantáneo**: promover un despliegue anterior ya
   construido, en segundos, en vez de recompilar y esperar a que Pages
   propague (el workflow llega a dormir 90 s por eso).
4. **Se acaba el pie del CNAME.** El guardarraíl de `prepararDist` que
   aborta si el CNAME no llegó a `dist/` existe porque cada publicación
   VACÍA la rama `gh-pages`. Esa clase de fallo desaparece.

### Lo que NO arregla, y es lo más importante de esta sección

**Vercel no toca el fallo más probable de esta app.** Según §7, ese fallo
es que **Supabase se pausa a los 7 días sin actividad** — y con él se
paran también los avisos, porque el `pg_cron` vive DENTRO del proyecto
pausado. Con Vercel sirviendo perfectamente, la app seguiría sin
funcionar.

Por eso la mudanza trae `api/latido.js` y un **cron diario** declarado en
`vercel.json`, que llama a `rpc/health` —la misma función que usa
`npm run health`, para que el latido no sea una ruta que solo se ejercita
a sí misma— y mantiene el contador de inactividad lejos de los siete
días. **Esa es la mayor ganancia de estabilidad de todo el movimiento**, y
llega de rebote.

### Lo que ya está hecho y empujado a `main`

- `vercel.json`: rewrites SPA, las cinco cabeceras, caché inmutable para
  `/assets/*` y **sin caché** para `sw.js` y `version.json` (un
  `version.json` cacheado hace mentir a `npm run health`), y el cron.
- `vite.config.js`: `version.json` **se emite en el build** (plugin
  `selloDeVersion`). Hasta ahora lo escribía `prepararDist` al publicar,
  porque construir y publicar eran el mismo acto; Vercel construye por su
  cuenta y nunca pasa por ese script. Los dos caminos conviven sin
  ambigüedad: el plugin sella siempre, y `prepararDist` lo sobrescribe en
  la ruta de `gh-pages`, donde se sabe más (deploy o rollback, y a qué
  referencia). El último que escribe es el que publica.
- `api/latido.js`: el endpoint del cron, protegido con `CRON_SECRET`.
- `desplegar.yml`: **arreglado un bug que estaba vivo**. Pasaba TRES
  variables al build y la app usa CUATRO: sin `VITE_VAPID_PUBLIC`, la
  pantalla de Avisos responde «Falta la clave pública de avisos». O sea
  que la vía de emergencia publicaba, además del arreglo, una app sin
  notificaciones. No se veía porque el camino local sí tiene la variable
  en su `.env`. **Hay que añadirla como Variable del repositorio.**

### Lo verificado en Vercel, medido y no supuesto

Contra `el-gremio-theta.vercel.app`, antes de tocar el DNS:

- Las **cinco cabeceras** servidas de verdad, CSP incluida con
  `frame-ancestors 'none'`.
- **Ruta profunda `/panel/lo-que-sea` → HTTP 200**, donde GitHub Pages
  daba 404.
- `/legal/*.html`, `/narrativa/`, `/manifest.webmanifest` y `/sw.js`
  siguen sirviéndose tal cual: el rewrite comodín NO se los come, porque
  Vercel mira el sistema de ficheros antes de aplicar los rewrites.
- `version.json` con `"origen": "vercel"` — el plugin nuevo funciona.
- Las cinco `VITE_*` presentes en el bundle y **`CRON_SECRET` ausente**
  de él, que es justo el reparto que tiene que haber.
- `/api/latido`: **401 sin secreto**, y con él `{"ok":true,"postgres":"17.6"}`.
  O sea que el antídoto contra la pausa de Supabase está probado entero.
- La app dibujada en el navegador, correcta.

Lo único que fallaba allí era el captcha, y era lo esperado: Turnstile
tiene autorizado `elgremioapp.com`, no `*.vercel.app`.

### Una simplificación que ahorró dos pasos

**El dominio no cambia, así que Supabase y Turnstile no se tocan.** Las
Redirect URLs de Supabase y los hostnames de Turnstile están puestos
contra `elgremioapp.com`, y ese sigue siendo el dominio. Estaban
apuntados como pendientes y no hacían falta.

### El corte de DNS, y los dos detalles que importaban

Copia de la zona anterior en `docs/dns/zona-elgremioapp-antes-de-vercel-2026-08-18.txt`.

1. **Había CUATRO registros AAAA apuntando también a GitHub Pages**
   (`2606:50c0:800x::153`), no solo los cuatro A. Vercel no publica IPv6
   para el ápice, así que **hay que borrarlos**: dejarlos habría mandado a
   Vercel solo a los clientes IPv4 y a GitHub Pages a todo el que tuviera
   IPv6, que en redes móviles es casi todo el mundo. Es el error que
   habría hecho la mudanza «funcionar» en el portátil y no en los
   teléfonos.
2. **Vercel propone marcar «Redirect apex domains to www»**, y aquí eso
   rompe el captcha: Turnstile autoriza `elgremioapp.com`, y `www` es otro
   hostname. Se dejó SIN marcar.

La zona quedó así, con el correo intacto (DKIM ×3, SPF, DMARC,
autodiscover, autoconfig y los dos MX, sin tocar):

```
A  @  216.198.79.1   TTL 300
A  @  64.29.17.1     TTL 300
(sin AAAA)
```

El TTL se bajó de 14400 a 300 a propósito: si hay que volver atrás, con
cuatro horas de caché el rollback sería insoportable.

### El despliegue sigue siendo a mano, y eso está resuelto

Al conectar el repositorio, Vercel publicaba producción en **cada empujón
a `main`**. El 18-ago produción acabó sirviendo un commit de solo
documentación: de las cuatro publicaciones de la mañana, **tres fueron
cambios de texto**. Justo lo que §7l había decidido evitar.

**Apagado** con `git.deploymentEnabled.main = false` en `vercel.json`, y
comprobado en los dos sentidos, que es lo que hace que esto sea un hecho y
no una intención:

- Un empujón a `main` **ya no publica nada** (verificado: push a las
  10:57, y la última publicación seguía siendo la de las 10:47).
- `npm run vercel` **sí publica** (verificado: producción pasó a servir
  `7b0b11a` en menos de 30 segundos).

**Cómo se publica ahora:**

```bash
git push origin main     # primero, SIEMPRE
npm run vercel           # y entonces se publica
npm run health           # y se comprueba
```

**El orden no es un detalle.** El hook no compila nada aquí: le dice a
Vercel que se traiga `main` de GitHub y construya allí. Publicar sin
haber empujado publica lo que hubiera en el remoto, que es una forma
silenciosa de desplegar algo que no es lo que tienes delante. El script
avisa si la rama no es `main`, si el local y `origin/main` difieren, o si
hay cambios sin confirmar, pero avisar no es impedir.

**La URL del hook (`VERCEL_DEPLOY_HOOK` en el `.env`) es un secreto de
verdad**, y conviene tener clara la diferencia: las `VITE_*` son públicas
por diseño y viajan en el bundle; esta no viaja al navegador y quien la
tenga puede publicar en producción cuando le apetezca. Va en el `.env`, y
en `.env.example` solo como ejemplo.

Quedan **dos caminos deliberados y ninguno automático**, que es la
filosofía de siempre: `npm run deploy` publica en GitHub Pages (la red de
seguridad) y `npm run vercel` en Vercel (lo que sirve el dominio).

### Lo que queda
- ~~Mover `www` a Vercel.~~ **HECHO** (18-ago). En este orden, que
  importa: primero `www.elgremioapp.com` al proyecto **como redirección
  308 al ápice** —no como sitio, que daría contenido duplicado y un
  hostname que Turnstile no conoce—, y solo después el CNAME en Hostinger
  a `0f700ed78b5b64af.vercel-dns-017.com`. Al revés, `www` habría dado un
  404 de Vercel. Comprobado: `HTTP 308 → https://elgremioapp.com/`,
  `server: Vercel`, un solo salto y 200 al final. El correo, sin tocar.
- ~~Añadir `VITE_VAPID_PUBLIC` como Variable del repositorio.~~ **HECHO**
  (18-ago). Se comprobó que en el repositorio solo estaban tres, lo que
  confirma el bug: la vía de emergencia llevaba desde el 16-ago publicando
  una app sin avisos. Las cuatro están ahora y coinciden con el `.env`.

**GitHub Pages se queda como red de seguridad, pero con un matiz que hay
que saber ANTES de necesitarla.** La rama `gh-pages` sigue ahí y
`npm run deploy` sigue publicando en ella igual que siempre. Lo que **no**
se puede es verla: `drraulferrer.github.io/el-gremio/` **responde 301 al
dominio**, o sea a Vercel, porque dentro de `gh-pages` viaja un `CNAME`
con `elgremioapp.com` y Pages redirige su propia dirección a la
personalizada. Medido el 18-ago, no supuesto.

O sea que **la red de seguridad no es «abrir la dirección vieja»**: es
**devolver el DNS**. Restaurar en Hostinger los cuatro A y los cuatro AAAA
de `docs/dns/zona-elgremioapp-antes-de-vercel-2026-08-18.txt` y volver a
poner el CNAME de `www` en `drraulferrer.github.io`. Con TTL 300 en los
registros, eso surte efecto en minutos.

Si algún día se quiere además poder MIRAR la copia de Pages sin tocar el
DNS —para comparar dos versiones, por ejemplo—, hay que sacar el `CNAME`
de la rama `gh-pages`; pero entonces deja de estar lista para el rollback
por DNS, porque Pages solo sirve el dominio propio si ese fichero está.
Son dos usos incompatibles y hay que elegir uno: hoy está elegido el
rollback, que es el que importa cuando algo va mal.

### Dos trampas del trayecto, ya pagadas

- **Rellenar el formulario de Vercel por DOM no vale.** Poner los valores
  con `element.value` los deja en el DOM pero NO en el estado de React.
  Hay que teclear de verdad. Y el importador de `.env` rechaza el fichero
  salvo que se llame exactamente `.env`.
- **`"trailingSlash": null` tumba el despliegue entero** con «Invalid
  request: trailingSlash should be boolean». «No lo toques» se dice
  omitiendo la clave, no poniéndola a null.
- **El error de verdad estaba ARRIBA del formulario, fuera de la
  pantalla.** Se perdieron varios intentos mirando el botón. Cuando algo
  no responde en un formulario largo, subir del todo antes que insistir.

### Una obsoleta que se puede borrar

**El token de `gh` de esta máquina YA tiene el scope `workflow`.** El
arreglo de `desplegar.yml` se empujó sin problema el 18-ago. La trampa
que decía que empujar ficheros de `.github/workflows/` falla y que hacía
falta `gh auth refresh -s workflow` **ya no aplica**.

---

## 7o. El recordatorio de avisos (18 de agosto) · 2.2.0

Nació de un número, no de una idea: al comprobar los avisos tras el
despliegue salió que **de ocho perfiles activos, cinco no tenían ningún
aparato registrado**. El sistema les escribía avisos en `push_log` que no
salían a ninguna parte. Y no se notaba —la app funciona igual y el
registro dice que el aviso «se apuntó»—, que es justo lo que lo hacía
peligroso. La ironía: los tres que esa tarde tenían motivo `vuelve`
—«hace días que no apareces»— eran de los que no podían recibirlo.

**Dos piezas.** En el Setup, un paso que explica qué son, cuándo llegan y
dónde se activan; **no los activa**, porque durante el alta el gremio
todavía no existe y el permiso se concede aparato por aparato. Y en el
panel parental, un aviso arriba mientras este dispositivo no los tenga,
con cuántos miembros se quedarían sin nada, que lleva a 🔔 Avisos con la
sección ya abierta.

### Tres decisiones que conviene no deshacer

1. **El aviso vive SOLO en el panel parental, detrás del PIN.** No es
   pereza: es la misma razón que ya estaba escrita en `Avisos.jsx`. Pedir
   el permiso del navegador es un gesto de UNA vez y, si se deniega, **no
   vuelve a preguntar nunca**. Mejor un adulto con el móvil en la mano
   que una niña de once años a la carrera. Un banner en el tablero de la
   junior invitaría justo a eso.
2. **El «deja de mostrarlo» se guarda en el APARATO, no en la base.** Una
   suscripción pertenece a la instalación, así que «aquí no hay avisos» es
   una verdad local: guardarlo por perfil lo escondería en el móvil de al
   lado, donde sigue haciendo falta. La clave lleva el gremio dentro para
   que dos familias en el mismo navegador no se pisen.
3. **Calla cuando no serviría de nada**: navegador que ya bloqueó, aparato
   que no puede, clave del despliegue ausente. El botón al que llevaría
   tampoco funcionaría, y culpar a quien no tiene la culpa es ruido.

### Lo que enseñó el trayecto

**Un bug que ningún test habría cogido, y que solo apareció mirando la
pantalla.** El mensaje de despedida —el que explica la ruta tras pulsar
«Dejar de mostrar»— tapaba el panel **para siempre**: su rama cortaba
antes de que se mirara el flag de oculto, así que «Entendido» no hacía
nada. Los 617 tests estaban en verde y el build limpio. Es exactamente lo
que dice §3 de este documento y por eso se repite aquí.

**Y `push_subs` entró en el backend simulado.** Sin ella el aviso reventaba
en modo demo mientras en producción habría funcionado: la peor
combinación, porque la demo es justo donde se prueba. Es la trampa de §7
del arranque, encontrada antes de pagarla porque estaba escrita.

**Dónde está**: `lib/avisosPendientes.js` (la lógica y el porqué),
`screens/AvisoPush.jsx` (el banner), el paso `avisos` de `Onboarding.jsx`,
y `perfilesConAvisos()` en `lib/push.js` para el recuento —que devuelve
`null` si falla, a propósito: el aviso distingue «no le llega a cinco» de
«no he podido averiguarlo» y en el segundo caso no se inventa la cifra—.

---

## 7p. Perfiles de mascota (18 de agosto) · EN PRODUCCIÓN

Perro o gato con perfil propio, misiones y premios. **La justificación con
la literatura está en `docs/MASCOTAS.md`**; aquí solo lo que hay que saber
para no deshacerlo sin querer.

### Lo que se construyó

Alta en Miembros con rol «Mascota» y especie; al guardar **se le crean sus
nueve misiones y cinco premios**, porque un perfil vacío no lo rellena
nadie. Pestaña propia en el panel para apuntar sus misiones, que quedan
aprobadas en el acto —no hay a quién validárselas— y guardan quién las
apuntó. Migración 027 ejecutada, versión 2.3.0, y la narrativa contada en
2.3.1.

### Las tres decisiones que no hay que deshacer

1. **Los trucos NO son diarios.** Es lo más contraintuitivo de toda la app
   y lo único que contradice su mecánica central. Demant et al. (2011):
   los perros entrenados 1–2 veces por semana adquieren MEJOR que los
   diarios. Si alguien "simplifica" poniéndolo todo diario, la app estaría
   empujando a la familia hacia lo menos eficaz mientras le da palmadas.
   **Hay un test que falla si pasa.**
2. **Ninguna misión puede ser correctiva** (AVSAB 2021). Hay otro test que
   revisa el catálogo entero buscando lenguaje de castigo.
3. **El aviso vive solo en el panel y la mascota no es un jugador**: fuera
   del selector de perfiles, fuera de los avisos, y **no hereda las
   misiones genéricas de la casa**.

### Decidido el 18-ago: el XP de la mascota SUMA a la meta

Ya funcionaba así —`goalProgress()` suma todas las misiones aprobadas sin
mirar el perfil—, pero era una omisión y ahora es una decisión: el trabajo
es de la casa y la meta es de todos, así que cuidar al animal no puede ser
un juego paralelo que no cuente para nada. Está contado en la narrativa.

Lo que NO cambia: **el XP va a la mascota, no a quien la cuida.** Quien
cepilla al perro no se lleva puntos propios.

### Dos cosas que salieron al construirlo, y que valen para todo el proyecto

- **`esParaPerfil` tenía un agujero.** Una misión sin destinatario valía
  para cualquier perfil, lo cual era correcto mientras todos eran
  personas. Al añadir un rol nuevo, **el perro heredaba «Beber agua»**. La
  lección general: cada vez que se añada un rol, hay que revisar los sitios
  donde el código dice «para todos» dando por hecho que todos son iguales.
- **No cabía el perro.** `MAX_PERFILES` es 8 y el gremio ya tenía 8
  perfiles activos: con un cupo compartido la funcionalidad habría sido
  inusable desde el minuto cero. Las mascotas cuentan en `MAX_MASCOTAS`
  aparte.

---

## 8. Pendientes

**Lo que de verdad queda abierto, por orden.** Nada de esto es código
bloqueado: son cosas de uso, o decisiones que piden datos antes que
teclado.

0. **Vivir con los Talis y con la mascota.** Es lo único que queda de la
   2.4.1, y no es código: el nombre nuevo y la Crónica llevan en
   producción desde el 18-ago sin que nadie los haya usado una semana, y
   ese es justo el error que sacó los tres fallos de §7r. Mirar sobre
   todo si la Crónica se entiende sin explicarla.
1. **Activar los avisos en los teléfonos que faltan.** Medido el 18-ago:
   **cinco de los ocho perfiles activos no tienen ningún aparato**. Hay
   que reinstalar la PWA desde elgremioapp.com y activar Ajustes → 🔔
   Avisos en cada uno. **Desde 2.2.0 la app lo recuerda sola** en el panel
   parental (§7o), así que esto ya no depende de que alguien se acuerde;
   pero el gesto sigue teniendo que hacerlo una persona en cada móvil.
2. **Un par de semanas de uso antes de añadir nada**, y entonces mirar el
   cuadro de mando y el diagnóstico de economía con datos reales.
3. Lo demás —poderes por cablear, huecos de producto, backlog— está más
   abajo y no corre prisa.

**Y una cosa que solo puede decir el uso:** dar de alta un perro por
primera vez sacó **tres fallos en el primer minuto** (§7r). Vivir con la
mascota una semana antes de tocar nada más. Sobre todo para ver si el reparto de
trucos en días alternos se entiende sin explicarlo, que es donde esto se
juega su credibilidad.

**Cerrado el 18-ago y aquí solo como registro:** las migraciones 025 y
026, la Edge Function `notificar`, la mudanza a Vercel (§7n), `www`, y la
variable `VITE_VAPID_PUBLIC` del repositorio. **No queda ninguna migración
pendiente.**

### El correo ya no está pendiente

La cadena entera está hecha y probada: dominio, buzón, SMTP propio, las
tres plantillas en español, el enlace de recuperación abierto de verdad
y «Confirm email» encendido (§7i). Si algún día un correo deja de llegar,
el sitio donde mirar es **Authentication → Auth Logs** —un fallo de SMTP
sale ahí en vez de un «request completed»— y después el tope de 30/hora
en Rate Limits.

### La Edge Function `notificar` ya está al día (18-ago) · HECHO

Estaba desplegada la de **hace dos días** mientras el esquema y el
repositorio ya llevaban lo de la 026 (`franja`, `sin_programar`,
`sin_plan_manana`). No se notaba —`push_log.franja` tiene `'tarde'` por
defecto, así que los avisos de siempre seguían saliendo— y por eso era
fácil que se quedara así para siempre: se enviaba todo menos el
recordatorio de noche, en silencio.

Redesplegada: **versión 5, `verify_jwt=False`**, comprobado con
`supabase functions list`.

**La trampa que casi se paga, y que hay que leer antes de volver a tocar
esto.** La primera versión de esta sección decía:

```bash
supabase functions deploy notificar        # ← MAL, sin la bandera
```

Ejecutado tal cual, **habría roto los avisos por completo**: la función se
autentica con su propia cabecera `x-gremio-secreto` y está desplegada con
`verify_jwt` en false (lo dice su propia cabecera, líneas 15-16). Sin la
bandera, el despliegue reactiva la verificación de JWT y el cron —que
manda `x-gremio-secreto` y ningún `Authorization`— empezaría a comerse
401. Y como el fallo estaría en `cron.job_run_details` y no en la app,
nadie se enteraría hasta echar de menos los avisos.

**Cómo se comprueba en qué modo está la desplegada, sin deducirlo:** una
llamada sin cabeceras. Si contesta `{"error":"no autorizado"}`, eso es la
FUNCIÓN hablando y `verify_jwt` está en false. Si contestara el mensaje
del gateway de Supabase, estaría en true.

El comando bueno, y sin `supabase link` —que pediría la contraseña de la
base sin necesitarla para esto—:

```bash
supabase functions deploy notificar --project-ref chfbrawsoulfiywiqhpe --no-verify-jwt
```

Comprobado después: sin secreto sigue dando el 401 de la función, y con él
responde 200 con su resumen, saltando los perfiles por franja horaria.

**Y comprobado de punta a punta el mismo día**, forzando la franja con
`?forzar=noche` (envía notificaciones reales; se hizo a propósito y con
permiso). `push_log` quedó así:

```
dia         franja  motivo          enviados
2026-08-18  noche   sin_programar   1
2026-08-18  noche   sin_programar   1
2026-08-18  noche   sin_programar   0
2026-08-18  noche   sin_programar   0
2026-08-17  tarde   vuelve          1     ← histórico
2026-08-16  tarde   racha_riesgo    1     ← histórico
```

Las dos cosas que prueba de golpe: **`franja` y `sin_programar` existen y
se escriben** —o sea, la 026 y la función nueva están vivas— y **el
backfill dejó en `'tarde'` todo lo anterior**, que era su trabajo.

**Los dos `enviados = 0` no son un fallo**: son perfiles sin aparato
registrado. Es el pendiente de más abajo —reinstalar la PWA desde
elgremioapp.com y activar Ajustes → 🔔 Avisos en cada teléfono—, y aquí se
ve medido: de seis perfiles, cuatro tenían algo que decir de noche y solo
dos tienen dónde recibirlo.

**La lección, que es la del §7e otra vez y del revés.** Aquella decía que
la migración va antes del despliegue del bundle, porque el cliente no
puede pedirle a la base algo que todavía no existe. Esto es el otro lado:
el esquema puede adelantarse a la Edge Function igual de silenciosamente.
La regla completa es que **una funcionalidad de este proyecto tiene TRES
piezas —esquema, bundle y Edge Function— y no está entregada hasta que las
tres van a la vez.**

### Y después: los avisos en los móviles

**Activar Ajustes → 🔔 Avisos en cada teléfono, con la app reinstalada
desde elgremioapp.com.** Un PWA queda atado al origen donde se instaló, y
el viejo ahora redirige fuera de su ámbito: sin reinstalar, la suscripción
push no vale. Es lo único que le falta a una funcionalidad que ya está
montada y comprobada de punta a punta.

### Y luego: mirar el cuadro de mando con datos reales

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

### Planificar por días de la semana · CONSTRUIDO (16-ago, tarde)

Está hecho de punta a punta, verificado en el navegador y **con la
migración 024 ya ejecutada en producción** (§2). Lo único que falta para
que la familia pueda usarlo es **desplegar**: la base va por delante del
bundle.

Lo verificado en el navegador, no solo compilando: la tira de siete
casillas en el formulario (44 px de alto, entra en 375 px sin scroll
lateral), la tira de lectura en la lista de misiones, guardar `[1,7]` y
que persista, el tablero de la junior enseñando solo lo que toca hoy, la
pantalla de la peque igual, el vacío «No queda ninguna por hoy» cuando el
día está libre, y la racha marcando **3 días** con lunes/miércoles/viernes
hechos y los martes y jueves libres por el medio —que sin los días
neutros habrían dado 1— sin el aviso de «hoy todavía no».

Lo que se tocó, por si hay que seguir el hilo: `challenges.days` en
`schema.sql` y en la migración, `sin_mision_ese_dia` y `streak_days` en
Postgres, la vista `push_pendientes`, `misiones.js` (el patrón entero),
`rachas.js` y `meritos.js` (días neutros), `economia.js` (la carga),
`Home`, `KidHome`, `ParentPanel`, `CaminoRacha`, `resumen.js` y
`styles.css`. 32 tests nuevos en `tests/dias.test.js`.

**Una corrección al diseño que estaba escrito aquí**, porque importa: el
diseño decía que los días sin misiones podían entrar por `diasSalvados`,
el mecanismo del comodín. **No podían.** Un comodín TAPA Y SUMA —cuenta
como día hecho—, y un día neutro solo tapa. Metidos por ahí, a quien solo
tuviera misiones los lunes le habrían contado los otros seis días como
hechos y habría llegado a los cien días sin hacer nada. Van por un
parámetro propio, `diasNeutros`, en las tres funciones y en Postgres. Es
la trampa a recordar si alguien vuelve a tocar las rachas.

Dos cosas que no estaban en el plan y salieron por el camino:

- **La carga se recalcula con el reparto.** Una diaria repartida en tres
  días pesa 3/7, no 1, y el tope de siete diarias mira el PEOR DÍA y no
  el total. Sin esto, repartir ocho misiones en cuatro y cuatro seguía
  avisando de que se pasa de siete: regañar por haber hecho justo lo que
  el aviso pide.
- **«Racha viva» en `push_pendientes` se lee de `racha`** y ya no se
  deduce de «ayer hizo algo». Eran lo mismo hasta hoy; con días neutros
  por medio, ayer puede ser un martes libre y la racha seguir entera.

Y una decisión de interfaz: el patrón se ofrece también a las semanales y
mensuales («la colada, los sábados») y **no a las únicas**, que no se
repiten; pasar una misión a «única» borra el patrón, porque una misión de
una sola vez y además solo los martes es una forma silenciosa de que no
aparezca hasta el martes que viene.

El diseño original, que se cumplió salvo en lo corregido arriba:

**1. Se planifica por DÍA DE LA SEMANA, no por «semana que empieza hoy».**
Esta es la respuesta a «una semana puede empezar cualquier día», y la
respuesta es que entonces no hay que modelar semanas. Un patrón de siete
casillas (L M X J V S D) **no tiene fecha de inicio**: se repite solo, y
empezar a usarlo un jueves no produce ninguna semana parcial que haya que
normalizar. Todo el problema desaparece por construcción.

Esto pide una columna `days smallint[]` en `challenges` (1 = lunes …
7 = domingo, `null` = todos los días, que es el comportamiento de hoy) y
tocar el predicado de `src/lib/misiones.js`, que es el único sitio donde
se decide qué misión sale hoy —para eso se centralizó en la 013—.

El modo «cada N días» **se deja fuera a propósito**: ese sí necesita una
fecha ancla por misión, y con ancla vuelve el problema que el patrón
semanal no tiene. Si algún día se quiere, va con su `anchor_date`, no sin
ella.

**2. La racha cuenta DÍAS CUMPLIDOS, no días con actividad.** Sin esto,
la funcionalidad se come el sistema de rachas: si a la junior le tocan
lunes, miércoles y viernes, el martes no tiene nada que hacer y hoy eso
le rompería la racha. Un día sin misiones asignadas tiene que ser
**neutro**: ni la rompe ni la alarga.

La buena noticia es que el mecanismo ya existe y no hay que inventarlo:
`rachaActual`, `rachaMaxima` y `hoyHecho` (`src/lib/rachas.js`,
`src/lib/meritos.js`) aceptan `diasSalvados`, que significa exactamente
«este día no rompe». Los días sin misiones entran por ahí. **Ojo: hay que
pasarlos también a `claim_streak` en Postgres**, que es quien certifica
la racha y paga los hitos; si solo se arregla el cliente, la pantalla
dirá 12 y la base pagará por 4.

Y el número que se enseña sigue siendo real, que es la regla 4 del banco
de mensajes: con días alternos, llegar al hito de 30 cuesta más semanas
de calendario. Eso es correcto y no hay que maquillarlo.

**3. En la interfaz, una tira de siete puntos por misión** (L M X J V S D,
rellenos los que tocan), no una fila nueva por día. Con la letra Y el
relleno se lee sin depender del color. Cabe en la fila que ya existe y no
vuelve a llenar la pantalla, que era la condición de partida.

Lo que hubo que tocar, en orden: migración `challenges.days` + `schema.sql`
→ `misiones.js` → el formulario de misión y la biblioteca → `KidHome` y el
tablero → `rachas.js`/`meritos.js` con los días neutros → `claim_streak` →
la vista `push_pendientes`, que decide a quién avisar y daba por hecho
que todos los días son iguales.

`claim_streak` no se tocó, y eso es una buena noticia: usa `streak_days`
desde la 019, así que arreglar la cuenta en un sitio la arregló en los
dos. Si llevara su propia copia, hoy habría dos que mantener y el aviso
diría 12 mientras el cobro pagaba por 4.

### Programación diaria de tareas · ENTREGADA (17-ago, cerrada el 18)

Lo pidió la familia: que un adulto decida cada noche qué harán al día
siguiente la junior y la peque. **Ya está entregada del todo**: las tres
piezas —esquema (025 y 026), bundle y Edge Function— van a la vez desde el
18-ago.

**Lo que costó y merece recordarse:** el bundle estuvo desde la mañana del
18 pidiendo `plan_diario` a una base donde esa tabla todavía no existía,
porque se desplegó antes de migrar. Es el §7e otra vez, y estuvo roto en
producción unas horas sin que saltara ninguna alarma.

**LA DECISIÓN QUE LO SOSTIENE, y que hay que respetar si se toca: el plan
es una CAPA por fecha ENCIMA del patrón semanal, no un requisito.** Si
nadie programa, manda el patrón y el día sale como siempre —olvidarlo no
rompe nada y la racha no sufre—. Solo aplica a las DIARIAS; semanales,
mensuales y únicas van por su vía. Tres decisiones más, cerradas con la
familia:

- **Sustituir es solo para ese día.** El plan es por fecha: la sustituta
  sale mañana y pasado vuelve el patrón. Una pausada metida en el plan
  sale por su id **sin activarse** —ese es el caso de «sustituir por hoy
  sin tocar el patrón»—; la biblioteca, en cambio, activa permanente, y la
  UI lo dice.
- **«Hay plan» se mira por PERFIL, no por familia.** Si el adulto programó
  a la junior y no a la peque, la peque sigue con su patrón, no con el
  tablero vacío. Un plan vacío (deseleccionar todo) no se escribe: equivale
  a «sin plan» y vuelve el patrón.
- **Dos franjas de aviso, no una.** El tope de `push_log` pasó de «uno al
  día» a «uno por franja»: tarde (17-19, hacer misiones) y noche (20-22,
  el recordatorio de programar). Máximo dos al día, y no se pisan.

**El motor: la capa `planDelDia`** en `src/lib/misiones.js`. Sin plan
para esa fecha devuelve EXACTAMENTE `misionesDe({dia})` —un test lo fija
elemento a elemento—, así que los tableros no cambian de comportamiento
mientras nadie programe. La fecha del plan se compara sin `new Date(cadena)`,
que es la trampa de zona de la 018/024.

**Dónde está cada cosa:**

- `plan_diario` (migración 025): una fila por (familia, dia, misión
  diaria). RLS por familia, guardarraíl que solo deja programar hoy o
  mañana, purga a 7 días en el cron de las 4:12, realtime.
- Pantalla **«Programar mañana»**: un modal desde la pestaña Validar (NO
  una séptima pestaña —seis ya entran justas a 360 px—). Preselecciona lo
  que el patrón dice que toca mañana, se confirma o se sustituye. En
  `ProgramarManana`/`ToggleMision` de `ParentPanel.jsx`.
- Tableros `KidHome`/`Home`: pasan de `misionesDe({dia})` a
  `planDelDia(..., data.planDiario, ...)`. Un solo punto de cambio en cada.
- Avisos: `push_pendientes` expone `sin_plan_manana` (la vista NO decide la
  franja, para que `?forzar` siga sirviendo); `notificar/index.ts` decide
  la franja por la hora y, de noche, manda `sin_programar` al adulto sin
  plan de mañana; `mensajes.ts` tiene el banco nuevo (sin culpa, sin
  género, determinista). `?forzar=tarde|noche` fuerza una franja para
  probar.

**Verificado en el navegador** (demo): la preselección sale correcta para
mañana (miércoles: «Sacar la basura» de L/X/V incluida), la sustitución de
una activa por una pausada se guarda como `sustituta`, confirmar escribe
las 4 filas del día, el tablero de la junior con plan de hoy muestra SOLO
lo planificado —una pausada incluida— y NO el patrón, y sin plan vuelve el
patrón sin diferencia. 578 tests en verde (22 nuevos en
`tests/plan-diario.test.js` y el de `mensajes`).

**Lo que NO se pudo probar en el navegador**: el reparto de avisos por
franja (`sin_programar`, no pisar la tarde) vive en la Edge Function y la
vista, y solo se prueba de verdad contra la base con las migraciones
puestas. La lógica está en tests (mensajes) y el espejo SQL, pero el envío
real hay que verificarlo al desplegar: forzar `notificar?forzar=noche` y
comprobar dos filas en `push_log` con franjas distintas el mismo día.

**Dos gotchas que salieron y conviene recordar:**

- **El backend simulado no tenía `.gte` ni `plan_diario`.** La carga filtra
  el plan por fecha con `.gte('dia', ...)`, y el backend demo solo entendía
  `eq`: habría reventado en pantalla (la trampa clásica del §7). Añadidos
  los dos a `fakeBackend.js`. Si se usa otro operador nuevo, lo mismo: o se
  añade, o revienta solo en demo.
- **`--acento` no existía como variable CSS.** La tira de días de la 024
  usaba `border-color: var(--acento)`, que se ignoraba en silencio (el
  borde se quedaba gris en vez de oro). Corregido a `var(--oro)` —el acento
  real de la app— en la tira y en los toggles nuevos.

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

En la base quedan pendientes la **025 y la 026** (programación diaria).
Lo anterior, las veinticuatro primeras migraciones, están
ejecutadas y comprobadas, la 024 incluida.

### Un detalle que mordía, ya arreglado

La tienda de la peque salía vacía con el tarro lleno de estrellas. La
causa real no era el nivel del premio sino el precio: su tienda filtra por
`TECHO_PEQUE` (72 monedas) y el premio más barato del catálogo cuesta 325.
Resuelto en el setup (§7g): si hay peque, se le crean premios a su alcance
y la tienda de los demás filtra por encima de ese techo.

**En el gremio que ya está en producción esto NO se arregla solo**, porque
su tienda se creó antes. Ya no hay que teclearlos a mano: Panel → Premios
→ «✨ Premios de arranque» los ofrece con una casilla cada uno y los crea
de una vez (§7m).

### Escrito pero no activado

- **Edge Function de health**: está en `supabase/functions/health/`, sin
  desplegar. Requiere la CLI de Supabase. Solo hace falta si se quiere un
  monitor externo tipo UptimeRobot.
- **`npm run prueba:concurrencia`**: escrito y sin ejecutar nunca. Necesita
  `GREMIO_EMAIL` y `GREMIO_PASSWORD` de la cuenta familiar, crea una misión
  temporal, comprueba la atomicidad y limpia lo que creó.
- **Sentry**: adaptador listo en `monitoring.js`, apagado. Sin
  `VITE_SENTRY_DSN` no se carga nada ni sale un byte hacia terceros.
  Repasado el 17-ago y el **veredicto es que a esta escala NO hace falta**:
  `salud_diaria` (migración 023) ya da el recuento diario de errores de
  todas las familias —`security definer`, se salta el RLS— y `app_logs`
  guarda el detalle 30 días. Sentry solo añade avisos en el momento y
  trazas des-minificadas, que importan con muchas familias, no ahora. Y si
  algún día se enciende, la receta de `docs/RUNBOOK.md` §3 lleva ya las dos
  trampas que le faltaban: **(1)** hay que meter el host de ingest de
  Sentry en `connect-src` de la CSP o cada evento muere en silencio contra
  la política, y **(2)** manda datos de menores a un tercero → región EU,
  `sendDefaultPii:false`, `beforeSend` que tira `user`/`request`, DPA y
  mención en privacidad. Es decisión legal, no interruptor.

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
npm test             # 599 tests, deben pasar
npm run dev:demo     # trastear sin tocar producción
npm run dev          # contra la Supabase real
```

Antes de dar nada por terminado:

```bash
npm run verify           # tests + build + revisión de credenciales
git push origin main     # PRIMERO: Vercel construye desde el remoto
npm run vercel           # publica en elgremioapp.com
npm run health           # 🟢 web + 🟢 supabase
```

**`npm run deploy` ya NO es el comando de publicar.** Sigue funcionando,
pero publica en `gh-pages`, que desde el 18-ago es la red de seguridad y
no el sitio que ve la familia (§3 y §7n).

Y si lo que has tocado es el esquema o la Edge Function, recuerda que una
funcionalidad aquí tiene **tres piezas** y no está entregada hasta que las
tres van a la vez:

```bash
# 1. esquema: ejecutar la migración en el SQL Editor (método en §2)
# 2. bundle:  git push && npm run vercel
supabase functions deploy notificar --project-ref chfbrawsoulfiywiqhpe --no-verify-jwt   # 3.
```

La bandera del final no es opcional: sin ella se rompen los avisos. El
porqué está en §8.

---

## 7q. Las monedas ahora son Talis (18 de agosto) · 2.4.0 · EN PRODUCCIÓN

Cambio de nombre de la divisa, y no es cosmético. **El canon completo está
en `docs/TALIS.md`**; aquí solo lo que hay que saber para no deshacerlo.

### Por qué

El tutorial abría advirtiendo que un sistema de «tarea hecha, moneda
cobrada» se apaga en la semana tres, y a la vez la interfaz decía
«monedas» en catorce sitios. El nombre trabajaba contra el diseño: una
moneda dice «te pago por esto» sin necesidad de añadir nada. Un **Talis**
es una ficha de reconocimiento: no mide lo que vale la misión, marca que
alguien ha contribuido al Gremio. La mecánica es idéntica.

### Lo que se hizo

- `src/lib/talis.js` + `src/components/Cronica.jsx`: el vocabulario —`TALIS`, `BOLSA`,
  `CASA`, `LEMA`, el formateador `talis(n)` y los `FRAGMENTOS` de lore—.
- Texto visible renombrado en toda la app, la narrativa pública, los docs
  y las dos páginas legales.
- Sección de lore nueva en `public/narrativa/index.html` (acto «Qué es»,
  la tercera) y la leyenda del origen dentro del tutorial.
- `docs/TALIS.md` con el canon y la separación entre ficción e historia.
- 27 tests nuevos (`tests/talis.test.js`). Total: **660, en verde**.

### Las tres cosas que NO se tocaron, y por qué

1. **La columna sigue siendo `coins`.** No hay migración y no debe
   haberla. El lore separa el «concepto funcional» del «nombre
   narrativo», y esa separación es justo lo que permitió cambiar el
   relato entero sin tocar una sola función que abona dentro de una
   transacción. **Hay un test que falla si alguien renombra el esquema.**
2. **`redeem_reward` sigue devolviendo `'sin_monedas'`.** Renombrarlo
   obligaría a migrar por un motivo cosmético y a coordinar cliente y
   base en el mismo despliegue. Otro test lo vigila.
3. **La pantalla de la peque no dice «Talis».** A los tres años sus Talis
   se siguen dibujando como estrellas, sin cifras. La ficha gremial es
   una abstracción que no le sirve todavía.

También se quedan como estaban los identificadores internos
(`monedasPorDia`, `MONEDAS_POR_ESTRELLA`, `monedas_x`, el campo `monedas`
de `HITOS`). Es la misma frontera del punto 1: funcional dentro, narrativo
fuera. Si algún día molesta, es un renombrado mecánico y sin riesgo, pero
no aporta nada a quien usa la app.

### Regla para escribir texto nuevo

Talis **no pluraliza**: `1 Talis`, `20 Talis`. Nunca «Talises». No hay que
acordarse: usar `talis(n)` de `src/lib/talis.js`. Y en las líneas de datos
apretadas —cuadro, historial, camino de rachas— va el glifo 🪙 solo, sin
la palabra, igual que se escribe `XP` y no «experiencia».

### Lo que falta

Solo **publicar**: `npm run verify && git push origin main && npm run
vercel`. La Crónica ya está cableada (Progreso, debajo de las insignias) y
comprobada en el navegador en sus tres estados: todo cerrado, dos abiertos
con su pastilla de «Nuevo», y la historia completa. El detalle de las
decisiones está en `docs/TALIS.md` §5.

---

## 7r. Los tres fallos del alta de mascotas (18 de agosto) · 2.4.1

Encontrados dando de alta un perro por primera vez, que es lo que §8
llevaba días diciendo que hacía falta. Los tres son de la 2.3.0.

1. **El onboarding ofrecía el rol «Mascota» y rompía el alta entera.** El
   desplegable salía de `ROLE_LABEL` —que incluye mascota— pero el insert
   no manda `species`. Postgres rechaza esa fila por
   `profiles_especie_coherente`, y como todos los miembros van en un solo
   insert, **se caía el alta de la familia completa**. Ahora usa `ROLES`.
2. **Elegir perro o gato no se veía.** Las pastillas usaban `.activa`,
   que no existe para `.pastilla-habilidad`; el CSS solo define `.sel`.
   El estado cambiaba y la pantalla no. Parecía que la app no dejaba
   elegir especie, que es exactamente como se reportó.
3. **No había avatar de perro ni de gato.** Van al final de `EMOJIS`, no
   al principio: el onboarding enseña `EMOJIS.slice(0, 8)` y ahí se dan
   de alta personas. Al elegir especie se propone la cara
   (`EMOJI_DE_ESPECIE`, en `lib/mascotas.js`).

### La grieta por la que pasaron, que es lo importante

**El backend simulado no comprobaba la coherencia de especie y Postgres
sí.** En demo la mascota sin especie se creaba tan tranquila. Un demo más
permisivo que la base **da luz verde a lo que va a romperse en casa de
alguien**, y es la razón por la que el fallo 1 llegó a producción sin que
nadie lo viera.

Ya la comprueba, con el mismo mensaje de error que la base. Si se añade
otro `check` a `profiles`, conviene añadirlo también ahí.

### Lo que dejan como norma

- Una pastilla se marca con **`.sel`**. Hay un test que lee las pantallas
  y el CSS y falla si alguien usa una clase que no está definida.
- Y la lección de §8, ahora con nombre: **construir una funcionalidad
  entera antes de usarla una vez** es cómo se llega a tener tres fallos
  en el primer minuto de uso. Las mascotas llevaban desde el 18-ago
  «construidas y en producción» sin que nadie diera de alta un animal.

---

## 7s. La estética nueva (18 de agosto) · 2.5.0

Aplicada la guía de assets y la propuesta «el taller nocturno». La guía
está copiada en `docs/GUIA-ASSETS.md`; aquí solo lo que hay que saber
para no deshacerlo.

### Lo que cambió

Paleta (#141428 / #1D1D36, oro #F2B33D→#FFD77A, teal #4FC4B5), tres
tipografías —Fraunces títulos, Inter cuerpo, **Baloo 2 solo en la peque**—
y dieciséis piezas propias en `public/assets/`: emblema, ficha de Talis,
gema, ocho iconos de habilidad, estrellas, fondo y pergamino.

### Las cuatro trampas, por orden de lo caro que salen

1. **Los assets del zip traen marca de agua «AI生成»** en la esquina
   inferior izquierda. No se ve sobre blanco y se lee perfectamente sobre
   el índigo del tablero, que es donde se usan. Las de `public/assets/`
   están limpias. **Si alguien reimporta una pieza del zip, vuelve.** Hay
   un test que falla si aparece un PNG sin redimensionar, que es la única
   forma de que eso pase.
2. **`--display` se redefine dentro del mundo de la peque.** Al pasar
   `--display` a Fraunces, su pantalla se quedó **entera en serif**: la
   regla global `h1,h2,h3` gana por especificidad y hay una docena de
   reglas suyas que piden `var(--display)` a mano. Se arregla redefiniendo
   la VARIABLE en las seis raíces del mundo peque —`.kid` y las cinco
   capas fijas hermanas—, no listando selectores. Hay test.
3. **El fondo NO va en el body con `background-attachment: fixed`**,
   aunque es lo que pide la guía. Va en `.ambiente`, que ya es
   `position: fixed`. El atajo de la guía reabre el bug del fondo que
   parpadeaba en Safari de iOS.
4. **La estrella vacía de la peque se oscureció a #9C895D.** El contorno
   #E8DCC2 que pide la guía da 1,1:1 sobre el papel crema: la peque no
   podía contar las que le faltan, que es exactamente para lo que están.

### Lo que se decidió al aplicarla

- **El dorado dejó de decorar.** Siete usos de cromo —foco, pastillas
  elegidas, puntos de carrusel, toggles— pasaron al teal. El oro se queda
  en XP, Talis, insignias, meta, rachas y celebración.
- **El estandarte `banner-meta.png` NO se usa, y no conviene reintentarlo.**
  Su dibujo mide 1361×716: al ancho de la tarjeta de la meta son 183 px de
  alto, más que todo su contenido. Y recortado se ve recortado —se
  probaron tres encuadres—, porque un cortinaje con caídas y borlas no
  tiene por dónde partirse. El ornamento de esa tarjeta es ahora
  `.filigrana`: un filete dorado dibujado en CSS con un rombo en el
  centro, que además separa el rango de la meta. No puede salir cortado
  porque no hay imagen.
- **La gema es la misma pieza para todos** y el color del miembro pasó al
  halo de detrás. Si fuera solo la imagen, los cuatro perfiles serían
  idénticos justo donde más falta hace distinguirlos.
- **Los assets pesan 424 KB, no 11 MB.** Cada pieza a 2-3× su tamaño real
  en pantalla; fondo y pergamino a JPEG por ser opacos. Hay un test con
  tope por fichero y tope del conjunto.

El contraste salió mejor que antes, no peor: el texto secundario sobre
tarjeta pasa de 4,69:1 a 6,05:1.

---

## 7t. El arrastre de la peque y el icono del escritorio (18-ago) · 2.5.1

Dos fallos que solo se ven con la app instalada en un móvil. Los dos son
anteriores a la estética nueva.

### La pantalla de la peque se arrastraba fuera del teléfono

`.kid-cabecera` iba a sangre con `width:100vw` + `margin-left:50%` +
`transform:translateX(-50%)`. **Los transforms no cuentan para
`scrollWidth`**: la caja de layout seguía midiendo 563 px dentro de un
contenedor de 375, y como `.kid` tiene `overflow-y:auto` —que fuerza
`overflow-x:auto`, porque en CSS `visible` no puede convivir con otro
valor— esos 188 px eran scroll horizontal real.

Ahora va con márgenes negativos que anulan el padding. **El margen lateral
es UNA variable** (`--kid-margen-izq` / `--kid-margen-der`) usada por el
padding y por la cabecera: escrito dos veces, se desincroniza en cuanto
alguien toque uno. La media query de ≥620 px mueve la variable, no el
padding. Comprobado a 375, 900 y 1280 px: cero desbordamiento y la
cabecera de borde a borde. Hay tests.

Y `.kid` y `.kid-tienda` llevan ya `overscroll-behavior: contain`, como
`.modal`: sin eso el rebote elástico de iOS se propaga al documento.

### El icono del escritorio no era el del gremio

El `apple-touch-icon` apuntaba a `icon.svg`, y **iOS no admite SVG ahí**.
Al no poder leerlo ponía una miniatura de la web. Ahora hay PNG: 180 para
iOS, 192 y 512 para el manifiesto y un **maskable de 512** con el emblema
al 60 % —Android recorta hasta el 20 % exterior según la forma del
lanzador y el laurel se quedaba sin puntas—. Los avisos del service worker
también usan PNG. `icon.svg` ya no existe.

**Y faltaba la mitad, que se vio al probarlo (2.5.2).** Seguía saliendo
una letra «E». iOS pide `/apple-touch-icon.png` y
`/apple-touch-icon-precomposed.png` **por su cuenta**, sin leer el HTML, y
el `rewrites` catch-all de `vercel.json` le devolvía `index.html` con un
200: iOS daba el 200 por bueno, no podía decodificarlo y pintaba la
inicial. Ahora esos dos ficheros existen de verdad, más `favicon.ico`. En
Vercel el estático gana al rewrite. **Si algún día parecen duplicados de
`icon-192.png`, NO se borran**: hay un test que lo explica.

**Al probarlo hay que reinstalar la PWA**: el icono viejo se queda cacheado
en el escritorio hasta que se borra y se vuelve a añadir.

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

**El captcha está ENCENDIDO y verificado de punta a punta** (Cloudflare
Turnstile, widget «El Gremio», modo Gestionado). Sin token, los tres
endpoints de Supabase responden `captcha_failed`; con la app real, las
tres operaciones pasan. Receta completa en `docs/CAPTCHA.md`.

**Y de ahí salió el fallo más traicionero de toda la sesión.** Con el
captcha ya exigido, registrarse y recuperar la contraseña funcionaban y
**entrar no**: `signInWithPassword` quiere el token DENTRO de `options`, y
se estaba pasando al lado de `email` y `password`, donde **supabase-js lo
descarta en silencio** —ni error, ni aviso, ni nada en consola—. El único
síntoma era que la familia no podía entrar, justo la operación que nadie
prueba después de tocar el registro.

No lo cazó ningún test ni el build: se vio interceptando el cuerpo real de
la petición en el navegador. La forma vive ahora en `argumentosDeEntrada()`
(`src/lib/acceso.js`) con tests que la fijan. **Regla para la próxima: al
tocar el acceso se prueban las TRES, y se empieza por entrar.** La
comprobación rápida no crea ninguna cuenta: entrar con un correo
inventado; si sale «Email o contraseña incorrectos», el captcha pasó.

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

---

## 7l. CI, por fin (16 de agosto)

Dos workflows en `.github/workflows/`, y la diferencia entre ellos es lo
que hay que entender:

- **`ci.yml`** corre en cada empujón: tests, build, credenciales y código
  muerto. **No despliega nada.** Existe porque hasta hoy los tests solo
  corrían si alguien se acordaba, y ese alguien era siempre la misma
  persona en el mismo portátil.
- **`desplegar.yml`** se lanza A MANO desde Actions. No es despliegue
  continuo a propósito: aquí se empuja documentación varias veces al día y
  publicar en cada empujón convierte el despliegue en ruido. Es la póliza
  contra el punto único de fallo — si el portátil desaparece, se puede
  publicar un arreglo desde el móvil.

**El workflow de despliegue REUTILIZA `npm run deploy`.** No reimplementa
la publicación, y eso no es pereza: ese script escribe el `version.json`
que lee `npm run health`, publica la rama `gh-pages` y deja la etiqueta
para poder volver atrás. Una copia paralela de todo eso se habría separado
del camino local en tres meses, y nos habríamos enterado el día que
hiciera falta.

Antes de que el despliegue por Actions funcione hacen falta **tres
variables de repositorio** (Ajustes → Secrets and variables → Actions →
pestaña *Variables*, NO *Secrets*: las tres son públicas y viajan en el
bundle):

```
VITE_SUPABASE_URL         https://chfbrawsoulfiywiqhpe.supabase.co
VITE_SUPABASE_ANON_KEY    la clave publishable del proyecto
VITE_TURNSTILE_SITE_KEY   0x4AAAAAAERftVUmt9C26CW7
```

Si falta alguna, el workflow **para en el primer paso** en vez de publicar
una app que no conecta con nada o que no dibuja el captcha. Un despliegue
roto y silencioso es peor que no desplegar.

**Trampa del token:** el token de `gh` de esta máquina no tiene el scope
`workflow`, así que **empujar ficheros de `.github/workflows/` falla**.
Se arregla una sola vez con `gh auth refresh -s workflow`, que es
interactivo y tiene que hacerlo la persona.

**Y el camino se recorrió entero el mismo día**, que era el objetivo: un
camino de emergencia que nadie ha usado nunca no es un camino, es una
suposición. El primer despliegue desde Actions (`deploy-2026-08-16-1058`)
publicó el mismo commit que la rama, mantuvo el CNAME, dejó su etiqueta de
rollback y la app siguió funcionando: captcha resolviendo, sesión llegando
a Supabase y service worker activo.

> **Al día de hoy esto describe la RED DE SEGURIDAD, no el sitio real.**
> Desde el 18-ago el dominio lo sirve Vercel y se publica con
> `npm run vercel` (§7n). Los dos workflows de aquí siguen vivos y
> publicando en `gh-pages`, que es adonde se vuelve si Vercel falla.

**Los dos caminos conviven a propósito.** `npm run deploy` desde el
portátil sigue siendo el de todos los días —es más rápido y se ve lo que
pasa—; Actions es para cuando ese portátil no está. Los dos ejecutan el
MISMO script, así que no pueden separarse.

---

## 7u. Los sellos de oficio (19 de agosto) · 2.6.0 · EN PRODUCCIÓN

Las insignias dejan de ser emoji. Hay **80 piezas** en
`public/assets/insignias/`: las 73 del catálogo v1 que describen
`docs/INSIGNIAS-01..06` y 7 de legado. La receta de generación y las
reglas visuales están en `docs/GUIA-ASSETS.md`; aquí solo lo que hay que
saber para no deshacerlo.

### Qué es esto y qué NO es

Es **solo la capa visual**. El motor sigue siendo el de las 16 insignias
de `src/lib/insignias.js`: no se concede nada nuevo, no se evalúa ninguna
condición del catálogo v1, no hay tabla nueva y la economía no se toca.

`src/lib/sellos.js` es el catálogo de imágenes y el mapa `código de
insignia viva → sello`. Las 57 piezas que aún no tienen regla están ahí
declaradas, esperando al motor. El motor v2 —evaluación en servidor,
migraciones 017-024, las vistas Ahora/Colecciones/Historia, celebraciones
agrupadas, la bandeja de la peque— es el plan de 16 PRs de
`INSIGNIAS-06-PLAN-IMPLEMENTACION.md` y **no está empezado**.

### Las cuatro cosas que costaron un intento cada una

1. **El material ES la escala, y por eso dos insignias visibles a la vez
   no pueden compartir metal.** `x10` y `x25` cogían peldaños contiguos de
   Trayectoria (01 y 02), los dos en bronce, y en la rejilla parecían la
   misma insignia repetida. Ahora se saltan: 01/03/06 → bronce, plata,
   oro. Lo fija `tests/sellos.test.js` y no es cosmético: si el escalón no
   se ve, no hay escalón.

2. **El estado no puede vivir solo en el color.** `bloqueada` era
   `opacity:.38 + grayscale(1)` sobre la tarjeta ENTERA, lo que dejaba el
   texto en ~1,9:1. Ahora se atenúa solo la imagen, el texto va a opacidad
   completa (6,05:1) y el estado se dice además con palabras
   («Conseguida» / «Aún no»). Bajar ese texto aunque sea al 72 % lo deja
   en 3,8:1 y AA pide 4,5:1: **no se vuelve a atenuar**.

3. **El peso.** 80 PNG a resolución nativa son 206 MB. En WebP a 192 px
   son 976 KB. El tope de `public/assets` (700 KB) defiende la CARGA
   INICIAL y estas piezas no son eso —bajan en diferido, dentro de una
   pestaña—, así que tienen presupuesto propio en `tests/sellos.test.js`
   (20 KB por pieza, 1,2 MB el conjunto). `estetica.test.js` ahora filtra
   solo ficheros: sin eso, `readFileSync` sobre la carpeta reventaba.

4. **El recorte del fondo.** Ver `docs/GUIA-ASSETS.md`: la clave por
   distancia euclídea al magenta deja aureola rosa en los sellos con halo;
   hay que clasificar por tono (`min(R,B) − G`). Y el CDN que sirve las
   imágenes generadas devuelve 403 al User-Agent por defecto de Python.

### Verificado en el navegador

Con `npm run dev:demo`, sembrando la demo desde la consola
(`localStorage.gremio_demo_db`) con 8 insignias conseguidas y 8 sin
conseguir: rejilla a 375 px sin scroll horizontal, sellos a 64 px (40 px
en la fila de poderes), 19 imágenes cargando, `aria-hidden` en la imagen y
el estado en texto, contrastes medidos en la propia página.

---

## 7v. El motor de los sellos (19 de agosto) · 2.7.0 · EN PRODUCCIÓN

Las 80 piezas de §7u ya no son solo dibujo: **66 de los 73 del catálogo v1
se conceden solos**. Lo que sigue es lo que hay que saber para no
deshacerlo.

### Las piezas

| Fichero | Qué hace |
|---|---|
| `src/lib/sellos.js` | catálogo + las REGLAS, como datos |
| `src/lib/sellos-motor.js` | proyección por persona y evaluación. Puro: ni red ni estado |
| `src/lib/sellos-carga.js` | historial completo paginado + `conNuevas` |
| `src/components/LoteDeSellos.jsx` | la celebración agrupada |
| `src/components/SellosGanados.jsx` | «Tu historia» y el siguiente escalón |

Las reglas son OBJETOS, no funciones, y eso es deliberado: el destino de
esto es Postgres (INSIGNIAS-02) y un objeto se traduce a SQL mientras que
un `(s) => s.x >= 3` hay que reescribirlo.

### Lo que NO se toca sin pensarlo dos veces

**Todo lo de abajo sale de la misma regla: una insignia dada no se quita.**
Un falso positivo aquí no es un bug, es una insignia que un crío tiene
para siempre sin haberla ganado.

1. **`completa` no se pone a `true` a la ligera.** Es lo que decide si el
   motor evalúa Regreso y Equilibrio. Son las dos únicas familias que
   pueden dar un falso POSITIVO con datos a medias: con medio historial,
   la fila más antigua que se ve SIEMPRE parece «volver tras una pausa».
   El resto de familias solo puede quedarse corta, que es seguro, y por
   eso sí se evalúan aunque falte historia.

2. **Los siete sin regla se quedan sin regla.** Autonomía (4) necesita que
   alguien declare el nivel de ayuda; los dos repetibles de temporada
   necesitan instancias (`profile_badges` tiene `unique(profile_id,code)`);
   el de generaciones necesita la banda evolutiva. Ponerles una regla
   aproximada es exactamente lo que prohíbe la regla 6 de INSIGNIAS-01.

3. **`meritosDe().insignias` cuenta SOLO las dieciséis viejas.** Si se
   quita ese filtro, `coleccionista` —la única del gremio— se la lleva
   quien abra la app primero, porque el lote retroactivo sube a un perfil
   de tres insignias a doce de una pasada. No es un mérito, es el orden en
   que se desayuna.

4. **El lote se acumula, no se sustituye.** Conceder recarga los datos y
   esa recarga vuelve a pasar por `otorgarInsignias`. Sustituyendo, la
   segunda tanda abría un modal encima del que se estaba leyendo.

5. **El historial se pagina UNA vez por sesión.** Después se le pega lo
   nuevo con `conNuevas`, que deduplica por `id` porque las dos fuentes se
   solapan. Paginarlo en cada pasada son veinte peticiones por misión
   validada en una familia con años de historia.

### Lo que falta para el motor de verdad

Esto evalúa en el CLIENTE. INSIGNIAS-02 pide servidor autoritativo, y
sigue siendo el destino: mientras tanto, dos dispositivos pueden proponer
el mismo lote a la vez (lo salva el `unique`, no el diseño) y el contexto
histórico no está congelado —editar la habilidad de una misión reescribe
qué camino entrenó su pasado, y borrarla se lleva sus completions por
cascada—. La familia de misión es hoy el `challenge_id`, que aguanta
renombrar el título pero no duplicar la misión.

Pendiente también: las migraciones 028+ de INSIGNIAS-05 (snapshot
histórico, familia estable, instancias de temporada, nivel de ayuda).

### Verificado en el navegador

Demo sembrada con 60 misiones aprobadas en 20 días distintos, 3 retos y 2
habilidades: se conceden 11 (5 viejas + 6 sellos), en UN solo overlay, sin
errores en consola. `oficio_hogar_2` NO se concede, y está bien: le faltan
familias de misión. `coleccionista` tampoco, que era el fallo.

---

## 7w. Las migraciones 028–030 (19 de agosto) · 2.8.0 · **EJECUTADAS EL 19-AGO POR LA TARDE**

> Ejecutadas y comprobadas las tres, en orden, con el método del repo
> (traer por hash de commit + cotejar SHA-256). **La 029 NO se pudo
> ejecutar tal y como estaba escrita**: su trigger de inmutabilidad
> (`tg_completion_snapshot_inmutable`) rechazaba también la PRIMERA
> escritura del snapshot, que es justo lo que hace su propio backfill
> dos pasos después. En una base nueva no salta (cero filas que
> rellenar), así que build, tests y demo lo dieron por bueno; contra la
> base real reventó con P0001 y la transacción entera se revirtió, que
> es lo que tenía que pasar. Arreglado en `ed0a311` (la primera
> escritura se permite; la puerta no se reabre porque quitar
> `snapshot_quality` cae en la comprobación de siempre) y ejecutada a la
> segunda: backfill completo, `snapshot_quality is null` = 0 filas. El
> SHA bueno de la 029 es ahora
> `b8323dba3a0fcd3afa4f5dace647c37a79935cc831de659ac1b407c9903fea9e`.
>
> **Y una trampa nueva de Supabase que salió aquí:** las tablas nuevas
> **ya no nacen con grant para `anon`** (las de antes de agosto sí lo
> tienen). A `authenticated` no le falta nada —la app no se entera—,
> pero la comprobación externa de siempre («la lectura anónima da
> `[]`») devuelve **401** en vez de `[]` hasta que se añade
> `grant select ... to anon`. Hecho a mano para `mission_families` y
> `campanas_limpieza` el 19-ago; si una migración futura crea tabla,
> que lleve su grant.

### Qué cierran

| # | Fichero | Qué arregla |
|---|---|---|
| 028 | `migracion-028-familias-de-mision.sql` | duplicar una misión fabricaba variedad de la nada |
| 029 | `migracion-029-snapshot-historico.sql` | editar o borrar una misión reescribía o destruía el pasado |
| 030 | `migracion-030-sellos-por-temporada.sql` | `unique(profile_id,code)` impedía los sellos repetibles |

### Cómo se ejecutan

En ORDEN. La 029 depende de la 028.

```
028 → 029 → 030
```

SHA-256 para cotejar antes de pulsar Run (§2: pegar desde el navegador
destroza los acentos, hay que traer el fichero con la consola del editor):

```
028  9655f9ced0e59aff5ffd51e70f8bfe1e86cf7f3df4815c67e5a2e4e0cc00462d
029  d9a6307b1d00529be9bdda91c8cd3d595137c4d96984f783f71fba20c9860c09
030  55398a4563639f4be457e41d0416fc936158af5f454378b3e4c1b1eb1c552ade
```

La 029 hace backfill de TODAS las completaciones en lotes de 5.000. En una
familia con años de historia tarda; el lote existe para que el SQL Editor
no se rinda a la mitad.

### La ventana entre desplegar y migrar

Es real, porque las migraciones las corre una persona a mano. El código ya
desplegado la aguanta:

- `sellos-carga.js` pide las columnas del snapshot y, si Postgres
  responde `42703` (no existe la columna), **repite la consulta con las
  básicas**. El motor cae al challenge actual, que es exactamente como
  funcionaba en 2.7.0.
- Sin ese respaldo el fallo se vería como «dejaron de darse insignias»,
  que es de los que cuesta días diagnosticar.

### Lo que CAMBIA de comportamiento al ejecutarlas

1. **Borrar una misión con historial deja de funcionar.** La clave pasa a
   `restrict`. La app lo detecta por el código `23503` y ofrece retirarla
   (`active = false`), conservando la historia. Ver `src/lib/retirarMision.js`.
   Una misión SIN historia se sigue borrando igual.

2. **Algunos sellos de oficio pueden dejar de estar «a punto».** Si dos
   challenges de la misma habilidad eran en realidad la misma actividad,
   ahora cuentan como UNA familia y la variedad exigida no está cubierta.
   Verificado en demo: con «Hacer la cama» y «Hacer la cama (verano)»
   compartiendo familia, `oficio_hogar_1` deja de concederse; separándolas
   en dos actividades reales, vuelve. **Lo ya concedido no se quita**, que
   es la regla.

3. **El backfill marca `snapshot_quality = 'legacy_current_state'`**, y eso
   dice la verdad sobre sí mismo: ese contexto se dedujo del challenge que
   existía el día del backfill, no del que había cuando se hizo la misión.
   Lo capturado a partir de ahora es `native`. Ninguna regla futura debe
   tratarlos como equivalentes sin decirlo en voz alta.

### Lo que habilitan pero AÚN NO usa nadie

- `challenges.track_assistance` + `completions.assistance_level` son el
  dato que les falta a los cuatro sellos de **Autonomía**. La columna ya
  está; falta la interacción para declararlo sin convertir la validación
  en un formulario, y esa es una decisión de producto (INSIGNIAS-04 §7.7).
- `profile_badges.instance_key` + `family_goals.season_number` habilitan
  los dos sellos **repetibles de temporada**. Falta concederlos al cerrar
  meta con `instance_key = goal_id`.

Hasta que eso exista, esos seis sellos siguen SIN regla en `sellos.js`, y
así debe seguir: conceder por una condición que el sistema no puede
demostrar es lo único irreversible.

### Lo que sigue faltando para el motor de INSIGNIAS-02

Esto evalúa en el CLIENTE. Falta la parte grande: ledger de eventos,
proyecciones incrementales, concesión transaccional en servidor, cola de
evaluación y reconstrucción. Son las tablas de INSIGNIAS-05 §6–§9, y no se
escribieron aquí a propósito: son ~15 tablas y ~20 funciones de PL/pgSQL
que no se pueden probar contra una base desechable desde este portátil, y
soltarlas sin probar sobre la base de una familia real es peor que no
tenerlas.

---

## 7x. El modo limpieza (19 de agosto) · 2.9.0-2.10.0 · **EN PRODUCCIÓN, DE PUNTA A PUNTA**

Campañas de limpieza como misión secundaria, a petición de la familia y
a partir de un planificador doméstico real. **El diseño completo está en
`docs/LIMPIEZA.md`**; aquí lo operativo y lo que no hay que deshacer.

### Qué es

Un adulto lanza una «operación» desde Panel → Misiones → 🧹 Modo
limpieza: un formato (relámpago 15-90 min · zona de la semana · estancia
a fondo), participantes y reparto sugerido —equilibrado por minutos, la
peque incluida—, y qué adulto responde. Las tareas nacen como
`challenges` únicos (`skill 'hogar'`, `campana_id`) y viajan por el
camino de siempre: tablero → validar con elogio → `resolve_completion`.
Si la operación se completa entera antes de vencer, botín: la mitad de
los Talis ganados por cada participante, vía `bonuses` tipo
`limpieza:<id>`, sin XP. Cada tarea lleva un reloj de «Empezar» según su
esfuerzo (10/25/40 min) que es ayuda, no examen.

### El estado exacto

- **Código, tests (803) y demo verificados.** El flujo entero se probó
  en el navegador con `dev:demo`: lanzar, tableros, estrella de la
  peque, validación, cierre con botín (importes exactos), segunda
  campaña, reloj corriendo y sobreviviendo a recargas, y el guardarraíl
  de deshacer tras el botín.
- **Pasó revisión de código adversarial** (1 HIGH y 2 MEDIUM, los
  cuatro arreglados antes de ejecutar nada): índice único parcial
  `idx_campanas_una_activa` que respalda físicamente «una activa por
  gremio» —sin él, dos aparatos lanzando a la vez dejaban una campaña
  activa INVISIBLE bloqueando el gremio—, `unique_violation` capturada
  en lanzar y en cerrar (doble cierre concurrente → 'ya_cerrada', el
  dinero ya estaba a salvo por el índice de bonuses), y
  `undo_completion` rechaza con 'campana_cerrada' deshacer una tarea de
  una operación COMPLETADA, que dejaba el botín pagado por trabajo
  desaparecido.
- **La migración 031 se ejecutó el 19-ago por la tarde** (SHA cotejado
  `faa50ec90800c4a21853f68ab0954212c4d5b73303341dfa014ee6042ad736e5`),
  tras las 028-030 y con TODO comprobado: los ocho contadores a 1, los
  bloques adversariales rebotando como deben (tipo inventado y fechas
  al revés → 23514; dos activas a la vez → 23505 por el índice único),
  la lectura anónima devolviendo `[]` y el health en verde con el
  bundle 2.9.0 delante. Las piezas van a la vez: el modo limpieza está
  vivo de punta a punta.
- El orden del día quedó torcido y conviene contarlo: el bundle 2.9.0
  se publicó ANTES de migrar (la ventana del §7e otra vez, esta vez sin
  romper nada porque los degradados aguantaron). Las migraciones se
  ejecutaron después desde el navegador, con el bug de la 029 por medio
  (§7w).

### Decisiones que no hay que deshacer

- **Los Talis de limpieza doblan-cuadruplican los normales y la XP se
  queda cerca (tope ×2).** Es la mayor fuente proporcional de Talis del
  sistema A PROPÓSITO —es el trabajo más grande de la casa— y
  `tests/limpieza.test.js` fija la promesa y el techo (peor caso ≤ 300
  Talis por campaña). La XP no se infla porque marca nivel y meta.
- **Una operación activa por gremio, y solo adultos lanzan y cierran.**
  Las dos reglas viven en Postgres (`crear_campana_limpieza`,
  `cerrar_campana_limpieza`), con el doble check del premio a mano y el
  espejo en `fakeBackend.js`.
- **El cierre es un botón, no un automatismo** (como la subida de
  precios): «🎉 Repartir el botín» cuando todo está validado, «Recoger
  la campaña» cuando venció (pausa lo pendiente, sin botín).
- **El botín se calcula dos veces** —`botinPrevisto` (cliente) y el SQL—
  con `floor(sum/2)`. Si se toca un redondeo, se tocan los dos.
- **La pantalla de la peque no lleva reloj ni bloque de operación**: su
  tarea sale como una baldosa más. Un toque, estrella, y ya.
- **El reloj guarda el instante de inicio en localStorage**, nunca un
  contador (lección de `mantenerPulsado.js`), y agotarse no bloquea.
- **En SQL se escribe «monedas», nunca «Talis»**: `tests/talis.test.js`
  vigila `schema.sql` entero, comentarios incluidos. Ya mordió una vez
  en esta sesión.

### Trampa pagada en esta sesión

La confirmación del cierre se desmontaba antes de verse: cerrar
refresca, la campaña deja de estar activa y la vista de campaña
desaparece del modal. El estado `cierre` vive ahora en `ModoLimpieza`
(el padre) y el botín se resuelve ANTES de refrescar. Si alguien
refactoriza ese modal, que no lo baje de ahí.

### Dónde está cada cosa

`src/lib/limpieza.js` (catálogo de 15 campañas + reparto + progreso +
botín) · `src/lib/temporizador.js` (el reloj) · `src/screens/ModoLimpieza.jsx`
(asistente y seguimiento) · `TareaDeOperacion` en `Home.jsx` (tarjeta con
reloj) · tintes en `ParentPanel.jsx` (`carta-operacion`) · flag
`modoLimpieza` · migración `migracion-031-modo-limpieza.sql` + espejo en
`schema.sql` · tests en `tests/limpieza.test.js` y
`tests/temporizador.test.js`.

### Personalizar las tareas (2.10.0, la misma noche)

Lo pidió la familia en cuanto lo vio: el catálogo tiene que ser un punto
de partida, no un contrato. En el paso del reparto, el lápiz de cada
tarea abre un editor con el nombre, el esfuerzo y el dibujo, y «+ Añadir
una tarea de esta casa» crea tareas propias (el hueco «{Agrega los
tuyos}» del planificador original). Verificado en el navegador: editar
título/esfuerzo/emoji se refleja en la fila y en los totales al
instante, la tarea propia no viaja sin nombre, y el reloj de una tarea
renombrada sale bien en el tablero.

Tres decisiones que no hay que deshacer:

- **Los roles aptos no se editan.** Renombrar «Limpiar el horno» no lo
  vuelve apto para la junior; la seguridad no se rebautiza. Las propias
  nacen para cualquiera porque las escribe el adulto sabiendo para quién.
- **Los puntos no se teclean**: esfuerzo × rol, como en todo el sistema.
- **`esfuerzoDeMision(reto, rol)` tiene segunda vía por PUNTOS** (el
  multiplicador de XP más cercano a {1 · 1,5 · 2}): sin ella, el reloj
  de cualquier tarea renombrada caía a «media». El título del catálogo
  sigue mandando cuando existe. Si alguien la quita «porque el título
  basta», el reloj de las personalizadas vuelve a mentir.

Las tareas del asistente viajan MATERIALIZADAS (cada una con su
`asignado` dentro); `tareasParaLanzar`/`resumenDeReparto` ya no reciben
la campaña sino la lista personalizada. Cambio solo de bundle: ni
esquema ni Edge Function.

Y una molestia de entorno que costó un rato en la verificación: la
primera visita tras `npm install`/lockfile nuevo hace que Vite
re-optimice dependencias y RECARGUE la página un par de veces; en esas
recargas el asistente pierde su estado y parece un bug de la app. No lo
es: en cuanto Vite se asienta, el modal aguanta entero.

---

## 7y. Las zonas de la casa y el modo piso (19 de agosto, noche) · 2.11.0 · **MIGRACIÓN 032**

Lo pidió la familia al ver el modo limpieza: las zonas y las estancias
tienen que ser LAS DE CADA CASA, y tiene que existir un gremio de
convivientes que no son familia. Detalle de diseño en `docs/LIMPIEZA.md`.

### Qué es

- **`zonas_casa` (032)**: el mapa del modo limpieza. Cada zona tiene el
  NOMBRE de esta casa y una PLANTILLA (cocina, baño, dormitorio, salón,
  entrada, lavadero, juegos, exterior o genérica) que dice qué tareas
  trae su limpieza, en dos listas: `semanal` (zona de la semana, 7 días)
  y `fondo` (profunda, 3 días). Viven en `src/lib/zonas.js`; el catálogo
  de `limpieza.js` se queda solo con los blitz.
- **El setup pregunta la vivienda** (paso «¿Cómo es la casa?»): baños,
  dormitorios, ¿más de una planta?, extras. UNA pantalla compositora que
  genera la lista y la enseña editable ahí mismo —la edición es la
  confirmación—. Se puede saltar.
- **`families.tipo_gremio`** ('familia'|'piso'): el paso «¿Quiénes
  formáis el gremio?». En un piso todo el mundo es adulto, no se
  preguntan dormitorios (cada conviviente recibe SU habitación, privada
  y con dueño) y las campañas de una habitación se sugieren enteras a
  esa persona.
- **⚙️ → Casa**: añadir, renombrar, quitar zonas, cambiar su clase y su
  dueño después del setup. Un gremio sin zonas adopta las de siempre
  con un botón.

### Decisiones que no hay que deshacer

- **LAS PLANTAS NO SE MODELAN.** Un chalet no necesita una entidad
  «planta»: necesita que sus dos baños se llamen «de arriba» y «de
  abajo». La planta solo decide NOMBRES en la generación
  (`nombresRepetidos`), igual que el patrón semanal evitó modelar
  semanas. Si alguien añade una tabla de plantas, que relea esto.
- **Sin zonas guardadas no se pierde nada**: `zonasDeLaCasa` cae a
  `ZONAS_POR_DEFECTO` (virtuales) y el modo limpieza va como antes de
  la 032. El botón de ⚙️ → Casa las persiste cuando alguien las adopta.
- **Los roles aptos son un SUELO, no un club** (`tareaApta` con
  jerarquía peque < junior < adulto): una tarea «de peque» la puede
  hacer cualquiera con más años. Sin esto, en un piso de adultos las
  tareas suaves de un dormitorio quedaban sin nadie apto. Lo de solo
  adultos sigue cerrado hacia abajo.
- **El dueño de una zona ES su tipo**: con dueño es privada, sin dueño
  común. En ⚙️ → Casa es UN desplegable, no dos controles que puedan
  contradecirse. Y en el setup del piso, `dueno` viaja como ÍNDICE del
  miembro (los perfiles no existen aún) y Onboarding lo traduce a id
  tras el insert, con el mismo casado por posición de las misiones.
- **`zonas_casa` se escribe directo con RLS** (como challenges y
  rewards), sin RPC: no toca economía ni necesita regla de adulto
  aparte —vive detrás del PIN—.

### El estado

Verificado en demo de punta a punta: alta de piso (11 pasos, «Baño de
arriba/abajo» al marcar dos plantas, habitación por conviviente con su
dueño, zona añadida a mano), asistente listando las zonas reales, la
habitación de Ana sugerida ENTERA a Ana, y ⚙️ → Casa renombrando con
persistencia. 829 tests.

SHA-256 de la migración (cotejar antes de Run, método §2):

```
032  c1de40cfbe585abb291b79558ee384deddec9daa7f17308f1990fde6a8b2ac6c
```

### La trampa del trayecto

`tests/talis.test.js` vigila que `schema.sql` no diga «Talis» NI en
comentarios; ya mordió dos veces. Y las tablas nuevas siguen sin
heredar el grant de `anon` (§7w): la 032 lo lleva explícito.

---

## 7z. El buzón de fallos (21 de agosto) · 2.14.0 · **EN PRODUCCIÓN, MIGRACIÓN 033 EJECUTADA**

### Qué es

La tabla `informes_fallo` y dos puertas para escribir en ella: «Algo va
mal · contarlo» en el selector de perfiles, y «Contar qué estabas
haciendo» en la pantalla de tropiezo (`ErrorBoundary`).

### Por qué, que es lo que no se deduce del código

`monitoring.js` recogía huellas de error desde el primer día y **nadie las
leyó nunca**: se quedaban en el navegador de quien sufría el fallo. Y la
pantalla de tropiezo decía «el fallo ya ha quedado registrado», que quería
decir «en la consola de este móvil». El agujero no era de captura, era de
transporte. Esto es el transporte.

### Decisiones que no hay que deshacer

- **La entrada NO va detrás del PIN.** Quien se tropieza con un fallo casi
  siempre es quien no tiene el PIN. Está en el selector, a un toque de
  «Cambiar» desde cualquier tablero.
- **La peque no la ve.** Su pantalla son dibujos; un botón de texto ahí es
  un botón que se pulsa por jugar.
- **Se dice qué se manda, en la propia hoja y antes de mandarlo.** Texto,
  versión, pantalla, agente recortado y las tres huellas más repetidas.
  Nada más. `tests/fallos.test.js` fija la lista de campos EXACTA: el día
  que alguien añada uno, la prueba lo dice en voz alta.
- **Al fallar el envío no se borra lo escrito.** El fallo más común es
  quedarse sin red, y se arregla solo en un minuto.
- **El envío busca el gremio por su cuenta si no se lo dan.** La pantalla
  de tropiezo puede no haber cargado nada, y es justo donde más falta hace
  poder contarlo.
- **Sin realtime, a propósito**: nadie escucha ese buzón desde la app.
- **Sin `maybeSingle()`**: el backend simulado no lo tiene, y una demo que
  no puede hacer lo que hace producción es peor que no tenerla.

### Cómo se lee (esto es lo que se usa de verdad)

RUNBOOK §3b. En corto:

```sql
select created_at, texto, pantalla, version_app, huellas
  from public.informes_fallo
 where estado = 'nuevo'
 order by created_at desc;
```

### El estado

Verificado en demo de punta a punta, las dos puertas: desde el selector
(fila con `pantalla='selector'`, versión y agente recortado) y desde la
pantalla de tropiezo (`pantalla='tropiezo'`, con el `family_id` resuelto
solo). Inyectando dos errores iguales por `window.onerror`, el informe
viaja con `[{huella:'TypeError: …', veces:2}]`, que era el objetivo entero
de la función. 870 tests.

SHA-256 de la migración (cotejar antes de Run, método §2):

```
033  5f27201fe7e7983ffc43ddad3ceae18cb4b7b563cb49aa2a3548110506839adb
```

### Cómo se ejecutó la 033 (y por qué importa para la próxima)

**No hizo falta el SQL Editor.** El CLI de `supabase` de esta máquina está
autenticado, y eso abre un camino que no estaba escrito en ningún sitio:

```bash
supabase db query --linked --project-ref chfbrawsoulfiywiqhpe -f migracion-033-informes-de-fallo.sql
```

Ojo con dos cosas: `--project-ref` **exige** `--linked` (solo, da
`LegacyDbQueryMutuallyExclusiveFlagsError`), y el mismo comando sirve para
comprobar sin tocar nada, que es como se descubrió que la 033 no se había
aplicado pese a darla por hecha:

```bash
supabase db query --linked --project-ref chfbrawsoulfiywiqhpe \
  "select count(*) from information_schema.tables where table_name='informes_fallo';"
```

**La lección, que es la cara:** una migración no está ejecutada porque
alguien lo diga, sino cuando los contadores lo dicen. Aquí se dio por
ejecutada, y las dos comprobaciones externas devolvieron `PGRST205` —con
`zonas_casa` respondiendo 200 al lado, que fue lo que descartó que fuera
la clave o el proyecto—. Comprobar ANTES de publicar costó un minuto;
publicar sin comprobar habría costado el primer informe de la familia.

Ejecutada y verificada el 21-ago a las 21:26: los cinco contadores a 1,
los tres `check` mordiendo sin dejar filas, RLS aguantando desde fuera
(200 y `[]`), la tabla existiendo (400 a una columna inventada) y la
escritura anónima rechazada con 401.

### La trampa de este trayecto

**Publicar el bundle antes que la migración.** Si pasa, el primer informe
muere con un «schema cache» que no dice nada; por eso `mensajeDeError`
traduce ese caso exacto a «Falta ejecutar migracion-033…», con su test en
`tests/observabilidad.test.js`. Aun así: **primero la 033, después
`npm run vercel`.**

---

## 7aa. El orden de la tienda (22 de agosto) · 2.15.0 · SIN MIGRACIÓN

Los premios se pintaban en el orden de `created_at` que trae la consulta
de `App.jsx`, así que los precios salían salteados. Ahora
`ordenarPorPrecio()` (en `src/lib/premios.js`) los pone de menos a más, y
la tienda lleva un botón para invertirlo.

Lo que hay que saber si se toca:

- **`ordenarPorPrecio` NO muta**: recibe `data.rewards`, que es estado
  compartido de App. Devuelve copia.
- **El empate se rompe por título en el MISMO sentido en las dos
  direcciones**, a propósito. Hay test.
- **La preferencia vive en `localStorage` (`gremio_orden_tienda`)** con el
  patrón de `latido.js`: almacén inyectable y `try/catch`, porque Safari
  en privado tira al escribir. Perder la preferencia es aceptable; que la
  tienda no dibuje, no.
- `premiosParaMayores` sigue **solo filtrando**: quien quiera orden, que
  lo pida. `premiosParaPeque` ya ordenaba de menos a más desde el primer
  día y no se ha tocado.
- El panel parental ordena igual, sin botón.

Verificado en demo con los 11 premios del gremio de pruebas: 325, 325,
350, 450, 480, 505, 505 de menos a más; al invertir, los dos 325 y los dos
505 conservan su orden interno; la preferencia aguanta el cambio de
pestaña. 878 tests.

---

## 7ab. El sello que no se concedía (22 de agosto) · 2.15.1 · SIN MIGRACIÓN

**El fallo más caro de este proyecto hasta la fecha, medido en días
vivo: tres.** Y no lo encontró nadie mirando la app, sino una consulta a
`app_logs` hecha para otra cosa.

`onConflict: 'profile_id,code'` contra un índice que la 030 había
convertido en `(profile_id, code, instance_key)`. Postgres: `42P10`, fila
entera al suelo. `App.jsx` captura el error y sigue, así que la app se
veía perfecta mientras el motor de sellos no concedía NADA desde el
19-ago. Los errores crecían (68 → 80 → 147 al día) porque se reintenta en
cada carga.

Tres lecciones, y las tres valen para el próximo cambio de esquema:

1. **Un `onConflict` es una dependencia del esquema escrita en una
   cadena de texto.** Cambiar un índice único en una migración obliga a
   buscar todos los `upsert` de esa tabla. Ahora lo vigila
   `tests/upserts.test.js`.
2. **Capturar el error y seguir convierte un fallo en un silencio.** Aquí
   estaba bien no tumbar la app, pero nadie miraba dónde caía el aviso.
3. **La demo era más permisiva que la base** y por eso no reprodujo nada:
   el backend simulado no tiene índices. Ya lleva el `instance_key: ''`
   por defecto, pero la lección de fondo es que la demo no puede ser la
   única verificación de algo que depende de una restricción de Postgres.

Y la meta-lección, que es la que importa: **1.650 líneas de registro en
siete días y ningún sitio donde mirarlas.** El panel de uso (§7ac, en
marcha) nace de aquí.

---

## 7ac. Spec de reconocimientos (22 de agosto) · SIN IMPLEMENTAR

`docs/RECONOCIMIENTOS.md`. Petición del autor: «evolucionar hacia un
sistema completo de reconocimientos, no solo recompensas».

El diagnóstico, en una línea: **todo lo que la app reconoce baja de
arriba abajo o lo dicta el motor**; no hay una sola pieza horizontal.
Nadie puede reconocer a nadie salvo el adulto que valida, a los adultos
no los reconoce nunca nadie, y el elogio —que se guarda bien en
`completions.praise`— deja de verse cuando rueda la semana.

Cinco piezas (Muro, Gracias entre iguales, lo espontáneo, Retrato, y
sacar el elogio de la tienda), ocho decisiones cerradas —la primera:
**un reconocimiento no da ni cuesta Talis ni XP**— y tres fases, con F1
(el Muro) **sin migración**, a propósito: es la prueba barata de que en
esta casa el reconocimiento se lee, antes de comprometer el esquema.

La 034 solo entra en F2. Hay **cuatro preguntas abiertas al final del
documento** que no puede decidir quien escriba el código.


---

## 7ad. El panel que no decía qué fallaba (22 de agosto) · 2.16.0

Continuación directa de §7ab. Si el fallo de los sellos estuvo tres días
vivo no fue solo porque el `onConflict` estuviera mal: fue porque **el
sitio donde había que verlo no lo enseñaba**.

Lo que se arregló en `src/screens/Estado.jsx` y `src/lib/registro.js`:

- La lista pintaba `evento`, que vale lo mismo para todos los errores.
  Ahora pinta la **huella**, el `origen`, el código de Postgres y en qué
  versiones ha aparecido (si sale en dos, sobrevivió a un despliegue).
- **Agrupado por huella, con `×N`**, «desde» y «última vez». Sin agrupar,
  lo grave se entierra bajo lo repetido.
- El filtro de nivel **iba después del `limit`**: se pedían 20 líneas de
  cualquier nivel y luego se quedaba con los errores. Con el ruido de
  `debug` e `info`, el panel enseñaba dos de 228. Ahora `.in('nivel',
  ['error','warn'])` en la consulta, y 200 filas.
- El botón de enviar y recargar **dice lo que ha hecho**.
- `fakeBackend` no tenía `.in()`. Añadido, con la lección de siempre: una
  demo menos capaz que la base miente en la dirección peor.

`tests/registro.test.js` (14 pruebas) fija el comportamiento con la fila
REAL que guardó producción el 21-ago a las 22:21.

---

## 7ae. La app se entera de que está vieja (22 de agosto) · 2.17.0

Sale de una pregunta del panel nuevo: por qué aparecía la versión
`2.5.1+ba00891` entre los errores del 21-ago. Respuesta: **una sesión
abierta desde el día 18**. Tres días, diez versiones.

`src/lib/actualizacion.js` compara `COMMIT` (inyectado en el bundle) con
el `commit` de `version.json` (escrito en cada despliegue). Si difieren,
`useVersionNueva()` devuelve `true` y App pinta el cartel.

Lo que hay que respetar si se toca:

- **No recarga sola, y no debe.** Ver el comentario del fichero.
- **El aviso va DENTRO del contenedor que no usa la peque**: su pantalla
  hace `return` antes. Moverlo más arriba se lo pone delante a ella.
- **Ante la duda, no avisa.** El guardia de `content-type` no es
  decorativo: en `npm run dev` el comodín de la SPA devuelve `index.html`
  con un 200, y sin esa comprobación saldría el cartel en cada arranque de
  desarrollo. Hay test.
- Relojes: 20 s al arrancar, 5 min de gracia al volver a primer plano, 30
  min en periódico. Mirar más a menudo no aporta —los despliegues son a
  mano y espaciados— y gasta batería y datos de alguien.

**Resuelto en la 2.18.0** lo que aquí quedaba pendiente: la tablet de la
peque no muestra el aviso, pero **se recarga sola al volver de segundo
plano** (`useRecargarAlVolver`, enganchado en `KidHome`). Tres guardias:
nada a medias (`celebrando`, `jugando`, `fiesta`, `ocupado`), dos minutos
mínimos escondida, y —el que importa— no reintentar para un commit que ya
se intentó, porque si tras recargar seguimos en el bundle viejo es que el
navegador sirve su caché y recargar otra vez es un bucle con una niña de
tres años delante. La línea `version.recarga_automatica` se vacía a la
base ANTES de recargar; si no, se iría con la página.

---

## 7af. El Muro (22 de agosto) · 2.19.0 · F1 de reconocimientos · SIN MIGRACIÓN

Primera pieza de `docs/RECONOCIMIENTOS.md`. `src/lib/muro.js` +
`src/components/Muro.jsx`, enganchados en Progreso (adultos y junior) y
en `FichaPeque` (ella).

Lo que hay que saber si se toca:

- **No hay dato nuevo.** Sale entero de `completions.praise`, que se
  escribe al validar desde el primer día. La app lo tenía y solo lo
  enseñaba dentro de su semana.
- **Solo lo aprobado.** Un elogio de una validación corregida después a
  «rechazado» no cuenta. Hay test.
- **La visita se sella con la fecha de la última frase**, no con `now()`:
  si llega una mientras alguien lee, sigue siendo nueva. Vive en
  `localStorage` por perfil (`gremio_muro_visto_<id>`), como la Crónica:
  es marca de un aparato, no dato del gremio.
- **El aviso no lleva número** (`Pestana punto`), y no es estética: los
  reconocimientos recibidos no se cuentan en ninguna pantalla (§10.1 de
  la spec). Para la peque el aviso es el latido de su avatar.
- **Un elogio no se puede firmar**: `completions` no guarda quién validó.
  Si se quiere, `resolved_by` va en la 034 y firma de ahí en adelante.

Siguiente: F2 (los gracias entre iguales), que ya sí pide la migración
034. Y ojo al alcance doble de §10.4: en modo piso, la F2 incluye P3.

---

## 7ag. Los gracias (22 de agosto) · 2.20.0 · F2 · **MIGRACIÓN 034**

El primer canal horizontal de la app. `src/lib/gracias.js` +
`src/screens/DarGracias.jsx`, con la variante sin texto de la peque
dentro de `KidHome`.

Lo que no hay que deshacer:

- **La tabla no tiene columna de recompensa.** No es un olvido: es la
  decisión 1 de la spec hecha esquema. Que no exista es más fuerte que
  acordarse de no usarla.
- **El tope de tres al día lo impone el trigger `tg_tope_gracias_dia`**,
  no la interfaz. El cliente solo lo enseña.
- **El `dia` lo calcula el cliente** con `dayKey(ahora, family.timezone)`,
  como `bonuses.dia`: a las 00:30 de un lunes, una tablet en otra zona
  contaría el domingo.
- **No se ofrecen hechos que ya tengan elogio** (§10.3). La regla mira si
  el hecho ya tiene palabras, no quién las escribió — entre otras cosas
  porque `completions` no guarda quién validó.
- **El backend simulado imita las tres reglas** (tope, no-a-uno-mismo y la
  forma del gesto). Una demo más permisiva que la base es peor que no
  tener demo.

Verificado en demo de punta a punta: dar tres, que el cuarto lo corte la
base incluso saltándose la interfaz, que la junior lo reciba firmado con
la cara de quien se lo mandó, que la peque dé con un toque y que su ficha
lo enseñe con la cara del remitente.

Pendiente de mirar en uso: en la tablet, la fila de «dar las gracias»
queda por debajo de sus cinco misiones y hay que bajar para verla. Es
deliberado —sus misiones van primero— pero si nadie la encuentra, sube.

---

## 7ah. F3 de reconocimientos (22 de agosto) · 2.21.0 · SIN MIGRACIÓN

Cierra `docs/RECONOCIMIENTOS.md` entera. Tres piezas:

- **`espontaneo` en familia**, con un botón en `DarGracias` que quita el
  encargo de la ecuación y marca la frase en el muro. En piso sigue de
  serie.
- **`src/lib/retrato.js`**: la frase de la semana, calculada y no
  guardada. Lee `snapshot_skill` (contexto congelado) y no cuenta NUNCA
  lo recibido: solo dice si alguien se acordó, sin cifra. Es §10.1
  aplicada, y hay un test que comprueba que la frase no contiene dígitos.
- **El elogio fuera del catálogo de premios**, con un test que falla si
  vuelve a aparecer algo que venda reconocimiento.

Lo que queda del sistema entero no es código. Son los criterios de §8 de
la spec, y el que de verdad importa: **que en la primera semana haya al
menos un reconocimiento dado por alguien que no sea adulto, y al menos
uno dirigido a un adulto**. Si eso no pasa, se habrá construido otro
canal de arriba abajo con nombre nuevo. Se comprueba así:

```sql
select tipo, count(*), count(distinct de_profile) as personas
  from public.reconocimientos group by tipo;
```

---

## 7ai. Progreso plegable (22 de agosto) · 2.21.1

`Plegable` en `components/ui.jsx` + `lib/plegado.js`. Envuelve «Lo que has
hecho» y «Lo que te han dicho», que son las dos secciones que crecen con
el uso.

- Un `<details>` con `open` controlado y memoria por aparato
  (`gremio_plegado_<id>`). Misma cabecera que «Ver el catálogo de sellos»,
  que ya era un `<details>`: **una sola forma de plegar en la app**, no
  dos parecidas.
- **La pista de la cabecera no es decorativa**: sin ella hay que abrir
  para saber si hay algo, y entonces plegar no ahorra nada. En el muro es
  la última frase y NUNCA un número (§10.1).
- El sellado del muro se movió de «al montar Progreso» a «al abrir la
  sección». Era un fallo de la 2.19.0: se daba por leído lo que nadie
  había leído.

---

## 7aj. La gramática de Duolingo (24 de agosto) · 2.22.0 · SIN MIGRACIÓN

**De dónde sale.** Una rama hermana —`claude/gremio-animations-tools-6fn3yf`,
en el repo `Proyectos`, no en este— estaba mirando animaciones y
herramientas con Duolingo como referencia. **No llegó a empujar nada**:
la rama no existe en ningún remoto, así que sus hallazgos no se pudieron
leer. Con eso sobre la mesa, la derivación se hizo aquí. Si algún día
aparece, hay que cotejar: esto es una lectura, no la suya.

**Qué NO es.** No hay mecánica nueva, ni migración, ni nada más que
hacer. Solo cambia lo que la app **contesta** cuando ya has hecho algo.
Es deliberado: §8 pedía un par de semanas de uso antes de añadir nada, y
la capa de respuesta se puede tocar sin añadir superficie.

**Cuatro piezas, tres módulos nuevos:**

`lib/contador.js` — **los números suben, no saltan**. Va en la Bolsa y en
la XP del tramo. Cuatro decisiones que están fijadas en tests porque no
son cosméticas:

- **Dura lo mismo suba 4 que suba 300.** Lo fijo es el TIEMPO (700 ms),
  no la velocidad. A velocidad constante, el premio grande sería el más
  lento y el pequeño no se vería.
- **Sube animado, baja instantáneo.** Ganar se saborea; gastar es una
  transacción.
- **La primera vez no se anima**, solo el cambio con la pantalla
  delante. Si no, abrir la app es una tragaperras.
- **El redondeo va HACIA el destino, no al más cercano.** Con
  `Math.round`, una subida de +1 se pasaba media cuenta enseñando el
  número viejo: el caso más corto era el único invisible.

  Y un regalo: al **subir de nivel**, `current` BAJA (95 → 5), y como las
  bajadas no se animan, ahí se planta solo. Es lo correcto.

`lib/celebracion.js` — **tres escalones**: `chispa` (1.100 ms, 4
estrellas), `normal` (1.900 ms, 10 — exactamente lo que ya había) y
`hito` (3.200 ms, 18). Cambian el **tamaño**, no solo la duración.
`Celebracion` sin `intensidad` se comporta igual que antes de la 2.22.0,
que es lo que evita tocar las llamadas ya repartidas. Subir de nivel →
`hito`; pedir un premio → `chispa`.

`lib/vibrar.js` — **el háptico**, en la estrella de la peque (4 sitios) y
en cada misión aprobada. **Sin interruptor en Ajustes**, a propósito: la
vibración ya tiene el del sistema y el silencio del móvil, y
`prefers-reduced-motion` cubre el resto. No existe en iOS Safari y eso no
es un fallo; lo que sí sería un fallo es que una excepción aquí se
comiera la acción que la disparó, así que va todo en `try/catch`.

**La llama inquieta** (`CaminoRacha` + `styles.css`). El 🔥 solo se mueve
el día que la racha está en riesgo. Es la lección del `latido` del
avatar: una animación permanente deja de comunicar en dos días. Duolingo
apaga su llama cuando no has practicado; aquí **no se apaga** —sería
castigar a mediodía, justo lo que este camino evita— sino que se
inquieta.

### Comprobado en el navegador, no solo compilando

Con `npm run dev:demo` y Chromium, que es lo que manda `CLAUDE.md` y lo
que habría cazado los tres bugs caros de este proyecto. Los cuatro:

- `normal` al aprobar misión, con el elogio debajo ✅
- `hito` al subir de nivel: `celebracion celebracion-hito`, 18 estrellas ✅
- `chispa` al canjear: `celebracion celebracion-chispa`, y el modal del
  sello se lee por detrás ✅
- llama: clase `racha-numero inquieta`, `animationName = llama-inquieta` ✅
- **el contador cazado a media subida**: la Bolsa marcando 903 con el
  valor real ya en 905 ✅

Cero errores de consola en todas las pasadas. 34 tests nuevos, **1.013 en
total**.

### La trampa que se pagó al sembrar la demo, y que volverá a pasar

Para poder ver la racha en riesgo hay que inventar `completions` en la BD
demo. Con los campos inventados —`approved_at`, `status: 'approved'`— la
app **revienta entera** con `RangeError: Invalid time value` en
`partesEnZona`, y el ErrorBoundary saca «El gremio ha tropezado».

Los campos buenos son **`requested_at` / `resolved_at`** y el estado es
**`'aprobado'`**, en español (`canDo` y `goalProgress` leen justo esos).
Merece la pena anotarlo porque el fallo no se parece en nada a su causa y
se pierde media hora buscándolo en el sitio equivocado.

### Lo que queda abierto

- **Verlo en un móvil de verdad.** El háptico no se puede comprobar en
  Chromium headless: ahí `navigator.vibrate` existe y no hace nada. Lo
  único que está probado es que no tira y que respeta
  `prefers-reduced-motion`; que el patrón `LOGRO` se note bien en la mano
  solo lo dice un teléfono.
- **Mirar si el `hito` cansa.** 3,2 s es mucho tiempo de pantalla
  tapada. Es la cifra más discutible de todo esto y la primera que hay
  que bajar si alguien lo dice.

### Estado de publicación de la 2.22.0 · 24-ago

**Mezclada en `main`. NO publicada todavía.** El último paso lo tiene que
dar una persona, y es una sola orden.

Por qué no lo dio la sesión: **producción se publica con un único
mecanismo**, el deploy hook `publicar-a-mano` (`VERCEL_DEPLOY_HOOK` en el
`.env`), y ese secreto no vive en el contenedor de la sesión. Comprobado
contra la API de Vercel, y no es una suposición: **las quince
publicaciones de producción de este proyecto llevan todas
`deployHookName: publicar-a-mano`**. Empujar a `main` NO publica solo;
solo dispara el preview de la rama. Que `main` vaya por delante de
producción es un estado normal aquí, no una avería.

```bash
cd ~/el-gremio && npm run vercel && npm run health
```

**Y lo que hay que saber antes de darla:** producción venía sirviendo
`754fcd2` (2.21.1), o sea **dos commits por detrás de `main`**. El 23-ago
entraron las **copias de seguridad cifradas** (`c482c68`) y el arreglo de
su cron (`3211863`) sin subir el número —`package.json` se quedó en
2.21.1— y se quedaron sin publicar. Así que esa orden **no publica solo
la 2.22.0: publica también aquello**. Sin migración pendiente ninguna, así
que el orden esquema→bundle no aplica y se puede dar tal cual.

Es el fallo del versionado otra vez, el que dejó el número parado en
1.0.0 durante 55 despliegues: depende de acordarse. Aquí no rompió nada
porque las copias son un script de fuera de la app, pero durante un día
`app_logs.release` habría dicho 2.21.1 sobre un bundle que no era el de
la 2.21.1.

**Lo que no se pudo comprobar desde la sesión**, y hay que mirar tras
publicar:

- `npm run health` necesita las claves del `.env`, y la salida a
  elgremioapp.com desde el contenedor da 403 por el proxy. La única
  comprobación que vale es la de tu máquina.
- El háptico: en Chromium headless `navigator.vibrate` existe y no hace
  nada. Hay que tocarlo en un móvil.

## 7ak. El Panorama y los Talis a mano (24 de agosto) · 2.23.0 · SIN MIGRACIÓN

**La app abre por «Hoy», no por las misiones.** `screens/Panorama.jsx` es
la pestaña nueva y la de arranque (`Home.jsx`, `useState('panorama')`).
Las cuentas viven todas en `lib/panorama.js` y están probadas en
`tests/panorama.test.js`; en el JSX no se suma nada.

Referencia declarada: los cuadros de **Oura** y **Opal**. De ahí salen el
arco con la cifra dentro, el titular en palabra debajo y las tres
pastillas colgando de una horquilla. Lo que NO se copia es la comparación
social —Opal enseña «un 19 % menos que tus iguales»—: en una casa eso es
una liga entre hermanos, y esta app no tiene ranking a propósito.

Decisiones que conviene no deshacer sin leer primero:

- **El arco cuenta lo enviado, no lo validado.** `diaDe()` mide
  `tocan - quedan`, o sea lo que ya no está en el plato. Con una misión
  pendiente de visto bueno, el día está hecho por su parte. Medir la
  validación es medir la diligencia del adulto y enseñársela a la criatura
  como si fuera suya.
- **Teal mientras corre, oro al cerrarse.** `components/Arco.jsx`, prop
  `cerrado`. Es la regla de la hoja aplicada a un componente.
- **`ahora` no gobierna `canDo`.** `canDo` lee `new Date()` por su cuenta,
  así que pasarle a `diaDe` una fecha inventada mueve el plan y no mueve
  la disponibilidad. Los tests del día van con la hora real por eso; los
  de la semana, con fecha fija, porque `semanaDe` no toca `canDo`.
- **El estandarte salió de Home a `components/Estandarte.jsx`.** Lo pintan
  el Panorama y las otras tres pestañas. Antes estaba escrito dentro de
  `Home.jsx` y hacían falta dos copias.
- **`min-width: 0` en `.tab`.** Con la sexta pestaña, `flex: 1` no basta:
  un hijo de flex trae `min-width: auto`, la barra medía más que la
  pantalla y «Panel» no se veía. Si algún día se añade una séptima, el
  problema volverá por el rótulo, no por el ancho de la barra.
- **`rachas.js` gana `diasSalvados()`.** El camino de la racha construía
  la clave a mano con `getDate()`, y eso solo coincide con `dayKey`
  mientras el aparato esté en la zona de la familia. Ahora la construyen
  los dos con `dayKey`.

**El aviso de los Talis a mano** (`components/TalisAMano.jsx` +
`lib/premioManual.js`, `tests/talis-a-mano.test.js`). El premio a mano
exige motivo desde la 014 «para que dentro de un mes se sepa por qué», y
ese motivo solo lo leía quien lo escribía. Ahora lo lee quien lo recibe.

- Se avisa una vez por concesión y por aparato
  (`gremio_manual_avisado:<perfil>` en `localStorage`, tope de 60).
- **Ventana de 14 días** (`DIAS_DE_AVISO`): lo más viejo se marca como
  visto en silencio. Sin eso, estrenar la app en un móvil sacaría de golpe
  todos los premios a mano de la historia del gremio.
- Se monta en `App.jsx` junto a `LoteDeSellos`, por lo mismo: tiene que
  sobrevivir a que Home se recargue por realtime.
- **No sale en el mundo de la peque.** Un motivo escrito no le dice nada
  a quien todavía no lee.

**Se cruzó con la gramática de Duolingo (7aj), que llegó antes a `main`.**
Las dos sesiones numeraron su trabajo 2.22.0; esta pasó a 2.23.0 al
integrar. Del cruce salieron dos costuras que conviene conocer:

- El `Bolsa` del Panorama cuenta solo, porque el contador vive dentro del
  componente de `ui.jsx`. No hay nada que hacer aquí.
- La llama de la racha se inquieta también en la pastilla del Panorama
  (`.chip-racha.inquieta`, reusando `llama-inquieta`). Dos pantallas que
  enseñan la MISMA racha no pueden contarla de dos maneras: la pastilla
  se había escrito para apagarse a gris, y eso contradecía la decisión de
  7aj de no apagar nunca la llama.
- El aviso de Talis a mano vibra con `LOGRO`: aparece sin que nadie lo
  haya pedido, y el toque avisa antes de que nadie lea nada.

Estado: `npm run verify` en verde (1.046 tests, los de las dos sesiones).


## 7al. El desbordamiento invisible de Hoy (24 de agosto) · 2.23.1

**Cómo se veía**: la pantalla de Hoy al 66 % y pegada a la izquierda en
un iPhone, con el fondo vacío a la derecha. La barra de pestañas, en
cambio, centrada en la pantalla y de su tamaño normal. Las demás
pestañas, perfectas.

**Esa combinación es la firma del problema**: el contenido en flujo se
coloca dentro del documento —que se había vuelto de 692 px— y lo `fixed`
se coloca contra la ventana. Cuando se vean las dos cosas descuadradas
entre sí, medir `document.documentElement.scrollWidth` contra
`clientWidth` antes que nada.

**La causa**: un `.sr` (texto para lectores de pantalla) dentro de cada
`.ficha-hab` de la tira de habilidades. Es `position: absolute`, así que
su caja cuelga del antecesor POSICIONADO más cercano. La tira tenía
`overflow-x: auto` pero no `position`, de modo que el antecesor
posicionado era `.carta`, ya fuera del carrusel, y **el recorte no le
alcanzaba**. Las fichas del final del carrusel dejaban su `.sr` a 692 px.

**El arreglo**: `position: relative` en `.ficha-hab` y en `.barra-dia`.
Test en `estetica.test.js` («nada se escapa del carrusel de
habilidades»), comprobado que falla al quitar la línea.

**Cómo encontrarlo la próxima vez**, porque el primer intento de buscar
el elemento culpable devolvió cero: un recorrido del DOM que descarta lo
que tiene un antecesor con `overflow` distinto de `visible` NO encuentra
esto, justo porque el fallo es que la cadena del DOM y la de bloques
contenedores no coinciden. Lo que sí funcionó fue la amputación: esconder
un candidato y volver a medir `scrollWidth`.

De paso, la barra de pestañas: con seis, «Progreso» en Fraunces se
cortaba en Safari. Se ensancha la barra a `100vw - 16px` y se cierran los
huecos por debajo de 480 px; quedan ocho píxeles de margen (15 %) a
393 pt. **No está holgado**: en una pantalla de 360 pt vuelve a ir justo.
Si hay que tocar esto otra vez, la salida buena no es encoger la letra
—12 px es el suelo— sino sacar «Cambiar» de la barra a la cabecera del
Panorama, que además es el patrón del que salió la pantalla (el perfil
vive arriba a la derecha en Oura y en Opal). Serían cinco pestañas a
68 px cada una y se acabó el problema.


## 7am. Las celebraciones que no salían (24 de agosto) · 2.23.2

**El síntoma**: «no me saltan los mensajes de recompensas ni las
animaciones». Y era verdad, pero no porque estuvieran rotas: la
celebración, el háptico y el contador funcionaban perfectamente cuando se
probaban de frente.

**La causa**: la celebración es una diferencia entre dos cargas de datos,
y su memoria (`prev`, un `useRef`) vivía en `screens/Home.jsx`. Pero
`App.jsx` hace `if (parentMode) return <ParentPanel …>`: **Home se
desmonta entero mientras se está en el panel**, que es donde se valida.
Al salir, `useRef(null)` otra vez y la primera pasada solo tomaba la
referencia. Nadie que validara su propia misión veía nada.

**Cómo se demostró**, porque el código «parecía» bien: A/B en la demo con
el mismo guion —salir de Home, aprobar por detrás, volver y forzar una
recarga—. Con el código de git: nada. Con el arreglo: «+20 XP · +4 Talis»
y su elogio. Y como las celebraciones se cierran solas en 1,9 s, sondear
con llamadas sueltas no vale: hay que dejar puesto un `MutationObserver`
y leer el registro después.

**El arreglo**: la memoria y el estado suben a `App.jsx`, junto a
`LoteDeSellos` y `TalisAMano`, que ya estaban ahí por lo mismo. La regla
sale a `lib/celebracion.js` (`marcaDe` + `queCelebrar`) con ocho pruebas.
Home conserva solo la chispa del canje, que sí es respuesta a un gesto
suyo, y la pide con `onCelebrar`.

**Lo que se pinta sigue dentro de la rama de los mayores**, no en la raíz
de App: si se montara arriba del todo saldría también encima de la
pantalla de la peque, que tiene su propia respuesta.

**Lo que NO se arregló, y es aceptable**: al salir del panel, la Bolsa no
cuenta hacia arriba, porque `useContador` monta de cero con Home. Da
igual: la celebración tapa la pantalla justo en ese momento y cuando se
va, la cuenta ya habría terminado. Si algún día molesta, la solución es
la misma que aquí —subir la memoria del contador por encima de Home—.

## 7an. El retrato del gremialista (24 de agosto) · 2.24.0 · MIGRACIÓN 035 EJECUTADA

Un perfil ya no es un emoji: es una figura por capas que gana equipo al
subir de nivel. Nueve fases del nivel 1 al 50. El detalle completo, con
las dos alternativas que se descartaron y por qué, está en
[`docs/RETRATO.md`](docs/RETRATO.md); el prototipo con el que se decidió,
en `docs/prototipos/retrato.html`.

### Estado: ejecutada y desplegada el 24-ago

La **035 está ejecutada** en `chfbrawsoulfiywiqhpe`: cuatro columnas,
cuatro CHECK y el trigger, con el backfill de `xp_maxima` cuadrado en los
once perfiles. El trigger se probó contra la base de verdad bajando la XP
de un perfil dentro de un bloque que aborta solo: la XP cayó a 0 y la
marca se quedó en 538, y nada de eso llegó a escribirse.

La 035 **no rompe al cliente viejo**: solo añade columnas nullables y
`emoji` sigue en su sitio como respaldo. Por eso la versión es menor y el
rollback de frontend sigue siendo seguro por sí solo.

### Tres decisiones que conviene no deshacer

- **La fase se calcula contra `xp_maxima`, nunca contra `xp`.** Deshacer
  devuelve la XP; si el personaje se desvistiera al deshacer, deshacer
  sería un castigo y la familia dejaría de hacerlo. Lo mantiene el trigger
  `trg_marca_de_agua_xp` y no el cliente, porque hay cuatro caminos que
  tocan `xp` y basta que uno se olvide. Mismo razonamiento que el rango
  del Estandarte.
- **Los niveles de las fases no son números redondos.** Están puestos en
  hitos de calendario (una semana, un mes, tres, seis, un año, dos,
  cuatro, siete) con la economía de `economia.js`. La curva es cuadrática:
  repartir por nivel daría saltos de años. Hay un test que lo defiende.
- **Las listas usan `vista="cabeza"` aunque quepa el cuerpo.** El picker
  se probó a 72 px con cuerpo entero: el farol salía como una caja gris
  suelta y encima se perdía el aro, que es lo que lleva la fase. El equipo
  se mira en la ficha.

### Dos trampas que salieron por el camino, ya pagadas

**`schema.sql` no se podía ejecutar de cero.** Ocho líneas de comentario
habían perdido sus `--` dentro del `create table profiles`. La base de
producción no estaba afectada porque se construyó por migraciones, pero
montar un gremio nuevo siguiendo el README fallaba con error de sintaxis.
Arreglado. Merece la pena mirar el fichero entero de vez en cuando: nadie
lo ejecuta nunca y por eso puede llevar meses roto sin que nadie lo note.

**Un componente usado sin importar pasa el build.** Vite empaqueta tan
tranquilo y revienta en pantalla con `ReferenceError`, en la ruta donde
vive ese componente. Pasó dos veces cableando el retrato —Cuadro y
Panorama— y las dos el build dio verde. Ahora lo cierra
`tests/imports.test.js`, que recorre `src/` y comprueba que todo lo que se
usa como `<Componente>` está importado o definido en el fichero.

### El modo demo se alineó a mano

`fakeBackend.js` copia a propósito las restricciones del esquema, así que
también lleva la 035: los defectos de `profiles`, el CHECK
`profiles_retrato_solo_personas` y el espejo del trigger. Ese último va en
`escribir()` y no en el update de `Consulta` porque las RPC tocan
`profiles` y escriben directas: en Postgres las cubre un trigger BEFORE y
aquí el único punto equivalente es la escritura. Si estuviera en el
update, deshacer bajaría la marca en demo y no en producción, y el
personaje se desvestiría solo en el sitio donde se prueba.

## 7ao. Lo que el retrato traía roto (24 de agosto) · 2.25.0 · MIGRACIÓN 036 EJECUTADA

Tres arreglos sobre la 2.24.0, los tres encontrados usándola.

**El retrato no se guardaba.** El `update` de un miembro lleva lista
EXPLÍCITA de columnas, y al añadir las tres del retrato en la 035 nadie
las metió ahí. El editor las cambiaba, Supabase devolvía éxito y la
pantalla decía «Guardado». Un fallo mudo: no hay error que leer, y solo se
descubre volviendo a abrir la ficha.

La fila se arma ahora en `filaDeMiembro()`, en `lib/miembros.js`, fuera
del formulario y con un test que comprueba que lleva todas las columnas
que el editor puede tocar. **Si se añade una pieza al retrato, hay que
añadirla ahí**; el test avisa, pero conviene saberlo antes.

**«Sin pelo».** Peinado nuevo, migración 036 (solo ensancha el CHECK, no
rompe nada). Con él elegido, el selector de color de pelo desaparece.

**El arco de fase no se veía en los perfiles cálidos**, y no era cosa del
naranja: el oro no contrasta con NINGÚN color de la paleta —1,04 en el
teal, 1,49 en el coral, 1,29 en el amarillo—. Parecía legible porque el
fondo oscuro de alrededor hacía el trabajo, y saltó donde peor se
disimulaba. Ahora el arco lleva un canal oscuro debajo (contraste 9,08) y
el aro de base va apagado, porque es lo que aún no se ha conseguido.

Cambiar el oro por otro color no era opción: el dorado reconoce, no
decora. **La lección no es el canal, es que el contraste se miraba a ojo**
y por eso el fallo llegó a producción. Las cifras viven ahora en
`PALETA_RETRATO` con tests que las vigilan, incluido uno que deja
constancia de lo malo que era antes por si alguien quita el canal.

## 7ap. El retrato, completo (24 de agosto) · 2.26.0 · MIGRACIÓN 037 EJECUTADA

Tres agujeros que tenía el retrato al salir, tapados a la vez: no había
dónde mirarse, nadie avisaba de que habías avanzado, y solo un adulto con
el PIN podía elegir piezas. Detalle en [`docs/RETRATO.md`](docs/RETRATO.md).

La **037 está ejecutada** y desplegado el cliente: cinco columnas de
retrato, seis CHECK y el de forma comprobado contra la base (acepta
'coleta' y 'castanoclaro', rechaza 'DROP TABLE' y 'x'). Cuatro perfiles
tenían ya peinado elegido cuando se ejecutó.

### Lo que conviene no deshacer

- **Lo que falta para la fase siguiente solo se enseña si está cerca**
  (`faseSiguiente`, 45 días). De la fase 7 a la 8 hay dos años: una cuenta
  atrás de años deshincha. Devolver `null` es la decisión, no un descuido.
- **El equipo no se elige nunca.** El editor ofrece túnica —ropa de
  diario— pero ni manto ni farol. Si se pudiera elegir un manto, el manto
  dejaría de significar «maestría».
- **La 037 deja de enumerar el catálogo en la base.** La 035 lo metió en
  un CHECK; dos días después la 036 existía solo para añadir «calvo». El
  CHECK que queda es de forma. El catálogo vive en `src/lib/retratos.js` y
  añadir una pieza ya no pide migración.

### Un fallo que ya estaba desplegado

Sobre una piel muy oscura la cara desaparecía: los ojos eran tinta fija y
contrastaban **1,20** sobre «ébano», y el pelo negro **1,12**. Quien
elegía la piel más oscura se quedaba sin cara. Ahora el ojo lleva blanco y
pupila, y `separar()` despega el pelo de la piel solo cuando hace falta.

Es el TERCER fallo de contraste del retrato en dos días, y todos con la
misma forma: un color fijo sobre un fondo variable, decidido a ojo. Al
añadir cualquier pieza, mídelo.

### Dos cosas para decidir

- **No hay linter.** Dos fallos de esta sesión —`Retrato` y `generoDe`
  usados sin importar— pasaron el build y reventaron en pantalla. Los dos
  los habría cazado `no-undef`. `tests/imports.test.js` solo cubre la
  mitad JSX. Añadir ESLint es una decisión del proyecto, no se ha tomado.
- **La celebración se puede perder detrás del modal de sellos**: su
  temporizador corre aunque esté tapada. Es de antes del retrato.

## 7aq. Barbas, y los dos cabos sueltos (24 de agosto) · 2.27.0 · MIGRACIÓN 038 EJECUTADA

**Barbas**: bigote, perilla, corta y larga, del color del pelo. Migración
038 —hace falta la columna, pero los valores ya no van en un CHECK.

**La celebración ya no se pierde detrás del modal de sellos.** Su
temporizador corría aunque estuviera tapada, así que una validación que
concediera sello Y subiera de fase se comía la fase. Ahora espera a que la
pantalla esté libre. Comprobado por secuencia en el navegador: nada →
modal de sellos → celebración.

### Hay linter, y conviene saber para qué NO es

Dos reglas y ninguna de estilo: `no-undef` y `react/jsx-no-undef`. Están
por un motivo concreto: el 24-ago se usó dos veces algo sin importarlo
—`Retrato` y `generoDe`— y las dos `npm run build` dio VERDE. Vite
empaqueta una referencia que no existe y el fallo aparece en pantalla.

**No añadas reglas de estilo aquí.** El criterio del proyecto vive en los
comentarios del código, y convertir `npm run verify` en una discusión
sobre comillas haría que la gente dejara de mirar su salida.

Dos detalles de la configuración, por si extrañan:
- `react-hooks/exhaustive-deps` está registrada pero **apagada**. Los
  `eslint-disable-line` del código son anteriores al linter; si la regla
  no existe, cada comentario de esos es un error por sí solo.
- `__DOMINIO__` se declara como global porque lo inyecta Vite (`define`).

Con esto, `tests/imports.test.js` se retiró: era una aproximación con
expresiones regulares a media regla, y ahora hay la regla entera.

### Estado

Ejecutada y desplegado. Seis columnas de retrato, siete CHECK, y el de
mascotas comprobado contra la base: cubre las seis, `retrato_barba`
incluida.

## 7ar. Cuatro arreglos del retrato al usarlo (24 de agosto) · 2.28.0 · MIGRACIÓN 039 EJECUTADA

Los cuatro salieron de la familia usándolo, no de mirar el código:

1. **Barba y bigote juntos** como opción propia, no como segundo mando.
2. **La barba larga salía hueca**: eran dos curvas encaradas y se dibujaba
   el espacio entre ellas. Ahora es una forma maciza.
3. **El color de pelo desaparecía al marcar «sin pelo»** y la barba va de
   ese color: había que ponerse un peinado, elegir color y quitárselo.
   `usaColorDePelo()` decide ahora cuándo un mando pinta algo, y la
   etiqueta pasa a «Color de la barba».
4. **Flequillo**: recto, cortina o sin flequillo, como EJE APARTE del
   peinado. Dentro de la lista de peinados la habría triplicado —largo,
   largo con cortina, largo despejado— para decir lo mismo. Migración 039.

Ejecutada y desplegado. Siete columnas de retrato, ocho CHECK, y el de
mascotas comprobado contra la base: cubre las siete.

### La lección, que ya va repetida

Ninguno de estos cuatro se veía leyendo el código, y dos son de forma:
una barba hueca y un mando que se esconde cuando aún hace falta. El
retrato lleva siete piezas y cada una nueva multiplica las combinaciones;
**la única prueba que vale es repartir combinaciones raras entre los
perfiles de la demo y mirarlas juntas**. Así salieron la cara de antifaz,
la barba hueca y el flequillo ras.

## 7as. La cortina que parecía una calva (24 de agosto) · 2.28.1 · SIN MIGRACIÓN

El flequillo de cortina abría un pico en mitad de la frente: lo que se
veía no era una raya, era piel. **Una cortina no descubre la frente**,
cae entera y solo se separa en una raya. Ahora cubre como el recto —algo
más larga por los lados— y la raya es una cuña de tres unidades.

Y al hacerla fina apareció el de siempre: en rubio sobre piel pálida,
piel y pelo contrastan 1,85 y la raya se perdía, con lo que la cortina
volvía a parecer un flequillo recto. La raya sale ahora de la piel **en
sombra** y se separa del pelo (`colorDeRaya`, mínimo 2,3).

**Cuarto fallo de contraste del retrato.** Los cuatro con la misma forma:
dos piezas del mismo tono, una encima de otra, decididas a ojo. El test
nuevo recorre las 64 combinaciones de piel y pelo en vez de mirar tres.
Si se añade un tono de piel o de pelo, ese test lo cubre solo; si se
añade una pieza que se pinte SOBRE otra, hace falta un test como ese.

## 7at. El retrato, a un toque desde cualquier sitio (24 de agosto) · 2.29.0 · SIN MIGRACIÓN

Tocar el avatar de la cabecera abre el retrato, en cualquier pestaña y sin
panel. Antes solo se llegaba por Progreso —y la peque no llegaba de
ninguna manera, porque su pantalla no tiene pestañas—.

Cuatro puertas, **un solo componente** (`MiRetrato` sobre
`EditorRetrato`): cabecera, Progreso, ficha de la peque y panel parental.
Es lo que impide que acaben ofreciendo catálogos distintos.

### Decisiones

- **Modal y no salto a Progreso.** Cambiar de pestaña para cambiarte el
  pelo te saca de lo que estabas haciendo, y al cerrar habría que volver.
- **La peque llega por su ficha**, no directamente al editor: su avatar ya
  abría la ficha y ahí está lo que ha hecho. Quitárselo para poner el
  editor habría cambiado una cosa por otra.
- **Su editor va sin la vista previa con texto** (`vistaPrevia={false}`)
  y con una figura grande de espejo encima. La explicación de fases y
  niveles no es un resumen para ella, es texto que no puede leer.
- Hay dos avatares de cabecera —la tarjeta de las pestañas de trabajo y el
  saludo del Panorama— y **los dos abren lo mismo**. El estado vive en
  Home, que es el padre de ambos.

### Lo que no se ha hecho, por si alguien lo nota

Cada toque en el editor **escribe en la base**. Con un adulto eso son
cuatro escrituras; con una criatura de tres años probando colores pueden
ser cincuenta seguidas. No molesta —la figura se mueve al instante con una
copia local y la escritura va detrás— pero si algún día el log de Supabase
se ve ruidoso, el sitio donde poner un retardo es `cambiarRetrato` en
`FichaPeque.jsx`.

## 7au. Cerrar sesión y entrar por enlace (24 de agosto) · 2.30.0 · SIN MIGRACIÓN

**No había logout.** El único `signOut` del código estaba dentro del
borrado de cuenta. Ahora hay uno en Panel → ⚙️ → Datos: detrás del PIN,
con dos toques, y **no en el selector de perfiles** —la cuenta es una sola
y cerrarla echa a toda la casa; ahí lo tendrían a un dedo la junior y la
peque—.

**Magic link.** Entrar sin contraseña, con el SMTP que ya estaba montado
desde agosto. No hizo falta tocar Hostinger ni crear subdominios: el
remitente `noreply@elgremioapp.com` y las URLs de retorno ya servían.

### Dos decisiones del enlace que conviene no deshacer

- **`shouldCreateUser: false`.** Por defecto Supabase CREA la cuenta si el
  correo no existe. Con una letra mal, alguien entraría en un gremio vacío
  sin entender que está en otra cuenta, y la 017 impide arreglarlo después.
- **Sin cuenta se contesta lo mismo que con ella.** Si no, la pantalla se
  convierte en un comprobador de qué familias existen. Misma regla que la
  recuperación de contraseña, y por el mismo motivo.

### PENDIENTE, y se nota si no se hace

**Hecho el 25-ago.** La plantilla del Magic Link está pegada y verificada
recargando (§7e). Detalle y trampas en `docs/CORREOS.md` §4.

### Google: hecho el 24-ago (ver §7av)

## 7av. Entrar con Google (24 de agosto) · 2.31.0 · SIN MIGRACIÓN

Configurado y encendido. Lo que quedó montado, por si algún día hay que
tocarlo o rehacerlo:

**En Google Cloud**, proyecto `ElGremio`:
- Pantalla de consentimiento: «El Gremio», **usuarios externos**, en modo
  prueba. En ese modo NO hace falta la verificación de Google, que pide
  vídeos y tarda semanas. El límite son 100 usuarios de prueba.
- Cliente OAuth «El Gremio · web», tipo aplicación web.
- Origen JavaScript: `https://elgremioapp.com`
- URI de redirección: `https://chfbrawsoulfiywiqhpe.supabase.co/auth/v1/callback`
  — **es la de Supabase, no la de la web**. Es el campo que más se falla.

**En Supabase** → Authentication → Providers → Google: activado con su
Client ID y su secreto. Los dos interruptores de riesgo quedaron
APAGADOS a propósito:
- *Skip nonce checks*: baja la seguridad del token.
- *Allow users without an email*: entraría gente sin correo, y entonces el
  enlace automático de identidades por correo deja de funcionar, que es
  justo lo que protege que entres en TU gremio y no en uno nuevo.

### El reparto, otra vez

**El Client Secret lo pegó una persona.** Manejar secretos ajenos no entra
en lo que hace el agente, ni siquiera para pegarlos en el panel de su
dueño. Mismo reparto que la contraseña del SMTP en §7e, y conviene que
siga así si algún día hay que rotar las credenciales.

Lo que sí hizo el agente: rellenar la pantalla de consentimiento y crear
el cliente OAuth con sus dos URLs. Y de ahí una lección barata: al
desplazarse por el panel de Supabase se abrió por error el proveedor
**Azure**. No se guardó nada, pero es el riesgo real de clicar en una
consola ajena. Si algún día aparece un proveedor raro medio configurado,
mirar aquí primero.

### La trampa que no tiene arreglo automático

Entrar con una cuenta de Google **distinta** a la del gremio crea una
cuenta nueva y vacía: se ve «Fundad vuestro gremio» con todo a cero. La
017 impide que una cuenta tenga dos gremios, así que no se arregla solo y
hay que limpiarlo en la base. Con el enlace por correo esto lo bloquea
`shouldCreateUser: false`; en OAuth no hay equivalente y lo único que
queda es el aviso bajo el botón.

## 7aw. Las plantillas de correo, al día (25 de agosto) · SIN VERSIÓN

Pegada la cuarta plantilla —**Magic link or OTP**, que así se llama en el
panel— y repasadas las tres de agosto: las cuatro en castellano.

**La trampa nueva: `pbcopy` rompe los acentos.** Al pegar el HTML,
«contraseña» llegó al editor como «contrase√±a». La forma buena es
`LC_CTYPE=UTF-8 pbcopy < fichero`. Se pilló porque se leyó el DOM en vez
de fiarse de la pantalla: en un editor de código con fuente monoespaciada,
el mojibake cuesta de ver.

**Las demás plantillas siguen en inglés y da igual**, que es lo que se
comprobó: invitación y reautenticación no las usa la app, y las cuatro
notificaciones de seguridad —contraseña cambiada, correo cambiado,
teléfono cambiado, método de acceso enlazado— están **desactivadas** con
su propio interruptor. La última se dispararía al enlazar Google, así que
si algún día se encienden, **traducirlas antes de encenderlas**. Tabla en
`docs/CORREOS.md`.

## 7ax. Instalar en la pantalla de inicio, con dibujos (25 de agosto) · 2.32.0 · SIN MIGRACIÓN

Las instrucciones estaban en texto y **detrás del PIN**, que es justo
donde no llega quien las necesita: el aparato nuevo. Ahora hay un enlace
en la pantalla de acceso y una guía dibujada (`GuiaInstalar`), compartida
entre el acceso y Panel → Dispositivos para que no haya dos versiones.

### Decisiones

- **Dibujado, no capturado.** Una captura de pantalla envejece con cada
  versión de iOS y haría falta una por idioma. El dibujo solo envejece si
  cambia el icono, que es lo único que hay que reconocer.
- **Enlace, no cartel.** Uno que salte solo es un anuncio, y quien usa la
  app en el navegador a propósito no tiene por qué verlo cada vez.
- **`todos` en Dispositivos**: ahí un adulto mira SU móvil para
  explicárselo a quien tiene otro, así que detectar la plataforma
  acertaría con la persona equivocada.

### El fallo que salió al abrirlo

La detección tenía las comprobaciones en mal orden: la conjetura del iPad
—«un Mac con pantalla táctil es un iPad»— iba ANTES de mirar si el agente
decía Android. Resultado: un Android emulado, que reporta `platform:
MacIntel` y cinco puntos táctiles, recibía las instrucciones de iOS
—«toca Compartir en Safari» en un Pixel—.

**Lo que dice el aparato gana a lo que se deduce de él.** Corregido el
orden y con test de regresión. Y se vio abriendo la app, no leyendo el
código: los tests que había pasaban porque ninguno probaba un agente y una
plataforma que se contradijeran.

## 7ay. Actividad global, en vez de PostHog (25 de agosto) · 2.32.1 · migración 040

El encargo era «montar PostHog para monitorizar la actividad». Antes de
tocar código: `legal/privacidad.html` §2 dice, sin matices, que esta app
no usa «herramientas de analítica o seguimiento de ningún tipo», y §5
cierra la lista de proveedores (Supabase, GitHub Pages, Hostinger,
Cloudflare). PostHog no encaja ahí sin reescribir un texto que familias
con menores ya aceptaron — igual que se decidió con Sentry (RUNBOOK §3):
es una decisión legal, no un interruptor. Preguntado, el veredicto fue
quedarse en casa.

**Qué hay ahora:** `salud_diaria` (migración 023) ya llevaba el
recuento diario, pero solo se leía desde el SQL Editor. La 040 añade
`public.operadores` (vacía, RLS sin políticas — se rellena a mano, nunca
desde una migración) y dos funciones `security definer`:
`es_operador()` y `actividad_reciente(p_dias)`, que solo devuelve filas
si `auth.uid()` está en `operadores`. Panel → ⚙️ → **📈 Actividad**
(`src/screens/Actividad.jsx`), pestaña que ni se pinta para quien no es
operador. Cero variables de entorno nuevas, cero bytes fuera de Supabase.

**Para verlo, falta un paso manual** (adrede: así el UUID de quien
administra no entra en un repositorio público) — RUNBOOK §3c tiene las
dos líneas para el SQL Editor.

### El tropiezo de numeración

Esta sesión arrancó con el repo local **22 commits por detrás de
`origin/main`** — la 2.24.0 a la 2.32.0 (retrato, Google, magic link,
guía de instalación) ya estaban fuera y la numeración de migraciones
había llegado a la 039. La migración se escribió primero como «035» a
ciegas; `git fetch` + `list_migrations` por MCP lo destaparon antes de
aplicar nada. Se resolvió con `git stash -u` → `merge --ff-only
origin/main` → `stash pop` (sin conflictos) y renumerando a **040**. La
lección de siempre ([[el-gremio-sesiones-en-paralelo]] en la memoria del
agente): `git fetch` antes de numerar, no después.

### Verificado

`npx vitest run`: 1129 tests en verde (`tests/upserts.test.js` no carga
en esta ruta concreta —tiene espacios y `~` que rompen un `new
URL(...).pathname` sin decodificar—, ajeno a este cambio). `npm run
build` limpio. Abierto en `dev:demo`: sin la pestaña Actividad, como
toca —el modo demo no tiene `operadores` que consultar y ni lo intenta—,
y sin errores nuevos en consola. `get_advisors` solo marca lo esperado:
`operadores` con RLS y sin políticas (mismo patrón que `salud_diaria`) y
las dos funciones nuevas como «cualquier autenticado puede llamarlas»,
que es el diseño — el filtro de verdad vive dentro de la función, no en
el `grant`.

**Pendiente de esta sesión:** confirmar que la pestaña aparece de verdad
tras darte de alta como operador (RUNBOOK §3c) y decidir cuándo hacer
`git push`.

## 7az. PostHog, después de todo (26 de agosto) · 2.33.0 · sin migración

Con la 040 recién desplegada, llegó el encargo real: `npx
@posthog/wizard@latest self-driving`. Se paró antes de ejecutarlo — ese
modo edita el código sin supervisión, crea la cuenta de terceros que §7ay
acababa de descartar, y suele activar grabación de sesión y autocaptura
por defecto. Preguntado, la respuesta fue: sí, PostHog de verdad, pero
reescribiendo antes la política y configurándolo a mano.

**Lo que se hizo, en orden:**

1. **`legal/privacidad.html`**, versión 2026-08-26: la frase «ni
   herramientas de analítica... de ningún tipo» (§2) se sustituyó por lo
   que de verdad pasa —dos contadores agregados, sin nombres, sin
   contenido, sin grabación—, con fila nueva en la tabla de proveedores
   (§5), base legal en §3 y una frase en §4 (menores) dejando claro que
   los contadores no distinguen adulto de criatura. `terminos.html`
   también sube de fecha aunque no cambie de contenido: `tests/legal.test.js`
   exige que las DOS lleven la misma versión.
2. **`ReconsentimientoLegal.jsx`**, enganchada en `App.jsx` justo delante
   de `ParentPanel` cuando `family.legal_version !== VERSION_LEGAL` —
   nunca antes: consentir es cosa de quien tiene la patria potestad, y el
   PIN es la única puerta que ya demuestra que hay una persona adulta.
   Las peques y el uso diario no se enteran de nada.
3. **El panel de PostHog, apagado a mano**, no solo en el código: Session
   replay, Autocapture (clics, web vitals, dead clicks) y Capture console
   logs, los cuatro venían ON por defecto en el proyecto nuevo. «Discard
   client IP data» ya estaba activo. Sin este paso, un cambio futuro en
   el panel de PostHog podría reactivar grabación de sesión sin tocar una
   línea de código — por eso la salvaguarda va en los dos sitios.
4. **`src/lib/actividadExterna.js`**: dos eventos, `mision_validada` y
   `premio_canjeado`, disparados desde `ParentPanel.jsx` (`resolverMision`
   / `resolverCanje`) con `family.id` como único identificador — nunca
   `profile_id`, nunca el texto de la misión o el elogio. Apagado sin
   `VITE_POSTHOG_KEY` y también en modo demo (no hay gremio real que
   contar). `advanced_disable_decide` de propina: ni pide configuración
   remota, así que el panel de PostHog no puede reactivar nada por su
   cuenta aunque alguien lo intente.
5. **CSP**: `https://eu.i.posthog.com` añadido a `connect-src` en
   `index.html` Y `vercel.json` — exacto, sin comodín, porque
   `*.posthog.com` colaría `app.posthog.com`.

**La cuenta de PostHog ya existía** (el usuario la creó y la abrió en su
Chrome real durante la sesión, región EU, proyecto 258309) — no hizo
falta darla de alta desde aquí; el agente no crea cuentas de terceros ni
introduce contraseñas, solo se conectó al navegador ya autenticado para
leer la clave pública del proyecto y ajustar la configuración de
privacidad.

**Verificado:** `npx vitest run` (1129/1129, mismo ENOENT ajeno de
`upserts.test.js`), `npm run build` limpio (el bundle sube a ~1,08 MB por
`posthog-js`, ya avisaba Vite antes de esto por el tamaño del chunk), y
`dev:demo` recargado sin errores nuevos en consola. **Lo que NO se pudo
verificar en esta sesión**, porque hace falta una sesión real (el agente
no introduce contraseñas): que `ReconsentimientoLegal` aparece de verdad
al entrar al panel con una cuenta ya existente, y que los dos eventos
llegan al proyecto de PostHog tras validar algo. Falta también dar de
alta `VITE_POSTHOG_KEY`/`VITE_POSTHOG_HOST` en Vercel — `.env` es solo
local.

**Pendiente:** ese repaso en real, las dos variables en Vercel, y decidir
cuándo hacer `git push` (esto y la 040 de §7ay siguen sin subir).

## 7ba. Limpieza de código (27 de agosto) · 2.33.2 · sin migración · MEZCLADA el 27-ago

El encargo: repasar el proyecto entero buscando código muerto (imports,
ficheros, componentes, banderas, dependencias), lógica duplicada y
complejidad sin requisito; eliminar lo mínimo y seguro, sin cambiar
comportamiento sin una prueba que lo cubra. Llegó por la rama
`claude/gremio-code-cleanup-e8o8ib` (**PR #2**), con CI en verde y sin
conflicto, y **se mezcló en `main` el mismo día 27 tras revisarlo
Raúl**. Publicar es lo de siempre (§7n) y es solo bundle.

**El análisis, para poder repetirlo.** Cuatro barridos: un grafo de
imports desde `main.jsx` (los 130 ficheros de `src/` son alcanzables, ni
uno huérfano), el uso real de dependencias (las 12 se usan) y de
banderas (las nueve de `flags.js` se leen con `flag()`), `npm run
muertos` (clase A a cero, antes y después), y un detector de bloques de
seis líneas idénticos entre ficheros. Ojo con confiar en el lint para
esto: `eslint.config.js` solo lleva `no-undef` **a propósito** (está
razonado en el propio fichero), así que un import sin usar no lo caza
nadie del tooling del repo; y `muertos.mjs` mira exports, no imports.
Los dos huecos se cubrieron con scripts de sesión.

**Lo que se eliminó:**

- **Diez imports que nadie usaba**: `MONEDAS_POR_ESTRELLA` en
  `juego.js`; `useRef`, `levelProgress`, `FREQ_LABEL` y `talis` en
  `Home.jsx`; y cinco en tests (`precioObjetivo`, `insigniaPorCodigo`,
  `planDeperfil`, `rachaActual`, `habilidadesElegidas`). Verificado
  símbolo a símbolo que cada uno aparecía SOLO en su import y que sigue
  vivo donde sí se usa: ninguno pasó a clase A.
- **El efecto de foco de los diálogos, copiado calcado tres veces**
  (`LoteDeSellos`, `SelloDetalle`, `TalisAMano`): el foco entra al
  abrir, Escape cierra, el foco vuelve al salir. Ahora es un hook único,
  `useFocoDialogo` en `src/lib/dialogo.js`, al estilo de los que ya
  había (`useMantenerPulsado`, `useContador`). El háptico de
  `TalisAMano` queda en su propio efecto con las MISMAS dependencias
  (`[onClose]`), declarado antes del hook, así que dispara igual y en el
  mismo orden que antes. Un diálogo nuevo debe usar este hook, no copiar
  el efecto una cuarta vez.

**Verificado en navegador, no solo compilando** (`dev:demo` + Chromium
sin cabeza): onboarding de 11 pasos entero, misión completada y validada
con elogio desde el panel, Talis a mano concedidos de un adulto a otro.
Los tres diálogos, uno a uno: el foco entra en el botón de cerrar al
abrir, Escape cierra, y en `SelloDetalle` el foco vuelve exactamente al
`pieza-boton` que lo abrió. Sin errores de consola ni de página. Y de
propina, una comprobación que §7az dejó como no verificable:
**`ReconsentimientoLegal` SÍ aparece** al entrar al panel con una cuenta
que ya existía, al menos en demo (salió en mitad del recorrido y hubo
que aceptarla para seguir). `npm run verify` en verde: lint, 1.138
tests en 64 ficheros, build y secrets-check.

**Lo que el análisis señala y SE QUEDA, para que la próxima limpieza no
lo vuelva a abrir:**

- La clase B de `muertos` (16): modelo escrito por delante de la
  interfaz (temporadas, poderes sin cablear) y ayudantes de tests. Ya lo
  decía §7c y sigue siendo verdad.
- La clase C (11): exports que solo usa su fichero. Ruido tolerado, no
  fallo.
- La tarjeta «Lo que te han dicho» duplicada entre `Home` y `Panorama`:
  seis líneas con ids y comentarios de contexto distintos; extraerla
  añadiría indirección sin quitar riesgo real.
- Las listas de tablas de `datos.js` y `fakeBackend.js` PARECEN el mismo
  dato y no lo son: una es el subconjunto exportable (sin `app_logs`, a
  propósito), la otra la base demo completa. Unificarlas sería un error.

**El cierre, y una limitación de la sesión remota que conviene saber:**
el PR se revisó y se mezcló el 27-ago, pero **publicar no se pudo hacer
desde la sesión por el camino normal**: el contenedor no tiene el `.env`
(el `VERCEL_DEPLOY_HOOK` no viaja al repo, con razón) y su red tampoco
alcanza `api.vercel.com`, así que `npm run vercel` solo puede lanzarse
desde el portátil. Lo que SÍ se pudo hacer desde fuera fue comprobar qué
sirve el dominio —el MCP de Vercel lee `version.json` aunque la red del
contenedor no llegue—.

**Cómo acabó publicada (29-ago), y el truco que NO conviene normalizar.**
El `npm run vercel` desde el portátil no llegó a Vercel: en la lista de
despliegues del proyecto no consta NINGUNO posterior al del 26-ago, ni
siquiera fallido, o sea que el hook nunca se disparó (si vuelve a pasar:
el script debe imprimir «✓ Publicación lanzada (job …)»; si no lo
imprime, leer su error, y comprobar que el hook «publicar-a-mano» sigue
existiendo en Vercel → Settings → Git → Deploy Hooks). Con el hook fuera
de alcance, la sesión publicó con **dos commits seguidos a `main`**:
`748701d` pone `git.deploymentEnabled.main` a `true` —y ese mismo push
despliega, con su contexto git completo— y `5eaa0dd` lo devuelve a
`false` sin desplegar nada, porque Vercel lee la bandera del árbol de
cada push. Comprobado: el despliegue `dpl_AmKKQDwNeNjd794FKsj36aSo3bwv`
en READY, `version.json` respondiendo `2.33.2 · 748701d`, y cero
despliegues después del commit de cierre. Es un último recurso, no un
camino: entre los dos commits CUALQUIER push a `main` publica, así que
si se repite, que sea igual —abrir, un solo push, cerrar— y con el
dominio vigilado.

## 7bb. Recuperación ante desastres y terreno firme (29-30 de agosto) · 2.33.3 · migraciones 041, 042 y 043

**Lo que hay que saber en una línea:** las migraciones **041, 042 y 043 están
EJECUTADAS** y la **2.33.3 publicada y comprobada** (`npm run health`: web
2.33.3 `fff2a2e`, supabase 17.6). En ese orden.

### Lo que se descubrió, que era el objetivo

Se fue a probar la restauración por primera vez —un respaldo que nunca se ha
restaurado no es una protección— y **no funcionaba nada de ese camino**. Seis
defectos, todos invisibles sin ejecutarlo:

1. **No había ni una copia, y por DOS motivos.** El primero: el comando
   documentado del Llavero omitía `-T /usr/bin/security`. El segundo, que se vio
   al día siguiente y es el que de verdad mandaba: **cron no llega al Llavero**
   —corre fuera de la sesión de inicio— **y no recupera la ejecución que se
   pierde mientras el Mac duerme**. Así que el `-T` era necesario pero no
   habría bastado: cron habría seguido fallando igual. Desde el 30-ago el
   respaldo va por **LaunchAgent** (`com.elgremio.respaldo`), que resuelve los
   dos, y quedó comprobado con una copia real. Detalle completo en
   `docs/RESPALDOS.md`. Crear el ítem y poder LEER su valor son dos
   permisos distintos: sin el `-T`, `find-generic-password` lo encuentra y el
   `-w` que usa el script falla. Y fallaba en un log que nadie mira.
   El `-T` quedó arreglado en `docs/RESPALDOS.md`, en la cabecera del script
   **y en el mensaje de error**, que era lo único que leía quien tenía el
   problema y decía justo el comando que no funciona.
2. **`--project-ref` no elige destino**, solo comprueba que sea el proyecto
   enlazado. Restaurar en otro proyecto era imposible. Ahora hay `--db-url`,
   que lee la cadena de `RESTAURAR_DB_URL` —en variable de entorno para que la
   contraseña no acabe en el historial ni en la lista de procesos—.
3. **`SQL_ORDEN` devolvía UNA tabla de 23.** El caso base descartaba las que
   tienen clave ajena fuera de `public`, y como `families` apunta a
   `auth.users` y de ella cuelga todo, la recursiva no alcanzaba nada. La
   restauración habría insertado en orden de volcado y roto las claves ajenas.
4. Los `delete` iban en un trozo multi-sentencia, que `--db-url` rechaza.
5. El error real quedaba oculto tras el «Connecting to remote database…» del
   CLI, porque el script mostraba `stderr || stdout` y la causa venía por el
   otro.
6. **`schema.sql` no reconstruía la base.** Faltaban el RLS de
   `mission_families` —que la 028 sí enciende, así que producción está bien
   pero cualquier base creada desde el fichero nacía con esa tabla expuesta—,
   `create extension pg_cron`, y un `set check_function_bodies = off` porque
   `zona_de_perfil()` es `language sql` y consulta `profiles` antes de que
   exista.

**El límite que queda, y no es un fallo:** en un proyecto NUEVO no se restaura
nada, porque `families.owner` apunta a `auth.users` y eso no se restaura. Para
el desastre real —proyecto vivo, datos perdidos— la vía es restaurar encima, y
ahora tiene bastantes más probabilidades de funcionar. Cubrir el caso del
proyecto nuevo exige recrear antes las cuentas con los mismos UUID, y no está
resuelto.

### Las tres migraciones

- **041** · `redeem_reward` no comprobaba que el premio y el perfil fueran de
  la misma casa. Hoy no lo puede provocar nadie porque el RLS solo deja ver un
  gremio, pero esa garantía es del borde y el borde va a cambiar con los
  gremios múltiples. Sale de auditar las cinco funciones que cruzan dos
  identificadores: **las otras cuatro ya comprobaban**.
- **042** · el libro de las monedas (`movimientos_coins`): saldo antes, saldo
  después, motivo, resultado y clave de idempotencia. Se llama `coins` y no
  `talis` porque el esquema no dice «talis» —hay un test que lo defiende y me
  pilló en el intento—.
- **043** · el libro lo escribe un **disparador** sobre `profiles`, no cada
  función a mano. Llamarlo desde las ocho que mueven monedas es una costumbre;
  el disparador es una garantía: si alguien añade la novena y olvida declarar
  su motivo, el asiento sale como `desconocido` en vez de no salir. **Seis de
  las ocho ya eran idempotentes** por su propio estado; solo
  `grant_manual_bonus` necesitaba clave, y a propósito, porque el índice único
  de `bonuses` excluye el tipo `manual`.

### Trampas que costaron tiempo, para no repetirlas

- **Mira los números de migración DESPUÉS de un `git fetch`.** Escribí una 040
  que ya existía: otra sesión la había publicado mientras tanto. Lo mismo vale
  para la versión.
- **Para probar contra producción sin dejar rastro**, un bloque que aborta al
  final funciona muy bien: `do $$ … raise exception 'ENSAYO %', v; end $$;`
  deshace todo lo que haya hecho dentro. Así se comprobaron la idempotencia y
  el disparador contra la base de verdad.
- `supabase db query -f` manda el fichero como **una sola sentencia
  preparada** por `--db-url`: no traga ficheros multi-sentencia. Por `--linked`
  sí, porque va por la API de gestión. Para aplicar `schema.sql` entero, el
  editor SQL del panel.

### Lo que queda abierto

- **`truncate` para `authenticated`** en todas las tablas. `truncate` se salta
  el RLS, pero PostgREST no lo expone, así que es endurecimiento pendiente y
  no una puerta abierta. Merece su propia revisión de grants.
- **Derivar el nivel en servidor.** Era la otra mitad de la tarea 1.1 del plan
  y se aplazó: hoy añadiría una tercera copia de la fórmula sin nadie que la
  llame hasta que exista el hito de expansión.

### El contexto: hay un plan

Esto es la **Fase 1** de un plan de implementación que vive fuera del repo, en
`~/Library/Mobile Documents/com~apple~CloudDocs/ClaudeCode/specs/`:

- `el-gremio-gremios-multiples.md` — la especificación funcional de gremios
  múltiples, tipos de gremio e identidad progresiva. 31 decisiones cerradas,
  118 requisitos.
- `el-gremio-plan-implementacion.md` — el plan en fases. **Fases 0 y 1
  cerradas.** La siguiente es la 2, identidad y pertenencia, que es la que
  cambia el modelo de datos vivo.
- `el-gremio-briefing-legal-equipo.md` y `-menores.md` — listos para enviar,
  sin encargar. Son el camino crítico de las fases 8a y 8b.
- `el-gremio-catalogo-amigos.md` — borrador sin validar con un grupo real.

## 7bc. Identidad y pertenencia, el cimiento (30 de agosto) · SIN VERSIÓN · migraciones 044 y 045

**Lo que hay que saber en una línea:** las migraciones **044 y 045 están
EJECUTADAS** y comprobadas contra producción. **No hay versión nueva ni
despliegue**: no cambia una sola línea de `src/`, y la app que corre hoy
(2.33.3, `fff2a2e`) sigue siendo la correcta.

Esto es la **Fase 2** del plan, y de sus siete piezas van las cuatro primeras:
2.1 (dos clases de credencial), 2.2 (modelo de persona y pertenencia), 2.3
(migrar los gremios actuales) y 2.4 (aislamiento por pertenencia en todas las
políticas). Quedan 2.5 (F-9, conversión de perfil a persona), 2.6 (F-13,
migrar el correo compartido) y 2.7 (F-8d, borrar la identidad), que son las
que tienen pantalla.

### El cambio, en una frase

Hasta ayer, el permiso lo daba **ser la dueña de la cuenta del gremio**. Desde
hoy lo da **llegar al gremio**, y llegar tiene tres formas. Hoy las tres
apuntan al mismo sitio para todo el mundo: es el paso «convivir», y ese es el
objetivo.

### Lo que se creó (044)

- **`credenciales`** · una fila por cuenta, y la cuenta es la clave primaria:
  un correo es **credencial compartida de gremio** o **identidad personal**,
  nunca las dos. Por construcción, no por una comprobación que alguien tenga
  que acordarse de hacer. Las cuatro cuentas que existen quedaron
  clasificadas como `compartida` — que es lo que son: la clave de una casa no
  representa a una persona.
- **`pertenencias`** · persona, gremio, rol (`titular`/`gestor`/`miembro`),
  estado (`activa`/`abandonada`/`expulsada`), **cómo se entró** y desde
  cuándo. Índice único **parcial** para la activa: entre un `select` y un
  `insert` cabe otra petición, y abandonar y volver tiene que poder dejar dos
  filas. **Cero filas hoy**, y es correcto: una pertenencia es de una persona
  y todavía no hay ninguna.
- **`profiles.persona`** · el vínculo opcional, nulo en los trece perfiles.
  Con índice único por `(family_id, persona)` —una persona, un personaje por
  gremio— y un disparador que **rechaza vincular una credencial compartida**:
  si se pudiera, la clave de la casa se convertiría en la identidad de quien
  la usara primero.
- **`mis_gremios()`**, `es_mi_gremio()`, `clase_credencial()` y
  `exige_persona()`. La última no la llama nadie todavía, y está escrita a
  propósito **antes** que la primera operación de persona: una garantía que
  llega después se le olvida a alguien y no se entera nadie.

### Lo que cambió (045)

Las **veintiuna** políticas que decían
`family_id in (select id from families where owner = auth.uid())` ahora dicen
`family_id in (select public.mis_gremios())`. Y **las seis funciones
`security definer`** que llevaban esa comprobación escrita a mano por dentro
—`grant_daily_bonus`, `grant_manual_bonus`, `crear_campana_limpieza`,
`cerrar_campana_limpieza`, `spend_power`, `claim_streak`— preguntan ahora por
`es_mi_gremio(v_family)`.

**Las funciones importaban tanto como las políticas, y por un motivo que no
se ve:** un `security definer` se salta el RLS, así que esa línea no era una
copia de la política, era la **única** autorización que había ahí dentro. Sin
cambiarla, la primera persona que se convierta y entre con su correo propio
recibiría `no_es_tuyo` al pedir su estrella diaria, con pertenencia activa y
todo.

**Dónde vive ahora el paso «contraer»:** la rama de propiedad está DENTRO de
`mis_gremios()`. Cuando no queden clientes viejos, se borra **una rama de una
función** y no se toca ninguna política. Y no antes: retirarla con clientes
viejos en la calle deja a esas casas viendo su gremio vacío, que es el fallo
que documenta la 017.

### Dos cosas que aparecieron al comparar el fichero con producción

Ninguna era de esta fase, y las dos llevaban semanas.

1. **`grant_manual_bonus` se revocaba con la firma de CUATRO argumentos**, y
   tiene cinco desde la 042. Una firma que no existe no da un aviso: `revoke`
   contesta «function does not exist» y **corta la reconstrucción de la base
   ahí mismo**. El síntoma en producción era que ese `revoke ... from public`
   nunca llegó a ejecutarse, y PUBLIC seguía en su lista de permisos.
2. **Hacen falta las DOS revocaciones, y cada una por su motivo.**
   `revoke ... from public` no quita la concesión explícita que Supabase da a
   `anon` por privilegios por defecto —por eso `crear_campana_limpieza`,
   `cerrar_campana_limpieza` y `grant_manual_bonus` se podían llamar **sin
   haber entrado**: no escribían nada, pero contestaban—. Y
   `revoke ... from anon` no quita la de PUBLIC, **de la que `anon` hereda**.
   Esto último es lo que tenía roto el barrido general que la 021 dejó al
   final de `schema.sql`: llevaba desde agosto pareciendo que funcionaba.
   Añadido el `from anon` a las seis y a los dos disparadores nuevos, y el
   barrido corregido en la **046**.

Las dos las defiende ahora `tests/permisos.test.js`, y las dos están escritas
en `docs/RUNBOOK.md` §6b, al lado de la trampa de las sobrecargas, que es de
la misma familia.

**Y una tercera, menor:** `crear_campana_limpieza` y `spend_power` tenían en
producción **los comentarios viejos**, anteriores a la limpieza de la 2.33.2.
Solo comentarios —el código ejecutable era idéntico byte a byte— pero era
deriva de esquema de verdad, y la 045 la deja resuelta: las seis funciones
son ahora idénticas en `schema.sql` y en la base.

### Cómo se comprobó

- **`npm run respaldo` antes de tocar nada** (`respaldo-2026-08-30-132515`,
  abierto y comprobado por el propio script).
- `npm run verify`: **1195 tests en verde**, 69 ficheros. Los dos nuevos
  —`tests/pertenencia.test.js` (23) y `tests/permisos.test.js` (5)— se
  probaron **contra el esquema viejo** antes de darlos por buenos: 20 de 23
  fallan, que es lo que se quería.
- **El conjunto de gremios no cambia para nadie**: un bloque con `set_config`
  de la sesión, cuenta por cuenta, comparando el predicado viejo con
  `mis_gremios()`. **4 iguales, 0 distintas.**
- **El RLS de verdad, con el rol `authenticated` puesto**: 4 gremios × 14
  tablas = **56 comprobaciones en verde**, cada cuenta viendo exactamente las
  filas de su casa y ni una más.
- Las seis funciones, **idénticas byte a byte** entre `schema.sql` y la base
  (md5 de `prosrc`).
- `get_advisors`: ninguna alerta nueva. Las tres funciones de la economía
  desaparecen de la lista de «anon puede ejecutar».
- `npm run health`: web 2.33.3 (`fff2a2e`), supabase 17.6.

**Lo que NO se pudo comprobar**, y hace falta: entrar de verdad con la clave
de la casa y mirar la pantalla. El agente no introduce contraseñas, y el modo
demo no toca RLS —usa `fakeBackend`—, así que las 56 comprobaciones de arriba
son lo más cerca que se llega desde aquí. **Con la app abierta, mirar que el
tablón, la tienda, el historial y el panel siguen igual.**

### Lo que queda abierto

- **El `truncate` para `authenticated`**, que ya venía de la Fase 0. `truncate`
  se salta el RLS, pero PostgREST no lo expone, así que es endurecimiento
  pendiente y no una puerta abierta.
- **`zona_de_perfil` no la llama nadie** —ni el esquema, ni el cliente, ni un
  script— desde la 018. Es una función huérfana y habría que retirarla.
- **`redeem_reward` la puede llamar `anon`** también, pero es `security
  invoker`: el RLS la protege. Entra en la misma revisión.
- **La Fase 2 va por la mitad.** Lo siguiente es **2.5**, la conversión de
  perfil a persona (F-9): es la primera que crea una identidad personal de
  verdad y, con ella, la primera fila de `pertenencias`. Ahí es donde el
  cambio de hoy deja de ser un no-op.

## 7bd. El barrido que cerraba media puerta (30 de agosto) · SIN VERSIÓN · migración 046

**Migración 046 EJECUTADA.** Es una corrección de lo que quedó a medio
diagnosticar en §7bc, y no es de la Fase 2.

La 021 dejó escrita la regla buena —«al crear una función `security definer`
no basta con `revoke from public`, hay que retirar `anon` explícitamente»— y
un barrido al final de `schema.sql` que lo hacía para todas de una vez. La
idea era correcta y el sitio también.

**Lo que fallaba:** el barrido hacía solo `revoke ... from anon`, y **`anon`
hereda de PUBLIC**. Mientras PUBLIC conserve el permiso —que es el que
Postgres da por defecto a toda función nueva— quitárselo a `anon` no cierra
nada: `has_function_privilege('anon', …)` sigue diciendo `true`, que es lo
único que mira PostgREST. Así que el barrido llevaba desde agosto pareciendo
que funcionaba, y seis funciones contestaban sin sesión.

**Y un segundo motivo, que explica por qué la lista fue creciendo:** el
barrido solo se ha vuelto a ejecutar **dos veces** en toda la historia del
proyecto, en la 017 y en la 021. Cada `create or replace` posterior estrena
los privilegios por defecto de Supabase, que conceden a `anon`. De la 022 a la
045 no se volvió a pasar — y la propia 021 avisaba de esto en su texto.

**Cómo quedó:** el barrido de `schema.sql` retira ahora PUBLIC además de
`anon`, la 046 lo ejecuta sobre la base, y la 044 y la 045 lo llevan pegado al
final. `anon_puede_llamar` está en **cero** por primera vez desde la 021;
`authenticated` conserva las 19 que necesitaba y ninguna de las trece que
llama el cliente pierde permiso — comprobado antes de aplicar, con un bloque
que deshacía al final.

**La regla, otra vez y en `docs/RUNBOOK.md` §6b**: toda migración que cree o
reemplace una función `security definer` termina pegando el barrido. Lo
defiende `tests/permisos.test.js` de la 044 en adelante.

**Una corrección de §7bc**, que decía que tres funciones «solo estarían
expuestas en una base reconstruida»: era falso. El barrido del final de
`schema.sql` ya las cubría en una reconstrucción; el problema estaba en la
base viva, y era mayor de lo que ese párrafo contaba.

## 7be. Convertirse en persona, sin que se reinicie nada (30 de agosto) · SIN VERSIÓN · migración 047

**Migración 047 EJECUTADA y ensayada contra producción.** Sigue sin haber
versión nueva ni despliegue: lo único que cambia en `src/` es un mensaje de
error que hoy no puede ver nadie.

> **Ojo al siguiente despliegue:** `src/lib/acciones.js` tiene desde hoy una
> línea sin publicar (el mensaje de `saldo_en_cartera`). No cambia nada de lo
> que se puede hacer, pero **sube la versión antes de desplegar** o el bundle
> de la 2.33.4 saldría etiquetado como 2.33.3.

Es la pieza **2.5** de la Fase 2, el flujo **F-9**. Con esto la fase va por
cinco de siete: quedan 2.6 (migrar el correo compartido) y 2.7 (borrar la
identidad).

### Por qué son dos pasos y no uno

Por dos motivos, y el segundo es el que decide el diseño:

1. `signUp` devuelve `error: null` y `session: null` cuando falta confirmar el
   correo. La identidad no es buena hasta entonces, y **hasta entonces no se
   mueve un saldo ni se crea una pertenencia**: un correo mal escrito dejaría
   el dinero del juego en una identidad que no controla nadie.
2. **La sesión nueva no puede demostrar que operaba ese personaje.** Son dos
   sesiones distintas y no comparten nada.

Así que `solicitar_conversion` se llama **desde la sesión compartida** —que sí
puede demostrarlo— con el PIN, que es la única puerta que prueba que hay una
persona adulta delante, y deja una fila con el correo elegido y 72 horas de
caducidad. `completar_conversion` se llama **desde la sesión nueva**. El enlace
entre las dos es **el correo**: se eligió a mano dentro del gremio y haberlo
confirmado demuestra que ese buzón es suyo. No hace falta pasar ningún secreto
de una sesión a la otra.

### Lo que se creó

- **`carteras`** · saldo único por persona. Se crea vacía en la conversión y se
  llena con la transferencia de ese mismo momento. No hay relleno masivo, y
  quien no se convierte conserva su saldo local tal cual.
- **`conversiones`** · la solicitud, que es **también el asiento** de la
  conversión: personaje, gremio, correo, saldo antes, importe, saldo de la
  cartera después, fecha, resultado y clave. No hacía falta un libro aparte
  para la cartera: esta fila es el apunte de la única operación que la llena.
- **`profiles.saldo_local_cerrado`** · y `redeem_reward` la mira. Sin esa
  línea la marca no marcaría nada: sería una columna que nadie lee.
- **`movimientos_coins.tipo`** conoce `'conversion'`.

### Dos decisiones que conviene recordar

- **La pertenencia se crea como `reclamacion`, no como `fundacion`.** No crea
  una relación nueva: formaliza la de quien ya operaba ese personaje, y es el
  único origen de los cuatro que no consume llave.
- **Y con rol `gestor`, no `titular`.** Pertenecer da acceso y gestión; no da
  la potestad de cerrar el gremio ni de traspasarlo, que hoy sigue siendo de la
  credencial compartida que lo fundó. Es la misma línea que se trazó en la 045
  al dejar `familia_owner` intacta.

### Lo que NO hace, y hay que leerlo entero

- **No hay pantalla, y no es un olvido.** La identidad personal aparece solo
  cuando alguien necesita cruzar el límite de su gremio: forjar una llave
  (Fase 5), aceptar una invitación o cambiar de gremio (Fase 6). Nada de eso
  existe, así que **no hay disparo**, y ofrecerla «por si acaso» es justo lo
  que la especificación prohíbe. Las funciones existen, están probadas y no las
  llama nadie.
- **La cartera recibe el saldo pero todavía no lo gasta ni lo llena.** Las ocho
  funciones que mueven monedas siguen escribiendo en `profiles.coins`;
  encaminarlas a la cartera es la Fase 3. **Por eso la Fase 3 tiene que llegar
  antes que la Fase 5**, que es el orden que el plan ya tiene. Si alguien se lo
  salta, el primer gremialista que se convierta se queda con dos monederos y
  ninguno completo.
- **No convierte juniors** (va detrás de su revisión jurídica) ni peques ni
  mascotas (no son personas con correo).
- **No migra el correo compartido.** Quien fundó la casa con su correo personal
  se choca con `correo_es_la_clave_de_casa`, y eso es la 2.6. Es el caso **más
  frecuente**: sin la 2.6, la pantalla estrella le dice que no a casi todo el
  mundo.

### Cómo se comprobó

Respaldo antes (`respaldo-2026-08-30-150149`). `npm run verify`: **1222 tests
en 70 ficheros**, con `tests/conversion.test.js` (26) nuevo.

Y sobre todo, **dos ensayos contra la base de verdad**, los dos en un bloque
que termina lanzando una excepción para deshacerlo todo:

- **La conversión entera**, con un adulto real de 424 Talis y una identidad
  nueva creada y confirmada dentro del ensayo: `solicitar`=ok, `completar`=ok,
  repetir con la misma clave=ok **sin duplicar nada** (1 pertenencia, 1
  asiento), cartera=424, `coins`=0, `saldo_local_cerrado`=t, asiento de
  conversión por −424, y el canje siguiente devolviendo **`saldo_en_cartera`**.
  El correo se tecleó en MAYÚSCULAS a propósito: se normaliza.
- **Los siete rechazos**: correo de la casa → `correo_es_la_clave_de_casa`; PIN
  malo → `pin_incorrecto`; correo sin arroba → `correo_invalido`; junior →
  `junior_bloqueado`; peque → `solo_adulto`; perfil de otro gremio →
  `no_es_tuyo`; correo sin confirmar → `correo_sin_confirmar`.

Después de los dos, producción sigue con **cero** carteras, conversiones,
personas, pertenencias y cuentas de ensayo. Y `anon` sigue sin poder ejecutar
ninguna función `security definer`.

## 7bf. El correo de la casa se hace tuyo (30 de agosto) · SIN VERSIÓN · migración 048

**Migración 048 EJECUTADA y ensayada contra producción.** Sigue sin haber
versión nueva ni despliegue. Es la pieza **2.6** de la Fase 2, el flujo
**F-13**, y con ella la fase va por **seis de siete**: solo queda la 2.7
(borrar la identidad), que es la que la especificación dice que **bloquea el
lanzamiento**.

### El caso, y lo único que hay que proteger

Quien fundó la casa usó **su** correo personal como clave compartida. Ahora lo
necesita para ser ella misma, y la 047 le contestaba `correo_es_la_clave_de_casa`
—correcto, pero sin salida—. Como un correo es credencial compartida **o**
identidad personal y nunca las dos, la salida es **mover la llave de la casa a
otro correo**.

Y lo único que hay que proteger es que **la casa no se quede sin llave**. Ese
correo lo tienen abierto el móvil de quien lo fundó y las tabletas de las
peques: reclasificarlo antes de que exista otra llave que funcione deja a la
familia entera fuera de su gremio, y de eso no hay vuelta atrás amable.

### Tres llamadas, y la del medio no escribe nada

1. **`solicitar_migracion_correo`**, desde la sesión compartida y con el PIN.
   Se elige el correo nuevo de la casa y el personaje al que se vincula el
   antiguo. **No toca el gremio.**
2. La persona da de alta el correo nuevo, lo confirma, entra con él y llama a
   **`probar_credencial_nueva`**. Esa llamada **no escribe nada en el gremio**:
   lo único que hace es dejar constancia de que esa cuenta existe, está
   confirmada y **se puede entrar con ella**. Que es justo lo que hay que
   demostrar antes de tocar la llave de una casa.
3. **`completar_migracion_correo`**, otra vez desde la sesión compartida. En
   **una** transacción: la llave pasa al correo nuevo, el antiguo se
   reclasifica como identidad personal, se vincula al personaje, entra por
   pertenencia, estrena cartera y recibe su saldo.

### Por qué así, y no como lo cuenta la especificación

F-13 describe ocho pasos en los que la credencial nueva se engancha al gremio
**antes** de reclasificar la antigua, y `L-46` admite un estado intermedio con
**dos credenciales compartidas válidas**, con la nota de que hay que poder
retirar la sobrante a mano si la cosa se interrumpe ahí.

Con este orden **ese estado no llega a existir**. La llamada del medio
demuestra exactamente lo mismo que el paso 4 de la especificación —que la
credencial nueva entra de verdad— sin engancharla a nada, y el cambio de llave
ocurre entero dentro de una transacción. Si el proceso se abandona en cualquier
punto anterior, en el gremio **no ha cambiado absolutamente nada** y la fila
caduca sola a las 72 horas.

Es **más fuerte** que lo que pedía `R-84`, no menos. `L-46` se queda sin caso,
y queda anotado en la especificación.

### Las sesiones antiguas se caen, y es lo que tiene que pasar

Es el paso 7 de F-13 y no es limpieza. Si la sesión de la tableta de una peque
sobrevive al cambio, esa tableta pasa a ser **una sesión personal de otra
persona**: mismo `auth.uid()`, clase nueva. Al terminar se retiran todas las
sesiones de la cuenta antigua —la que hace la llamada incluida— y cada aparato
vuelve a entrar por donde le toca. Se hace **en el servidor**, no fiándolo a
que el cliente llame a `signOut`, que es la misma lección que dejó la 043 con
el libro de las monedas. Va con `to_regclass` por delante: `auth.sessions` y
`auth.refresh_tokens` son internas de Supabase y el cambio de llave no puede
depender de que no se muevan de sitio.

### Cómo se comprobó

Respaldo antes (`respaldo-2026-08-30-163424`). `npm run verify`: **1240 tests
en 71 ficheros**, con `tests/migracion-correo.test.js` (18) nuevo.

Y **dos ensayos contra la base de verdad**, los dos deshaciéndose al final:

- **La migración entera** sobre un gremio real, con un adulto de 424 Talis:
  `solicitar`=ok · intentar completar sin haber probado la llave =
  **`aun_sin_probar`** · `probar`=ok y **el `owner` del gremio intacto en ese
  momento** · `completar`=ok · `owner` ahora la cuenta nueva · la antigua
  `personal` y sin gremio, la nueva `compartida` con el gremio · 1 pertenencia,
  cartera 424, `coins` 0, saldo cerrado, 1 conversión · **las 4 sesiones vivas
  de la cuenta antigua pasaron a 0** · y el gremio con **exactamente una**
  llave en todo momento.
- **Los once rechazos**: correo actual, PIN malo, correo sin arroba, correo ya
  ocupado, perfil de otro gremio, segunda migración a la vez
  (`ya_hay_una_en_marcha`), cancelar y volver a pedir, una identidad personal
  intentando migrar (`no_es_compartida`) y `probar` desde una cuenta ya
  clasificada.

Después, producción intacta: cero migraciones, conversiones, personas,
pertenencias, carteras y cuentas de ensayo; las 7 sesiones vivas siguen vivas;
cada gremio con una llave; y `anon` sin poder ejecutar ninguna función.

### Lo que falta para que esto lo use alguien

Sin cambios respecto a §7be, menos una: la 2.6 ya no es de la lista.

1. **La 2.7** (`delete_my_account` todavía borra el gremio entero). La
   especificación dice que **bloquea el lanzamiento**.
2. **La pantalla**, que llega con su disparo en la Fase 5.
3. **La Fase 3**, antes que la 5, o la cartera se queda a medias.
4. **Supabase Auth**: las Redirect URLs y la plantilla de confirmación, para
   que el correo vuelva a un sitio donde se llame a las funciones (§1 de
   `docs/CORREOS.md`).
5. **Mirar la pantalla con una sesión real.**

## 7bg. Borrarse sin llevarse la casa · LA FASE 2, CERRADA (30 de agosto) · SIN VERSIÓN · migración 049

**Migración 049 EJECUTADA y ensayada contra producción.** Es la pieza **2.7**,
el flujo **F-8d**, y **con ella la Fase 2 queda cerrada**: 2.1 a 2.7.

### Lo que había, y por qué no podía quedarse

`delete_my_account()` hacía, literalmente, `delete from public.families where
owner = auth.uid()`. Con una cuenta por casa eso era exactamente lo que la
persona pedía. Desde la 047 y la 048 deja de serlo: un gremio puede tener
personas dentro con identidad propia, y esa línea se las lleva **todas** por la
clave ajena en cascada —perfiles, misiones, canjes, insignias, historial— de
gente que no ha pedido nada.

### Dos puertas, que no son la misma

- **Borrar la credencial compartida** es borrar la casa. Sigue haciendo lo de
  siempre, con una condición nueva: **si dentro vive alguien con identidad
  propia, se niega** (`hay_personas_dentro`). Que la casa se disuelva no puede
  decidirlo quien tiene la clave sin contar con quien vive dentro.
- **Borrar una identidad personal** no borra ningún gremio. Se sale de ellos, y
  el personaje **se queda**, operable por la casa igual que antes de
  convertirse. Es `borrar_mi_identidad()`, con `efecto_de_borrarme()` delante.

El efecto lo calcula el servidor **entero**, y la lista de gremios **no llega
del cliente**: el cliente enseña lo que devuelve `efecto_de_borrarme()` y al
confirmar manda solo decisiones. La función las vuelve a calcular antes de
tocar nada.

### Por qué hoy borrarse no cierra nunca un gremio

La especificación dice que la última persona administradora tiene que elegir:
traspasar, cerrar o cancelar. Y también dice que los perfiles internos y la
credencial compartida no se van con la identidad. Las dos cosas se juntan así:
**un gremio que conserva clave de casa nunca se queda sin administración**,
porque un perfil adulto con el PIN la tiene. Ahí la acción es siempre
«abandonar».

Como hoy **todos** los gremios tienen clave de casa, hoy borrarse no cierra
ninguno. Las otras tres ramas están escritas y probadas porque en la Fase 6
aparecerán gremios fundados por una persona, sin clave de casa detrás.

### Y el dinero del juego no se evapora

Al convertirse, el saldo pasó a la cartera. Al borrarse, **la cartera vuelve al
personaje** y el saldo local se reabre, con su asiento
(`devolucion_conversion`). Sin eso, quien borra su cuenta se lleva por delante
los Talis de un personaje que se queda en la casa, a la vista de todos, con
cero.

### El ensayo encontró un fallo que ningún test habría visto

Al borrar la cuenta, la clave ajena pone `conversiones.persona` a null — y el
`CHECK` que escribí en la 047 exigía que una fila `completada` tuviera persona.
**El borrado entero fallaba.** Lo mismo con `nueva` en `migraciones_correo`.

La condición correcta es **la fecha, no la persona**: una conversión completada
es el apunte de un movimiento que ocurrió, y que quien lo protagonizó haya
borrado su identidad después no lo deshace. Los dos `CHECK` quedan corregidos
en la 049. Lo que sí se sigue impidiendo —que una `pendiente` traiga persona o
fecha— no se toca.

**La lección, para la próxima:** los tests que leen el SQL como texto son
buenos para las decisiones, y no habrían visto esto ni de lejos. Lo vio
ejecutar el camino entero contra la base.

### Cómo se comprobó

Respaldo antes (`respaldo-2026-08-30-164736`). `npm run verify`: **1257 tests
en 72 ficheros**, con `tests/borrado-identidad.test.js` (16) nuevo.

Y el ensayo entero contra la base de verdad, deshecho al final: se convierte
una persona real de 424 Talis; la clave de casa intenta borrarse y recibe
**`hay_personas_dentro`** con el gremio intacto; la persona pide su efecto
—clase personal, cartera 424, acción `abandonar`, conserva clave de casa— y se
borra. Después:

- **el gremio sigue vivo**, con sus **4 perfiles, 75 misiones, 181 misiones
  completadas y 18 premios**, exactamente los mismos que antes;
- el personaje vuelve con sus **424 Talis**, sin persona y con el saldo local
  reabierto;
- su pertenencia, su cartera y su cuenta se han ido con ella;
- la fila de `conversiones` se queda **sin persona y con el importe intacto**;
- hay **un** asiento de devolución;
- y ya no queda ninguna persona dentro.

Producción intacta después: 4 gremios, 13 perfiles, todo lo nuevo a cero,
**ningún gremio sin administración** y `anon` sin poder ejecutar nada.

### La Fase 2, cerrada

| | |
|---|---|
| 2.1 · dos clases de credencial | 044 |
| 2.2 · persona, pertenencia y vínculo | 044 |
| 2.3 · migrar los gremios actuales | 044 |
| 2.4 · aislamiento por pertenencia | 045 |
| 2.5 · conversión de perfil a persona (F-9) | 047 |
| 2.6 · migrar el correo compartido (F-13) | 048 |
| 2.7 · borrar la identidad (F-8d) | 049 |

Y de propina, dos que no eran de la fase: la **046** (el barrido de permisos
que llevaba desde agosto cerrando media puerta) y el arreglo de la firma de
`grant_manual_bonus`, que cortaba la reconstrucción de la base.

### Lo que falta para que esto lo use alguien

1. **La Fase 3**, y antes que la Fase 5: la cartera recibe pero todavía no se
   llena sola.
2. **La pantalla**, que llega con su disparo en la Fase 5.
3. **Supabase Auth**: Redirect URLs y plantilla de confirmación
   (`docs/CORREOS.md` §1).
4. **Mirar la pantalla con una sesión real.**

Ya **no** está en esta lista `delete_my_account`, que era lo que bloqueaba el
lanzamiento.

## 7bh. Las reglas dejan de ser constantes (30 de agosto) · SIN VERSIÓN · migración 050

**Migración 050 EJECUTADA y comprobada.** Es la pieza **3.1**, la primera de la
Fase 3, y se desarrolló **en paralelo** en un worktree aparte (rama
`fase-3-1`), sin tocar la base, mientras esta sesión hacía la 2.7. Integrada
aquí después de revisarla.

### Qué trae

Los números de la expansión —hitos, costes, factor, límite global y
caducidades— dejan de vivir en `src/lib` y pasan a **tres tablas versionadas**
que el servidor puede leer al cobrar una llave: `configuracion_expansion`,
`escalones_expansion` y `disponibilidad_tipos`.

Las tres se escriben **juntas en una transacción** y después **no admiten
`update` ni `delete`**: la historia de lo que cobraba cada versión no se
reescribe. Y no basta con prohibir el `update`: añadir mañana un escalón a la
versión de hoy no es un `update` y cambiaría lo que cobraba una versión ya
usada, así que un tercer disparador exige que los escalones viajen con su
cabecera.

**Cinco funciones lectoras** `security definer` son la única puerta —las tablas
no se conceden a nadie, patrón `operadores`—, así que `motivo` y
`publicada_por` no salen por la API. Sin versión vigente la respuesta es **cero
filas**, no un `null` que alguien recoja con un `coalesce` distraído.

`tipo_publicado()` **no** se concede a `authenticated` a propósito: el país es
un parámetro suyo, y un cliente no declara en qué país está para desbloquear un
tipo.

**Los costes se guardan uno a uno, no como fórmula.** Guardar solo la base y el
factor obliga a calcular la potencia dos veces —servidor al cobrar, cliente al
pintar— que es la segunda fuente de verdad que se acaba de quitar de la curva
de nivel. Un validador comprueba al publicar que las filas cuadran con la regla
declarada.

Primera versión **`2026-08-30.1`** con los números aprobados sin retocar: hitos
6-8-10-12, costes 300/750/1875/4690, ×2,5, límite 5, invitaciones 14 días,
llaves sin caducidad. Y `tests/expansion.test.js` deja de llevarlos escritos:
los lee de la migración, así que la calibración del 29-ago se defiende ahora
contra la misma fuente que usa el servidor.

### Lo que hubo que corregir al integrarla

**Las dos copias del esquema diferían en los acentos de los comentarios de dos
funciones.** El código era idéntico y la prosa seguía la convención de cada
fichero, que parece lo correcto — pero **Postgres guarda el cuerpo tal cual,
comentarios incluidos**, en `pg_proc.prosrc`. Dos copias que solo difieren en
un acento producen objetos **distintos** en la base, y entonces comparar
`md5(prosrc)` con el fichero —que es como se cazó esta misma mañana que
`crear_campana_limpieza` y `spend_power` llevaban semanas desviadas— deja de
servir.

**La regla, para escribirla de una vez:** dentro de `$fn$ … $fn$` mandan los
ficheros `.sql` nuevos, que van **sin acentos**, y `schema.sql` copia ese cuerpo
tal cual. Fuera de las funciones, cada fichero conserva su estilo. Lo defiende
ahora `tests/configuracion.test.js`, que compara los diez cuerpos byte a byte.

### Cómo se comprobó

Respaldo antes (`respaldo-2026-08-30-170939`). `npm run verify`: **1289 tests en
73 ficheros**.

Contra la base, después de aplicar: versión vigente `2026-08-30.1`, escala
`1:n6/300 2:n8/750 3:n10/1875 4:n12/4690`, parámetros `5/4/geometrica/14/sin
caducidad`, `hito_expansion(1)` = 300 y `hito_expansion(9)` = cero filas.
`anon` no puede ejecutar nada, `authenticated` no puede leer las tablas ni
llamar a `tipo_publicado`.

Y los cuatro intentos de reescribir la historia, **los cuatro rechazados**: un
`update` sobre un escalón, un `delete` sobre la versión, añadir un escalón a
una versión ya publicada, y publicar una escala en la que el segundo coste no
dobla al primero. Este último salta al **cerrar** la transacción, porque el
validador es un disparador diferido — el primer ensayo lo dio por bueno y el
fallo era del ensayo, no del código.

Las diez funciones, **idénticas byte a byte** entre `schema.sql` y la base.

### Lo que la 3.1 deja escrito y no hecho

- **Las 72 horas de la 047 y la 048 siguen escritas a mano.** Son caducidades
  de la conversión de identidad, no de la expansión, y redirigirlas obliga a
  reescribir dos funciones ya en producción. Hacerlo la próxima vez que se
  toquen.
- **`MAX_PERFILES` y los límites por tipo no se han movido**: van en la
  plantilla de tipo (Fase 4).
- **No hay función de publicación**: las versiones nuevas se insertan desde el
  SQL Editor. Cuando haya pantalla de operador, una RPC con `es_operador()`
  delante; las comprobaciones ya están en disparadores.
- Los nombres de tipo son los de la especificación (`hogar`, `amigos`,
  `equipo`, `hogar_compartido`); traducirlos desde `families.tipo_gremio` es la
  Fase 4.

## 7bi. La cartera cobra y paga (30 de agosto) · SIN VERSIÓN · migración 051

**Migración 051 EJECUTADA y ensayada.** Es la pieza **3.2**, el modelo híbrido
de saldo. No cambia nada en `src/` salvo retirar un mensaje que ya no puede
ocurrir, así que la app sigue en la 2.33.4 y no hay nada que desplegar.

### Qué faltaba

La 047 creó la cartera y le pasó el saldo al convertirse, pero ahí se acababa:
las ocho funciones que mueven monedas seguían escribiendo en `profiles.coins`.
A partir del día siguiente, esa persona **ganaba en un monedero y tenía el
dinero en el otro**. Por eso la 047 se escribió con la conversión sin disparo y
con el aviso de que la Fase 3 tenía que llegar antes que la Fase 5.

La regla es `D-02` en su opción C: quien tiene identidad **cobra y paga de su
cartera**; quien no la tiene —una peque, una junior, una mascota, un perfil sin
convertir— conserva su **saldo local** exactamente como hoy. Y el saldo de una
peque nunca se mezcla con la cartera de nadie.

### Dónde se encamina, y la excepción que lo hace posible

En un disparador `before update of coins on profiles`, no tocando las ocho
funciones: es lo que la 043 ya descartó para el libro, y por lo mismo.

Y la línea que hay que entender: **si `persona` cambia en el mismo `update`, el
disparador no se mete.** Hay dos operaciones cuyo trabajo es precisamente mover
el dinero de un monedero al otro —la conversión y el borrado de identidad— y
las dos cambian `persona` y `coins` a la vez, en direcciones opuestas. Si el
disparador mirara `new.persona`, leería la conversión como «acaba de gastar
424» y se lo restaría a una cartera todavía vacía.

### Dos fallos que encontró el ensayo, y ninguno era del ensayo

1. **Una transferencia entre monederos son DOS asientos, y solo se anotaba
   uno.** La conversión apuntaba la salida del saldo local y la entrada en la
   cartera no dejaba rastro en el libro: la cartera tenía 424 y `descuadre_saldos()`
   decía 0. Arreglado poniendo **una sola puerta que toca `carteras`**
   (`mover_cartera`), que mueve y anota juntos — misma decisión que la 043. Las
   tres funciones de transferencia dejan de tocar la tabla a mano.
2. **La clave de idempotencia es única en todo el libro**, así que las dos patas
   de un traspaso no pueden llevar la misma. La lleva la de salida; el «una sola
   vez» del traspaso ya lo garantiza `conversiones.clave`. Chocó en el segundo
   ensayo, con violación de índice.

### Y el libro empieza a cuadrar de verdad

`CON-5` pide que la suma de los asientos reproduzca el saldo. **No lo hacía para
nadie**, y no por un fallo: el libro nació con la 042 y los saldos son
anteriores. Los cuatro perfiles con dinero (559, 424, 320 y 45) no tenían ni un
asiento detrás.

Se les escribió uno de **apertura**, que dice la verdad: «esto es lo que había
el día que empezó a haber libro». Sin él, `descuadre_saldos()` nace dando
falsos positivos para todo el mundo y nadie la vuelve a mirar.

Además, `saldo_local_cerrado` deja de poder mentir: un `CHECK` la ata a
`persona`, que es quien manda. Tenerlas por separado era tener dos fuentes de
la misma verdad.

### Las dos funciones que leían mal

`redeem_reward` miraba `p.coins`, que para un convertido vale cero: ahora lee
`saldo_de()` y **deja de rechazar** a quien tiene el saldo en la cartera —ahora
la cartera paga—, así que el código `saldo_en_cartera` desaparece. Y
`undo_completion` recortaba con `greatest(0, coins - c.coins)`: ese cero es el
del saldo local, así que deshacer una misión no le quitaba nada al convertido y
la cartera se quedaba con monedas de un trabajo que la base ya no considera
hecho.

### Cómo se comprobó

Respaldo (`respaldo-2026-08-30-174813`). `npm run verify`: **1308 tests en 74
ficheros**.

Y el ciclo entero contra la base, deshecho al final: se convierte una adulta de
424 · estrella diaria → 429 · premio a mano → 449 · canje de 15 → 434 · **el
mismo canje repetido con la misma clave → sigue en 434** · un canje que no puede
pagar → `sin_monedas` · deshacer una misión de 5 → 429. **El saldo local de la
adulta se queda en 0 todo el rato.** Y la peque, en la misma casa, pasa de 45 a
50 **en su saldo local, con cero carteras**.

Su libro al terminar, por partida doble:
`apertura/+424/local · conversion/−424/local · conversion/+424/cartera ·
bonus_diario/+5 · bonus_manual/+20 · canje/−15 · canje/−1434 (rechazado) ·
deshacer_mision/−5`. **Descuadres: 0.**

Producción intacta después: 4 gremios, 1348 Talis, 4 asientos de apertura, cero
carteras y cero cuentas de ensayo.

### Lo que queda de la Fase 3

Solo la **3.3**: que el precio sea el del gremio donde se gasta. Hoy no cambia
nada porque una persona tiene un gremio; empieza a importar en la Fase 6.

## 7bj. El precio es el del gremio · LA FASE 3, CERRADA (30 de agosto) · 2.33.5 · migración 052

**Migración 052 EJECUTADA.** Es la pieza **3.3**, la última de la Fase 3, y con
ella **la fase queda cerrada**.

### Lo primero: casi todo lo que pedía `R-53` ya pasaba

«Los TALIS se gastan siempre al precio vigente del gremio donde se gasta, con
su temporada y sus reglas.» Eso ya era verdad, y no por casualidad:

- cada premio es de un gremio, y la 041 comprueba que el premio y quien lo
  canjea sean de la misma casa;
- `redeem_reward` cobra `rw.cost` y nada más — el cliente **no tiene por dónde**
  declarar un coste, así que no puede declarar uno menor (`E-5.4`);
- y **la temporada ya está dentro de ese número**: la subida del 30 % no se
  calcula al cobrar, la escribe un adulto sobre `rewards.cost` al abrir
  temporada. El precio guardado ES el vigente.

Así que aquí no había nada que arreglar. Lo que sí hacía falta eran **pruebas
que lo sujeten**: lo que se cumple sin que nadie lo defienda es lo que se rompe
sin que nadie lo note, y basta con que alguien añada un parámetro de coste «para
la vista previa».

### Lo que sí faltaba, y era consecuencia de la 051

**La tienda lee `profiles.coins`, y desde la 051 eso vale cero para un personaje
convertido**: su dinero está en la cartera. La tienda le enseñaría cero Talis y
todos los premios en gris con 429 en el bolsillo. Nadie puede verlo hoy, pero
era una avería servida para el día que exista la pantalla.

`saldos_visibles()` devuelve, para cada personaje de mis gremios, lo que de
verdad puede gastar. La app la llama en el bloque degradable de `loadAll` y
sustituye `coins` **solo en lo que se pinta**: la columna de la base no se toca,
y si la migración no estuviera, el saldo se queda el de siempre. Ninguna
pantalla se entera de que hay dos monederos.

### Una decisión que la Fase 6 tiene que revisar

`saldos_visibles()` devuelve los personajes de **mis gremios**, no solo el
propio. Es lo que sostiene `CNV-7` —convertirse no saca al personaje del
selector de la casa, que lo sigue viendo y operando igual— y hoy no choca con
nada, porque un gremio es una casa y quien opera ese personaje ya veía su saldo
ayer.

Pero `CAP-12` dice que el saldo es «solo propio». **En la Fase 6 hay que volver
aquí**: enseñarle a un desconocido cuánto tiene en la cartera alguien de su
gremio de amigos no es lo mismo que enseñárselo a su madre.

### Y la tienda dice cuánto falta

`E-5.3` pide que el rechazo indique **cuánto falta**, no solo que falta. Ahora
el premio que no se puede pagar lleva su «te faltan N» al lado del precio, antes
de pulsar. «No tienes suficientes» obligaba a restar de cabeza para saber si era
cuestión de una misión o de una semana.

### La Fase 3, cerrada

| | |
|---|---|
| 3.1 · configuración versionada | 050 |
| 3.2 · cartera híbrida | 051 |
| 3.3 · el precio del gremio donde se gasta | 052 |

Definición de hecho, punto por punto: `E-5.3` ✅ · `E-5.4` ✅ (estructural: el
cliente no puede declarar coste) · **descuadre saldo/asientos: cero** ✅ · la
tienda no cambia de precio para nadie ✅ · ningún número de expansión vive ya en
`src/lib` ✅.

### Cómo se comprobó

Respaldo (`respaldo-2026-08-30-180454`). `npm run verify`: **1317 tests en 75
ficheros**. Y contra la base: la cuenta de una casa ve **sus 4 personajes y
ninguno de otra**, con saldos idénticos a `profiles.coins` — que es lo correcto
mientras no se convierta nadie.

### Lo que falta para que esto lo use alguien

1. **Fase 4** — el tipo de gremio como plantilla.
2. **Fase 5** — hitos y llaves, y **con ella la pantalla**: es el primer motivo
   real para convertirse.
3. **Supabase Auth**: Redirect URLs y plantilla de confirmación.
4. **Mirar la pantalla con una sesión real.**

## 7bk. El tipo deja de ser un `if` (30 de agosto) · 2.33.6 · migración 053

**Migración 053 EJECUTADA y ensayada.** Son las piezas **4.1** y **4.3** de la
Fase 4. **Faltan la 4.2** (capacidades por rol) **y la 4.4** (país de
operación).

### Qué había, y por qué no podía crecer

El tipo de gremio ya existía —`families.tipo_gremio`, 'familia' o 'piso' desde
la 032— y ya cambiaba el comportamiento. Pero escrito como `tipo_gremio ===
'piso'` a mano donde hiciera falta. Con dos tipos y dos efectos se aguanta; con
los tres que vienen y siete ejes de efecto son decenas de `if` en sitios que
nadie recuerda. **El mismo problema que la 050 resolvió con los números de la
expansión.**

Un apunte de realidad: la especificación habla de cuatro ficheros con
condicionales. Vivos quedaban **dos** —el texto del mapa de zonas y si dar las
gracias parte de un encargo—, los dos en el cliente.

### Las tres capas, y cuál es esta

El **núcleo común** no se toca. La **política de tipo** —esta plantilla— decide
cómo nace un gremio y qué tiene encendido, y se aplica **una vez**, al crear. La
**configuración** que el grupo edita después es suya.

De ahí la regla que lo sostiene todo: **una plantilla mejorada no reescribe
gremios existentes**, porque estaría pisando decisiones que ya no son suyas. Por
eso cada gremio guarda `plantilla_version`, y por eso una plantilla publicada
no se edita ni se borra: se publica otra versión.

### Por qué los ejes van en `jsonb`

Porque se leen **enteros y de una vez**, al abrir el gremio, y nadie los
consulta por campo: nadie va a preguntar qué gremios tienen los encargos
apagados. Siete tablas para eso serían siete `join` y ningún `check` que valga
la pena. Lo que sí hace falta —que no cambien por detrás— lo da el mismo sello
que la 050, no un `check`.

Los **dos interruptores de Equipo** sí van en columnas propias, y el motivo
importa: si el progreso de un equipo contara y se pudiera forjar desde ahí, un
gremio de trabajo sería la vía más barata de subir de nivel y ganar monedas para
gastarlas fuera. Eso no puede quedar enterrado en un `jsonb`.

### Las cuatro plantillas, y solo una se ofrece

| | | |
|---|---|---|
| **Hogar** | se ofrece | es el `familia` de siempre, con el nombre de la especificación |
| **Hogar compartido** | no | tipo **legado**: son los `piso` que ya existen. **Hay uno real en producción**, y sigue exactamente igual |
| **Amigos** | no | escrita, pero su catálogo está sin validar con un grupo real: un tipo que nace vacío es peor que un tipo que no está |
| **Equipo** | no | especificada y **apagada** hasta su revisión jurídica |

### Ningún gremio cambia de nada

`'familia'` → `'hogar'` y `'piso'` → `'hogar_compartido'`. Es un cambio de
nombre, no de comportamiento: mismos catálogos, mismos roles, mismos permisos,
mismos datos. Y **`tipo_gremio` no se retira**: sigue siendo lo que lee el
cliente viejo, y quitarla es el paso «contraer» de otra tanda.

**Los textos sembrados son exactamente los que estaban escritos a mano**, y hay
un test que lo comprueba: si el de la plantilla no es el que decía el cliente,
alguien ha cambiado el producto sin querer.

### Y el tipo es inmutable por decisión, no de casualidad

Hasta hoy lo era «de hecho»: no había pantalla que lo tocara. Eso no es una
garantía, es una ausencia. Ahora un disparador rechaza cambiar el tipo, la
versión de plantilla **y el `tipo_gremio` viejo**.

### Cómo se comprobó

Respaldo (`respaldo-2026-08-30-182317`). `npm run verify`: **1332 tests en 76
ficheros**.

Contra la base: los **4 gremios migrados** (3 hogar, 1 hogar compartido), cero
sin clasificar, la cuenta ve la plantilla de su gremio y solo `hogar` en los
tipos ofrecidos, con su texto intacto. Y los **cinco rechazos**: cambiar
`tipo_gremio`, cambiar `tipo_plantilla`, cambiar la versión, editar una
plantilla publicada y borrarla. Renombrar el gremio —que tiene que seguir
funcionando— sigue funcionando.

### La deuda que cierra, y con test

«Cero condicionales por tipo fuera de la plantilla» es un punto de la definición
de hecho, y ahora lo defiende un test: **solo dos ficheros comparan el tipo**, y
los dos únicamente como respaldo para cuando la plantilla no está. Un tercero
hace caer la prueba.

### Lo que falta de la Fase 4

- **4.2 · capacidades por rol** (`CAP-01` a `CAP-17`). Hoy la única puerta sigue
  siendo el PIN, como siempre. La etiqueta visible no autoriza nada, pero eso
  todavía no está modelado.
- **4.4 · país de operación**. La matriz tipo × país × estado ya existe desde la
  050 (`disponibilidad_tipos`, `tipo_publicado()`); falta `families.pais` y la
  ruta de declaración tardía para los gremios que ya existen — que **nunca**
  reciben un país por inferencia y **nunca** se quedan bloqueados por no haberlo
  declarado.

## 7bl. La etiqueta visible no autoriza nada (30 de agosto) · SIN VERSIÓN · migración 054

**Migración 054 EJECUTADA y ensayada.** Es la pieza **4.2**. Solo toca el
servidor, así que la app sigue en la 2.33.6.

### Los tres ejes que hoy son uno solo

Con una cuenta por casa, «permiso» significa hoy una sola cosa: saberse el PIN.
Con varias personas, varios gremios y tres tipos hacen falta tres ejes, y lo
importante es **no mezclarlos nunca**:

- **Capacidad** — la unidad de autorización. Nombre estable, comprobable en
  servidor, independiente del tipo. **Es lo único que autoriza.**
- **Rol interno** — un paquete de capacidades, el mismo en los tres tipos.
- **Rol visible** — la etiqueta que lee la gente. Cambia por tipo y **no
  autoriza nada**.

El tercero es el que trae los accidentes. Es comodísimo escribir
`if rol = 'gestor'` en una función, y el día que un tipo llame «Organizador» a
otra cosa, esa línea autoriza a quien no debía.

### Cómo se resuelve

`puede(gremio, capacidad, personaje)` devuelve `'no'`, `'si'` o **`'pin'`**:

1. Si tengo **pertenencia activa en ese gremio**, mi rol es el de la
   pertenencia. **Nunca el gremio activo de la sesión**: en cuanto hay dos son
   cosas distintas.
2. Si no, y soy la credencial compartida **de ese gremio**, manda el rol del
   **personaje que se opera**. Es lo que hay hoy: en una casa manda quien sabe
   el PIN, y las peques no.
3. Si no, no soy nadie ahí.

Tres valores y no un booleano porque el PIN sigue siendo una puerta de verdad
—protege el panel de **su** gremio, y saber el de A no abre el de B— y una
capacidad que lo exige no es lo mismo que una que no.

**Lo que no está declarado, no está permitido**: una capacidad inventada
después de publicar una plantilla no la gana nadie por sorpresa.

### Y tres funciones dejan de mirar la etiqueta

`grant_manual_bonus`, `crear_campana_limpieza` y `cerrar_campana_limpieza`
comprobaban `role = 'adulto'` a mano. Ahora preguntan por capacidad, y la matriz
devuelve **exactamente lo mismo** para lo que hay hoy: un adulto con la clave de
la casa puede, una junior o una peque no. Lo que cambia es de dónde sale la
respuesta, y que el día que un tipo reparta distinto, estas tres se enteran
solas.

Se pasaron **tres y no las ocho** a propósito: son las que hoy tienen una
comprobación de rol de verdad. Poner `puede()` donde no había nada sería
inventarse un permiso, no trasladarlo.

### Lo que NO hace, y hay que tenerlo claro

**El PIN se sigue comprobando en el cliente**, como hasta hoy. Que la matriz
diga `'pin'` no lo verifica: dice que hace falta. Verificarlo en servidor exige
que el PIN viaje en cada llamada, y eso es otra tanda.

### Cómo se comprobó

Respaldo (`respaldo-2026-08-30-184119`). `npm run verify`: **1349 tests en 77
ficheros**. Contra la base: **476 filas** de matriz (4 plantillas × 7 roles × 17
capacidades), `adulto/CAP-09` = `pin`, `peque/CAP-09` = `no`, `adulto/CAP-13`
(forjar) = `no` —una credencial compartida no forja, no hay a quién cargarle el
gasto—, `adulto/CAP-17` (convertirse) = `si`, y `no` para: sin personaje, gremio
ajeno y capacidad inventada.

## 7bm. El país se declara, nunca se deduce (30 de agosto) · SIN VERSIÓN · migración 055

**Migración 055 EJECUTADA y ensayada.** Es la pieza **4.4**, y con ella **la
Fase 4 queda cerrada**. Solo toca el servidor, así que la app sigue en la
2.33.6.

### Qué había, y qué faltaba

La matriz tipo × país × estado existe desde la 050 y `tipo_publicado()` la
contesta. Lo que no había era **el país**: la matriz sabía responder «qué tipos
hay publicados en ES» y no había manera de saber si un gremio opera en ES.

Por eso `tipo_publicado()` se dejó sin conceder a `authenticated`: el país es un
parámetro suyo, y un cliente no declara en qué país está para desbloquear un
tipo (`R-108`, `SEC-29`). Quien la llame tiene que ser una función del servidor
que sepa de dónde sacar el país de verdad. Esa función ya existe, y el país de
verdad es `families.pais`.

### La tentación era `timezone`

La columna está ahí desde la 018, dice `Europe/Madrid` para los cuatro gremios
que existen, y sacar `'ES'` de ahí es **una línea**. Sería un país inventado por
el servidor con apariencia de dato declarado, y el día que alguien opere desde
Madrid para un gremio de otra jurisdicción, esa línea habría decidido su régimen
legal sola. Un test lo prohíbe explícitamente: ninguna de las cinco funciones
nuevas puede nombrar `timezone`.

La columna nace **nula para todos**, y nula quiere decir «sin declarar», que es
la verdad. Mismo criterio que `legal_version` en la 022.

### Y no se bloquea a nadie

Sin `not null`, sin valor por defecto, y **ninguna función viva empieza a exigir
un país**. `exige_pais()` existe y hoy no la llama nadie —igual que
`exige_persona()` en la 044 existió antes que su primer uso—, y hay un test que
cuenta sus llamadas dentro de los cuerpos de función: si alguien la enchufa sin
darse cuenta, la prueba cae. Se le pedirá el país al gremio la primera vez que
intente algo que dependa de él, y eso es la Fase 5.

### Tres respuestas, porque «sin país» no es «no»

`disponibilidad_de_tipo(gremio, tipo)` devuelve `'si'`, `'no'` o **`'sin_pais'`**.
El tercero es `R-117` entero: es lo único que dispara la pregunta. Quien lo trate
como un `'no'` estaría bloqueando un gremio por no haber declarado, que es justo
lo que la regla prohíbe.

Y fíjate en lo que la función **no** tiene: un parámetro `pais`. Recibe el gremio
y el país lo saca ella de la base. Eso es `R-108` escrito en la firma, y es la
razón de que esta sí se pueda conceder a `authenticated`.

### El `update` a mano también cierra

La comprobación de capacidad habría sido decorativa. La política `familia_owner`
es `for all`, así que la cuenta del gremio escribe en `families` por la API y se
pondría el país sin pasar por `CAP-04`. El disparador exige un pestillo de
transacción —`set_config('app.declarando_pais', …, true)`, el mismo mecanismo que
`motivo_coins` desde la 043— **con el id del gremio dentro**: un pestillo abierto
para A no abre B. Es la lección de la 054 aplicada aquí: si la única guarda está
en una función que se puede rodear, no es una guarda.

### `CAP-04`, y no una capacidad nueva

Declarar el país es cambiar un ajuste del gremio. Inventar `CAP-18` tendría
además un efecto que solo se ve leyendo la 054: **lo que no está declarado no
está permitido**, así que ninguna plantilla ya publicada la tendría y la
declaración habría sido imposible para todo el mundo. `CAP-04` reparte hoy `pin`
a titular, gestor y adulto: el perfil adulto con el PIN y la persona con
administración de `R-117`, palabra por palabra.

### Declarar dos veces

El mismo país devuelve `ok` —un doble clic no es un error—. Uno **distinto** se
ignora, no cambia nada y el intento se anota en `app_logs` como aviso (`E-12.6`).
El apunte permanente —quién declaró, cuándo y qué— vive en `families` y no
caduca; `app_logs` es para lo que hay que mirar, no para lo que hay que guardar
siempre.

### Cómo se comprobó

Respaldo (`respaldo-2026-08-30-190109`). `npm run verify`: **1375 tests en 78
ficheros**.

Contra la base: **4 gremios, los 4 sin declarar** —que es lo correcto, porque
esta migración no declara el país de nadie—, las cinco funciones creadas, el
disparador puesto, y los permisos exactos: las cuatro públicas concedidas a
`authenticated` y no a `anon` ni a PUBLIC, el disparador a nadie, y
`tipo_publicado()` **sigue sin `authenticated`**, que es lo que la 050 dejó
dicho.

Y el ensayo —once comprobaciones en un bloque que termina en
`raise exception 'ENSAYO…'` y lo deshace todo—:

| | |
|---|---|
| `update` a mano | rechazado |
| pestillo de **otro** gremio | rechazado · un pestillo abierto para A no abre B |
| por la puerta | declarado = `ES` |
| cambiarlo después | rechazado |
| retirarlo | rechazado |
| reescribir el apunte | rechazado |
| **renombrar el gremio** | sigue funcionando |
| `hogar/ES` · `equipo/ES` · `hogar/FR` | `true` · `false` · `false` |
| `declarar_pais()` desde el SQL Editor | `sin_sesion` |

Después del ensayo los cuatro gremios seguían sin país y `app_logs` sin ningún
`pais_ya_declarado`: no quedó nada detrás.

## 7bn. La llave se forja (30 de agosto) · SIN VERSIÓN · migración 056

**Migración 056 EJECUTADA y ensayada.** Es la **Fase 5** entera: el nivel
derivado en servidor, el derecho de expansión —la llave— con su ciclo de vida
completo, y la forja con todas sus comprobaciones. Solo toca el servidor, así
que la app sigue en la 2.33.6.

### La tercera copia de la fórmula del nivel, y cómo se evita que se separen

El plan de la Fase 1 aplazó derivar el nivel en servidor con este motivo
escrito: «hoy añadiría una tercera copia de la fórmula sin nadie que la llame
hasta la Fase 5. Cuando entre, hace falta algo que garantice que SQL y JS
coinciden». Ya entró, porque forjar exige comprobar el nivel y `R-26` prohíbe
que el cliente lo declare.

Lo que evita que se separen son tres cosas: la aritmética está escrita **una
vez**, en `xp_de_nivel()`; `nivel_de_xp()` la recorre con **el mismo bucle** que
`levelFromXp`; y `tests/llave.test.js` **extrae la expresión del SQL, la ejecuta
en JS** y la compara con `xpForLevel` del nivel 1 al 40, más el bucle completo
en los bordes exactos de cada hito.

Y no es una fórmula cerrada a propósito: `floor((1 + sqrt(1 + xp/12.5)) / 2)`
devuelve en coma flotante el nivel **anterior** justo en el valor exacto de un
hito, que es el único sitio donde esta función decide algo. El test lo prohíbe
por escrito.

### El nivel sale de la marca de agua

`E-4.5`: deshacer una misión baja la XP y **el hito alcanzado no se retira**. Se
lee `xp_maxima`, que un disparador mantiene desde la 035 y que nunca baja. Si se
leyera `xp` a secas, corregir una misión mal validada le quitaría a alguien una
oportunidad que ya se había ganado.

En el ensayo se ve: con el nivel puesto a 6 y la XP bajada a cero después,
`nivel_en_gremio()` seguía diciendo 6.

### Nada cobra antes de haber dicho que sí

El orden de las once comprobaciones **es** la especificación, y un test lo
defiende por posición en el texto: todo lo que puede decir que no aparece antes
de la línea que toca la cartera.

El límite global se mira **antes de cobrar** (`R-61`, `D-06`): la versión
anterior de la especificación dejaba comprar en el límite, y cobrar por una
llave que no se puede usar es cobrar por nada. Entre «estás en el límite» y «no
te llega» se responde primero el límite: no llegar es cuestión de una semana,
estar en el límite es una decisión —salir de un gremio— y merece decirse antes.

Y solo el rechazo **por saldo** deja asiento (`R-08`, `F-5` paso 5). Anotar «te
falta nivel» llenaría el libro de cosas que no son dinero.

### El escalón, una sola vez, y por índice

`E-4.4` lo garantiza `idx_derecho_escalon_una_vez` y no un `select` previo:
entre el `select` y el `insert` cabe otra petición, que es el oficio de
`idx_bonuses_uno_al_dia`. El índice es **parcial**, y ahí está el matiz: una
llave **revertida no bloquea** el escalón. Revertir devuelve el dinero (`T-12`);
si además se quedara con la oportunidad, la persona habría perdido las dos
cosas.

El manejador de `unique_violation` rodea **solo al `insert`**. Puesto al final
de la función se tragaría también el choque de claves del libro, y un problema
de idempotencia saldría disfrazado de `ya_forjado`.

### El origen sobrevive al cierre del gremio de origen

`E-7.4` pide que la llave siga registrando A como origen aunque A se cierre. Con
`cascade` un gremio cerrado borraría llaves pagadas; con `set null` borraría la
trazabilidad de `R-22`. Por eso `origen` **no tiene clave ajena**, y por eso se
guarda además `origen_nombre`: un uuid huérfano registra el origen para la base,
pero no para quien lee su lista de llaves. Mismo criterio que `publicada_por` en
la 050.

### Y el tipo lo decide la plantilla, no un `if`

Equipo no origina llaves porque su plantilla dice `expansion_desde_tipo = false`
(`R-111`, `R-115`), no porque haya una comparación escrita en la forja. Es la
053 haciendo su trabajo, y hay un test que lo vigila.

### Lo que NO hace

**No gasta la llave.** Crear un gremio y aceptar una invitación son la Fase 6.
`consumir_llave()` existe, lanza en vez de devolver un código —su sitio es
dentro de la transacción de destino, para que las dos cosas se deshagan juntas
(`R-20`, `T-10`)— y **no se concede a `authenticated`**: un cliente que pudiera
llamarla suelta consumiría una llave sin crear nada. Hoy no la llama nadie.

**No exige país.** Forjar depende del nivel, del saldo y del límite; quien
decide la jurisdicción es **crear** el gremio, que es la Fase 6. Un gremio sin
país declarado puede forjar, y eso es `R-117` deliberado.

**No caduca ninguna llave.** `T-14` recomienda no caducar en el MVP y
`llave_dias` ya es nulo desde la 050. El estado `'caducado'` existe en el modelo
y hoy no lo escribe nadie.

**No hay pantalla.** `oportunidades_expansion()` devuelve el «cuánto falta» que
la pantalla necesitará, en el mismo orden que la forja para que no puedan decir
cosas distintas. Pintarlo es otra tanda.

### Cómo se comprobó

Respaldo (`respaldo-2026-08-30-200015`). `npm run verify`: **1413 tests en 79
ficheros**.

Y el ensayo contra la base, que forjó una llave **de verdad** montando una
identidad personal completa y lo deshizo todo al terminar:

| | |
|---|---|
| con credencial compartida | `exige_identidad_personal` |
| nivel 0 | `nivel_insuficiente` |
| escalón 99 | `escalon_desconocido` · `CFG-6` |
| nivel bastante, sin monedas | `sin_monedas`, y **1 asiento** con saldo igual antes y después |
| **XP bajada a cero después del hito** | el nivel sigue siendo 6 · `E-4.5` |
| forja | `ok`, y la cartera baja **exactamente** el coste |
| la llave | origen, nombre, coste, versión, temporada 1 y estado `disponible` |
| el asiento | 1, con `referencia` a la llave y la diferencia = coste |
| otra vez el mismo escalón | `ya_forjado`, sin cobrar |
| la misma clave otra vez | `ok`, sin cobrar |
| con **5 pertenencias activas** | `en_el_limite` y **saldo intacto** · `R-61`, `E-9.13` |
| consumir dos veces | `consumido` y después `llave_no_disponible` · `E-9.12` |
| revertir sin ser operador | `no_autorizado` |
| plantillas que forjan | `hogar` `amigos` `hogar_compartido` sí · **`equipo` no** |

Después: 0 llaves, 0 pertenencias, 0 carteras, 4 gremios, ninguna cuenta de
ensayo y **cero descuadres**. No quedó nada detrás.

## 7bo. Una persona, varios gremios (30 de agosto) · SIN VERSIÓN · migración 057

**Migración 057 EJECUTADA y ensayada.** Es la **6.1** de la Fase 6: el
servidor. Invitaciones con caducidad, crear un gremio con llave, aceptar con
llave, abandonar, expulsar y reingresar. **No toca el cliente**, y eso es
deliberado: mientras nadie tenga dos gremios, la familia que usa la app hoy no
nota nada. La app sigue en la 2.33.6.

### Antes de tocar nada: el inventario

El plan ponía una condición —«hay que inventariar **antes** los supuestos de
gremio único del cliente»— y está hecha, en **`NOTAS-FASE-6.md`**. Salieron los
cuatro que el plan nombraba y **cuatro más**. Léelo antes de la 6.2; aquí solo
va el que mandaba.

### El índice que había que quitar, y por qué no antes

`idx_families_owner` era único desde la 017, y su comentario decía por qué: «la
app carga el gremio con `limit 1` sin orden, así que una cuenta con dos gremios
abre uno u otro según el día. **Mientras eso siga así, dos gremios por cuenta
son un error, no una función.**»

Sigue siendo verdad. Por eso el índice **deja de ser único y no desaparece**
—la primera rama de `mis_gremios()` es `families.owner = auth.uid()`, y sin él
cada petición recorrería la tabla de familias entera—, y por eso **nadie tiene
dos gremios hasta que la 6.2 esté desplegada**.

No es teoría: el ensayo de la 056 se topó de frente con ese índice al intentar
crear gremios de mentira, y hubo que darle a cada uno una cuenta propia.

### Quién es el `owner` de un gremio creado con llave

Hasta hoy `families.owner` era la **credencial compartida**: la cuenta de la
casa. Un gremio creado con llave lo crea una **persona**, y `credenciales`
prohíbe que una personal lleve `family_id`. Así que ese gremio **nace sin
credencial compartida** y su `owner` es la cuenta personal. Crearle una —para
que entre gente sin cuenta, como en una casa— es la Fase 7.

Y hay una función que esto podría haber convertido en un desastre:
`delete_my_account()` borra los gremios de los que la cuenta es dueña, y con una
persona dueña de tres eso serían tres casas. **Ya estaba cerrado**: la 049 le
puso delante `if clase_credencial() = 'personal' then return
'usa_borrar_identidad'`. Hay un test que vigila que siga puesto.

### Volver no cuesta el historial

`R-63` es la regla menos evidente de la fase: al reingresar **no nace un
personaje nuevo, vuelve el anterior** con su XP, su marca de agua, sus insignias
y su historial. «Empezar desde cero en cada gremio» es la primera vez que
entras, no cada vez (`R-64`). Sin eso, volver a casa sería un castigo por
haberse ido.

En el ensayo se ve entero: la amiga entra, llega a 250 de XP, se va —el
personaje se retira, no se borra—, la vuelven a invitar, acepta, y sale **un
solo personaje con sus 250 de XP**, aunque al reingresar diera otro nombre.

### La llave y la puerta se deshacen juntas

`consumir_llave()` se llama **después** de que la entrada haya funcionado y
**dentro de la misma transacción** (`R-20`, `T-10`). Si lanzara —una carrera con
otra petición usando la misma llave— se deshace todo: la pertenencia, la
invitación y el consumo. Eso no es una comprobación, es dónde vive el código, y
un test vigila que ninguna de las dos puertas capture esa excepción.

En el ensayo: dos intentos de crear con la llave 2 fallaron —país sin publicar y
tipo no ofrecido— y **la llave 2 siguió disponible**.

### El país, aquí sí llega como parámetro

Y no contradice a `R-108`. `R-102` dice que el país se **elige explícitamente**
al crear; lo que `R-108` prohíbe es que un país declarado por el cliente
**autorice** algo. Por eso la elección se cruza contra `tipo_publicado()`, que
es la matriz del servidor: declarar `FR` no desbloquea nada, deniega. Esta es la
primera función que llama a `tipo_publicado()`, que la 050 escribió para este
momento y dejó sin conceder a `authenticated` exactamente por esto.

### Lo que NO hace, y hay que tenerlo claro

- **El gremio nuevo nace desnudo.** Sin misiones, sin premios, sin zonas y sin
  meta. Qué lleva cada catálogo es `D-14`, sigue sin resolver para Amigos, y
  para Hogar vive hoy en `src/lib/setup.js`, o sea en el cliente. Decidido así
  a propósito: inventarlo desde una migración sería decidir producto.
- **No hay tope de miembros.** `R-74` dice ocho humanos, y ese número vive en el
  cliente. Su sitio es `plantillas_tipo.limites`, que sigue vacío desde la 053.
  `invitar()` lee ese `jsonb` y, si no dice nada, no limita: escribir un 8 ahí
  sería repetir la constante repartida que la 050 y la 053 vinieron a retirar.
- **No toca los avisos.** Un aparato sigue teniendo una fila por `endpoint` con
  su `family_id`, así que con varios gremios solo recibiría de uno. Es el punto
  7 del inventario y **es una decisión de producto**, aplazada a la 6.3 con la
  pantalla delante.
- **No ofrece Amigos**, y no por falta de código: el `check` de
  `families.tipo_gremio` solo conoce `'familia'` y `'piso'`, que es lo que lee
  el cliente viejo. Ensanchar esa columna —o retirarla, el paso «contraer» que
  la 053 dejó anotado— es requisito para publicar Amigos.

### Cómo se comprobó

Respaldo (`respaldo-2026-08-30-210653`). `npm run verify`: **1449 tests en 80
ficheros**.

Y el ensayo de punta a punta, con dos identidades personales de mentira y todo
deshecho al terminar:

| | |
|---|---|
| forjar dos llaves | `ok` · `ok` |
| crear gremio con la 1 | `ok`, llave **consumida** |
| el gremio nuevo | `pais=ES`, `tipo=hogar`, `owner` es la **persona** |
| su personaje | **a cero**, y la pertenencia `titular` |
| crear en `FR` | `tipo_no_publicado_ahi` |
| crear de tipo `equipo` | `tipo_no_ofrecido` |
| **la llave 2, tras los dos fallos** | **sigue `disponible`** |
| titular sale estando sola | `eres_quien_titula` |
| invitar · invitar otra vez | `ok` · `ya_invitada` |
| bandeja de la invitada | 1 (con el correo en mayúsculas normalizado) |
| aceptar sin llave, siendo su primera | `ok` · `S-10` |
| abandonar | `ok`, personaje **retirado**, no borrado |
| reinvitar y volver | `ok` · **1 personaje, XP 250 conservada** |
| invitación vencida | `caducada`, y **ese intento cierra la fila** |

Después: 4 gremios, 0 invitaciones, 0 pertenencias, 0 llaves, ninguna cuenta de
ensayo y **cero descuadres**. Solo quedó lo que tenía que quedar: el índice de
`owner`, que ya no es único.

## 7bp. El gremio activo (30 de agosto) · 2.34.0 · sin migración

**La 6.2: el cliente.** Es la primera pieza de toda la Fase 6 que **se ve y se
despliega**, y la primera del día que toca `src/`. Sin migración: la base ya
estaba lista desde la 057.

### Lo que hacía la app, y por qué

`loadFamily()` cargaba **un** gremio con `limit 1` y se quedaba con el más
antiguo. No era un descuido: la 017 puso un índice único para que una cuenta no
pudiera tener dos, y el `order('created_at')` estaba puesto justo para que ese
`limit 1` fuera determinista. Ahora trae **todos** y abre el **activo**.

El matiz que hacía urgente el cambio: desde la 045 la RLS ya deja leer
`families` a quien **pertenece**, no solo a la cuenta dueña. Así que en cuanto
existiera la primera pertenencia en un segundo gremio, esa consulta ya devolvía
varias filas y se quedaba con la primera. El segundo gremio no es que se viera
mal: **era invisible**.

### Dos cosas se recuerdan por aparato

En qué gremio estabas (`gremio_activo`) y **qué personaje eres en cada uno**
(`gremio_perfil:<id>`). Van en `localStorage` y no en la base porque son
preferencias de un aparato (`C-2`), el mismo criterio que la Crónica y el muro.

La clave vieja era **una sola para todo**, `gremio_profile`, y la leían siete
sitios. Con dos gremios apunta a un personaje que no está en el activo, y cada
uno de los siete fallaba a su manera —unos con un `undefined` y los peores
cogiendo el primero de la lista—. Están los siete migrados, y hay un test que
comprueba que la clave global no reaparezca en ninguno.

**Y se rescata.** La primera vez que un gremio pregunta por su personaje, si no
tiene clave propia y existe la global, la adopta y la retira. Sin eso, desplegar
esto expulsaría a toda la familia de su personaje y les haría volver a
elegirlo. Que el rescate se lo lleve el primer gremio que pregunte no es un
problema, y conviene tener claro por qué: **el día del despliegue nadie tiene
dos gremios**. La 6.1 mantuvo esa invariante justo para que este momento fuera
seguro.

### Cambiar de gremio no arrastra nada

`C-6`. Se sueltan los datos, el personaje, el panel parental, la celebración
pendiente y **las dos referencias** —`ultimoVisto` e `historialSellos`—, que son
`useRef` y no se limpian solas al cambiar de estado: arrastrarían la marca de un
gremio al otro.

Y `C-4`, que la especificación llama «la trampa más probable de este flujo»: la
zona horaria y la temporada se recalculan porque `cambiarGremio` vuelve a llamar
a `loadFamily`, que vuelve a llamar a `configurarZona`. Sin eso, el día se
contaría en la zona del gremio anterior y **una racha viva se leería como
rota**.

### El selector solo aparece si hay a dónde ir

Con un gremio, la pantalla es la de siempre. Cada chip lleva el **tipo** debajo
del nombre (`C-5`): pasar de la casa al trabajo sin darse cuenta es el error de
uso más probable de esta funcionalidad. El nombre del tipo sale de
`plantilla_de_gremio()`, no de una lista escrita en el cliente, que es la regla
que la 053 dejó puesta; y es degradable, así que sin la RPC el chip sale solo
con el nombre del gremio.

### Cómo se comprobó

`npm run verify`: **1473 tests en 81 ficheros**. Y —que es la regla de la casa y
lo que de verdad valía— **con la pantalla delante**, en `dev:demo` sembrado con
dos gremios en zonas horarias distintas:

| | |
|---|---|
| entrar con la clave **vieja** puesta | va directo al personaje de siempre, sin preguntar |
| el selector | sale con los dos gremios, el activo marcado |
| cambiar a «El piso de Ana» | cambia el título y la lista de personajes |
| **recargar la página** | vuelve a El piso **y a Ana**: las dos claves funcionan juntas |
| lo del otro gremio | no se cuela nada: ni el saldo, ni la meta, ni los personajes |

Un susto que no lo era: en la captura leí «nivel 5» para un personaje de 420 XP,
que con la curva del proyecto son 3. Leyendo el DOM en vez del píxel, dice 3.
Cliente y `nivel_de_xp()` coinciden.

### Lo que NO hace

- **No hay pantalla para forjar, ni para invitar, ni para aceptar.** El servidor
  las tiene todas desde la 056 y la 057, y nadie las llama todavía. Eso es la
  6.3.
- **Cambiar de gremio pasa por «Cambiar»**, o sea por el selector de personaje,
  que al entrar suelta el del gremio que dejas. Un cambio de gremio directo
  desde el tablero es de la 6.3, cuando haya dónde ponerlo.
- **No toca los avisos.** Sigue siendo un aparato, un gremio.

---

## 7bq. Expandirse, y la identidad donde toca (30 de agosto) · 2.35.0 · sin migración

**La 6.3, primera parte.** La pantalla de expandirse, con la conversión a
identidad personal **dentro**. Sin migración: el servidor lo tenía todo desde
la 056.

### Por qué la conversión va aquí y no en su propia pantalla

Antes de escribir nada se vio esto: el cliente **no llamaba a ninguna** función
de identidad ni de expansión. Ni `forjar_llave`, ni `invitar`, ni
`solicitar_conversion`. Y las tres primeras exigen identidad personal, que nadie
tiene.

Empezar por la pantalla de forjar habría contestado `exige_identidad_personal`
al 100 % de la gente para siempre. La especificación ya lo había resuelto:
`F-4` paso 3 dice que la identidad se pide **justo ahí**, al ir a expandirse,
«no antes, no *por si acaso*» (`R-48`); y el plan de la Fase 2 dejó escrito que
la pantalla de conversión no se hacía entonces porque **su disparo llegaba en la
Fase 5**. Llegó.

Así que son dos pantallas en una: quien no tiene identidad no ve una lista de
escalones que no puede tocar, ve por qué le hace falta y cómo se crea.

### Lo que la conversión dice, y lo que calla

El texto no dice «regístrate». Dice qué se gana y —lo que de verdad se pregunta
alguien a quien le piden un correo por primera vez en esta app— **qué no
cambia**: la casa sigue entrando igual, el personaje es el mismo, y ni el nivel,
ni el historial, ni los Talis se pierden.

Y el orden de las dos llamadas importa: primero `solicitar_conversion` —que
comprueba el PIN y aparta el correo— y **después** `signUp`. Al revés, un PIN
mal tecleado dejaría una cuenta creada que después habría que limpiar.

### La frontera, escrita en un módulo aparte

`src/lib/expansion.js` traduce a frases lo que contesta el servidor, y no decide
nada: `SEC-1`, el cliente solo muestra. Dos tests lo atan a `schema.sql`:

- los **estados** de `oportunidades_expansion()` son los mismos y **en el mismo
  orden** —que es el orden de prioridad con el que el servidor decide qué decir
  primero, para que la pantalla no diga una cosa y el servidor otra—;
- **todos** los códigos de retorno de `forjar_llave()` y de
  `solicitar_conversion()` tienen frase. Si mañana el servidor devuelve uno
  nuevo y nadie se lo escribe, el test cae en vez de salir como «algo ha
  fallado».

### Dos fallos que cazaron las pruebas

- **`null ?? x` devuelve `x`.** La tabla de mensajes tiene `ok: null` a
  propósito —«no digas nada»—, así que con el operador cómodo el caso BUENO de
  forjar salía con el mensaje genérico de error. Se arregló con `in`.
- **Una clase de CSS inventada.** `btn-principal` no existe; `tests/estetica.js`
  la cazó. Las que hay son `btn`, `btn-bloque`, `btn-fantasma`, `btn-mini`,
  `btn-exito`, `btn-peligro` y `btn-icono`.

### Y lo de Supabase, que estaba hecho

El punto que este documento llevaba abierto desde el 25-ago —«dar de alta las
Redirect URLs»— **ya estaba**. Comprobado en el panel: Site URL
`https://elgremioapp.com/` y cuatro redirecciones, con la del dominio y la de
`www`. Se ha añadido `http://localhost:5177/**`, que es el puerto de
`.claude/launch.json` y faltaba: sin ella, probar la conversión en local por ese
puerto muere al volver del correo.

**Lo que sí queda abierto, y es de producto:** la plantilla «Confirm sign up»
dice *«Alguien ha creado un gremio familiar con este correo. Confírmalo y
podréis entrar todos»*. Eso es la copia de **fundar una casa**, y Supabase tiene
**una sola** plantilla de confirmación, así que la conversión la reutiliza: a
quien está creando **su** identidad se le diría «podréis entrar todos», que
sugiere justo lo contrario de lo que pasa. Hace falta un texto que valga para
los dos casos.

### Cómo se comprobó

`npm run verify`: **1488 tests en 82 ficheros**. Y en `dev:demo`, que es donde
se ve el caso real —la demo no implementa `clase_credencial`, así que cae del
lado de «sin identidad», exactamente como la familia de hoy—: el botón sale en
Progreso, el modal abre en la puerta de la conversión, los tres campos están con
sus etiquetas y el botón nace deshabilitado hasta que la validación pasa.

**Con una salvedad honesta:** el panel de capturas del navegador se quedó
sirviendo un fotograma viejo, así que lo de arriba está comprobado leyendo el
DOM —geometría, colores, textos y estados—, no mirando una imagen. Contraste
comprobado también por ahí: fondo `rgba(46,46,84,.78)` con texto
`rgb(234,234,244)`.

### Lo que falta de la 6.3

Invitar, la bandeja de invitaciones, crear un gremio con la llave, y salir y
echar. El servidor las tiene desde la 057 y **siguen sin llamarlas nadie**. Y
con ellas, la decisión de los avisos.


---

# CÓMO ARRANCAR LA SIGUIENTE SESIÓN

**Estado al cerrar el 30-ago-2026, por la noche.**

## Dónde está todo

| | |
|---|---|
| Repositorio | `~/el-gremio`, rama `main` |
| Versión desplegada | **2.34.0** · la **2.35.0 está construida y sin publicar** |
| Migraciones aplicadas | hasta la **057**. La siguiente libre es la **058** |
| Tests | 1488 en 82 ficheros |
| Plan y especificación | `~/Library/Mobile Documents/com~apple~CloudDocs/ClaudeCode/specs/` |

**Lo primero, siempre:** `git fetch` antes de elegir número de migración o de
versión. Hoy no ha hecho falta, pero el 30-ago por la mañana ya pasó una vez.

## Qué se hizo hoy, en una tabla

| Fase | Estado | Migraciones |
|---|---|---|
| 0 · Antes de tocar nada | ✅ cerrada (29-ago) | — |
| 1 · Terreno firme | ✅ cerrada | 041-043 |
| 2 · Identidad y pertenencia | ✅ **cerrada** | 044, 045, 047, 048, 049 |
| 3 · Configuración y cartera | ✅ **cerrada** | 050, 051, 052 |
| 4 · El tipo como plantilla | ✅ **cerrada** | 053, 054, 055 |
| 5 · Hitos y llaves | ✅ **cerrada** | 056 |
| 6 · Gremios múltiples | ◐ **6.1, 6.2 y media 6.3** · faltan invitaciones y avisos | 057 |
| 7 en adelante | ☐ sin empezar | — |

Y de propina, la **046**: el barrido de permisos que la 021 dejó escrito llevaba
desde agosto cerrando media puerta, porque quitaba `anon` pero no PUBLIC, del
que `anon` hereda.

## Por dónde seguir

**Mirar la 2.34.0 con una sesión real.** Está publicada y comprobada desde
fuera —`npm run health` dice `2.34.0 (5e5b65a)` y el sitio carga sin errores de
consola—, pero eso es todo lo que se puede comprobar desde aquí: el agente no
introduce contraseñas.

Y lo que hay que mirar es justo **que no ha cambiado nada**. El selector solo
sale con más de un gremio, y la familia tiene uno, así que la pantalla debe ser
idéntica a la de siempre y su personaje debe seguir elegido al entrar. Si eso
se cumple, el cambio de carga —que es el camino por el que pasa todo— está
dentro sin ruido.

Después, la **6.3 · las pantallas**. El servidor tiene desde la 056 y la 057
todo lo que hace falta y **nadie lo llama todavía**:

| Qué falta pintar | Con qué |
|---|---|
| Forjar una llave, y «cuánto te falta» | `oportunidades_expansion()` · `forjar_llave()` |
| Mis llaves | `mis_llaves()` |
| Invitar, y las invitaciones del gremio | `invitar()` · `invitaciones_del_gremio()` · `revocar_invitacion()` |
| La bandeja, que es **de la persona** y no del gremio activo | `mis_invitaciones()` · `aceptar_invitacion()` · `rechazar_invitacion()` |
| Crear un gremio con llave, con su tipo y su país | `tipos_ofrecidos()` · `crear_gremio_con_llave()` |
| Salir y echar | `abandonar_gremio()` · `expulsar_de_gremio()` |

Y con ella, **la decisión de los avisos** que quedó aplazada: hoy un aparato
solo puede estar suscrito a un gremio (`push_subs.endpoint` es único). O la
suscripción pasa a ser por `(aparato, gremio)`, o los avisos se dirigen a la
persona y el gremio pasa a ser un dato del mensaje. La segunda es más correcta y
toca la Edge Function.

Un detalle de uso que se ve en cuanto lo pruebas: **cambiar de gremio pasa hoy
por «Cambiar»**, o sea por el selector de personaje, que al entrar suelta el del
gremio que dejas. Funciona, pero el sitio natural de un cambio de gremio es el
tablero. Es de la 6.3, cuando haya dónde ponerlo.

## Lo que sigue abierto, y no es de ninguna fase

1. **Mirar la app con una sesión real.** Es lo único de las cuatro
   comprobaciones de `CLAUDE.md` que lleva todo el día sin hacerse: el agente no
   introduce contraseñas y el modo demo no toca RLS. Lo visible de hoy es el
   «te faltan N Talis» de la tienda.
2. **Supabase Auth · la plantilla de confirmación.** Las Redirect URLs **ya
   están** (comprobado el 30-ago; se añadió además `localhost:5177`). Lo que
   queda es la copia: «Confirm sign up» dice «Confírmalo y podréis entrar
   todos», que es el texto de fundar una casa, y la conversión a identidad
   personal reutiliza esa misma plantilla porque Supabase solo tiene una. Hace
   falta un texto que valga para los dos casos.
3. **El `truncate` para `authenticated`**, abierto desde la Fase 0.
4. **`zona_de_perfil`** es una función huérfana desde la 018: no la llama nadie.
5. **`CAP-12` vs `saldos_visibles()`**: hoy la casa ve el saldo de sus
   personajes, que es lo que sostiene `CNV-7`. En la **Fase 6**, cuando un
   gremio pueda tener personas que no viven juntas, **hay que volver ahí**.
6. **El PIN se comprueba en el cliente.** La matriz de capacidades ya dice
   cuándo hace falta; verificarlo en servidor es otra tanda.

## Tres trampas de hoy, para no repetirlas

- **`pg_proc.prosrc` guarda los comentarios.** Dos copias del esquema que solo
  difieren en un acento producen objetos distintos en la base, y comparar
  `md5(prosrc)` con el fichero —que es como se cazó que dos funciones llevaban
  semanas desviadas— deja de servir. **Dentro de `$fn$ … $fn$` mandan los
  ficheros `.sql` nuevos, sin acentos, y `schema.sql` copia ese cuerpo tal
  cual.**
- **Una migración registra lo que hizo ese día, no la versión vigente.** Cuando
  una posterior reescribe una función, la comparación «dos copias» se hace
  contra la última que la tocó. Editar una migración ya aplicada es lo que no se
  hace.
- **Los ensayos contra la base encontraron tres fallos que ningún test de los
  que leen el fichero habría visto**: un `CHECK` que impedía borrarse, una
  transferencia que solo anotaba una de sus dos patas, y un choque de clave de
  idempotencia. El patrón —un bloque que termina en `raise exception 'ENSAYO…'`
  y lo deshace todo— es lo más rentable de esta sesión.
