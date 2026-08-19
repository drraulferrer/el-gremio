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

/**
 * El nombre del sello. Sale del catálogo, que los tiene todos.
 *
 * Antes se derivaba de la CATEGORÍA, y eso hacía que las tres piezas de
 * «Actividades distintas» se llamaran las tres «Nuevos caminos»: tres
 * cromos con el mismo nombre en la misma fila, indistinguibles.
 */
export function nombreDeSello(sello) {
  return sello?.nombre || 'Sello'
}

/**
 * La cifra exacta de un escalón, cuando la tiene.
 *
 * «Dos meses de presencia» y «Un año de jornadas» son nombres narrativos
 * de 60 y 250 jornadas ACUMULADAS, no de dos meses ni de un año de
 * calendario. El catálogo obliga a enseñar siempre el número al lado
 * justamente para no crear esa equivalencia falsa.
 */
export function detalleDeSello(sello) {
  if (sello?.categoria === 'ritmo') return `${sello.umbral} días`
  if (sello?.categoria === 'trayectoria') return `${sello.umbral} encargos`
  return null
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
