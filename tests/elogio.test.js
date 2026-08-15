import { describe, it, expect } from 'vitest'
import { sugerenciasDeElogio, rachaDeMision, elogioValido } from '../src/lib/elogio'
import { CATALOGO, tareasDeRol } from '../src/lib/tareas'

const hace = (dias) => {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString()
}

const hecha = (dias, extra = {}) => ({
  challenge_id: 'c1',
  profile_id: 'p1',
  status: 'aprobado',
  resolved_at: hace(dias),
  ...extra
})

describe('sugerencias de elogio', () => {
  const reto = { title: 'Recoger los juguetes', skill: 'responsabilidad' }

  it('nombran la acción concreta, que es lo que las hace útiles', () => {
    const s = sugerenciasDeElogio({ reto })
    expect(s.length).toBeGreaterThanOrEqual(3)
    expect(s.some((f) => f.includes('recoger los juguetes'))).toBe(true)
  })

  it('nunca proponen un "muy bien" pelado', () => {
    for (const skill of ['hogar', 'salud', 'autonomia', 'amabilidad', 'creatividad']) {
      for (const frase of sugerenciasDeElogio({ reto: { title: 'Hacer la cama', skill } })) {
        expect(frase.trim().toLowerCase()).not.toBe('muy bien')
        expect(frase.length).toBeGreaterThan(15)
      }
    }
  })

  it('cambian según la habilidad', () => {
    const a = sugerenciasDeElogio({ reto: { title: 'Hacer la cama', skill: 'autonomia' } })[0]
    const b = sugerenciasDeElogio({ reto: { title: 'Hacer la cama', skill: 'amabilidad' } })[0]
    expect(a).not.toBe(b)
  })

  it('con racha, reconocen la constancia y no solo el resultado', () => {
    const conRacha = sugerenciasDeElogio({ reto, racha: 5 })
    expect(conRacha.some((f) => /6 días seguidos/.test(f))).toBe(true)
  })

  it('sin racha no inventan una', () => {
    const sinRacha = sugerenciasDeElogio({ reto, racha: 0 })
    expect(sinRacha.some((f) => /días seguidos/.test(f))).toBe(false)
  })

  it('no repiten y no pasan de cuatro', () => {
    const s = sugerenciasDeElogio({ reto, racha: 9 })
    expect(s.length).toBeLessThanOrEqual(4)
    expect(new Set(s).size).toBe(s.length)
  })

  it('aguantan una misión sin habilidad o sin título', () => {
    expect(() => sugerenciasDeElogio({ reto: {} })).not.toThrow()
    expect(sugerenciasDeElogio({ reto: {} }).length).toBeGreaterThan(0)
  })

  // Los títulos del catálogo están en infinitivo. Este test existe porque
  // la primera versión soltaba "Has hacer la cama sin que nadie te lo
  // recordara": un elogio mal construido no suena sincero, y sin sinceridad
  // el elogio deja de funcionar.
  it('ninguna frase del catálogo entero queda mal construida', () => {
    const malaConstruccion = /\bHas [a-záéíóúñ]+(ar|er|ir)\b/
    for (const rol of Object.keys(CATALOGO)) {
      for (const tarea of tareasDeRol(rol)) {
        const reto = { title: tarea.t, skill: tarea.skill }
        for (const racha of [0, 4]) {
          for (const frase of sugerenciasDeElogio({ reto, racha })) {
            expect(malaConstruccion.test(frase), `${rol} · ${tarea.t} → "${frase}"`).toBe(false)
            expect(frase.endsWith('.'), `sin punto final: "${frase}"`).toBe(true)
          }
        }
      }
    }
  })
})

describe('racha de una misión', () => {
  it('cuenta días naturales consecutivos, empezando por ayer', () => {
    const completions = [hecha(1), hecha(2), hecha(3)]
    expect(rachaDeMision('c1', 'p1', completions)).toBe(3)
  })

  it('un hueco la corta', () => {
    const completions = [hecha(1), hecha(3), hecha(4)]
    expect(rachaDeMision('c1', 'p1', completions)).toBe(1)
  })

  it('lo de hoy no cuenta todavía: se está validando', () => {
    expect(rachaDeMision('c1', 'p1', [hecha(0)])).toBe(0)
  })

  it('no mezcla personas ni misiones', () => {
    const completions = [hecha(1, { profile_id: 'p2' }), hecha(2, { challenge_id: 'c9' })]
    expect(rachaDeMision('c1', 'p1', completions)).toBe(0)
  })

  it('ignora lo pendiente y lo rechazado', () => {
    const completions = [hecha(1, { status: 'pendiente' }), hecha(2, { status: 'rechazado' })]
    expect(rachaDeMision('c1', 'p1', completions)).toBe(0)
  })
})

describe('validez del elogio', () => {
  it('vacío vale: obligar a escribir acabaría en "ok"', () => {
    expect(elogioValido('')).toBe(true)
    expect(elogioValido(null)).toBe(true)
  })

  it('corta por arriba', () => {
    expect(elogioValido('x'.repeat(240))).toBe(true)
    expect(elogioValido('x'.repeat(241))).toBe(false)
  })
})
