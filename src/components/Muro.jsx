import { useState } from 'react'
import { fechaCorta } from '../lib/muro'
import { flex } from '../lib/genero'

// ------------------------------------------------------------------
// El Muro: lo que te han dicho, junto y sin caducar.
//
// Dos formatos con la misma materia:
//
//  · `normal` — para quien lee. La frase manda: va grande y entrecomillada,
//    y debajo, pequeño, de qué encargo salió y qué día.
//  · `peque` — para quien no lee. Manda el dibujo del encargo, y la frase
//    va debajo en pequeño para el adulto que pase y se la lea en voz alta
//    (§10.2 de la spec: leerlo una persona es mejor que cualquier voz
//    sintética, y además es el momento bueno de todo esto).
//
// Sin contadores en ninguno de los dos. Un número de frases recibidas al
// lado del nombre convierte el muro en un marcador, y ese es justo el
// ranking que la app no tiene a propósito.
// ------------------------------------------------------------------

const TOPE = 30

export default function Muro({ elogios = [], challenges = [], genero = 'neutro', formato = 'normal' }) {
  const [todo, setTodo] = useState(false)
  const visibles = todo ? elogios : elogios.slice(0, TOPE)
  const retoDe = (id) => challenges.find((c) => c.id === id)

  if (elogios.length === 0) {
    return (
      <div className="vacio">
        {formato === 'peque'
          ? 'Todavía no hay frases. Aparecen cuando alguien te dice qué has hecho bien.'
          : 'Todavía no hay ninguna. Aparecen aquí cuando alguien valida una misión tuya y escribe qué has hecho bien.'}
      </div>
    )
  }

  if (formato === 'peque') {
    return (
      <div className="muro-peque">
        {visibles.map((e) => (
          <div className="muro-peque-frase" key={e.id}>
            {/* Si hay remitente manda su cara: a los tres años «quién me
                lo dice» se entiende mucho antes que «por qué». */}
            <span className="muro-peque-emoji" aria-hidden="true">
              {e.de?.emoji || retoDe(e.challengeId)?.emoji || '⭐'}
            </span>
            <div>
              <p className="muro-peque-texto">
                {e.tipo === 'gesto' ? `${e.de?.name || 'Alguien'} te dio las gracias ⭐` : e.texto}
              </p>
              <p className="muro-fecha">{fechaCorta(e.ts)}</p>
            </div>
          </div>
        ))}
        {!todo && elogios.length > TOPE && (
          <button className="btn btn-fantasma btn-bloque" onClick={() => setTodo(true)}>
            Ver todas
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {visibles.map((e) => {
        const reto = retoDe(e.challengeId)
        return (
          <div className="carta muro-frase" key={e.id}>
            {e.tipo === 'gesto' ? (
              <p className="muro-texto">
                ⭐ {e.de?.name || 'Alguien'} te dio las gracias
              </p>
            ) : (
              <p className="muro-texto">“{e.texto}”</p>
            )}
            {/* Se marca porque NO es lo mismo: reconocer un encargo es
                decir «bien hecho»; esto es decir «me di cuenta», que es
                justo lo que no tenía sitio en la app. */}
            {e.tipo === 'espontaneo' && <span className="chip chip-espontaneo">✨ Nadie te lo pidió</span>}
            <p className="muro-fecha">
              {/* La firma primero cuando la hay: quién lo dijo pesa más
                  que de qué encargo salió. Los elogios de validación no
                  pueden firmarse —`completions` no guarda quién validó—,
                  así que ahí manda el encargo. */}
              {e.de ? `${e.de.emoji || '·'} ${e.de.name} · ` : ''}
              {reto?.emoji ? `${reto.emoji} ` : ''}
              {e.de && !reto ? '' : (flex(reto?.title, genero) || 'Una misión') + ' · '}
              {fechaCorta(e.ts)}
            </p>
          </div>
        )
      })}
      {!todo && elogios.length > TOPE && (
        <button className="btn btn-fantasma btn-bloque" onClick={() => setTodo(true)}>
          Ver las {elogios.length - TOPE} anteriores
        </button>
      )}
    </div>
  )
}
