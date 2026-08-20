import { describe, it, expect } from 'vitest'
import { SELLOS_V1, selloPorId, esSecreto } from '../src/lib/sellos'
import { loreDeSello, loreDeInsignia, condicionDe, poderDeInsignia } from '../src/lib/sellos-lore'
import { INSIGNIAS, PODERES_LISTOS, insigniaPorCodigo } from '../src/lib/insignias'

describe('cada sello sabe contarse', () => {
  it('los 73 tienen significado, lore e implicaciones', () => {
    for (const s of SELLOS_V1) {
      const t = loreDeSello(s)
      expect(t, s.id).toBeTruthy()
      for (const campo of ['significado', 'lore', 'implica']) {
        expect(t[campo]?.length, `${s.id}.${campo}`).toBeGreaterThan(20)
      }
    }
  })

  it('las dieciséis viejas también', () => {
    for (const b of INSIGNIAS) {
      const t = loreDeInsignia(b.code)
      expect(t, b.code).toBeTruthy()
      expect(t.implica.length, b.code).toBeGreaterThan(20)
    }
  })

  it('las legendarias y las obras maestras llevan nota de grado', () => {
    const legendarias = SELLOS_V1.filter((s) => s.material === 'legendaria')
    expect(legendarias).toHaveLength(4)
    for (const s of legendarias) expect(loreDeSello(s).nota, s.id).toBeTruthy()
    for (const s of SELLOS_V1.filter((x) => x.grado === 'Obra maestra')) {
      expect(loreDeSello(s).nota, s.id).toBeTruthy()
    }
  })
})

describe('«qué implica» no puede prometer lo que el sistema no da', () => {
  // Es la promesa central: un sello no da Talis, ni XP, ni ventaja
  // (INSIGNIAS-01 §13.1). La tentación al escribir estos textos es que
  // suenen a premio, y ahí es donde se cuela la mentira.
  const PROHIBIDO = /\bdesbloquea\b|\bganas? \d|\bte da\b|\bmás Talis\b|\bmás XP\b|\bdescuento\b|\bventaja\b/i

  it('ninguno del catálogo nuevo promete economía ni ventaja', () => {
    for (const s of SELLOS_V1) {
      const t = loreDeSello(s)
      expect(PROHIBIDO.test(t.implica), `${s.id}: «${t.implica}»`).toBe(false)
    }
  })

  it('el poder sale de la definición real, no de la prosa', () => {
    // La prosa NO repite el poder a propósito: si un comodín pasara de un
    // uso a dos, un texto a mano seguiría prometiendo uno. La línea que lo
    // anuncia se compone de `insignias.js`, así que cambia sola.
    for (const b of INSIGNIAS) {
      const tienePoder = Boolean(b.poder) && PODERES_LISTOS.has(b.poder.tipo)
      expect(Boolean(poderDeInsignia(b.code)), b.code).toBe(tienePoder)
    }
  })

  it('solo se anuncian los poderes cableados de punta a punta', () => {
    // `monedas_x` y `abre_premio` existen en el modelo y no llegan a
    // ninguna parte. Prometer un ×1,25 que no toca las Talis es mentirle
    // a quien se lo ganó.
    const conPoderDeclarado = INSIGNIAS.filter((b) => b.poder)
    const anunciados = conPoderDeclarado.filter((b) => poderDeInsignia(b.code))
    expect(anunciados.length).toBeLessThan(conPoderDeclarado.length)
    for (const b of anunciados) expect(PODERES_LISTOS.has(b.poder.tipo), b.code).toBe(true)
  })

  it('las tres competitivas explican por qué no tienen sucesora', () => {
    for (const code of ['primer_nivel10', 'mano_derecha', 'coleccionista']) {
      const t = loreDeInsignia(code).implica
      expect(/una persona|sucesora|compara/i.test(t), code).toBe(true)
    }
  })
})

describe('la condición sale de la regla, no de un texto a mano', () => {
  it('cada sello evaluable sabe decir su condición', () => {
    for (const s of SELLOS_V1.filter((x) => x.regla)) {
      expect(condicionDe(s).length, s.id).toBeGreaterThan(0)
    }
  })

  it('los que no tienen regla no se inventan una', () => {
    for (const s of SELLOS_V1.filter((x) => !x.regla)) {
      expect(condicionDe(s), s.id).toEqual([])
    }
  })

  it('la cifra de la frase es la MISMA que la de la regla', () => {
    // Si el umbral del catálogo cambia y la frase no, la pantalla
    // promete una cosa y el motor concede otra.
    const ritmo = selloPorId('ritmo_03')
    expect(ritmo.regla.diasActivos).toBe(25)
    expect(condicionDe(ritmo).join(' ')).toContain('25')

    const oficio = selloPorId('oficio_hogar_2')
    const frase = condicionDe(oficio).join(' ')
    expect(frase).toContain(String(oficio.regla.xp))
    expect(frase).toContain('Hogar')
  })

  it('no pluraliza mal cuando el umbral es uno', () => {
    expect(condicionDe(selloPorId('inicio_primer_encargo'))).toEqual(['1 encargo aprobado'])
  })
})

describe('los secretos no se filtran por ningún lado', () => {
  const secretos = SELLOS_V1.filter(esSecreto)

  it('son exactamente los tres descubrimientos', () => {
    expect(secretos.map((s) => s.id)).toEqual([
      'descubrimiento_semana_variada',
      'descubrimiento_tres_ritmos',
      'descubrimiento_varias_generaciones'
    ])
  })

  it('nada más del catálogo es secreto', () => {
    // Un objetivo que se espera que alguien persiga tiene que estar a la
    // vista: esconderlo sería dirigir la conducta a ciegas.
    expect(SELLOS_V1.filter(esSecreto)).toHaveLength(3)
    expect(SELLOS_V1.filter((s) => s.visibilidad && s.visibilidad !== 'secret')).toEqual([])
  })

  it('su nombre no se enseña hasta conseguirlos', () => {
    // El nombre existe en el catálogo —hace falta al abrirlos— pero la
    // pieza sin conseguir no lo pinta. Lo fija el render, y esto vigila
    // que el nombre siga siendo suficientemente revelador como para que
    // esconderlo importe.
    for (const s of secretos) {
      expect(s.nombre, s.id).toBeTruthy()
      expect(s.nombre.length, s.id).toBeGreaterThan(5)
    }
  })
})

describe('el catálogo y las dieciséis no se pisan al abrir la ficha', () => {
  it('ningún código del catálogo nuevo es también de los viejos', () => {
    for (const s of SELLOS_V1) {
      expect(insigniaPorCodigo(s.id), s.id).toBeNull()
    }
  })
})
