import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  TALIS, BOLSA, CASA, LEMA, talis, conFicha,
  FRAGMENTOS, fragmentosDesbloqueados, ultimoFragmento,
  progresoDeTalis, queFaltaPara, fragmentosNuevos
} from '../src/lib/talis'

const YO = { id: 'p1' }
const OTRA = 'p2'

describe('el nombre', () => {
  it('no pluraliza: uno y veinte se escriben igual', () => {
    expect(talis(1)).toBe('1 Talis')
    expect(talis(20)).toBe('20 Talis')
    expect(talis(0)).toBe('0 Talis')
  })

  it('aguanta basura sin escribir NaN en la pantalla de nadie', () => {
    for (const v of [null, undefined, '', NaN]) {
      expect(talis(v), String(v)).toBe('0 Talis')
    }
  })

  it('la ficha va delante, no detrás', () => {
    expect(conFicha(45)).toBe('🪙 45 Talis')
  })

  it('el vocabulario del gremio es el del canon', () => {
    expect(TALIS).toBe('Talis')
    expect(BOLSA).toBe('Bolsa de Talis')
    expect(CASA).toBe('Casa de Recompensas')
    expect(LEMA).toBe('Tu esfuerzo deja marca.')
  })
})

describe('los fragmentos de la historia', () => {
  it('con cero Talis no se ha abierto ninguno', () => {
    expect(fragmentosDesbloqueados({ ganados: 0 })).toEqual([])
    expect(ultimoFragmento({ ganados: 0 })).toBe(null)
  })

  it('el primero llega con el primer Talis, no con el décimo', () => {
    expect(ultimoFragmento({ ganados: 1 }).id).toBe('primer-talis')
  })

  it('se abren en orden y sin saltarse ninguno', () => {
    const abiertos = fragmentosDesbloqueados({ ganados: 500, insignias: 1 })
    expect(abiertos.map((f) => f.id)).toEqual(FRAGMENTOS.map((f) => f.id))
  })

  it('los umbrales van sobre lo GANADO, no sobre el saldo', () => {
    // Es la decisión que defiende este test: si fueran sobre el saldo,
    // gastar en la tienda borraría la historia, que es justo lo contrario
    // de lo que estos textos dicen.
    const gastado = { ganados: 600, insignias: 0 }
    expect(ultimoFragmento(gastado).id).toBe('la-bolsa')
  })

  it('«La obra» no se abre sin una insignia, por muchos Talis que haya', () => {
    // Explica por qué las insignias no se compran. Contárselo a quien no
    // tiene ninguna es contestar una pregunta que nadie se ha hecho.
    expect(ultimoFragmento({ ganados: 99999, insignias: 0 }).id).toBe('la-bolsa')
    expect(ultimoFragmento({ ganados: 99999, insignias: 1 }).id).toBe('la-obra')
  })

  it('los umbrales no decrecen: uno posterior nunca pide menos', () => {
    for (let i = 1; i < FRAGMENTOS.length; i++) {
      expect(FRAGMENTOS[i].ganados).toBeGreaterThanOrEqual(FRAGMENTOS[i - 1].ganados)
    }
  })

  it('sin argumentos no revienta', () => {
    expect(fragmentosDesbloqueados()).toEqual([])
  })
})

describe('la frontera entre el relato y el esquema', () => {
  // Talis es el nombre narrativo; `coins` es la columna. Si alguien
  // «arregla» esto renombrando la base, hay que enterarse aquí y no en
  // producción: la migración tendría que ir sincronizada con el cliente.
  it('el esquema sigue hablando de coins', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
    expect(schema).toMatch(/coins integer/)
    expect(schema).not.toMatch(/\btalis\b/i)
  })

  it('el código de retorno de Postgres tampoco se renombró', () => {
    const acciones = readFileSync(new URL('../src/lib/acciones.js', import.meta.url), 'utf8')
    expect(acciones).toContain("'sin_monedas'")
  })
})

describe('los Talis ganados en la vida de alguien', () => {
  const datos = {
    completions: [
      { profile_id: 'p1', status: 'aprobado', coins: 40 },
      { profile_id: 'p1', status: 'aprobado', coins: 10 },
      { profile_id: 'p1', status: 'pendiente', coins: 99 },
      { profile_id: 'p1', status: 'rechazado', coins: 99 },
      { profile_id: OTRA, status: 'aprobado', coins: 500 }
    ],
    bonuses: [
      { profile_id: 'p1', coins: 5, tipo: 'globos' },
      { profile_id: 'p1', coins: 20, tipo: 'manual' },
      { profile_id: OTRA, coins: 700 }
    ],
    badges: [{ profile_id: 'p1' }, { profile_id: 'p1' }, { profile_id: OTRA }]
  }

  it('suma misiones aprobadas y extras, y nada de lo ajeno', () => {
    expect(progresoDeTalis(YO, datos)).toEqual({ ganados: 75, insignias: 2 })
  })

  it('lo pendiente y lo rechazado no cuenta: todavía no se ha ganado', () => {
    const soloPendientes = { completions: [{ profile_id: 'p1', status: 'pendiente', coins: 500 }] }
    expect(progresoDeTalis(YO, soloPendientes).ganados).toBe(0)
  })

  it('gastar en la tienda NO baja lo ganado', () => {
    // La decisión que defiende este test. Los canjes viven en
    // `redemptions` y aquí no se miran a propósito: si restaran, comprar
    // un premio borraría fragmentos de la historia ya descubiertos.
    const conCanjes = { ...datos, redemptions: [{ profile_id: 'p1', cost: 70, status: 'entregado' }] }
    expect(progresoDeTalis(YO, conCanjes).ganados).toBe(75)
  })

  it('sin datos no revienta', () => {
    expect(progresoDeTalis(YO)).toEqual({ ganados: 0, insignias: 0 })
    expect(progresoDeTalis(undefined, datos).ganados).toBe(0)
  })
})

describe('qué falta para abrir un fragmento', () => {
  it('nada, si ya está abierto', () => {
    expect(queFaltaPara(FRAGMENTOS[0], { ganados: 5 })).toBe(null)
  })

  it('lo dice en Talis, y respeta la mayúscula del canon', () => {
    const frase = queFaltaPara(FRAGMENTOS[1], { ganados: 0 })
    expect(frase).toBe('Te faltan 100 Talis')
    expect(frase).toContain('Talis')
  })

  it('concuerda el verbo cuando falta uno solo', () => {
    expect(queFaltaPara(FRAGMENTOS[1], { ganados: 99 })).toBe('Te falta 1 Talis')
  })

  it('con los Talis puestos pero sin insignia, lo que falta es la insignia', () => {
    expect(queFaltaPara(FRAGMENTOS[3], { ganados: 500, insignias: 0 })).toBe('Te falta una insignia')
  })

  it('y si faltan las dos cosas, las nombra las dos', () => {
    expect(queFaltaPara(FRAGMENTOS[3], { ganados: 0, insignias: 0 }))
      .toBe('Te faltan 500 Talis y una insignia')
  })

  it('todo fragmento cerrado sabe decir qué le falta', () => {
    // Un candado sin explicación se lee como un fallo de la app.
    for (const f of FRAGMENTOS) {
      expect(queFaltaPara(f, { ganados: 0, insignias: 0 }), f.id).toBeTruthy()
    }
  })
})

describe('los fragmentos sin leer', () => {
  it('recién abierto y sin leer nada, sale', () => {
    expect(fragmentosNuevos({ ganados: 1 }, []).map((f) => f.id)).toEqual(['primer-talis'])
  })

  it('lo ya leído no vuelve a salir', () => {
    expect(fragmentosNuevos({ ganados: 1 }, ['primer-talis'])).toEqual([])
  })

  it('un fragmento cerrado no está sin leer: no existe todavía', () => {
    expect(fragmentosNuevos({ ganados: 0 }, [])).toEqual([])
  })

  it('leer el primero no marca los que se abren después', () => {
    const ids = fragmentosNuevos({ ganados: 100 }, ['primer-talis']).map((f) => f.id)
    expect(ids).toEqual(['el-valor'])
  })
})
