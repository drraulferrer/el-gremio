import { describe, it, expect } from 'vitest'
import { enMarco, romperMarco } from '../src/lib/marco'

// ------------------------------------------------------------------
// Clickjacking.
//
// Lo que defienden estos tests no es la forma de una función: es que la
// app NO SE PINTE dentro del iframe de otra página. La CSP no puede
// evitarlo —`frame-ancestors` se ignora en un meta y GitHub Pages no
// sirve cabeceras—, así que esta es toda la defensa que hay.
//
// El caso que importa es el tercero: el marco que no deja salir. Si
// alguna vez se «simplifica» esto a un booleano, ese caso se vuelve
// indistinguible de «he salido» y la app acaba pintada dentro del marco,
// que es justo lo que se quería impedir.
// ------------------------------------------------------------------

const suelto = () => {
  const v = { location: { href: 'https://elgremioapp.com/' } }
  v.self = v
  v.top = v
  return v
}

const enmarcado = ({ dejaSalir = true } = {}) => {
  const dentro = { location: { href: 'https://elgremioapp.com/' } }
  const fuera = {
    get location() {
      return this._loc
    },
    set location(valor) {
      if (!dejaSalir) throw new DOMException('bloqueado', 'SecurityError')
      this._loc = valor
    },
    _loc: 'https://sitio-ajeno.example/'
  }
  dentro.self = dentro
  dentro.top = fuera
  return dentro
}

describe('detectar el marco', () => {
  it('sin marco, no hay marco', () => {
    expect(enMarco(suelto())).toBe(false)
  })

  it('dentro de un iframe, sí', () => {
    expect(enMarco(enmarcado())).toBe(true)
  })

  it('si preguntarlo revienta, se responde que sí', () => {
    // En duda, la respuesta prudente es la que no arranca la app dentro
    // de la página de otro.
    const raro = {
      get self() {
        throw new Error('bloqueado por el navegador')
      }
    }
    expect(enMarco(raro)).toBe(true)
  })
})

describe('salir del marco', () => {
  it('sin marco no se toca nada', () => {
    const v = suelto()
    expect(romperMarco(v)).toBe('suelto')
  })

  it('con marco, se navega al sitio de verdad', () => {
    const v = enmarcado()
    expect(romperMarco(v)).toBe('saliendo')
    expect(v.top.location).toBe('https://elgremioapp.com/')
  })

  it('un marco que no deja salir se declara ATRAPADO, no resuelto', () => {
    // Es el caso peligroso: un iframe `sandbox` sin allow-top-navigation
    // lanza SecurityError al navegar. Si esto devolviera 'saliendo', la
    // app se montaría dentro del marco del atacante.
    const v = enmarcado({ dejaSalir: false })
    expect(romperMarco(v)).toBe('atrapado')
  })
})

describe('los tres desenlaces son distintos entre sí', () => {
  it('main.jsx solo monta la app con "suelto"', () => {
    const desenlaces = [
      romperMarco(suelto()),
      romperMarco(enmarcado()),
      romperMarco(enmarcado({ dejaSalir: false }))
    ]
    expect(new Set(desenlaces).size).toBe(3)
    expect(desenlaces.filter((d) => d === 'suelto')).toHaveLength(1)
  })
})
