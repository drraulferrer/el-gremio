// ------------------------------------------------------------------
// El háptico: confirmar el gesto en el dedo, no en la pantalla.
//
// Duolingo vibra al acertar y al fallar, y lo hace por una razón que se
// nota sobre todo en una tablet apoyada en la mesa: entre que tocas y
// que la pantalla responde hay un hueco, y en ese hueco la duda es «¿lo
// he pulsado?». La respuesta más rápida que existe no es visual.
//
// Aquí importa más que en una app de adultos. La peque de 3 años valida
// misiones tocando estrellas grandes: no lee el texto que confirma, así
// que la confirmación tiene que llegar por otro canal. El sonido ya lo
// hace (`sonido.js`); esto es el mismo mensaje para cuando la tablet
// está en silencio.
//
// TRES DECISIONES:
//
// 1. **No hay interruptor en Ajustes.** La vibración ya tiene dos
//    interruptores que la persona conoce y encuentra —el del sistema
//    operativo y el silencio del móvil— y `prefers-reduced-motion` cubre
//    a quien pide menos movimiento. Un tercero dentro de la app sería un
//    ajuste que nadie busca en el sitio donde nadie mira.
//
// 2. **Callar no es fallar.** `navigator.vibrate` no existe en iOS
//    Safari, que es donde se usa la mitad de esta app. Un háptico que no
//    se puede dar no es un error: es una app que en ese aparato se
//    apoya solo en el sonido y la imagen. Nada de esto puede tirar una
//    excepción ni impedir que la estrella se registre.
//
// 3. **Patrones cortos y pocos.** Tres, con significados distintos y no
//    solapables. Un catálogo de diez vibraciones parecidas es ruido en
//    el dedo: si no se distinguen, no comunican.
// ------------------------------------------------------------------

/** Confirmación de un toque. Lo más corto que se percibe sin molestar. */
export const TOQUE = 10

/**
 * Algo se ha conseguido: misión aprobada, estrella, nivel.
 *
 * Dos golpes, no uno: un pulso único ya significa «toque», y esto tiene
 * que sentirse distinto de pulsar un botón o no dice nada nuevo.
 */
export const LOGRO = [0, 18, 60, 28]

/** Algo no ha salido. Más largo y más plano: no invita a repetir. */
export const FALLO = [0, 40, 50, 40]

/** ¿El sistema ha pedido menos movimiento? */
function menosMovimiento() {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * ¿Se puede y se debe vibrar?
 *
 * Separado de `vibrar` para poder fijar la regla en un test sin
 * necesitar un navegador que vibre de verdad.
 *
 * @param {object} nav objeto tipo `navigator` (inyectable en tests)
 * @param {boolean} reducido si el sistema pide menos movimiento
 */
export function debeVibrar(nav, reducido = menosMovimiento()) {
  if (reducido) return false
  return typeof nav?.vibrate === 'function'
}

/**
 * Vibra, si se puede.
 *
 * @param {number|number[]} patron uno de TOQUE / LOGRO / FALLO
 * @returns {boolean} si llegó a vibrar, para que un test pueda mirarlo
 */
export function vibrar(patron = TOQUE, nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (!debeVibrar(nav)) return false
  try {
    nav.vibrate(patron)
    return true
  } catch {
    // Algunos navegadores tiran si la pestaña no está en primer plano.
    // Un háptico perdido no es nada; una excepción aquí se comería la
    // acción que lo disparó.
    return false
  }
}
