import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { urlDeLaNarrativa, urlDelGremio } from '../lib/dominio'
import Captcha from '../components/Captcha'
import { esErrorDeCaptcha } from '../lib/captcha'
import { datosDeAceptacion, puedeAceptar, urlLegal } from '../lib/legal'
import {
  resultadoDeAlta,
  resultadoDeRecuperacion,
  traducirAcceso,
  urlDeVuelta,
  MIN_CLAVE_ENTRAR,
  MIN_CLAVE_NUEVA
} from '../lib/acceso'

export default function Login() {
  const [modo, setModo] = useState('entrar') // entrar | crear | olvidada
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('') // el camino bueno también habla
  const [cargando, setCargando] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [token, setToken] = useState('')
  // Cada intento fallido remonta el captcha: su token es de un solo uso y
  // reintentar con el mismo lo rechaza Supabase.
  const [intento, setIntento] = useState(0)

  const minimo = modo === 'crear' ? MIN_CLAVE_NUEVA : MIN_CLAVE_ENTRAR

  function limpiar(siguiente) {
    setModo(siguiente)
    setError('')
    setAviso('')
  }

  // El token viaja en `options` solo si existe: mandar `captchaToken:
  // undefined` es lo mismo que no mandarlo, y así la app funciona igual
  // antes y después de configurar Cloudflare.
  const conCaptcha = (opciones = {}) => (token ? { ...opciones, captchaToken: token } : opciones)

  function fallo(mensaje) {
    // «captcha protection: request disallowed» no le dice nada a nadie.
    setError(esErrorDeCaptcha(mensaje)
      ? 'No hemos podido comprobar que no eres un robot. Espera un momento y vuelve a intentarlo.'
      : mensaje)
    setToken('')
    setIntento((n) => n + 1)
  }

  async function enviar() {
    setError('')
    setAviso('')
    setCargando(true)

    if (modo === 'olvidada') {
      const r = resultadoDeRecuperacion(
        await supabase.auth.resetPasswordForEmail(email, conCaptcha({
          redirectTo: urlDeVuelta(window.location.origin, import.meta.env.BASE_URL)
        }))
      )
      setCargando(false)
      if (r.estado === 'error') fallo(r.mensaje)
      else setAviso(r.mensaje)
      return
    }

    if (modo === 'crear') {
      const r = resultadoDeAlta(
        await supabase.auth.signUp({
          email,
          password: pass,
          options: conCaptcha({
            emailRedirectTo: urlDeVuelta(window.location.origin, import.meta.env.BASE_URL),
            // Qué versión de los textos aceptó esta cuenta y cuándo. Va en
            // los metadatos porque tiene que existir desde el primer
            // instante, incluso antes de confirmar el correo; al fundar el
            // gremio se copia a `families`, que es donde queda como
            // registro estable.
            data: datosDeAceptacion()
          })
        })
      )
      setCargando(false)
      if (r.estado === 'error') fallo(r.mensaje)
      else if (r.estado === 'confirma') setAviso(r.mensaje)
      // 'dentro' no necesita mensaje: la app ya ha cambiado de pantalla.
      return
    }

    const { error: err } = await supabase.auth.signInWithPassword(
      conCaptcha({ email, password: pass })
    )
    setCargando(false)
    if (err) fallo(traducirAcceso(err.message))
  }

  const puedeEnviar =
    !cargando &&
    email.includes('@') &&
    (modo === 'olvidada' || pass.length >= minimo) &&
    // Sin la casilla no hay alta. La regla vive en legal.js para poder
    // probarla sin abrir el navegador.
    (modo !== 'crear' || puedeAceptar(acepta))
  // OJO: el botón NO espera al token del captcha, y es a propósito.
  // Bloquearlo hasta tenerlo parece más limpio y es una trampa: el día
  // que Cloudflare no cargue —o que el widget no dibuje por lo que sea—
  // NADIE puede entrar, registrarse ni recuperar su contraseña, y encima
  // sin un mensaje que lo explique. Quien de verdad exige el captcha es
  // Supabase, que rechaza la petición sin token válido; entonces se ve un
  // error concreto y se puede reintentar. Un candado en el navegador que
  // deja fuera a las familias reales protege menos que el de arriba.

  return (
    <div className="pantalla-centrada">
      <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" width="84" height="84" style={{ borderRadius: 20 }} />
      <h1 style={{ fontSize: '2rem' }}>El Gremio</h1>
      <p className="suave" style={{ maxWidth: 320 }}>
        {modo === 'olvidada'
          ? 'Escribe el correo del gremio y te mandamos un enlace para poner una contraseña nueva.'
          : 'Una sola cuenta para todo el gremio familiar. Cada persona elige su perfil después.'}
      </p>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div className="campo">
          <label htmlFor="acceso-email">Email</label>
          <input
            id="acceso-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            onKeyDown={(e) => { if (e.key === 'Enter' && puedeEnviar) enviar() }}
          />
        </div>

        {modo !== 'olvidada' && (
          <div className="campo">
            <label htmlFor="acceso-clave">Contraseña</label>
            <input
              id="acceso-clave"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              onKeyDown={(e) => { if (e.key === 'Enter' && puedeEnviar) enviar() }}
            />
            {modo === 'crear' && (
              <p className="suave" style={{ fontSize: '.8rem', marginTop: 4 }}>
                Al menos {MIN_CLAVE_NUEVA} caracteres. Es la única llave del gremio entero.
              </p>
            )}
          </div>
        )}

        {/* La aceptación va ANTES del botón y con los enlaces dentro de la
            frase: una casilla debajo del botón se marca sin leer, y un
            enlace en el pie no lo abre nadie. Los dos documentos se ven
            sin cuenta, que es justo cuando hacen falta. */}
        {modo === 'crear' && (
          <label className="acepta-legal">
            <input
              type="checkbox"
              checked={acepta}
              onChange={(e) => setAcepta(e.target.checked)}
            />
            <span>
              Soy mayor de edad y acepto las{' '}
              <a href={urlLegal('terminos', urlDelGremio())} target="_blank" rel="noopener noreferrer">
                condiciones de uso
              </a>{' '}
              y la{' '}
              <a href={urlLegal('privacidad', urlDelGremio())} target="_blank" rel="noopener noreferrer">
                política de privacidad
              </a>. Los perfiles de menores que cree son de personas a mi cargo.
            </span>
          </label>
        )}

        <Captcha key={modo + intento} accion={modo} onToken={setToken} />

        {error && <p className="error-texto">{error}</p>}
        {aviso && <p className="aviso-texto">{aviso}</p>}

        <button className="btn btn-bloque" onClick={enviar} disabled={!puedeEnviar}>
          {modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear cuenta familiar' : 'Enviar el enlace'}
        </button>

        <button
          className="btn btn-fantasma btn-bloque"
          style={{ marginTop: 10 }}
          onClick={() => limpiar(modo === 'entrar' ? 'crear' : 'entrar')}
        >
          {modo === 'entrar' ? 'Primera vez: crear cuenta' : 'Ya tengo cuenta'}
        </button>

        {/* La salida de emergencia va siempre visible menos cuando ya
            estás en ella: esconderla detrás de un intento fallido obliga a
            fallar a propósito para encontrarla. */}
        {modo !== 'olvidada' && (
          <button
            className="btn btn-fantasma btn-bloque"
            style={{ marginTop: 10 }}
            onClick={() => limpiar('olvidada')}
          >
            He olvidado la contraseña
          </button>
        )}
      </div>

      {/* Esta pantalla es lo primero que ve quien abre el dominio, tenga
          cuenta o no. Sin esto, la única forma de saber qué es esto era
          tener ya una cuenta y bajar hasta la séptima pestaña de ajustes,
          detrás del PIN. La explicación no pide sesión, así que puede
          vivir delante de ella. */}
      <a
        className="enlace-suave"
        href={urlDeLaNarrativa()}
        target="_blank"
        rel="noopener noreferrer"
      >
        📖 Qué es El Gremio y por qué funciona así
      </a>
    </div>
  )
}
