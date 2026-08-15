import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { validarClaveNueva, traducirAcceso, MIN_CLAVE_NUEVA } from '../lib/acceso'

/**
 * Poner una contraseña nueva tras pulsar el enlace del correo.
 *
 * Se dibuja POR ENCIMA de todo lo demás. El enlace de recuperación abre
 * sesión de verdad, así que sin esta pantalla la persona entraba en su
 * gremio, veía todo normal y se iba sin haber cambiado la contraseña que
 * había venido a cambiar: el peor final posible, porque parece que ha
 * funcionado.
 */
export default function NuevaClave({ onHecho }) {
  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function guardar() {
    const v = validarClaveNueva(clave, repetida)
    if (!v.ok) {
      setError(v.mensaje)
      return
    }
    setError('')
    setCargando(true)
    const { error: err } = await supabase.auth.updateUser({ password: clave })
    setCargando(false)
    if (err) {
      setError(traducirAcceso(err.message))
      return
    }
    // La URL sigue llevando el token del correo colgando. Se limpia para
    // que recargar no reabra esta pantalla ni deje el token en el
    // historial del navegador.
    window.history.replaceState({}, '', window.location.pathname)
    onHecho()
  }

  return (
    <div className="pantalla-centrada">
      <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" width="72" height="72" style={{ borderRadius: 18 }} />
      <h1 style={{ fontSize: '1.6rem' }}>Contraseña nueva</h1>
      <p className="suave" style={{ maxWidth: 320 }}>
        Elige la contraseña con la que entrará el gremio a partir de ahora.
        Al menos {MIN_CLAVE_NUEVA} caracteres.
      </p>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div className="campo">
          <label htmlFor="clave-nueva">Contraseña nueva</label>
          <input
            id="clave-nueva"
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="campo">
          <label htmlFor="clave-repetida">Repítela</label>
          <input
            id="clave-repetida"
            type="password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            autoComplete="new-password"
            onKeyDown={(e) => { if (e.key === 'Enter') guardar() }}
          />
        </div>
        {error && <p className="error-texto">{error}</p>}
        <button className="btn btn-bloque" onClick={guardar} disabled={cargando || !clave || !repetida}>
          Guardar y entrar
        </button>
      </div>
    </div>
  )
}
