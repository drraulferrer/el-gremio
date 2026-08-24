# El retrato del gremialista

Estado: **en producción desde el 24-ago-2026** (2.24.0). Migración 035
ejecutada y trigger verificado contra la base real.

Un perfil deja de ser un emoji y pasa a ser una figura por capas que gana
equipo al subir de nivel. El emoji no desaparece: sigue siendo el respaldo
y lo único que llevan las mascotas.

---

## 1. La idea, y las dos que se descartaron

Se valoraron cuatro formas de darle imagen a un personaje. Dos se
descartaron por chocar con algo que el proyecto ya tenía escrito:

- **Constructor de avatar con cosméticos comprables.** Habría convertido
  los Talis en el motor. El README dice lo contrario: «los Talis son un
  andamio», y el catálogo de premios «prioriza decisiones sobre cosas».
  Desbloquear gorros es exactamente la economía de cosas que esta app
  decidió no tener.
- **Un compañero virtual que crece.** «Mascota» ya significa aquí un perro
  o un gato **de verdad**, con perfil propio (migración 027). Un segundo
  bicho habría vuelto ambigua la palabra en toda la app.

Lo que sí se hizo es la mezcla de las dos partes buenas: **figura por
capas** cuyo equipo **lo desbloquea el nivel, no la tienda**. Encaja
porque la XP no se gasta: usarla para desbloquear no compite con nada.

## 2. Lo que identifica y lo que crece

La separación es la pieza central del diseño:

| | Quién lo pone | Cambia |
|---|---|---|
| Piel, pelo, peinado, color | La persona, en Miembros | Solo si lo cambia |
| Equipo (túnica → farol) | La escalera de fases | Al subir de nivel |

Cada pieza está dibujada **una vez** y anclada a `hombro`, `cintura` y
`mano`. Sin ese anclaje el set sería multiplicativo: nueve fases × doce
peinados = más de cien dibujos. Con él es lineal.

## 3. La escalera

Nueve fases, tope en el nivel 50. Los niveles no son números redondos y no
es descuido: la curva `50·L·(L-1)` es cuadrática, así que repartir fases
cada N niveles daría saltos de tiempo que crecen sin freno. Están puestas
en **hitos de calendario** de un adulto con los supuestos de
`economia.js` (48 XP/día; la junior gana 72 y llega antes).

| Fase | Nivel | Nombre | Equipo que añade | Adulto |
|---|---|---|---|---|
| 1 | 1 | Aprendiz | Túnica y cinto de cuerda | día 0 |
| 2 | 3 | Ayudante | Pañuelo al cuello | 6 d |
| 3 | 6 | Artesana/o | Delantal del taller | 31 d |
| 4 | 10 | Forjadora/or | Cinto con hebilla · **primer oro** | 94 d |
| 5 | 14 | Maestra/o | Manto corto | 190 d |
| 6 | 20 | Decana/o | Broche del gremio | 396 d |
| 7 | 27 | Guardiana/án | Farol, aún apagado | 731 d |
| 8 | 38 | Insigne | **Farol encendido** | 1465 d |
| 9 | 50 | Custodia/io del taller | Filigrana en el manto | 2552 d |

Por encima del 50 la fase se queda en la 9. El nivel sigue subiendo: lo
que se acaba es el dibujo, no el progreso.

El oro entra en la fase 4 y la luz se enciende en la 8, siguiendo la regla
de `styles.css`: **el dorado no decora, reconoce**.

## 4. Las tres reglas que no se negocian

**La marca de agua.** La fase se calcula contra `xp_maxima`, nunca contra
`xp`. Deshacer devuelve la XP, y si el personaje se desvistiera al
deshacer, un adulto corrigiendo un toque equivocado le estaría quitando el
manto a alguien: deshacer pasaría a sentirse como un castigo y la familia
dejaría de hacerlo. Lo mantiene un trigger en Postgres, no el cliente,
porque hay cuatro caminos que tocan `xp` y bastaría que uno se olvidara.
Es el mismo razonamiento que sostiene el rango del Estandarte.

**El recorte a la cabeza.** Por debajo de 64 px se dibuja solo la cabeza
con su aro. Un cuerpo entero a 30 o 40 px es una mancha: no se distingue
quién es. Y pasar el umbral no basta para que MEREZCA la pena: el picker
se probó a 72 px con cuerpo y el farol salía como una caja gris suelta,
además de perderse el aro. Las listas piden `vista="cabeza"` aunque
quepan; el equipo se mira en la ficha.

**El disco de fondo en el tablero.** Un miembro de pelo y piel oscuros se
disolvía en el índigo a 30 px y quedaba el aro flotando sin cara dentro.
En pergamino no hace falta.

## 5. Las mascotas

Se quedan con emoji, dentro de un medallón que les da el mismo aro y el
mismo tamaño que a las personas. Sin arco: una mascota no tiene fase. No
es solo que falten piezas de perro, es que meter un animal en una escalera
de aprendiz a maestra diría algo que este proyecto no quiere decir. Lo
sujeta un CHECK, `profiles_retrato_solo_personas`.

## 6. Lo que queda

- Nadie ha elegido sus piezas todavía: los once perfiles salen con los
  valores por defecto hasta que cada cual entre en Miembros y se monte el
  suyo. No es un fallo, es el estado inicial.
- El arco del aro hace comparables a los miembros en el picker. Se aceptó
  a sabiendas (24-ago-2026): la `Gema` ya enseñaba el nivel ahí al lado.
- Solo hay tres peinados. Añadir uno es una pieza SVG y una migración que
  amplíe el CHECK.

El prototipo con el que se decidió todo esto está en
[`prototipos/retrato.html`](prototipos/retrato.html): se abre en cualquier
navegador y enseña la escalera entera y las pruebas de tamaño.
