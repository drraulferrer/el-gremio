import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { EMOJIS } from '../src/lib/supabase'
import { ROLES, ROLES_CON_MASCOTA } from '../src/lib/miembros'
import { crearClienteDemo } from '../src/lib/fakeBackend'
import {
  ESPECIES,
  EMOJI_DE_ESPECIE,
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

describe('dar de alta una mascota, desde la interfaz', () => {
  // Los dos fallos que trajo la 2.3.0 y que nadie vio porque la
  // funcionalidad se construyó entera antes de usarla ni una vez.

  it('hay un avatar de perro y otro de gato', () => {
    // Sin ellos, a la mascota de la casa había que ponerle cara de zorro
    // y la lista de miembros dejaba de leerse de un vistazo.
    expect(EMOJIS).toContain('🐕')
    expect(EMOJIS).toContain('🐈')
  })

  it('cada especie tiene su avatar propuesto, y está en la lista', () => {
    for (const e of ESPECIES) {
      const cara = EMOJI_DE_ESPECIE[e]
      expect(cara, e).toBeTruthy()
      expect(EMOJIS, e).toContain(cara)
    }
  })

  it('no hay avatares repetidos', () => {
    expect(new Set(EMOJIS).size).toBe(EMOJIS.length)
  })

  it('las pastillas de especie se marcan con la MISMA clase que las demás', () => {
    // Este test existe por un fallo real: las pastillas de «¿Perro o
    // gato?» se marcaban con `.activa`, que no está definida para
    // `.pastilla-habilidad` —el CSS solo tiene `.sel`—. El clic
    // funcionaba y el estado cambiaba, pero en pantalla no pasaba nada,
    // así que parecía que la app no dejaba elegir especie.
    const pantalla = readFileSync(new URL('../src/screens/Miembros.jsx', import.meta.url), 'utf8')
    const estilos = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
    const marcas = [...pantalla.matchAll(/'pastilla-habilidad' \+ \([^)]*\? ' (\w+)'/g)].map((x) => x[1])

    expect(marcas.length).toBeGreaterThan(0)
    for (const marca of marcas) {
      expect(estilos, `.pastilla-habilidad.${marca} no existe en el CSS`)
        .toContain(`.pastilla-habilidad.${marca}`)
    }
  })
})

describe('la especie es obligatoria, y eso se comprueba en los dos sitios', () => {
  // El backend simulado persiste en localStorage, que en Node no existe.
  // Un doble en memoria basta: lo que se prueba aquí es qué acepta y qué
  // rechaza, no dónde lo guarda.
  beforeEach(() => {
    const memoria = new Map()
    globalThis.localStorage = {
      getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
      setItem: (k, v) => memoria.set(k, String(v)),
      removeItem: (k) => memoria.delete(k)
    }
  })

  // El fallo que esto vigila llegó a producción por una grieta concreta:
  // el onboarding ofrecía el rol «mascota» sin pedir especie, el backend
  // simulado lo aceptaba tan tranquilo y Postgres rechazaba la fila
  // entera por `profiles_especie_coherente`. Un demo más permisivo que la
  // base da luz verde a lo que va a romperse en casa de alguien.

  it('el alta inicial del gremio NO ofrece el rol mascota', () => {
    // Ahí no se puede: el insert va sin `species` y, aunque colara, la
    // mascota nacería sin sus misiones —el catálogo se crea en Miembros—.
    const onboarding = readFileSync(new URL('../src/screens/Onboarding.jsx', import.meta.url), 'utf8')
    expect(onboarding).not.toMatch(/Object\.entries\(ROLE_LABEL\)/)
    expect(onboarding).toMatch(/ROLES\.map/)
  })

  it('el rol mascota sí existe donde sí se puede elegir especie', () => {
    expect(ROLES).not.toContain('mascota')
    expect(ROLES_CON_MASCOTA).toContain('mascota')
  })

  it('el demo rechaza una mascota sin especie, igual que Postgres', async () => {
    const demo = crearClienteDemo()
    const { error } = await demo
      .from('profiles')
      .insert([{ family_id: 'f1', name: 'Chispa', role: 'mascota', species: null }])
      .select()
    expect(error?.message).toMatch(/profiles_especie_coherente/)
  })

  it('y rechaza una persona CON especie, que es el otro lado del mismo error', async () => {
    const demo = crearClienteDemo()
    const { error } = await demo
      .from('profiles')
      .insert([{ family_id: 'f1', name: 'Ana', role: 'adulto', species: 'perro' }])
      .select()
    expect(error?.message).toMatch(/profiles_especie_coherente/)
  })

  it('una mascota con especie válida entra sin problema', async () => {
    const demo = crearClienteDemo()
    const { data, error } = await demo
      .from('profiles')
      .insert([{ family_id: 'f1', name: 'Chispa', role: 'mascota', species: 'perro' }])
      .select()
    expect(error).toBe(null)
    expect(data[0].species).toBe('perro')
  })
})
