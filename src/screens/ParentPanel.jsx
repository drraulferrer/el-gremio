import { useState } from 'react'
import { supabase, canDo, dayKey, goalProgress, ROLE_LABEL, FREQ_LABEL, mensajeDeError } from '../lib/supabase'
import { CATALOGO, DEFAULTS_ROL, RECOMENDADAS } from '../lib/tareas'
import {
  resolverMision as resolverMisionRemota,
  resolverCanje as resolverCanjeRemoto,
  estrellaInmediata,
  deshacerMision
} from '../lib/acciones'
import { perfilesActivos } from '../lib/miembros'
import { avisoDeCarga } from '../lib/economia'
import { premioAMano } from '../lib/acciones'
import { revisarPremioManual, avisoDeCantidad, MAXIMO_MANUAL } from '../lib/premioManual'
import { MONEDAS_POR_ESTRELLA, TECHO_PEQUE } from '../lib/premios'
import { SUBIDA_POR_TEMPORADA, precioSiguienteTemporada, premiosQueSuben } from '../lib/temporadas'
import { quienMasAporta } from '../lib/meritos'
import { habilidad, HABILIDADES } from '../lib/habilidades'
import { sugerenciasDeElogio, rachaDeMision, sugerenciasDeCorreccion, correccionValida } from '../lib/elogio'
import { flex, generoDe } from '../lib/genero'
import { Modal, Celebracion, Pestana } from '../components/ui'
import Icono from '../components/Icono'
import Ajustes from './Ajustes'
import Cuadro from './Cuadro'
import {
  misionesDe,
  destinoDe,
  destinoA,
  rolesDe,
  textoDestino,
  ETIQUETA_ROL,
  GRUPOS_ROL,
  agruparPorFrecuencia
} from '../lib/misiones'
import SelectorEmoji from '../components/SelectorEmoji'
import { emojiSugerido } from '../lib/emojis'

export default function ParentPanel({ family, data, refresh, refreshFamily, onVerTutorial, onExit }) {
  const [tab, setTab] = useState('pendientes')
  const [celeb, setCeleb] = useState(null)
  const [aviso, setAviso] = useState('')

  const perfilDe = (id) => data.profiles.find((p) => p.id === id)
  const retoDe = (id) => data.challenges.find((ch) => ch.id === id)
  const premioDe = (id) => data.rewards.find((r) => r.id === id)

  const pendientes = data.completions.filter((c) => c.status === 'pendiente')
  const canjes = data.redemptions.filter((r) => r.status === 'pendiente')
  const numPendientes = pendientes.length + canjes.length

  // Lo aprobado hoy, para poder deshacer un toque equivocado sin entrar
  // en la base de datos. Se limita al día en curso a propósito: deshacer
  // lo de la semana pasada ya no es corregir un error, es reescribir.
  const hoy = dayKey(new Date())
  const hechasHoy = data.completions
    .filter((c) => c.status === 'aprobado' && c.resolved_at && dayKey(new Date(c.resolved_at)) === hoy)
    .sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at))

  // Lo devuelto hoy. Faltaba: al pulsar «Todavía no» la misión salía de la
  // lista de pendientes y desaparecía de la vista del adulto, así que
  // quien devolvía no tenía dónde comprobar qué había pedido ni con qué
  // palabras. Media conversación de la tarde depende de poder releer eso.
  const devueltasHoy = data.completions
    .filter((c) => c.status === 'rechazado' && c.resolved_at && dayKey(new Date(c.resolved_at)) === hoy)
    .sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at))

  async function deshacer(id) {
    setAviso('')
    const { ok, mensaje } = await deshacerMision(id)
    if (ok) await refresh()
    else setAviso(mensaje || 'No se pudo deshacer.')
  }

  async function resolverMision(id, estado, elogio = '') {
    setAviso('')
    const { ok, mensaje } = await resolverMisionRemota(id, estado, elogio)
    if (ok) await refresh()
    // Puede salir bien y traer aviso: es el caso de la base sin migrar,
    // donde la misión se valida pero el elogio se queda por el camino.
    if (mensaje) setAviso(mensaje)
    else if (!ok) setAviso('No se pudo validar la misión.')
  }

  async function resolverCanje(id, estado) {
    setAviso('')
    const { ok, mensaje } = await resolverCanjeRemoto(id, estado)
    if (ok) await refresh()
    else setAviso(mensaje || 'No se pudo resolver el canje.')
  }

  return (
    <div className="app">
      {celeb && <Celebracion emoji={celeb.emoji} texto={celeb.texto} onDone={() => setCeleb(null)} />}

      <div className="fila-separada" style={{ marginBottom: 12 }}>
        <h2 className="titulo-panel">
          <Icono nombre="candado" tamano={20} /> Panel parental
        </h2>
        <div className="fila">
          <button
            className={'btn-icono' + (tab === 'ajustes' ? ' activo' : '')}
            aria-label="Miembros y ajustes"
            title="Miembros y ajustes"
            onClick={() => setTab(tab === 'ajustes' ? 'pendientes' : 'ajustes')}
          >
            <Icono nombre="ajustes" />
          </button>
          <button className="btn btn-fantasma btn-mini" onClick={onExit}>
            <Icono nombre="salir" tamano={18} /> Salir
          </button>
        </div>
      </div>

      {aviso && <p className="error-texto" role="alert" style={{ margin: '0 4px 10px' }}>{aviso}</p>}

      {tab === 'pendientes' && (
        <div>
          <div className="titulo-seccion">Misiones por validar</div>
          {pendientes.length === 0 && <div className="vacio">Nada por validar. Todo al día.</div>}
          {pendientes.map((c) => (
            <TarjetaValidacion
              key={c.id}
              completion={c}
              perfil={perfilDe(c.profile_id)}
              reto={retoDe(c.challenge_id)}
              completions={data.completions}
              onResolver={resolverMision}
            />
          ))}

          <div className="titulo-seccion">Canjes por entregar</div>
          {canjes.length === 0 && <div className="vacio">Ningún premio en camino.</div>}
          {canjes.map((r) => {
            const p = perfilDe(r.profile_id)
            const rw = premioDe(r.reward_id)
            return (
              <div className="carta" key={r.id}>
                <div className="fila" style={{ marginBottom: 10 }}>
                  <div className="avatar" style={{ borderColor: p?.color }}>{p?.emoji}</div>
                  <div className="crece">
                    <strong>{rw?.emoji} {rw?.title || 'Premio'}</strong>
                    <div className="suave">{p?.name} · {r.cost} 🪙</div>
                  </div>
                </div>
                <div className="fila">
                  <button className="btn btn-exito btn-mini crece" onClick={() => resolverCanje(r.id, 'entregado')}>
                    <Icono nombre="premio" tamano={19} /> Entregado
                  </button>
                  <button className="btn btn-fantasma btn-mini" onClick={() => resolverCanje(r.id, 'cancelado')}>Devolver 🪙</button>
                </div>
              </div>
            )
          })}
          <div className="titulo-seccion">Hecho hoy · se puede deshacer</div>
          {hechasHoy.length === 0 && <div className="vacio">Todavía no hay nada conseguido hoy.</div>}
          {hechasHoy.map((c) => {
            const p = perfilDe(c.profile_id)
            const ch = retoDe(c.challenge_id)
            return (
              <div className="carta" key={c.id}>
                <div className="fila">
                  <div className="avatar" style={{ borderColor: p?.color }}>{p?.emoji}</div>
                  <div className="crece">
                    <strong>{ch?.emoji} {flex(ch?.title, generoDe(p)) || 'Misión'}</strong>
                    <div className="suave">{p?.name} · +{c.xp} XP · +{c.coins} 🪙</div>
                  </div>
                  <button
                    className="btn btn-fantasma btn-mini"
                    onClick={() => deshacer(c.id)}
                    aria-label={`Deshacer ${flex(ch?.title, generoDe(p)) || 'la misión'} de ${p?.name || ''}`}
                  >
                    <Icono nombre="atras" tamano={18} /> Deshacer
                  </button>
                </div>
                {c.praise && <p className="elogio-recibido">“{c.praise}”</p>}
              </div>
            )
          })}

          {devueltasHoy.length > 0 && (
            <>
              <div className="titulo-seccion">Devuelto hoy</div>
              {devueltasHoy.map((c) => {
                const p = perfilDe(c.profile_id)
                const ch = retoDe(c.challenge_id)
                return (
                  <div className="carta carta-correccion" key={c.id}>
                    <div className="fila">
                      <div className="avatar" style={{ borderColor: p?.color }}>{p?.emoji}</div>
                      <div className="crece">
                        <strong>{ch?.emoji} {flex(ch?.title, generoDe(p)) || 'Misión'}</strong>
                        <div className="suave">{p?.name} · la puede volver a enviar</div>
                      </div>
                      {/* Quitar la devolución borra la petición entera: la
                          misión sigue disponible y desaparece el aviso rojo
                          de su tablero. Es el «me he equivocado», no un
                          segundo veredicto. */}
                      <button
                        className="btn btn-fantasma btn-mini"
                        onClick={() => deshacer(c.id)}
                        aria-label={`Quitar la devolución de ${flex(ch?.title, generoDe(p)) || 'la misión'}`}
                      >
                        <Icono nombre="atras" tamano={18} /> Quitar
                      </button>
                    </div>
                    {c.praise && <p className="texto-correccion">{c.praise}</p>}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {tab === 'cuadro' && <Cuadro data={data} />}
      {tab === 'peque' && <ModoPeque family={family} data={data} refresh={refresh} onCeleb={setCeleb} />}
      {tab === 'misiones' && <GestionMisiones family={family} data={data} refresh={refresh} />}
      {tab === 'premios' && <GestionPremios family={family} data={data} refresh={refresh} />}
      {tab === 'meta' && <GestionMeta family={family} data={data} refresh={refresh} />}
      {tab === 'ajustes' && (
        <Ajustes
          family={family}
          data={data}
          refresh={refresh}
          refreshFamily={refreshFamily}
          onVerTutorial={onVerTutorial}
        />
      )}

      <nav className="tabbar" aria-label="Secciones del panel">
        <Pestana
          icono="validar"
          etiqueta="Validar"
          aviso={numPendientes}
          activa={tab === 'pendientes'}
          onClick={() => setTab('pendientes')}
        />
        <Pestana icono="cuadro" etiqueta="Cuadro" activa={tab === 'cuadro'} onClick={() => setTab('cuadro')} />
        <Pestana icono="estrella" etiqueta="Peque" activa={tab === 'peque'} onClick={() => setTab('peque')} />
        <Pestana icono="misiones" etiqueta="Misiones" activa={tab === 'misiones'} onClick={() => setTab('misiones')} />
        <Pestana icono="premio" etiqueta="Premios" activa={tab === 'premios'} onClick={() => setTab('premios')} />
        <Pestana icono="meta" etiqueta="Meta" activa={tab === 'meta'} onClick={() => setTab('meta')} />
      </nav>
    </div>
  )
}

// --------------------------------------------------------------
// Validación con elogio específico
//
// El elogio es el componente con más respaldo del sistema (Leijten 2019;
// Owen 2012), pero solo si es concreto. El riesgo evidente era añadir
// fricción: si validar pasa de un toque a rellenar un formulario, se
// deja de validar y se acabó el sistema.
//
// Solución: cada sugerencia ES el botón de validar. Tocarla aprueba la
// misión con ese elogio. Sigue siendo un toque, y el camino fácil pasa a
// ser el que dice algo en lugar del que no dice nada.
// --------------------------------------------------------------

function TarjetaValidacion({ completion, perfil, reto, completions, onResolver }) {
  const [escribiendo, setEscribiendo] = useState(false)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  // Rechazar abre su propio bloque en vez de resolver de un toque: no
  // validar SIN decir por qué es exactamente lo que enseña que el adulto
  // es impredecible.
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')

  const genero = generoDe(perfil)
  const racha = rachaDeMision(completion.challenge_id, completion.profile_id, completions)
  // El elogio va dirigido a esa persona, así que concuerda con su género.
  const sugerencias = sugerenciasDeElogio({ reto, racha }).map((f) => flex(f, genero))
  const hab = habilidad(reto?.skill)

  async function validar(elogio) {
    setOcupado(true)
    await onResolver(completion.id, 'aprobado', elogio)
    setOcupado(false)
  }

  async function noValidar(razon) {
    if (!correccionValida(razon)) return
    setOcupado(true)
    await onResolver(completion.id, 'rechazado', razon)
    setOcupado(false)
  }

  return (
    <div className="carta">
      <div className="fila" style={{ marginBottom: 10 }}>
        <div className="avatar" style={{ borderColor: perfil?.color }}>{perfil?.emoji}</div>
        <div className="crece">
          <strong>{reto?.emoji} {flex(reto?.title, genero) || 'Misión'}</strong>
          <div className="suave">
            {perfil?.name} · +{completion.xp} XP · +{completion.coins} 🪙
            {racha >= 2 && <> · 🔥 {racha + 1} días seguidos</>}
          </div>
        </div>
        {hab && (
          <span className="chip-habilidad" style={{ borderColor: hab.color, color: hab.color }}>
            {hab.emoji} {hab.nombre}
          </span>
        )}
      </div>

      <div className="titulo-elogio">Valida diciéndole qué ha hecho bien</div>

      <div className="elogios">
        {sugerencias.map((frase) => (
          <button key={frase} className="elogio" disabled={ocupado} onClick={() => validar(frase)}>
            {frase}
          </button>
        ))}
        <button className="elogio elogio-propio" disabled={ocupado} onClick={() => setEscribiendo(!escribiendo)}>
          <Icono nombre="editar" tamano={16} /> Escribir otro
        </button>
      </div>

      {escribiendo && (
        <div className="campo" style={{ marginTop: 10 }}>
          <label>Tu elogio</label>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={240}
            autoFocus
            placeholder="Has…"
            onKeyDown={(e) => { if (e.key === 'Enter' && texto.trim()) validar(texto) }}
          />
          <button className="btn btn-exito btn-mini" disabled={!texto.trim() || ocupado} onClick={() => validar(texto)}>
            <Icono nombre="validar" tamano={18} /> Validar con este elogio
          </button>
        </div>
      )}

      <div className="fila" style={{ marginTop: 10 }}>
        <button className="btn btn-fantasma btn-mini crece" disabled={ocupado} onClick={() => validar('')}>
          Validar sin elogio
        </button>
        <button
          className="btn btn-peligro btn-mini"
          disabled={ocupado}
          onClick={() => setRechazando(!rechazando)}
          aria-expanded={rechazando}
          aria-label={`Todavía no: ${flex(reto?.title, genero) || 'la misión'} de ${perfil?.name || ''}`}
          title="Todavía no: dile qué falta"
        >
          <Icono nombre="cerrar" tamano={19} /> Todavía no
        </button>
      </div>

      {rechazando && (
        <div className="bloque-correccion">
          <div className="titulo-correccion">Dile qué falta. Lo verá en su tablero y podrá volver a intentarlo.</div>
          <div className="elogios">
            {sugerenciasDeCorreccion({ reto }).map((frase) => (
              <button key={frase} className="correccion" disabled={ocupado} onClick={() => noValidar(frase)}>
                {frase}
              </button>
            ))}
          </div>
          <div className="campo" style={{ marginTop: 8 }}>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={240}
              placeholder="O escríbelo tú: qué falta exactamente"
              onKeyDown={(e) => { if (e.key === 'Enter') noValidar(motivo) }}
            />
            <button
              className="btn btn-peligro btn-mini"
              disabled={!correccionValida(motivo) || ocupado}
              onClick={() => noValidar(motivo)}
            >
              Enviar sin validar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------
// Modo peque: estrella inmediata, sin espera de validación
// --------------------------------------------------------------

function ModoPeque({ family, data, refresh, onCeleb }) {
  const peques = perfilesActivos(data.profiles).filter((p) => p.role === 'peque')
  const [ocupado, setOcupado] = useState(null)
  const [fallo, setFallo] = useState('')
  // Editar desde aquí y no solo desde la pestaña Misiones: este es el sitio
  // donde de verdad se usan sus misiones, y por tanto donde se ve que una
  // está mal escrita o vale demasiado poco.
  const [editando, setEditando] = useState(null)

  async function guardar(m) {
    const fila = {
      title: m.title.trim(),
      emoji: m.emoji,
      xp: Number(m.xp) || 0,
      coins: Number(m.coins) || 0,
      frequency: m.frequency,
      skill: m.skill || null,
      profile_id: m.profile_id || null,
      target_roles: m.target_roles || null,
      active: m.active
    }
    const { error } = m.id
      ? await supabase.from('challenges').update(fila).eq('id', m.id)
      : await supabase.from('challenges').insert({ ...fila, family_id: family.id })
    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    setEditando(null)
    await refresh()
  }

  async function borrar(m) {
    if (!window.confirm(`¿Borrar "${flex(m.title, 'neutro')}" y su historial?`)) return
    const { error } = await supabase.from('challenges').delete().eq('id', m.id)
    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    setEditando(null)
    await refresh()
  }

  async function darEstrella(reto, perfil) {
    setOcupado(reto.id)
    setFallo('')
    const { ok, mensaje } = await estrellaInmediata({ family, profile: perfil, reto })
    if (ok) {
      onCeleb({ emoji: '⭐', texto: `¡Estrella para ${perfil.name}!` })
      await refresh()
    } else {
      setFallo(mensaje || 'No se pudo dar la estrella.')
    }
    setOcupado(null)
  }

  // Una misión creada desde aquí nace asignada a ESTA peque, no a «Todos»:
  // se está creando dentro de su sección, y una misión global saldría
  // también en el tablero de los adultos. Cinco monedas es una estrella
  // exacta, que es la unidad en la que ella cuenta: mezclar cantidades que
  // no son múltiplos deja el tarro en «dos estrellas y pico».
  const misionNueva = (p) => ({
    ...MISION_VACIA,
    coins: MONEDAS_POR_ESTRELLA,
    profile_id: p.id,
    skill: 'autonomia'
  })

  if (peques.length === 0) {
    return <div className="vacio">No hay perfiles "peque". Este modo da la estrella y los puntos al momento, sin paso de validación.</div>
  }

  return (
    <div>
      <p className="suave" style={{ margin: '0 4px 10px' }}>
        Mismo efecto que su pantalla: la estrella y los puntos caen al momento. Útil cuando la tablet no está a
        mano. El lápiz de al lado edita la misión —título, dibujo, puntos y frecuencia— y el botón del final de
        cada lista crea una nueva, ya asignada a quien corresponde.
      </p>
      {fallo && <p className="error-texto" role="alert">{fallo}</p>}
      {peques.map((p) => {
        // Con las pausadas incluidas: si se ocultaran, pausar una desde
        // aquí la haría desaparecer de la única pantalla desde la que se
        // puede volver a activar.
        const retos = misionesDe(p, data.challenges, { incluirPausadas: true })
        return (
          <div key={p.id}>
            <div className="titulo-seccion">{p.emoji} {p.name}</div>
            {retos.length === 0 && <div className="vacio">Sin misiones todavía. Créale la primera aquí abajo.</div>}
            {retos.map((ch) => {
              const disponible = canDo(ch, data.completions, p.id)
              return (
                <div className="fila" key={ch.id} style={{ marginBottom: 10, opacity: ch.active ? 1 : 0.5 }}>
                  <button
                    className="boton-peque crece"
                    style={{ marginBottom: 0 }}
                    disabled={!ch.active || !disponible || ocupado === ch.id}
                    onClick={() => darEstrella(ch, p)}
                  >
                    <span className="peque-emoji">{ch.emoji}</span>
                    <span className="crece" style={{ textAlign: 'left' }}>{flex(ch.title, generoDe(p))}</span>
                    <span>{!ch.active ? '⏸' : disponible ? '⭐' : '✓'}</span>
                  </button>
                  <button
                    className="btn-icono"
                    onClick={() => setEditando(ch)}
                    aria-label={`Editar ${flex(ch.title, generoDe(p))}`}
                    title="Editar esta misión"
                  >
                    <Icono nombre="editar" />
                  </button>
                </div>
              )
            })}
            <button
              className="btn btn-fantasma btn-mini"
              style={{ width: '100%', marginBottom: 18 }}
              onClick={() => setEditando(misionNueva(p))}
            >
              + Nueva misión para {p.name}
            </button>
          </div>
        )
      })}

      {editando && (
        <FormMision
          mision={editando}
          perfiles={perfilesActivos(data.profiles)}
          onGuardar={guardar}
          onBorrar={editando.id ? borrar : null}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}

// --------------------------------------------------------------
// Gestión de misiones
// --------------------------------------------------------------

const MISION_VACIA = { title: '', emoji: '⭐', xp: 10, coins: 5, frequency: 'diario', profile_id: null, target_roles: null, skill: 'responsabilidad', active: true }

function GestionMisiones({ family, data, refresh }) {
  const [editando, setEditando] = useState(null) // null | objeto misión
  const [plantillas, setPlantillas] = useState(false)
  const [fallo, setFallo] = useState('')
  // El destino, tal y como se lee en la lista. Sin el caso del rol, una
  // misión de «cualquier adulto» se anunciaba como «Todos», que es
  // justo lo que no es.
  const destinoTexto = (ch) =>
    textoDestino(ch, (id) => data.profiles.find((p) => p.id === id)?.name)

  async function guardar(m) {
    const fila = {
      family_id: family.id,
      title: m.title.trim(),
      emoji: m.emoji,
      xp: Number(m.xp) || 0,
      coins: Number(m.coins) || 0,
      frequency: m.frequency,
      profile_id: m.profile_id || null,
      target_roles: m.target_roles || null,
      skill: m.skill || null,
      active: m.active
    }
    const { error } = m.id
      ? await supabase.from('challenges').update(fila).eq('id', m.id)
      : await supabase.from('challenges').insert(fila)
    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    setFallo('')
    setEditando(null)
    await refresh()
  }

  async function borrar(m) {
    if (!window.confirm(`¿Borrar "${m.title}" y su historial?`)) return
    const { error } = await supabase.from('challenges').delete().eq('id', m.id)
    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    setEditando(null)
    await refresh()
  }

  async function alternar(m) {
    const { error } = await supabase.from('challenges').update({ active: !m.active }).eq('id', m.id)
    if (error) setFallo(mensajeDeError(error))
    else await refresh()
  }

  // Un aviso por persona que se pase del presupuesto de la economía. Se
  // calcula sobre lo ACTIVO, que es lo que de verdad genera puntos, y solo
  // aparece cuando hay algo que decir: un aviso permanente deja de leerse
  // a la semana.
  // Agrupado por persona y, dentro, por frecuencia. Una lista de 43
  // misiones seguidas no se puede organizar: para saber qué tiene la
  // junior había que leerlas todas comprobando el destino de cada una.
  // El orden de los bloques es el de urgencia, igual que en el tablero.
  const grupos = (() => {
    const gente = perfilesActivos(data.profiles)
    const salida = gente.map((p) => ({
      clave: p.id,
      titulo: `${p.emoji} ${p.name}`,
      misiones: misionesDe(p, data.challenges, { incluirPausadas: true })
    }))
    // Las que no le tocan a nadie activo no pueden quedarse sin sitio: se
    // perderían de vista y seguirían contando en la economía.
    const asignadas = new Set(salida.flatMap((g) => g.misiones.map((m) => m.id)))
    const huerfanas = data.challenges.filter((c) => !asignadas.has(c.id))
    if (huerfanas.length) {
      salida.push({ clave: 'sin-destino', titulo: '— Sin nadie a quien le toque', misiones: huerfanas })
    }
    return salida
      .filter((g) => g.misiones.length)
      .map((g) => ({ ...g, bloques: agruparPorFrecuencia(g.misiones) }))
  })()

  const avisos = perfilesActivos(data.profiles)
    .map((p) => avisoDeCarga(misionesDe(p, data.challenges), p.name))
    .filter(Boolean)

  return (
    <div>
      {fallo && <p className="error-texto" role="alert">{fallo}</p>}
      {avisos.map((a, i) => (
        <p className="aviso-carga" key={i} role="status">⚖️ {a.texto}</p>
      ))}
      <div className="fila" style={{ marginBottom: 12 }}>
        <button className="btn btn-mini crece" onClick={() => setEditando({ ...MISION_VACIA })}>+ Nueva misión</button>
        <button className="btn btn-fantasma btn-mini" onClick={() => setPlantillas(true)}>📚 Biblioteca</button>
      </div>

      {data.challenges.length === 0 && <div className="vacio">Todavía no hay misiones. Crea una o activa varias desde la biblioteca.</div>}

      {grupos.map((g) => (
        <section key={g.clave}>
          <div className="titulo-seccion">{g.titulo}</div>
          {g.bloques.map((b) => (
            <div key={b.frecuencia}>
              <h4 className="titulo-frecuencia">
                {b.titulo}
                <span className="cuenta-frecuencia">{b.misiones.length}</span>
              </h4>
              {b.misiones.map((ch) => (
        <div className="carta" key={ch.id} style={{ opacity: ch.active ? 1 : 0.5 }}>
          <div className="fila">
            <div className="avatar">{ch.emoji}</div>
            <div className="crece">
              <strong>{flex(ch.title, generoDe(data.profiles.find((p) => p.id === ch.profile_id)))}</strong>
              <div className="suave">
                {habilidad(ch.skill) && <>{habilidad(ch.skill).emoji} {habilidad(ch.skill).nombre} · </>}
                +{ch.xp} XP · {ch.coins} 🪙
              </div>
            </div>
            <button className="btn-icono" onClick={() => alternar(ch)} aria-label={ch.active ? 'Pausar' : 'Activar'}>
              <Icono nombre={ch.active ? 'pausar' : 'reanudar'} />
            </button>
            <button className="btn-icono" onClick={() => setEditando(ch)} aria-label={`Editar ${ch.title}`}>
              <Icono nombre="editar" />
            </button>
          </div>
        </div>
              ))}
            </div>
          ))}
        </section>
      ))}

      {editando && (
        <FormMision
          mision={editando}
          perfiles={perfilesActivos(data.profiles)}
          onGuardar={guardar}
          onBorrar={editando.id ? borrar : null}
          onClose={() => setEditando(null)}
        />
      )}

      {plantillas && (
        <Biblioteca family={family} data={data} refresh={refresh} onClose={() => setPlantillas(false)} />
      )}
    </div>
  )
}

function FormMision({ mision, perfiles, onGuardar, onBorrar, onClose }) {
  const [m, setM] = useState({ ...mision })
  const set = (cambios) => setM({ ...m, ...cambios })

  // Solo se ofrecen los roles que tienen gente: «cualquier junior» en un
  // gremio sin junior es una opción que no hace nada.
  const rolesPresentes = [...new Set(perfiles.map((p) => p.role))].filter((r) => ETIQUETA_ROL[r])

  // Un grupo solo se ofrece si TODOS sus roles tienen gente. «Los peques y
  // la junior» en un gremio sin junior sería una etiqueta que miente sobre
  // a quién le va a salir la misión.
  const gruposPresentes = GRUPOS_ROL.filter((g) => g.roles.every((r) => rolesPresentes.includes(r)))

  return (
    <Modal titulo={m.id ? 'Editar misión' : 'Nueva misión'} onClose={onClose}>
      <div className="campo">
        <label>Título</label>
        <input value={m.title} onChange={(e) => set({ title: e.target.value })} autoFocus />
      </div>
      <div className="campo">
        <label>Emoji</label>
        <div className="grid-emojis">
          {['⭐', '🧸', '🪥', '📚', '✏️', '🎒', '🧹', '🍽️', '🏃', '📵', '📖', '🗓️', '🐶', '🧺', '🛏️', '🎻'].map((e) => (
            <button key={e} className={m.emoji === e ? 'sel' : ''} onClick={() => set({ emoji: e })}>{e}</button>
          ))}
        </div>
      </div>
      <div className="fila">
        <div className="campo crece">
          <label>XP</label>
          <input type="number" min="0" value={m.xp} onChange={(e) => set({ xp: e.target.value })} />
        </div>
        <div className="campo crece">
          <label>Monedas 🪙</label>
          <input type="number" min="0" value={m.coins} onChange={(e) => set({ coins: e.target.value })} />
        </div>
      </div>
      <div className="campo">
        <label>Habilidad que entrena</label>
        <div className="grid-habilidades">
          {HABILIDADES.map((h) => (
            <button
              key={h.id}
              type="button"
              className={'pastilla-habilidad' + (m.skill === h.id ? ' sel' : '')}
              style={m.skill === h.id ? { borderColor: h.color, color: h.color } : undefined}
              onClick={() => set({ skill: h.id })}
            >
              <span>{h.emoji}</span> {h.nombre}
            </button>
          ))}
        </div>
        <span className="suave">{habilidad(m.skill)?.lema}</span>
      </div>

      <div className="campo">
        <label>Frecuencia</label>
        <select value={m.frequency} onChange={(e) => set({ frequency: e.target.value })}>
          <option value="diario">Diaria</option>
          <option value="semanal">Semanal</option>
          <option value="mensual">Mensual</option>
          <option value="unico">Única</option>
        </select>
      </div>
      <div className="campo">
        <label>Para</label>
        <select value={destinoDe(m)} onChange={(e) => set(destinoA(e.target.value))}>
          <option value="">Todo el gremio</option>
          {gruposPresentes.map((g) => (
            <option key={g.id} value={`grupo:${g.id}`}>{g.etiqueta}</option>
          ))}
          {rolesPresentes.map((r) => (
            <option key={r} value={`rol:${r}`}>{ETIQUETA_ROL[r]}</option>
          ))}
          {perfiles.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
        </select>
        <span className="suave">
          {rolesDe(m)
            ? 'Una sola misión: la hace cada quien por su cuenta, sin duplicarla ni quitársela a nadie.'
            : m.profile_id
              ? 'Solo esta persona la ve en su tablero.'
              : 'La ven todos, la peque incluida.'}
        </span>
      </div>
      {/* Pausar en vez de borrar. Borrar arrastra en cascada el historial
          —XP ya aportada a metas cerradas incluida—, y casi siempre lo que
          se quiere es que deje de salir, no que nunca hubiera existido.
          Vive en el formulario y no solo en la lista de Misiones porque
          desde la pestaña Peque no había forma de llegar. */}
      <div className="campo">
        <label>Estado</label>
        <div className="fila">
          <button
            className={'btn btn-mini crece' + (m.active ? '' : ' btn-fantasma')}
            aria-pressed={m.active}
            onClick={() => set({ active: true })}
          >
            Activa
          </button>
          <button
            className={'btn btn-mini crece' + (m.active ? ' btn-fantasma' : '')}
            aria-pressed={!m.active}
            onClick={() => set({ active: false })}
          >
            En pausa
          </button>
        </div>
        <span className="suave">
          {m.active
            ? 'Sale en el tablero de quien le toque.'
            : 'No sale en ningún tablero. El historial que ya tenga se conserva.'}
        </span>
      </div>

      <button className="btn btn-bloque" disabled={!m.title.trim()} onClick={() => onGuardar(m)}>Guardar</button>
      {onBorrar && (
        <button className="btn btn-peligro btn-bloque" style={{ marginTop: 10 }} onClick={() => onBorrar(m)}>Borrar misión</button>
      )}
    </Modal>
  )
}

// --------------------------------------------------------------
// Biblioteca: hábitos y tareas de la casa, filtradas por rol.
// El catálogo no tiene puntos; se asignan al activar cada misión
// para un perfil concreto (defaults por rol, editables después).
// --------------------------------------------------------------

function Biblioteca({ family, data, refresh, onClose }) {
  const candidatos = perfilesActivos(data.profiles)
  const [perfilId, setPerfilId] = useState(candidatos[0]?.id || '')
  const [sel, setSel] = useState(() => new Set())
  const [activando, setActivando] = useState(false)
  const [fallo, setFallo] = useState('')

  const perfil = candidatos.find((p) => p.id === perfilId)
  const yaActivas = new Set(misionesDe(perfil, data.challenges).map((ch) => ch.title))

  const grupos = perfil ? CATALOGO[perfil.role] || [] : []

  function alternarSel(titulo) {
    const s = new Set(sel)
    if (s.has(titulo)) s.delete(titulo)
    else s.add(titulo)
    setSel(s)
  }

  async function activar() {
    if (!perfil || sel.size === 0) return
    setActivando(true)
    const defaults = DEFAULTS_ROL[perfil.role]
    const filas = []
    for (const g of grupos) {
      for (const tt of g.tareas) {
        if (!sel.has(tt.t) || yaActivas.has(tt.t)) continue
        filas.push({
          family_id: family.id,
          profile_id: perfil.id,
          title: tt.t,
          emoji: tt.e,
          xp: defaults.xp,
          coins: defaults.coins,
          frequency: tt.f,
          skill: tt.skill
        })
      }
    }
    if (filas.length) {
      const { error } = await supabase.from('challenges').insert(filas)
      if (error) {
        setFallo(mensajeDeError(error))
        setActivando(false)
        return
      }
    }
    setActivando(false)
    onClose()
    await refresh()
  }

  return (
    <Modal titulo="📚 Biblioteca" onClose={onClose}>
      <div className="campo">
        <label>Para</label>
        <select value={perfilId} onChange={(e) => { setPerfilId(e.target.value); setSel(new Set()) }}>
          {candidatos.map((p) => (
            <option key={p.id} value={p.id}>{p.emoji} {p.name} · {flex(ROLE_LABEL[p.role], generoDe(p))}</option>
          ))}
        </select>
      </div>
      <p className="suave" style={{ marginTop: 0 }}>
        Activa pocas a la vez, de {RECOMENDADAS.min} a {RECOMENDADAS.max} por persona, y de habilidades distintas.
        Un tablón entero deja de ser un juego, y todo de la misma habilidad hace que el progreso se vea plano.
      </p>

      {grupos.map((g) => (
        <div key={g.grupo}>
          <div className="titulo-seccion">{g.grupo}</div>
          {g.tareas.map((tt) => {
            const activa = yaActivas.has(tt.t)
            return (
              <label
                key={tt.t}
                className="fila"
                style={{ padding: '9px 4px', opacity: activa ? 0.45 : 1, cursor: activa ? 'default' : 'pointer' }}
              >
                <input
                  type="checkbox"
                  style={{ width: 22, height: 22, flex: 'none' }}
                  disabled={activa}
                  checked={activa || sel.has(tt.t)}
                  onChange={() => alternarSel(tt.t)}
                />
                <span style={{ fontSize: '1.2rem' }}>{tt.e}</span>
                <span className="crece">
                  {flex(tt.t, generoDe(perfil))}
                  {habilidad(tt.skill) && (
                    <span className="suave" style={{ display: 'block', fontSize: '0.76rem' }}>
                      {habilidad(tt.skill).emoji} {habilidad(tt.skill).nombre}
                    </span>
                  )}
                </span>
                <span className="chip">{activa ? 'ya activa' : FREQ_LABEL[tt.f]}</span>
              </label>
            )
          })}
        </div>
      ))}

      {fallo && <p className="error-texto" role="alert">{fallo}</p>}
      <button className="btn btn-bloque" style={{ marginTop: 12 }} disabled={sel.size === 0 || activando} onClick={activar}>
        {activando ? 'Activando…' : `Activar ${sel.size} ${sel.size === 1 ? 'misión' : 'misiones'}`}
      </button>
    </Modal>
  )
}

const PREMIO_VACIO = { title: '', emoji: '🎁', cost: 50, active: true }

function GestionPremios({ family, data, refresh }) {
  const [editando, setEditando] = useState(null)
  const [fallo, setFallo] = useState('')
  const [aMano, setAMano] = useState(false)

  async function guardar(r) {
    const fila = {
      family_id: family.id,
      title: r.title.trim(),
      emoji: r.emoji,
      cost: Number(r.cost) || 0,
      active: r.active
    }
    const { error } = r.id
      ? await supabase.from('rewards').update(fila).eq('id', r.id)
      : await supabase.from('rewards').insert(fila)
    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    setFallo('')
    setEditando(null)
    await refresh()
  }

  async function borrar(r) {
    if (!window.confirm(`¿Borrar el premio "${r.title}"?`)) return
    const { error } = await supabase.from('rewards').delete().eq('id', r.id)
    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    setEditando(null)
    await refresh()
  }

  async function alternar(r) {
    const { error } = await supabase.from('rewards').update({ active: !r.active }).eq('id', r.id)
    if (error) setFallo(mensajeDeError(error))
    else await refresh()
  }

  return (
    <div>
      {fallo && <p className="error-texto" role="alert">{fallo}</p>}
      <div className="fila" style={{ marginBottom: 12 }}>
        <button className="btn btn-mini crece" onClick={() => setEditando({ ...PREMIO_VACIO })}>
          + Nuevo premio
        </button>
        {/* Va aquí y no en una pestaña propia: quien entra a Premios es
            quien está pensando en recompensas, y esto es la recompensa que
            no cabía en el catálogo. Una pestaña más para algo que se usa
            una vez al mes sería una pestaña que nadie abre. */}
        <button className="btn btn-fantasma btn-mini crece" onClick={() => setAMano(!aMano)}>
          🪙 Monedas a mano
        </button>
      </div>

      {aMano && (
        <PremioAMano
          data={data}
          onCerrar={() => setAMano(false)}
          onHecho={async () => {
            setAMano(false)
            await refresh()
          }}
        />
      )}

      {data.rewards.length === 0 && (
        <div className="vacio">Sin premios todavía. Funcionan mejor los tangibles: un plan, un privilegio, una salida.</div>
      )}

      {data.rewards.map((r) => (
        <div className="carta" key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
          <div className="fila">
            <div className="avatar">{r.emoji}</div>
            <div className="crece">
              <strong>{r.title}</strong>
              <div className="suave">{r.cost} 🪙</div>
            </div>
            <button className="btn-icono" onClick={() => alternar(r)} aria-label={r.active ? 'Pausar' : 'Activar'}>
              <Icono nombre={r.active ? 'pausar' : 'reanudar'} />
            </button>
            <button className="btn-icono" onClick={() => setEditando(r)} aria-label={`Editar ${r.title}`}>
              <Icono nombre="editar" />
            </button>
          </div>
        </div>
      ))}

      {editando && (
        <Modal titulo={editando.id ? 'Editar premio' : 'Nuevo premio'} onClose={() => setEditando(null)}>
          <FormPremio premio={editando} onGuardar={guardar} onBorrar={editando.id ? borrar : null} />
        </Modal>
      )}
    </div>
  )
}

function FormPremio({ premio, onGuardar, onBorrar }) {
  const [r, setR] = useState({ ...premio })
  // Deja de sugerir en cuanto alguien elige a mano: a partir de ahí manda
  // la persona, aunque siga escribiendo el título.
  const [aMano, setAMano] = useState(Boolean(premio.id))
  const set = (cambios) => setR({ ...r, ...cambios })

  function escribirTitulo(title) {
    set(aMano ? { title } : { title, emoji: emojiSugerido(title, PREMIO_VACIO.emoji) })
  }

  return (
    <div>
      <div className="campo">
        <label htmlFor="premio-titulo">Premio</label>
        <input
          id="premio-titulo"
          value={r.title}
          onChange={(e) => escribirTitulo(e.target.value)}
          placeholder="Elegir peli del viernes"
          autoFocus
        />
      </div>
      <div className="campo">
        <label htmlFor="premio-emoji">Emoji <span className="emoji-elegido">{r.emoji}</span></label>
        <SelectorEmoji
          id="premio-emoji"
          valor={r.emoji}
          onElegir={(e) => { setAMano(true); set({ emoji: e }) }}
        />
      </div>
      <div className="campo">
        <label>Precio en monedas 🪙</label>
        <input type="number" min="1" value={r.cost} onChange={(e) => set({ cost: e.target.value })} />
      </div>
      <button className="btn btn-bloque" disabled={!r.title.trim()} onClick={() => onGuardar(r)}>Guardar</button>
      {onBorrar && (
        <button className="btn btn-peligro btn-bloque" style={{ marginTop: 10 }} onClick={() => onBorrar(r)}>Borrar premio</button>
      )}
    </div>
  )
}

// --------------------------------------------------------------
// Meta cooperativa del gremio
// --------------------------------------------------------------

function GestionMeta({ family, data, refresh }) {
  const goal = data.goal
  const [form, setForm] = useState(goal ? { ...goal } : { title: '', emoji: '🏆', target_xp: 1000 })
  const [fallo, setFallo] = useState('')
  const progreso = goalProgress(goal, data.completions)

  async function guardar() {
    const fila = {
      family_id: family.id,
      title: form.title.trim(),
      emoji: form.emoji,
      target_xp: Number(form.target_xp) || 500
    }
    const { error } = goal
      ? await supabase.from('family_goals').update(fila).eq('id', goal.id)
      : await supabase.from('family_goals').insert(fila)
    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    setFallo('')
    await refresh()
  }

  /**
   * Cerrar la meta es cerrar la TEMPORADA, y eso son tres cosas, no una.
   *
   * Nadie pierde XP ni baja de nivel al cerrarla: la XP personal es
   * acumulativa y no tiene tope. Lo único que vuelve a cero es la barra de
   * la meta, que es otro contador. Ver src/lib/temporadas.js.
   */
  async function conseguida() {
    if (!window.confirm('¿Marcar la meta como conseguida? Todo el gremio recibirá la insignia 🏰.')) return

    const activos = perfilesActivos(data.profiles)
    // Se calcula ANTES de cerrar: al marcarla lograda deja de ser la meta
    // en curso y ya no habría contra qué medir quién aportó más.
    const manoDerecha = quienMasAporta(goal, data.completions, activos)

    const cierre = await supabase
      .from('family_goals')
      .update({ achieved: true, achieved_at: new Date().toISOString() })
      .eq('id', goal.id)
    if (cierre.error) {
      setFallo(mensajeDeError(cierre.error))
      return
    }

    const filas = activos.map((p) => ({ family_id: family.id, profile_id: p.id, code: 'gremio' }))
    const insignias = await supabase
      .from('profile_badges')
      .upsert(filas, { onConflict: 'profile_id,code', ignoreDuplicates: true })
    if (insignias.error) setFallo(mensajeDeError(insignias.error))

    // «Mano derecha» cambia de dueño con cada meta. Primero se retira la
    // anterior y después se pone la nueva, en ese orden: al revés choca
    // con el índice único por gremio de la migración 015.
    if (manoDerecha) {
      await supabase.from('profile_badges').delete().eq('family_id', family.id).eq('code', 'mano_derecha')
      const nueva = await supabase
        .from('profile_badges')
        .insert({ family_id: family.id, profile_id: manoDerecha, code: 'mano_derecha' })
      if (nueva.error) setFallo(mensajeDeError(nueva.error))
    }

    await subirPrecios()
    setForm({ title: '', emoji: '🏆', target_xp: 1000 })
    await refresh()
  }

  /**
   * La subida de precios de la temporada nueva.
   *
   * Se PREGUNTA, no se aplica sola: cambia lo que ve la familia en la
   * tienda de un día para otro, y una tienda que sube sola de precio sin
   * avisar se siente como una trampa aunque el motivo sea bueno.
   *
   * Los premios que están dentro del alcance de la peque quedan fuera de
   * la subida. Ella no va por temporadas ni por niveles, va por distancia:
   * gana lo mismo cada día pase lo que pase, así que subirle el precio no
   * le añade dificultad, le quita el premio.
   */
  async function subirPrecios() {
    const suben = premiosQueSuben(data.rewards, TECHO_PEQUE)
    if (!suben.length) return

    const barato = suben.reduce((a, b) => (a.cost < b.cost ? a : b))
    const subida = Math.round(SUBIDA_POR_TEMPORADA * 100)
    const aviso =
      `Nueva temporada del gremio.\n\n` +
      `¿Subir un ${subida} % el precio de los ${suben.length} premios de la tienda? ` +
      `Es lo que mantiene la dificultad ahora que el gremio produce más.\n\n` +
      `Por ejemplo, "${barato.title}" pasaría de ${barato.cost} a ${precioSiguienteTemporada(barato.cost)} monedas.\n\n` +
      `Los premios de la peque no se tocan.`
    if (!window.confirm(aviso)) return

    for (const r of suben) {
      const { error } = await supabase
        .from('rewards')
        .update({ cost: precioSiguienteTemporada(r.cost) })
        .eq('id', r.id)
      if (error) {
        setFallo(mensajeDeError(error))
        return
      }
    }
  }

  return (
    <div>
      {fallo && <p className="error-texto" role="alert">{fallo}</p>}
      <p className="suave" style={{ margin: '0 4px 12px' }}>
        Una sola meta activa: la XP de todo el gremio suma hacia un premio compartido. Es cooperativa, nadie compite con nadie.
      </p>

      {goal && (
        <div className="estandarte">
          <div className="fila-separada">
            <strong>{goal.emoji} {goal.title}</strong>
            <span className="suave">{Math.min(progreso, goal.target_xp)} / {goal.target_xp} XP</span>
          </div>
          <div className="xpbar" style={{ marginTop: 8 }}>
            <div className="xpbar-fill" style={{ width: Math.min(100, Math.round((100 * progreso) / goal.target_xp)) + '%' }} />
            <div className="xpbar-pips"><span /><span /><span /><span /><span /></div>
          </div>
          <button className="btn btn-exito btn-bloque" style={{ marginTop: 10 }} onClick={conseguida}>
            🎉 ¡Conseguida! Cerrar y celebrar
          </button>
        </div>
      )}

      <div className="carta">
        <div className="campo">
          <label>{goal ? 'Editar meta' : 'Nueva meta del gremio'}</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Noche de pizza y peli" />
        </div>
        <div className="fila">
          <div className="campo" style={{ width: 110 }}>
            <label>Emoji</label>
            <select value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })}>
              {['🏆', '🍕', '🎬', '🏕️', '🎢', '🏖️', '🎲'].map((e) => <option key={e}>{e}</option>)}
            </select>
          </div>
          <div className="campo crece">
            <label>XP objetivo</label>
            <input type="number" min="100" step="50" value={form.target_xp} onChange={(e) => setForm({ ...form, target_xp: e.target.value })} />
          </div>
        </div>
        <button className="btn btn-bloque" disabled={!form.title.trim()} onClick={guardar}>Guardar meta</button>
      </div>
    </div>
  )
}

/**
 * Premio a mano: monedas extra por algo que no cabía en el catálogo.
 *
 * No da XP a propósito. La XP marca el nivel y alimenta la meta del
 * gremio, las dos calculadas contra un ritmo; un extra a mano que subiera
 * de nivel convertiría lo excepcional en la vía rápida y en dos semanas
 * nadie haría misiones.
 *
 * El motivo es obligatorio y queda guardado con el nombre del adulto que
 * lo concede. No por desconfianza: porque si dentro de un mes hay que
 * explicar ese saldo, la respuesta tiene que existir en algún sitio.
 */
function PremioAMano({ data, onHecho, onCerrar }) {
  const gente = perfilesActivos(data.profiles)
  const adultos = gente.filter((p) => p.role === 'adulto')
  const [para, setPara] = useState(gente[0]?.id || '')
  const [monedas, setMonedas] = useState(20)
  const [motivo, setMotivo] = useState('')
  const [quien, setQuien] = useState(adultos[0]?.id || '')
  const [fallo, setFallo] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const problema = revisarPremioManual({ monedas, motivo, otorgadoPor: quien, perfiles: gente })
  const aviso = avisoDeCantidad(monedas)

  async function conceder() {
    if (problema) return setFallo(problema)
    setOcupado(true)
    setFallo('')
    const { ok, mensaje } = await premioAMano({
      profileId: para,
      monedas: Number(monedas),
      motivo: motivo.trim(),
      otorgadoPor: quien
    })
    setOcupado(false)
    if (ok) onHecho()
    else setFallo(mensaje || 'No se pudo conceder.')
  }

  return (
    <div className="bloque-manual">
      <div className="fila-separada" style={{ marginBottom: 8 }}>
        <strong style={{ fontSize: '0.95rem' }}>Monedas por algo excepcional</strong>
        <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar"><Icono nombre="cerrar" tamano={18} /></button>
      </div>
      <p className="suave" style={{ margin: '0 0 10px' }}>
        Suma monedas sin dar XP, así que no adelanta niveles ni la meta del gremio.
      </p>

      {fallo && <p className="error-texto" role="alert">{fallo}</p>}

      <div className="fila">
        <div className="campo crece">
          <label>Para</label>
          <select value={para} onChange={(e) => setPara(e.target.value)}>
            {gente.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
          </select>
        </div>
        <div className="campo crece">
          <label>Monedas 🪙</label>
          <input
            type="number"
            min="1"
            max={MAXIMO_MANUAL}
            value={monedas}
            onChange={(e) => setMonedas(e.target.value)}
          />
        </div>
      </div>

      {aviso && <p className="suave" style={{ margin: '0 0 8px', color: '#d99a2b' }}>{aviso}</p>}

      <div className="campo">
        <label>Motivo</label>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={240}
          placeholder="Qué ha pasado para merecerlo"
        />
      </div>

      <div className="campo">
        <label>Lo concede</label>
        <select value={quien} onChange={(e) => setQuien(e.target.value)}>
          {adultos.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
        </select>
        <span className="suave">Solo un adulto puede concederlo, y queda registrado quién.</span>
      </div>

      <button className="btn btn-bloque" disabled={Boolean(problema) || ocupado} onClick={conceder}>
        Conceder {Number(monedas) || 0} 🪙
      </button>
      {problema && <p className="suave" style={{ marginTop: 6 }}>{problema}</p>}
    </div>
  )
}
