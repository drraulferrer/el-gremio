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
import { olvidarTodo } from './gremios'

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
  //
  // Y se va el personaje de TODOS los gremios, no solo el del activo (6.2):
  // dejar apuntado en un aparato compartido quién era alguien en un gremio
  // del que ya no hay sesión es justo lo que esta limpieza venía a evitar.
  olvidarTodo()

  return error ? { ok: false, mensaje } : { ok: true, mensaje: '' }
}

// ------------------------------------------------------------------
// Expandirse (Fase 6.3).
//
// Las tres llamadas que la pantalla de expansión necesita. Van aquí y no
// dentro de la pantalla por lo mismo que el resto: para que quede
// registrado lo que pasa y para que el mensaje presentable se decida en un
// solo sitio.
// ------------------------------------------------------------------

/** Los escalones del gremio activo, con cuánto falta para cada uno. */
export async function leerOportunidades(familyId) {
  const { data, error } = await supabase.rpc('oportunidades_expansion', { p_family: familyId })
  if (error) {
    log.warn('expansion.oportunidades.error', { detalle: String(error.message || error) })
    return []
  }
  return data || []
}

/** Mis pertenencias activas: cada gremio con su personaje y su nivel. */
export async function leerPertenencias() {
  const { data, error } = await supabase.rpc('mis_pertenencias')
  if (error) {
    log.warn('pertenencias.mias.error', { detalle: String(error.message || error) })
    return []
  }
  return data || []
}

/** Mis llaves, de todos mis gremios. */
export async function leerLlaves() {
  const { data, error } = await supabase.rpc('mis_llaves')
  if (error) {
    log.warn('expansion.llaves.error', { detalle: String(error.message || error) })
    return []
  }
  return data || []
}

/**
 * Forjar. La clave de idempotencia se deriva de la intención —este gremio,
 * este escalón— más la ventana de diez segundos, igual que un canje: un
 * doble clic no puede pagar dos llaves.
 */
export async function forjarLlave(familyId, orden) {
  const requestId = nuevoRequestId()
  const clave = claveDe(['forja', familyId, orden])
  const { data, error } = await supabase.rpc('forjar_llave', {
    p_family: familyId,
    p_orden: orden,
    p_clave: clave
  })
  if (error) {
    log.error('expansion.forja.error', { request_id: requestId, detalle: String(error.message || error) })
    return 'error'
  }
  log.info('expansion.forja', { request_id: requestId, family_id: familyId, orden, resultado: data })
  return data
}

/**
 * Pedir una identidad propia. Es el paso 1 de la conversion (F-9): deja la
 * solicitud, comprueba el PIN y aparta el correo. La cuenta la crea despues
 * la pantalla con `signUp`, y la conversion TERMINA al volver del enlace.
 *
 * Va primero a proposito: si el PIN no vale o el correo no esta disponible,
 * no se ha creado ninguna cuenta que despues haya que limpiar.
 */
export async function solicitarConversion(profileId, correo, pinHash) {
  const requestId = nuevoRequestId()
  const { data, error } = await supabase.rpc('solicitar_conversion', {
    p_profile: profileId,
    p_correo: correo,
    p_pin_hash: pinHash
  })
  if (error) {
    log.error('conversion.solicitud.error', { request_id: requestId, detalle: String(error.message || error) })
    return 'error'
  }
  // El correo NO se registra: `log.js` lo filtra igual, pero no darselo es
  // mas barato que confiar en el filtro.
  log.info('conversion.solicitud', { request_id: requestId, profile_id: profileId, resultado: data })
  return data
}

/**
 * Terminar la identidad propia: el paso 3 de `F-9`, el que ocurre al
 * volver desde el enlace del correo y **desde la sesion nueva**.
 *
 * Es la pieza que faltaba. La base la tiene desde la 047 y no la llamaba
 * NADIE, asi que ninguna credencial llegaba nunca a ser `personal`; y como
 * forjar, aceptar una invitacion, reclamar y retirar la clave comun exigen
 * las cuatro `clase_credencial() = 'personal'`, las fases 5, 6 y 7 estaban
 * cerradas en produccion sin que faltara ni una linea de SQL.
 *
 * La clave de idempotencia va derivada de la cuenta: dos pestañas que
 * vuelven del mismo enlace a la vez son un solo intento.
 */
export async function terminarIdentidad(userId) {
  const requestId = nuevoRequestId()
  const { data, error } = await supabase.rpc('completar_conversion', {
    p_clave: claveDe(['identidad', userId || 'sin-cuenta'])
  })
  if (error) {
    log.error('conversion.terminar.error', {
      request_id: requestId, detalle: String(error.message || error)
    })
    return 'error'
  }
  log.info('conversion.terminar', { request_id: requestId, resultado: data })
  return data
}

// ------------------------------------------------------------------
// Gastar la llave, e invitar (Fase 6.3, segunda mitad).
// ------------------------------------------------------------------

/** Los tipos de gremio que se pueden crear hoy. Lo decide el servidor. */
export async function leerTiposOfrecidos() {
  const { data, error } = await supabase.rpc('tipos_ofrecidos')
  if (error) {
    log.warn('gremios.tipos.error', { detalle: String(error.message || error) })
    return []
  }
  return data || []
}

/**
 * Crear un gremio con una llave. Devuelve `{ resultado, familyId }`.
 *
 * No cobra nada: el pago fue al forjar. Y la llave se consume DENTRO de la
 * misma transaccion que crea el gremio, asi que si algo falla no se pierde.
 */
export async function crearGremioConLlave({ llave, nombre, tipo, pais, pinHash, personaje }) {
  const requestId = nuevoRequestId()
  const { data, error } = await supabase.rpc('crear_gremio_con_llave', {
    p_llave: llave,
    p_nombre: nombre,
    p_tipo: tipo,
    p_pais: pais,
    p_pin_hash: pinHash,
    p_personaje: personaje || null
  })
  if (error) {
    log.error('gremios.crear.error', { request_id: requestId, detalle: String(error.message || error) })
    return { resultado: 'error', familyId: null }
  }
  const fila = (data || [])[0] || {}
  log.info('gremios.crear', { request_id: requestId, resultado: fila.resultado })
  return { resultado: fila.resultado, familyId: fila.family_id || null }
}

/** Mis invitaciones. Son de la PERSONA, no del gremio activo. */
export async function leerInvitaciones() {
  const { data, error } = await supabase.rpc('mis_invitaciones')
  if (error) {
    log.warn('invitaciones.leer.error', { detalle: String(error.message || error) })
    return []
  }
  return data || []
}

/** Aceptar. Devuelve `{ resultado, familyId }`. */
export async function aceptarInvitacion(invitacion, llave, personaje) {
  const requestId = nuevoRequestId()
  const { data, error } = await supabase.rpc('aceptar_invitacion', {
    p_invitacion: invitacion,
    p_llave: llave || null,
    p_personaje: personaje || null
  })
  if (error) {
    log.error('invitaciones.aceptar.error', { request_id: requestId, detalle: String(error.message || error) })
    return { resultado: 'error', familyId: null }
  }
  const fila = (data || [])[0] || {}
  log.info('invitaciones.aceptar', { request_id: requestId, resultado: fila.resultado })
  return { resultado: fila.resultado, familyId: fila.family_id || null }
}

export async function rechazarInvitacion(invitacion) {
  const { data, error } = await supabase.rpc('rechazar_invitacion', { p_invitacion: invitacion })
  if (error) {
    log.error('invitaciones.rechazar.error', { detalle: String(error.message || error) })
    return 'error'
  }
  return data
}

/** Las que ha emitido este gremio, para quien lo administra. */
export async function leerInvitacionesDelGremio(familyId) {
  const { data, error } = await supabase.rpc('invitaciones_del_gremio', { p_family: familyId })
  if (error) {
    log.warn('invitaciones.gremio.error', { detalle: String(error.message || error) })
    return []
  }
  return data || []
}

export async function invitar(familyId, correo, profileId) {
  const requestId = nuevoRequestId()
  const { data, error } = await supabase.rpc('invitar', {
    p_family: familyId,
    p_correo: correo,
    p_profile: profileId || null
  })
  if (error) {
    log.error('invitaciones.invitar.error', { request_id: requestId, detalle: String(error.message || error) })
    return 'error'
  }
  // El correo NO se registra, igual que en la conversion.
  log.info('invitaciones.invitar', { request_id: requestId, family_id: familyId, resultado: data })
  return data
}

export async function revocarInvitacion(invitacion, profileId) {
  const { data, error } = await supabase.rpc('revocar_invitacion', {
    p_invitacion: invitacion,
    p_profile: profileId || null
  })
  if (error) {
    log.error('invitaciones.revocar.error', { detalle: String(error.message || error) })
    return 'error'
  }
  return data
}

/**
 * Las personas de un gremio. Se lee la tabla directamente: `pertenencias`
 * tiene politica para quien pertenece (045), asi que no hace falta una RPC.
 */
export async function leerPersonasDelGremio(familyId) {
  const { data, error } = await supabase
    .from('pertenencias')
    .select('persona, rol, origen, desde')
    .eq('family_id', familyId)
    .eq('estado', 'activa')
  if (error) {
    log.warn('pertenencias.leer.error', { detalle: String(error.message || error) })
    return []
  }
  return data || []
}

export async function expulsarDeGremio(familyId, persona, profileId) {
  const requestId = nuevoRequestId()
  const { data, error } = await supabase.rpc('expulsar_de_gremio', {
    p_family: familyId,
    p_persona: persona,
    p_profile: profileId || null
  })
  if (error) {
    log.error('pertenencias.expulsar.error', { request_id: requestId, detalle: String(error.message || error) })
    return 'error'
  }
  log.info('pertenencias.expulsar', { request_id: requestId, family_id: familyId, resultado: data })
  return data
}

export async function abandonarGremio(familyId) {
  const requestId = nuevoRequestId()
  const { data, error } = await supabase.rpc('abandonar_gremio', { p_family: familyId })
  if (error) {
    log.error('pertenencias.abandonar.error', { request_id: requestId, detalle: String(error.message || error) })
    return 'error'
  }
  log.info('pertenencias.abandonar', { request_id: requestId, family_id: familyId, resultado: data })
  return data
}

// ------------------------------------------------------------------
// Reclamar un perfil, y la credencial compartida (Fase 7).
// ------------------------------------------------------------------

export async function solicitarReclamacion(profileId) {
  const requestId = nuevoRequestId()
  const { data, error } = await supabase.rpc('solicitar_reclamacion', { p_profile: profileId })
  if (error) {
    log.error('reclamacion.solicitud.error', { request_id: requestId, detalle: String(error.message || error) })
    return 'error'
  }
  log.info('reclamacion.solicitud', { request_id: requestId, resultado: data })
  return data
}

export async function leerMisReclamaciones() {
  const { data, error } = await supabase.rpc('mis_reclamaciones')
  if (error) {
    log.warn('reclamacion.mias.error', { detalle: String(error.message || error) })
    return []
  }
  return data || []
}

export async function leerReclamacionesDelGremio(familyId) {
  const { data, error } = await supabase.rpc('reclamaciones_del_gremio', { p_family: familyId })
  if (error) {
    log.warn('reclamacion.gremio.error', { detalle: String(error.message || error) })
    return []
  }
  return data || []
}

export async function aprobarReclamacion(id, profileId) {
  const requestId = nuevoRequestId()
  const { data, error } = await supabase.rpc('aprobar_reclamacion', {
    p_reclamacion: id, p_profile: profileId || null
  })
  if (error) {
    log.error('reclamacion.aprobar.error', { request_id: requestId, detalle: String(error.message || error) })
    return 'error'
  }
  log.info('reclamacion.aprobar', { request_id: requestId, resultado: data })
  return data
}

export async function rechazarReclamacion(id, profileId) {
  const { data, error } = await supabase.rpc('rechazar_reclamacion', {
    p_reclamacion: id, p_profile: profileId || null
  })
  if (error) {
    log.error('reclamacion.rechazar.error', { detalle: String(error.message || error) })
    return 'error'
  }
  return data
}

/** El inventario de R-88, calculado entero en servidor. */
export async function leerInventarioCredencial(familyId) {
  const { data, error } = await supabase.rpc('inventario_credencial', { p_family: familyId })
  if (error) {
    log.warn('credencial.inventario.error', { detalle: String(error.message || error) })
    return null
  }
  return data
}

export async function desactivarCredencialCompartida(familyId, profileId) {
  const requestId = nuevoRequestId()
  const { data, error } = await supabase.rpc('desactivar_credencial_compartida', {
    p_family: familyId, p_profile: profileId || null
  })
  if (error) {
    log.error('credencial.desactivar.error', { request_id: requestId, detalle: String(error.message || error) })
    return 'error'
  }
  log.info('credencial.desactivar', { request_id: requestId, family_id: familyId, resultado: data })
  return data
}

export async function crearCredencialCompartida(familyId, correo, profileId) {
  const requestId = nuevoRequestId()
  const { data, error } = await supabase.rpc('crear_credencial_compartida', {
    p_family: familyId, p_correo: correo, p_profile: profileId || null
  })
  if (error) {
    log.error('credencial.crear.error', { request_id: requestId, detalle: String(error.message || error) })
    return 'error'
  }
  // El correo NO se registra, igual que en la conversion y en las invitaciones.
  log.info('credencial.crear', { request_id: requestId, family_id: familyId, resultado: data })
  return data
}
