import { useEffect, useState } from 'react'
import { Modal, Talis } from '../components/ui'
import { supabase, hashPin } from '../lib/supabase'
import { leerOportunidades, leerLlaves, forjarLlave, solicitarConversion } from '../lib/acciones'
import {
  loQueFalta, llavesDisponibles, mensajeDeForja, mensajeDeConversion
} from '../lib/expansion'

// ------------------------------------------------------------------
// Expandirse a otro gremio.
//
// DOS PANTALLAS EN UNA, Y ESE ES EL DISEÑO. `F-4` paso 3 dice que la
// identidad personal se pide **aquí**, al ir a expandirse, «no antes, no
// por si acaso» (`R-48`). Así que quien todavía no la tiene no ve una
// lista de escalones que no puede tocar: ve por qué le hace falta una
// identidad y cómo se crea.
//
// Es la primera vez en toda la app que se le pide a alguien un correo
// suyo. Merece explicarse, y por eso el texto no dice «regístrate»: dice
// qué se gana y qué NO cambia —la casa sigue entrando con su clave
// compartida, y su personaje es el mismo—, que es la duda real.
//
// EL CLIENTE SOLO MUESTRA (`SEC-1`). Todo lo que se pinta aquí sale de
// `oportunidades_expansion()`, y el botón de forjar no autoriza nada:
// `forjar_llave()` vuelve a comprobar las once condiciones antes de cobrar.
// Si esta pantalla y el servidor no coinciden, manda el servidor y aquí se
// enseña lo que haya contestado.
// ------------------------------------------------------------------

export default function Expandirse({ family, profile, onClose, refresh }) {
  const [cargando, setCargando] = useState(true)
  const [esPersonal, setEsPersonal] = useState(false)
  const [oportunidades, setOportunidades] = useState([])
  const [llaves, setLlaves] = useState([])
  const [aviso, setAviso] = useState('')
  const [forjando, setForjando] = useState(null)

  async function cargar() {
    // La clase de la credencial la dice el servidor, no `profile.persona`:
    // un personaje puede tener identidad detrás y estar operándose HOY con
    // la clave compartida de la casa, y en ese caso forjar no se puede.
    const { data: clase } = await supabase.rpc('clase_credencial')
    const personal = clase === 'personal'
    setEsPersonal(personal)
    if (personal) {
      const [o, l] = await Promise.all([leerOportunidades(family.id), leerLlaves()])
      setOportunidades(o)
      setLlaves(l)
    }
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function forjar(orden) {
    setForjando(orden)
    setAviso('')
    const codigo = await forjarLlave(family.id, orden)
    const mensaje = mensajeDeForja(codigo)
    setForjando(null)
    if (mensaje) {
      setAviso(mensaje)
      // Aunque falle se recarga: si el motivo fue que el estado había
      // cambiado por detrás, lo honrado es enseñar el estado nuevo y no
      // dejar en pantalla el que produjo el error.
      cargar()
      return
    }
    await cargar()
    // El saldo ha bajado, y eso lo pinta media app.
    refresh?.()
  }

  return (
    <Modal titulo="Expandirse" onClose={onClose}>
      {cargando && <p className="suave">Un momento…</p>}

      {!cargando && !esPersonal && <Conversion family={family} profile={profile} />}

      {!cargando && esPersonal && (
        <>
          <p className="suave">
            Cada escalón que alcanzas en <strong>{family.name}</strong> te deja forjar una llave.
            Una llave abre un gremio nuevo, o te deja entrar en uno al que te inviten.
          </p>

          {oportunidades.length === 0 && (
            <p className="suave">Aquí todavía no hay escalones que alcanzar.</p>
          )}

          <ul className="lista-escalones">
            {oportunidades.map((o) => {
              const { puede, titulo, detalle } = loQueFalta(o)
              return (
                <li key={o.orden} className={'escalon' + (puede ? ' escalon-listo' : '')}>
                  <div>
                    <strong>{titulo}</strong>
                    <p className="suave">{detalle}</p>
                  </div>
                  {puede && (
                    <button
                      className="btn"
                      disabled={forjando === o.orden}
                      onClick={() => forjar(o.orden)}
                    >
                      {forjando === o.orden ? 'Forjando…' : <>Forjar por <Talis n={o.coste} /></>}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          {aviso && <p className="aviso" role="alert">{aviso}</p>}

          <MisLlaves llaves={llaves} />
        </>
      )}
    </Modal>
  )
}

/** Las llaves que tengo, con la de dónde salieron. */
function MisLlaves({ llaves }) {
  const sinGastar = llavesDisponibles(llaves)
  if (!llaves.length) return null

  return (
    <div style={{ marginTop: 16 }}>
      <h4>Tus llaves</h4>
      {sinGastar.length === 0 && <p className="suave">Ninguna sin usar.</p>}
      <ul className="lista-llaves">
        {llaves.map((l) => (
          <li key={l.id}>
            {/* De dónde salió, siempre. Una llave conserva su origen aunque
                se acabe usando en otro sitio, y aunque ese gremio se cierre
                (`R-22`): por eso el nombre viene guardado en la propia fila
                y no de buscar el gremio, que puede ya no existir. */}
            <span>Forjada en <strong>{l.origen_nombre}</strong></span>
            {l.estado === 'disponible' && <span className="chip">sin usar</span>}
            {l.estado === 'consumido' && (
              <span className="chip">abrió {l.destino_nombre || 'un gremio'}</span>
            )}
            {l.estado === 'revertido' && <span className="chip">devuelta</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * La puerta: crear una identidad propia.
 *
 * Pide correo, contraseña y el PIN del gremio. El PIN es lo único que
 * demuestra que hay una persona adulta delante, y por eso lo exige el
 * servidor (`solicitar_conversion`), no esta pantalla.
 *
 * Son dos pasos y no uno porque el correo hay que confirmarlo: aquí se
 * deja la solicitud y se crea la cuenta, y la conversión **termina** al
 * volver desde el enlace del correo. Eso ya lo resuelve el arranque de la
 * app, que es donde llega esa vuelta.
 */
function Conversion({ family, profile }) {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [pin, setPin] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [enviado, setEnviado] = useState(false)

  const puedeEnviar = correo.includes('@') && clave.length >= 8 && pin.length >= 4

  async function empezar() {
    setOcupado(true)
    setAviso('')

    // 1 · La solicitud, que es la que comprueba el PIN y aparta el correo.
    //     Va PRIMERO: si algo de esto no cuadra, no se ha creado ninguna
    //     cuenta que después haya que limpiar.
    const codigo = await solicitarConversion(profile.id, correo, await hashPin(pin))
    const mensaje = mensajeDeConversion(codigo)
    if (mensaje) {
      setAviso(mensaje)
      setOcupado(false)
      return
    }

    // 2 · Y la cuenta, que es la que dispara el correo de confirmación.
    const { error } = await supabase.auth.signUp({
      email: correo,
      password: clave,
      options: { emailRedirectTo: window.location.origin + (import.meta.env.BASE_URL || '/') }
    })
    setOcupado(false)
    if (error) {
      setAviso('La solicitud está guardada, pero no se ha podido enviar el correo. Inténtalo dentro de un rato.')
      return
    }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div>
        <h4>Mira tu correo</h4>
        <p className="suave">
          Te hemos escrito a <strong>{correo}</strong>. Abre el enlace desde este mismo
          aparato y tu identidad quedará creada.
        </p>
        <p className="suave">
          Mientras tanto no cambia nada: <strong>{family.name}</strong> sigue funcionando
          igual y con la misma clave de siempre.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h4>Para expandirte necesitas una identidad propia</h4>
      <p className="suave">
        Un gremio nuevo es tuyo, no de esta casa: hace falta saber quién lo abre. Por eso
        una llave la forja una persona, y hoy <strong>{family.name}</strong> entra con una
        clave que comparte todo el mundo.
      </p>
      <p className="suave">
        <strong>Qué no cambia:</strong> la casa sigue entrando como siempre, tu personaje es
        el mismo y no pierdes nada —ni nivel, ni historial, ni tus Talis, que pasan a ser
        tuyos y te acompañan a cualquier gremio.
      </p>

      <label className="campo">
        <span>Tu correo</span>
        {/* Y no el de la casa: el servidor lo rechaza con un mensaje propio,
            porque es el error que cualquiera comete la primera vez. */}
        <input
          type="email"
          value={correo}
          autoComplete="email"
          placeholder="uno tuyo, distinto del de la casa"
          onChange={(e) => setCorreo(e.target.value)}
        />
      </label>

      <label className="campo">
        <span>Una contraseña</span>
        <input
          type="password"
          value={clave}
          autoComplete="new-password"
          placeholder="8 caracteres o más"
          onChange={(e) => setClave(e.target.value)}
        />
      </label>

      <label className="campo">
        <span>El PIN del gremio</span>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          autoComplete="off"
          onChange={(e) => setPin(e.target.value)}
        />
      </label>

      {aviso && <p className="aviso" role="alert">{aviso}</p>}

      <button className="btn btn-bloque" disabled={!puedeEnviar || ocupado} onClick={empezar}>
        {ocupado ? 'Un momento…' : 'Crear mi identidad'}
      </button>
    </div>
  )
}
