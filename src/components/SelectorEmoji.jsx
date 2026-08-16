import { useState } from 'react'
import { GRUPOS_EMOJI_PREMIO, buscarEmoji } from '../lib/emojis'


// ------------------------------------------------------------------
// Rejilla de emojis con grupos y buscador.
//
// Con doce emojis bastaba una fila; con noventa hace falta poder
// encontrarlos, y por eso el buscador va por nombre («piscina», «peli»,
// «abuela») y no por categoría: quien está creando un premio ya sabe qué
// premio es, lo que no sabe es en qué grupo lo hemos metido nosotros.
//
// Sirve para las tres cosas que llevan emoji —premios, misiones y la meta
// del gremio— con el catálogo que se le pase. Los de misión son otros: una
// misión es una acción de la casa y el dibujo tiene que decir cuál en un
// vistazo, que es como lo lee la peque en su rejilla.
//
// La caja tiene altura máxima y se desplaza dentro. Sin eso, el
// formulario de un premio pasaba a medir tres pantallas y el botón de
// guardar quedaba en Marte.
// ------------------------------------------------------------------

export default function SelectorEmoji({ valor, onElegir, id = 'emoji', grupos = GRUPOS_EMOJI_PREMIO, ejemplos = 'piscina, peli, abuela' }) {
  const [busqueda, setBusqueda] = useState('')
  const buscando = busqueda.trim().length > 0
  const catalogo = grupos.flatMap((g) => g.emojis)
  const encontrados = buscando ? buscarEmoji(busqueda, catalogo) : []

  return (
    <div className="selector-emoji">
      <input
        id={id}
        type="search"
        className="selector-emoji-buscar"
        placeholder={`Buscar: ${ejemplos}…`}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="selector-emoji-caja">
        {buscando && encontrados.length === 0 && (
          <p className="suave">Nada con ese nombre. Prueba con otra palabra, o elige uno de la lista borrando la búsqueda.</p>
        )}

        {buscando ? (
          <Rejilla emojis={encontrados} valor={valor} onElegir={onElegir} />
        ) : (
          grupos.map((g) => (
            <div key={g.grupo} className="selector-emoji-grupo">
              <div className="selector-emoji-titulo">
                {g.grupo}
                {g.ayuda && <em>{g.ayuda}</em>}
              </div>
              <Rejilla emojis={g.emojis} valor={valor} onElegir={onElegir} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Rejilla({ emojis, valor, onElegir }) {
  return (
    <div className="grid-emojis">
      {emojis.map((x) => (
        <button
          key={x.e}
          type="button"
          className={valor === x.e ? 'sel' : ''}
          aria-label={x.n}
          aria-pressed={valor === x.e}
          onClick={() => onElegir(x.e)}
        >
          {x.e}
        </button>
      ))}
    </div>
  )
}
