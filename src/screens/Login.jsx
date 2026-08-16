import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { urlDeLaNarrativa } from '../lib/dominio'
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

  const minimo = modo === 'crear' ? MIN_CLAVE_NUEVA : MIN_CLAVE_ENTRAR

  function limpiar(siguiente) {
    setModo(siguiente)
    setError('')
    setAviso('')
  }

  async function enviar() {
    setError('')
    setAviso('')
    setCargando(true)

    if (modo === 'olvidada') {
      const r = resultadoDeRecuperacion(
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: urlDeVuelta(window.location.origin, import.meta.env.BASE_URL)
        })
      )
      setCargando(false)
      if (r.estado === 'error') setError(r.mensaje)
      else setAviso(r.mensaje)
      return
    }

    if (modo === 'crear') {
      const r = resultadoDeAlta(
        await supabase.auth.signUp({
          email,
          password: pass,
          options: { emailRedirectTo: urlDeVuelta(window.location.origin, import.meta.env.BASE_URL) }
        })
      )
      setCargando(false)
      if (r.estado === 'error') setError(r.mensaje)
      else if (r.estado === 'confirma') setAviso(r.mensaje)
      // 'dentro' no necesita mensaje: la app ya ha cambiado de pantalla.
      return
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password: pass })
    setCargando(false)
    if (err) setError(traducirAcceso(err.message))
  }

  const puedeEnviar =
    !cargando && email.includes('@') && (modo === 'olvidada' || pass.length >= minimo)

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
