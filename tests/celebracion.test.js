import { describe, it, expect } from 'vitest'
import {
  marcaDe,
  queCelebrar,
  ESCALONES,
  escalonDe,
  duracionCelebracion,
  estrellasDe,
  EXTRA_ELOGIO_MS
} from '../src/lib/celebracion'

describe('los tres escalones', () => {
  it('están ordenados: una chispa no puede pesar como un hito', () => {
    // Esta es toda la idea. Si los tres duraran lo mismo, subir de nivel
    // no se distinguiría de un martes cualquiera, que es donde estábamos.
    expect(ESCALONES.chispa.ms).toBeLessThan(ESCALONES.normal.ms)
    expect(ESCALONES.normal.ms).toBeLessThan(ESCALONES.hito.ms)
  })

  it('el escalón grande también trae más estrellas, no solo más tiempo', () => {
    // Alargar la misma animación no la hace más grande, la hace más
    // lenta, que es lo contrario de celebrar.
    expect(ESCALONES.chispa.estrellas).toBeLessThan(ESCALONES.normal.estrellas)
    expect(ESCALONES.normal.estrellas).toBeLessThan(ESCALONES.hito.estrellas)
  })

  it('el de en medio es el que ya había, y no se toca', () => {
    // 1.900 ms llevan desde la 1.0 sin que nadie se queje: son la
    // referencia contra la que se miden los otros dos.
    expect(ESCALONES.normal.ms).toBe(1900)
    expect(ESCALONES.normal.estrellas).toBe(10)
  })

  it('solo el de en medio va sin clase: es el aspecto de siempre', () => {
    expect(ESCALONES.normal.clase).toBe('')
    expect(ESCALONES.chispa.clase).not.toBe('')
    expect(ESCALONES.hito.clase).not.toBe('')
  })
})

describe('pedir un escalón', () => {
  it('devuelve el que se pide', () => {
    expect(escalonDe('hito')).toBe(ESCALONES.hito)
  })

  it('ante cualquier cosa rara cae al de en medio en vez de tirar', () => {
    // Una celebración es lo último que puede romper una pantalla.
    expect(escalonDe('fiesta-mayor')).toBe(ESCALONES.normal)
    expect(escalonDe(undefined)).toBe(ESCALONES.normal)
    expect(escalonDe(null)).toBe(ESCALONES.normal)
  })
})

describe('cuánto se queda en pantalla', () => {
  it('sin elogio, lo que diga el escalón', () => {
    expect(duracionCelebracion('chispa')).toBe(ESCALONES.chispa.ms)
    expect(duracionCelebracion('hito')).toBe(ESCALONES.hito.ms)
  })

  it('con elogio, lo suficiente para leerlo', () => {
    // El elogio lo escribe otra persona y es la pieza que de verdad
    // tiene efecto. Por debajo de un par de segundos se vuelve un
    // parpadeo.
    expect(duracionCelebracion('normal', true)).toBe(1900 + EXTRA_ELOGIO_MS)
    expect(EXTRA_ELOGIO_MS).toBeGreaterThanOrEqual(1500)
  })

  it('el extra del elogio se suma igual en todos los escalones', () => {
    // Leer una frase cuesta lo mismo en una chispa que en un hito, así
    // que se suma en vez de multiplicar.
    for (const nombre of Object.keys(ESCALONES)) {
      expect(duracionCelebracion(nombre, true) - duracionCelebracion(nombre, false)).toBe(EXTRA_ELOGIO_MS)
    }
  })
})

describe('la lluvia de estrellas', () => {
  it('sale entera en condiciones normales', () => {
    expect(estrellasDe('hito')).toBe(ESCALONES.hito.estrellas)
  })

  it('con menos movimiento no cae ninguna, en ningún escalón', () => {
    // La caja con el texto se queda: quien pide menos movimiento sigue
    // necesitando saber que la misión se aprobó. Lo que se va es la
    // lluvia, que es puro movimiento.
    for (const nombre of Object.keys(ESCALONES)) {
      expect(estrellasDe(nombre, true)).toBe(0)
    }
  })
})

// ------------------------------------------------------------------
// Qué se celebra entre dos cargas.
//
// EL FALLO QUE FIJAN ESTOS TESTS: la memoria de «lo que ya se ha visto»
// vivía dentro de Home, y Home se desmonta al entrar en el panel
// parental, que es justo donde se valida. Al salir montaba de cero y la
// primera pasada solo tomaba la referencia: quien validaba su propia
// misión no veía la celebración NUNCA. Con un adulto y un móvil, siempre.
//
// Por eso la regla es una función pura y la memoria vive en App: lo que
// no se puede probar es lo que llega al móvil de casa roto.
// ------------------------------------------------------------------
describe('qué se celebra entre dos cargas', () => {
  const c = (id, extra = {}) => ({ id, xp: 10, coins: 4, praise: null, ...extra })

  it('sin marca previa no se celebra nada', () => {
    // Abrir la app no puede sacar de golpe la fiesta de todo lo de ayer.
    expect(queCelebrar({ antes: null, aprobadas: [c('a'), c('b')], nivel: 3, profileId: 'p1' })).toBe(null)
  })

  it('una validación nueva se celebra en el escalón de todos los días', () => {
    const antes = marcaDe({ aprobadas: [c('a')], nivel: 3, profileId: 'p1' })
    const f = queCelebrar({ antes, aprobadas: [c('a'), c('b')], nivel: 3, profileId: 'p1' })
    expect(f.intensidad).toBe('normal')
    expect(f.texto).toMatch(/\+10 XP/)
    expect(f.emoji).toBe('🌟')
  })

  it('la marca SOBREVIVE a que la pantalla se destruya y se vuelva a montar', () => {
    // Esto es el fallo, dicho en un test: la marca se toma antes de
    // entrar en el panel y se compara al salir. Si la memoria viviera en
    // la pantalla, aquí no habría con qué comparar.
    const antesDeEntrarAlPanel = marcaDe({ aprobadas: [c('a')], nivel: 3, profileId: 'p1' })
    const alSalirDelPanel = [c('a'), c('b', { praise: 'Te ha costado y lo has hecho igual.' })]
    const f = queCelebrar({ antes: antesDeEntrarAlPanel, aprobadas: alSalirDelPanel, nivel: 3, profileId: 'p1' })
    expect(f).not.toBe(null)
    expect(f.elogio).toBe('Te ha costado y lo has hecho igual.')
  })

  it('varias de golpe se suman en UNA sola celebración', () => {
    // Validar cinco seguidas en el panel no puede sacar cinco pantallas.
    const antes = marcaDe({ aprobadas: [], nivel: 3, profileId: 'p1' })
    const f = queCelebrar({ antes, aprobadas: [c('a'), c('b'), c('c')], nivel: 3, profileId: 'p1' })
    expect(f.texto).toMatch(/\+30 XP/)
    expect(f.texto).toMatch(/12/)
  })

  it('sin Talis no se escribe el importe', () => {
    const antes = marcaDe({ aprobadas: [], nivel: 3, profileId: 'p1' })
    const f = queCelebrar({ antes, aprobadas: [c('a', { coins: 0 })], nivel: 3, profileId: 'p1' })
    expect(f.texto).toBe('+10 XP')
  })

  it('subir de nivel gana a la misión que lo subió', () => {
    // Dos celebraciones seguidas por el mismo gesto le quitan valor a la
    // grande, que es lo que la escala venía a proteger.
    const antes = marcaDe({ aprobadas: [], nivel: 3, profileId: 'p1' })
    const f = queCelebrar({ antes, aprobadas: [c('a')], nivel: 4, profileId: 'p1' })
    expect(f.intensidad).toBe('hito')
    expect(f.texto).toBe('¡Nivel 4!')
  })

  it('nada nuevo, nada que celebrar', () => {
    const antes = marcaDe({ aprobadas: [c('a')], nivel: 3, profileId: 'p1' })
    expect(queCelebrar({ antes, aprobadas: [c('a')], nivel: 3, profileId: 'p1' })).toBe(null)
  })

  it('al cambiar de perfil no se hereda la fiesta de otra persona', () => {
    // La tablet compartida: si la marca de una valiera para la otra, al
    // entrar la segunda vería celebrado lo que hizo la primera.
    const antes = marcaDe({ aprobadas: [], nivel: 3, profileId: 'p1' })
    expect(queCelebrar({ antes, aprobadas: [c('z')], nivel: 3, profileId: 'p2' })).toBe(null)
  })
})

// ------------------------------------------------------------------
// El cambio de fase del retrato.
//
// Sin esto, ganar el manto o encender el farol no se anunciaba en ningún
// sitio: las listas dibujan solo la cabeza, así que el equipo nuevo
// aparecía y nadie se enteraba. La fase se celebra en el momento en que
// pasa, que es el único momento en que significa algo.
// ------------------------------------------------------------------
describe('subir de fase', () => {
  const marca = (nivel) => marcaDe({ aprobadas: [], nivel, profileId: 'p1' })
  const fiesta = (antesNivel, nivel, genero = 'neutro') =>
    queCelebrar({ antes: marca(antesNivel), aprobadas: [], nivel, profileId: 'p1', genero })

  it('la fase gana al nivel: una sola fiesta por el mismo gesto', () => {
    const f = fiesta(13, 14)
    expect(f.fase).toBe(5)
    expect(f.texto).not.toMatch(/Nivel/)
    // El número no se pierde, baja a la nota.
    expect(f.nota).toMatch(/nivel 14/)
  })

  it('dice qué equipo se ha ganado, que es lo que hay que ver', () => {
    expect(fiesta(37, 38).nota).toMatch(/[Ff]arol encendido/)
  })

  // El nombre de una fase lleva las tres formas. Sin flexionar, la
  // celebración enseñaba «{Decana|Decano|Decanato}» en pantalla: lo pilló
  // un test como este, no la pantalla.
  it('el nombre sale flexionado y sin llaves, en los tres géneros', () => {
    for (const g of ['femenino', 'masculino', 'neutro']) {
      const f = fiesta(19, 20, g)
      expect(f.texto, g).not.toMatch(/[{}|]/)
      expect(f.texto.length, g).toBeGreaterThan(3)
    }
    expect(fiesta(19, 20, 'femenino').texto).not.toBe(fiesta(19, 20, 'masculino').texto)
  })

  it('subir de nivel sin cambiar de fase sigue celebrando el nivel de siempre', () => {
    const f = fiesta(15, 16)
    expect(f.fase).toBeUndefined()
    expect(f.texto).toBe('¡Nivel 16!')
  })

  it('sin marca previa no se celebra nada, tampoco una fase', () => {
    expect(queCelebrar({ antes: null, aprobadas: [], nivel: 50, profileId: 'p1' })).toBeNull()
  })
})
