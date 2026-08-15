import { useState } from 'react'
import { supabase, hashPin, mensajeDeError } from '../lib/supabase'
import { validarPin, PIN_MINIMO, PIN_MAXIMO } from '../lib/pin'
import { log } from '../lib/log'

// ------------------------------------------------------------------
// Cambio del PIN parental.
//
// Hasta ahora esto solo se podía hacer por SQL, que es tanto como decir
// que no se podía hacer. Era el hueco más molesto del producto: el PIN
// se aprende mirando dedos, y si cambiarlo cuesta abrir la consola de
// Supabase, no se cambia nunca.
// ------------------------------------------------------------------

export default function Seguridad({ family, onCambiado }) {
  const [actual, setActual] = useState('')
  const [nuevo, setNuevo] = useState('')
  const [repetido, setRepetido] = useState('')
  const [fallo, setFallo] = useState('')
  const [hecho, setHecho] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const revision = validarPin({ nuevo, repetido, actual })
  const listo = actual.length >= PIN_MINIMO && revision.ok

  async function cambiar() {
    setFallo('')
    setHecho(false)

    const hashDelActual = await hashPin(actual)
    if (hashDelActual !== family.parent_pin_hash) {
      setFallo('El PIN actual no es correcto.')
      log.warn('pin.intento_fallido')
      return
    }

    setOcupado(true)
    const { error } = await supabase
      .from('families')
      .update({ parent_pin_hash: await hashPin(nuevo) })
      .eq('id', family.id)
    setOcupado(false)

    if (error) {
      setFallo(mensajeDeError(error))
      return
    }

    // Nunca se registra el PIN, ni el viejo ni el nuevo: `redactar` lo
    // eliminaría igualmente, pero es que aquí ni se pasa.
    log.warn('pin.cambiado')
    setActual('')
    setNuevo('')
    setRepetido('')
    setHecho(true)
    if (onCambiado) onCambiado()
  }

  return (
    <div>
      <div className="titulo-seccion">PIN parental</div>

      <div className="carta">
        <div className="campo">
          <label>PIN actual</label>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={actual}
            onChange={(e) => { setActual(e.target.value); setFallo(''); setHecho(false) }}
          />
        </div>

        <div className="campo">
          <label>PIN nuevo</label>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={PIN_MAXIMO}
            value={nuevo}
            onChange={(e) => { setNuevo(e.target.value); setHecho(false) }}
          />
          <span className="suave">Entre {PIN_MINIMO} y {PIN_MAXIMO} dígitos.</span>
        </div>

        <div className="campo">
          <label>Repite el PIN nuevo</label>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={PIN_MAXIMO}
            value={repetido}
            onChange={(e) => { setRepetido(e.target.value); setHecho(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && listo) cambiar() }}
          />
        </div>

        {nuevo && !revision.ok && <p className="error-texto">{revision.mensaje}</p>}
        {revision.aviso && <p className="suave">⚠ {revision.aviso}</p>}
        {fallo && <p className="error-texto" role="alert">{fallo}</p>}
        {hecho && <p style={{ color: 'var(--exito)', fontWeight: 800 }}>✓ PIN cambiado.</p>}

        <button className="btn btn-bloque" disabled={!listo || ocupado} onClick={cambiar}>
          {ocupado ? 'Guardando…' : 'Cambiar PIN'}
        </button>
      </div>

      <div className="carta">
        <strong>Qué protege y qué no</strong>
        <p className="suave">
          El PIN guarda el panel parental <em>dentro</em> de la sesión familiar: evita que unas manos curiosas
          se validen sus propias misiones. No es seguridad criptográfica. Quien tenga la sesión abierta y sepa
          abrir la consola del navegador puede saltárselo, así que aquí no se guarda nada sensible.
        </p>
        <p className="suave">
          Si el PIN se cambia, no hay que hacer nada en el resto de dispositivos: se comprueba contra el
          servidor, no contra una copia local.
        </p>
      </div>
    </div>
  )
}
