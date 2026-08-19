// ------------------------------------------------------------------
// Modo limpieza: campañas de limpieza como misión secundaria.
//
// Lo pidió la familia (19-ago): además de las misiones de siempre, poder
// lanzar de vez en cuando una "operación" de limpieza —un rato corto de
// todos a la vez, la zona de la semana o una estancia a fondo— con las
// tareas repartidas entre quienes participan. El catálogo sale de un
// planificador doméstico real (rutinas por tiempo, cinco zonas
// rotativas y limpieza profunda por estancia), adaptado a los tres
// roles de esta casa.
//
// Tres decisiones que sostienen el diseño, con su porqué:
//
//  1. SOLO UN ADULTO puede lanzar y cerrar una campaña. Es trabajo de
//     verdad, con productos y esfuerzo de verdad: decidir cuánto y
//     cuándo es del mismo orden que conceder Talis a mano. Se comprueba
//     aquí para dar un mensaje decente y OTRA VEZ en Postgres
//     (`crear_campana_limpieza`), que es la que manda.
//  2. UNA campaña activa a la vez por gremio. Dos operaciones solapadas
//     dejan de ser un acontecimiento y pasan a ser el tablón de siempre
//     con otro nombre. La regla vive en la base, no solo aquí.
//  3. La campaña paga PRINCIPALMENTE Talis, y la XP —toda de hogar— se
//     queda cerca de la de una misión normal. La XP marca el nivel y
//     alimenta la meta, y las dos están calculadas contra un ritmo
//     (src/lib/economia.js): inflarla convertiría la limpieza en la vía
//     rápida de nivel. Los Talis, en cambio, son reconocimiento puro, y
//     aquí está el trabajo más grande de la casa: por proporción, una
//     tarea de limpieza es la mayor fuente de Talis del sistema. Hay un
//     test que fija esa promesa.
//
// Las campañas son acotadas en el tiempo (1, 3 o 7 días): un pico
// puntual, como el camino de rachas, no un cambio de cadencia. Sus
// misiones nacen con `frequency: 'unico'`, que pesa 0 en `cargaDe`, así
// que no disparan el aviso de carga ni descuadran el diagnóstico.
// ------------------------------------------------------------------

import { DEFAULTS_ROL } from './tareas'
import { dayKey } from './supabase'

// ------------------------------------------------------------------
// Esfuerzo: el planificador dimensiona por minutos, y de los minutos
// salen los puntos. Los multiplicadores van sobre los valores por rol
// de DEFAULTS_ROL, para que la proporcionalidad por edades se conserve:
// la misma tarea vale más XP para la junior que para un adulto, igual
// que en el resto del sistema.
//
// El multiplicador de Talis (×2 a ×4) es la promesa del modo: una
// misión normal paga ~0,5 Talis por XP; una de limpieza paga 2 por XP.
// ------------------------------------------------------------------

// `temporizador` es lo que cuenta atrás el reloj de la tarea: el techo
// de la horquilla, no la media, porque un temporizador que se agota
// antes de lo prometido enseña que los relojes de esta app mienten.
export const ESFUERZO = {
  rapida: { id: 'rapida', nombre: 'Rápida', minutos: 8, texto: '5-10 min', temporizador: 10, xp: 1, coins: 2 },
  media: { id: 'media', nombre: 'Media', minutos: 20, texto: '15-25 min', temporizador: 25, xp: 1.5, coins: 3 },
  intensa: { id: 'intensa', nombre: 'Intensa', minutos: 35, texto: '30 min o más', temporizador: 40, xp: 2, coins: 4 }
}

/** La mitad de lo ganado en la campaña, si se cierra completa. */
export const BOTIN_FACTOR = 0.5

/** Puntos de una tarea para un rol concreto. */
export function puntosDeTarea(tarea, rol) {
  const d = DEFAULTS_ROL[rol]
  const m = ESFUERZO[tarea.esf]
  if (!d || !m) return null
  return { xp: Math.round(d.xp * m.xp), coins: Math.round(d.coins * m.coins) }
}

/** Minutos estimados de una tarea, para repartir y para enseñar. */
export function minutosDe(tarea) {
  return ESFUERZO[tarea.esf]?.minutos || 0
}

// ------------------------------------------------------------------
// El catálogo. Tres formatos del planificador:
//
//   blitz    → un rato corto, todos a la vez, HOY (1 día)
//   zona     → la zona de la semana, estilo rotativo (7 días)
//   profunda → una estancia a fondo, cabe en un fin de semana (3 días)
//
// Cada tarea lleva título (infinitivo o sustantivo; sin marcas de
// género, porque ninguna habla de quien la hace), emoji, roles aptos y
// esfuerzo. `a` es la acción en infinitivo cuando el título es un
// sustantivo, igual que en tareas.js: la usan las frases de elogio.
//
// Los roles no son una sugerencia estética: lo que lleva químicos,
// horno, altura o cuchillas es SOLO de personas adultas, el mismo
// criterio del bloque «Casa a fondo» del catálogo general. Y la peque
// tiene tareas de verdad en casi todas las campañas: a los tres años
// participar es el premio, y una operación familiar donde ella no tiene
// baldosa es una fiesta a la que no la han invitado.
// ------------------------------------------------------------------

export const TIPOS = [
  {
    id: 'blitz',
    nombre: 'Limpieza relámpago',
    emoji: '⚡',
    desc: 'Un rato corto, todos a la vez. Se elige cuánto tiempo hay y salen las tareas que caben.'
  },
  {
    id: 'zona',
    nombre: 'Zona de la semana',
    emoji: '🗺️',
    desc: 'Una zona de la casa cada vez, con una semana para completarla. Cinco zonas para rotar.'
  },
  {
    id: 'profunda',
    nombre: 'Limpieza profunda',
    emoji: '🧽',
    desc: 'Una estancia a fondo, con tres días de margen. Lo gordo es de personas adultas.'
  }
]

const TODOS = ['peque', 'junior', 'adulto']
const MAYORES = ['junior', 'adulto']
const ADULTO = ['adulto']

export const CAMPANAS = [
  // ----------------------------- blitz -----------------------------
  {
    clave: 'blitz_15',
    tipo: 'blitz',
    titulo: 'Operación relámpago · 15 minutos',
    emoji: '⚡',
    dias: 1,
    tareas: [
      { t: 'Recoger lo que está fuera de su sitio', e: '🧺', roles: TODOS, esf: 'rapida' },
      { t: 'Llevar los platos sucios al fregadero', e: '🍽️', roles: MAYORES, esf: 'rapida' },
      { t: 'Limpiar las encimeras de la cocina', e: '🧴', roles: MAYORES, esf: 'rapida' },
      { t: 'Hacer las camas', e: '🛏️', roles: TODOS, esf: 'rapida' },
      { t: 'Repasar el lavabo y el grifo del baño', e: '🚰', roles: MAYORES, esf: 'rapida' },
      { t: 'Vaciar las papeleras', e: '🗑️', roles: MAYORES, esf: 'rapida' }
    ]
  },
  {
    clave: 'blitz_30',
    tipo: 'blitz',
    titulo: 'Operación media hora',
    emoji: '⏱️',
    dias: 1,
    tareas: [
      { t: 'Lavar los platos o cargar el lavavajillas', e: '🫧', roles: MAYORES, esf: 'media' },
      { t: 'Limpiar la mesa del comedor', e: '🍽️', roles: TODOS, esf: 'rapida' },
      { t: 'Quitar el polvo de las superficies bajas', e: '🪶', roles: TODOS, esf: 'rapida' },
      { t: 'Barrer las zonas de paso', e: '🧹', roles: MAYORES, esf: 'rapida' },
      { t: 'Limpiar las superficies del baño', e: '🚿', roles: ADULTO, esf: 'media' },
      { t: 'Recoger juguetes y libros', e: '🧸', roles: ['peque'], esf: 'rapida' }
    ]
  },
  {
    clave: 'blitz_60',
    tipo: 'blitz',
    titulo: 'Operación hora completa',
    emoji: '🕐',
    dias: 1,
    tareas: [
      { t: 'Limpiar superficies y electrodomésticos de la cocina', e: '🍳', roles: ADULTO, esf: 'media' },
      { t: 'Barrer y fregar el suelo de la cocina', e: '🧹', roles: MAYORES, esf: 'media' },
      { t: 'Lavar los platos', e: '🫧', roles: MAYORES, esf: 'media' },
      { t: 'Hacer las camas y ordenar las superficies', e: '🛏️', roles: TODOS, esf: 'rapida' },
      { t: 'Quitar el polvo de los muebles del salón', e: '🪶', roles: MAYORES, esf: 'rapida' },
      { t: 'Aspirar el salón', e: '🌀', roles: MAYORES, esf: 'media' },
      { t: 'Colocar cojines y doblar las mantas', e: '🛋️', roles: ['peque'], esf: 'rapida' },
      { t: 'Vaciar las papeleras de toda la casa', e: '🗑️', roles: MAYORES, esf: 'rapida' },
      { t: 'Limpiar el lavabo, el inodoro y la ducha', e: '🚽', roles: ADULTO, esf: 'media' },
      { t: 'Poner una lavadora', e: '🌊', roles: MAYORES, esf: 'rapida' }
    ]
  },
  {
    clave: 'blitz_90',
    tipo: 'blitz',
    titulo: 'Operación a fondo · 90 minutos',
    emoji: '💪',
    dias: 1,
    tareas: [
      { t: 'Limpiar encimeras y frentes de los armarios', e: '🧴', roles: ADULTO, esf: 'media' },
      { t: 'Barrer y fregar el suelo de la cocina', e: '🧹', roles: MAYORES, esf: 'media' },
      { t: 'Fregar los platos', e: '🫧', roles: MAYORES, esf: 'media' },
      { t: 'Limpiar el lavabo, la encimera y el espejo del baño', e: '🪞', roles: MAYORES, esf: 'media' },
      { t: 'Limpiar el inodoro y la bañera o la ducha', e: '🚽', roles: ADULTO, esf: 'media' },
      { t: 'Cambiar las toallas', e: '🧻', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Aspirar los dormitorios', e: '🌀', roles: MAYORES, esf: 'media' },
      { t: 'Quitar el polvo de muebles y pantallas del salón', e: '📺', roles: ['junior'], esf: 'rapida' },
      { t: 'Aspirar el salón y la entrada', e: '🌀', roles: MAYORES, esf: 'media' },
      { t: 'Ahuecar cojines y recolocar las mantas', e: '🛋️', roles: ['peque'], esf: 'rapida' },
      { t: 'Poner y tender una lavadora', e: '🧺', roles: MAYORES, esf: 'media' }
    ]
  },

  // ------------------------------ zonas ----------------------------
  {
    clave: 'zona_entrada',
    tipo: 'zona',
    titulo: 'Zona 1 · Entrada y comedor',
    emoji: '🚪',
    dias: 7,
    tareas: [
      { t: 'Sacudir el felpudo', e: '🚪', roles: TODOS, esf: 'rapida' },
      { t: 'Organizar zapatos y abrigos', e: '🥾', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Limpiar la puerta y la manija', e: '🚪', roles: ['junior'], esf: 'rapida' },
      { t: 'Quitar el polvo de la entrada', e: '🪶', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Limpiar la mesa y las sillas del comedor', e: '🪑', roles: MAYORES, esf: 'media' },
      { t: 'Barrer y fregar la entrada y el comedor', e: '🧹', roles: MAYORES, esf: 'media' },
      { t: 'Limpiar espejos y cristales', e: '🪞', roles: MAYORES, esf: 'rapida' },
      { t: 'Quitar las telarañas de las esquinas altas', e: '🕸️', roles: ADULTO, esf: 'rapida' }
    ]
  },
  {
    clave: 'zona_cocina',
    tipo: 'zona',
    titulo: 'Zona 2 · Cocina',
    emoji: '🍳',
    dias: 7,
    tareas: [
      { t: 'Limpiar los electrodomésticos por fuera', e: '🍞', roles: ['junior'], esf: 'rapida' },
      { t: 'Limpiar y desinfectar las encimeras', e: '🧴', roles: ADULTO, esf: 'rapida' },
      { t: 'Fregar el fregadero y el grifo', e: '🚰', roles: MAYORES, esf: 'rapida' },
      { t: 'Ordenar la despensa', e: '🥫', roles: MAYORES, esf: 'media' },
      { t: 'Retirar los productos caducados', e: '🗓️', roles: ADULTO, esf: 'rapida' },
      { t: 'Limpiar el microondas por dentro', e: '♨️', roles: ADULTO, esf: 'rapida' },
      { t: 'Repasar el frigorífico y sus huecos', e: '🧊', roles: ADULTO, esf: 'media' },
      { t: 'Barrer y fregar el suelo de la cocina', e: '🧹', roles: MAYORES, esf: 'media' },
      { t: 'Emparejar los táperes con sus tapas', e: '🥡', roles: ['peque'], esf: 'rapida' }
    ]
  },
  {
    clave: 'zona_banos',
    tipo: 'zona',
    titulo: 'Zona 3 · Baños y colada',
    emoji: '🛁',
    dias: 7,
    tareas: [
      { t: 'Limpiar los espejos del baño', e: '🪞', roles: ['junior'], esf: 'rapida' },
      { t: 'Limpiar el inodoro, la bañera y el lavabo', e: '🚽', roles: ADULTO, esf: 'media' },
      { t: 'Fregar el suelo del baño', e: '🧹', roles: MAYORES, esf: 'rapida' },
      { t: 'Reponer el papel higiénico', e: '🧻', roles: ['peque'], esf: 'rapida' },
      { t: 'Cambiar toallas y alfombrillas', e: '🧺', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Vaciar la papelera del baño', e: '🗑️', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Poner y tender una lavadora', e: '🌊', roles: MAYORES, esf: 'media' },
      { t: 'Doblar y repartir la ropa limpia', e: '👕', roles: TODOS, esf: 'media' }
    ]
  },
  {
    clave: 'zona_dormitorios',
    tipo: 'zona',
    titulo: 'Zona 4 · Dormitorios y armarios',
    emoji: '🛏️',
    dias: 7,
    tareas: [
      { t: 'Cambiar las sábanas', e: '🛏️', roles: MAYORES, esf: 'media' },
      { t: 'Quitar el polvo de los muebles', e: '🪶', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Despejar mesitas y cómodas', e: '🕯️', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Ordenar cajones y armario', e: '🗄️', roles: ['junior'], esf: 'media' },
      { t: 'Guardar la ropa que quedó fuera', e: '👚', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Aspirar y fregar el suelo', e: '🌀', roles: ADULTO, esf: 'media' },
      { t: 'Limpiar los espejos', e: '🪞', roles: ['junior'], esf: 'rapida' },
      { t: 'Rescatar lo que vive debajo de la cama', e: '🔦', roles: ['peque', 'junior'], esf: 'rapida' }
    ]
  },
  {
    clave: 'zona_salon',
    tipo: 'zona',
    titulo: 'Zona 5 · Sala de estar',
    emoji: '🛋️',
    dias: 7,
    tareas: [
      { t: 'Recoger juguetes y libros del salón', e: '🧸', roles: ['peque'], esf: 'rapida' },
      { t: 'Quitar el polvo de estantes y marcos', e: '🖼️', roles: ['junior'], esf: 'rapida' },
      { t: 'Limpiar pantallas y mandos', e: '📺', roles: ['junior'], esf: 'rapida' },
      { t: 'Aspirar el sofá y debajo de los cojines', e: '🛋️', roles: ADULTO, esf: 'media' },
      { t: 'Sacudir las alfombras', e: '🧶', roles: MAYORES, esf: 'media' },
      { t: 'Aspirar y fregar el suelo del salón', e: '🌀', roles: MAYORES, esf: 'media' },
      { t: 'Ordenar cables y cargadores', e: '🔌', roles: ['junior'], esf: 'rapida' },
      { t: 'Colocar cojines y mantas', e: '🛋️', roles: ['peque'], esf: 'rapida' }
    ]
  },

  // ---------------------------- profundas --------------------------
  {
    clave: 'profunda_cocina',
    tipo: 'profunda',
    titulo: 'La cocina a fondo',
    emoji: '🍳',
    dias: 3,
    tareas: [
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
  {
    clave: 'profunda_bano',
    tipo: 'profunda',
    titulo: 'El baño a fondo',
    emoji: '🛁',
    dias: 3,
    tareas: [
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
  {
    clave: 'profunda_dormitorio',
    tipo: 'profunda',
    titulo: 'El dormitorio a fondo',
    emoji: '🛏️',
    dias: 3,
    tareas: [
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
  {
    clave: 'profunda_salon',
    tipo: 'profunda',
    titulo: 'La sala a fondo',
    emoji: '🛋️',
    dias: 3,
    tareas: [
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
  {
    clave: 'profunda_juegos',
    tipo: 'profunda',
    titulo: 'El cuarto de juegos a fondo',
    emoji: '🧸',
    dias: 3,
    tareas: [
      { t: 'Clasificar juguetes: guardar, donar o retirar', e: '🧮', roles: MAYORES, esf: 'intensa' },
      { t: 'Lavar los juguetes de plástico', e: '🦆', roles: ['peque', 'junior'], esf: 'media' },
      { t: 'Meter los peluches a lavar', e: '🧸', roles: ['junior'], esf: 'media' },
      { t: 'Ordenar libros y juegos de mesa', e: '📚', roles: ['peque', 'junior'], esf: 'media' },
      { t: 'Limpiar las estanterías', e: '🪶', roles: ['junior'], esf: 'media' },
      { t: 'Limpiar mesas y sillas', e: '🪑', roles: ['peque', 'junior'], esf: 'rapida' },
      { t: 'Limpiar las paredes con huellas', e: '🖐️', roles: ADULTO, esf: 'media' },
      { t: 'Aspirar y fregar el suelo', e: '🌀', roles: ADULTO, esf: 'media' },
      { t: 'Revisar las manualidades y retirar lo seco', e: '✂️', roles: ['junior'], esf: 'media' }
    ]
  },
  {
    clave: 'profunda_entrada',
    tipo: 'profunda',
    titulo: 'La entrada a fondo',
    emoji: '🚪',
    dias: 3,
    tareas: [
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
  }
]

/** Las campañas de un formato, en el orden del catálogo. */
export function campanasDeTipo(tipo) {
  return CAMPANAS.filter((c) => c.tipo === tipo)
}

/** ¿Esta misión nació de una campaña de limpieza? */
export function esDeOperacion(reto) {
  return Boolean(reto?.campana_id)
}

// El esfuerzo de una misión ya guardada se recupera sin columna nueva:
// `challenges` no guarda esfuerzo, y añadir esquema para un dato que
// solo alimenta el reloj sería pagar caro una cosmética. Dos vías, en
// orden:
//
//  1. Por TÍTULO, si sigue siendo el del catálogo.
//  2. Por PUNTOS, si el título se personalizó (desde que las tareas se
//     editan al lanzar, es el caso normal): la XP de una tarea es
//     base_del_rol × {1 · 1,5 · 2}, así que el multiplicador más
//     cercano dice el esfuerzo. Aguanta incluso que un adulto retoque
//     la XP a mano después, porque se toma el más cercano.
//
// Y 'media' como red final: un reloj aproximado sigue siendo mejor que
// ningún reloj.
const ESFUERZO_POR_TITULO = new Map(
  CAMPANAS.flatMap((c) => c.tareas).map((t) => [t.t, t.esf])
)

/** El esfuerzo de una misión de campaña. `rol` afina la vía por puntos. */
export function esfuerzoDeMision(reto, rol = null) {
  const porTitulo = ESFUERZO[ESFUERZO_POR_TITULO.get(String(reto?.title || '').trim())]
  if (porTitulo) return porTitulo

  const base = DEFAULTS_ROL[rol]?.xp
  if (base && Number(reto?.xp) > 0) {
    const factor = Number(reto.xp) / base
    const candidatos = Object.values(ESFUERZO)
    return candidatos.reduce((a, b) => (Math.abs(b.xp - factor) < Math.abs(a.xp - factor) ? b : a))
  }

  return ESFUERZO.media
}

// ------------------------------------------------------------------
// Personalizar: las tareas del catálogo son un punto de partida
//
// El planificador original deja huecos «{Agrega los tuyos}» en cada
// lista, y esta casa no limpia igual que ninguna otra: al lanzar, cada
// tarea se puede editar (título, esfuerzo y emoji) y se pueden añadir
// tareas propias. Dos límites que NO se abren:
//
//  · Los ROLES APTOS del catálogo no se editan: renombrar «Limpiar el
//    horno» no lo vuelve apto para la junior. Lo que lleva químicos,
//    horno o altura sigue siendo de personas adultas se llame como se
//    llame. Las tareas propias nacen para todos, porque las escribe el
//    adulto sabiendo para quién son.
//  · Los PUNTOS no se teclean: salen del esfuerzo y del rol, como
//    siempre. Editar el esfuerzo es la palanca honesta para «esta
//    tarea en esta casa es más gorda».
// ------------------------------------------------------------------

/** Una tarea en blanco, para los huecos «{Agrega los tuyos}». */
export function nuevaTareaPropia() {
  return { t: '', e: '🧹', roles: [...TODOS], esf: 'media', propia: true, asignado: null }
}

/** El mismo límite que comprueba la RPC: 3-120 tras recortar. */
export function tituloDeTareaValido(t) {
  const limpio = String(t || '').trim()
  return limpio.length >= 3 && limpio.length <= 120
}

/** Una campaña del catálogo por su clave, o null. */
export function campanaDeCatalogo(clave) {
  return CAMPANAS.find((c) => c.clave === clave) || null
}

// ------------------------------------------------------------------
// Lanzar: quién puede, cómo se reparte y qué se envía
// ------------------------------------------------------------------

/**
 * ¿Puede lanzarse una campaña? Devuelve el primer problema como mensaje,
 * o null si todo está bien. Es la comprobación del cliente, para dar un
 * mensaje decente; la que manda vive en Postgres, como con el premio a
 * mano, porque el navegador se puede saltar.
 */
export function puedeLanzarCampana({ quienId, perfiles = [], campanas = [] }) {
  const quien = perfiles.find((p) => p.id === quienId)
  if (!quien) return 'Falta decir qué adulto la lanza.'
  if (quien.role !== 'adulto') return 'Solo un adulto puede lanzar el modo limpieza.'
  if (quien.active === false) return 'Ese perfil está retirado.'
  if (campanas.some((c) => c.estado === 'activa')) {
    return 'Ya hay una operación en marcha. Ciérrala antes de lanzar otra.'
  }
  return null
}

/** ¿Esta tarea la puede hacer este perfil? Las mascotas nunca limpian. */
export function tareaApta(tarea, perfil) {
  return Boolean(perfil) && perfil.role !== 'mascota' && tarea.roles.includes(perfil.role)
}

/**
 * Reparto sugerido: cada tarea, a la persona apta con menos minutos
 * acumulados. Es determinista —mismo catálogo y mismos participantes,
 * mismo reparto— para que la sugerencia no baile entre dos aperturas
 * del formulario. Devuelve un array paralelo a `tareas` con el id del
 * perfil, o null si nadie del grupo puede con esa tarea.
 */
export function repartoSugerido(tareas = [], participantes = []) {
  const carga = new Map(participantes.map((p) => [p.id, 0]))
  return tareas.map((tarea) => {
    const aptos = participantes.filter((p) => tareaApta(tarea, p))
    if (!aptos.length) return null
    const elegido = aptos.reduce((a, b) => (carga.get(b.id) < carga.get(a.id) ? b : a))
    carga.set(elegido.id, carga.get(elegido.id) + minutosDe(tarea))
    return elegido.id
  })
}

/**
 * Las filas que se envían a `crear_campana_limpieza`: una por tarea
 * asignada, con los puntos ya calculados para el rol de quien la hará.
 * Las tareas trabajan ya PERSONALIZADAS —cada una lleva su `asignado`—
 * y aquí se filtra lo que no puede viajar: sin nadie asignado (quitarla
 * es eso), asignada a alguien no apto, o con un título que la base va a
 * rechazar (una tarea propia a medio escribir).
 */
export function tareasParaLanzar(tareas = [], perfiles = []) {
  const porId = new Map(perfiles.map((p) => [p.id, p]))
  return tareas
    .map((tarea) => {
      const perfil = porId.get(tarea.asignado)
      if (!perfil || !tareaApta(tarea, perfil)) return null
      if (!tituloDeTareaValido(tarea.t)) return null
      const puntos = puntosDeTarea(tarea, perfil.role)
      if (!puntos) return null
      return { profile_id: perfil.id, title: tarea.t.trim(), emoji: tarea.e, xp: puntos.xp, coins: puntos.coins }
    })
    .filter(Boolean)
}

/** Totales por persona para el formulario: tareas, minutos y puntos. */
export function resumenDeReparto(tareas = [], perfiles = []) {
  return perfiles
    .map((perfil) => {
      const suyas = tareas.filter((t) => t.asignado === perfil.id)
      const minutos = suyas.reduce((total, t) => total + minutosDe(t), 0)
      const puntos = suyas.reduce(
        (total, t) => {
          const p = puntosDeTarea(t, perfil.role)
          return p ? { xp: total.xp + p.xp, coins: total.coins + p.coins } : total
        },
        { xp: 0, coins: 0 }
      )
      return { perfil, tareas: suyas.length, minutos, ...puntos }
    })
    .filter((r) => r.tareas > 0)
}

// ------------------------------------------------------------------
// Leer una campaña en marcha
// ------------------------------------------------------------------

/** La campaña activa del gremio, si la hay. */
export function campanaActiva(campanas = []) {
  return campanas.find((c) => c.estado === 'activa') || null
}

/** Las misiones que nacieron con una campaña. */
export function misionesDeCampana(campana, challenges = []) {
  if (!campana) return []
  return challenges.filter((ch) => ch.campana_id === campana.id)
}

/**
 * El progreso: cuántas tareas hay, cuántas están aprobadas y cuántas
 * esperan validación. `completa` es la condición del botín.
 */
export function progresoDeCampana(campana, challenges = [], completions = []) {
  const misiones = misionesDeCampana(campana, challenges)
  const estadoDe = (ch) => {
    const suyas = completions.filter((c) => c.challenge_id === ch.id)
    if (suyas.some((c) => c.status === 'aprobado')) return 'aprobada'
    if (suyas.some((c) => c.status === 'pendiente')) return 'pendiente'
    return 'sin_hacer'
  }
  const estados = misiones.map(estadoDe)
  const aprobadas = estados.filter((e) => e === 'aprobada').length
  return {
    total: misiones.length,
    aprobadas,
    pendientes: estados.filter((e) => e === 'pendiente').length,
    completa: misiones.length > 0 && aprobadas === misiones.length
  }
}

/**
 * El botín previsto por participante: la mitad de los Talis que sus
 * tareas aprobadas de la campaña han pagado ya. Es la MISMA cuenta que
 * hace `cerrar_campana_limpieza` en Postgres; si se tocan los redondeos,
 * hay que tocar los dos sitios, y hay un test que compara las cifras.
 */
export function botinPrevisto(campana, challenges = [], completions = []) {
  const ids = new Set(misionesDeCampana(campana, challenges).map((ch) => ch.id))
  const porPerfil = new Map()
  for (const c of completions) {
    if (c.status !== 'aprobado' || !ids.has(c.challenge_id)) continue
    porPerfil.set(c.profile_id, (porPerfil.get(c.profile_id) || 0) + (c.coins || 0))
  }
  return [...porPerfil.entries()]
    .map(([profileId, ganados]) => ({ profileId, ganados, botin: Math.floor(ganados * BOTIN_FACTOR) }))
    .filter((r) => r.botin > 0)
}

// La fecha de fin (`termina`, un date 'YYYY-MM-DD' de Postgres) se compara
// SIN pasar por `new Date(cadena)`: parsearla la clava a medianoche UTC y
// en según qué zona retrocede un día. Es la lección de la 018 y la 024.
function numeroDeDia(clave) {
  const [a, m, d] = String(clave).slice(0, 10).split('-').map(Number)
  return a * 10000 + m * 100 + d
}

/** ¿Ya pasó su fecha de fin? El día de fin, incluido, todavía cuenta. */
export function campanaVencida(campana, hoy = new Date()) {
  return numeroDeDia(campana.termina) < numeroDeDia(dayKey(hoy))
}

/** Días que quedan, contando hoy. 0 = venció. */
export function diasRestantes(campana, hoy = new Date()) {
  const aUtc = (n) => Date.UTC(Math.floor(n / 10000), Math.floor((n % 10000) / 100) - 1, n % 100)
  const diff = Math.round((aUtc(numeroDeDia(campana.termina)) - aUtc(numeroDeDia(dayKey(hoy)))) / 86400000)
  return Math.max(0, diff + 1)
}
