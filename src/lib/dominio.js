// ------------------------------------------------------------------
// La dirección buena del gremio.
//
// Durante un tiempo bastó con calcularla del origen: la app estaba en un
// sitio y solo en uno. Con la mudanza a dominio propio (agosto de 2026)
// eso dejó de ser cierto, porque la dirección vieja sigue viva y
// redirigiendo, y una PWA instalada desde ella conserva el origen viejo
// para siempre.
//
// El problema no es que la app se abra ahí —redirige, funciona—, es que
// la pantalla de Dispositivos ENSEÑA esa dirección a los demás: un QR
// impreso o una URL copiada desde un aparato viejo propaga la dirección
// vieja a gente nueva, y la deja circulando años.
//
// Por eso la fuente de verdad pasa a ser `public/CNAME`, que es donde ya
// vivía la decisión, y llega al bundle por `define` en vite.config.js.
// ------------------------------------------------------------------

// En desarrollo hay que seguir viendo el origen real: un QR que apunte a
// elgremioapp.com desde `npm run dev` no sirve para probar nada. Cubre
// localhost, el bucle local y las dos redes privadas con las que se
// prueba desde el móvil de casa.
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/

export function esOrigenLocal(origin) {
  try {
    return LOCAL.test(new URL(origin).hostname)
  } catch {
    return false
  }
}

/**
 * La URL que se enseña y se comparte.
 *
 * Sin dominio declarado se comporta como antes —origen más base—, que es
 * lo correcto para un despliegue bajo subcarpeta. Con dominio declarado
 * manda el dominio, salvo en local.
 */
export function urlCanonica(origin, base = '/', dominio = '') {
  const limpio = String(dominio || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (limpio && !esOrigenLocal(origin)) return `https://${limpio}/`
  const b = base.startsWith('/') ? base : '/' + base
  return String(origin).replace(/\/$/, '') + (b.endsWith('/') ? b : b + '/')
}

// Los dos de abajo son los que usa la interfaz. Van aquí, y no en la
// pantalla de Dispositivos, porque desde la mudanza los usan tres
// pantallas y una regla copiada es una regla que se desincroniza.
const DOMINIO = typeof __DOMINIO__ === 'string' ? __DOMINIO__ : ''

/** La dirección de la app, la que se enseña y se comparte. */
export function urlDelGremio() {
  if (typeof window === 'undefined') return ''
  return urlCanonica(window.location.origin, import.meta.env.BASE_URL || '/', DOMINIO)
}

/** La exposición pública. Cuelga de la misma raíz, así que se deriva. */
export function urlDeLaNarrativa() {
  return urlDelGremio() + 'narrativa/'
}

/** ¿Se está mirando la app desde una dirección que ya no es la buena? */
export function mirandoDireccionVieja() {
  if (typeof window === 'undefined') return false
  return enDireccionVieja(window.location.origin, DOMINIO)
}

/** ¿Se está mirando la app desde una dirección que ya no es la buena? */
export function enDireccionVieja(origin, dominio = '') {
  const limpio = String(dominio || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!limpio || esOrigenLocal(origin)) return false
  try {
    return new URL(origin).hostname !== limpio
  } catch {
    return false
  }
}
