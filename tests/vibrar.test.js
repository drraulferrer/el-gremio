import { describe, it, expect } from 'vitest'
import { vibrar, debeVibrar, TOQUE, LOGRO, FALLO } from '../src/lib/vibrar'

// Un navigator de mentira: los tests no pueden depender de correr en un
// aparato que vibre de verdad.
function navFalso() {
  const dados = []
  return {
    vibrate: (p) => { dados.push(p); return true },
    dados: () => dados
  }
}

describe('cuándo se puede vibrar', () => {
  it('vibra si el aparato sabe', () => {
    expect(debeVibrar(navFalso(), false)).toBe(true)
  })

  it('no vibra donde no existe la API', () => {
    // iOS Safari, que es donde se usa la mitad de esta app. No es un
    // error: es un aparato que se apoya en el sonido y la imagen.
    expect(debeVibrar({}, false)).toBe(false)
    expect(debeVibrar(null, false)).toBe(false)
  })

  it('no vibra si el sistema pide menos movimiento', () => {
    expect(debeVibrar(navFalso(), true)).toBe(false)
  })
})

describe('vibrar de verdad', () => {
  it('pasa el patrón tal cual y avisa de que vibró', () => {
    const nav = navFalso()
    expect(vibrar(LOGRO, nav)).toBe(true)
    expect(nav.dados()).toEqual([LOGRO])
  })

  it('sin aparato capaz, calla y devuelve false', () => {
    expect(vibrar(TOQUE, {})).toBe(false)
  })

  it('si el navegador tira, se lo traga', () => {
    // Algunos tiran si la pestaña no está en primer plano. Una
    // excepción aquí se comería la acción que disparó el háptico: la
    // estrella de la peque tiene que registrarse igual.
    const nav = { vibrate: () => { throw new Error('no visible') } }
    expect(() => vibrar(TOQUE, nav)).not.toThrow()
    expect(vibrar(TOQUE, nav)).toBe(false)
  })
})

describe('los patrones', () => {
  it('son tres y se distinguen', () => {
    // Si logro y fallo se sintieran parecidos no comunicarían nada, que
    // es el fallo de tener un catálogo de diez vibraciones.
    expect(LOGRO).not.toEqual(FALLO)
    expect(typeof TOQUE).toBe('number')
  })

  it('el toque es más corto que cualquier cosa que signifique algo', () => {
    const total = (p) => (Array.isArray(p) ? p.reduce((s, n) => s + n, 0) : p)
    expect(total(TOQUE)).toBeLessThan(total(LOGRO))
    expect(total(TOQUE)).toBeLessThan(total(FALLO))
  })
})
