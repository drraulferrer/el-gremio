import { describe, it, expect } from 'vitest'
import { componerAviso, todasLasPlantillas } from '../supabase/functions/notificar/mensajes.ts'
import { plantillaCompleta, marcasDe } from '../src/lib/genero'

const BASE = { nombre: 'Junior', n: 12, dia: '2026-08-16', profileId: 'p1' }

describe('el tono de los avisos', () => {
  it('ninguna frase riñe: nada de fallar, deber ni llevar sin', () => {
    // Esto lo lee una niña de once años en su móvil. La app puede picar,
    // echar de menos y retar; no puede reprochar.
    const prohibidas = /has fallado|no has hecho|llevas .* sin|deberías|tienes que|otra vez sin|perdid/i
    for (const a of todasLasPlantillas()) {
      expect(`${a.titulo} ${a.cuerpo}`, `frase con reproche: ${a.titulo}`).not.toMatch(prohibidas)
    }
  })

  it('ninguna frase lleva marca de género a medias', () => {
    for (const a of todasLasPlantillas()) {
      expect(plantillaCompleta(a.titulo), `título: ${a.titulo}`).toBe(true)
      expect(plantillaCompleta(a.cuerpo), `cuerpo: ${a.cuerpo}`).toBe(true)
    }
  })

  it('y ninguna necesita marca: se envían tal cual, sin pasar por flex', () => {
    // La Edge Function no tiene el catálogo de género, así que una marca
    // aquí llegaría al móvil como «{a|b|c}» en crudo.
    for (const a of todasLasPlantillas()) {
      expect(marcasDe(a.titulo)).toHaveLength(0)
      expect(marcasDe(a.cuerpo)).toHaveLength(0)
    }
  })

  it('no cuela ningún adjetivo con género de los típicos', () => {
    const genero = /\b(solo|sola|cansad[oa]|list[oa]|content[oa]|perdid[oa]|dormid[oa]|quiet[oa])\b/i
    for (const a of todasLasPlantillas()) {
      expect(`${a.titulo} ${a.cuerpo}`, `género en: ${a.titulo}`).not.toMatch(genero)
    }
  })
})

describe('qué frase toca', () => {
  it('la misma persona y el mismo día siempre reciben lo mismo', () => {
    expect(componerAviso('vuelve', BASE)).toEqual(componerAviso('vuelve', BASE))
  })

  it('dos personas el mismo día no reciben la misma frase', () => {
    const a = componerAviso('vuelve', { ...BASE, profileId: 'p1' })
    const b = componerAviso('vuelve', { ...BASE, profileId: 'p2' })
    expect(a).not.toEqual(b)
  })

  it('la misma persona no repite frase dos días seguidos', () => {
    const hoy = componerAviso('racha_riesgo', { ...BASE, dia: '2026-08-16' })
    const manana = componerAviso('racha_riesgo', { ...BASE, dia: '2026-08-17' })
    expect(hoy).not.toEqual(manana)
  })

  it('el número que se enseña es el que se le pasa', () => {
    const a = componerAviso('racha_riesgo', { ...BASE, n: 12, profileId: 'p3' })
    const texto = `${a.titulo} ${a.cuerpo}`
    if (/\d+/.test(texto)) expect(texto).toMatch(/\b(12|13)\b/)
  })

  it('nunca enseña un número negativo', () => {
    const a = componerAviso('sin_validar', { ...BASE, n: -5 })
    expect(`${a.titulo} ${a.cuerpo}`).not.toMatch(/-\d/)
  })

  it('singular y plural cuadran en las de validar', () => {
    for (const profileId of ['a', 'b', 'c', 'd', 'e']) {
      const una = componerAviso('sin_validar', { ...BASE, n: 1, profileId })
      const texto = `${una.titulo} ${una.cuerpo}`
      expect(texto, texto).not.toMatch(/\b1 misiones\b/)
    }
  })

  it('un motivo inventado no pasa en silencio', () => {
    expect(() => componerAviso('lo_que_sea', BASE)).toThrow()
  })
})
