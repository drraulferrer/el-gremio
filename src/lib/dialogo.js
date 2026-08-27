import { useEffect, useRef } from 'react'

// ------------------------------------------------------------------
// El foco de un diálogo emergente: entra al abrirse y vuelve al salir.
//
// Sin esto, quien navega con teclado sigue en el botón que había detrás
// y no puede cerrar lo que tiene delante. Y Escape cierra, que es lo que
// todo el mundo prueba primero.
//
// Vivía copiado en los tres diálogos (LoteDeSellos, SelloDetalle,
// TalisAMano); una copia de una regla es una regla que se desincroniza,
// así que ahora es un solo hook. Devuelve la ref que el diálogo debe
// poner en su botón de cerrar.
// ------------------------------------------------------------------

export function useFocoDialogo(onClose) {
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

  return cerrar
}
