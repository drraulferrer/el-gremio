import { useEffect, useState } from 'react'
import {
  leerInventarioCredencial, desactivarCredencialCompartida, crearCredencialCompartida
} from '../lib/acciones'
import { motivoDeCredencial, mensajeDeCredencial } from '../lib/expansion'
import { leerPerfil } from '../lib/gremios'

// ------------------------------------------------------------------
// La clave común del gremio.
//
// Un gremio donde ya todo el mundo tiene identidad no necesita una clave
// compartida, y mantenerla es un correo y una contraseña que abren la casa
// entera y no representan a nadie.
//
// LO QUE ESTA PANTALLA TIENE QUE HACER BIEN es explicar **por qué todavía no
// se puede**, que es el caso de casi todo el mundo. Un «no se puede» a secas
// deja a alguien atascado sin saber qué le falta; el servidor devuelve el
// motivo concreto (`E-11.6`) y aquí se convierte en una frase con salida.
//
// Y el inventario que se pinta es el MISMO que el servidor vuelve a calcular
// al desactivar (`R-88`). No se suma nada aquí: si la pantalla contara por su
// cuenta, podría enseñar un botón que el servidor va a rechazar.
// ------------------------------------------------------------------

export default function ClaveComun({ family }) {
  const [inv, setInv] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [correo, setCorreo] = useState('')

  const quien = leerPerfil(family?.id)

  async function cargar() {
    setInv(await leerInventarioCredencial(family.id))
  }

  useEffect(() => {
    cargar()
  }, [family?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function quitar() {
    setOcupado(true)
    setAviso('')
    const codigo = await desactivarCredencialCompartida(family.id, quien)
    setOcupado(false)
    const mensaje = mensajeDeCredencial(codigo)
    if (mensaje) {
      setAviso(mensaje)
      cargar()
      return
    }
    // Al quitarla cambia quién es dueña del gremio y por dónde se entra:
    // arrancar de cero es lo honesto.
    window.location.reload()
  }

  async function crear() {
    setOcupado(true)
    setAviso('')
    const codigo = await crearCredencialCompartida(family.id, correo.trim().toLowerCase(), quien)
    setOcupado(false)
    const mensaje = mensajeDeCredencial(codigo)
    if (mensaje) return setAviso(mensaje)
    setCorreo('')
    cargar()
  }

  if (!inv) return null

  // Sin clave común: lo que se ofrece es volver a tener una, que es OTRA.
  if (inv.activa === false) {
    return (
      <>
        <div className="titulo-seccion">La clave común</div>
        <div className="carta">
          <p className="suave">
            Este gremio <strong>ya no tiene clave común</strong>: se entra solo con
            identidades propias.
          </p>
          <p className="suave">
            Se puede volver a tener una, pero será <strong>otra</strong>: la anterior no
            vuelve ni se puede recuperar. Da de alta una cuenta nueva con su correo,
            confírmalo, y luego escríbelo aquí.
          </p>

          <label className="campo">
            <span>El correo de la clave nueva</span>
            <input
              type="email"
              value={correo}
              autoComplete="off"
              onChange={(e) => setCorreo(e.target.value)}
            />
          </label>

          {aviso && <p className="aviso" role="alert">{aviso}</p>}

          <button
            className="btn btn-bloque"
            disabled={!correo.includes('@') || ocupado}
            onClick={crear}
          >
            {ocupado ? 'Un momento…' : 'Crear una clave común nueva'}
          </button>
        </div>
      </>
    )
  }

  const sinIdentidad = inv.adultos_sin_identidad || []
  const noConvertidos = inv.no_convertidos || []
  const responsables = inv.responsables || []

  return (
    <>
      <div className="titulo-seccion">La clave común</div>

      <div className="carta">
        <p className="suave">
          Hoy toda la casa entra con el mismo correo y la misma contraseña. Cuando cada
          persona adulta tenga la suya, esa clave sobra: es una llave de más debajo del
          felpudo.
        </p>

        {/* El inventario, tal cual lo cuenta el servidor. */}
        <ul className="suave">
          <li><strong>{inv.adultos_con_identidad}</strong> con identidad propia</li>
          {sinIdentidad.length > 0 && (
            <li>
              <strong>{sinIdentidad.length}</strong> sin identidad propia:{' '}
              {sinIdentidad.map((p) => p.nombre).join(', ')}
            </li>
          )}
          {noConvertidos.length > 0 && (
            <li>
              <strong>{noConvertidos.length}</strong> que no pueden tenerla:{' '}
              {noConvertidos.map((p) => p.nombre).join(', ')}
            </li>
          )}
          {responsables.length > 0 && (
            <li>
              Quedarían a cargo de <strong>{responsables.map((p) => p.nombre).join(', ')}</strong>
            </li>
          )}
        </ul>

        {!inv.puede && (
          // El motivo, con su salida. Solo el primero: si hay tres, arreglar
          // el primero suele arreglar los otros, y una lista de tres frases
          // largas no se lee.
          <p className="suave">{motivoDeCredencial((inv.motivos || [])[0])}</p>
        )}

        {inv.puede && !abierto && (
          <button className="btn btn-fantasma btn-bloque" onClick={() => setAbierto(true)}>
            Quitar la clave común
          </button>
        )}

        {inv.puede && abierto && (
          <>
            <ul className="suave">
              <li>A partir de ahora se entra <strong>solo con identidades propias</strong>.</li>
              <li>
                Los perfiles que no pueden tenerla <strong>siguen usándose</strong>, pero los
                opera una persona adulta desde su cuenta.
              </li>
              <li>
                La contraseña de la clave común <strong>no se recupera</strong>. Si algún día
                hace falta otra, será una nueva.
              </li>
            </ul>

            {aviso && <p className="aviso" role="alert">{aviso}</p>}

            <div className="fila-botones">
              <button className="btn btn-peligro" disabled={ocupado} onClick={quitar}>
                {ocupado ? 'Quitando…' : 'Quitarla'}
              </button>
              <button className="btn btn-fantasma" onClick={() => { setAbierto(false); setAviso('') }}>
                Mejor no
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
