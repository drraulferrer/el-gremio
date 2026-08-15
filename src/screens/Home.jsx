import { useEffect, useRef, useState } from 'react'
import { canDo, dayKey, goalProgress, levelProgress, BADGES, FREQ_LABEL } from '../lib/supabase'
import { pedirMision as pedirMisionRemota, canjearPremio } from '../lib/acciones'
import { Gema, XPBar, Moneda, Celebracion, Pestana } from '../components/ui'

export default function Home({ family, data, profile, refresh, onSwitchProfile, onParent }) {
  const [tab, setTab] = useState('misiones')
  const [celeb, setCeleb] = useState(null)
  const [ocupado, setOcupado] = useState(null)
  const [aviso, setAviso] = useState('')
  const prev = useRef(null)

  const misPendientes = data.completions.filter((c) => c.profile_id === profile.id && c.status === 'pendiente')
  const misAprobadas = data.completions.filter((c) => c.profile_id === profile.id && c.status === 'aprobado')

  // Celebrar cuando llega una validación o se sube de nivel (vía realtime)
  useEffect(() => {
    const ids = new Set(misAprobadas.map((c) => c.id))
    const lvl = levelProgress(profile.xp).level
    if (prev.current && prev.current.profileId === profile.id) {
      const nuevas = misAprobadas.filter((c) => !prev.current.ids.has(c.id))
      if (lvl > prev.current.lvl) {
        setCeleb({ emoji: '💎', texto: `¡Nivel ${lvl}!` })
      } else if (nuevas.length) {
        const xp = nuevas.reduce((s, c) => s + c.xp, 0)
        setCeleb({ emoji: '🌟', texto: `+${xp} XP` })
      }
    }
    prev.current = { ids, lvl, profileId: profile.id }
  }, [data, profile.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function pedirMision(reto) {
    setOcupado(reto.id)
    setAviso('')
    const { ok, mensaje } = await pedirMisionRemota({ family, profile, reto })
    if (ok) await refresh()
    else setAviso(mensaje || 'No se pudo enviar la misión.')
    setOcupado(null)
  }

  async function canjear(premio) {
    setOcupado(premio.id)
    setAviso('')
    const { ok, mensaje } = await canjearPremio({ premio, profile })
    if (ok) {
      setCeleb({ emoji: '🛍️', texto: 'Pedido al gremio' })
      await refresh()
    } else {
      setAviso(mensaje)
    }
    setOcupado(null)
  }

  const retoDe = (id) => data.challenges.find((ch) => ch.id === id)
  const goal = data.goal
  const progresoMeta = goalProgress(goal, data.completions)

  return (
    <div className="app">
      {celeb && <Celebracion emoji={celeb.emoji} texto={celeb.texto} onDone={() => setCeleb(null)} />}

      {/* Carnet de aventurera/o */}
      <div className="carta">
        <div className="fila">
          <Gema xp={profile.xp} color={profile.color} />
          <div className="crece">
            <div className="fila-separada">
              <h2 style={{ fontSize: '1.2rem' }}>{profile.emoji} {profile.name}</h2>
              <Moneda n={profile.coins} />
            </div>
            <div style={{ marginTop: 8 }}>
              <XPBar xp={profile.xp} />
            </div>
          </div>
        </div>
      </div>

      {/* Estandarte: meta cooperativa del gremio */}
      {goal && (
        <div className="estandarte">
          <div className="fila-separada">
            <strong style={{ fontFamily: 'var(--display)' }}>{goal.emoji} {goal.title}</strong>
            <span className="suave">{Math.min(progresoMeta, goal.target_xp)} / {goal.target_xp} XP</span>
          </div>
          <div className="xpbar" style={{ marginTop: 8 }}>
            <div className="xpbar-fill" style={{ width: Math.min(100, Math.round((100 * progresoMeta) / goal.target_xp)) + '%', background: 'linear-gradient(90deg,#7fb3ff,#a78bfa)' }} />
            <div className="xpbar-pips"><span /><span /><span /><span /><span /></div>
          </div>
          {progresoMeta >= goal.target_xp && (
            <p style={{ marginTop: 8, color: 'var(--exito)', fontWeight: 800 }}>¡Meta del gremio conseguida! 🎉</p>
          )}
        </div>
      )}

      {aviso && (
        <p className="error-texto" role="alert" style={{ margin: '0 4px 10px' }}>{aviso}</p>
      )}

      {tab === 'misiones' && (
        <Misiones
          data={data}
          profile={profile}
          family={family}
          ocupado={ocupado}
          onPedir={pedirMision}
          misPendientes={misPendientes}
          misAprobadas={misAprobadas}
          retoDe={retoDe}
        />
      )}

      {tab === 'tienda' && <Tienda data={data} profile={profile} ocupado={ocupado} onCanjear={canjear} />}

      {tab === 'insignias' && <Insignias data={data} profile={profile} />}

      <nav className="tabbar" aria-label="Secciones">
        <Pestana icono="misiones" etiqueta="Misiones" activa={tab === 'misiones'} onClick={() => setTab('misiones')} />
        <Pestana icono="tienda" etiqueta="Tienda" activa={tab === 'tienda'} onClick={() => setTab('tienda')} />
        <Pestana icono="insignias" etiqueta="Insignias" activa={tab === 'insignias'} onClick={() => setTab('insignias')} />
        <Pestana icono="perfiles" etiqueta="Cambiar" onClick={onSwitchProfile} />
        <Pestana icono="candado" etiqueta="Panel" onClick={onParent} />
      </nav>
    </div>
  )
}

function Misiones({ data, profile, ocupado, onPedir, misPendientes, misAprobadas, retoDe }) {
  const hoy = dayKey(new Date())
  const disponibles = data.challenges.filter(
    (ch) => ch.active && (ch.profile_id === profile.id || ch.profile_id === null) && canDo(ch, data.completions, profile.id)
  )
  const hechasHoy = misAprobadas.filter((c) => c.resolved_at && dayKey(new Date(c.resolved_at)) === hoy)

  return (
    <div>
      <div className="titulo-seccion">Misiones disponibles</div>
      {disponibles.length === 0 && (
        <div className="vacio">No queda ninguna por hoy. Las nuevas misiones se crean en el panel parental.</div>
      )}
      <div className="lista-misiones">
        {disponibles.map((ch) => (
          <div className="carta" key={ch.id}>
            <div className="fila">
              <div className="avatar">{ch.emoji}</div>
              <div className="crece">
                <strong>{ch.title}</strong>
                <div className="suave">+{ch.xp} XP · +{ch.coins} 🪙 · {FREQ_LABEL[ch.frequency]}</div>
              </div>
              <button className="btn btn-mini" disabled={ocupado === ch.id} onClick={() => onPedir(ch)}>
                ¡Hecho!
              </button>
            </div>
          </div>
        ))}
      </div>

      {misPendientes.length > 0 && (
        <div>
          <div className="titulo-seccion">Esperando visto bueno</div>
          {misPendientes.map((c) => (
            <div className="carta" key={c.id}>
              <div className="fila-separada">
                <span>{retoDe(c.challenge_id)?.emoji} {retoDe(c.challenge_id)?.title || 'Misión'}</span>
                <span className="chip chip-pendiente">⏳ pendiente</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {hechasHoy.length > 0 && (
        <div>
          <div className="titulo-seccion">Conseguidas hoy</div>
          {hechasHoy.map((c) => (
            <div className="carta" key={c.id}>
              <div className="fila-separada">
                <span>{retoDe(c.challenge_id)?.emoji} {retoDe(c.challenge_id)?.title || 'Misión'}</span>
                <span className="chip chip-hecho">✓ +{c.xp} XP</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Tienda({ data, profile, ocupado, onCanjear }) {
  const premios = data.rewards.filter((r) => r.active)
  const misCanjes = data.redemptions.filter((r) => r.profile_id === profile.id && r.status === 'pendiente')
  const premioDe = (id) => data.rewards.find((r) => r.id === id)

  return (
    <div>
      <div className="titulo-seccion">Tienda del gremio</div>
      {premios.length === 0 && (
        <div className="vacio">La tienda está vacía. Los premios se crean en el panel parental.</div>
      )}
      {premios.map((r) => (
        <div className="carta" key={r.id}>
          <div className="fila">
            <div className="avatar">{r.emoji}</div>
            <div className="crece">
              <strong>{r.title}</strong>
              <div className="suave">{r.cost} 🪙</div>
            </div>
            <button
              className="btn btn-mini"
              disabled={ocupado === r.id || profile.coins < r.cost}
              onClick={() => onCanjear(r)}
            >
              Canjear
            </button>
          </div>
        </div>
      ))}

      {misCanjes.length > 0 && (
        <div>
          <div className="titulo-seccion">Pedidos por entregar</div>
          {misCanjes.map((c) => (
            <div className="carta" key={c.id}>
              <div className="fila-separada">
                <span>{premioDe(c.reward_id)?.emoji} {premioDe(c.reward_id)?.title || 'Premio'}</span>
                <span className="chip chip-pendiente">⏳ en camino</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Insignias({ data, profile }) {
  const mias = new Set(data.badges.filter((b) => b.profile_id === profile.id).map((b) => b.code))
  return (
    <div>
      <div className="titulo-seccion">Insignias · {mias.size} de {BADGES.length}</div>
      <div className="grid-insignias">
        {BADGES.map((b) => (
          <div className={'insignia' + (mias.has(b.code) ? '' : ' bloqueada')} key={b.code}>
            <span className="ins-emoji">{b.emoji}</span>
            <span className="ins-nombre">{b.name}</span>
            <div className="suave" style={{ fontSize: '0.72rem', marginTop: 2 }}>{b.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
