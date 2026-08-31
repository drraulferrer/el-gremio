import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ------------------------------------------------------------------
// Una cosa, un nombre.
//
// Sale del inventario de vocabulario del 31-ago, que se hizo porque la
// primera persona que usó esto dijo «es poco intuitivo todo». Contando
// solo prosa de pantalla salieron cinco palabras propias —identidad,
// llave, forjar, clave común, escalón— y la conclusión fue que el
// problema no era cuántas hay, sino que **una de ellas tenía cuatro
// nombres**: «la clave común», «la clave que comparte todo el mundo», «la
// clave que comparte toda la casa» y «el mismo correo y la misma
// contraseña», repartidos por tres pantallas que se visitan seguidas.
//
// Una palabra difícil bien usada se aprende. Cuatro sinónimos de lo mismo
// no se aprenden nunca, porque quien lee no sabe que son lo mismo.
//
// Ojo con lo que este fichero NO dice: en el CÓDIGO y en la base esa cosa
// se llama `compartida` (`credenciales.clase`), y ahí está bien. Son dos
// registros distintos a propósito: la base nombra estructuras y la
// pantalla habla con una familia. Por eso el barrido mira prosa y no
// comentarios ni identificadores.
// ------------------------------------------------------------------

const RAIZ = new URL('..', import.meta.url).pathname

function ficheros(dir) {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n)
    if (statSync(ruta).isDirectory()) return ficheros(ruta)
    return /\.jsx?$/.test(n) ? [ruta] : []
  })
}

const CODIGO = /=>|=|;|import |const |function |useState|className|\bawait\b|&&|\|\||\{|\}|\(|\)|\[|\]/

function sinComentarios(t) {
  return t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

/**
 * La prosa que de verdad se lee: nodos de texto de JSX y literales con
 * forma de frase. Se descarta todo lo que huela a sintaxis, que es lo que
 * ensuciaba el primer barrido y hacía contar `setIdentidadHecha` como si
 * fuera una palabra de la interfaz.
 */
function prosa(ruta) {
  const t = sinComentarios(readFileSync(ruta, 'utf8'))
  const bruto = [
    ...[...t.matchAll(/>([^<>]{6,400})</g)].map((m) => m[1]),
    ...[...t.matchAll(/'([^'\\\n]{15,300})'/g)].map((m) => m[1])
  ]
  return bruto
    .map((c) => c.replace(/\s+/g, ' ').trim())
    .filter((c) => !CODIGO.test(c) && c.split(' ').length >= 3 && /[a-záéíóúñ]{3}/.test(c))
}

const PANTALLAS = [
  ...ficheros(join(RAIZ, 'src/screens')),
  ...ficheros(join(RAIZ, 'src/components')),
  join(RAIZ, 'src/lib/expansion.js'),
  join(RAIZ, 'src/App.jsx')
]

const TODA_LA_PROSA = PANTALLAS.flatMap((f) => prosa(f).map((frase) => ({ f, frase })))

describe('la clave compartida se llama igual en todas partes', () => {
  it('el barrido encuentra prosa de sobra', () => {
    // Si esto se desploma, el extractor se ha roto y el resto del fichero
    // estaría dando verde sin mirar nada.
    expect(TODA_LA_PROSA.length).toBeGreaterThan(200)
  })

  it('«clave común» es el nombre, y se usa', () => {
    const conNombre = TODA_LA_PROSA.filter((x) => /clave com[úu]n/i.test(x.frase))
    expect(conNombre.length).toBeGreaterThanOrEqual(5)
  })

  it('y no hay ningún sinónimo suelto', () => {
    // Las tres formas que llegó a haber. `clave compartida` es el nombre
    // TÉCNICO —el de `credenciales.clase`— y en pantalla no pinta nada.
    const SINONIMOS = /clave que comparte|clave compartida|clave de (la )?casa/i
    const sueltos = TODA_LA_PROSA
      .filter((x) => SINONIMOS.test(x.frase))
      .map((x) => `${x.f.replace(RAIZ, '')}: «${x.frase.slice(0, 70)}»`)
    expect(sueltos, 'otra forma de nombrar la clave común').toEqual([])
  })

  it('pero explicarla sigue estando permitido', () => {
    // La diferencia entre un sinónimo y una glosa: el sinónimo compite con
    // el nombre, la glosa lo enseña. «Hoy toda la casa entra con el mismo
    // correo y la misma contraseña» describe, no rebautiza, y tiene que
    // poder decirse.
    const glosa = TODA_LA_PROSA.some((x) => /el mismo correo y la misma contrase/i.test(x.frase))
    expect(glosa, 'se ha perdido la explicación de qué es la clave común').toBe(true)
  })
})
