import { describe, it, expect } from 'vitest'
import {
  pasoContador,
  suavizar,
  debeContar,
  DURACION_MS
} from '../src/lib/contador'

describe('la curva', () => {
  it('empieza en 0 y acaba en 1', () => {
    expect(suavizar(0)).toBe(0)
    expect(suavizar(1)).toBe(1)
  })

  it('desacelera: a mitad de tiempo lleva más de media cuenta', () => {
    // Esto es la decisión, no un detalle de la fórmula. Acelerando, la
    // cifra final llegaría de golpe y se perdería el único fotograma que
    // importa, que es aquel en el que se para.
    expect(suavizar(0.5)).toBeGreaterThan(0.5)
  })

  it('no se sale de rango aunque le pidan un tiempo imposible', () => {
    expect(suavizar(-3)).toBe(0)
    expect(suavizar(9)).toBe(1)
  })
})

describe('en qué número va la cuenta', () => {
  it('llega al destino exacto al acabar el tiempo', () => {
    expect(pasoContador({ desde: 118, hasta: 126, transcurrido: DURACION_MS })).toBe(126)
    expect(pasoContador({ desde: 118, hasta: 126, transcurrido: DURACION_MS + 500 })).toBe(126)
  })

  it('nunca se pasa del destino por el camino', () => {
    // Pasarse y volver es el fallo clásico de estas cuentas, y se ve:
    // la Bolsa enseñaría 127 Talis que no tienes durante un fotograma.
    for (let t = 0; t <= DURACION_MS; t += 17) {
      const v = pasoContador({ desde: 118, hasta: 126, transcurrido: t })
      expect(v).toBeGreaterThanOrEqual(118)
      expect(v).toBeLessThanOrEqual(126)
    }
  })

  it('siempre devuelve enteros: aquí no hay importes con decimales', () => {
    for (let t = 0; t <= DURACION_MS; t += 23) {
      const v = pasoContador({ desde: 0, hasta: 7, transcurrido: t })
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('la subida de +1 se ve moverse desde el primer fotograma', () => {
    // Con redondeo al más cercano, +1 se pasaba media cuenta enseñando
    // el número viejo: el caso más corto era el único invisible. Por eso
    // el redondeo va HACIA el destino.
    expect(pasoContador({ desde: 118, hasta: 119, transcurrido: 16 })).toBe(119)
  })

  it('sube lo mismo de tiempo tanto si sube 4 como si sube 300', () => {
    // Lo que se mantiene fijo es el TIEMPO, no la velocidad: si no, el
    // premio grande —el que no puedes hacer esperar— sería el más lento.
    const corta = pasoContador({ desde: 0, hasta: 4, transcurrido: DURACION_MS })
    const larga = pasoContador({ desde: 0, hasta: 300, transcurrido: DURACION_MS })
    expect(corta).toBe(4)
    expect(larga).toBe(300)
  })

  it('si no hay cambio, no hay cuenta', () => {
    expect(pasoContador({ desde: 42, hasta: 42, transcurrido: 0 })).toBe(42)
  })

  it('con duración cero se planta en el destino en vez de dividir por cero', () => {
    expect(pasoContador({ desde: 0, hasta: 50, transcurrido: 0, duracion: 0 })).toBe(50)
  })
})

describe('cuándo se anima y cuándo no', () => {
  it('se anima al subir', () => {
    expect(debeContar({ desde: 118, hasta: 126 })).toBe(true)
  })

  it('bajar es instantáneo: gastar no se saborea', () => {
    // Contar hacia atrás los Talis de una compra sería subrayar la
    // pérdida durante 700 ms, justo lo que no queremos que recuerde
    // quien acaba de canjear un premio.
    expect(debeContar({ desde: 126, hasta: 40 })).toBe(false)
  })

  it('la primera vez nunca se anima', () => {
    // Abrir la app y ver tus 1.240 Talis contar desde cero es una
    // máquina tragaperras, no una respuesta a un gesto.
    expect(debeContar({ desde: 0, hasta: 1240, primeraVez: true })).toBe(false)
  })

  it('con menos movimiento se pone el número y ya', () => {
    // No una versión corta: ninguna. Quien pide menos movimiento no
    // pide el mismo movimiento más rápido.
    expect(debeContar({ desde: 118, hasta: 126, menosMovimiento: true })).toBe(false)
  })

  it('no se anima con valores que no son números', () => {
    expect(debeContar({ desde: NaN, hasta: 10 })).toBe(false)
    expect(debeContar({ desde: 10, hasta: Infinity })).toBe(false)
  })
})
