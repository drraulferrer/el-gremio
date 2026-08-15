import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

// QR generado en el propio dispositivo. Nada de servicios externos que
// generan la imagen: eso significaría mandar la URL del gremio a un
// tercero cada vez que alguien abre esta pantalla.
//
// Corrección de errores media (M, ~15%): sobra para una pantalla o un
// folio, y mantiene la rejilla lo bastante gruesa para escanear rápido.
export default function QR({ texto, tamano = 220, titulo = 'Código QR' }) {
  const modulos = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(texto)
    qr.make()
    const n = qr.getModuleCount()
    return {
      n,
      celdas: Array.from({ length: n }, (_, fila) =>
        Array.from({ length: n }, (_, col) => qr.isDark(fila, col))
      )
    }
  }, [texto])

  const margen = 2
  const lado = modulos.n + margen * 2

  return (
    <svg
      className="qr"
      width={tamano}
      height={tamano}
      viewBox={`0 0 ${lado} ${lado}`}
      role="img"
      aria-label={titulo}
      shapeRendering="crispEdges"
    >
      <rect width={lado} height={lado} fill="#ffffff" />
      {modulos.celdas.map((fila, y) =>
        fila.map((oscuro, x) =>
          oscuro ? <rect key={`${x}-${y}`} x={x + margen} y={y + margen} width="1" height="1" fill="#10122a" /> : null
        )
      )}
    </svg>
  )
}
