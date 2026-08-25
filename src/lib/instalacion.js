// ------------------------------------------------------------------
// Instalar la app en la pantalla de inicio.
//
// El Gremio es una webapp, así que «instalar» significa añadir un icono
// que la abre a pantalla completa. Importa más de lo que parece: sin
// instalar, en iPhone NO hay avisos push (lo dice avisosPendientes.js), y
// la peque abriría su tablero dentro de una pestaña de Safari, con la
// barra de direcciones a un dedo de sus botones enormes.
//
// Lo que sabe este fichero es solo lo que se puede razonar sin pintar, y
// está separado del dibujo porque las reglas de detección son justo lo
// que conviene poder probar sin abrir un navegador.
// ------------------------------------------------------------------

/**
 * ¿Ya está instalada y abierta desde su icono?
 *
 * Dos formas porque los dos mundos la dicen distinta: el estándar
 * `display-mode` y el `navigator.standalone` de Safari, que es anterior
 * al estándar y sigue siendo el único fiable en iPhone.
 */
export function abiertaComoApp(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return false
  const porEstandar = win.matchMedia?.('(display-mode: standalone)')?.matches === true
  const porSafari = win.navigator?.standalone === true
  return porEstandar || porSafari
}

/**
 * En qué aparato estamos, a efectos de instalar.
 *
 * El iPad miente: desde iPadOS 13 se anuncia como un Mac de escritorio.
 * Se le pilla porque un Mac de verdad no tiene pantalla táctil, así que
 * `maxTouchPoints > 1` sobre un `MacIntel` es un iPad. Sin esto, a quien
 * instala en la tablet de la peque —el caso más probable de todos— se le
 * enseñarían las instrucciones equivocadas.
 *
 * El ORDEN de las comprobaciones importa tanto como las comprobaciones.
 * Ver dentro.
 */
export function plataformaDeInstalacion({ ua = '', plataforma = '', tactiles = 0 } = {}) {
  // Lo que el aparato DICE de sí mismo va primero, siempre. La pista del
  // iPad de más abajo es una conjetura, y una conjetura no puede ganarle
  // a un dato: si el agente dice Android, es Android.
  //
  // El orden no es teórico. Con la primera versión —la conjetura antes
  // que Android— un Android emulado, que reporta `platform: MacIntel` y
  // cinco puntos táctiles, recibía las instrucciones de iOS: «toca
  // Compartir en Safari» en un Pixel. Se vio abriendo la app, no leyendo
  // el código.
  if (/iPhone|iPod|iPad/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  // El iPad miente: desde iPadOS 13 se anuncia como un Mac de escritorio.
  // Se le pilla porque un Mac de verdad no tiene pantalla táctil. Va la
  // ÚLTIMA justamente por ser una conjetura.
  if (/Mac/i.test(plataforma) && tactiles > 1) return 'ios'
  return 'escritorio'
}

/** Lee la plataforma del navegador de verdad. */
export function plataformaDeEsteAparato(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  if (!nav) return 'escritorio'
  return plataformaDeInstalacion({
    ua: nav.userAgent || '',
    plataforma: nav.platform || '',
    tactiles: nav.maxTouchPoints || 0
  })
}

/**
 * Qué enseñar: el botón que instala de verdad, o los pasos a mano.
 *
 * Android y escritorio dan un evento (`beforeinstallprompt`) que permite
 * instalar de un toque. iOS no lo tiene y no lo va a tener, así que ahí
 * solo caben instrucciones —y por eso las instrucciones no son un
 * segundo plato: son el único camino en la mitad de los aparatos de una
 * casa española.
 *
 * `null` significa que no hay nada que ofrecer: o ya está instalada, o es
 * un escritorio sin evento, donde un icono en la pantalla de inicio no es
 * lo que nadie espera.
 */
export function queOfrecer({ instalada, plataforma, hayEvento }) {
  if (instalada) return null
  if (hayEvento) return 'boton'
  if (plataforma === 'ios' || plataforma === 'android') return 'pasos'
  return null
}
