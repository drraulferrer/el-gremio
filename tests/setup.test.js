import { describe, it, expect } from 'vitest'
import {
  PREGUNTAS, RESPUESTAS_POR_DEFECTO, preguntaResuelta, alternar,
  cuantasMisiones, misionesParaRol, premiosDelPlan,
  metaDelPlan, planDeArranque, TITULOS_DE_UNA_CASA, PREMIOS_DE_LA_PEQUE,
  PREMIOS_EN_LA_TIENDA, PREMIOS_POR_TIPO
} from '../src/lib/setup'
import { TECHO_PEQUE, CATALOGO_PREMIOS } from '../src/lib/premios'
import { metaObjetivo } from '../src/lib/economia'
import { IDS_HABILIDAD } from '../src/lib/habilidades'

// ------------------------------------------------------------------
// El setup de arranque.
//
// Lo que defienden estos tests es que las respuestas SIRVAN de algo. El
// fallo que se quiere evitar no es una excepción: es que la familia
// conteste cuatro preguntas y reciba exactamente el mismo tablero que
// habría recibido sin contestarlas, que es la forma más rápida de que un
// setup se perciba como un trámite.
// ------------------------------------------------------------------

const MIEMBROS = [
  { name: 'Ana', role: 'adulto' },
  { name: 'Bruno', role: 'adulto' },
  { name: 'Cloe', role: 'junior' },
  { name: 'Dani', role: 'peque' }
]

describe('las preguntas', () => {
  it('son cuatro y todas llevan su porqué', () => {
    // El porqué no es decoración: es lo que sustituye a las once
    // diapositivas del tutorial viejo.
    expect(PREGUNTAS).toHaveLength(4)
    for (const p of PREGUNTAS) {
      expect(p.porque.length).toBeGreaterThan(40)
      expect(p.opciones.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('las opciones de foco apuntan a habilidades que existen', () => {
    const focos = PREGUNTAS.find((p) => p.id === 'focos')
    for (const o of focos.opciones) {
      for (const s of o.skills) expect(IDS_HABILIDAD).toContain(s)
    }
  })

  it('las ocho habilidades están cubiertas por alguna opción', () => {
    // Si una habilidad no se puede elegir, su rama del progreso no se
    // mueve nunca, y una barra que no sube desmotiva más que no tenerla.
    const focos = PREGUNTAS.find((p) => p.id === 'focos')
    const cubiertas = new Set(focos.opciones.flatMap((o) => o.skills))
    for (const id of IDS_HABILIDAD) expect(cubiertas.has(id)).toBe(true)
  })

  it('las respuestas por defecto valen para seguir sin tocar nada', () => {
    for (const p of PREGUNTAS) expect(preguntaResuelta(p, RESPUESTAS_POR_DEFECTO)).toBe(true)
  })

  it('la meta propia exige escribir algo', () => {
    const meta = PREGUNTAS.find((p) => p.id === 'meta')
    expect(preguntaResuelta(meta, { meta: 'propia', metaPropia: '' })).toBe(false)
    expect(preguntaResuelta(meta, { meta: 'propia', metaPropia: 'Ir a la playa' })).toBe(true)
  })
})

describe('alternar', () => {
  it('añade, quita y respeta el máximo', () => {
    expect(alternar([], 'a', 3)).toEqual(['a'])
    expect(alternar(['a'], 'a', 3)).toEqual([])
    expect(alternar(['a', 'b', 'c'], 'd', 3)).toEqual(['a', 'b', 'c'])
    // Y con el tope lleno se puede seguir quitando, o no habría salida.
    expect(alternar(['a', 'b', 'c'], 'b', 3)).toEqual(['a', 'c'])
  })
})

describe('misionesParaRol', () => {
  it('el ritmo decide cuántas', () => {
    for (const [ritmo, cuantas] of [['suave', 3], ['normal', 5], ['fuerte', 7]]) {
      expect(cuantasMisiones(ritmo)).toBe(cuantas)
      const m = misionesParaRol('junior', { ...RESPUESTAS_POR_DEFECTO, ritmo })
      expect(m).toHaveLength(cuantas)
    }
  })

  it('reparte entre los focos elegidos en vez de vaciar el primero', () => {
    // El fallo que esto evita: elegir tres focos y recibir cinco misiones
    // del primero. La familia contestó tres veces y solo se usó una.
    const respuestas = { ...RESPUESTAS_POR_DEFECTO, focos: ['estudio', 'salud', 'orden'], ritmo: 'fuerte' }
    const skills = new Set(misionesParaRol('junior', respuestas).map((m) => m.skill))
    expect(skills.has('aprendizaje')).toBe(true)
    expect(skills.has('salud')).toBe(true)
    expect(skills.size).toBeGreaterThanOrEqual(3)
  })

  it('cambiar el foco cambia el tablero', () => {
    const conEstudio = misionesParaRol('junior', { ...RESPUESTAS_POR_DEFECTO, focos: ['estudio'] })
    const conOrden = misionesParaRol('junior', { ...RESPUESTAS_POR_DEFECTO, focos: ['orden'] })
    expect(conEstudio.map((m) => m.title)).not.toEqual(conOrden.map((m) => m.title))
    // Lo elegido va primero; el resto es relleno, porque ningún rol tiene
    // siete tareas de una sola habilidad.
    expect(conEstudio[0].skill).toBe('aprendizaje')
    expect(conEstudio.filter((m) => m.skill === 'aprendizaje').length).toBeGreaterThanOrEqual(2)
    expect(conOrden[0].skill).toBe('responsabilidad')
  })

  it('nunca saca títulos que describen una casa concreta', () => {
    // «Ayudar a su hermana» vale en la casa que lo escribió y en ninguna
    // otra. Aparecer en el primer tablero de alguien de fuera es la
    // señal más clara de que esto es la app de una familia.
    for (const rol of ['peque', 'junior', 'adulto']) {
      for (const foco of PREGUNTAS[0].opciones.map((o) => o.id)) {
        const m = misionesParaRol(rol, { ...RESPUESTAS_POR_DEFECTO, focos: [foco], ritmo: 'fuerte' })
        for (const t of TITULOS_DE_UNA_CASA) {
          expect(m.map((x) => x.title)).not.toContain(t)
        }
      }
    }
  })

  it('no repite misiones aunque falten candidatas de ese foco', () => {
    // A los tres años no hay nada de aprendizaje formal: el relleno tiene
    // que traer otras, no repetir las mismas.
    const m = misionesParaRol('peque', { ...RESPUESTAS_POR_DEFECTO, focos: ['estudio'], ritmo: 'fuerte' })
    expect(m).toHaveLength(7)
    expect(new Set(m.map((x) => x.title)).size).toBe(7)
  })

  it('cada misión sale lista para insertar', () => {
    for (const m of misionesParaRol('adulto', RESPUESTAS_POR_DEFECTO)) {
      expect(m.title).toBeTruthy()
      expect(m.emoji).toBeTruthy()
      expect(['diario', 'semanal', 'mensual', 'unico']).toContain(m.frequency)
      expect(m.xp).toBeGreaterThan(0)
      expect(m.coins).toBeGreaterThan(0)
    }
  })
})

describe('premiosDelPlan', () => {
  it('siempre deja al menos tres de nivel 1, se elija lo que se elija', () => {
    // Son los que sostienen el hábito: premian con autonomía, no con
    // cosas, y no pierden valor con el uso.
    for (const premios of [['decidir'], ['juntos'], ['salir'], ['juntos', 'salir']]) {
      const lista = premiosDelPlan({ premios })
      expect(lista.filter((p) => p.tier === 1).length).toBeGreaterThanOrEqual(3)
    }
  })

  it('no mete más de un premio de nivel 3', () => {
    const lista = premiosDelPlan({ premios: ['decidir', 'juntos', 'salir'] })
    expect(lista.filter((p) => p.tier === 3).length).toBeLessThanOrEqual(1)
  })

  it('llena la tienda sin pasarse ni repetir', () => {
    const lista = premiosDelPlan({ premios: ['decidir', 'juntos', 'salir'] })
    expect(lista.length).toBeLessThanOrEqual(PREMIOS_EN_LA_TIENDA)
    expect(new Set(lista.map((p) => p.title)).size).toBe(lista.length)
  })

  it('todos los títulos que reparte existen en el catálogo', () => {
    // Un título mal escrito aquí no da error: simplemente ese premio no
    // aparece nunca, y la tienda sale más pobre sin que nadie lo note.
    // Ya pasó con «Elegir la actividad», que en el catálogo es «una».
    const delCatalogo = new Set(CATALOGO_PREMIOS.map((p) => p.title))
    for (const titulos of Object.values(PREMIOS_POR_TIPO)) {
      for (const t of titulos) expect(delCatalogo).toContain(t)
    }
  })

  it('responder «planes fuera» trae planes fuera', () => {
    const titulos = premiosDelPlan({ premios: ['salir'] }).map((p) => p.title)
    expect(titulos.some((t) => ['Picnic', 'Cine', 'Ir a la piscina', 'Helado'].includes(t))).toBe(true)
  })
})

describe('metaDelPlan', () => {
  it('la cifra sale del modelo, no de la respuesta', () => {
    const roles = MIEMBROS.map((m) => m.role)
    expect(metaDelPlan({ meta: 'peli' }, roles).target_xp).toBe(metaObjetivo(roles))
  })

  it('una familia más pequeña tiene una meta más pequeña', () => {
    // Si la cifra fuera fija, dos personas tardarían el triple en cerrar
    // la misma meta y el horizonte de 60 días dejaría de cumplirse.
    const grande = metaDelPlan({ meta: 'peli' }, ['adulto', 'adulto', 'junior', 'peque']).target_xp
    const pequena = metaDelPlan({ meta: 'peli' }, ['adulto', 'junior']).target_xp
    expect(pequena).toBeLessThan(grande)
  })

  it('respeta la meta escrita a mano', () => {
    const meta = metaDelPlan({ meta: 'propia', metaPropia: '  Fin de semana en la playa ' }, ['adulto'])
    expect(meta.title).toBe('Fin de semana en la playa')
  })
})

describe('planDeArranque', () => {
  it('da una tanda de misiones por persona con nombre', () => {
    const plan = planDeArranque(RESPUESTAS_POR_DEFECTO, [...MIEMBROS, { name: '  ', role: 'junior' }])
    expect(plan.porMiembro).toHaveLength(4)
    expect(plan.resumen.personas).toBe(4)
    expect(plan.resumen.misiones).toBe(4 * 5)
  })

  it('con peque en casa añade premios a su alcance', () => {
    // Sin esto su tarro se llena de estrellas y su tienda sale vacía: los
    // premios del catálogo cuestan 325 y ella gana cinco monedas al día.
    const conPeque = planDeArranque(RESPUESTAS_POR_DEFECTO, MIEMBROS)
    const suyos = conPeque.premios.filter((p) => p.cost <= TECHO_PEQUE)
    expect(suyos).toHaveLength(PREMIOS_DE_LA_PEQUE.length)
    expect(conPeque.resumen.techoPeque).toBe(TECHO_PEQUE)
  })

  it('y sin peque, no los añade', () => {
    const sinPeque = planDeArranque(RESPUESTAS_POR_DEFECTO, MIEMBROS.filter((m) => m.role !== 'peque'))
    expect(sinPeque.premios.every((p) => p.cost > TECHO_PEQUE)).toBe(true)
    expect(sinPeque.resumen.techoPeque).toBeNull()
  })

  it('aguanta un alta a medias sin reventar', () => {
    const plan = planDeArranque(RESPUESTAS_POR_DEFECTO, [])
    expect(plan.porMiembro).toEqual([])
    expect(plan.resumen.misiones).toBe(0)
    expect(plan.meta.target_xp).toBe(metaObjetivo([]))
  })

  it('dos respuestas distintas dan dos gremios distintos', () => {
    const a = planDeArranque({ ...RESPUESTAS_POR_DEFECTO, focos: ['estudio'], ritmo: 'suave', premios: ['salir'] }, MIEMBROS)
    const b = planDeArranque({ ...RESPUESTAS_POR_DEFECTO, focos: ['salud'], ritmo: 'fuerte', premios: ['decidir'] }, MIEMBROS)
    expect(a.resumen.misiones).not.toBe(b.resumen.misiones)
    expect(a.porMiembro[0].misiones.map((m) => m.title))
      .not.toEqual(b.porMiembro[0].misiones.map((m) => m.title))
  })

  it('es determinista: las mismas respuestas dan el mismo gremio', () => {
    // Sin esto, el resumen que se enseña antes de fundar podría no ser lo
    // que se funda.
    const uno = planDeArranque(RESPUESTAS_POR_DEFECTO, MIEMBROS)
    const otro = planDeArranque(RESPUESTAS_POR_DEFECTO, MIEMBROS)
    expect(JSON.stringify(uno)).toBe(JSON.stringify(otro))
  })
})
