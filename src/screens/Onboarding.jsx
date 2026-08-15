import { useState } from 'react'
import {
  supabase,
  hashPin,
  TEMPLATES,
  EMOJIS,
  COLORS,
  ROLE_LABEL,
  PREMIOS_INICIALES,
  META_INICIAL,
  mensajeDeError
} from '../lib/supabase'
import { log } from '../lib/log'

const MIEMBRO_NUEVO = () => ({ name: '', role: 'junior', emoji: '🦊', color: COLORS[0] })

export default function Onboarding({ onDone }) {
  const [paso, setPaso] = useState(1)
  const [nombre, setNombre] = useState('')
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [miembros, setMiembros] = useState([
    { name: '', role: 'adulto', emoji: '🧙', color: COLORS[2] },
    { name: '', role: 'adulto', emoji: '🦉', color: COLORS[1] },
    { name: '', role: 'junior', emoji: '🦄', color: COLORS[0] },
    { name: '', role: 'peque', emoji: '🐣', color: COLORS[3] }
  ])
  const [conPlantillas, setConPlantillas] = useState(true)
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)

  function setMiembro(i, cambios) {
    setMiembros(miembros.map((m, j) => (j === i ? { ...m, ...cambios } : m)))
  }

  async function crear() {
    setError('')
    const listos = miembros.filter((m) => m.name.trim())
    if (!listos.some((m) => m.role === 'adulto')) {
      setError('Hace falta al menos una persona adulta.')
      return
    }
    setCreando(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const pinHash = await hashPin(pin1)
      const { data: fam, error: e1 } = await supabase
        .from('families')
        .insert({ owner: userData.user.id, name: nombre.trim(), parent_pin_hash: pinHash })
        .select()
        .single()
      if (e1) throw e1

      const { data: perfiles, error: e2 } = await supabase
        .from('profiles')
        .insert(listos.map((m) => ({
          family_id: fam.id,
          name: m.name.trim(),
          role: m.role,
          emoji: m.emoji,
          color: m.color
        })))
        .select()
      if (e2) throw e2

      if (conPlantillas) {
        const retos = perfiles.flatMap((p) =>
          (TEMPLATES[p.role] || []).map((t) => ({ ...t, family_id: fam.id, profile_id: p.id }))
        )
        if (retos.length) {
          const { error: e3 } = await supabase.from('challenges').insert(retos)
          if (e3) throw e3
        }

        const { error: e4 } = await supabase
          .from('rewards')
          .insert(PREMIOS_INICIALES.map((r) => ({ ...r, family_id: fam.id })))
        if (e4) throw e4

        const { error: e5 } = await supabase.from('family_goals').insert({ ...META_INICIAL, family_id: fam.id })
        if (e5) throw e5
      }

      log.info('gremio.fundado', { perfiles: perfiles.length, con_plantillas: conPlantillas })
      onDone()
    } catch (err) {
      setError(mensajeDeError(err) || 'Algo falló al crear el gremio.')
      setCreando(false)
    }
  }

  if (paso === 1) {
    return (
      <div className="pantalla-centrada">
        <h1>Fundad vuestro gremio</h1>
        <p className="suave" style={{ maxWidth: 320 }}>El nombre saldrá en la cabecera de todos los perfiles.</p>
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div className="campo">
            <label>Nombre del gremio</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="El Gremio de los..." autoFocus />
          </div>
          <button className="btn btn-bloque" disabled={!nombre.trim()} onClick={() => setPaso(2)}>Seguir</button>
        </div>
      </div>
    )
  }

  if (paso === 2) {
    return (
      <div className="pantalla-centrada">
        <h1>PIN parental</h1>
        <p className="suave" style={{ maxWidth: 320 }}>
          Protege el panel donde se validan misiones y se crean premios. Mínimo 4 dígitos.
        </p>
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div className="campo">
            <label>PIN</label>
            <input type="password" inputMode="numeric" value={pin1} onChange={(e) => setPin1(e.target.value)} />
          </div>
          <div className="campo">
            <label>Repite el PIN</label>
            <input type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value)} />
          </div>
          {pin2 && pin1 !== pin2 && <p className="error-texto">Los dos PIN no coinciden.</p>}
          <button
            className="btn btn-bloque"
            disabled={pin1.length < 4 || pin1 !== pin2}
            onClick={() => setPaso(3)}
          >
            Seguir
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app" style={{ paddingTop: 24 }}>
      <h1 style={{ marginBottom: 4 }}>Los miembros</h1>
      <p className="suave" style={{ marginBottom: 14 }}>
        Deja el nombre vacío para saltarte una fila. <strong>Peque</strong>: pantalla propia de botones enormes, con
        estrella al momento y sin esperar validación. <strong>Junior</strong>: pide sus misiones y espera el visto
        bueno. <strong>Adulto</strong>: además entra al panel con el PIN.
      </p>

      {miembros.map((m, i) => (
        <div className="carta" key={i}>
          <div className="fila" style={{ marginBottom: 10 }}>
            <div className="avatar" style={{ borderColor: m.color }}>{m.emoji}</div>
            <input
              className="crece"
              placeholder="Nombre"
              value={m.name}
              onChange={(e) => setMiembro(i, { name: e.target.value })}
            />
            <select
              style={{ width: 120 }}
              value={m.role}
              onChange={(e) => setMiembro(i, { role: e.target.value })}
            >
              {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="grid-emojis" style={{ marginBottom: 8 }}>
            {EMOJIS.slice(0, 8).map((e) => (
              <button key={e} className={m.emoji === e ? 'sel' : ''} onClick={() => setMiembro(i, { emoji: e })}>{e}</button>
            ))}
          </div>
          <div className="grid-colores">
            {COLORS.map((c) => (
              <button
                key={c}
                className={m.color === c ? 'sel' : ''}
                style={{ background: c }}
                onClick={() => setMiembro(i, { color: c })}
                aria-label={'Color ' + c}
              />
            ))}
          </div>
        </div>
      ))}

      <label className="fila carta" style={{ cursor: 'pointer' }}>
        <input type="checkbox" style={{ width: 22, height: 22 }} checked={conPlantillas} onChange={(e) => setConPlantillas(e.target.checked)} />
        <span className="crece">
          Empezar con contenido: misiones por edad, cinco premios de ejemplo y una primera meta del gremio. Todo
          editable o borrable después.
        </span>
      </label>

      {error && <p className="error-texto">{error}</p>}
      <button className="btn btn-bloque" onClick={crear} disabled={creando || !miembros.some((m) => m.name.trim())}>
        {creando ? 'Fundando…' : '⚔️ Fundar el gremio'}
      </button>
    </div>
  )
}
