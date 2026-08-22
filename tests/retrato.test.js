import { describe, it, expect } from 'vitest'
import { habilidadesDe, leHanDicho, retratoDe } from '../src/lib/retrato'

const AHORA = new Date('2026-08-22T12:00:00.000Z')
const haceDias = (n) => new Date(AHORA.getTime() - n * 86400000).toISOString()

const c = (extra = {}) => ({
  profile_id: 'p1',
  status: 'aprobado',
  resolved_at: haceDias(1),
  snapshot_skill: 'hogar',
  challenge_id: 'ch1',
  ...extra
})

describe('en qué ha andado esta semana', () => {
  it('cuenta por habilidad y ordena de más a menos', () => {
    const datos = {
      completions: [c(), c(), c({ snapshot_skill: 'amabilidad' })],
      challenges: []
    }
    const h = habilidadesDe('p1', datos, AHORA)
    expect(h.map((x) => x.id)).toEqual(['hogar', 'amabilidad'])
    expect(h[0].veces).toBe(2)
    expect(h[0].nombre).toBe('Hogar')
  })

  // Si mañana una misión cambia de habilidad, la semana pasada no puede
  // cambiar con ella: manda el contexto congelado de la completación.
  it('manda el snapshot, no la misión de hoy', () => {
    const datos = {
      completions: [c({ snapshot_skill: 'salud' })],
      challenges: [{ id: 'ch1', skill: 'hogar' }]
    }
    expect(habilidadesDe('p1', datos, AHORA)[0].id).toBe('salud')
  })

  it('sin snapshot se cae a la misión, que es mejor que nada', () => {
    const datos = {
      completions: [c({ snapshot_skill: null })],
      challenges: [{ id: 'ch1', skill: 'cooperacion' }]
    }
    expect(habilidadesDe('p1', datos, AHORA)[0].id).toBe('cooperacion')
  })

  it('solo lo suyo, lo aprobado y lo de estos siete días', () => {
    const datos = {
      completions: [
        c({ profile_id: 'p9' }),
        c({ status: 'pendiente' }),
        c({ resolved_at: haceDias(30) }),
        c()
      ],
      challenges: []
    }
    expect(habilidadesDe('p1', datos, AHORA)).toHaveLength(1)
  })

  it('sin datos no rompe', () => {
    expect(habilidadesDe('p1')).toEqual([])
  })
})

describe('si alguien se ha acordado de decírselo', () => {
  it('sí o no, nunca cuántas veces', () => {
    const datos = { reconocimientos: [{ a_profile: 'p1', created_at: haceDias(2) }] }
    expect(leHanDicho('p1', datos, AHORA)).toBe(true)
    // Es un booleano a propósito: contar lo recibido es el marcador que
    // la decisión §10.1 prohíbe en toda la app.
    expect(typeof leHanDicho('p1', datos, AHORA)).toBe('boolean')
  })

  it('no cuenta lo de otra persona ni lo de hace un mes', () => {
    expect(leHanDicho('p1', { reconocimientos: [{ a_profile: 'p9', created_at: haceDias(1) }] }, AHORA)).toBe(false)
    expect(leHanDicho('p1', { reconocimientos: [{ a_profile: 'p1', created_at: haceDias(30) }] }, AHORA)).toBe(false)
  })
})

describe('la frase', () => {
  it('con dos habilidades, las nombra', () => {
    const datos = { completions: [c(), c(), c({ snapshot_skill: 'salud' })], challenges: [] }
    expect(retratoDe('p1', datos, AHORA).frase).toBe('Esta semana el gremio te ha visto sobre todo en Hogar y Salud.')
  })

  // Con tres deja de ser un retrato y pasa a ser un inventario.
  it('nunca nombra más de dos', () => {
    const datos = {
      completions: [c(), c({ snapshot_skill: 'salud' }), c({ snapshot_skill: 'aprendizaje' })],
      challenges: []
    }
    const frase = retratoDe('p1', datos, AHORA).frase
    expect(frase).toMatch(/Hogar|Salud|Aprendizaje/)
    expect(frase.split(' y ')).toHaveLength(2)
  })

  it('con una, la nombra sola', () => {
    expect(retratoDe('p1', { completions: [c()], challenges: [] }, AHORA).frase)
      .toBe('Esta semana el gremio te ha visto sobre todo en Hogar.')
  })

  it('sin nada validado lo dice sin adornos', () => {
    expect(retratoDe('p1', { completions: [] }, AHORA).frase).toBe('Esta semana todavía no hay nada validado.')
  })

  it('y si además le han dicho algo, lo añade sin cifras', () => {
    const datos = {
      completions: [c()],
      challenges: [],
      reconocimientos: [{ a_profile: 'p1', created_at: haceDias(1) }, { a_profile: 'p1', created_at: haceDias(2) }]
    }
    const frase = retratoDe('p1', datos, AHORA).frase
    expect(frase).toMatch(/alguien se ha acordado de decírtelo/i)
    expect(frase).not.toMatch(/\d/)
  })

  it('sin nada validado pero con alguien que se acordó, también lo dice', () => {
    const datos = { completions: [], reconocimientos: [{ a_profile: 'p1', created_at: haceDias(1) }] }
    expect(retratoDe('p1', datos, AHORA).frase).toMatch(/alguien se ha acordado/i)
  })
})
