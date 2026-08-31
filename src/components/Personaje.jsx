import Retrato from './Retrato'

/**
 * Un personaje en línea: su retrato y su nombre.
 *
 * Existe porque cuando llegaron los retratos (035 y 037) se convirtieron
 * las apariciones grandes —el selector, el tablero, los miembros— y se
 * quedaron atrás cinco pequeñas, todas en el panel: la cabecera de cada
 * persona en Misiones, el grupo plegable, la leyenda del Cuadro, las
 * pastillas del modo limpieza y la fila de Estado. Ahí seguía saliendo el
 * emoji del alta, así que la misma persona tenía dos caras según la
 * pantalla.
 *
 * Se hace pieza y no cinco apaños por lo de siempre: cinco sitios que
 * dibujan lo mismo acaban dibujándolo distinto. Y `Retrato` ya resuelve lo
 * difícil —una mascota lleva medallón de emoji y no retrato, porque no
 * tiene fase—, así que aquí solo se le pone el tamaño y la alineación.
 *
 * `conNombre={false}` para donde el nombre ya está o no cabe, como la
 * leyenda del reparto, que lo que enseña es el porcentaje.
 */
export default function Personaje({ perfil, tamano = 22, conNombre = true, className }) {
  if (!perfil) return null
  return (
    <span className={'personaje-linea' + (className ? ' ' + className : '')}>
      <Retrato perfil={perfil} tamano={tamano} />
      {conNombre && <span className="personaje-linea-nombre">{perfil.name}</span>}
    </span>
  )
}
