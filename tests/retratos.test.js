import { describe, it, expect } from 'vitest'
import {
  FASES, NIVEL_TOPE, PIELES, PELOS, PEINADOS,
  faseDeNivel, faseDePerfil, piezasDe, hexDe, llevaFigura
} from '../src/lib/retratos'
import { plantillaCompleta, marcasDe, flex } from '../src/lib/genero'

const xpDeNivel = (n) => 50 * n * (n - 1)

describe('la escalera de fases', () => {
  it('empieza en el nivel 1 y acaba en el tope', () => {
    expect(FASES[0].nivel).toBe(1)
    expect(FASES[FASES.length - 1].nivel).toBe(NIVEL_TOPE)
  })

  it('sube de nivel y de fase sin saltos ni repeticiones', () => {
    const niveles = FASES.map((f) => f.nivel)
    expect([...niveles].sort((a, b) => a - b)).toEqual(niveles)
    expect(new Set(niveles).size).toBe(niveles.length)
    expect(FASES.map((f) => f.n)).toEqual(FASES.map((_, i) => i + 1))
  })

  // Los niveles están puestos en hitos de calendario, no en números
  // redondos. Si alguien los "arregla" a 5-10-15-20, este test cae: lo
  // que defiende es que entre dos fases no pasen años de golpe.
  it('reparte el tiempo, no los niveles', () => {
    const XP_DIA_ADULTO = 48
    const dias = FASES.map((f) => xpDeNivel(f.nivel) / XP_DIA_ADULTO)
    expect(Math.round(dias[1])).toBeLessThanOrEqual(10) // la 2ª, dentro de la 1ª semana
    expect(Math.round(dias[2])).toBeLessThanOrEqual(40) // la 3ª, dentro del 1er mes
    // A partir de la tercera, ninguna fase tarda mucho más del doble que
    // la anterior en llegar: es lo que impide que aparezca un salto de
    // años de golpe si alguien retoca un nivel.
    //
    // El primer salto queda fuera del bucle y no por comodidad: de la
    // fase 1 a la 2 hay 6 días y de la 2 a la 3 hay 25, un factor 4. Es
    // deliberado —la fase 2 está puesta dentro de la primera semana para
    // que se vea algo enseguida— y las dos comprobaciones de arriba ya lo
    // sujetan por otro lado.
    for (let i = 3; i < dias.length; i++) {
      // El máximo real hoy es exactamente 2,5, en la fase 4. El 2,6 deja
      // un dedo de holgura para retoques que no cambien la forma.
      expect(dias[i] - dias[i - 1]).toBeLessThan(2.6 * (dias[i - 1] - dias[i - 2]))
    }
  })

  it('por encima del tope se queda en la última, no se rompe', () => {
    expect(faseDeNivel(NIVEL_TOPE).n).toBe(FASES.length)
    expect(faseDeNivel(NIVEL_TOPE + 1).n).toBe(FASES.length)
    expect(faseDeNivel(500).n).toBe(FASES.length)
  })

  it('por debajo del primer nivel tampoco', () => {
    expect(faseDeNivel(0).n).toBe(1)
    expect(faseDeNivel(-3).n).toBe(1)
  })

  it('cada fase empieza justo en su nivel y ni uno antes', () => {
    for (const f of FASES) {
      expect(faseDeNivel(f.nivel).n).toBe(f.n)
      if (f.n > 1) expect(faseDeNivel(f.nivel - 1).n).toBe(f.n - 1)
    }
  })

  it('todas las fases dicen qué equipo añaden', () => {
    for (const f of FASES) expect(f.equipo.length).toBeGreaterThan(3)
  })
})

describe('los nombres hablan a las tres personas', () => {
  it('ninguna marca de género se queda a medias', () => {
    for (const f of FASES) {
      expect(plantillaCompleta(f.nombre), `${f.nombre} → ${JSON.stringify(marcasDe(f.nombre))}`).toBe(true)
    }
  })

  it('y las tres formas dan texto, no un hueco', () => {
    for (const f of FASES) {
      for (const g of ['femenino', 'masculino', 'neutro']) {
        const t = flex(f.nombre, g)
        expect(t).not.toMatch(/[{}|]/)
        expect(t.trim().length).toBeGreaterThan(2)
      }
    }
  })
})

describe('la marca de agua', () => {
  // Deshacer devuelve la XP. Si el personaje se desvistiera al deshacer,
  // deshacer se sentiría como un castigo y la familia dejaría de hacerlo.
  it('la fase la manda la XP máxima, no la de ahora', () => {
    const perfil = { xp: xpDeNivel(12), xp_maxima: xpDeNivel(20) }
    expect(faseDePerfil(perfil).n).toBe(faseDeNivel(20).n)
  })

  it('sin xp_maxima manda la XP actual, que es lo que hay', () => {
    expect(faseDePerfil({ xp: xpDeNivel(20) }).n).toBe(faseDeNivel(20).n)
  })

  it('un perfil recién creado está en la fase 1 y no revienta', () => {
    expect(faseDePerfil({}).n).toBe(1)
    expect(faseDePerfil(null).n).toBe(1)
    expect(faseDePerfil({ xp: null, xp_maxima: undefined }).n).toBe(1)
  })

  it('nunca baja: más XP nunca da una fase anterior', () => {
    let previa = 0
    for (let xp = 0; xp < xpDeNivel(NIVEL_TOPE + 4); xp += 977) {
      const n = faseDePerfil({ xp }).n
      expect(n).toBeGreaterThanOrEqual(previa)
      previa = n
    }
  })
})

describe('las piezas', () => {
  it('un perfil sin columnas nuevas sale dibujable igualmente', () => {
    const p = piezasDe({ name: 'de antes' })
    expect(PIELES.some((x) => x.id === p.piel)).toBe(true)
    expect(PELOS.some((x) => x.id === p.pelo)).toBe(true)
    expect(PEINADOS.some((x) => x.id === p.peinado)).toBe(true)
  })

  it('una pieza que ya no está en el catálogo cae al valor por defecto', () => {
    const p = piezasDe({ retrato_piel: 'turquesa', retrato_peinado: 'mohicano' })
    expect(PIELES.some((x) => x.id === p.piel)).toBe(true)
    expect(p.peinado).toBe('corto')
  })

  it('y una que sí está se respeta', () => {
    const p = piezasDe({ retrato_piel: 'oscura', retrato_pelo: 'rubio', retrato_peinado: 'rizado' })
    expect(p).toEqual({ piel: 'oscura', pelo: 'rubio', peinado: 'rizado' })
  })

  it('los catálogos no tienen ids repetidos', () => {
    for (const lista of [PIELES, PELOS, PEINADOS]) {
      const ids = lista.map((x) => x.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('todo color de pieza es un hex de verdad', () => {
    for (const lista of [PIELES, PELOS]) {
      for (const x of lista) expect(x.hex).toMatch(/^#[0-9a-f]{6}$/i)
    }
    expect(hexDe(PIELES, 'no-existe')).toBe(PIELES[0].hex)
  })
})

describe('las mascotas', () => {
  it('llevan medallón, no figura', () => {
    expect(llevaFigura({ role: 'mascota', species: 'perro' })).toBe(false)
    expect(llevaFigura({ role: 'mascota', species: 'gato' })).toBe(false)
  })

  it('las personas sí llevan figura, los tres roles', () => {
    for (const role of ['adulto', 'junior', 'peque']) {
      expect(llevaFigura({ role })).toBe(true)
    }
  })
})
