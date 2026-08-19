// ------------------------------------------------------------------
// Los méritos de cada persona.
//
// Las insignias declaran QUÉ hace falta (`test: (s) => s.rachaMax >= 7`);
// este fichero calcula ese `s` a partir de lo que hay cargado. Están
// separados a propósito: el catálogo se lee de un vistazo y se cambia sin
// tocar cuentas, y las cuentas se prueban sin tocar el catálogo.
//
// Todo sale de `completions` aprobadas. No hay contadores guardados en
// `profiles` y no los va a haber: un contador duplicado se desincroniza el
// día que alguien deshace una misión, y deshacer es una operación normal
// aquí, no una excepción.
// ------------------------------------------------------------------

import { dayKey, levelFromXp } from './supabase'
import { diasNeutros } from './misiones'
import { insigniaPorCodigo } from './insignias'

/** Las aprobadas de una persona, que es la base de casi todo lo demás. */
function aprobadasDe(completions, profileId) {
  return completions.filter((c) => c.profile_id === profileId && c.status === 'aprobado' && c.resolved_at)
}

/**
 * La racha más larga de días naturales seguidos con algo aprobado.
 *
 * Se cuenta por DÍA y no por misión concreta: la insignia reconoce
 * constancia, y quien un martes hace la cama y el miércoles pone la mesa
 * ha sido igual de constante que quien repitió la misma. Contar por misión
 * concreta premiaría además tener misiones fáciles fijas, que es justo la
 * conducta que no interesa reforzar.
 *
 * Es la racha MÁXIMA histórica, no la actual: una insignia que se pierde
 * al fallar un día castiga en vez de reconocer, y lo que se ganó ganado
 * está.
 *
 * `diasSalvados` son los días cubiertos con un comodín. Cuentan como día
 * hecho, y ese es TODO el efecto del comodín: sin esto sería un botón que
 * gasta un uso y no cambia nada, que es peor que no tenerlo.
 *
 * `diasNeutros` son los días sin misiones asignadas y son otra cosa: no
 * cuentan como día hecho, solo dejan pasar. Un hueco entre dos días
 * hechos se puentea si TODOS los días de en medio son neutros, y lo que
 * se suma sigue siendo el número de días cumplidos. Ver la decisión 3 de
 * `rachas.js`.
 */
export function rachaMaxima(completions, profileId, diasSalvados = [], diasNeutros = []) {
  // dayKey no lleva ceros a la izquierda ('2026-8-9'), así que ordenar
  // como texto pone el 10 antes que el 9 y parte la racha por la mitad.
  // Todo se pasa a la misma medianoche local, que es también la que
  // reconstruye el paseo por los huecos.
  const aFecha = (k) => {
    const [a, m, d] = k.split('-').map(Number)
    return new Date(a, m - 1, d).getTime()
  }

  const dias = [
    ...new Set([
      ...aprobadasDe(completions, profileId).map((c) => dayKey(new Date(c.resolved_at))),
      ...diasSalvados
    ])
  ]
  if (!dias.length) return 0

  const neutros = new Set(diasNeutros.map(aFecha))
  const ordenados = dias.map(aFecha).sort((x, y) => x - y)

  let mejor = 1
  let actual = 1
  for (let i = 1; i < ordenados.length; i++) {
    actual = huecoSalvable(ordenados[i - 1], ordenados[i], neutros) ? actual + 1 : 1
    if (actual > mejor) mejor = actual
  }
  return mejor
}

/**
 * ¿Se puede ir de un día hecho al siguiente sin romper? Sí si son
 * consecutivos, o si todo lo que hay en medio son días neutros.
 *
 * Se camina con `setDate` y no sumando 86.400.000 ms porque las noches de
 * cambio de hora duran 23 o 25: sumando milisegundos, la medianoche se
 * desplaza y ninguna de las claves de después coincide.
 */
function huecoSalvable(desde, hasta, neutros) {
  const saltos = Math.round((hasta - desde) / 86400000)
  if (saltos === 1) return true
  if (saltos < 1 || saltos > 400) return false
  const cursor = new Date(desde)
  for (let i = 1; i < saltos; i++) {
    cursor.setDate(cursor.getDate() + 1)
    if (!neutros.has(cursor.getTime())) return false
  }
  return true
}

/** Cuántas aprobadas de cada habilidad. Sin XP: aquí cuenta la repetición. */
export function aprobadasPorHabilidad(completions, challenges, profileId) {
  const habilidadDe = new Map(challenges.map((ch) => [ch.id, ch.skill]))
  return aprobadasDe(completions, profileId).reduce((acc, c) => {
    const skill = habilidadDe.get(c.challenge_id)
    if (!skill) return acc
    return { ...acc, [skill]: (acc[skill] || 0) + 1 }
  }, {})
}

/**
 * Quién ha aportado más XP a la meta en curso.
 *
 * Devuelve el id, o null si nadie ha aportado nada todavía: sin este
 * matiz, en un gremio recién fundado la insignia «Mano derecha» se la
 * llevaría quien apareciera primero en la lista con cero XP.
 */
export function quienMasAporta(goal, completions, profiles = []) {
  if (!goal) return null
  const desde = new Date(goal.starts_at).getTime()
  const activos = new Set(profiles.map((p) => p.id))

  const porPersona = completions
    .filter((c) => c.status === 'aprobado' && c.resolved_at && new Date(c.resolved_at).getTime() >= desde)
    .filter((c) => activos.has(c.profile_id))
    .reduce((acc, c) => ({ ...acc, [c.profile_id]: (acc[c.profile_id] || 0) + c.xp }), {})

  const orden = Object.entries(porPersona).sort((a, b) => b[1] - a[1])
  if (!orden.length || orden[0][1] <= 0) return null
  // Empate técnico: sin desempate, la insignia bailaría de una persona a
  // otra en cada recarga según el orden del objeto. Con empate, nadie.
  if (orden.length > 1 && orden[1][1] === orden[0][1]) return null
  return orden[0][0]
}

/**
 * Todo lo que necesita saber el catálogo de insignias sobre una persona.
 * @param {object} perfil
 * @param {object} datos  el `data` de App.jsx (completions, challenges, …)
 */
export function meritosDe(perfil, datos) {
  const {
    completions = [],
    challenges = [],
    redemptions = [],
    badges = [],
    goal = null,
    profiles = [],
    powerUses = []
  } = datos || {}
  const aprobadas = aprobadasDe(completions, perfil.id)
  const porHabilidad = aprobadasPorHabilidad(completions, challenges, perfil.id)
  const diasSalvados = powerUses
    .filter((u) => u.profile_id === perfil.id && u.tipo === 'salva_racha')
    .map((u) => dayKey(new Date(u.used_at)))

  return {
    approved: aprobadas.length,
    level: levelFromXp(perfil.xp),
    redemptions: redemptions.filter((r) => r.profile_id === perfil.id && r.status !== 'cancelado').length,
    // Solo las DIECISÉIS de siempre.
    //
    // `coleccionista` pregunta «¿nadie juntó diez insignias antes?», y esa
    // pregunta se escribió contra un catálogo de dieciséis. Al encender el
    // motor v1, un perfil pasa de tres sellos a doce en una sola pasada
    // retroactiva, así que la única del gremio se la llevaría quien
    // abriese la app primero. Eso no es un mérito, es el orden en que se
    // desayuna, y es justo la comparación entre miembros que el catálogo
    // nuevo retira. Contar solo el catálogo viejo deja la regla midiendo
    // lo que medía.
    insignias: badges.filter((b) => b.profile_id === perfil.id && insigniaPorCodigo(b.code)).length,
    rachaMax: rachaMaxima(completions, perfil.id, diasSalvados, diasNeutros(perfil, challenges)),
    porHabilidad,
    habilidadesTocadas: Object.keys(porHabilidad).length,
    // La hora es la de validación, no la de petición: es la única que
    // consta cerrada. Madrugar y que te validen a mediodía no cuenta, y es
    // preferible quedarse corto a repartir una insignia que no toca.
    antesDeLasNueve: aprobadas.filter((c) => new Date(c.resolved_at).getHours() < 9).length,
    topAportacion: quienMasAporta(goal, completions, profiles) === perfil.id
  }
}
