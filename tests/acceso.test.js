import { describe, it, expect } from 'vitest'
import {
  resultadoDeAlta,
  resultadoDeRecuperacion,
  validarClaveNueva,
  esRecuperacion,
  traducirAcceso,
  urlDeVuelta,
  MIN_CLAVE_NUEVA
} from '../src/lib/acceso'

describe('alta de cuenta', () => {
  it('con sesión, entra directamente', () => {
    const r = resultadoDeAlta({ data: { session: { access_token: 'x' } }, error: null })
    expect(r.estado).toBe('dentro')
  })

  // El caso que estuvo roto: ni error ni sesión. La pantalla se quedaba
  // igual que antes de pulsar y no había forma de saber que el correo
  // estaba en camino.
  it('sin sesión y sin error, avisa de que hay que confirmar el correo', () => {
    const r = resultadoDeAlta({ data: { user: { id: 'u1' }, session: null }, error: null })
    expect(r.estado).toBe('confirma')
    expect(r.mensaje).toMatch(/correo/i)
  })

  it('el error llega traducido, nunca en inglés', () => {
    const r = resultadoDeAlta({ data: null, error: { message: 'User already registered' } })
    expect(r.estado).toBe('error')
    expect(r.mensaje).toMatch(/Ya tengo cuenta/)
  })

  it('sin argumentos no revienta', () => {
    expect(resultadoDeAlta().estado).toBe('confirma')
  })
})

describe('recuperar la contraseña', () => {
  // Decisión: el mensaje NO puede depender de si el correo existe. Si
  // cambiara, la pantalla de acceso sería un comprobador de qué familias
  // están dadas de alta.
  it('dice lo mismo haya cuenta o no', () => {
    const r = resultadoDeRecuperacion({ error: null })
    expect(r.estado).toBe('enviado')
    expect(r.mensaje).toMatch(/Si ese correo tiene cuenta/)
  })

  it('el límite de intentos de Supabase se lee en cristiano', () => {
    const r = resultadoDeRecuperacion({ error: { message: 'For security purposes, you can only request this after 60 seconds' } })
    expect(r.mensaje).toMatch(/Demasiados intentos/)
  })
})

describe('contraseña nueva', () => {
  it('pide el mínimo largo', () => {
    expect(validarClaveNueva('corta', 'corta').ok).toBe(false)
    expect(validarClaveNueva('a'.repeat(MIN_CLAVE_NUEVA), 'a'.repeat(MIN_CLAVE_NUEVA)).ok).toBe(true)
  })

  it('las dos tienen que coincidir', () => {
    const r = validarClaveNueva('gremio2026', 'gremio2027')
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(/no coinciden/)
  })

  it('vacía no vale', () => {
    expect(validarClaveNueva('', '').ok).toBe(false)
  })
})

describe('detección del enlace de recuperación', () => {
  it('reconoce el hash que manda Supabase', () => {
    expect(esRecuperacion('#access_token=abc&type=recovery&expires_in=3600')).toBe(true)
  })

  it('reconoce el parámetro de consulta', () => {
    expect(esRecuperacion('', '?type=recovery')).toBe(true)
  })

  it('una carga normal no lo es', () => {
    expect(esRecuperacion('', '')).toBe(false)
    expect(esRecuperacion('#/panel', '?perfil=3')).toBe(false)
  })
})

describe('la url de vuelta del correo', () => {
  // Hoy la app vive en la raíz de su propio dominio, pero la regla que
  // importa sigue siendo la misma: la vuelta es la URL publicada COMPLETA.
  it('en el dominio propio es la raíz', () => {
    expect(urlDeVuelta('https://elgremioapp.com', '/')).toBe('https://elgremioapp.com/')
  })

  // Y si algún día vuelve a colgar de una subcarpeta —así estuvo en
  // usuario.github.io/el-gremio/—, un enlace a la raíz del dominio
  // llevaría a una página que no existe.
  it('conserva la subcarpeta de la publicación', () => {
    expect(urlDeVuelta('https://drraulferrer.github.io', '/el-gremio/'))
      .toBe('https://drraulferrer.github.io/el-gremio/')
  })

  it('no duplica la barra final del origen', () => {
    expect(urlDeVuelta('http://localhost:5173/', '/')).toBe('http://localhost:5173/')
  })
})

describe('traducción de mensajes de acceso', () => {
  it('credenciales, confirmación y red', () => {
    expect(traducirAcceso('Invalid login credentials')).toMatch(/incorrectos/)
    expect(traducirAcceso('Email not confirmed')).toMatch(/confirmar/)
    expect(traducirAcceso('Failed to fetch')).toMatch(/Sin conexión/)
  })

  it('lo que no conoce lo deja pasar tal cual, nunca lo esconde', () => {
    expect(traducirAcceso('algo rarísimo del servidor')).toBe('algo rarísimo del servidor')
  })
})
