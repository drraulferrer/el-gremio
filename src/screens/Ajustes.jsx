import { useState } from 'react'
import Miembros from './Miembros'
import Seguridad from './Seguridad'
import Dispositivos from './Dispositivos'
import Datos from './Datos'
import Avisos from './Avisos'
import Evidencia from './Evidencia'
import Estado from './Estado'

// Las pantallas de administración que casi nunca se tocan viven aquí,
// detrás del ⚙️, en vez de robar sitio en la barra de pestañas: con seis
// pestañas los rótulos ya no caben en un móvil.
const SECCIONES = [
  { id: 'miembros', etiqueta: '👥 Miembros' },
  { id: 'pin', etiqueta: '🔑 PIN' },
  { id: 'dispositivos', etiqueta: '📱 Dispositivos' },
  { id: 'datos', etiqueta: '🗂️ Datos' },
  { id: 'avisos', etiqueta: '🔔 Avisos' },
  { id: 'evidencia', etiqueta: '📚 Evidencia' },
  { id: 'estado', etiqueta: '🩺 Estado' }
]

export default function Ajustes({ family, data, refresh, refreshFamily, onVerTutorial, seccionInicial }) {
  // `seccionInicial` existe para que el recordatorio del panel pueda
  // abrir directamente en 🔔 Avisos. Un enlace que te deja en Miembros y
  // te obliga a buscar la pestaña no es un enlace, es una pista.
  const [seccion, setSeccion] = useState(seccionInicial || 'miembros')

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
      {seccion === 'datos' && <Datos family={family} onCambiada={refreshFamily} />}
      {seccion === 'avisos' && <Avisos family={family} data={data} />}
      {seccion === 'evidencia' && (
        <>
          <button className="btn btn-bloque" style={{ marginBottom: 8 }} onClick={() => onVerTutorial('porque')}>
            ⚔️ Por qué funciona así
          </button>
          <button className="btn btn-fantasma btn-bloque" style={{ marginBottom: 14 }} onClick={() => onVerTutorial('mapa')}>
            🗺️ Dónde está cada cosa
          </button>
          <Evidencia />
        </>
      )}
      {seccion === 'estado' && <Estado family={family} data={data} />}
    </div>
  )
}
