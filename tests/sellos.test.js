import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import {
  SELLOS, SELLOS_V1, SELLOS_LEGADO, MATERIALES, GRADOS_OFICIO,
  selloDeInsignia, selloPorId, INSIGNIAS_CON_SELLO, BLOQUES, SELLOS_EN_BLOQUES
} from '../src/lib/sellos'
import { INSIGNIAS, insigniaPorCodigo } from '../src/lib/insignias'
import { HABILIDADES } from '../src/lib/habilidades'

const raiz = new URL('../', import.meta.url)
const dir = new URL('public/assets/insignias/', raiz)
// Solo las imágenes: alguna herramienta deja su caché dentro de la
// carpeta y no es una pieza del catálogo.
const ficheros = new Set(readdirSync(dir).filter((f) => !f.startsWith('.')))

// ------------------------------------------------------------------
// Los sellos son SOLO la capa visual: el motor sigue siendo el de las 16
// de `insignias.js`. Por eso este fichero comprueba dos cosas y ninguna
// más: que el catálogo visual está entero y que ninguna insignia viva se
// queda sin cara. Lo que concede cada insignia se prueba en
// `insignias.test.js`, y ahí se queda.
// ------------------------------------------------------------------

describe('el catálogo de sellos', () => {
  it('tiene las 73 del catálogo v1 y las 7 de legado', () => {
    expect(SELLOS_V1).toHaveLength(73)
    expect(SELLOS_LEGADO).toHaveLength(7)
    expect(SELLOS).toHaveLength(80)
  })

  it('no repite ningún id ni ninguna imagen', () => {
    const ids = SELLOS.map((s) => s.id)
    expect(new Set(ids).size, 'hay ids repetidos').toBe(ids.length)
    const srcs = SELLOS.map((s) => s.src)
    expect(new Set(srcs).size, 'dos sellos comparten imagen').toBe(srcs.length)
  })

  it('cada sello tiene su fichero en el disco', () => {
    for (const s of SELLOS) {
      const nombre = s.src.split('/').pop()
      expect(ficheros, `falta la imagen de ${s.id}`).toContain(nombre)
    }
  })

  it('no sobra ninguna imagen sin sello que la use', () => {
    // Un .webp huérfano viaja al bundle y no lo pide nadie. Se nota aquí
    // o no se nota nunca.
    const usadas = new Set(SELLOS.map((s) => s.src.split('/').pop()))
    for (const f of ficheros) expect(usadas, `${f} no la usa ningún sello`).toContain(f)
  })

  it('usa solo materiales de la escala', () => {
    const validos = new Set([...MATERIALES, 'descubrimiento'])
    for (const s of SELLOS) expect(validos, s.id).toContain(s.material)
  })

  it('las ocho habilidades tienen sus cuatro grados', () => {
    for (const h of HABILIDADES) {
      const camino = SELLOS_V1.filter((s) => s.habilidad === h.id)
      expect(camino, h.id).toHaveLength(4)
      expect(camino.map((s) => s.grado)).toEqual(GRADOS_OFICIO)
    }
  })

  it('el material sube dentro de un camino de oficio, nunca baja', () => {
    // Es TODA la promesa visual del sistema: si un grado alto sale en un
    // metal peor que el anterior, la escala deja de significar nada.
    for (const h of HABILIDADES) {
      const orden = SELLOS_V1
        .filter((s) => s.habilidad === h.id)
        .map((s) => MATERIALES.indexOf(s.material))
      for (let i = 1; i < orden.length; i++) {
        expect(orden[i], `${h.id} baja de material en el grado ${i + 1}`).toBeGreaterThan(orden[i - 1])
      }
    }
  })
})

describe('cada insignia viva tiene su cara', () => {
  it('las 16 que hoy se conceden tienen sello', () => {
    for (const b of INSIGNIAS) {
      expect(selloDeInsignia(b.code), `${b.code} se quedaría en emoji`).toBeTruthy()
    }
    expect(INSIGNIAS_CON_SELLO).toHaveLength(INSIGNIAS.length)
  })

  it('no hay dos insignias compartiendo el mismo sello', () => {
    // Dos insignias con la misma imagen se leen como la misma insignia.
    const usados = INSIGNIAS.map((b) => selloDeInsignia(b.code).id)
    expect(new Set(usados).size).toBe(usados.length)
  })

  it('x10, x25 y x50 salen en tres metales DISTINTOS', () => {
    // Estrictamente distintos, no «que no bajen»: con 01/02/03 las tres
    // caían en bronce y en la rejilla parecían la misma insignia tres
    // veces. Un escalón que no se ve no es un escalón.
    const escalones = ['x10', 'x25', 'x50']
      .map((c) => MATERIALES.indexOf(selloDeInsignia(c).material))
    expect(escalones[1], 'x25 no se distingue de x10').toBeGreaterThan(escalones[0])
    expect(escalones[2], 'x50 no se distingue de x25').toBeGreaterThan(escalones[1])
  })

  it('las dos rachas tampoco comparten metal', () => {
    const [siete, veintiuno] = ['racha7', 'racha21']
      .map((c) => MATERIALES.indexOf(selloDeInsignia(c).material))
    expect(veintiuno).toBeGreaterThan(siete)
  })

  it('una insignia que no existe no revienta: devuelve null', () => {
    expect(selloDeInsignia('no_existe')).toBeNull()
    expect(selloPorId('no_existe')).toBeNull()
  })
})

describe('lo que pesan', () => {
  // El tablero entero tiene 700 KB de tope porque se carga SIEMPRE. Los
  // sellos son otra cosa: 80 piezas que solo bajan al abrir Progreso, y
  // solo las que se ven (`loading="lazy"`). Aun así llevan tope propio,
  // porque «está en diferido» es justo la excusa con la que una carpeta
  // crece hasta los 20 MB sin que nadie lo mire.
  it('ninguna pasa de 20 KB y el conjunto cabe en 1,2 MB', () => {
    let total = 0
    for (const f of ficheros) {
      const bytes = statSync(new URL(f, dir)).size
      total += bytes
      expect(bytes, `${f} pesa demasiado`).toBeLessThan(20 * 1024)
    }
    expect(total, 'la colección se ha ido de peso').toBeLessThan(1.2 * 1024 * 1024)
  })

  it('son WebP: en PNG esto mismo pesaba trece veces más', () => {
    for (const f of ficheros) expect(f, f).toMatch(/\.webp$/)
  })
})

describe('los dos catálogos no se mezclan al contar', () => {
  // El fallo: la cabecera de la rejilla vieja decía «N de 16» con N
  // contando TODO lo que tiene el perfil. Desde que el motor concede
  // sellos, eso incluye los del catálogo v1: cinco viejas y ocho sellos
  // se leían como «13 de 16», y con más de dieciséis sellos habría dicho
  // «20 de 16».
  const badges = [
    'primera', 'x10', 'x25', 'x50', 'madrugador',
    'inicio_primer_encargo', 'ritmo_01', 'ritmo_02', 'ritmo_03',
    'trayectoria_01', 'trayectoria_02', 'oficio_hogar_1', 'exploracion_5_familias'
  ]

  it('el contador de la rejilla vieja solo cuenta las dieciséis', () => {
    const mias = new Set(badges)
    const misInsignias = new Set([...mias].filter((code) => insigniaPorCodigo(code)))
    expect(mias.size).toBe(13)
    expect(misInsignias.size).toBe(5)
    expect(misInsignias.size).toBeLessThanOrEqual(INSIGNIAS.length)
  })

  it('ni con el catálogo entero se pasa de dieciséis', () => {
    // La garantía que importa: el numerador no puede superar al
    // denominador pase lo que pase.
    const todo = new Set([...INSIGNIAS.map((b) => b.code), ...SELLOS_V1.map((s) => s.id)])
    const soloViejas = new Set([...todo].filter((code) => insigniaPorCodigo(code)))
    expect(soloViejas.size).toBe(INSIGNIAS.length)
  })

  it('los dos vocabularios no comparten ningún código', () => {
    // Si un sello se llamara igual que una insignia vieja, este filtro
    // lo contaría en el sitio equivocado y nadie se enteraría.
    const viejas = new Set(INSIGNIAS.map((b) => b.code))
    const chocan = SELLOS_V1.filter((s) => viejas.has(s.id)).map((s) => s.id)
    expect(chocan).toEqual([])
  })
})

describe('el catálogo se puede recorrer entero', () => {
  it('los seis bloques contienen las 73, sin dejarse ninguna', () => {
    // Si un sello no está en ningún bloque, existe en el motor y no hay
    // forma de verlo en la app: exactamente el estado del que venimos.
    expect(SELLOS_EN_BLOQUES).toHaveLength(SELLOS_V1.length)
    const enBloques = new Set(SELLOS_EN_BLOQUES.map((s) => s.id))
    const fuera = SELLOS_V1.filter((s) => !enBloques.has(s.id)).map((s) => s.id)
    expect(fuera, 'sellos inalcanzables desde la interfaz').toEqual([])
  })

  it('ningún bloque repite un sello', () => {
    const ids = SELLOS_EN_BLOQUES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cada sello tiene nombre propio', () => {
    const sinNombre = SELLOS_V1.filter((s) => !s.nombre).map((s) => s.id)
    expect(sinNombre).toEqual([])
  })

  it('dos sellos de la MISMA serie nunca comparten nombre', () => {
    // El fallo que fija: el nombre se derivaba de la categoría, así que
    // las tres piezas de «Actividades distintas» se llamaban las tres
    // «Nuevos caminos». Tres cromos idénticos en la misma fila.
    for (const bloque of BLOQUES) {
      for (const serie of bloque.series) {
        const nombres = serie.sellos.map((s) => s.nombre)
        expect(new Set(nombres).size, `${serie.nombre} repite nombre: ${nombres.join(', ')}`)
          .toBe(nombres.length)
      }
    }
  })

  it('ningún nombre se repite en todo el catálogo', () => {
    const nombres = SELLOS_V1.map((s) => s.nombre)
    const repetidos = nombres.filter((n, i) => nombres.indexOf(n) !== i)
    expect(repetidos).toEqual([])
  })
})
