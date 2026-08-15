import { useState } from 'react'
import QR from '../components/QR'

// ------------------------------------------------------------------
// Alta de dispositivos.
//
// La URL se calcula, no se escribe a mano: así sigue siendo correcta si
// mañana el gremio se mueve a un dominio propio o cambia el nombre del
// repositorio. Enseñar aquí un QR con una dirección fija sería la clase
// de detalle que se queda obsoleto sin que nadie se entere.
// ------------------------------------------------------------------

export function urlDelGremio() {
  if (typeof window === 'undefined') return ''
  const base = import.meta.env.BASE_URL || '/'
  return new URL(base, window.location.origin).href
}

export default function Dispositivos() {
  const url = urlDelGremio()
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles (Safari en algunos contextos): la URL
      // está a la vista y el QR sigue funcionando, que es lo que importa.
      setCopiado(false)
    }
  }

  return (
    <div>
      <div className="titulo-seccion">Abrir en otro dispositivo</div>

      <div className="carta tarjeta-qr">
        <QR texto={url} tamano={230} titulo={`Código QR de ${url}`} />
        <p className="suave" style={{ textAlign: 'center', marginTop: 4 }}>
          Apunta con la cámara del móvil o del iPad.
        </p>
        <code className="url-gremio">{url}</code>
        <button className="btn btn-fantasma btn-bloque" style={{ marginTop: 10 }} onClick={copiar}>
          {copiado ? '✓ Copiada' : 'Copiar dirección'}
        </button>
      </div>

      <div className="titulo-seccion">Instalarla como app</div>

      <div className="carta">
        <strong>📱 iPhone y iPad</strong>
        <p className="suave">
          Abre el enlace <strong>en Safari</strong> (Chrome en iOS no ofrece la opción). Toca el botón de
          compartir <strong>↑</strong> → <strong>Añadir a pantalla de inicio</strong>.
        </p>
      </div>

      <div className="carta">
        <strong>🤖 Android</strong>
        <p className="suave">
          En Chrome, menú <strong>⋮</strong> → <strong>Añadir a pantalla de inicio</strong> o{' '}
          <strong>Instalar aplicación</strong>.
        </p>
      </div>

      <div className="carta">
        <strong>Después, en cada aparato</strong>
        <p className="suave">
          Se entra con la <strong>misma cuenta familiar</strong> (un email y una contraseña para todos) y se
          elige perfil. El dispositivo lo recuerda, así que la tablet de la peque abre directamente en sus
          botones y no vuelve a pedir nada.
        </p>
      </div>
    </div>
  )
}
