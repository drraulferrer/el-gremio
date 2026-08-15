import { describe, it, expect } from 'vitest'
import { flex, generoDe, plantillaCompleta, marcasDe, GENEROS, IDS_GENERO } from '../src/lib/genero'
import { CATALOGO, tareasDeRol } from '../src/lib/tareas'
import { rangoDeHabilidad } from '../src/lib/habilidades'
import { ROLE_LABEL } from '../src/lib/supabase'
import { INSIGNIAS } from '../src/lib/insignias'
import { sugerenciasDeElogio } from '../src/lib/elogio'

describe('resolución de marcas', () => {
  const p = 'Vestirse {solo|sola|sin ayuda}'

  it('elige la forma que toca', () => {
    expect(flex(p, 'masculino')).toBe('Vestirse solo')
    expect(flex(p, 'femenino')).toBe('Vestirse sola')
    expect(flex(p, 'neutro')).toBe('Vestirse sin ayuda')
  })

  it('sin género, neutro: es la ausencia de dato, no un tercer sexo', () => {
    expect(flex(p)).toBe('Vestirse sin ayuda')
    expect(flex(p, 'inventado')).toBe('Vestirse sin ayuda')
    expect(flex(p, null)).toBe('Vestirse sin ayuda')
  })

  it('deja intacto lo que no lleva marcas', () => {
    expect(flex('Recoger juguetes', 'femenino')).toBe('Recoger juguetes')
  })

  it('resuelve varias marcas en la misma frase', () => {
    const dos = '{Querido|Querida|Hola}, lo has hecho {tú solo|tú sola|sin ayuda}.'
    expect(flex(dos, 'femenino')).toBe('Querida, lo has hecho tú sola.')
    expect(flex(dos, 'neutro')).toBe('Hola, lo has hecho sin ayuda.')
  })

  it('nunca deja llaves sueltas en pantalla', () => {
    for (const g of [...IDS_GENERO, undefined, 'raro']) {
      expect(flex('Algo {a|b}', g)).not.toMatch(/[{}]/)
      expect(flex('Algo {a}', g)).not.toMatch(/[{}]/)
    }
  })

  it('aguanta texto vacío o ausente', () => {
    expect(flex(null)).toBe('')
    expect(flex(undefined)).toBe('')
    expect(flex('')).toBe('')
  })
})

describe('género de un perfil', () => {
  it('un perfil sin columna se trata en neutro', () => {
    expect(generoDe({ name: 'Sin migrar' })).toBe('neutro')
    expect(generoDe(null)).toBe('neutro')
  })

  it('respeta lo declarado y descarta lo que no existe', () => {
    expect(generoDe({ gender: 'femenino' })).toBe('femenino')
    expect(generoDe({ gender: 'masculino' })).toBe('masculino')
    expect(generoDe({ gender: 'otro' })).toBe('neutro')
  })

  it('las tres opciones se pueden enseñar con un ejemplo', () => {
    expect(GENEROS).toHaveLength(3)
    for (const g of GENEROS) {
      expect(g.etiqueta.length).toBeGreaterThan(2)
      expect(g.ejemplo.length).toBeGreaterThan(10)
    }
  })
})

// ------------------------------------------------------------------
// Este bloque es el que evita el fallo tonto: una marca con solo dos
// formas deja a quien no ha dicho su género leyendo el masculino.
// ------------------------------------------------------------------
describe('todas las plantillas traen las tres formas', () => {
  const revisar = (texto, donde) => {
    expect(plantillaCompleta(texto), `${donde}: ${texto} → ${JSON.stringify(marcasDe(texto))}`).toBe(true)
  }

  it('en los títulos del catálogo', () => {
    for (const rol of Object.keys(CATALOGO)) {
      for (const tarea of tareasDeRol(rol)) revisar(tarea.t, `${rol}`)
    }
  })

  it('en los rangos de habilidad', () => {
    for (const xp of [0, 100, 300, 700, 1500]) revisar(rangoDeHabilidad(xp).nombre, 'rango')
  })

  it('en los nombres de las insignias', () => {
    for (const b of INSIGNIAS) revisar(b.name, 'insignia ' + b.code)
  })

  it('en las etiquetas de rol', () => {
    for (const [rol, etiqueta] of Object.entries(ROLE_LABEL)) revisar(etiqueta, 'rol ' + rol)
  })

  it('en las frases de elogio de todo el catálogo', () => {
    for (const rol of Object.keys(CATALOGO)) {
      for (const tarea of tareasDeRol(rol)) {
        for (const frase of sugerenciasDeElogio({ reto: { title: tarea.t, skill: tarea.skill }, racha: 3 })) {
          revisar(frase, `elogio ${rol}`)
        }
      }
    }
  })
})

describe('el resultado final nunca enseña marcas', () => {
  it('ni en títulos, ni en elogios, en ningún género', () => {
    for (const rol of Object.keys(CATALOGO)) {
      for (const tarea of tareasDeRol(rol)) {
        for (const g of IDS_GENERO) {
          expect(flex(tarea.t, g)).not.toMatch(/[{}|]/)
          for (const frase of sugerenciasDeElogio({ reto: { title: tarea.t, skill: tarea.skill }, racha: 2 })) {
            expect(flex(frase, g), `${rol} · ${tarea.t}`).not.toMatch(/[{}|]/)
          }
        }
      }
    }
  })

  it('la forma neutra no usa arroba, barra ni "-e": hay que poder leerla en voz alta', () => {
    const apanos = /[@]|\b\w+\/\w+\b|\bell[eo]s y ellas\b/
    for (const rol of Object.keys(CATALOGO)) {
      for (const tarea of tareasDeRol(rol)) {
        expect(apanos.test(flex(tarea.t, 'neutro')), tarea.t).toBe(false)
      }
    }
    for (const xp of [300, 700]) {
      expect(apanos.test(flex(rangoDeHabilidad(xp).nombre, 'neutro'))).toBe(false)
    }
  })
})
