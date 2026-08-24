import { describe, it, expect } from 'vitest'
import {
  FASES, NIVEL_TOPE, PIELES, PELOS, PEINADOS,
  faseDeNivel, faseDePerfil, piezasDe, hexDe, llevaFigura,
  PALETA_RETRATO, contraste, GAFAS, TUNICAS, BARBAS, FLEQUILLOS,
  admiteFlequillo, usaColorDePelo, colorDeRaya, MIN_RAYA, faseSiguiente, hayFaseNueva, DIAS_CERCA
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

  it('y una que sí está se respeta, las siete', () => {
    const p = piezasDe({
      retrato_piel: 'oscura', retrato_pelo: 'rubio', retrato_peinado: 'rizado',
      retrato_gafas: 'redondas', retrato_tunica: 'musgo', retrato_barba: 'perilla',
      retrato_flequillo: 'cortina'
    })
    expect(p).toEqual({
      piel: 'oscura', pelo: 'rubio', peinado: 'rizado',
      gafas: 'redondas', tunica: 'musgo', barba: 'perilla', flequillo: 'cortina'
    })
  })

  // Los perfiles de antes de la 037 no traen ni gafas ni túnica. Salen
  // con la cara de siempre en vez de rotos, que es lo que permite
  // desplegar el cliente antes de que nadie haya elegido nada.
  it('un perfil sin las piezas nuevas sale como salía', () => {
    const p = piezasDe({ retrato_piel: 'clara', retrato_peinado: 'largo' })
    expect(p.gafas).toBe('ninguna')
    expect(p.tunica).toBe('perfil')
    expect(p.barba).toBe('ninguna')
    expect(p.flequillo).toBe('recto')
  })

  // 'perfil' no es un color: es la regla «usa la del miembro». Si algún
  // día se le pone un hex, el aro y la túnica vuelven a ir a juego
  // siempre y la separación deja de servir para nada.
  it('la túnica por defecto no tiene color propio', () => {
    expect(TUNICAS.find((t) => t.id === 'perfil').hex).toBeNull()
    expect(TUNICAS.filter((t) => t.hex === null)).toHaveLength(1)
  })

  it('los catálogos no tienen ids repetidos', () => {
    for (const lista of [PIELES, PELOS, PEINADOS, GAFAS, TUNICAS, BARBAS, FLEQUILLOS]) {
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

// ------------------------------------------------------------------
// El contraste del arco de fase.
//
// Estos tests existen por un fallo que llegó a producción: el arco de
// progreso iba en oro directamente sobre el aro del miembro, y el oro no
// contrasta con ningún color de la paleta. En un perfil ámbar el progreso
// era invisible. Nadie lo había medido: se miraba a ojo, y a ojo colaba
// porque el fondo oscuro de alrededor hacía el trabajo.
//
// Cambiar el oro por otro color no era opción: la hoja de estilo dice que
// el dorado no decora, RECONOCE. La salida fue un canal oscuro bajo el
// arco. Esto vigila que siga habiendo separación.
// ------------------------------------------------------------------
describe('el arco de fase se ve sobre cualquier miembro', () => {
  const { oro, canal } = PALETA_RETRATO

  it('el oro destaca contra su canal', () => {
    expect(contraste(oro, canal)).toBeGreaterThan(4.5)
  })

  it('y el canal destaca contra todo color de miembro, incluidos los cálidos', () => {
    // Los seis de COLORS más dos cálidos elegidos a mano por la familia,
    // que son los que destaparon el fallo.
    const colores = ['#ff6b6b', '#4ecdc4', '#a78bfa', '#ffd166', '#6ee7a0', '#7fb3ff',
                     '#ff9f43', '#c9a227']
    for (const c of colores) {
      expect(contraste(canal, c), `canal vs ${c}`).toBeGreaterThan(3)
    }
  })

  // Deja constancia de por qué hizo falta el canal: sin él, esto es lo
  // que había. Si alguien lo quita "porque se ve bien", que lea esto.
  it('sin canal no se veía: el oro sobre el color pelado no llega ni a 1,5', () => {
    for (const c of ['#4ecdc4', '#ffd166', '#ff9f43']) {
      expect(contraste(oro, c), `oro vs ${c}`).toBeLessThan(1.6)
    }
  })

  it('la función de contraste dice lo que debe en los extremos', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contraste('#4fc4b5', '#4fc4b5')).toBeCloseTo(1, 5)
  })
})

// ------------------------------------------------------------------
// Lo que falta para la fase siguiente.
//
// La decisión que fijan: NO se enseña siempre. De la fase 7 a la 8 hay
// dos años con la economía real, y una cuenta atrás de años no empuja,
// deshincha. Solo se habla de la siguiente cuando está a la vista.
// ------------------------------------------------------------------
describe('la fase siguiente solo se enseña si está cerca', () => {
  const xp = (n) => 50 * n * (n - 1)

  it('al principio sí, que es cuando hace falta el empujón', () => {
    const cerca = faseSiguiente({ xp: xp(1) })
    expect(cerca).not.toBeNull()
    expect(cerca.fase.n).toBe(2)
    expect(cerca.dias).toBeLessThanOrEqual(DIAS_CERCA)
  })

  it('en los tramos largos se calla en vez de dar una cifra de años', () => {
    for (const nivel of [26, 37, 49]) {
      expect(faseSiguiente({ xp: xp(nivel) }), `nivel ${nivel}`).toBeNull()
    }
  })

  it('en la última fase no hay siguiente y no revienta', () => {
    expect(faseSiguiente({ xp: xp(50) })).toBeNull()
    expect(faseSiguiente({ xp: xp(200) })).toBeNull()
  })

  it('nunca dice que faltan menos de cero', () => {
    expect(faseSiguiente({ xp: xp(3) - 1 }).faltan).toBeGreaterThan(0)
  })

  it('quien gana más deprisa la ve antes', () => {
    const lento = faseSiguiente({ xp: xp(9) }, 48)
    const rapido = faseSiguiente({ xp: xp(9) }, 72)
    expect(rapido.dias).toBeLessThan(lento.dias)
  })
})

describe('el aviso de fase nueva', () => {
  it('salta justo en el nivel de cada fase y no antes', () => {
    for (const f of FASES.slice(1)) {
      expect(hayFaseNueva(f.nivel - 1, f.nivel), `fase ${f.n}`).toBe(true)
      expect(hayFaseNueva(f.nivel, f.nivel + 1), `fase ${f.n} otra vez`).toBe(false)
    }
  })

  it('subir de nivel sin cambiar de fase no lo dispara', () => {
    expect(hayFaseNueva(15, 16)).toBe(false)
  })

  it('un salto grande lo dispara una sola vez', () => {
    expect(hayFaseNueva(1, 20)).toBe(true)
  })
})

// ------------------------------------------------------------------
// Los mandos que aparecen y desaparecen.
//
// Fijan dos quejas concretas de uso: el color de pelo se escondía al
// marcar «sin pelo», y la barba va de ese color, así que había que
// ponerse un peinado, elegir el color y volver a quitárselo.
// ------------------------------------------------------------------
describe('qué mandos tienen sentido', () => {
  it('sin pelo pero con barba, el color de pelo sigue haciendo falta', () => {
    expect(usaColorDePelo({ peinado: 'calvo', barba: 'corta' })).toBe(true)
    expect(usaColorDePelo({ peinado: 'calvo', barba: 'bigote' })).toBe(true)
  })

  it('sin pelo y sin barba, no pinta nada y se retira', () => {
    expect(usaColorDePelo({ peinado: 'calvo', barba: 'ninguna' })).toBe(false)
  })

  it('con pelo siempre hace falta, haya barba o no', () => {
    expect(usaColorDePelo({ peinado: 'largo', barba: 'ninguna' })).toBe(true)
  })

  it('el flequillo no se ofrece donde no hay nada que peinar', () => {
    expect(admiteFlequillo('calvo')).toBe(false)
    expect(admiteFlequillo('rapado')).toBe(false)
    for (const p of ['corto', 'largo', 'rizado', 'coleta', 'mono', 'trenzas']) {
      expect(admiteFlequillo(p), p).toBe(true)
    }
  })
})

describe('las barbas con bigote', () => {
  it('están en el catálogo como opción propia, no como segundo mando', () => {
    const ids = BARBAS.map((b) => b.id)
    expect(ids).toContain('cortabigote')
    expect(ids).toContain('largabigote')
  })

  it('todas tienen nombre legible', () => {
    for (const b of BARBAS) expect(b.nombre.length).toBeGreaterThan(3)
  })
})

// ------------------------------------------------------------------
// La raya del flequillo de cortina.
//
// La primera versión de la cortina abría un pico en mitad de la frente y
// se leía como una calva. La segunda cubre la frente y solo deja una raya
// fina, pero entonces la raya tiene que VERSE: en rubio sobre piel pálida
// piel y pelo contrastan 1,85 y la raya desaparecía, con lo que la
// cortina volvía a parecer un flequillo recto.
//
// Cuarto fallo de contraste del retrato. Por eso este test recorre las 64
// combinaciones en vez de mirar tres a ojo.
// ------------------------------------------------------------------
describe('la raya del pelo se ve sobre cualquier cabeza', () => {
  it('ninguna de las 64 combinaciones de piel y pelo baja del mínimo', () => {
    for (const piel of PIELES) {
      for (const pelo of PELOS) {
        const raya = colorDeRaya(piel.hex, pelo.hex)
        expect(
          contraste(raya, pelo.hex),
          `${piel.id} + ${pelo.id}`
        ).toBeGreaterThanOrEqual(MIN_RAYA - 0.01)
      }
    }
  })

  it('y son 64, no vaya a ser que el catálogo se vacíe y el test pase solo', () => {
    expect(PIELES.length * PELOS.length).toBe(64)
  })

  it('la raya es más oscura que la piel: es sombra, no un hueco', () => {
    const raya = colorDeRaya('#f0c9a8', '#2b2118')
    expect(contraste(raya, '#ffffff')).toBeGreaterThan(contraste('#f0c9a8', '#ffffff'))
  })
})
