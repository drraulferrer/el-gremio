import { describe, it, expect } from 'vitest'
import {
  abiertaComoApp,
  plataformaDeInstalacion,
  queOfrecer
} from '../src/lib/instalacion'

describe('¿ya está instalada?', () => {
  const win = (display, safari) => ({
    matchMedia: () => ({ matches: display }),
    navigator: { standalone: safari }
  })

  it('lo dice el estándar', () => {
    expect(abiertaComoApp(win(true, undefined))).toBe(true)
  })

  // Safari en iPhone no implementa display-mode: sin esta segunda vía, la
  // app instalada en el móvil seguiría enseñando «instálame».
  it('o lo dice Safari, que va por su cuenta', () => {
    expect(abiertaComoApp(win(false, true))).toBe(true)
  })

  it('en una pestaña normal, no', () => {
    expect(abiertaComoApp(win(false, false))).toBe(false)
  })

  it('sin window no revienta', () => {
    expect(abiertaComoApp(undefined)).toBe(false)
    expect(abiertaComoApp({})).toBe(false)
  })
})

describe('en qué aparato estamos', () => {
  it('iPhone', () => {
    expect(plataformaDeInstalacion({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' })).toBe('ios')
  })

  // El caso que más importa: la tablet de la peque. Desde iPadOS 13 el
  // iPad se anuncia como Mac, y sin la pista táctil se le darían las
  // instrucciones de escritorio.
  it('iPad moderno, que se hace pasar por Mac', () => {
    expect(plataformaDeInstalacion({
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari',
      plataforma: 'MacIntel',
      tactiles: 5
    })).toBe('ios')
  })

  // El fallo que se coló: un Android emulado reporta platform MacIntel y
  // cinco puntos táctiles, y con la conjetura del iPad por delante recibía
  // las instrucciones de iOS —«toca Compartir en Safari» en un Pixel—.
  // Lo que el aparato DICE gana a lo que se deduce de él.
  it('si el agente dice Android, es Android aunque la plataforma diga Mac', () => {
    expect(plataformaDeInstalacion({
      ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      plataforma: 'MacIntel',
      tactiles: 5
    })).toBe('android')
  })

  it('y un iPhone es iPhone aunque venga con AppleWebKit y táctiles', () => {
    expect(plataformaDeInstalacion({
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15',
      plataforma: 'iPhone',
      tactiles: 5
    })).toBe('ios')
  })

  it('un Mac de verdad no es un iPad', () => {
    expect(plataformaDeInstalacion({
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari',
      plataforma: 'MacIntel',
      tactiles: 0
    })).toBe('escritorio')
  })

  it('Android', () => {
    expect(plataformaDeInstalacion({ ua: 'Mozilla/5.0 (Linux; Android 14; Pixel)' })).toBe('android')
  })

  it('Windows', () => {
    expect(plataformaDeInstalacion({ ua: 'Mozilla/5.0 (Windows NT 10.0)' })).toBe('escritorio')
  })

  it('sin datos no adivina: escritorio', () => {
    expect(plataformaDeInstalacion()).toBe('escritorio')
  })
})

describe('qué se le ofrece a cada cual', () => {
  it('instalada: nada, aunque el aparato sepa hacerlo', () => {
    expect(queOfrecer({ instalada: true, plataforma: 'android', hayEvento: true })).toBeNull()
  })

  it('con evento, el botón que instala de un toque', () => {
    expect(queOfrecer({ instalada: false, plataforma: 'android', hayEvento: true })).toBe('boton')
  })

  // iOS no tiene ese evento y no lo va a tener: ahí los pasos a mano no
  // son el plan B, son el único plan.
  it('en iOS, los pasos a mano', () => {
    expect(queOfrecer({ instalada: false, plataforma: 'ios', hayEvento: false })).toBe('pasos')
  })

  it('en Android sin evento todavía, también los pasos', () => {
    expect(queOfrecer({ instalada: false, plataforma: 'android', hayEvento: false })).toBe('pasos')
  })

  it('en un escritorio sin evento, nada: un icono ahí no lo espera nadie', () => {
    expect(queOfrecer({ instalada: false, plataforma: 'escritorio', hayEvento: false })).toBeNull()
  })
})
