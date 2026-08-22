import { describe, it, expect } from 'vitest'
import {
  validarTexto, hechosDe, construirReconocimiento, dadosHoy, quedanHoy,
  aQuienPuedoDar, darGracias, TOPE_DIARIO, TEXTO_MAXIMO, SUGERENCIAS
} from '../src/lib/gracias'

const FAMILIA = { id: 'fam-1', timezone: 'Europe/Madrid' }

function clienteFalso({ falla = null } = {}) {
  const escrito = []
  return {
    escrito,
    from() {
      return { insert: async (fila) => { escrito.push(fila); return { data: null, error: falla } } }
    }
  }
}

const compl = (extra = {}) => ({
  id: 'c' + Math.random().toString(36).slice(2),
  profile_id: 'p2',
  status: 'aprobado',
  praise: null,
  challenge_id: 'ch1',
  resolved_at: new Date().toISOString(),
  ...extra
})

describe('qué se puede escribir', () => {
  it('una palabra de verdad, sí; dos letras, no', () => {
    expect(validarTexto('gracias').ok).toBe(true)
    expect(validarTexto('ab').ok).toBe(false)
    expect(validarTexto('   ').ok).toBe(false)
  })

  it('media novela, no', () => {
    expect(validarTexto('x'.repeat(TEXTO_MAXIMO + 1)).ok).toBe(false)
  })
})

describe('los hechos que se proponen', () => {
  // Sin sugerencias no se usa: es la lección del elogio al validar, donde
  // cada sugerencia ES el botón.
  it('salen los encargos recientes de esa persona', () => {
    const datos = { completions: [compl(), compl()], challenges: [{ id: 'ch1', emoji: '🍳', title: 'Cocina' }] }
    const hechos = hechosDe('p2', datos)
    expect(hechos).toHaveLength(2)
    expect(hechos[0]).toMatchObject({ emoji: '🍳', titulo: 'Cocina' })
  })

  // §10.3: lo que YA tiene palabras no se vuelve a ofrecer. Da igual
  // quién las escribiera —completions no guarda quién validó—; lo que
  // importa es que ese hecho ya fue reconocido.
  it('NO sale lo que ya recibió un elogio', () => {
    const datos = { completions: [compl({ praise: 'Muy bien hecho' }), compl()], challenges: [] }
    expect(hechosDe('p2', datos)).toHaveLength(1)
  })

  it('no sale lo de otra persona ni lo que no está aprobado', () => {
    const datos = {
      completions: [compl({ profile_id: 'p9' }), compl({ status: 'pendiente' }), compl({ status: 'rechazado' })],
      challenges: []
    }
    expect(hechosDe('p2', datos)).toHaveLength(0)
  })

  it('no salen las de hace un mes: a los treinta días ya nadie se acuerda', () => {
    const viejo = new Date(Date.now() - 30 * 86400000).toISOString()
    const datos = { completions: [compl({ resolved_at: viejo })], challenges: [] }
    expect(hechosDe('p2', datos)).toHaveLength(0)
  })

  it('nunca más de cinco', () => {
    const datos = { completions: Array.from({ length: 20 }, () => compl()), challenges: [] }
    expect(hechosDe('p2', datos)).toHaveLength(SUGERENCIAS)
  })

  it('sin datos no rompe', () => {
    expect(hechosDe('p2')).toEqual([])
  })
})

describe('la fila que se guarda', () => {
  const base = { familyId: 'fam-1', deProfile: 'p1', aProfile: 'p2', dia: '2026-8-22' }

  it('un gracias lleva su frase y puede colgar de un encargo', () => {
    const fila = construirReconocimiento({ ...base, texto: '  gracias por la cena  ', completionId: 'c1' })
    expect(fila.texto).toBe('gracias por la cena')
    expect(fila.completion_id).toBe('c1')
  })

  // La base lo exige y la interfaz no puede mandar otra cosa: un gesto
  // con texto sería un gracias mudo con letra pequeña.
  it('un gesto va sin texto y sin encargo', () => {
    const fila = construirReconocimiento({ ...base, tipo: 'gesto', texto: 'no debería', completionId: 'c1' })
    expect(fila.texto).toBeNull()
    expect(fila.completion_id).toBeNull()
  })

  it('lo espontáneo no cuelga de ningún encargo: por eso es espontáneo', () => {
    const fila = construirReconocimiento({ ...base, tipo: 'espontaneo', texto: 'nadie te lo pidió', completionId: 'c1' })
    expect(fila.completion_id).toBeNull()
  })

  // Si algún día alguien añade aquí una columna de Talis o de XP, esta
  // prueba lo dice en voz alta. Es la defensa de la decisión 1.
  it('la fila tiene exactamente estos campos, y ninguno de recompensa', () => {
    expect(Object.keys(construirReconocimiento({ ...base, texto: 'x' })).sort()).toEqual(
      ['a_profile', 'completion_id', 'de_profile', 'dia', 'family_id', 'texto', 'tipo'].sort()
    )
  })
})

describe('el tope de tres al día', () => {
  const hoy = '2026-8-22'
  const dado = (extra = {}) => ({ de_profile: 'p1', dia: hoy, ...extra })

  it('cuenta solo los míos y solo los de hoy', () => {
    const filas = [dado(), dado(), dado({ de_profile: 'p9' }), dado({ dia: '2026-8-21' })]
    expect(dadosHoy(filas, 'p1', hoy)).toBe(2)
    expect(quedanHoy(filas, 'p1', hoy)).toBe(TOPE_DIARIO - 2)
  })

  it('no baja de cero aunque la base tenga más', () => {
    const filas = Array.from({ length: 9 }, () => dado())
    expect(quedanHoy(filas, 'p1', hoy)).toBe(0)
  })
})

describe('a quién se le puede dar', () => {
  const perfiles = [
    { id: 'p1', role: 'adulto' },
    { id: 'p2', role: 'junior' },
    { id: 'p3', role: 'mascota' },
    { id: 'p4', role: 'adulto', active: false }
  ]

  it('a cualquiera menos a mí, al perro y a quien se retiró', () => {
    expect(aQuienPuedoDar(perfiles, 'p1').map((p) => p.id)).toEqual(['p2'])
  })
})

describe('mandarlo', () => {
  it('un gracias con frase llega con el día del gremio', async () => {
    const cliente = clienteFalso()
    const r = await darGracias({
      family: FAMILIA, de: 'p1', a: 'p2', texto: 'gracias por la cena', cliente,
      ahora: new Date('2026-08-22T10:00:00.000Z')
    })
    expect(r.ok).toBe(true)
    expect(cliente.escrito[0]).toMatchObject({ de_profile: 'p1', a_profile: 'p2', tipo: 'gracias' })
    expect(cliente.escrito[0].dia).toMatch(/^2026-8-22$/)
  })

  it('un gesto no necesita frase', async () => {
    const cliente = clienteFalso()
    const r = await darGracias({ family: FAMILIA, de: 'p1', a: 'p2', tipo: 'gesto', cliente })
    expect(r.ok).toBe(true)
    expect(cliente.escrito[0].texto).toBeNull()
  })

  it('un gracias sin frase no llega a tocar la base', async () => {
    const cliente = clienteFalso()
    expect((await darGracias({ family: FAMILIA, de: 'p1', a: 'p2', texto: 'ab', cliente })).ok).toBe(false)
    expect(cliente.escrito).toHaveLength(0)
  })

  it('a uno mismo, no', async () => {
    const cliente = clienteFalso()
    const r = await darGracias({ family: FAMILIA, de: 'p1', a: 'p1', texto: 'me lo merezco', cliente })
    expect(r.ok).toBe(false)
    expect(cliente.escrito).toHaveLength(0)
  })

  it('si la base dice que no quedan, devuelve el motivo y no miente', async () => {
    const cliente = clienteFalso({ falla: { message: 'tope_de_gracias: ya has dado 3 hoy (máximo 3)' } })
    const r = await darGracias({ family: FAMILIA, de: 'p1', a: 'p2', texto: 'gracias', cliente })
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(/tres gracias de hoy/i)
  })

  it('sin cliente configurado tampoco revienta', async () => {
    const r = await darGracias({ family: FAMILIA, de: 'p1', a: 'p2', texto: 'gracias', cliente: null })
    expect(r.ok).toBe(false)
  })
})
