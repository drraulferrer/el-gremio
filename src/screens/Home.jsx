import { useEffect, useRef, useState } from 'react'
import { canDo, dayKey, levelProgress, FREQ_LABEL } from '../lib/supabase'
import { INSIGNIAS, PODERES, PODERES_LISTOS, insigniaPorCodigo } from '../lib/insignias'
import Poderes from '../components/Poderes'
import CaminoRacha from '../components/CaminoRacha'
import Cronica from '../components/Cronica'
import Sello from '../components/Sello'
import SellosGanados from '../components/SellosGanados'
import Colecciones from '../components/Colecciones'
import SelloDetalle, { tieneDetalle } from '../components/SelloDetalle'
import { pedirMision as pedirMisionRemota, canjearPremio, deshacerMision } from '../lib/acciones'
import { proyeccionDe } from '../lib/sellos-motor'
import { Gema, XPBar, Bolsa, Celebracion, Pestana, Talis, Plegable } from '../components/ui'
import { vibrar, LOGRO } from '../lib/vibrar'
import { talis, progresoDeTalis } from '../lib/talis'
import { HABILIDADES, habilidad, xpPorHabilidad, rangoDeHabilidad, habilidadDominante } from '../lib/habilidades'
import { flex, generoDe } from '../lib/genero'
import { planDelDia, agruparPorFrecuencia } from '../lib/misiones'
import { campanaActiva, diasRestantes, esfuerzoDeMision } from '../lib/limpieza'
import { iniciarTarea, inicioDe, olvidarTarea, restanteDe, textoDeRestante } from '../lib/temporizador'
import { flag } from '../lib/flags'
import { premiosParaMayores, ordenarPorPrecio, leerOrdenTienda, alternarOrdenTienda, ORDEN_TIENDA } from '../lib/premios'
import { muroDe, hayNuevo, leerVisita, sellarVisita } from '../lib/muro'
import DarGracias from './DarGracias'
import { retratoDe } from '../lib/retrato'
import Muro from '../components/Muro'
import Estandarte from '../components/Estandarte'
import Panorama from './Panorama'
import { semana, etiquetaDeSemana, validadasDe, resumenDeSemana, semanasConDatos } from '../lib/historial'

export default function Home({ family, data, profile, refresh, onSwitchProfile, onParent, historial }) {
  const genero = generoDe(profile)
  // Abre por el Panorama y no por las misiones. Abrir por la lista de
  // deberes decía lo mismo el día de quince misiones y el de ninguna, y
  // dejaba todo el progreso —racha, nivel, habilidades, meta— dentro de
  // una pestaña que hay que ir a buscar. Ver src/lib/panorama.js.
  const [tab, setTab] = useState('panorama')
  // El Muro: lo que le han dicho a esta persona. Se calcula aquí porque
  // el punto de la pestaña lo necesita, y se sella al entrar en Progreso.
  const elogios = muroDe({ completions: data.completions, reconocimientos: data.reconocimientos, perfiles: data.profiles }, profile.id)
  const [visto, setVisto] = useState(() => leerVisita(profile.id))
  const [dandoGracias, setDandoGracias] = useState(false)
  const muroNuevo = hayNuevo(elogios, visto)
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
        // Subir de nivel es lo que pasa una vez cada muchas veces: va
        // en el escalón grande. Si durase lo mismo que aprobar una
        // misión, no se distinguiría de un martes cualquiera.
        vibrar(LOGRO)
        setCeleb({ emoji: '💎', texto: `¡Nivel ${lvl}!`, intensidad: 'hito' })
      } else if (nuevas.length) {
        const xp = nuevas.reduce((s, c) => s + c.xp, 0)
        const monedas = nuevas.reduce((s, c) => s + (c.coins || 0), 0)
        // El elogio es lo que de verdad tiene efecto; la XP y los Talis
        // acompañan. El orden importa: primero lo que se ha ganado, y el
        // elogio debajo con más peso visual, no al revés.
        const conElogio = nuevas.find((c) => c.praise)
        vibrar(LOGRO)
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
      // Una confirmación, no un logro: no has conseguido nada, has
      // hecho algo y ha salido bien. Chispa corta y se quita de en medio.
      setCeleb({ emoji: '🛍️', texto: 'Pedido al gremio', intensidad: 'chispa' })
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

  // Dar por leído el muro. Se sella con la fecha de la ÚLTIMA frase y no
  // con «ahora»: si llega una mientras está leyendo, seguirá siendo
  // nueva. Vive aquí arriba porque lo abren dos pantallas —el Panorama y
  // Progreso— y dos copias acabarían sellando con criterios distintos.
  function sellarMuro() {
    const ultima = elogios[0]?.ts
    if (!ultima || ultima === visto) return
    sellarVisita(profile.id, ultima)
    setVisto(ultima)
  }

  const retoDe = (id) => data.challenges.find((ch) => ch.id === id)

  return (
    <div className="app">
      {celeb && <Celebracion emoji={celeb.emoji} texto={celeb.texto} elogio={celeb.elogio} intensidad={celeb.intensidad} onDone={() => setCeleb(null)} />}

      {/* El carnet y el estandarte encabezan las pestañas de trabajo,
          no el Panorama: allí ya hay una cabecera propia con el nombre,
          la racha y la bolsa, y el nivel cuelga del arco. Repetir aquí
          la misma tarjeta dejaría la cifra grande a media pantalla de
          distancia de lo alto, que es donde tiene que estar. */}
      {tab !== 'panorama' && (
        <>
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

          <Estandarte data={data} />
        </>
      )}

      {aviso && (
        <p className="error-texto" role="alert" style={{ margin: '0 4px 10px' }}>{aviso}</p>
      )}

      {tab === 'panorama' && (
        <Panorama
          data={data}
          profile={profile}
          genero={genero}
          elogios={elogios}
          muroNuevo={muroNuevo}
          onIrA={setTab}
          alVerMuro={sellarMuro}
        />
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

      {tab === 'progreso' && (
        <Progreso
          data={data}
          profile={profile}
          genero={genero}
          refresh={refresh}
          historial={historial}
          elogios={elogios}
          muroNuevo={muroNuevo}
          onDarGracias={() => setDandoGracias(true)}
          alVerMuro={sellarMuro}
        />
      )}

      {dandoGracias && (
        <DarGracias
          family={family}
          data={data}
          profile={profile}
          genero={genero}
          onHecho={refresh}
          onClose={() => setDandoGracias(false)}
        />
      )}

      <nav className="tabbar" aria-label="Secciones">
        {/* Sin punto de aviso, aunque el muro también asome en el
            Panorama: la app ABRE por esta pestaña, así que un punto aquí
            casi nunca se vería desde otro sitio, y dos puntos por lo
            mismo se leen como dos cosas pendientes. El de Progreso se
            queda, que es donde vive el muro entero. */}
        <Pestana icono="cuadro" etiqueta="Hoy" activa={tab === 'panorama'} onClick={() => setTab('panorama')} />
        <Pestana icono="misiones" etiqueta="Misiones" activa={tab === 'misiones'} onClick={() => setTab('misiones')} />
        <Pestana icono="tienda" etiqueta="Tienda" activa={tab === 'tienda'} onClick={() => setTab('tienda')} />
        <Pestana
          icono="insignias"
          etiqueta="Progreso"
          activa={tab === 'progreso'}
          punto={muroNuevo}
          onClick={() => setTab('progreso')}
        />
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
  // Las tareas de la operación de limpieza salen en su propio bloque,
  // arriba: son un acontecimiento con fecha de fin, no una única más. Con
  // la bandera apagada (o la campaña cerrada) vuelven al grupo de únicas,
  // que es donde su frecuencia las pondría: apagar el modo no le quita a
  // nadie trabajo ya encargado.
  const operacion = flag('modoLimpieza') ? campanaActiva(data.campanas || []) : null
  const deOperacion = operacion ? disponibles.filter((ch) => ch.campana_id === operacion.id) : []
  const porFrecuencia = agruparPorFrecuencia(
    operacion ? disponibles.filter((ch) => ch.campana_id !== operacion.id) : disponibles
  )
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

      {deOperacion.length > 0 && (
        <section>
          <h3 className="titulo-frecuencia">
            {operacion.emoji} {operacion.titulo}
            <span className="cuenta-frecuencia">{deOperacion.length}</span>
          </h3>
          <div className="fila-separada suave" style={{ margin: '0 4px 8px' }}>
            <span>Operación de limpieza del gremio</span>
            <span>{diasRestantes(operacion) === 1 ? 'último día' : `quedan ${diasRestantes(operacion)} días`}</span>
          </div>
          <div className="lista-misiones">
            {deOperacion.map((ch) => (
              <TareaDeOperacion
                key={ch.id}
                reto={ch}
                genero={genero}
                ocupado={ocupado}
                onPedir={onPedir}
                profileId={profile.id}
                rol={profile.role}
              />
            ))}
          </div>
        </section>
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

/**
 * Una tarea de la operación de limpieza, con su reloj.
 *
 * El flujo es el del planificador del que sale el catálogo: se pulsa
 * «Empezar», el reloj cuenta atrás lo que esa tarea pide según su
 * esfuerzo, y al terminar se marca. El reloj es una ayuda, no un
 * requisito: «¡Hecho!» está disponible desde el principio, porque una
 * tarea hecha sin reloj sigue siendo una tarea hecha.
 *
 * Dos detalles que no son opcionales:
 *  · El restante se CALCULA desde el inicio guardado en el aparato
 *    (src/lib/temporizador.js); el intervalo de un segundo solo
 *    repinta. Un contador en memoria se congela en segundo plano y se
 *    reinicia al recargar, que es la lección de mantenerPulsado.js.
 *  · Agotarse no bloquea nada: el reloj dice «¡Tiempo!» y la tarea
 *    sigue igual. Un reloj que castiga convierte la ayuda en examen.
 */
function TareaDeOperacion({ reto, genero, ocupado, onPedir, profileId, rol }) {
  // Con el rol delante, una tarea con el título personalizado recupera
  // su esfuerzo por los puntos; sin él caería a «media».
  const esf = esfuerzoDeMision(reto, rol)
  const [inicio, setInicio] = useState(() => inicioDe(profileId, reto.id))
  const [, setTic] = useState(0)

  const estado = inicio ? restanteDe(inicio, esf.temporizador) : null
  const corriendo = Boolean(estado && !estado.agotado)

  useEffect(() => {
    if (!corriendo) return
    const t = setInterval(() => setTic((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [corriendo])

  function empezar() {
    setInicio(iniciarTarea(profileId, reto.id))
  }

  function marcar() {
    olvidarTarea(profileId, reto.id)
    onPedir(reto)
  }

  return (
    <div className="carta carta-operacion">
      <div className="fila">
        <div className="avatar">{reto.emoji}</div>
        <div className="crece">
          <strong>{flex(reto.title, genero)}</strong>
          {/* Aquí los Talis SÍ se enseñan, al revés que en las misiones
              de siempre: pagar más Talis que nada es justo lo que esta
              campaña ofrece. */}
          <div className="suave">
            +{reto.xp} XP · +<Talis n={reto.coins} /> · {esf.texto}
          </div>
        </div>
      </div>
      <div className="fila" style={{ marginTop: 10 }}>
        {!inicio ? (
          <button className="btn btn-mini crece" onClick={empezar}>
            ▶ Empezar · {esf.temporizador} min
          </button>
        ) : (
          <span className={'chip chip-reloj crece' + (estado.agotado ? ' agotado' : '')} role="timer">
            {estado.agotado ? '⏰ ¡Tiempo! Márcala cuando esté' : `⏳ ${textoDeRestante(estado.ms)}`}
          </span>
        )}
        <button
          className={'btn btn-mini' + (!inicio ? ' btn-fantasma' : '')}
          disabled={ocupado === reto.id}
          onClick={marcar}
        >
          ¡Hecho!
        </button>
      </div>
    </div>
  )
}

function Tienda({ data, profile, ocupado, onCanjear }) {
  // El sentido vive en el dispositivo y no en el perfil: es una manía de
  // quien mira, no un dato del gremio, y sobrevive a cambiar de pestaña
  // —esta pantalla se vuelve a montar cada vez que se toca «Tienda»—.
  const [orden, setOrden] = useState(() => leerOrdenTienda())

  // Los premios por debajo del techo de la peque son SUYOS y no salen
  // aquí: cuestan quince o veinte Talis porque ella gana cinco al día,
  // y en esta tienda serían gratis.
  const premios = ordenarPorPrecio(premiosParaMayores(data.rewards), orden)
  const misCanjes = data.redemptions.filter((r) => r.profile_id === profile.id && r.status === 'pendiente')
  const premioDe = (id) => data.rewards.find((r) => r.id === id)
  const barato = orden === ORDEN_TIENDA.BARATO

  return (
    <div>
      <div className="fila-separada">
        <div className="titulo-seccion">Tienda del gremio</div>
        {/* Con un premio no hay nada que ordenar, y un botón que no hace
            nada visible se lee como que está roto. */}
        {premios.length > 1 && (
          <button
            className="btn btn-fantasma btn-mini"
            onClick={() => setOrden(alternarOrdenTienda(orden))}
            aria-label={
              barato
                ? 'Ordenado de más barato a más caro. Tocar para ponerlo al revés.'
                : 'Ordenado de más caro a más barato. Tocar para ponerlo al revés.'
            }
          >
            {barato ? '↑ Más barato' : '↓ Más caro'}
          </button>
        )}
      </div>
      {premios.length === 0 && (
        <div className="vacio">La tienda está vacía. Los premios se crean en el panel parental.</div>
      )}
      {premios.map((r) => (
        <div className="carta" key={r.id}>
          <div className="fila">
            <div className="avatar">{r.emoji}</div>
            <div className="crece">
              <strong>{r.title}</strong>
              <div className="suave"><Talis n={r.cost} /></div>
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

function Progreso({ data, profile, genero, refresh, historial, elogios = [], alVerMuro, onDarGracias, muroNuevo = false }) {
  // El historial va por semanas y no en una lista infinita: una lista que
  // solo crece deja de leerse al mes. Nada se archiva de verdad —los datos
  // siguen en la base—, solo sale de la vista.
  const [atras, setAtras] = useState(0)
  // El sello abierto a pantalla completa. Guarda el CÓDIGO y no el objeto
  // para que sirva igual con los del catálogo nuevo y con las dieciséis.
  const [abierto, setAbierto] = useState(null)
  const rango = semana(new Date(), atras)
  const validadas = validadasDe(data.completions, profile.id, rango)
  const resumen = resumenDeSemana(validadas)
  const tope = semanasConDatos(data.completions, profile.id)

  const mias = new Set(data.badges.filter((b) => b.profile_id === profile.id).map((b) => b.code))
  // Las que pertenecen al catálogo VIEJO, que es el que dibuja la rejilla
  // de abajo. Desde que el motor concede sellos, `mias` mezcla los dos
  // vocabularios y contar su tamaño contra 16 daba cifras imposibles.
  const misInsignias = new Set([...mias].filter((code) => insigniaPorCodigo(code)))
  // La proyección que usa el catálogo para decir cuánto falta. Sale del
  // historial COMPLETO que trae App; si todavía no ha llegado —o falló—
  // se cae al lote reciente, que basta para pintar y no para conceder.
  const proyeccion = proyeccionDe(profile, {
    completions: historial?.filas || data.completions,
    challenges: data.challenges,
    metas: data.goals || [],
    completa: Boolean(historial?.completa)
  })
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

      <Plegable
        id="hecho"
        titulo="Lo que has hecho"
        pista={resumen.misiones === 0
          ? (atras === 0 ? 'Nada validado esta semana todavía' : 'Esa semana no hubo nada')
          : `${resumen.misiones} ${resumen.misiones === 1 ? 'misión' : 'misiones'} · ${resumen.xp} XP`}
      >
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
              {resumen.misiones} {resumen.misiones === 1 ? 'misión' : 'misiones'} · {resumen.xp} XP · <Talis n={resumen.monedas} />
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

      {/* Va detrás del historial de la semana y delante de todo lo demás:
          arriba está lo que HAS HECHO, y esto es lo que te han DICHO. Las
          frases ya existían desde el primer día —se escriben al validar—,
          pero vivían colgadas de su semana y desaparecían al rodar. */}
      </Plegable>

      {/* El retrato de la semana: se calcula, no se guarda. Los sellos dan
          identidad a largo plazo y no contestan la pregunta corta —«¿en
          qué he andado yo estos días?»—, que es la que uno se hace el
          domingo. Sin cifras de lo recibido: §10.1. */}
      <p className="retrato" role="status">{retratoDe(profile.id, data).frase}</p>

      {/* La pista es la última frase recortada, no un número: enseñar
          cuántas te han dicho convertiría esto en un marcador, y es justo
          lo que §10.1 prohíbe. Y el punto no se apaga al entrar en
          Progreso sino al ABRIR esta sección: antes se daba por leído lo
          que nadie había leído. */}
      <Plegable
        id="muro"
        titulo="Lo que te han dicho"
        pista={elogios[0] ? `Lo último: “${elogios[0].texto || 'te dieron las gracias'}”` : 'Todavía nada'}
        marca={muroNuevo}
        alAbrir={alVerMuro}
      >
        <Muro elogios={elogios} challenges={data.challenges} genero={genero} />
      </Plegable>

      {/* Dar vive junto a recibir a propósito: quien acaba de leer lo que
          le han dicho es quien más cerca está de decírselo a otro. */}
      <button className="btn btn-fantasma btn-bloque" style={{ marginTop: 10 }} onClick={onDarGracias}>
        Dar las gracias a alguien
      </button>

      <Poderes data={data} profile={profile} refresh={refresh} genero={genero} />

      <SellosGanados mias={mias} onAbrir={setAbierto} />

      {/* El catálogo entero, plegado. Va detrás de «Tu historia» a
          propósito: primero lo tuyo y lo que viene ahora, y solo después
          lo que existe. Al revés, la pantalla abriría por una lista de lo
          que te falta. */}
      <details className="ver-catalogo">
        <summary>Ver el catálogo de sellos</summary>
        <Colecciones mias={mias} proyeccion={proyeccion} onAbrir={setAbierto} />
      </details>

      {/* El contador cuenta SOLO las dieciséis de esta rejilla.
          `mias` trae todo lo que tiene el perfil, y desde que el motor de
          los sellos concede eso incluye los del catálogo v1: un perfil con
          cinco viejas y ocho sellos leía «13 de 16», y al pasar de
          dieciséis sellos habría llegado a decir «20 de 16». Los sellos se
          cuentan arriba, en su propia sección. */}
      <div className="titulo-seccion">Insignias · {misInsignias.size} de {INSIGNIAS.length}</div>
      <div className="grid-insignias">
        {INSIGNIAS.map((b) => {
          const conseguida = mias.has(b.code)
          return (
          <div className={'insignia' + (conseguida ? '' : ' bloqueada')} key={b.code}>
            {conseguida && tieneDetalle(b.code) ? (
              <button className="pieza-boton" onClick={() => setAbierto(b.code)}>
                <Sello code={b.code} nombre={flex(b.name, genero)} conseguida />
              </button>
            ) : (
              <Sello code={b.code} nombre={flex(b.name, genero)} conseguida={conseguida} />
            )}
            <span className="ins-nombre">{flex(b.name, genero)}</span>
            {/* El estado va en TEXTO, no solo en el gris del sello: quien
                no distingue bien el color —o mira el móvil al sol— tiene
                que poder saber si la tiene sin adivinarlo por el tono. */}
            <span className={'ins-estado' + (conseguida ? ' ins-estado-si' : '')}>
              {conseguida ? 'Conseguida' : 'Aún no'}
            </span>
            <div className="suave" style={{ fontSize: '0.72rem', marginTop: 2 }}>{b.desc}</div>
            {/* Qué DA, no solo qué reconoce: una insignia que hace algo se
                busca, y para buscarla hay que poder leer qué hace desde
                antes de tenerla. */}
            {b.poder && PODERES_LISTOS.has(b.poder.tipo) && (
              <span className="ins-poder">{PODERES[b.poder.tipo].nombre}: {PODERES[b.poder.tipo].describe(b.poder)}</span>
            )}
          </div>
          )
        })}
      </div>

      {/* Va detrás de las insignias a propósito: el último fragmento
          explica por qué esas no se compran, y esa frase solo significa
          algo cuando ya tienes la rejilla de arriba delante. */}
      <Cronica profile={profile} progreso={progresoTalis} />

      {abierto && (
        <SelloDetalle
          code={abierto}
          concesion={data.badges.find((b) => b.profile_id === profile.id && b.code === abierto)}
          genero={genero}
          onClose={() => setAbierto(null)}
        />
      )}
    </div>
  )
}
