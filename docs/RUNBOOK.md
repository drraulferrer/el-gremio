# Runbook · El Gremio

Qué hacer cuando algo va mal, y cómo está montada la capa de producción.
Escrito para leerse a las tres de la mañana, que es cuando hace falta.

---

## 0. Arquitectura, en cuatro líneas

| Pieza | Dónde vive | Qué pasa si cae |
|---|---|---|
| Frontend (React + Vite) | GitHub Pages, rama `gh-pages` | Nadie entra. Los datos siguen intactos. |
| Backend (Postgres + Auth + Realtime) | Supabase, plan gratuito | La app carga pero no muestra nada. |
| Logs y métricas | Tabla `app_logs` en el mismo Supabase | Se pierde la traza, la app sigue. |
| Health check | Función SQL `health()` + Edge Function opcional | Solo afecta a la vigilancia. |

No hay servidor propio. Todo lo que en una arquitectura clásica viviría en
el backend (límite de ritmo, health, retención de logs) está en Postgres,
que es el único sitio que no se puede saltar desde la consola del navegador.

---

## 1. Diagnóstico rápido

```bash
npm run health
```

Comprueba las dos cosas que caen por separado: la web publicada y Supabase.
Sale con código 1 si algo falla, así que sirve para un cron o un monitor.

Dentro de la app: **Panel parental → ⚙️** muestra versión desplegada, salud
del backend, banderas activas y los últimos errores registrados.

| Síntoma | Causa más probable | Acción |
|---|---|---|
| Pantalla "Falta configurar Supabase" | `.env` sin rellenar o build sin variables | Revisar `.env`, recompilar |
| "Sin conexión con el gremio" | Supabase pausado o red caída | Ver panel de Supabase (proyectos gratuitos se pausan tras 7 días sin uso) |
| "Demasiadas acciones seguidas" | Límite de ritmo | Es correcto. Esperar una hora o subir el límite (§4) |
| "Esta sesión no tiene permiso" | Sesión caducada o RLS | Cerrar sesión y volver a entrar |
| Las validaciones no llegan solas | Realtime desconectado | Recargar; comprobar que las tablas están en la publicación `supabase_realtime` |
| El fondo tintinea o parpadea | Coste de composición en ese aparato | ⚙️ → Estado → apagar `luzEnMovimiento`; si sigue, `luzAmbiental`. Son por dispositivo y no requieren desplegar |
| Pantalla en blanco | Error de render | El `ErrorBoundary` muestra "El gremio ha tropezado" con la versión; mirar `app_logs` |

---

## 2. Logs estructurados

Cada línea es un JSON con `ts`, `nivel`, `evento`, `sesion_id`, `request_id`,
`family_id`, `profile_id` y `release`. El `request_id` es lo que permite
seguir una acción concreta de punta a punta.

- **En el navegador**: siempre, en la consola.
- **En Supabase**: solo `warn` y `error` (los informativos se descartan salvo
  que se active la bandera `logsInfo`).

Nunca se registran email, contraseña, PIN ni tokens: la función `redactar`
los sustituye por `[redactado]` aunque alguien los pase por descuido. Hay
tests que lo comprueban (`tests/observabilidad.test.js`).

Consultar los últimos errores:

```sql
select ts, evento, request_id, datos
from app_logs
where nivel = 'error'
order by ts desc
limit 50;
```

Retención: 30 días. La tabla no se limpia sola, hay que ejecutarlo:

```sql
select purge_logs(30);
```

Con el plan gratuito de Supabase (500 MB) esto sobra de largo para cuatro
personas, pero conviene correrlo cada pocos meses.

---

## 3. Monitorización de errores

`src/lib/monitoring.js` captura los errores no atrapados y las promesas
rechazadas, los agrupa por huella (ignorando UUIDs y números, para que el
mismo fallo con distintos ids cuente como uno) y lleva la frecuencia.

El proveedor externo está **preparado y apagado**.

### 3b. El buzón de fallos: lo que cuenta la familia

Desde la 2.14.0 hay un camino que antes no existía: `informes_fallo`
(migración 033). Lo que ve el usuario es «Algo va mal · contarlo» en el
selector de perfiles, y «Contar qué estabas haciendo» en la pantalla de
tropiezo. Lo que llega es el texto MÁS las huellas que `monitoring.js`
tenía en memoria en ese momento: eso es lo que convierte «no va» en algo
diagnosticable.

Leerlo es una consulta, y conviene hacerla cada pocos días:

```sql
select created_at, texto, pantalla, version_app, huellas
  from public.informes_fallo
 where estado = 'nuevo'
 order by created_at desc;
```

Y al arreglar uno, tacharlo para que la lista no crezca sin fin:

```sql
update public.informes_fallo set estado = 'arreglado' where id = '…';
```

No hay aviso de que ha entrado uno: nadie mira este buzón desde la app, y
suscribirlo por realtime sería pagar por algo que nadie escucha. Se mira
a mano, como el `salud_diaria` de abajo.

**¿Hace falta encenderlo? A la escala de hoy, no.** `salud_diaria`
(migración 023) ya da el recuento diario de errores de TODAS las familias
—corre como `security definer`, así que no la para el RLS— y `app_logs`
guarda el detalle 30 días. Con eso se responde «¿hubo errores y cuáles?»
sin ningún tercero. Sentry gana sentido cuando haya familias suficientes
para necesitar **avisos en el momento** en vez de mirar una tabla una vez
al día, y trazas des-minificadas. Antes de eso, añade superficie y una
dependencia externa sin cerrar un hueco real.

**Dos cosas hay que hacer ANTES de tocar código, y las dos faltaban en
esta receta:**

- **Ampliar la CSP, o Sentry no envía nada.** El `connect-src` de
  `index.html` solo deja salir hacia Supabase, Google Fonts y Cloudflare.
  El host de ingest de Sentry (`https://*.ingest.sentry.io`, o el
  específico de tu región/self-hosted) **no está**, así que sin tocarlo
  `Sentry.init` carga, no da error, y cada evento muere contra la CSP:
  cero eventos creyendo que funciona. Añadir a `connect-src` el host
  exacto que te dé Sentry al crear el proyecto.
- **Decisión legal, que aquí no es un trámite.** Esto guarda nombres y
  actividad diaria de menores. Enviar telemetría de error a un tercero es
  tratamiento de datos: hace falta DPA con Sentry, mención en la política
  de privacidad y **scrubbing de PII** (usar región EU y `beforeSend`
  para tirar cualquier dato de la familia). Ver §8 del arranque.

Cuando esté decidido:

1. Crear cuenta y proyecto en sentry.io (gratis hasta 5.000 eventos/mes).
   Elegir **región EU** si se procesan datos de menores.
2. `npm install @sentry/browser`.
3. Añadir el host de ingest a `connect-src` en `index.html`.
4. Poner `VITE_SENTRY_DSN=...` en `.env`. El DSN es público, va en el bundle.
5. En `src/main.jsx`, antes de renderizar:

```js
import * as Sentry from '@sentry/browser'
import { setProveedor } from './lib/monitoring'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: RELEASE,
  sendDefaultPii: false,
  // Sin esto, Sentry manda breadcrumbs, URLs y contexto que pueden
  // llevar datos de la familia. Recortar a lo mínimo diagnosticable.
  beforeSend: (evento) => {
    delete evento.user
    delete evento.request
    return evento
  }
})
setProveedor({ captureException: (e, ctx) => Sentry.captureException(e, { extra: ctx }) })
```

Para que las trazas no lleguen minificadas hay que subir los source maps
(el build ya los emite): `@sentry/vite-plugin` con un auth token, o dar la
monitorización por buena sabiendo que la línea será la del bundle.

Sin DSN no se carga la librería ni sale un byte hacia terceros. El
adaptador (`src/lib/monitoring.js`) está escrito para que enchufarlo sea
solo el `setProveedor` de arriba: no hay que tocar la captura, que ya está
instalada y probada.

---

## 3c. Actividad global (para quien mantiene la app)

`salud_diaria` (§3b la roza, migración 023) lleva cuentas, gremios,
altas, misiones validadas y errores por día, pero solo se puede leer
desde el SQL Editor. La migración 040 abre una vía desde la propia
interfaz sin meter analítica de terceros: `legal/privacidad.html` §2
promete que no la hay, y familias con menores ya aceptaron ese texto.

**Darte de alta como operador (una vez, en el SQL Editor de Supabase):**

```sql
select id, created_at from auth.users order by created_at;  -- busca el tuyo
insert into public.operadores values ('<tu-uuid-de-ahí>');
```

Con eso, Panel → ⚙️ aparece con una pestaña nueva, **📈 Actividad**, con
los últimos 30 días. Para cualquier otra cuenta la pestaña ni se pinta:
`actividad_reciente()` es `security definer` pero devuelve cero filas si
`auth.uid()` no está en `operadores`, así que no hay nada que ocultar, ni
family_id, ni nombres — `salud_diaria` tampoco los guarda.

Para quitarte: `delete from public.operadores where user_id = '<uuid>'`.

---

## 3d. Actividad externa (PostHog)

A diferencia de Sentry (§3), esto SÍ está activado — decisión tomada el
26-ago tras descartar primero el wizard `self-driving` (edita código sin
supervisión y activa grabación de sesión por defecto) y reescribir antes
`legal/privacidad.html` §2 y §5 con lo que de verdad ocurre.

**Qué manda:** dos eventos, `mision_validada` y `premio_canjeado`, sin
propiedades, identificados solo por el id del gremio (`family.id`, el
mismo que ya usa Supabase). Nada de nombres, texto libre, ni grabación de
pantalla — ver `src/lib/actividadExterna.js` para el porqué de cada opción
del `init`.

**Salvaguardas por partida doble.** El código las fuerza
(`disable_session_recording`, `autocapture: false`,
`advanced_disable_decide`…), y ADEMÁS se apagaron a mano en el panel de
PostHog (Session replay, Autocapture, Web vitals, Capture console logs) y
se confirmó «Discard client IP data» activo. Las dos hacen falta: un
cambio futuro en el panel de PostHog no debe poder reactivar nada de esto
por su cuenta, y el código tampoco debe depender de que nadie recuerde la
configuración del panel.

**Activarlo en un clon nuevo:** `VITE_POSTHOG_KEY` (Project Settings →
Project API Key, es pública por diseño) y `VITE_POSTHOG_HOST` — región
**EU**, no la que ofrezca por defecto. Sin la clave no se carga la
librería ni sale nada, igual que Sentry.

**Ampliar la CSP, o PostHog no envía nada.** `connect-src` necesita
`https://eu.i.posthog.com` exacto — sin comodín, porque `*.posthog.com`
colaría también `app.posthog.com`. En dos sitios: la meta etiqueta de
`index.html` y la cabecera de `vercel.json`. Los dos, siempre, o Vercel
sirve una CSP distinta a la del código fuente.

**Re-consentimiento.** Cambiar `legal/privacidad.html` de forma relevante
exige subir `VERSION_LEGAL` en `src/lib/legal.js` (y la fecha visible de
los DOS documentos — `tests/legal.test.js` lo comprueba) y las familias ya
registradas ven `ReconsentimientoLegal` la próxima vez que abran el panel
parental con PIN, nunca antes: es la única puerta que ya demostró que hay
una persona adulta delante, y así ninguna criatura puede aceptar nada por
accidente. El resto de la app sigue funcionando igual mientras tanto.

**Vercel:** las variables de arriba hay que darlas de alta también en el
panel de Vercel (Settings → Environment Variables) para que el build de
producción las vea — `.env` es solo local.

---

## 4. Límite de ritmo

Vive en la base de datos, en disparadores `before insert` que llaman a
`rate_guard`. Los valores por familia y hora:

| Tabla | Máximo/hora | Por qué ese número |
|---|---|---|
| `completions` | 120 | Cuatro personas no hacen 120 misiones al día. Cubre el dedo atascado de la peque. |
| `redemptions` | 30 | Canjear es un acto raro y deliberado. |
| `challenges` | 300 | La Biblioteca activa decenas de golpe. |
| `app_logs` | 600 | Un bucle de errores no debe llenar la tabla. |

Cambiar un límite: editar el disparador correspondiente en `schema.sql` y
volver a ejecutar solo esa función `create or replace`.

**Login, alta y recuperación de contraseña no se limitan aquí**: los limita
Supabase Auth. Se ajustan en el panel, en *Authentication → Rate Limits*.
Por defecto son razonables; con una sola cuenta familiar no hay que tocarlos.

Ver quién está tocando el límite:

```sql
select bucket, window_start, count
from rate_limits
order by window_start desc
limit 20;
```

---

## 5. Health check

Tres niveles, de menos a más independiente:

1. **Dentro de la app**: Panel parental → ⚙️ llama a la función SQL `health()`.
2. **Desde la línea de órdenes**: `npm run health` (web + backend).
3. **Desde fuera, sin credenciales**: Edge Function opcional.

Desplegar la Edge Function (requiere la CLI de Supabase):

```bash
supabase login
supabase link --project-ref chfbrawsoulfiywiqhpe
supabase functions deploy health --no-verify-jwt
```

**La CLI ya está instalada en este Mac** (v2.115.0, en
`~/.local/bin/supabase`, que va primero en el PATH). **No se instaló con
Homebrew porque aquí no hay Homebrew**: se bajó el binario oficial del
release de `supabase/cli` y se comprobó su SHA-256 contra el
`checksums.txt` del propio release antes de instalarlo. Para actualizarla,
el mismo camino:

```bash
V=$(curl -s https://api.github.com/repos/supabase/cli/releases/latest | grep -o '"tag_name": *"v[^"]*"' | cut -d'"' -f4 | tr -d v)
curl -sL "https://github.com/supabase/cli/releases/download/v$V/supabase_${V}_darwin_arm64.tar.gz" -o /tmp/sb.tar.gz
curl -sL "https://github.com/supabase/cli/releases/download/v$V/checksums.txt" -o /tmp/sb-sums.txt
grep "supabase_${V}_darwin_arm64.tar.gz" /tmp/sb-sums.txt | awk '{print $1"  /tmp/sb.tar.gz"}' | shasum -a 256 -c -
tar -xzf /tmp/sb.tar.gz -C /tmp && install -m 755 /tmp/supabase ~/.local/bin/supabase
```

**`supabase login` hay que ejecutarlo en una terminal de verdad.** El
flujo automático se niega en entornos sin TTY —que es donde corre el
agente— y contesta `LegacyLoginMissingTokenError`. La alternativa es
`--token`, pero eso obliga a pasear un token de acceso por el
portapapeles y por el historial del shell: mejor hacer el login una vez a
mano y que la credencial se quede donde tiene que estar.

Queda en `https://TU-REF.functions.supabase.co/health`, devuelve 200 si la
base responde y 503 si no. Eso es lo que hay que apuntar en un monitor
externo (UptimeRobot, Better Stack) si se quiere aviso automático.

**Sin esto la app funciona igual.** Es vigilancia, no dependencia.

---

## 6. Despliegue y rollback

```bash
npm run deploy                          # compila y publica en gh-pages
npm run rollback -- --lista             # ver versiones disponibles
npm run rollback -- deploy-2026-08-15-0930
```

Cada despliegue deja una etiqueta git y un `version.json` en la raíz
publicada, así que siempre se puede saber qué versión está sirviendo:

```bash
curl -s https://elgremioapp.com/version.json
```

El modelo es **solo hacia delante**: un rollback compila el código de una
referencia anterior y lo publica como un commit nuevo. No se reescribe
historia, así que si el rollback tampoco va bien se vuelve igual de rápido.

Tarda entre uno y dos minutos, casi todo esperando a que GitHub Pages
propague. Nada de esto toca la base de datos: **un rollback de frontend no
deshace una migración de esquema**. Si el problema es de esquema, hay que
revertirlo a mano en el SQL Editor.

### Rollback selectivo, sin desplegar

Si lo que falla es una función concreta, se apaga su bandera desde
**Panel parental → ⚙️ → Banderas** (afecta solo a ese dispositivo) o para
todos con una variable de entorno y un despliegue:

```
VITE_FLAG_MODO_PEQUE=0
```

### Cuando GitHub Actions esté disponible

El token de `gh` de esta máquina no tiene el scope `workflow`, así que el
despliegue va por rama. Para pasar a CI/CD:

```bash
gh auth refresh -s workflow
```

y montar un workflow que ejecute `npm ci && npm test && npm run build` y
publique con `actions/deploy-pages`. Los scripts actuales seguirán
funcionando como salida de emergencia.

---

## 6b. Convención de migraciones (importante)

**Cada cambio de esquema se escribe DOS veces**, y las dos son obligatorias:

1. En `schema.sql`, en su sitio dentro de la tabla o sección que toque.
   Ese fichero es la fuente de verdad completa: quien clone el repo y lo
   ejecute entero debe obtener una base idéntica a la de producción.
2. En un fichero `migracion-00N-<tema>.sql` aparte, idempotente, para las
   bases que ya existen y no se pueden recrear.

Si solo se escribe la migración, un proyecto limpio nace roto. Si solo se
escribe en `schema.sql`, la base de producción se queda atrás. Las dos.

Migraciones hasta hoy:

| Fichero | Qué añade | ¿En schema.sql? |
|---|---|---|
| `migracion-001-mensual.sql` | Frecuencia `mensual` en `challenges` | Sí |
| `migracion-002-produccion.sql` | `app_logs`, `rate_limits`, `rate_guard`, `health()` | Sí |
| `migracion-003-miembros.sql` | `profiles.active` e índice | Sí |
| `migracion-004-habilidades.sql` | `challenges.skill`, `rewards.tier`, `completions.praise`, `resolve_completion` con elogio | Sí |
| `migracion-005-funcion-duplicada.sql` | Retira la sobrecarga que dejó la 004 en bases ya existentes | No aplica (base nueva solo crea una) |
| `migracion-006-deshacer.sql` | `undo_completion`: deshace una misión y devuelve XP y Talis | Sí |
| `migracion-007-genero.sql` | `profiles.gender` y reescritura de los títulos que concuerdan | Sí |

**Trampa de las funciones**: `create or replace function` no sustituye una
función si cambia su firma (número o nombre de argumentos): crea una
**sobrecarga**. Con dos versiones vivas, PostgREST devuelve `PGRST203` y
la llamada deja de funcionar. Toda migración que cambie la firma de una
función debe hacer `drop function if exists ...(firma vieja);` antes del
`create or replace`. Pasó de verdad con `resolve_completion` en la 004 y
tumbó la estrella inmediata de la peque.

Comprobación rápida de que la convención se ha respetado:

```bash
grep -c "active boolean" schema.sql   # profiles, challenges y rewards → 3
```

## 7. Rotación de credenciales

Ver [ROTACION-SECRETOS.md](ROTACION-SECRETOS.md). Resumen: cada 90 días,
comprobable con `npm run secrets:check`.

---

## 7b. Copias de seguridad

Ver [RESPALDOS.md](RESPALDOS.md). Resumen: `npm run respaldo` vuelca, cifra con
AES-256 y **vuelve a abrir** la copia para comprobarla; el cron lo dispara a
diario y deja el registro en `~/el-gremio-respaldos/respaldo.log`. Para
restaurar, `npm run restaurar -- --ultimo --a <ref>`.

Este apartado no existía hasta el 23-ago-2026, y su ausencia era el hallazgo
GR-01 de la auditoría: el runbook cubría casi todo menos qué hacer cuando lo que
falla son los datos.

---

## 8. Incidentes conocidos y sus límites

- **Proyecto Supabase pausado.** El plan gratuito pausa proyectos tras 7 días
  sin actividad. Se reactiva a mano desde el panel y tarda un par de minutos.
  Es el fallo más probable de todos y no tiene arreglo automático.
- **El PIN parental no es seguridad.** Es un hash SHA-256 en cliente. Frena
  dedos curiosos dentro de la sesión familiar, no a alguien con la consola
  abierta. No guardar aquí nada sensible.
- **La clave anon es pública.** Va en el bundle por diseño. Lo que protege
  los datos es RLS. La que nunca sale del panel es la `service_role`.
- **Sin modo offline.** Sin red, la app no funciona. Está en el backlog.
- **Los logs se envían por lotes cada 5 segundos.** Un cierre brusco de la
  pestaña puede perder los últimos (hay vaciado en `pagehide`, pero no es
  garantía).
