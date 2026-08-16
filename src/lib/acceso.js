/**
 * Entrar, darse de alta y recuperar la contraseña.
 *
 * Vive aparte de la pantalla porque son reglas, no pintura, y porque el
 * caso que más duele —el alta que no falla pero tampoco entra— es
 * invisible en la interfaz: `signUp` devuelve `error: null` y `session:
 * null` cuando el proyecto pide confirmar el correo, así que la pantalla
 * se quedaba exactamente igual que antes de pulsar y la persona volvía a
 * pulsar. Con una familia eso lo resolvió alguien mirando el panel de
 * Supabase; con mil cuentas es la primera causa de abandono.
 */

// Mínimo para una contraseña NUEVA. El de Supabase son 6 y ese sigue
// valiendo para entrar (hay cuentas viejas), pero al crear o cambiar se
// pide más: es la única credencial real del gremio entero, y a diferencia
// del PIN parental esta sí protege datos.
export const MIN_CLAVE_NUEVA = 8

// Para entrar basta con lo que Supabase acepte: si le pedimos 8 a quien
// ya tiene una de 6, le estaríamos bloqueando su propia cuenta.
export const MIN_CLAVE_ENTRAR = 6

/**
 * Qué ha pasado tras `supabase.auth.signUp`.
 * Devuelve { estado, mensaje } con estado 'error' | 'confirma' | 'dentro'.
 */
export function resultadoDeAlta({ data, error } = {}) {
  if (error) return { estado: 'error', mensaje: traducirAcceso(error.message) }
  // Sesión = el proyecto no exige confirmar el correo y ya está dentro.
  if (data?.session) return { estado: 'dentro', mensaje: '' }
  // Sin sesión y sin error: hay un correo de confirmación en camino. Y si
  // el email ya existía, Supabase devuelve esto MISMO a propósito, para no
  // revelar qué correos están registrados. El mensaje sirve para los dos
  // casos sin mentir en ninguno.
  return {
    estado: 'confirma',
    mensaje: 'Te hemos enviado un correo para confirmar la cuenta. Ábrelo desde este mismo dispositivo y vuelve aquí.'
  }
}

/**
 * Qué ha pasado tras `supabase.auth.resetPasswordForEmail`.
 *
 * El mensaje es el mismo haya cuenta o no: decir «ese correo no existe»
 * convierte la pantalla en un comprobador de qué familias están dadas de
 * alta.
 */
export function resultadoDeRecuperacion({ error } = {}) {
  if (error) return { estado: 'error', mensaje: traducirAcceso(error.message) }
  return {
    estado: 'enviado',
    mensaje: 'Si ese correo tiene cuenta, le acaba de llegar un enlace para poner una contraseña nueva.'
  }
}

/** ¿Vale esta contraseña nueva? Devuelve { ok, mensaje }. */
export function validarClaveNueva(clave, repetida) {
  if (!clave || clave.length < MIN_CLAVE_NUEVA) {
    return { ok: false, mensaje: `La contraseña necesita al menos ${MIN_CLAVE_NUEVA} caracteres.` }
  }
  if (clave !== repetida) {
    return { ok: false, mensaje: 'Las dos contraseñas no coinciden.' }
  }
  return { ok: true, mensaje: '' }
}

/**
 * ¿Esta carga viene del enlace de recuperación del correo?
 *
 * Supabase-js consume el hash al arrancar y avisa con el evento
 * PASSWORD_RECOVERY, que es el camino bueno. Esto es el cinturón para
 * cuando el evento llega antes de que la app esté escuchando: sin ello,
 * el enlace del correo deja a la persona DENTRO de la app, con sesión y
 * sin haber cambiado nada, que es el peor final posible porque parece que
 * ha funcionado.
 */
export function esRecuperacion(hash = '', search = '') {
  const texto = String(hash) + '&' + String(search)
  return /(^|[#&?])type=recovery(&|$)/.test(texto.replace(/^#/, '#')) || /type=recovery/.test(texto)
}

/**
 * Los argumentos exactos de `signInWithPassword`.
 *
 * Existe por un fallo que costó un despliegue y que NO cazó ningún test:
 * el token del captcha se estaba pasando al lado de `email` y `password`,
 * y ahí **supabase-js lo ignora en silencio**. No avisa, no falla, no
 * devuelve error: simplemente manda `gotrue_meta_security: {}` y Supabase
 * responde «no captcha_token found». Con el captcha recién encendido eso
 * dejó a la familia sin poder entrar, mientras que registrarse y
 * recuperar la contraseña —que sí llevan el token en `options`— seguían
 * funcionando, que es lo que hacía el fallo tan difícil de ver.
 *
 * La regla es de una línea y por eso vive aquí, con su test: **en las
 * tres operaciones el token va DENTRO de `options`.**
 */
export function argumentosDeEntrada(email, clave, token = '') {
  return {
    email,
    password: clave,
    options: token ? { captchaToken: token } : {}
  }
}

/** Traduce los mensajes de Supabase Auth. Nunca deja jerga en pantalla. */
export function traducirAcceso(msg = '') {
  const t = String(msg)
  if (/invalid login credentials/i.test(t)) return 'Email o contraseña incorrectos.'
  if (/email not confirmed/i.test(t)) return 'Falta confirmar la cuenta: mira el correo que te enviamos.'
  if (/already registered|user already/i.test(t)) return 'Ese email ya tiene cuenta. Usa «Ya tengo cuenta».'
  if (/at least (\d+)/i.test(t)) return `La contraseña necesita al menos ${t.match(/at least (\d+)/i)[1]} caracteres.`
  if (/rate limit|too many requests|for security purposes/i.test(t)) {
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.'
  }
  if (/Failed to fetch|NetworkError/i.test(t)) return 'Sin conexión. Comprueba la red e inténtalo otra vez.'
  if (/new password should be different/i.test(t)) return 'La contraseña nueva tiene que ser distinta de la anterior.'
  return t
}

/**
 * A dónde vuelve el enlace del correo.
 *
 * Tiene que ser la URL publicada COMPLETA, con su subcarpeta si la
 * tuviera. Hoy la app vive en la raíz de elgremioapp.com y coincide con
 * el origen, pero mientras colgaba de /el-gremio/ un enlace a la raíz del
 * dominio llevaba a una página que no existe. Además hay que darla de alta en
 * Supabase → Authentication → URL Configuration → Redirect URLs, o el
 * enlace del correo rebota al «site url» por defecto.
 */
export function urlDeVuelta(origin, base = '/') {
  return String(origin).replace(/\/$/, '') + (base.startsWith('/') ? base : '/' + base)
}
