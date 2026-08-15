import { describe, it, expect } from 'vitest'
import { esParaPerfil, misionesDe, agruparPorFrecuencia, ORDEN_FRECUENCIA, destinoDe, destinoA } from '../src/lib/misiones'

const adultaA = { id: 'a1', role: 'adulto' }
const adultoB = { id: 'a2', role: 'adulto' }
const junior = { id: 'j1', role: 'junior' }
const peque = { id: 'p1', role: 'peque' }

const suya = { id: 'c1', profile_id: 'a1', target_role: null, active: true, frequency: 'diario' }
const deAdultos = { id: 'c2', profile_id: null, target_role: 'adulto', active: true, frequency: 'semanal' }
const deTodos = { id: 'c3', profile_id: null, target_role: null, active: true, frequency: 'diario' }
const pausada = { id: 'c4', profile_id: null, target_role: null, active: false, frequency: 'mensual' }

describe('a quién va dirigida una misión', () => {
  it('la de una persona concreta es solo suya', () => {
    expect(esParaPerfil(suya, adultaA)).toBe(true)
    expect(esParaPerfil(suya, adultoB)).toBe(false)
  })

  it('la de un rol la ven todos los de ese rol y nadie más', () => {
    expect(esParaPerfil(deAdultos, adultaA)).toBe(true)
    expect(esParaPerfil(deAdultos, adultoB)).toBe(true)
    expect(esParaPerfil(deAdultos, junior)).toBe(false)
    expect(esParaPerfil(deAdultos, peque)).toBe(false)
  })

  it('la de todos la ve todo el mundo, la peque incluida', () => {
    for (const p of [adultaA, adultoB, junior, peque]) expect(esParaPerfil(deTodos, p)).toBe(true)
  })

  it('una persona concreta manda sobre el rol', () => {
    const mixta = { profile_id: 'j1', target_role: 'adulto' }
    expect(esParaPerfil(mixta, junior)).toBe(true)
    expect(esParaPerfil(mixta, adultaA)).toBe(false)
  })

  it('no revienta sin perfil o sin misión', () => {
    expect(esParaPerfil(null, adultaA)).toBe(false)
    expect(esParaPerfil(deTodos, null)).toBe(false)
  })
})

describe('misiones de un perfil', () => {
  const todas = [suya, deAdultos, deTodos, pausada]

  it('por defecto deja fuera las pausadas', () => {
    expect(misionesDe(adultaA, todas).map((m) => m.id)).toEqual(['c1', 'c2', 'c3'])
  })

  it('las incluye cuando se piden', () => {
    expect(misionesDe(adultaA, todas, { incluirPausadas: true }).map((m) => m.id)).toContain('c4')
  })

  it('el otro adulto ve la de rol pero no la personal', () => {
    expect(misionesDe(adultoB, todas).map((m) => m.id)).toEqual(['c2', 'c3'])
  })

  it('la peque no ve las de adultos', () => {
    expect(misionesDe(peque, todas).map((m) => m.id)).toEqual(['c3'])
  })
})

describe('agrupación por frecuencia', () => {
  it('ordena de lo que caduca antes a lo que no caduca', () => {
    const grupos = agruparPorFrecuencia([
      { frequency: 'unico' },
      { frequency: 'mensual' },
      { frequency: 'diario' },
      { frequency: 'semanal' }
    ])
    expect(grupos.map((g) => g.frecuencia)).toEqual(ORDEN_FRECUENCIA)
  })

  it('no deja encabezados vacíos', () => {
    const grupos = agruparPorFrecuencia([{ frequency: 'diario' }, { frequency: 'diario' }])
    expect(grupos).toHaveLength(1)
    expect(grupos[0].titulo).toBe('Cada día')
    expect(grupos[0].misiones).toHaveLength(2)
  })

  it('una frecuencia desconocida no desaparece', () => {
    const grupos = agruparPorFrecuencia([{ frequency: 'diario' }, { frequency: 'trimestral' }])
    expect(grupos.map((g) => g.frecuencia)).toEqual(['diario', 'otras'])
  })

  it('sin misiones no hay grupos', () => {
    expect(agruparPorFrecuencia([])).toEqual([])
    expect(agruparPorFrecuencia()).toEqual([])
  })
})

describe('el destino como un solo valor de formulario', () => {
  it('ida y vuelta sin perder nada', () => {
    for (const reto of [suya, deAdultos, deTodos]) {
      expect(destinoA(destinoDe(reto))).toEqual({
        profile_id: reto.profile_id,
        target_role: reto.target_role
      })
    }
  })

  it('elegir persona borra el rol, y al revés', () => {
    expect(destinoA('a1')).toEqual({ profile_id: 'a1', target_role: null })
    expect(destinoA('rol:adulto')).toEqual({ profile_id: null, target_role: 'adulto' })
    expect(destinoA('')).toEqual({ profile_id: null, target_role: null })
  })

  it('nunca deja las dos columnas puestas a la vez', () => {
    for (const v of ['', 'a1', 'rol:adulto', 'rol:peque']) {
      const d = destinoA(v)
      expect(d.profile_id && d.target_role).toBeFalsy()
    }
  })
})
