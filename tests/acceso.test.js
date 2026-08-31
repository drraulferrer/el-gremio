import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import {
  argumentosDeEntrada,
  resultadoDeAlta,
  resultadoDeRecuperacion,
  validarClaveNueva,
  esRecuperacion,
  traducirAcceso,
  urlDeVuelta,
  MIN_CLAVE_NUEVA,
  resultadoDeEnlace,
  esConfirmacion,
  recordarIdentidadEnMarcha,
  hayIdentidadEnMarcha,
  olvidarIdentidadEnMarcha
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

describe('detección del enlace de confirmación', () => {
  // Es el hermano del de abajo, y hace falta por lo mismo: el enlace abre
  // sesión y la app tiene que enterarse. Aquí lo que hay que hacer después
  // no es una pantalla, es TERMINAR la conversión: hasta que corre, la
  // cuenta nueva no tiene ningún gremio.
  it('reconoce el hash de confirmar la cuenta', () => {
    expect(esConfirmacion('#access_token=abc&type=signup&expires_in=3600')).toBe(true)
  })

  it('y el de cambiar el correo', () => {
    expect(esConfirmacion('#type=email_change')).toBe(true)
    expect(esConfirmacion('', '?type=email')).toBe(true)
  })

  it('el de recuperar la contraseña NO es este', () => {
    // Si lo fuera, quien viene a cambiar la contraseña se comería una
    // llamada de más y, peor, las dos pantallas competirían por el turno.
    expect(esConfirmacion('#access_token=abc&type=recovery')).toBe(false)
  })

  it('una carga normal no lo es', () => {
    expect(esConfirmacion('', '')).toBe(false)
    expect(esConfirmacion('#/panel', '?perfil=3')).toBe(false)
  })
})

describe('la nota de que hay una identidad en marcha', () => {
  /** Un almacén de mentira, que además puede fingir estar roto. */
  function almacen({ rompe = false } = {}) {
    const datos = new Map()
    return {
      getItem: (k) => { if (rompe) throw new Error('modo privado'); return datos.get(k) ?? null },
      setItem: (k, v) => { if (rompe) throw new Error('modo privado'); datos.set(k, String(v)) },
      removeItem: (k) => { if (rompe) throw new Error('modo privado'); datos.delete(k) }
    }
  }

  it('se apunta al pedirla y se olvida al terminar', () => {
    const a = almacen()
    expect(hayIdentidadEnMarcha(a)).toBe(false)
    recordarIdentidadEnMarcha('Mia@Ejemplo.test', a)
    expect(hayIdentidadEnMarcha(a)).toBe(true)
    olvidarIdentidadEnMarcha(a)
    expect(hayIdentidadEnMarcha(a)).toBe(false)
  })

  it('el correo se guarda en minúsculas, como en la base', () => {
    const a = almacen()
    recordarIdentidadEnMarcha('  Mia@Ejemplo.test ', a)
    expect(a.getItem('gremio_identidad_en_marcha')).toBe('mia@ejemplo.test')
  })

  it('sin almacén no revienta nada: solo se pierde el matiz', () => {
    // En el modo privado de Safari `localStorage` existe y lanza al
    // escribir. Perder la nota significa callarse en vez de decir «ha
    // caducado»; eso es peor, no es grave, y desde luego no es motivo para
    // que la app no arranque.
    const roto = almacen({ rompe: true })
    expect(() => recordarIdentidadEnMarcha('x@y.test', roto)).not.toThrow()
    expect(hayIdentidadEnMarcha(roto)).toBe(false)
    expect(() => olvidarIdentidadEnMarcha(roto)).not.toThrow()
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

describe('la forma de la llamada de entrar', () => {
  // Este bloque existe por un fallo real, y de los caros de ver: el token
  // del captcha iba al lado de `email` y `password`, donde supabase-js lo
  // IGNORA en silencio. No hay error, no hay aviso: manda
  // `gotrue_meta_security: {}` y Supabase contesta «no captcha_token
  // found». Registrarse y recuperar la contraseña seguían funcionando
  // —esos sí lo llevan en `options`—, así que el único síntoma era que la
  // familia no podía entrar. Se cazó mirando el cuerpo de la petición en
  // el navegador, no en los tests, que es justo por lo que ahora hay uno.
  it('el token del captcha va DENTRO de options, nunca en la raíz', () => {
    const a = argumentosDeEntrada('a@b.com', 'secreta123', 'tok-123')
    expect(a.options.captchaToken).toBe('tok-123')
    expect(a.captchaToken).toBeUndefined()
  })

  it('sin token, options va vacío y no rompe nada', () => {
    const a = argumentosDeEntrada('a@b.com', 'secreta123', '')
    expect(a.options).toEqual({})
    expect(a.email).toBe('a@b.com')
    expect(a.password).toBe('secreta123')
  })

  it('las tres claves de arriba son las que espera supabase-js', () => {
    expect(Object.keys(argumentosDeEntrada('a@b.com', 'x', 't')).sort())
      .toEqual(['email', 'options', 'password'])
  })
})

describe('ninguna pantalla llama a Supabase Auth sin captcha', () => {
  // Esta es la versión general del test de arriba, y nace de que aquel no
  // bastó. El 30-ago la pantalla de conversión llamaba a `signUp` SIN
  // token: Supabase contestaba «400 captcha protection: request
  // disallowed», la cuenta no se creaba, no salía ningún correo, y la
  // pantalla decía «no se ha podido enviar el correo» — o sea que mandaba
  // a mirar una bandeja de entrada donde nunca iba a haber nada. Estuvo
  // así hasta el 31, y se encontró leyendo los Auth Logs del proyecto.
  //
  // El test de `argumentosDeEntrada` defendía la FORMA del argumento en un
  // sitio; este defiende que no haya un segundo sitio que se olvide.
  const raizSrc = new URL('../src/', import.meta.url)
  const leerSrc = (f) => readFileSync(new URL(f, raizSrc), 'utf8')

  // Las cuatro que Supabase protege con captcha cuando está encendido.
  const PROTEGIDAS = /supabase\.auth\.(signUp|signInWithPassword|resetPasswordForEmail|signInWithOtp)\s*\(/

  const pantallas = readdirSync(new URL('screens/', raizSrc))
    .filter((f) => f.endsWith('.jsx'))
    .filter((f) => PROTEGIDAS.test(leerSrc('screens/' + f)))

  it('el barrido encuentra las pantallas que las usan', () => {
    // Si algún día no encuentra ninguna es que el barrido se ha roto, no
    // que el problema se haya arreglado solo.
    expect(pantallas.sort()).toEqual(['Expandirse.jsx', 'Login.jsx'])
  })

  for (const fichero of pantallas) {
    it(`${fichero} pide token y lo manda dentro de options`, () => {
      const texto = leerSrc('screens/' + fichero)
      expect(texto, `${fichero} no dibuja el recuadro de Turnstile`)
        .toMatch(/<Captcha\b/)
      expect(texto, `${fichero} no manda ningún captchaToken`)
        .toContain('captchaToken')
      // Y en la raíz no, que es donde supabase-js lo ignora en silencio.
      expect(texto, `${fichero} manda el token al lado de email/password`)
        .not.toMatch(/^\s*captchaToken:/m)
    })
  }
})

// ------------------------------------------------------------------
// El enlace de entrada por correo.
//
// Fija las dos decisiones del magic link, que no son de interfaz:
//
//  · Sin cuenta NO se crea una: se pide con `shouldCreateUser: false`.
//    Por defecto Supabase la crearía, y una letra mal en el correo
//    dejaría a alguien dentro de un gremio vacío sin entender por qué.
//  · Y ese caso se cuenta con el MISMO mensaje que el camino bueno, para
//    no convertir la pantalla en un comprobador de qué familias existen.
// ------------------------------------------------------------------
describe('el enlace de entrada', () => {
  it('el camino bueno dice que ha salido, sin prometer que existe la cuenta', () => {
    const r = resultadoDeEnlace({ error: null })
    expect(r.estado).toBe('enviado')
    expect(r.mensaje).toMatch(/si ese correo tiene cuenta/i)
  })

  it('sin cuenta responde EXACTAMENTE lo mismo', () => {
    const bueno = resultadoDeEnlace({ error: null })
    const sinCuenta = resultadoDeEnlace({ error: { message: 'Signups not allowed for otp' } })
    expect(sinCuenta.estado).toBe('enviado')
    expect(sinCuenta.mensaje).toBe(bueno.mensaje)
  })

  it('y también con las otras formas del mismo error', () => {
    for (const m of ['Signup not allowed for otp', 'otp_disabled', 'signup_disabled']) {
      expect(resultadoDeEnlace({ error: { message: m } }).estado, m).toBe('enviado')
    }
  })

  it('un error de verdad sí se cuenta, y traducido', () => {
    const r = resultadoDeEnlace({ error: { message: 'For security purposes, you can only request this once every 60 seconds' } })
    expect(r.estado).toBe('error')
    expect(r.mensaje).toMatch(/demasiados intentos/i)
  })

  it('un fallo de red no se disfraza de enlace enviado', () => {
    const r = resultadoDeEnlace({ error: { message: 'Failed to fetch' } })
    expect(r.estado).toBe('error')
    expect(r.mensaje).toMatch(/sin conexión/i)
  })
})
