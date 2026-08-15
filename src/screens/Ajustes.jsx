import { useState } from 'react'
import Miembros from './Miembros'
import Estado from './Estado'

// Las dos pantallas de administración que casi nunca se tocan viven aquí,
// detrás del ⚙️, en vez de robar sitio en la barra de pestañas: con seis
// pestañas los rótulos ya no caben en un móvil.
export default function Ajustes({ family, data, refresh }) {
  const [seccion, setSeccion] = useState('miembros')

  return (
    <div>
      <div className="segmentos" role="tablist">
        <button
          role="tab"
          aria-selected={seccion === 'miembros'}
          className={seccion === 'miembros' ? 'activo' : ''}
          onClick={() => setSeccion('miembros')}
        >
          👥 Miembros
        </button>
        <button
          role="tab"
          aria-selected={seccion === 'estado'}
          className={seccion === 'estado' ? 'activo' : ''}
          onClick={() => setSeccion('estado')}
        >
          🩺 Estado
        </button>
      </div>

      {seccion === 'miembros' ? (
        <Miembros family={family} data={data} refresh={refresh} />
      ) : (
        <Estado family={family} data={data} />
      )}
    </div>
  )
}
