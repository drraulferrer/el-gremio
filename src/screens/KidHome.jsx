import { useEffect, useState } from 'react'
import { canDo, dayKey } from '../lib/supabase'
import { estrellaInmediata, deshacerMision, canjearPremio, cobrarGlobos } from '../lib/acciones'
import { tocarEstrella, sonidoActivo, alternarSonido } from '../lib/sonido'
import { log } from '../lib/log'
import Icono from '../components/Icono'
import { useMantenerPulsado } from '../lib/mantenerPulsado'
import { flex, generoDe } from '../lib/genero'
import { premiosParaPeque, estrellasDe, estrellasQueCuesta } from '../lib/premios'
import { sugerenciasDeElogio, rachaDeMision } from '../lib/elogio'
import { misionesDe } from '../lib/misiones'
import { estadoDelJuego, siguientePremio, esDeHoy, juegoDelDia, diaCompleto, claveFiesta } from '../lib/juego'
import Juego from './JuegosPeque'
import FichaPeque from './FichaPeque'
import { debeLatir, leerLatido, contarApertura, sellarPrimeraVez } from '../lib/latido'

// ------------------------------------------------------------------
// Pantalla de la peque (3 años).
//
// Reglas de diseño, todas por su edad y no por gusto estético:
//  - No sabe leer: manda el dibujo. El texto está para el adulto que pasa.
//  - Dedo pequeño y poca puntería: cada botón ocupa media pantalla de ancho
//    y pasa de 150 px de alto, muy por encima del mínimo de 48.
//  - La recompensa es inmediata: estrella, sonido y animación en el acto.
//    Esperar validación a los tres años equivale a no recompensar.
//  - No hay pestañas, ni tienda, ni números de XP: nada que la saque de
//    aquí por accidente. Para salir hay que mantener pulsado, que es un
//    gesto que a esta edad no se hace sin querer.
// ------------------------------------------------------------------

const HOLD_MS = 1500

export default function KidHome({ family, data, profile, refresh, onSalir }) {
  const genero = generoDe(profile)
  const [celebrando, setCelebrando] = useState(null)
  const [ocupado, setOcupado] = useState(null)
  const [fallo, setFallo] = useState('')
  const [conSonido, setConSonido] = useState(() => sonidoActivo())
  const [verTarro, setVerTarro] = useState(false)
  const [jugando, setJugando] = useState(false)
  const [verFicha, setVerFicha] = useState(false)
  // El latido señala un gesto que no se ve, y se apaga solo: ver
  // src/lib/latido.js. Se lee UNA vez al montar y no en cada render, o
  // abrir la ficha no volvería a pintar la cabecera.
  const [latido, setLatido] = useState(() => debeLatir(leerLatido(profile.id)))

  useEffect(() => {
    sellarPrimeraVez(profile.id)
  }, [profile.id])

  function abrirFicha() {
    const aperturas = contarApertura(profile.id)
    setLatido(debeLatir({ ...leerLatido(profile.id), aperturas }))
    setVerFicha(true)
  }

  // Solo las de hoy: a los tres años una baldosa que no toca no se puede
  // explicar («hoy esa no») y se toca igual. Que no esté es la única forma
  // de que la pantalla siga diciendo la verdad completa, que es lo que
  // hace que la fiesta de «ya están todas» signifique algo.
  const misiones = misionesDe(profile, data.challenges, { dia: new Date() })

  const hoy = dayKey(new Date())
  const estrellasHoy = data.completions.filter(
    (c) =>
      c.profile_id === profile.id &&
      c.status === 'aprobado' &&
      c.resolved_at &&
      dayKey(new Date(c.resolved_at)) === hoy
  ).length

  useEffect(() => {
    log.info('peque.pantalla_abierta', { profile_id: profile.id, misiones: misiones.length })
  }, [profile.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deshacer un toque equivocado. Se pide mantener pulsado, el mismo gesto
  // que para salir: a los tres años no se hace sin querer, y así una
  // estrella dada por error no obliga a entrar en el panel.
  async function deshacer(reto) {
    const suya = data.completions
      .filter(
        (c) =>
          c.challenge_id === reto.id &&
          c.profile_id === profile.id &&
          c.status === 'aprobado' &&
          c.resolved_at &&
          dayKey(new Date(c.resolved_at)) === hoy
      )
      .sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at))[0]

    if (!suya) return
    setFallo('')
    const { ok, mensaje } = await deshacerMision(suya.id)
    if (ok) await refresh()
    else setFallo(mensaje || 'No se pudo deshacer.')
  }

  const premios = premiosParaPeque(data.rewards)
  const guardadas = estrellasDe(profile.coins)
  const proximo = siguientePremio(premios, guardadas, (p) => estrellasQueCuesta(p.cost))

  // Las hechas hoy, contadas sobre SUS misiones de hoy: si se contaran
  // todas las completions daría igual repetir la misma, y la meta se
  // alcanzaría tocando cinco veces la misma baldosa.
  const hechasHoy = misiones.filter((m) => !canDo(m, data.completions, profile.id)).length
  const yaCobrado = (data.bonuses || []).some(
    (b) => b.profile_id === profile.id && b.tipo === 'globos' && esDeHoy(b.dia, hoy)
  )
  const juego = estadoDelJuego({ total: misiones.length, hechas: hechasHoy, yaCobrado })
  const cual = juegoDelDia(hoy)

  // La fiesta del día redondo. Se marca en el dispositivo y no en la base
  // porque es puramente cosmética: que salga dos veces si se abre en la
  // tablet y en el móvil no rompe nada, y a cambio no cuesta una tabla.
  const [fiesta, setFiesta] = useState(false)
  const completo = diaCompleto({ total: misiones.length, hechas: hechasHoy })

  useEffect(() => {
    if (!completo) return
    const clave = claveFiesta(profile.id, hoy)
    if (localStorage.getItem(clave)) return
    localStorage.setItem(clave, '1')
    setFiesta(true)
    log.info('peque.dia_completo', { profile_id: profile.id, misiones: misiones.length })
  }, [completo, profile.id, hoy]) // eslint-disable-line react-hooks/exhaustive-deps

  async function terminarJuego() {
    setJugando(false)
    const { ok, yaHoy, mensaje } = await cobrarGlobos(profile.id)
    if (ok) {
      tocarEstrella()
      setCelebrando({ emoji: cual?.emoji || '🎈', title: '¡Una estrella más!', elogio: '¡Lo has conseguido!' })
      await refresh()
    } else if (!yaHoy) {
      setFallo(mensaje || 'Uy, la estrella de los globos no se pudo guardar.')
    }
  }

  async function pedirPremio(premio) {
    setFallo('')
    const { ok, mensaje } = await canjearPremio({ premio, profile })
    if (ok) {
      tocarEstrella()
      setVerTarro(false)
      setCelebrando({ emoji: premio.emoji, elogio: '¡Se lo decimos a mamá y a papá!' })
      await refresh()
    } else {
      setFallo(mensaje || 'Uy, ahora mismo no se puede.')
    }
  }

  async function pulsar(reto) {
    if (ocupado) return
    setOcupado(reto.id)
    setFallo('')

    // Su misión se aprueba sola, así que aquí no hay adulto que escriba el
    // elogio: lo genera la app, concreto y en el momento, y se guarda igual
    // que el de un adulto para que quede en su historial.
    const racha = rachaDeMision(reto.id, profile.id, data.completions)
    const elogio = flex(sugerenciasDeElogio({ reto, racha })[0], genero)

    const { ok, mensaje } = await estrellaInmediata({ family, profile, reto, elogio })
    if (ok) {
      tocarEstrella()
      setCelebrando({ ...reto, elogio })
      await refresh()
    } else {
      setFallo(mensaje || 'Uy, no se pudo guardar. Avisa a mamá o papá.')
    }
    setOcupado(null)
  }

  return (
    <div className="kid">
      {celebrando && <CelebracionPeque reto={celebrando} onDone={() => setCelebrando(null)} />}

      <header className="kid-cabecera">
        <button
          className={'kid-avatar' + (latido ? ' latiendo' : '')}
          style={{ background: profile.color }}
          onClick={abrirFicha}
          aria-label={`Ver lo que ha hecho ${profile.name}`}
        >
          {profile.emoji}
        </button>
        <div className="crece">
          <h1 className="kid-nombre">{profile.name}</h1>
          <div className="kid-estrellas" aria-label={`${estrellasHoy} estrellas hoy`}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={'kid-estrella' + (i < estrellasHoy ? ' llena' : '')}>★</span>
            ))}
            {estrellasHoy > 5 && <span className="kid-mas">+{estrellasHoy - 5}</span>}
          </div>
        </div>
        <Tarro estrellas={guardadas} onAbrir={() => setVerTarro(true)} />
        <BotonSonido activo={conSonido} onCambiar={() => setConSonido(alternarSonido())} />
      </header>

      {fallo && <p className="kid-fallo">{fallo}</p>}

      {misiones.length === 0 && (
        <div className="kid-vacio">
          <span className="kid-vacio-emoji">🎈</span>
          <p>Todavía no hay tareas. Los adultos las añaden desde el panel.</p>
        </div>
      )}

      {/* Encima de las baldosas y no debajo: son las dos cosas que
          contestan «¿para qué?» y «¿qué gano ahora?», y ahí abajo
          obligaban a bajar la pantalla para verlas, justo por donde pasa
          la barra fija de salida. */}
      {proximo && (
        <MetaPeque proximo={proximo} estrellas={guardadas} onAbrir={() => setVerTarro(true)} />
      )}

      {misiones.length > 0 && <Globos juego={juego} cual={cual} onJugar={() => setJugando(true)} />}

      <div className="kid-grid">
        {misiones.map((ch) => {
          const disponible = canDo(ch, data.completions, profile.id)
          return (
            <BaldosaPeque
              key={ch.id}
              reto={ch}
              disponible={disponible}
              ocupado={ocupado === ch.id}
              onPulsar={() => pulsar(ch)}
              onDeshacer={() => deshacer(ch)}
              genero={genero}
            />
          )
        })}
      </div>

      {verTarro && (
        <TiendaPeque
          estrellas={guardadas}
          premios={premios}
          onPedir={pedirPremio}
          onCerrar={() => setVerTarro(false)}
        />
      )}

      {verFicha && (
        <FichaPeque data={data} profile={profile} genero={genero} onCerrar={() => setVerFicha(false)} />
      )}

      {jugando && <Juego id={cual?.id} onTerminar={terminarJuego} onCerrar={() => setJugando(false)} />}

      {fiesta && <FiestaDelDia onCerrar={() => setFiesta(false)} />}

      <SalidaAdulta onSalir={onSalir} />
    </div>
  )
}

/**
 * Una baldosa. Si está disponible, un toque la completa. Si ya está
 * hecha, un toque no hace nada (para que no la "descomplete" sin querer)
 * pero mantener pulsado 1,5 s la deshace: gesto de adulto.
 */
function BaldosaPeque({ reto, disponible, ocupado, onPulsar, onDeshacer, genero }) {
  const { progreso, manejadores } = useMantenerPulsado(onDeshacer, HOLD_MS)
  const sostenible = !disponible && !ocupado

  return (
    <button
      className={'kid-boton' + (disponible ? '' : ' hecha')}
      disabled={ocupado}
      onClick={() => disponible && onPulsar()}
      {...(sostenible ? manejadores : {})}
      aria-label={flex(reto.title, genero) + (disponible ? '' : ' (ya hecha, mantén pulsado para deshacer)')}
    >
      {progreso > 0 && (
        <span className="kid-deshacer" style={{ transform: `scaleX(${progreso / 100})` }} aria-hidden="true" />
      )}
      <span className="kid-boton-emoji">{reto.emoji}</span>
      <span className="kid-boton-texto">{flex(reto.title, genero)}</span>
      <span className="kid-boton-marca">{disponible ? '★' : '✓'}</span>
    </button>
  )
}

/**
 * El tarro. Las estrellas se quedan aquí de un día para otro, que es lo
 * que le da sentido a esperar: el contador de arriba se vacía cada noche,
 * este no. Se dibujan hasta doce y a partir de ahí el tarro se ve lleno;
 * no hay número por ninguna parte.
 */
function Tarro({ estrellas, onAbrir }) {
  const dibujadas = Math.min(estrellas, 12)
  return (
    <button className="kid-tarro" onClick={onAbrir} aria-label={`Tu tarro: ${estrellas} estrellas guardadas`}>
      <span className="kid-tarro-cristal">
        {Array.from({ length: dibujadas }, (_, i) => (
          <span key={i} className="kid-tarro-estrella" style={{ '--i': i }}>★</span>
        ))}
      </span>
      {estrellas > 12 && <span className="kid-tarro-lleno">★</span>}
    </button>
  )
}

/**
 * Su tienda. Sin precios en números: cada premio enseña una fila de
 * estrellas, las que ya tiene encendidas y las que faltan apagadas. Se
 * ve de un vistazo cuánto queda sin saber contar.
 */
function TiendaPeque({ estrellas, premios, onPedir, onCerrar }) {
  return (
    <div className="kid-tienda" role="dialog" aria-label="Tus premios">
      <div className="kid-tienda-cabecera">
        <span className="kid-tienda-titulo">Tus estrellas</span>
        <div className="kid-tienda-guardadas" aria-hidden="true">
          {Array.from({ length: Math.min(estrellas, 12) }, (_, i) => (
            <span key={i}>★</span>
          ))}
          {estrellas === 0 && <span className="kid-tienda-vacio">Todavía ninguna</span>}
        </div>
        <button className="kid-tienda-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <Icono nombre="cerrar" tamano={28} />
        </button>
      </div>

      {premios.length === 0 && (
        <p className="kid-tienda-vacio">
          Aún no hay premios. Los adultos los ponen en el panel.
        </p>
      )}

      <div className="kid-tienda-lista">
        {premios.map((p) => {
          const cuesta = estrellasQueCuesta(p.cost)
          const alcanza = estrellas >= cuesta
          return (
            <button
              key={p.id}
              className={'kid-premio' + (alcanza ? ' alcanza' : '')}
              disabled={!alcanza}
              onClick={() => onPedir(p)}
              aria-label={`${p.title}. ${alcanza ? 'Ya puedes pedirlo' : `Te faltan ${cuesta - estrellas} estrellas`}`}
            >
              <span className="kid-premio-emoji">{p.emoji}</span>
              <span className="kid-premio-texto">{p.title}</span>
              <span className="kid-premio-precio" aria-hidden="true">
                {Array.from({ length: cuesta }, (_, i) => (
                  <span key={i} className={i < estrellas ? 'llena' : ''}>★</span>
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BotonSonido({ activo, onCambiar }) {
  return (
    <button
      className="kid-sonido"
      onClick={onCambiar}
      aria-label={activo ? 'Silenciar' : 'Activar sonido'}
      title={activo ? 'Silenciar' : 'Activar sonido'}
    >
      <Icono nombre={activo ? 'sonido' : 'silencio'} tamano={24} />
    </button>
  )
}

/**
 * Salida protegida: hay que mantener el dedo un segundo y medio. No es
 * seguridad, es un filtro de edad: evita el toque accidental sin obligar
 * a un adulto a teclear un PIN cada vez que recoge la tablet.
 */
function SalidaAdulta({ onSalir }) {
  const { progreso, manejadores } = useMantenerPulsado(onSalir, HOLD_MS)

  return (
    <button className="kid-salida" {...manejadores}>
      <span className="kid-salida-relleno" style={{ transform: `scaleX(${progreso / 100})` }} />
      <span className="kid-salida-texto">Para adultos: mantén pulsado</span>
    </button>
  )
}

const CONFETI = ['⭐', '✨', '🌟', '🎉', '💫', '🎈', '⭐', '✨', '🌟', '🎉', '💫', '🎈']

function CelebracionPeque({ reto, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="kid-celebracion" onClick={onDone} role="presentation">
      {CONFETI.map((e, i) => {
        const ang = (i / CONFETI.length) * Math.PI * 2
        const dist = 140 + (i % 3) * 60
        return (
          <span
            key={i}
            className="kid-confeti"
            style={{ '--dx': Math.cos(ang) * dist + 'px', '--dy': Math.sin(ang) * dist + 'px' }}
          >
            {e}
          </span>
        )
      })}
      <div className="kid-celebracion-caja">
        <span className="kid-celebracion-emoji">{reto.emoji}</span>
        <span className="kid-celebracion-estrella">★</span>
        <span className="kid-celebracion-texto">{reto.elogio || '¡Muy bien!'}</span>
      </div>
    </div>
  )
}

/**
 * La tira del siguiente premio. La tienda ya enseña todos, pero hay que
 * abrirla; esto contesta «¿para qué estoy haciendo esto?» sin salir de la
 * pantalla donde toca las baldosas.
 *
 * Un solo premio, el más cercano, y las estrellas dibujadas en vez de
 * escritas: a los tres años «te faltan 2» no significa nada y dos huecos
 * apagados sí.
 */
function MetaPeque({ proximo, estrellas, onAbrir }) {
  const { premio, cuesta, alcanza } = proximo
  const faltan = Math.max(0, cuesta - estrellas)

  return (
    <button
      className={'kid-meta' + (alcanza ? ' lograda' : '')}
      onClick={onAbrir}
      aria-label={
        alcanza
          ? `Ya puedes pedir ${premio.title}`
          : `Siguiente premio: ${premio.title}. Te faltan ${faltan} estrellas`
      }
    >
      <span className="kid-meta-emoji">{premio.emoji}</span>
      <span className="kid-meta-texto">
        <span className="kid-meta-titulo">{premio.title}</span>
        <span className="kid-meta-estrellas" aria-hidden="true">
          {Array.from({ length: Math.min(cuesta, 10) }, (_, i) => (
            <span key={i} className={i < estrellas ? 'llena' : ''}>★</span>
          ))}
        </span>
      </span>
      {alcanza && <span className="kid-meta-listo" aria-hidden="true">¡YA!</span>}
    </button>
  )
}

/**
 * El acceso al juego. Tres estados y ninguno es un error:
 *  - cerrado: enseña cuántas misiones faltan, con globos apagados;
 *  - abierto: late, y es lo único que late en la pantalla;
 *  - cobrado: sigue visible pero en calma, porque «ya salió hoy» tiene que
 *    poder distinguirse de «no has llegado».
 */
function Globos({ juego, cual, onJugar }) {
  if (juego.meta === 0) return null
  const emoji = cual?.emoji || '🎈'

  if (juego.cobrado) {
    return (
      <div className="kid-globos hecho" role="status">
        <span className="kid-globos-emoji" aria-hidden="true">{emoji}</span>
        <span className="kid-globos-texto">{cual?.hecho || '¡Ya salió hoy!'}</span>
      </div>
    )
  }

  if (!juego.disponible) {
    return (
      <div className="kid-globos cerrado" role="status" aria-label={`Te faltan ${juego.faltan} misiones para el juego`}>
        <span className="kid-globos-emoji" aria-hidden="true">{emoji}</span>
        <span className="kid-globos-texto" aria-hidden="true">
          {Array.from({ length: juego.meta }, (_, i) => (
            <span key={i} className={'kid-globos-punto' + (i < juego.hechas ? ' hecho' : '')} />
          ))}
        </span>
      </div>
    )
  }

  return (
    <button className="kid-globos abierto" onClick={onJugar} aria-label={cual?.llamada || '¡A jugar!'}>
      <span className="kid-globos-emoji" aria-hidden="true">{emoji}</span>
      <span className="kid-globos-texto">{cual?.llamada || '¡A jugar!'}</span>
    </button>
  )
}

/**
 * La fiesta del día redondo: todas las misiones hechas.
 *
 * Existe porque el premio intermedio llega a la mitad y a partir de ahí el
 * tramo final se quedaba sin nada que lo empujara. Si la última misión
 * celebra igual que la primera, no hay razón para llegar al final.
 *
 * Se cierra sola a los seis segundos, y también con un toque en cualquier
 * sitio: nada que obligue a acertar un botón para salir.
 */
function FiestaDelDia({ onCerrar }) {
  useEffect(() => {
    const t = setTimeout(onCerrar, 6000)
    return () => clearTimeout(t)
  }, [onCerrar])

  // Posiciones y retardos fijos, no aleatorios: así la animación es la
  // misma cada tarde y ella la reconoce, que a esta edad es la mitad de
  // la gracia.
  const confeti = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: (i * 37) % 100,
    retardo: (i % 6) * 0.18,
    giro: i % 2 ? 1 : -1,
    color: ['#ff6b6b', '#ffd166', '#6ee7a0', '#7fb3ff', '#c9a0ff'][i % 5]
  }))

  return (
    <div className="kid-fiesta" role="dialog" aria-label="¡Has terminado todas las tareas de hoy!" onClick={onCerrar}>
      <div className="kid-fiesta-confeti" aria-hidden="true">
        {confeti.map((c) => (
          <span
            key={c.id}
            className="kid-papelito"
            style={{
              left: `${c.x}%`,
              background: c.color,
              animationDelay: `${c.retardo}s`,
              '--giro': c.giro
            }}
          />
        ))}
      </div>
      <div className="kid-fiesta-centro">
        <span className="kid-fiesta-emoji" aria-hidden="true">🏆</span>
        <p className="kid-fiesta-texto">¡Todo hecho!</p>
        <div className="kid-fiesta-estrellas" aria-hidden="true">
          <span>★</span><span>★</span><span>★</span>
        </div>
      </div>
    </div>
  )
}
