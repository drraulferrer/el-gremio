import { useState } from 'react'
import { rasgoDeTipo } from '../lib/plantilla'
import Retrato from '../components/Retrato'
import { Modal } from '../components/ui'
import {
  darGracias, hechosDe, aQuienPuedoDar, quedanHoy, validarTexto,
  TEXTO_MAXIMO, TOPE_DIARIO
} from '../lib/gracias'
import { dayKey } from '../lib/supabase'
import { flex } from '../lib/genero'

// ------------------------------------------------------------------
// «Dar las gracias»: dos toques y fuera.
//
// A quién → por qué. En ese orden y no al revés, porque en una casa uno
// piensa primero en la persona.
//
// El «por qué» NUNCA arranca en folio en blanco: se proponen los encargos
// REALES que esa persona hizo estos días y que todavía no tienen palabras
// (§10.3). Escribir es la salida, no la entrada. Es la misma lección que
// el elogio al validar, donde cada sugerencia ES el botón: cuando hubo
// que escribir, no se escribió.
//
// En un piso compartido la pieza principal es la otra —lo que NADIE
// pidió—, así que ahí se ofrece primero: entre convivientes adultos no
// hay validación jerárquica, y lo que se reparte mal no son las tareas
// del catálogo sino lo que nadie apuntó (§10.4).
// ------------------------------------------------------------------

export default function DarGracias({ family, data, profile, genero = 'neutro', onHecho, onClose }) {
  const [aQuien, setAQuien] = useState(null)
  const [texto, setTexto] = useState('')
  const [hecho, setHecho] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState('')
  const [listo, setListo] = useState(false)
  // Lo que NADIE pidió. En un piso viene marcado de serie porque ahí es la
  // pieza principal (§10.4); en una familia es una opción, y existe
  // porque el catálogo de misiones no cubre la carga que no se ve.
  const [espontaneo, setEspontaneo] = useState(false)

  // «Encargos» es un eje del tipo (migración 053): en una casa con adultos y
  // criaturas hay quien reparte tareas, y dar las gracias parte de una; en un
  // piso o entre amigos no hay jerarquía que reparta, así que siempre es
  // espontáneo. Sin plantilla, lo de siempre: mirar si es un piso.
  const hayEncargos = rasgoDeTipo(data?.plantilla, 'encargos', family.tipo_gremio !== 'piso')
  const sinEncargo = espontaneo || !hayEncargos
  const gente = aQuienPuedoDar(data.profiles, profile.id)
  const quedan = quedanHoy(data.reconocimientos, profile.id, dayKey(new Date(), family.timezone))
  const sugerencias = aQuien ? hechosDe(aQuien.id, data) : []

  async function mandar(tipo) {
    setEnviando(true)
    setFallo('')
    const r = await darGracias({
      family,
      de: profile.id,
      a: aQuien.id,
      tipo,
      texto,
      completionId: hecho?.completionId || null
    })
    setEnviando(false)
    if (!r.ok) {
      setFallo(r.mensaje || 'No ha podido salir. Inténtalo otra vez.')
      return
    }
    setListo(true)
    await onHecho?.()
  }

  if (listo) {
    return (
      <Modal titulo="Dicho" onClose={onClose}>
        <p role="status">
          Se lo hemos dejado a {aQuien.name} en su muro. Lo verá la próxima vez que entre.
        </p>
        <button className="btn btn-bloque" style={{ marginTop: 12 }} onClick={onClose} autoFocus>
          Cerrar
        </button>
      </Modal>
    )
  }

  if (quedan === 0) {
    return (
      <Modal titulo="Por hoy ya está" onClose={onClose}>
        <p>
          Has dado tus {TOPE_DIARIO} gracias de hoy. Mañana hay {TOPE_DIARIO} más.
        </p>
        {/* Que sean pocos no es una limitación técnica: es la pieza. */}
        <p className="suave">Son pocos a propósito: lo que se puede dar infinitas veces deja de valer.</p>
        <button className="btn btn-bloque" style={{ marginTop: 12 }} onClick={onClose}>Cerrar</button>
      </Modal>
    )
  }

  if (!aQuien) {
    return (
      <Modal titulo="Dar las gracias" onClose={onClose}>
        <p className="suave" style={{ marginTop: -4 }}>¿A quién?</p>
        <div className="picker-grid">
          {gente.map((p) => (
            <button
              key={p.id}
              className="picker-perfil"
              style={{ borderColor: p.color }}
              onClick={() => setAQuien(p)}
            >
              <Retrato perfil={p} tamano={72} vista="cabeza" />
              <span className="picker-nombre">{p.name}</span>
            </button>
          ))}
        </div>
        {gente.length === 0 && <div className="vacio">No hay nadie más en el gremio todavía.</div>}
        <p className="suave" style={{ marginTop: 10 }}>
          Te quedan {quedan} de {TOPE_DIARIO} hoy. No dan Talis ni XP: solo se dicen.
        </p>
      </Modal>
    )
  }

  const revision = validarTexto(texto)

  return (
    <Modal titulo={`Gracias a ${aQuien.name}`} onClose={onClose}>
      {hayEncargos && sugerencias.length > 0 && (
        <>
          <p className="suave" style={{ marginTop: -4 }}>¿Por qué? Esto ha hecho estos días:</p>
          {sugerencias.map((h) => (
            <button
              key={h.completionId}
              className={'btn btn-bloque ' + (hecho?.completionId === h.completionId ? '' : 'btn-fantasma')}
              style={{ marginBottom: 8, textAlign: 'left' }}
              onClick={() => {
                setHecho(h)
                setEspontaneo(false)
                setTexto(`Gracias por ${(flex(h.titulo, genero) || 'lo de antes').toLowerCase()}.`)
              }}
            >
              {h.emoji} {flex(h.titulo, genero)}
            </button>
          ))}
        </>
      )}

      {/* La opción que hace visible lo invisible. En familia va detrás de
          los encargos porque lo normal es reconocer algo que se hizo; en
          un piso va de serie, que allí lo que se reparte mal es justo lo
          que nadie apuntó. */}
      {hayEncargos && (
        <button
          className={'btn btn-bloque btn-mini ' + (espontaneo ? '' : 'btn-fantasma')}
          style={{ marginTop: 4 }}
          aria-pressed={espontaneo}
          onClick={() => { setEspontaneo(!espontaneo); setHecho(null) }}
        >
          ✨ Fue algo que nadie le pidió
        </button>
      )}

      <div className="campo" style={{ marginTop: 8 }}>
        <label htmlFor="gracias-texto">
          {sinEncargo ? 'Algo que nadie le pidió y aun así hizo' : 'O escríbelo tú'}
        </label>
        <textarea
          id="gracias-texto"
          value={texto}
          maxLength={TEXTO_MAXIMO}
          placeholder={sinEncargo
            ? 'Repusiste el papel sin que nadie dijera nada.'
            : 'Gracias por acordarte de la mochila.'}
          onChange={(e) => { setTexto(e.target.value); setHecho(null) }}
        />
      </div>

      {fallo && <p className="error-texto" role="alert">{fallo}</p>}

      <button
        className="btn btn-bloque"
        disabled={!revision.ok || enviando}
        onClick={() => mandar(sinEncargo && !hecho ? 'espontaneo' : 'gracias')}
      >
        {enviando ? 'Mandando…' : 'Decírselo'}
      </button>
      <button className="btn btn-fantasma btn-bloque" style={{ marginTop: 8 }} onClick={() => setAQuien(null)}>
        Elegir a otra persona
      </button>
    </Modal>
  )
}
