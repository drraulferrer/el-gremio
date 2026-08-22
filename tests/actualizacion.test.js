import { describe, it, expect } from 'vitest'
import { hayVersionNueva, consultarPublicado, CADA, TRAS_VOLVER } from '../src/lib/actualizacion'

// Un `fetch` de mentira. Se inyecta en vez de parchear el global: en CI
// no hay navegador, y parchear cosas globales es lo que dejó el CI en
// rojo cuatro empujones seguidos el 19-ago.
const respuesta = ({ ok = true, tipo = 'application/json', cuerpo = {}, revienta = false } = {}) =>
  async () => {
    if (revienta) throw new Error('sin red')
    return {
      ok,
      headers: { get: () => tipo },
      json: async () => cuerpo
    }
  }

describe('¿hay versión nueva?', () => {
  it('sí cuando el commit publicado es otro', () => {
    expect(hayVersionNueva({ commit: '340b589' }, 'cbbce0c')).toBe(true)
  })

  it('no cuando es el mismo', () => {
    expect(hayVersionNueva({ commit: '340b589' }, '340b589')).toBe(false)
  })

  // Un aviso que sale cuando no toca se aprende a ignorar en dos días, y
  // entonces ya no sirve el día que sí importa. Ante la duda, no.
  it('ante cualquier duda, no', () => {
    expect(hayVersionNueva(null, 'abc')).toBe(false)
    expect(hayVersionNueva({}, 'abc')).toBe(false)
    expect(hayVersionNueva({ commit: '' }, 'abc')).toBe(false)
    expect(hayVersionNueva({ commit: '   ' }, 'abc')).toBe(false)
    expect(hayVersionNueva('2.16.1', 'abc')).toBe(false)
  })

  it('un bundle de desarrollo no avisa de nada', () => {
    expect(hayVersionNueva({ commit: '340b589' }, 'dev')).toBe(false)
    expect(hayVersionNueva({ commit: 'dev' }, '340b589')).toBe(false)
  })

  it('los espacios de más no cuentan como versión distinta', () => {
    expect(hayVersionNueva({ commit: ' 340b589 ' }, '340b589')).toBe(false)
  })
})

describe('leer version.json', () => {
  it('devuelve el objeto cuando responde JSON', async () => {
    expect(await consultarPublicado(respuesta({ cuerpo: { commit: 'abc' } }))).toEqual({ commit: 'abc' })
  })

  // `npm run dev` no tiene version.json: el comodín de la SPA devuelve el
  // index.html con un 200 tan campante. Sin esta comprobación, el JSON.parse
  // reventaría en cada arranque de desarrollo.
  it('un index.html disfrazado de 200 no cuela', async () => {
    expect(await consultarPublicado(respuesta({ tipo: 'text/html' }))).toBeNull()
  })

  it('un 404 no rompe', async () => {
    expect(await consultarPublicado(respuesta({ ok: false }))).toBeNull()
  })

  it('sin red, tampoco', async () => {
    expect(await consultarPublicado(respuesta({ revienta: true }))).toBeNull()
  })

  it('sin fetch en el entorno, calla y devuelve null', async () => {
    expect(await consultarPublicado(null)).toBeNull()
  })
})

describe('los relojes', () => {
  // Media hora en primer plano y cinco minutos al volver: mirar más a
  // menudo no aporta —los despliegues son a mano y espaciados— y sí gasta
  // batería y datos de alguien.
  it('son los acordados', () => {
    expect(CADA).toBe(30 * 60 * 1000)
    expect(TRAS_VOLVER).toBe(5 * 60 * 1000)
  })
})
