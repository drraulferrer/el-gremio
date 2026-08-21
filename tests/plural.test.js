import { describe, it, expect } from 'vitest'
import { plural } from '../src/lib/plural'

describe('singular y plural', () => {
  it('con uno, va en singular', () => {
    expect(plural(1, 'estrella', 'estrellas')).toBe('1 estrella')
  })

  it('con más de uno, va en plural', () => {
    expect(plural(3, 'estrella', 'estrellas')).toBe('3 estrellas')
  })

  // El cero es plural en castellano («0 estrellas»), y es el caso que más
  // se ve: el tarro vacío es el estado de partida de cualquier peque.
  it('con cero, va en plural', () => {
    expect(plural(0, 'estrella', 'estrellas')).toBe('0 estrellas')
  })

  it('sirve para frases enteras, no solo para palabras sueltas', () => {
    expect(plural(1, 'estrella guardada', 'estrellas guardadas')).toBe('1 estrella guardada')
    expect(plural(12, 'estrella guardada', 'estrellas guardadas')).toBe('12 estrellas guardadas')
  })
})
