// ------------------------------------------------------------------
// Emojis para los premios.
//
// Había doce escritos a mano dentro del formulario, y con doce todos los
// premios de una casa acaban pareciéndose: el emoji es lo único que se ve
// de un premio en la tienda de la junior y, en la de la peque, lo ÚNICO
// que se ve, porque ahí no hay texto ni cifras. Que dos premios distintos
// lleven el mismo dibujo es, para ella, el mismo premio.
//
// Van agrupados y con nombre. El nombre no es documentación: es lo que
// hace que el buscador funcione, y con noventa emojis un buscador deja de
// ser un lujo. Los nombres están en castellano y con sinónimos de esta
// casa («peli» además de «película»), porque quien escribe en esa caja
// escribe como habla.
// ------------------------------------------------------------------

export const GRUPOS_EMOJI_PREMIO = [
  {
    grupo: 'Decidir',
    ayuda: 'Elegir algo. Los que mejor aguantan.',
    emojis: [
      { e: '🎬', n: 'película peli cine' },
      { e: '🎵', n: 'música canción' },
      { e: '📖', n: 'cuento libro leer' },
      { e: '🍝', n: 'cena menú pasta' },
      { e: '🥞', n: 'desayuno tortitas' },
      { e: '🗓️', n: 'plan actividad día' },
      { e: '🎲', n: 'juego de mesa dado' },
      { e: '👕', n: 'ropa vestirse' },
      { e: '🧭', n: 'excursión rumbo' },
      { e: '🪑', n: 'sitio asiento mesa' },
      { e: '🎤', n: 'karaoke cantar' },
      { e: '📻', n: 'radio emisora' }
    ]
  },
  {
    grupo: 'En casa',
    ayuda: 'Planes que no cuestan dinero.',
    emojis: [
      { e: '🏕️', n: 'fuerte de mantas acampada dentro' },
      { e: '👩‍🍳', n: 'cocinar receta' },
      { e: '🧁', n: 'repostería magdalena hornear' },
      { e: '🍿', n: 'palomitas sesión' },
      { e: '🛋️', n: 'sofá manta peli' },
      { e: '🎨', n: 'pintar dibujar manualidades' },
      { e: '🧩', n: 'puzle rompecabezas' },
      { e: '🪁', n: 'cometa jugar' },
      { e: '🛁', n: 'baño burbujas' },
      { e: '🌙', n: 'acostarse tarde noche cuento' },
      { e: '💛', n: 'tiempo de calidad juntos' },
      { e: '📣', n: 'elogio delante de todos' }
    ]
  },
  {
    grupo: 'Fuera',
    ayuda: 'Salidas. Cuestan más y valen más.',
    emojis: [
      { e: '🧺', n: 'picnic merienda campo' },
      { e: '🏞️', n: 'excursión monte naturaleza' },
      { e: '🏖️', n: 'playa arena' },
      { e: '🏊', n: 'piscina nadar' },
      { e: '🎡', n: 'feria noria parque de atracciones' },
      { e: '🎢', n: 'montaña rusa atracciones' },
      { e: '🦁', n: 'zoo animales' },
      { e: '🐠', n: 'acuario peces' },
      { e: '🏛️', n: 'museo exposición' },
      { e: '🎳', n: 'bolos bolera' },
      { e: '🛝', n: 'parque columpios tobogán' },
      { e: '🚂', n: 'tren viaje' },
      { e: '⛺', n: 'acampada tienda dormir fuera' },
      { e: '🌳', n: 'parque árbol aire libre' }
    ]
  },
  {
    grupo: 'Comer',
    ayuda: 'Con cuidado: la comida como premio se paga cara.',
    emojis: [
      { e: '🍕', n: 'pizza' },
      { e: '🍦', n: 'helado' },
      { e: '🍫', n: 'chocolate' },
      { e: '🥐', n: 'bollo croissant desayuno' },
      { e: '🍔', n: 'hamburguesa comer fuera' },
      { e: '🍽️', n: 'restaurante comer fuera cena' },
      { e: '🍓', n: 'fresa fruta' },
      { e: '🥤', n: 'batido bebida' },
      { e: '🍪', n: 'galleta' }
    ]
  },
  {
    grupo: 'Jugar y moverse',
    emojis: [
      { e: '⚽', n: 'fútbol pelota balón' },
      { e: '🏀', n: 'baloncesto canasta' },
      { e: '🚲', n: 'bici bicicleta' },
      { e: '🛼', n: 'patines patinar' },
      { e: '🛹', n: 'monopatín skate' },
      { e: '🤸', n: 'gimnasia saltar volteretas' },
      { e: '🥋', n: 'judo kárate artes marciales' },
      { e: '🏓', n: 'ping pong palas' },
      { e: '🧗', n: 'escalada rocódromo' },
      { e: '🏸', n: 'bádminton raqueta' },
      { e: '🎯', n: 'diana puntería juego' },
      { e: '🪀', n: 'yoyó juguete' }
    ]
  },
  {
    grupo: 'Aficiones',
    emojis: [
      { e: '🎮', n: 'videojuego consola pantalla' },
      { e: '🎸', n: 'guitarra música tocar' },
      { e: '🎻', n: 'violín música' },
      { e: '🎹', n: 'piano teclado' },
      { e: '🎭', n: 'teatro disfraz actuar' },
      { e: '📸', n: 'foto cámara' },
      { e: '🔭', n: 'estrellas telescopio astronomía' },
      { e: '🔬', n: 'ciencia experimento microscopio' },
      { e: '🪴', n: 'planta jardín cuidar' },
      { e: '🧶', n: 'lana coser tejer' },
      { e: '✂️', n: 'recortar manualidades' },
      { e: '🧱', n: 'construcción bloques piezas' }
    ]
  },
  {
    grupo: 'Con quien sea',
    ayuda: 'Premios que son una persona, no una cosa.',
    emojis: [
      { e: '👪', n: 'familia todos juntos' },
      { e: '🧑‍🤝‍🧑', n: 'amigo amiga invitar' },
      { e: '🐶', n: 'perro mascota' },
      { e: '🐱', n: 'gato mascota' },
      { e: '👵', n: 'abuela abuelos visita' },
      { e: '🎈', n: 'fiesta globos celebración' },
      { e: '🎂', n: 'cumpleaños tarta' },
      { e: '💌', n: 'carta nota sorpresa' },
      { e: '🌟', n: 'noche especial a solas con papa mama' }
    ]
  },
  {
    grupo: 'Grandes',
    ayuda: 'Para metas largas, no para un martes.',
    emojis: [
      { e: '🏆', n: 'trofeo meta gremio' },
      { e: '🎁', n: 'regalo sorpresa' },
      { e: '🗺️', n: 'viaje mapa aventura' },
      { e: '✈️', n: 'avión viaje' },
      { e: '🎟️', n: 'entrada espectáculo' },
      { e: '🚀', n: 'cohete grande' },
      { e: '🏰', n: 'castillo gremio' },
      { e: '⭐', n: 'estrella premio' }
    ]
  }
]

/** Lista plana, por si hace falta recorrerla entera. */
export const EMOJIS_PREMIO = GRUPOS_EMOJI_PREMIO.flatMap((g) => g.emojis)

/**
 * Busca por nombre. Sin acentos y sin mayúsculas, porque nadie escribe
 * «película» con tilde en una caja de búsqueda.
 */
export function buscarEmojiPremio(texto) {
  const limpio = normalizar(texto)
  if (!limpio) return EMOJIS_PREMIO
  return EMOJIS_PREMIO.filter((x) => normalizar(x.n).includes(limpio))
}

/**
 * El emoji que le pega a un título.
 *
 * Se usa solo al CREAR, y solo mientras el emoji siga siendo el que venía
 * por defecto: en cuanto alguien elige uno a mano, manda esa elección.
 * Escribir «Elegir la peli del viernes» y ver aparecer 🎬 ahorra el paso
 * de bajar a la rejilla, que es donde se abandona.
 */
export function emojiSugerido(titulo, porDefecto = '🎁') {
  const limpio = normalizar(titulo)
  if (!limpio) return porDefecto
  // Se recorre en el orden del catálogo y gana la palabra más larga que
  // aparezca: «cuento» debe ganarle a «ver» en «ver un cuento».
  let mejor = null
  for (const x of EMOJIS_PREMIO) {
    for (const palabra of normalizar(x.n).split(' ')) {
      if (palabra.length < 3 || !limpio.includes(palabra)) continue
      if (!mejor || palabra.length > mejor.largo) mejor = { e: x.e, largo: palabra.length }
    }
  }
  return mejor ? mejor.e : porDefecto
}

function normalizar(texto) {
  return (texto || '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
