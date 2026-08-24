import { useState } from 'react'
import Retrato from './Retrato'
import EditorRetrato from './EditorRetrato'
import { faseDePerfil, faseSiguiente } from '../lib/retratos'
import { guardarRetrato } from '../lib/acciones'
import { flex } from '../lib/genero'

// ------------------------------------------------------------------
// Mi retrato: mirarse y cambiarse.
//
// Vive fuera de las pantallas porque lo abren TRES sitios —la cabecera de
// cualquier pestaña, la sección de Progreso y la ficha de la peque— y
// tres copias de esto acabarían guardando de tres maneras distintas.
//
// Lo que hay aquí y no en EditorRetrato es la parte que no se elige: la
// figura entera, la fase que se lleva y lo que falta para la siguiente.
// Se mira; no se toca.
// ------------------------------------------------------------------

export default function MiRetrato({ profile, genero = 'neutro', refresh, tamano = 92 }) {
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState('')
  // Copia local para que el retrato se mueva al tocar, sin esperar a la
  // ida y vuelta. Lo que se guarda es esto; `profile` llega con el refresco.
  const [borrador, setBorrador] = useState(null)
  const mio = borrador || profile

  const fase = faseDePerfil(mio)
  const cerca = faseSiguiente(mio)

  async function cambiar(cambios) {
    const siguiente = { ...mio, ...cambios }
    setBorrador(siguiente)
    setGuardando(true)
    setFallo('')
    const { ok, mensaje } = await guardarRetrato({ profile, piezas: siguiente })
    if (ok) await refresh?.()
    else setFallo(mensaje || 'No se pudo guardar el retrato.')
    setGuardando(false)
  }

  return (
    <div>
      <div className="fila" style={{ alignItems: 'center', gap: 16 }}>
        <Retrato perfil={mio} tamano={tamano} vista="cuerpo" />
        <div className="crece">
          <strong style={{ fontFamily: 'var(--display)', fontSize: '1.05rem' }}>
            {flex(fase.nombre, genero)}
          </strong>
          <div className="suave" style={{ fontSize: '0.85rem' }}>{fase.equipo}</div>
          {cerca ? (
            <div className="suave" style={{ fontSize: '0.8rem', marginTop: 6 }}>
              A {cerca.faltan} XP de <strong>{flex(cerca.fase.nombre, genero)}</strong>,
              que trae {cerca.fase.equipo.toLowerCase()}.
            </div>
          ) : (
            <div className="suave" style={{ fontSize: '0.8rem', marginTop: 6 }}>
              El equipo se gana subiendo de nivel. No se compra.
            </div>
          )}
        </div>
      </div>

      <div className="titulo-seccion" style={{ marginTop: 14 }}>Cómo eres</div>
      <EditorRetrato perfil={mio} onCambiar={cambiar} genero={genero} vistaPrevia={false} />
      {guardando && <p className="suave">Guardando…</p>}
      {fallo && <p className="error-texto">{fallo}</p>}
    </div>
  )
}
