import { useEffect, useRef } from 'react'
import { cargarTurnstile, claveDelSitio, hayCaptcha } from '../lib/captcha'

/**
 * El recuadro de Turnstile. No dibuja nada si no hay clave configurada,
 * que es el estado en que vive la app hasta que alguien cree la cuenta de
 * Cloudflare (ver docs/CAPTCHA.md).
 *
 * El token de Turnstile es de UN SOLO USO: si el alta falla y se vuelve a
 * intentar con el mismo token, Supabase lo rechaza y la persona se queda
 * mirando un error que no entiende. Por eso quien llama le cambia la
 * `key` en cada intento fallido: React desmonta el widget y monta uno
 * nuevo, que trae token nuevo.
 */
export default function Captcha({ onToken, accion }) {
  const caja = useRef(null)
  const widget = useRef(null)
  const avisar = useRef(onToken)
  avisar.current = onToken

  useEffect(() => {
    if (!hayCaptcha()) return undefined
    let vivo = true

    cargarTurnstile()
      .then((ts) => {
        if (!vivo || !ts || !caja.current || widget.current !== null) return
        widget.current = ts.render(caja.current, {
          sitekey: claveDelSitio(),
          action: accion,
          theme: 'dark',
          callback: (token) => avisar.current(token),
          'expired-callback': () => avisar.current(''),
          'error-callback': () => avisar.current('')
        })
      })
      // Que Cloudflare no cargue no puede dejar a nadie fuera: se sigue
      // sin token y decide Supabase, que es quien de verdad verifica.
      .catch(() => avisar.current(''))

    return () => {
      vivo = false
      if (widget.current !== null && window.turnstile) {
        window.turnstile.remove(widget.current)
        widget.current = null
      }
    }
  }, [accion])

  if (!hayCaptcha()) return null
  return <div ref={caja} style={{ marginTop: 12, minHeight: 65 }} />
}
