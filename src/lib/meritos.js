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
 */
export function rachaMaxima(completions, profileId, diasSalvados = []) {
  const dias = [
    ...new Set([
      ...aprobadasDe(completions, profileId).map((c) => dayKey(new Date(c.resolved_at))),
      ...diasSalvados
    ])
  ]
  if (!dias.length) return 0

  // Se ordenan por fecha real, no por la cadena: dayKey no lleva ceros a
  // la izquierda ('2026-8-9'), así que ordenar como texto pone el 10 antes
  // que el 9 y parte la racha por la mitad.
  const ordenados = dias
    .map((k) => {
      const [a, m, d] = k.split('-').map(Number)
      return new Date(a, m - 1, d).getTime()
    })
    .sort((x, y) => x - y)

  let mejor = 1
  let actual = 1
  for (let i = 1; i < ordenados.length; i++) {
    const saltoDeUnDia = Math.round((ordenados[i] - ordenados[i - 1]) / 86400000) === 1
    actual = saltoDeUnDia ? actual + 1 : 1
    if (actual > mejor) mejor = actual
  }
  return mejor
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
    insignias: badges.filter((b) => b.profile_id === perfil.id).length,
    rachaMax: rachaMaxima(completions, perfil.id, diasSalvados),
    porHabilidad,
    habilidadesTocadas: Object.keys(porHabilidad).length,
    // La hora es la de validación, no la de petición: es la única que
    // consta cerrada. Madrugar y que te validen a mediodía no cuenta, y es
    // preferible quedarse corto a repartir una insignia que no toca.
    antesDeLasNueve: aprobadas.filter((c) => new Date(c.resolved_at).getHours() < 9).length,
    topAportacion: quienMasAporta(goal, completions, profiles) === perfil.id
  }
}
