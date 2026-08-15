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
  it('siete diarias justas no avisan: es el tope pedido por la familia', () => {
    expect(revisarCarga(n(7, 'diario')).excedida).toBe(false)
    expect(avisoDeCarga(n(7, 'diario'))).toBe(null)
  })

  it('doce diarias avisan y dicen cuánto se pasan', () => {
    const aviso = avisoDeCarga(n(12, 'diario'), 'Irene')
    expect(aviso).not.toBe(null)
    expect(aviso.razon).toBeCloseTo(1.5)
    expect(aviso.texto).toMatch(/Irene/)
    expect(aviso.texto).toMatch(/12 diarias/)
    expect(aviso.texto).toMatch(/máximo 7/)
  })

  it('muchas semanales solas también pueden pasarse', () => {
    // 40 semanales pesan 5,7 y ya no bastan: el presupuesto subió a 8 al
    // permitir 7 diarias. Hacen falta más de 56 para desbordarlo solo con
    // semanales, que es justo el punto de medir la carga y no el número.
    expect(revisarCarga(n(40, 'semanal')).excedida).toBe(false)
    expect(revisarCarga(n(60, 'semanal')).excedida).toBe(true)
  })

  it('el aviso nombra las frecuencias pasadas, no todas', () => {
    const aviso = avisoDeCarga([...n(12, 'diario'), ...n(2, 'semanal')], 'Irene')
    expect(aviso.texto).toMatch(/12 diarias/)
    expect(aviso.texto).not.toMatch(/semanales/)
  })
})
