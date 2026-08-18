import { useEffect, useRef, useState } from 'react'
import { canDo, dayKey, goalProgress, levelProgress, FREQ_LABEL } from '../lib/supabase'
import { INSIGNIAS, PODERES, PODERES_LISTOS } from '../lib/insignias'
import { estadoDeTemporada } from '../lib/temporadas'
import Poderes from '../components/Poderes'
import CaminoRacha from '../components/CaminoRacha'
import Cronica from '../components/Cronica'
import { pedirMision as pedirMisionRemota, canjearPremio, deshacerMision } from '../lib/acciones'
import { Gema, XPBar, Bolsa, Celebracion, Pestana } from '../components/ui'
import { talis, progresoDeTalis } from '../lib/talis'
import { HABILIDADES, habilidad, xpPorHabilidad, rangoDeHabilidad, habilidadDominante } from '../lib/habilidades'
import { flex, generoDe } from '../lib/genero'
import { planDelDia, agruparPorFrecuencia } from '../lib/misiones'
import { premiosParaMayores } from '../lib/premios'
import { semana, etiquetaDeSemana, validadasDe, resumenDeSemana, semanasConDatos } from '../lib/historial'

export default function Home({ family, data, profile, refresh, onSwitchProfile, onParent }) {
  const genero = generoDe(profile)
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
        const monedas = nuevas.reduce((s, c) => s + (c.coins || 0), 0)
        // El elogio es lo que de verdad tiene efecto; la XP y los Talis
        // acompañan. El orden importa: primero lo que se ha ganado, y el
        // elogio debajo con más peso visual, no al revés.
        const conElogio = nuevas.find((c) => c.praise)
        setCeleb({
          emoji: '🌟',
          texto: monedas > 0 ? `+${xp} XP · +${talis(monedas)}` : `+${xp} XP`,
          elogio: conElogio?.praise || ''
        })
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

  async function cancelarPendiente(id) {
    setAviso('')
    const { ok, mensaje } = await deshacerMision(id)
    if (ok) await refresh()
    else setAviso(mensaje || 'No se pudo cancelar.')
  }

  const retoDe = (id) => data.challenges.find((ch) => ch.id === id)
  const goal = data.goal
  const progresoMeta = goalProgress(goal, data.completions)
  // Metas logradas = temporadas cerradas. Se deriva, no se guarda: un
  // contador duplicado se desincroniza el día que alguien reabre una meta.
  const temporada = estadoDeTemporada(data.goals || [])

  return (
    <div className="app">
      {celeb && <Celebracion emoji={celeb.emoji} texto={celeb.texto} elogio={celeb.elogio} onDone={() => setCeleb(null)} />}

      {/* Carnet de aventurera/o */}
      <div className="carta">
        <div className="fila">
          <Gema xp={profile.xp} color={profile.color} />
          <div className="crece">
            <div className="fila-separada">
              <h2 style={{ fontSize: '1.2rem' }}>{profile.emoji} {profile.name}</h2>
              <Bolsa n={profile.coins} />
            </div>
            <div style={{ marginTop: 8 }}>
              <XPBar xp={profile.xp} />
            </div>
          </div>
        </div>
      </div>

      {/* Estandarte: rango del gremio y meta cooperativa.
          El sello va ENCIMA de la meta, y el bloque entero sobrevive a que
          no haya meta activa. Las dos cosas son la misma decisión: la
          barra de la meta se vacía al cerrarla, y si con ella desaparecía
          también el rango, cerrar una meta se sentía como perder el
          progreso. Es justo lo que las temporadas venían a arreglar. */}
      {(goal || temporada.metasLogradas > 0) && (
        <div className="estandarte">
          <div className="sello-gremio">
            <span className="sello-emoji" aria-hidden="true">{temporada.rango.emoji}</span>
            <div className="crece">
              <div className="sello-nombre">{temporada.rango.nombre}</div>
              {temporada.metasLogradas > 0 && (
                <div className="suave" style={{ fontSize: '0.78rem' }}>
                  {temporada.metasLogradas} {temporada.metasLogradas === 1 ? 'meta lograda' : 'metas logradas'} ·
                  {' '}{temporada.xpHistorica} XP de por vida
                </div>
              )}
            </div>
          </div>

          {goal ? (
            <>
              <div className="fila-separada">
                <strong style={{ fontFamily: 'var(--display)' }}>{goal.emoji} {goal.title}</strong>
                <span className="suave">{Math.min(progresoMeta, goal.target_xp)} / {goal.target_xp} XP</span>
              </div>
              <div className="xpbar" style={{ marginTop: 8 }}>
                {/* Sin color en línea: la meta es reconocimiento y su oro
                    lo pone `.estandarte .xpbar-fill` en la hoja. */}
                <div className="xpbar-fill" style={{ width: Math.min(100, Math.round((100 * progresoMeta) / goal.target_xp)) + '%' }} />
                <div className="xpbar-pips"><span /><span /><span /><span /><span /></div>
              </div>
              {progresoMeta >= goal.target_xp && (
                <p style={{ marginTop: 8, color: 'var(--exito)', fontWeight: 800 }}>¡Meta del gremio conseguida! 🎉</p>
              )}
            </>
          ) : (
            <p className="suave" style={{ margin: 0 }}>
              Temporada {temporada.temporada}: sin meta todavía. Un adulto puede proponer la siguiente desde el panel.
            </p>
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
          onCancelar={cancelarPendiente}
          genero={genero}
        />
      )}

      {tab === 'tienda' && <Tienda data={data} profile={profile} ocupado={ocupado} onCanjear={canjear} />}

      {tab === 'progreso' && <Progreso data={data} profile={profile} genero={genero} refresh={refresh} />}

      <nav className="tabbar" aria-label="Secciones">
        <Pestana icono="misiones" etiqueta="Misiones" activa={tab === 'misiones'} onClick={() => setTab('misiones')} />
        <Pestana icono="tienda" etiqueta="Tienda" activa={tab === 'tienda'} onClick={() => setTab('tienda')} />
        <Pestana icono="insignias" etiqueta="Progreso" activa={tab === 'progreso'} onClick={() => setTab('progreso')} />
        <Pestana icono="perfiles" etiqueta="Cambiar" onClick={onSwitchProfile} />
        <Pestana icono="candado" etiqueta="Panel" onClick={onParent} />
      </nav>
    </div>
  )
}

function Misiones({ data, profile, ocupado, onPedir, misPendientes, misAprobadas, retoDe, onCancelar, genero }) {
  // Lo que no se validó hoy, con su motivo. Solo de hoy: una corrección de
  // la semana pasada ya no corrige nada, es un reproche guardado.
  const hoyClave = dayKey(new Date())
  const misRechazadas = data.completions.filter(
    (c) =>
      c.profile_id === profile.id &&
      c.status === 'rechazado' &&
      c.resolved_at &&
      dayKey(new Date(c.resolved_at)) === hoyClave
  )

  const hoy = dayKey(new Date())
  // `dia` deja fuera las que hoy no tocan por su patrón semanal. El
  // tablero responde «¿qué me toca HOY?»; el panel sigue viéndolas todas.
  const disponibles = planDelDia(profile, data.challenges, data.planDiario, new Date()).filter((ch) =>
    canDo(ch, data.completions, profile.id)
  )
  const porFrecuencia = agruparPorFrecuencia(disponibles)
  const hechasHoy = misAprobadas.filter((c) => c.resolved_at && dayKey(new Date(c.resolved_at)) === hoy)

  return (
    <div>
      {misRechazadas.length > 0 && (
        <>
          <div className="titulo-seccion">Todavía no</div>
          {misRechazadas.map((c) => {
            const ch = data.challenges.find((x) => x.id === c.challenge_id)
            // Qué ha pasado con esa misión DESPUÉS de que la devolvieran.
            // Sin esto la tarjeta era un callejón sin salida: decía qué
            // faltaba y no ofrecía forma de arreglarlo. La misión volvía a
            // la lista de abajo, sí, pero nada unía las dos cosas, y
            // «arréglalo y búscalo tú entre quince» no es una instrucción.
            const posteriores = data.completions.filter(
              (x) =>
                x.challenge_id === c.challenge_id &&
                x.profile_id === profile.id &&
                x.status !== 'rechazado' &&
                new Date(x.requested_at) > new Date(c.resolved_at)
            )
            const esperando = posteriores.some((x) => x.status === 'pendiente')
            const yaValidada = posteriores.some((x) => x.status === 'aprobado')
            const puedeRepetir = ch && canDo(ch, data.completions, profile.id)

            return (
              <div className="carta carta-correccion" key={c.id}>
                <div className="fila">
                  <div className="avatar">{ch?.emoji || '📝'}</div>
                  <div className="crece">
                    <strong>{flex(ch?.title, genero) || 'Misión'}</strong>
                    {c.praise && <p className="texto-correccion">{c.praise}</p>}
                  </div>
                  {yaValidada ? (
                    <span className="chip">✓ ya está</span>
                  ) : esperando ? (
                    <span className="chip chip-pendiente">⏳ enviada</span>
                  ) : puedeRepetir ? (
                    <button
                      className="btn btn-mini"
                      disabled={ocupado === ch.id}
                      onClick={() => onPedir(ch)}
                    >
                      Ya está
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </>
      )}

      <div className="titulo-seccion">Misiones disponibles</div>
      {disponibles.length === 0 && (
        <div className="vacio">No queda ninguna por hoy. Las nuevas misiones se crean en el panel parental.</div>
      )}
      {/* Separadas por frecuencia y no en una lista plana: con quince
          misiones seguidas, saber cuáles caducan hoy obligaba a leerlas
          todas. La frecuencia ya no se repite en cada tarjeta, porque la
          dice el encabezado del bloque. */}
      {porFrecuencia.map((grupo) => (
        <section key={grupo.frecuencia}>
          <h3 className="titulo-frecuencia">
            {grupo.titulo}
            <span className="cuenta-frecuencia">{grupo.misiones.length}</span>
          </h3>
          <div className="lista-misiones">
            {grupo.misiones.map((ch) => (
              <div className="carta" key={ch.id}>
                <div className="fila">
                  <div className="avatar">{ch.emoji}</div>
                  <div className="crece">
                    <strong>{flex(ch.title, genero)}</strong>
                    <div className="suave">
                      {habilidad(ch.skill) && (
                        <span style={{ color: habilidad(ch.skill).color }}>
                          {habilidad(ch.skill).emoji} {habilidad(ch.skill).nombre} ·{' '}
                        </span>
                      )}
                      +{ch.xp} XP
                    </div>
                  </div>
                  <button className="btn btn-mini" disabled={ocupado === ch.id} onClick={() => onPedir(ch)}>
                    ¡Hecho!
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {misPendientes.length > 0 && (
        <div>
          <div className="titulo-seccion">Esperando visto bueno</div>
          {misPendientes.map((c) => (
            <div className="carta" key={c.id}>
              <div className="fila-separada">
                <span>{retoDe(c.challenge_id)?.emoji} {flex(retoDe(c.challenge_id)?.title, genero) || 'Misión'}</span>
                <span className="chip chip-pendiente">⏳ pendiente</span>
              </div>
              <button
                className="btn btn-fantasma btn-mini btn-bloque"
                style={{ marginTop: 10 }}
                onClick={() => onCancelar(c.id)}
              >
                Me he equivocado, cancelar
              </button>
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
                <span>{retoDe(c.challenge_id)?.emoji} {flex(retoDe(c.challenge_id)?.title, genero) || 'Misión'}</span>
                <span className="chip chip-hecho">✓ +{c.xp} XP</span>
              </div>
              {c.praise && <p className="elogio-recibido">“{c.praise}”</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Tienda({ data, profile, ocupado, onCanjear }) {
  // Los premios por debajo del techo de la peque son SUYOS y no salen
  // aquí: cuestan quince o veinte Talis porque ella gana cinco al día,
  // y en esta tienda serían gratis.
  const premios = premiosParaMayores(data.rewards)
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

function Progreso({ data, profile, genero, refresh }) {
  // El historial va por semanas y no en una lista infinita: una lista que
  // solo crece deja de leerse al mes. Nada se archiva de verdad —los datos
  // siguen en la base—, solo sale de la vista.
  const [atras, setAtras] = useState(0)
  const rango = semana(new Date(), atras)
  const validadas = validadasDe(data.completions, profile.id, rango)
  const resumen = resumenDeSemana(validadas)
  const tope = semanasConDatos(data.completions, profile.id)

  const mias = new Set(data.badges.filter((b) => b.profile_id === profile.id).map((b) => b.code))
  const progresoTalis = progresoDeTalis(profile, data)
  const porHabilidad = xpPorHabilidad(profile.id, data.completions, data.challenges)
  const dominante = habilidadDominante(porHabilidad)

  return (
    <div>
      <CaminoRacha data={data} profile={profile} refresh={refresh} />

      <div className="titulo-seccion">Tus habilidades</div>

      {dominante ? (
        <p className="suave" style={{ margin: '0 4px 12px' }}>
          Ahora mismo eres, sobre todo, <strong style={{ color: dominante.color }}>{dominante.nombre.toLowerCase()}</strong>.
          Las misiones no son tareas: cada una entrena algo.
        </p>
      ) : (
        <p className="suave" style={{ margin: '0 4px 12px' }}>
          Cuando validen tus primeras misiones, aquí verás qué estás entrenando.
        </p>
      )}

      <div className="carta">
        {HABILIDADES.map((h) => {
          const xp = porHabilidad[h.id] || 0
          const rango = rangoDeHabilidad(xp)
          return (
            <div key={h.id} className="fila-habilidad">
              <img src={h.icono} alt="" className="hab-icono" />
              <div className="crece">
                <div className="fila-separada">
                  <strong style={{ fontSize: '0.95rem' }}>{h.nombre}</strong>
                  <span className="suave" style={{ fontSize: '0.78rem' }}>
                    {flex(rango.nombre, genero)} · {xp} XP
                  </span>
                </div>
                {/* Todas las barras degradan teal→oro, sin color por
                    habilidad: el teal dice «progreso» y el oro asoma
                    según se acerca la maestría. Que las ocho compartan
                    escala es lo que deja compararlas de un vistazo. */}
                <div className="barra-habilidad">
                  <div className="barra-habilidad-fill" style={{ width: rango.pct + '%' }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="titulo-seccion">Lo que has hecho</div>

      <div className="carta">
        <div className="fila-separada" style={{ marginBottom: 10 }}>
          <button
            className="btn btn-fantasma btn-mini"
            onClick={() => setAtras(atras + 1)}
            disabled={atras >= tope}
            aria-label="Semana anterior"
          >
            ‹
          </button>
          <strong style={{ fontSize: '0.95rem' }}>{etiquetaDeSemana(rango)}</strong>
          <button
            className="btn btn-fantasma btn-mini"
            onClick={() => setAtras(Math.max(0, atras - 1))}
            disabled={atras === 0}
            aria-label="Semana siguiente"
          >
            ›
          </button>
        </div>

        {resumen.misiones === 0 ? (
          <div className="vacio" style={{ margin: 0 }}>
            {atras === 0 ? 'Todavía no hay nada validado esta semana.' : 'Esa semana no hubo nada.'}
          </div>
        ) : (
          <>
            <div className="suave" style={{ marginBottom: 10 }}>
              {resumen.misiones} {resumen.misiones === 1 ? 'misión' : 'misiones'} · {resumen.xp} XP · {resumen.monedas} 🪙
            </div>
            {validadas.map((c) => {
              const ch = data.challenges.find((x) => x.id === c.challenge_id)
              const dia = new Date(c.resolved_at)
              return (
                <div className="fila-historial" key={c.id}>
                  <span className="hist-dia">{dia.getDate()}/{dia.getMonth() + 1}</span>
                  <span className="hist-emoji">{ch?.emoji || '✅'}</span>
                  <div className="crece">
                    <div>{flex(ch?.title, genero) || 'Misión'}</div>
                    {c.praise && <p className="hist-elogio">“{c.praise}”</p>}
                  </div>
                  <span className="suave" style={{ fontSize: '0.8rem' }}>+{c.xp}</span>
                </div>
              )
            })}
          </>
        )}
      </div>

      <Poderes data={data} profile={profile} refresh={refresh} genero={genero} />

      <div className="titulo-seccion">Insignias · {mias.size} de {INSIGNIAS.length}</div>
      <div className="grid-insignias">
        {INSIGNIAS.map((b) => (
          <div className={'insignia' + (mias.has(b.code) ? '' : ' bloqueada')} key={b.code}>
            <span className="ins-emoji">{b.emoji}</span>
            <span className="ins-nombre">{flex(b.name, genero)}</span>
            <div className="suave" style={{ fontSize: '0.72rem', marginTop: 2 }}>{b.desc}</div>
            {/* Qué DA, no solo qué reconoce: una insignia que hace algo se
                busca, y para buscarla hay que poder leer qué hace desde
                antes de tenerla. */}
            {b.poder && PODERES_LISTOS.has(b.poder.tipo) && (
              <span className="ins-poder">{PODERES[b.poder.tipo].nombre}: {PODERES[b.poder.tipo].describe(b.poder)}</span>
            )}
          </div>
        ))}
      </div>

      {/* Va detrás de las insignias a propósito: el último fragmento
          explica por qué esas no se compran, y esa frase solo significa
          algo cuando ya tienes la rejilla de arriba delante. */}
      <Cronica profile={profile} progreso={progresoTalis} />
    </div>
  )
}
