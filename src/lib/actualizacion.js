import { useEffect, useRef, useState } from 'react'
import { COMMIT } from './version'
import { log, vaciar } from './log'

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

// ------------------------------------------------------------------
// La tablet de la peque: recargar al volver de segundo plano.
//
// Su pantalla no lleva el cartel —no sabe leer— y una tablet que se queda
// días en el mueble del salón es justo el aparato con más probabilidad de
// correr una versión de la semana pasada. Aquí sí se recarga sola, pero
// solo en el único momento en que hacerlo no le quita nada: **cuando la
// app acaba de volver de segundo plano después de un buen rato**. Si
// estuvo escondida dos minutos, no había ningún dedo encima.
//
// Las tres cosas que impiden la recarga, y por qué:
//
//   · Que haya algo a medias (un juego, una celebración, una estrella
//     viajando a la base). Recargar ahí le quita algo que ya era suyo.
//   · Que haya estado escondida poco rato: pudo ser un aviso del sistema
//     tapando la pantalla mientras ella jugaba.
//   · Que YA se recargara buscando ese mismo commit. Si tras recargar
//     seguimos en el bundle viejo, el navegador está sirviendo su caché y
//     volver a recargar es un bucle infinito con la niña delante.
// ------------------------------------------------------------------

export const OCULTA_MINIMA = 2 * 60 * 1000
const CLAVE_INTENTO = 'gremio_recarga_intentada'

export function debeRecargar({
  ocultaMs = 0,
  versionNueva = false,
  listo = true,
  commitPublicado = null,
  yaIntentadoPara = null
} = {}) {
  if (!versionNueva || !listo) return false
  if (ocultaMs < OCULTA_MINIMA) return false
  if (commitPublicado && yaIntentadoPara === commitPublicado) return false
  return true
}

export function leerIntento(almacen = localStorage) {
  try {
    return almacen.getItem(CLAVE_INTENTO)
  } catch {
    return null
  }
}

export function apuntarIntento(commitPublicado, almacen = localStorage) {
  try {
    almacen.setItem(CLAVE_INTENTO, String(commitPublicado))
  } catch {
    // Sin almacenamiento no hay memoria del intento y, por tanto, no hay
    // guardia contra el bucle: por eso `debeRecargar` exige que el commit
    // publicado se conozca, y aquí se falla en silencio y ya está.
  }
}

/**
 * Recarga la pantalla de la peque al volver de segundo plano si hay
 * versión nueva. `listo` es una función: la evalúa en el momento de
 * decidir, no cuando se montó el efecto.
 */
export function useRecargarAlVolver(listo = () => true) {
  const ocultaDesde = useRef(0)

  useEffect(() => {
    async function alCambiar() {
      if (document.visibilityState === 'hidden') {
        ocultaDesde.current = Date.now()
        return
      }
      const ocultaMs = ocultaDesde.current ? Date.now() - ocultaDesde.current : 0
      ocultaDesde.current = 0
      if (ocultaMs < OCULTA_MINIMA || !listo()) return

      const publicado = await consultarPublicado()
      const decision = debeRecargar({
        ocultaMs,
        versionNueva: hayVersionNueva(publicado),
        listo: listo(),
        commitPublicado: publicado?.commit || null,
        yaIntentadoPara: leerIntento()
      })
      if (!decision) return

      apuntarIntento(publicado.commit)
      log.info('version.recarga_automatica', {
        corriendo: COMMIT,
        publicada: publicado.commit,
        oculta_s: Math.round(ocultaMs / 1000)
      })
      // Se vacía la cola ANTES de recargar: si no, esa línea —la única
      // prueba de que esto ocurrió— se va con la página.
      await vaciar()
      window.location.reload()
    }

    document.addEventListener('visibilitychange', alCambiar)
    return () => document.removeEventListener('visibilitychange', alCambiar)
  }, [listo])
}
