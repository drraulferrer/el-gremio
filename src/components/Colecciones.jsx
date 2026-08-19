import { useState } from 'react'
import Sello from './Sello'
import { BLOQUES } from '../lib/sellos'
import { requisitosDe } from '../lib/sellos-motor'
import { nombreDeSello, detalleDeSello } from './SellosGanados'

// ------------------------------------------------------------------
// El catálogo entero, navegable.
//
// «Tu historia» enseña lo conseguido y el siguiente paso, que es lo
// accionable. Esto es lo otro: poder ver QUÉ HAY. Sin esta pantalla, las
// 73 piezas existían pero no había forma de mirarlas, y la pregunta
// razonable —«¿por qué solo salen 16?»— no tenía respuesta dentro de la
// app.
//
// Se recorre por SERIES, no por piezas sueltas: 73 cosas no se navegan,
// veinte series en seis bloques sí. Por eso los 32 caminos de oficio se
// ven como ocho caminos de cuatro grados.
//
// Cada bloque se abre y se cierra. Todos empiezan cerrados menos el
// primero: abrir con seis bloques desplegados es volver a enseñar 73
// cosas a la vez, que es justo lo que esta estructura evita.
// ------------------------------------------------------------------

/** Qué estado tiene una pieza dentro de su serie. */
function estadoDe(sello, i, sellos, mias) {
  if (mias.has(sello.id)) return 'conseguido'
  // El siguiente es el primero sin conseguir de la serie.
  const anteriores = sellos.slice(0, i)
  const esSiguiente = anteriores.every((s) => mias.has(s.id))
  if (!sello.regla) return 'sin_dato'
  return esSiguiente ? 'siguiente' : 'lejano'
}

const TEXTO_ESTADO = {
  conseguido: 'Conseguido',
  siguiente: 'El siguiente',
  lejano: 'Más adelante',
  sin_dato: 'Todavía no disponible'
}

/**
 * Por qué una pieza no se puede ganar aún. No es un fallo de nadie y el
 * texto tiene que decirlo: son datos que la app no recoge todavía.
 */
function porQueNoDisponible(sello) {
  if (sello.categoria === 'autonomia') {
    return 'Hace falta anotar cuánta ayuda necesita cada misión. Aún no se pide en ningún sitio.'
  }
  if (sello.id === 'descubrimiento_varias_generaciones') {
    return 'Hace falta saber la banda de edad de cada perfil, que todavía no se guarda.'
  }
  return 'Hace falta guardar un sello por cada temporada, y ahora solo cabe uno por persona.'
}

function Requisitos({ lista }) {
  if (!lista.length) return null
  return (
    <ul className="requisitos">
      {lista.map((r) => (
        <li key={r.etiqueta} className={r.cumple ? 'requisito cumple' : 'requisito'}>
          <span className="requisito-etiqueta">{r.etiqueta}</span>
          <span className="requisito-cifra">
            {r.actual.toLocaleString('es-ES')}{r.sufijo || ''}
            <span className="suave"> / {r.objetivo.toLocaleString('es-ES')}{r.sufijo || ''}</span>
            {r.cumple && <span className="requisito-ok" aria-label="cumplido"> ✓</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Serie({ serie, mias, proyeccion }) {
  const conseguidos = serie.sellos.filter((s) => mias.has(s.id)).length
  const siguiente = serie.sellos.find(
    (s, i) => estadoDe(s, i, serie.sellos, mias) === 'siguiente'
  )

  return (
    <li className="serie">
      <div className="serie-cabecera">
        <strong className="serie-nombre">{serie.nombre}</strong>
        <span className="suave serie-cuenta">{conseguidos} de {serie.sellos.length}</span>
      </div>
      <p className="suave serie-significado">{serie.significado}</p>

      <ol className="serie-piezas">
        {serie.sellos.map((s, i) => {
          const estado = estadoDe(s, i, serie.sellos, mias)
          return (
            <li key={s.id} className={`pieza pieza-${estado}`}>
              <Sello
                code={s.id}
                nombre={nombreDeSello(s)}
                conseguida={estado === 'conseguido'}
                tamano={44}
              />
              {/* El nombre completo va aquí y no en un tooltip: en un
                  móvil no hay hover, y un dato que solo existe al pasar
                  el ratón no existe. */}
              <span className="pieza-nombre">{nombreDeSello(s)}</span>
              {detalleDeSello(s) && <span className="pieza-cifra">{detalleDeSello(s)}</span>}
              <span className="pieza-estado">{TEXTO_ESTADO[estado]}</span>
            </li>
          )
        })}
      </ol>

      {siguiente && (
        <div className="serie-siguiente">
          {siguiente.regla && requisitosDe(proyeccion, siguiente.regla).length > 0 ? (
            <>
              <div className="serie-siguiente-titulo">
                Para «{nombreDeSello(siguiente)}» te falta:
              </div>
              <Requisitos lista={requisitosDe(proyeccion, siguiente.regla)} />
            </>
          ) : (
            <p className="suave" style={{ margin: 0 }}>
              {serie.id === 'regreso'
                ? 'Aparece solo, si algún día vuelves después de una pausa. No hay nada que perseguir.'
                : 'Aparece solo. No se persigue.'}
            </p>
          )}
        </div>
      )}

      {!siguiente && conseguidos < serie.sellos.length && (
        <p className="suave serie-siguiente">
          {porQueNoDisponible(serie.sellos[0])}
        </p>
      )}
    </li>
  )
}

function Bloque({ bloque, mias, proyeccion, abierto, onAlternar }) {
  const total = bloque.series.reduce((n, s) => n + s.sellos.length, 0)
  const conseguidos = bloque.series.reduce(
    (n, s) => n + s.sellos.filter((x) => mias.has(x.id)).length, 0
  )

  return (
    <section className="bloque-coleccion">
      <button
        className="bloque-cabecera"
        onClick={onAlternar}
        aria-expanded={abierto}
      >
        <span className="crece">
          <strong className="bloque-nombre">{bloque.nombre}</strong>
          <span className="suave bloque-significado">{bloque.significado}</span>
        </span>
        <span className="bloque-cuenta">{conseguidos} de {total}</span>
        <span className="bloque-flecha" aria-hidden="true">{abierto ? '▾' : '▸'}</span>
      </button>

      {abierto && (
        <ul className="lista-series">
          {bloque.series.map((s) => (
            <Serie key={s.id} serie={s} mias={mias} proyeccion={proyeccion} />
          ))}
        </ul>
      )}
    </section>
  )
}

export default function Colecciones({ mias, proyeccion }) {
  const [abiertos, setAbiertos] = useState(() => new Set(['camino']))

  const alternar = (id) => setAbiertos((prev) => {
    const siguiente = new Set(prev)
    if (siguiente.has(id)) siguiente.delete(id)
    else siguiente.add(id)
    return siguiente
  })

  const total = BLOQUES.reduce((n, b) => n + b.series.reduce((m, s) => m + s.sellos.length, 0), 0)
  const conseguidos = BLOQUES.reduce(
    (n, b) => n + b.series.reduce((m, s) => m + s.sellos.filter((x) => mias.has(x.id)).length, 0), 0
  )

  return (
    <div className="colecciones">
      {/* La cifra de arriba es «X sellos en tu historia», no «X de 73».
          Un denominador convierte una biografía en una lista de tareas
          por hacer, y además delata cuántas sorpresas quedan. El total
          de cada serie sí se ve, porque ahí sirve para orientarse. */}
      <p className="suave colecciones-intro">
        {conseguidos === 0
          ? `El catálogo tiene ${total} sellos. Se consiguen solos, haciendo misiones.`
          : `Llevas ${conseguidos} ${conseguidos === 1 ? 'sello' : 'sellos'}. Aquí está el catálogo entero.`}
      </p>

      {BLOQUES.map((b) => (
        <Bloque
          key={b.id}
          bloque={b}
          mias={mias}
          proyeccion={proyeccion}
          abierto={abiertos.has(b.id)}
          onAlternar={() => alternar(b.id)}
        />
      ))}
    </div>
  )
}
