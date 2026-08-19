// ------------------------------------------------------------------
// Las zonas de la casa: el mapa sobre el que limpia el modo limpieza.
//
// Hasta la 2.10.0 las campañas de zona y de limpieza profunda eran una
// lista fija —cinco zonas y seis estancias, las de la casa de quien
// escribió el catálogo—. Pero ninguna casa es esa casa: hay chalets con
// dos baños, pisos sin cuarto de juegos y buhardillas que ningún
// catálogo conoce. Desde la 2.11.0 cada gremio tiene SUS zonas
// (`zonas_casa`, migración 032): se siembran en el setup con una
// pregunta sobre la vivienda, y se añaden, renombran o quitan cuando la
// casa cambie, desde ⚙️ → Casa.
//
// Tres decisiones de diseño, con su porqué:
//
//  1. LAS PLANTAS NO SE MODELAN. Un chalet no necesita una entidad
//     «planta»: necesita que sus dos baños se llamen «Baño de arriba» y
//     «Baño de abajo». La planta solo decide NOMBRES en la generación,
//     igual que el patrón semanal evitó modelar semanas: el problema
//     desaparece por construcción en vez de resolverse con esquema.
//  2. Cada zona lleva una PLANTILLA (cocina, baño, dormitorio…) que es
//     de donde salen sus tareas. Renombrar «Baño» a «Baño de la peque»
//     no cambia qué se limpia en un baño; una zona rara («Buhardilla»)
//     usa la plantilla genérica, que limpia lo que toda estancia tiene.
//  3. SIN ZONAS GUARDADAS, EL MODO LIMPIEZA FUNCIONA IGUAL: cae a las
//     zonas por defecto (las de siempre, virtuales). Un gremio anterior
//     a la 032, o uno que saltó la pregunta, no pierde nada; solo gana
//     cuando configura las suyas.
//
// El modo «compañeros de piso» (families.tipo_gremio = 'piso') añade
// las zonas PRIVADAS: la habitación de cada conviviente, con dueño. En
// una campaña, lo de la habitación de alguien se le sugiere a ese
// alguien; las comunes se reparten como siempre.
// ------------------------------------------------------------------

const TODOS = ['peque', 'junior', 'adulto']
const MAYORES = ['junior', 'adulto']
const ADULTO = ['adulto']

// ------------------------------------------------------------------
// Las plantillas: qué se limpia en cada clase de estancia
//
// `semanal` es la pasada de la zona de la semana (7 días); `fondo`, la
// limpieza profunda (3 días). Mismo formato de tarea que el resto del
// modo limpieza: t, e, roles aptos y esfuerzo. Lo que lleva químicos,
// horno o altura sigue siendo solo de personas adultas.
// ------------------------------------------------------------------

export const PLANTILLAS_ZONA = {
  cocina: {
    id: 'cocina',
    nombre: 'Cocina',
    emoji: '🍳',
    semanal: [
      { t: 'Limpiar los electrodomésticos por fuera', e: '🍞', roles: ['junior'], esf: 'rapida' },
      { t: 'Limpiar y desinfectar las encimeras', e: '🧴', roles: ADULTO, esf: 'rapida' },
      { t: 'Fregar el fregadero y el grifo', e: '🚰', roles: MAYORES, esf: 'rapida' },
      { t: 'Ordenar la despensa', e: '🥫', roles: MAYORES, esf: 'media' },
      { t: 'Retirar los productos caducados', e: '🗓️', roles: ADULTO, esf: 'rapida' },
      { t: 'Limpiar el microondas por dentro', e: '♨️', roles: ADULTO, esf: 'rapida' },
      { t: 'Repasar el frigorífico y sus huecos', e: '🧊', roles: ADULTO, esf: 'media' },
      { t: 'Barrer y fregar el suelo de la cocina', e: '🧹', roles: MAYORES, esf: 'media' },
      { t: 'Emparejar los táperes con sus tapas', e: '🥡', roles: ['peque'], esf: 'rapida' }
    ],
    fondo: [
      { t: 'Vaciar y limpiar los armarios por dentro', e: '🗄️', roles: ADULTO, esf: 'intensa' },
      { t: 'Limpiar el frigorífico y el congelador a fondo', e: '🧊', roles: ADULTO, esf: 'intensa' },
      { t: 'Limpiar el horno', e: '♨️', roles: ADULTO, esf: 'intensa' },
      { t: 'Limpiar el microondas por dentro y por fuera', e: '📦', roles: ADULTO, esf: 'media' },
      { t: 'Limpiar los pequeños electrodomésticos', e: '🍞', roles: ['junior'], esf: 'media' },
      { t: 'Fregar el fregadero y los grifos a fondo', e: '🚰', roles: ADULTO, esf: 'media' },
      { t: 'Barrer a fondo esquinas y debajo de los muebles', e: '🧹', roles: ADULTO, esf: 'media' },
      { t: 'Fregar el suelo de la cocina', e: '🪣', roles: MAYORES, esf: 'media' },
      { t: 'Limpiar el cubo de basura por dentro y por fuera', e: '🗑️', roles: ADULTO, esf: 'media' },
      { t: 'Ordenar los cajones de la cocina', e: '🥄', roles: ['junior'], esf: 'media' },
      { t: 'Retirar esponjas viejas y reponer los paños', e: '🧽', roles: ['peque', 'junior'], esf: 'rapida' }
    ]
  },

  bano: {
    id: 'bano',
    nombre: 'Baño',
    emoji: '🛁',
    semanal: [
      { t: 'Limpiar los espejos del baño', e: '🪞', roles: ['junior'], esf: 'rapida' },
      { t: 'Limpiar el inodoro, la bañera y el lavabo', e: '🚽', roles: ADULTO, esf: 'media' },
      { t: 'Fregar el suelo del baño', e: '🧹', roles: MAYORES, esf: 'rapida' },
      { t: 'Reponer el papel higiénico', e: '🧻', roles: ['peque'], esf: 'rapida' },
      { t: 'Cambiar toallas y alfombrillas', e: '🧺', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Vaciar la papelera del baño', e: '🗑️', roles: ['peque', 'junior'], esf: 'rapida' }
    ],
    fondo: [
      { t: 'Vaciar estantes y retirar los productos caducados', e: '🧴', roles: ADULTO, esf: 'media' },
      { t: 'Limpiar la mampara o la cortina de la ducha', e: '🚿', roles: ADULTO, esf: 'intensa' },
      { t: 'Fregar azulejos y juntas', e: '🧱', roles: ADULTO, esf: 'intensa' },
      { t: 'Limpiar el inodoro completo, tanque y base', e: '🚽', roles: ADULTO, esf: 'media' },
      { t: 'Fregar el lavabo y el grifo con cepillo', e: '🪥', roles: ADULTO, esf: 'media' },
      { t: 'Limpiar los espejos', e: '🪞', roles: ['junior'], esf: 'rapida' },
      { t: 'Lavar alfombrillas y cortinas', e: '🧺', roles: ['junior'], esf: 'media' },
      { t: 'Fregar el suelo a fondo, esquinas incluidas', e: '🪣', roles: ADULTO, esf: 'media' },
      { t: 'Limpiar la rejilla de ventilación', e: '💨', roles: ADULTO, esf: 'media' },
      { t: 'Reponer papel y jabón', e: '🧼', roles: ['peque'], esf: 'rapida' }
    ]
  },

  dormitorio: {
    id: 'dormitorio',
    nombre: 'Dormitorio',
    emoji: '🛏️',
    semanal: [
      { t: 'Cambiar las sábanas', e: '🛏️', roles: MAYORES, esf: 'media' },
      { t: 'Quitar el polvo de los muebles', e: '🪶', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Despejar mesitas y cómodas', e: '🕯️', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Ordenar cajones y armario', e: '🗄️', roles: ['junior'], esf: 'media' },
      { t: 'Guardar la ropa que quedó fuera', e: '👚', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Aspirar y fregar el suelo', e: '🌀', roles: ADULTO, esf: 'media' },
      { t: 'Limpiar los espejos', e: '🪞', roles: ['junior'], esf: 'rapida' },
      { t: 'Rescatar lo que vive debajo de la cama', e: '🔦', roles: ['peque', 'junior'], esf: 'rapida' }
    ],
    fondo: [
      { t: 'Lavar toda la ropa de cama y el protector', e: '🛏️', roles: ADULTO, esf: 'media' },
      { t: 'Voltear el colchón', e: '🔄', roles: ADULTO, esf: 'media' },
      { t: 'Quitar el polvo en alto y limpiar las lámparas', e: '💡', roles: ADULTO, esf: 'media' },
      { t: 'Vaciar el armario, revisar y separar para donar', e: '🧥', roles: ADULTO, esf: 'intensa' },
      { t: 'Ordenar los cajones', e: '🗄️', roles: ['junior'], esf: 'media' },
      { t: 'Limpiar debajo de la cama', e: '🔦', roles: ['junior'], esf: 'media' },
      { t: 'Limpiar ventanas y espejos', e: '🪟', roles: ['junior'], esf: 'media' },
      { t: 'Aspirar a fondo, alfombras incluidas', e: '🌀', roles: ADULTO, esf: 'media' },
      { t: 'Guardar la ropa de otra temporada', e: '📦', roles: ADULTO, esf: 'media' },
      { t: 'Llevar juguetes y cuentos a su sitio', e: '🧸', roles: ['peque'], esf: 'rapida' }
    ]
  },

  salon: {
    id: 'salon',
    nombre: 'Salón',
    emoji: '🛋️',
    semanal: [
      { t: 'Recoger juguetes y libros del salón', e: '🧸', roles: ['peque'], esf: 'rapida' },
      { t: 'Quitar el polvo de estantes y marcos', e: '🖼️', roles: ['junior'], esf: 'rapida' },
      { t: 'Limpiar pantallas y mandos', e: '📺', roles: ['junior'], esf: 'rapida' },
      { t: 'Aspirar el sofá y debajo de los cojines', e: '🛋️', roles: ADULTO, esf: 'media' },
      { t: 'Sacudir las alfombras', e: '🧶', roles: MAYORES, esf: 'media' },
      { t: 'Aspirar y fregar el suelo del salón', e: '🌀', roles: MAYORES, esf: 'media' },
      { t: 'Ordenar cables y cargadores', e: '🔌', roles: ['junior'], esf: 'rapida' },
      { t: 'Colocar cojines y mantas', e: '🛋️', roles: ['peque'], esf: 'rapida' }
    ],
    fondo: [
      { t: 'Quitar polvo y telarañas de techos y lámparas', e: '💡', roles: ADULTO, esf: 'media' },
      { t: 'Aspirar los sofás y debajo de los cojines', e: '🛋️', roles: ADULTO, esf: 'media' },
      { t: 'Mover los muebles y limpiar debajo', e: '🪑', roles: ADULTO, esf: 'intensa' },
      { t: 'Limpiar pantallas y aparatos electrónicos', e: '📺', roles: ['junior'], esf: 'media' },
      { t: 'Ordenar cables y mandos', e: '🔌', roles: ['junior'], esf: 'rapida' },
      { t: 'Vaciar, limpiar y reordenar las estanterías', e: '📚', roles: MAYORES, esf: 'media' },
      { t: 'Lavar cojines y mantas', e: '🧺', roles: ADULTO, esf: 'media' },
      { t: 'Limpiar los cristales', e: '🪟', roles: ADULTO, esf: 'media' },
      { t: 'Fregar el suelo y sacudir las alfombras', e: '🪣', roles: ADULTO, esf: 'intensa' },
      { t: 'Retirar revistas y papeles viejos', e: '📰', roles: ['junior'], esf: 'rapida' },
      { t: 'Sacudir decoraciones y marcos de fotos', e: '🖼️', roles: ['peque', 'junior'], esf: 'rapida' }
    ]
  },

  entrada: {
    id: 'entrada',
    nombre: 'Entrada y comedor',
    emoji: '🚪',
    semanal: [
      { t: 'Sacudir el felpudo', e: '🚪', roles: TODOS, esf: 'rapida' },
      { t: 'Organizar zapatos y abrigos', e: '🥾', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Limpiar la puerta y la manija', e: '🚪', roles: ['junior'], esf: 'rapida' },
      { t: 'Quitar el polvo de la entrada', e: '🪶', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Limpiar la mesa y las sillas del comedor', e: '🪑', roles: MAYORES, esf: 'media' },
      { t: 'Barrer y fregar la entrada y el comedor', e: '🧹', roles: MAYORES, esf: 'media' },
      { t: 'Limpiar espejos y cristales', e: '🪞', roles: MAYORES, esf: 'rapida' },
      { t: 'Quitar las telarañas de las esquinas altas', e: '🕸️', roles: ADULTO, esf: 'rapida' }
    ],
    fondo: [
      { t: 'Despejar la entrada y clasificar qué se queda', e: '📦', roles: ADULTO, esf: 'media' },
      { t: 'Vaciar y limpiar el zapatero', e: '🥾', roles: ['junior'], esf: 'media' },
      { t: 'Limpiar la puerta principal y la manija', e: '🚪', roles: ['junior'], esf: 'rapida' },
      { t: 'Limpiar paredes e interruptores', e: '🖐️', roles: ADULTO, esf: 'media' },
      { t: 'Sacudir y lavar los felpudos', e: '🧶', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Barrer y fregar esquinas y debajo de los muebles', e: '🧹', roles: ADULTO, esf: 'media' },
      { t: 'Limpiar espejos y cristales de la entrada', e: '🪞', roles: ['junior'], esf: 'rapida' },
      { t: 'Ordenar el paragüero y los bancos', e: '☂️', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Limpiar las lámparas de la entrada', e: '💡', roles: ADULTO, esf: 'media' }
    ]
  },

  lavadero: {
    id: 'lavadero',
    nombre: 'Lavadero',
    emoji: '🧺',
    semanal: [
      { t: 'Poner y tender una lavadora', e: '🌊', roles: MAYORES, esf: 'media' },
      { t: 'Doblar y repartir la ropa limpia', e: '👕', roles: TODOS, esf: 'media' },
      { t: 'Emparejar calcetines', e: '🧦', roles: ['peque'], esf: 'rapida' },
      { t: 'Vaciar y ordenar los cestos de ropa', e: '🧺', roles: ['junior'], esf: 'rapida' },
      { t: 'Reponer detergente y productos de lavado', e: '🧴', roles: ADULTO, esf: 'rapida' }
    ],
    fondo: [
      { t: 'Hacer un ciclo vacío para limpiar la lavadora', e: '🌊', roles: ADULTO, esf: 'media' },
      { t: 'Limpiar las gomas y los cajetines del detergente', e: '🫧', roles: ADULTO, esf: 'media' },
      { t: 'Limpiar el filtro de la secadora o el tendedero', e: '💨', roles: ADULTO, esf: 'media' },
      { t: 'Mover las máquinas y limpiar debajo y detrás', e: '🪑', roles: ADULTO, esf: 'intensa' },
      { t: 'Vaciar y limpiar estantes y armarios del lavadero', e: '🗄️', roles: ADULTO, esf: 'media' },
      { t: 'Limpiar y desinfectar los cestos de la ropa', e: '🧺', roles: ['junior'], esf: 'media' },
      { t: 'Barrer y fregar el suelo', e: '🧹', roles: MAYORES, esf: 'media' }
    ]
  },

  juegos: {
    id: 'juegos',
    nombre: 'Cuarto de juegos',
    emoji: '🧸',
    semanal: [
      { t: 'Recoger juguetes y llevarlos a su caja', e: '🧸', roles: ['peque'], esf: 'rapida' },
      { t: 'Ordenar libros y juegos de mesa', e: '📚', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Quitar el polvo de las estanterías', e: '🪶', roles: ['junior'], esf: 'rapida' },
      { t: 'Limpiar mesas y sillas', e: '🪑', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Barrer o aspirar el suelo', e: '🧹', roles: MAYORES, esf: 'media' }
    ],
    fondo: [
      { t: 'Clasificar juguetes: guardar, donar o retirar', e: '🧮', roles: MAYORES, esf: 'intensa' },
      { t: 'Lavar los juguetes de plástico', e: '🦆', roles: ['peque', 'junior'], esf: 'media' },
      { t: 'Meter los peluches a lavar', e: '🧸', roles: ['junior'], esf: 'media' },
      { t: 'Ordenar libros y juegos de mesa', e: '📚', roles: ['peque', 'junior'], esf: 'media' },
      { t: 'Limpiar las estanterías', e: '🪶', roles: ['junior'], esf: 'media' },
      { t: 'Limpiar las paredes con huellas', e: '🖐️', roles: ADULTO, esf: 'media' },
      { t: 'Aspirar y fregar el suelo', e: '🌀', roles: ADULTO, esf: 'media' },
      { t: 'Revisar las manualidades y retirar lo seco', e: '✂️', roles: ['junior'], esf: 'media' }
    ]
  },

  exterior: {
    id: 'exterior',
    nombre: 'Terraza o jardín',
    emoji: '🌿',
    semanal: [
      { t: 'Barrer la terraza o los senderos', e: '🧹', roles: MAYORES, esf: 'media' },
      { t: 'Regar las plantas de fuera', e: '🪴', roles: TODOS, esf: 'rapida' },
      { t: 'Recoger hojas y cosas sueltas', e: '🍂', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Limpiar la mesa y las sillas de fuera', e: '🪑', roles: MAYORES, esf: 'rapida' }
    ],
    fondo: [
      { t: 'Retirar hojas, ramas y todo lo suelto', e: '🍂', roles: MAYORES, esf: 'media' },
      { t: 'Limpiar los muebles de exterior a fondo', e: '🪑', roles: ADULTO, esf: 'media' },
      { t: 'Lavar cojines y telas de exterior', e: '🧺', roles: ADULTO, esf: 'media' },
      { t: 'Quitar malas hierbas de canteros y macetas', e: '🌱', roles: MAYORES, esf: 'media' },
      { t: 'Limpiar la barbacoa o la zona de cocina exterior', e: '🍖', roles: ADULTO, esf: 'intensa' },
      { t: 'Baldear el suelo con manguera o fregona', e: '💦', roles: ADULTO, esf: 'intensa' },
      { t: 'Limpiar cristales y puertas que dan fuera', e: '🪟', roles: ADULTO, esf: 'media' }
    ]
  },

  // La red para las zonas que ningún catálogo conoce: la buhardilla, el
  // trastero, el despacho. Limpia lo que toda estancia tiene.
  generica: {
    id: 'generica',
    nombre: 'Otra zona',
    emoji: '🚪',
    semanal: [
      { t: 'Despejar y llevar cada cosa a su sitio', e: '📦', roles: TODOS, esf: 'rapida' },
      { t: 'Quitar el polvo de las superficies', e: '🪶', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Vaciar la papelera si la hay', e: '🗑️', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Limpiar cristales y espejos', e: '🪞', roles: MAYORES, esf: 'rapida' },
      { t: 'Barrer o aspirar el suelo', e: '🧹', roles: MAYORES, esf: 'media' },
      { t: 'Fregar el suelo', e: '🪣', roles: MAYORES, esf: 'media' }
    ],
    fondo: [
      { t: 'Vaciar la zona y clasificar qué se queda', e: '📦', roles: MAYORES, esf: 'intensa' },
      { t: 'Quitar polvo y telarañas de lo alto', e: '🕸️', roles: ADULTO, esf: 'media' },
      { t: 'Limpiar estantes y armarios por dentro', e: '🗄️', roles: MAYORES, esf: 'media' },
      { t: 'Mover los muebles y limpiar debajo', e: '🪑', roles: ADULTO, esf: 'intensa' },
      { t: 'Limpiar ventanas y cristales', e: '🪟', roles: ADULTO, esf: 'media' },
      { t: 'Fregar el suelo a fondo, esquinas incluidas', e: '🪣', roles: ADULTO, esf: 'media' },
      { t: 'Volver a colocar cada cosa, ordenada', e: '🧮', roles: ['peque', 'junior'], esf: 'media' }
    ]
  }
}

/** Los ids válidos de plantilla, para checks y formularios. */
export const IDS_PLANTILLA = Object.keys(PLANTILLAS_ZONA)

/** La plantilla de una zona, con la genérica como red. */
export function plantillaDe(zona) {
  return PLANTILLAS_ZONA[zona?.plantilla] || PLANTILLAS_ZONA.generica
}

/** El mismo límite que comprueba la base: 2-60 tras recortar. */
export function nombreDeZonaValido(nombre) {
  const limpio = String(nombre || '').trim()
  return limpio.length >= 2 && limpio.length <= 60
}

// ------------------------------------------------------------------
// Las zonas por defecto: el mapa de siempre, virtual
//
// Un gremio sin zonas guardadas —anterior a la 032, o que saltó la
// pregunta del setup— ve exactamente lo que veía: estas. No se
// persisten solas; se persisten cuando alguien las adopta desde
// ⚙️ → Casa y las hace suyas.
// ------------------------------------------------------------------

export const ZONAS_POR_DEFECTO = [
  { id: 'v:cocina', nombre: 'Cocina', emoji: '🍳', plantilla: 'cocina', tipo: 'comun', dueno: null, virtual: true },
  { id: 'v:bano', nombre: 'Baño', emoji: '🛁', plantilla: 'bano', tipo: 'comun', dueno: null, virtual: true },
  { id: 'v:dormitorios', nombre: 'Dormitorios', emoji: '🛏️', plantilla: 'dormitorio', tipo: 'comun', dueno: null, virtual: true },
  { id: 'v:salon', nombre: 'Salón', emoji: '🛋️', plantilla: 'salon', tipo: 'comun', dueno: null, virtual: true },
  { id: 'v:entrada', nombre: 'Entrada y comedor', emoji: '🚪', plantilla: 'entrada', tipo: 'comun', dueno: null, virtual: true },
  { id: 'v:juegos', nombre: 'Cuarto de juegos', emoji: '🧸', plantilla: 'juegos', tipo: 'comun', dueno: null, virtual: true }
]

/**
 * Las zonas con las que trabaja el modo limpieza: las guardadas si las
 * hay, y si no, las de siempre. Ordenadas por `orden` y nombre.
 */
export function zonasDeLaCasa(data) {
  const guardadas = data?.zonas || []
  if (!guardadas.length) return ZONAS_POR_DEFECTO
  return [...guardadas].sort(
    (a, b) => (a.orden || 0) - (b.orden || 0) || String(a.nombre).localeCompare(String(b.nombre), 'es')
  )
}

// ------------------------------------------------------------------
// De la pregunta de la vivienda a la lista de zonas
//
// UNA pregunta compositora, no un cuestionario: cuántos baños, cuántos
// dormitorios (en modo piso ni se pregunta: uno por conviviente), si
// hay más de una planta y qué extras existen. De ahí sale la lista, que
// se enseña editable en el mismo paso: la edición ES la confirmación.
// ------------------------------------------------------------------

export const EXTRAS_VIVIENDA = [
  { id: 'juegos', etiqueta: 'Cuarto de juegos', emoji: '🧸', plantilla: 'juegos' },
  { id: 'lavadero', etiqueta: 'Lavadero', emoji: '🧺', plantilla: 'lavadero' },
  { id: 'exterior', etiqueta: 'Terraza o jardín', emoji: '🌿', plantilla: 'exterior' },
  { id: 'despacho', etiqueta: 'Despacho', emoji: '🖥️', plantilla: 'generica' }
]

export const VIVIENDA_POR_DEFECTO = {
  banos: 1,
  dormitorios: 2,
  masDeUnaPlanta: false,
  extras: []
}

/**
 * Nombres para N estancias iguales. Con más de una planta y exactamente
 * dos, la planta pone el nombre («de arriba», «de abajo»), que es TODO
 * lo que una planta aporta aquí; con otra cuenta, se numeran.
 */
function nombresRepetidos(base, cuantos, masDeUnaPlanta) {
  if (cuantos <= 1) return [base]
  if (cuantos === 2 && masDeUnaPlanta) return [`${base} de arriba`, `${base} de abajo`]
  return Array.from({ length: cuantos }, (_, i) => (i === 0 ? base : `${base} ${i + 1}`))
}

/**
 * La lista de zonas que la vivienda dibuja. `miembros` son los del alta
 * ({name, role}); en modo piso, cada conviviente con nombre recibe su
 * habitación PRIVADA con `dueno` como ÍNDICE del miembro —los perfiles
 * aún no existen; Onboarding lo traduce a id tras el insert, con el
 * mismo casado por posición que usan las misiones—.
 */
export function zonasDesdeVivienda(vivienda = VIVIENDA_POR_DEFECTO, { tipoGremio = 'familia', miembros = [] } = {}) {
  const v = { ...VIVIENDA_POR_DEFECTO, ...vivienda }
  const zonas = []
  const comun = (nombre, plantilla, emoji) =>
    zonas.push({ nombre, emoji: emoji || PLANTILLAS_ZONA[plantilla].emoji, plantilla, tipo: 'comun', dueno: null })

  comun('Cocina', 'cocina')
  comun('Salón', 'salon')
  comun('Entrada y comedor', 'entrada')

  for (const nombre of nombresRepetidos('Baño', Math.max(1, v.banos), v.masDeUnaPlanta)) {
    comun(nombre, 'bano')
  }

  if (tipoGremio === 'piso') {
    // Una habitación por conviviente, suya. Sin dormitorios «de sobra»:
    // si el piso tiene un cuarto más, se añade a mano en el mismo paso.
    miembros
      .map((m, i) => ({ ...m, indice: i }))
      .filter((m) => (m.name || '').trim())
      .forEach((m) => {
        zonas.push({
          nombre: `Habitación de ${m.name.trim()}`,
          emoji: PLANTILLAS_ZONA.dormitorio.emoji,
          plantilla: 'dormitorio',
          tipo: 'privada',
          dueno: m.indice
        })
      })
  } else {
    const nombres = v.dormitorios >= 1 ? ['Dormitorio principal'] : []
    for (let i = 2; i <= v.dormitorios; i++) nombres.push(`Dormitorio ${i}`)
    for (const nombre of nombres) comun(nombre, 'dormitorio')
  }

  for (const extra of EXTRAS_VIVIENDA) {
    if ((v.extras || []).includes(extra.id)) comun(extra.etiqueta, extra.plantilla, extra.emoji)
  }

  return zonas.map((z, i) => ({ ...z, orden: i }))
}

/** Una zona en blanco para «añadir otra», desde el setup o desde ⚙️ → Casa. */
export function nuevaZona() {
  return { nombre: '', emoji: '🚪', plantilla: 'generica', tipo: 'comun', dueno: null }
}

// ------------------------------------------------------------------
// De una zona a una campaña lanzable
// ------------------------------------------------------------------

/**
 * La campaña que el asistente puede lanzar sobre una zona: la pasada
 * semanal (7 días) o la limpieza a fondo (3 días). Devuelve el mismo
 * objeto que una campaña del catálogo, así que el resto del modo
 * limpieza no distingue de dónde salió.
 */
export function campanaDeZona(zona, modo = 'semanal') {
  const plantilla = plantillaDe(zona)
  const fondo = modo === 'fondo'
  return {
    clave: `${fondo ? 'fondo' : 'zona'}:${zona.id || zona.plantilla}`.slice(0, 80),
    tipo: fondo ? 'profunda' : 'zona',
    titulo: fondo ? `${zona.nombre} a fondo` : `Zona de la semana · ${zona.nombre}`,
    emoji: zona.emoji || plantilla.emoji,
    dias: fondo ? 3 : 7,
    zona,
    tareas: (fondo ? plantilla.fondo : plantilla.semanal).map((t) => ({ ...t, roles: [...t.roles] }))
  }
}
