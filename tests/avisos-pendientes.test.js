import { describe, it, expect } from 'vitest'
import {
  debeRecordar,
  perfilesSinAparato,
  textoDelAviso,
  claveDeOculto
} from '../src/lib/avisosPendientes'

const perfil = (id, extra = {}) => ({ id, active: true, role: 'adulto', ...extra })

describe('cuándo se recuerda que faltan los avisos', () => {
  it('se recuerda cuando este aparato los tiene apagados', () => {
    expect(debeRecordar({ estado: 'apagado', oculto: false })).toBe(true)
  })

  it('no se recuerda si ya están encendidos', () => {
    expect(debeRecordar({ estado: 'encendido', oculto: false })).toBe(false)
  })

  it('no se recuerda si alguien dijo que dejara de mostrarse', () => {
    expect(debeRecordar({ estado: 'apagado', oculto: true })).toBe(false)
  })

  // Insistirle a quien no puede hacer nada es ruido, no ayuda. Los tres
  // casos tienen la misma raíz: el botón de Ajustes tampoco funcionaría.
  it('calla cuando el aparato no admite avisos', () => {
    expect(debeRecordar({ estado: 'imposible', oculto: false })).toBe(false)
  })

  it('calla cuando el navegador ya los bloqueó', () => {
    expect(debeRecordar({ estado: 'bloqueado', oculto: false })).toBe(false)
  })

  it('calla cuando falta la clave del despliegue, que es problema nuestro', () => {
    expect(debeRecordar({ estado: 'sin-clave', oculto: false })).toBe(false)
  })

  // Mientras se resuelve `estadoDePush()` el panel ya está pintado. Si el
  // aviso saliera en ese hueco, aparecería y desaparecería solo en cada
  // apertura, que es la clase de parpadeo que hace desconfiar de la app.
  it('no parpadea mientras aún no se sabe el estado', () => {
    expect(debeRecordar({ estado: 'cargando', oculto: false })).toBe(false)
    expect(debeRecordar({ estado: undefined, oculto: false })).toBe(false)
  })
})

describe('a cuánta gente no le llegaría nada', () => {
  it('cuenta los perfiles sin ningún aparato', () => {
    const perfiles = [perfil('a'), perfil('b'), perfil('c')]
    expect(perfilesSinAparato(perfiles, ['a'])).toBe(2)
  })

  it('no cuenta a la peque, que nunca recibe avisos a propósito', () => {
    const perfiles = [perfil('a'), perfil('p', { role: 'peque' })]
    expect(perfilesSinAparato(perfiles, [])).toBe(1)
  })

  it('no cuenta a los perfiles retirados', () => {
    const perfiles = [perfil('a'), perfil('b', { active: false })]
    expect(perfilesSinAparato(perfiles, [])).toBe(1)
  })

  it('da cero cuando todos tienen aparato', () => {
    const perfiles = [perfil('a'), perfil('b')]
    expect(perfilesSinAparato(perfiles, ['a', 'b'])).toBe(0)
  })

  // Un perfil puede tener el móvil y la tablet: son dos filas en
  // `push_subs` y una sola persona cubierta.
  it('un mismo perfil con dos aparatos cuenta una vez', () => {
    const perfiles = [perfil('a'), perfil('b')]
    expect(perfilesSinAparato(perfiles, ['a', 'a', 'a'])).toBe(1)
  })

  // Si la consulta falla no se puede afirmar nada; el aviso seguirá
  // saliendo, pero hablando solo de este aparato (ver textoDelAviso).
  it('aguanta que no haya lista de aparatos', () => {
    expect(perfilesSinAparato([perfil('a')], null)).toBe(1)
    expect(perfilesSinAparato(null, null)).toBe(0)
  })
})

describe('qué se le dice a la familia', () => {
  it('con varios sin cubrir, da el número', () => {
    expect(textoDelAviso(5)).toContain('5 miembros')
  })

  // El singular importa: «1 miembros» es el detalle que hace que una app
  // parezca hecha con prisa.
  it('con uno solo, habla en singular', () => {
    expect(textoDelAviso(1)).toContain('1 miembro del gremio')
    expect(textoDelAviso(1)).not.toContain('miembros')
  })

  it('sin recuento fiable, habla solo de este aparato', () => {
    expect(textoDelAviso(0)).toContain('este aparato')
  })
})

describe('dónde se guarda el «deja de mostrarlo»', () => {
  // Dos gremios en el mismo navegador no deben pisarse: pasa en las
  // pruebas y pasaría en una tablet compartida entre dos casas.
  it('la clave lleva el gremio dentro', () => {
    expect(claveDeOculto('fam-1')).not.toBe(claveDeOculto('fam-2'))
  })

  it('aguanta que no haya gremio todavía', () => {
    expect(claveDeOculto(null)).toContain('sin-gremio')
  })
})
