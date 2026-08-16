// ------------------------------------------------------------------
// El camino de la racha.
//
// La idea es la de Duolingo, y funciona por una razón concreta: una
// racha convierte «hoy no me apetece» en «no quiero romperla». El coste
// de fallar deja de ser abstracto. Pero lo que sostiene el hábito no es
// el número: es VER el siguiente hito y saber cuánto falta. Un contador
// suelto dice «llevas 9 días» y no dice nada más; un camino dice «te
// faltan cinco para el de dos semanas», que es una frase accionable.
//
// TRES DECISIONES QUE NO SON COSMÉTICAS:
//
// 1. La racha se cuenta POR DÍA con algo aprobado, no por misión
//    concreta. Contar por misión premiaría tener una fácil fija, que es
//    justo la conducta que no interesa reforzar.
//
// 2. El día de hoy NO rompe la racha hasta que se acaba. Si a las cinco
//    de la tarde aún no ha hecho nada, la racha sigue viva y en riesgo.
//    Marcarla como rota a mediodía sería castigar por adelantado, y el
//    aviso «hoy todavía no» es lo que de verdad hace que se levante.
//
// 3. Un día SIN misiones asignadas es neutro: ni rompe la racha ni la
//    alarga. Llegó con la planificación por días de la semana, y sin él
//    esa funcionalidad se lleva por delante esta: a quien le tocan lunes,
//    miércoles y viernes, el martes no tiene nada que hacer.
//
//    Los días neutros van SEPARADOS de los salvados con comodín, y esa
//    separación no es un detalle de implementación. Un comodín cuenta
//    como día HECHO —tapa y suma—; un día neutro solo tapa. Si los
//    neutros entraran por `diasSalvados`, a quien solo tuviera misiones
//    los lunes le contarían los otros seis días como hechos y llegaría a
//    los cien días sin haber hecho nada. El número que se enseña sigue
//    siendo real: con días alternos, el hito de 30 cuesta más semanas de
//    calendario, y eso es correcto y no hay que maquillarlo.
//
// 4. Cada hito se paga UNA VEZ EN LA VIDA, no una vez por racha. Si se
//    rompe y se vuelve a los siete días, no se cobra otra vez: si no,
//    romper la racha a propósito cada semana sería la forma más rentable
//    de jugar, y el sistema estaría premiando exactamente lo contrario de
//    lo que quiere premiar. Lo garantiza un índice único en Postgres, no
//    esta comprobación.
//
// LAS CIFRAS. Con los supuestos de economia.js una persona junior gana
// unas 38 monedas al día y un adulto 24. El camino entero paga 445 en
// cien días: alrededor del 11 % de lo que gana la junior en ese tiempo, y
// solo si no falla NI UN DÍA. Es un extra por algo excepcional, no una
// segunda fuente de ingresos, y por eso los primeros hitos pagan poco:
// lo que motiva al principio es llegar, no cobrar.
// ------------------------------------------------------------------

import { dayKey } from './supabase'

export const HITOS = [
  { dias: 3, nombre: 'Tres días', emoji: '🌱', monedas: 5 },
  { dias: 7, nombre: 'Una semana', emoji: '🔥', monedas: 15 },
  { dias: 14, nombre: 'Dos semanas', emoji: '⚡', monedas: 25 },
  { dias: 21, nombre: 'Ya es costumbre', emoji: '🧗', monedas: 40 },
  { dias: 30, nombre: 'Un mes entero', emoji: '🏔️', monedas: 60 },
  { dias: 50, nombre: 'Cincuenta', emoji: '💎', monedas: 100 },
  { dias: 100, nombre: 'Cien días', emoji: '👑', monedas: 200 }
]

/** El tipo con el que se guarda el cobro de un hito en `bonuses`. */
export const tipoDeHito = (dias) => `racha:${dias}`

/** Los días con algo aprobado, más los tapados con un comodín. */
function diasConAlgo(completions = [], profileId, diasSalvados = []) {
  return new Set([
    ...completions
      .filter((c) => c.profile_id === profileId && c.status === 'aprobado' && c.resolved_at)
      .map((c) => dayKey(new Date(c.resolved_at))),
    ...diasSalvados
  ])
}

/** ¿Ha hecho algo hoy? Es lo que separa «en riesgo» de «al día». */
export function hoyHecho(completions = [], profileId, diasSalvados = [], hoy = new Date()) {
  return diasConAlgo(completions, profileId, diasSalvados).has(dayKey(hoy))
}

/**
 * La racha viva: días CUMPLIDOS hacia atrás desde hoy.
 *
 * Si hoy todavía no hay nada, se cuenta hasta ayer y la racha sigue viva:
 * el día no ha terminado. Ver la decisión 2 de arriba.
 *
 * `diasNeutros` son los días sin misiones asignadas: se atraviesan sin
 * sumar y sin cortar. Por eso el bucle lleva dos contadores —lo caminado
 * y lo contado—: el tope de 400 es del primero, o una lista larga de días
 * neutros lo dejaría dando vueltas.
 */
export function rachaActual(completions = [], profileId, diasSalvados = [], hoy = new Date(), diasNeutros = []) {
  const dias = diasConAlgo(completions, profileId, diasSalvados)
  const neutros = new Set(diasNeutros)
  const cursor = new Date(hoy)
  if (!dias.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)

  let racha = 0
  for (let pasos = 0; pasos < 400; pasos++) {
    const clave = dayKey(cursor)
    if (dias.has(clave)) racha++
    else if (!neutros.has(clave)) break
    cursor.setDate(cursor.getDate() - 1)
  }
  return racha
}

/**
 * Racha viva pero sin nada hecho hoy: es cuando hay que avisar.
 *
 * Un día neutro nunca está en riesgo: no se puede avisar de que se va a
 * perder algo por no hacer lo que no hay que hacer.
 */
export function enRiesgo(completions = [], profileId, diasSalvados = [], hoy = new Date(), diasNeutros = []) {
  if (diasNeutros.includes(dayKey(hoy))) return false
  return (
    rachaActual(completions, profileId, diasSalvados, hoy, diasNeutros) > 0 &&
    !hoyHecho(completions, profileId, diasSalvados, hoy)
  )
}

/** El hito al que se camina ahora. Null cuando ya están todos. */
export function siguienteHito(racha = 0) {
  return HITOS.find((h) => h.dias > racha) || null
}

/**
 * El camino para dibujar: cada hito con su estado y, en el que toca,
 * cuánto falta.
 *
 * Los ya logrados NO se esconden. Ver de dónde vienes es la mitad de lo
 * que sostiene una racha larga; un camino que solo enseña lo que queda es
 * una lista de deberes.
 */
export function caminoDe(racha = 0) {
  const siguiente = siguienteHito(racha)
  return HITOS.map((h) => {
    const logrado = racha >= h.dias
    const esSiguiente = siguiente?.dias === h.dias
    const anterior = HITOS.filter((x) => x.dias < h.dias).map((x) => x.dias).pop() || 0
    return {
      ...h,
      estado: logrado ? 'logrado' : esSiguiente ? 'siguiente' : 'lejos',
      faltan: Math.max(0, h.dias - racha),
      // Progreso DESDE el hito anterior, no desde cero: si fuera desde
      // cero, el tramo de 50 a 100 avanzaría medio punto por día y la
      // barra parecería parada durante siete semanas.
      pct: logrado ? 100 : Math.max(0, Math.round((100 * (racha - anterior)) / (h.dias - anterior)))
    }
  })
}

/** Los hitos alcanzados que todavía no se han cobrado. */
export function hitosPorCobrar(racha = 0, bonuses = [], profileId) {
  const cobrados = new Set(
    bonuses.filter((b) => b.profile_id === profileId).map((b) => b.tipo)
  )
  return HITOS.filter((h) => racha >= h.dias && !cobrados.has(tipoDeHito(h.dias)))
}
