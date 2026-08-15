import { describe, it, expect } from 'vitest'
import { xpForLevel, levelFromXp, levelProgress, goalProgress, BADGES } from '../src/lib/supabase'

describe('curva de niveles', () => {
  it('sigue la tabla de la especificación', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(100)
    expect(xpForLevel(3)).toBe(300)
    expect(xpForLevel(4)).toBe(600)
    expect(xpForLevel(5)).toBe(1000)
  })

  it('sitúa cada XP en su nivel, incluidos los bordes', () => {
    expect(levelFromXp(0)).toBe(1)
    expect(levelFromXp(99)).toBe(1)
    expect(levelFromXp(100)).toBe(2)
    expect(levelFromXp(299)).toBe(2)
    expect(levelFromXp(300)).toBe(3)
    expect(levelFromXp(1000)).toBe(5)
  })

  it('nunca retrocede al subir XP', () => {
    let anterior = 1
    for (let xp = 0; xp < 5000; xp += 37) {
      const nivel = levelFromXp(xp)
      expect(nivel).toBeGreaterThanOrEqual(anterior)
      anterior = nivel
    }
  })

  it('calcula el progreso dentro del nivel', () => {
    const p = levelProgress(200)
    expect(p.level).toBe(2)
    expect(p.current).toBe(100) // 200 - 100 de base
    expect(p.needed).toBe(200) // 300 - 100
    expect(p.pct).toBe(50)
    expect(p.nextAt).toBe(300)
  })

  it('mantiene el porcentaje entre 0 y 100', () => {
    for (const xp of [0, 1, 99, 100, 999, 1000, 99999]) {
      const { pct } = levelProgress(xp)
      expect(pct).toBeGreaterThanOrEqual(0)
      expect(pct).toBeLessThanOrEqual(100)
    }
  })
})

describe('meta cooperativa', () => {
  const meta = { starts_at: '2026-08-01T00:00:00.000Z', target_xp: 500 }

  it('solo suma la XP aprobada después de arrancar la meta', () => {
    const completions = [
      { status: 'aprobado', resolved_at: '2026-08-05T10:00:00.000Z', xp: 100 },
      { status: 'aprobado', resolved_at: '2026-08-06T10:00:00.000Z', xp: 50 },
      { status: 'aprobado', resolved_at: '2026-07-20T10:00:00.000Z', xp: 999 }, // antes de la meta
      { status: 'pendiente', resolved_at: null, xp: 400 }, // sin validar
      { status: 'rechazado', resolved_at: '2026-08-07T10:00:00.000Z', xp: 300 }
    ]
    expect(goalProgress(meta, completions)).toBe(150)
  })

  it('devuelve cero sin meta activa', () => {
    expect(goalProgress(null, [])).toBe(0)
  })
})

describe('insignias automáticas', () => {
  it('se desbloquean en el umbral exacto', () => {
    const porCodigo = Object.fromEntries(BADGES.map((b) => [b.code, b]))
    expect(porCodigo.primera.test({ approved: 0, level: 1, redemptions: 0 })).toBe(false)
    expect(porCodigo.primera.test({ approved: 1, level: 1, redemptions: 0 })).toBe(true)
    expect(porCodigo.x10.test({ approved: 9, level: 1, redemptions: 0 })).toBe(false)
    expect(porCodigo.x10.test({ approved: 10, level: 1, redemptions: 0 })).toBe(true)
    expect(porCodigo.nivel5.test({ approved: 0, level: 5, redemptions: 0 })).toBe(true)
    expect(porCodigo.canje1.test({ approved: 0, level: 1, redemptions: 1 })).toBe(true)
  })

  it('la insignia del gremio no es automática: se otorga al cerrar la meta', () => {
    const gremio = BADGES.find((b) => b.code === 'gremio')
    expect(gremio.test({ approved: 999, level: 99, redemptions: 99 })).toBe(false)
  })
})
