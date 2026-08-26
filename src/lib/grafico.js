/**
 * Coordenadas de un polyline SVG para una serie de números, encajada en
 * un lienzo ancho×alto. Sin librería: es una regla de tres por punto.
 *
 * Una serie sin variación (un solo valor, o todos iguales) se pinta como
 * una línea recta a media altura en vez de dividir por un rango cero:
 * no hay nada que exagerar, así que no se inventa un pico.
 */
export function puntosDeLinea(valores, ancho, alto, margen = 4) {
  if (!valores || valores.length === 0) return ''

  const max = Math.max(...valores)
  const min = Math.min(...valores)
  const rango = max - min
  const pasoX = valores.length > 1 ? (ancho - margen * 2) / (valores.length - 1) : 0

  return valores
    .map((v, i) => {
      const x = margen + i * pasoX
      const y = rango === 0 ? alto / 2 : alto - margen - ((v - min) / rango) * (alto - margen * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
