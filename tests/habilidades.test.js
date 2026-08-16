import { describe, it, expect } from 'vitest'
import {
  HABILIDADES,
  IDS_HABILIDAD,
  habilidad,
  xpPorHabilidad,
  habilidadDominante,
  rangoDeHabilidad
} from '../src/lib/habilidades'
import { flex } from '../src/lib/genero'
import { CATALOGO, tareasDeRol, DEFAULTS_ROL } from '../src/lib/tareas'
import { CATALOGO_PREMIOS, NIVELES, nivelDePremio } from '../src/lib/premios'
import { misionesParaRol, premiosDelPlan, RESPUESTAS_POR_DEFECTO } from '../src/lib/setup'
import { REFERENCIAS, PRINCIPIOS } from '../src/lib/evidencia'

describe('habilidades', () => {
  it('son ocho, con id, color y lema', () => {
    expect(HABILIDADES).toHaveLength(8)
    for (const h of HABILIDADES) {
      expect(h.id).toMatch(/^[a-z]+$/)
      expect(h.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(h.lema.length).toBeGreaterThan(10)
    }
  })

  it('no hay ids repetidos', () => {
    expect(new Set(IDS_HABILIDAD).size).toBe(8)
  })

  it('habilidad() devuelve null para lo desconocido', () => {
    expect(habilidad('hogar').nombre).toBe('Hogar')
    expect(habilidad('inventada')).toBe(null)
    expect(habilidad(null)).toBe(null)
  })
})

describe('XP por habilidad', () => {
  const challenges = [
    { id: 'c1', skill: 'salud' },
    { id: 'c2', skill: 'salud' },
    { id: 'c3', skill: 'hogar' },
    { id: 'c4', skill: null }
  ]
  const completions = [
    { challenge_id: 'c1', profile_id: 'p1', status: 'aprobado', xp: 20 },
    { challenge_id: 'c2', profile_id: 'p1', status: 'aprobado', xp: 30 },
    { challenge_id: 'c3', profile_id: 'p1', status: 'aprobado', xp: 10 },
    { challenge_id: 'c1', profile_id: 'p1', status: 'pendiente', xp: 99 },
    { challenge_id: 'c1', profile_id: 'p2', status: 'aprobado', xp: 77 },
    { challenge_id: 'c4', profile_id: 'p1', status: 'aprobado', xp: 15 }
  ]

  it('solo suma lo aprobado de esa persona', () => {
    const r = xpPorHabilidad('p1', completions, challenges)
    expect(r.salud).toBe(50)
    expect(r.hogar).toBe(10)
  })

  it('ignora las misiones sin habilidad en vez de romperse', () => {
    const r = xpPorHabilidad('p1', completions, challenges)
    expect(Object.values(r).reduce((a, b) => a + b, 0)).toBe(60)
  })

  it('devuelve las ocho claves aunque estén a cero', () => {
    const r = xpPorHabilidad('nadie', [], [])
    expect(Object.keys(r).sort()).toEqual([...IDS_HABILIDAD].sort())
  })

  it('la dominante es la de más XP, y null si no hay nada', () => {
    expect(habilidadDominante(xpPorHabilidad('p1', completions, challenges)).id).toBe('salud')
    expect(habilidadDominante(xpPorHabilidad('nadie', [], []))).toBe(null)
  })
})

describe('rangos de habilidad', () => {
  it('empieza en aprendiz y sube por tramos', () => {
    const nombre = (xp, genero = 'femenino') => flex(rangoDeHabilidad(xp).nombre, genero)
    expect(nombre(0)).toBe('Aprendiz')
    expect(nombre(99)).toBe('Aprendiz')
    expect(nombre(100)).toBe('Oficial')
    expect(nombre(700)).toBe('Maestra')
    expect(nombre(99999)).toBe('Leyenda')
  })

  it('los rangos concuerdan con el género y tienen forma neutra', () => {
    expect(flex(rangoDeHabilidad(300).nombre, 'masculino')).toBe('Veterano')
    expect(flex(rangoDeHabilidad(300).nombre, 'femenino')).toBe('Veterana')
    expect(flex(rangoDeHabilidad(300).nombre, 'neutro')).toBe('Veteranía')
    expect(flex(rangoDeHabilidad(700).nombre, 'neutro')).toBe('Maestría')
  })

  it('el porcentaje nunca se sale de rango', () => {
    for (const xp of [0, 1, 99, 100, 699, 1500, 50000]) {
      const r = rangoDeHabilidad(xp)
      expect(r.pct).toBeGreaterThanOrEqual(0)
      expect(r.pct).toBeLessThanOrEqual(100)
    }
  })
})

describe('catálogo de misiones', () => {
  it('cubre los tres roles', () => {
    expect(Object.keys(CATALOGO).sort()).toEqual(['adulto', 'junior', 'peque'])
  })

  it('toda misión declara habilidad válida, frecuencia válida y dibujo', () => {
    const frecuencias = ['diario', 'semanal', 'mensual', 'unico']
    for (const rol of Object.keys(CATALOGO)) {
      for (const tarea of tareasDeRol(rol)) {
        expect(IDS_HABILIDAD, `${rol}: ${tarea.t}`).toContain(tarea.skill)
        expect(frecuencias, `${rol}: ${tarea.t}`).toContain(tarea.f)
        expect(tarea.e.length, `${rol}: ${tarea.t}`).toBeGreaterThan(0)
        expect(tarea.t.length).toBeGreaterThan(3)
      }
    }
  })

  it('no repite títulos dentro del mismo rol', () => {
    for (const rol of Object.keys(CATALOGO)) {
      const titulos = tareasDeRol(rol).map((t) => t.t)
      expect(new Set(titulos).size, `duplicados en ${rol}`).toBe(titulos.length)
    }
  })

  it('la peque no tiene nada de riesgo: ni química, ni altura, ni cortantes', () => {
    const peligro = /lejía|químic|escalera|altura|cortante|cristal|horno|inodoro/i
    for (const tarea of tareasDeRol('peque')) {
      expect(peligro.test(tarea.t), tarea.t).toBe(false)
    }
  })

  it('el bloque a fondo es exclusivo de personas adultas', () => {
    const aFondo = CATALOGO.adulto.find((g) => g.grupo.includes('a fondo'))
    expect(aFondo).toBeTruthy()
    const titulosAdultos = new Set(aFondo.tareas.map((t) => t.t))
    for (const rol of ['peque', 'junior']) {
      for (const tarea of tareasDeRol(rol)) {
        expect(titulosAdultos.has(tarea.t), `${tarea.t} en ${rol}`).toBe(false)
      }
    }
  })
})

describe('misiones de arranque', () => {
  // Antes salían de una lista fija de títulos; ahora las arma el setup con
  // lo que contesta la familia. Lo que se defiende es lo mismo: cinco por
  // persona con la respuesta por defecto, variadas, y con los puntos de su
  // rol.
  it('son cinco por rol con la respuesta por defecto', () => {
    for (const rol of ['peque', 'junior', 'adulto']) {
      const arranque = misionesParaRol(rol, RESPUESTAS_POR_DEFECTO)
      expect(arranque, rol).toHaveLength(5)
    }
  })

  it('tocan más de una habilidad, para que ninguna barra nazca muerta', () => {
    for (const rol of ['peque', 'junior', 'adulto']) {
      const skills = new Set(misionesParaRol(rol, RESPUESTAS_POR_DEFECTO).map((m) => m.skill))
      expect(skills.size, `${rol} entrena una sola habilidad`).toBeGreaterThanOrEqual(2)
    }
  })

  it('llevan los puntos por defecto de su rol', () => {
    for (const rol of ['peque', 'junior', 'adulto']) {
      for (const m of misionesParaRol(rol, RESPUESTAS_POR_DEFECTO)) {
        expect(m.xp).toBe(DEFAULTS_ROL[rol].xp)
        expect(m.coins).toBe(DEFAULTS_ROL[rol].coins)
      }
    }
  })
})

describe('premios', () => {
  it('cada premio tiene nivel de 1 a 3 y coste positivo', () => {
    for (const p of CATALOGO_PREMIOS) {
      expect([1, 2, 3]).toContain(p.tier)
      expect(p.cost).toBeGreaterThan(0)
    }
  })

  it('el coste encaja con el rango de su nivel', () => {
    for (const p of CATALOGO_PREMIOS) {
      const [min, max] = NIVELES[p.tier].coste
      expect(p.cost, p.title).toBeGreaterThanOrEqual(p.tier === 1 ? 0 : min)
      expect(p.cost, p.title).toBeLessThanOrEqual(max)
    }
  })

  it('el nivel 1 domina el catálogo: es el que mejor sostiene el hábito', () => {
    const nivel1 = CATALOGO_PREMIOS.filter((p) => p.tier === 1).length
    expect(nivel1).toBeGreaterThanOrEqual(CATALOGO_PREMIOS.filter((p) => p.tier === 3).length)
  })

  it('la tienda de arranque es sobre todo de nivel 1', () => {
    const tienda = premiosDelPlan(RESPUESTAS_POR_DEFECTO)
    const nivel1 = tienda.filter((p) => p.tier === 1).length
    expect(nivel1).toBeGreaterThan(tienda.length / 2)
  })

  it('no hay dinero, chuches ni pantallas en el catálogo', () => {
    const prohibido = /dinero|euro|€|chuche|caramelo|golosina|pantalla|tablet|videojuego|móvil/i
    for (const p of CATALOGO_PREMIOS) {
      expect(prohibido.test(p.title), p.title).toBe(false)
    }
  })

  it('nivelDePremio clasifica por coste', () => {
    // Valores dentro de cada banda tras espaciar las cadencias a 15/30/45
    // días: los umbrales son los de NIVELES, no números sueltos.
    expect(nivelDePremio(400)).toBe(1)
    expect(nivelDePremio(900)).toBe(2)
    expect(nivelDePremio(1300)).toBe(3)
  })
})

describe('evidencia', () => {
  it('son las seis referencias, con cita y aplicación', () => {
    expect(REFERENCIAS).toHaveLength(6)
    for (const r of REFERENCIAS) {
      expect(r.cita.length).toBeGreaterThan(60)
      expect(r.aporta.length).toBeGreaterThan(40)
      expect(r.enElGremio.length).toBeGreaterThan(40)
    }
  })

  it('los PMID son numéricos cuando existen', () => {
    for (const r of REFERENCIAS) {
      if (r.pmid !== null) expect(r.pmid).toMatch(/^\d{7,8}$/)
    }
  })

  it('hay un principio por cada idea que el sistema aplica', () => {
    const ids = PRINCIPIOS.map((p) => p.id)
    expect(ids).toContain('elogio')
    expect(ids).toContain('retirada')
    expect(ids).toContain('eleccion')
    expect(new Set(ids).size).toBe(PRINCIPIOS.length)
  })
})
