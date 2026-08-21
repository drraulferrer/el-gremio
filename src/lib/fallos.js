// ------------------------------------------------------------------
// Contar que algo va mal.
//
// El agujero que tapa: `monitoring.js` recoge las huellas de los errores
// —nombre, mensaje normalizado y cuántas veces— pero se quedan en el
// navegador de quien los sufre, y nadie las lee nunca. Un fallo visto un
// domingo llegaba de viva voz y tres días tarde, sin versión ni pantalla.
//
// Aquí se juntan las dos mitades: lo que cuenta la persona y lo que ya
// sabía la máquina. Va a `informes_fallo` (migración 033), que es una
// libreta y no un sistema de tickets.
//
// REGLA: no se manda nada que no haya escrito quien informa, salvo la
// versión, la pantalla, el agente recortado y esas huellas. Ni capturas,
// ni datos de otras personas, ni el contenido de ningún otro campo.
// ------------------------------------------------------------------

import { supabase, operacion } from './supabase'
import { log, nuevoRequestId } from './log'
import { resumenErrores } from './monitoring'
import { RELEASE } from './version'

export const TEXTO_MINIMO = 4
export const TEXTO_MAXIMO = 1000

/** Tres bastan: son las que se repiten, y el resto es cola larga. */
export const HUELLAS_MAXIMAS = 3

/** El agente completo son 150-250 caracteres de ruido; la columna corta a 200. */
export const AGENTE_MAXIMO = 200

/**
 * ¿Se puede mandar esto? Devuelve el motivo en el idioma de quien lo lee,
 * no el de la base: quien informa de un fallo ya está teniendo un mal
 * rato como para encima recibir un `23514`.
 */
export function validarTexto(texto) {
  const limpio = String(texto || '').trim()
  if (limpio.length < TEXTO_MINIMO) {
    return { ok: false, mensaje: 'Cuenta un poco más: con dos palabras no se puede buscar el fallo.' }
  }
  if (limpio.length > TEXTO_MAXIMO) {
    return { ok: false, mensaje: `Demasiado largo: ${limpio.length} caracteres y el tope son ${TEXTO_MAXIMO}.` }
  }
  return { ok: true, mensaje: '' }
}

/**
 * La fila tal y como va a la base. Función pura y a propósito: es lo
 * único que hay que mirar para saber qué sale de este dispositivo.
 */
export function construirInforme({
  texto,
  pantalla = null,
  familyId,
  profileId = null,
  version = RELEASE,
  agente = '',
  huellas = []
}) {
  return {
    family_id: familyId,
    profile_id: profileId,
    texto: String(texto).trim(),
    // La pantalla es un rótulo corto y nuestro («selector», «tropiezo»),
    // no la URL: la URL de una SPA no dice dónde estaba nadie.
    pantalla: pantalla ? String(pantalla).slice(0, 40) : null,
    version_app: version ? String(version).slice(0, 60) : null,
    agente: agente ? String(agente).slice(0, AGENTE_MAXIMO) : null,
    huellas: huellas.slice(0, HUELLAS_MAXIMAS).map(({ huella, veces }) => ({ huella, veces }))
  }
}

/**
 * De qué gremio es quien está informando.
 *
 * Se pregunta en vez de recibirlo porque la otra puerta de esta función
 * es la pantalla de tropiezo, y ahí puede no haber cargado nada todavía:
 * justo cuando más falta hace poder contar lo que ha pasado.
 *
 * Sin `maybeSingle()` a propósito: el backend simulado no lo tiene, y una
 * demo que no puede hacer lo que hace producción es peor que no tenerla.
 */
async function familiaDeLaSesion(cliente, requestId) {
  const quien = await cliente.auth.getUser()
  const userId = quien?.data?.user?.id
  if (!userId) return { id: null, mensaje: 'Hay que haber entrado en el gremio para poder contarlo.' }

  const { data, error, mensaje } = await operacion(
    'fallo.familia.error',
    () => cliente.from('families').select('id').eq('owner', userId).limit(1),
    { request_id: requestId }
  )
  if (error) return { id: null, mensaje }

  const fila = Array.isArray(data) ? data[0] : data
  if (!fila?.id) return { id: null, mensaje: 'No encuentro tu gremio. Cierra sesión y vuelve a entrar.' }
  return { id: fila.id, mensaje: '' }
}

/**
 * Manda el informe. Nunca lanza: devuelve `{ ok, mensaje }`, igual que
 * el resto de acciones.
 *
 * El cliente se INYECTA (con el de verdad por defecto) en vez de tocarse
 * desde fuera: parchear el módulo es lo que dejó el CI en rojo cuatro
 * empujones seguidos el 19-ago, porque en CI ese cliente es `null`.
 */
export async function enviarInforme({
  texto,
  pantalla = null,
  familyId = null,
  profileId = null,
  cliente = supabase,
  agente = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  huellas = resumenErrores()
}) {
  const revision = validarTexto(texto)
  if (!revision.ok) return { ok: false, mensaje: revision.mensaje }

  if (!cliente) {
    return { ok: false, mensaje: 'Esta copia no está conectada al gremio, así que no puedo mandarlo.' }
  }

  const requestId = nuevoRequestId()

  let gremio = familyId
  if (!gremio) {
    const encontrado = await familiaDeLaSesion(cliente, requestId)
    if (!encontrado.id) return { ok: false, mensaje: encontrado.mensaje }
    gremio = encontrado.id
  }

  const fila = construirInforme({ texto, pantalla, familyId: gremio, profileId, agente, huellas })

  log.info('fallo.contado', {
    request_id: requestId,
    pantalla: fila.pantalla,
    letras: fila.texto.length,
    huellas: fila.huellas.length
  })

  const { error, mensaje } = await operacion(
    'fallo.contado.error',
    () => cliente.from('informes_fallo').insert(fila),
    { request_id: requestId, pantalla: fila.pantalla }
  )

  return { ok: !error, mensaje }
}
