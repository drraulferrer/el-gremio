import { useEffect, useRef, useState } from 'react'

// ------------------------------------------------------------------
// Pulsación mantenida.
//
// Es el gesto de adulto de la pantalla infantil: sirve para salir y para
// deshacer una estrella dada por error. A los tres años no se hace sin
// querer, y no obliga a teclear un PIN cada vez.
//
// Dos relojes a propósito:
//   - un setTimeout decide CUÁNDO se completa la acción;
//   - requestAnimationFrame solo pinta la barra de progreso.
// Si rAF se frena (pestaña en segundo plano, batería baja, un navegador
// que ahorra), la acción se completa igual. Al revés —fiar la acción a
// rAF— el gesto se queda a medias sin que nadie entienda por qué.
// ------------------------------------------------------------------

export function useMantenerPulsado(alCompletar, ms = 1500) {
  const [progreso, setProgreso] = useState(0)
  const temporizador = useRef(null)
  const raf = useRef(null)
  const inicio = useRef(0)

  function parar() {
    if (temporizador.current) clearTimeout(temporizador.current)
    if (raf.current) cancelAnimationFrame(raf.current)
    temporizador.current = null
    raf.current = null
    setProgreso(0)
  }

  function empezar() {
    if (temporizador.current) return
    inicio.current = Date.now()

    temporizador.current = setTimeout(() => {
      parar()
      alCompletar()
    }, ms)

    const pintar = () => {
      setProgreso(Math.min(100, ((Date.now() - inicio.current) / ms) * 100))
      raf.current = requestAnimationFrame(pintar)
    }
    raf.current = requestAnimationFrame(pintar)
  }

  useEffect(() => parar, [])

  return {
    progreso,
    manejadores: {
      onPointerDown: empezar,
      onPointerUp: parar,
      onPointerLeave: parar,
      onPointerCancel: parar,
      onContextMenu: (e) => e.preventDefault()
    }
  }
}
