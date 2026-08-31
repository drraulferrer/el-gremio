/**
 * Entrar, darse de alta, recuperar la contraseña — y terminar lo que el
 * correo dejó a medias.
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

/**
 * El mismo texto tanto si el correo tiene cuenta como si no. Ver abajo.
 */
const ENLACE_ENVIADO =
  'Si ese correo tiene cuenta, le acaba de llegar un enlace para entrar. Solo sirve una vez.'

/**
 * Qué ha pasado tras `supabase.auth.signInWithOtp`.
 *
 * Dos decisiones viven aquí, y las dos importan:
 *
 * 1 · El enlace se pide con `shouldCreateUser: false`. Por defecto
 *     Supabase CREA la cuenta si el correo no existe, y en esta app eso
 *     sería un desastre silencioso: una letra mal en el correo y quien
 *     entra se encuentra «Fundad vuestro gremio» con todo vacío, sin
 *     entender que está en una cuenta nueva. La 017 impide que una cuenta
 *     tenga dos gremios, así que tampoco se arregla solo después.
 *
 * 2 · Cuando NO hay cuenta, Supabase contesta «Signups not allowed for
 *     otp». Ese error se traduce al MISMO mensaje que el camino bueno, a
 *     propósito: enseñarlo convertiría la pantalla en un comprobador de
 *     qué familias están dadas de alta. Es la misma regla que sigue
 *     `resultadoDeRecuperacion`, y por el mismo motivo.
 */
export function resultadoDeEnlace({ error } = {}) {
  if (error && /signups? not allowed|otp_disabled|signup_disabled/i.test(String(error.message))) {
    return { estado: 'enviado', mensaje: ENLACE_ENVIADO }
  }
  if (error) return { estado: 'error', mensaje: traducirAcceso(error.message) }
  return { estado: 'enviado', mensaje: ENLACE_ENVIADO }
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
 * ¿Esta carga viene del enlace de CONFIRMACIÓN del correo?
 *
 * Hermano de `esRecuperacion`, y hace falta por lo mismo: el enlace abre
 * sesión y la app tiene que enterarse. Lo que cambia es qué hay que hacer
 * después. En la recuperación, enseñar una pantalla. Aquí, TERMINAR la
 * conversión: `completar_conversion()` es lo que crea la pertenencia y
 * mueve el saldo, y hasta que no corre, la cuenta nueva **no tiene ningún
 * gremio**. Sin esto, quien acaba de crearse una identidad abre la app y
 * ve «Fundad vuestro gremio», con su casa aparentemente perdida.
 *
 * Vale también para el alta normal —fundar un gremio llega por este mismo
 * `type=signup`—, y ahí el servidor contesta `sin_solicitud` y no pasa
 * nada. Preguntar de más es mucho más barato que perderse la vuelta buena.
 */
export function esConfirmacion(hash = '', search = '') {
  const texto = String(hash) + '&' + String(search)
  return /type=(signup|email_change|email)(&|$)/.test(texto)
}

// ------------------------------------------------------------------
// La nota de «hay una identidad en marcha».
//
// El servidor contesta `sin_solicitud` en dos situaciones que para él son
// la misma y para quien mira la pantalla no se parecen en nada: fundar un
// gremio —que no pidió ninguna identidad— y volver con una solicitud que
// ya caducó, a las 72 horas. Sin esta nota habría que elegir entre callar
// siempre (y dejar a la segunda persona en una cuenta vacía sin saber por
// qué) o hablar siempre (e inventarle un error a la primera el día que se
// da de alta).
//
// Es del APARATO, no de la cuenta, y por eso vive aquí y no en la base: la
// pantalla ya dice «ábrelo desde este mismo aparato». Si el enlace se abre
// en otro, no hay nota y se calla, que es lo que pasaba hasta hoy.
// ------------------------------------------------------------------

export const CLAVE_IDENTIDAD = 'gremio_identidad_en_marcha'

/** Igual que en `gremios.js`: en modo privado `localStorage` lanza. */
function guardado(almacen, clave, valor) {
  try {
    if (valor === undefined) return almacen.getItem(clave)
    if (valor === null) almacen.removeItem(clave)
    else almacen.setItem(clave, valor)
  } catch {
    // Sin almacén la nota dura lo que la pestaña. Es peor, no es grave.
  }
  return null
}

export function recordarIdentidadEnMarcha(correo, almacen = localStorage) {
  guardado(almacen, CLAVE_IDENTIDAD, String(correo || '').trim().toLowerCase())
}

export function hayIdentidadEnMarcha(almacen = localStorage) {
  return Boolean(guardado(almacen, CLAVE_IDENTIDAD, undefined))
}

export function olvidarIdentidadEnMarcha(almacen = localStorage) {
  guardado(almacen, CLAVE_IDENTIDAD, null)
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
