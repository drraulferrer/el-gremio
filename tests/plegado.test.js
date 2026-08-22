import { describe, it, expect } from 'vitest'
import { estaAbierto, recordarAbierto } from '../src/lib/plegado'

function almacenFalso(inicial = {}) {
  const datos = { ...inicial }
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v) },
    ver: () => ({ ...datos })
  }
}

describe('qué secciones quedan abiertas', () => {
  // El motivo de plegar por defecto es de pantalla: con la semana llena,
  // el historial y el muro dejan el resto de Progreso a tres pantallas de
  // scroll.
  it('por defecto, plegado', () => {
    expect(estaAbierto('muro', almacenFalso())).toBe(false)
  })

  // Pero obligar a desplegar lo mismo cada vez es la forma más rápida de
  // que deje de abrirse.
  it('lo que alguien abre, se queda abierto', () => {
    const almacen = almacenFalso()
    recordarAbierto('muro', true, almacen)
    expect(estaAbierto('muro', almacen)).toBe(true)
  })

  it('y lo que cierra, se queda cerrado', () => {
    const almacen = almacenFalso()
    recordarAbierto('muro', true, almacen)
    recordarAbierto('muro', false, almacen)
    expect(estaAbierto('muro', almacen)).toBe(false)
  })

  it('cada sección lleva su cuenta', () => {
    const almacen = almacenFalso()
    recordarAbierto('muro', true, almacen)
    expect(estaAbierto('hecho', almacen)).toBe(false)
  })

  it('se puede pedir otro valor por defecto', () => {
    expect(estaAbierto('lo-que-sea', almacenFalso(), true)).toBe(true)
  })

  it('un almacén roto no tumba la pantalla', () => {
    const roto = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') } }
    expect(estaAbierto('muro', roto)).toBe(false)
    expect(() => recordarAbierto('muro', true, roto)).not.toThrow()
    expect(recordarAbierto('muro', true, roto)).toBe(true)
  })
})
