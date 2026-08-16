import { describe, it, expect } from 'vitest'
import {
  TABLAS_EXPORTADAS, FORMATO_EXPORTACION, construirExportacion, nombreFichero,
  resumenDeBorrado, confirmacionValida, mensajeDeBorrado
} from '../src/lib/datos'

// ------------------------------------------------------------------
// Llevarse los datos y borrar la cuenta (migración 018).
//
// Estos tests defienden tres decisiones, no una implementación:
//   1. el hash del PIN no sale nunca en la copia;
//   2. la copia lleva TODAS las tablas aunque estén vacías, para que
//      quien la abra sepa que no falta nada;
//   3. la confirmación del borrado se puede escribir como habla la gente
//      (sin acentos, sin mayúsculas), porque está para obligar a mirar,
//      no para ganar un examen de mecanografía.
// ------------------------------------------------------------------

const FAMILIA = {
  id: 'f1',
  name: 'Los Robledo',
  parent_pin_hash: 'no-debe-salir-jamas',
  timezone: 'Europe/Madrid',
  created_at: '2026-08-01T10:00:00.000Z'
}

describe('construirExportacion', () => {
  it('no se lleva el hash del PIN', () => {
    const fichero = construirExportacion({ family: FAMILIA, tablas: {} })
    expect(JSON.stringify(fichero)).not.toContain('no-debe-salir-jamas')
    expect(fichero.gremio.parent_pin_hash).toBeUndefined()
  })

  it('incluye todas las tablas, también las vacías', () => {
    const fichero = construirExportacion({ family: FAMILIA, tablas: { profiles: [{ id: 'p1' }] } })
    for (const tabla of TABLAS_EXPORTADAS) {
      expect(Array.isArray(fichero.datos[tabla])).toBe(true)
    }
    expect(fichero.datos.profiles).toHaveLength(1)
    expect(fichero.datos.completions).toHaveLength(0)
  })

  it('lleva cabecera con formato, versión y fecha', () => {
    const fichero = construirExportacion({
      family: FAMILIA,
      tablas: {},
      generadoEn: new Date('2026-08-16T09:00:00.000Z'),
      release: '1.0.0+abc'
    })
    expect(fichero.formato).toBe(FORMATO_EXPORTACION)
    expect(fichero.aplicacion).toBe('El Gremio')
    expect(fichero.release).toBe('1.0.0+abc')
    expect(fichero.generado_en).toBe('2026-08-16T09:00:00.000Z')
    expect(fichero.gremio.timezone).toBe('Europe/Madrid')
  })

  it('aguanta que no haya familia ni tablas', () => {
    const fichero = construirExportacion({})
    expect(fichero.gremio).toBeNull()
    expect(fichero.datos.profiles).toEqual([])
  })
})

describe('nombreFichero', () => {
  it('sale legible y con fecha', () => {
    expect(nombreFichero(FAMILIA, new Date('2026-08-16T09:00:00.000Z'))).toBe('los-robledo-2026-08-16.json')
  })

  it('quita acentos y símbolos que rompen un nombre de fichero', () => {
    const raro = { name: '¡Gremio de la Peña! /2' }
    expect(nombreFichero(raro, new Date('2026-08-16T09:00:00.000Z'))).toBe('gremio-de-la-pena-2-2026-08-16.json')
  })

  it('nunca se queda sin nombre', () => {
    expect(nombreFichero({ name: '###' }, new Date('2026-08-16T09:00:00.000Z'))).toBe('gremio-2026-08-16.json')
    expect(nombreFichero(null, new Date('2026-08-16T09:00:00.000Z'))).toBe('gremio-2026-08-16.json')
  })
})

describe('resumenDeBorrado', () => {
  it('cuenta solo lo que existe y lo nombra en castellano', () => {
    const resumen = resumenDeBorrado({
      profiles: [{}, {}, {}],
      completions: [{}, {}],
      rewards: []
    })
    expect(resumen).toEqual([
      { tabla: 'profiles', nombre: 'miembros', cuantas: 3 },
      { tabla: 'completions', nombre: 'misiones pedidas', cuantas: 2 }
    ])
  })

  it('usa el singular cuando hay uno solo', () => {
    // «1 metas» delata que nadie ha mirado la pantalla, y esta es la
    // pantalla en la que más falta hace que se note que alguien la ha
    // mirado: es la del botón que no tiene vuelta atrás.
    const resumen = resumenDeBorrado({ family_goals: [{}], profiles: [{}, {}] })
    expect(resumen).toEqual([
      { tabla: 'profiles', nombre: 'miembros', cuantas: 2 },
      { tabla: 'family_goals', nombre: 'meta', cuantas: 1 }
    ])
  })

  it('con un gremio vacío no inventa nada', () => {
    expect(resumenDeBorrado({})).toEqual([])
    expect(resumenDeBorrado(null)).toEqual([])
  })
})

describe('confirmacionValida', () => {
  it('acepta el nombre tal cual', () => {
    expect(confirmacionValida('Los Robledo', 'Los Robledo')).toBe(true)
  })

  it('perdona mayúsculas, acentos y espacios de sobra', () => {
    expect(confirmacionValida('  la peña  ', 'La Peña')).toBe(true)
    expect(confirmacionValida('LA PENA', 'La Peña')).toBe(true)
  })

  it('no acepta otra cosa, ni el vacío', () => {
    expect(confirmacionValida('', 'Los Robledo')).toBe(false)
    expect(confirmacionValida('los robledos', 'Los Robledo')).toBe(false)
    expect(confirmacionValida('cualquier cosa', '')).toBe(false)
    expect(confirmacionValida('', '')).toBe(false)
  })
})

describe('mensajeDeBorrado', () => {
  it('calla cuando ha ido bien', () => {
    expect(mensajeDeBorrado('ok')).toBeNull()
    expect(mensajeDeBorrado('ok_sin_gremio')).toBeNull()
  })

  it('y explica en castellano cuando no', () => {
    expect(mensajeDeBorrado('sin_sesion')).toMatch(/sesión/i)
    expect(mensajeDeBorrado('lo_que_sea')).toMatch(/no se ha tocado nada/i)
  })
})
