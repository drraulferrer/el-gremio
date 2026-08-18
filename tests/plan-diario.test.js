import { describe, it, expect, afterEach } from 'vitest'
import { planDelDia, hayPlan, planDeperfil, misionesDe } from '../src/lib/misiones'
import { rachaActual } from '../src/lib/rachas'
import { diasNeutros } from '../src/lib/misiones'
import { configurarZona, dayKey } from '../src/lib/supabase'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// El plan del día: una capa por fecha encima del patrón.
//
// Lo que defienden estos tests son las decisiones cerradas con la familia:
//
//  1. El plan es una CAPA, no un requisito. Sin plan para esa fecha, el
//     resultado es EXACTAMENTE el patrón. Olvidar programar no cambia nada.
//  2. Sustituir es solo para ese día: una pausada metida en el plan sale
//     por su id aunque `active` sea false, y no se activa.
//  3. El plan no crea un día neutro nuevo: un día planificado tiene
//     misiones, así que la racha no se alarga sola por culpa del plan.
//
// La primera es la que más fácil se rompe al tocar la capa, y por eso se
// comprueba contra `misionesDe` elemento a elemento.
// ------------------------------------------------------------------

afterEach(() => configurarZona(null))

// 2026: el 10 de agosto fue lunes.
const MANANA = new Date(2026, 7, 11) // martes
const claveISO = (d) => {
  const p = d
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-${String(p.getDate()).padStart(2, '0')}`
}

const junior = { id: 'j', role: 'junior' }
const peque = { id: 'p', role: 'peque' }

// Cuatro diarias de la junior, dos con patrón que NO toca el martes.
const retos = [
  { id: 'd1', active: true, profile_id: 'j', frequency: 'diario' },                 // todos los días
  { id: 'd2', active: true, profile_id: 'j', frequency: 'diario' },                 // todos los días
  { id: 'd3', active: true, profile_id: 'j', frequency: 'diario', days: [1, 3, 5] },// no toca martes
  { id: 'dp', active: false, profile_id: 'j', frequency: 'diario' },                // PAUSADA
  { id: 'sem', active: true, profile_id: 'j', frequency: 'semanal' },               // semanal
  { id: 'peq', active: true, profile_id: 'p', frequency: 'diario' }                 // de la peque
]

const fila = (challenge_id, profile_id = 'j', extra = {}) => ({
  challenge_id, profile_id, dia: claveISO(MANANA), ...extra
})

describe('sin plan, manda el patrón', () => {
  it('el resultado es idéntico a misionesDe({dia}), elemento a elemento', () => {
    const conCapa = planDelDia(junior, retos, [], MANANA).map((c) => c.id)
    const soloPatron = misionesDe(junior, retos, { dia: MANANA }).map((c) => c.id)
    expect(conCapa).toEqual(soloPatron)
  })

  it('planDelDia sin filas de plan no inventa nada', () => {
    // d3 no toca el martes; sin plan, no sale. La pausada tampoco.
    const ids = planDelDia(junior, retos, [], MANANA).map((c) => c.id)
    expect(ids).toContain('d1')
    expect(ids).toContain('d2')
    expect(ids).not.toContain('d3')
    expect(ids).not.toContain('dp')
  })

  it('hayPlan es false cuando no hay filas', () => {
    expect(hayPlan([], junior, MANANA)).toBe(false)
  })
})

describe('con plan, las diarias salen del plan', () => {
  const plan = [fila('d1'), fila('d3', 'j', { origen: 'sustituta' })]

  it('salen solo las diarias planificadas, no las demás del patrón', () => {
    const ids = planDelDia(junior, retos, plan, MANANA).map((c) => c.id)
    expect(ids).toContain('d1')
    expect(ids).toContain('d3') // planificada aunque su patrón no toque el martes
    expect(ids).not.toContain('d2') // del patrón pero NO en el plan
  })

  it('las semanales siguen por su vía, plan o no', () => {
    const ids = planDelDia(junior, retos, plan, MANANA).map((c) => c.id)
    expect(ids).toContain('sem')
  })

  it('hayPlan es true, y solo para el perfil planificado', () => {
    expect(hayPlan(plan, junior, MANANA)).toBe(true)
    // La peque no tiene filas: sigue con su patrón, no con el tablero vacío.
    expect(hayPlan(plan, peque, MANANA)).toBe(false)
    expect(planDelDia(peque, retos, plan, MANANA).map((c) => c.id)).toEqual(['peq'])
  })
})

describe('sustituir es solo por hoy, y no activa la pausada', () => {
  it('una pausada metida en el plan sale por su id aunque active sea false', () => {
    const plan = [fila('dp', 'j', { origen: 'sustituta' })]
    const ids = planDelDia(junior, retos, plan, MANANA).map((c) => c.id)
    expect(ids).toContain('dp')
    // El challenge sigue pausado: la capa no muta nada.
    expect(retos.find((c) => c.id === 'dp').active).toBe(false)
  })

  it('el plan es de un día: para otra fecha no hay plan y vuelve el patrón', () => {
    const plan = [fila('dp', 'j', { origen: 'sustituta' })]
    const pasado = new Date(2026, 7, 12) // miércoles
    expect(hayPlan(plan, junior, pasado)).toBe(false)
    expect(planDelDia(junior, retos, plan, pasado).map((c) => c.id)).toEqual(
      misionesDe(junior, retos, { dia: pasado }).map((c) => c.id)
    )
  })
})

describe('la fecha del plan se compara sin caer en la trampa de zona', () => {
  it('un YYYY-MM-DD de Postgres casa con el día correcto en zona negativa', () => {
    // new Date('2026-08-11') es medianoche UTC = 10-ago por la tarde en
    // México. Si la comparación pasara por Date, el plan del 11 no casaría.
    configurarZona('America/Mexico_City')
    const plan = [{ challenge_id: 'd1', profile_id: 'j', dia: '2026-08-11' }]
    // Un instante que en México es todavía el 11 por la mañana.
    const martesEnMexico = new Date('2026-08-11T15:00:00Z')
    expect(hayPlan(plan, junior, martesEnMexico)).toBe(true)
  })
})

describe('el plan no crea un día neutro nuevo (racha)', () => {
  it('diasNeutros sigue mirando el patrón, no el plan', () => {
    // d3 (L/X/V) hace del martes un día... pero d1 y d2 son de todos los
    // días, así que el martes NO es neutro. El plan no cambia eso.
    const neutros = diasNeutros(junior, retos, { hoy: MANANA, ventana: 3 })
    expect(neutros).not.toContain(dayKey(MANANA))
  })
})

// ------------------------------------------------------------------
// Cliente y base cuentan lo mismo
//
// El plan se resuelve en el cliente (planDelDia) y la racha/avisos en
// Postgres. Igual que en tests/dias.test.js, esto no ejecuta SQL: fija que
// las decisiones estén escritas en los DOS sitios —schema.sql y las
// migraciones—, que es lo que se olvida al tocar uno solo.
// ------------------------------------------------------------------
describe('el esquema dice lo mismo en las dos mitades', () => {
  const leer = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
  const m025 = leer('migracion-025-plan-diario.sql')
  const m026 = leer('migracion-026-avisos-noche.sql')
  const schema = leer('schema.sql')

  it('plan_diario existe en la migración 025 y en schema.sql', () => {
    for (const sql of [m025, schema]) {
      expect(sql).toMatch(/create table if not exists public\.plan_diario/)
      expect(sql).toMatch(/idx_plan_diario_dia/)
      expect(sql).toMatch(/tg_plan_dia_cercano/)
    }
  })

  it('el tope de push_log es por (perfil, dia, franja) en la 026 y en schema.sql', () => {
    for (const sql of [m026, schema]) {
      expect(sql).toMatch(/idx_push_log_uno_por_franja/)
      expect(sql).toMatch(/franja text not null default 'tarde'/)
    }
    // La migración retira el índice viejo; el nuevo esquema ya no lo tiene.
    expect(m026).toMatch(/drop index if exists idx_push_log_uno_al_dia/)
    expect(schema).not.toMatch(/idx_push_log_uno_al_dia/)
  })

  it('la vista de avisos expone sin_plan_manana en la 026 y en schema.sql', () => {
    for (const sql of [m026, schema]) {
      expect(sql).toMatch(/as sin_plan_manana/)
      expect(sql).toMatch(/pl\.dia = h\.dia \+ 1/)
    }
  })
})
