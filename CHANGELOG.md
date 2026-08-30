# Cambios

Qué versión trae qué. Sirve para dos cosas concretas: saber qué está
corriendo un dispositivo cuando algo falla —`app_logs.release` guarda la
versión de cada línea— y decidir a qué volver con `npm run rollback`.

## Cuándo sube cada número

| | cuándo | ejemplo |
|---|---|---|
| **MAYOR** | una migración deja al cliente viejo roto: el rollback de frontend ya no es seguro por sí solo | `target_role` → `target_roles`, que un cliente anterior lee como «para todos» |
| **MENOR** | algo nuevo que la familia ve y usa | los minijuegos, el historial semanal, el premio a mano |
| **PARCHE** | arreglos y ajustes que no cambian lo que se puede hacer | los globos de 7 s a 18 s |

Semver clásico habla de romper una API pública. Aquí no hay consumidores
externos, así que lo que se traduce como «ruptura» es lo único que de
verdad duele en esta app: que el esquema y el cliente dejen de encajar.

---

## 2.33.3 · 30 de agosto de 2026

**El doble clic deja de cobrar dos veces.** Hasta hoy, pulsar dos veces
«canjear» o «premio a mano» descontaba o regalaba dos veces: el `for update`
de Postgres serializa las dos peticiones, que no es lo mismo que evitarlas.
Ahora cada intento lleva una clave derivada de lo que se pretende hacer, y el
servidor guarda un asiento por clave: si la clave ya existe, devuelve el
resultado de la primera sin volver a mover nada.

La clave se deriva de la intención y no es un identificador nuevo por
llamada, porque para reconocer un doble clic **las dos peticiones tienen que
llevar la misma**. Lleva una ventana de diez segundos, con su pega escrita en
el código: dos intentos idénticos dentro de esos diez segundos se consideran
el mismo, así que un canje repetido a propósito muy seguido devuelve `ok` sin
cobrar. Se arregla esperando un momento.

Detrás van tres migraciones, ya aplicadas:

- **041** · `redeem_reward` comprobaba el premio y el perfil por separado
  pero no que fueran de la misma casa. Hoy no lo puede provocar nadie —el
  RLS solo deja ver un gremio— pero esa garantía es del borde, y el borde va
  a cambiar con los gremios múltiples.
- **042** · el libro de las monedas: cada movimiento deja un asiento con
  saldo antes, saldo después, motivo y resultado. Había libro de altas
  (`bonuses`) pero no de bajas, así que un saldo no se podía reconstruir.
- **043** · el libro lo escribe un **disparador**, no cada función a mano.
  Llamarlo desde las ocho funciones que mueven monedas es una costumbre;
  esto es una garantía: si alguien añade la novena y olvida declarar su
  motivo, el asiento sale como `desconocido` en vez de no salir.

Y una limpieza que venía de la misma revisión: `retratos.js` tenía su propia
copia de la curva de nivel, con el comentario «misma curva que supabase.js»
en las dos. Ahora hay una sola, con un test que ata la fase del retrato a
ella.

## 2.33.2 · 27 de agosto de 2026

**Limpieza de código sin cambio de comportamiento.** Un repaso con
`npm run muertos`, un grafo de imports y un detector de bloques
repetidos. Lo que salió y lo que se hizo:

- **Diez imports que nadie usaba**, fuera: `MONEDAS_POR_ESTRELLA` en
  `juego.js`; `useRef`, `levelProgress`, `FREQ_LABEL` y `talis` en
  `Home.jsx`; y cinco más en tests (`precioObjetivo`,
  `insigniaPorCodigo`, `planDeperfil` + `rachaActual`,
  `habilidadesElegidas`). Todos los símbolos siguen vivos donde sí se
  usan; solo cayó la referencia muerta.
- **El efecto de foco de los diálogos, copiado tres veces**, ahora es un
  hook (`src/lib/dialogo.js`, `useFocoDialogo`): entra el foco al abrir,
  Escape cierra, y el foco vuelve al salir. Lo usaban calcados
  `LoteDeSellos`, `SelloDetalle` y `TalisAMano`; una copia de una regla
  es una regla que se desincroniza. Comprobado en el navegador con los
  tres diálogos: foco dentro al abrir, Escape cierra, y en el detalle de
  sello el foco vuelve exactamente al botón que lo abrió.
- Lo que el detector señala y **se queda a propósito**: la clase B son
  modelos escritos por delante de la interfaz (temporadas, poderes) y la
  clase C es ruido tolerado, como ya dice §7c del arranque. Ni ficheros
  huérfanos, ni banderas apagadas, ni dependencias sin usar: el grafo
  salió limpio.
- **Sin migración.**

## 2.33.1 · 26 de agosto de 2026

**El panel de Actividad, con gráficos.** Enseñaba los 30 días en texto
plano; ahora hay una línea de tendencia (SVG a mano, sin librería nueva)
para gremios activos, misiones validadas, altas y errores, además del
resumen de hoy y el detalle por día que ya había. El dashboard de
PostHog también suma una tercera tarjeta, "Actividad total por semana"
(`mision_validada + premio_canjeado`, agrupado por semana): con dos
eventos nada más, semanal se lee mejor que diario.

- Nuevo `src/lib/grafico.js` (`puntosDeLinea`), con tests.
- **Sin migración.**

## 2.33.0 · 26 de agosto de 2026

**PostHog, pero solo dos contadores.** El encargo era instalar el wizard
`self-driving` de PostHog. Antes de tocar nada: eso crea una cuenta de
terceros, edita el código sin supervisión y activa grabación de sesión y
captura de clics por defecto — justo lo que `legal/privacidad.html`
prometía que no pasaría. Se reescribió la política primero (§2 y §5,
versión 2026-08-26) y se montó a mano, con salvaguardas por partida
doble: en el código (`src/lib/actividadExterna.js`) y en el panel de
PostHog (grabación, autocaptura, web vitals y logs de consola apagados a
mano; IP ya descartada por defecto).

Lo único que sale de la app: `mision_validada` y `premio_canjeado`, sin
propiedades, identificados por el id del gremio — nunca por persona, ni
con el contenido de nada.

- **Re-consentimiento**: quien ya tenía cuenta ve una pantalla nueva al
  entrar al panel parental (con PIN, nunca antes) pidiendo aceptar la
  política actualizada. El resto de la app sigue igual mientras tanto.
- **CSP ampliada** en `index.html` y `vercel.json`: `eu.i.posthog.com`,
  exacto y sin comodín.
- Variables nuevas (`VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`) — hace falta
  darlas de alta también en Vercel antes de publicar. RUNBOOK §3d.
- **Sin migración.**

## 2.32.1 · 25 de agosto de 2026

**Actividad global, sin analítica de terceros.** La idea de partida era
montar PostHog para ver cómo se usa la app. `legal/privacidad.html` §2 lo
impide sin matices —«ni herramientas de analítica o seguimiento de ningún
tipo»—, y familias con menores ya aceptaron ese texto: cambiarlo es una
decisión legal, no una casilla. Igual que se decidió con Sentry
(RUNBOOK §3), se queda en casa.

`salud_diaria` (migración 023) ya llevaba el recuento diario, pero solo
se podía leer desde el SQL Editor. La migración 040 añade
`public.operadores` (vacía, RLS sin políticas, se rellena a mano) y dos
funciones `security definer`: `es_operador()` y `actividad_reciente()`,
que devuelve la tabla completa a quien está en esa lista y **cero filas**
a cualquier otra cuenta. Nuevo panel → ⚙️ → 📈 Actividad, que ni se pinta
si la respuesta es que no. Sin variables de entorno nuevas, sin bytes
saliendo de Supabase.

- Cómo darte de alta como operador: RUNBOOK §3c.
- **Migración 040**, ejecutada.

## 2.32.0 · 25 de agosto de 2026

**Cómo ponerla en la pantalla de inicio, explicado con dibujos.** Las
instrucciones existían, pero en texto y detrás del PIN, en Panel → ⚙️ →
Dispositivos. Ahí no llega quien las necesita: quien instala está en el
aparato NUEVO, acaba de escanear el QR y muchas veces no tiene el PIN.

Ahora hay un enlace discreto en la pantalla de acceso, «📲 Ponerla en la
pantalla de inicio», que abre una guía con el móvil dibujado, el icono
real de cada sistema y los pasos numerados. Va dibujado y no capturado
porque una captura envejece con cada versión de iOS y haría falta una por
idioma.

- **Detecta el aparato** y enseña solo lo suyo. En Panel → Dispositivos
  enseña los dos, porque ahí un adulto mira SU móvil para explicárselo a
  quien tiene otro.
- **En Android ofrece instalar de un toque** si el navegador lo permite
  (`beforeinstallprompt`). iOS no tiene ese evento y no lo va a tener, así
  que ahí los pasos a mano no son el plan B: son el único plan.
- **Desaparece si ya está instalada**, mirando `display-mode` y también
  el `navigator.standalone` de Safari, que va por su cuenta.
- Es un enlace y no un cartel que salte solo. Un cartel sería un anuncio,
  y quien usa la app en el navegador a propósito no tiene por qué verlo
  cada vez.

## 2.31.0 · 24 de agosto de 2026

**Entrar con Google.** El proveedor quedó configurado en Supabase, así que
se enciende el botón que ya viajaba apagado en la 2.30.0.

Debajo lleva un aviso que no es decorativo: **usa la cuenta de Google del
mismo correo del gremio**. Supabase enlaza identidades solo si el correo
coincide y está verificado; con otra distinta se crea una cuenta nueva y
vacía, y la 017 impide que una cuenta tenga dos gremios, así que limpiarlo
después es entrar en la base a mano. Con el enlace por correo eso lo
bloquea `shouldCreateUser: false`; en OAuth no hay equivalente y lo único
que queda es decirlo antes.

La bandera `google` sigue existiendo: si algún día caducan las
credenciales, apagarla quita el botón sin revertir nada más.

## 2.30.0 · 24 de agosto de 2026

**Cerrar sesión**, que no existía: lo único que llamaba a `signOut` era el
borrado de la cuenta. Está en Panel → ⚙️ → Datos, detrás del PIN y con dos
toques. No va en el selector de perfiles a propósito: la cuenta es una
sola para toda la casa, así que cerrarla echa a todos, y ahí lo tendrían a
un dedo la junior y la peque. Cambiar de perfil sigue siendo otra cosa.

**Entrar con un enlace por correo**, sin contraseña. Se pide desde la
pantalla de acceso y llega por el SMTP que ya estaba montado.

Dos decisiones que van dentro:

- Se pide con **`shouldCreateUser: false`**. Por defecto Supabase crea la
  cuenta si el correo no existe, y aquí eso sería un desastre callado: una
  letra mal y quien entra se encuentra «Fundad vuestro gremio» con todo
  vacío. La 017 impide que una cuenta tenga dos gremios, así que tampoco
  se arreglaría después.
- Cuando no hay cuenta, el mensaje es **el mismo** que cuando sí la hay.
  Enseñar la diferencia convertiría la pantalla en un comprobador de qué
  familias están dadas de alta. Es la regla que ya seguía la recuperación
  de contraseña.

**Falta pegar una plantilla.** Supabase usa una distinta para el enlace de
entrada y no está entre las tres que se pegaron en agosto, así que hasta
que se pegue estos correos salen en inglés. Está escrita y lista en
`docs/CORREOS.md` §4.

## 2.29.0 · 24 de agosto de 2026

**El retrato se abre tocando el avatar de la cabecera**, en cualquier
pestaña y sin pasar por el panel. Antes solo se llegaba por Progreso, o
por el PIN si eras la peque —o sea, para ella no había manera—.

Se abre en modal y no saltando a Progreso: cambiar de pestaña para
cambiarte el pelo te saca de lo que estabas haciendo y al cerrar habría
que volver.

**La peque también.** Su avatar sigue abriendo su ficha, que es donde ya
iba, y la ficha estrena «Cómo soy»: su figura grande de espejo y los
mismos mandos, en su paleta y sin una palabra sobre fases ni niveles.
A los tres años eso no es un resumen, es texto que no puede leer; lo que
sí entiende es tocar un color y ver que cambia.

La sección de Progreso se queda donde estaba. Las tres —cabecera,
Progreso y ficha— usan el mismo componente, así que no pueden separarse.

## 2.28.1 · 24 de agosto de 2026

**El flequillo de cortina parecía una calva.** Abría un pico ancho en
mitad de la frente y lo que se veía no era una raya, era piel. Una
cortina no descubre la frente: cae entera y solo se separa en una raya.
Ahora el pelo cubre como el flequillo recto —algo más largo por los
lados, que es lo que la distingue— y la raya es una cuña fina.

Con la raya fina apareció el problema de siempre: en rubio sobre piel
pálida, piel y pelo contrastan 1,85 y la raya desaparecía, con lo que la
cortina volvía a parecer un flequillo recto. La raya sale ahora de la
piel **en sombra** —que es lo que hay debajo de una raya de verdad— y se
separa del pelo lo justo. Hay un test que recorre las 64 combinaciones de
piel y pelo del catálogo: es el cuarto fallo de contraste del retrato y
mirar tres a ojo ya ha demostrado no bastar.

## 2.28.0 · 24 de agosto de 2026

Cuatro cosas del retrato, las cuatro salidas de usarlo.

**Barba y bigote juntos** son ahora una opción propia —«Barba y bigote» y
«Larga y bigote»— y no un segundo mando al lado de la barba: son dos
decisiones para una sola cosa que se mira entera.

**La barba larga salía hueca.** Eran dos curvas encaradas y lo que se
dibujaba era el espacio ENTRE ellas: una barba con el centro vacío. Ahora
es una forma maciza.

**El color de pelo desaparecía al marcar «sin pelo»,** y la barba va de
ese color: había que ponerse un peinado, elegir el color y volver a
quitárselo. Ahora se ofrece mientras haya barba que teñir, y se llama
«Color de la barba» cuando no hay pelo.

**Flequillo**: recto, cortina o sin flequillo. Es un eje aparte y no un
peinado más, porque «con flequillo o sin él» vale para casi todos los
cortes y meterlo dentro habría triplicado la lista para decir lo mismo.
No se ofrece en el rapado ni sin pelo: ahí no hay nada que peinar.
Migración 039.

## 2.27.0 · 24 de agosto de 2026

**Barbas.** Bigote, perilla, barba corta y barba larga, del color del pelo
—una barba de otro color se ve rara casi siempre y sería un mando más en
un formulario que ya tiene seis—. Migración 038, la primera pieza que se
añade con el criterio de la 037: la columna hace falta, pero los valores
ya viven en `src/lib/retratos.js` y no en un CHECK.

**La celebración ya no se pierde detrás del modal de sellos.** Su
temporizador corría desde que se montaba, así que cuando una misma
validación concedía un sello Y subía de fase, la fase se apagaba sin que
nadie la viera. Ahora espera a que la pantalla esté libre. Comprobado por
secuencia: nada → modal de sellos → celebración.

**Y hay linter, para una sola cosa: usar algo sin importarlo.** Pasó dos
veces el 24-ago —`Retrato` en dos pantallas y `generoDe` en App— y las
dos `npm run build` dio verde, porque Vite empaqueta tan tranquilo una
referencia que no existe y el fallo sale en pantalla como
`ReferenceError`. Dos reglas, `no-undef` y `react/jsx-no-undef`, dentro de
`npm run verify`. Nada de estilo: el criterio del proyecto está escrito en
los comentarios y no hace falta una herramienta que opine de comillas.

Con el linter dentro, `tests/imports.test.js` sobra —era una aproximación
con expresiones regulares a media regla— y se retira.

## 2.26.0 · 24 de agosto de 2026

Tres agujeros del retrato, tapados a la vez porque se sostienen entre
ellos: no había dónde mirarse, nadie avisaba de que habías avanzado, y
solo un adulto con el PIN podía elegir las piezas.

**El retrato vive en Progreso.** Figura de cuerpo entero, la fase con su
nombre y el equipo que trae. Y lo que falta para la siguiente **solo si
está cerca**: de la fase 7 a la 8 hay dos años, y una cuenta atrás de años
no empuja, deshincha. El resto del tiempo se enseña lo que ya se lleva
puesto.

**Cambiar de fase se celebra.** Con la figura nueva ya vestida, el nombre
de la fase y qué equipo ha traído. Antes se ganaba el manto y no lo sabía
nadie.

**Cada cual monta su retrato.** El editor está también en Progreso, así
que la junior elige su cara sin pedirle el PIN a nadie. No hay nada que
validar en elegir un peinado. La peque sigue en manos de su adulto, que a
los tres años es lo que toca.

**Más piezas.** Cuatro peinados nuevos (coleta, moño, trenzas, rapado),
dos tonos de piel y dos de pelo, **gafas** —la pieza que más rinde,
porque las listas dibujan solo la cabeza y solo lo que está en la cara
sirve para distinguir a alguien— y **color de túnica separado del color
del miembro**, que multiplica las combinaciones sin dibujar nada.

**Y un fallo que ya estaba desplegado**: sobre una piel muy oscura la cara
desaparecía. Los ojos eran tinta fija y contrastaban 1,20 sobre «ébano»;
el pelo negro, 1,12. Quien elegía la piel más oscura del catálogo se
quedaba sin cara. Ahora el ojo lleva blanco y pupila —se ve sobre
cualquier tono— y `separar()` despega el pelo de la piel solo cuando hace
falta, sin tocar nada donde ya se veía.

La migración 037 además **deja de enumerar el catálogo en la base**. La
035 lo metió en un CHECK diciendo que así lo protegía Postgres; dos días
después la 036 existía solo para añadir «calvo» y esta tendría que
ensanchar tres CHECK más. Queda un CHECK de forma, que es lo que de verdad
protegía. El catálogo vive en `src/lib/retratos.js`.

## 2.25.0 · 24 de agosto de 2026

**Arregla que el retrato no se guardaba.** El `update` de un miembro lleva
lista explícita de columnas y las tres del retrato no estaban en ella: el
editor las cambiaba, Supabase devolvía éxito y no se guardaba nada. Un
fallo mudo, sin error que leer. La fila se arma ahora en
`lib/miembros.js` con `filaDeMiembro()`, fuera del formulario, y hay un
test que comprueba que lleva todas las columnas que el editor puede tocar.

**«Sin pelo» como peinado.** Cuando está elegido, el selector de color de
pelo desaparece: un mando que no hace nada es peor que no tenerlo.
Migración 036, que solo ensancha un CHECK.

**El progreso del arco no se veía en los perfiles cálidos.** Y resultó no
ser cosa del naranja: medido, el oro no contrasta con **ningún** color de
la paleta —de 1,04 en el teal a 1,49 en el coral—. Colaba porque el fondo
oscuro de alrededor hacía el trabajo. Dos cambios:

- el arco lleva un **canal oscuro** debajo, que le da su propio borde y lo
  hace legible contra cualquier tono (oro contra canal: 9,08);
- el aro de base va **apagado**, porque es lo que aún no se ha
  conseguido: así la diferencia entre hecho y por hacer no depende del
  tono. El color se conserva, solo baja el brillo, y sigue identificando.

Cambiar el oro por otro color no era opción: el dorado no decora,
reconoce. Ahora las cifras viven en `PALETA_RETRATO` y hay tests que las
vigilan, que es lo que faltaba: el contraste se miraba a ojo.

## 2.24.0 · 24 de agosto de 2026

**El retrato del gremialista.** Un perfil deja de ser un emoji y pasa a
ser una figura por capas que gana equipo al subir de nivel: nueve fases
entre el nivel 1 y el 50, de la túnica del aprendiz al farol encendido de
quien custodia el taller. El equipo no se compra ni se elige: se alcanza.

Menor y no mayor porque **el cliente viejo no se rompe**: la migración 035
solo añade columnas nullables y `emoji` sigue donde estaba, sirviendo de
respaldo. Un navegador sin recargar sigue pintando su emoji sin enterarse,
y el rollback de frontend sigue siendo seguro por sí solo.

- Las fases están puestas en **hitos de calendario** —una semana, un mes,
  tres, seis, un año, dos, cuatro, siete— y no en números redondos de
  nivel: la curva es cuadrática y repartir por nivel daría saltos de
  tiempo que crecen sin freno. Los niveles salen de ahí.
- **La fase nunca baja.** Se calcula contra `xp_maxima`, que mantiene un
  trigger. Deshacer devuelve la XP y no puede desvestir a nadie: si lo
  hiciera, deshacer se sentiría como un castigo y la familia dejaría de
  hacerlo.
- **Las mascotas se quedan con emoji**, en un medallón con el mismo aro y
  tamaño que las personas. Sin arco de fase: un perro no es aprendiz.
- Por debajo de 64 px se dibuja solo la cabeza. Se probó lo contrario y a
  30 px el cuerpo entero es una mancha.
- Se elige piel, pelo y peinado en **Panel → ⚙️ → Miembros**, con vista
  previa en vivo.

Además, dos arreglos que salieron por el camino:

- **`schema.sql` estaba roto.** Ocho líneas de comentario habían perdido
  sus `--` dentro del `create table profiles`, así que el fichero no se
  podía ejecutar de cero: montar un gremio nuevo siguiendo el README
  fallaba con un error de sintaxis. La base en producción no estaba
  afectada, porque se construyó por migraciones.
- **Test nuevo `imports.test.js`**: un componente usado sin importar no
  rompe el build, revienta en pantalla. Pasó dos veces cableando esto
  —Cuadro y Panorama— y las dos el build dio verde.

## 2.23.2 · 24 de agosto de 2026

**Las celebraciones no salían nunca a quien valida.** «+18 XP · +4 Talis»
con su elogio, la lluvia de estrellas, el háptico: todo estaba escrito y
todo funcionaba, y aun así en casa no aparecía casi nunca.

La celebración es una **diferencia entre dos cargas de datos**: hace falta
acordarse de lo que había antes para saber qué hay nuevo. Esa memoria
vivía dentro de la pantalla de inicio, y esa pantalla **se destruye entera
al entrar en el panel parental** —que es exactamente donde se valida—. Al
salir del panel volvía a montarse de cero, su memoria era una hoja en
blanco y la primera pasada solo servía para tomar la referencia. Con un
adulto y un móvil, que es como se usa esto, eso era **todas las veces**.

Ahora la memoria vive un piso más arriba, en el componente que no se
desmonta nunca, junto a las otras dos cosas que ya estaban ahí por el
mismo motivo (el lote de sellos y el aviso de Talis a mano). Si se valida
algo estando dentro del panel, la celebración sale **al salir**, que es
cuando hay alguien mirando.

De paso, la regla —qué se celebra y en qué escalón— sale del componente a
`lib/celebracion.js` y queda con sus ocho pruebas. No es orden por orden:
este fallo no se ve en un portátil y llegó al móvil de casa sin que nadie
lo notara, y lo que no se puede probar es justo lo que llega roto.

Tres decisiones que quedan fijadas ahí:

- **Sin memoria previa no se celebra nada.** Abrir la app no puede sacar
  de golpe la fiesta de todo lo de ayer.
- **Cinco validaciones seguidas son UNA celebración**, con la suma. Cinco
  pantallas seguidas no celebran, agotan.
- **Subir de nivel gana a la misión que lo subió.** Dos celebraciones por
  el mismo gesto le quitan valor a la grande.

Y el mundo de la peque queda fuera a propósito: su pantalla se aprueba en
el acto y ya tiene su respuesta —estrella, sonido, háptico—. Una segunda
celebración encima, con texto que todavía no lee, sería ruido sobre lo
que ya funciona.

## 2.23.1 · 24 de agosto de 2026

**La pantalla de Hoy salía encogida en el móvil.** En un iPhone se veía
al 66 %, pegada a la izquierda y con medio dedo de fondo vacío a la
derecha; las demás pestañas, bien. En el portátil no se reproducía.

La causa no estaba donde parecía. Los `.sr` —el texto que solo leen los
lectores de pantalla, uno por ficha de habilidad— van en
`position: absolute`, y eso los coloca contra el **antecesor
posicionado** más cercano, no contra su padre. La tira de habilidades
tiene `overflow-x: auto` pero no tenía `position`, así que a efectos de
posición esos `.sr` no eran hijos suyos y **su recorte no les afectaba**:
se quedaban tumbados a 692 px del margen izquierdo. El documento entero
pasaba a medir eso de ancho y Safari de iOS alejaba la página para que
cupiera, que es exactamente lo que se veía.

Se arregla con una línea en cada contenedor (`.ficha-hab` y
`.barra-dia`), y queda un test que lo fija: quitar esa línea no rompe
nada visible en un portátil, que es como llegó hasta el móvil.

**Y la barra de seis pestañas, con ocho píxeles de margen.** «Progreso»
en Fraunces salía cortado en Safari —«Progre…»— porque a 393 pt le
quedaban tres píxeles. La barra se ensancha y se cierran los huecos en
pantallas de menos de 480 px; la letra no se toca, que 12 px es el suelo
del texto de interfaz.

## 2.23.0 · 24 de agosto de 2026

**La app ya no abre por los deberes.** La primera pantalla era la lista de
misiones, y esa pantalla decía lo mismo el día que quedaban quince y el
día que no quedaba ninguna: nada de lo que llevabas hecho. Todo el
progreso —racha, nivel, habilidades, meta del gremio— vivía dentro de una
pestaña a la que había que ir a buscar.

Ahora abre por **Hoy**, un cuadro de progreso. La referencia son los
cuadros de **Oura** y **Opal**, y de ellos se toman tres decisiones que
aquí son estructura y no adorno:

- **Una cifra manda.** Un arco de 0 a lo que toque hoy, la cuenta dentro
  y todo lo demás a media voz. Si tres bloques piden la misma atención,
  no la pide ninguno.
- **La cifra va con palabra.** «3/6» no dice si eso es bueno; «Más de la
  mitad» sí, y debajo la única frase accionable de la pantalla: «te
  quedan 3 misiones para cerrar el día».
- **Tres relojes colgando del arco**, como los sub-scores de Opal: racha,
  nivel y gremio, que son los tres que corren de verdad en esta app —el
  de hoy, el personal a largo plazo y el compartido—.

Y una que es de aquí y no de Oura: **el panorama no compara con nadie**.
Opal enseña «un 19 % menos que tus iguales» y en una app de adultos
funciona; en una casa, eso mismo es una liga entre hermanos. La única
comparación es contra uno mismo la semana pasada y contra la meta común.

Debajo del arco, **la semana en siete barras** —escaladas contra el mejor
día de esa semana, no contra un techo fijo: con techo fijo una semana
floja sale plana y no se lee nada—, la meta del gremio y **la tira de
habilidades**, en fila y con desplazamiento lateral como la de Oura: ocho
barras apiladas son una tabla, ocho fichas en fila son un vistazo.

Detalles que costaron su rato y conviene no deshacer:

- **El arco cuenta lo ENVIADO, no lo validado.** Quien ha hecho su parte y
  espera el visto bueno de un adulto ha terminado su día. Medir la
  validación sería enseñarle la diligencia del adulto como si fuera suya.
- **El arco va en teal y solo pasa a oro al cerrarse el día**, que es toda
  la regla de la hoja de estilo aplicada a un componente: el dorado no
  decora, reconoce.
- **El botón a las misiones va al final.** Arriba, el panorama vuelve a
  ser un trámite antes de la lista de deberes, que es lo que venía a dejar
  de ser.
- El estandarte sale de la cabecera de Home a `components/Estandarte.jsx`:
  lo necesitaban dos pantallas y dos copias acaban diciendo cosas
  distintas.
- Con la sexta pestaña, `flex: 1` no bastaba: un hijo de flex trae
  `min-width: auto` y se niega a encoger, así que la barra medía más que
  la pantalla y «Panel» no se veía. Lo arregla `min-width: 0`.

**Y un aviso que faltaba: los Talis a mano.** El premio a mano obliga a
escribir un motivo «para que dentro de un mes se sepa por qué», y hasta
ahora ese motivo solo lo leía quien lo escribía: a quien los recibe le
subía la Bolsa y nadie le decía nada. Reconocer algo sin decírselo a la
persona no es reconocer, es contabilizar.

Ahora sale un aviso propio —distinto del de una misión validada, porque
unos Talis a mano son justo lo contrario: alguien saliéndose del catálogo
porque la vida no cabía dentro— con **el motivo en grande y la cifra
debajo**. Al revés sería una nómina.

- Se avisa **una vez por concesión y por aparato**, con la marca en
  `localStorage` como la visita al muro.
- **Lo de hace más de catorce días se calla**, pero se marca igual:
  estrenar la app en un móvil nuevo no puede sacar de golpe los premios a
  mano de toda la historia del gremio, y un «te han dado 20 Talis» de hace
  cuatro meses no reconoce nada, desconcierta.
- **No se monta en el mundo de la peque**, y es a propósito: un motivo
  escrito no le dice nada a quien todavía no lee. A esa edad se lo cuenta
  quien se los da.

Sin migración: todo sale de `bonuses`, que ya estaba.

## 2.22.0 · 24 de agosto de 2026

**La gramática de Duolingo, aplicada a la capa de respuesta.** Cuatro
piezas que no añaden nada que hacer: cambian lo que la app contesta
cuando ya has hecho algo. Sin migración; solo bundle.

**Los números suben, no saltan** (`lib/contador.js`). Aprobar una misión
cambiaba la Bolsa de 118 a 126 entre dos fotogramas. Un número que salta
se lee como un dato; uno que sube se lee como algo que acabas de ganar.
Cuatro decisiones dentro:

- **Dura lo mismo suba 4 que suba 300.** Lo fijo es el tiempo, no la
  velocidad: a velocidad constante el premio grande —el que no puedes
  hacer esperar— sería el más lento.
- **Sube animado, baja instantáneo.** Contar hacia atrás los Talis de una
  compra sería subrayar la pérdida 700 ms, justo lo que no queremos que
  recuerde quien acaba de canjear.
- **La primera vez no se anima.** Abrir la app y ver tus 1.240 Talis
  contar desde cero es una tragaperras, no una respuesta a un gesto.
- **El `aria-label` lleva siempre la cifra de verdad.** Un lector de
  pantalla leyendo siete números intermedios no celebra: estorba.

Efecto lateral que salió gratis: al **subir de nivel** la XP del tramo
baja (95 → 5), y como las bajadas no se animan, ahí el número se planta
solo. Es lo correcto: lo que se celebra es el nivel, no el contador.

**Celebrar en escala** (`lib/celebracion.js`). Lo que más se pasa por
alto de Duolingo no es que celebre, es que **no celebra siempre igual**.
Aquí una misión aprobada, subir de nivel y confirmar un canje sacaban la
misma lluvia de diez estrellas y los mismos 1,9 s. Ahora hay tres
escalones —`chispa`, `normal`, `hito`— y cambian el **tamaño**, no solo
la duración: alargar la misma animación no la hace más grande, la hace
más lenta. `normal` es exactamente lo que ya había, así que las llamadas
que no piden escalón se comportan igual que antes.

- **Subir de nivel** pasa a `hito`. Si durase lo mismo que aprobar una
  misión, no se distinguiría de un martes cualquiera.
- **Pedir un premio** pasa a `chispa`: no has conseguido nada, has hecho
  algo y ha salido bien. Con fondo más claro, para no tapar la pantalla
  de la que no te has movido.
- Con `prefers-reduced-motion` no cae **ninguna** estrella, en ningún
  escalón. La caja con el texto se queda: quien pide menos movimiento
  sigue necesitando saber que la misión se aprobó.

**La llama solo se mueve el día que hay algo que hacer.** La racha en
riesgo inquieta el 🔥; el resto de los días está quieto. Es la lección
del latido del avatar y del revés: una animación permanente deja de
comunicar en dos días. Duolingo apaga su llama cuando no has practicado;
aquí no se apaga —eso sería castigar a mediodía, que es lo que este
camino evita a propósito— sino que se inquieta.

**El háptico** (`lib/vibrar.js`), en la estrella de la peque y en cada
misión aprobada. Quien usa la pantalla peque no lee el texto que
confirma, y la tablet está a menudo en silencio: sin vibración, con el
sonido apagado no queda ninguna confirmación que no haya que saber leer.
**No lleva interruptor en Ajustes**: la vibración ya tiene dos que la
persona conoce —el del sistema y el silencio del móvil— y
`prefers-reduced-motion` cubre el resto. Callar donde no existe la API
(iOS Safari) no es un fallo, y una excepción aquí jamás puede comerse la
acción que la disparó.

34 tests nuevos (1.013 en total). Comprobado en el navegador con
`dev:demo`, no solo compilando: los tres escalones, la llama inquieta y
la cuenta cazada a media subida (la Bolsa marcando 903 con el valor real
ya en 905).

**Esta versión arrastra dos commits que nunca se publicaron.** El 23-ago
entraron en `main` las **copias de seguridad cifradas** (`c482c68`) y el
arreglo de su línea de cron (`3211863`), y ninguno subió el número:
`package.json` se quedó en 2.21.1 y producción siguió sirviendo
`754fcd2`. Así que **2.22.0 publica también eso**, y es lo que dirá
`app_logs.release` de aquellas líneas. Se anota aquí para que el día que
haya que decidir a qué volver con `npm run rollback`, el número no mienta
sobre lo que lleva dentro.

## 2.21.1 · 22 de agosto de 2026

**Progreso se comía la pantalla con la semana llena.** «Lo que has hecho»
y «Lo que te han dicho» crecen con el uso, que es lo que se quería, pero
con dieciséis misiones validadas y sus frases dejaban la racha, las
habilidades y los sellos a **trece pantallas de móvil** de scroll
(18.373 px contra 7.758 midiéndolo en la demo).

Los dos se pliegan ahora, y **la cabecera dice qué hay dentro sin abrir**:
«16 misiones · 240 XP» y «Lo último: “Te has acordado tú de hacer la
cama”». Una cabecera muda obliga a abrir para saber si hay algo, que es
justo lo que se quería evitar.

- **Se pliegan de serie, pero lo que abres se queda abierto**: obligar a
  desplegar lo mismo cada vez es la forma más rápida de que deje de
  abrirse. Se recuerda por aparato, como el orden de la tienda.
- Son `<details>` de verdad y no un `div` con `onClick`: el navegador ya
  sabe abrirlos con teclado, anunciarlos a un lector de pantalla y buscar
  dentro del texto plegado.
- La pista del muro es **la última frase**, nunca un número: contar lo
  recibido es el marcador que prohíbe §10.1.

**Y de paso, un fallo que trajo la 2.19.0:** el punto de «hay algo nuevo»
se apagaba al entrar en Progreso, hubiera leído uno el muro o no. Ahora se
apaga **al abrir la sección**, que es cuando de verdad se lee.

## 2.21.0 · 22 de agosto de 2026

**F3 y última de `docs/RECONOCIMIENTOS.md`.** Tres piezas y ninguna
migración: el sistema de reconocimientos queda entero.

**Lo que nadie pidió, también en familia.** El tipo `espontaneo` estaba
desde la 2.20.0 pero solo lo ofrecía el modo piso. Ahora, al dar las
gracias, hay un botón —«✨ Fue algo que nadie le pidió»— que cambia lo que
se manda: no cuelga de ningún encargo y en el muro llega marcado. **No es
lo mismo y por eso se distingue**: reconocer un encargo es decir «bien
hecho»; esto es decir «me di cuenta», que es exactamente lo que no tenía
sitio en la app. En un piso sigue viniendo de serie.

**El Retrato: quién has sido esta semana.** Una frase en Progreso, encima
del muro: «Esta semana el gremio te ha visto sobre todo en Responsabilidad
y Hogar». Se calcula, no se guarda. Existe porque los sellos dan identidad
a largo plazo —73 piezas, meses de camino— y no contestan la pregunta
corta, que es la que uno se hace el domingo.

- Nunca más de dos habilidades: con tres deja de ser un retrato y pasa a
  ser un inventario.
- Manda el contexto **congelado** de cada completación: si mañana una
  misión cambia de habilidad, la semana pasada no cambia con ella.
- Y si además le han dicho algo, lo añade —«Y alguien se ha acordado de
  decírtelo»— **sin una sola cifra**: contar lo recibido es el marcador
  que prohíbe §10.1.

**El elogio sale de la tienda.** Estaba en el catálogo a 325: ocho o nueve
días de la junior para que alguien dijera en voz alta algo bueno de ella.
El motivo de retirarlo no es el precio, es que **el reconocimiento no se
compra** — y desde la 2.20.0 hay un sitio donde se dice gratis. Ningún
gremio llegó a crearlo, así que no hubo nada que migrar; queda un test que
falla si alguien vuelve a poner a la venta un elogio, un gracias o un
reconocimiento.

## 2.20.0 · 22 de agosto de 2026

**Los gracias: el primer canal horizontal de la app.** F2 de
`docs/RECONOCIMIENTOS.md`. Hasta hoy todo lo que El Gremio reconocía
bajaba de arriba abajo —el adulto valida y elogia— o lo dictaba el motor
de sellos. Ahora la junior puede reconocer a su hermana, la peque a quien
sea, y —lo que no había pasado nunca— **alguien puede reconocer a los
adultos**.

- **Dos toques**: a quién, y por qué. En ese orden, porque en una casa uno
  piensa primero en la persona.
- **Nada de folio en blanco.** El «por qué» propone los encargos REALES
  que esa persona hizo estos días **y que todavía no tienen palabras**: lo
  que ya recibió un elogio no se vuelve a ofrecer, porque reconocer dos
  veces el mismo hecho es repetir el mismo acto, no sumar uno nuevo.
  Escribir es la salida, no la entrada; es la lección del elogio al
  validar, donde cada sugerencia ES el botón.
- **La peque da con una cara y una estrella.** Sin texto: toca la cara de
  quien sea y va. Su estrella de gracias es de otro color que la suya
  —la suya se gana, esta se regala— y la fila solo aparece si le quedan,
  porque un botón que contesta «no» a los tres años no se entiende: se
  repite.
- **Tres al día por persona, y el tope vive en la BASE.** Uno que solo
  viviera en la interfaz lo salta cualquiera que recargue, y este tope no
  es una protección técnica: es la regla que sostiene la pieza. Lo que se
  puede dar infinitas veces deja de valer.
- **Ni Talis ni XP, en ninguna dirección**, y la tabla no tiene ni una
  columna para ello: que no exista es más fuerte que acordarse de no
  usarla. Un «gracias» que paga cinco Talis deja de ser un gracias y pasa
  a ser una misión barata.
- **El muro los recibe firmados.** Los gracias llevan la cara y el nombre
  de quien los manda; los elogios de validación siguen sin firma porque
  `completions` no guarda quién validó. Conviven en una sola lista: para
  quien lo lee no son dos cosas, es todo lo bueno que le han dicho.
- **En modo piso, «lo que nadie pidió» entra ya** (§10.4 de la spec):
  entre convivientes adultos no hay validación jerárquica, así que el
  canal vertical no existe y lo que se reparte mal no son las tareas del
  catálogo sino lo que nadie apuntó.

Migración **034**, con RLS por gremio, grant explícito de `anon`, los dos
checks de forma —nadie se reconoce a sí mismo; un gesto no lleva texto— y
el trigger del tope diario. El backend simulado imita las tres reglas: sin
eso, la demo dejaría dar gracias infinitas mientras producción corta a las
tres, que es la trampa que este proyecto lleva evitando desde el principio.

## 2.19.0 · 22 de agosto de 2026

**El Muro: todo lo bueno que te han dicho, junto y sin caducar.** Es la
F1 de `docs/RECONOCIMIENTOS.md` y no ha hecho falta ni un dato nuevo: los
elogios se escriben al validar desde el primer día y se guardan en
`completions.praise`. Lo único que hacía la app era **dejar de
enseñarlos** —el historial va por semanas y al rodar la semana
desaparecían de la vista—, así que nadie podía leer de una vez lo que le
habían dicho.

- **En Progreso**, sección «Lo que te han dicho»: cada frase con el
  encargo del que salió y su fecha. Las 30 últimas, y un botón para las
  anteriores; no caduca nada.
- **En la ficha de la peque**, antes que sus premios a propósito: lo que
  le han dicho pesa más que lo que se ha llevado. Manda el dibujo del
  encargo y la frase va pequeña debajo, para el adulto que pase y se la
  lea en voz alta, que es la versión buena de esto.
- **Cómo se entera alguien de que hay algo nuevo**, ya que esto no manda
  avisos push: un **punto sin número** en la pestaña de Progreso, y para
  la peque, su avatar latiendo —el aviso que ya entiende—. Se apaga al
  abrirlo, y se sella con la fecha de la última frase y no con «ahora»:
  si llega una mientras está leyendo, seguirá siendo nueva.
- **Sin contadores en ninguna parte.** Ni en el muro, ni en la pestaña, ni
  al lado de ningún nombre: un número de frases recibidas convierte esto
  en un marcador, que es el ranking que la app no tiene a propósito.
- Lo rechazado no entra: un elogio escrito en una validación que luego se
  corrigió no es un elogio, es un accidente.

**Lo que este muro todavía no puede decir: quién lo dijo.** `completions`
guarda `resolved_at` y `praise` pero **no guarda quién validó**, así que
una frase no se puede firmar. Se enseña con su encargo y su fecha, que es
lo que hay. La firma llega con los gracias de la F2 —esos sí tienen
remitente— y, si se quiere firmar también los elogios, la columna
`resolved_by` entra en la migración 034 y desde ese día quedan firmados.

## 2.18.0 · 22 de agosto de 2026

**La tablet de la peque ya no depende de que un adulto se acuerde.** El
aviso de versión nueva de la 2.17.0 no le sirve a ella —no sabe leer—, y
su tablet es justo el aparato con más papeletas para quedarse días
abierto en el mueble del salón corriendo una versión de la semana pasada.

Ahí la app **sí se recarga sola**, y solo en el único momento en que
hacerlo no le quita nada: **al volver de segundo plano después de un buen
rato**. Si la pantalla estuvo escondida dos minutos, no había ningún dedo
encima.

Tres cosas la frenan, y las tres tienen su prueba:

- **Algo a medias**: un juego, una celebración, una estrella viajando a la
  base. Recargar ahí le quitaría algo que ya era suyo.
- **Poco rato escondida** (menos de dos minutos): pudo ser un aviso del
  sistema tapando la pantalla mientras ella jugaba.
- **Haberlo intentado ya para ese mismo commit.** Este es el guardia que
  importa: si tras recargar seguimos en el bundle viejo, el navegador está
  sirviendo su caché y volver a recargar sería un bucle infinito con una
  niña de tres años delante. Se apunta en `localStorage` qué versión se
  buscaba y no se reintenta.

Y deja una línea en el registro (`version.recarga_automatica`) **antes**
de recargar —vaciando la cola a propósito—, porque si no, la única prueba
de que esto ocurrió se iría con la página.

Verificado en el navegador simulando el ciclo entero: se va a segundo
plano, vuelve tres minutos después, recarga sola y apunta el commit; al
repetir el ciclo con el mismo commit, ya no recarga.

## 2.17.0 · 22 de agosto de 2026

**La app no se enteraba nunca de que estaba vieja.** El 21 de agosto a
las 08:44 hubo una sesión corriendo el bundle del día 18: tres días y
diez versiones por detrás. No era caché del service worker —el nuestro no
cachea nada a propósito—, era una app **abierta desde hacía días**. Un
icono de inicio en un móvil no se cierra nunca, y el código con el que se
cargó sigue ejecutándose hasta que alguien recarga de verdad.

Eso choca con la regla que gobierna los despliegues aquí: una migración
puede dejar roto a un cliente viejo, y el cliente viejo no tenía forma de
saber que lo era.

Ahora compara el commit que lleva dentro con el de `version.json` —que ya
se publicaba en cada build— y, si no coinciden, avisa con un cartel y un
botón de recargar.

- **Mira en tres momentos**, y el segundo es el que importa: al arrancar
  (pasados 20 s, para no competir con la carga), **al volver a primer
  plano** si hace más de cinco minutos de la última —el caso exacto del
  móvil suspendido— y cada media hora.
- **No recarga sola.** Una app que se recarga bajo el dedo de alguien
  pierde el toque que estaba dando, y en la pantalla de la peque sería
  sencillamente inquietante. Avisa; recarga quien quiera.
- **La peque no lo ve.** Su pantalla vuelve antes de ese punto del árbol y
  un cartel de texto que no puede leer solo sería ruido. Cuando un adulto
  salga al selector, lo verá.
- **Ante la duda, no avisa**: sin dato, sin commit, con un bundle de
  desarrollo o con un `index.html` devuelto por el comodín de la SPA
  —200 y `text/html`, que es lo que pasa en `npm run dev`—, se calla. Un
  aviso que sale cuando no toca se aprende a ignorar en dos días.
- Deja **una sola línea** en el registro (`version.vieja`) la primera vez,
  para saber por fin cuánto tiempo corre la gente con una versión vieja.

## 2.16.1 · 22 de agosto de 2026

**Un fallo ya arreglado seguía leyéndose como un fallo vivo.** El panel
enseñaba las 199 veces que falló el `onConflict` con la misma cara que un
error de hace un minuto, y el que importaba quedaba enterrado debajo.

Ahora se parten en dos: arriba lo que **ha aparecido en la versión que
corre ahora mismo**, y debajo, apagado, lo que no. La etiqueta dice
exactamente lo que se puede afirmar —«sin repetirse en 2.16.1»— y no
«arreglado», que eso no lo sabe la app. Lo dudoso (un fallo sin versión
registrada) se queda arriba: esconder uno vivo es peor que enseñar uno
muerto de más.

**Y «JWT issued at future» deja de salir en crudo.** Es PGRST303: el
reloj del aparato va por delante del servidor y el testigo de sesión
parece emitido en el futuro. Ahora dice qué hacer: *«La hora de este
aparato va adelantada respecto al servidor. Pon la fecha y la hora en
automático y vuelve a entrar»*.

## 2.16.0 · 22 de agosto de 2026

**El panel de errores decía siete veces «ha fallado algo» y nunca decía
qué.** Cada fila enseñaba el nombre del evento —`error.capturado`, que es
el mismo para TODOS los errores de la app—, la hora, la versión y una
«petición —» vacía. La huella, el código de Postgres y el origen estaban
guardados en `datos` y no se pintaban. Por eso el fallo de los sellos
pudo estar tres días delante de los ojos de cualquiera.

Tres cosas, y las tres son la misma:

- **Se lee el mensaje, no el nombre del evento.** Ahora cada tarjeta
  empieza por lo que falló: «there is no unique or exclusion constraint…
  · En otorgarInsignias · Postgres 42P10 · 2.15.0+796376b».
- **Lo repetido se agrupa y se cuenta.** 294 líneas iguales eran 294
  tarjetas que enterraban lo demás; ahora es una con `×294`, desde cuándo
  y cuándo fue la última. Y una frase arriba: «2 fallos distintos, 295
  veces».
- **Se marca lo que no es nuestro.** Un «Script error.» sin fichero ni
  línea viene de fuera —una extensión, casi siempre— y no se puede
  diagnosticar. Decirlo ahorra la tarde de buscarlo en código propio.

**El filtro estaba después del `limit`, que es no filtrar: recortar.** La
consulta pedía las 20 últimas líneas de TODOS los niveles y luego se
quedaba con las de error. Con 171 líneas de `debug` y 78 de `info` en dos
días, esas 20 se llenaban de ruido y el panel enseñaba dos errores de los
228 que había. Ahora el nivel va en la consulta y se traen 200.

**El botón sí hacía algo; lo que no hacía era decirlo.** «Enviar lo
pendiente y recargar» vacía la cola de registro, pero esa cola se vacía
sola cada pocos segundos, así que casi siempre no había nada que enviar y
la pantalla se quedaba idéntica. Ahora contesta: «Enviado. 3 líneas
nuevas» o «No había nada pendiente: el registro ya estaba al día».

**Y el backend simulado se había quedado corto otra vez.** No tenía
`.in()`, así que la consulta nueva reventaba **solo en demo** —producción
bien, demo diciendo que no hay errores—, que es exactamente la
combinación que este proyecto ya se prometió no repetir. Se descubrió
porque el panel nuevo, en la demo, enseñó su propio fallo:
`TypeError: …eq(...).in is not a function ×2`.

## 2.15.1 · 22 de agosto de 2026

**Tres días sin conceder ni un sello, y nadie se enteró.** La migración
030 cambió el índice único de `profile_badges` de `(profile_id, code)` a
`(profile_id, code, instance_key)` —para que un sello pueda repetirse por
temporada—, y dos `upsert` se quedaron pidiendo el índice viejo:
`App.jsx`, que es por donde se conceden TODOS los sellos normales, y el
cierre de meta del panel, que reparte la insignia 🏰.

Postgres contesta `42P10` («there is no unique or exclusion constraint
matching the ON CONFLICT specification») y **se cae la fila entera**. El
código capturaba el error y seguía, así que la app se veía bien: ni un
sello nuevo desde el 19-ago, y 68 → 80 → 147 errores al día en
`app_logs` porque cada carga lo reintenta. El último sello concedido era
del 19 de agosto.

Se descubrió leyendo los registros para otra cosa. Nadie los miraba: son
1.650 líneas en siete días que hasta hoy no había abierto nadie.

Lo que se ha hecho, por orden de importancia:

- **El arreglo**, que son dos cadenas de texto: el `onConflict` nombra las
  tres columnas. `instance_key` no viaja en la fila —la base pone su `''`
  antes de resolver el conflicto—, pero el destino sí tiene que nombrarla.
- **`tests/upserts.test.js`**, que cruza cada `onConflict` del cliente con
  los índices únicos de `schema.sql` y falla si no encaja ninguno.
  Comprobado reintroduciendo el fallo a propósito: lo caza, y el mensaje
  dice qué índices hay de verdad. Ni el build ni los tipos podían ver
  esto: la incoherencia era entre una cadena y un índice.
- **La demo deja de ser más permisiva que la base**: `profile_badges`
  hereda ahora el `instance_key: ''` por defecto. En demo el fallo NO se
  reproducía, que es la peor combinación posible.

Al abrir la app, la familia recibirá de golpe los sellos de estos tres
días: el motor recalcula desde el historial y concede lo que falte.

## 2.15.0 · 22 de agosto de 2026

**La tienda ya no sale salteada.** Los premios llegaban de la base por
`created_at` —el orden en que alguien los escribió—, que para quien mira
la tienda es ningún orden: 505, 325, 900, 480. Comparar «¿qué me llega
antes?» obligaba a leer la lista entera y hacer la cuenta de cabeza.

Ahora salen **de menos a más por defecto**, y hay un botón arriba a la
derecha para darle la vuelta («↑ Más barato» / «↓ Más caro»).

- **El defecto no es estético.** Lo que decide si esto se sigue usando son
  los primeros días, y en los primeros días lo único accionable es lo más
  barato. Ponerlo delante es poner delante lo que se puede tocar.
- **La preferencia se guarda en el dispositivo**, no en el perfil: es una
  manía de quien mira. Sin eso se perdía al cambiar de pestaña, porque la
  tienda se vuelve a montar cada vez que se toca «Tienda».
- **Los empates se rompen por título y siempre en el mismo sentido.** Dos
  premios de 505 que se intercambien el sitio al invertir el orden se leen
  como un fallo, no como un orden.
- **El botón no sale con un solo premio**: un botón que no cambia nada
  visible se lee como que está roto.
- **El panel parental también ordena por precio**, sin botón: quien edita
  premios los compara con los de su banda, y esa comparación es siempre de
  menos a más.

La tienda de la peque ya ordenaba así desde el primer día
(`premiosParaPeque`); esto le da a la de los mayores lo que ella tenía.

## 2.14.0 · 21 de agosto de 2026

**Contar que algo va mal, desde dentro de la app.** Hasta hoy un fallo
visto un domingo por la tarde llegaba —si llegaba— de viva voz y tres días
después, sin versión, sin pantalla y sin lo que decía la consola.
`monitoring.js` recogía las huellas de cada error desde el primer día,
pero se quedaban en el navegador de quien lo sufría: nadie las leyó nunca.

Ahora hay dos puertas y las dos llevan al mismo sitio:

- **«Algo va mal · contarlo»** en el selector de perfiles. Vive ahí y no
  detrás del PIN a propósito: quien se tropieza con un fallo suele ser
  justo quien NO tiene el PIN, y esa pantalla está a un toque de «Cambiar»
  desde cualquier tablero.
- **«Contar qué estabas haciendo»** en la pantalla de tropiezo. Esa
  pantalla decía «el fallo ya ha quedado registrado», que significaba «en
  la consola de este móvil», que es tanto como decir en ninguna parte.

Lo que se manda es lo que escribe la persona **más** la versión, la
pantalla, el agente recortado y las tres huellas de error más repetidas.
Nada más: ni capturas, ni datos de otras pantallas. Y se dice en la propia
hoja, debajo del campo, antes de mandar nada.

Detalles que no se ven pero deciden si esto sirve:

- **Si falla el envío no se borra lo escrito.** El motivo más común de
  fallo es quedarse sin red, y se arregla solo en un minuto; un formulario
  que se vacía al fallar es la forma más segura de que nadie lo reintente.
- **La pantalla de tropiezo no tiene datos cargados**, así que el envío
  busca el gremio por su cuenta en vez de recibirlo. Justo ahí es donde
  más falta hace poder contarlo.
- **Nadie mira este buzón desde la app** y por eso la tabla no va por
  realtime. Se lee con una consulta, y está escrita en el RUNBOOK §3b.
- Migración **033**, con RLS por gremio, grant explícito de `anon` (la
  lección de la 028) y tope de 200 informes por gremio.

La peque no lo ve: su pantalla son dibujos, y un botón de texto ahí es un
botón que se pulsa por jugar.

## 2.13.2 · 21 de agosto de 2026

**Dos frases que no decían la verdad.** Ninguna rompía nada; las dos
contaban mal lo que estaba pasando.

- **«1 estrellas guardadas».** Los dos `aria-label` de la pantalla de la
  peque escribían el plural a pelo. Ahí el texto visible son dibujos, así
  que ese rótulo es TODO lo que oye quien navega con lector de pantalla:
  es la única frase de esa pantalla que se lee en voz alta, y era la única
  que estaba mal escrita. El resto de la app ya distinguía («Te falta 1
  Talis» / «Te faltan 100»). El ayudante vivía suelto y privado dentro de
  `sellos-lore.js`, donde nadie más podía usarlo; ahora es `lib/plural.js`
  con sus tests, y `sellos-lore` gasta el compartido.

- **El botón de cerrar la meta gritaba «¡Conseguida!» yendo por el 0,1 %.**
  Verde, a ancho completo y con confeti en el texto, dijeras 10 XP o
  12.950. Cerrar la meta lo sigue decidiendo un adulto y no el contador
  —una noche de pizza no espera a un número—, pero por debajo del objetivo
  el botón ahora se llama «Cerrar la meta y empezar otra» y va en discreto,
  y el aviso dice con cuánto se está cerrando. Detrás hay tres cosas que no
  se deshacen: la temporada, la insignia 🏰 y la subida de precios.

Verificado en el navegador con `dev:demo`, las dos ramas: a 20/12.950 sale
el botón discreto; forzando la meta a 10/10 vuelve el verde con el 🎉.

## 2.13.1 · 20 de agosto de 2026

**El aspa y el botón de cerrar de la ficha se salían de la pantalla.** Dos
fallos distintos, los dos míos y los dos del mismo despiste:

- La ficha anulaba con `padding: 0` el relleno del velo, que es justo el
  que respeta las áreas seguras del aparato. Sin él, el aspa se iba a la
  esquina física de la pantalla —debajo de la muesca o de la esquina
  redondeada— y el botón de abajo quedaba pegado al borde y tapado por la
  barra de pestañas, que flota fija por encima.
- El botón se escribió con `className="btn btn-primario ancho"` y **ni
  `btn-primario` ni `ancho` existen** en la hoja. Las reales son `btn` y
  `btn-bloque`. Una clase inventada es HTML perfectamente válido: no falla
  al compilar, no avisa en consola, y el botón sale sin ancho ni aspecto.

Ahora el aspa va pegada al panel con `sticky` —sigue a la vista al bajar
por una ficha larga— y abajo hay hueco para el indicador de inicio y la
tabbar. Medido en pantalla: 31 px de aire y nada tapando el botón.

Un test recorre los componentes y falla si alguna clase `btn-*` usada en
el JSX no está definida en `styles.css`. Comprobado reintroduciendo el
fallo a propósito: lo caza.

## 2.13.0 · 20 de agosto de 2026

**Cada sello conseguido se puede abrir y cuenta de dónde sale.** Al
tocarlo, la pieza crece a pantalla completa y responde cuatro preguntas en
el orden en que la gente las hace: por qué la tienes, qué significa, la
misma idea contada desde el Gremio, y qué implica tenerla.

El «por qué» se compone de la REGLA, no de un texto escrito a mano: si
mañana cambia un umbral del catálogo, la frase cambia con él. Un texto
fijo seguiría prometiendo el viejo. Y lleva la fecha: «La conseguiste el
14 de julio de 2026».

**«Qué implica» no puede mentir, y hay un test que lo vigila.** Un sello no
da Talis, ni XP, ni ventaja, así que ninguno de los 73 puede decir
«desbloquea» o «te da»: la prueba falla si alguno lo intenta. Lo que sí
dice, en voz alta, es que no da nada de eso —porque esa es la promesa del
sistema, no una carencia—. Las cuatro viejas que sí dan un poder lo
anuncian aparte, y ese anuncio se compone de la definición real: si un
comodín pasara de un uso a dos, la línea cambiaría sola.

**Los tres descubrimientos pasan a siluetas.** Se ve que están y cuántos
quedan —el catálogo sigue completo— pero no cuál es cada uno: enseñar
«Semana de herramientas variadas» ya contaba media condición, y una
sorpresa explicada deja de serlo. Nada más del catálogo es secreto, y eso
es deliberado: un objetivo que se espera que alguien persiga tiene que
estar a la vista.

De paso, cada sello estrena su nombre del catálogo también en la ficha, y
Ritmo y Trayectoria enseñan la cifra exacta al lado del nombre narrativo.

## 2.12.0 · 19 de agosto de 2026

**Ya se puede ver el catálogo entero de sellos.** Progreso estrena «Ver el
catálogo de sellos»: los 73, agrupados en seis bloques y veinte series,
cada bloque plegable.

Faltaba, y la pregunta era razonable: la pantalla enseñaba una rejilla de
«N de 16» —las dieciséis viejas— y los sellos nuevos solo aparecían al
conseguirlos. Las 73 piezas existían en el motor y no había forma de
mirarlas desde la app.

Cada serie enseña sus escalones con su estado —conseguido, el siguiente,
más adelante— y debajo **lo que falta para el siguiente, dato a dato**:
«Días 20 / 25», «Actividades 3 / 5». No hay porcentaje: tener el 100 % de
la XP y el 0 % de las semanas no es medio camino, porque las semanas no se
pueden acelerar. Ver las dos cifras es lo único que explica POR QUÉ falta.

Lo que no lleva progreso: los tres regresos y los tres descubrimientos.
Enseñar su cuenta convertiría una sorpresa en una lista de deberes, y en
el caso del regreso dibujaría además una cuenta atrás hacia desaparecer.
Los siete que aún no se pueden ganar dicen por qué en una frase, que es
información y no un candado.

**Cada sello estrena nombre propio.** Antes se derivaba de la categoría, y
por eso las tres piezas de «Actividades distintas» se llamaban las tres
«Nuevos caminos»: tres cromos indistinguibles en la misma fila. Ahora usan
los nombres del catálogo —«Caja variada», «Mapa del taller», «Taller sin
rincones desconocidos»— y hay un test que impide que dos de la misma serie
vuelvan a compartirlo. Ritmo y Trayectoria enseñan además la cifra exacta
al lado, porque «Un año de jornadas» son 250 jornadas acumuladas y no un
año de calendario.

El contador de la rejilla vieja también se corrige: contaba en su
numerador TODO lo que tiene el perfil, sellos nuevos incluidos, contra un
denominador de 16. Un perfil con cinco viejas y ocho sellos leía «13 de
16», y con más de dieciséis sellos habría dicho «20 de 16».

## 2.11.0 · 19 de agosto de 2026

**Las zonas de la casa, y el modo compañeros de piso.** Las campañas de
zona y de limpieza profunda dejan de limpiar la casa del catálogo y
pasan a limpiar LA VUESTRA: cada gremio tiene su mapa de zonas
(`zonas_casa`, migración 032), que se siembra en el setup con una
pregunta sobre la vivienda —cuántos baños, cuántos dormitorios, si hay
más de una planta, qué extras— y se edita cuando la casa cambie desde
⚙️ → Casa: añadir, renombrar o quitar. Las plantas no se guardan como
dato: solo ponen nombre («Baño de arriba», «Baño de abajo»). Cada zona
lleva una CLASE (cocina, baño, dormitorio… u «otra zona» para la
buhardilla que ningún catálogo conoce) que decide qué tareas trae su
limpieza.

Y el setup pregunta ahora **quiénes formáis el gremio**: una familia,
o **compañeros de piso**. En un piso todo el mundo es adulto, no se
preguntan dormitorios —cada conviviente recibe SU habitación, con
dueño— y las campañas sobre una habitación se sugieren enteras a esa
persona. Las zonas comunes se reparten como siempre.

De regalo, un arreglo de concepto: los roles aptos de una tarea son un
SUELO de capacidad, no un club. Una tarea «de peque» la puede hacer
cualquiera con más años; lo de adultos sigue siendo solo de adultos.

Sin zonas guardadas (un gremio anterior, o quien saltó la pregunta),
el modo limpieza usa las de siempre y desde ⚙️ → Casa se adoptan con un
botón. Necesita la **migración 032**; sin ella todo degrada con aviso.

## 2.10.0 · 19 de agosto de 2026

**Las tareas del modo limpieza se personalizan al lanzar.** El catálogo
pasa a ser un punto de partida: en el reparto, el lápiz de cada tarea
abre un editor con el nombre («Recoger el cuarto de juegos a fondo»),
el esfuerzo —que arrastra puntos y reloj, como siempre— y el dibujo,
con el mismo buscador de emojis de las misiones. Y el hueco «{Agrega
los tuyos}» del planificador original ya existe: «+ Añadir una tarea de
esta casa» crea tareas propias, que nacen para cualquiera y no viajan
hasta tener nombre.

Dos límites a propósito: los roles aptos del catálogo no se editan
(renombrar «Limpiar el horno» no lo vuelve apto para la junior) y los
puntos no se teclean (salen del esfuerzo y del rol). El reloj de una
tarea renombrada se recupera por los puntos guardados, no por el título,
así que personalizar no lo rompe.

## 2.9.0 · 19 de agosto de 2026

**El modo limpieza: campañas de limpieza como misión secundaria.** Un
adulto lanza una «operación» desde Panel → Misiones: un formato del
planificador doméstico (limpieza relámpago por tiempo, la zona de la
semana, o una estancia a fondo), con las tareas repartidas entre quienes
participan —la peque incluida, que tiene tareas a su medida en casi
todas—. Las tareas son misiones únicas normales por dentro (se piden,
se validan con elogio, pagan por `resolve_completion`), así que no hay
un segundo camino de puntos que auditar.

Lo que las hace distintas:

- **Toda la XP es de Hogar, y los Talis doblan o cuadruplican los de una
  misión normal según el esfuerzo.** Es la mayor fuente proporcional de
  Talis del sistema, a propósito, y hay un test que fija esa promesa. La
  XP se queda cerca de la normal: el nivel no se compra fregando.
- **Botín de cierre**: si la operación se completa entera antes de su
  fecha, cada participante recibe la mitad de sus Talis ganados, por
  `bonuses` (tipo `limpieza:<id>`, sin XP, el patrón de `racha:N`). Si
  vence sin completarse, se recoge sin botín y lo pendiente se pausa.
- **Cada tarea lleva reloj**: «Empezar» arranca una cuenta atrás según
  el esfuerzo (10/25/40 min), que sobrevive a recargas porque guarda el
  instante de inicio, no un contador. Es ayuda, no examen: agotarse no
  bloquea nada y la tarea se puede marcar sin reloj.
- **En el panel se ven de otro color** (tinte teal) en Validar, Hecho
  hoy, la lista de Misiones y las pausadas, con su horquilla de minutos.
- Una sola operación activa por gremio, y solo la lanza y la cierra un
  adulto: comprobado en el cliente para el mensaje y en Postgres para
  mandar (`crear_campana_limpieza` / `cerrar_campana_limpieza`).

Necesita la **migración 031** (tabla `campanas_limpieza`,
`challenges.campana_id`, las dos funciones y un `undo_completion` que
aprende de campañas). Sin ella la app degrada: el resto funciona y el
modo limpieza avisa de qué falta. Bandera `modoLimpieza` para apagarlo
sin desplegar; las tareas ya lanzadas seguirían saliendo como únicas
normales.

Antes de ejecutar nada pasó una revisión adversarial que dejó cuatro
arreglos: índice único parcial para «una activa por gremio» (dos
aparatos lanzando a la vez dejaban una campaña invisible bloqueando el
gremio), doble cierre concurrente → 'ya_cerrada' en vez de error crudo,
deshacer una tarea de una operación ya completada rebota con mensaje
(el botín ya contó con ella), y el tope por tarea aguanta valores
desorbitados sin reventar.

## 2.8.1 · 19 de agosto de 2026

**La tienda enseñaba una moneda distinta de la de la cabecera.** En 2.5.0
la ficha grabada llegó a la Bolsa y el emoji 🪙 se quedó en los otros
veinte sitios donde sale un importe: la tienda, el resumen semanal, el
tablero de la mascota, el camino de rachas, los miembros, el panel y el
cuadro de mando. La misma pantalla mostraba dos monedas.

Ahora hay un componente `<Talis n={...} />` y lo usan todos. La ficha se
mide en `em` y no en píxeles, porque aparece lo mismo en texto de 0,72 rem
que de 1 rem y a 18 px fijos rompía la línea.

De paso mejora lo que oye un lector de pantalla: donde decía «120 moneda»
ahora dice «120 Talis», que es el vocabulario que la 2.4.0 estableció.

Dos cosas más:

- **La diapositiva del tutorial sobre los Talis enseña la pieza real.** Es
  la primera vez que una familia ve un Talis, y era justo donde el emoji
  del sistema dibujaba algo distinto de lo que sale después.
- **Se retira `conFicha()`**, que devolvía `🪙 45 Talis`. No la llamaba
  nadie salvo su propio test, y era una trampa: nombre atractivo, emoji
  dentro. Para texto plano queda `talis(n)`.

Un test recorre `src/` y falla si el emoji vuelve a colarse en cualquier
fichero fuera de un comentario.

## 2.8.0 · 19 de agosto de 2026

**El pasado deja de poder reescribirse.** Migraciones 028, 029 y 030, con
el código que las acompaña.

Había una incoherencia de fondo: una insignia ganada no se pierde, pero la
prueba de por qué se ganó sí se podía destruir. De dos maneras. Editar la
habilidad de una misión reescribía el pasado —«Hacer la cama» pasa de
Hogar a Responsabilidad y las cuarenta veces del año pasado dejan de haber
entrenado Hogar, con la Maestría todavía en el perfil y nada detrás—. Y
borrar una misión se llevaba sus completaciones por cascada; el botón
incluso lo anunciaba: «¿Borrar … y su historial?».

- **029 congela el contexto** de cada completación al crearla: habilidad,
  frecuencia, título, familia y valores. Es lo que leen ahora las reglas.
  Al CREAR y no al validar, porque una misión pedida el lunes y aprobada
  el jueves debe guardar lo que era el lunes.
- **028 da identidad estable a las actividades.** Antes la familia de
  misión era el `challenge_id`, así que duplicar «Hacer la cama» en «Hacer
  la cama II» fabricaba variedad de la nada y los caminos de oficio —que
  piden practicar de varias formas— se podían comprar.
- **030 permite los sellos repetibles**: `unique(profile_id, code)` impedía
  que existieran el sello de la temporada 2 y el de la 5 a la vez.

**Borrar una misión con historial ya no borra el historial.** La clave pasa
a `restrict` y la app ofrece retirarla, que es lo que quien pulsa quería de
verdad: que deje de salir. Una misión sin historia se sigue borrando.

Dos cosas que conviene saber:

- **La app aguanta la ventana entre desplegar y migrar.** Si las columnas
  aún no existen, la consulta se repite con las básicas y el motor cae al
  challenge actual, igual que en 2.7.0. Sin ese respaldo el fallo se vería
  como «dejaron de darse insignias».
- **Algún sello de oficio puede dejar de estar a punto** si dos misiones
  que parecían distintas eran la misma actividad. Lo ya concedido no se
  quita, que es la regla.

Se habilitan —pero no se usan todavía— el nivel de ayuda que necesitan los
cuatro sellos de Autonomía y las instancias por temporada. Los seis siguen
sin regla a propósito: conceder por algo que el sistema no puede demostrar
es lo único irreversible.

## 2.7.0 · 19 de agosto de 2026

**El motor de los sellos se enciende: 66 de los 73 ya se pueden ganar.**
Hasta ahora las 80 piezas eran dibujo; desde esta versión hay reglas
detrás y se conceden solas.

`src/lib/sellos-motor.js` calcula una proyección por persona —días,
semanas y meses activos, XP y variedad por habilidad, familias de misión,
pausas— y `src/lib/sellos.js` guarda las reglas como DATOS, no como
funciones, porque un objeto se traduce a SQL el día que esto viva en
Postgres y un `(s) => s.x >= 3` no.

**El anti-farming es real, no decorativo.** Cincuenta misiones un sábado
no abren «cincuenta encargos»: la regla pide además catorce días y tres
semanas. Cien XP repitiendo la misma tarea no abren un camino de oficio:
pide dos familias de misión distintas. Se comprobó en el navegador con un
historial de sesenta misiones en veinte días, y `oficio_hogar_2`
correctamente NO se concedió por faltarle variedad.

**La regla que manda sobre todas: una insignia dada no se quita.** De ahí
salen las tres decisiones que más código ocupan:

- **El historial se trae entero, paginado.** Las 400 completions del
  tablero cubren tres semanas de una familia de cuatro, y «mil días en el
  Gremio» es una pregunta sobre una vida. Se pagina una vez por sesión y
  después solo se pega lo nuevo: paginarlo en cada validación serían
  veinte peticiones por misión.
- **Si el historial puede estar truncado, Regreso y Equilibrio no se
  evalúan.** Son las dos únicas familias que pueden dar un falso
  POSITIVO con datos a medias —con medio historial, la fila más antigua
  siempre parece «volver tras una pausa»—. El resto solo puede quedarse
  corto, que es seguro.
- **Siete sellos se quedan sin regla a propósito.** Los cuatro de
  Autonomía esperan a que exista el nivel de ayuda; los dos repetibles de
  temporada, al modelo de instancias; el de generaciones, a la banda
  evolutiva. Conceder por una condición que el sistema no puede demostrar
  es lo único irreversible.

Dos fallos que solo se vieron abriendo la app:

- **`Coleccionista` se la llevaba quien abriera la app primero.** Contaba
  todas las insignias, y el lote retroactivo sube a un perfil de tres a
  doce de golpe. Ahora cuenta solo las dieciséis de siempre, que es
  contra las que se escribió la regla.
- **Salían dos celebraciones seguidas.** Conceder recarga los datos, y esa
  recarga volvía a conceder. El lote ahora se acumula en vez de
  sustituirse: un desbloqueo múltiple es una sola experiencia, venga en
  una pasada o en tres.

Progreso estrena «Tu historia en el Gremio» con lo conseguido y, de lo que
falta, solo el siguiente escalón de cada serie empezada —nunca los 73 a la
vez—. La bandera `sellosV2` apaga el motor sin desplegar si hiciera falta.

## 2.6.0 · 19 de agosto de 2026

**Las insignias dejan de ser emoji y pasan a ser sellos grabados.** 80
piezas nuevas en `public/assets/insignias/`: las 73 del catálogo v1 que
describen `docs/INSIGNIAS-01..06` más 7 de legado.

El emoji tenía un problema que no se arregla cambiándolo por otro emoji:
🌟 y 👑 pesan lo mismo en pantalla aunque una sea la primera misión y la
otra cincuenta. El sello sí sabe decir cuánto cuesta, porque el **material
es la escala** —bronce → plata → oro → oro con gema → legendaria—. Es la
misma pieza grabada, cada vez en un metal mejor, y se lee sin leer.

Tres cosas que se vieron en el navegador y no en los tests:

- `x10` y `x25` caían las dos en bronce y en la rejilla parecían la misma
  insignia repetida. Ahora las series prestan peldaños **saltados**
  (Trayectoria 01/03/06), y un test lo fija: dos insignias visibles a la
  vez no comparten metal.
- El estado ya no vive solo en el color. `bloqueada` era `opacity:.38 +
  grayscale(1)` sobre la tarjeta entera, que dejaba el texto en ~1,9:1.
  Ahora se atenúa **la imagen**, el texto va a opacidad completa (6,05:1) y
  el estado se dice además con palabras: «Conseguida» / «Aún no».
- 80 PNG a resolución nativa eran 206 MB. En WebP a 192 px son 976 KB, con
  tope propio en `tests/sellos.test.js`: el de `public/assets` defiende la
  carga inicial y estas bajan en diferido, dentro de una pestaña.

Esto es **solo la capa visual**. El motor sigue siendo el de las 16
insignias de `insignias.js`: no se concede nada nuevo, no se evalúa
ninguna condición del catálogo v1 y la economía no se toca. Las 57 piezas
que aún no tienen regla quedan esperando en `src/lib/sellos.js`.

## 2.5.3 · 18 de agosto de 2026

**El ornamento del estandarte deja de ser un recorte.** Se probaron tres
encuadres de `banner-meta.png` y los tres se veían cortados, que es lo que
pasa siempre al recortar un cortinaje con caídas y borlas: no hay línea
por donde partirlo que no parezca rota.

Y entero no cabe. Su dibujo mide 1361×716, o sea **183 px de alto al ancho
de esa tarjeta**: más que todo su contenido junto.

Así que el ornamento se dibuja en vez de recortarse. Un filete dorado que
se desvanece por los lados y un rombo en el centro —el mismo motivo que
remata la filigrana del estandarte—. Pesa cero, funciona a cualquier ancho
y **no puede salir cortado, porque no hay nada que recortar**.

Además ahora hace un trabajo: separa el rango del gremio de la meta, en
lugar de colgar de un borde sin nada encima. La tarjeta recupera los 20 px
de relleno que se le habían reservado al adorno.

Fuera `cresta-gremio.png` y `banner-meta.png`. Los assets bajan de 424 a
356 KB.

---

## 2.5.2 · 18 de agosto de 2026

**El icono del escritorio seguía saliendo como una letra «E».** La 2.5.1
puso PNG de verdad y arregló media causa; faltaba la otra, que es propia
de cómo está montado este sitio.

iOS no se fía solo de las etiquetas del HTML: pide
`/apple-touch-icon.png` y `/apple-touch-icon-precomposed.png` **por su
cuenta**, en la raíz. Y `vercel.json` reescribe todo lo que no existe a
`index.html`, así que esas dos rutas devolvían **200 con HTML**. iOS daba
el 200 por bueno, intentaba decodificarlo como imagen, fallaba, y pintaba
la inicial del nombre. La etiqueta `<link>` correcta no servía de nada
porque el sondeo se resuelve antes.

Ahora existen esos dos ficheros, más `favicon.ico`, que los navegadores
sondean igual. En Vercel el estático gana al rewrite, así que el sondeo
acierta. `icon-180.png` desaparece: lo sustituye `apple-touch-icon.png`,
que es el mismo fichero en la ruta que de verdad se consulta.

Dos tests nuevos: uno comprueba que los tres ficheros están, y el otro que
el rewrite catch-all sigue ahí —que es justamente lo que los hace
necesarios—, para que quien los vea algún día y le parezcan duplicados
encuentre el porqué antes de borrarlos.

**Hay que reinstalar la PWA para verlo**: el icono viejo se queda en el
escritorio hasta que se borra el acceso y se vuelve a añadir.

---

## 2.5.1 · 18 de agosto de 2026

Dos cosas que solo se ven usando la app instalada en un móvil.

**La pantalla de la peque se podía arrastrar y salirse del teléfono.** Su
cabecera iba a sangre con `width:100vw` + `margin-left:50%` +
`transform:translateX(-50%)`. El transform la devolvía a su sitio a la
vista, pero **los transforms no cuentan para `scrollWidth`**: la caja de
layout seguía empezando en el 50 % y midiendo 100vw, o sea 563 px dentro
de un contenedor de 375. Y como `.kid` tiene `overflow-y:auto` —que por la
regla de CSS de que `visible` no puede convivir con otro valor fuerza
`overflow-x:auto`—, esos 188 px se convertían en scroll horizontal.

Ahora va a sangre con márgenes negativos que anulan el padding del
contenedor. Se ve exactamente igual y no desborda nada, ni a 375 px ni a
1280. El margen lateral es **una sola variable** usada por el padding y
por la cabecera, para que no puedan volver a desincronizarse; la media
query de pantalla ancha mueve la variable, no el padding.

Y las dos capas fijas que hacen scroll —el tablero de la peque y su
tienda— llevan ya `overscroll-behavior: contain`, que es lo que impide
que el rebote elástico de iOS se propague al documento. Es el mismo
remedio que ya usaban los diálogos.

**El icono de la app instalada no era el del gremio.** El
`apple-touch-icon` apuntaba a un SVG, y **iOS no admite SVG ahí**: al no
poder leerlo, ponía en el escritorio una miniatura de la web. Ahora hay
PNG de verdad —180 para iOS, 192 y 512 para el manifiesto, y un
**maskable** de 512 con el emblema más pequeño porque Android recorta
hasta el 20 % exterior según la forma del lanzador—. El manifiesto declara
tamaños y tipo, los avisos usan el PNG (un SVG tampoco se pinta de forma
fiable en una notificación), y los colores pasan al índigo nuevo #141428.
El `icon.svg` viejo ya no lo referencia nadie y se ha ido.

Siete tests nuevos: cuatro vigilan que la cabecera no vuelva al truco de
`100vw` y que las capas contengan el rebote; tres, que el
`apple-touch-icon` siga siendo PNG y que el manifiesto no pierda el
maskable.

---

## 2.5.0 · 18 de agosto de 2026

La estética entera, según la guía de assets y la propuesta «el taller
nocturno». La app deja de dibujarse con emojis del sistema y pasa a tener
piezas propias.

- **Paleta**: índigo #141428 y superficies #1D1D36, oro Talis
  #F2B33D→#FFD77A, teal #4FC4B5 para el progreso, y el mundo de la peque
  con su pergamino, su estrella y su coral.
- **Tres voces**: Fraunces en títulos, niveles y rangos —suena a sello
  grabado sin caer en lo medievaloide—, Inter en todo lo que hay que leer
  a las diez de la noche, y Baloo 2 **solo** en la pantalla de la peque.
- **Piezas propias**: emblema del gremio en el acceso, la ficha de Talis
  en la Bolsa, la gema de nivel, los ocho iconos de habilidad grabados,
  las estrellas de la peque, el fondo del taller y el grano de pergamino
  en las tarjetas.
- **El dorado deja de decorar.** Siete usos que eran cromo —el anillo de
  foco, las pastillas elegidas, los puntos del carrusel, los toggles—
  pasan al teal. El oro se queda donde reconoce: XP, Talis, insignias,
  meta, rachas y celebración. Ahora, si algo brilla en dorado, alguien ha
  cumplido.
- **Las barras de habilidad** degradan teal→oro sobre el carril entero,
  no sobre lo recorrido: con lo segundo, una habilidad al 4 % salía
  dorada de punta a punta y el color decía «maestría» donde había cuatro
  por ciento.

**Los assets traían marca de agua.** Las dieciséis piezas llevaban un
«AI生成» en la esquina inferior izquierda, invisible sobre blanco y
perfectamente visible sobre el índigo de la app, que es donde se usan.
Están limpias: alfa a cero en las transparentes y un parche clonado en
las dos opacas. Hay una comprobación que las repasa todas.

**Y pesan 424 KB en vez de 11 MB**: cada pieza redimensionada a 2-3× su
tamaño real en pantalla, y las dos opacas —fondo y pergamino— a JPEG,
que para eso no tienen transparencia que conservar.

Dos cosas que la guía pedía y se hicieron de otra forma, las dos por el
mismo motivo —lo que ya sabe este proyecto pesa más que la especificación—:

1. **El fondo NO va en el body con `background-attachment: fixed`**, que
   es lo que dice la guía. Va en la capa `.ambiente`, que ya es
   `position: fixed` y da el mismo resultado. El atajo de la guía
   reabriría el bug del fondo que parpadeaba en Safari de iOS, uno de los
   tres más caros de esta app.
2. **Del estandarte de la meta se usa solo su cresta dorada.** A tamaño
   real pedía 70 px de alto en una tarjeta que solo tiene rango y barra,
   y de membrete tenue por detrás ensuciaba el texto justo donde hay que
   leer.

---

## 2.4.1 · 18 de agosto de 2026

Tres fallos del alta de mascotas, encontrados usándola por primera vez.
Los tres venían de la 2.3.0: la funcionalidad se construyó entera antes de
darle de alta a un animal ni una sola vez.

- **En el alta inicial del gremio se podía elegir el rol «Mascota», y eso
  rompía el alta entera.** El desplegable salía de `ROLE_LABEL`, que
  incluye «mascota», pero el insert no manda `species`; Postgres rechaza
  esa fila por `profiles_especie_coherente` y con ella **las de toda la
  familia**, porque van en un solo insert. Quien lo intentara no podía
  terminar de fundar su gremio. El paso ahora ofrece solo los tres roles
  de persona y dice dónde se dan de alta los animales.
- **Elegir perro o gato no se veía.** Las pastillas se marcaban con la
  clase `.activa`, que no existe para `.pastilla-habilidad` —el CSS solo
  tiene `.sel`, que es la que usan las otras tres pastillas de la app—.
  El clic funcionaba y el estado cambiaba, pero en pantalla no pasaba
  nada, así que parecía que la app no dejaba elegir especie.
- **No había avatar de perro ni de gato**, así que a la mascota de la casa
  había que ponerle cara de zorro y la lista de miembros dejaba de leerse
  de un vistazo. Ahora están, al final de la lista para no quitarle sitio
  a nadie en el alta inicial —que enseña solo los ocho primeros y ahí no
  se crean animales—, y al elegir especie la app ya propone la cara que
  toca.

**Y la razón de fondo, que es lo que hay que arreglar de verdad:** el
backend simulado **no comprobaba la coherencia de especie** y Postgres sí.
Un demo más permisivo que la base es peor que no tener demo: da luz verde
a lo que va a romperse en casa de alguien. Ahora la comprueba, con el
mismo mensaje de error, y hay cinco tests nuevos —incluido uno que falla
si alguien vuelve a marcar una pastilla con una clase que el CSS no
define—.

---

## 2.4.0 · 18 de agosto de 2026

Las monedas pasan a llamarse **Talis**, y el cambio no es de vocabulario.

Una moneda dice, sin necesidad de añadir nada, «te pago por hacer esto».
Es exactamente el marco que el resto de la app lleva desde el primer día
intentando no instalar: el tutorial abre advirtiendo que un sistema de
«tarea hecha, moneda cobrada» se apaga en la semana tres, y a la vez la
interfaz decía «monedas» en catorce sitios. El nombre trabajaba en contra
del diseño.

Un **Talis** no es un pago: es una ficha de reconocimiento. La mecánica es
idéntica —se gana validando misiones, se gasta en la tienda—, pero lo que
el sistema dice al entregarla cambia: no mide lo que vale la misión, marca
que alguien ha contribuido al Gremio.

Qué trae:

- **Vocabulario en un solo sitio**, `src/lib/talis.js`: el nombre, la
  Bolsa de Talis, la Casa de Recompensas, el lema y el formateador
  `talis(n)`, que existe porque Talis no pluraliza y eso se olvida en la
  pantalla número catorce.
- **El lore, en la narrativa**: sección nueva en la exposición pública
  —qué es un Talis, la leyenda del origen, las cuatro cosas que
  representa, Talis frente a insignias— y la leyenda también dentro de la
  app, en el paso del tutorial que antes se llamaba «Las monedas son un
  andamio».
- **La regla que sostiene el resto**, ahora escrita y con test: *los Talis
  se ganan, las insignias se merecen*. Ninguna cantidad compra una
  insignia.
- **La Crónica de los Talis**, en Progreso y debajo de las insignias: la
  historia se abre en cuatro fragmentos, por Talis **ganados** en total y
  no por saldo —si fuera por saldo, gastar en la tienda borraría el
  relato—. Los cerrados se ven apagados y dicen qué falta para abrirlos,
  porque un hueco vacío no se busca. El cuarto pide además una insignia:
  es el que explica por qué esas no se compran.
- **Rigor histórico separado de la ficción** en `docs/TALIS.md`. Los Talis
  son inventados; los gremios europeos, el aprendizaje por oficio y los
  sellos corporativos de los que toma prestado, no. En ninguna pantalla se
  dice lo contrario.
- La celebración de una misión validada dice ahora también los Talis
  ganados, detrás de la XP y por delante del elogio, que sigue siendo lo
  que más pesa.

**No hay migración, y es deliberado.** En Postgres la columna se sigue
llamando `coins` y `redeem_reward` sigue devolviendo `'sin_monedas'`. El
lore separa el concepto funcional del nombre narrativo, y esa separación
es justo lo que permite cambiar el relato sin tocar funciones que abonan
dentro de una transacción. Dos tests vigilan la frontera.

Sin cambios para la peque: a los tres años sus Talis se siguen dibujando
como estrellas, sin cifras.

---

## 2.3.1 · 18 de agosto de 2026

La narrativa cuenta ya los perfiles de mascota, y cuenta lo importante:
**por qué los trucos no son diarios** cuando toda la app premia la
constancia diaria. Es lo más contraintuitivo del sistema y ahora está
explicado con su evidencia, en vez de parecer un descuido.

Y queda decidido, en vez de ocurrir por omisión: **el XP de la mascota
suma a la meta compartida del gremio**. El trabajo es de la casa y la meta
es de todos, así que cuidar al animal no es un juego paralelo. Lo que no
cambia: ese XP es de la mascota, no de quien la cuida.

## 2.3.0 · 18 de agosto de 2026

**Perfiles de mascota: perro o gato, con misiones y premios propios.**

La justificación, con la literatura, está en `docs/MASCOTAS.md`. Lo que
hay que saber al usarlo:

- **Se da de alta en Miembros** eligiendo el rol «Mascota» y la especie, y
  **llega con su catálogo puesto**: nueve misiones y cinco premios. Sin
  eso habría que escribirlos a mano y nadie lo haría.
- **Los trucos NO son diarios**, y es lo más contraintuitivo de la app:
  entrenar a diario se aprende PEOR que espaciarlo (Demant et al. 2011),
  así que salen en días alternos y con la sesión marcada en 5 minutos.
  Los hábitos —comida, agua, arenero, paseo— sí son diarios, porque ahí
  la constancia no es una técnica de aprendizaje sino una necesidad.
- **Sus misiones las apunta un adulto** desde la pestaña Mascotas del
  panel, y quedan aprobadas en el acto: no hay a quién validárselas. Queda
  guardado quién las apuntó.
- **El XP va a la mascota**, no a quien la cuida.
- **Para el gato, los premios son juego y atención, no comida**: el 50 %
  de los gatos prefiere interacción social humana (Vitale Shreve 2017).
- **Ninguna misión es aversiva**, y hay un test que lo vigila (AVSAB 2021).

Y tres exclusiones, porque una mascota no es un jugador: no sale en el
selector de perfiles, no recibe avisos, y no hereda las misiones genéricas
de la casa.

## 2.2.0 · 18 de agosto de 2026

**Recordatorio de que los avisos están sin activar.**

Sale de una medición, no de una intuición: ese día, de ocho perfiles
activos, **cinco no tenían ningún aparato registrado**. El sistema les
escribía avisos en `push_log` que no salían a ninguna parte, y no se
notaba porque la app funciona igual y el registro dice que el aviso «se
apuntó». Los tres que esa tarde tenían motivo `vuelve` —«hace días que no
apareces»— eran de los que no podían recibirlo.

- **En el Setup**, un paso nuevo explica qué son, cuándo llegan y dónde se
  activan. No los activa: durante el alta el gremio todavía no existe y el
  permiso se concede aparato por aparato.
- **En el panel parental**, un aviso arriba del todo mientras este
  dispositivo no los tenga, con el número de miembros del gremio que no
  recibirían nada. Lleva a 🔔 Avisos con la sección ya abierta.
- **Se puede callar** con «Dejar de mostrar», y entonces explica la ruta
  para activarlos más tarde. El olvido se guarda **en el aparato**, no en
  la base: una suscripción pertenece a la instalación, así que guardarlo
  por perfil lo escondería en el móvil de al lado, donde sigue haciendo
  falta.
- **No insiste cuando no serviría de nada**: si el navegador ya los
  bloqueó, si el aparato no puede o si falta la clave del despliegue, se
  calla. El botón al que llevaría tampoco funcionaría.

## 2.1.0 · 18 de agosto de 2026

Dos cosas que pidió la familia después de los primeros días de uso real.

**Encender una misión es un toque.** Antes había que abrir el lápiz,
bajar al par Activa/Pausada del final del formulario, pulsarlo y guardar:
cuatro pasos y un modal para cambiar un booleano. Ahora:

- En **Panel → Peque**, cada misión lleva su botón ▶/⏸ al lado del lápiz,
  el mismo que ya tenían los premios. Las activas suben arriba y la
  cabecera dice cuántas están en pausa.
- En **Panel → Misiones**, las pausadas dejan de estar solo detrás de la
  biblioteca: se despliegan al final de la lista, con su destino y sus
  puntos, y se reencienden con un «▶ Activar». Siguen fuera de las listas
  de cada persona a propósito —eran treinta tarjetas al 50 % de opacidad
  de cosas que no están pasando—, pero ya no hay que ir a buscarlas a un
  catálogo para volver a encender algo que ya existe.

**Premios de arranque, por debajo de 250 monedas.** El premio más barato
del catálogo cuesta 325, o sea ocho o nueve días de la junior, así que los
primeros días abría la tienda y no podía tocar nada. Seis premios nuevos
de 80 a 240 monedas —de dos a seis días— cubren ese hueco y encadenan con
las 325 del catálogo sin dejar salto.

No son un nivel nuevo, son andamio, y el código los trata como tal:

- Son **decisiones, no cosas**, igual que el nivel 1: elegir la música,
  elegir la cena, quedarse un rato más.
- **No entran en el diagnóstico de la economía.** De paso se arregló que
  los premios de la peque sí entraban: en una casa con peque, el nivel 1
  salía con un precio medio de 190 monedas y el panel avisaba de que «se
  consigue demasiado rápido» un premio de 325.
- **No suben de precio al cambiar de temporada.** Encarecerlos no les
  añade dificultad, les quita el sentido.
- **Están pensados para retirarse** cuando el hábito se sostenga solo, y
  la pantalla que los añade lo dice.

Se añaden desde **Panel → Premios**, con un aviso que solo sale si de
verdad hace falta y que lleva la cifra delante: cuántos días de la junior
cuesta lo más barato que hay. Esa misma pantalla ofrece los premios de la
peque cuando faltan, que era un pendiente conocido de los gremios creados
antes del setup de agosto.

## 2.0.0 · 17 de agosto de 2026

Todo lo que salió entre el 15 y el 17 de agosto. Fueron **55 despliegues y
102 commits con el número parado en 1.0.0**, porque la versión es un campo
a mano de `package.json` y nadie la tocó nunca; lo que identificaba cada
despliegue era el hash del commit. A partir de aquí se numera, y
`npm run deploy` avisa si se olvida.

Es MAYOR porque el criterio se cumplió varias veces: hubo migraciones tras
las cuales un cliente antiguo interpreta mal los datos, no solo se queda
sin funciones.

### La app
- Modo peque completo: pantalla propia, tarro de estrellas, tienda a su
  escala, tres minijuegos que rotan por día y fiesta al completar el día.
- Sistema de habilidades: cada misión entrena una de ocho competencias,
  con rangos y elogio específico al validar.
- Misiones dirigidas a una persona, a un rol o a un grupo; agrupadas por
  persona y frecuencia; con planificación por días de la semana.
- Validar o **no** validar con motivo, que quien la hizo ve en su tablero.
- Historial semanal navegable hacia atrás.
- Temporadas del gremio, insignias con superpoder y premio a mano.
- Concordancia de género por perfil, con forma neutra reescrita.

### La casa
- Dominio propio: **elgremioapp.com**.
- Avisos push sin servidor propio.
- Correo propio con SMTP y plantillas en español.
- Captcha de Turnstile y textos legales con aceptación en el alta.
- CSP estricta, CI en cada empujón y despliegue desde Actions.
- Licencia AGPL-3.0.
- Preparada para más de una familia.

### Economía
Recalculada de arriba abajo y con tests que la sostienen: cadencias de
premio a 15/30/45 días, meta a 60, presupuesto de 8 misiones-diarias
equivalentes por persona (7 diarias, 5 semanales, 8 mensuales) y aviso
cuando alguien se pasa.

---

## 1.0.0 · 15 de agosto de 2026

El prototipo inicial: misiones, XP, monedas, premios, insignias y meta
cooperativa, con la capa de producción y la gestión de miembros.
