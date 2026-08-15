import { useState } from 'react'
import Miembros from './Miembros'
import Seguridad from './Seguridad'
import Dispositivos from './Dispositivos'
import Estado from './Estado'

// Las pantallas de administración que casi nunca se tocan viven aquí,
// detrás del ⚙️, en vez de robar sitio en la barra de pestañas: con seis
// pestañas los rótulos ya no caben en un móvil.
const SECCIONES = [
  { id: 'miembros', etiqueta: '👥 Miembros' },
  { id: 'pin', etiqueta: '🔑 PIN' },
  { id: 'dispositivos', etiqueta: '📱 Dispositivos' },
  { id: 'estado', etiqueta: '🩺 Estado' }
]

export default function Ajustes({ family, data, refresh, refreshFamily }) {
  const [seccion, setSeccion] = useState('miembros')

  return (
    <div>
      <div className="segmentos" role="tablist">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={seccion === s.id}
            className={seccion === s.id ? 'activo' : ''}
            onClick={() => setSeccion(s.id)}
          >
            {s.etiqueta}
          </button>
        ))}
      </div>

      {seccion === 'miembros' && <Miembros family={family} data={data} refresh={refresh} />}
      {seccion === 'pin' && <Seguridad family={family} onCambiado={refreshFamily} />}
      {seccion === 'dispositivos' && <Dispositivos />}
      {seccion === 'estado' && <Estado family={family} data={data} />}
    </div>
  )
}
