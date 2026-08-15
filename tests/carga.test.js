import { describe, it, expect } from 'vitest'
import { cargaDe, revisarCarga, avisoDeCarga, TOPES, SUPUESTOS } from '../src/lib/economia'

const n = (cuantas, frequency) => Array.from({ length: cuantas }, () => ({ frequency }))

describe('carga en misiones diarias equivalentes', () => {
  it('una diaria pesa uno; siete semanales, lo mismo', () => {
    expect(cargaDe(n(1, 'diario'))).toBe(1)
    expect(cargaDe(n(7, 'semanal'))).toBeCloseTo(1)
    expect(cargaDe(n(30, 'mensual'))).toBeCloseTo(1)
  })

  it('las únicas no pesan: son un extra, no un ritmo', () => {
    expect(cargaDe(n(50, 'unico'))).toBe(0)
  })

  it('sin misiones no hay carga', () => {
    expect(cargaDe([])).toBe(0)
    expect(cargaDe()).toBe(0)
  })
})

describe('los topes caben en el presupuesto del modelo', () => {
  it('gastar los tres máximos no se pasa de las 5 del modelo', () => {
    const carga = cargaDe([...n(TOPES.diario, 'diario'), ...n(TOPES.semanal, 'semanal'), ...n(TOPES.mensual, 'mensual')])
    expect(carga).toBeLessThanOrEqual(SUPUESTOS.misionesActivas)
  })

  it('y no sobra tanto como para que el tope sea inútil', () => {
    const carga = cargaDe([...n(TOPES.diario, 'diario'), ...n(TOPES.semanal, 'semanal'), ...n(TOPES.mensual, 'mensual')])
    expect(carga).toBeGreaterThan(SUPUESTOS.misionesActivas * 0.9)
  })
})

describe('revisión y aviso', () => {
  it('cinco diarias justas no avisan', () => {
    expect(revisarCarga(n(5, 'diario')).excedida).toBe(false)
    expect(avisoDeCarga(n(5, 'diario'))).toBe(null)
  })

  it('doce diarias avisan y dicen cuánto se pasan', () => {
    const aviso = avisoDeCarga(n(12, 'diario'), 'Irene')
    expect(aviso).not.toBe(null)
    expect(aviso.razon).toBeCloseTo(2.4)
    expect(aviso.texto).toMatch(/Irene/)
    expect(aviso.texto).toMatch(/12 diarias/)
    expect(aviso.texto).toMatch(/máximo 4/)
  })

  it('muchas semanales solas también pueden pasarse', () => {
    expect(revisarCarga(n(40, 'semanal')).excedida).toBe(true)
  })

  it('el aviso nombra las frecuencias pasadas, no todas', () => {
    const aviso = avisoDeCarga([...n(12, 'diario'), ...n(2, 'semanal')], 'Irene')
    expect(aviso.texto).toMatch(/12 diarias/)
    expect(aviso.texto).not.toMatch(/semanales/)
  })
})
