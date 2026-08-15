import { useState } from 'react'
import { HABILIDADES } from '../lib/habilidades'
import { NIVELES, EVITAR } from '../lib/premios'
import { PRINCIPIOS } from '../lib/evidencia'
import Icono from '../components/Icono'

// ------------------------------------------------------------------
// Tutorial de bienvenida.
//
// No explica dónde están los botones: explica por qué el sistema está
// hecho así. Es lo que evita el malentendido que hundiría el invento —
// creer que esto es "hacer tareas para cobrar"— y lo que permite que un
// adulto sepa qué hacer cuando la novedad se apague en la semana tres.
//
// Se puede saltar en cualquier momento; nadie aprende a la fuerza.
// ------------------------------------------------------------------

const CLAVE_VISTO = 'gremio_tutorial_visto'

export function tutorialPendiente() {
  try {
    return localStorage.getItem(CLAVE_VISTO) !== '1'
  } catch {
    return false
  }
}

export function marcarTutorialVisto() {
  try {
    localStorage.setItem(CLAVE_VISTO, '1')
  } catch {
    // Sin localStorage (modo privado) simplemente se volverá a ver.
  }
}

const PASOS = [
  {
    id: 'idea',
    emoji: '⚔️',
    titulo: 'Esto no es una lista de tareas',
    cuerpo: (
      <>
        <p>
          Es un juego de rol familiar. Las misiones no se hacen para cobrar: se hacen para{' '}
          <strong>entrenar habilidades</strong>.
        </p>
        <p className="suave">
          La diferencia no es de palabras. Un sistema de "tarea hecha, moneda cobrada" funciona unas semanas y
          después se apaga, porque el motivo de hacerlo se ha vuelto la moneda. Uno de habilidades aguanta más,
          porque lo que crece es la persona y eso se ve.
        </p>
        <p>
          El objetivo deja de ser <em>hacer la cama</em> y pasa a ser <em>volverse más autónoma</em>.
        </p>
      </>
    )
  },
  {
    id: 'habilidades',
    emoji: '🌱',
    titulo: 'Ocho habilidades',
    cuerpo: (
      <>
        <p>Cada misión entrena una. En tu carnet ves cuáles llevas más entrenadas.</p>
        <div className="grid-habilidades" style={{ marginTop: 10 }}>
          {HABILIDADES.map((h) => (
            <span key={h.id} className="pastilla-habilidad" style={{ borderColor: h.color, color: h.color }}>
              <span>{h.emoji}</span> {h.nombre}
            </span>
          ))}
        </div>
        <p className="suave" style={{ marginTop: 12 }}>
          Consejo: al montar el tablón, mezcla habilidades. Si todo son tareas de casa, el progreso se ve plano
          y aburre antes.
        </p>
      </>
    )
  },
  {
    id: 'dia',
    emoji: '✅',
    titulo: 'El día a día',
    cuerpo: (
      <>
        <p>
          Quien hace una misión la marca. Queda pendiente hasta que un adulto la valida desde el panel.{' '}
          <strong>La peque es la excepción</strong>: su estrella cae al momento, porque a los tres años esperar
          equivale a no recibir nada.
        </p>
        <p>
          Al validar, la app propone <strong>elogios concretos</strong>. Tocar uno valida la misión: cuesta lo
          mismo que un botón mudo y dice algo.
        </p>
        <div className="carta" style={{ marginTop: 10 }}>
          <p className="suave" style={{ margin: 0 }}>En vez de</p>
          <p style={{ margin: '2px 0 8px' }}>“Muy bien.”</p>
          <p className="suave" style={{ margin: 0 }}>Mejor</p>
          <p style={{ margin: '2px 0 0' }}>“Has recogido los juguetes sin que nadie te lo recordara.”</p>
        </div>
        <p className="suave" style={{ marginTop: 10 }}>
          El elogio genérico pierde efecto por repetición; el que nombra lo que hizo, no.
        </p>
      </>
    )
  },
  {
    id: 'premios',
    emoji: '🎁',
    titulo: 'Premios que no se gastan',
    cuerpo: (
      <>
        <p>Los mejores premios no son cosas: son decisiones.</p>
        {Object.entries(NIVELES).map(([n, nivel]) => (
          <div className="carta" key={n} style={{ borderColor: nivel.color }}>
            <strong style={{ color: nivel.color }}>
              {'⭐'.repeat(Number(n))} {nivel.nombre}
            </strong>
            <div className="suave">{nivel.lema}</div>
          </div>
        ))}
        <p className="suave">
          Elegir la película o la música del coche no cuesta dinero, no se acaba y alimenta la autonomía, que es
          lo que sostiene el hábito cuando la novedad se apaga.
        </p>
        <div className="titulo-seccion">Mejor fuera de la tienda</div>
        {EVITAR.map((e) => (
          <div className="fila" key={e.que} style={{ padding: '6px 4px' }}>
            <span style={{ opacity: 0.6 }}>✕</span>
            <span className="crece">
              <strong>{e.que}.</strong> <span className="suave">{e.porque}</span>
            </span>
          </div>
        ))}
      </>
    )
  },
  {
    id: 'andamio',
    emoji: '🪜',
    titulo: 'Las monedas son un andamio',
    cuerpo: (
      <>
        <p>
          Están para <strong>arrancar</strong> una costumbre que todavía no existe. Cuando una misión ya se hace
          sola, sin recordatorios y sin mirar el premio, ese es el momento de quitarla del tablón.
        </p>
        <p className="suave">
          No es perder progreso: es la señal de que el hábito ya se sostiene sin ayuda. Lo que se queda para
          siempre es el reconocimiento, que no se gasta.
        </p>
        <p>
          Y hay una parte que no se compra con monedas: <strong>la meta del gremio</strong>. La XP de todos suma
          hacia un plan compartido. No hay ranking entre miembros a propósito.
        </p>
      </>
    )
  },
  {
    id: 'principios',
    emoji: '📚',
    titulo: 'Los siete principios',
    cuerpo: (
      <>
        <p className="suave">Todo lo anterior sale de aquí. Si algo del sistema chirría, la respuesta suele estar en esta lista.</p>
        {PRINCIPIOS.map((p) => (
          <div className="carta" key={p.id}>
            <strong>{p.titulo}</strong>
            <div className="suave">{p.detalle}</div>
          </div>
        ))}
        <p className="suave">
          Las referencias completas están en el panel parental, en ⚙️ → Evidencia.
        </p>
      </>
    )
  }
]

export default function Tutorial({ onCerrar }) {
  const [i, setI] = useState(0)
  const paso = PASOS[i]
  const ultimo = i === PASOS.length - 1

  function cerrar() {
    marcarTutorialVisto()
    onCerrar()
  }

  return (
    <div className="app tutorial">
      <div className="fila-separada" style={{ marginBottom: 14 }}>
        <div className="puntos-tutorial" role="progressbar" aria-valuenow={i + 1} aria-valuemin={1} aria-valuemax={PASOS.length}>
          {PASOS.map((p, n) => (
            <span key={p.id} className={'punto' + (n === i ? ' activo' : '') + (n < i ? ' hecho' : '')} />
          ))}
        </div>
        <button className="btn btn-fantasma btn-mini" onClick={cerrar}>
          {ultimo ? 'Cerrar' : 'Saltar'}
        </button>
      </div>

      <div className="tutorial-cuerpo" key={paso.id}>
        <span className="tutorial-emoji">{paso.emoji}</span>
        <h1 className="tutorial-titulo">{paso.titulo}</h1>
        <div className="tutorial-texto">{paso.cuerpo}</div>
      </div>

      <div className="fila tutorial-pie">
        {i > 0 && (
          <button className="btn btn-fantasma btn-mini" onClick={() => setI(i - 1)} aria-label="Anterior">
            <Icono nombre="atras" tamano={18} />
          </button>
        )}
        <button className="btn crece" onClick={() => (ultimo ? cerrar() : setI(i + 1))}>
          {ultimo ? '⚔️ Empezar' : 'Seguir'}
        </button>
      </div>
    </div>
  )
}
