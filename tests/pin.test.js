import { describe, it, expect } from 'vitest'
import { validarPin, esSoloDigitos, esTrivial, PIN_MINIMO, PIN_MAXIMO } from '../src/lib/pin'

const ok = (extra = {}) => validarPin({ nuevo: '5837', repetido: '5837', actual: '1234', ...extra })

describe('validación del PIN', () => {
  it('acepta un PIN razonable', () => {
    const r = ok()
    expect(r.ok).toBe(true)
    expect(r.mensaje).toBe('')
    expect(r.aviso).toBe('')
  })

  it('exige la longitud mínima', () => {
    const r = ok({ nuevo: '58', repetido: '58' })
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(new RegExp(String(PIN_MINIMO)))
  })

  it('corta por arriba', () => {
    const largo = '1'.repeat(PIN_MAXIMO + 1)
    const r = ok({ nuevo: largo, repetido: largo })
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(new RegExp(String(PIN_MAXIMO)))
  })

  it('solo admite números: el teclado del panel es numérico', () => {
    const r = ok({ nuevo: '58a7', repetido: '58a7' })
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(/solo puede tener números/)
  })

  it('detecta que los dos no coinciden', () => {
    const r = ok({ repetido: '5838' })
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(/no coinciden/)
  })

  it('rechaza repetir el PIN que ya se tenía', () => {
    const r = ok({ nuevo: '1234', repetido: '1234', actual: '1234' })
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(/ya tenías/)
  })

  it('sin PIN actual (alta) no compara con nada', () => {
    const r = validarPin({ nuevo: '5837', repetido: '5837' })
    expect(r.ok).toBe(true)
  })

  it('avisa de los PIN triviales pero deja continuar', () => {
    const r = validarPin({ nuevo: '0000', repetido: '0000', actual: '9999' })
    expect(r.ok).toBe(true)
    expect(r.aviso).toMatch(/primeros que prueba/)
  })

  it('el orden de las comprobaciones no filtra un PIN corto y distinto', () => {
    const r = validarPin({ nuevo: '12', repetido: '99' })
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(new RegExp(String(PIN_MINIMO)))
  })
})

describe('auxiliares', () => {
  it('esSoloDigitos', () => {
    expect(esSoloDigitos('1234')).toBe(true)
    expect(esSoloDigitos('12 34')).toBe(false)
    expect(esSoloDigitos('')).toBe(false)
    expect(esSoloDigitos(null)).toBe(false)
  })

  it('esTrivial', () => {
    expect(esTrivial('1234')).toBe(true)
    expect(esTrivial('0000')).toBe(true)
    expect(esTrivial('5837')).toBe(false)
  })
})
