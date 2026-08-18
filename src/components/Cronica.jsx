import { useEffect, useRef } from 'react'
import {
  FRAGMENTOS, fragmentosDesbloqueados, fragmentosNuevos, queFaltaPara
} from '../lib/talis'

// ------------------------------------------------------------------
// La Crónica del Gremio: la historia de los Talis, contada a trozos.
//
// Por qué NO se enseña entera desde el principio: soltar el lore completo
// en el onboarding es la forma más rápida de que nadie lo lea. Cada
// fragmento llega cuando quien lo lee ya ha vivido lo que cuenta —el
// primero al ganar el primer Talis, el último cuando ya tiene insignias y
// puede entender por qué esas no se compran—.
//
// Y por qué los cerrados SÍ se ven, en vez de aparecer de la nada: un
// hueco vacío no se busca. Ver que faltan tres piezas y cuánto cuesta
// cada una es lo que convierte una colección en algo a lo que ir. Es la
// misma decisión que en la tienda de la peque, donde los premios que
// todavía no alcanza se ven apagados en vez de esconderse.
//
// Lo único que se guarda es qué fragmentos ya se han visto, y se guarda
// en localStorage a propósito: es preferencia de un aparato, no un dato
// del gremio. Meterlo en Postgres habría pedido una migración para
// decidir dónde va una pastilla de «Nuevo».
// ------------------------------------------------------------------

const CLAVE = 'gremio_cronica_'

function leidosDe(profileId) {
  try {
    return JSON.parse(localStorage.getItem(CLAVE + profileId) || '[]')
  } catch {
    return []
  }
}

function marcarLeidos(profileId, ids) {
  try {
    localStorage.setItem(CLAVE + profileId, JSON.stringify(ids))
  } catch {
    // Sin localStorage (modo privado) la pastilla de «Nuevo» sale cada
    // vez. Molesta poco y no rompe nada.
  }
}

export default function Cronica({ profile, progreso }) {
  const abiertos = fragmentosDesbloqueados(progreso)
  const abiertosIds = new Set(abiertos.map((f) => f.id))

  // Lo que ya estaba leído AL ENTRAR, congelado en una ref por persona.
  //
  // Tiene que ser una foto y no una lectura viva, porque el efecto de
  // abajo escribe en el mismo sitio del que esto lee. Con estado normal
  // la marca se pisaba a sí misma: StrictMode ejecuta el efecto dos
  // veces en desarrollo, la primera marcaba leído y la segunda ya no
  // encontraba nada nuevo, así que la pastilla no llegaba a verse nunca.
  const leidos = useRef(null)
  if (leidos.current?.profileId !== profile.id) {
    leidos.current = { profileId: profile.id, ids: new Set(leidosDe(profile.id)) }
  }
  const nuevos = new Set(abiertos.filter((f) => !leidos.current.ids.has(f.id)).map((f) => f.id))

  // Marcar leído no cambia lo de arriba: la pastilla dura esta visita,
  // que es justo lo que tiene que durar un descubrimiento.
  useEffect(() => {
    if (fragmentosNuevos(progreso, [...leidos.current.ids]).length) {
      marcarLeidos(profile.id, [...abiertosIds])
    }
  }, [profile.id, progreso.ganados, progreso.insignias]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="titulo-seccion">
        La crónica de los Talis · {abiertos.length} de {FRAGMENTOS.length}
      </div>

      {abiertos.length === 0 ? (
        <div className="vacio">
          Tu primer Talis abrirá el primer fragmento de la historia del Gremio.
        </div>
      ) : null}

      <ol className="cronica">
        {FRAGMENTOS.map((f) => {
          const abierto = abiertosIds.has(f.id)
          const falta = queFaltaPara(f, progreso)
          return (
            <li className={'fragmento' + (abierto ? '' : ' cerrado')} key={f.id}>
              <span className="frag-romano" aria-hidden="true">{abierto ? f.romano : '🔒'}</span>
              <div className="crece">
                <div className="fila-separada">
                  <strong>{abierto ? f.titulo : `Fragmento ${f.romano}`}</strong>
                  {abierto && nuevos.has(f.id) && <span className="frag-nuevo">Nuevo</span>}
                </div>
                {abierto ? (
                  <p className="frag-texto">{f.texto}</p>
                ) : (
                  <div className="suave" style={{ fontSize: '0.82rem', marginTop: 2 }}>{falta}</div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {abiertos.length === FRAGMENTOS.length && (
        <p className="suave" style={{ margin: '0 4px 12px', fontSize: '0.84rem' }}>
          Historia completa. Un Talis no vale por lo que puedes comprar con él: vale
          por lo que hiciste para ganarlo.
        </p>
      )}
    </>
  )
}
