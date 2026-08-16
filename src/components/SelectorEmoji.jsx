import { useState } from 'react'
import { GRUPOS_EMOJI_PREMIO, buscarEmojiPremio } from '../lib/emojis'

// ------------------------------------------------------------------
// Rejilla de emojis con grupos y buscador.
//
// Con doce emojis bastaba una fila; con ochenta y seis hace falta poder
// encontrarlos, y por eso el buscador va por nombre («piscina», «peli»,
// «abuela») y no por categoría: quien está creando un premio ya sabe qué
// premio es, lo que no sabe es en qué grupo lo hemos metido nosotros.
//
// La caja tiene altura máxima y se desplaza dentro. Sin eso, el
// formulario de un premio pasaba a medir tres pantallas y el botón de
// guardar quedaba en Marte.
// ------------------------------------------------------------------

export default function SelectorEmoji({ valor, onElegir, id = 'emoji' }) {
  const [busqueda, setBusqueda] = useState('')
  const buscando = busqueda.trim().length > 0
  const encontrados = buscando ? buscarEmojiPremio(busqueda) : []

  return (
    <div className="selector-emoji">
      <input
        id={id}
        type="search"
        className="selector-emoji-buscar"
        placeholder="Buscar: piscina, peli, abuela…"
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
          GRUPOS_EMOJI_PREMIO.map((g) => (
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
