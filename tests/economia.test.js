import { describe, it, expect } from 'vitest'
import {
  SUPUESTOS,
  monedasPorDia,
  xpPorDia,
  tasaDeReferencia,
  precioObjetivo,
  bandaDePrecio,
  metaObjetivo,
  diasParaPermitirse,
  diagnosticoEconomia,
  veredicto,
  techoDe,
  techoFamiliar
} from '../src/lib/economia'
import {
  CATALOGO_PREMIOS,
  NIVELES,
  MONEDAS_POR_ESTRELLA,
  estrellasDe,
  estrellasQueCuesta,
  premiosParaPeque,
  ordenarPorPrecio,
  leerOrdenTienda,
  alternarOrdenTienda,
  ORDEN_TIENDA,
  TECHO_PEQUE
} from '../src/lib/premios'
import { metaDelPlan } from '../src/lib/setup'
import { DEFAULTS_ROL } from '../src/lib/tareas'

// ------------------------------------------------------------------
// Estos tests son el guardián del equilibrio. Si alguien sube la XP de
// las misiones o baja el precio de un premio, aquí se ve antes de que la
// familia se encuentre debiendo una acampada cada semana.
// ------------------------------------------------------------------

describe('modelo de ingresos', () => {
  it('cada rol gana lo que dicen sus valores por defecto', () => {
    for (const rol of Object.keys(DEFAULTS_ROL)) {
      const esperado = SUPUESTOS.misionesActivas * DEFAULTS_ROL[rol].coins * SUPUESTOS.adherencia
      expect(monedasPorDia(rol)).toBeCloseTo(esperado, 5)
      expect(xpPorDia(rol)).toBeCloseTo(SUPUESTOS.misionesActivas * DEFAULTS_ROL[rol].xp * SUPUESTOS.adherencia, 5)
    }
  })

  it('un rol inventado no rompe el cálculo', () => {
    expect(monedasPorDia('gnomo')).toBe(0)
    expect(xpPorDia('gnomo')).toBe(0)
  })

  it('ningún rol se aleja más del doble de la tasa de referencia', () => {
    // Una sola tienda solo funciona si los tres ganan a ritmos parecidos.
    const ref = tasaDeReferencia()
    for (const rol of Object.keys(DEFAULTS_ROL)) {
      const suya = monedasPorDia(rol)
      expect(suya, rol).toBeGreaterThan(ref / 2)
      expect(suya, rol).toBeLessThan(ref * 2)
    }
  })
})

describe('los precios del catálogo respetan su banda', () => {
  for (const nivel of [1, 2, 3]) {
    it(`nivel ${nivel}`, () => {
      const [min, max] = bandaDePrecio(nivel)
      for (const p of CATALOGO_PREMIOS.filter((x) => x.tier === nivel)) {
        expect(p.cost, `${p.title} (${p.cost})`).toBeGreaterThanOrEqual(min)
        expect(p.cost, `${p.title} (${p.cost})`).toBeLessThanOrEqual(max)
      }
    })
  }

  it('la banda declarada en NIVELES cabe dentro de la que deriva el modelo', () => {
    // Igualdad exacta no vale desde que las cadencias son 15/30/45: con 30
    // y 45 días tan cerca, las bandas del modelo SE SOLAPAN (el suelo del
    // nivel 3 cae por debajo del techo del 2). Lo que hay que garantizar
    // es que la banda declarada no se salga de la del modelo, y que los
    // niveles no se pisen: el 3 nunca puede costar menos que el 2.
    for (const nivel of [1, 2, 3]) {
      const [lo, hi] = bandaDePrecio(nivel)
      const [dLo, dHi] = NIVELES[nivel].coste
      expect(dLo, `nivel ${nivel} suelo`).toBeGreaterThanOrEqual(lo)
      expect(dHi, `nivel ${nivel} techo`).toBeLessThanOrEqual(hi)
      expect(dLo).toBeLessThan(dHi)
    }
  })

  it('las bandas declaradas no se pisan entre niveles', () => {
    expect(NIVELES[2].coste[0]).toBeGreaterThan(NIVELES[1].coste[1])
    expect(NIVELES[3].coste[0]).toBeGreaterThan(NIVELES[2].coste[1])
  })

  it('cada nivel cae en su cadencia, ±50 %', () => {
    for (const nivel of [1, 2, 3]) {
      const precios = CATALOGO_PREMIOS.filter((p) => p.tier === nivel).map((p) => p.cost)
      const medio = precios.reduce((a, b) => a + b, 0) / precios.length
      const dias = diasParaPermitirse(medio, tasaDeReferencia())
      const objetivo = SUPUESTOS.cadencia[nivel]
      expect(dias, `nivel ${nivel}: ${dias.toFixed(1)} días, objetivo ${objetivo}`).toBeGreaterThan(objetivo * 0.5)
      expect(dias, `nivel ${nivel}: ${dias.toFixed(1)} días, objetivo ${objetivo}`).toBeLessThan(objetivo * 1.5)
    }
  })

  it('los niveles no se solapan: nivel 3 nunca cuesta menos que nivel 2', () => {
    const max = (n) => Math.max(...CATALOGO_PREMIOS.filter((p) => p.tier === n).map((p) => p.cost))
    const min = (n) => Math.min(...CATALOGO_PREMIOS.filter((p) => p.tier === n).map((p) => p.cost))
    expect(min(2)).toBeGreaterThan(max(1))
    expect(min(3)).toBeGreaterThan(max(2))
  })
})

describe('meta del gremio', () => {
  // La meta ya no es una constante: la calcula el setup con los roles de
  // la casa. Se comprueba sobre la familia de referencia del modelo.
  const metaInicial = metaDelPlan({ meta: 'peli' }, ['adulto', 'adulto', 'junior', 'peque'])

  it('la inicial se cierra en la cadencia prevista, ±40 %', () => {
    const objetivo = metaObjetivo()
    expect(metaInicial.target_xp).toBeGreaterThan(objetivo * 0.6)
    expect(metaInicial.target_xp).toBeLessThan(objetivo * 1.4)
  })

  it('no vuelve a los 600 XP de antes, que se cerraban en cuatro días', () => {
    const porDia = ['adulto', 'adulto', 'junior', 'peque'].reduce((t, r) => t + xpPorDia(r), 0)
    expect(metaInicial.target_xp / porDia).toBeGreaterThan(8)
  })
})

describe('diagnóstico en vivo', () => {
  const data = {
    profiles: [
      { id: 'p1', role: 'junior', active: true },
      { id: 'p2', role: 'peque', active: true },
      { id: 'p3', role: 'adulto', active: false }
    ],
    challenges: [
      { id: 'c1', profile_id: 'p1', active: true, xp: 15, coins: 8, frequency: 'diario' },
      { id: 'c2', profile_id: 'p1', active: true, xp: 30, coins: 15, frequency: 'semanal' },
      { id: 'c3', profile_id: 'p2', active: true, xp: 10, coins: 5, frequency: 'diario' },
      { id: 'c4', profile_id: 'p1', active: false, xp: 99, coins: 99, frequency: 'diario' },
      { id: 'c5', profile_id: 'p1', active: true, xp: 50, coins: 50, frequency: 'unico' }
    ],
    rewards: [
      { id: 'r1', tier: 1, cost: 400, active: true },
      { id: 'r2', tier: 3, cost: 600, active: true },
      { id: 'r3', tier: 1, cost: 999, active: false },
      // Andamio: por debajo del suelo del modelo, no es un premio de nivel 1.
      { id: 'r4', tier: 1, cost: 40, active: true }
    ],
    goal: { target_xp: 1600 }
  }

  it('ignora perfiles retirados y misiones pausadas', () => {
    const d = diagnosticoEconomia(data)
    expect(d.porPersona.map((x) => x.perfil.id)).toEqual(['p1', 'p2'])
    expect(d.porPersona[0].misiones).toBe(3) // c1, c2, c5; no la pausada
  })

  it('lo único no cuenta como ingreso diario', () => {
    const d = diagnosticoEconomia(data)
    // junior: 8 diario + 15/7 semanal = 10,14 · adherencia 0,6 = 6,09
    expect(d.porPersona[0].monedasDia).toBeCloseTo((8 + 15 / 7) * 0.6, 2)
  })

  it('solo mira los premios activos', () => {
    const d = diagnosticoEconomia(data)
    expect(d.niveles.find((n) => n.nivel === 1).premios).toBe(1)
    expect(d.niveles.find((n) => n.nivel === 1).precioMedio).toBe(400)
  })

  it('y solo los que están dentro del modelo', () => {
    // El de 40 monedas es andamio —de la peque o de arranque— y no se
    // promedia con los de verdad: mezclarlos daba un nivel 1 de 220
    // monedas y un aviso de «se consigue demasiado rápido» sobre un
    // premio que cuesta 400.
    const d = diagnosticoEconomia(data)
    expect(d.fueraDelModelo).toBe(1)
  })

  it('un nivel sin premios no rompe nada', () => {
    const d = diagnosticoEconomia(data)
    const nivel2 = d.niveles.find((n) => n.nivel === 2)
    expect(nivel2.premios).toBe(0)
    expect(nivel2.precioMedio).toBe(null)
    expect(nivel2.diasMin).toBe(null)
  })

  it('aguanta una familia vacía', () => {
    expect(() => diagnosticoEconomia({})).not.toThrow()
    expect(diagnosticoEconomia({}).porPersona).toEqual([])
  })
})

describe('veredicto', () => {
  it('avisa cuando algo va demasiado rápido o demasiado lento', () => {
    expect(veredicto(0.5, 7).estado).toBe('rapido')
    expect(veredicto(7, 7).estado).toBe('ok')
    expect(veredicto(30, 7).estado).toBe('lento')
    expect(veredicto(null, 7).estado).toBe('sin_datos')
    expect(veredicto(Infinity, 7).estado).toBe('sin_datos')
  })
})


// ------------------------------------------------------------------
// La tienda de la peque: monedas dibujadas como estrellas, sin números.
// ------------------------------------------------------------------

describe('estrellas de la peque', () => {
  it('una estrella es una misión suya', () => {
    expect(MONEDAS_POR_ESTRELLA).toBe(5)
    expect(estrellasDe(0)).toBe(0)
    expect(estrellasDe(5)).toBe(1)
    expect(estrellasDe(40)).toBe(8)
  })

  it('nunca enseña estrellas de más: lo que sobra se guarda, no se redondea', () => {
    // Si mostrara 2 con 9 monedas y un premio costara 2, pediría algo que
    // no puede pagar y el servidor lo rechazaría. Se redondea hacia abajo.
    expect(estrellasDe(9)).toBe(1)
    expect(estrellasDe(14)).toBe(2)
  })

  it('aguanta valores ausentes', () => {
    expect(estrellasDe(null)).toBe(0)
    expect(estrellasDe(undefined)).toBe(0)
  })

  it('todo premio cuesta al menos una estrella', () => {
    expect(estrellasQueCuesta(28)).toBe(6)
    expect(estrellasQueCuesta(40)).toBe(8)
    expect(estrellasQueCuesta(1)).toBe(1)
    expect(estrellasQueCuesta(0)).toBe(1)
  })

  it('solo se le enseña lo que puede alcanzar, de más barato a más caro', () => {
    const rewards = [
      { id: 'a', tier: 3, cost: 900, active: true },
      { id: 'b', tier: 1, cost: 55, active: true },
      { id: 'c', tier: 1, cost: 35, active: true },
      { id: 'd', tier: 1, cost: 40, active: false },
      { id: 'e', tier: 2, cost: 540, active: true }
    ]
    expect(premiosParaPeque(rewards).map((p) => p.id)).toEqual(['c', 'b'])
  })

  it('el nivel ya no decide: lo que decide es si le queda cerca', () => {
    // Un premio barato SIN nivel sí le sale, porque puede pagarlo. Antes
    // se le escondía por no llevar etiqueta, que es una razón burocrática.
    expect(premiosParaPeque([{ id: 'x', cost: 30, active: true }]).map((p) => p.id)).toEqual(['x'])
    // Y uno de nivel 1 carísimo NO, aunque la etiqueta diga que es suyo.
    expect(premiosParaPeque([{ id: 'y', cost: 270, tier: 1, active: true }])).toEqual([])
  })

  it('sin premios no rompe', () => {
    expect(premiosParaPeque()).toEqual([])
    expect(premiosParaPeque([])).toEqual([])
  })

  it('lo que se le enseña le cae en pocos días, que es lo que aguanta a los tres años', () => {
    // Sus misiones dan 5 monedas; con 5 activas y 60 % de adherencia son
    // 15 al día, o sea 3 estrellas diarias. Ella NO va por niveles: su
    // tienda filtra por precio, porque desde que las cadencias se
    // espaciaron a 15/30/45 días el nivel 1 cuesta ~270 y le quedaría a
    // dieciocho días de distancia.
    const estrellasPorDia = (SUPUESTOS.misionesActivas * 5 * SUPUESTOS.adherencia) / MONEDAS_POR_ESTRELLA
    const dias = estrellasQueCuesta(TECHO_PEQUE) / estrellasPorDia
    expect(dias, `${dias.toFixed(1)} días`).toBeLessThan(5)
    expect(dias).toBeGreaterThan(1)
  })

  it('su tienda deja fuera los premios de la familia, que le quedan lejísimos', () => {
    const suyos = premiosParaPeque([
      { id: 'a', cost: 40, active: true, tier: 1 },
      { id: 'b', cost: 270, active: true, tier: 1 },
      { id: 'c', cost: 540, active: true, tier: 2 }
    ])
    expect(suyos.map((p) => p.id)).toEqual(['a'])
  })
})

// ------------------------------------------------------------------
// Los techos no los usa ninguna pantalla: son el cálculo con el que se
// dimensionó la meta del gremio. Un modelo que nadie ejecuta se pudre en
// silencio —cambia un tope, cambia un rol, y nadie se entera—, así que
// aquí quedan fijadas sus dos propiedades estructurales. Si algún día se
// necesitan para poner una meta, se sabrá que siguen diciendo la verdad.
// ------------------------------------------------------------------
describe('techos de producción', () => {
  it('lo esperado nunca pasa del máximo, que es el sentido de tener los dos', () => {
    for (const rol of ['adulto', 'junior', 'peque']) {
      const t = techoDe(rol)
      expect(t.esperado.xpDia).toBeLessThan(t.maximo.xpDia)
      expect(t.esperado.monedasDia).toBeLessThan(t.maximo.monedasDia)
    }
  })

  it('un rol que no existe no inventa un techo', () => {
    expect(techoDe('perro')).toBe(null)
  })

  it('el techo familiar es la suma de sus roles, no una estimación aparte', () => {
    const familia = techoFamiliar(['adulto', 'junior'])
    const suma = techoDe('adulto').maximo.xpDia + techoDe('junior').maximo.xpDia
    expect(familia.maximo.xpDia).toBeCloseTo(suma, 1)
  })
})

// ------------------------------------------------------------------
// El orden de la tienda (2.15.0). Los premios llegaban por `created_at`,
// que para quien mira la tienda es ningún orden: los precios salían
// salteados y comparar «¿qué me llega antes?» obligaba a leer la lista
// entera.
// ------------------------------------------------------------------
describe('el orden de la tienda', () => {
  const TIENDA = [
    { id: 'a', title: 'Cine', cost: 900, active: true },
    { id: 'b', title: 'Helado', cost: 325, active: true },
    { id: 'c', title: 'Peli', cost: 480, active: true },
    { id: 'd', title: 'Bici', cost: 1620, active: true }
  ]

  function almacenFalso(inicial = {}) {
    const datos = { ...inicial }
    return {
      getItem: (k) => (k in datos ? datos[k] : null),
      setItem: (k, v) => { datos[k] = String(v) },
      ver: () => ({ ...datos })
    }
  }

  it('por defecto, lo más barato delante: es lo único accionable los primeros días', () => {
    expect(ordenarPorPrecio(TIENDA).map((p) => p.id)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('del revés cuando se pide', () => {
    expect(ordenarPorPrecio(TIENDA, ORDEN_TIENDA.CARO).map((p) => p.id)).toEqual(['d', 'a', 'c', 'b'])
  })

  it('no toca la lista que recibe: `data.rewards` es estado compartido', () => {
    const original = [...TIENDA]
    ordenarPorPrecio(TIENDA, ORDEN_TIENDA.CARO)
    expect(TIENDA).toEqual(original)
  })

  // Dos premios del mismo precio que se intercambian el sitio al invertir
  // el orden se leen como un fallo, no como un orden.
  it('el empate se rompe por título y siempre en el mismo sentido', () => {
    const empate = [
      { id: 'z', title: 'Zoo', cost: 480 },
      { id: 'm', title: 'Museo', cost: 480 },
      { id: 'c', title: 'Cena', cost: 480 }
    ]
    expect(ordenarPorPrecio(empate).map((p) => p.id)).toEqual(['c', 'm', 'z'])
    expect(ordenarPorPrecio(empate, ORDEN_TIENDA.CARO).map((p) => p.id)).toEqual(['c', 'm', 'z'])
  })

  it('sin premios, o con uno, no rompe', () => {
    expect(ordenarPorPrecio()).toEqual([])
    expect(ordenarPorPrecio([{ id: 'x', title: 'Solo', cost: 10 }]).map((p) => p.id)).toEqual(['x'])
  })

  it('la preferencia se guarda por dispositivo y arranca en lo barato', () => {
    const almacen = almacenFalso()
    expect(leerOrdenTienda(almacen)).toBe(ORDEN_TIENDA.BARATO)

    expect(alternarOrdenTienda(ORDEN_TIENDA.BARATO, almacen)).toBe(ORDEN_TIENDA.CARO)
    expect(leerOrdenTienda(almacen)).toBe(ORDEN_TIENDA.CARO)

    expect(alternarOrdenTienda(ORDEN_TIENDA.CARO, almacen)).toBe(ORDEN_TIENDA.BARATO)
    expect(leerOrdenTienda(almacen)).toBe(ORDEN_TIENDA.BARATO)
  })

  it('un valor raro guardado no deja la tienda en un orden imposible', () => {
    expect(leerOrdenTienda(almacenFalso({ gremio_orden_tienda: 'lo-que-sea' }))).toBe(ORDEN_TIENDA.BARATO)
  })

  // Safari en privado tira al escribir. Perder la preferencia es
  // aceptable; que la tienda no dibuje, no.
  it('un almacén que revienta no tumba la tienda', () => {
    const roto = {
      getItem: () => { throw new Error('sin almacenamiento') },
      setItem: () => { throw new Error('sin almacenamiento') }
    }
    expect(leerOrdenTienda(roto)).toBe(ORDEN_TIENDA.BARATO)
    expect(alternarOrdenTienda(ORDEN_TIENDA.BARATO, roto)).toBe(ORDEN_TIENDA.CARO)
  })
})
