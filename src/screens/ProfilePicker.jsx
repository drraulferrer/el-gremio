import { Gema } from '../components/ui'
import Retrato from '../components/Retrato'
import { RELEASE } from '../lib/version'
import { modoDemo } from '../lib/supabase'

export default function ProfilePicker({
  family, profiles, onPick, onParent, onReportar,
  gremios = [], onCambiarGremio
}) {
  // El selector solo aparece si hay a dónde ir. Con un gremio —el caso de
  // todo el mundo hoy— la pantalla es exactamente la de siempre, y eso es
  // deliberado: no se le enseña a nadie una elección que no tiene.
  const varios = gremios.length > 1

  return (
    <div className="pantalla-centrada">
      <h1>{family.name}</h1>

      {varios && (
        // Con SU tipo bien visible, que es lo que pide `C-5`: pasar de la
        // casa al trabajo sin darse cuenta es el error de uso más probable
        // de toda esta funcionalidad, y el más incómodo.
        <div className="selector-gremio" role="group" aria-label="Cambiar de gremio">
          {gremios.map((g) => (
            <button
              key={g.id}
              className={'chip-gremio' + (g.id === family.id ? ' chip-gremio-activo' : '')}
              aria-current={g.id === family.id ? 'true' : undefined}
              onClick={() => onCambiarGremio?.(g.id)}
            >
              {g.name}
              {g.tipo_visible && <span className="chip-gremio-tipo">{g.tipo_visible}</span>}
            </button>
          ))}
        </div>
      )}

      <p className="suave">¿Quién juega?</p>
      <div className="picker-grid">
        {profiles.map((p) => (
          <button
            key={p.id}
            className={'picker-perfil' + (p.role === 'peque' ? ' picker-peque' : '')}
            style={{ borderColor: p.color }}
            onClick={() => onPick(p.id)}
          >
            <Retrato perfil={p} tamano={p.role === 'peque' ? 84 : 72} vista="cabeza" />
            <span className="picker-nombre">{p.name}</span>
            {p.role === 'peque' ? <span className="chip">⭐ modo peque</span> : <Gema xp={p.xp} color={p.color} mini />}
          </button>
        ))}
      </div>
      <button className="btn btn-fantasma" style={{ marginTop: 8 }} onClick={onParent}>
        🔒 Panel parental
      </button>

      {/* Contar un fallo vive aquí y no detrás del PIN a propósito: quien
          se tropieza con uno suele ser quien NO tiene el PIN, y esta
          pantalla está a un toque de «Cambiar» desde cualquier tablero. */}
      {onReportar && (
        <button className="enlace-suave" onClick={onReportar}>
          Algo va mal · contarlo
        </button>
      )}

      <p className="suave" style={{ fontSize: '0.75rem' }}>
        {RELEASE}
        {modoDemo && ' · modo demo'}
      </p>
    </div>
  )
}
