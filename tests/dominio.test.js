import { describe, it, expect } from 'vitest'
import { urlCanonica, esOrigenLocal, enDireccionVieja } from '../src/lib/dominio'

const D = 'elgremioapp.com'

describe('la dirección que se comparte', () => {
  it('manda el dominio propio aunque la app se abra en la dirección vieja', () => {
    // El caso que motivó todo: un aparato con la PWA instalada desde
    // GitHub Pages enseñaba a los demás una dirección heredada.
    expect(urlCanonica('https://drraulferrer.github.io', '/el-gremio/', D)).toBe('https://elgremioapp.com/')
  })

  it('en el dominio bueno devuelve el dominio bueno', () => {
    expect(urlCanonica('https://elgremioapp.com', '/', D)).toBe('https://elgremioapp.com/')
  })

  it('en local devuelve el origen real, o el QR no serviría para probar', () => {
    expect(urlCanonica('http://localhost:5173', '/', D)).toBe('http://localhost:5173/')
    expect(urlCanonica('http://192.168.1.40:5173', '/', D)).toBe('http://192.168.1.40:5173/')
  })

  it('sin dominio declarado se comporta como antes: origen más base', () => {
    expect(urlCanonica('https://alguien.github.io', '/el-gremio/', '')).toBe('https://alguien.github.io/el-gremio/')
    expect(urlCanonica('https://alguien.github.io', '/', '')).toBe('https://alguien.github.io/')
  })

  it('aguanta un CNAME con protocolo, barra final o espacios', () => {
    for (const sucio of ['https://elgremioapp.com', 'elgremioapp.com/', '  elgremioapp.com\n']) {
      expect(urlCanonica('https://loquesea.com', '/', sucio)).toBe('https://elgremioapp.com/')
    }
  })

  it('siempre termina en barra: sin ella el QR de una subcarpeta pierde el último tramo', () => {
    expect(urlCanonica('https://alguien.github.io', '/el-gremio', '')).toMatch(/\/$/)
  })
})

describe('reconocer el origen local', () => {
  it('acepta localhost, el bucle y las redes privadas', () => {
    for (const o of ['http://localhost:5173', 'http://127.0.0.1:4173', 'http://192.168.0.9', 'http://10.0.0.4', 'http://172.16.3.2']) {
      expect(esOrigenLocal(o)).toBe(true)
    }
  })

  it('no confunde un dominio público que empiece parecido', () => {
    expect(esOrigenLocal('https://localhost.attacker.com')).toBe(false)
    expect(esOrigenLocal('https://192.168.1.1.example.com')).toBe(false)
    expect(esOrigenLocal('https://elgremioapp.com')).toBe(false)
  })

  it('no revienta con basura', () => {
    expect(esOrigenLocal('')).toBe(false)
    expect(esOrigenLocal('no-es-una-url')).toBe(false)
  })
})

describe('avisar de que se está en la dirección vieja', () => {
  it('avisa desde la dirección vieja', () => {
    expect(enDireccionVieja('https://drraulferrer.github.io', D)).toBe(true)
  })

  it('no avisa en el dominio bueno ni en local ni sin dominio declarado', () => {
    expect(enDireccionVieja('https://elgremioapp.com', D)).toBe(false)
    expect(enDireccionVieja('http://localhost:5173', D)).toBe(false)
    expect(enDireccionVieja('https://loquesea.com', '')).toBe(false)
  })
})
