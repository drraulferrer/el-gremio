import { useState } from 'react'
import { selloDeInsignia } from '../lib/sellos'

// ------------------------------------------------------------------
// El sello de una insignia.
//
// Tres cosas que parecen detalles y no lo son:
//
// 1. La imagen es DECORATIVA (`alt=""`). El nombre y el estado ya van en
//    texto dentro de la tarjeta; si el sello también se anunciara, un
//    lector de pantalla leería la misma insignia dos veces.
//
// 2. Lleva `width`/`height` fijos. Sin ellos, 16 imágenes que llegan en
//    diferido empujan la rejilla hacia abajo mientras cargan y la lista
//    salta bajo el dedo de quien está leyendo.
//
// 3. Si la imagen falla, NO se cae la pantalla ni queda un hueco: sale el
//    marco del sello con la inicial. Un icono que no llega es un fallo de
//    red, y un fallo de red no debe parecer una insignia rota.
// ------------------------------------------------------------------

export default function Sello({ code, nombre = '', conseguida = false, tamano = 64 }) {
  const [falla, setFalla] = useState(false)
  const def = selloDeInsignia(code)

  const clases = [
    'sello',
    conseguida ? 'sello-conseguida' : 'sello-pendiente',
    def ? `sello-${def.material}` : ''
  ].filter(Boolean).join(' ')

  if (!def || falla) {
    return (
      <span className={`${clases} sello-sin-imagen`} style={{ width: tamano, height: tamano }} aria-hidden="true">
        {nombre.trim().charAt(0) || '·'}
      </span>
    )
  }

  return (
    <img
      className={clases}
      src={def.src}
      width={tamano}
      height={tamano}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      draggable="false"
      onError={() => setFalla(true)}
    />
  )
}
