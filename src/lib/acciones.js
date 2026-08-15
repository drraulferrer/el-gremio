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
export async function estrellaInmediata({ family, profile, reto, elogio = '' }) {
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

  // Siempre con los tres argumentos, incluso cuando el elogio va vacío.
  // Si en la base conviven la versión de dos y la de tres (pasa cuando un
  // `create or replace` cambia la firma y deja una sobrecarga), la llamada
  // de dos argumentos es ambigua y PostgREST la rechaza con PGRST203.
  const aprobacion = await operacion(
    'mision.estrella_inmediata.aprobacion_error',
    () =>
      supabase.rpc('resolve_completion', {
        c_id: alta.data.id,
        new_status: 'aprobado',
        praise_text: elogio ? String(elogio).trim().slice(0, 240) : null
      }),
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

  // Ambigüedad por sobrecarga: la base tiene las dos versiones de la
  // función y PostgREST no puede elegir. Se arregla en la base, no aquí.
  if (reintento.error?.code === 'PGRST203') {
    return {
      ok: false,
      mensaje: 'La base tiene dos versiones de resolve_completion. Borra la antigua: drop function public.resolve_completion(uuid, text);'
    }
  }

  if (reintento.error) return { ok: false, mensaje: reintento.mensaje }

  return {
    ok: true,
    mensaje: texto
      ? 'Validada, pero el elogio no se ha guardado: falta ejecutar migracion-004-habilidades.sql en Supabase.'
      : ''
  }
}

/**
 * Deshace una misión: la borra y devuelve XP y monedas si estaban dadas.
 * Existe porque el toque equivocado es inevitable, sobre todo cuando quien
 * toca tiene tres años.
 */
export async function deshacerMision(id) {
  const requestId = nuevoRequestId()
  const { data, error, mensaje } = await operacion(
    'mision.deshecha.error',
    () => supabase.rpc('undo_completion', { c_id: id }),
    { request_id: requestId, completion_id: id }
  )

  if (error) {
    // Base sin migrar: la función todavía no existe.
    if (error.code === 'PGRST202') {
      return {
        ok: false,
        mensaje: 'Falta ejecutar migracion-006-deshacer.sql en el SQL Editor de Supabase.'
      }
    }
    return { ok: false, mensaje }
  }

  if (data === 'no_existe') return { ok: false, mensaje: 'Esa misión ya no está.' }

  log.info('mision.deshecha', { request_id: requestId, completion_id: id })
  return { ok: true, mensaje: '' }
}

/**
 * Cobra el premio del juego de globos: una estrella extra, una al día.
 *
 * El tope no se comprueba aquí. Lo decide `grant_daily_bonus` en Postgres,
 * donde un índice único por perfil y día lo hace imposible de saltar
 * recargando o cambiando de dispositivo. Esta función solo traduce la
 * respuesta: 'ya_hoy' NO es un fallo, es el caso normal del segundo
 * intento, y por eso no pinta nada en rojo.
 */
export async function cobrarGlobos(profileId) {
  const requestId = nuevoRequestId()
  const { data, error, mensaje } = await operacion(
    'juego.globos.error',
    () => supabase.rpc('grant_daily_bonus', { p_id: profileId, p_tipo: 'globos' }),
    { request_id: requestId, profile_id: profileId }
  )

  if (error) {
    // Base sin migrar: la función todavía no existe.
    if (error.code === 'PGRST202') {
      return { ok: false, yaHoy: false, mensaje: 'Falta ejecutar migracion-012-juego-de-globos.sql en Supabase.' }
    }
    return { ok: false, yaHoy: false, mensaje }
  }

  if (data === 'ya_hoy') return { ok: false, yaHoy: true, mensaje: '' }
  if (data === 'no_existe') return { ok: false, yaHoy: false, mensaje: 'Ese perfil ya no está.' }
  if (data === 'no_es_tuyo') return { ok: false, yaHoy: false, mensaje: 'Ese perfil no es de este gremio.' }

  log.info('juego.globos.cobrado', { request_id: requestId, profile_id: profileId })
  return { ok: true, yaHoy: false, mensaje: '' }
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
