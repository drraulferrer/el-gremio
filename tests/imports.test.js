import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ------------------------------------------------------------------
// Un componente usado sin importar NO rompe el build.
//
// Vite empaqueta tan tranquilo y el fallo aparece en pantalla como
// `ReferenceError`, en la ruta concreta donde vive ese componente. Pasó
// dos veces cableando el retrato —Cuadro y Panorama, las dos por añadir
// el JSX y olvidar la línea de arriba— y las dos veces el build dio
// verde. Es exactamente la clase de fallo contra la que avisa el
// CLAUDE.md: pasa el build y los tests y solo se ve abriendo la app.
//
// Este test recorre el árbol y comprueba que todo lo que se usa como
// <Componente ...> está importado o definido en el mismo fichero.
// ------------------------------------------------------------------

function ficheros(dir) {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n)
    if (statSync(ruta).isDirectory()) return ficheros(ruta)
    return /\.jsx?$/.test(n) ? [ruta] : []
  })
}

// Mayúscula inicial = componente. Se dejan fuera las etiquetas con punto
// (<Foo.Bar>), que se resuelven por el objeto y no por el nombre suelto.
const USO = /<([A-Z][A-Za-z0-9]*)[\s/>]/g

// Los comentarios se quitan antes de mirar: este proyecto documenta los
// componentes en prosa —«se pinta con <Talis n={...} />»— y sin esto el
// primer falso positivo llega en el primer fichero bien escrito.
function sinComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('nada se usa sin importar', () => {
  const rutas = ficheros('src')

  for (const ruta of rutas) {
    const codigo = sinComentarios(readFileSync(ruta, 'utf8'))
    const usados = [...new Set([...codigo.matchAll(USO)].map((m) => m[1]))]
    if (usados.length === 0) continue

    it(ruta, () => {
      const faltan = usados.filter((nombre) => {
        const importado = new RegExp(
          `import\\s+(\\{[^}]*\\b${nombre}\\b[^}]*\\}|${nombre}\\b)`
        ).test(codigo)
        const definido = new RegExp(
          `(function|const|class)\\s+${nombre}\\b`
        ).test(codigo)
        return !importado && !definido
      })
      expect(faltan, `${ruta}: usa <${faltan.join('>, <')}> sin importarlo`).toEqual([])
    })
  }
})
