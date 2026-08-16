import { describe, it, expect } from 'vitest'
import {
  GRUPOS_EMOJI_PREMIO, EMOJIS_PREMIO, GRUPOS_EMOJI_MISION, EMOJIS_MISION,
  buscarEmoji, emojiSugerido
} from '../src/lib/emojis'
import { CATALOGO_PREMIOS } from '../src/lib/premios'
import { CATALOGO } from '../src/lib/tareas'
import { HABILIDADES } from '../src/lib/habilidades'

// ------------------------------------------------------------------
// Emojis de premio.
//
// Por qué esto merece tests: en la tienda de la peque el emoji es lo
// ÚNICO que se ve —no hay texto ni cifras—, así que dos premios con el
// mismo dibujo son, para ella, el mismo premio. Un duplicado en el
// catálogo no da error en ninguna parte y solo se nota en su pantalla.
// ------------------------------------------------------------------

describe('el catálogo', () => {
  it('tiene variedad de sobra y ningún emoji repetido', () => {
    const todos = EMOJIS_PREMIO.map((x) => x.e)
    expect(todos.length).toBeGreaterThanOrEqual(60)
    expect(new Set(todos).size).toBe(todos.length)
  })

  it('todos llevan nombre con el que buscarlos', () => {
    for (const x of EMOJIS_PREMIO) {
      expect(x.n, x.e).toBeTruthy()
      expect(x.n.length, x.e).toBeGreaterThan(3)
    }
  })

  it('los grupos tienen nombre y no están vacíos', () => {
    for (const g of GRUPOS_EMOJI_PREMIO) {
      expect(g.grupo).toBeTruthy()
      expect(g.emojis.length).toBeGreaterThanOrEqual(6)
    }
  })

  it('cubre los premios del catálogo del proyecto', () => {
    // Si un premio de la tienda inicial usa un emoji que no está aquí,
    // editarlo desde el panel lo cambiaría sin querer: la rejilla no
    // marcaría ninguno como elegido.
    const disponibles = new Set(EMOJIS_PREMIO.map((x) => x.e))
    const huerfanos = CATALOGO_PREMIOS.filter((p) => !disponibles.has(p.emoji)).map((p) => p.emoji)
    expect(huerfanos).toEqual([])
  })
})

describe('buscarEmoji', () => {
  it('encuentra por palabra suelta', () => {
    expect(buscarEmoji('piscina').map((x) => x.e)).toContain('🏊')
    expect(buscarEmoji('abuela').map((x) => x.e)).toContain('👵')
  })

  it('perdona acentos y mayúsculas', () => {
    // Nadie escribe «película» con tilde en una caja de búsqueda.
    expect(buscarEmoji('PELICULA').map((x) => x.e)).toContain('🎬')
    expect(buscarEmoji('musica').map((x) => x.e)).toContain('🎵')
  })

  it('sin búsqueda devuelve todo', () => {
    expect(buscarEmoji('')).toHaveLength(EMOJIS_PREMIO.length)
    expect(buscarEmoji('   ')).toHaveLength(EMOJIS_PREMIO.length)
  })

  it('y con algo que no existe, nada', () => {
    expect(buscarEmoji('zzzz')).toEqual([])
  })
})

describe('emojiSugerido', () => {
  it('acierta con los premios que de verdad se escriben', () => {
    expect(emojiSugerido('Elegir la peli del viernes')).toBe('🎬')
    expect(emojiSugerido('Ir a la piscina')).toBe('🏊')
    expect(emojiSugerido('Noche de juegos')).toBe('🎲')
    expect(emojiSugerido('Cinco minutos más de cuento')).toBe('📖')
    expect(emojiSugerido('Merienda de picnic en el campo')).toBe('🧺')
  })

  it('gana la palabra más larga, no la primera', () => {
    // «cuento» tiene que ganarle a «leer» aunque «leer» esté antes en el
    // mismo nombre del catálogo.
    expect(emojiSugerido('Leer un cuento en la cama')).toBe('📖')
  })

  it('no inventa: si no reconoce nada, deja el que venía', () => {
    expect(emojiSugerido('Zzz qqq')).toBe('🎁')
    expect(emojiSugerido('')).toBe('🎁')
    expect(emojiSugerido(null)).toBe('🎁')
    expect(emojiSugerido('Zzz qqq', '⭐')).toBe('⭐')
  })

  it('no se dispara con fragmentos de dos letras', () => {
    // Con umbral corto, cualquier título casaba con cualquier cosa.
    expect(emojiSugerido('La')).toBe('🎁')
    expect(emojiSugerido('De')).toBe('🎁')
  })
})

// ------------------------------------------------------------------
// Y los de misión, que son otro catálogo: una misión es una acción de la
// casa y el dibujo tiene que decir cuál de un vistazo, que es como lo lee
// la peque en su rejilla.
// ------------------------------------------------------------------

describe('los emojis de misión', () => {
  it('no repiten y hay de sobra', () => {
    const todos = EMOJIS_MISION.map((x) => x.e)
    expect(todos.length).toBeGreaterThanOrEqual(80)
    expect(new Set(todos).size).toBe(todos.length)
  })

  it('van agrupados por las ocho habilidades', () => {
    // No por zona de la casa: lo que se entrena no es la tarea, es la
    // competencia, y es la misma decisión que gobierna el resto.
    const grupos = GRUPOS_EMOJI_MISION.map((g) => g.grupo.toLocaleLowerCase('es'))
    expect(grupos).toHaveLength(HABILIDADES.length)
    for (const h of HABILIDADES) {
      const nombre = h.nombre.toLocaleLowerCase('es')
      expect(grupos, `falta el grupo de ${h.nombre}`).toContain(nombre)
    }
  })

  it('cubre TODOS los emojis del catálogo de tareas', () => {
    // Si una tarea de la biblioteca usa uno que no está en la rejilla,
    // editarla desde el panel se lo cambiaría sin querer.
    const disponibles = new Set(EMOJIS_MISION.map((x) => x.e))
    const usados = new Set(
      Object.values(CATALOGO).flatMap((grupos) => grupos.flatMap((g) => g.tareas)).map((t) => t.e)
    )
    expect([...usados].filter((e) => !disponibles.has(e))).toEqual([])
  })

  it('busca y sugiere dentro de su propio catálogo', () => {
    expect(buscarEmoji('dientes', EMOJIS_MISION).map((x) => x.e)).toEqual(['🪥'])
    expect(emojiSugerido('Cepillarse los dientes', '⭐', EMOJIS_MISION)).toBe('🪥')
    expect(emojiSugerido('Regar las plantas', '⭐', EMOJIS_MISION)).toBe('🪴')
    expect(emojiSugerido('Hacer la cama', '⭐', EMOJIS_MISION)).toBe('🛏️')
  })

  it('y no se mezcla con el de premios', () => {
    // Un premio no puede acabar con el emoji del inodoro.
    expect(emojiSugerido('Limpiar el inodoro', '⭐', EMOJIS_MISION)).toBe('🚽')
    expect(emojiSugerido('Limpiar el inodoro')).toBe('🎁')
  })
})
