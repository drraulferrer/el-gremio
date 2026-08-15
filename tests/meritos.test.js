import { describe, it, expect } from 'vitest'
import { rachaMaxima, aprobadasPorHabilidad, quienMasAporta, meritosDe } from '../src/lib/meritos'

// Fechas fijas: nada de `new Date()` suelto en un test, que convierte un
// fallo real en «pasa por la mañana y falla a medianoche».
function aprobada({ perfil = 'p1', reto = 'c1', dia, hora = 12, xp = 10 }) {
  const [a, m, d] = dia.split('-').map(Number)
  return {
    profile_id: perfil,
    challenge_id: reto,
    status: 'aprobado',
    xp,
    resolved_at: new Date(a, m - 1, d, hora, 0, 0).toISOString()
  }
}

describe('racha máxima', () => {
  it('cuenta días naturales seguidos, no misiones', () => {
    const c = [
      aprobada({ dia: '2026-8-10', reto: 'cama' }),
      aprobada({ dia: '2026-8-11', reto: 'mesa' }),
      aprobada({ dia: '2026-8-12', reto: 'basura' })
    ]
    expect(rachaMaxima(c, 'p1')).toBe(3)
  })

  it('dos misiones el mismo día son un solo día', () => {
    const c = [
      aprobada({ dia: '2026-8-10', reto: 'cama' }),
      aprobada({ dia: '2026-8-10', reto: 'mesa' })
    ]
    expect(rachaMaxima(c, 'p1')).toBe(1)
  })

  it('no se pierde al cruzar el 9 y el 10 del mes', () => {
    // dayKey no lleva ceros a la izquierda: ordenar como texto pone
    // '2026-8-10' antes que '2026-8-9' y parte la racha en dos.
    const c = [
      aprobada({ dia: '2026-8-8' }),
      aprobada({ dia: '2026-8-9' }),
      aprobada({ dia: '2026-8-10' }),
      aprobada({ dia: '2026-8-11' })
    ]
    expect(rachaMaxima(c, 'p1')).toBe(4)
  })

  it('devuelve la mejor racha histórica aunque hoy esté rota', () => {
    const c = [
      aprobada({ dia: '2026-7-1' }),
      aprobada({ dia: '2026-7-2' }),
      aprobada({ dia: '2026-7-3' }),
      aprobada({ dia: '2026-8-1' })
    ]
    expect(rachaMaxima(c, 'p1')).toBe(3)
  })

  it('un comodín tapa el hueco de un día', () => {
    const c = [
      aprobada({ dia: '2026-8-10' }),
      aprobada({ dia: '2026-8-12' })
    ]
    expect(rachaMaxima(c, 'p1')).toBe(1)
    expect(rachaMaxima(c, 'p1', ['2026-8-11'])).toBe(3)
  })

  it('un comodín gastado en un día que ya estaba hecho no suma dos veces', () => {
    const c = [aprobada({ dia: '2026-8-10' }), aprobada({ dia: '2026-8-11' })]
    expect(rachaMaxima(c, 'p1', ['2026-8-11'])).toBe(2)
  })

  it('ignora lo de otras personas y lo no aprobado', () => {
    const c = [
      aprobada({ dia: '2026-8-10', perfil: 'p2' }),
      { profile_id: 'p1', challenge_id: 'x', status: 'pendiente', xp: 10, resolved_at: null }
    ]
    expect(rachaMaxima(c, 'p1')).toBe(0)
  })
})

describe('aprobadas por habilidad', () => {
  const retos = [
    { id: 'cama', skill: 'hogar' },
    { id: 'mesa', skill: 'hogar' },
    { id: 'leer', skill: 'aprendizaje' },
    { id: 'suelta', skill: null }
  ]

  it('agrupa por la habilidad de cada misión', () => {
    const c = [
      aprobada({ dia: '2026-8-1', reto: 'cama' }),
      aprobada({ dia: '2026-8-2', reto: 'mesa' }),
      aprobada({ dia: '2026-8-3', reto: 'leer' })
    ]
    expect(aprobadasPorHabilidad(c, retos, 'p1')).toEqual({ hogar: 2, aprendizaje: 1 })
  })

  it('una misión sin habilidad no inventa una categoría', () => {
    const c = [aprobada({ dia: '2026-8-1', reto: 'suelta' })]
    expect(aprobadasPorHabilidad(c, retos, 'p1')).toEqual({})
  })
})

describe('quién aporta más a la meta', () => {
  const meta = { starts_at: new Date(2026, 7, 1).toISOString() }
  const gente = [{ id: 'p1' }, { id: 'p2' }]

  it('el de más XP desde que arrancó la meta', () => {
    const c = [
      aprobada({ dia: '2026-8-5', perfil: 'p1', xp: 30 }),
      aprobada({ dia: '2026-8-5', perfil: 'p2', xp: 10 })
    ]
    expect(quienMasAporta(meta, c, gente)).toBe('p1')
  })

  it('no cuenta lo anterior al arranque de la meta', () => {
    const c = [
      aprobada({ dia: '2026-7-20', perfil: 'p1', xp: 500 }),
      aprobada({ dia: '2026-8-5', perfil: 'p2', xp: 10 })
    ]
    expect(quienMasAporta(meta, c, gente)).toBe('p2')
  })

  it('en empate no se la lleva nadie, para que no baile en cada recarga', () => {
    const c = [
      aprobada({ dia: '2026-8-5', perfil: 'p1', xp: 20 }),
      aprobada({ dia: '2026-8-5', perfil: 'p2', xp: 20 })
    ]
    expect(quienMasAporta(meta, c, gente)).toBe(null)
  })

  it('sin meta o sin nada aportado, nadie', () => {
    expect(quienMasAporta(null, [], gente)).toBe(null)
    expect(quienMasAporta(meta, [], gente)).toBe(null)
  })

  it('quien ya no está activo no compite', () => {
    const c = [
      aprobada({ dia: '2026-8-5', perfil: 'p1', xp: 90 }),
      aprobada({ dia: '2026-8-5', perfil: 'p2', xp: 10 })
    ]
    expect(quienMasAporta(meta, c, [{ id: 'p2' }])).toBe('p2')
  })
})

describe('méritos completos', () => {
  const datos = {
    profiles: [{ id: 'p1', xp: 1000 }, { id: 'p2', xp: 0 }],
    challenges: [{ id: 'cama', skill: 'hogar' }, { id: 'leer', skill: 'aprendizaje' }],
    completions: [
      aprobada({ dia: '2026-8-10', reto: 'cama', hora: 8 }),
      aprobada({ dia: '2026-8-11', reto: 'leer', hora: 20 })
    ],
    redemptions: [
      { profile_id: 'p1', status: 'entregado' },
      { profile_id: 'p1', status: 'cancelado' }
    ],
    badges: [{ profile_id: 'p1', code: 'primera' }],
    goal: { starts_at: new Date(2026, 7, 1).toISOString() }
  }

  it('reúne lo que piden las insignias', () => {
    const m = meritosDe({ id: 'p1', xp: 1000 }, datos)
    expect(m.approved).toBe(2)
    expect(m.level).toBe(5)
    expect(m.rachaMax).toBe(2)
    expect(m.habilidadesTocadas).toBe(2)
    expect(m.porHabilidad).toEqual({ hogar: 1, aprendizaje: 1 })
    expect(m.insignias).toBe(1)
    expect(m.topAportacion).toBe(true)
  })

  it('un canje cancelado no cuenta como canje', () => {
    expect(meritosDe({ id: 'p1', xp: 0 }, datos).redemptions).toBe(1)
  })

  it('la hora que cuenta es la de validación', () => {
    expect(meritosDe({ id: 'p1', xp: 0 }, datos).antesDeLasNueve).toBe(1)
  })

  it('no se rompe con datos vacíos', () => {
    const m = meritosDe({ id: 'x', xp: 0 }, {})
    expect(m.approved).toBe(0)
    expect(m.topAportacion).toBe(false)
  })
})
