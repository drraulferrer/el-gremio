import { describe, it, expect } from 'vitest'
import { claveDe, huella, VENTANA_CLAVE_MS } from '../src/lib/acciones'

// ------------------------------------------------------------------
// La clave que evita cobrar dos veces (migraciones 042 y 043).
//
// Lo que defiende este fichero es la propiedad de la que depende todo lo
// demas: dos peticiones nacidas del MISMO gesto llevan la misma clave, y dos
// intenciones distintas no. Si alguien "arregla" esto poniendo un
// identificador nuevo por llamada, el doble clic vuelve a cobrar dos veces y
// no se enteraria nadie, porque por pantalla se ve igual.
//
// `ahora` se pasa a mano en todos los casos a proposito: sin eso, un test que
// llame dos veces seguidas falla el dia que las dos llamadas caigan a los dos
// lados de una ventana.
// ------------------------------------------------------------------

const T = 1_756_500_000_000

describe('la clave de idempotencia', () => {
  it('dos veces la misma intencion, la misma clave', () => {
    const a = claveDe(['canje', 'premio-1', 'perfil-1'], T)
    const b = claveDe(['canje', 'premio-1', 'perfil-1'], T + 900)
    expect(b).toBe(a)
  })

  it('intenciones distintas, claves distintas', () => {
    const base = claveDe(['canje', 'premio-1', 'perfil-1'], T)
    expect(claveDe(['canje', 'premio-2', 'perfil-1'], T)).not.toBe(base)
    expect(claveDe(['canje', 'premio-1', 'perfil-2'], T)).not.toBe(base)
    expect(claveDe(['manual', 'premio-1', 'perfil-1'], T)).not.toBe(base)
  })

  it('pasada la ventana, la clave cambia: un canje deliberado mas tarde si entra', () => {
    const a = claveDe(['canje', 'premio-1', 'perfil-1'], T)
    const b = claveDe(['canje', 'premio-1', 'perfil-1'], T + VENTANA_CLAVE_MS * 2)
    expect(b).not.toBe(a)
  })

  it('cabe en lo que acepta la base: entre 8 y 120 caracteres', () => {
    // El check de movimientos_coins rechaza fuera de ese rango, y un uuid
    // ocupa 36: dos uuids y el prefijo se acercan al limite.
    const larga = claveDe(['manual', 'a'.repeat(36), 'b'.repeat(36), huella('x'.repeat(500))], T)
    expect(larga.length).toBeGreaterThanOrEqual(8)
    expect(larga.length).toBeLessThanOrEqual(120)
  })
})

describe('la huella del motivo', () => {
  it('el mismo texto da la misma huella', () => {
    expect(huella('por ayudar con la mudanza')).toBe(huella('por ayudar con la mudanza'))
  })

  it('textos distintos dan huellas distintas', () => {
    // Dos premios a mano de la misma cantidad y distinta razon son dos cosas
    // distintas, y tienen que poder darse seguidos.
    expect(huella('por la mudanza')).not.toBe(huella('por el examen'))
  })

  it('no se rompe con nada raro', () => {
    expect(typeof huella('')).toBe('string')
    expect(typeof huella(undefined)).toBe('string')
  })
})
