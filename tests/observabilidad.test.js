import { describe, it, expect } from 'vitest'
import { redactar } from '../src/lib/log'
import { huella, origenDelError } from '../src/lib/monitoring'
import { mensajeDeError, eventoDeExito } from '../src/lib/supabase'

describe('redacción de logs', () => {
  it('borra credenciales aunque alguien las pase por descuido', () => {
    const salida = redactar({
      email: 'persona@ejemplo.com',
      password: 'secreto',
      pin: '1234',
      parent_pin_hash: 'abcdef',
      access_token: 'eyJhbGciOi',
      apikey: 'anon-key',
      profile_id: 'p1'
    })
    expect(salida.email).toBe('[redactado]')
    expect(salida.password).toBe('[redactado]')
    expect(salida.pin).toBe('[redactado]')
    expect(salida.parent_pin_hash).toBe('[redactado]')
    expect(salida.access_token).toBe('[redactado]')
    expect(salida.apikey).toBe('[redactado]')
    expect(salida.profile_id).toBe('p1')
  })

  it('también en objetos anidados', () => {
    const salida = redactar({ contexto: { usuario: { email: 'x@y.z', id: 7 } } })
    expect(salida.contexto.usuario.email).toBe('[redactado]')
    expect(salida.contexto.usuario.id).toBe(7)
  })

  it('recorta textos largos para no inflar la tabla de logs', () => {
    const salida = redactar({ nota: 'x'.repeat(1000) })
    expect(salida.nota.length).toBeLessThan(320)
    expect(salida.nota.endsWith('…')).toBe(true)
  })

  it('conserva nombre, mensaje y traza de los errores', () => {
    const salida = redactar(new Error('algo se rompió'))
    expect(salida.nombre).toBe('Error')
    expect(salida.mensaje).toBe('algo se rompió')
    expect(typeof salida.stack).toBe('string')
  })

  it('no se cuelga con estructuras muy profundas', () => {
    const profundo = { a: { b: { c: { d: { e: { f: 'fondo' } } } } } }
    expect(() => redactar(profundo)).not.toThrow()
  })
})

describe('agrupación de errores', () => {
  it('agrupa el mismo fallo con distintos identificadores', () => {
    const a = new Error('perfil 550e8400-e29b-41d4-a716-446655440000 no encontrado')
    const b = new Error('perfil 6ba7b810-9dad-11d1-80b4-00c04fd430c8 no encontrado')
    expect(huella(a)).toBe(huella(b))
  })

  it('distingue fallos realmente distintos', () => {
    expect(huella(new Error('sin monedas'))).not.toBe(huella(new Error('sin permiso')))
  })
})

describe('mensajes de error para la interfaz', () => {
  it('traduce el límite de ritmo', () => {
    const mensaje = mensajeDeError({ message: 'limite_de_ritmo:completions: 121 en 3600 s (máximo 120)' })
    expect(mensaje).toMatch(/Demasiadas acciones/)
    expect(mensaje).not.toMatch(/limite_de_ritmo/)
  })

  it('traduce el fallo de RLS y el de red', () => {
    expect(mensajeDeError({ message: 'new row violates row-level security policy' })).toMatch(/permiso/)
    expect(mensajeDeError({ message: 'Failed to fetch' })).toMatch(/Sin conexión/)
  })

  // Publicar el bundle antes que la migración es el error de despliegue
  // más fácil de cometer aquí, y el que peor se diagnostica: PostgREST
  // contesta «schema cache» y quien lo lee no sabe qué hacer con eso.
  it('dice qué migración falta cuando la tabla del buzón no está', () => {
    const mensaje = mensajeDeError({
      message: "Could not find the table 'public.informes_fallo' in the schema cache"
    })
    expect(mensaje).toMatch(/migracion-033/)
  })

  it('no inventa nada cuando no reconoce el error', () => {
    expect(mensajeDeError({ message: 'otra cosa rara' })).toBe('otra cosa rara')
    expect(mensajeDeError(null)).toBe('')
  })
})

describe('errores de PostgREST en el registro', () => {
  // Un PostgrestError es un Error con code/details/hint colgados encima.
  class PostgrestError extends Error {
    constructor(c) {
      super(c.message)
      this.name = 'PostgrestError'
      this.details = c.details
      this.hint = c.hint
      this.code = c.code
    }
  }

  it('conserva code, details y hint, que son los que dicen qué hacer', () => {
    const salida = redactar(
      new PostgrestError({
        message: 'permission denied for table completions',
        details: 'RLS denegó la operación',
        hint: 'GRANT DELETE ON public.completions TO authenticated;',
        code: '42501'
      })
    )
    expect(salida.mensaje).toBe('permission denied for table completions')
    expect(salida.code).toBe('42501')
    expect(salida.hint).toMatch(/GRANT DELETE/)
    expect(salida.details).toBe('RLS denegó la operación')
  })

  it('sigue borrando credenciales colgadas de un error', () => {
    const err = new Error('fallo al entrar')
    err.password = 'secreto'
    err.code = 'PGRST301'
    const salida = redactar(err)
    expect(salida.password).toBe('[redactado]')
    expect(salida.code).toBe('PGRST301')
  })
})

describe('nombre del evento en las operaciones', () => {
  // Ocho «mision.deshecha.error» resultaron ser ocho deshaceres correctos:
  // la rama de éxito reutilizaba el nombre del evento de fallo.
  it('la línea de éxito no se llama como la de fallo', () => {
    expect(eventoDeExito('mision.deshecha.error')).toBe('mision.deshecha.ok')
    expect(eventoDeExito('premio.canje.error')).toBe('premio.canje.ok')
  })

  it('también con el sufijo separado por guion bajo', () => {
    expect(eventoDeExito('mision.estrella_inmediata.alta_error')).toBe('mision.estrella_inmediata.alta.ok')
  })

  it('ningún nombre de éxito contiene ya la palabra error', () => {
    const eventos = [
      'mision.pedida.error',
      'mision.resuelta.error',
      'mision.deshecha.error',
      'mision.estrella_inmediata.alta_error',
      'mision.estrella_inmediata.aprobacion_error',
      'premio.canje.error',
      'premio.canje_resuelto.error'
    ]
    for (const e of eventos) expect(eventoDeExito(e)).not.toMatch(/error/)
  })
})

describe('origen de los errores globales', () => {
  it('marca como ajeno el «Script error.» sin fichero ni línea', () => {
    const salida = origenDelError({ message: 'Script error.', filename: '', lineno: 0, colno: 0 })
    expect(salida.ajeno).toBe(true)
    expect(salida.fichero).toBe('')
  })

  it('marca como propio un fallo del bundle, con su posición', () => {
    const salida = origenDelError({
      filename: 'https://elgremioapp.com/assets/index-abc.js',
      lineno: 412,
      colno: 77
    })
    expect(salida.ajeno).toBe(false)
    expect(salida.fichero).toMatch(/assets\/index-/)
    expect(salida.linea).toBe(412)
    expect(salida.columna).toBe(77)
  })

  it('no revienta si el evento no trae nada', () => {
    expect(origenDelError(undefined).ajeno).toBe(true)
    expect(origenDelError({}).linea).toBe(0)
  })
})
