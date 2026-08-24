import { describe, it, expect } from 'vitest'
import {
  ESCALONES,
  escalonDe,
  duracionCelebracion,
  estrellasDe,
  EXTRA_ELOGIO_MS
} from '../src/lib/celebracion'

describe('los tres escalones', () => {
  it('están ordenados: una chispa no puede pesar como un hito', () => {
    // Esta es toda la idea. Si los tres duraran lo mismo, subir de nivel
    // no se distinguiría de un martes cualquiera, que es donde estábamos.
    expect(ESCALONES.chispa.ms).toBeLessThan(ESCALONES.normal.ms)
    expect(ESCALONES.normal.ms).toBeLessThan(ESCALONES.hito.ms)
  })

  it('el escalón grande también trae más estrellas, no solo más tiempo', () => {
    // Alargar la misma animación no la hace más grande, la hace más
    // lenta, que es lo contrario de celebrar.
    expect(ESCALONES.chispa.estrellas).toBeLessThan(ESCALONES.normal.estrellas)
    expect(ESCALONES.normal.estrellas).toBeLessThan(ESCALONES.hito.estrellas)
  })

  it('el de en medio es el que ya había, y no se toca', () => {
    // 1.900 ms llevan desde la 1.0 sin que nadie se queje: son la
    // referencia contra la que se miden los otros dos.
    expect(ESCALONES.normal.ms).toBe(1900)
    expect(ESCALONES.normal.estrellas).toBe(10)
  })

  it('solo el de en medio va sin clase: es el aspecto de siempre', () => {
    expect(ESCALONES.normal.clase).toBe('')
    expect(ESCALONES.chispa.clase).not.toBe('')
    expect(ESCALONES.hito.clase).not.toBe('')
  })
})

describe('pedir un escalón', () => {
  it('devuelve el que se pide', () => {
    expect(escalonDe('hito')).toBe(ESCALONES.hito)
  })

  it('ante cualquier cosa rara cae al de en medio en vez de tirar', () => {
    // Una celebración es lo último que puede romper una pantalla.
    expect(escalonDe('fiesta-mayor')).toBe(ESCALONES.normal)
    expect(escalonDe(undefined)).toBe(ESCALONES.normal)
    expect(escalonDe(null)).toBe(ESCALONES.normal)
  })
})

describe('cuánto se queda en pantalla', () => {
  it('sin elogio, lo que diga el escalón', () => {
    expect(duracionCelebracion('chispa')).toBe(ESCALONES.chispa.ms)
    expect(duracionCelebracion('hito')).toBe(ESCALONES.hito.ms)
  })

  it('con elogio, lo suficiente para leerlo', () => {
    // El elogio lo escribe otra persona y es la pieza que de verdad
    // tiene efecto. Por debajo de un par de segundos se vuelve un
    // parpadeo.
    expect(duracionCelebracion('normal', true)).toBe(1900 + EXTRA_ELOGIO_MS)
    expect(EXTRA_ELOGIO_MS).toBeGreaterThanOrEqual(1500)
  })

  it('el extra del elogio se suma igual en todos los escalones', () => {
    // Leer una frase cuesta lo mismo en una chispa que en un hito, así
    // que se suma en vez de multiplicar.
    for (const nombre of Object.keys(ESCALONES)) {
      expect(duracionCelebracion(nombre, true) - duracionCelebracion(nombre, false)).toBe(EXTRA_ELOGIO_MS)
    }
  })
})

describe('la lluvia de estrellas', () => {
  it('sale entera en condiciones normales', () => {
    expect(estrellasDe('hito')).toBe(ESCALONES.hito.estrellas)
  })

  it('con menos movimiento no cae ninguna, en ningún escalón', () => {
    // La caja con el texto se queda: quien pide menos movimiento sigue
    // necesitando saber que la misión se aprobó. Lo que se va es la
    // lluvia, que es puro movimiento.
    for (const nombre of Object.keys(ESCALONES)) {
      expect(estrellasDe(nombre, true)).toBe(0)
    }
  })
})
