import { describe, it, expect } from 'vitest'
import {
  ESPECIES,
  DIAS_TRUCO,
  esMascota,
  especieValida,
  catalogoDe,
  premiosDe,
  filaDeMision,
  filaDePremio,
  premiosParaPerfil
} from '../src/lib/mascotas'
import { esParaPerfil } from '../src/lib/misiones'

const TODAS = [...catalogoDe('perro'), ...catalogoDe('gato')]

describe('el catálogo no puede ser aversivo', () => {
  // La restricción más dura de todo esto (AVSAB 2021). No es una
  // preferencia de estilo: si la app sugiere una sola misión aversiva,
  // está enseñando a la familia a hacerle daño al animal con la coartada
  // de un sistema de puntos. Este test existe para que nadie la cuele en
  // una revisión rápida.
  const PROHIBIDO = [
    /regañ/i, /correg/i, /castig/i, /tir[óo]n/i, /domin/i,
    /quien manda/i, /colleja/i, /grit/i, /asust/i, /pellizc/i
  ]

  it('ninguna misión usa lenguaje de corrección o castigo', () => {
    for (const m of TODAS) {
      for (const patron of PROHIBIDO) {
        expect(m.title, `«${m.title}» contiene ${patron}`).not.toMatch(patron)
      }
    }
  })

  it('ningún premio usa lenguaje de corrección o castigo', () => {
    for (const p of [...premiosDe('perro'), ...premiosDe('gato')]) {
      for (const patron of PROHIBIDO) {
        expect(p.title).not.toMatch(patron)
      }
    }
  })
})

describe('trucos y hábitos son cosas distintas', () => {
  // Demant et al. 2011: entrenar a diario adquiere PEOR que espaciarlo.
  // Si alguien "simplifica" poniéndolo todo diario, esta app estaría
  // empujando a la familia hacia lo menos eficaz con su propia mecánica
  // de rachas. Es la línea que no se toca.
  it('los trucos salen espaciados, nunca diarios', () => {
    const trucos = TODAS.filter((m) => m.tipo === 'truco')
    expect(trucos.length).toBeGreaterThan(0)
    for (const t of trucos) {
      const fila = filaDeMision(t, { familyId: 'f', profileId: 'p' })
      expect(fila.frequency, `«${t.title}»`).not.toBe('diario')
      expect(fila.days).toEqual(DIAS_TRUCO)
    }
  })

  it('los hábitos sí son diarios y sin patrón', () => {
    const habitos = TODAS.filter((m) => m.tipo === 'habito')
    expect(habitos.length).toBeGreaterThan(0)
    for (const h of habitos) {
      const fila = filaDeMision(h, { familyId: 'f', profileId: 'p' })
      expect(fila.frequency, `«${h.title}»`).toBe('diario')
      expect(fila.days).toBeNull()
    }
  })

  it('las dos especies traen trucos y hábitos', () => {
    for (const especie of ESPECIES) {
      const c = catalogoDe(especie)
      expect(c.some((m) => m.tipo === 'truco')).toBe(true)
      expect(c.some((m) => m.tipo === 'habito')).toBe(true)
    }
  })
})

describe('las misiones de mascota son solo suyas', () => {
  it('salen marcadas para el rol mascota y para ese animal', () => {
    const fila = filaDeMision(catalogoDe('perro')[0], { familyId: 'f', profileId: 'nube' })
    expect(fila.target_roles).toEqual(['mascota'])
    expect(fila.profile_id).toBe('nube')
  })

  // El agujero que casi se cuela: `esParaPerfil` devuelve true para
  // cualquiera cuando la misión no lleva destinatario. Sin arreglarlo, el
  // perro heredaría «Beber agua» y «Cocina» del tablero de la familia.
  it('una mascota NO hereda las misiones genéricas de la casa', () => {
    const generica = { title: 'Beber agua' }
    expect(esParaPerfil(generica, { id: 'p', role: 'junior' })).toBe(true)
    expect(esParaPerfil(generica, { id: 'n', role: 'mascota' })).toBe(false)
  })

  it('y una persona no ve las de la mascota', () => {
    const deMascota = { title: 'Cepillado', target_roles: ['mascota'] }
    expect(esParaPerfil(deMascota, { id: 'j', role: 'junior' })).toBe(false)
    expect(esParaPerfil(deMascota, { id: 'n', role: 'mascota' })).toBe(true)
  })
})

describe('los premios no se mezclan', () => {
  const premios = [
    { id: 'a', title: 'Tarde de peli' },
    { id: 'b', title: 'Paseo largo', target_role: 'mascota' }
  ]

  it('la mascota solo ve los suyos', () => {
    const r = premiosParaPerfil(premios, { role: 'mascota' })
    expect(r.map((x) => x.id)).toEqual(['b'])
  })

  it('las personas solo ven los de la familia', () => {
    const r = premiosParaPerfil(premios, { role: 'junior' })
    expect(r.map((x) => x.id)).toEqual(['a'])
  })

  it('el premio de mascota sale marcado al guardarlo', () => {
    const fila = filaDePremio(premiosDe('gato')[0], { familyId: 'f' })
    expect(fila.target_role).toBe('mascota')
  })
})

describe('para el gato, el premio por defecto no es comida', () => {
  // Vitale Shreve et al. 2017: el 50 % prefiere interacción social
  // humana; el 37 %, comida. El premio más barato —el que se canjea de
  // verdad— tiene que ser de los que se dan con tiempo, no con comida.
  it('el premio más barato del gato no es comestible', () => {
    const masBarato = [...premiosDe('gato')].sort((a, b) => a.cost - b.cost)[0]
    expect(masBarato.title).not.toMatch(/chuch|golosina|premio de comida|snack/i)
    expect(masBarato.tier).toBe(1)
  })
})

describe('reglas sueltas', () => {
  it('reconoce a una mascota', () => {
    expect(esMascota({ role: 'mascota' })).toBe(true)
    expect(esMascota({ role: 'junior' })).toBe(false)
    expect(esMascota(null)).toBe(false)
  })

  it('solo admite perro y gato', () => {
    expect(especieValida('perro')).toBe(true)
    expect(especieValida('gato')).toBe(true)
    expect(especieValida('loro')).toBe(false)
    expect(especieValida(null)).toBe(false)
  })

  it('una especie desconocida no trae catálogo, no revienta', () => {
    expect(catalogoDe('loro')).toEqual([])
    expect(premiosDe(undefined)).toEqual([])
  })

  it('marca qué misiones necesitan a un adulto', () => {
    const conAdulto = TODAS.filter((m) => m.adulto)
    expect(conAdulto.length).toBeGreaterThan(0)
    // Todo lo que toca comida o salir a la calle lleva la marca.
    const comida = TODAS.filter((m) => /comida|agua|arenero|dental|paseo/i.test(m.title))
    for (const m of comida) {
      expect(m.adulto, `«${m.title}» debería necesitar adulto`).toBe(true)
    }
  })
})
