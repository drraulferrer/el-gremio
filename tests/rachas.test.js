import { describe, it, expect } from 'vitest'
import {
  HITOS,
  tipoDeHito,
  rachaActual,
  hoyHecho,
  enRiesgo,
  siguienteHito,
  caminoDe,
  hitosPorCobrar
} from '../src/lib/rachas'
import { readFileSync } from 'node:fs'

const HOY = new Date(2026, 7, 15, 18, 0, 0)
const hace = (dias, hora = 10) => {
  const d = new Date(2026, 7, 15, hora, 0, 0)
  d.setDate(d.getDate() - dias)
  return d.toISOString()
}
const aprobada = (dias, perfil = 'p1') => ({
  profile_id: perfil,
  status: 'aprobado',
  xp: 10,
  resolved_at: hace(dias)
})

describe('la racha viva', () => {
  it('cuenta días seguidos hasta hoy', () => {
    const c = [aprobada(0), aprobada(1), aprobada(2)]
    expect(rachaActual(c, 'p1', [], HOY)).toBe(3)
  })

  it('sigue viva aunque hoy todavía no haya nada: el día no ha terminado', () => {
    const c = [aprobada(1), aprobada(2), aprobada(3)]
    expect(rachaActual(c, 'p1', [], HOY)).toBe(3)
    expect(hoyHecho(c, 'p1', [], HOY)).toBe(false)
    expect(enRiesgo(c, 'p1', [], HOY)).toBe(true)
  })

  it('con lo de hoy hecho ya no está en riesgo', () => {
    const c = [aprobada(0), aprobada(1)]
    expect(enRiesgo(c, 'p1', [], HOY)).toBe(false)
  })

  it('un hueco de dos días la rompe', () => {
    const c = [aprobada(3), aprobada(4), aprobada(5)]
    expect(rachaActual(c, 'p1', [], HOY)).toBe(0)
    expect(enRiesgo(c, 'p1', [], HOY)).toBe(false)
  })

  it('un comodín tapa el hueco', () => {
    const c = [aprobada(1), aprobada(3), aprobada(4)]
    expect(rachaActual(c, 'p1', [], HOY)).toBe(1)
    const salvado = ['2026-8-13'] // el día 2 hacia atrás
    expect(rachaActual(c, 'p1', salvado, HOY)).toBe(4)
  })

  it('dos misiones el mismo día son un solo día', () => {
    const c = [aprobada(0), aprobada(0), aprobada(1)]
    expect(rachaActual(c, 'p1', [], HOY)).toBe(2)
  })

  it('ignora lo de otras personas y lo no aprobado', () => {
    const c = [aprobada(0, 'otro'), { profile_id: 'p1', status: 'pendiente', resolved_at: null }]
    expect(rachaActual(c, 'p1', [], HOY)).toBe(0)
  })
})

describe('el camino', () => {
  it('el siguiente hito es el primero por encima de la racha', () => {
    expect(siguienteHito(0).dias).toBe(3)
    expect(siguienteHito(7).dias).toBe(14)
    expect(siguienteHito(9).dias).toBe(14)
  })

  it('con todos hechos ya no hay siguiente', () => {
    expect(siguienteHito(100)).toBe(null)
    expect(caminoDe(100).every((h) => h.estado === 'logrado')).toBe(true)
  })

  it('marca logrados, el siguiente y los lejanos', () => {
    const camino = caminoDe(9)
    expect(camino.filter((h) => h.estado === 'logrado').map((h) => h.dias)).toEqual([3, 7])
    expect(camino.find((h) => h.estado === 'siguiente').dias).toBe(14)
    expect(camino.filter((h) => h.estado === 'lejos').map((h) => h.dias)).toEqual([21, 30, 50, 100])
  })

  it('dice cuántos días faltan para el siguiente', () => {
    expect(caminoDe(9).find((h) => h.estado === 'siguiente').faltan).toBe(5)
  })

  it('el progreso se mide desde el hito anterior, no desde cero', () => {
    // Con 75 días, el tramo 50→100 va por la mitad. Medido desde cero
    // saldría 75 % y la barra mentiría sobre lo que queda.
    expect(caminoDe(75).find((h) => h.dias === 100).pct).toBe(50)
    expect(caminoDe(0).find((h) => h.dias === 3).pct).toBe(0)
  })

  it('los hitos van de menos a más y pagan de menos a más', () => {
    const dias = HITOS.map((h) => h.dias)
    const monedas = HITOS.map((h) => h.monedas)
    expect([...dias].sort((a, b) => a - b)).toEqual(dias)
    expect([...monedas].sort((a, b) => a - b)).toEqual(monedas)
  })

  it('el camino entero paga poco para lo que cuesta: es un extra, no un sueldo', () => {
    // Una junior gana unas 38 monedas al día (economia.js). Cien días sin
    // fallar son ~3.800; el camino no puede acercarse a eso o deja de ser
    // un premio y pasa a ser la vía principal.
    const total = HITOS.reduce((t, h) => t + h.monedas, 0)
    expect(total).toBeLessThan(0.2 * 100 * 38)
  })
})

describe('qué queda por cobrar', () => {
  const bonuses = [{ profile_id: 'p1', tipo: tipoDeHito(3) }, { profile_id: 'p1', tipo: 'globos' }]

  it('los alcanzados y sin cobrar', () => {
    expect(hitosPorCobrar(8, bonuses, 'p1').map((h) => h.dias)).toEqual([7])
  })

  it('lo ya cobrado no se vuelve a cobrar aunque la racha crezca', () => {
    expect(hitosPorCobrar(100, bonuses, 'p1').map((h) => h.dias)).not.toContain(3)
  })

  it('lo cobrado por otra persona no cuenta como cobrado por mí', () => {
    expect(hitosPorCobrar(5, [{ profile_id: 'otro', tipo: tipoDeHito(3) }], 'p1').map((h) => h.dias)).toEqual([3])
  })

  it('sin racha no hay nada que cobrar', () => {
    expect(hitosPorCobrar(0, [], 'p1')).toEqual([])
  })
})

// ------------------------------------------------------------------
// La tabla de hitos está escrita DOS veces: aquí en JavaScript, para
// dibujar el camino, y en el `case` de `claim_streak`, que es quien paga.
// Es la misma deuda que las insignias únicas, y se cubre igual: si
// alguien añade un hito en un sitio y no en el otro, cae este test y no
// una familia preguntándose por qué no le han pagado los cien días.
// ------------------------------------------------------------------
describe('Postgres paga exactamente lo que dice el camino', () => {
  const sql = readFileSync(new URL('../migracion-016-camino-de-rachas.sql', import.meta.url), 'utf8')
  const enSql = [...sql.matchAll(/when (\d+) then (\d+)/g)].map((m) => ({
    dias: Number(m[1]),
    monedas: Number(m[2])
  }))

  it('los mismos hitos y los mismos importes', () => {
    expect(enSql).toEqual(HITOS.map((h) => ({ dias: h.dias, monedas: h.monedas })))
  })

  it('schema.sql dice lo mismo que la migración', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
    const trozo = schema.slice(schema.indexOf('function public.claim_streak'))
    const enSchema = [...trozo.matchAll(/when (\d+) then (\d+)/g)].map((m) => ({
      dias: Number(m[1]),
      monedas: Number(m[2])
    }))
    expect(enSchema).toEqual(enSql)
  })
})
