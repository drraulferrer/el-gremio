import { useEffect, useRef } from 'react'
import Sello from './Sello'
import { selloPorId, esSecreto } from '../lib/sellos'
import { insigniaPorCodigo } from '../lib/insignias'
import { loreDeSello, loreDeInsignia, condicionDe, poderDeInsignia } from '../lib/sellos-lore'
import { nombreDeSello, detalleDeSello } from './SellosGanados'
import { flex } from '../lib/genero'

// ------------------------------------------------------------------
// La ficha de un sello, a pantalla completa.
//
// Contesta cuatro preguntas, en el orden en que la gente las hace:
//
//   1. ¿Por qué la tengo?   → la condición, sacada de la REGLA
//   2. ¿Qué significa?      → qué reconoce, en lenguaje directo
//   3. …                    → el mismo hecho contado desde el Gremio
//   4. ¿Y esto qué implica? → qué cambia por tenerla
//
// El orden importa. Empezar por el lore sería empezar por el adorno, y
// quien abre esto casi siempre viene a resolver la primera: «¿esta de
// dónde ha salido?».
//
// La condición se COMPONE de la regla en vez de escribirse a mano. Un
// texto a mano dice lo que decía el día que se escribió; si mañana un
// umbral cambia, esta pantalla seguiría prometiendo el viejo.
// ------------------------------------------------------------------

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

function fechaLarga(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

export default function SelloDetalle({ code, concesion, genero = 'neutro', onClose }) {
  const cerrar = useRef(null)

  useEffect(() => {
    const antes = document.activeElement
    cerrar.current?.focus()
    const conTecla = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', conTecla)
    return () => {
      document.removeEventListener('keydown', conTecla)
      if (antes instanceof HTMLElement) antes.focus()
    }
  }, [onClose])

  const sello = selloPorId(code)
  const vieja = insigniaPorCodigo(code)
  const texto = sello ? loreDeSello(sello) : loreDeInsignia(code)
  if (!texto) return null

  const nombre = sello ? nombreDeSello(sello) : flex(vieja.name, genero)
  const cifra = sello ? detalleDeSello(sello) : null
  const condicion = sello ? condicionDe(sello) : (vieja?.desc ? [vieja.desc] : [])
  const cuando = fechaLarga(concesion?.earned_at)
  const poder = poderDeInsignia(code)

  return (
    <div className="modal-fondo detalle-fondo" onClick={onClose}>
      <div
        className="detalle-sello"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalle-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={cerrar} className="detalle-cerrar" onClick={onClose} aria-label="Cerrar">×</button>

        <div className="detalle-pieza">
          <Sello code={code} nombre={nombre} conseguida tamano={168} />
        </div>

        <h2 id="detalle-titulo" className="detalle-nombre">{nombre}</h2>
        {cifra && <p className="detalle-cifra">{cifra}</p>}

        {/* Primero el motivo: es a lo que se viene. */}
        {condicion.length > 0 && (
          <section className="detalle-bloque">
            <h3 className="detalle-epigrafe">Por qué la tienes</h3>
            {cuando && <p className="detalle-fecha">La conseguiste el {cuando}.</p>}
            <ul className="detalle-condicion">
              {condicion.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </section>
        )}

        <section className="detalle-bloque">
          <h3 className="detalle-epigrafe">Qué significa</h3>
          <p>{texto.significado}</p>
          {texto.nota && <p className="detalle-nota">{texto.nota}</p>}
        </section>

        <blockquote className="detalle-lore">{texto.lore}</blockquote>

        <section className="detalle-bloque detalle-implica">
          <h3 className="detalle-epigrafe">Qué implica en el Gremio</h3>
          <p>{texto.implica}</p>
          {poder ? (
            <p className="detalle-poder">Da un poder — {poder}</p>
          ) : (
            // Se dice en voz alta a propósito. Es la promesa del sistema
            // entero: si un sello diera Talis, sería un cupón, y la razón
            // de hacer la misión pasaría a ser el cupón.
            <p className="suave detalle-sin-economia">
              No da Talis, ni XP, ni ninguna ventaja. Un sello no se compra ni se gasta:
              se queda, y cuenta algo de ti que ya es verdad.
            </p>
          )}
        </section>

        <button className="btn btn-bloque" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  )
}

/** ¿Se puede abrir la ficha de este código? */
export function tieneDetalle(code) {
  const sello = selloPorId(code)
  if (sello) return Boolean(loreDeSello(sello))
  return Boolean(loreDeInsignia(code))
}

export { esSecreto }
