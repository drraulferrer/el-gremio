import { describe, it, expect, afterEach } from 'vitest'
import { dayKey, weekKey, monthKey, configurarZona, zonaActual, esColumnaQueNoExiste } from '../src/lib/supabase'

// ------------------------------------------------------------------
// La zona horaria de la familia (migración 018).
//
// Lo que defienden estos tests no es el formato de una cadena: es que el
// navegador y Postgres estén contando el MISMO día. Mientras el servidor
// contaba en Europe/Madrid y el cliente en la hora del aparato, una
// familia en México podía pedir la estrella diaria dos veces o ninguna, y
// ver rota una racha viva. El fallo no daba error: daba un resultado
// distinto.
// ------------------------------------------------------------------

afterEach(() => configurarZona(null))

describe('dayKey con zona', () => {
  it('sin zona configurada se comporta como siempre (hora del dispositivo)', () => {
    configurarZona(null)
    expect(dayKey(new Date(2026, 7, 15))).toBe('2026-8-15')
  })

  it('el mismo instante es un día distinto en Madrid y en Ciudad de México', () => {
    // 15 de agosto, 02:00 en Madrid (UTC+2) = 14 de agosto, 18:00 en México.
    const instante = new Date('2026-08-15T00:00:00Z')

    configurarZona('Europe/Madrid')
    const madrid = dayKey(instante)

    configurarZona('America/Mexico_City')
    const mexico = dayKey(instante)

    expect(madrid).toBe('2026-8-15')
    expect(mexico).toBe('2026-8-14')
    expect(madrid).not.toBe(mexico)
  })

  it('mantiene el formato sin ceros a la izquierda', () => {
    // No es estética: hay claves guardadas y comparadas con este formato
    // por toda la app, y el juego de globos casa el `dia` de Postgres
    // (que sí lleva ceros) contra esto.
    configurarZona('Europe/Madrid')
    expect(dayKey(new Date('2026-03-05T12:00:00Z'))).toBe('2026-3-5')
  })

  it('acepta la zona como argumento sin tocar la configurada', () => {
    configurarZona('Europe/Madrid')
    expect(dayKey(new Date('2026-08-15T00:00:00Z'), 'America/Mexico_City')).toBe('2026-8-14')
    expect(dayKey(new Date('2026-08-15T00:00:00Z'))).toBe('2026-8-15')
  })
})

describe('weekKey y monthKey siguen a la misma zona', () => {
  it('un cambio de mes a medianoche cae de un lado o de otro según la zona', () => {
    const instante = new Date('2026-09-01T00:30:00Z') // 02:30 en Madrid, 18:30 del día 31 en México
    expect(monthKey(instante, 'Europe/Madrid')).toBe('2026-m9')
    expect(monthKey(instante, 'America/Mexico_City')).toBe('2026-m8')
  })

  it('y un cambio de semana, igual', () => {
    // Lunes 3 de agosto de 2026, 00:30 UTC.
    const instante = new Date('2026-08-03T00:30:00Z')
    expect(weekKey(instante, 'Europe/Madrid')).not.toBe(weekKey(instante, 'America/Los_Angeles'))
  })
})

describe('zonaActual', () => {
  it('devuelve la configurada cuando la hay', () => {
    configurarZona('America/Bogota')
    expect(zonaActual()).toBe('America/Bogota')
  })

  it('y si no, alguna del dispositivo, nunca vacío', () => {
    configurarZona(null)
    expect(zonaActual()).toBeTruthy()
  })
})

describe('esColumnaQueNoExiste', () => {
  it('reconoce a PostgREST diciendo que falta la columna', () => {
    expect(esColumnaQueNoExiste({ code: 'PGRST204' })).toBe(true)
    expect(esColumnaQueNoExiste({ code: '42703' })).toBe(true)
    expect(esColumnaQueNoExiste({ message: 'column families.timezone does not exist' })).toBe(true)
  })

  it('y no confunde cualquier otro error con eso', () => {
    // Importa: si diera true de más, el alta reintentaría sin la zona y
    // se tragaría en silencio un fallo real.
    expect(esColumnaQueNoExiste(null)).toBe(false)
    expect(esColumnaQueNoExiste({ code: '23505', message: 'duplicate key value' })).toBe(false)
    expect(esColumnaQueNoExiste({ message: 'network error' })).toBe(false)
  })
})
