import { describe, it, expect } from 'vitest'
import {
  estaActivo,
  perfilesActivos,
  perfilesRetirados,
  validarMiembro,
  puedeRetirar,
  loQueSePierde,
  MAX_PERFILES
} from '../src/lib/miembros'

const perfil = (id, name, role, active = true) => ({ id, name, role, active, xp: 0, coins: 0 })

const GREMIO = [
  perfil('a1', 'Adulta', 'adulto'),
  perfil('a2', 'Adulto', 'adulto'),
  perfil('j1', 'Junior', 'junior'),
  perfil('p1', 'Peque', 'peque')
]

describe('activos y retirados', () => {
  it('un perfil sin la columna active cuenta como activo', () => {
    // Así funciona en una base a la que todavía no se le ha pasado la
    // migración 003: nadie desaparece del selector por sorpresa.
    expect(estaActivo({ id: 'x', name: 'Sin columna' })).toBe(true)
  })

  it('separa unos de otros', () => {
    const con = [...GREMIO, perfil('r1', 'Retirada', 'junior', false)]
    expect(perfilesActivos(con).map((p) => p.id)).toEqual(['a1', 'a2', 'j1', 'p1'])
    expect(perfilesRetirados(con).map((p) => p.id)).toEqual(['r1'])
  })
})

describe('validación de un miembro', () => {
  it('exige nombre y rol conocido', () => {
    expect(validarMiembro({ name: '   ', role: 'junior' }, GREMIO).ok).toBe(false)
    expect(validarMiembro({ name: 'Nueva', role: 'gnomo' }, GREMIO).ok).toBe(false)
    expect(validarMiembro({ name: 'Nueva', role: 'junior' }, GREMIO).ok).toBe(true)
  })

  it('rechaza nombres repetidos sin distinguir mayúsculas ni acentos de más', () => {
    const r = validarMiembro({ name: '  junior ', role: 'peque' }, GREMIO)
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(/Ya hay alguien/)
  })

  it('deja renombrar a alguien sin chocar consigo mismo', () => {
    expect(validarMiembro({ id: 'j1', name: 'Junior', role: 'junior' }, GREMIO).ok).toBe(true)
  })

  it('no cuenta a los retirados para el choque de nombres', () => {
    const con = [...GREMIO, perfil('r1', 'Fantasma', 'junior', false)]
    expect(validarMiembro({ name: 'Fantasma', role: 'junior' }, con).ok).toBe(true)
  })

  it('corta en el máximo de miembros activos', () => {
    const lleno = Array.from({ length: MAX_PERFILES }, (_, i) => perfil('x' + i, 'M' + i, 'junior'))
    const r = validarMiembro({ name: 'Uno más', role: 'junior' }, lleno)
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(new RegExp(String(MAX_PERFILES)))
  })

  it('impide dejar el gremio sin ninguna persona adulta al cambiar un rol', () => {
    const soloUnAdulto = [perfil('a1', 'Adulta', 'adulto'), perfil('j1', 'Junior', 'junior')]
    const r = validarMiembro({ id: 'a1', name: 'Adulta', role: 'junior' }, soloUnAdulto)
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(/única persona adulta/)
  })

  it('sí permite bajar de rol si queda otra persona adulta', () => {
    expect(validarMiembro({ id: 'a1', name: 'Adulta', role: 'junior' }, GREMIO).ok).toBe(true)
  })
})

describe('retirar', () => {
  it('permite retirar a quien no es la última persona adulta', () => {
    expect(puedeRetirar(GREMIO[0], GREMIO).ok).toBe(true)
    expect(puedeRetirar(GREMIO[2], GREMIO).ok).toBe(true)
  })

  it('protege a la última persona adulta: nadie podría validar', () => {
    const soloUnAdulto = [perfil('a1', 'Adulta', 'adulto'), perfil('j1', 'Junior', 'junior')]
    const r = puedeRetirar(soloUnAdulto[0], soloUnAdulto)
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(/única persona adulta/)
  })

  it('no deja vaciar el gremio', () => {
    const unaSola = [perfil('a1', 'Adulta', 'adulto')]
    expect(puedeRetirar(unaSola[0], unaSola).ok).toBe(false)
  })
})

describe('qué se pierde al borrar', () => {
  it('cuenta historial y XP aprobada de esa persona', () => {
    const datos = {
      completions: [
        { profile_id: 'j1', status: 'aprobado', xp: 20 },
        { profile_id: 'j1', status: 'aprobado', xp: 30 },
        { profile_id: 'j1', status: 'pendiente', xp: 99 },
        { profile_id: 'a1', status: 'aprobado', xp: 50 }
      ],
      redemptions: [{ profile_id: 'j1' }],
      badges: [{ profile_id: 'j1' }, { profile_id: 'j1' }]
    }
    expect(loQueSePierde(GREMIO[2], datos)).toEqual({ misiones: 3, canjes: 1, insignias: 2, xp: 50 })
  })

  it('no revienta sin datos', () => {
    expect(loQueSePierde(null, null)).toEqual({ misiones: 0, canjes: 0, insignias: 0, xp: 0 })
  })
})
