import { describe, it, expect } from 'vitest'
import { sugerenciasDeCorreccion, correccionValida } from '../src/lib/elogio'

describe('sugerencias para no validar', () => {
  const reto = { title: 'Recoger los juguetes', a: 'recoger los juguetes' }

  it('da tres frases y ninguna está vacía', () => {
    const s = sugerenciasDeCorreccion({ reto })
    expect(s).toHaveLength(3)
    for (const f of s) expect(f.trim().length).toBeGreaterThan(10)
  })

  it('hablan de la tarea, no de la persona', () => {
    for (const f of sugerenciasDeCorreccion({ reto })) {
      expect(f).not.toMatch(/vago|vaga|perezos|no te has esforzado|mal hecho|otra vez tú/i)
    }
  })

  it('todas dejan claro el siguiente paso', () => {
    for (const f of sugerenciasDeCorreccion({ reto })) {
      expect(f).toMatch(/valida|avísame|cuando esté|termínalo|repasa|mira otra vez/i)
    }
  })

  it('no revienta sin misión', () => {
    expect(sugerenciasDeCorreccion({}).length).toBe(3)
    expect(sugerenciasDeCorreccion({ reto: null }).length).toBe(3)
  })
})

describe('validez del motivo', () => {
  it('vacío no vale: rechazar sin decir por qué es el bug que arreglamos', () => {
    expect(correccionValida('')).toBe(false)
    expect(correccionValida('  ')).toBe(false)
    expect(correccionValida('no')).toBe(false)
  })

  it('un motivo corto pero real, sí', () => {
    expect(correccionValida('Falta la mesa')).toBe(true)
  })

  it('no cabe una novela', () => {
    expect(correccionValida('x'.repeat(241))).toBe(false)
  })
})
