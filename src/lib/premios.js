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
//
// Los precios NO están puestos a ojo: salen de src/lib/economia.js, que
// declara cuánto se gana al día y cada cuánto debería caer cada nivel.
// Las bandas de aquí son las que devuelve ese modelo, y hay un test que
// falla si alguien cambia los puntos de las misiones y las descuadra.
//
// Revisados DOS veces el 15-ago-2026: primero al espaciar las cadencias a
// 15/30/45 días, y después al subir el presupuesto de misiones de 5 a 8
// porque la familia quería 6-7 diarias. Lo segundo sube los precios un
// 60 %: si se gana un 60 % más al día, un premio que debe caer cada 30
// días tiene que costar un 60 % más, o la tienda se regala.
//
// Precios revisados el 15-ago-2026 al espaciar las cadencias a 15/30/45
// días. Los números subieron mucho (nivel 1 de ~35 a ~270) porque lo que
// cambió no fue el valor de los premios sino cada cuánto deben caer: si un
// premio se puede pagar en dos días, la tienda es una máquina expendedora.
// El orden relativo entre premios se conservó mapeando cada nivel a su
// banda nueva, así que «Helado» sigue siendo el más barato de su nivel.
// ------------------------------------------------------------------

export const NIVELES = {
  1: {
    nombre: 'Decidir',
    lema: 'Elegir algo por ti. Lo que más aguanta con el tiempo.',
    coste: [324, 540],
    color: '#6ee7a0'
  },
  2: {
    nombre: 'Vivir',
    lema: 'Planes que se hacen juntos y se recuerdan.',
    coste: [648, 1080],
    color: '#ffd166'
  },
  3: {
    nombre: 'Celebrar',
    lema: 'Los grandes. Para metas largas, no para el martes.',
    coste: [1110, 1620],
    color: '#c9a0ff'
  }
}

export const CATALOGO_PREMIOS = [
  // Nivel 1 · decidir. La que más evidencia tiene y la más barata de
  // sostener: no cuesta dinero y no se agota.
  { title: 'Elogio específico delante de la familia', emoji: '📣', cost: 325, tier: 1 },
  { title: 'Tiempo de calidad', emoji: '💛', cost: 480, tier: 1 },
  { title: 'Elegir una actividad', emoji: '🗓️', cost: 480, tier: 1 },
  { title: 'Elegir un juego', emoji: '🎲', cost: 350, tier: 1 },
  { title: 'Elegir el cuento', emoji: '📖', cost: 325, tier: 1 },
  { title: 'Elegir la música del coche', emoji: '🎵', cost: 325, tier: 1 },
  { title: 'Elegir la película', emoji: '🎬', cost: 505, tier: 1 },
  { title: 'Elegir el desayuno del domingo', emoji: '🥞', cost: 450, tier: 1 },
  { title: 'Elegir la excursión', emoji: '🧭', cost: 540, tier: 1 },
  { title: 'Elegir el menú del viernes', emoji: '🍝', cost: 505, tier: 1 },

  // Nivel 2 · experiencias compartidas.
  { title: 'Cocinar juntos', emoji: '👩‍🍳', cost: 690, tier: 2 },
  { title: 'Dormir en un fuerte de mantas', emoji: '🏕️', cost: 760, tier: 2 },
  { title: 'Noche de juegos', emoji: '🎯', cost: 720, tier: 2 },
  { title: 'Picnic', emoji: '🧺', cost: 830, tier: 2 },
  { title: 'Cine', emoji: '🍿', cost: 1010, tier: 2 },
  { title: 'Helado', emoji: '🍦', cost: 650, tier: 2 },
  { title: 'Ir a la piscina', emoji: '🏊', cost: 905, tier: 2 },
  { title: 'Excursión especial', emoji: '🏞️', cost: 1080, tier: 2 },

  // Nivel 3 · para metas del gremio o rachas largas.
  { title: 'Elegir una actividad de fin de semana', emoji: '🗺️', cost: 1125, tier: 3 },
  { title: 'Ir al parque de aventuras', emoji: '🎢', cost: 1495, tier: 3 },
  { title: 'Ir a comer fuera', emoji: '🍽️', cost: 1315, tier: 3 },
  { title: 'Bolera', emoji: '🎳', cost: 1200, tier: 3 },
  { title: 'Acampada', emoji: '⛺', cost: 1620, tier: 3 },
  // En la lista original ponía "elegido por el niño"; en esta casa son
  // dos niñas y el premio lo puede canjear cualquiera, así que va neutro.
  { title: 'Museo a elegir', emoji: '🏛️', cost: 1110, tier: 3 },
  { title: 'Noche especial con uno de los padres', emoji: '🌟', cost: 1395, tier: 3 }
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

// La tienda de arranque tampoco se decide aquí: la arma `setup.js` con lo
// que contesta la familia en el alta, respetando dos reglas suyas (al
// menos tres premios de nivel 1 y como mucho uno de nivel 3).

// ------------------------------------------------------------------
// La tienda de la peque.
//
// A los tres años no se leen números ni se entiende un saldo, pero sí se
// entiende un tarro que se llena. Sus monedas se dibujan como estrellas:
// una estrella = una misión suya, que es la unidad con la que ella cuenta
// de verdad. Si un adulto cambia lo que valen sus misiones, la conversión
// deja de cuadrar exactamente; se prefiere eso a enseñarle cifras.
// ------------------------------------------------------------------

export const MONEDAS_POR_ESTRELLA = 5

export function estrellasDe(monedas) {
  return Math.floor((monedas || 0) / MONEDAS_POR_ESTRELLA)
}

export function estrellasQueCuesta(coste) {
  return Math.max(1, Math.round(coste / MONEDAS_POR_ESTRELLA))
}

/**
 * El techo de lo que se le puede enseñar a la peque, en monedas.
 *
 * Ella no va por niveles: va por DISTANCIA. Gana unas 15 monedas al día,
 * así que este techo son unos tres días de espera, que es lo máximo que
 * sostiene una niña de tres años sin que el premio deje de existir para
 * ella. Cuando las cadencias de la familia se espaciaron a 15/30/45 días
 * (agosto 2026), el nivel 1 pasó a costar ~270 y ella se quedó fuera: el
 * mismo premio que a la junior le cuesta cinco días a ella le costaba
 * dieciocho. Por eso su tienda filtra por precio y no por nivel.
 */
export const TECHO_PEQUE = 72

/**
 * Los premios que se le enseñan a ella: los que puede alcanzar de verdad.
 * Un premio que no llega nunca no motiva, decora.
 */
export function premiosParaPeque(rewards = []) {
  return rewards.filter((r) => r.active && r.cost <= TECHO_PEQUE).sort((a, b) => a.cost - b.cost)
}

/**
 * Y los de todos los demás: los que están POR ENCIMA de su techo.
 *
 * El mismo número parte la tienda en dos, y hace falta que la parta: los
 * premios de la peque cuestan quince o veinte monedas porque ella gana
 * cinco al día, y en la tienda de la junior serían gratis. Mientras
 * `rewards` no tenga columna de dueño —la misma que hace falta para el
 * poder `abre_premio`—, el ámbito lo marca el precio.
 */
export function premiosParaMayores(rewards = []) {
  return rewards.filter((r) => r.active && r.cost > TECHO_PEQUE)
}

export function nivelDePremio(coste) {
  if (coste <= NIVELES[1].coste[1]) return 1
  if (coste <= NIVELES[2].coste[1]) return 2
  return 3
}
