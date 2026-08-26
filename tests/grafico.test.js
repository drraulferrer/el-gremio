import { describe, it, expect } from 'vitest'
import { puntosDeLinea } from '../src/lib/grafico'

describe('puntosDeLinea', () => {
  it('sin valores, sin puntos', () => {
    expect(puntosDeLinea([], 100, 40)).toBe('')
    expect(puntosDeLinea(null, 100, 40)).toBe('')
  })

  it('un solo valor va centrado, sin dividir por un rango cero', () => {
    const [punto] = puntosDeLinea([7], 100, 40, 4).split(' ')
    const [x, y] = punto.split(',').map(Number)
    expect(x).toBe(4)
    expect(y).toBe(20)
  })

  it('valores iguales dibujan una línea recta a media altura', () => {
    const puntos = puntosDeLinea([5, 5, 5], 100, 40, 4).split(' ')
    const alturas = puntos.map((p) => Number(p.split(',')[1]))
    expect(alturas).toEqual([20, 20, 20])
  })

  it('el valor más alto queda arriba (y menor) y el más bajo abajo', () => {
    const [bajo, alto] = puntosDeLinea([0, 10], 100, 40, 4).split(' ')
    const yBajo = Number(bajo.split(',')[1])
    const yAlto = Number(alto.split(',')[1])
    expect(yAlto).toBeLessThan(yBajo)
  })

  it('el primer y el último punto tocan los márgenes del lienzo', () => {
    const puntos = puntosDeLinea([1, 2, 3, 4], 100, 40, 4).split(' ')
    const xPrimero = Number(puntos[0].split(',')[0])
    const xUltimo = Number(puntos[puntos.length - 1].split(',')[0])
    expect(xPrimero).toBe(4)
    expect(xUltimo).toBe(96)
  })
})
