import { describe, it, expect } from 'vitest'
import {
  temporadaActual,
  rangoDeGremio,
  precioEnTemporada,
  temporadaQueDesbloquea,
  estaDesbloqueado,
  estadoDeTemporada,
  RANGOS_GREMIO,
  SUBIDA_POR_TEMPORADA,
  precioSiguienteTemporada,
  premiosQueSuben
} from '../src/lib/temporadas'

const meta = (achieved, target_xp = 1000) => ({ achieved, target_xp })

describe('en qué temporada va el gremio', () => {
  it('sin metas logradas, la primera', () => {
    expect(temporadaActual([])).toBe(1)
    expect(temporadaActual([meta(false)])).toBe(1)
  })

  it('cada meta lograda abre la siguiente', () => {
    expect(temporadaActual([meta(true)])).toBe(2)
    expect(temporadaActual([meta(true), meta(true), meta(false)])).toBe(3)
  })

  it('se deriva y no se guarda: no puede desincronizarse', () => {
    // Mismo dato de entrada, mismo resultado, sin estado que mantener.
    const metas = [meta(true), meta(true)]
    expect(temporadaActual(metas)).toBe(temporadaActual([...metas]))
  })
})

describe('rango del gremio', () => {
  it('cada temporada tiene el suyo', () => {
    expect(rangoDeGremio(1).nombre).toMatch(/novato/i)
    expect(rangoDeGremio(5).nombre).toMatch(/legendario/i)
  })

  it('pasada la última, se queda en la última en vez de romperse', () => {
    expect(rangoDeGremio(99)).toEqual(RANGOS_GREMIO[RANGOS_GREMIO.length - 1])
  })

  it('aguanta basura sin dejar al gremio sin rango', () => {
    for (const v of [0, -3, null, undefined, NaN]) expect(rangoDeGremio(v).temporada).toBe(1)
  })
})

describe('los precios suben con la temporada', () => {
  it('en la primera se paga el precio base', () => {
    expect(precioEnTemporada(400, 1)).toBe(400)
  })

  it('un 30 % compuesto por temporada', () => {
    expect(precioEnTemporada(400, 2)).toBe(520)
    expect(precioEnTemporada(400, 3)).toBe(675)
  })

  it('la subida se nota pero no dispara: la cuarta no llega al triple', () => {
    const r = precioEnTemporada(400, 4) / 400
    expect(r).toBeGreaterThan(2)
    expect(r).toBeLessThan(3)
  })

  it('siempre múltiplos de cinco, que es como se leen los precios', () => {
    for (const t of [1, 2, 3, 4, 5]) expect(precioEnTemporada(437, t) % 5).toBe(0)
  })
})

describe('premios que se desbloquean', () => {
  it('los baratos están desde el principio', () => {
    expect(temporadaQueDesbloquea(1)).toBe(1)
    expect(temporadaQueDesbloquea(2)).toBe(1)
  })

  it('los de nivel 3 llegan en la segunda temporada', () => {
    expect(temporadaQueDesbloquea(3)).toBe(2)
    expect(estaDesbloqueado({ tier: 3 }, 1)).toBe(false)
    expect(estaDesbloqueado({ tier: 3 }, 2)).toBe(true)
  })

  it('cada nivel nuevo pide una temporada más', () => {
    expect(temporadaQueDesbloquea(4)).toBe(3)
    expect(temporadaQueDesbloquea(5)).toBe(4)
  })
})

describe('el resumen de temporada', () => {
  it('enseña el acumulado histórico, que es lo que la barra no dice', () => {
    const e = estadoDeTemporada([meta(true, 8000), meta(true, 10000), meta(false, 12000)])
    expect(e.temporada).toBe(3)
    expect(e.metasLogradas).toBe(2)
    expect(e.xpHistorica).toBe(18000)
  })

  it('dice cuánto han subido los precios acumulado', () => {
    expect(estadoDeTemporada([]).subidaDePrecios).toBe(0)
    expect(estadoDeTemporada([meta(true)]).subidaDePrecios).toBe(30)
  })

  it('en la última temporada ya no hay siguiente que prometer', () => {
    const metas = Array.from({ length: RANGOS_GREMIO.length }, () => meta(true))
    expect(estadoDeTemporada(metas).siguiente).toBe(null)
  })

  it('sin metas no rompe', () => {
    expect(estadoDeTemporada().temporada).toBe(1)
    expect(SUBIDA_POR_TEMPORADA).toBeGreaterThan(0.2)
  })
})

describe('la subida de precios de la temporada nueva', () => {
  it('sube un 30 % y redondea a cinco', () => {
    expect(precioSiguienteTemporada(100)).toBe(130)
    expect(precioSiguienteTemporada(105)).toBe(135)
    expect(precioSiguienteTemporada(600)).toBe(780)
  })

  it('compone temporada a temporada, sin precio base guardado', () => {
    // Aplicarla dos veces tiene que dar lo mismo que el modelo dice para
    // la temporada 3, salvo el redondeo a cinco de cada paso.
    const dosPasos = precioSiguienteTemporada(precioSiguienteTemporada(1000))
    expect(Math.abs(dosPasos - precioEnTemporada(1000, 3))).toBeLessThanOrEqual(5)
  })

  it('el andamio no sube: ni el de la peque ni el de arranque', () => {
    // El parámetro dejó de ser el techo de la peque (72, excluyente) y
    // pasó a ser el SUELO del modelo (324, incluyente) cuando entraron los
    // premios de arranque: estaban en el hueco entre los dos y subían de
    // precio hasta dejar de llegar en tres días, que es lo único que los
    // justifica. Lo que defiende sigue siendo lo mismo: encarecer un
    // premio que se compra por distancia y no por temporada no añade
    // dificultad, quita el premio.
    const tienda = [
      { title: 'cuento', cost: 28, active: true },
      { title: 'peli', cost: 72, active: true },
      { title: 'arranque', cost: 130, active: true },
      { title: 'en la banda', cost: 324, active: true },
      { title: 'cocinar', cost: 690, active: true },
      { title: 'retirado', cost: 500, active: false }
    ]
    expect(premiosQueSuben(tienda, 324).map((r) => r.title)).toEqual(['en la banda', 'cocinar'])
  })

  it('sin suelo, suben todos los activos', () => {
    const tienda = [{ cost: 10, active: true }, { cost: 20, active: false }]
    expect(premiosQueSuben(tienda, 0)).toHaveLength(1)
  })
})
