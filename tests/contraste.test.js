import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// El contraste de la paleta, calculado y no supuesto.
//
// Sale de la revisión de usabilidad del 31-ago. Los colores de TEXTO ya
// estaban bien —los siete pasan AA sobre las tres superficies— pero el
// contorno de los controles no: `--linea` da 1,2-1,6:1, y el relleno de
// un campo tampoco salvaba la papeleta (1,05-1,33:1 contra la superficie
// donde se posa). O sea que un campo de texto era casi invisible hasta
// enfocarlo. El anillo de foco, en cambio, siempre estuvo bien.
//
// Lo que este fichero defiende no es un color: es la SEPARACIÓN. Hay dos
// tokens porque hacen dos cosas distintas, y fundirlos en uno rompe algo
// en cualquiera de las dos direcciones —o se apagan los controles, o se
// encienden las 45 rayas decorativas de la app—.
// ------------------------------------------------------------------

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

/** El valor de una variable CSS declarada en `:root`. */
function token(nombre) {
  const m = css.match(new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})`))
  return m ? m[1] : null
}

function luminancia(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/** El cociente de contraste de WCAG entre dos colores. */
function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

const SUPERFICIES = ['tablero', 'carta', 'carta-alta']
const TEXTOS = ['tinta', 'tinta-suave', 'oro', 'teal', 'coral', 'exito']

describe('el texto pasa AA sobre las tres superficies', () => {
  for (const t of TEXTOS) {
    it(`--${t}`, () => {
      const color = token(t)
      expect(color, `falta el token --${t}`).toBeTruthy()
      for (const s of SUPERFICIES) {
        const r = contraste(color, token(s))
        expect(r, `--${t} sobre --${s} da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})

describe('el contorno de un control pasa 1.4.11', () => {
  it('--filo-control llega a 3:1 en la peor superficie', () => {
    // 3:1 es lo que WCAG pide para «la información visual necesaria para
    // identificar un componente de interfaz». Un campo cuyo filo no llega
    // es un campo que hay que adivinar.
    const filo = token('filo-control')
    expect(filo, 'falta el token --filo-control').toBeTruthy()
    for (const s of [...SUPERFICIES, 'tablero-hondo']) {
      const r = contraste(filo, token(s))
      expect(r, `--filo-control sobre --${s} da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
    }
  })

  it('y el anillo de foco también, que es la otra mitad de la regla', () => {
    for (const s of [...SUPERFICIES, 'tablero-hondo']) {
      expect(contraste(token('teal'), token(s))).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('los dos tokens de filo son dos, y a propósito', () => {
  it('`--linea` NO llega a 3:1, y no pasa nada: es decoración', () => {
    // Está escrito como expectativa y no como queja: si algún día alguien
    // la sube, este test cae y le obliga a mirar las 45 rayas que toca.
    const r = contraste(token('linea'), token('carta'))
    expect(r).toBeLessThan(3)
  })

  it('ningún control se ha quedado con la raya decorativa', () => {
    // Los doce controles del reparto. Si alguien añade un control nuevo
    // con `--linea`, esta lista deja de cuadrar.
    const CONTROLES = [
      'input, select, textarea', '.btn-fantasma',
      '.grid-emojis button, .grid-colores button', '.picker-perfil',
      '.detalle-cerrar', '.boton-peque', '.plan-toggle', '.dia-casilla',
      '.setup-opcion', '.ver-catalogo > summary', '.plegable > summary',
      '.pausadas-bloque > summary'
    ]
    for (const sel of CONTROLES) {
      // El bloque de ese selector que declara un filo.
      const bloques = [...css.matchAll(new RegExp(
        '^' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'gm'
      ))].map((m) => m[1]).filter((b) => /border[^:]*:/.test(b))
      const conFilo = bloques.find((b) => b.includes('--filo-control') || b.includes('--linea'))
      expect(conFilo, `${sel} no declara ningún filo`).toBeTruthy()
      expect(conFilo, `${sel} sigue con la raya decorativa`).toContain('--filo-control')
    }
  })

  it('y quedan rayas decorativas de sobra, o sea que no se subió todo', () => {
    // Si esto llegara a cero, alguien habría «arreglado» el contraste
    // encendiendo la app entera, que es justo lo que no se quería.
    expect((css.match(/var\(--linea\)/g) || []).length).toBeGreaterThan(30)
  })
})
