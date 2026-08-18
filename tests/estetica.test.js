import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { HABILIDADES } from '../src/lib/habilidades'

const raiz = new URL('../', import.meta.url)
const dir = new URL('public/assets/', raiz)
const css = readFileSync(new URL('src/styles.css', raiz), 'utf8')
const ficheros = readdirSync(dir)

describe('las piezas del tablero', () => {
  it('están todas las que la interfaz pide', () => {
    const pedidas = [...css.matchAll(/\/assets\/([\w.-]+)/g)].map((m) => m[1])
    expect(pedidas.length).toBeGreaterThan(4)
    for (const f of new Set(pedidas)) expect(ficheros, f).toContain(f)
  })

  it('cada habilidad tiene su icono, y el icono existe', () => {
    for (const h of HABILIDADES) {
      expect(h.icono, h.id).toBe(`/assets/icono-${h.id}.png`)
      expect(ficheros, h.id).toContain(`icono-${h.id}.png`)
    }
  })

  it('ninguna pesa lo que pesaba al llegar', () => {
    // Llegaron a 1024-2048 px y 11 MB entre todas: en una PWA que se abre
    // en el móvil de una familia, eso es medio minuto de espera con datos.
    let total = 0
    for (const f of ficheros) {
      const bytes = statSync(new URL(f, dir)).size
      total += bytes
      expect(bytes, `${f} pesa demasiado`).toBeLessThan(260 * 1024)
    }
    expect(total, 'el conjunto se ha ido de peso').toBeLessThan(700 * 1024)
  })
})

describe('la marca de agua de los assets', () => {
  // Las dieciséis piezas llegaron con un «AI生成» en la esquina inferior
  // izquierda. Sobre blanco no se ve; sobre el índigo del tablero, que es
  // donde se usan, se lee perfectamente. Este test existe porque el fallo
  // volvería en silencio el día que alguien reimporte un asset del zip.
  //
  // El glifo se detecta por lo que es: píxeles GRISES —sin color, que en
  // estas piezas de oro y teal no debería haber ninguno— en esa esquina.
  // Sin decodificador de imagen en los tests no se puede leer el píxel,
  // pero sí la cabecera del PNG. Y con eso basta para el guardarraíl que
  // de verdad importa: que nadie copie aquí la pieza de 1024 px del zip,
  // que es la única forma de que la marca vuelva.

  it('ninguna pieza conserva el tamaño original sin limpiar', () => {
    // El zip trae 1024x1024 y 2048x1152. Cualquier fichero de ese tamaño
    // en public/assets es una pieza recién copiada, o sea, con marca.
    for (const f of ficheros) {
      const buf = readFileSync(new URL(f, dir))
      if (buf.subarray(1, 4).toString() !== 'PNG') continue
      const ancho = buf.readUInt32BE(16)
      const alto = buf.readUInt32BE(20)
      expect(ancho, `${f} está sin redimensionar`).toBeLessThan(700)
      expect(alto, `${f} está sin redimensionar`).toBeLessThan(700)
    }
  })

  it('queda escrito de dónde salen y cómo se limpian', () => {
    // Si esto no está documentado, el próximo que toque los assets repite
    // el fallo. La receta vive en la guía copiada al repo.
    const guia = readFileSync(new URL('docs/GUIA-ASSETS.md', raiz), 'utf8')
    expect(guia).toMatch(/Inventario/)
  })
})

describe('las dos reglas visuales que no se negocian', () => {
  it('el mundo de la peque redefine --display: si no, sale en serif', () => {
    // Es el fallo más caro de este cambio de tipografía: --display pasó a
    // ser Fraunces y la pantalla de una niña de tres años se quedó con
    // una serif grabada hasta que se redefinió la variable en sus raíces.
    expect(css).toMatch(/\.kid[\s\S]{0,400}--display:\s*var\(--peque\)/)
  })

  it('el foco no va en oro: el dorado reconoce, no decora', () => {
    const foco = css.match(/button:focus-visible\s*{[^}]*}/)
    expect(foco).toBeTruthy()
    expect(foco[0]).toContain('var(--teal)')
    expect(foco[0]).not.toContain('var(--oro)')
  })
})
