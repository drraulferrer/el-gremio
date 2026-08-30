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

// ------------------------------------------------------------------
// La clave que evita cobrar dos veces.
//
// El servidor guarda un asiento por clave y, si la clave ya existe, devuelve
// el resultado de la primera sin volver a mover nada (migraciones 042 y 043).
// Para que eso proteja de un doble clic, las DOS peticiones tienen que
// llevar la MISMA clave, asi que no vale un identificador nuevo por llamada:
// se deriva de la intencion —que premio, para quien— mas una ventana de
// tiempo.
//
// LA VENTANA, y su pega, que conviene conocer: dentro de esos diez segundos,
// dos intentos identicos se consideran el mismo. Eso es lo que se busca con
// un doble clic o con un reintento tras una respuesta perdida. Pero si
// alguien canjea a proposito el mismo premio dos veces seguidas en menos de
// diez segundos, la segunda devuelve `ok` sin cobrar. Es raro y se arregla
// esperando un momento; a cambio, el caso comun queda cubierto sin pedirle
// al resto de la aplicacion que lleve la cuenta de nada.
//
// Diez segundos y no mas: cuanto mas ancha la ventana, mas probable el falso
// positivo. Cuanto mas estrecha, menos reintentos cubre.
// ------------------------------------------------------------------

export const VENTANA_CLAVE_MS = 10_000

/** Huella corta y estable de un texto. No es seguridad: es para distinguir. */
export function huella(texto = '') {
  let h = 5381
  for (let i = 0; i < String(texto).length; i++) h = ((h << 5) + h + String(texto).charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/**
 * La clave de una intencion. `ahora` es un parametro para que los tests no
 * dependan de caer o no en el mismo lado de una ventana.
 */
export function claveDe(partes, ahora = Date.now()) {
  return [...partes, Math.floor(ahora / VENTANA_CLAVE_MS)].join(':').slice(0, 120)
}

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
 * Deshace una misión: la borra y devuelve XP y Talis si estaban dados.
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
  if (data === 'campana_cerrada') {
    return {
      ok: false,
      mensaje: 'Esa tarea es de una operación de limpieza ya cerrada: su botín ya se repartió y no se puede deshacer.'
    }
  }

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

/**
 * Gasta un uso de un poder de insignia (comodín o voz de mando).
 *
 * Los usos los cuenta Postgres, no esta función: si la cuenta viviera en
 * el navegador, recargar la página devolvería los usos, que es el mismo
 * bug que tuvo el juego de globos. Aquí solo se traduce la respuesta.
 */
export async function gastarPoder({ profileId, code, tipo, usos, dias = null, destino = null, nota = '' }) {
  const requestId = nuevoRequestId()
  const { data, error, mensaje } = await operacion(
    'poder.gastado.error',
    () =>
      supabase.rpc('spend_power', {
        p_id: profileId,
        p_code: code,
        p_tipo: tipo,
        p_usos: Number(usos) || 0,
        p_dias: dias == null ? null : Number(dias),
        p_target: destino,
        p_nota: nota ? String(nota).trim().slice(0, 240) : null
      }),
    { request_id: requestId, profile_id: profileId, code, tipo }
  )

  if (error) {
    if (error.code === 'PGRST202') {
      return { ok: false, mensaje: 'Falta ejecutar migracion-015-poderes-y-unicas.sql en Supabase.' }
    }
    return { ok: false, mensaje }
  }

  const problemas = {
    sin_usos: 'Ese poder ya no tiene usos, o ha caducado.',
    no_la_tienes: 'Todavía no tienes esa insignia.',
    poder_no_gastable: 'Ese poder no se gasta: lo tienes mientras dure.',
    sin_destino: 'Elige a quién se lo encargas.',
    destino_no_existe: 'Esa persona ya no está en el gremio.',
    a_ti_no: 'La voz de mando es para encargar a otra persona, no a ti.',
    no_existe: 'Ese perfil ya no está.',
    no_es_tuyo: 'Ese perfil no es de este gremio.'
  }
  if (problemas[data]) return { ok: false, mensaje: problemas[data] }

  log.info('poder.gastado', { request_id: requestId, profile_id: profileId, code, tipo, con_destino: Boolean(destino) })
  return { ok: true, mensaje: '' }
}

/**
 * Cobra un hito del camino de la racha.
 *
 * Ni el importe ni la racha viajan desde aquí: los dos los decide y
 * comprueba `claim_streak` en Postgres. Esta pantalla es la que dibuja el
 * contador, así que no puede ser también la que certifique que es cierto.
 *
 * 'ya_cobrado' NO es un fallo: es lo que contesta la base cada vez que se
 * vuelve a abrir la pantalla con el hito ya pagado, que es casi siempre.
 */
export async function cobrarRacha(profileId, hito) {
  const requestId = nuevoRequestId()
  const { data, error, mensaje } = await operacion(
    'racha.cobrada.error',
    () => supabase.rpc('claim_streak', { p_id: profileId, p_hito: hito }),
    { request_id: requestId, profile_id: profileId, hito }
  )

  if (error) {
    if (error.code === 'PGRST202') {
      return { ok: false, mensaje: 'Falta ejecutar migracion-016-camino-de-rachas.sql en Supabase.' }
    }
    return { ok: false, mensaje }
  }

  if (data === 'ya_cobrado' || data === 'aun_no') return { ok: false, mensaje: '' }
  if (data === 'hito_invalido') return { ok: false, mensaje: 'Ese hito no existe.' }
  if (data === 'no_existe') return { ok: false, mensaje: 'Ese perfil ya no está.' }
  if (data === 'no_es_tuyo') return { ok: false, mensaje: 'Ese perfil no es de este gremio.' }

  log.info('racha.cobrada', { request_id: requestId, profile_id: profileId, hito })
  return { ok: true, mensaje: '' }
}

/** Canjea un premio. Devuelve además el motivo cuando no se puede. */
export async function canjearPremio({ premio, profile }) {
  const requestId = nuevoRequestId()
  const { data, error, mensaje } = await operacion(
    'premio.canje.error',
    () => supabase.rpc('redeem_reward', {
      rw_id: premio.id,
      p_id: profile.id,
      p_clave: claveDe(['canje', premio.id, profile.id])
    }),
    { request_id: requestId, reward_id: premio.id }
  )

  if (error) return { ok: false, mensaje }
  if (data === 'sin_monedas') return { ok: false, mensaje: 'Todavía no tienes suficientes Talis. Completa nuevas misiones para conseguirlos.' }
  if (data === 'no_disponible') return { ok: false, mensaje: 'Ese premio ya no está disponible.' }
  // Migración 047: quien se convierte en persona pasa su saldo a la cartera, y
  // el del personaje deja de ser gastable. Hoy no lo puede ver nadie —no hay
  // forma de convertirse todavía— pero decir «no tienes suficientes» a quien
  // tiene el saldo en otro sitio sería mentir, y el día que exista la
  // conversión esta rama es la normal.
  if (data === 'saldo_en_cartera') {
    return { ok: false, mensaje: 'Tus Talis están ahora en tu cartera personal, no en este personaje.' }
  }

  log.info('premio.canjeado', { request_id: requestId, reward_id: premio.id, coste: premio.cost })
  return { ok: true, mensaje: '' }
}

/** Entrega o cancela un canje. Cancelar devuelve los Talis. */
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

/**
 * Premio a mano: Talis extra por algo excepcional, sin XP.
 *
 * Las reglas (cantidad, motivo, que quien lo concede sea adulto) se
 * comprueban en `revisarPremioManual` antes de llamar, y OTRA VEZ en
 * Postgres dentro de `grant_manual_bonus`. No es redundancia por gusto:
 * la comprobación del cliente es para dar un mensaje decente, y la de la
 * base es la que de verdad manda, porque el navegador se puede saltar.
 */
export async function premioAMano({ profileId, monedas, motivo, otorgadoPor }) {
  const requestId = nuevoRequestId()
  const { data, error, mensaje } = await operacion(
    'premio.manual.error',
    () =>
      supabase.rpc('grant_manual_bonus', {
        p_id: profileId,
        p_coins: Number(monedas),
        p_motivo: motivo,
        p_otorgado_por: otorgadoPor,
        // El motivo entra en la clave: dos premios a mano de la misma
        // cantidad y distinta razon son dos cosas distintas.
        p_clave: claveDe(['manual', profileId, Number(monedas), huella(motivo)])
      }),
    { request_id: requestId, profile_id: profileId, monedas: Number(monedas) }
  )

  if (error) {
    if (error.code === 'PGRST202') {
      return { ok: false, mensaje: 'Falta ejecutar migracion-014-premio-a-mano.sql en Supabase.' }
    }
    return { ok: false, mensaje }
  }

  const problemas = {
    cantidad_invalida: 'Esa cantidad no vale.',
    sin_motivo: 'Falta el motivo.',
    no_existe: 'Ese perfil ya no está.',
    no_es_tuyo: 'Ese perfil no es de este gremio.',
    quien_no_existe: 'Quien lo concede ya no está activo.',
    no_es_adulto: 'Solo un adulto puede conceder un premio a mano.'
  }
  if (problemas[data]) return { ok: false, mensaje: problemas[data] }

  log.info('premio.manual', {
    request_id: requestId,
    profile_id: profileId,
    monedas: Number(monedas),
    otorgado_por: otorgadoPor
  })
  return { ok: true, mensaje: '' }
}

/**
 * Lanza una campaña del modo limpieza.
 *
 * Las reglas (que quien lanza sea adulto, una campaña activa por gremio,
 * los topes por tarea) se comprueban en `puedeLanzarCampana` antes de
 * llamar, y OTRA VEZ en Postgres dentro de `crear_campana_limpieza`. La
 * del cliente da el mensaje decente; la de la base es la que manda.
 *
 * Campaña y misiones nacen en la misma transacción: en dos llamadas, un
 * fallo de red por medio dejaría una campaña vacía o misiones huérfanas.
 */
export async function lanzarCampanaLimpieza({ activadaPor, campana, tareas }) {
  const requestId = nuevoRequestId()
  const { data, error, mensaje } = await operacion(
    'limpieza.lanzada.error',
    () =>
      supabase.rpc('crear_campana_limpieza', {
        p_activada_por: activadaPor,
        p_tipo: campana.tipo,
        p_clave: campana.clave,
        p_titulo: campana.titulo,
        p_emoji: campana.emoji,
        p_dias: Number(campana.dias) || 1,
        p_tareas: tareas
      }),
    { request_id: requestId, clave: campana.clave, tareas: tareas.length }
  )

  if (error) {
    if (error.code === 'PGRST202') {
      return { ok: false, mensaje: 'Falta ejecutar migracion-031-modo-limpieza.sql en Supabase.' }
    }
    return { ok: false, mensaje }
  }

  const problemas = {
    quien_no_existe: 'Quien la lanza ya no está activo.',
    no_es_tuyo: 'Ese perfil no es de este gremio.',
    no_es_adulto: 'Solo un adulto puede lanzar el modo limpieza.',
    tipo_invalido: 'Ese formato de campaña no existe.',
    duracion_invalida: 'Esa duración no vale.',
    titulo_invalido: 'Ese título no vale.',
    sin_tareas: 'Una campaña sin tareas no es una campaña.',
    tarea_invalida: 'Alguna tarea no está bien asignada. Revisa el reparto.',
    ya_hay_activa: 'Ya hay una operación en marcha. Ciérrala antes de lanzar otra.'
  }
  if (problemas[data]) return { ok: false, mensaje: problemas[data] }

  log.info('limpieza.lanzada', { request_id: requestId, clave: campana.clave, tareas: tareas.length })
  return { ok: true, mensaje: '' }
}

/**
 * Cierra una campaña del modo limpieza. El desenlace lo decide la base,
 * no el botón: 'ok' reparte el botín si está completa, 'expirada' la
 * recoge sin botín si venció, y 'aun_no' no toca nada. Ni el importe ni
 * la condición viajan desde aquí, por lo mismo que en `cobrarRacha`: la
 * pantalla que dibuja el progreso no puede ser la que lo certifique.
 */
export async function cerrarCampanaLimpieza({ campanaId, quienId }) {
  const requestId = nuevoRequestId()
  const { data, error, mensaje } = await operacion(
    'limpieza.cerrada.error',
    () => supabase.rpc('cerrar_campana_limpieza', { p_campana: campanaId, p_quien: quienId }),
    { request_id: requestId, campana_id: campanaId }
  )

  if (error) {
    if (error.code === 'PGRST202') {
      return { ok: false, resultado: null, mensaje: 'Falta ejecutar migracion-031-modo-limpieza.sql en Supabase.' }
    }
    return { ok: false, resultado: null, mensaje }
  }

  const problemas = {
    no_existe: 'Esa campaña ya no está.',
    no_es_tuyo: 'Esa campaña no es de este gremio.',
    quien_no_existe: 'Quien la cierra ya no está activo.',
    no_es_adulto: 'Solo un adulto puede cerrar la campaña.',
    ya_cerrada: 'Esa campaña ya estaba cerrada.',
    aun_no: 'Todavía quedan tareas y la campaña sigue en plazo.'
  }
  if (problemas[data]) return { ok: false, resultado: data, mensaje: problemas[data] }

  log.info('limpieza.cerrada', { request_id: requestId, campana_id: campanaId, resultado: data })
  return { ok: true, resultado: data, mensaje: '' }
}

/**
 * Apuntar una misión de la mascota. La hace una persona, la puntúa el
 * animal.
 *
 * Es `estrellaInmediata` con dos diferencias que importan:
 *
 * - **Queda aprobada en el acto**, sin cola de validación. No hay a quién
 *   validarle nada: el adulto que la apunta ES el validador, y mandarla a
 *   una cola para que ese mismo adulto se la apruebe después sería
 *   ceremonia sin contenido.
 * - **Guarda quién la apuntó** (`registrado_por`). Sin eso, el historial
 *   de un perro con tres cuidadores no distingue quién estuvo cepillándolo
 *   cada día, que es justo lo que un adulto querrá mirar el día que
 *   sospeche que el trabajo lo hace siempre el mismo.
 *
 * El XP y los Talis van a la mascota, no a quien la cuida: decisión
 * tomada a conciencia en §2.1 de docs/MASCOTAS.md.
 */
export async function apuntarMisionDeMascota({ family, mascota, reto, quien }) {
  const requestId = nuevoRequestId()
  log.info('mascota.mision.apuntada', {
    request_id: requestId,
    challenge_id: reto.id,
    profile_id: mascota.id
  })

  const alta = await operacion(
    'mascota.mision.alta_error',
    () =>
      supabase
        .from('completions')
        .insert({
          family_id: family.id,
          challenge_id: reto.id,
          profile_id: mascota.id,
          registrado_por: quien?.id || null,
          xp: reto.xp,
          coins: reto.coins
        })
        .select()
        .single(),
    { request_id: requestId, challenge_id: reto.id }
  )

  if (alta.error || !alta.data) {
    return { ok: false, mensaje: alta.mensaje || 'No se pudo apuntar la misión.' }
  }

  const aprobacion = await operacion(
    'mascota.mision.aprobacion_error',
    () =>
      supabase.rpc('resolve_completion', {
        c_id: alta.data.id,
        new_status: 'aprobado',
        praise_text: null
      }),
    { request_id: requestId, completion_id: alta.data.id }
  )

  return { ok: !aprobacion.error, mensaje: aprobacion.mensaje }
}

/**
 * Guardar las piezas del retrato de quien está mirando.
 *
 * Existe para que la junior pueda montarse su propia cara sin pedirle el
 * PIN a nadie. El editor del panel parental sigue donde estaba y sirve
 * para todos; esto sirve para uno: el que lo pulsa.
 *
 * Escribe SOLO las tres columnas de retrato, y ese recorte es la
 * seguridad de verdad. La familia comparte una cuenta, así que el RLS es
 * por familia y nada impediría a este camino tocar el nivel, el rol o los
 * Talis; lo que lo impide es que aquí no se nombran. Si algún día esto
 * acepta un objeto suelto de quien lo llame, deja de ser seguro.
 */
export async function guardarRetrato({ profile, piezas }) {
  const requestId = nuevoRequestId()
  log.info('retrato.guardado', { request_id: requestId, profile_id: profile.id })

  const { error, mensaje } = await operacion(
    'retrato.guardado.error',
    () =>
      supabase
        .from('profiles')
        .update({
          retrato_piel: piezas.retrato_piel ?? null,
          retrato_pelo: piezas.retrato_pelo ?? null,
          retrato_peinado: piezas.retrato_peinado ?? null,
          retrato_gafas: piezas.retrato_gafas ?? null,
          retrato_tunica: piezas.retrato_tunica ?? null,
          retrato_barba: piezas.retrato_barba ?? null,
          retrato_flequillo: piezas.retrato_flequillo ?? null
        })
        .eq('id', profile.id),
    { request_id: requestId, profile_id: profile.id }
  )

  return error ? { ok: false, mensaje } : { ok: true, mensaje: '' }
}

/**
 * Cerrar la sesión de la cuenta.
 *
 * No existía, y se notaba: lo único que llamaba a `signOut` era el borrado
 * de la cuenta. Quien quisiera salir —para prestar el móvil, para entrar
 * con otra cuenta, para dejar de estar dentro en un aparato ajeno— no
 * tenía manera.
 *
 * Cierra la sesión de TODA la casa, porque la cuenta es una sola: no es
 * «cambiar de perfil», que es otra cosa y está en la barra de abajo. Por
 * eso vive detrás del PIN y no en el selector de perfiles, donde lo
 * tendrían a un dedo la junior y la peque.
 *
 * También borra el perfil elegido en este aparato. Sin eso, la próxima
 * persona que entrase con otra cuenta arrancaría con el perfil de la
 * anterior seleccionado hasta que el selector la corrigiera.
 */
export async function cerrarSesion() {
  const requestId = nuevoRequestId()
  log.info('sesion.cerrada', { request_id: requestId })

  const { error, mensaje } = await operacion(
    'sesion.cerrada.error',
    () => supabase.auth.signOut(),
    { request_id: requestId }
  )

  // Se limpia aunque `signOut` falle: si la sesión no se ha podido cerrar
  // en el servidor, dejar además el perfil apuntado no arregla nada.
  try {
    localStorage.removeItem('gremio_profile')
  } catch {
    // Modo privado de Safari y poco más. No es motivo para no salir.
  }

  return error ? { ok: false, mensaje } : { ok: true, mensaje: '' }
}
