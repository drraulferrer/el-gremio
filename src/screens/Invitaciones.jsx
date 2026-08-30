import { useEffect, useState } from 'react'
import { Modal } from '../components/ui'
import { leerInvitaciones, leerLlaves, aceptarInvitacion, rechazarInvitacion } from '../lib/acciones'
import { aceptables, llavesDisponibles, mensajeDeAceptar } from '../lib/expansion'

// ------------------------------------------------------------------
// La bandeja de invitaciones.
//
// **Es de la PERSONA, no del gremio activo** (`F-2` paso 3). Por eso se abre
// desde el selector y no desde dentro de un gremio: una invitación a B llega
// mientras estás en A, y si solo se viera desde B no se vería nunca.
//
// Y cada una dice **de qué tipo es el gremio** al que invitan, porque entrar
// en un equipo de trabajo y entrar en una casa no son la misma decisión.
//
// El estado que se pinta viene YA RESUELTO del servidor: una pendiente
// vencida llega como caducada. Aquí no se vuelve a mirar el reloj —serían
// dos relojes, y `T-3` dice que manda el del servidor.
// ------------------------------------------------------------------

const COMO_SE_LEE = {
  pendiente: null,
  caducada: 'Caducada',
  aceptada: 'Ya la aceptaste',
  rechazada: 'La rechazaste',
  revocada: 'La retiraron'
}

export default function Invitaciones({ onClose, onIrAlGremio }) {
  const [cargando, setCargando] = useState(true)
  const [invitaciones, setInvitaciones] = useState([])
  const [llaves, setLlaves] = useState([])
  const [aviso, setAviso] = useState('')
  const [ocupada, setOcupada] = useState(null)

  async function cargar() {
    const [i, l] = await Promise.all([leerInvitaciones(), leerLlaves()])
    setInvitaciones(i)
    setLlaves(l)
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  const sinUsar = llavesDisponibles(llaves)

  async function aceptar(inv) {
    setOcupada(inv.id)
    setAviso('')
    // La llave se manda solo si la hay. Si es tu PRIMERA pertenencia el
    // servidor no la pide (`S-10`), y mandar una gastaría de más.
    const { resultado, familyId } = await aceptarInvitacion(inv.id, sinUsar[0]?.id || null, null)
    setOcupada(null)
    const mensaje = mensajeDeAceptar(resultado)
    if (mensaje) {
      setAviso(mensaje)
      // Se recarga igual: casi todos los motivos por los que esto falla son
      // que el estado cambió por detrás, y dejar en pantalla el viejo hace
      // que el siguiente intento falle igual sin explicación.
      cargar()
      return
    }
    onIrAlGremio?.(familyId)
    onClose?.()
  }

  async function rechazar(inv) {
    setOcupada(inv.id)
    await rechazarInvitacion(inv.id)
    setOcupada(null)
    cargar()
  }

  const pendientes = aceptables(invitaciones)

  return (
    <Modal titulo="Invitaciones" onClose={onClose}>
      {cargando && <p className="suave">Un momento…</p>}

      {!cargando && invitaciones.length === 0 && (
        <p className="suave">No tienes ninguna invitación.</p>
      )}

      {!cargando && invitaciones.length > 0 && pendientes.length === 0 && (
        <p className="suave">No tienes ninguna sin resolver.</p>
      )}

      {aviso && <p className="aviso" role="alert">{aviso}</p>}

      <ul className="lista-invitaciones">
        {invitaciones.map((i) => {
          const resuelta = COMO_SE_LEE[i.estado]
          return (
            <li key={i.id}>
              <div>
                <strong>{i.gremio}</strong>
                {/* El tipo, siempre visible. */}
                {i.tipo_visible && <span className="chip">{i.tipo_visible}</span>}
                {resuelta && <p className="suave">{resuelta}</p>}
              </div>

              {!resuelta && (
                <div className="fila-botones">
                  <button
                    className="btn"
                    disabled={ocupada === i.id}
                    onClick={() => aceptar(i)}
                  >
                    Entrar
                  </button>
                  <button
                    className="btn btn-fantasma"
                    disabled={ocupada === i.id}
                    onClick={() => rechazar(i)}
                  >
                    No, gracias
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {pendientes.length > 0 && sinUsar.length === 0 && (
        <p className="suave">
          Para entrar en un gremio más hace falta una llave, salvo que sea el primero al
          que perteneces. Se forjan desde <strong>Progreso</strong>, en el gremio donde
          hayas llegado al nivel.
        </p>
      )}
    </Modal>
  )
}
