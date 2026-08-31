import { useState } from 'react'
import { supabase, canDo, dayKey, goalProgress, ROLE_LABEL, FREQ_LABEL, mensajeDeError, esColumnaQueNoExiste, zonaActual } from '../lib/supabase'
import { CATALOGO, DEFAULTS_ROL, RECOMENDADAS } from '../lib/tareas'
import {
  resolverMision as resolverMisionRemota,
  resolverCanje as resolverCanjeRemoto,
  estrellaInmediata,
  deshacerMision
} from '../lib/acciones'
import { perfilesActivos } from '../lib/miembros'
import { misionValidada, premioCanjeado } from '../lib/actividadExterna'
import { avisoDeCarga, monedasPorDia } from '../lib/economia'
import { premioAMano } from '../lib/acciones'
import { revisarPremioManual, avisoDeCantidad, MAXIMO_MANUAL } from '../lib/premioManual'
import {
  MONEDAS_POR_ESTRELLA,
  TECHO_PEQUE,
  NIVELES,
  PREMIOS_DE_ARRANQUE,
  ordenarPorPrecio,
  premiosDeArranqueQueFaltan
} from '../lib/premios'
import { PREMIOS_DE_LA_PEQUE } from '../lib/setup'
import { SUBIDA_POR_TEMPORADA, precioSiguienteTemporada, premiosQueSuben } from '../lib/temporadas'
import { quienMasAporta } from '../lib/meritos'
import { borrarORetirar } from '../lib/retirarMision'
import { habilidad, HABILIDADES } from '../lib/habilidades'
import { sugerenciasDeElogio, rachaDeMision, sugerenciasDeCorreccion, correccionValida } from '../lib/elogio'
import { flex, generoDe } from '../lib/genero'
import { Modal, Celebracion, Pestana, Talis } from '../components/ui'
import Personaje from '../components/Personaje'
import Retrato from '../components/Retrato'
import Icono from '../components/Icono'
import Ajustes from './Ajustes'
import AvisoPush from './AvisoPush'
import TableroMascota from './TableroMascota'
import Cuadro from './Cuadro'
import {
  misionesDe,
  tocaEl,
  destinoDe,
  destinoA,
  rolesDe,
  textoDestino,
  ETIQUETA_ROL,
  GRUPOS_ROL,
  agruparPorFrecuencia,
  DIAS_SEMANA,
  diasDe,
  tocaDia,
  textoDias,
  alternarDia
} from '../lib/misiones'
import SelectorEmoji from '../components/SelectorEmoji'
import { emojiSugerido, GRUPOS_EMOJI_MISION, EMOJIS_MISION } from '../lib/emojis'
import { talis } from '../lib/talis'
import { flag } from '../lib/flags'
import { campanaActiva, esDeOperacion, esfuerzoDeMision } from '../lib/limpieza'
import ModoLimpieza from './ModoLimpieza'
import { leerPerfil } from '../lib/gremios'

export default function ParentPanel({ family, data, refresh, refreshFamily, onVerTutorial, onExit }) {
  const [tab, setTab] = useState('pendientes')
  // Con qué pestaña de Ajustes abrir. Solo lo usa el recordatorio de
  // avisos; el resto de entradas a Ajustes siguen cayendo en Miembros.
  const [seccionAjustes, setSeccionAjustes] = useState(null)
  // Cuál de las mascotas se está mirando, cuando hay más de una.
  const [mascotaAbierta, setMascotaAbierta] = useState(null)

  const mascotas = data.profiles.filter((p) => p.role === 'mascota' && p.active !== false)
  // Quién está apuntando. El panel se entra con PIN, no como perfil, así
  // que lo único que se puede saber es de quién es ESTE aparato —la misma
  // señal que usa la pantalla de Avisos—. Si no consta, se guarda null:
  // mejor un hueco honesto que atribuirle el trabajo a alguien al azar.
  const quien = data.profiles.find((p) => p.id === leerPerfil(family?.id)) || null
  const [programar, setProgramar] = useState(false)
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
    if (ok) {
      await refresh()
      if (estado === 'aprobado') misionValidada(family.id)
    }
    // Puede salir bien y traer aviso: es el caso de la base sin migrar,
    // donde la misión se valida pero el elogio se queda por el camino.
    if (mensaje) setAviso(mensaje)
    else if (!ok) setAviso('No se pudo validar la misión.')
  }

  async function resolverCanje(id, estado) {
    setAviso('')
    const { ok, mensaje } = await resolverCanjeRemoto(id, estado)
    if (ok) {
      await refresh()
      if (estado === 'entregado') premioCanjeado(family.id)
    } else setAviso(mensaje || 'No se pudo resolver el canje.')
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
            onClick={() => {
              setSeccionAjustes(null)
              setTab(tab === 'ajustes' ? 'pendientes' : 'ajustes')
            }}
          >
            <Icono nombre="ajustes" />
          </button>
          <button className="btn btn-fantasma btn-mini" onClick={onExit}>
            <Icono nombre="salir" tamano={18} /> Salir
          </button>
        </div>
      </div>

      {aviso && <p className="error-texto" role="alert" style={{ margin: '0 4px 10px' }}>{aviso}</p>}

      <AvisoPush
        family={family}
        data={data}
        onIrAAvisos={() => {
          setSeccionAjustes('avisos')
          setTab('ajustes')
        }}
      />

      {tab === 'pendientes' && (
        <div>
          {/* El ritual de fin de día: registrar lo de hoy y dejar
              programado lo de mañana. Vive aquí y no en pestaña propia
              porque es lo que se hace al cerrar el día. */}
          <button className="btn btn-bloque" style={{ marginBottom: 14 }} onClick={() => setProgramar(true)}>
            🌙 Programar mañana
          </button>
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
                  <Retrato perfil={p} tamano={40} />
                  <div className="crece">
                    <strong>{rw?.emoji} {rw?.title || 'Premio'}</strong>
                    <div className="suave">{p?.name} · <Talis n={r.cost} /></div>
                  </div>
                </div>
                <div className="fila">
                  <button className="btn btn-exito btn-mini crece" onClick={() => resolverCanje(r.id, 'entregado')}>
                    <Icono nombre="premio" tamano={19} /> Entregado
                  </button>
                  <button className="btn btn-fantasma btn-mini" onClick={() => resolverCanje(r.id, 'cancelado')}>Devolver Talis</button>
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
              <div className={'carta' + (esDeOperacion(ch) ? ' carta-operacion' : '')} key={c.id}>
                <div className="fila">
                  <Retrato perfil={p} tamano={40} />
                  <div className="crece">
                    <strong>{ch?.emoji} {flex(ch?.title, generoDe(p)) || 'Misión'}</strong>
                    <div className="suave">{p?.name} · +{c.xp} XP · +<Talis n={c.coins} /></div>
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
                      <Retrato perfil={p} tamano={40} />
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

      {tab === 'mascotas' && (
        <div>
          {/* Con una sola mascota no se enseña selector: sería una fila de
              un botón. Con varias, sí. */}
          {mascotas.length > 1 && (
            <div className="segmentos" role="tablist">
              {mascotas.map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={(mascotaAbierta || mascotas[0].id) === m.id}
                  className={(mascotaAbierta || mascotas[0].id) === m.id ? 'activo' : ''}
                  onClick={() => setMascotaAbierta(m.id)}
                >
                  <Personaje perfil={m} tamano={20} />
                </button>
              ))}
            </div>
          )}
          <TableroMascota
            family={family}
            data={data}
            mascota={mascotas.find((m) => m.id === (mascotaAbierta || mascotas[0].id)) || mascotas[0]}
            quien={quien}
            refresh={refresh}
          />
        </div>
      )}

      {tab === 'cuadro' && <Cuadro data={data} />}
      {tab === 'peque' && <ModoPeque family={family} data={data} refresh={refresh} onCeleb={setCeleb} />}
      {tab === 'misiones' && (
        <GestionMisiones
          family={family}
          data={data}
          refresh={refresh}
          onIrACasa={() => { setSeccionAjustes('casa'); setTab('ajustes') }}
        />
      )}
      {tab === 'premios' && <GestionPremios family={family} data={data} refresh={refresh} />}
      {tab === 'meta' && <GestionMeta family={family} data={data} refresh={refresh} />}
      {tab === 'ajustes' && (
        <Ajustes
          key={seccionAjustes || 'miembros'}
          family={family}
          data={data}
          refresh={refresh}
          refreshFamily={refreshFamily}
          onVerTutorial={onVerTutorial}
          seccionInicial={seccionAjustes}
        />
      )}

      {programar && (
        <ProgramarManana
          family={family}
          data={data}
          refresh={refresh}
          onClose={() => setProgramar(false)}
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
        {/* Solo si hay alguna: una pestaña vacía enseña un hueco y no una
            función, y esta app tiene ya seis pestañas peleándose el ancho. */}
        {mascotas.length > 0 && (
          <Pestana
            icono="estrella"
            etiqueta="Mascotas"
            activa={tab === 'mascotas'}
            onClick={() => setTab('mascotas')}
          />
        )}
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

  // Las tareas del modo limpieza se distinguen a la vista: son misión
  // secundaria con fecha de fin, y en una cola mezclada el adulto tiene
  // que poder ver de un vistazo qué pertenece a la operación.
  const deOperacion = esDeOperacion(reto)

  return (
    <div className={'carta' + (deOperacion ? ' carta-operacion' : '')}>
      <div className="fila" style={{ marginBottom: 10 }}>
        <Retrato perfil={perfil} tamano={40} />
        <div className="crece">
          <strong>{reto?.emoji} {flex(reto?.title, genero) || 'Misión'}</strong>
          <div className="suave">
            {perfil?.name} · +{completion.xp} XP · +<Talis n={completion.coins} />
            {deOperacion && <> · 🧹 {esfuerzoDeMision(reto, perfil?.role).texto}</>}
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
    // Si tiene historial se ofrece retirarla: borrarla se llevaría por
    // delante la prueba de las insignias que sostiene. Ver retirarMision.js.
    const { resultado, error } = await borrarORetirar({ ...m, titulo: flex(m.title, 'neutro') })
    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    if (resultado === 'cancelado') return
    setEditando(null)
    await refresh()
  }

  // Encender y apagar una misión es UN TOQUE, no un formulario.
  //
  // Antes solo se podía desde el lápiz: abrir la misión, buscar el par
  // Activa/Pausada al final del formulario, pulsarlo y guardar. Cuatro
  // pasos y un modal para cambiar un booleano, en la pantalla donde se
  // decide cada mañana qué le toca hoy a la peque —que es justo donde eso
  // se hace a diario—. El mismo botón que ya tienen los premios.
  async function alternar(m) {
    setOcupado(m.id)
    const { error } = await supabase.from('challenges').update({ active: !m.active }).eq('id', m.id)
    if (error) setFallo(mensajeDeError(error))
    else await refresh()
    setOcupado(null)
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
  // también en el tablero de los adultos. Cinco Talis son una estrella
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
        mano. El botón ▶/⏸ enciende y apaga la misión en un toque, el lápiz la edita —título, dibujo, puntos y
        frecuencia— y el botón del final de cada lista crea una nueva, ya asignada a quien corresponde.
      </p>
      {fallo && <p className="error-texto" role="alert">{fallo}</p>}
      {peques.map((p) => {
        // Con las pausadas incluidas: si se ocultaran, pausar una desde
        // aquí la haría desaparecer de la única pantalla desde la que se
        // puede volver a activar.
        // Las activas primero: una pausada en medio de la lista parte de
        // un vistazo lo que hoy se puede tocar, y esta pantalla se lee de
        // arriba abajo dando estrellas.
        const retos = [...misionesDe(p, data.challenges, { incluirPausadas: true })].sort(
          (a, b) => Number(b.active) - Number(a.active)
        )
        const enPausa = retos.filter((c) => !c.active).length
        return (
          <div key={p.id}>
            <div className="titulo-seccion">
              <Personaje perfil={p} tamano={26} />
              {enPausa > 0 && (
                <span className="chip" style={{ marginLeft: 8 }}>
                  {enPausa} en pausa
                </span>
              )}
            </div>
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
                    onClick={() => alternar(ch)}
                    disabled={ocupado === ch.id}
                    aria-pressed={ch.active}
                    aria-label={ch.active
                      ? `Pausar ${flex(ch.title, generoDe(p))}`
                      : `Activar ${flex(ch.title, generoDe(p))}`}
                    title={ch.active ? 'Pausar: deja de salirle en su pantalla' : 'Activar: vuelve a salirle en su pantalla'}
                  >
                    <Icono nombre={ch.active ? 'pausar' : 'reanudar'} />
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

const MISION_VACIA = { title: '', emoji: '⭐', xp: 10, coins: 5, frequency: 'diario', profile_id: null, target_roles: null, skill: 'responsabilidad', days: null, active: true }

function GestionMisiones({ family, data, refresh, onIrACasa }) {
  const [editando, setEditando] = useState(null) // null | objeto misión
  const [plantillas, setPlantillas] = useState(false)
  const [limpieza, setLimpieza] = useState(false)
  const operacion = campanaActiva(data.campanas || [])
  // Qué persona está desplegada. Solo una a la vez, y ninguna al entrar:
  // la vista de arranque es el resumen de la familia, no el detalle.
  const [abierto, setAbierto] = useState(null)
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
      days: diasDe(m),
      active: m.active
    }
    const escribir = (f) =>
      m.id
        ? supabase.from('challenges').update(f).eq('id', m.id)
        : supabase.from('challenges').insert(f)

    let { error } = await escribir(fila)
    // Una base sin la migración 024 no tiene la columna. Se guarda el
    // resto en vez de dejar la misión sin escribir, y se dice qué se ha
    // perdido: callarlo sería peor que el fallo, porque el patrón se
    // daría por puesto. Mismo criterio que con `families.timezone`.
    if (error && esColumnaQueNoExiste(error)) {
      const { days, ...sinDias } = fila
      ;({ error } = await escribir(sinDias))
      if (!error && days) {
        setFallo('La misión se ha guardado, pero los días de la semana no: a esta base le falta la migración 024.')
        setEditando(null)
        await refresh()
        return
      }
    }
    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    setFallo('')
    setEditando(null)
    await refresh()
  }

  async function borrar(m) {
    // Si tiene historial se ofrece retirarla: borrarla se llevaría por
    // delante la prueba de las insignias que sostiene. Ver retirarMision.js.
    const { resultado, error } = await borrarORetirar({ ...m, titulo: m.title })
    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    if (resultado === 'cancelado') return
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
  // Las PAUSADAS no salen aquí: una misión pausada está, a todos los
  // efectos, devuelta a la biblioteca —desde allí se vuelve a activar—, y
  // dejarla en esta lista al 50 % de opacidad solo servía para doblar la
  // altura del panel con cosas que no están pasando. Se cuentan abajo,
  // que es lo único que hay que saber de ellas.
  const pausadas = data.challenges.filter((c) => !c.active)

  const grupos = (() => {
    const gente = perfilesActivos(data.profiles)
    const salida = gente.map((p) => ({
      clave: p.id,
      titulo: p.name,
      perfil: p,
      misiones: misionesDe(p, data.challenges)
    }))
    // Las que no le tocan a nadie activo no pueden quedarse sin sitio: se
    // perderían de vista y seguirían contando en la economía.
    const asignadas = new Set(salida.flatMap((g) => g.misiones.map((m) => m.id)))
    // Solo entre las activas: desde que las pausadas salen de la lista,
    // mirar `data.challenges` entero metía TODAS las pausadas aquí como
    // si no tuvieran destino.
    const huerfanas = data.challenges.filter((c) => c.active && !asignadas.has(c.id))
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
      {/* El modo limpieza va encima y a lo ancho, como «Programar mañana»
          en Validar: es un acto de campaña, no una misión más. La pastilla
          dice si hay una operación en marcha sin tener que abrirlo. */}
      {flag('modoLimpieza') && (
        <button className="btn btn-bloque" style={{ marginBottom: 10 }} onClick={() => setLimpieza(true)}>
          🧹 Modo limpieza{operacion ? ` · ${operacion.emoji} en marcha` : ''}
        </button>
      )}
      <div className="fila" style={{ marginBottom: 12 }}>
        <button className="btn btn-mini crece" onClick={() => setEditando({ ...MISION_VACIA })}>+ Nueva misión</button>
        <button className="btn btn-fantasma btn-mini" onClick={() => setPlantillas(true)}>📚 Biblioteca</button>
      </div>

      {data.challenges.length === 0 && <div className="vacio">Todavía no hay misiones. Crea una o activa varias desde la biblioteca.</div>}

      {grupos.map((g) => (
        <section key={g.clave}>
          {/* Plegado por persona. Con cuatro personas y seis misiones cada
              una esto era una pared de treinta tarjetas donde no se veía
              nada; cerrado, la familia entera cabe en cuatro filas y se
              abre solo a quien vienes a tocar. La cuenta va en la cabecera
              para que plegar no esconda la información que hace falta
              para decidir. */}
          <button
            type="button"
            className="grupo-cabecera"
            aria-expanded={abierto === g.clave}
            onClick={() => setAbierto(abierto === g.clave ? null : g.clave)}
          >
            <span className="grupo-titulo">
              {g.perfil ? <Personaje perfil={g.perfil} tamano={26} /> : g.titulo}
            </span>
            <span className="grupo-cuenta">{g.misiones.length}</span>
            <span className="grupo-chevron" aria-hidden="true">{abierto === g.clave ? '▾' : '▸'}</span>
          </button>
          {abierto === g.clave && g.bloques.map((b) => (
            <div key={b.frecuencia}>
              <h4 className="titulo-frecuencia">
                {b.titulo}
                <span className="cuenta-frecuencia">{b.misiones.length}</span>
              </h4>
              {b.misiones.map((ch) => (
        <div className={'carta' + (esDeOperacion(ch) ? ' carta-operacion' : '')} key={ch.id}>
          <div className="fila">
            <div className="avatar">{ch.emoji}</div>
            <div className="crece">
              <strong>{flex(ch.title, generoDe(data.profiles.find((p) => p.id === ch.profile_id)))}</strong>
              <div className="suave">
                {esDeOperacion(ch) && (
                  <>🧹 Operación · {esfuerzoDeMision(ch, data.profiles.find((p) => p.id === ch.profile_id)?.role).texto} · </>
                )}
                {habilidad(ch.skill) && <>{habilidad(ch.skill).emoji} {habilidad(ch.skill).nombre} · </>}
                +{ch.xp} XP · <Talis n={ch.coins} />
              </div>
              {/* La tira solo sale cuando hay patrón: dibujar siete puntos
                  llenos en todas las misiones sería repetir «todos los
                  días» treinta veces y esconder justo a las que no. */}
              {diasDe(ch) && (
                <div className="tira-dias mini" aria-label={textoDias(ch)}>
                  {DIAS_SEMANA.map((d) => (
                    <span
                      key={d.n}
                      className={'dia-punto' + (tocaDia(ch, d.n) ? ' sel' : '')}
                      aria-hidden="true"
                    >
                      {d.letra}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              className="btn-icono"
              onClick={() => alternar(ch)}
              aria-label={`Devolver "${ch.title}" a la biblioteca`}
              title="Devolver a la biblioteca"
            >
              <Icono nombre="pausar" />
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

      {/* Una misión pausada no desaparece, y ahora tampoco hay que ir a
          buscarla: se despliega aquí y se reenciende en un toque.
          Sigue fuera de las listas de arriba a propósito —eran treinta
          tarjetas al 50 % de opacidad de cosas que no están pasando—, pero
          esconderlas detrás de la biblioteca convertía «volver a
          encenderla» en abrir un modal, elegir persona y buscarla en el
          catálogo. Plegada por defecto: se ve la cuenta, se abre quien la
          necesita. */}
      {pausadas.length > 0 && (
        <details className="pausadas-bloque">
          <summary>
            {pausadas.length === 1 ? '1 misión en pausa' : `${pausadas.length} misiones en pausa`}
            <span className="suave">
              {pausadas.length === 1 ? ' · tócala para volver a encenderla' : ' · tócalas para volver a encenderlas'}
            </span>
          </summary>
          {pausadas.map((ch) => (
            <div className={'carta' + (esDeOperacion(ch) ? ' carta-operacion' : '')} key={ch.id} style={{ opacity: 0.72 }}>
              <div className="fila">
                {/* Sin el avatar grande de las listas de arriba: en 375 px,
                    avatar + botón con texto + lápiz dejaban al título
                    cuarenta píxeles y «Estudiar violín» salía partido en
                    dos líneas. El emoji va en línea con el título, que es
                    donde se lee igual de bien y ocupa la mitad. */}
                <div className="crece">
                  <strong>{ch.emoji} {flex(ch.title, generoDe(data.profiles.find((p) => p.id === ch.profile_id)))}</strong>
                  <div className="suave">
                    {destinoTexto(ch)} · +{ch.xp} XP · <Talis n={ch.coins} />
                  </div>
                </div>
                {/* Sin `crece`: el que tiene que ensanchar es el título.
                    Con la clase puesta, el botón se comía la fila y
                    «Estudiar violín» salía partido en dos líneas. */}
                <button
                  className="btn btn-mini"
                  style={{ flex: 'none' }}
                  onClick={() => alternar(ch)}
                  aria-label={`Activar "${ch.title}"`}
                >
                  ▶ Activar
                </button>
                <button className="btn-icono" onClick={() => setEditando(ch)} aria-label={`Editar ${ch.title}`}>
                  <Icono nombre="editar" />
                </button>
              </div>
            </div>
          ))}
          <p className="suave" style={{ margin: '4px 4px 0' }}>
            Conservan su historial. Si buscas una que nunca has creado, está en la{' '}
            <button className="btn btn-fantasma btn-mini" onClick={() => setPlantillas(true)}>
              📚 biblioteca
            </button>
          </p>
        </details>
      )}

      {plantillas && (
        <Biblioteca family={family} data={data} refresh={refresh} onClose={() => setPlantillas(false)} />
      )}

      {limpieza && (
        <ModoLimpieza
          data={data}
          refresh={refresh}
          onClose={() => setLimpieza(false)}
          onIrACasa={() => { setLimpieza(false); onIrACasa?.() }}
        />
      )}
    </div>
  )
}

function FormMision({ mision, perfiles, onGuardar, onBorrar, onClose }) {
  const [m, setM] = useState({ ...mision })
  // Igual que en los premios: se sugiere mientras nadie haya elegido a
  // mano, y al editar una que ya existe no se sugiere nunca, que su emoji
  // ya lo decidió alguien.
  const [emojiAMano, setEmojiAMano] = useState(Boolean(mision.id))
  const set = (cambios) => setM({ ...m, ...cambios })

  function escribirTitulo(title) {
    set(emojiAMano ? { title } : { title, emoji: emojiSugerido(title, MISION_VACIA.emoji, EMOJIS_MISION) })
  }

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
        <label htmlFor="mision-titulo">Título</label>
        <input
          id="mision-titulo"
          value={m.title}
          onChange={(e) => escribirTitulo(e.target.value)}
          autoFocus
        />
      </div>
      <div className="campo">
        <label htmlFor="mision-emoji">Emoji <span className="emoji-elegido">{m.emoji}</span></label>
        <SelectorEmoji
          id="mision-emoji"
          valor={m.emoji}
          grupos={GRUPOS_EMOJI_MISION}
          ejemplos="dientes, cama, plantas"
          onElegir={(e) => { setEmojiAMano(true); set({ emoji: e }) }}
        />
      </div>
      <div className="fila">
        <div className="campo crece">
          <label>XP</label>
          <input type="number" min="0" value={m.xp} onChange={(e) => set({ xp: e.target.value })} />
        </div>
        <div className="campo crece">
          <label>Talis</label>
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
        {/* Pasar a «única» borra el patrón: una misión que se hace una
            sola vez y además solo los martes es una forma silenciosa de
            que no aparezca hasta el martes que viene. */}
        <select
          value={m.frequency}
          onChange={(e) =>
            set(e.target.value === 'unico' ? { frequency: 'unico', days: null } : { frequency: e.target.value })
          }
        >
          <option value="diario">Diaria</option>
          <option value="semanal">Semanal</option>
          <option value="mensual">Mensual</option>
          <option value="unico">Única</option>
        </select>
      </div>
      {/* Los días son un patrón de siete casillas, no un calendario: no
          tienen fecha de inicio, así que se repiten solos y empezar a
          usarlos un jueves no deja ninguna semana a medias. Se ofrecen
          también para las semanales y mensuales —«la colada, los
          sábados»— y no para las únicas, que no se repiten. */}
      {m.frequency !== 'unico' && (
        <div className="campo">
          <label id="mision-dias">Qué días</label>
          <div className="tira-dias" role="group" aria-labelledby="mision-dias">
            {DIAS_SEMANA.map((d) => {
              const puesto = tocaDia(m, d.n)
              return (
                <button
                  key={d.n}
                  type="button"
                  className={'dia-casilla' + (puesto ? ' sel' : '')}
                  aria-pressed={puesto}
                  aria-label={d.nombre}
                  onClick={() => set({ days: alternarDia(m.days, d.n) })}
                >
                  {d.letra}
                </button>
              )
            })}
          </div>
          <span className="suave">{textoDias(m)}</span>
        </div>
      )}
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

// --------------------------------------------------------------
// Programar mañana: qué diarias harán la junior y la peque el día
// siguiente. Es el ritual de fin de día, por eso vive en la pestaña
// Validar y no como pestaña propia (seis ya entran justas a 360 px).
//
// El plan es una CAPA sobre el patrón: se preselecciona lo que el patrón
// dice que toca mañana, se confirma —o se sustituye alguna por una
// pausada, solo por ese día—. Si no se confirma, no pasa nada: manda el
// patrón. Ver src/lib/misiones.js (planDelDia) y migración 025.
// --------------------------------------------------------------

// La fecha de mañana en la zona de la familia, como 'YYYY-MM-DD'. Se
// calcula desde `dayKey` (que ya respeta la zona) y se avanza un día por
// aritmética UTC, sin `new Date(cadena)`, que es la trampa de zona.
function fechaDeManana(tz) {
  const [a, m, d] = dayKey(new Date(), tz).split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}

const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function ProgramarManana({ family, data, refresh, onClose }) {
  const tz = zonaActual()
  const manana = fechaDeManana(tz)
  // Mediodía UTC: seguro para sacar el día de la semana en cualquier zona.
  const fechaManana = new Date(manana + 'T12:00:00Z')
  const nombreManana = NOMBRE_DIA[fechaManana.getUTCDay()]

  // Solo junior y peque: los adultos programan, no se programan.
  const ninos = perfilesActivos(data.profiles).filter((p) => p.role === 'junior' || p.role === 'peque')

  const diariasDe = (perfil, incluirPausadas = false) =>
    misionesDe(perfil, data.challenges, { incluirPausadas }).filter((c) => c.frequency === 'diario')

  // Selección inicial por perfil: las diarias activas que el patrón dice
  // que tocan mañana. El adulto quita, o añade una pausada.
  const [sel, setSel] = useState(() => {
    const inicial = {}
    for (const n of ninos) {
      inicial[n.id] = new Set(diariasDe(n).filter((c) => tocaEl(c, fechaManana)).map((c) => c.id))
    }
    return inicial
  })
  const [abrirBiblioteca, setAbrirBiblioteca] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState('')
  const [hecho, setHecho] = useState(false)

  function alternar(perfilId, challengeId) {
    setSel((s) => {
      const suyo = new Set(s[perfilId])
      if (suyo.has(challengeId)) suyo.delete(challengeId)
      else suyo.add(challengeId)
      return { ...s, [perfilId]: suyo }
    })
  }

  const retoDe = (id) => data.challenges.find((c) => c.id === id)
  const totalSel = ninos.reduce((t, n) => t + (sel[n.id]?.size || 0), 0)

  async function confirmar() {
    setGuardando(true)
    setFallo('')
    const filas = []
    for (const n of ninos) {
      for (const id of sel[n.id] || []) {
        const reto = retoDe(id)
        if (!reto) continue
        // Deriva el origen: si es una activa que hoy tocaba por patrón, es
        // 'patron'; cualquier otra (pausada, o activa que el patrón no
        // ponía mañana) es una sustitución de ese día.
        const origen = reto.active && tocaEl(reto, fechaManana) ? 'patron' : 'sustituta'
        filas.push({ family_id: family.id, dia: manana, challenge_id: id, profile_id: n.id, origen })
      }
    }

    // Reconfirmar limpia lo anterior de ese día: el plan es idempotente,
    // no se acumula. Borra solo el de mañana, no toca otros días.
    const { error: eBorrar } = await supabase
      .from('plan_diario').delete().eq('family_id', family.id).eq('dia', manana)
    if (eBorrar) return acabarConFallo(eBorrar)

    if (filas.length) {
      const { error: eIns } = await supabase.from('plan_diario').insert(filas)
      if (eIns) return acabarConFallo(eIns)
    }

    setGuardando(false)
    setHecho(true)
    await refresh()
  }

  function acabarConFallo(error) {
    setGuardando(false)
    // La tabla puede no existir si falta la migración 025. Se dice claro
    // en vez de un error críptico; la app no depende de esto para lo demás.
    const falta = error.code === '42P01' || error.code === 'PGRST205'
    setFallo(falta
      ? 'La programación diaria necesita la migración 025, que aún no está en la base.'
      : mensajeDeError(error))
  }

  if (abrirBiblioteca) {
    return (
      <Biblioteca
        family={family}
        data={data}
        refresh={refresh}
        onClose={() => setAbrirBiblioteca(false)}
      />
    )
  }

  return (
    <Modal titulo={`Programar el ${nombreManana}`} onClose={onClose}>
      {hecho ? (
        <div>
          <p className="ok-texto" role="status">
            Listo. Mañana {nombreManana} saldrá lo que has elegido; el resto de días sigue el patrón.
          </p>
          <button className="btn btn-bloque" onClick={onClose}>Cerrar</button>
        </div>
      ) : (
        <div>
          {fallo && <p className="error-texto" role="alert">{fallo}</p>}
          <p className="suave" style={{ marginTop: 0 }}>
            Marcado sale ✓ va mañana. Puedes quitar alguna, o añadir una pausada solo por ese día.
          </p>

          {ninos.length === 0 && <div className="vacio">No hay junior ni peque en el gremio.</div>}

          {ninos.map((n) => {
            const activas = diariasDe(n)
            const pausadas = diariasDe(n, true).filter((c) => !c.active)
            const suyo = sel[n.id] || new Set()
            return (
              <section key={n.id} style={{ marginBottom: 16 }}>
                <div className="fila" style={{ marginBottom: 8 }}>
                  <Retrato perfil={n} tamano={40} />
                  <strong className="crece">{n.name}</strong>
                  <span className="suave">{suyo.size} para mañana</span>
                </div>

                {activas.length === 0 && pausadas.length === 0 && (
                  <div className="vacio">Sin misiones diarias. Se activan en Misiones.</div>
                )}

                {activas.map((c) => (
                  <ToggleMision
                    key={c.id}
                    reto={c}
                    marcado={suyo.has(c.id)}
                    onToggle={() => alternar(n.id, c.id)}
                  />
                ))}

                {pausadas.length > 0 && (
                  <details className="plan-pausadas">
                    <summary>Sustituir por una pausada ({pausadas.length})</summary>
                    {pausadas.map((c) => (
                      <ToggleMision
                        key={c.id}
                        reto={c}
                        pausada
                        marcado={suyo.has(c.id)}
                        onToggle={() => alternar(n.id, c.id)}
                      />
                    ))}
                  </details>
                )}
              </section>
            )
          })}

          <div className="fila" style={{ marginTop: 4 }}>
            <button className="btn crece" disabled={guardando} onClick={confirmar}>
              {guardando ? 'Guardando…' : `Confirmar ${totalSel} para mañana`}
            </button>
            <button className="btn btn-fantasma btn-mini" onClick={() => setAbrirBiblioteca(true)}>
              📚 Biblioteca
            </button>
          </div>
          <p className="suave" style={{ fontSize: '0.8rem' }}>
            La biblioteca activa la misión de forma permanente; una pausada vuelve solo por mañana.
          </p>
        </div>
      )}
    </Modal>
  )
}

function ToggleMision({ reto, marcado, pausada, onToggle }) {
  return (
    <button
      type="button"
      className={'plan-toggle' + (marcado ? ' sel' : '') + (pausada ? ' pausada' : '')}
      aria-pressed={marcado}
      onClick={onToggle}
    >
      <span className="plan-check" aria-hidden="true">{marcado ? '✓' : '+'}</span>
      <span className="avatar">{reto.emoji}</span>
      <span className="crece">{reto.title}</span>
    </button>
  )
}

function Biblioteca({ family, data, refresh, onClose }) {
  const candidatos = perfilesActivos(data.profiles)
  const [perfilId, setPerfilId] = useState(candidatos[0]?.id || '')
  const [sel, setSel] = useState(() => new Set())
  const [activando, setActivando] = useState(false)
  const [fallo, setFallo] = useState('')

  const perfil = candidatos.find((p) => p.id === perfilId)
  const yaActivas = new Set(misionesDe(perfil, data.challenges).map((ch) => ch.title))

  // Las pausadas SÍ se vuelven a ofrecer aquí, y al activarlas hay que
  // revivir la fila que ya existe. Insertando una nueva —que es lo que
  // hacía— quedaban dos misiones del mismo título para la misma persona,
  // una parada y otra viva, con el historial partido entre las dos.
  const pausadasPorTitulo = new Map(
    misionesDe(perfil, data.challenges, { incluirPausadas: true })
      .filter((ch) => !ch.active)
      .map((ch) => [ch.title, ch])
  )

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
    const revivir = []
    for (const g of grupos) {
      for (const tt of g.tareas) {
        if (!sel.has(tt.t) || yaActivas.has(tt.t)) continue
        const pausada = pausadasPorTitulo.get(tt.t)
        if (pausada) {
          revivir.push(pausada.id)
          continue
        }
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
    // Una por una con `eq`, y NO con `.in()`: el backend simulado solo
    // implementa `eq` en su constructor de consultas (fakeBackend.js), así
    // que `.in()` compila, pasa los tests y revienta en la pantalla con un
    // «update(...).in is not a function». Aquí son cuatro filas como mucho.
    for (const id of revivir) {
      const { error } = await supabase.from('challenges').update({ active: true }).eq('id', id)
      if (error) {
        setFallo(mensajeDeError(error))
        setActivando(false)
        return
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
  const [arranque, setArranque] = useState(false)

  // El agujero de los primeros días, medido con la tienda que hay: si lo
  // más barato está a más de una semana, la junior abre la tienda, no
  // puede tocar nada y deja de abrirla. Se avisa con la cifra delante,
  // no con una recomendación genérica.
  const faltanDeArranque = premiosDeArranqueQueFaltan(data.rewards)
  const alcanzables = data.rewards.filter((r) => r.active && r.cost > TECHO_PEQUE)
  const masBarato = alcanzables.length ? Math.min(...alcanzables.map((r) => r.cost)) : null
  const diasDelPrimero = masBarato === null ? null : Math.ceil(masBarato / monedasPorDia('junior'))
  // Una tienda vacía es el caso PEOR, no el caso sin problema: si el aviso
  // pidiera un precio para salir, el gremio que más lo necesita —el que
  // todavía no tiene premios— sería justo el que no lo vería.
  const arranqueLejos = masBarato === null || diasDelPrimero > 7

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
          <img src="/assets/talis.png" alt="" className="ficha-linea" /> Talis a mano
        </button>
      </div>

      {/* El aviso solo sale si de verdad falta algo. Un cartel permanente
          deja de leerse a la semana, y esto es una tarea de una sola vez. */}
      {faltanDeArranque.length > 0 && arranqueLejos && (
        <p className="aviso-carga" role="status">
          ✨ {masBarato === null
            ? 'No hay ningún premio que la junior pueda alcanzar.'
            : `El premio más barato cuesta ${talis(masBarato)}: ${diasDelPrimero} días de la junior.`}{' '}
          Los primeros días no llega a nada, y son los que deciden si esto se sigue usando.
          <button className="btn btn-mini" style={{ marginLeft: 8 }} onClick={() => setArranque(true)}>
            Ver premios de arranque
          </button>
        </p>
      )}

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

      {/* Por precio, igual que la tienda que ve la familia. Aquí no hay
          botón para invertirlo: quien edita premios los compara con los de
          su banda, y esa comparación es siempre de menos a más. */}
      {ordenarPorPrecio(data.rewards).map((r) => (
        <div className="carta" key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
          <div className="fila">
            <div className="avatar">{r.emoji}</div>
            <div className="crece">
              <strong>{r.title}</strong>
              <div className="suave"><Talis n={r.cost} /></div>
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

      {arranque && (
        <PremiosDeArranque
          family={family}
          data={data}
          refresh={refresh}
          onClose={() => setArranque(false)}
        />
      )}
    </div>
  )
}

/**
 * Los premios pequeños de los primeros días.
 *
 * Por qué existe esta pantalla y no se metieron sin más en el catálogo:
 * el catálogo lo arma el alta una sola vez, y el gremio que ya está en
 * producción se creó antes de que esto existiera. Además hay que poder
 * QUITARLOS cuando el hábito se sostenga —son andamio—, y eso pide un
 * sitio donde se vea qué son y por qué.
 *
 * Los de la peque van en la misma pantalla cuando hay peque: su tienda
 * también nace vacía en un gremio creado antes del setup de agosto, y es
 * exactamente el mismo gesto.
 */
function PremiosDeArranque({ family, data, refresh, onClose }) {
  const hayPeque = perfilesActivos(data.profiles).some((p) => p.role === 'peque')
  const puestos = new Set(data.rewards.map((r) => r.title))
  const dePeque = hayPeque ? PREMIOS_DE_LA_PEQUE.filter((p) => !puestos.has(p.title)) : []

  const [sel, setSel] = useState(
    () => new Set([...premiosDeArranqueQueFaltan(data.rewards), ...dePeque].map((p) => p.title))
  )
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState('')

  const bloques = [
    {
      clave: 'junior',
      titulo: 'Para la junior y los adultos',
      pie: `De ${Math.ceil(PREMIOS_DE_ARRANQUE[0].cost / monedasPorDia('junior'))} a ` +
        `${Math.ceil(PREMIOS_DE_ARRANQUE[PREMIOS_DE_ARRANQUE.length - 1].cost / monedasPorDia('junior'))} ` +
        `días de la junior. El primero del catálogo está a ${Math.ceil(NIVELES[1].coste[0] / monedasPorDia('junior'))}.`,
      premios: PREMIOS_DE_ARRANQUE
    },
    ...(hayPeque
      ? [{
          clave: 'peque',
          titulo: 'Para la peque',
          pie: `Por debajo de ${talis(TECHO_PEQUE)}, que es lo único que le sale a ella en su tienda.`,
          premios: PREMIOS_DE_LA_PEQUE
        }]
      : [])
  ]

  function alternarSel(titulo) {
    const s = new Set(sel)
    if (s.has(titulo)) s.delete(titulo)
    else s.add(titulo)
    setSel(s)
  }

  async function anadir() {
    const elegidos = bloques
      .flatMap((b) => b.premios)
      .filter((p) => sel.has(p.title) && !puestos.has(p.title))
    if (!elegidos.length) return
    setGuardando(true)
    // `family_id` explícito en todo insert derivado de perfiles: el SQL
    // Editor se salta el RLS y una vez escribió en familias ajenas.
    const { error } = await supabase.from('rewards').insert(
      elegidos.map((p) => ({
        family_id: family.id,
        title: p.title,
        emoji: p.emoji,
        cost: p.cost,
        tier: p.tier,
        active: true
      }))
    )
    setGuardando(false)
    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    onClose()
    await refresh()
  }

  const porPoner = bloques
    .flatMap((b) => b.premios)
    .filter((p) => sel.has(p.title) && !puestos.has(p.title)).length

  return (
    <Modal titulo="✨ Premios de arranque" onClose={onClose}>
      <p className="suave" style={{ marginTop: 0 }}>
        Premios pequeños para las primeras semanas, mientras el hábito todavía no se sostiene solo. Son
        decisiones, no cosas: elegir la música, elegir la cena, quedarse un rato más.
      </p>
      <p className="suave">
        <strong>Están pensados para retirarse.</strong> Cuando la rutina aguante sin ellos, pausálos desde la
        lista y la tienda vuelve a ser la de siempre. No suben de precio al cambiar de temporada ni entran en el
        diagnóstico de la economía.
      </p>

      {bloques.map((b) => (
        <div key={b.clave}>
          <div className="titulo-seccion">{b.titulo}</div>
          <p className="suave" style={{ margin: '0 4px 6px', fontSize: '0.78rem' }}>{b.pie}</p>
          {b.premios.map((p) => {
            const ya = puestos.has(p.title)
            return (
              <label
                key={p.title}
                className="fila"
                style={{ padding: '9px 4px', opacity: ya ? 0.45 : 1, cursor: ya ? 'default' : 'pointer' }}
              >
                <input
                  type="checkbox"
                  style={{ width: 22, height: 22, flex: 'none' }}
                  disabled={ya}
                  checked={ya || sel.has(p.title)}
                  onChange={() => alternarSel(p.title)}
                />
                <span style={{ fontSize: '1.2rem' }}>{p.emoji}</span>
                <span className="crece">{p.title}</span>
                <span className="chip">{ya ? 'ya está' : <Talis n={p.cost} />}</span>
              </label>
            )
          })}
        </div>
      ))}

      {fallo && <p className="error-texto" role="alert">{fallo}</p>}
      <button className="btn btn-bloque" style={{ marginTop: 12 }} disabled={porPoner === 0 || guardando} onClick={anadir}>
        {guardando ? 'Añadiendo…' : `Añadir ${porPoner} ${porPoner === 1 ? 'premio' : 'premios'}`}
      </button>
    </Modal>
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
        <label>Precio en Talis</label>
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
  const [emojiAMano, setEmojiAMano] = useState(Boolean(goal))
  const [fallo, setFallo] = useState('')

  function escribirTitulo(title) {
    setForm(emojiAMano ? { ...form, title } : { ...form, title, emoji: emojiSugerido(title, '🏆') })
  }
  const progreso = goalProgress(goal, data.completions)
  // Cerrar la meta lo decide un adulto, no el contador: se puede dar por
  // buena antes de tiempo (una noche de pizza no espera a un número). Pero
  // el botón no puede gritar «¡Conseguida!» yendo por la décima parte,
  // porque lo que cierra son tres cosas que no se deshacen: la temporada,
  // la insignia 🏰 y la subida de precios de la tienda.
  const lograda = Boolean(goal) && progreso >= goal.target_xp

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
    const aviso = lograda
      ? '¿Marcar la meta como conseguida? Todo el gremio recibirá la insignia 🏰.'
      : `¿Cerrar la meta con ${progreso} de ${goal.target_xp} XP? Se da por conseguida igualmente: ` +
        'todo el gremio recibe la insignia 🏰 y la barra vuelve a empezar.'
    if (!window.confirm(aviso)) return

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
      // Las tres columnas del índice de la 030; con dos, 42P10 y la
      // insignia 🏰 no se reparte. Ver App.jsx, mismo caso.
      .upsert(filas, { onConflict: 'profile_id,code,instance_key', ignoreDuplicates: true })
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
    // El suelo del modelo, no el techo de la peque: entre los dos está el
    // andamio de arranque, que tampoco sube. Encarecerlo no le añade
    // dificultad, le quita el sentido —ver `premiosQueSuben`—.
    const suben = premiosQueSuben(data.rewards, NIVELES[1].coste[0])
    if (!suben.length) return

    const barato = suben.reduce((a, b) => (a.cost < b.cost ? a : b))
    const subida = Math.round(SUBIDA_POR_TEMPORADA * 100)
    const aviso =
      `Nueva temporada del gremio.\n\n` +
      `¿Subir un ${subida} % el precio de los ${suben.length} premios de la tienda? ` +
      `Es lo que mantiene la dificultad ahora que el gremio produce más.\n\n` +
      `Por ejemplo, "${barato.title}" pasaría de ${barato.cost} a ${precioSiguienteTemporada(barato.cost)} Talis.\n\n` +
      `Los premios de la peque y los de arranque no se tocan.`
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
          <button
            className={'btn btn-bloque ' + (lograda ? 'btn-exito' : 'btn-fantasma')}
            style={{ marginTop: 10 }}
            onClick={conseguida}
          >
            {lograda ? '🎉 ¡Conseguida! Cerrar y celebrar' : 'Cerrar la meta y empezar otra'}
          </button>
        </div>
      )}

      <div className="carta">
        <div className="campo">
          <label>{goal ? 'Editar meta' : 'Nueva meta del gremio'}</label>
          <input
            id="meta-titulo"
            value={form.title}
            onChange={(e) => escribirTitulo(e.target.value)}
            placeholder="Noche de pizza y peli"
          />
        </div>
        <div className="campo">
          <label htmlFor="meta-emoji">Emoji <span className="emoji-elegido">{form.emoji}</span></label>
          {/* La meta usa el catálogo de los PREMIOS y no el de misiones:
              una meta del gremio es un premio compartido, no una tarea. */}
          <SelectorEmoji
            id="meta-emoji"
            valor={form.emoji}
            onElegir={(e) => { setEmojiAMano(true); setForm({ ...form, emoji: e }) }}
          />
        </div>
        <div className="campo">
          <label htmlFor="meta-xp">XP objetivo</label>
          <input
            id="meta-xp"
            type="number"
            min="100"
            step="50"
            value={form.target_xp}
            onChange={(e) => setForm({ ...form, target_xp: e.target.value })}
          />
        </div>
        <button className="btn btn-bloque" disabled={!form.title.trim()} onClick={guardar}>Guardar meta</button>
      </div>
    </div>
  )
}

/**
 * Premio a mano: Talis extra por algo que no cabía en el catálogo.
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
        <strong style={{ fontSize: '0.95rem' }}>Talis por algo excepcional</strong>
        <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar"><Icono nombre="cerrar" tamano={18} /></button>
      </div>
      <p className="suave" style={{ margin: '0 0 10px' }}>
        Suma Talis sin dar XP, así que no adelanta niveles ni la meta del gremio.
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
          <label>Talis</label>
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
        Conceder {Number(monedas) || 0} Talis
      </button>
      {problema && <p className="suave" style={{ marginTop: 6 }}>{problema}</p>}
    </div>
  )
}
