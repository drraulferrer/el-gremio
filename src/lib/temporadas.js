// ------------------------------------------------------------------
// Temporadas: la progresión del gremio.
//
// Cada meta del gremio lograda cierra una temporada y abre la siguiente.
// Se eligió ese disparador (y no el nivel de cada persona) porque la
// tienda es compartida: si cada quien avanzara a su ritmo, cada quien
// vería precios distintos y dejaría de ser una tienda para ser una
// tarifa. La meta ya era el hito colectivo que se celebra; ahora además
// deja huella.
//
// QUÉ NO PASA AL CAMBIAR DE TEMPORADA, que es lo que preocupaba:
// nadie pierde XP ni baja de nivel. La XP personal es acumulativa y la
// curva no tiene tope. Lo único que se reinicia es la barra de la meta,
// que es otro contador: cada meta es un reto nuevo.
//
// QUÉ SÍ PASA:
//  · el gremio sube de rango y eso se ve;
//  · los precios suben, así que la dificultad crece sola;
//  · se desbloquea un escalón de premios que antes no existía.
//
// Los precios suben un 30 % por temporada. No es un número redondo por
// gusto: por debajo del 20 % no se nota y deja de ser progresión, y por
// encima del 50 % la temporada 4 pide diez veces más que la primera y el
// sistema se rompe por arriba.
// ------------------------------------------------------------------

export const SUBIDA_POR_TEMPORADA = 0.3

export const RANGOS_GREMIO = [
  { temporada: 1, nombre: 'Gremio novato', emoji: '🌱' },
  { temporada: 2, nombre: 'Gremio con oficio', emoji: '🔨' },
  { temporada: 3, nombre: 'Gremio veterano', emoji: '🛡️' },
  { temporada: 4, nombre: 'Gremio ilustre', emoji: '⚜️' },
  { temporada: 5, nombre: 'Gremio legendario', emoji: '🐉' }
]

/**
 * En qué temporada va el gremio. Se deriva de las metas ya logradas en
 * vez de guardarse en una columna: así no puede desincronizarse con la
 * realidad, que es el bug clásico de los contadores duplicados.
 */
export function temporadaActual(metas = []) {
  return metas.filter((m) => m.achieved).length + 1
}

/** El rango que corresponde. A partir de la última, se queda en la última. */
export function rangoDeGremio(temporada) {
  const n = Math.max(1, Math.floor(temporada) || 1)
  return RANGOS_GREMIO[Math.min(n, RANGOS_GREMIO.length) - 1]
}

/**
 * Lo que cuesta algo en esta temporada. El precio base es el de la
 * temporada 1; a partir de ahí sube un 30 % compuesto.
 */
export function precioEnTemporada(base, temporada) {
  const n = Math.max(1, Math.floor(temporada) || 1)
  return Math.round((base * Math.pow(1 + SUBIDA_POR_TEMPORADA, n - 1)) / 5) * 5
}

/**
 * Lo que pasará a costar un premio al abrir la temporada siguiente.
 *
 * Se aplica sobre el precio ACTUAL y no sobre un precio base guardado en
 * ninguna parte, y por eso compone solo: cada temporada aplica su subida
 * una vez, encima de lo que ya valía. Redondeado a cinco porque un premio
 * de 1.053 monedas no lo lee nadie.
 */
export function precioSiguienteTemporada(actual) {
  return Math.round((Number(actual) * (1 + SUBIDA_POR_TEMPORADA)) / 5) * 5
}

/**
 * Qué premios entran en la subida de precios de la temporada nueva.
 *
 * Solo los que están DENTRO del modelo, o sea a partir del suelo del
 * nivel 1. Lo que queda por debajo es andamio —los premios de la peque y
 * los de arranque de la junior— y no es una excepción por ser barato: es
 * que ni ella ni el arranque van por temporadas, van por distancia. Se
 * gana lo mismo cada día pase lo que pase, así que subirles el precio no
 * les añade dificultad, les quita el premio. Un premio que no llega nunca
 * no motiva, decora.
 *
 * El parámetro se llamaba `techoPeque` y era el techo de la peque (72).
 * Pasó a ser el suelo del modelo (324) cuando entraron los premios de
 * arranque, que estaban justo en el hueco entre los dos y se encarecían
 * hasta dejar de ser alcanzables.
 */
export function premiosQueSuben(rewards = [], suelo = 0) {
  return rewards.filter((r) => r.active && r.cost >= suelo)
}

/**
 * A partir de qué temporada se puede canjear un premio.
 *
 * Los de nivel 1 y 2 están desde el principio; los de nivel 3 aparecen en
 * la segunda, y a partir de ahí cada temporada desbloquea un escalón
 * nuevo. Un premio bloqueado NO se esconde: se enseña apagado, porque ver
 * lo que viene es lo que da sentido a seguir.
 */
export function temporadaQueDesbloquea(tier) {
  return Math.max(1, (Number(tier) || 2) - 1)
}

export function estaDesbloqueado(premio, temporada) {
  return temporada >= temporadaQueDesbloquea(premio?.tier)
}

/** Resumen para la pantalla: dónde está el gremio y qué trae lo siguiente. */
export function estadoDeTemporada(metas = []) {
  const temporada = temporadaActual(metas)
  const rango = rangoDeGremio(temporada)
  const siguiente = rangoDeGremio(temporada + 1)
  const logradas = metas.filter((m) => m.achieved)
  return {
    temporada,
    rango,
    siguiente: siguiente.temporada > rango.temporada ? siguiente : null,
    metasLogradas: logradas.length,
    // El acumulado histórico: lo que la barra de la meta activa no enseña
    // y que es justo lo que daba sensación de perderse.
    xpHistorica: logradas.reduce((t, m) => t + (m.target_xp || 0), 0),
    subidaDePrecios: Math.round((Math.pow(1 + SUBIDA_POR_TEMPORADA, temporada - 1) - 1) * 100)
  }
}
