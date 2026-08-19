# El modo limpieza

Campañas de limpieza como misión secundaria: una «operación» acotada en
el tiempo que un adulto lanza desde el panel, con las tareas repartidas
entre quienes participan. Añadido en la 2.9.0 (19-ago-2026) a partir de
un planificador doméstico real que aportó la familia; el catálogo
adaptado vive en `src/lib/limpieza.js`.

## Qué es y qué no es

Es una **campaña**: empieza, dura 1, 3 o 7 días, y termina. No toca el
patrón semanal ni el plan diario, no cuenta en la carga de la economía
(sus misiones son únicas, que pesan 0 en `cargaDe`) y no deja rastro
permanente en el tablón: es el acontecimiento, no la rutina.

No es un segundo sistema de puntos. Las tareas son filas de
`challenges` normales (`frequency 'unico'`, `skill 'hogar'`,
`campana_id`): se piden desde el tablero, se validan con elogio en el
panel, la peque recibe su estrella al momento, y XP y Talis los abona
`resolve_completion` como siempre. Lo único nuevo es el agrupador
(`campanas_limpieza`) y el botín de cierre.

## Los tres formatos

Del planificador, adaptados a esta casa:

| Formato | Qué es | Dura |
|---|---|---|
| `blitz` — Limpieza relámpago | Un rato corto todos a la vez: 15, 30, 60 o 90 min (catálogo fijo) | hoy |
| `zona` — Zona de la semana | Una zona de VUESTRA casa, con su plantilla de tareas | 7 días |
| `profunda` — Limpieza profunda | Una zona de vuestra casa, a fondo | 3 días |

## Las zonas de la casa (2.11.0)

Desde la 2.11.0 las campañas de zona y profunda limpian el mapa de CADA
casa (`zonas_casa`, migración 032; lógica y plantillas en
`src/lib/zonas.js`). Cada zona = nombre de esta casa + una PLANTILLA
(cocina, baño, dormitorio, salón, entrada, lavadero, juegos, exterior o
genérica) con dos listas de tareas: `semanal` y `fondo`. Se siembran en
el setup con la pregunta de la vivienda y se editan en ⚙️ → Casa.

Decisiones que sostienen esto:

- **Las plantas no se modelan**: solo ponen nombre («Baño de arriba»).
- **Sin zonas guardadas, nada se rompe**: `zonasDeLaCasa` cae a las de
  siempre (virtuales) y ⚙️ → Casa las adopta con un botón.
- **Modo compañeros de piso** (`families.tipo_gremio = 'piso'`): todo el
  mundo es adulto, cada conviviente tiene SU habitación (zona privada
  con `dueno`) y las campañas sobre ella se le sugieren enteras. El
  dueño ES el tipo: con dueño, privada; sin dueño, común.
- **Los roles aptos son un suelo, no un club** (`tareaApta` con
  jerarquía): una tarea «de peque» la hace cualquiera con más años; lo
  de adultos sigue cerrado hacia abajo.

Cada tarea lleva **roles aptos** —lo que implica químicos, horno,
altura o cuchillas es solo de personas adultas, el criterio de «Casa a
fondo»— y **esfuerzo** (`rapida` 5-10 min · `media` 15-25 · `intensa`
30+), del que salen los puntos y el reloj. La peque tiene tareas de
verdad en casi todas las campañas: a los tres años participar es el
premio.

## La economía, y la promesa que la sostiene

**El modo limpieza es la mayor fuente proporcional de Talis del
sistema, a propósito.** Los multiplicadores van sobre `DEFAULTS_ROL`:

| Esfuerzo | XP | Talis | Reloj |
|---|---|---|---|
| rapida | ×1 | ×2 | 10 min |
| media | ×1,5 | ×3 | 25 min |
| intensa | ×2 | ×4 | 40 min |

La XP se queda cerca de la de una misión normal (tope ×2) porque marca
el nivel y alimenta la meta, y las dos están calculadas contra un ritmo:
inflarla convertiría la limpieza en la vía rápida de nivel. Los Talis sí
se disparan, porque son reconocimiento puro y aquí está el trabajo más
grande de la casa. `tests/limpieza.test.js` fija la promesa (más Talis
por XP y más Talis absolutos que cualquier misión normal) y el techo (el
peor caso de una campaña entera con botín ≤ 300 Talis: un pico del orden
de una semana de juego, no de un mes).

**El botín**: si la operación se completa entera antes de vencer, cada
participante recibe `floor(susTalisGanados / 2)` por `bonuses` con tipo
`limpieza:<id de campaña>` (el patrón de `racha:N`, que esquiva el
índice de «uno al día»). Sin XP, la regla del premio a mano. Es
cooperativo a posta: o se termina TODO o no hay botín para nadie, igual
que la meta del gremio. La cuenta vive dos veces —`botinPrevisto` en el
cliente y `cerrar_campana_limpieza` en Postgres— y si se toca un
redondeo hay que tocar los dos.

## Las reglas que viven en la base (migración 031)

- **Solo un adulto lanza y cierra.** Cliente para el mensaje
  (`puedeLanzarCampana`), Postgres para mandar: el mismo doble check que
  `grant_manual_bonus`.
- **Una operación activa por gremio, con respaldo físico**: el índice
  único parcial `idx_campanas_una_activa` (family_id where estado =
  'activa'), porque dos aparatos lanzando a la vez pasan los dos el
  `not exists`. La función captura la `unique_violation` y responde
  'ya_hay_activa'.
- **Deshacer respeta el botín**: `undo_completion` rechaza con
  'campana_cerrada' una tarea de una operación COMPLETADA — su botín ya
  se repartió contándola. Activas y expiradas se deshacen como siempre.
- **El doble cierre concurrente responde 'ya_cerrada'**, no un error
  crudo: el índice de «uno al día» de `bonuses` tumba al segundo y su
  transacción entera se revierte; el modal refresca también al fallar
  para pasar a contar la verdad.
- **Campaña y misiones nacen en la misma transacción**
  (`crear_campana_limpieza`), como la voz de mando: en dos llamadas, un
  fallo de red deja una campaña vacía.
- **El desenlace lo decide la base** (`cerrar_campana_limpieza`): botín
  solo si todo está aprobado; vencida sin completar → se pausan las
  tareas sin hacer y no hay botín; en plazo → no toca nada. La pantalla
  que dibuja el progreso no certifica nada, como en `claim_streak`.
- Topes de cordura por tarea (xp ≤ 60, Talis ≤ 40) y de campañas por
  gremio (60), contra el dedo gordo.

## El reloj (`src/lib/temporizador.js`)

«Usa un temporizador para dividir tareas en bloques manejables», dice el
planificador. Cada tarjeta de operación en el tablero lleva «▶ Empezar ·
N min»; el reloj cuenta atrás lo que su esfuerzo pide y al llegar a cero
dice «¡Tiempo!» sin bloquear nada.

- Se guarda el **instante de inicio** en localStorage, no un contador:
  sobrevive a recargas y a la pestaña en segundo plano (la lección de
  `mantenerPulsado.js`). El intervalo de un segundo solo repinta.
- Es **cosmética de aparato**: no hay tabla ni migración, como la
  fiesta del día completo. Caduca a las 24 h y se purga solo.
- El esfuerzo de una misión guardada se recupera **por título** desde el
  catálogo (`esfuerzoDeMision`); un título editado a mano cae a `media`.
- **La pantalla de la peque no lleva reloj**, deliberadamente: su
  interacción es un toque y sus tareas son rápidas; un temporizador ahí
  rompería la regla de esa pantalla (nada que la saque de su sitio).

## Personalizar (2.10.0)

El catálogo es un punto de partida, no un contrato: en el paso del
reparto, el lápiz de cada tarea abre un editor (`EditorDeTarea`) con el
nombre, el esfuerzo y el dibujo, y «+ Añadir una tarea de esta casa»
crea tareas propias (`nuevaTareaPropia`), que nacen para cualquiera y
no viajan hasta tener un nombre válido (`tituloDeTareaValido`, el mismo
3-120 de la RPC). Dos límites deliberados:

- **Los roles aptos no se editan**: renombrar «Limpiar el horno» no lo
  vuelve apto para la junior. La seguridad no se rebautiza.
- **Los puntos no se teclean**: salen del esfuerzo y del rol. El
  esfuerzo es la palanca honesta para «esta tarea aquí es más gorda», y
  arrastra el reloj.

Personalizar rompía la vía «esfuerzo por título» del reloj, así que
`esfuerzoDeMision(reto, rol)` tiene ahora una segunda vía: los PUNTOS
guardados (xp = base_del_rol × {1 · 1,5 · 2}, se toma el multiplicador
más cercano). El título del catálogo sigue mandando cuando existe.

## Dónde se ve

- **Panel → Misiones**: botón «🧹 Modo limpieza» (dice si hay operación
  en marcha). El asistente: formato → campaña → participantes y reparto
  (sugerido por `repartoSugerido`, equilibrado por minutos y
  determinista; cada tarea editable, con la asignación embebida en la
  propia tarea) → qué adulto responde → lanzar.
- **Tablero de adultos y junior**: bloque propio encima de las misiones,
  con tinte teal (`carta-operacion`), días restantes, Talis visibles (al
  revés que las misiones normales: pagar más es lo que ofrece) y reloj.
- **Pantalla de la peque**: su tarea sale como una baldosa más.
- **Panel**: las tarjetas de la operación van teñidas en Validar, Hecho
  hoy, la lista de Misiones («🧹 Operación · 15-25 min») y las pausadas.
  En el Cuadro, el botín sale como «(N de botín)» junto a lo a mano.
- **Cierre**: desde el modal del modo limpieza, cuando todo está
  validado («🎉 Repartir el botín») o cuando venció («Recoger la
  campaña»). Es un botón y no un automatismo por lo mismo que la subida
  de precios de temporada: repartir el botín es un acontecimiento.

## Trampas que ya salieron

- **La confirmación del cierre debe vivir en el modal, no en la vista de
  la campaña**: cerrar refresca, con el refresco la campaña deja de
  estar activa y la vista se desmonta antes de enseñar nada. Pasó en la
  primera verificación; el estado `cierre` de `ModoLimpieza.jsx` existe
  por esto.
- **`schema.sql` no puede decir «Talis»**: `tests/talis.test.js` vigila
  la frontera funcional/narrativo. En SQL se escribe «monedas».
- La bandera `modoLimpieza` apaga botón y bloque, pero **no** esconde
  las tareas ya lanzadas: quedan como únicas normales. Apagarla no le
  quita a nadie trabajo ya encargado.
