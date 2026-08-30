import { useEffect, useState } from 'react'
import { abandonarGremio, leerPertenencias } from '../lib/acciones'

// ------------------------------------------------------------------
// Dejar un gremio.
//
// SOLO APARECE SI HAY ALGO QUE DEJAR. Quien opera con la clave compartida de
// la casa no tiene pertenencia: no «pertenece» al gremio, ES el gremio. Para
// esa persona la salida es borrar la cuenta, que está justo debajo, y
// enseñarle además un «dejar el gremio» que no le corresponde solo sería una
// forma de asustar.
//
// Y NO SE PARECE A BORRAR LA CUENTA, a propósito. Borrar es definitivo y por
// eso pide escribir el nombre. Salir no lo es: el personaje se retira, no se
// borra, y si te vuelven a invitar recuperas ese mismo personaje con su
// nivel, su historial y sus insignias (`R-63`). Lo que cuesta volver es una
// llave nueva, y eso es lo que hay que decir claro — no un muro de fricción
// que sugiera una gravedad que no tiene.
// ------------------------------------------------------------------

const RESPUESTAS = {
  ok: null,
  sin_sesion: 'Se ha cerrado la sesión. Vuelve a entrar.',
  no_estas_dentro: 'Ya no pertenecías a este gremio.',
  // El único que para de verdad. Se explica entero porque la salida existe,
  // solo que pasa por otro sitio.
  eres_quien_titula:
    'Eres quien titula este gremio y no hay nadie más que lo administre. ' +
    'Antes de salir, pasa la titularidad a otra persona o cierra el gremio.'
}

export default function DejarElGremio({ family }) {
  const [tengo, setTengo] = useState(null) // null = todavía no se sabe
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    let vivo = true
    leerPertenencias().then((mias) => {
      if (vivo) setTengo(mias.some((p) => p.family_id === family?.id))
    })
    return () => { vivo = false }
  }, [family?.id])

  async function salir() {
    setOcupado(true)
    setAviso('')
    const codigo = await abandonarGremio(family.id)
    setOcupado(false)
    const mensaje = codigo in RESPUESTAS
      ? RESPUESTAS[codigo]
      : 'No se ha podido salir. Inténtalo dentro de un rato.'
    if (mensaje) return setAviso(mensaje)

    // Se recarga entera, y es lo correcto y no lo cómodo: salir cambia a la
    // vez el gremio activo, el personaje, el PIN, la zona horaria y todos los
    // datos. `elegirActivo` ya sabe caer a otro de los míos cuando el
    // guardado deja de serlo (`C-3`), así que arrancar de cero es
    // exactamente el camino que esa regla describe.
    window.location.reload()
  }

  if (!tengo) return null

  return (
    <>
      <div className="titulo-seccion">Dejar este gremio</div>

      <div className="carta">
        <p className="suave">
          Sales de <strong>{family?.name}</strong> y dejas de ver sus misiones, su tienda y
          su historial. Tus otros gremios no se tocan.
        </p>

        {!abierto && (
          <button className="btn btn-fantasma btn-bloque" onClick={() => setAbierto(true)}>
            Quiero dejar este gremio
          </button>
        )}

        {abierto && (
          <>
            <ul className="suave">
              <li>
                Tu personaje <strong>se retira, no se borra</strong>: conserva su nivel, su
                historial, sus insignias y sus reconocimientos.
              </li>
              <li>
                Si te vuelven a invitar, <strong>recuperas ese mismo personaje</strong> con
                todo. Pero entrar otra vez cuesta <strong>una llave nueva</strong>.
              </li>
              <li>
                Tus Talis <strong>son tuyos</strong> y no se tocan: van contigo a tus otros
                gremios.
              </li>
              <li>
                No se devuelve nada por salir: ni las llaves que gastaste, ni los Talis que
                te costaron.
              </li>
              <li>Liberas una plaza de tu límite de gremios.</li>
            </ul>

            {aviso && <p className="aviso" role="alert">{aviso}</p>}

            <div className="fila-botones">
              <button className="btn btn-peligro" disabled={ocupado} onClick={salir}>
                {ocupado ? 'Saliendo…' : 'Salir del gremio'}
              </button>
              <button className="btn btn-fantasma" onClick={() => { setAbierto(false); setAviso('') }}>
                Mejor no
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
