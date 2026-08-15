// ------------------------------------------------------------------
// Iconos de interfaz.
//
// Regla que sigue el proyecto: los emoji son CONTENIDO (la misión es un
// osito, el premio es una pizza, el avatar es un pollito) y ahí se
// quedan, porque para quien tiene tres años el dibujo es el significado.
// Pero los mandos —pestañas, editar, pausar, cerrar— son ESTRUCTURA, y
// ahí el emoji falla: cambia de forma en cada sistema, no hereda el
// color del tema y no se alinea con el texto.
//
// Trazo de 1,75 y rejilla de 24, uniformes. Sin dependencias: son cuatro
// formas geométricas y no compensa arrastrar una librería de iconos.
// ------------------------------------------------------------------

const TRAZOS = {
  misiones: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
  tienda: <><path d="M5.6 8.2h12.8l-1.05 11.4a1.6 1.6 0 0 1-1.6 1.4H8.25a1.6 1.6 0 0 1-1.6-1.4z" /><path d="M9.2 8.2V6.6a2.8 2.8 0 0 1 5.6 0v1.6" /></>,
  insignias: <><circle cx="12" cy="9" r="5.5" /><path d="M8.5 13.5 7 21l5-2.5 5 2.5-1.5-7.5" /></>,
  perfiles: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8" /><path d="M17.5 14.2a5.5 5.5 0 0 1 3 4.8" /></>,
  candado: <><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  validar: <><circle cx="12" cy="12" r="8.5" /><path d="m8.2 12.4 2.6 2.6 5-5.6" /></>,
  estrella: <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  premio: <><rect x="3.5" y="8.5" width="17" height="4" rx="1" /><path d="M5 12.5v8h14v-8" /><path d="M12 8.5v12" /><path d="M12 8.5S10.5 4 8 4a2.2 2.2 0 0 0 0 4.5" /><path d="M12 8.5S13.5 4 16 4a2.2 2.2 0 0 1 0 4.5" /></>,
  meta: <><path d="M5.5 21V3.8" /><path d="M5.5 4.5h12l-2.2 3.8 2.2 3.8h-12" /></>,
  ajustes: <><path d="M4 7h9" /><path d="M17 7h3" /><circle cx="15" cy="7" r="2" /><path d="M4 17h3" /><path d="M11 17h9" /><circle cx="9" cy="17" r="2" /></>,
  editar: <><path d="M4 20.2l3.6-.7L20 7.1a1.9 1.9 0 0 0-2.7-2.7L4.7 16.6z" /><path d="M15.6 5.8 18.2 8.4" /></>,
  pausar: <><rect x="7.5" y="5" width="3.5" height="14" rx="1.2" /><rect x="13" y="5" width="3.5" height="14" rx="1.2" /></>,
  reanudar: <path d="M7.5 5.4v13.2l11-6.6z" />,
  cerrar: <><path d="M6.5 6.5l11 11" /><path d="M17.5 6.5l-11 11" /></>,
  sonido: <><path d="M4.5 9.5h3.2L12 5.8v12.4l-4.3-3.7H4.5z" /><path d="M15.4 9.4a3.6 3.6 0 0 1 0 5.2" /><path d="M17.9 6.9a7.1 7.1 0 0 1 0 10.2" /></>,
  silencio: <><path d="M4.5 9.5h3.2L12 5.8v12.4l-4.3-3.7H4.5z" /><path d="m16 9.8 4.4 4.4" /><path d="m20.4 9.8-4.4 4.4" /></>,
  salir: <><path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14" /><path d="M17 8.5 20.5 12 17 15.5" /><path d="M20.5 12h-10" /></>,
  atras: <><path d="M11 5.5 4.5 12l6.5 6.5" /><path d="M4.5 12h15" /></>
}

export default function Icono({ nombre, tamano = 22, className = '', titulo }) {
  const trazo = TRAZOS[nombre]
  if (!trazo) return null

  return (
    <svg
      className={className}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
      focusable="false"
    >
      {titulo && <title>{titulo}</title>}
      {trazo}
    </svg>
  )
}

export const ICONOS = Object.keys(TRAZOS)
