import { describe, it, expect } from 'vitest'
import { canDo, dayKey, weekKey, monthKey } from '../src/lib/supabase'

const PERFIL = 'p1'
const reto = (frequency) => ({ id: 'c1', frequency })
const hecha = (cuando, status = 'aprobado') => ({
  challenge_id: 'c1',
  profile_id: PERFIL,
  status,
  requested_at: cuando
})

describe('claves de periodo', () => {
  it('distinguen días, semanas ISO y meses', () => {
    expect(dayKey(new Date(2026, 7, 15))).toBe('2026-8-15')
    expect(dayKey(new Date(2026, 7, 16))).not.toBe(dayKey(new Date(2026, 7, 15)))
    expect(monthKey(new Date(2026, 7, 1))).toBe('2026-m8')
    expect(monthKey(new Date(2026, 8, 1))).not.toBe(monthKey(new Date(2026, 7, 1)))
    // Lunes y domingo de la misma semana ISO comparten clave.
    expect(weekKey(new Date(2026, 7, 10))).toBe(weekKey(new Date(2026, 7, 16)))
    expect(weekKey(new Date(2026, 7, 17))).not.toBe(weekKey(new Date(2026, 7, 16)))
  })
})

describe('disponibilidad de una misión', () => {
  it('la diaria se agota hoy y vuelve mañana', () => {
    const hoy = new Date().toISOString()
    expect(canDo(reto('diario'), [], PERFIL)).toBe(true)
    expect(canDo(reto('diario'), [hecha(hoy)], PERFIL)).toBe(false)

    const ayer = new Date(Date.now() - 26 * 3600 * 1000).toISOString()
    expect(canDo(reto('diario'), [hecha(ayer)], PERFIL)).toBe(true)
  })

  it('la única se agota para siempre', () => {
    const haceUnAno = new Date(Date.now() - 365 * 86400 * 1000).toISOString()
    expect(canDo(reto('unico'), [], PERFIL)).toBe(true)
    expect(canDo(reto('unico'), [hecha(haceUnAno)], PERFIL)).toBe(false)
  })

  it('un rechazo no consume la frecuencia', () => {
    const hoy = new Date().toISOString()
    expect(canDo(reto('diario'), [hecha(hoy, 'rechazado')], PERFIL)).toBe(true)
    expect(canDo(reto('unico'), [hecha(hoy, 'rechazado')], PERFIL)).toBe(true)
  })

  it('una pendiente sí la consume: no se puede pedir dos veces lo mismo', () => {
    const hoy = new Date().toISOString()
    expect(canDo(reto('diario'), [hecha(hoy, 'pendiente')], PERFIL)).toBe(false)
  })

  it('no mezcla lo que ha hecho otra persona', () => {
    const hoy = new Date().toISOString()
    const deOtra = { ...hecha(hoy), profile_id: 'p2' }
    expect(canDo(reto('diario'), [deOtra], PERFIL)).toBe(true)
  })

  it('la mensual se libera al cambiar de mes', () => {
    const esteMes = new Date().toISOString()
    expect(canDo(reto('mensual'), [hecha(esteMes)], PERFIL)).toBe(false)
    const haceDosMeses = new Date(Date.now() - 62 * 86400 * 1000).toISOString()
    expect(canDo(reto('mensual'), [hecha(haceDosMeses)], PERFIL)).toBe(true)
  })
})
