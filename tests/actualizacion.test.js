import { describe, it, expect } from 'vitest'
import {
  hayVersionNueva, consultarPublicado, debeRecargar, leerIntento, apuntarIntento,
  CADA, TRAS_VOLVER, OCULTA_MINIMA
} from '../src/lib/actualizacion'

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

describe('recargar sola la tablet de la peque', () => {
  const base = {
    ocultaMs: 10 * 60 * 1000,
    versionNueva: true,
    listo: true,
    commitPublicado: 'nuevo',
    yaIntentadoPara: null
  }

  it('sí: volvió tras diez minutos escondida, con versión nueva y nada a medias', () => {
    expect(debeRecargar(base)).toBe(true)
  })

  it('no si no hay versión nueva', () => {
    expect(debeRecargar({ ...base, versionNueva: false })).toBe(false)
  })

  // Un juego a medias, una celebración o una estrella viajando a la base.
  // Recargar ahí le quita algo que ya era suyo.
  it('no si hay algo a medias', () => {
    expect(debeRecargar({ ...base, listo: false })).toBe(false)
  })

  // Pudo ser un aviso del sistema tapando la pantalla mientras jugaba.
  it('no si estuvo escondida un momento', () => {
    expect(debeRecargar({ ...base, ocultaMs: 30 * 1000 })).toBe(false)
    expect(debeRecargar({ ...base, ocultaMs: OCULTA_MINIMA - 1 })).toBe(false)
    expect(debeRecargar({ ...base, ocultaMs: OCULTA_MINIMA })).toBe(true)
  })

  // El guardia que importa: si ya se recargó buscando ese commit y aquí
  // seguimos con el viejo, el navegador sirve su caché y recargar otra vez
  // es un bucle infinito con la niña delante.
  it('no si ya se recargó buscando ese mismo commit', () => {
    expect(debeRecargar({ ...base, yaIntentadoPara: 'nuevo' })).toBe(false)
  })

  it('pero sí si el intento anterior era para otra versión', () => {
    expect(debeRecargar({ ...base, yaIntentadoPara: 'viejo' })).toBe(true)
  })

  it('sin argumentos no recarga nada', () => {
    expect(debeRecargar()).toBe(false)
  })

  it('el intento se recuerda entre recargas, y un almacén roto no rompe', () => {
    const datos = {}
    const almacen = { getItem: (k) => datos[k] ?? null, setItem: (k, v) => { datos[k] = v } }
    expect(leerIntento(almacen)).toBeNull()
    apuntarIntento('abc123', almacen)
    expect(leerIntento(almacen)).toBe('abc123')

    const roto = { getItem: () => { throw new Error('nope') }, setItem: () => { throw new Error('nope') } }
    expect(leerIntento(roto)).toBeNull()
    expect(() => apuntarIntento('x', roto)).not.toThrow()
  })
})
