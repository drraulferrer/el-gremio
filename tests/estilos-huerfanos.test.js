import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ------------------------------------------------------------------
// Ninguna clase de la interfaz se queda sin su regla.
//
// Nace de un fallo que estuvo semanas vivo y que no vio nadie, porque no
// rompe nada: **`.aviso` no existía**. Diez mensajes de seis pantallas
// —las de las fases 6 y 7— se pintaban como prosa normal, sin color, sin
// filo y sin peso. «El PIN no es correcto» tenía exactamente el mismo
// aspecto que el párrafo explicativo de encima.
//
// Y lo que lo hacía invisible desde dentro: los diez llevan `role="alert"`,
// así que la app se lo contaba perfectamente a un lector de pantalla. El
// build daba verde, el linter daba verde y los tests daban verde, porque
// una clase que no existe es CSS que no se aplica, no un error.
//
// Aquí se cruzan las dos listas, que es lo único que lo caza: las clases
// que el JSX pide y las que la hoja define.
// ------------------------------------------------------------------

const RAIZ = new URL('..', import.meta.url).pathname
const leer = (f) => readFileSync(join(RAIZ, f), 'utf8')

function ficheros(dir) {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n)
    if (statSync(ruta).isDirectory()) return ficheros(ruta)
    return /\.jsx?$/.test(n) ? [ruta] : []
  })
}

/** Toda clase que aparece en un selector de la hoja. */
function definidas() {
  return new Set([...leer('src/styles.css').matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]))
}

/**
 * Las clases que pide el JSX, con el fichero donde salen.
 *
 * Solo los `className="…"` literales. Los calculados —`className={x ? 'a' :
 * 'b'}`— quedan fuera a propósito: perseguirlos pediría entender el
 * fichero, y lo que este test defiende es lo barato de defender.
 */
function pedidas() {
  const mapa = new Map()
  for (const ruta of ficheros(join(RAIZ, 'src'))) {
    for (const m of readFileSync(ruta, 'utf8').matchAll(/className="([^"{}]+)"/g)) {
      for (const clase of m[1].split(/\s+/).filter(Boolean)) {
        if (!mapa.has(clase)) mapa.set(clase, new Set())
        mapa.get(clase).add(ruta.replace(RAIZ, ''))
      }
    }
  }
  return mapa
}

// Envoltorios sin estilo: existen como marca de lo que contienen y no
// piden nada a la hoja. Se declaran uno a uno, y esa es la gracia: la
// lista se compara ENTERA, así que una clase nueva sin regla cae aquí
// aunque su autor la creyera igual de inofensiva.
const SIN_REGLA_A_PROPOSITO = [
  'colecciones',
  'editor-retrato',
  'kid-ficha',
  'panorama',
  'panorama-semana',
  'selector-emoji'
]

describe('toda clase que pide el JSX tiene su regla en la hoja', () => {
  const hoja = definidas()
  const usadas = pedidas()
  const huerfanas = [...usadas.keys()].filter((c) => !hoja.has(c)).sort()

  it('el barrido encuentra la interfaz entera', () => {
    // Si esto baja de golpe es que el barrido se ha roto, no que la app
    // haya adelgazado.
    expect(usadas.size).toBeGreaterThan(300)
    expect(hoja.size).toBeGreaterThan(300)
  })

  it('y las únicas sin regla son las declaradas', () => {
    const nuevas = huerfanas.filter((c) => !SIN_REGLA_A_PROPOSITO.includes(c))
    const donde = nuevas.map((c) => `${c} (${[...usadas.get(c)].sort().join(', ')})`)
    expect(donde, 'clases pedidas por el JSX que la hoja no define').toEqual([])
  })

  it('y la lista de excepciones no envejece sola', () => {
    // Si alguien le da estilo a una de ellas, o la retira del JSX, hay que
    // sacarla de la lista. Comparar lista contra lista es lo que obliga.
    const sobran = SIN_REGLA_A_PROPOSITO.filter((c) => !huerfanas.includes(c))
    expect(sobran, 'excepciones que ya no hacen falta').toEqual([])
  })
})

describe('el aviso, que es el que se perdió', () => {
  const css = leer('src/styles.css')

  it('tiene regla, y no solo sus primas', () => {
    expect(css).toMatch(/^\.aviso \{/m)
    expect(css).toMatch(/^\.aviso-bien \{/m)
  })

  it('no se distingue solo por el color', () => {
    // La regla que se incumple sola cuando uno tiñe el fondo y ya está.
    // Filo izquierdo grueso y peso: quien no vea el rojo lo ve igual.
    const regla = css.slice(css.indexOf('\n.aviso {'), css.indexOf('\n.aviso-bien {'))
    expect(regla).toMatch(/border-left:\s*3px/)
    expect(regla).toMatch(/font-weight:\s*600/)
  })

  it('lo que dice el servidor se anuncia, además de verse', () => {
    // Los diez `role="alert"` ya estaban antes que la regla; lo que
    // faltaba era la mitad visual. Que sigan estando.
    const conAlerta = ficheros(join(RAIZ, 'src'))
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/className="aviso"[^>]*/g)].map((m) => m[0]))
    expect(conAlerta.length).toBeGreaterThan(5)
    for (const uso of conAlerta) expect(uso).toContain('role="alert"')
  })
})
