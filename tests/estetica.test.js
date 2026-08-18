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

describe('el mundo de la peque no se puede arrastrar', () => {
  // El fallo: `.kid-cabecera` iba a sangre con `width:100vw` +
  // `margin-left:50%` + `transform:translateX(-50%)`. El transform la
  // devolvía a su sitio A LA VISTA, pero los transforms no cuentan para
  // `scrollWidth`, así que la caja de layout seguía midiendo 563 px dentro
  // de un contenedor de 375. Y como `.kid` tiene `overflow-y:auto` —que
  // por la regla de CSS de que `visible` no puede convivir con otro valor
  // fuerza `overflow-x:auto`—, esos 188 px se volvían scroll horizontal:
  // la pantalla de la peque se arrastraba y se salía del móvil.
  // Sin comentarios: el bloque de `.kid-cabecera` EXPLICA el fallo citando
  // `width:100vw`, y sin quitarlos el test se dispararía con su propia
  // documentación.
  const bloque = (sel) => {
    const i = css.indexOf(`\n${sel} {`)
    if (i < 0) return ''
    return css.slice(i, css.indexOf('\n}', i)).replace(/\/\*[\s\S]*?\*\//g, '')
  }

  it('la cabecera va a sangre con márgenes negativos, no con 100vw', () => {
    const cab = bloque('.kid-cabecera')
    expect(cab).toBeTruthy()
    expect(cab, 'vuelve el desbordamiento horizontal').not.toMatch(/width:\s*100vw/)
    expect(cab, 'vuelve el desbordamiento horizontal').not.toMatch(/margin-left:\s*50%/)
    expect(cab).toMatch(/margin-left:\s*calc\(-1 \* var\(--kid-margen-izq\)\)/)
    expect(cab).toMatch(/margin-right:\s*calc\(-1 \* var\(--kid-margen-der\)\)/)
  })

  it('el margen lateral es UNA variable, no dos valores sueltos', () => {
    // Si el padding del contenedor y el margen negativo de la cabecera se
    // escriben por separado, vuelven a desincronizarse en cuanto alguien
    // toque uno. Incluida la media query de pantalla ancha.
    const kid = bloque('.kid')
    expect(kid).toMatch(/--kid-margen-izq:/)
    expect(kid).toMatch(/--kid-margen-der:/)
    expect(kid).toMatch(/padding:[^;]*var\(--kid-margen-der\)[^;]*var\(--kid-margen-izq\)/)
    expect(css, 'la media query ancha debe mover la variable, no el padding')
      .not.toMatch(/\.kid \{\s*padding-inline:/)
  })

  it('las capas fijas del mundo peque contienen el rebote de iOS', () => {
    // Sin `overscroll-behavior`, el rebote elástico se propaga al
    // documento y la capa entera se arrastra fuera de la pantalla.
    for (const sel of ['.kid', '.kid-tienda']) {
      expect(bloque(sel), `${sel} sin contención`).toMatch(/overscroll-behavior:\s*contain/)
    }
  })
})

describe('el icono de la app instalada', () => {
  const publico = readdirSync(new URL('public/', raiz))
  const html = readFileSync(new URL('index.html', raiz), 'utf8')
  const manifiesto = JSON.parse(readFileSync(new URL('public/manifest.webmanifest', raiz), 'utf8'))

  it('apple-touch-icon es PNG: iOS no admite SVG ahí', () => {
    // Con un SVG, iOS no puede leerlo y pone en el escritorio una
    // miniatura de la web en vez del emblema.
    const m = html.match(/<link rel="apple-touch-icon"[^>]*>/)
    expect(m).toBeTruthy()
    expect(m[0]).toMatch(/\.png/)
    expect(m[0]).not.toMatch(/\.svg/)
  })

  it('están los ficheros de las rutas que iOS sondea SOLO', () => {
    // La trampa que costó el segundo intento: iOS pide
    // /apple-touch-icon.png y /apple-touch-icon-precomposed.png por su
    // cuenta, sin leer el HTML. Como vercel.json reescribe todo lo que no
    // existe a index.html, esas rutas devolvían 200 con HTML; iOS daba el
    // 200 por bueno, no podía decodificarlo y pintaba una «E».
    //
    // En Vercel el fichero estático gana al rewrite, así que basta con
    // que existan. Si alguien los borra por parecer duplicados, vuelve la
    // letra y nadie relaciona una cosa con la otra.
    for (const f of ['apple-touch-icon.png', 'apple-touch-icon-precomposed.png', 'favicon.ico']) {
      expect(publico, `falta ${f}: iOS lo sondea solo`).toContain(f)
    }
  })

  it('el rewrite catch-all sigue ahí, que es lo que hace necesarios esos ficheros', () => {
    // Si algún día se quita, este test recuerda por qué existían.
    const vercel = JSON.parse(readFileSync(new URL('vercel.json', raiz), 'utf8'))
    const pillaTodo = vercel.rewrites?.some((r) => r.source === '/(.*)' && r.destination === '/index.html')
    expect(pillaTodo).toBe(true)
  })

  it('el manifiesto declara tamaños y tiene un icono maskable', () => {
    expect(manifiesto.icons.length).toBeGreaterThanOrEqual(2)
    for (const i of manifiesto.icons) {
      expect(i.type, i.src).toBe('image/png')
      expect(i.sizes, i.src).toMatch(/^\d+x\d+$/)
      expect(publico, i.src).toContain(i.src.replace('./', ''))
    }
    expect(manifiesto.icons.some((i) => i.purpose === 'maskable')).toBe(true)
  })

  it('el color del manifiesto es el índigo nuevo, no el viejo', () => {
    expect(manifiesto.theme_color).toBe('#141428')
    expect(manifiesto.background_color).toBe('#141428')
    expect(html).toContain('content="#141428"')
  })

  it('no queda nadie apuntando al icono viejo', () => {
    expect(publico).not.toContain('icon.svg')
    const sw = readFileSync(new URL('public/sw.js', raiz), 'utf8')
    expect(sw).not.toMatch(/icon\.svg/)
  })
})
