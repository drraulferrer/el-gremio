import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SUPUESTOS, xpPorDia, monedasPorDia, precioObjetivo } from '../src/lib/economia'
import { xpForLevel, levelFromXp } from '../src/lib/supabase'

// ------------------------------------------------------------------
// La calibración de la expansión a otros gremios.
//
// Estos tests son al hito de expansión lo que economia.test.js es a los
// precios de la tienda: el guardián. Si alguien sube la XP de las
// misiones, cambia la adherencia o toca la curva de nivel, el primer
// gremio extra deja de caer donde se prometió y aquí se ve, en vez de
// descubrirlo con una familia dentro.
//
// LO QUE DEFIENDEN, y viene de la especificación funcional
// (`specs/el-gremio-gremios-multiples.md`, §11.2 y R-85):
//
//   · el primer hito cae HACIA LA MITAD de una primera temporada normal,
//     y no al principio;
//   · «hacia la mitad» no es alcanzar el nivel: es poder FORJAR la llave
//     y USARLA ese mismo día. Si el coste obliga a no pisar la tienda
//     durante un mes, el hito llega el día 31 y la llave el 50;
//   · cada llave siguiente cuesta bastante más que la anterior, y no de
//     forma lineal.
//
// DE DÓNDE SALEN LOS NÚMEROS, desde la migración 050.
//
// Estaban escritos aquí desde el 29-ago-2026, y con una nota que decía
// que se mudarían en cuanto existiera la configuración versionada que
// pide R-66. Ya existe: viven en `configuracion_expansion` y en
// `escalones_expansion`, que es donde el servidor puede leerlos al
// cobrar una llave (CFG-2). Este fichero los lee de la semilla de esa
// migración, y por eso siguen siendo UNA sola fuente (CFG-1): si alguien
// publica una versión con otros números y descoloca el hito, aquí se ve.
//
// Se lee el SQL como texto, igual que en `configuracion.test.js`. Lo que
// este fichero defiende no es que los números estén escritos, sino que
// el hito que producen siga cayendo donde se prometió.
// ------------------------------------------------------------------

const semilla = readFileSync(
  new URL('../migracion-050-las-reglas-dejan-de-ser-constantes.sql', import.meta.url),
  'utf8'
)

/** Los escalones sembrados: `(v_version, orden, nivel_exigido, coste)`. */
const ESCALA = [
  ...semilla
    .slice(semilla.indexOf('insert into public.escalones_expansion'))
    .matchAll(/\(v_version,\s*(\d+),\s*(\d+),\s*(\d+)\)/g)
].map(([, orden, nivel, coste]) => ({ orden: +orden, nivel: +nivel, coste: +coste }))

const HITOS = ESCALA.map((e) => e.nivel)
const COSTE_BASE = ESCALA[0].coste

/** Días que tarda un rol en alcanzar un nivel con la economía estándar. */
function diaDeNivel(nivel, rol = 'adulto') {
  return xpForLevel(nivel) / xpPorDia(rol)
}

/** El coste del escalón k, tal cual está guardado. No se recalcula: CFG-1. */
const costeDe = (k) => ESCALA[k - 1].coste

describe('los números salen de la configuración, no de aquí', () => {
  it('la escala sembrada tiene cuatro escalones', () => {
    // Si el parseo fallara, `ESCALA` saldría vacía y todo lo de abajo
    // pasaría por comparar `undefined` con `undefined`. Esto lo caza.
    expect(ESCALA).toHaveLength(4)
    expect(ESCALA.map((e) => e.orden)).toEqual([1, 2, 3, 4])
  })
})

describe('el primer hito cae hacia la mitad de la primera temporada', () => {
  const mitad = SUPUESTOS.cadenciaMeta / 2

  it('la mitad de la temporada son 30 días', () => {
    // Si alguien cambia la cadencia de la meta, todo lo de abajo se mueve
    // con ella. Se comprueba aparte para que el fallo diga por qué.
    expect(mitad).toBe(30)
  })

  it(`una persona adulta alcanza el nivel ${HITOS[0]} hacia el día 30`, () => {
    // Banda del 10 %: entre el día 27 y el 33. Con el 15 % una subida del
    // 20 % en la XP de las misiones pasaba sin avisar, y eso es
    // exactamente lo que este test tiene que cazar.
    const dia = diaDeNivel(HITOS[0])
    expect(dia).toBeGreaterThan(mitad * 0.9)
    expect(dia).toBeLessThan(mitad * 1.1)
  })

  it('el hito anterior caería demasiado pronto, y por eso el primero no es ese', () => {
    // Es la otra mitad de la decisión: el nivel 5 llega a un tercio de
    // temporada. Si un cambio de economía lo acercara al día 30, el hito
    // habría que bajarlo, y este test lo dice.
    expect(diaDeNivel(HITOS[0] - 1)).toBeLessThan(mitad * 0.8)
  })

  it('no se alcanza al empezar', () => {
    expect(diaDeNivel(HITOS[0])).toBeGreaterThan(mitad / 2)
    expect(levelFromXp(0)).toBe(1)
  })
})

describe('hacia el día 30 se puede forjar la llave Y usarla', () => {
  it('el coste base cabe en lo que queda tras pisar la tienda', () => {
    // La tienda compite con la llave: son el mismo saldo. Se supone el
    // caso realista, no el asceta: alguien que ya se ha canjeado UN
    // premio de nivel 1 a su precio objetivo.
    const conUnPremio = (COSTE_BASE + precioObjetivo(1)) / monedasPorDia('adulto')
    expect(conUnPremio).toBeLessThanOrEqual(diaDeNivel(HITOS[0]))
  })

  it('quien no pisa la tienda no llega mucho antes: manda el nivel, no el dinero', () => {
    // Si el dinero llegara mucho antes que el nivel, el coste no estaría
    // haciendo nada y la llave sería un trámite.
    const sinPremios = COSTE_BASE / monedasPorDia('adulto')
    expect(sinPremios).toBeLessThan(diaDeNivel(HITOS[0]))
    expect(sinPremios).toBeGreaterThan(diaDeNivel(HITOS[0]) / 4)
  })
})

describe('la escala crece, y no en línea recta', () => {
  it('los hitos exigen niveles estrictamente mayores', () => {
    for (let k = 1; k < HITOS.length; k++) expect(HITOS[k]).toBeGreaterThan(HITOS[k - 1])
  })

  it('cada llave cuesta al menos el doble que la anterior', () => {
    // «Significativamente más costosa» (R-15). Por debajo del doble no se
    // nota y la escala deja de ser una escala.
    for (let k = 2; k <= 4; k++) expect(costeDe(k)).toBeGreaterThanOrEqual(costeDe(k - 1) * 2)
  })

  it('el crecimiento es geométrico, no lineal', () => {
    const salto1 = costeDe(2) - costeDe(1)
    const salto2 = costeDe(3) - costeDe(2)
    expect(salto2).toBeGreaterThan(salto1 * 1.5)
  })

  it('la segunda llave la termina de abrir el ahorro, no el nivel', () => {
    // Con la primera llave forjada, ahorrarlo todo desde ese día hasta
    // poder pagar la segunda debe llevar MÁS que alcanzar el hito 2: si
    // no, la segunda expansión se sentiría regalada.
    const diaPrimera = diaDeNivel(HITOS[0])
    const diaSegundaPorDinero = diaPrimera + costeDe(2) / monedasPorDia('adulto')
    expect(diaSegundaPorDinero).toBeGreaterThan(diaDeNivel(HITOS[1]))
  })

  it('los costes son múltiplos de cinco, como el resto de la tienda', () => {
    // Antes solo se comprobaban los tres primeros, porque el cuarto salía
    // 4687,5 de la fórmula. Ahora el coste es un entero guardado y la
    // configuración lo redondea al múltiplo de cinco: se comprueban los cuatro.
    for (let k = 1; k <= ESCALA.length; k++) expect(costeDe(k) % 5).toBe(0)
  })
})

describe('el hito llega antes a quien gana más XP, y se acepta', () => {
  it('una junior lo alcanza claramente antes que una persona adulta', () => {
    // No es un fallo: la proporcionalidad por edades vive en los puntos de
    // la misión. Se acepta (D-25) y se vigila. Este test existe para que
    // la diferencia no crezca en silencio hasta volverse absurda.
    const adulto = diaDeNivel(HITOS[0], 'adulto')
    const junior = diaDeNivel(HITOS[0], 'junior')
    expect(junior).toBeLessThan(adulto)
    expect(junior).toBeGreaterThan(adulto / 2)
  })
})
