import { Gema } from '../components/ui'
import { RELEASE } from '../lib/version'
import { modoDemo } from '../lib/supabase'

export default function ProfilePicker({ family, profiles, onPick, onParent, onReportar }) {
  return (
    <div className="pantalla-centrada">
      <h1>{family.name}</h1>
      <p className="suave">¿Quién juega?</p>
      <div className="picker-grid">
        {profiles.map((p) => (
          <button
            key={p.id}
            className={'picker-perfil' + (p.role === 'peque' ? ' picker-peque' : '')}
            style={{ borderColor: p.color }}
            onClick={() => onPick(p.id)}
          >
            <span className="picker-emoji">{p.emoji}</span>
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
