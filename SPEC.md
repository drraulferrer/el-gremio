# SPEC · El Gremio

Especificación de la webapp de gamificación familiar. Este documento es la fuente de verdad para iterar el proyecto (formato compatible con un bucle SPEC → BUILD → REVIEW).

## 1. Contexto y decisiones cerradas

- Cuatro miembros de partida: dos adultos, una junior (11 años) y una peque (3 años). Desde agosto de 2026 el número es configurable (de 1 a 8) y los roles se pueden combinar como haga falta; la única invariante es que quede **al menos una persona adulta activa**, porque si no nadie puede validar.
- Las bajas son **retiradas**, no borrados: un perfil inactivo sale del selector pero conserva historial e insignias, y la XP que aportó sigue contando en las metas ya cerradas. El borrado real existe, pero solo sobre perfiles ya retirados, con confirmación por nombre y aviso numérico de lo que se pierde.
- La app vive en el dispositivo de cada miembro: webapp desplegada (Vite + React + Supabase + Vercel), instalable como PWA ligera.
- Los padres validan cada reto completado. Excepción deliberada: el rol peque recibe la estrella al momento porque a los 3 años la recompensa diferida no funciona.
- La peque **sí opera la app**, en una pantalla propia adaptada a su edad (revisión de agosto de 2026; la versión anterior de esta especificación decía que solo la manejaban los adultos). El panel parental conserva su pestaña Peque como vía alternativa cuando la tablet no está a mano.
- Sin ranking entre miembros. La única estructura comparativa es cooperativa: la meta del gremio.
- Recompensas dobles: progresión virtual (XP, niveles, insignias) más catálogo de premios reales canjeables con monedas.
- Se gamifica la fricción (hábitos y tareas que cuestan), no las actividades ya placenteras, para no minar la motivación intrínseca.
- Una única cuenta de autenticación familiar; perfiles internos estilo consola; panel parental protegido por PIN.

## 2. Economía

- La XP nunca se gasta; solo sube. Determina el nivel.
- Curva de nivel: `xpAcumulada(nivel) = 50 · nivel · (nivel − 1)`. Nivel 2: 100 XP; nivel 3: 300; nivel 4: 600; nivel 5: 1000.
- Las monedas se ganan junto a la XP y se gastan en la tienda. Separar ambas evita que canjear se sienta como perder progreso.
- La proporcionalidad entre edades se regula en los valores de XP y monedas de cada misión, no en curvas distintas por persona.
- Frecuencias de misión: `diario` (una vez por día natural), `semanal` (una vez por semana ISO), `mensual` (una vez por mes natural), `unico` (una sola vez). Limitación conocida: las tareas trimestrales o anuales se modelan como `unico` y se reactivan a mano.
- Un rechazo no consume la frecuencia: la misión vuelve a estar disponible.

## 3. Roles

| Rol | Flujo |
|---|---|
| adulto | Pide misiones, espera validación del otro adulto (o la propia; modelo de confianza). Accede al panel con PIN. |
| junior | Pide misiones desde su dispositivo y espera el visto bueno. Canjea premios. |
| peque | Pantalla propia (`KidHome`): rejilla de botones enormes con dibujo, sin navegación ni texto imprescindible. Al tocar uno: alta + aprobación inmediata, celebración y sonido. Salir exige mantener pulsado 1,5 s. Un adulto puede hacer lo mismo desde la pestaña Peque del panel. |

## 4. Modelo de datos (Supabase, ver schema.sql)

- `families(id, owner → auth.users, name, parent_pin_hash)`
- `profiles(id, family_id, name, role, emoji, color, xp, coins, active)` — `active = false` es una retirada (migración 003). El código trata la ausencia de la columna como activo, así que una base sin migrar sigue funcionando.
- `challenges(id, family_id, profile_id nullable = todos, title, emoji, xp, coins, frequency, active)`
- `completions(id, family_id, challenge_id, profile_id, status pendiente|aprobado|rechazado, xp, coins, requested_at, resolved_at)` — xp y coins son copia del reto en el momento de pedirlo.
- `rewards(id, family_id, title, emoji, cost, active)`
- `redemptions(id, family_id, reward_id, profile_id, cost, status pendiente|entregado|cancelado)`
- `family_goals(id, family_id, title, emoji, target_xp, achieved, starts_at, achieved_at)` — una activa a la vez.
- `profile_badges(id, family_id, profile_id, code, earned_at)` con unique(profile_id, code).

RLS en todas las tablas: `family_id ∈ familias del auth.uid()`. Funciones `security invoker`:

- `resolve_completion(c_id, 'aprobado'|'rechazado')`: cierra la pendiente y, si aprueba, abona XP y monedas de forma atómica.
- `redeem_reward(rw_id, p_id) → 'ok'|'sin_monedas'|'no_disponible'`: descuenta monedas y crea el canje.
- `resolve_redemption(r_id, 'entregado'|'cancelado')`: al cancelar devuelve las monedas.

## 4b. Biblioteca de tareas de la casa

`src/lib/tareas.js` contiene el catálogo doméstico completo aportado por la familia, agrupado por zonas (dormitorios, salón, cocina y mesa, colada, baño, plantas y terraza, y un bloque "a fondo" exclusivo de personas adultas por riesgo, químicos o altura).

Principios del catálogo:

- Sin puntos: el catálogo solo declara título, emoji, roles aptos y frecuencia sugerida. Está desacoplado de la economía.
- Una tarea existe una sola vez y puede ser apta para varios roles (`roles: ['junior','adulto']`); no se duplica en el catálogo.
- La instanciación sí es por perfil: al activar una tarea desde la Biblioteca del panel parental se crea un `challenge` asignado a esa persona con valores propios de XP y monedas. Ahí vive la proporcionalidad por edades, así que dos perfiles pueden tener la misma tarea con recompensas distintas.
- Defaults al activar (`DEFAULTS_ROL`, editables misión a misión): peque 10/5, junior 15/8, adulto 10/5. A quien más le cuesta, más XP; los adultos puntúan bajo en tareas triviales para no inflar la meta cooperativa.
- La Biblioteca marca como "ya activa" cualquier tarea cuyo título coincida con una misión activa del perfil, para evitar duplicados reales.
- Los matices de seguridad del texto original (con supervisión, productos seguros, sin objetos peligrosos, acompañada) se conservan en los títulos; en el rol peque la supervisión queda además garantizada por diseño, porque sus misiones las opera un adulto.

## 5. Insignias

Automáticas (se evalúan en cliente tras cada carga y se insertan con upsert idempotente): primera misión, 10, 25 y 50 aprobadas, nivel 5, nivel 10, primer canje. Manual: `gremio`, otorgada a todos los perfiles al cerrar una meta familiar.

## 6. Pantallas

1. **Login**: cuenta familiar única, alta y entrada.
2. **Onboarding**: nombre del gremio → PIN parental (mínimo 4 dígitos, hash SHA-256 en cliente) → miembros con rol, emoji y color → plantillas de misiones por edad opcionales.
3. **ProfilePicker**: rejilla de perfiles, recuerda la elección por dispositivo (localStorage).
4. **Home** (por miembro): carnet con gema de nivel, barra de XP y monedas; estandarte de la meta del gremio; pestañas Misiones, Tienda, Insignias. Celebración animada al recibir validación (vía realtime) y al subir de nivel.
5. **KidHome** (rol peque): cabecera con su avatar y las estrellas de hoy, rejilla de misiones a dos columnas con botones de 165 px de alto, botón de silencio y salida por pulsación mantenida. Paleta propia (papel crema, colores saturados, bordes gruesos) deliberadamente distinta del tablero nocturno: no busca combinar, busca que reconozca su sitio.
6. **ParentPanel** (tras PIN): Validar (misiones y canjes en un toque), Peque (estrella inmediata), Misiones (CRUD + plantillas + pausar), Premios (CRUD + pausar), Meta (crear, editar, cerrar con insignia para todos).
7. **Ajustes** (⚙️ en la cabecera del panel, con control segmentado): **Miembros** (alta, edición, retirada, reincorporación y borrado con confirmación) y **Estado** (versión desplegada, salud del backend, banderas, últimos errores, antigüedad de la rotación de credenciales). Van aquí y no en la barra de pestañas porque con seis pestañas los rótulos dejan de caber en un móvil.

## 7. Diseño

Tema "tablero nocturno": fondo índigo `#1e2140`, cartas `#292d55`, oro `#f5b841`/`#ffd166` para monedas y acciones, colores de gema por miembro (coral, turquesa, violeta, sol). Tipografías: Fredoka (display) + Nunito (cuerpo). Firma visual: gema facetada con el nivel dentro (clip-path) y barra de XP con pips de rombo. Una sola pieza de movimiento orquestada: la celebración de estrellas. `prefers-reduced-motion` respetado. Objetivos táctiles de 48 px o más.

## 8. Riesgo principal y contramedidas

El riesgo del producto no es técnico sino motivacional: el decaimiento de la novedad hacia la semana 3 o 4. Contramedidas ya integradas: validación en un toque para que el coste parental sea mínimo, meta cooperativa renovable, premios reales, plantillas para rotar misiones sin esfuerzo. Contramedidas pendientes en el backlog: rotación programada y resumen semanal.

## 9. Backlog v2 (por orden de valor estimado)

1. Rachas con "protector de racha" (un fallo perdonado por semana) para la junior.
2. Resumen semanal del gremio: XP total, misiones, gráfico simple, enviado o mostrado el domingo.
3. Rotación mensual de misiones sugerida desde la biblioteca (recordatorio de cambiar el subconjunto activo).
4. Foto opcional como evidencia al pedir una misión.
5. Notificaciones push (requiere service worker) para "tienes una validación pendiente".
6. Modo offline básico con cola de peticiones.
7. Exportación CSV del historial.
8. Sonidos de celebración opcionales.
9. Ajuste estacional de dificultad (vacaciones frente a curso escolar).

## 9b. Capa de producción

Añadida en agosto de 2026. La restricción de partida es que no hay servidor
propio: el frontend es estático en GitHub Pages y el backend es Supabase.
Todo lo que en una arquitectura clásica viviría en el servidor se ha llevado
a Postgres, que es el único punto que no se puede saltar desde la consola
del navegador.

| Requisito | Solución | Límite conocido |
|---|---|---|
| Logs estructurados | JSON con `ts`, `nivel`, `evento`, `sesion_id`, `request_id`, `family_id`, `profile_id`, `release`; consola siempre, tabla `app_logs` para warn y error | Envío por lotes cada 5 s: un cierre brusco puede perder los últimos |
| Monitorización de errores | `window.onerror`, `unhandledrejection` y `ErrorBoundary`, con agrupación por huella y frecuencia | El proveedor externo (Sentry) queda listo pero apagado; sin DSN no sale nada hacia terceros |
| Límite de ritmo | Disparadores `before insert` sobre `rate_guard`, por familia y ventana horaria | Login y alta los limita Supabase Auth, no esto |
| Health check | Función SQL `health()`, `scripts/health-check.mjs` y Edge Function opcional | La Edge Function necesita la CLI de Supabase; la app no depende de ella |
| Plan de rollback | Despliegues etiquetados, `version.json` publicado, `npm run rollback` en menos de 2 min, más banderas para apagar funciones sin desplegar | Un rollback de frontend no deshace una migración de esquema |
| Rotación de secretos | Calendario de 90 días, `npm run secrets:check`, `docs/ROTACION-SECRETOS.md` | Solo la contraseña de la cuenta familiar obliga a volver a entrar en todos los dispositivos |

Redacción obligatoria: email, contraseña, PIN y tokens nunca llegan al
registro, ni siquiera si alguien los pasa por descuido (`redactar`, con
tests que lo comprueban).

## 10. Criterios de aceptación de la v1

- Una familia nueva pasa de cero a operativa en menos de 15 minutos siguiendo el README.
- Una misión pedida en el dispositivo de la junior aparece en el panel parental y, al validarla, la celebración llega a su dispositivo sin recargar.
- Un canje descuenta monedas, queda pendiente de entrega y una cancelación las devuelve.
- La estrella del modo peque abona puntos al momento y respeta la frecuencia diaria.
- Cerrar una meta otorga la insignia 🏰 a los cuatro perfiles.
- La peque abre su perfil, toca un dibujo y ve la estrella sin ayuda; no consigue salir de su pantalla con un toque suelto.
- Un error de red o de permisos se ve en pantalla con un mensaje en castellano y queda registrado con su id de petición.
- `npm run health` distingue "la web está caída" de "Supabase está caído".
