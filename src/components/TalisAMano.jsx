// ------------------------------------------------------------------
// El aviso de los Talis a mano.
//
// Por qué existe: el premio a mano obliga a escribir un motivo para que
// «dentro de un mes se sepa por qué» (ver src/lib/premioManual.js), y
// hasta ahora ese motivo solo lo leía quien lo escribía. A quien los
// recibe le subía la Bolsa sin más. Reconocer algo y no decírselo a la
// persona no es reconocer: es contabilizar.
//
// LA FRASE ES LO IMPORTANTE, no la cifra. Por eso el motivo va en
// grande y entrecomillado —es lo que alguien se paró a escribir— y la
// cantidad va debajo, a media voz. Al revés esto sería una nómina.
//
// Y va aparte de la celebración de misión (`Celebracion`) a propósito:
// una misión validada es el sistema funcionando; unos Talis a mano son
// justo lo contrario, alguien saliéndose del sistema porque la vida no
// cabía en el catálogo. Si las dos cosas se vieran igual, la excepción
// dejaría de notarse, que es lo único que la hace valer.
// ------------------------------------------------------------------

import { useEffect, useRef } from 'react'
import { fechaCorta } from '../lib/muro'
import { vibrar, LOGRO } from '../lib/vibrar'
import { Talis } from './ui'

export default function TalisAMano({ premios = [], onClose }) {
  const cerrar = useRef(null)

  // El foco entra en el diálogo y vuelve al salir. Sin esto, quien
  // navega con teclado se queda en el botón de detrás y no puede cerrar
  // lo que tiene delante.
  useEffect(() => {
    // El háptico de logro, el mismo que una misión validada. No es un
    // adorno: este diálogo aparece sin que nadie lo haya pedido, y un
    // toque avisa de que ha pasado algo antes de que nadie lea nada.
    vibrar(LOGRO)

    const antes = document.activeElement
    cerrar.current?.focus()
    const conTecla = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', conTecla)
    return () => {
      document.removeEventListener('keydown', conTecla)
      if (antes instanceof HTMLElement) antes.focus()
    }
  }, [onClose])

  if (!premios.length) return null

  const total = premios.reduce((t, p) => t + p.coins, 0)
  const varios = premios.length > 1

  return (
    <div className="modal-fondo" onClick={onClose}>
      <div
        className="modal talis-mano"
        role="dialog"
        aria-modal="true"
        aria-labelledby="talis-mano-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="talis-mano-titulo">Talis a mano</h3>

        {/* Una sola ficha, y grande: la del componente `Talis`, que se
            mide en `em` y crece con la cifra. Hubo un momento con una
            ficha decorativa arriba ADEMÁS de esta, y dos monedas en la
            misma tarjeta se leían como dos importes. */}
        <p className="talis-mano-cifra">
          <Talis n={total} />
        </p>

        <ul className="talis-mano-lista">
          {premios.map((p) => (
            <li key={p.id}>
              <p className="talis-mano-motivo">“{p.motivo}”</p>
              <p className="suave talis-mano-firma">
                {p.quien ? `Lo decidió ${p.quien}` : 'Lo decidió el gremio'}
                {p.cuando ? ` · ${fechaCorta(p.cuando)}` : ''}
                {varios ? ' · ' : ''}
                {varios ? <Talis n={p.coins} /> : null}
              </p>
            </li>
          ))}
        </ul>

        {/* Qué son y qué NO son. Esta frase es la que evita que el premio
            a mano se lea como «hay una forma más rápida de cobrar»: no
            da XP, no sube de nivel y no cuenta para la meta. */}
        <p className="suave">
          Estos Talis no vienen de ninguna misión: alguien del gremio decidió que esto
          merecía reconocerse. No suman XP ni cuentan para la meta, y no se pueden pedir.
        </p>

        <button ref={cerrar} className="btn btn-bloque" onClick={onClose}>
          Gracias
        </button>
      </div>
    </div>
  )
}
