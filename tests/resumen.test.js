import { describe, it, expect } from 'vitest'
import {
  asignadasA,
  aportacionAMeta,
  premiosDe,
  extrasDe,
  resumenDePersona,
  resumenDelGremio,
  semanaEnCasillas
} from '../src/lib/resumen'

// Un miércoles, para que la semana natural (lunes a domingo) tenga días
// por delante y por detrás y los rangos no se prueben en el borde.
const HOY = new Date(2026, 7, 12, 10, 0, 0)
const dia = (d, h = 10) => new Date(2026, 7, d, h, 0, 0).toISOString()

const JUNIOR = { id: 'j', name: 'Junior', role: 'junior', xp: 300, coins: 40 }
const ADULTO = { id: 'a', name: 'Adulto', role: 'adulto', xp: 100, coins: 10 }
const PEQUE = { id: 'p', name: 'Peque', role: 'peque', xp: 0, coins: 5 }

const RETOS = [
  { id: 'cama', title: 'Hacer la cama', frequency: 'diario', active: true, profile_id: 'j', target_roles: null },
  { id: 'leer', title: 'Leer', frequency: 'diario', active: true, profile_id: null, target_roles: ['junior'] },
  { id: 'menu', title: 'Menú', frequency: 'semanal', active: true, profile_id: null, target_roles: ['adulto'] },
  { id: 'vieja', title: 'Pausada', frequency: 'diario', active: false, profile_id: 'j', target_roles: null }
]

const aprobada = (perfil, reto, d, xp = 15) => ({
  profile_id: perfil,
  challenge_id: reto,
  status: 'aprobado',
  xp,
  coins: 8,
  requested_at: dia(d, 9),
  resolved_at: dia(d)
})

describe('misiones asignadas', () => {
  it('cuenta por frecuencia y deja fuera las pausadas', () => {
    const a = asignadasA(JUNIOR, RETOS)
    expect(a.total).toBe(2)
    expect(a.diario).toBe(2)
    expect(a.semanal).toBe(0)
  })

  it('cada rol ve las suyas', () => {
    expect(asignadasA(ADULTO, RETOS).total).toBe(1)
    expect(asignadasA(PEQUE, RETOS).total).toBe(0)
  })
})

describe('aportación a la meta', () => {
  const meta = { starts_at: dia(10), target_xp: 200 }
  const completions = [
    aprobada('j', 'cama', 11, 30),
    aprobada('a', 'menu', 11, 10),
    // Anterior al arranque de la meta: no cuenta para el reparto.
    aprobada('j', 'cama', 5, 500)
  ]

  it('reparte sobre lo aportado desde que arrancó la meta', () => {
    expect(aportacionAMeta(JUNIOR, meta, completions)).toEqual({ xp: 30, pct: 75 })
    expect(aportacionAMeta(ADULTO, meta, completions)).toEqual({ xp: 10, pct: 25 })
  })

  it('sin meta no hay reparto que enseñar', () => {
    expect(aportacionAMeta(JUNIOR, null, completions)).toEqual({ xp: 0, pct: 0 })
  })

  it('con la meta recién abierta no divide entre cero', () => {
    expect(aportacionAMeta(JUNIOR, { starts_at: dia(12, 23) }, [])).toEqual({ xp: 0, pct: 0 })
  })
})

describe('premios recibidos', () => {
  const rewards = [{ id: 'r1', title: 'Cine' }, { id: 'r2', title: 'Helado' }]
  const redenciones = [
    { profile_id: 'j', reward_id: 'r1', cost: 100, status: 'entregado', resolved_at: dia(6) },
    { profile_id: 'j', reward_id: 'r2', cost: 60, status: 'entregado', resolved_at: dia(11) },
    { profile_id: 'j', reward_id: 'r1', cost: 100, status: 'pendiente', resolved_at: null },
    { profile_id: 'j', reward_id: 'r1', cost: 100, status: 'cancelado', resolved_at: dia(7) }
  ]

  it('separa entregados, en camino y lo gastado', () => {
    const p = premiosDe(JUNIOR, redenciones, rewards)
    expect(p.entregados).toBe(2)
    expect(p.enCamino).toBe(1)
    // Un canje cancelado devolvió las monedas: no se ha gastado.
    expect(p.gastado).toBe(160)
  })

  it('el último es el más reciente, con su nombre', () => {
    expect(premiosDe(JUNIOR, redenciones, rewards).ultimo.titulo).toBe('Helado')
  })

  it('sin canjes no inventa un último', () => {
    expect(premiosDe(ADULTO, redenciones, rewards).ultimo).toBe(null)
  })
})

describe('monedas que no vienen de misiones', () => {
  it('separa el juego del premio a mano', () => {
    const bonuses = [
      { profile_id: 'p', tipo: 'globos', coins: 5 },
      { profile_id: 'p', tipo: 'globos', coins: 5 },
      { profile_id: 'p', tipo: 'manual', coins: 20 },
      { profile_id: 'j', tipo: 'manual', coins: 50 }
    ]
    expect(extrasDe(PEQUE, bonuses)).toEqual({ juego: 10, aMano: 20 })
  })
})

describe('la ficha de una persona', () => {
  const datos = {
    profiles: [ADULTO, JUNIOR, PEQUE],
    challenges: RETOS,
    completions: [
      aprobada('j', 'cama', 12),
      aprobada('j', 'leer', 11),
      { profile_id: 'j', challenge_id: 'cama', status: 'pendiente', xp: 15, coins: 8, requested_at: dia(12), resolved_at: null },
      { profile_id: 'j', challenge_id: 'leer', status: 'rechazado', xp: 15, coins: 8, requested_at: dia(12), resolved_at: dia(12, 11) }
    ],
    redemptions: [],
    rewards: [],
    bonuses: [],
    goal: { starts_at: dia(10), target_xp: 200 }
  }

  it('separa hoy, la semana y el total', () => {
    const r = resumenDePersona(JUNIOR, datos, HOY)
    expect(r.completadas.hoy).toBe(1)
    expect(r.completadas.semana).toBe(2)
    expect(r.completadas.total).toBe(2)
  })

  it('enseña lo pendiente y lo devuelto de la semana', () => {
    const r = resumenDePersona(JUNIOR, datos, HOY)
    expect(r.pendientes).toBe(1)
    expect(r.devueltas).toBe(1)
  })

  it('no se rompe con una persona que no ha hecho nada', () => {
    const r = resumenDePersona(PEQUE, datos, HOY)
    expect(r.completadas.total).toBe(0)
    expect(r.meta).toEqual({ xp: 0, pct: 0 })
    expect(r.premios.ultimo).toBe(null)
  })
})

describe('el gremio entero', () => {
  const datos = {
    profiles: [PEQUE, JUNIOR, ADULTO],
    challenges: RETOS,
    completions: [aprobada('j', 'cama', 12), aprobada('a', 'menu', 11)],
    redemptions: [],
    rewards: [],
    bonuses: [],
    goal: { starts_at: dia(10), target_xp: 100, title: 'Pizza', emoji: '🍕' }
  }

  it('ordena por rol y no por lo aportado: un panel ordenado por XP es una clasificación', () => {
    const r = resumenDelGremio(datos, HOY)
    expect(r.personas.map((x) => x.perfil.name)).toEqual(['Adulto', 'Junior', 'Peque'])
  })

  it('resume la meta con su porcentaje', () => {
    const r = resumenDelGremio(datos, HOY)
    expect(r.meta.progreso).toBe(30)
    expect(r.meta.pct).toBe(30)
  })

  it('señala a quien lleva la semana sin aparecer', () => {
    expect(resumenDelGremio(datos, HOY).sinActividad).toEqual(['Peque'])
  })

  it('sin meta activa el cuadro sigue saliendo', () => {
    const r = resumenDelGremio({ ...datos, goal: null }, HOY)
    expect(r.meta).toBe(null)
    expect(r.personas).toHaveLength(3)
  })
})

describe('la semana en siete casillas (la ficha de la peque)', () => {
  // HOY es miércoles 12 de agosto de 2026.
  const completions = [aprobada('p', 'cama', 10), aprobada('p', 'cama', 12)]

  it('empieza en lunes, como el resto del historial', () => {
    expect(semanaEnCasillas(PEQUE, completions, HOY).map((d) => d.letra)).toEqual(
      ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    )
  })

  it('marca los días con algo hecho', () => {
    const s = semanaEnCasillas(PEQUE, completions, HOY)
    expect(s.filter((d) => d.hecho).map((d) => d.letra)).toEqual(['L', 'X'])
  })

  it('señala hoy, y hoy nunca es futuro aunque queden horas', () => {
    const s = semanaEnCasillas(PEQUE, completions, HOY)
    const hoy = s.find((d) => d.hoy)
    expect(hoy.letra).toBe('X')
    expect(hoy.futuro).toBe(false)
  })

  it('lo que aún no ha llegado va aparte: un futuro en hueco se lee como un suspenso', () => {
    const s = semanaEnCasillas(PEQUE, completions, HOY)
    expect(s.filter((d) => d.futuro).map((d) => d.letra)).toEqual(['J', 'V', 'S', 'D'])
    // El martes no se hizo y ya pasó: ese sí es un hueco de verdad.
    const martes = s.find((d) => d.letra === 'M')
    expect(martes.hecho).toBe(false)
    expect(martes.futuro).toBe(false)
  })

  it('sin nada hecho siguen siendo siete casillas', () => {
    expect(semanaEnCasillas(PEQUE, [], HOY)).toHaveLength(7)
  })
})
