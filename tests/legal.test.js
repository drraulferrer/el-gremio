import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { VERSION_LEGAL, DOCUMENTOS, urlLegal, datosDeAceptacion, puedeAceptar } from '../src/lib/legal'

describe('aceptación en el alta', () => {
  // Esta es LA regla: sin marcar la casilla no hay alta. Vive en una
  // función y no suelta en la pantalla para poder fijarla aquí.
  it('sin marcar no se puede seguir', () => {
    expect(puedeAceptar(false)).toBe(false)
    expect(puedeAceptar(undefined)).toBe(false)
    expect(puedeAceptar('sí')).toBe(false)
  })

  it('marcada, sí', () => {
    expect(puedeAceptar(true)).toBe(true)
  })

  it('lo que se guarda dice QUÉ versión y CUÁNDO', () => {
    const d = datosDeAceptacion(new Date('2026-08-16T10:00:00Z'))
    expect(d.legal_version).toBe(VERSION_LEGAL)
    expect(d.legal_aceptado_en).toBe('2026-08-16T10:00:00.000Z')
  })
})

describe('las direcciones de los documentos', () => {
  it('cuelgan de la raíz canónica', () => {
    expect(urlLegal('privacidad', 'https://elgremioapp.com/'))
      .toBe('https://elgremioapp.com/legal/privacidad.html')
    expect(urlLegal('terminos', 'https://elgremioapp.com/'))
      .toBe('https://elgremioapp.com/legal/terminos.html')
  })

  it('sobreviven a una raíz sin barra final', () => {
    expect(urlLegal('terminos', 'http://localhost:5173'))
      .toBe('http://localhost:5173/legal/terminos.html')
  })

  // Se piden por nombre de fichero y no como directorio: el servidor de
  // Vite no sirve el índice de un directorio de public/, así que la
  // dirección corta parecería rota justo al comprobarla en local.
  it('piden el fichero .html, no el directorio', () => {
    for (const doc of Object.keys(DOCUMENTOS)) {
      expect(urlLegal(doc, '/')).toMatch(/\.html$/)
    }
  })
})

describe('los documentos publicados', () => {
  const leer = (f) => readFileSync(new URL('../public/' + f, import.meta.url), 'utf8')

  it('existen los dos y no están vacíos', () => {
    for (const { archivo } of Object.values(DOCUMENTOS)) {
      expect(leer(archivo).length).toBeGreaterThan(2000)
    }
  })

  // Si el texto cambia y la versión no, la versión guardada junto a cada
  // cuenta pasa a decir algo falso: sería la prueba de una aceptación que
  // nunca ocurrió sobre ESE texto.
  it('los dos llevan escrita la versión vigente', () => {
    for (const { archivo } of Object.values(DOCUMENTOS)) {
      expect(leer(archivo)).toContain(VERSION_LEGAL)
    }
  })

  it('dicen a quién reclamar y cómo', () => {
    for (const { archivo } of Object.values(DOCUMENTOS)) {
      const texto = leer(archivo)
      expect(texto).toContain('Raúl Ferrer')
      expect(texto).toContain('info@elgremioapp.com')
    }
  })

  it('la privacidad cubre lo que no se puede omitir con datos de menores', () => {
    const p = leer(DOCUMENTOS.privacidad.archivo)
    expect(p).toMatch(/patria potestad|tutela/i)   // quién consiente
    expect(p).toMatch(/Agencia Española de Protección de Datos/i) // dónde reclamar
    expect(p).toMatch(/30 días/)                   // retención de los logs
    expect(p).toMatch(/borrar la cuenta/i)         // supresión
  })

  it('se enlazan entre sí', () => {
    expect(leer(DOCUMENTOS.terminos.archivo)).toContain('privacidad.html')
  })
})
