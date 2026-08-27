import { describe, it, expect } from 'vitest'
import {
  INSIGNIAS, CON_PODER, PODERES, poderActivo,
  multiplicadorDe, usosDisponibles, ganablesPor, PODERES_LISTOS
} from '../src/lib/insignias'
import { readFileSync } from 'node:fs'

const HOY = new Date(2026, 7, 15, 12)
const hace = (dias) => new Date(HOY.getTime() - dias * 86400000).toISOString()
const stats = (extra = {}) => ({
  approved: 0, level: 1, redemptions: 0, rachaMax: 0,
  habilidadesTocadas: 0, antesDeLasNueve: 0, insignias: 0, porHabilidad: {}, ...extra
})

describe('el catálogo', () => {
  it('hay bastantes más que las ocho originales', () => {
    expect(INSIGNIAS.length).toBeGreaterThanOrEqual(15)
  })

  it('ningún código repetido', () => {
    expect(new Set(INSIGNIAS.map((b) => b.code)).size).toBe(INSIGNIAS.length)
  })

  it('todas tienen clase, y hay de las tres cosas', () => {
    for (const b of INSIGNIAS) expect(b.clase, b.code).toBeTruthy()
    expect(INSIGNIAS.some((b) => b.clase === 'unica')).toBe(true)
    expect(INSIGNIAS.some((b) => b.poder)).toBe(true)
  })

  it('todo poder declarado existe de verdad', () => {
    for (const b of CON_PODER) expect(PODERES[b.poder.tipo], b.code).toBeTruthy()
  })

  it('los multiplicadores respetan su tope: la economía va contra un ritmo', () => {
    for (const b of CON_PODER.filter((x) => x.poder.tipo === 'monedas_x')) {
      expect(b.poder.factor, b.code).toBeLessThanOrEqual(PODERES.monedas_x.maxFactor)
    }
  })

  it('todo poder caduca menos la llave', () => {
    for (const b of CON_PODER) {
      if (b.poder.tipo === 'abre_premio') expect(b.poder.dias).toBeUndefined()
      else expect(b.poder.dias, b.code).toBeGreaterThan(0)
    }
  })
})

describe('caducidad de los poderes', () => {
  it('activo dentro del plazo', () => {
    expect(poderActivo({ code: 'racha21', earned_at: hace(3) }, HOY)?.tipo).toBe('monedas_x')
  })

  it('caducado fuera', () => {
    expect(poderActivo({ code: 'racha21', earned_at: hace(30) }, HOY)).toBe(null)
  })

  it('la llave no caduca: una llave oxidada no abre nada', () => {
    expect(poderActivo({ code: 'ocho_habilidades', earned_at: hace(900) }, HOY)?.tipo).toBe('abre_premio')
  })

  it('una insignia sin poder no da poder', () => {
    expect(poderActivo({ code: 'primera', earned_at: hace(1) }, HOY)).toBe(null)
    expect(poderActivo({ code: 'inventada' }, HOY)).toBe(null)
  })
})

describe('multiplicador de monedas', () => {
  it('sin insignias, uno', () => {
    expect(multiplicadorDe([], HOY)).toBe(1)
  })

  it('NO se acumulan: se coge el mayor', () => {
    const m = multiplicadorDe([
      { code: 'racha21', earned_at: hace(1) },   // 1,25
      { code: 'primer_nivel10', earned_at: hace(1) } // 1,5
    ], HOY)
    expect(m).toBe(1.5)
  })

  it('una caducada no cuenta', () => {
    expect(multiplicadorDe([{ code: 'primer_nivel10', earned_at: hace(60) }], HOY)).toBe(1)
  })
})

describe('poderes gastables', () => {
  it('suma los usos de las que estén activas', () => {
    const g = [{ code: 'racha7', earned_at: hace(1) }, { code: 'ayuda10', earned_at: hace(1) }]
    expect(usosDisponibles(g, 'salva_racha', {}, HOY)).toBe(3)
  })

  it('descuenta lo ya gastado', () => {
    const g = [{ code: 'ayuda10', earned_at: hace(1) }]
    expect(usosDisponibles(g, 'salva_racha', { ayuda10: 1 }, HOY)).toBe(1)
    expect(usosDisponibles(g, 'salva_racha', { ayuda10: 5 }, HOY)).toBe(0)
  })
})

describe('las únicas son de una sola persona', () => {
  it('si nadie la tiene, se puede ganar', () => {
    const g = ganablesPor(stats({ level: 10 }), new Set(), new Set())
    expect(g.map((b) => b.code)).toContain('primer_nivel10')
  })

  it('si ya la tiene alguien, nadie más', () => {
    const g = ganablesPor(stats({ level: 10 }), new Set(['primer_nivel10']), new Set())
    expect(g.map((b) => b.code)).not.toContain('primer_nivel10')
    // Pero las normales del mismo hito sí siguen disponibles.
    expect(g.map((b) => b.code)).toContain('nivel10')
  })

  it('lo que ya tiene no se vuelve a ganar', () => {
    const g = ganablesPor(stats({ approved: 50, level: 10 }), new Set(), new Set(['x10', 'x25']))
    expect(g.map((b) => b.code)).not.toContain('x10')
    expect(g.map((b) => b.code)).toContain('x50')
  })
})

// ------------------------------------------------------------------
// La deuda que anuncia la migración 015: los códigos de las insignias
// únicas están escritos DOS veces, aquí en JavaScript y en el índice
// parcial de Postgres. No hay forma de tener una sola copia sin meter el
// catálogo en una tabla, así que al menos que salte un test el día que se
// añada una única y se olvide el índice. Sin él, la insignia «solo una
// persona» se la llevarían dos, que es exactamente lo que la anulaba.
// ------------------------------------------------------------------

describe('el índice de Postgres conoce todas las únicas', () => {
  const sql = readFileSync(new URL('../migracion-015-poderes-y-unicas.sql', import.meta.url), 'utf8')
  const enElIndice = sql
    .split('idx_badges_unica_por_gremio')[1]
    .split(';')[0]
    .match(/'([a-z0-9_]+)'/g)
    .map((s) => s.replaceAll("'", ''))

  it('están las tres y solo las tres', () => {
    const enElCatalogo = INSIGNIAS.filter((b) => b.clase === 'unica').map((b) => b.code)
    expect([...enElIndice].sort()).toEqual([...enElCatalogo].sort())
  })

  it('schema.sql dice lo mismo que la migración', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
    const enSchema = schema
      .split('idx_badges_unica_por_gremio')[1]
      .split(';')[0]
      .match(/'([a-z0-9_]+)'/g)
      .map((s) => s.replaceAll("'", ''))
    expect([...enSchema].sort()).toEqual([...enElIndice].sort())
  })
})

describe('poderes que se anuncian frente a poderes que funcionan', () => {
  it('solo se declaran listos los que están cableados de punta a punta', () => {
    expect([...PODERES_LISTOS].sort()).toEqual(['asigna_tarea', 'salva_racha'])
  })

  it('todo poder listo es un tipo real del catálogo', () => {
    for (const tipo of PODERES_LISTOS) expect(PODERES[tipo]).toBeTruthy()
  })
})
