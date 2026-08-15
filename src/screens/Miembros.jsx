import { useState } from 'react'
import { supabase, mensajeDeError, EMOJIS, COLORS, ROLE_LABEL } from '../lib/supabase'
import {
  perfilesActivos,
  perfilesRetirados,
  validarMiembro,
  puedeRetirar,
  loQueSePierde,
  MAX_PERFILES,
  ROLES
} from '../lib/miembros'
import { log } from '../lib/log'
import { Modal, Gema } from '../components/ui'

// ------------------------------------------------------------------
// Gestión de miembros del gremio.
//
// La baja por defecto es "retirar", no "borrar": borrar arrastra en
// cascada misiones, canjes e insignias, y con ellos la XP que esa
// persona aportó a metas ya cerradas. Retirar la saca del selector y
// deja la historia intacta.
// ------------------------------------------------------------------

const MIEMBRO_NUEVO = () => ({ name: '', role: 'junior', emoji: '🦊', color: COLORS[0], active: true })

const AYUDA_ROL = {
  adulto: 'Pide misiones, valida las de los demás y entra al panel con el PIN.',
  junior: 'Pide sus misiones desde su dispositivo y espera el visto bueno.',
  peque: 'Pantalla propia de botones enormes. La estrella cae al momento, sin validación.'
}

export default function Miembros({ family, data, refresh }) {
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)
  const [fallo, setFallo] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const activos = perfilesActivos(data.profiles)
  const retirados = perfilesRetirados(data.profiles)

  async function guardar(m) {
    const { ok, mensaje } = validarMiembro(m, data.profiles)
    if (!ok) {
      setFallo(mensaje)
      return
    }

    setOcupado(true)
    const fila = {
      family_id: family.id,
      name: m.name.trim(),
      role: m.role,
      emoji: m.emoji,
      color: m.color
    }
    const { error } = m.id
      ? await supabase.from('profiles').update(fila).eq('id', m.id)
      : await supabase.from('profiles').insert(fila)
    setOcupado(false)

    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    log.info(m.id ? 'miembro.editado' : 'miembro.creado', { rol: m.role })
    setFallo('')
    setEditando(null)
    await refresh()
  }

  async function cambiarActivo(perfil, activo) {
    if (!activo) {
      const { ok, mensaje } = puedeRetirar(perfil, data.profiles)
      if (!ok) {
        setFallo(mensaje)
        return
      }
    }
    setOcupado(true)
    const { error } = await supabase.from('profiles').update({ active: activo }).eq('id', perfil.id)
    setOcupado(false)

    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    log.info(activo ? 'miembro.reincorporado' : 'miembro.retirado', { profile_id: perfil.id })
    setFallo('')
    await refresh()
  }

  async function borrarDeVerdad(perfil) {
    setOcupado(true)
    const { error } = await supabase.from('profiles').delete().eq('id', perfil.id)
    setOcupado(false)

    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    log.warn('miembro.borrado', { profile_id: perfil.id, rol: perfil.role })
    setBorrando(null)
    setFallo('')
    await refresh()
  }

  return (
    <div>
      {fallo && <p className="error-texto" role="alert">{fallo}</p>}

      <button
        className="btn btn-mini btn-bloque"
        style={{ marginBottom: 12 }}
        disabled={activos.length >= MAX_PERFILES}
        onClick={() => { setFallo(''); setEditando(MIEMBRO_NUEVO()) }}
      >
        + Añadir miembro
      </button>

      <div className="titulo-seccion">En el gremio · {activos.length} de {MAX_PERFILES}</div>

      {activos.map((p) => (
        <div className="carta" key={p.id}>
          <div className="fila">
            <div className="avatar" style={{ borderColor: p.color }}>{p.emoji}</div>
            <div className="crece">
              <strong>{p.name}</strong>
              <div className="suave">
                {ROLE_LABEL[p.role]} · {p.xp} XP · {p.coins} 🪙
              </div>
            </div>
            <Gema xp={p.xp} color={p.color} mini />
            <button className="btn-icono" onClick={() => { setFallo(''); setEditando(p) }} aria-label={`Editar a ${p.name}`}>
              ✏️
            </button>
          </div>
          <button
            className="btn btn-fantasma btn-mini btn-bloque"
            style={{ marginTop: 10 }}
            disabled={ocupado}
            onClick={() => cambiarActivo(p, false)}
          >
            Retirar del gremio
          </button>
        </div>
      ))}

      {retirados.length > 0 && (
        <>
          <div className="titulo-seccion">Retirados</div>
          <p className="suave" style={{ margin: '0 4px 10px' }}>
            Fuera del selector de perfiles, pero su historial y su aportación a las metas siguen contando.
          </p>
          {retirados.map((p) => (
            <div className="carta" key={p.id} style={{ opacity: 0.6 }}>
              <div className="fila">
                <div className="avatar" style={{ borderColor: p.color }}>{p.emoji}</div>
                <div className="crece">
                  <strong>{p.name}</strong>
                  <div className="suave">{ROLE_LABEL[p.role]} · {p.xp} XP</div>
                </div>
              </div>
              <div className="fila" style={{ marginTop: 10 }}>
                <button
                  className="btn btn-mini crece"
                  disabled={ocupado || perfilesActivos(data.profiles).length >= MAX_PERFILES}
                  onClick={() => cambiarActivo(p, true)}
                >
                  Reincorporar
                </button>
                <button className="btn btn-peligro btn-mini" disabled={ocupado} onClick={() => setBorrando(p)}>
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {editando && (
        <FormMiembro
          miembro={editando}
          ocupado={ocupado}
          onGuardar={guardar}
          onClose={() => setEditando(null)}
        />
      )}

      {borrando && (
        <ConfirmarBorrado
          perfil={borrando}
          perdida={loQueSePierde(borrando, data)}
          ocupado={ocupado}
          onBorrar={() => borrarDeVerdad(borrando)}
          onClose={() => setBorrando(null)}
        />
      )}
    </div>
  )
}

function FormMiembro({ miembro, ocupado, onGuardar, onClose }) {
  const [m, setM] = useState({ ...miembro })
  const set = (cambios) => setM({ ...m, ...cambios })

  return (
    <Modal titulo={m.id ? `Editar a ${miembro.name}` : 'Nuevo miembro'} onClose={onClose}>
      <div className="campo">
        <label>Nombre</label>
        <input value={m.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} autoFocus />
      </div>

      <div className="campo">
        <label>Rol</label>
        <select value={m.role} onChange={(e) => set({ role: e.target.value })}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <span className="suave">{AYUDA_ROL[m.role]}</span>
      </div>

      <div className="campo">
        <label>Emoji</label>
        <div className="grid-emojis">
          {EMOJIS.map((e) => (
            <button key={e} className={m.emoji === e ? 'sel' : ''} onClick={() => set({ emoji: e })}>{e}</button>
          ))}
        </div>
      </div>

      <div className="campo">
        <label>Color</label>
        <div className="grid-colores">
          {COLORS.map((c) => (
            <button
              key={c}
              className={m.color === c ? 'sel' : ''}
              style={{ background: c }}
              onClick={() => set({ color: c })}
              aria-label={'Color ' + c}
            />
          ))}
        </div>
      </div>

      <button className="btn btn-bloque" disabled={ocupado || !m.name.trim()} onClick={() => onGuardar(m)}>
        {ocupado ? 'Guardando…' : 'Guardar'}
      </button>
    </Modal>
  )
}

function ConfirmarBorrado({ perfil, perdida, ocupado, onBorrar, onClose }) {
  const [texto, setTexto] = useState('')
  const confirmado = texto.trim().toLocaleLowerCase('es') === perfil.name.trim().toLocaleLowerCase('es')
  const hayHistoria = perdida.misiones + perdida.canjes + perdida.insignias > 0

  return (
    <Modal titulo={`Borrar a ${perfil.name}`} onClose={onClose}>
      <p>Esto no se puede deshacer. Se borrará para siempre:</p>
      <ul className="suave" style={{ margin: '8px 0 12px', paddingLeft: 20 }}>
        <li>{perdida.misiones} misiones de su historial ({perdida.xp} XP aprobada)</li>
        <li>{perdida.canjes} canjes</li>
        <li>{perdida.insignias} insignias</li>
      </ul>
      {hayHistoria && (
        <p className="suave">
          Esa XP dejará de contar en las metas del gremio ya cerradas. Si solo quieres que deje de jugar,
          cierra esto y usa <strong>Retirar</strong>.
        </p>
      )}

      <div className="campo" style={{ marginTop: 12 }}>
        <label>Escribe «{perfil.name}» para confirmar</label>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
      </div>

      <button className="btn btn-peligro btn-bloque" disabled={!confirmado || ocupado} onClick={onBorrar}>
        {ocupado ? 'Borrando…' : 'Borrar definitivamente'}
      </button>
      <button className="btn btn-fantasma btn-bloque" style={{ marginTop: 10 }} onClick={onClose}>
        Cancelar
      </button>
    </Modal>
  )
}
