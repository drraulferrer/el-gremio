# El Gremio

> ¿Retomando el proyecto en una sesión nueva? Empieza por
> **[ARRANQUE-SESION.md](ARRANQUE-SESION.md)**: estado actual, decisiones
> tomadas, trampas conocidas y pendientes.

Webapp de misiones familiares con XP, niveles, monedas, premios reales,
insignias y una meta cooperativa. Cuatro perfiles, tres roles y una sola
cuenta para toda la casa. Sin ranking entre miembros: la única comparación
es la meta compartida del gremio.

Funciona en cualquier dispositivo con navegador y se instala como app desde
"Añadir a pantalla de inicio".

## Los tres roles

| Rol | Cómo lo vive |
|---|---|
| **Adulto** | Pide misiones, valida las de los demás, entra al panel con PIN. |
| **Junior** (11 años) | Pide sus misiones desde su móvil y espera el visto bueno. Canjea premios. |
| **Peque** (3 años) | **Pantalla propia**: seis botones enormes con dibujo, sin texto que leer. Toca uno y la estrella cae al momento, con animación y sonido. Para salir hay que mantener pulsado un segundo y medio, así que no se escapa sola. |

La estrella inmediata de la peque no es un atajo: a los tres años la
recompensa diferida no funciona. Un adulto puede darle la estrella también
desde el panel (pestaña Peque) cuando la tablet no está a mano.

## Miembros

De 1 a 8 perfiles, con el rol que haga falta y en cualquier combinación; lo
único obligatorio es que quede al menos una persona adulta, porque si no
nadie puede validar. Se gestionan en **Panel parental → ⚙️ → Miembros**:
alta, edición de nombre, rol, emoji y color, y baja.

La baja por defecto es **retirar**, no borrar: el perfil sale del selector
pero conserva su historial y la XP que aportó a las metas ya cerradas, y se
puede reincorporar cuando sea. Borrar de verdad solo se ofrece sobre quien
ya está retirado, exige escribir su nombre y avisa con números de cuántas
misiones, canjes e insignias se van a perder.

## Economía

- **XP**: nunca se gasta, marca el nivel. Nivel 2 a los 100 XP, nivel 3 a
  los 300, nivel 5 a los 1000. Subir de nivel dispara celebración.
- **Monedas**: se ganan junto a la XP y se gastan en la tienda de premios
  reales. Separarlas evita que canjear se sienta como perder progreso.
- **Meta del gremio**: la XP aprobada de todos suma hacia un objetivo común.
- **Validación**: lo de adultos y junior queda "pendiente" hasta que alguien
  lo valida. El modo peque salta ese paso.

---

# Puesta en marcha (unos 20 minutos)

## 1. Supabase (backend)

1. Crear cuenta y proyecto en [supabase.com](https://supabase.com), plan
   gratuito. Región: elegir la más cercana (`eu-west-3`, París, para España).
2. **SQL Editor** → pegar el contenido completo de `schema.sql` → *Run*.
   Crea tablas, RLS, funciones atómicas, realtime, logs, límite de ritmo y
   la función `health()`.
3. **Authentication → Sign In / Providers → Email**: activar el proveedor y
   **desactivar "Confirm email"** (si no, la primera cuenta se queda
   esperando un correo que nadie va a abrir).
4. **Project Settings → API**: copiar la *Project URL* y la clave
   *anon public*.

> Si ya tenías una versión anterior del esquema, ejecuta además
> `migracion-001-mensual.sql`, `migracion-002-produccion.sql` y
> `migracion-003-miembros.sql`. Si empiezas de cero, `schema.sql` ya lo
> incluye todo. Todas son idempotentes.

## 2. En local

```bash
cp .env.example .env    # pegar ahí la URL y la anon key
npm install
npm run dev
```

Abrir la URL local → "Primera vez: crear cuenta" → crear **una única cuenta
para toda la familia** (un email, una contraseña). El asistente pide nombre
del gremio, PIN parental y los cuatro miembros, y puede dejar el tablón ya
poblado: misiones por edad, cinco premios y una primera meta.

### Verla sin Supabase

```bash
npm run dev:demo
```

Arranca con un backend simulado en el propio navegador: sirve para trastear
con la interfaz sin crear nada. Los datos viven en `localStorage` y no salen
de ahí.

## 3. Publicar en GitHub Pages

El repositorio debe ser **público**: GitHub Pages en repos privados requiere
plan de pago. No es un problema de privacidad, porque en el código no hay
ni un dato familiar: los nombres se introducen en el asistente y viven en
Supabase, protegidos por RLS.

```bash
gh repo create el-gremio --public --source=. --remote=origin --push
npm run deploy
```

Después, en GitHub: **Settings → Pages → Source: Deploy from a branch →
rama `gh-pages`, carpeta `/ (root)`**.

Queda publicado en `https://TU-USUARIO.github.io/el-gremio/`.

Cada despliegue deja una etiqueta git, así que volver atrás son dos minutos:

```bash
npm run rollback -- --lista
npm run rollback -- deploy-2026-08-15-0930
```

> El despliegue va por rama y no por GitHub Actions porque el token de `gh`
> de esta máquina no tiene el scope `workflow`. Para pasar a CI/CD:
> `gh auth refresh -s workflow`. Ver `docs/RUNBOOK.md`.

## 4. En cada dispositivo

Abrir la URL, entrar con la cuenta familiar y elegir perfil. El dispositivo
recuerda la elección. En el menú del navegador: **"Añadir a pantalla de
inicio"** y queda instalada con su icono, a pantalla completa.

La tablet de la peque se queda en su perfil: al abrirla ve directamente sus
botones.

---

## Seguridad, en honesto

- Una sola cuenta de autenticación por familia. Las niñas no necesitan ni
  deben tener cuentas propias.
- Los datos quedan aislados por familia mediante Row Level Security en todas
  las tablas, incluidas las de logs y límite de ritmo.
- **El PIN parental no es seguridad criptográfica.** Es un hash SHA-256 en
  cliente: un cerrojo doméstico contra dedos curiosos dentro de la sesión
  familiar. Alguien con la sesión abierta y conocimientos técnicos se lo
  salta desde la consola. Para misiones y premios de casa sobra; no guardes
  aquí nada sensible.
- **La clave `anon` es pública por diseño** y viaja en el bundle. Lo que
  protege los datos es RLS, no ella. La que nunca sale del panel de Supabase
  es la `service_role`.
- Las funciones SQL (`resolve_completion`, `redeem_reward`,
  `resolve_redemption`) mueven los puntos de forma atómica: sin dobles
  abonos ni saldos negativos.
- Los logs nunca guardan email, contraseña, PIN ni tokens.

## Capa de producción

| Pieza | Dónde |
|---|---|
| Logs estructurados en JSON, con id de petición | `src/lib/log.js` → tabla `app_logs` |
| Monitorización de errores (Sentry listo, apagado) | `src/lib/monitoring.js` |
| Límite de ritmo por familia | Disparadores SQL sobre `rate_guard` |
| Health check | Función SQL `health()`, `npm run health`, Edge Function opcional |
| Despliegues versionados y rollback | `npm run deploy` / `npm run rollback` |
| Banderas para apagar funciones sin desplegar | `src/lib/flags.js` y Panel → ⚙️ |
| Rotación de credenciales cada 90 días | `npm run secrets:check` + `docs/ROTACION-SECRETOS.md` |

Todo eso está explicado, con sus límites, en **[docs/RUNBOOK.md](docs/RUNBOOK.md)**.

## Biblioteca de tareas de la casa

El panel incluye una Biblioteca (Misiones → 📚) con el catálogo doméstico
completo por roles: se elige a la persona, se marcan tareas y se activan con
valores por defecto según la edad, editables después. El catálogo no tiene
puntos; los puntos nacen al activar, y ahí vive la proporcionalidad entre
edades.

Consejo: mantened activas de 3 a 6 misiones por persona y rotad desde la
biblioteca. Un tablón con todo deja de ser un juego.

## Estructura

```
schema.sql              Esquema completo de Supabase, incluida la capa de producción
src/lib/supabase.js     Cliente, economía, insignias, plantillas, traducción de errores
src/lib/acciones.js     Acciones de dominio (pedir, validar, canjear) con registro
src/lib/miembros.js     Reglas de alta, edición y baja de perfiles
src/lib/tareas.js       Biblioteca de tareas de la casa por roles, sin puntos
src/lib/log.js          Registro estructurado en JSON con redacción de credenciales
src/lib/monitoring.js   Captura y agrupación de errores; adaptador de Sentry
src/lib/flags.js        Banderas de funcionalidad
src/lib/fakeBackend.js  Backend simulado del modo demo
src/screens/            Login, Onboarding, ProfilePicker, Home, KidHome,
                        ParentPanel, Ajustes (Miembros + Estado)
src/components/         Gema, barra de XP, modal, PIN, celebración, ErrorBoundary
scripts/                deploy, rollback, health-check, secrets-check
supabase/functions/     Edge Function de health (opcional)
docs/                   RUNBOOK y rotación de credenciales
tests/                  Economía, frecuencias, miembros y observabilidad (vitest)
SPEC.md                 Especificación, fuente de verdad para iterar
```

## Comandos

```bash
npm run dev            # desarrollo
npm run dev:demo       # desarrollo con backend simulado, sin Supabase
npm test               # tests (40)
npm run build          # compilación de producción
npm run verify         # tests + build + revisión de credenciales
npm run health         # ¿responden la web publicada y Supabase?
npm run deploy         # publicar en GitHub Pages
npm run rollback       # volver a una versión anterior
```
