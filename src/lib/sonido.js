// ------------------------------------------------------------------
// Sonido de celebración para el modo peque.
//
// Sintetizado con WebAudio: ni un fichero que descargar, ni un byte de
// audio en el bundle. Se dispara siempre desde un toque, así que ningún
// navegador lo bloquea por autoplay.
//
// Silenciable y silencioso por defecto si el sistema pide menos
// movimiento (quien evita animaciones suele agradecer evitar ruido).
// ------------------------------------------------------------------

const CLAVE = 'gremio_sonido'

let contexto = null

export function sonidoActivo() {
  const guardado = localStorage.getItem(CLAVE)
  if (guardado !== null) return guardado === '1'
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return true
}

export function alternarSonido() {
  const siguiente = !sonidoActivo()
  localStorage.setItem(CLAVE, siguiente ? '1' : '0')
  return siguiente
}

/** Arpegio corto y ascendente: suena a "bien hecho" sin ser estridente. */
export function tocarEstrella() {
  if (!sonidoActivo()) return
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    contexto = contexto || new AudioCtx()
    if (contexto.state === 'suspended') contexto.resume()

    const notas = [523.25, 659.25, 783.99, 1046.5] // do, mi, sol, do
    notas.forEach((frecuencia, i) => {
      const osc = contexto.createOscillator()
      const gan = contexto.createGain()
      const t0 = contexto.currentTime + i * 0.09

      osc.type = 'sine'
      osc.frequency.setValueAtTime(frecuencia, t0)
      gan.gain.setValueAtTime(0.0001, t0)
      gan.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02)
      gan.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32)

      osc.connect(gan).connect(contexto.destination)
      osc.start(t0)
      osc.stop(t0 + 0.34)
    })
  } catch {
    // Un fallo de audio jamás debe impedir que la estrella se registre.
  }
}
