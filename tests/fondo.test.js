import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// Guardián del parpadeo del fondo.
//
// La luz ambiental estuvo montada dentro de varias ramas del `return` de
// App. Al cambiar de pantalla React la desmontaba, la animación CSS
// volvía a cero y el fondo pegaba un salto de casi cien píxeles: eso era
// lo que se veía como parpadeo.
//
// Estos tests leen el código fuente en vez de renderizar, porque lo que
// hay que garantizar es estructural: que la capa se monte UNA vez y
// FUERA de cualquier rama condicional.
// ------------------------------------------------------------------

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const cssCrudo = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

// Sin comentarios: si no, buscar "fixed" encuentra el comentario que
// explica por qué se quitó `background-attachment: fixed`, y el test se
// autoengaña. Pasó a la primera.
const css = cssCrudo.replace(/\/\*[\s\S]*?\*\//g, '')

describe('la luz ambiental no se desmonta', () => {
  it('se monta exactamente una vez', () => {
    const montajes = app.match(/<Ambiente\s*\/>/g) || []
    expect(montajes).toHaveLength(1)
  })

  it('se monta con la forma exacta que garantiza que no se desmonta', () => {
    // Anclar la estructura completa es más fiable que recortar el fichero
    // por índices: esta forma solo se cumple si la capa está por encima de
    // todas las ramas y hermana del contenido.
    expect(app).toMatch(/return \(\s*<>\s*<Ambiente \/>\s*\{contenido\(\)\}\s*<\/>\s*\)/)
  })

  it('la función que decide la pantalla existe y devuelve por ramas', () => {
    expect(app).toContain('function contenido()')
    expect(app.indexOf('function contenido()')).toBeLessThan(app.indexOf('<Ambiente />'))
  })

  it('no cuelga de un operador condicional', () => {
    expect(/\?\s*<Ambiente/.test(app)).toBe(false)
    expect(/&&\s*<Ambiente/.test(app)).toBe(false)
  })
})

describe('el fondo no usa recursos que parpadean en iOS', () => {
  it('el body no lleva background-attachment: fixed', () => {
    // En Safari de iOS repinta mal al hacer scroll. El degradado vive
    // ahora en .ambiente, que sí se compone en su propia capa.
    const cuerpo = css.slice(css.indexOf('\nbody {'), css.indexOf('#root {'))
    expect(/background[^;]*\bfixed\b/.test(cuerpo)).toBe(false)
  })

  it('la capa ambiental se promueve a capa propia', () => {
    const bloque = css.slice(css.indexOf('.ambiente {'), css.indexOf('.ambiente span {'))
    expect(bloque).toMatch(/transform:\s*translateZ\(0\)/)
  })

  it('las manchas solo animan transform, nunca posición ni tamaño', () => {
    const claves = css.match(/@keyframes derivar-[abc][^}]*}[^}]*}/g) || []
    expect(claves.length).toBe(3)
    for (const k of claves) {
      expect(k).toMatch(/transform:/)
      expect(/\b(left|top|right|bottom|width|height):/.test(k), k).toBe(false)
    }
  })

  it('se paran con prefers-reduced-motion', () => {
    const i = css.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(css.slice(i, i + 400)).toMatch(/\.ambiente span\s*\{\s*animation:\s*none/)
  })
})
