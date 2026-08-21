import { useState } from 'react'
import { Modal } from '../components/ui'
import { enviarInforme, validarTexto, TEXTO_MAXIMO } from '../lib/fallos'

// ------------------------------------------------------------------
// «Algo va mal»: la hoja para contarlo.
//
// Dos decisiones que no son de estilo:
//
//  1. **Se dice qué se manda, antes de mandarlo.** Va debajo del campo y
//     no escondido en un enlace de ayuda. Quien informa de un fallo está
//     teniendo un mal rato; que además se pregunte qué acaba de enviar
//     desde el móvil de su casa es exactamente lo que no puede pasar.
//
//  2. **Si falla el envío, NO se borra lo escrito.** Un formulario que se
//     vacía al fallar es la forma más segura de que nadie lo intente dos
//     veces, y aquí la segunda vez es la que cuenta: el motivo más común
//     de fallo es quedarse sin red, que se arregla solo en un minuto.
//
// No la ve la peque: su pantalla son dibujos y un botón de texto ahí es
// un botón que se pulsa por jugar.
// ------------------------------------------------------------------

const EJEMPLO = 'Al tocar «Tienda» se queda cargando y no sale nada. Le pasa a la junior desde ayer.'

export default function ReportarFallo({ pantalla = null, familyId = null, profileId = null, onClose }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState('')
  const [hecho, setHecho] = useState(false)

  const revision = validarTexto(texto)
  const restantes = TEXTO_MAXIMO - texto.trim().length

  async function mandar() {
    setEnviando(true)
    setFallo('')
    const r = await enviarInforme({ texto, pantalla, familyId, profileId })
    setEnviando(false)
    if (r.ok) setHecho(true)
    else setFallo(r.mensaje || 'No ha podido salir. Inténtalo otra vez en un momento.')
  }

  if (hecho) {
    return (
      <Modal titulo="Contado" onClose={onClose}>
        <p role="status">
          Ya está apuntado, con la versión y la pantalla en la que estabas. Gracias: sin esto,
          los fallos se arreglan cuando alguien se tropieza dos veces con ellos.
        </p>
        <button className="btn btn-bloque" style={{ marginTop: 12 }} onClick={onClose} autoFocus>
          Cerrar
        </button>
      </Modal>
    )
  }

  return (
    <Modal titulo="Algo va mal" onClose={onClose}>
      <div className="campo">
        <label htmlFor="fallo-texto">¿Qué ha pasado?</label>
        <textarea
          id="fallo-texto"
          autoFocus
          value={texto}
          maxLength={TEXTO_MAXIMO}
          placeholder={EJEMPLO}
          onChange={(e) => setTexto(e.target.value)}
        />
        {/* El contador aparece cerca del tope y no antes: un número que
            baja desde 1.000 mientras escribes mete prisa sin motivo. */}
        {restantes <= 120 && (
          <span className="suave" style={{ fontSize: '0.78rem' }}>
            {restantes >= 0 ? `Quedan ${restantes} caracteres.` : 'Te has pasado del tope.'}
          </span>
        )}
      </div>

      <p className="suave" style={{ fontSize: '0.78rem', marginTop: -4 }}>
        Se manda lo que escribas aquí, la versión de la app, la pantalla en la que estabas y el
        error técnico si lo hubo. Nada más: ni capturas, ni lo que haya en otras pantallas.
      </p>

      {fallo && <p className="error-texto" role="alert">{fallo}</p>}

      <button
        className="btn btn-bloque"
        style={{ marginTop: 8 }}
        disabled={!revision.ok || enviando}
        onClick={mandar}
      >
        {enviando ? 'Mandando…' : 'Mandarlo'}
      </button>
      <button className="btn btn-fantasma btn-bloque" style={{ marginTop: 8 }} onClick={onClose}>
        Ahora no
      </button>
    </Modal>
  )
}
