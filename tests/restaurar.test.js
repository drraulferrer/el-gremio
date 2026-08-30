import { describe, it, expect } from 'vitest'
import { refDeUrl, censura } from '../scripts/restaurar.mjs'

// ------------------------------------------------------------------
// El destino de una restauración se elige con una cadena de conexión
// (RESTAURAR_DB_URL), y de ella cuelgan las dos protecciones del script:
//
//   · sacar el ref para poder decir "esto es PRODUCCIÓN, para";
//   · no imprimir nunca la contraseña que lleva dentro.
//
// Las dos son funciones puras, así que se pueden probar sin tocar ninguna
// base. Que no las hubiera es parte de por qué la restauración llevaba
// desde agosto sin funcionar y nadie se había enterado.
// ------------------------------------------------------------------

describe('sacar el ref de la cadena de conexión', () => {
  it('conexión directa', () => {
    expect(refDeUrl('postgresql://postgres:x@db.chfbrawsoulfiywiqhpe.supabase.co:5432/postgres'))
      .toBe('chfbrawsoulfiywiqhpe')
  })

  it('a través del pooler, donde el ref va en el usuario', () => {
    expect(refDeUrl('postgresql://postgres.wcbhfoxitpejcqrthwkc:x@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'))
      .toBe('wcbhfoxitpejcqrthwkc')
  })

  it('lo que no reconoce lo dice, en vez de inventarse un ref', () => {
    // Devolver null es lo que dispara el aviso de "no he podido comprobar
    // que esto no sea produccion". Un ref inventado seria mucho peor: la
    // comprobacion pasaria y no habria protegido nada.
    expect(refDeUrl('postgresql://postgres:x@localhost:5432/postgres')).toBe(null)
    expect(refDeUrl('')).toBe(null)
    expect(refDeUrl(undefined)).toBe(null)
  })
})

describe('la contraseña no se imprime nunca', () => {
  it('la tapa en una cadena suelta', () => {
    const salida = censura('postgresql://postgres:s3cr3t-largo@db.abc.supabase.co:5432/postgres')
    expect(salida).not.toContain('s3cr3t-largo')
    expect(salida).toContain('•••')
  })

  it('la tapa dentro de un error del CLI, que es por donde se escaparía', () => {
    const error = 'failed to connect to postgresql://postgres.abc:hunter2@aws-0.pooler.supabase.com:6543/postgres: timeout'
    const salida = censura(error)
    expect(salida).not.toContain('hunter2')
    expect(salida).toContain('timeout')
  })

  it('tapa el valor literal de la variable, aunque no sea una URL', () => {
    // El caso real: alguien copia del panel solo la contrasena, el CLI la
    // devuelve cruda en «failed to parse connection string: …» y la primera
    // regla no la reconoce porque no hay URL donde buscarla.
    const salida = censura('failed to parse connection string: wOnhW6A2mn6QYKNR', 'wOnhW6A2mn6QYKNR')
    expect(salida).not.toContain('wOnhW6A2mn6QYKNR')
    expect(salida).toContain('•••')
  })

  it('un secreto demasiado corto no convierte la salida en un tachon', () => {
    // Sin el minimo, un valor de dos letras taparia media salida.
    expect(censura('error de red', 'ed')).toBe('error de red')
  })

  it('no se atraganta con lo que no lleva contraseña', () => {
    expect(censura('todo bien', null)).toBe('todo bien')
    expect(censura(null, null)).toBe('')
  })
})
