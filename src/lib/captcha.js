/**
 * Captcha del registro (Cloudflare Turnstile).
 *
 * Está para una cosa concreta: cada alta consume un correo de
 * confirmación del cupo del proyecto, así que un script que registre
 * cuentas en bucle no «llena la base», deja a las familias reales sin
 * poder darse de alta. El captcha es lo que hace que ese cupo lo gasten
 * personas.
 *
 * DECISIÓN IMPORTANTE: si no hay clave configurada, la app funciona
 * exactamente igual que antes y no dibuja nada. Sin eso, el día que la
 * clave falte o Cloudflare esté caído, el registro entero se cae con él;
 * y de paso permite desarrollar y probar en local sin montar nada. La
 * comprobación de verdad no está aquí, está en Supabase, que rechaza el
 * alta si el token no es válido: esto es la pieza que lo pide, no la que
 * lo verifica.
 */

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export function hayCaptcha() {
  return Boolean(SITE_KEY)
}

export function claveDelSitio() {
  return SITE_KEY
}

let promesa = null

/** Carga el script de Turnstile una sola vez y resuelve con `window.turnstile`. */
export function cargarTurnstile() {
  if (!hayCaptcha()) return Promise.resolve(null)
  if (promesa) return promesa

  promesa = new Promise((resolver, rechazar) => {
    if (window.turnstile) return resolver(window.turnstile)
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.defer = true
    s.onload = () => resolver(window.turnstile)
    s.onerror = () => {
      // Que no cargue no puede dejar a nadie fuera: quien llama trata el
      // null como «sin captcha» y el alta sigue. Supabase lo rechazará si
      // exige token, y entonces el mensaje será el suyo, no una pantalla
      // en blanco.
      promesa = null
      rechazar(new Error('turnstile_no_carga'))
    }
    document.head.appendChild(s)
  })

  return promesa
}

/**
 * Traduce el fallo de Supabase cuando el token no vale. Sin esto, quien
 * se registra lee «captcha protection: request disallowed», que no le
 * dice ni qué ha pasado ni qué hacer.
 */
export function esErrorDeCaptcha(mensaje = '') {
  return /captcha/i.test(String(mensaje))
}
