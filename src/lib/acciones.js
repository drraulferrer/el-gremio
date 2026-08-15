// ------------------------------------------------------------------
// Acciones de dominio, en un solo sitio.
//
// Antes vivían repetidas en Home y en el panel parental, con la misma
// costumbre peligrosa en las dos: `if (!error)` y a otra cosa, sin
// contarle nada a nadie. Aquí cada acción registra lo que pasa y
// devuelve un mensaje presentable cuando falla.
// ------------------------------------------------------------------

import { supabase, operacion } from './supabase'
import { log, nuevoRequestId } from './log'

/** Pide una misión: queda pendiente de validación. */
export async function pedirMision({ family, profile, reto }) {
  const requestId = nuevoRequestId()
  log.info('mision.pedida', { request_id: requestId, challenge_id: reto.id, xp: reto.xp })

  const { error, mensaje } = await operacion(
    'mision.pedida.error',
    () =>
      supabase.from('completions').insert({
        family_id: family.id,
        challenge_id: reto.id,
        profile_id: profile.id,
        xp: reto.xp,
        coins: reto.coins
      }),
    { request_id: requestId, challenge_id: reto.id }
  )

  return { ok: !error, mensaje }
}

/**
 * Misión con estrella inmediata (rol peque). A los tres años la
 * recompensa diferida no funciona, así que se aprueba en el acto; el
 * registro queda igualmente en el historial para los adultos.
 */
export async function estrellaInmediata({ family, profile, reto }) {
  const requestId = nuevoRequestId()
  log.info('mision.estrella_inmediata', { request_id: requestId, challenge_id: reto.id, profile_id: profile.id })

  const alta = await operacion(
    'mision.estrella_inmediata.alta_error',
    () =>
      supabase
        .from('completions')
        .insert({
          family_id: family.id,
          challenge_id: reto.id,
          profile_id: profile.id,
          xp: reto.xp,
          coins: reto.coins
        })
        .select()
        .single(),
    { request_id: requestId, challenge_id: reto.id }
  )

  if (alta.error || !alta.data) {
    return { ok: false, mensaje: alta.mensaje || 'No se pudo guardar la estrella.' }
  }

  const aprobacion = await operacion(
    'mision.estrella_inmediata.aprobacion_error',
    () => supabase.rpc('resolve_completion', { c_id: alta.data.id, new_status: 'aprobado' }),
    { request_id: requestId, completion_id: alta.data.id }
  )

  return { ok: !aprobacion.error, mensaje: aprobacion.mensaje }
}

/**
 * Valida o rechaza una misión pendiente (panel parental).
 * El elogio viaja en la misma llamada: o se guardan las dos cosas o
 * ninguna. Nunca se registra su texto en los logs, que puede llevar
 * nombres y detalles de casa.
 */
export async function resolverMision(id, estado, elogio = '') {
  const requestId = nuevoRequestId()
  const texto = elogio ? String(elogio).trim().slice(0, 240) : null

  const intento = await operacion(
    'mision.resuelta.error',
    () => supabase.rpc('resolve_completion', { c_id: id, new_status: estado, praise_text: texto }),
    { request_id: requestId, completion_id: id, estado }
  )

  if (!intento.error) {
    log.info('mision.resuelta', {
      request_id: requestId,
      completion_id: id,
      estado,
      con_elogio: Boolean(texto)
    })
    return { ok: true, mensaje: '' }
  }

  // Salvavidas para el desfase de esquema: si la base todavía tiene la
  // versión de dos argumentos de resolve_completion (falta la migración
  // 004), Postgres devuelve PGRST202 y no encuentra la función. Antes de
  // dejar a nadie sin poder validar, se reintenta sin elogio y se avisa.
  const faltaFuncion =
    intento.error?.code === 'PGRST202' || /resolve_completion\(.*praise_text/i.test(intento.error?.message || '')

  if (!faltaFuncion) return { ok: false, mensaje: intento.mensaje }

  log.warn('mision.resuelta.sin_elogio', {
    request_id: requestId,
    completion_id: id,
    motivo: 'falta migracion-004 en la base'
  })

  const reintento = await operacion(
    'mision.resuelta.error',
    () => supabase.rpc('resolve_completion', { c_id: id, new_status: estado }),
    { request_id: requestId, completion_id: id, estado, sin_elogio: true }
  )

  if (reintento.error) return { ok: false, mensaje: reintento.mensaje }

  return {
    ok: true,
    mensaje: texto
      ? 'Validada, pero el elogio no se ha guardado: falta ejecutar migracion-004-habilidades.sql en Supabase.'
      : ''
  }
}

/** Canjea un premio. Devuelve además el motivo cuando no se puede. */
export async function canjearPremio({ premio, profile }) {
  const requestId = nuevoRequestId()
  const { data, error, mensaje } = await operacion(
    'premio.canje.error',
    () => supabase.rpc('redeem_reward', { rw_id: premio.id, p_id: profile.id }),
    { request_id: requestId, reward_id: premio.id }
  )

  if (error) return { ok: false, mensaje }
  if (data === 'sin_monedas') return { ok: false, mensaje: 'Aún te faltan monedas para ese premio.' }
  if (data === 'no_disponible') return { ok: false, mensaje: 'Ese premio ya no está disponible.' }

  log.info('premio.canjeado', { request_id: requestId, reward_id: premio.id, coste: premio.cost })
  return { ok: true, mensaje: '' }
}

/** Entrega o cancela un canje. Cancelar devuelve las monedas. */
export async function resolverCanje(id, estado) {
  const requestId = nuevoRequestId()
  const { error, mensaje } = await operacion(
    'premio.canje_resuelto.error',
    () => supabase.rpc('resolve_redemption', { r_id: id, new_status: estado }),
    { request_id: requestId, redemption_id: id, estado }
  )
  if (!error) log.info('premio.canje_resuelto', { request_id: requestId, redemption_id: id, estado })
  return { ok: !error, mensaje }
}
