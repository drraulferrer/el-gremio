import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Conversion } from './Expandirse'
import { perfilesActivos } from '../lib/miembros'

// ------------------------------------------------------------------
// Quién eres tú en esta app · ⚙️ → Datos
//
// La segunda puerta a la identidad propia. La primera —dentro de
// Expandirse— la pone `F-4` paso 3: se pide justo cuando hace falta y «no
// antes, no por si acaso» (`R-48`). Esa decisión no se toca y esta puerta
// no la contradice: quien no vaya a expandirse no ve nada que le empuje a
// crearse una cuenta, y quien SÍ la quiera deja de tener que adivinar que
// vive detrás de un botón a media pantalla en Progreso.
//
// Y de paso arregla algo que no tenía sitio en ningún lado: **la app no
// decía en ninguna pantalla si entras con tu identidad o con la clave que
// comparte toda la casa.** Es la primera pregunta de esta sección y hasta
// hoy no se respondía.
//
// Degradable como todo lo demás: si `clase_credencial()` no contesta —una
// base sin la migración 044— esto no pinta nada y Datos se queda como
// estaba.
// ------------------------------------------------------------------

export default function TuIdentidad({ family, data }) {
  const [clase, setClase] = useState(null)
  const [correo, setCorreo] = useState('')
  const [eligiendo, setEligiendo] = useState(null)

  useEffect(() => {
    let vivo = true
    Promise.all([
      supabase.rpc('clase_credencial'),
      supabase.auth.getUser()
    ]).then(([{ data: c, error }, { data: u }]) => {
      if (!vivo || error) return
      setClase(c)
      setCorreo(u?.user?.email || '')
    })
    return () => { vivo = false }
  }, [])

  if (!clase || clase === 'sin_clasificar') return null

  // Ya la tiene: aquí no hay nada que hacer, solo que se sepa.
  if (clase === 'personal') {
    return (
      <>
        <div className="titulo-seccion">Tu identidad</div>
        <div className="carta">
          <p className="suave" style={{ marginTop: 0 }}>
            Entras con <strong>tu identidad propia</strong>{correo ? <> ({correo})</> : null}.
            Tus Talis son tuyos y te acompañan a cualquier gremio, y desde aquí puedes
            forjar llaves y entrar en otros gremios.
          </p>
        </div>
      </>
    )
  }

  // Quién puede tenerla y todavía no la tiene. Solo perfiles adultos: es
  // lo que exige `solicitar_conversion`, y ofrecer a una junior un botón
  // que el servidor va a rechazar es peor que no ofrecerlo.
  const candidatos = perfilesActivos(data?.profiles || [])
    .filter((p) => p.role === 'adulto' && !p.persona)

  return (
    <>
      <div className="titulo-seccion">Tu identidad</div>

      <div className="carta">
        <p className="suave" style={{ marginTop: 0 }}>
          Este aparato entra con <strong>la clave común</strong>, la misma para toda la
          casa. Sirve para todo lo de aquí dentro, pero no dice <em>quién</em> eres: por eso
          no puede forjar llaves ni entrar en otros gremios.
        </p>
        <p className="suave">
          Una identidad propia es un correo tuyo, distinto del de la casa.{' '}
          <strong>No cambia nada de aquí</strong>: la casa sigue entrando igual, tu personaje
          es el mismo, y ni el nivel, ni el historial, ni tus Talis se pierden.
        </p>

        {candidatos.length === 0 && (
          <p className="suave">
            Todos los personajes adultos de este gremio tienen ya la suya.
          </p>
        )}

        {/* Con un solo adulto esto es un botón; con varios, la lista evita
            lo único que aquí no tiene arreglo: convertir el personaje
            equivocado. El vínculo no se deshace. */}
        {candidatos.length > 0 && !eligiendo && (
          <div className="fila-botones" style={{ flexWrap: 'wrap' }}>
            {candidatos.map((p) => (
              <button key={p.id} className="btn" onClick={() => setEligiendo(p)}>
                {candidatos.length === 1 ? 'Crear mi identidad propia' : `Soy ${p.name}`}
              </button>
            ))}
          </div>
        )}

        {eligiendo && (
          <div style={{ marginTop: 12 }}>
            <Conversion family={family} profile={eligiendo} conIntroduccion={false} />
            <button
              className="btn btn-fantasma btn-bloque"
              style={{ marginTop: 10 }}
              onClick={() => setEligiendo(null)}
            >
              Ahora no
            </button>
          </div>
        )}
      </div>
    </>
  )
}
