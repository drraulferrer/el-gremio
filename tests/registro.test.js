import { describe, it, expect } from 'vitest'
import { resumenDeFila, agruparErrores, tituloDeErrores } from '../src/lib/registro'

// La fila real que guardó producción el 21-ago a las 22:21, recortada.
// El panel la enseñaba como «error.capturado · 2.15.0+796376b · petición
// —», que es literalmente todo lo que decía mientras la app llevaba tres
// días sin conceder un sello.
const REAL = {
  id: 1,
  nivel: 'error',
  evento: 'error.capturado',
  ts: '2026-08-21T22:21:07.138Z',
  release: '2.15.0+796376b',
  datos: {
    huella: 'Error: there is no unique or exclusion constraint matching the ON CONFLICT specification',
    origen: 'otorgarInsignias',
    veces: 1,
    detalle: { code: '42P10', message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' }
  }
}

const fila = (extra = {}, datos = {}) => ({
  id: Math.random(),
  nivel: 'error',
  evento: 'error.capturado',
  ts: '2026-08-21T10:00:00.000Z',
  release: '2.14.0+abc',
  ...extra,
  datos: { huella: 'Error: algo', ...datos }
})

describe('qué se puede leer de una fila', () => {
  it('lo primero es el mensaje, no el nombre del evento', () => {
    expect(resumenDeFila(REAL).huella).toContain('ON CONFLICT')
    expect(resumenDeFila(REAL).codigo).toBe('42P10')
    expect(resumenDeFila(REAL).origen).toBe('otorgarInsignias')
  })

  it('sin huella, se cae al mensaje del detalle', () => {
    const r = resumenDeFila({ nivel: 'error', evento: 'x', datos: { detalle: { message: 'se cayó' } } })
    expect(r.huella).toBe('se cayó')
  })

  // Las filas viejas son de antes de que existiera la mitad de los
  // campos: leerlas no puede reventar la pantalla de estado.
  it('una fila vieja o vacía no rompe', () => {
    expect(resumenDeFila({}).huella).toBe('desconocido')
    expect(resumenDeFila(null).huella).toBe('desconocido')
    expect(resumenDeFila(undefined).nivel).toBe('error')
  })

  it('marca lo que viene de fuera de la app', () => {
    expect(resumenDeFila(fila({}, { ajeno: true })).ajeno).toBe(true)
    expect(resumenDeFila(REAL).ajeno).toBe(false)
  })
})

describe('agrupar por huella', () => {
  it('lo repetido cuenta, no ocupa 294 filas', () => {
    const muchas = Array.from({ length: 294 }, () => fila({}, { huella: 'Error: ON CONFLICT' }))
    const grupos = agruparErrores(muchas)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].veces).toBe(294)
  })

  it('primero lo más repetido', () => {
    const grupos = agruparErrores([
      fila({}, { huella: 'A' }), fila({}, { huella: 'B' }),
      fila({}, { huella: 'B' }), fila({}, { huella: 'B' })
    ])
    expect(grupos.map((g) => g.huella)).toEqual(['B', 'A'])
  })

  // Dos fallos de una vez cada uno: importa el de hace diez minutos, no
  // el del martes.
  it('a igualdad de veces, primero el más reciente', () => {
    const grupos = agruparErrores([
      fila({ ts: '2026-08-18T09:00:00.000Z' }, { huella: 'martes' }),
      fila({ ts: '2026-08-21T23:50:00.000Z' }, { huella: 'hace diez minutos' })
    ])
    expect(grupos[0].huella).toBe('hace diez minutos')
  })

  it('guarda cuándo empezó y cuándo fue la última, en cualquier orden de llegada', () => {
    const grupos = agruparErrores([
      fila({ ts: '2026-08-21T23:50:00.000Z' }, { huella: 'X' }),
      fila({ ts: '2026-08-19T08:00:00.000Z' }, { huella: 'X' }),
      fila({ ts: '2026-08-20T12:00:00.000Z' }, { huella: 'X' })
    ])
    expect(grupos[0].primera).toBe('2026-08-19T08:00:00.000Z')
    expect(grupos[0].ultima).toBe('2026-08-21T23:50:00.000Z')
  })

  // Un error que aparece en dos versiones sobrevivió a un despliegue, y
  // eso cambia dónde hay que buscarlo.
  it('reúne las versiones en las que ha aparecido, sin repetirlas', () => {
    const grupos = agruparErrores([
      fila({ release: '2.14.0' }, { huella: 'X' }),
      fila({ release: '2.15.0' }, { huella: 'X' }),
      fila({ release: '2.14.0' }, { huella: 'X' })
    ])
    expect(grupos[0].releases).toEqual(['2.14.0', '2.15.0'])
  })

  it('un error manda sobre un aviso con la misma huella', () => {
    const grupos = agruparErrores([fila({ nivel: 'warn' }, { huella: 'X' }), fila({ nivel: 'error' }, { huella: 'X' })])
    expect(grupos[0].nivel).toBe('error')
  })

  it('sin filas, ni una fila', () => {
    expect(agruparErrores()).toEqual([])
    expect(agruparErrores([])).toEqual([])
  })
})

describe('la frase de la cabecera', () => {
  it('sin errores, lo dice y ya', () => {
    expect(tituloDeErrores([])).toMatch(/Buena señal/)
  })

  it('cuenta fallos distintos y veces totales', () => {
    const grupos = agruparErrores([
      ...Array.from({ length: 294 }, () => fila({}, { huella: 'A' })),
      fila({}, { huella: 'B' })
    ])
    expect(tituloDeErrores(grupos)).toBe('2 fallos distintos, 295 veces.')
  })

  // Cinco fallos de extensiones del navegador no son cinco fallos de la
  // app, y la frase no puede sugerir lo contrario.
  it('separa lo que no es de la app', () => {
    const grupos = agruparErrores([fila({}, { huella: 'A' }), fila({}, { huella: 'B', ajeno: true })])
    expect(tituloDeErrores(grupos)).toMatch(/1 de fuera de la app/)
  })
})
