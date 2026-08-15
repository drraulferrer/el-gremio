import { describe, it, expect } from 'vitest'
import {
  debeLatir,
  leerLatido,
  contarApertura,
  sellarPrimeraVez,
  APERTURAS_PARA_APRENDER,
  DIAS_DE_GRACIA
} from '../src/lib/latido'

const DIA = 86400000
const AHORA = new Date(2026, 7, 15).getTime()

// Un almacén de mentira: los tests no deben depender de que exista
// localStorage ni dejar basura en el del navegador de al lado.
function almacenFalso(inicial = {}) {
  const datos = { ...inicial }
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v) },
    ver: () => ({ ...datos })
  }
}

describe('cuándo late el avatar', () => {
  it('late mientras no lo haya encontrado', () => {
    expect(debeLatir({ aperturas: 0, desde: AHORA, ahora: AHORA })).toBe(true)
    expect(debeLatir({ aperturas: APERTURAS_PARA_APRENDER - 1, desde: AHORA, ahora: AHORA })).toBe(true)
  })

  it('se apaga en cuanto lo ha abierto unas cuantas veces', () => {
    expect(debeLatir({ aperturas: APERTURAS_PARA_APRENDER, desde: AHORA, ahora: AHORA })).toBe(false)
  })

  it('se apaga al pasar los días de gracia aunque no lo haya abierto nunca', () => {
    // Si no lo ha encontrado en diez días, el latido tampoco está
    // sirviendo: a partir de ahí solo es ruido.
    const tarde = AHORA + (DIAS_DE_GRACIA + 1) * DIA
    expect(debeLatir({ aperturas: 0, desde: AHORA, ahora: tarde })).toBe(false)
    expect(debeLatir({ aperturas: 0, desde: AHORA, ahora: AHORA + 5 * DIA })).toBe(true)
  })

  it('sin sello de primera vez late: es el primer arranque', () => {
    expect(debeLatir({ aperturas: 0, desde: null, ahora: AHORA })).toBe(true)
  })

  it('sin argumentos no explota', () => {
    expect(debeLatir()).toBe(true)
  })
})

describe('memoria por perfil', () => {
  it('cuenta las aperturas de cada criatura por separado', () => {
    const a = almacenFalso()
    contarApertura('peque', a)
    contarApertura('peque', a)
    contarApertura('otra', a)
    expect(leerLatido('peque', a).aperturas).toBe(2)
    expect(leerLatido('otra', a).aperturas).toBe(1)
  })

  it('el sello de la primera vez no se reescribe', () => {
    const a = almacenFalso()
    sellarPrimeraVez('peque', AHORA, a)
    sellarPrimeraVez('peque', AHORA + 5 * DIA, a)
    expect(leerLatido('peque', a).desde).toBe(AHORA)
  })

  it('un almacén roto no tumba la pantalla', () => {
    const roto = {
      getItem: () => { throw new Error('sin almacenamiento') },
      setItem: () => { throw new Error('sin almacenamiento') }
    }
    expect(leerLatido('peque', roto)).toEqual({ aperturas: 0, desde: null })
    expect(() => sellarPrimeraVez('peque', AHORA, roto)).not.toThrow()
    expect(contarApertura('peque', roto)).toBe(0)
  })
})
