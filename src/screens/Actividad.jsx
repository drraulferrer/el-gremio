import { useEffect, useState } from 'react'
import { supabase, mensajeDeError } from '../lib/supabase'

// ------------------------------------------------------------------
// Actividad global, solo para quien mantiene la app.
//
// Lee `salud_diaria` a través de `actividad_reciente()`, que devuelve
// filas de verdad únicamente si `auth.uid()` está en `public.operadores`
// (ver migracion-035). Para cualquier otra cuenta la función responde
// vacío, nunca con datos ajenos: no hay family_id, nombre ni correo en
// ninguna columna, porque `salud_diaria` tampoco los guarda.
//
// No hay analítica de terceros aquí a propósito: legal/privacidad.html
// promete que no la hay. Esto es una consulta más a Supabase con una
// puerta más estrecha, no una herramienta de seguimiento nueva.
// ------------------------------------------------------------------

const DIAS = 30

export default function Actividad() {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    supabase.rpc('actividad_reciente', { p_dias: DIAS }).then(({ data, error }) => {
      if (!vivo) return
      if (error) setError(mensajeDeError(error))
      else setFilas(data || [])
    })
    return () => {
      vivo = false
    }
  }, [])

  const hoy = filas && filas[0]

  return (
    <div>
      <div className="titulo-seccion">Actividad de los últimos {DIAS} días</div>
      <p className="suave" style={{ margin: '0 4px 10px' }}>
        Cuentas agregadas de <code>salud_diaria</code>: nunca lo que hace una familia en
        concreto.
      </p>

      {error && (
        <p className="error-texto" role="alert">
          {error}
        </p>
      )}

      {!error && filas === null && <div className="vacio">Cargando…</div>}

      {!error && filas && filas.length === 0 && (
        <div className="vacio">
          Sin filas todavía. <code>salud_diaria</code> se calcula una vez al día.
        </div>
      )}

      {hoy && (
        <div className="carta">
          <div className="fila-separada">
            <strong>Hoy</strong>
            <span className="chip">{new Date(hoy.dia).toLocaleDateString('es-ES')}</span>
          </div>
          <div className="suave" style={{ marginTop: 6 }}>
            {hoy.cuentas} cuentas · {hoy.gremios} gremios · {hoy.perfiles} perfiles activos
          </div>
        </div>
      )}

      {!error && filas && filas.length > 0 && (
        <div className="carta">
          {filas.map((f) => (
            <div className="fila-separada" key={f.dia} style={{ padding: '5px 0' }}>
              <span>{new Date(f.dia).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>
              <span className="suave">
                {f.gremios_activos}/{f.gremios} activos · {f.altas_del_dia} altas · {f.misiones_validadas}{' '}
                misiones · {f.errores === 0 ? 'sin errores' : `${f.errores} errores`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
