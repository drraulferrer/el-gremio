import { describe, it, expect } from 'vitest'
import {
  GRUPOS_EMOJI_PREMIO, EMOJIS_PREMIO, buscarEmojiPremio, emojiSugerido
} from '../src/lib/emojis'
import { CATALOGO_PREMIOS } from '../src/lib/premios'

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

describe('buscarEmojiPremio', () => {
  it('encuentra por palabra suelta', () => {
    expect(buscarEmojiPremio('piscina').map((x) => x.e)).toContain('🏊')
    expect(buscarEmojiPremio('abuela').map((x) => x.e)).toContain('👵')
  })

  it('perdona acentos y mayúsculas', () => {
    // Nadie escribe «película» con tilde en una caja de búsqueda.
    expect(buscarEmojiPremio('PELICULA').map((x) => x.e)).toContain('🎬')
    expect(buscarEmojiPremio('musica').map((x) => x.e)).toContain('🎵')
  })

  it('sin búsqueda devuelve todo', () => {
    expect(buscarEmojiPremio('')).toHaveLength(EMOJIS_PREMIO.length)
    expect(buscarEmojiPremio('   ')).toHaveLength(EMOJIS_PREMIO.length)
  })

  it('y con algo que no existe, nada', () => {
    expect(buscarEmojiPremio('zzzz')).toEqual([])
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
