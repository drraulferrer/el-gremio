// ------------------------------------------------------------------
// El cuadro de mando del panel parental.
//
// Responde a las cuatro preguntas que un adulto se hace de verdad, y que
// hasta ahora obligaban a recorrer cuatro pantallas sumando de cabeza:
// cuántas misiones tiene cada cual, cuántas está cumpliendo, cuánto ha
// puesto en la meta común y qué premios se ha llevado.
//
// UNA ADVERTENCIA QUE NO ES DECORATIVA: esto vive detrás del PIN y no se
// enseña nunca en el tablero de nadie. La app no tiene ranking a
// propósito —la única comparación es la meta compartida— y ver «tu
// hermana aportó el doble» convertiría una casa en una liga. Para los
// adultos sí es información útil: enseña quién está cargando con todo y
// quién lleva una semana sin aparecer, que es justo lo que hay que ver
// antes de repartir misiones otra vez.
//
// Todo se calcula aquí y en pantalla no se suma nada, por la misma razón
// de siempre: una cuenta metida en el JSX no se puede probar.
// ------------------------------------------------------------------

import { levelFromXp, dayKey, goalProgress } from './supabase'
import { misionesDe, diasNeutros } from './misiones'
import { semana, validadasDe, resumenDeSemana } from './historial'
import { rachaMaxima } from './meritos'
import { ORDEN_FRECUENCIA } from './misiones'

/** Las misiones activas que le tocan, contadas por frecuencia. */
export function asignadasA(perfil, challenges = []) {
  const mias = misionesDe(perfil, challenges)
  const porFrecuencia = ORDEN_FRECUENCIA.reduce(
    (acc, f) => ({ ...acc, [f]: mias.filter((m) => m.frequency === f).length }),
    {}
  )
  return { ...porFrecuencia, total: mias.length }
}

/**
 * Lo que ha aportado a la meta EN CURSO.
 *
 * Solo cuenta desde que la meta arrancó, igual que la barra que ve toda
 * la familia: si contara la XP de siempre, quien lleva más tiempo en el
 * gremio saldría eternamente arriba y el reparto no diría nada del mes.
 */
export function aportacionAMeta(perfil, goal, completions = []) {
  if (!goal) return { xp: 0, pct: 0 }
  const desde = new Date(goal.starts_at).getTime()
  const suyas = completions.filter(
    (c) =>
      c.profile_id === perfil.id &&
      c.status === 'aprobado' &&
      c.resolved_at &&
      new Date(c.resolved_at).getTime() >= desde
  )
  const xp = suyas.reduce((t, c) => t + c.xp, 0)
  const total = goalProgress(goal, completions)
  return { xp, pct: total > 0 ? Math.round((100 * xp) / total) : 0 }
}

/** Premios que ha pedido: entregados, en camino y el último que llegó. */
export function premiosDe(perfil, redemptions = [], rewards = []) {
  const mios = redemptions.filter((r) => r.profile_id === perfil.id)
  const entregados = mios.filter((r) => r.status === 'entregado')
  const ultimo = [...entregados].sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at))[0]
  const premioDe = (id) => rewards.find((r) => r.id === id)
  return {
    entregados: entregados.length,
    enCamino: mios.filter((r) => r.status === 'pendiente').length,
    gastado: entregados.reduce((t, r) => t + r.cost, 0),
    ultimo: ultimo ? { titulo: premioDe(ultimo.reward_id)?.title || 'Premio', cuando: ultimo.resolved_at } : null
  }
}

/** Talis que NO vienen de una misión: juego de la peque y premios a mano. */
export function extrasDe(perfil, bonuses = []) {
  const mios = bonuses.filter((b) => b.profile_id === perfil.id)
  return {
    juego: mios.filter((b) => b.tipo !== 'manual').reduce((t, b) => t + b.coins, 0),
    aMano: mios.filter((b) => b.tipo === 'manual').reduce((t, b) => t + b.coins, 0)
  }
}

/**
 * La semana en siete casillas: qué días hizo algo.
 *
 * Es la única forma de «tu resumen» que entiende alguien de tres años.
 * No lleva números ni porcentajes a propósito: los días se cuentan con
 * los ojos, y una fila de siete con estrellas puestas dice «llevas cuatro
 * días seguidos» sin que nadie sepa leer todavía.
 *
 * Empieza en lunes, como el resto del historial de la app, para que la
 * semana de la peque y la de su hermana sean la misma semana.
 */
export function semanaEnCasillas(perfil, completions = [], ahora = new Date()) {
  const rango = semana(ahora, 0)
  const hechos = new Set(
    completions
      .filter((c) => c.profile_id === perfil.id && c.status === 'aprobado' && c.resolved_at)
      .map((c) => dayKey(new Date(c.resolved_at)))
  )
  const hoy = dayKey(ahora)
  const INICIALES = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  return INICIALES.map((letra, i) => {
    const fecha = new Date(rango.desde)
    fecha.setDate(fecha.getDate() + i)
    const clave = dayKey(fecha)
    return {
      letra,
      clave,
      hecho: hechos.has(clave),
      hoy: clave === hoy,
      // Lo que aún no ha llegado se dibuja distinto de lo que se falló:
      // un futuro pintado como hueco se lee como un suspenso.
      futuro: fecha.getTime() > ahora.getTime() && clave !== hoy
    }
  })
}

/** La ficha completa de una persona. */
export function resumenDePersona(perfil, datos, ahora = new Date()) {
  const { challenges = [], completions = [], redemptions = [], rewards = [], bonuses = [], goal = null } = datos || {}
  const rango = semana(ahora, 0)
  const deLaSemana = resumenDeSemana(validadasDe(completions, perfil.id, rango))
  const hoy = dayKey(ahora)
  const suyas = completions.filter((c) => c.profile_id === perfil.id)

  return {
    perfil,
    nivel: levelFromXp(perfil.xp),
    xp: perfil.xp,
    monedas: perfil.coins,
    asignadas: asignadasA(perfil, challenges),
    completadas: {
      hoy: suyas.filter((c) => c.status === 'aprobado' && c.resolved_at && dayKey(new Date(c.resolved_at)) === hoy).length,
      semana: deLaSemana.misiones,
      total: suyas.filter((c) => c.status === 'aprobado').length
    },
    xpSemana: deLaSemana.xp,
    pendientes: suyas.filter((c) => c.status === 'pendiente').length,
    // Las devueltas de la semana son la señal temprana de que algo no va:
    // o la misión le queda grande, o se está pidiendo sin hacerla.
    devueltas: validadasDe(completions, perfil.id, rango, 'rechazado').length,
    racha: rachaMaxima(completions, perfil.id, [], diasNeutros(perfil, challenges)),
    meta: aportacionAMeta(perfil, goal, completions),
    premios: premiosDe(perfil, redemptions, rewards),
    extras: extrasDe(perfil, bonuses)
  }
}

/**
 * El gremio entero, con las fichas ordenadas.
 *
 * Se ordena por rol y no por aportación: ordenar por lo aportado es hacer
 * una clasificación aunque no se llame así, y quien mira el panel a las
 * once de la noche lee el primer nombre como «el que va ganando».
 */
export function resumenDelGremio(datos, ahora = new Date()) {
  const { profiles = [], completions = [], goal = null } = datos || {}
  const orden = { adulto: 0, junior: 1, peque: 2 }
  const gente = [...profiles].sort((a, b) => (orden[a.role] ?? 9) - (orden[b.role] ?? 9))
  const personas = gente.map((p) => resumenDePersona(p, datos, ahora))
  const progreso = goalProgress(goal, completions)

  return {
    personas,
    meta: goal
      ? {
          titulo: goal.title,
          emoji: goal.emoji,
          objetivo: goal.target_xp,
          progreso,
          pct: Math.min(100, Math.round((100 * progreso) / goal.target_xp))
        }
      : null,
    // Sirve para leer el reparto de un vistazo: si una barra se come el
    // 70 %, no es que esa persona sea aplicada, es que las misiones están
    // mal repartidas.
    xpSemana: personas.reduce((t, r) => t + r.xpSemana, 0),
    sinActividad: personas.filter((r) => r.completadas.semana === 0).map((r) => r.perfil.name)
  }
}
