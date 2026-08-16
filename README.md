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
| **Peque** (3 años) | **Pantalla propia**: seis botones enormes con dibujo, sin texto que leer. Toca uno y la estrella cae al momento, con animación y sonido. Tiene su **tarro de estrellas**, que no se vacía de un día para otro, y su propia tienda de premios sin cifras. Para salir hay que mantener pulsado un segundo y medio, así que no se escapa sola. |

La estrella inmediata de la peque no es un atajo: a los tres años la
recompensa diferida no funciona. Un adulto puede darle la estrella también
desde el panel (pestaña Peque) cuando la tablet no está a mano.

## Miembros y cómo les habla la app

De 1 a 8 perfiles, con el rol que haga falta y en cualquier combinación; lo
único obligatorio es que quede al menos una persona adulta, porque si no
nadie puede validar.

Cada perfil elige **cómo se dirige a él la app**: femenino, masculino o sin
especificar. El castellano marca género en participios y adjetivos, y la app
habla de tú ("lo has hecho tú sola"), así que sin ese dato solo caben dos
salidas malas: hablarle a todo el mundo en masculino, o llenar la pantalla
de arrobas y barras que no se pueden leer en voz alta —y aquí hay una
criatura de tres años a la que le leen la pantalla—.

La opción **sin especificar** no es un tercer sexo: significa que no se ha
dicho, y hace que la app use textos **reescritos** para que no haga falta
marca ninguna. Es el valor por defecto, así que es el que más se lee:

```
femenino    Vestirse sola        · Veterana
masculino   Vestirse solo        · Veterano
sin decir   Vestirse sin ayuda   · Veteranía
``` Se gestionan en **Panel parental → ⚙️ → Miembros**:
alta, edición de nombre, rol, emoji y color, y baja.

La baja por defecto es **retirar**, no borrar: el perfil sale del selector
pero conserva su historial y la XP que aportó a las metas ya cerradas, y se
puede reincorporar cuando sea. Borrar de verdad solo se ofrece sobre quien
ya está retirado, exige escribir su nombre y avisa con números de cuántas
misiones, canjes e insignias se van a perder.

## No es una lista de tareas

Es un sistema de **habilidades**, no de recompensas por trabajo. Cada
misión entrena una de ocho competencias —🏡 Hogar, 💪 Salud, 📚 Aprendizaje,
❤️ Amabilidad, 🌱 Responsabilidad, 🤝 Cooperación, 🎨 Creatividad,
🧠 Autonomía— y el carnet muestra cuáles llevas más entrenadas.

La diferencia no es de redacción. Un sistema de "tarea hecha, moneda
cobrada" funciona unas semanas y después se apaga. El objetivo deja de ser
*hacer la cama* y pasa a ser *volverse más autónoma*.

**El elogio específico es la pieza central.** Al validar, la app propone
frases que nombran la acción concreta —"Has conseguido hacer la cama sin
que nadie te lo recordara"— y **tocar la frase valida la misión**: cuesta
lo mismo que un botón mudo y dice algo. El elogio genérico pierde efecto
por repetición; el que nombra lo que hizo, no.

**Todo se puede deshacer.** Un toque equivocado no obliga a entrar en la
base de datos: en la pantalla de la peque se mantiene pulsada la baldosa
1,5 s, en el panel hay una sección "Hecho hoy" con un botón por cada
misión, y quien pide una misión por error puede cancelarla. Deshacer
devuelve la XP y las monedas.

**Las monedas son un andamio**, no el motor: están para arrancar una
costumbre que aún no existe y se retiran cuando el hábito se sostiene solo.
Por eso el catálogo de premios prioriza los que son decisiones (elegir la
peli, la música del coche, el menú del viernes) sobre los que son cosas, y
deja fuera dinero, chucherías y pantallas.

Todo esto está razonado, con sus referencias, en
**[docs/FUNDAMENTO-CIENTIFICO.md](docs/FUNDAMENTO-CIENTIFICO.md)** y dentro
de la app en ⚙️ → Evidencia. La primera vez que se abre, un tutorial de seis
pasos lo explica.

## Economía

- **XP**: nunca se gasta, marca el nivel. Nivel 2 a los 100 XP, nivel 3 a
  los 300, nivel 5 a los 1000. Subir de nivel dispara celebración.
- **Monedas**: se ganan junto a la XP y se gastan en la tienda de premios
  reales. Separarlas evita que canjear se sienta como perder progreso.
- **Meta del gremio**: la XP aprobada de todos suma hacia un objetivo común.
- **Equilibrio**: los precios no están puestos a ojo. `src/lib/economia.js`
  declara cuánto se gana al día y cada cuánto debería caer cada nivel de
  premio (2 / 7 / 30 días) y de ahí salen las bandas. El panel ⚙️ → Estado
  enseña el diagnóstico con las misiones activas de verdad, por si el
  tablón crece y la economía se dispara sin que nadie lo note.
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
> las migraciones `migracion-001` … `migracion-007` en orden. Si empiezas
> de cero, `schema.sql` ya lo incluye todo. Todas son idempotentes.

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

Dentro de la app, en **Panel parental → ⚙️ → 📱 Dispositivos**, hay un **QR
con la dirección** y las instrucciones de instalación por plataforma: se
abre en el portátil y se apunta con el móvil o el iPad. La URL se calcula
sola, así que sigue siendo correcta si algún día el gremio se mueve a un
dominio propio.

Para el mundo de papel:

```bash
npm run qr     # genera docs/qr-el-gremio.svg y una tarjeta A5 imprimible
```

Después: entrar con la cuenta familiar, elegir perfil, y en el menú del
navegador **"Añadir a pantalla de inicio"** (en iPhone y iPad tiene que ser
Safari; Chrome en iOS no ofrece la opción). Queda instalada con su icono, a
pantalla completa.

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
  aquí nada sensible. Se cambia en **⚙️ → 🔑 PIN**.
- **La clave `anon` es pública por diseño** y viaja en el bundle. Lo que
  protege los datos es RLS, no ella. La que nunca sale del panel de Supabase
  es la `service_role`.
- Las funciones SQL (`resolve_completion`, `redeem_reward`,
  `resolve_redemption`) mueven los puntos de forma atómica: sin dobles
  abonos ni saldos negativos.
- Los logs nunca guardan email, contraseña, PIN ni tokens.

## Diseño

Tema "tablero nocturno" con **cristal líquido** traducido a la web:
translucidez con desenfoque del fondo, luz especular en el borde superior
y color ambiental por detrás para que el material tenga algo que
refractar. El desenfoque real se reserva a las piezas que flotan (barra,
hojas, cabeceras); las listas usan el mismo aspecto sin `backdrop-filter`
para no gastar cuadros de animación en el móvil.

La pantalla de la peque no lleva cristal en sus baldosas a propósito: ahí
hace falta color plano y máximo contraste, no transparencia.

Respeta `prefers-reduced-transparency` (superficies opacas) y
`prefers-reduced-motion` (sin deriva de la luz ambiental).

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

## Biblioteca de misiones

El panel incluye una Biblioteca (Misiones → 📚) con el catálogo completo por
edad, agrupado por habilidad: autocuidado, orden, ayuda en casa, cabeza y
manos, movimiento y trato con los demás para la peque; autocuidado, hogar,
aprendizaje, salud y crecer por dentro para la junior; salud, hogar, familia,
profesional, personal y casa a fondo para los adultos.

El catálogo no tiene puntos; los puntos nacen al activar la misión para una
persona, y ahí vive la proporcionalidad entre edades.

Consejo: mantened activas de 3 a 6 misiones por persona y rotad desde la
biblioteca. Un tablón con todo deja de ser un juego.

## Estructura

```
schema.sql              Esquema completo de Supabase, incluida la capa de producción
src/lib/supabase.js     Cliente, economía, insignias, plantillas, traducción de errores
src/lib/acciones.js     Acciones de dominio (pedir, validar, canjear) con registro
src/lib/habilidades.js  Las 8 competencias y el progreso por habilidad
src/lib/elogio.js       Sugerencias de elogio específico y rachas
src/lib/premios.js      Catálogo de recompensas por nivel y lista de evitar
src/lib/evidencia.js    Principios y referencias del sistema
src/lib/genero.js       Concordancia de género con tres formas por frase
src/lib/mantenerPulsado.js  Gesto de pulsación mantenida (salir, deshacer)
src/lib/economia.js     Equilibrio: supuestos, precios y diagnóstico en vivo
src/lib/miembros.js     Reglas de alta, edición y baja de perfiles
src/lib/pin.js          Reglas del PIN parental
src/lib/tareas.js       Biblioteca de tareas de la casa por roles, sin puntos
src/lib/log.js          Registro estructurado en JSON con redacción de credenciales
src/lib/monitoring.js   Captura y agrupación de errores; adaptador de Sentry
src/lib/flags.js        Banderas de funcionalidad
src/lib/fakeBackend.js  Backend simulado del modo demo
src/screens/            Login, Onboarding, Tutorial, ProfilePicker, Home, KidHome,
                        ParentPanel, Ajustes (Miembros · PIN · Dispositivos ·
                        Evidencia · Estado)
src/components/         Gema, barra de XP, modal, PIN, celebración, ErrorBoundary
scripts/                deploy, rollback, health-check, secrets-check, qr
supabase/functions/     Edge Function de health (opcional)
docs/                   RUNBOOK y rotación de credenciales
tests/                  Economía, frecuencias, miembros, PIN, habilidades,
                        elogio y observabilidad (vitest)
SPEC.md                 Especificación, fuente de verdad para iterar
```

## Comandos

```bash
npm run dev            # desarrollo
npm run dev:demo       # desarrollo con backend simulado, sin Supabase
npm test               # tests (441)
npm run build          # compilación de producción
npm run verify         # tests + build + revisión de credenciales
npm run health         # ¿responden la web publicada y Supabase?
npm run prueba:concurrencia  # ¿aguantan las funciones dos toques a la vez?
npm run qr             # QR imprimible con la dirección del gremio
npm run deploy         # publicar en GitHub Pages
npm run rollback       # volver a una versión anterior
```

## Licencia

**AGPL-3.0** (ver `LICENSE`). En corto: puedes usarlo, copiarlo y
desplegarlo; si lo ofreces como servicio a otras personas, tienes que
publicar tus cambios.

Se eligió esta y no una permisiva por lo que le pasó a OurHome, que fue
la referencia gratuita del sector hasta que sus responsables apagaron el
servidor con los datos de las familias dentro. Aquí el trato es el
contrario: el gremio vive en **tu** base de datos, la app deja
descargártelo entero (⚙️ → Datos) y el código no se puede cerrar. Si este
proyecto se para, tu gremio no.
