import { describe, it, expect } from 'vitest'
import {
  lunesDe, semana, etiquetaDeSemana, validadasDe, semanasConDatos, resumenDeSemana
} from '../src/lib/historial'
import { weekKey } from '../src/lib/supabase'

// Sábado 15 de agosto de 2026. Su lunes es el 10.
const SABADO = new Date(2026, 7, 15, 13, 0, 0)

describe('la semana empieza en lunes', () => {
  it('un sábado cae en la semana que empieza el lunes anterior', () => {
    const l = lunesDe(SABADO)
    expect(l.getDate()).toBe(10)
    expect(l.getDay()).toBe(1)
    expect(l.getHours()).toBe(0)
  })

  it('un domingo pertenece a la semana que YA empezó, no a la siguiente', () => {
    // Domingo 16: su lunes sigue siendo el 10.
    expect(lunesDe(new Date(2026, 7, 16, 23, 0)).getDate()).toBe(10)
  })

  it('un lunes es su propio lunes', () => {
    expect(lunesDe(new Date(2026, 7, 10, 9, 0)).getDate()).toBe(10)
  })

  it('cuenta las semanas igual que weekKey, que decide si una semanal está hecha', () => {
    // Si estas dos discreparan, el historial y la disponibilidad dirían
    // semanas distintas y nadie entendería por qué.
    const dentro = [new Date(2026, 7, 10), new Date(2026, 7, 13), new Date(2026, 7, 16)]
    const claves = new Set(dentro.map((d) => weekKey(d)))
    expect(claves.size).toBe(1)
    expect(new Set(dentro.map((d) => lunesDe(d).getTime())).size).toBe(1)
  })
})

describe('navegación por semanas', () => {
  it('cero es la de ahora y uno es la anterior', () => {
    expect(semana(SABADO, 0).desde.getDate()).toBe(10)
    expect(semana(SABADO, 1).desde.getDate()).toBe(3)
    expect(semana(SABADO, 2).desde.getDate()).toBe(27) // julio
  })

  it('el intervalo dura exactamente siete días y no solapa', () => {
    const a = semana(SABADO, 0)
    const b = semana(SABADO, 1)
    expect((a.hasta - a.desde) / 86400000).toBe(7)
    expect(b.hasta.getTime()).toBe(a.desde.getTime())
  })
})

describe('cómo se nombra cada semana', () => {
  it('las dos recientes tienen nombre, no fecha', () => {
    expect(etiquetaDeSemana(semana(SABADO, 0))).toBe('Esta semana')
    expect(etiquetaDeSemana(semana(SABADO, 1))).toBe('La semana pasada')
  })

  it('las anteriores van por fechas, que es lo que se pidió', () => {
    expect(etiquetaDeSemana(semana(SABADO, 2))).toMatch(/27 de julio – 2 de agosto/)
    expect(etiquetaDeSemana(semana(SABADO, 3))).toMatch(/20–26 de julio/)
  })
})

describe('lo validado de una semana', () => {
  const c = (dia, extra = {}) => ({
    profile_id: 'p1', status: 'aprobado',
    resolved_at: new Date(2026, 7, dia, 12).toISOString(),
    xp: 10, coins: 5, ...extra
  })
  const completions = [
    c(10), c(13, { xp: 20, praise: 'bien' }), c(16),
    c(9), // domingo anterior: fuera
    c(13, { profile_id: 'p2' }), // de otra persona
    c(12, { status: 'pendiente' }) // sin validar
  ]

  it('solo lo suyo, validado y dentro de la semana', () => {
    const v = validadasDe(completions, 'p1', semana(SABADO, 0))
    expect(v).toHaveLength(3)
  })

  it('lo más reciente primero', () => {
    const v = validadasDe(completions, 'p1', semana(SABADO, 0))
    expect(new Date(v[0].resolved_at).getDate()).toBe(16)
  })

  it('el resumen suma lo que hay', () => {
    const r = resumenDeSemana(validadasDe(completions, 'p1', semana(SABADO, 0)))
    expect(r).toEqual({ misiones: 3, xp: 40, monedas: 15, conElogio: 1 })
  })

  it('una semana vacía no rompe el resumen', () => {
    expect(resumenDeSemana([])).toEqual({ misiones: 0, xp: 0, monedas: 0, conElogio: 0 })
  })
})

describe('hasta dónde se puede retroceder', () => {
  it('sin historial, a ninguna parte', () => {
    expect(semanasConDatos([], 'p1', SABADO)).toBe(0)
  })

  it('hasta la semana de la más antigua', () => {
    const completions = [
      { profile_id: 'p1', status: 'aprobado', resolved_at: new Date(2026, 6, 20, 12).toISOString() },
      { profile_id: 'p1', status: 'aprobado', resolved_at: new Date(2026, 7, 13, 12).toISOString() }
    ]
    expect(semanasConDatos(completions, 'p1', SABADO)).toBe(3)
  })

  it('lo pendiente y lo de otros no abren semanas vacías', () => {
    const completions = [
      { profile_id: 'p2', status: 'aprobado', resolved_at: new Date(2026, 5, 1).toISOString() },
      { profile_id: 'p1', status: 'pendiente', resolved_at: new Date(2026, 5, 1).toISOString() }
    ]
    expect(semanasConDatos(completions, 'p1', SABADO)).toBe(0)
  })
})
