// ------------------------------------------------------------------
// Catálogo de recompensas, ordenado por lo que dice la evidencia.
//
// La idea que gobierna esta lista: la recompensa no es el objetivo, es
// un andamio. Sirve para arrancar una conducta poco frecuente y hay que
// ir retirándola cuando el hábito ya se sostiene solo (Brown et al.,
// 2018: las recompensas por sí solas tienen efecto pequeño y funcionan
// mejor como iniciadores).
//
// Por eso el nivel 1 no son cosas: son decisiones. Elegir la película o
// la música del coche alimenta la autonomía, que es una de las tres
// necesidades que sostienen la motivación a largo plazo (Ryan y Deci).
// Cuesta poco, no se gasta y no pierde valor con el uso.
// ------------------------------------------------------------------

export const NIVELES = {
  1: {
    nombre: 'Decidir',
    lema: 'Elegir algo por ti. Lo que más aguanta con el tiempo.',
    coste: [30, 60],
    color: '#6ee7a0'
  },
  2: {
    nombre: 'Vivir',
    lema: 'Planes que se hacen juntos y se recuerdan.',
    coste: [80, 140],
    color: '#ffd166'
  },
  3: {
    nombre: 'Celebrar',
    lema: 'Los grandes. Para metas largas, no para el martes.',
    coste: [200, 400],
    color: '#c9a0ff'
  }
}

export const CATALOGO_PREMIOS = [
  // Nivel 1 · decidir. La que más evidencia tiene y la más barata de
  // sostener: no cuesta dinero y no se agota.
  { title: 'Elogio específico delante de la familia', emoji: '📣', cost: 30, tier: 1 },
  { title: 'Tiempo de calidad', emoji: '💛', cost: 40, tier: 1 },
  { title: 'Elegir una actividad', emoji: '🗓️', cost: 45, tier: 1 },
  { title: 'Elegir un juego', emoji: '🎲', cost: 35, tier: 1 },
  { title: 'Elegir el cuento', emoji: '📖', cost: 30, tier: 1 },
  { title: 'Elegir la música del coche', emoji: '🎵', cost: 30, tier: 1 },
  { title: 'Elegir la película', emoji: '🎬', cost: 50, tier: 1 },
  { title: 'Elegir el desayuno del domingo', emoji: '🥞', cost: 45, tier: 1 },
  { title: 'Elegir la excursión', emoji: '🧭', cost: 60, tier: 1 },
  { title: 'Elegir el menú del viernes', emoji: '🍝', cost: 50, tier: 1 },

  // Nivel 2 · experiencias compartidas.
  { title: 'Cocinar juntos', emoji: '👩‍🍳', cost: 80, tier: 2 },
  { title: 'Dormir en un fuerte de mantas', emoji: '🏕️', cost: 90, tier: 2 },
  { title: 'Noche de juegos', emoji: '🎯', cost: 90, tier: 2 },
  { title: 'Picnic', emoji: '🧺', cost: 100, tier: 2 },
  { title: 'Cine', emoji: '🍿', cost: 120, tier: 2 },
  { title: 'Helado', emoji: '🍦', cost: 80, tier: 2 },
  { title: 'Ir a la piscina', emoji: '🏊', cost: 110, tier: 2 },
  { title: 'Excursión especial', emoji: '🏞️', cost: 140, tier: 2 },

  // Nivel 3 · para metas del gremio o rachas largas.
  { title: 'Elegir una actividad de fin de semana', emoji: '🗺️', cost: 200, tier: 3 },
  { title: 'Ir al parque de aventuras', emoji: '🎢', cost: 300, tier: 3 },
  { title: 'Escalada', emoji: '🧗', cost: 250, tier: 3 },
  { title: 'Bolera', emoji: '🎳', cost: 220, tier: 3 },
  { title: 'Acampada', emoji: '⛺', cost: 400, tier: 3 },
  // En la lista original ponía "elegido por el niño"; en esta casa son
  // dos niñas y el premio lo puede canjear cualquiera, así que va neutro.
  { title: 'Museo a elegir', emoji: '🏛️', cost: 200, tier: 3 },
  { title: 'Noche especial con uno de los padres', emoji: '🌟', cost: 300, tier: 3 }
]

/**
 * Lo que conviene NO poner en la tienda, y por qué. Se enseña en el
 * panel al crear un premio: es más útil ahí que en un documento que
 * nadie va a releer.
 */
export const EVITAR = [
  { que: 'Dinero', porque: 'Convierte el sistema en un sueldo y desplaza el motivo de hacerlo.' },
  { que: 'Chucherías', porque: 'Premiar con comida enseña a regular emociones comiendo.' },
  { que: 'Pantallas como premio habitual', porque: 'Les da un valor extra justo al que más cuesta limitar.' },
  { que: 'Comprar juguetes por tareas', porque: 'El efecto dura lo que dura la novedad del juguete.' },
  { que: 'Premios impredeciblemente grandes', porque: 'Rompen la previsibilidad, que es lo que sostiene el hábito.' }
]

/** Selección de arranque: casi todo nivel 1, un par de nivel 2 y uno grande. */
export const PREMIOS_INICIALES = CATALOGO_PREMIOS.filter((p) =>
  [
    'Elegir el cuento',
    'Elegir la música del coche',
    'Elegir la película',
    'Tiempo de calidad',
    'Cocinar juntos',
    'Noche de juegos',
    'Ir al parque de aventuras'
  ].includes(p.title)
)

export function nivelDePremio(coste) {
  if (coste <= NIVELES[1].coste[1]) return 1
  if (coste <= NIVELES[2].coste[1]) return 2
  return 3
}
