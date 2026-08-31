import { useEffect, useState } from 'react'
import { Modal, Talis } from '../components/ui'
import Captcha from '../components/Captcha'
import { esErrorDeCaptcha } from '../lib/captcha'
import { supabase, hashPin } from '../lib/supabase'
import { recordarIdentidadEnMarcha } from '../lib/acceso'
import {
  leerOportunidades, leerLlaves, forjarLlave, solicitarConversion,
  leerTiposOfrecidos, crearGremioConLlave,
  leerConversionQueEstorba, cancelarConversion
} from '../lib/acciones'
import {
  loQueFalta, llavesDisponibles, mensajeDeForja, mensajeDeConversion,
  mensajeDeCrear, mensajeDeCancelar
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

export default function Expandirse({ family, profile, onClose, refresh, onIrAlGremio }) {
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

          {/* Y lo que se puede hacer con ella. Una llave que no se puede
              gastar es haber pagado por nada, así que en cuanto hay una sin
              usar esto aparece debajo. */}
          {llavesDisponibles(llaves).length > 0 && (
            <UsarLaLlave
              llave={llavesDisponibles(llaves)[0]}
              onCreado={(id) => { onIrAlGremio?.(id); onClose?.() }}
            />
          )}
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
 * Gastar la llave creando un gremio.
 *
 * Es UNA de las dos cosas que se pueden hacer con ella (`R-19`); la otra es
 * aceptar una invitación, y esa vive en la bandeja porque llega de fuera. Se
 * dice aquí, para que nadie se quede pensando que solo sirve para esto.
 *
 * **No cuesta nada**: el pago fue al forjar, y cobrar aquí sería cobrar dos
 * veces. El texto lo dice, porque un formulario que pide un PIN y un nombre
 * después de haber pagado 300 se parece mucho a una segunda caja.
 */
function UsarLaLlave({ llave, onCreado }) {
  const [abierto, setAbierto] = useState(false)
  const [tipos, setTipos] = useState([])
  const [tipo, setTipo] = useState('')
  const [nombre, setNombre] = useState('')
  const [pais, setPais] = useState('ES')
  const [pin, setPin] = useState('')
  const [personaje, setPersonaje] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    if (abierto) leerTiposOfrecidos().then(setTipos)
  }, [abierto])

  // Sin preselección de tipo (`R-42`): sin elegir no se continúa. Es un
  // cambio deliberado respecto al alta de hoy, que elige por ti.
  const puede = tipo && nombre.trim().length >= 2 && pin.length >= 4 && /^[A-Za-z]{2}$/.test(pais)

  async function crear() {
    setOcupado(true)
    setAviso('')
    const { resultado, familyId } = await crearGremioConLlave({
      llave: llave.id,
      nombre: nombre.trim(),
      tipo,
      pais: pais.toUpperCase(),
      pinHash: await hashPin(pin),
      personaje: personaje.trim()
    })
    setOcupado(false)
    const mensaje = mensajeDeCrear(resultado)
    if (mensaje) return setAviso(mensaje)
    onCreado?.(familyId)
  }

  if (!abierto) {
    return (
      <div style={{ marginTop: 16 }}>
        <p className="suave">
          Tienes una llave sin usar. Puedes <strong>crear un gremio nuevo</strong> con ella,
          o guardarla para entrar en uno al que te inviten.
        </p>
        <button className="btn btn-bloque" onClick={() => setAbierto(true)}>
          Crear un gremio con esta llave
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16 }}>
      <h4>Un gremio nuevo</h4>
      <p className="suave">
        Ya está pagado: la llave se gastó al forjarla y esto no cuesta nada más.
      </p>

      <label className="campo">
        <span>Qué clase de gremio</span>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Elige…</option>
          {tipos.map((t) => (
            <option key={t.tipo} value={t.tipo}>{t.nombre_visible}</option>
          ))}
        </select>
      </label>

      <label className="campo">
        <span>Cómo se llama</span>
        <input value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} />
      </label>

      <label className="campo">
        {/* Se elige, no se deduce (`R-102`). Ni del idioma, ni de la hora, ni
            del correo. Y no se podrá cambiar. */}
        <span>País donde opera · no se podrá cambiar</span>
        <input
          value={pais}
          maxLength={2}
          onChange={(e) => setPais(e.target.value.toUpperCase())}
        />
      </label>

      <label className="campo">
        <span>Un PIN para este gremio</span>
        <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} />
      </label>

      <label className="campo">
        <span>Tu nombre ahí dentro</span>
        {/* Empiezas de cero: ni nivel, ni misiones, ni Talis del gremio de
            origen se copian (`R-03`). El nombre sí lo eliges. */}
        <input value={personaje} maxLength={40} onChange={(e) => setPersonaje(e.target.value)} />
      </label>

      {aviso && <p className="aviso" role="alert">{aviso}</p>}

      <button className="btn btn-bloque" disabled={!puede || ocupado} onClick={crear}>
        {ocupado ? 'Creando…' : 'Crear el gremio'}
      </button>
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
 *
 * Se exporta porque tiene DOS puertas desde la 2.42.0: esta —al ir a
 * expandirse, que es donde `R-48` dice que se pida— y ⚙️ → Datos, para
 * quien va a buscarla en vez de tropezársela. Misma pieza en los dos
 * sitios: dos formularios que piden lo mismo acabarían pidiéndolo distinto.
 */
export function Conversion({ family, profile, conIntroduccion = true }) {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [pin, setPin] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  // Casi todos los avisos de esta pantalla son un «no se puede». El de
  // haber retirado la solicitud es lo contrario, y pintarlo en rojo como
  // los demás sería peor que no decir nada.
  const [avisoBien, setAvisoBien] = useState(false)
  const [enviado, setEnviado] = useState(false)
  // El captcha, igual que en el acceso. Sin él esta pantalla NO puede
  // funcionar en producción: Turnstile está encendido en el proyecto y
  // Supabase rechaza `/signup` con «no captcha_token found». Estuvo así
  // desde el 30-ago —la solicitud se guardaba, la cuenta no se creaba y
  // nadie recibía ningún correo—, y el mensaje de esta pantalla decía que
  // no se había podido enviar el correo, que era la parte que menos
  // ayudaba a encontrarlo.
  const [token, setToken] = useState('')
  // Su token es de UN SOLO USO: cada intento fallido remonta el widget.
  const [intento, setIntento] = useState(0)
  // La solicitud viva que impide pedir otra, si la hay. Ver abajo.
  const [estorba, setEstorba] = useState(null)
  const [retirando, setRetirando] = useState(false)

  const puedeEnviar = correo.includes('@') && clave.length >= 8 && pin.length >= 4

  async function empezar() {
    setOcupado(true)
    setAvisoBien(false)
    setAviso('')

    // 1 · La solicitud, que es la que comprueba el PIN y aparta el correo.
    //     Va PRIMERO: si algo de esto no cuadra, no se ha creado ninguna
    //     cuenta que después haya que limpiar.
    const codigo = await solicitarConversion(profile.id, correo, await hashPin(pin))
    const mensaje = mensajeDeConversion(codigo)
    if (mensaje) {
      setAviso(mensaje)
      // «Ya hay una solicitud en marcha» es un callejón sin salida: hay dos
      // índices únicos —uno por personaje y otro por correo— y hasta que esa
      // solicitud caduque, 72 horas después, no se puede pedir otra. Si
      // además el alta anterior falló, el correo que dice mirar no existe.
      // Así que aquí se busca cuál es y se ofrece retirarla.
      if (codigo === 'ya_tienes_solicitud') {
        setEstorba(await leerConversionQueEstorba(family.id, profile.id, correo))
      }
      setOcupado(false)
      return
    }

    // 2 · Y la cuenta, que es la que dispara el correo de confirmación.
    //     El token va DENTRO de `options`, que es la regla de una línea
    //     que `acceso.js` explica con su propio susto: al lado de `email`
    //     y `password`, supabase-js lo ignora en silencio.
    const { error } = await supabase.auth.signUp({
      email: correo,
      password: clave,
      options: {
        emailRedirectTo: window.location.origin + (import.meta.env.BASE_URL || '/'),
        ...(token ? { captchaToken: token } : {})
      }
    })
    setOcupado(false)
    if (error) {
      // Remontar el captcha, o el segundo intento reusaría un token
      // gastado y fallaría por un motivo distinto del primero.
      setIntento((n) => n + 1)
      setToken('')
      setAviso(
        esErrorDeCaptcha(error.message)
          ? 'No se ha podido comprobar que hay una persona detrás. Espera a que cargue el recuadro de abajo y vuelve a intentarlo.'
          // Y no «no se ha podido enviar el correo»: si `signUp` falla, la
          // cuenta NO se ha creado, así que no hay ningún correo en
          // camino. Decir lo contrario manda a buscar en la bandeja de
          // entrada un mensaje que nadie ha mandado.
          : 'La solicitud está guardada, pero la cuenta no se ha podido crear. Inténtalo dentro de un rato.'
      )
      return
    }
    // La nota para la vuelta. Sirve para una sola cosa, y no es poca: que
    // si el enlace se abre pasadas las 72 horas, la app pueda decir «ha
    // caducado» en vez de callarse. Ver `acceso.js`.
    recordarIdentidadEnMarcha(correo)
    setEnviado(true)
  }

  /**
   * Retirarla. Con el PIN que ya está escrito arriba: el servidor lo exige
   * igual que para pedirla, y volver a preguntarlo aquí sería preguntar dos
   * veces lo mismo en la misma pantalla.
   *
   * No se reintenta sola a propósito. Si la solicitud anterior sí estaba en
   * marcha de verdad —el correo salió y alguien está a punto de abrirlo—,
   * retirarla y volver a pedirla por su cuenta rompería justo eso.
   */
  async function retirar() {
    setRetirando(true)
    setAvisoBien(false)
    setAviso('')
    const codigo = await cancelarConversion(estorba.id, await hashPin(pin))
    setRetirando(false)
    const mensaje = mensajeDeCancelar(codigo)
    if (mensaje) return setAviso(mensaje)
    setEstorba(null)
    setAvisoBien(true)
    setAviso('Retirada. Ya puedes pedirla otra vez.')
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
      {/* La explicación es de ESTA puerta: aquí se llega yendo a
          expandirse, así que el porqué empieza por ahí. Desde ⚙️ se llega
          buscando la identidad y esa pantalla ya ha explicado lo suyo;
          repetirlo diría «para expandirte» a quien no va a expandirse. */}
      {conIntroduccion && (
        <>
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
        </>
      )}

      {!conIntroduccion && (
        <p className="suave" style={{ marginTop: 0 }}>
          La identidad de <strong>{profile.name}</strong>. El correo tiene que ser
          suyo y distinto del de la casa.
        </p>
      )}

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

      {/* Va antes del aviso y del botón, como en el acceso. El botón NO
          espera al token: si Cloudflare no carga, quien decide es
          Supabase y el error se explica arriba. */}
      <Captcha key={'conversion:' + intento} accion="conversion" onToken={setToken} />

      {aviso && (
        <p className={avisoBien ? 'aviso aviso-bien' : 'aviso'} role="alert">{aviso}</p>
      )}

      {estorba && (
        <div className="aviso-config" style={{ marginTop: 12 }}>
          <p className="suave">
            Hay una solicitud sin terminar para <strong>{estorba.correo}</strong>, pedida
            el {new Date(estorba.solicitada_at).toLocaleDateString()}. Mientras siga ahí no
            se puede pedir otra.
          </p>
          <p className="suave">
            Si no te llegó ningún correo, retírala y vuelve a empezar. Si sí te llegó y
            aún no lo has abierto, mejor abre ese enlace.
          </p>
          <button className="btn btn-bloque" disabled={retirando} onClick={retirar}>
            {retirando ? 'Retirando…' : 'Retirar esa solicitud'}
          </button>
        </div>
      )}

      <button className="btn btn-bloque" disabled={!puedeEnviar || ocupado} onClick={empezar}>
        {ocupado ? 'Un momento…' : 'Crear mi identidad'}
      </button>
    </div>
  )
}
