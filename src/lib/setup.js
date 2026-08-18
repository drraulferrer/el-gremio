// ------------------------------------------------------------------
// El setup: cuatro preguntas que construyen el gremio.
//
// Antes, el arranque eran once diapositivas explicando el sistema y
// después un tablero idéntico para todo el mundo: las misiones que había
// escrito UNA familia, con dos títulos que hablaban de sus criaturas. Ni
// se aprendía —nadie lee once pantallas antes de usar nada— ni servía a
// otra casa.
//
// Ahora se aprende configurando. Cada pregunta lleva debajo el principio
// que la sostiene, así que al terminar la familia ha leído las cuatro
// ideas del sistema mientras decidía, y además tiene un tablero suyo. La
// explicación larga no desaparece: sigue entera en ⚙️ → Evidencia.
//
// Este fichero no toca la red ni React. Devuelve un plan; quien lo
// inserta es Onboarding.jsx.
// ------------------------------------------------------------------

import { DEFAULTS_ROL, tareasDeRol } from './tareas'
import { CATALOGO_PREMIOS, TECHO_PEQUE } from './premios'
import { metaObjetivo } from './economia'

// Títulos del catálogo que describen una casa concreta (las criaturas de
// quien lo escribió). Valen para esa familia y se activan a mano desde la
// Biblioteca, pero no pueden salir en el tablero de arranque de alguien
// que acaba de entrar.
export const TITULOS_DE_UNA_CASA = ['Ayudar a su hermana', 'Leer con las niñas']

// ------------------------------------------------------------------
// Las preguntas
// ------------------------------------------------------------------

export const PREGUNTAS = [
  {
    id: 'focos',
    tipo: 'varios',
    min: 1,
    max: 3,
    titulo: '¿Qué queréis que cambie primero?',
    ayuda: 'Elegid hasta tres. De aquí salen las misiones del primer tablero.',
    porque:
      'El sistema no reparte tareas: entrena habilidades. Por eso la pregunta no es qué hay que hacer en casa, sino qué queréis que aprendan.',
    opciones: [
      { id: 'autonomia', emoji: '🧭', etiqueta: 'Que se apañen solos', detalle: 'Vestirse, prepararse, salir a tiempo', skills: ['autonomia'] },
      { id: 'orden', emoji: '🧹', etiqueta: 'Orden en casa', detalle: 'Recoger, ayudar, hacerse cargo', skills: ['responsabilidad', 'hogar'] },
      { id: 'estudio', emoji: '📚', etiqueta: 'Lectura y estudio', detalle: 'Leer a diario, deberes sin pelea', skills: ['aprendizaje'] },
      { id: 'salud', emoji: '🪥', etiqueta: 'Higiene y salud', detalle: 'Dientes, ducha, moverse', skills: ['salud'] },
      { id: 'convivencia', emoji: '🤝', etiqueta: 'Llevarse mejor', detalle: 'Ayudarse, colaborar, buen trato', skills: ['amabilidad', 'cooperacion'] },
      { id: 'crear', emoji: '🎨', etiqueta: 'Jugar y crear', detalle: 'Dibujar, inventar, sin pantallas', skills: ['creatividad'] }
    ]
  },
  {
    id: 'ritmo',
    tipo: 'uno',
    titulo: '¿Cuánto queréis abarcar la primera semana?',
    ayuda: 'Se puede cambiar cualquier día desde el panel.',
    porque:
      'Empezar con pocas y cumplirlas sostiene más que empezar con veinte. Además, cuantas más misiones activas, más deprisa corre la economía: el sistema avisa cuando se dispara.',
    opciones: [
      { id: 'suave', emoji: '🌱', etiqueta: 'Poco y seguro', detalle: '3 misiones por persona', misiones: 3 },
      { id: 'normal', emoji: '⚔️', etiqueta: 'Lo normal', detalle: '5 misiones por persona', misiones: 5, recomendada: true },
      { id: 'fuerte', emoji: '🔥', etiqueta: 'En serio', detalle: '7 misiones por persona', misiones: 7 }
    ]
  },
  {
    id: 'premios',
    tipo: 'varios',
    min: 1,
    max: 3,
    titulo: '¿Qué funciona de verdad en vuestra casa?',
    ayuda: 'Con esto se llena la tienda. Nada de dinero ni chucherías.',
    porque:
      'El premio es un andamio, no el objetivo: sirve para arrancar y se retira cuando el hábito aguanta solo. Los que mejor envejecen no son cosas, son decisiones.',
    opciones: [
      { id: 'decidir', emoji: '🗳️', etiqueta: 'Elegir ellos algo', detalle: 'La peli, la cena del viernes, la música', tipos: ['decidir'] },
      { id: 'juntos', emoji: '🏕️', etiqueta: 'Planes en casa', detalle: 'Cocinar, noche de juegos, fuerte de mantas', tipos: ['juntos'] },
      { id: 'salir', emoji: '🧺', etiqueta: 'Planes fuera', detalle: 'Picnic, cine, piscina, excursión', tipos: ['salir'] }
    ]
  },
  {
    id: 'meta',
    tipo: 'uno',
    titulo: '¿Qué queréis conseguir juntos?',
    ayuda: 'La meta del gremio: la suma de todo el mundo, sin competir entre sí.',
    porque:
      'Es la única comparación que existe aquí, y es cooperativa. No hay clasificación entre hermanos: lo que hace cada persona empuja la misma barra.',
    opciones: [
      { id: 'peli', emoji: '🍕', etiqueta: 'Noche de pizza y peli', titulo: 'Noche de pizza y peli' },
      { id: 'excursion', emoji: '🏞️', etiqueta: 'Excursión de un día', titulo: 'Excursión de un día' },
      { id: 'juegos', emoji: '🎲', etiqueta: 'Tarde de juegos', titulo: 'Tarde de juegos en familia' },
      { id: 'propia', emoji: '✍️', etiqueta: 'La escribimos nosotros', libre: true }
    ]
  }
]

export const RESPUESTAS_POR_DEFECTO = {
  focos: ['autonomia', 'orden'],
  ritmo: 'normal',
  premios: ['decidir', 'juntos'],
  meta: 'peli',
  metaPropia: ''
}

/** ¿Está esta pregunta contestada como para poder seguir? */
export function preguntaResuelta(pregunta, respuestas) {
  const valor = respuestas?.[pregunta.id]
  if (pregunta.tipo === 'varios') {
    return Array.isArray(valor) && valor.length >= (pregunta.min || 1)
  }
  if (pregunta.id === 'meta' && valor === 'propia') {
    return Boolean((respuestas.metaPropia || '').trim())
  }
  return Boolean(valor)
}

/** Alterna una opción de las de varios, respetando el máximo. */
export function alternar(seleccion = [], id, max = Infinity) {
  if (seleccion.includes(id)) return seleccion.filter((x) => x !== id)
  if (seleccion.length >= max) return seleccion
  return [...seleccion, id]
}

// ------------------------------------------------------------------
// De respuestas a plan
// ------------------------------------------------------------------

function opcionesDe(id) {
  return PREGUNTAS.find((p) => p.id === id).opciones
}

/** Las habilidades elegidas, en el orden en el que se eligieron. */
export function habilidadesElegidas(focos = []) {
  const orden = opcionesDe('focos')
  return focos
    .map((id) => orden.find((o) => o.id === id))
    .filter(Boolean)
    .flatMap((o) => o.skills)
    .filter((s, i, todas) => todas.indexOf(s) === i)
}

export function cuantasMisiones(ritmo) {
  const opcion = opcionesDe('ritmo').find((o) => o.id === ritmo)
  return opcion ? opcion.misiones : 5
}

/** Todas las tareas de un rol, en una lista plana y sin las de una casa concreta. */
function candidatasDe(rol) {
  return tareasDeRol(rol).filter((t) => !TITULOS_DE_UNA_CASA.includes(t.t))
}

/**
 * Misiones de arranque para un rol.
 *
 * Reparto por turnos entre las habilidades elegidas, no «las N primeras
 * que coincidan»: si no, elegir tres focos daba cinco misiones del
 * primero y ninguna de los otros dos, y la familia veía que su respuesta
 * no había servido de nada.
 *
 * Si el rol no tiene tareas de alguna habilidad —a los tres años no hay
 * nada de aprendizaje formal— se rellena con lo demás en el orden del
 * catálogo, que ya viene ordenado por lo que más se usa.
 */
export function misionesParaRol(rol, respuestas) {
  const cuantas = cuantasMisiones(respuestas.ritmo)
  const skills = habilidadesElegidas(respuestas.focos)
  const candidatas = candidatasDe(rol)

  const cubos = skills.map((s) => candidatas.filter((t) => t.skill === s))
  const elegidas = []

  let vuelta = 0
  while (elegidas.length < cuantas && cubos.some((c) => c.length > vuelta)) {
    for (const cubo of cubos) {
      if (elegidas.length >= cuantas) break
      if (cubo[vuelta]) elegidas.push(cubo[vuelta])
    }
    vuelta++
  }

  // Relleno: lo que quede, sin repetir.
  for (const t of candidatas) {
    if (elegidas.length >= cuantas) break
    if (!elegidas.includes(t)) elegidas.push(t)
  }

  const defaults = DEFAULTS_ROL[rol] || DEFAULTS_ROL.junior
  return elegidas.slice(0, cuantas).map((t) => ({
    title: t.t,
    emoji: t.e,
    frequency: t.f,
    skill: t.skill,
    xp: defaults.xp,
    coins: defaults.coins
  }))
}

// Qué premios del catálogo entran en cada respuesta. Escrito a mano y no
// derivado del nivel: «Tiempo de calidad» es nivel 1 y es un plan en
// casa, y quien contesta no está pensando en niveles.
export const PREMIOS_POR_TIPO = {
  decidir: [
    'Elegir la película',
    'Elegir el cuento',
    'Elegir la música del coche',
    'Elegir el menú del viernes',
    'Elegir un juego',
    'Elegir el desayuno del domingo',
    'Elegir una actividad'
  ],
  juntos: [
    'Tiempo de calidad',
    'Noche de juegos',
    'Cocinar juntos',
    'Dormir en un fuerte de mantas'
  ],
  salir: [
    'Picnic',
    'Helado',
    'Cine',
    'Ir a la piscina',
    'Excursión especial',
    'Ir al parque de aventuras'
  ]
}

export const PREMIOS_EN_LA_TIENDA = 7
const MINIMO_NIVEL_1 = 3

/**
 * La tienda inicial.
 *
 * Dos reglas que no dependen de lo que se conteste: al menos tres de
 * nivel 1 —son los que sostienen el hábito— y como mucho uno de nivel 3,
 * que es de meta larga y no del martes.
 */
export function premiosDelPlan(respuestas) {
  const tipos = respuestas.premios || []
  const porTitulo = (titulo) => CATALOGO_PREMIOS.find((p) => p.title === titulo)

  const listas = tipos.map((t) => (PREMIOS_POR_TIPO[t] || []).map(porTitulo).filter(Boolean))

  // 1 · Por turnos entre lo que se ha elegido, para que las tres
  // respuestas se noten en la tienda y no solo la primera.
  const porTurnos = []
  let vuelta = 0
  while (listas.some((l) => l.length > vuelta)) {
    for (const lista of listas) {
      const p = lista[vuelta]
      if (p && !porTurnos.includes(p)) porTurnos.push(p)
    }
    vuelta++
  }

  // 2 · Como mucho un premio de nivel 3: es de meta larga, no del martes.
  const sinTercerosDeMas = porTurnos.filter(
    (p, i, todos) => p.tier !== 3 || todos.findIndex((q) => q.tier === 3) === i
  )

  // 3 · El suelo de nivel 1, aunque no se haya elegido «decidir».
  const conSuelo = [...sinTercerosDeMas]
  for (const titulo of PREMIOS_POR_TIPO.decidir) {
    if (conSuelo.filter((p) => p.tier === 1).length >= MINIMO_NIVEL_1) break
    const p = porTitulo(titulo)
    if (p && !conSuelo.includes(p)) conSuelo.push(p)
  }

  // 4 · Y el recorte, que se lleva por delante lo que NO es de nivel 1.
  // Cortar por la cola sin mirar el nivel deshacía el paso 3: quien
  // contestaba «planes fuera» acababa con dos de nivel 1 y el suelo
  // dejaba de ser suelo.
  const recortado = [...conSuelo]
  while (recortado.length > PREMIOS_EN_LA_TIENDA) {
    const desdeElFinal = [...recortado].reverse().findIndex((p) => p.tier !== 1)
    recortado.splice(desdeElFinal >= 0 ? recortado.length - 1 - desdeElFinal : recortado.length - 1, 1)
  }
  return recortado
}

/**
 * Los premios de la peque, que son OTROS.
 *
 * Su tienda filtra por precio (`TECHO_PEQUE`), no por nivel, porque a su
 * ritmo un premio de 325 Talis está a dieciocho días y a los tres años
 * eso no es un premio, es una decoración. Sin esto, su tarro se llena de
 * estrellas y su tienda sale vacía: el fallo estaba en el producto desde
 * que se subieron los precios.
 *
 * Que no se cuelen en la tienda de los demás lo resuelve el mismo techo
 * (`premiosParaMayores`). Es una regla por precio y no por dueño porque
 * `rewards` no tiene columna de dueño; el día que la tenga, esto se
 * sustituye por lo evidente.
 */
export const PREMIOS_DE_LA_PEQUE = [
  { title: 'Elegir el cuento de esta noche', emoji: '📖', cost: 15, tier: 1 },
  { title: 'Elegir la canción', emoji: '🎵', cost: 20, tier: 1 },
  { title: 'Elegir el juego de después de cenar', emoji: '🎲', cost: 35, tier: 1 },
  { title: 'Cinco minutos más de cuento', emoji: '🌙', cost: 55, tier: 1 }
]

export function metaDelPlan(respuestas, roles) {
  const opcion = opcionesDe('meta').find((o) => o.id === respuestas.meta)
  const propia = (respuestas.metaPropia || '').trim()
  return {
    title: opcion?.libre ? propia : opcion?.titulo || 'Meta del gremio',
    emoji: opcion?.emoji || '🏆',
    // La cifra NO se pregunta: sale del modelo de economía con los roles
    // reales de esta casa, para que la meta caiga alrededor de los 60
    // días pase lo que pase con el tamaño de la familia.
    target_xp: metaObjetivo(roles)
  }
}

/**
 * El plan completo. `miembros` son los del alta: {name, role}.
 */
export function planDeArranque(respuestas, miembros = []) {
  const conNombre = miembros.filter((m) => (m.name || '').trim())
  const roles = conNombre.map((m) => m.role)
  const hayPeque = roles.includes('peque')

  const porMiembro = conNombre.map((m) => ({
    miembro: m,
    misiones: misionesParaRol(m.role, respuestas)
  }))

  return {
    porMiembro,
    premios: [...premiosDelPlan(respuestas), ...(hayPeque ? PREMIOS_DE_LA_PEQUE : [])],
    meta: metaDelPlan(respuestas, roles),
    resumen: {
      personas: conNombre.length,
      misiones: porMiembro.reduce((t, p) => t + p.misiones.length, 0),
      premios: premiosDelPlan(respuestas).length + (hayPeque ? PREMIOS_DE_LA_PEQUE.length : 0),
      habilidades: [
        ...new Set(porMiembro.flatMap((p) => p.misiones.map((m) => m.skill)).filter(Boolean))
      ],
      techoPeque: hayPeque ? TECHO_PEQUE : null
    }
  }
}
