import { useEffect, useRef, useState } from 'react'
import { COMMIT } from './version'
import { log } from './log'

// ------------------------------------------------------------------
// Enterarse de que la app está vieja.
//
// El problema, medido y no supuesto: el 21 de agosto a las 08:44 hubo una
// sesión corriendo el bundle del día 18 —tres días y diez versiones por
// detrás—. No era caché del service worker, que este no cachea nada a
// propósito: era una app abierta desde hacía días. Un icono de inicio en
// un móvil no se «cierra» nunca, y el código con el que se cargó sigue
// ejecutándose hasta que alguien recarga de verdad.
//
// Eso choca de frente con la regla que gobierna los despliegues de este
// proyecto: una migración puede dejar roto a un cliente viejo, y hasta
// hoy no había forma de que el cliente viejo se enterase de que lo era.
//
// El arreglo se apoya en algo que ya existía: cada build publica
// `version.json` con su commit. Compararlo con el que lleva dentro el
// bundle contesta la pregunta sin inventar nada.
//
// Tres momentos de comprobación, y el segundo es EL importante:
//
//   1. Al arrancar, pasado un rato: no compite con la carga inicial.
//   2. **Al volver a primer plano**, si hace más de cinco minutos de la
//      última. Es justo el caso del móvil que estuvo suspendido.
//   3. Cada media hora, para la pestaña que se queda abierta a la vista.
//
// Lo que NO hace: recargar sola. Una app que se recarga bajo el dedo de
// alguien pierde el toque que estaba dando y, en la pantalla de la peque,
// es sencillamente inquietante. Aquí se avisa; recarga quien quiera.
// ------------------------------------------------------------------

export const CADA = 30 * 60 * 1000
export const TRAS_VOLVER = 5 * 60 * 1000
export const AL_ARRANCAR = 20 * 1000

/**
 * ¿Lo que hay publicado es distinto de lo que corre aquí?
 *
 * Conservadora a conciencia: ante cualquier duda —sin dato, sin commit, o
 * un bundle de desarrollo— dice que NO. Un aviso de versión nueva que
 * sale cuando no la hay se aprende a ignorar en dos días, y entonces ya
 * no sirve el día que sí importa.
 */
export function hayVersionNueva(publicado, commitLocal = COMMIT) {
  if (!publicado || typeof publicado !== 'object') return false
  const remoto = typeof publicado.commit === 'string' ? publicado.commit.trim() : ''
  if (!remoto || remoto === 'dev') return false
  if (!commitLocal || commitLocal === 'dev') return false
  return remoto !== commitLocal
}

/**
 * Lee `version.json`. Devuelve `null` ante cualquier problema: sin red,
 * un 404, o —el caso de `npm run dev`— un `index.html` devuelto por el
 * comodín de la SPA, que parece un 200 y no es JSON.
 */
export async function consultarPublicado(buscar = typeof fetch === 'function' ? fetch : null) {
  if (!buscar) return null
  try {
    const res = await buscar('/version.json', { cache: 'no-store' })
    if (!res?.ok) return null
    const tipo = res.headers?.get?.('content-type') || ''
    if (!/json/i.test(tipo)) return null
    return await res.json()
  } catch {
    // Sin red no hay nada que decir, y desde luego no un error en el
    // registro: esto corre solo, cada media hora, en el móvil de alguien.
    return null
  }
}

/** `true` cuando hay publicada una versión distinta de la que corre. */
export function useVersionNueva() {
  const [nueva, setNueva] = useState(false)
  const ultima = useRef(0)

  useEffect(() => {
    let vivo = true

    async function mirar(motivo) {
      ultima.current = Date.now()
      const publicado = await consultarPublicado()
      if (!vivo || !hayVersionNueva(publicado)) return
      setNueva(true)
      // Una sola línea, la primera vez: sirve para saber CUÁNTO tiempo
      // corre la gente con una versión vieja, que es el dato que hoy no
      // tenemos. Repetirla cada media hora sería ruido.
      log.info('version.vieja', { motivo, corriendo: COMMIT, publicada: publicado.commit })
    }

    const alArrancar = setTimeout(() => mirar('arranque'), AL_ARRANCAR)
    const periodico = setInterval(() => mirar('periodico'), CADA)

    function alVolver() {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - ultima.current < TRAS_VOLVER) return
      mirar('vuelve')
    }
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      vivo = false
      clearTimeout(alArrancar)
      clearInterval(periodico)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])

  return nueva
}
