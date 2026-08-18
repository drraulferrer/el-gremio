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
// entiende un tarro que se llena. Sus Talis se dibujan como estrellas:
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
 * El techo de lo que se le puede enseñar a la peque, en Talis.
 *
 * Ella no va por niveles: va por DISTANCIA. Gana unos 15 Talis al día,
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
 * premios de la peque cuestan quince o veinte Talis porque ella gana
 * cinco al día, y en la tienda de la junior serían gratis. Mientras
 * `rewards` no tenga columna de dueño —la misma que hace falta para el
 * poder `abre_premio`—, el ámbito lo marca el precio.
 */
export function premiosParaMayores(rewards = []) {
  return rewards.filter((r) => r.active && r.cost > TECHO_PEQUE)
}

// ------------------------------------------------------------------
// El andamio de los primeros días.
//
// El problema que resuelve, que es de producto y no de código: el premio
// más barato del catálogo cuesta 325 Talis, o sea ocho o nueve días de
// la junior. Los primeros días de una app así son justo los que deciden
// si se sigue usando, y en esos días la tienda no le da nada: ve una
// estantería entera de cosas que no puede tocar. La contramedida a la
// caída de novedad estaba escrita en la SPEC, pero el arranque no la
// tenía.
//
// La respuesta NO es bajar los precios del catálogo —eso convierte la
// tienda en una máquina expendedora, que es exactamente lo que se decidió
// evitar al espaciar las cadencias a 15/30/45 días—. Es poner unos pocos
// premios pequeños que se cobran en dos o tres días y sirven para arrancar
// la conducta, con la misma regla que gobierna el nivel 1: son DECISIONES,
// no cosas. Elegir la música, elegir la cena, quedarse un rato más.
//
// Y son andamio de verdad, no un nivel nuevo:
//
//  · Se quedan FUERA del modelo de economía (`fueraDelModelo`), así que no
//    ensucian el diagnóstico del panel ni el precio medio del nivel 1.
//  · No suben de precio al cambiar de temporada. Encarecerlos no les
//    añade dificultad, les quita el sentido: a la tercera temporada uno de
//    130 costaría 220 y ya no llegaría en tres días.
//  · Se retiran cuando el hábito se sostiene solo, que es lo que dice la
//    evidencia sobre las recompensas (Brown et al., 2018). El panel avisa
//    de ello al añadirlos.
//
// La banda es (TECHO_PEQUE, suelo del nivel 1) = (72, 324). No es una
// elección estética: por debajo de 72 caerían en la tienda de la peque,
// que filtra por precio, y por encima de 324 competirían con los premios
// de verdad en vez de dar el primer empujón. Los precios de aquí van de
// 80 a 240, o sea de dos a seis días de la junior, encadenando con las
// 325 del primer premio del catálogo sin dejar hueco.
// ------------------------------------------------------------------

export const PREMIOS_DE_ARRANQUE = [
  { title: 'Elegir la música de la cena', emoji: '🎵', cost: 80, tier: 1 },
  { title: 'Diez minutos de charla a solas', emoji: '💬', cost: 105, tier: 1 },
  { title: 'Quince minutos más antes de dormir', emoji: '🌙', cost: 130, tier: 1 },
  { title: 'Elegir qué se cena hoy', emoji: '🍽️', cost: 165, tier: 1 },
  { title: 'Elegir el plan del sábado por la tarde', emoji: '🕓', cost: 205, tier: 1 },
  { title: 'Comodín: hoy te libras de una misión', emoji: '🎟️', cost: 240, tier: 1 }
]

/**
 * Si un premio queda por debajo del suelo del modelo.
 *
 * Los dos conjuntos que caen aquí —los de la peque y los de arranque— son
 * andamio y no economía, y a los dos hay que tratarlos igual: no entran en
 * el diagnóstico de cadencias ni en la subida de temporada. Antes solo se
 * excluían los de la peque, y por eso en una casa con peque el nivel 1
 * salía con un precio medio de 190 Talis y el panel avisaba de que «se
 * consigue demasiado rápido» un premio que costaba 325.
 *
 * La regla va por precio y no por una columna porque `rewards` no tiene
 * dueño ni marca; el día que la tenga, esto se sustituye por lo evidente.
 */
export function fueraDelModelo(premio) {
  return (premio?.cost ?? 0) < NIVELES[1].coste[0]
}

/**
 * Los premios de arranque que esta tienda todavía no tiene.
 *
 * Compara por título e ignora si están activos: uno pausado ya está
 * puesto, y volver a añadirlo dejaría dos filas iguales, una encendida y
 * otra apagada.
 */
export function premiosDeArranqueQueFaltan(rewards = []) {
  const puestos = new Set(rewards.map((r) => r.title))
  return PREMIOS_DE_ARRANQUE.filter((p) => !puestos.has(p.title))
}

export function nivelDePremio(coste) {
  if (coste <= NIVELES[1].coste[1]) return 1
  if (coste <= NIVELES[2].coste[1]) return 2
  return 3
}
