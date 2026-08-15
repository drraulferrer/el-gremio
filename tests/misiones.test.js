import { describe, it, expect } from 'vitest'
import {
  esParaPerfil,
  misionesDe,
  agruparPorFrecuencia,
  ORDEN_FRECUENCIA,
  destinoDe,
  destinoA,
  rolesDe,
  grupoDe,
  textoDestino
} from '../src/lib/misiones'

const adultaA = { id: 'a1', role: 'adulto' }
const adultoB = { id: 'a2', role: 'adulto' }
const junior = { id: 'j1', role: 'junior' }
const peque = { id: 'p1', role: 'peque' }

const suya = { id: 'c1', profile_id: 'a1', target_roles: null, active: true, frequency: 'diario' }
const deAdultos = { id: 'c2', profile_id: null, target_roles: ['adulto'], active: true, frequency: 'semanal' }
const deTodos = { id: 'c3', profile_id: null, target_roles: null, active: true, frequency: 'diario' }
const pausada = { id: 'c4', profile_id: null, target_roles: null, active: false, frequency: 'mensual' }
const deNinos = { id: 'c5', profile_id: null, target_roles: ['junior', 'peque'], active: true, frequency: 'diario' }

describe('a quién va dirigida una misión', () => {
  it('la de una persona concreta es solo suya', () => {
    expect(esParaPerfil(suya, adultaA)).toBe(true)
    expect(esParaPerfil(suya, adultoB)).toBe(false)
  })

  it('la de varios roles la ven todos esos y nadie más', () => {
    expect(esParaPerfil(deNinos, junior)).toBe(true)
    expect(esParaPerfil(deNinos, peque)).toBe(true)
    expect(esParaPerfil(deNinos, adultaA)).toBe(false)
    expect(esParaPerfil(deNinos, adultoB)).toBe(false)
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
    const mixta = { profile_id: 'j1', target_roles: ['adulto'] }
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
    for (const reto of [suya, deAdultos, deTodos, deNinos]) {
      expect(destinoA(destinoDe(reto))).toEqual({
        profile_id: reto.profile_id,
        target_roles: reto.target_roles
      })
    }
  })

  it('elegir persona borra los roles, y al revés', () => {
    expect(destinoA('a1')).toEqual({ profile_id: 'a1', target_roles: null })
    expect(destinoA('rol:adulto')).toEqual({ profile_id: null, target_roles: ['adulto'] })
    expect(destinoA('grupo:ninos')).toEqual({ profile_id: null, target_roles: ['junior', 'peque'] })
    expect(destinoA('')).toEqual({ profile_id: null, target_roles: null })
  })

  it('nunca deja las dos columnas puestas a la vez', () => {
    for (const v of ['', 'a1', 'rol:adulto', 'rol:peque', 'grupo:ninos']) {
      const d = destinoA(v)
      expect(d.profile_id && d.target_roles).toBeFalsy()
    }
  })

  it('un grupo desconocido no inventa un destino', () => {
    expect(destinoA('grupo:marcianos')).toEqual({ profile_id: null, target_roles: null })
  })
})

describe('compatibilidad con la columna vieja de un solo rol', () => {
  it('sigue entendiendo target_role mientras no se retire', () => {
    const vieja = { profile_id: null, target_role: 'adulto' }
    expect(rolesDe(vieja)).toEqual(['adulto'])
    expect(esParaPerfil(vieja, adultaA)).toBe(true)
    expect(esParaPerfil(vieja, peque)).toBe(false)
  })

  it('si están las dos, manda el array', () => {
    const ambas = { profile_id: null, target_role: 'adulto', target_roles: ['peque'] }
    expect(rolesDe(ambas)).toEqual(['peque'])
  })
})

describe('cómo se lee el destino', () => {
  const nombre = (id) => ({ a1: 'Marta' })[id]

  it('nombra el grupo cuando los roles coinciden con uno', () => {
    expect(textoDestino(deNinos)).toBe('Los peques y la junior')
    expect(grupoDe(['peque', 'junior'])?.id).toBe('ninos')
  })

  it('el orden de los roles da igual', () => {
    expect(textoDestino({ target_roles: ['peque', 'junior'] })).toBe('Los peques y la junior')
  })

  it('un rol suelto, una persona y todos', () => {
    expect(textoDestino(deAdultos)).toBe('Cualquier adulto')
    expect(textoDestino(suya, nombre)).toBe('Marta')
    expect(textoDestino(deTodos)).toBe('Todos')
  })
})
