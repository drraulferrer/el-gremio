import { useEffect, useState } from 'react'
import { canDo, dayKey } from '../lib/supabase'
import { estrellaInmediata, deshacerMision } from '../lib/acciones'
import { tocarEstrella, sonidoActivo, alternarSonido } from '../lib/sonido'
import { log } from '../lib/log'
import Icono from '../components/Icono'
import { useMantenerPulsado } from '../lib/mantenerPulsado'
import { flex, generoDe } from '../lib/genero'
import { sugerenciasDeElogio, rachaDeMision } from '../lib/elogio'

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

  const misiones = data.challenges.filter(
    (ch) => ch.active && (ch.profile_id === profile.id || ch.profile_id === null)
  )

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
        <span className="kid-avatar" style={{ background: profile.color }}>{profile.emoji}</span>
        <div className="crece">
          <h1 className="kid-nombre">{profile.name}</h1>
          <div className="kid-estrellas" aria-label={`${estrellasHoy} estrellas hoy`}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={'kid-estrella' + (i < estrellasHoy ? ' llena' : '')}>★</span>
            ))}
            {estrellasHoy > 5 && <span className="kid-mas">+{estrellasHoy - 5}</span>}
          </div>
        </div>
        <BotonSonido activo={conSonido} onCambiar={() => setConSonido(alternarSonido())} />
      </header>

      {fallo && <p className="kid-fallo">{fallo}</p>}

      {misiones.length === 0 && (
        <div className="kid-vacio">
          <span className="kid-vacio-emoji">🎈</span>
          <p>Todavía no hay tareas. Los adultos las añaden desde el panel.</p>
        </div>
      )}

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
