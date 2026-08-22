import { describe, it, expect } from 'vitest'
import { elogiosDe, hayNuevo, leerVisita, sellarVisita, fechaCorta } from '../src/lib/muro'

const c = (extra = {}) => ({
  id: Math.random().toString(36).slice(2),
  profile_id: 'p1',
  status: 'aprobado',
  praise: 'Lo has hecho por tu cuenta.',
  resolved_at: '2026-08-20T10:00:00.000Z',
  challenge_id: 'ch1',
  ...extra
})

function almacenFalso(inicial = {}) {
  const datos = { ...inicial }
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v) },
    ver: () => ({ ...datos })
  }
}

describe('lo que le han dicho a alguien', () => {
  it('solo lo suyo', () => {
    const filas = [c(), c({ profile_id: 'p2' })]
    expect(elogiosDe(filas, 'p1')).toHaveLength(1)
  })

  // Un elogio escrito en una validación que luego se corrigió a
  // «rechazado» no es un elogio: es un accidente.
  it('solo lo aprobado', () => {
    expect(elogiosDe([c({ status: 'rechazado' })], 'p1')).toHaveLength(0)
    expect(elogiosDe([c({ status: 'pendiente' })], 'p1')).toHaveLength(0)
  })

  it('las misiones sin frase no pintan nada en el muro', () => {
    expect(elogiosDe([c({ praise: null }), c({ praise: '   ' }), c({ praise: '' })], 'p1')).toHaveLength(0)
  })

  it('lo último, arriba', () => {
    const filas = [
      c({ praise: 'de julio', resolved_at: '2026-07-01T10:00:00.000Z' }),
      c({ praise: 'de agosto', resolved_at: '2026-08-20T10:00:00.000Z' }),
      c({ praise: 'de junio', resolved_at: '2026-06-01T10:00:00.000Z' })
    ]
    expect(elogiosDe(filas, 'p1').map((e) => e.texto)).toEqual(['de agosto', 'de julio', 'de junio'])
  })

  // La frase se escribe al VALIDAR, no al pedir la misión.
  it('la fecha es la de la validación', () => {
    const [e] = elogiosDe([c({ requested_at: '2026-08-01T10:00:00.000Z' })], 'p1')
    expect(e.ts).toBe('2026-08-20T10:00:00.000Z')
  })

  it('el texto va limpio de espacios', () => {
    expect(elogiosDe([c({ praise: '  bien hecho  ' })], 'p1')[0].texto).toBe('bien hecho')
  })

  it('sin datos no rompe', () => {
    expect(elogiosDe()).toEqual([])
    expect(elogiosDe([], 'p1')).toEqual([])
  })
})

describe('¿hay algo nuevo?', () => {
  const elogios = [{ ts: '2026-08-20T10:00:00.000Z' }]

  it('sí si no lo ha abierto nunca', () => {
    expect(hayNuevo(elogios, null)).toBe(true)
  })

  it('sí si lo último es posterior a su última visita', () => {
    expect(hayNuevo(elogios, '2026-08-19T10:00:00.000Z')).toBe(true)
  })

  it('no si ya lo vio', () => {
    expect(hayNuevo(elogios, '2026-08-20T10:00:00.000Z')).toBe(false)
    expect(hayNuevo(elogios, '2026-08-21T10:00:00.000Z')).toBe(false)
  })

  it('sin nada que enseñar, no hay novedad', () => {
    expect(hayNuevo([], null)).toBe(false)
    expect(hayNuevo()).toBe(false)
  })
})

describe('cuándo lo vio, por dispositivo', () => {
  it('se guarda por perfil', () => {
    const almacen = almacenFalso()
    sellarVisita('p1', '2026-08-20T10:00:00.000Z', almacen)
    expect(leerVisita('p1', almacen)).toBe('2026-08-20T10:00:00.000Z')
    expect(leerVisita('p2', almacen)).toBeNull()
  })

  it('un almacén roto no tumba la pantalla', () => {
    const roto = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') } }
    expect(leerVisita('p1', roto)).toBeNull()
    expect(() => sellarVisita('p1', '2026-01-01', roto)).not.toThrow()
  })
})

describe('la fecha de cada frase', () => {
  const ahora = new Date('2026-08-22T00:00:00.000Z')

  it('sin año cuando es de este año: el año sobra', () => {
    expect(fechaCorta('2026-07-14T10:00:00.000Z', ahora)).toBe('14 de julio')
  })

  it('con año cuando es de otro', () => {
    expect(fechaCorta('2025-12-31T10:00:00.000Z', ahora)).toBe('31 de diciembre de 2025')
  })

  it('una fecha rota no escribe «Invalid Date» en la pantalla de nadie', () => {
    expect(fechaCorta('no soy una fecha', ahora)).toBe('')
    expect(fechaCorta(null, ahora)).toBe('')
  })
})
