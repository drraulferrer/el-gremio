import { useEffect, useState } from 'react'
import Icono from '../components/Icono'
import { GLOBOS_DEL_JUEGO } from '../lib/juego'

// ------------------------------------------------------------------
// Los minijuegos de la peque.
//
// Rotan por día (ver juegoDelDia en lib/juego.js) porque con uno solo la
// novedad dura una semana, y la novedad es lo que sostiene todo esto a
// los tres años.
//
// Los tres piden un gesto DISTINTO, que es lo que los hace tres juegos y
// no uno pintado de tres colores:
//   · globos    → suben; hay que anticipar dónde estarán
//   · estrellas → caen; hay que perseguirlas
//   · bichitos  → asoman y se esconden en su sitio; hay que esperar
//
// Reglas comunes, todas por la edad: no se puede perder, no hay reloj que
// corra, y cada pieza es enorme. Un temporizador a los tres años no es
// tensión, es llanto.
//
// Nada se anima con `filter` ni con propiedades de layout: solo
// `transform` y `opacity`. Esta pantalla ya se ganó un bug de fondo por
// animar cosas caras en un móvil.
// ------------------------------------------------------------------

const COLORES = ['#ff6b6b', '#ffd166', '#6ee7a0', '#7fb3ff', '#c9a0ff', '#ffa96b']

/**
 * Las piezas de un juego y cómo se quitan.
 *
 * El actualizador es funcional a propósito: dos toques rápidos caen en el
 * mismo lote de React, y leyendo la clausura vieja uno de los dos revive.
 * Con un dedo de tres años eso pasa constantemente. Y el final se detecta
 * en un efecto, no dentro del actualizador, porque ahí React puede
 * ejecutarlo dos veces y cobraría la estrella por duplicado.
 */
function usePiezas(cuantas, crear, onTerminar) {
  const [piezas, setPiezas] = useState(() => Array.from({ length: cuantas }, (_, i) => crear(i)))
  const quitar = (id) => setPiezas((previas) => previas.filter((p) => p.id !== id))

  useEffect(() => {
    if (piezas.length === 0) onTerminar()
  }, [piezas.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return [piezas, quitar]
}

/** El marco común: cierre, cuenta atrás y el cielo donde pasa todo. */
function Tablero({ etiqueta, restantes, fondo, onCerrar, children }) {
  return (
    <div className="kid-juego" style={fondo ? { background: fondo } : undefined} role="dialog" aria-label={etiqueta}>
      <button className="kid-juego-cerrar" onClick={onCerrar} aria-label="Cerrar el juego">
        <Icono nombre="cerrar" tamano={28} />
      </button>
      <p className="kid-juego-cuenta" aria-live="polite">
        {restantes > 0 ? `Quedan ${restantes}` : '¡Todos!'}
      </p>
      <div className="kid-juego-cielo">{children}</div>
    </div>
  )
}

/** Globos que suben. 18 s de subida: con 7 el dedo no llegaba. */
export function JuegoGlobos({ onTerminar, onCerrar }) {
  const [globos, quitar] = usePiezas(
    GLOBOS_DEL_JUEGO,
    (i) => ({
      id: i,
      // Tope al 70 %: la pieza mide 92 px y más a la derecha se sale.
      x: 6 + (i % 3) * 30 + (i % 2) * 4,
      retardo: (i % 3) * 0.7 + Math.floor(i / 3) * 1.4,
      color: COLORES[i % COLORES.length]
    }),
    onTerminar
  )

  return (
    <Tablero etiqueta="Juego de globos" restantes={globos.length} onCerrar={onCerrar}>
      {globos.map((g) => (
        <button
          key={g.id}
          className="kid-globo"
          style={{ left: `${g.x}%`, animationDelay: `${g.retardo}s`, background: g.color }}
          onClick={() => quitar(g.id)}
          aria-label="Globo"
        >
          <span className="kid-globo-brillo" aria-hidden="true" />
        </button>
      ))}
    </Tablero>
  )
}

/** Estrellas que caen. Bajan más despacio que un globo sube: perseguir cuesta más que anticipar. */
export function JuegoEstrellas({ onTerminar, onCerrar }) {
  const [estrellas, quitar] = usePiezas(
    GLOBOS_DEL_JUEGO,
    (i) => ({
      id: i,
      x: 6 + (i % 3) * 30 + (i % 2) * 4,
      retardo: (i % 3) * 0.9 + Math.floor(i / 3) * 1.8
    }),
    onTerminar
  )

  return (
    <Tablero
      etiqueta="Juego de estrellas"
      restantes={estrellas.length}
      fondo="linear-gradient(180deg, #2b2a5e 0%, #4b3f86 60%, #7a5ea8 100%)"
      onCerrar={onCerrar}
    >
      {estrellas.map((e) => (
        <button
          key={e.id}
          className="kid-estrella-cae"
          style={{ left: `${e.x}%`, animationDelay: `${e.retardo}s` }}
          onClick={() => quitar(e.id)}
          aria-label="Estrella"
        >
          ★
        </button>
      ))}
    </Tablero>
  )
}

/**
 * Bichitos que asoman y se esconden, cada uno en su agujero. No se mueven
 * por la pantalla: lo que se entrena aquí es esperar el momento, que es
 * un gesto distinto a perseguir.
 */
export function JuegoBichitos({ onTerminar, onCerrar }) {
  const BICHOS = ['🐞', '🐛', '🦋', '🐝', '🐌', '🐢']
  const [bichitos, quitar] = usePiezas(
    GLOBOS_DEL_JUEGO,
    (i) => ({ id: i, emoji: BICHOS[i % BICHOS.length], retardo: i * 0.6 }),
    onTerminar
  )

  return (
    <Tablero
      etiqueta="Juego de bichitos"
      restantes={bichitos.length}
      fondo="linear-gradient(180deg, #d9f2c4 0%, #eaf7d8 55%, #fff6e0 100%)"
      onCerrar={onCerrar}
    >
      <div className="kid-madriguera">
        {bichitos.map((b) => (
          <button
            key={b.id}
            className="kid-bichito"
            style={{ animationDelay: `${b.retardo}s` }}
            onClick={() => quitar(b.id)}
            aria-label="Bichito"
          >
            {b.emoji}
          </button>
        ))}
      </div>
    </Tablero>
  )
}

const POR_ID = {
  globos: JuegoGlobos,
  estrellas: JuegoEstrellas,
  bichitos: JuegoBichitos
}

/** Pinta el juego que toca hoy. Si el id no existe, caen los globos. */
export default function Juego({ id, onTerminar, onCerrar }) {
  const Elegido = POR_ID[id] || JuegoGlobos
  return <Elegido onTerminar={onTerminar} onCerrar={onCerrar} />
}
