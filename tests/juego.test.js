import { describe, it, expect } from 'vitest'
import {
  metaDelDia,
  estadoDelJuego,
  siguientePremio,
  esDeHoy,
  juegoDelDia,
  diaCompleto,
  claveFiesta,
  JUEGOS,
  GLOBOS_DEL_JUEGO
} from '../src/lib/juego'

describe('cuántas misiones abren el juego', () => {
  it('la mitad, redondeando hacia arriba', () => {
    expect(metaDelDia(6)).toBe(3)
    expect(metaDelDia(5)).toBe(3) // no 2: el impar no debe abaratar el premio
    expect(metaDelDia(1)).toBe(1)
  })

  it('sin misiones no hay meta que alcanzar', () => {
    expect(metaDelDia(0)).toBe(0)
    expect(estadoDelJuego({ total: 0, hechas: 0 }).alcanzada).toBe(false)
  })
})

describe('estado del juego', () => {
  it('cerrado mientras falten misiones, y dice cuántas', () => {
    const e = estadoDelJuego({ total: 6, hechas: 1 })
    expect(e.disponible).toBe(false)
    expect(e.faltan).toBe(2)
  })

  it('se abre justo al llegar a la mitad', () => {
    expect(estadoDelJuego({ total: 6, hechas: 3 }).disponible).toBe(true)
    expect(estadoDelJuego({ total: 6, hechas: 3 }).faltan).toBe(0)
  })

  it('sigue alcanzada pero no disponible si ya se cobró hoy', () => {
    const e = estadoDelJuego({ total: 6, hechas: 6, yaCobrado: true })
    expect(e.alcanzada).toBe(true)
    expect(e.cobrado).toBe(true)
    expect(e.disponible).toBe(false)
  })

  it('no revienta sin argumentos', () => {
    expect(estadoDelJuego().disponible).toBe(false)
  })

  it('los globos son un número jugable', () => {
    expect(GLOBOS_DEL_JUEGO).toBeGreaterThan(2)
    expect(GLOBOS_DEL_JUEGO).toBeLessThan(12)
  })
})

describe('el siguiente premio', () => {
  const premios = [
    { id: 'a', title: 'Cuento', cost: 6 },
    { id: 'b', title: 'Parque', cost: 3 },
    { id: 'c', title: 'Peli', cost: 10 }
  ]

  it('el más barato que todavía no alcanza', () => {
    expect(siguientePremio(premios, 0).premio.title).toBe('Parque')
    expect(siguientePremio(premios, 4).premio.title).toBe('Cuento')
    expect(siguientePremio(premios, 4).alcanza).toBe(false)
  })

  it('si le llega justo, ya apunta al siguiente', () => {
    expect(siguientePremio(premios, 3).premio.title).toBe('Cuento')
  })

  it('si le llega para todos, enseña el mayor como alcanzado', () => {
    const s = siguientePremio(premios, 99)
    expect(s.premio.title).toBe('Peli')
    expect(s.alcanza).toBe(true)
  })

  it('sin premios no hay nada que enseñar', () => {
    expect(siguientePremio([], 5)).toBe(null)
  })
})

describe('el día que devuelve la base', () => {
  it('casa con el dayKey del cliente aunque lleve ceros', () => {
    expect(esDeHoy('2026-08-15', '2026-8-15')).toBe(true)
    expect(esDeHoy('2026-8-15', '2026-8-15')).toBe(true)
  })

  it('no casa con otro día', () => {
    expect(esDeHoy('2026-08-14', '2026-8-15')).toBe(false)
  })

  it('aguanta basura sin decir que sí', () => {
    for (const v of [null, undefined, '', 'ayer', '2026-08']) expect(esDeHoy(v, '2026-8-15')).toBe(false)
    expect(esDeHoy('2026-08-15', null)).toBe(false)
  })
})

describe('rotación de juegos', () => {
  it('el mismo día devuelve siempre el mismo juego', () => {
    const a = juegoDelDia('2026-8-15')
    const b = juegoDelDia('2026-8-15')
    expect(a.id).toBe(b.id)
  })

  it('días seguidos no repiten juego', () => {
    const ids = ['2026-8-15', '2026-8-16', '2026-8-17'].map((d) => juegoDelDia(d).id)
    expect(new Set(ids).size).toBe(3)
  })

  it('recorre los tres a lo largo de la semana', () => {
    const ids = Array.from({ length: 7 }, (_, i) => juegoDelDia(`2026-8-${15 + i}`).id)
    expect(new Set(ids)).toEqual(new Set(JUEGOS.map((j) => j.id)))
  })

  it('aguanta una fecha inválida sin quedarse sin juego', () => {
    expect(juegoDelDia('ayer')).toBeTruthy()
    expect(juegoDelDia(null)).toBeTruthy()
  })

  it('cada juego tiene lo que la pantalla necesita', () => {
    for (const j of JUEGOS) {
      expect(j.id && j.emoji && j.llamada && j.hecho).toBeTruthy()
    }
  })
})

describe('el día redondo', () => {
  it('solo con todas hechas', () => {
    expect(diaCompleto({ total: 5, hechas: 5 })).toBe(true)
    expect(diaCompleto({ total: 5, hechas: 4 })).toBe(false)
  })

  it('sin misiones no hay día redondo que celebrar', () => {
    expect(diaCompleto({ total: 0, hechas: 0 })).toBe(false)
    expect(diaCompleto()).toBe(false)
  })

  it('la clave de la fiesta separa por perfil y por día', () => {
    expect(claveFiesta('p1', '2026-8-15')).not.toBe(claveFiesta('p2', '2026-8-15'))
    expect(claveFiesta('p1', '2026-8-15')).not.toBe(claveFiesta('p1', '2026-8-16'))
  })
})
