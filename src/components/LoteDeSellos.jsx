import Sello from './Sello'
import { selloPorId } from '../lib/sellos'
import { useFocoDialogo } from '../lib/dialogo'
import { insigniaPorCodigo } from '../lib/insignias'
import { flex } from '../lib/genero'

// ------------------------------------------------------------------
// La celebración de un lote de sellos.
//
// UNA sola por lote, y esa es toda la razón de que este componente
// exista. Cerrar una meta puede desbloquear a la vez un escalón de
// trayectoria, un grado de oficio y una exploración; con un modal por
// insignia, quien acaba de hacer la cama se come tres pantallas seguidas
// y la tercera ya no significa nada.
//
// El caso extremo es el primer encendido del motor: años de historial se
// evalúan de golpe y pueden caer veinte sellos juntos. Por eso la portada
// muestra tres y el resto se resume («y N más»), en vez de una lista
// interminable que nadie lee.
// ------------------------------------------------------------------

/** Nombre legible de un código, venga del catálogo nuevo o de las 16. */
function nombreDe(code, genero) {
  const vieja = insigniaPorCodigo(code)
  if (vieja) return flex(vieja.name, genero)

  const sello = selloPorId(code)
  if (!sello) return 'Sello nuevo'
  if (sello.grado) return `${sello.grado} de ${etiquetaHabilidad(sello.habilidad)}`
  if (sello.umbral) return `${sello.umbral} ${sello.categoria === 'ritmo' ? 'días' : 'encargos'}`
  return TITULOS[sello.categoria] || 'Sello nuevo'
}

const TITULOS = {
  primeros_encargos: 'Primer encargo',
  exploracion: 'Nuevos caminos',
  equilibrio: 'Equilibrio',
  obra_comun: 'Obra común',
  regreso_al_taller: 'Regreso al taller',
  descubrimientos: 'Descubrimiento'
}

const HABILIDADES = {
  hogar: 'Hogar', salud: 'Salud', aprendizaje: 'Aprendizaje', amabilidad: 'Amabilidad',
  responsabilidad: 'Responsabilidad', cooperacion: 'Cooperación', creatividad: 'Creatividad',
  autonomia: 'Autonomía'
}
const etiquetaHabilidad = (id) => HABILIDADES[id] || id

/**
 * Con qué frase se encabeza el lote. Sin superlativos: lo que se
 * reconoce es lo que se hizo, no lo excepcional que es quien lo hizo.
 */
function titular(cuantos) {
  if (cuantos === 1) return 'Un sello nuevo en tu historia'
  return `${cuantos} sellos nuevos en tu historia`
}

export default function LoteDeSellos({ codigos = [], genero = 'neutro', onClose }) {
  const cerrar = useFocoDialogo(onClose)

  if (!codigos.length) return null

  const portada = codigos.slice(0, 3)
  const resto = codigos.length - portada.length

  return (
    <div className="modal-fondo" onClick={onClose}>
      <div
        className="modal lote-sellos"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lote-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="lote-titulo">{titular(codigos.length)}</h3>

        <div className="lote-piezas">
          {portada.map((code) => (
            <div className="lote-pieza" key={code}>
              <Sello code={code} nombre={nombreDe(code, genero)} conseguida tamano={72} />
              <span className="lote-nombre">{nombreDe(code, genero)}</span>
            </div>
          ))}
        </div>

        {resto > 0 && (
          <p className="suave lote-resto">
            Y {resto} {resto === 1 ? 'más' : 'más'}. {'Están todos en Progreso.'}
          </p>
        )}

        <p className="suave">
          Los sellos cuentan lo que has aprendido a hacer y lo que has sostenido
          en el tiempo. No se gastan y no se pierden.
        </p>

        <button ref={cerrar} className="btn btn-bloque" onClick={onClose}>
          Seguir
        </button>
      </div>
    </div>
  )
}
