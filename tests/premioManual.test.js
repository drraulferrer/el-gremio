import { describe, it, expect } from 'vitest'
import {
  revisarPremioManual, motivoValido, cantidadValida, avisoDeCantidad,
  MAXIMO_MANUAL, AVISO_MANUAL
} from '../src/lib/premioManual'

const perfiles = [
  { id: 'a1', role: 'adulto', active: true, name: 'Adulta' },
  { id: 'a2', role: 'adulto', active: false, name: 'Retirado' },
  { id: 'j1', role: 'junior', active: true, name: 'Junior' },
  { id: 'p1', role: 'peque', active: true, name: 'Peque' }
]
const base = { monedas: 20, motivo: 'Ayudó con la mudanza sin que nadie se lo pidiera', otorgadoPor: 'a1', perfiles }

describe('cantidad', () => {
  it('entero positivo y dentro del tope', () => {
    expect(cantidadValida(1)).toBe(true)
    expect(cantidadValida(MAXIMO_MANUAL)).toBe(true)
  })

  it('el tope existe contra el dedo gordo, no contra el fraude', () => {
    expect(cantidadValida(MAXIMO_MANUAL + 1)).toBe(false)
    expect(cantidadValida(5000)).toBe(false)
  })

  it('ni cero, ni negativo, ni decimales, ni basura', () => {
    for (const v of [0, -5, 2.5, '', null, 'diez', NaN, Infinity]) {
      expect(cantidadValida(v), String(v)).toBe(false)
    }
  })
})

describe('motivo', () => {
  it('obligatorio: sin él nadie recuerda el porqué en un mes', () => {
    expect(motivoValido('')).toBe(false)
    expect(motivoValido('  ')).toBe(false)
    expect(motivoValido('ok')).toBe(false)
  })

  it('corto pero real vale; una novela no', () => {
    expect(motivoValido('Cuidó a su hermana')).toBe(true)
    expect(motivoValido('x'.repeat(241))).toBe(false)
  })
})

describe('quién lo concede', () => {
  it('un adulto activo sí', () => {
    expect(revisarPremioManual(base)).toBe(null)
  })

  it('la junior no puede concederse monedas a sí misma ni a nadie', () => {
    expect(revisarPremioManual({ ...base, otorgadoPor: 'j1' })).toMatch(/adulto/i)
    expect(revisarPremioManual({ ...base, otorgadoPor: 'p1' })).toMatch(/adulto/i)
  })

  it('un adulto retirado tampoco', () => {
    expect(revisarPremioManual({ ...base, otorgadoPor: 'a2' })).toMatch(/retirado/i)
  })

  it('y hay que decir quién', () => {
    expect(revisarPremioManual({ ...base, otorgadoPor: null })).toMatch(/qué adulto/i)
    expect(revisarPremioManual({ ...base, otorgadoPor: 'fantasma' })).toMatch(/qué adulto/i)
  })
})

describe('el orden de los avisos', () => {
  it('la cantidad se revisa antes que el motivo', () => {
    expect(revisarPremioManual({ ...base, monedas: 0, motivo: '' })).toMatch(/Talis/i)
  })

  it('cantidades altas avisan pero no bloquean', () => {
    expect(avisoDeCantidad(AVISO_MANUAL)).toBe(null)
    expect(avisoDeCantidad(AVISO_MANUAL + 1)).toMatch(/bastante/i)
    expect(revisarPremioManual({ ...base, monedas: AVISO_MANUAL + 1 })).toBe(null)
  })
})
