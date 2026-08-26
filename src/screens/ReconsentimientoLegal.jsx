import { useState } from 'react'
import { supabase, mensajeDeError } from '../lib/supabase'
import { VERSION_LEGAL, urlLegal, puedeAceptar, datosDeAceptacion } from '../lib/legal'
import { urlDelGremio } from '../lib/dominio'
import { log } from '../lib/log'

// ------------------------------------------------------------------
// Se enseña SOLO al entrar en el panel parental (family.legal_version
// desactualizado), nunca en el resto de la app: consentir es un acto de
// quien tiene la patria potestad, y una peque no puede darlo por
// accidente si esta pantalla no está en su camino.
// ------------------------------------------------------------------

export default function ReconsentimientoLegal({ family, onAceptado, onSalir }) {
  const [acepta, setAcepta] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState('')

  async function aceptar() {
    setFallo('')
    setOcupado(true)
    const { legal_version, legal_aceptado_en } = datosDeAceptacion()
    const { error } = await supabase
      .from('families')
      .update({ legal_version, legal_at: legal_aceptado_en })
      .eq('id', family.id)
    setOcupado(false)
    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    log.info('legal.reaceptado', { version: legal_version })
    onAceptado()
  }

  return (
    <div className="pantalla-centrada">
      <img src={import.meta.env.BASE_URL + 'assets/emblema-gremio.png'} alt="" width="80" height="80" />
      <h1 style={{ fontSize: '1.6rem' }}>Hemos actualizado la política de privacidad</h1>
      <p className="suave" style={{ maxWidth: 380 }}>
        Añadimos PostHog para saber, en conjunto, si la app se usa: cuántas misiones se validan y cuántos
        premios se canjean por gremio. Sin grabación de pantalla, sin nombres, sin lo que escribís. El
        detalle completo está en la política de privacidad.
      </p>

      <div style={{ width: '100%', maxWidth: 380 }}>
        <label className="acepta-legal">
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
          <span>
            He leído y acepto la{' '}
            <a href={urlLegal('privacidad', urlDelGremio())} target="_blank" rel="noopener noreferrer">
              política de privacidad
            </a>{' '}
            actualizada ({VERSION_LEGAL}).
          </span>
        </label>

        {fallo && <p className="error-texto" role="alert">{fallo}</p>}

        <button className="btn btn-bloque" disabled={!puedeAceptar(acepta) || ocupado} onClick={aceptar}>
          {ocupado ? 'Guardando…' : 'Continuar al panel'}
        </button>
        {onSalir && (
          <button className="btn btn-fantasma btn-bloque" style={{ marginTop: 8 }} onClick={onSalir}>
            Ahora no
          </button>
        )}
      </div>
    </div>
  )
}
