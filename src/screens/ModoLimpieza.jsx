import { useState } from 'react'
import { perfilesActivos } from '../lib/miembros'
import { Modal, Talis } from '../components/ui'
import Icono from '../components/Icono'
import SelectorEmoji from '../components/SelectorEmoji'
import { GRUPOS_EMOJI_MISION } from '../lib/emojis'
import { lanzarCampanaLimpieza, cerrarCampanaLimpieza } from '../lib/acciones'
import { zonasDeLaCasa, campanaDeZona, plantillaDe } from '../lib/zonas'
import {
  TIPOS,
  ESFUERZO,
  campanasDeTipo,
  tareaApta,
  repartoSugerido,
  tareasParaLanzar,
  resumenDeReparto,
  nuevaTareaPropia,
  tituloDeTareaValido,
  puedeLanzarCampana,
  campanaActiva,
  misionesDeCampana,
  progresoDeCampana,
  botinPrevisto,
  campanaVencida,
  diasRestantes
} from '../lib/limpieza'

// --------------------------------------------------------------
// Modo limpieza: lanzar y seguir una campaña desde el panel.
//
// Vive detrás del PIN como todo el panel, pero eso no basta: igual que
// el premio a mano, el formulario pregunta QUÉ ADULTO la lanza, y esa
// regla se comprueba aquí para el mensaje y en Postgres para mandar.
//
// El cierre es un botón y no un automatismo, por la misma razón que la
// subida de precios de temporada se pregunta y no se aplica sola:
// repartir el botín es un acontecimiento, y un acontecimiento que pasa
// solo mientras nadie mira deja de serlo.
// --------------------------------------------------------------

export default function ModoLimpieza({ data, refresh, onClose, onIrACasa }) {
  const activa = campanaActiva(data.campanas || [])
  // El desenlace del cierre vive AQUÍ y no en la vista de la campaña:
  // cerrar refresca los datos, con el refresco la campaña deja de estar
  // activa, y la vista que iba a enseñar la confirmación se desmonta
  // antes de que nadie la vea. Pasó en la primera verificación: el botín
  // se pagaba y el modal saltaba al asistente como si nada.
  const [cierre, setCierre] = useState(null)
  return (
    <Modal titulo="🧹 Modo limpieza" onClose={onClose}>
      {cierre ? (
        <CierreDeCampana cierre={cierre} onClose={onClose} />
      ) : activa ? (
        <CampanaEnMarcha campana={activa} data={data} refresh={refresh} onCerrada={setCierre} />
      ) : (
        <LanzarCampana data={data} refresh={refresh} onIrACasa={onIrACasa} />
      )}
    </Modal>
  )
}

function CierreDeCampana({ cierre, onClose }) {
  if (cierre.resultado === 'expirada') {
    return (
      <div>
        <p className="ok-texto" role="status">
          La operación se ha recogido. Lo que quedaba sin hacer está pausado en Misiones, y no
          hay botín: el botín es de las operaciones que se terminan.
        </p>
        <button className="btn btn-bloque" onClick={onClose}>Cerrar</button>
      </div>
    )
  }
  return (
    <div>
      <p className="ok-texto" role="status">
        🎉 ¡Operación completada! El botín ya está en la bolsa de cada participante.
      </p>
      {cierre.botin.map((b) => (
        <div className="fila" key={b.perfil.id} style={{ padding: '4px 4px' }}>
          <div className="avatar" style={{ borderColor: b.perfil.color }}>{b.perfil.emoji}</div>
          <span className="crece">{b.perfil.name}</span>
          <span>+<Talis n={b.botin} /></span>
        </div>
      ))}
      <button className="btn btn-bloque" style={{ marginTop: 10 }} onClick={onClose}>Cerrar</button>
    </div>
  )
}

// El perfil de este aparato, la misma señal que usa el resto del panel.
// Puede no ser un adulto, o no constar: en ese caso el desplegable
// arranca vacío y hay que elegir, que es mejor que atribuirlo al azar.
function adultoDelAparato(perfiles) {
  const p = perfiles.find((x) => x.id === localStorage.getItem('gremio_profile'))
  return p?.role === 'adulto' ? p.id : ''
}

function SelectorDeAdulto({ adultos, valor, onCambiar }) {
  return (
    <div className="campo">
      <label>¿Qué adulto responde por la operación?</label>
      <select value={valor} onChange={(e) => onCambiar(e.target.value)}>
        <option value="">Elegir…</option>
        {adultos.map((p) => (
          <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
        ))}
      </select>
    </div>
  )
}

function LanzarCampana({ data, refresh, onIrACasa }) {
  const gente = perfilesActivos(data.profiles).filter((p) => p.role !== 'mascota')
  const adultos = gente.filter((p) => p.role === 'adulto')

  const [tipo, setTipo] = useState(null)
  // La campaña elegida, YA construida: del catálogo si es un blitz, o
  // levantada sobre una zona de la casa si es de zona o profunda.
  const [camp, setCamp] = useState(null)
  // Quién participa. Por defecto, toda la casa: la peque incluida, que
  // para eso tiene tareas propias en el catálogo.
  const [participantes, setParticipantes] = useState(() => new Set(gente.map((p) => p.id)))
  // Las tareas ya MATERIALIZADAS: el catálogo es un punto de partida y
  // aquí cada una lleva su asignación y sus retoques (título, esfuerzo,
  // emoji). El catálogo original no se toca nunca.
  const [tareas, setTareas] = useState([])
  // Cuál está abierta en edición. Una a la vez: dos editores abiertos
  // convierten el modal en un acordeón que nadie puede leer.
  const [editando, setEditando] = useState(null)
  const [quienId, setQuienId] = useState(() => adultoDelAparato(data.profiles))
  const [lanzando, setLanzando] = useState(false)
  const [fallo, setFallo] = useState('')

  const grupo = gente.filter((p) => participantes.has(p.id))
  const filas = camp ? tareasParaLanzar(tareas, gente) : []

  function repartir(lista, quienes) {
    const sugerencia = repartoSugerido(lista, quienes)
    return lista.map((t, i) => ({ ...t, asignado: sugerencia[i] }))
  }

  function elegirCampana(c) {
    setCamp(c)
    setEditando(null)
    const quienes = gente.filter((p) => participantes.has(p.id))
    // La habitación de alguien es SUYA: si participa, sus tareas se le
    // sugieren enteras. Lo demás —y su cuarto si no participa— se
    // reparte entre el grupo como siempre.
    const dueno = c.zona?.dueno ? quienes.find((p) => p.id === c.zona.dueno) : null
    setTareas(repartir(c.tareas, dueno ? [dueno] : quienes))
  }

  function alternarParticipante(id) {
    const siguiente = new Set(participantes)
    if (siguiente.has(id)) siguiente.delete(id)
    else siguiente.add(id)
    setParticipantes(siguiente)
    // Cambiar el grupo re-reparte entero (los retoques de título,
    // esfuerzo y emoji se conservan): una asignación a medias con
    // alguien que ya no participa es peor que volver a la sugerencia.
    if (camp) setTareas(repartir(tareas, gente.filter((p) => siguiente.has(p.id))))
  }

  function asignar(indice, perfilId) {
    setTareas(tareas.map((t, i) => (i === indice ? { ...t, asignado: perfilId || null } : t)))
  }

  function editar(indice, cambios) {
    setTareas(tareas.map((t, i) => (i === indice ? { ...t, ...cambios } : t)))
  }

  function anadirPropia() {
    setTareas([...tareas, nuevaTareaPropia()])
    setEditando(tareas.length)
  }

  function quitarPropia(indice) {
    setEditando(null)
    setTareas(tareas.filter((_, i) => i !== indice))
  }

  async function lanzar() {
    setFallo('')
    const problema = puedeLanzarCampana({ quienId, perfiles: data.profiles, campanas: data.campanas || [] })
    if (problema) {
      setFallo(problema)
      return
    }
    if (!filas.length) {
      setFallo('No queda ninguna tarea asignada. Reparte algo antes de lanzar.')
      return
    }
    setLanzando(true)
    const { ok, mensaje } = await lanzarCampanaLimpieza({ activadaPor: quienId, campana: camp, tareas: filas })
    setLanzando(false)
    if (!ok) {
      setFallo(mensaje || 'No se pudo lanzar la operación.')
      return
    }
    await refresh()
  }

  // Paso 1: el formato.
  if (!tipo) {
    return (
      <div>
        <p className="suave" style={{ marginTop: 0 }}>
          Una operación de limpieza para el gremio: tareas repartidas, XP de Hogar y más Talis
          que ninguna otra misión. Si se completa entera, botín para quienes participaron.
        </p>
        {TIPOS.map((t) => (
          <button key={t.id} type="button" className="carta carta-eleccion" onClick={() => setTipo(t.id)}>
            <div className="fila">
              <div className="avatar">{t.emoji}</div>
              <div className="crece">
                <strong>{t.nombre}</strong>
                <div className="suave">{t.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    )
  }

  // Paso 2: la campaña concreta. Los blitz salen del catálogo; las de
  // zona y las profundas se levantan sobre LAS ZONAS DE ESTA CASA.
  if (!camp) {
    const nombreDe = (id) => data.profiles.find((p) => p.id === id)?.name
    return (
      <div>
        <button className="btn btn-fantasma btn-mini" onClick={() => setTipo(null)}>‹ Formato</button>

        {tipo === 'blitz'
          ? campanasDeTipo('blitz').map((c) => (
            <button key={c.clave} type="button" className="carta carta-eleccion" onClick={() => elegirCampana(c)}>
              <div className="fila">
                <div className="avatar">{c.emoji}</div>
                <div className="crece">
                  <strong>{c.titulo}</strong>
                  <div className="suave">
                    {c.tareas.length} tareas · {c.dias === 1 ? 'para hoy' : `${c.dias} días`}
                  </div>
                </div>
              </div>
            </button>
          ))
          : zonasDeLaCasa(data).map((z) => {
            const c = campanaDeZona(z, tipo === 'profunda' ? 'fondo' : 'semanal')
            return (
              <button key={c.clave} type="button" className="carta carta-eleccion" onClick={() => elegirCampana(c)}>
                <div className="fila">
                  <div className="avatar">{z.emoji}</div>
                  <div className="crece">
                    <strong>{z.nombre}</strong>
                    <div className="suave">
                      {c.tareas.length} tareas · {c.dias} días
                      {z.tipo === 'privada' && nombreDe(z.dueno) && <> · la habitación de {nombreDe(z.dueno)}</>}
                      {z.plantilla === 'generica' && <> · {plantillaDe(z).nombre.toLocaleLowerCase('es')}</>}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}

        {tipo !== 'blitz' && onIrACasa && (
          <button className="btn btn-fantasma btn-mini btn-bloque" style={{ marginTop: 8 }} onClick={onIrACasa}>
            🏠 Editar las zonas de la casa
          </button>
        )}
      </div>
    )
  }

  // Paso 3: quién participa, quién hace qué, y lanzar.
  const resumen = resumenDeReparto(tareas, grupo)

  return (
    <div>
      <button className="btn btn-fantasma btn-mini" onClick={() => setCamp(null)}>‹ Elegir otra</button>
      <div className="fila" style={{ margin: '10px 0 4px' }}>
        <span style={{ fontSize: '1.4rem' }}>{camp.emoji}</span>
        <strong className="crece">{camp.titulo}</strong>
        <span className="chip">{camp.dias === 1 ? 'hoy' : `${camp.dias} días`}</span>
      </div>

      <div className="titulo-seccion">Quién participa</div>
      <div className="fila" style={{ flexWrap: 'wrap' }}>
        {gente.map((p) => (
          <button
            key={p.id}
            type="button"
            className={'pastilla-habilidad' + (participantes.has(p.id) ? ' sel' : '')}
            aria-pressed={participantes.has(p.id)}
            onClick={() => alternarParticipante(p.id)}
          >
            {p.emoji} {p.name}
          </button>
        ))}
      </div>

      <div className="titulo-seccion">El reparto</div>
      <p className="suave" style={{ marginTop: 0 }}>
        Viene repartido para equilibrar el tiempo de cada cual. Con el lápiz se retoca una
        tarea para esta casa —el nombre, el esfuerzo, el dibujo—, y «fuera» la deja para
        otra vez.
      </p>
      {tareas.map((tarea, i) => {
        const aptos = grupo.filter((p) => tareaApta(tarea, p))
        const sinNombre = !tituloDeTareaValido(tarea.t)
        return (
          <div key={i}>
            <div className="fila fila-reparto">
              <span style={{ fontSize: '1.15rem' }}>{tarea.e}</span>
              <div className="crece">
                <div>{sinNombre ? <em className="suave">Ponle nombre a esta tarea…</em> : tarea.t}</div>
                <div className="suave" style={{ fontSize: '0.76rem' }}>
                  {ESFUERZO[tarea.esf].texto}
                  {tarea.propia && ' · tarea de esta casa'}
                </div>
              </div>
              <button
                className={'btn-icono' + (editando === i ? ' activo' : '')}
                onClick={() => setEditando(editando === i ? null : i)}
                aria-expanded={editando === i}
                aria-label={`Editar ${tarea.t || 'la tarea nueva'}`}
              >
                <Icono nombre="editar" />
              </button>
              <select
                value={tarea.asignado || ''}
                onChange={(e) => asignar(i, e.target.value)}
                aria-label={`Quién hace: ${tarea.t || 'la tarea nueva'}`}
              >
                <option value="">— fuera</option>
                {aptos.map((p) => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                ))}
              </select>
            </div>

            {editando === i && (
              <EditorDeTarea
                tarea={tarea}
                onCambiar={(cambios) => editar(i, cambios)}
                onQuitar={tarea.propia ? () => quitarPropia(i) : null}
                onListo={() => setEditando(null)}
              />
            )}
          </div>
        )
      })}

      {/* El hueco «{Agrega los tuyos}» del planificador original: cada
          casa limpia cosas que ningún catálogo conoce. */}
      <button className="btn btn-fantasma btn-mini btn-bloque" style={{ marginTop: 8 }} onClick={anadirPropia}>
        + Añadir una tarea de esta casa
      </button>

      {resumen.length > 0 && (
        <>
          <div className="titulo-seccion">Lo que se lleva cada cual</div>
          {resumen.map((r) => (
            <div className="fila" key={r.perfil.id} style={{ padding: '4px 4px' }}>
              <div className="avatar" style={{ borderColor: r.perfil.color }}>{r.perfil.emoji}</div>
              <span className="crece">{r.perfil.name}</span>
              <span className="suave">
                {r.tareas} {r.tareas === 1 ? 'tarea' : 'tareas'} · ~{r.minutos} min · +{r.xp} XP · +<Talis n={r.coins} />
              </span>
            </div>
          ))}
          <p className="suave" style={{ fontSize: '0.8rem' }}>
            Y si la operación se completa entera, cada cual se lleva de botín la mitad de sus
            Talis ganados.
          </p>
        </>
      )}

      <SelectorDeAdulto adultos={adultos} valor={quienId} onCambiar={setQuienId} />

      {fallo && <p className="error-texto" role="alert">{fallo}</p>}
      <button
        className="btn btn-bloque"
        disabled={lanzando || filas.length === 0 || !quienId}
        onClick={lanzar}
      >
        {lanzando ? 'Lanzando…' : `🧹 Lanzar la operación (${filas.length} ${filas.length === 1 ? 'tarea' : 'tareas'})`}
      </button>
    </div>
  )
}

/**
 * Retocar una tarea para esta casa: el nombre, el esfuerzo y el dibujo.
 *
 * Lo que NO se edita aquí es deliberado:
 *  · Los roles aptos del catálogo: renombrar «Limpiar el horno» no lo
 *    vuelve apto para la junior. La seguridad no se rebautiza.
 *  · Los puntos: salen del esfuerzo y del rol, como en todo el sistema.
 *    El esfuerzo es la palanca honesta para «esta tarea aquí es más
 *    gorda», y arrastra también el reloj.
 */
function EditorDeTarea({ tarea, onCambiar, onQuitar, onListo }) {
  return (
    <div className="editor-tarea">
      <div className="campo">
        <label>Cómo se llama en esta casa</label>
        <input
          value={tarea.t}
          maxLength={120}
          autoFocus
          placeholder="Limpiar la pecera, ordenar el trastero…"
          onChange={(e) => onCambiar({ t: e.target.value })}
        />
      </div>

      <div className="campo">
        <label>Esfuerzo · decide los puntos y el reloj</label>
        <div className="fila" style={{ flexWrap: 'wrap' }}>
          {Object.values(ESFUERZO).map((esf) => (
            <button
              key={esf.id}
              type="button"
              className={'pastilla-habilidad' + (tarea.esf === esf.id ? ' sel' : '')}
              aria-pressed={tarea.esf === esf.id}
              onClick={() => onCambiar({ esf: esf.id })}
            >
              {esf.nombre} · {esf.texto}
            </button>
          ))}
        </div>
      </div>

      <div className="campo">
        <label>El dibujo</label>
        <SelectorEmoji
          valor={tarea.e}
          onElegir={(e) => onCambiar({ e })}
          id="emoji-tarea-limpieza"
          grupos={GRUPOS_EMOJI_MISION}
          ejemplos="escoba, plancha, coche"
        />
      </div>

      <div className="fila">
        <button className="btn btn-mini crece" onClick={onListo}>Listo</button>
        {onQuitar && (
          <button className="btn btn-fantasma btn-mini" onClick={onQuitar}>Quitar esta tarea</button>
        )}
      </div>
    </div>
  )
}

function CampanaEnMarcha({ campana, data, refresh, onCerrada }) {
  const adultos = perfilesActivos(data.profiles).filter((p) => p.role === 'adulto')
  const [quienId, setQuienId] = useState(() => adultoDelAparato(data.profiles))
  const [cerrando, setCerrando] = useState(false)
  const [fallo, setFallo] = useState('')

  const misiones = misionesDeCampana(campana, data.challenges)
  const progreso = progresoDeCampana(campana, data.challenges, data.completions)
  const botin = botinPrevisto(campana, data.challenges, data.completions)
  const vencio = campanaVencida(campana)
  const dias = diasRestantes(campana)
  const perfilDe = (id) => data.profiles.find((p) => p.id === id)

  // Por persona: cuántas de las suyas están ya aprobadas.
  const porPersona = [...new Set(misiones.map((m) => m.profile_id))]
    .map((id) => {
      const suyas = misiones.filter((m) => m.profile_id === id)
      const hechas = suyas.filter((m) =>
        data.completions.some((c) => c.challenge_id === m.id && c.status === 'aprobado')
      ).length
      return { perfil: perfilDe(id), total: suyas.length, hechas }
    })
    .filter((x) => x.perfil)

  async function cerrar() {
    setFallo('')
    setCerrando(true)
    const { ok, resultado, mensaje } = await cerrarCampanaLimpieza({ campanaId: campana.id, quienId })
    setCerrando(false)
    if (!ok) {
      setFallo(mensaje || 'No se pudo cerrar la operación.')
      // Se refresca TAMBIÉN al fallar: si otro adulto cerró un segundo
      // antes desde su móvil, la respuesta es 'ya_cerrada' y lo honesto
      // es que esta pantalla pase a contar la verdad, no quedarse
      // enseñando una campaña que ya no existe.
      await refresh()
      return
    }
    // El botín se resuelve AHORA, antes de refrescar: con los datos
    // nuevos la campaña ya no está activa y esta vista desaparece.
    onCerrada({
      resultado,
      botin: botin.map((b) => ({ perfil: perfilDe(b.profileId), botin: b.botin })).filter((b) => b.perfil)
    })
    await refresh()
  }

  return (
    <div>
      <div className="fila" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: '1.4rem' }}>{campana.emoji}</span>
        <strong className="crece">{campana.titulo}</strong>
        <span className="chip">
          {vencio ? 'fuera de plazo' : dias === 1 ? 'último día' : `quedan ${dias} días`}
        </span>
      </div>

      <div className="xpbar" aria-label={`${progreso.aprobadas} de ${progreso.total} tareas validadas`}>
        <div
          className="xpbar-fill"
          style={{ width: progreso.total ? Math.round((100 * progreso.aprobadas) / progreso.total) + '%' : '0%' }}
        />
        <div className="xpbar-pips"><span /><span /><span /><span /><span /></div>
      </div>
      <div className="fila-separada suave" style={{ marginTop: 4, marginBottom: 10 }}>
        <span>{progreso.aprobadas} de {progreso.total} validadas</span>
        {progreso.pendientes > 0 && <span>⏳ {progreso.pendientes} por validar</span>}
      </div>

      {porPersona.map((x) => (
        <div className="fila" key={x.perfil.id} style={{ padding: '4px 4px' }}>
          <div className="avatar" style={{ borderColor: x.perfil.color }}>{x.perfil.emoji}</div>
          <span className="crece">{x.perfil.name}</span>
          <span className="suave">{x.hechas} de {x.total}</span>
        </div>
      ))}

      {botin.length > 0 && (
        <>
          <div className="titulo-seccion">Botín previsto</div>
          {botin.map((b) => {
            const p = perfilDe(b.profileId)
            return (
              <div className="fila" key={b.profileId} style={{ padding: '4px 4px' }}>
                <div className="avatar" style={{ borderColor: p?.color }}>{p?.emoji}</div>
                <span className="crece">{p?.name}</span>
                <span className="suave">+<Talis n={b.botin} /> si se completa</span>
              </div>
            )
          })}
        </>
      )}

      {progreso.completa ? (
        <>
          <SelectorDeAdulto adultos={adultos} valor={quienId} onCambiar={setQuienId} />
          {fallo && <p className="error-texto" role="alert">{fallo}</p>}
          <button className="btn btn-bloque" disabled={cerrando || !quienId} onClick={cerrar}>
            {cerrando ? 'Cerrando…' : '🎉 Repartir el botín'}
          </button>
        </>
      ) : vencio ? (
        <>
          <p className="suave">
            Se acabó el plazo con tareas sin hacer. Recogerla pausa lo pendiente y cierra la
            operación sin botín; lo ya validado se queda, claro.
          </p>
          <SelectorDeAdulto adultos={adultos} valor={quienId} onCambiar={setQuienId} />
          {fallo && <p className="error-texto" role="alert">{fallo}</p>}
          <button className="btn btn-bloque" disabled={cerrando || !quienId} onClick={cerrar}>
            Recoger la campaña
          </button>
        </>
      ) : (
        <p className="suave">
          El botín se reparte cuando estén todas validadas. Las tareas salen en el tablero de
          cada cual, y se validan en la pestaña Validar como cualquier misión.
        </p>
      )}
    </div>
  )
}
