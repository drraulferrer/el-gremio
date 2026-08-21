import { describe, it, expect } from 'vitest'
import {
  validarTexto,
  construirInforme,
  enviarInforme,
  TEXTO_MAXIMO,
  HUELLAS_MAXIMAS,
  AGENTE_MAXIMO
} from '../src/lib/fallos'

// Un cliente de mentira, inyectado. NO se parchea el módulo `supabase`:
// en CI ese cliente es `null` y parchearlo fue lo que dejó el CI en rojo
// cuatro empujones seguidos el 19 de agosto.
function clienteFalso({ usuario = { id: 'u1' }, familia = { id: 'fam-1' }, fallaInsert = null } = {}) {
  const escrito = []
  return {
    escrito,
    auth: { getUser: async () => ({ data: { user: usuario } }) },
    from(tabla) {
      if (tabla === 'families') {
        return {
          select: () => ({ eq: () => ({ limit: async () => ({ data: familia ? [familia] : [], error: null }) }) })
        }
      }
      return {
        insert: async (fila) => {
          escrito.push({ tabla, fila })
          return { data: null, error: fallaInsert }
        }
      }
    }
  }
}

describe('qué se puede mandar', () => {
  it('con dos letras no vale: no se puede buscar nada con eso', () => {
    expect(validarTexto('no').ok).toBe(false)
  })

  it('los espacios no cuentan como texto', () => {
    expect(validarTexto('        ').ok).toBe(false)
  })

  it('una frase corta pero real, sí', () => {
    expect(validarTexto('la tienda no abre').ok).toBe(true)
  })

  it('media novela, no', () => {
    const largo = validarTexto('x'.repeat(TEXTO_MAXIMO + 1))
    expect(largo.ok).toBe(false)
    expect(largo.mensaje).toContain(String(TEXTO_MAXIMO))
  })
})

describe('qué sale de este dispositivo', () => {
  const base = { texto: '  la tienda no abre  ', familyId: 'fam-1' }

  it('el texto va limpio de espacios', () => {
    expect(construirInforme(base).texto).toBe('la tienda no abre')
  })

  it('sin pantalla ni perfil, van a nulo y no a undefined', () => {
    const fila = construirInforme(base)
    expect(fila.pantalla).toBeNull()
    expect(fila.profile_id).toBeNull()
  })

  it('el agente se recorta al tope de la columna', () => {
    const fila = construirInforme({ ...base, agente: 'M'.repeat(500) })
    expect(fila.agente).toHaveLength(AGENTE_MAXIMO)
  })

  it('solo van las tres huellas más repetidas, y solo huella y veces', () => {
    const muchas = Array.from({ length: 9 }, (_, i) => ({ huella: 'E' + i, veces: 9 - i, ruido: 'no' }))
    const fila = construirInforme({ ...base, huellas: muchas })
    expect(fila.huellas).toHaveLength(HUELLAS_MAXIMAS)
    expect(fila.huellas[0]).toEqual({ huella: 'E0', veces: 9 })
  })

  // El día que alguien añada un campo a la fila, esta prueba lo dirá en
  // voz alta. Es la única defensa contra mandar de más sin enterarse.
  it('la fila tiene exactamente estos campos y ninguno más', () => {
    expect(Object.keys(construirInforme(base)).sort()).toEqual(
      ['agente', 'family_id', 'huellas', 'pantalla', 'profile_id', 'texto', 'version_app'].sort()
    )
  })
})

describe('mandarlo', () => {
  it('un texto que no vale ni llega a tocar la base', async () => {
    const cliente = clienteFalso()
    const r = await enviarInforme({ texto: 'no', cliente })
    expect(r.ok).toBe(false)
    expect(cliente.escrito).toHaveLength(0)
  })

  it('con el gremio delante, no lo vuelve a preguntar', async () => {
    const cliente = clienteFalso({ familia: null })
    const r = await enviarInforme({ texto: 'la tienda no abre', familyId: 'fam-9', cliente })
    expect(r.ok).toBe(true)
    expect(cliente.escrito[0].fila.family_id).toBe('fam-9')
  })

  it('sin gremio delante lo busca solo: eso es lo que salva la pantalla de tropiezo', async () => {
    const cliente = clienteFalso()
    const r = await enviarInforme({ texto: 'se ha quedado en blanco', pantalla: 'tropiezo', cliente })
    expect(r.ok).toBe(true)
    expect(cliente.escrito[0].tabla).toBe('informes_fallo')
    expect(cliente.escrito[0].fila.family_id).toBe('fam-1')
    expect(cliente.escrito[0].fila.pantalla).toBe('tropiezo')
  })

  it('sin sesión lo dice con palabras, no con un error', async () => {
    const r = await enviarInforme({ texto: 'la tienda no abre', cliente: clienteFalso({ usuario: null }) })
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(/entrado en el gremio/i)
  })

  it('sin cliente —una copia sin configurar— tampoco revienta', async () => {
    const r = await enviarInforme({ texto: 'la tienda no abre', cliente: null })
    expect(r.ok).toBe(false)
    expect(r.mensaje).toMatch(/no está conectada/i)
  })

  it('si la base lo rechaza, devuelve el motivo y no miente diciendo que sí', async () => {
    const cliente = clienteFalso({ fallaInsert: { message: 'tope_de_filas:informes_fallo: el gremio ya tiene 200' } })
    const r = await enviarInforme({ texto: 'la tienda no abre', cliente })
    expect(r.ok).toBe(false)
    expect(r.mensaje).toContain('tope_de_filas')
  })
})
