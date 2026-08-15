import { describe, it, expect } from 'vitest'
import {
  SUPUESTOS,
  monedasPorDia,
  xpPorDia,
  tasaDeReferencia,
  precioObjetivo,
  bandaDePrecio,
  metaObjetivo,
  diasParaPermitirse,
  diagnosticoEconomia,
  veredicto
} from '../src/lib/economia'
import { CATALOGO_PREMIOS, NIVELES } from '../src/lib/premios'
import { META_INICIAL } from '../src/lib/supabase'
import { DEFAULTS_ROL } from '../src/lib/tareas'

// ------------------------------------------------------------------
// Estos tests son el guardián del equilibrio. Si alguien sube la XP de
// las misiones o baja el precio de un premio, aquí se ve antes de que la
// familia se encuentre debiendo una acampada cada semana.
// ------------------------------------------------------------------

describe('modelo de ingresos', () => {
  it('cada rol gana lo que dicen sus valores por defecto', () => {
    for (const rol of Object.keys(DEFAULTS_ROL)) {
      const esperado = SUPUESTOS.misionesActivas * DEFAULTS_ROL[rol].coins * SUPUESTOS.adherencia
      expect(monedasPorDia(rol)).toBeCloseTo(esperado, 5)
      expect(xpPorDia(rol)).toBeCloseTo(SUPUESTOS.misionesActivas * DEFAULTS_ROL[rol].xp * SUPUESTOS.adherencia, 5)
    }
  })

  it('un rol inventado no rompe el cálculo', () => {
    expect(monedasPorDia('gnomo')).toBe(0)
    expect(xpPorDia('gnomo')).toBe(0)
  })

  it('ningún rol se aleja más del doble de la tasa de referencia', () => {
    // Una sola tienda solo funciona si los tres ganan a ritmos parecidos.
    const ref = tasaDeReferencia()
    for (const rol of Object.keys(DEFAULTS_ROL)) {
      const suya = monedasPorDia(rol)
      expect(suya, rol).toBeGreaterThan(ref / 2)
      expect(suya, rol).toBeLessThan(ref * 2)
    }
  })
})

describe('los precios del catálogo respetan su banda', () => {
  for (const nivel of [1, 2, 3]) {
    it(`nivel ${nivel}`, () => {
      const [min, max] = bandaDePrecio(nivel)
      for (const p of CATALOGO_PREMIOS.filter((x) => x.tier === nivel)) {
        expect(p.cost, `${p.title} (${p.cost})`).toBeGreaterThanOrEqual(min)
        expect(p.cost, `${p.title} (${p.cost})`).toBeLessThanOrEqual(max)
      }
    })
  }

  it('la banda declarada en NIVELES coincide con la que deriva el modelo', () => {
    for (const nivel of [1, 2, 3]) {
      expect(NIVELES[nivel].coste, `nivel ${nivel}`).toEqual(bandaDePrecio(nivel))
    }
  })

  it('cada nivel cae en su cadencia, ±50 %', () => {
    for (const nivel of [1, 2, 3]) {
      const precios = CATALOGO_PREMIOS.filter((p) => p.tier === nivel).map((p) => p.cost)
      const medio = precios.reduce((a, b) => a + b, 0) / precios.length
      const dias = diasParaPermitirse(medio, tasaDeReferencia())
      const objetivo = SUPUESTOS.cadencia[nivel]
      expect(dias, `nivel ${nivel}: ${dias.toFixed(1)} días, objetivo ${objetivo}`).toBeGreaterThan(objetivo * 0.5)
      expect(dias, `nivel ${nivel}: ${dias.toFixed(1)} días, objetivo ${objetivo}`).toBeLessThan(objetivo * 1.5)
    }
  })

  it('los niveles no se solapan: nivel 3 nunca cuesta menos que nivel 2', () => {
    const max = (n) => Math.max(...CATALOGO_PREMIOS.filter((p) => p.tier === n).map((p) => p.cost))
    const min = (n) => Math.min(...CATALOGO_PREMIOS.filter((p) => p.tier === n).map((p) => p.cost))
    expect(min(2)).toBeGreaterThan(max(1))
    expect(min(3)).toBeGreaterThan(max(2))
  })
})

describe('meta del gremio', () => {
  it('la inicial se cierra en la cadencia prevista, ±40 %', () => {
    const objetivo = metaObjetivo()
    expect(META_INICIAL.target_xp).toBeGreaterThan(objetivo * 0.6)
    expect(META_INICIAL.target_xp).toBeLessThan(objetivo * 1.4)
  })

  it('no vuelve a los 600 XP de antes, que se cerraban en cuatro días', () => {
    const porDia = ['adulto', 'adulto', 'junior', 'peque'].reduce((t, r) => t + xpPorDia(r), 0)
    expect(META_INICIAL.target_xp / porDia).toBeGreaterThan(8)
  })
})

describe('diagnóstico en vivo', () => {
  const data = {
    profiles: [
      { id: 'p1', role: 'junior', active: true },
      { id: 'p2', role: 'peque', active: true },
      { id: 'p3', role: 'adulto', active: false }
    ],
    challenges: [
      { id: 'c1', profile_id: 'p1', active: true, xp: 15, coins: 8, frequency: 'diario' },
      { id: 'c2', profile_id: 'p1', active: true, xp: 30, coins: 15, frequency: 'semanal' },
      { id: 'c3', profile_id: 'p2', active: true, xp: 10, coins: 5, frequency: 'diario' },
      { id: 'c4', profile_id: 'p1', active: false, xp: 99, coins: 99, frequency: 'diario' },
      { id: 'c5', profile_id: 'p1', active: true, xp: 50, coins: 50, frequency: 'unico' }
    ],
    rewards: [
      { id: 'r1', tier: 1, cost: 40, active: true },
      { id: 'r2', tier: 3, cost: 600, active: true },
      { id: 'r3', tier: 1, cost: 999, active: false }
    ],
    goal: { target_xp: 1600 }
  }

  it('ignora perfiles retirados y misiones pausadas', () => {
    const d = diagnosticoEconomia(data)
    expect(d.porPersona.map((x) => x.perfil.id)).toEqual(['p1', 'p2'])
    expect(d.porPersona[0].misiones).toBe(3) // c1, c2, c5; no la pausada
  })

  it('lo único no cuenta como ingreso diario', () => {
    const d = diagnosticoEconomia(data)
    // junior: 8 diario + 15/7 semanal = 10,14 · adherencia 0,6 = 6,09
    expect(d.porPersona[0].monedasDia).toBeCloseTo((8 + 15 / 7) * 0.6, 2)
  })

  it('solo mira los premios activos', () => {
    const d = diagnosticoEconomia(data)
    expect(d.niveles.find((n) => n.nivel === 1).premios).toBe(1)
    expect(d.niveles.find((n) => n.nivel === 1).precioMedio).toBe(40)
  })

  it('un nivel sin premios no rompe nada', () => {
    const d = diagnosticoEconomia(data)
    const nivel2 = d.niveles.find((n) => n.nivel === 2)
    expect(nivel2.premios).toBe(0)
    expect(nivel2.precioMedio).toBe(null)
    expect(nivel2.diasMin).toBe(null)
  })

  it('aguanta una familia vacía', () => {
    expect(() => diagnosticoEconomia({})).not.toThrow()
    expect(diagnosticoEconomia({}).porPersona).toEqual([])
  })
})

describe('veredicto', () => {
  it('avisa cuando algo va demasiado rápido o demasiado lento', () => {
    expect(veredicto(0.5, 7).estado).toBe('rapido')
    expect(veredicto(7, 7).estado).toBe('ok')
    expect(veredicto(30, 7).estado).toBe('lento')
    expect(veredicto(null, 7).estado).toBe('sin_datos')
    expect(veredicto(Infinity, 7).estado).toBe('sin_datos')
  })
})
