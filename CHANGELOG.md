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
