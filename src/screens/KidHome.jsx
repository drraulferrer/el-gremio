import { useEffect, useRef, useState } from 'react'
import { canDo, dayKey } from '../lib/supabase'
import { estrellaInmediata } from '../lib/acciones'
import { tocarEstrella, sonidoActivo, alternarSonido } from '../lib/sonido'
import { log } from '../lib/log'
import Icono from '../components/Icono'

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

  async function pulsar(reto) {
    if (ocupado) return
    setOcupado(reto.id)
    setFallo('')

    const { ok, mensaje } = await estrellaInmediata({ family, profile, reto })
    if (ok) {
      tocarEstrella()
      setCelebrando(reto)
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
            <button
              key={ch.id}
              className={'kid-boton' + (disponible ? '' : ' hecha')}
              disabled={!disponible || ocupado === ch.id}
              onClick={() => pulsar(ch)}
              aria-label={ch.title + (disponible ? '' : ' (ya hecha)')}
            >
              <span className="kid-boton-emoji">{ch.emoji}</span>
              <span className="kid-boton-texto">{ch.title}</span>
              <span className="kid-boton-marca">{disponible ? '★' : '✓'}</span>
            </button>
          )
        })}
      </div>

      <SalidaAdulta onSalir={onSalir} />
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
  const [progreso, setProgreso] = useState(0)
  const inicio = useRef(null)
  const raf = useRef(null)

  function empezar() {
    inicio.current = Date.now()
    const tick = () => {
      const transcurrido = Date.now() - inicio.current
      const pct = Math.min(100, (transcurrido / HOLD_MS) * 100)
      setProgreso(pct)
      if (pct >= 100) {
        parar()
        onSalir()
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  function parar() {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = null
    inicio.current = null
    setProgreso(0)
  }

  useEffect(() => parar, [])

  return (
    <button
      className="kid-salida"
      onPointerDown={empezar}
      onPointerUp={parar}
      onPointerLeave={parar}
      onPointerCancel={parar}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="kid-salida-relleno" style={{ transform: `scaleX(${progreso / 100})` }} />
      <span className="kid-salida-texto">Adultos: mantén pulsado</span>
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
        <span className="kid-celebracion-texto">¡Muy bien!</span>
      </div>
    </div>
  )
}
