import { describe, it, expect } from 'vitest'
import {
  PREMIOS_DE_ARRANQUE,
  TECHO_PEQUE,
  NIVELES,
  CATALOGO_PREMIOS,
  fueraDelModelo,
  premiosDeArranqueQueFaltan,
  premiosParaPeque,
  premiosParaMayores
} from '../src/lib/premios'
import { monedasPorDia, diasParaPermitirse, diagnosticoEconomia } from '../src/lib/economia'
import { premiosQueSuben } from '../src/lib/temporadas'

const SUELO = NIVELES[1].coste[0]

describe('premios de arranque: dónde caen', () => {
  it('todos están por encima del techo de la peque', () => {
    // Si cayeran por debajo, aparecerían en la tienda de la peque, que
    // filtra por precio: a ella un premio de 200 monedas le costaría
    // trece días y su tienda dejaría de ser alcanzable.
    for (const p of PREMIOS_DE_ARRANQUE) {
      expect(p.cost, `${p.title} (${p.cost})`).toBeGreaterThan(TECHO_PEQUE)
    }
  })

  it('todos están por debajo del suelo del modelo', () => {
    // Son andamio, no economía: si tocaran la banda del nivel 1
    // competirían con los premios de verdad en vez de dar el primer
    // empujón.
    for (const p of PREMIOS_DE_ARRANQUE) {
      expect(p.cost, `${p.title} (${p.cost})`).toBeLessThan(SUELO)
    }
  })

  it('ninguno cuesta más de 250 monedas', () => {
    // La cifra que pidió la familia, escrita como test para que nadie la
    // suba sin darse cuenta.
    for (const p of PREMIOS_DE_ARRANQUE) {
      expect(p.cost, p.title).toBeLessThanOrEqual(250)
    }
  })

  it('el primero cae en menos de tres días para la junior', () => {
    const barato = Math.min(...PREMIOS_DE_ARRANQUE.map((p) => p.cost))
    const dias = diasParaPermitirse(barato, monedasPorDia('junior'))
    expect(dias, `${barato} monedas = ${dias.toFixed(1)} días`).toBeLessThan(3)
  })

  it('ninguno tarda más de una semana para la junior', () => {
    // El límite del andamio: pasada una semana deja de ser «los primeros
    // días» y el premio se convierte en decoración.
    for (const p of PREMIOS_DE_ARRANQUE) {
      const dias = diasParaPermitirse(p.cost, monedasPorDia('junior'))
      expect(dias, `${p.title}: ${dias.toFixed(1)} días`).toBeLessThan(7)
    }
  })

  it('la rampa no deja un salto al nivel 1', () => {
    // Entre el más caro del arranque y el más barato del catálogo no
    // puede haber un abismo: si al terminar el andamio lo siguiente
    // cuesta el triple, el andamio no ha servido de nada.
    const caro = Math.max(...PREMIOS_DE_ARRANQUE.map((p) => p.cost))
    const primero = Math.min(...CATALOGO_PREMIOS.map((p) => p.cost))
    expect(primero / caro).toBeLessThan(2)
  })

  it('no repiten título con el catálogo', () => {
    const delCatalogo = new Set(CATALOGO_PREMIOS.map((p) => p.title))
    for (const p of PREMIOS_DE_ARRANQUE) {
      expect(delCatalogo.has(p.title), p.title).toBe(false)
    }
  })

  it('son decisiones, no cosas: ninguno es dinero, chuchería ni pantalla', () => {
    const prohibido = /dinero|euro|chuche|caramelo|golosina|pantalla|tablet|móvil|videojuego|consola/i
    for (const p of PREMIOS_DE_ARRANQUE) {
      expect(prohibido.test(p.title), p.title).toBe(false)
    }
  })
})

describe('premios de arranque: en qué tienda salen', () => {
  const tienda = PREMIOS_DE_ARRANQUE.map((p, i) => ({ ...p, id: 'a' + i, active: true }))

  it('salen en la de los mayores', () => {
    expect(premiosParaMayores(tienda)).toHaveLength(PREMIOS_DE_ARRANQUE.length)
  })

  it('no salen en la de la peque', () => {
    expect(premiosParaPeque(tienda)).toEqual([])
  })
})

describe('fueraDelModelo', () => {
  it('deja fuera lo que cuesta menos que el suelo del nivel 1', () => {
    expect(fueraDelModelo({ cost: 15 })).toBe(true)
    expect(fueraDelModelo({ cost: 240 })).toBe(true)
    expect(fueraDelModelo({ cost: SUELO - 1 })).toBe(true)
  })

  it('deja dentro lo que llega a la banda', () => {
    expect(fueraDelModelo({ cost: SUELO })).toBe(false)
    expect(fueraDelModelo({ cost: 1200 })).toBe(false)
  })
})

describe('premiosDeArranqueQueFaltan', () => {
  it('con la tienda vacía faltan todos', () => {
    expect(premiosDeArranqueQueFaltan([])).toHaveLength(PREMIOS_DE_ARRANQUE.length)
  })

  it('no propone uno que ya está, aunque esté pausado', () => {
    // Volver a añadirlo crearía un duplicado y el adulto tendría dos
    // filas iguales, una encendida y otra apagada.
    const puesto = PREMIOS_DE_ARRANQUE[0]
    const faltan = premiosDeArranqueQueFaltan([{ ...puesto, id: 'x', active: false }])
    expect(faltan).toHaveLength(PREMIOS_DE_ARRANQUE.length - 1)
    expect(faltan.map((p) => p.title)).not.toContain(puesto.title)
  })

  it('aguanta una tienda sin nada que ver', () => {
    expect(premiosDeArranqueQueFaltan([{ id: 'z', title: 'Bolera', cost: 1200 }]))
      .toHaveLength(PREMIOS_DE_ARRANQUE.length)
  })
})

describe('el andamio no falsea el diagnóstico de la economía', () => {
  const perfiles = [{ id: 'j', name: 'Junior', role: 'junior', active: true }]
  const challenges = Array.from({ length: 8 }, (_, i) => ({
    id: 'c' + i, profile_id: 'j', frequency: 'diario', xp: 15, coins: 8, active: true
  }))

  it('un premio de arranque no baja el precio medio del nivel 1', () => {
    const soloModelo = diagnosticoEconomia({
      profiles: perfiles,
      challenges,
      rewards: [{ id: 'r1', cost: 400, tier: 1, active: true }]
    })
    const conAndamio = diagnosticoEconomia({
      profiles: perfiles,
      challenges,
      rewards: [
        { id: 'r1', cost: 400, tier: 1, active: true },
        { id: 'r2', cost: 100, tier: 1, active: true }
      ]
    })
    const nivel1 = (d) => d.niveles.find((n) => n.nivel === 1)
    expect(nivel1(conAndamio).precioMedio).toBe(nivel1(soloModelo).precioMedio)
    expect(nivel1(conAndamio).premios).toBe(1)
  })

  it('pero los cuenta aparte, no los esconde', () => {
    const d = diagnosticoEconomia({
      profiles: perfiles,
      challenges,
      rewards: [
        { id: 'r1', cost: 400, tier: 1, active: true },
        { id: 'r2', cost: 100, tier: 1, active: true },
        { id: 'r3', cost: 20, tier: 1, active: true }
      ]
    })
    expect(d.fueraDelModelo).toBe(2)
  })

  it('sin premios de arranque el diagnóstico no cambia', () => {
    const d = diagnosticoEconomia({
      profiles: perfiles,
      challenges,
      rewards: [{ id: 'r1', cost: 400, tier: 1, active: true }]
    })
    expect(d.fueraDelModelo).toBe(0)
  })
})

describe('la subida de temporada no toca el andamio', () => {
  const tienda = [
    { id: 'a', title: 'cuento peque', cost: 15, active: true },
    { id: 'b', title: 'arranque', cost: 130, active: true },
    { id: 'c', title: 'cocinar', cost: 690, active: true }
  ]

  it('solo sube lo que está dentro del modelo', () => {
    expect(premiosQueSuben(tienda, SUELO).map((r) => r.title)).toEqual(['cocinar'])
  })

  it('un premio de arranque encarecido dejaría de ser alcanzable', () => {
    // La razón de excluirlo, escrita: a la tercera temporada un premio de
    // 130 costaría 220 y el andamio ya no llegaría en tres días.
    const dias = diasParaPermitirse(130 * 1.3 * 1.3, monedasPorDia('junior'))
    expect(dias).toBeGreaterThan(5)
  })
})
