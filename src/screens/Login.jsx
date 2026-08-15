import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [modo, setModo] = useState('entrar') // entrar | crear
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar() {
    setError('')
    setCargando(true)
    const fn = modo === 'entrar'
      ? supabase.auth.signInWithPassword({ email, password: pass })
      : supabase.auth.signUp({ email, password: pass })
    const { error: err } = await fn
    setCargando(false)
    if (err) setError(traducir(err.message))
  }

  return (
    <div className="pantalla-centrada">
      <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" width="84" height="84" style={{ borderRadius: 20 }} />
      <h1 style={{ fontSize: '2rem' }}>El Gremio</h1>
      <p className="suave" style={{ maxWidth: 320 }}>
        Una sola cuenta para todo el gremio familiar. Cada persona elige su perfil después.
      </p>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div className="campo">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="campo">
          <label>Contraseña</label>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            onKeyDown={(e) => { if (e.key === 'Enter') enviar() }}
          />
        </div>
        {error && <p className="error-texto">{error}</p>}
        <button className="btn btn-bloque" onClick={enviar} disabled={cargando || !email || pass.length < 6}>
          {modo === 'entrar' ? 'Entrar' : 'Crear cuenta familiar'}
        </button>
        <button
          className="btn btn-fantasma btn-bloque"
          style={{ marginTop: 10 }}
          onClick={() => { setModo(modo === 'entrar' ? 'crear' : 'entrar'); setError('') }}
        >
          {modo === 'entrar' ? 'Primera vez: crear cuenta' : 'Ya tengo cuenta'}
        </button>
      </div>
    </div>
  )
}

function traducir(msg) {
  if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.'
  if (/already registered/i.test(msg)) return 'Ese email ya tiene cuenta. Usa "Ya tengo cuenta".'
  if (/at least 6/i.test(msg)) return 'La contraseña necesita al menos 6 caracteres.'
  return msg
}
