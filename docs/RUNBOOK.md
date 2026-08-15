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

El proveedor externo está **preparado y apagado**. Para activar Sentry:

1. Crear cuenta y proyecto en sentry.io (gratis hasta 5.000 eventos/mes).
2. `npm install @sentry/browser`
3. Poner `VITE_SENTRY_DSN=...` en `.env`. El DSN es público, va en el bundle.
4. En `src/main.jsx`, antes de renderizar:

```js
import * as Sentry from '@sentry/browser'
import { setProveedor } from './lib/monitoring'

Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, release: RELEASE })
setProveedor({ captureException: (e, ctx) => Sentry.captureException(e, { extra: ctx }) })
```

Sin DSN no se carga la librería ni sale un byte hacia terceros.

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
brew install supabase/tap/supabase
supabase login
supabase link --project-ref TU-REF
supabase functions deploy health --no-verify-jwt
```

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
curl -s https://TU-USUARIO.github.io/el-gremio/version.json
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
| `migracion-006-deshacer.sql` | `undo_completion`: deshace una misión y devuelve XP y monedas | Sí |
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
