// ------------------------------------------------------------------
// Suscripción a los avisos push.
//
// Tres cosas que conviene tener claras antes de tocar esto:
//
// 1. UNA SUSCRIPCIÓN ES DE UN APARATO, NO DE UNA PERSONA. El navegador da
//    un `endpoint` por instalación; si se reinstala la app o se limpia el
//    sitio, es otro distinto. Por eso la clave en la base es el endpoint
//    y el perfil es un campo más, que se reescribe al cambiar de persona:
//    en el móvil de la junior estará siempre ella, y en la tablet común
//    el aviso debe ir para quien la tenga abierta.
//
// 2. EN iPHONE SOLO FUNCIONA CON LA APP INSTALADA en la pantalla de
//    inicio (iOS 16.4+). Desde una pestaña de Safari, `Notification` ni
//    siquiera existe. Por eso `estadoDePush` distingue «no se puede» de
//    «se puede y está apagado»: son dos mensajes distintos en pantalla, y
//    decirle «actívalo» a quien no puede activarlo es peor que no decir
//    nada.
//
// 3. EL PERMISO SE PIDE CON UN GESTO, nunca al arrancar. Un navegador
//    puede bloquear para siempre el permiso si se pide sin interacción, y
//    entonces ya no hay forma de volver a preguntar desde la app.
// ------------------------------------------------------------------

import { supabase } from './supabase'
import { log } from './log'

const CLAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC || ''

export function sePuedeNotificar() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

/**
 * Qué se le puede ofrecer a esta persona en esta pantalla.
 * @returns {'imposible'|'sin-clave'|'bloqueado'|'apagado'|'encendido'}
 */
export async function estadoDePush() {
  if (!sePuedeNotificar()) return 'imposible'
  if (!CLAVE_PUBLICA) return 'sin-clave'
  if (Notification.permission === 'denied') return 'bloqueado'
  const registro = await navigator.serviceWorker.getRegistration()
  const sub = registro && (await registro.pushManager.getSubscription())
  return sub ? 'encendido' : 'apagado'
}

// La clave VAPID viaja en base64url y `applicationServerKey` la quiere en
// bytes. Es la conversión de siempre, sin misterio.
function aBytes(base64url) {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const crudo = atob(base64)
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)))
}

function comoJson(sub) {
  const datos = sub.toJSON()
  return { endpoint: datos.endpoint, p256dh: datos.keys.p256dh, auth: datos.keys.auth }
}

export async function registrarServiceWorker() {
  if (!sePuedeNotificar()) return null
  return navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', {
    scope: import.meta.env.BASE_URL
  })
}

/** Enciende los avisos en ESTE aparato para el perfil que lo está usando. */
export async function activarAvisos({ family, profile }) {
  if (!sePuedeNotificar()) return { ok: false, mensaje: 'Este aparato no admite avisos.' }
  if (!CLAVE_PUBLICA) return { ok: false, mensaje: 'Falta configurar la clave de avisos (VITE_VAPID_PUBLIC).' }

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') {
    return {
      ok: false,
      mensaje:
        permiso === 'denied'
          ? 'Los avisos están bloqueados en este aparato. Se vuelven a permitir desde los ajustes del navegador.'
          : 'Sin permiso no se pueden enviar avisos.'
    }
  }

  const registro = (await navigator.serviceWorker.getRegistration()) || (await registrarServiceWorker())
  await navigator.serviceWorker.ready

  const sub =
    (await registro.pushManager.getSubscription()) ||
    (await registro.pushManager.subscribe({
      // Obligatorio en todos los navegadores actuales: no se admiten
      // suscripciones silenciosas, y es lo correcto.
      userVisibleOnly: true,
      applicationServerKey: aBytes(CLAVE_PUBLICA)
    }))

  const { error } = await supabase.from('push_subs').upsert(
    { family_id: family.id, profile_id: profile.id, ...comoJson(sub), activa: true, fallos: 0 },
    { onConflict: 'endpoint' }
  )

  if (error) return { ok: false, mensaje: 'No se pudo guardar el aviso: ' + error.message }

  log.info('push.activado', { profile_id: profile.id })
  return { ok: true, mensaje: '' }
}

/** Apaga los avisos en este aparato. Borra la suscripción del navegador. */
export async function apagarAvisos() {
  const registro = await navigator.serviceWorker.getRegistration()
  const sub = registro && (await registro.pushManager.getSubscription())
  if (!sub) return { ok: true, mensaje: '' }

  const { endpoint } = comoJson(sub)
  await sub.unsubscribe()
  // La fila se borra, no se marca inactiva: si vuelve a activarse llegará
  // un endpoint nuevo, y dejar el viejo solo acumula basura.
  const { error } = await supabase.from('push_subs').delete().eq('endpoint', endpoint)
  if (error) return { ok: false, mensaje: error.message }

  log.info('push.apagado')
  return { ok: true, mensaje: '' }
}

/**
 * Al cambiar de perfil, este aparato pasa a ser de otra persona.
 *
 * Sin esto, la tablet compartida seguiría recibiendo los avisos de quien
 * la encendió hace tres semanas. No pide permisos ni suscribe: si no hay
 * suscripción, no hace nada.
 */
export async function apuntarPerfil({ family, profile }) {
  if (!sePuedeNotificar() || !family || !profile) return
  const registro = await navigator.serviceWorker.getRegistration()
  const sub = registro && (await registro.pushManager.getSubscription())
  if (!sub) return

  const { endpoint } = comoJson(sub)
  await supabase
    .from('push_subs')
    .update({ profile_id: profile.id, family_id: family.id })
    .eq('endpoint', endpoint)
}

/**
 * Qué perfiles del gremio tienen ALGÚN aparato con avisos.
 *
 * Lo usa el recordatorio del panel para poder decir a cuánta gente no le
 * llegaría nada (`avisosPendientes.js`). Devuelve ids únicos: una persona
 * con el móvil y la tablet son dos filas y una sola persona cubierta.
 *
 * **Devuelve `null` si algo falla, y eso es deliberado**: el recordatorio
 * distingue «no le llega a cinco» de «no he podido averiguarlo», y en el
 * segundo caso habla solo de este aparato en vez de inventarse una cifra.
 * Un panel no se rompe porque un recuento accesorio no se pueda leer.
 */
export async function perfilesConAvisos(familyId) {
  if (!familyId) return null
  const { data, error } = await supabase
    .from('push_subs')
    .select('profile_id')
    .eq('family_id', familyId)
    .eq('activa', true)
  if (error) return null
  return [...new Set((data || []).map((s) => s.profile_id))]
}
