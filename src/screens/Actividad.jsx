import { useEffect, useState } from 'react'
import { supabase, mensajeDeError } from '../lib/supabase'
import { puntosDeLinea } from '../lib/grafico'

// ------------------------------------------------------------------
// Actividad global, solo para quien mantiene la app.
//
// Lee `salud_diaria` a través de `actividad_reciente()`, que devuelve
// filas de verdad únicamente si `auth.uid()` está en `public.operadores`
// (ver migracion-040). Para cualquier otra cuenta la función responde
// vacío, nunca con datos ajenos: no hay family_id, nombre ni correo en
// ninguna columna, porque `salud_diaria` tampoco los guarda.
//
// No hay analítica de terceros aquí a propósito: legal/privacidad.html
// promete justo eso. Esto es una consulta más a Supabase con una puerta
// más estrecha, no una herramienta de seguimiento nueva.
// ------------------------------------------------------------------

const DIAS = 30
const ANCHO_GRAFICO = 600
const ALTO_GRAFICO = 56

function Tendencia({ titulo, valores, color, unidad = '' }) {
  const total = valores.reduce((a, b) => a + b, 0)
  const hoy = valores[valores.length - 1] ?? 0

  return (
    <div className="carta">
      <div className="fila-separada">
        <strong>{titulo}</strong>
        <span className="chip">{hoy}{unidad} hoy</span>
      </div>
      <svg
        viewBox={`0 0 ${ANCHO_GRAFICO} ${ALTO_GRAFICO}`}
        width="100%"
        height={ALTO_GRAFICO}
        preserveAspectRatio="none"
        style={{ display: 'block', marginTop: 8 }}
        role="img"
        aria-label={`${titulo}: ${total}${unidad} en los últimos ${DIAS} días`}
      >
        <polyline
          points={puntosDeLinea(valores, ANCHO_GRAFICO, ALTO_GRAFICO)}
          fill="none"
          style={{ stroke: color }}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="suave" style={{ marginTop: 4 }}>
        {total}{unidad} en {DIAS} días
      </div>
    </div>
  )
}

export default function Actividad() {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    // Más reciente primero: es lo que quiere "hoy" y el detalle de abajo.
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
  // Las tendencias se leen de izquierda a derecha como el tiempo: al
  // revés de cómo llega la fila (más reciente primero), o el gráfico
  // contaría la historia del revés.
  const cronologico = filas ? [...filas].reverse() : []

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
            {hoy.cuentas} cuentas · {hoy.gremios} gremios · {hoy.perfiles} perfiles activos ·{' '}
            {hoy.suscripciones_push} suscritos a avisos
          </div>
        </div>
      )}

      {cronologico.length > 1 && (
        <>
          <Tendencia titulo="Gremios activos" valores={cronologico.map((f) => f.gremios_activos)} color="var(--oro)" />
          <Tendencia
            titulo="Misiones validadas"
            valores={cronologico.map((f) => f.misiones_validadas)}
            color="var(--teal)"
          />
          <Tendencia titulo="Altas nuevas" valores={cronologico.map((f) => f.altas_del_dia)} color="var(--menta)" />
          <Tendencia titulo="Errores" valores={cronologico.map((f) => f.errores)} color="var(--peligro)" />
        </>
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
