import Sello from './Sello'
import { SELLOS_V1, selloPorId } from '../lib/sellos'

// ------------------------------------------------------------------
// «Tu historia en el Gremio»: los sellos del catálogo v1 conseguidos.
//
// NO se dibujan los 73. El catálogo tiene 23 series y enseñarlas todas a
// la vez convierte una biografía en una pared de candados: la primera vez
// que alguien abre esto vería 70 huecos y 3 piezas, que es justo la
// lectura contraria a la que se busca. Se muestra lo conseguido y, de lo
// que falta, solo el SIGUIENTE escalón de cada serie —y como mucho tres—.
//
// Cuando no hay nada todavía, la sección entera no aparece. Un titular
// con un vacío debajo no informa de nada.
// ------------------------------------------------------------------

/** A qué serie pertenece un sello, para no proponer dos de la misma. */
function serieDe(sello) {
  if (sello.habilidad) return `oficio_${sello.habilidad}`
  if (sello.categoria === 'exploracion') return sello.id.replace(/_\d+$/, '')
  return sello.categoria
}

const NOMBRES = {
  primeros_encargos: 'Primer encargo',
  ritmo: (s) => `${s.umbral} días con presencia`,
  trayectoria: (s) => `${s.umbral} encargos repartidos`,
  caminos_de_oficio: (s) => `${s.grado} de ${HABILIDADES[s.habilidad]}`,
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

export function nombreDeSello(sello) {
  const n = NOMBRES[sello.categoria]
  return typeof n === 'function' ? n(sello) : n || 'Sello'
}

export default function SellosGanados({ mias }) {
  const conseguidos = SELLOS_V1.filter((s) => mias.has(s.id))
  if (!conseguidos.length) return null

  // El siguiente de cada serie: el primero que aún no se tiene, y solo de
  // series ya empezadas. Proponer un camino que nadie ha pisado sería
  // convertir el catálogo en una lista de deberes.
  const empezadas = new Set(conseguidos.map(serieDe))
  const vistas = new Set()
  const siguientes = []
  for (const s of SELLOS_V1) {
    if (!s.regla || mias.has(s.id)) continue
    const serie = serieDe(s)
    if (!empezadas.has(serie) || vistas.has(serie)) continue
    vistas.add(serie)
    siguientes.push(s)
    if (siguientes.length === 3) break
  }

  return (
    <>
      <div className="titulo-seccion">
        Tu historia en el Gremio · {conseguidos.length} {conseguidos.length === 1 ? 'sello' : 'sellos'}
      </div>

      <ul className="grid-sellos">
        {conseguidos.map((s) => (
          <li className="sello-ficha" key={s.id}>
            <Sello code={s.id} nombre={nombreDeSello(s)} conseguida tamano={56} />
            <span className="sello-ficha-nombre">{nombreDeSello(s)}</span>
          </li>
        ))}
      </ul>

      {siguientes.length > 0 && (
        <>
          <div className="titulo-seccion">Lo siguiente en tus caminos</div>
          <ul className="grid-sellos">
            {siguientes.map((s) => (
              <li className="sello-ficha" key={s.id}>
                <Sello code={s.id} nombre={nombreDeSello(s)} tamano={56} />
                <span className="sello-ficha-nombre">{nombreDeSello(s)}</span>
                <span className="ins-estado">Aún no</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

export { serieDe, selloPorId }
