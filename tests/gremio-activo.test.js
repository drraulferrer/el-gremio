import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  CLAVE_ACTIVO, CLAVE_PERFIL_VIEJA, clavePerfil,
  elegirActivo, leerGremioActivo, recordarGremioActivo,
  leerPerfil, recordarPerfil, olvidarPerfil, olvidarTodo
} from '../src/lib/gremios'

// ------------------------------------------------------------------
// El gremio activo y el personaje de cada gremio (6.2).
//
// Este fichero defiende los tres supuestos de gremio único que el inventario
// de `NOTAS-FASE-6.md` puso arriba del todo, y que se rompen de maneras
// distintas:
//
//   1 · LA CARGA. `limit 1` abría el más antiguo. Desde la migración 045 la
//       RLS ya devuelve todos los gremios de quien pertenece, así que el
//       segundo no es que se viera mal: era invisible.
//
//   2 · EL PERSONAJE. Una clave global apunta a un perfil que no está en el
//       gremio activo en cuanto hay dos. Y el rescate de esa clave vieja
//       importa tanto como el cambio: sin él, desplegar esto expulsa a toda
//       la familia de su personaje.
//
//   3 · LO QUE NO SE ARRASTRA. Cambiar de gremio recalcula la zona horaria y
//       la temporada, y suelta lo que estaba a medias.
// ------------------------------------------------------------------

/** Un `localStorage` de mentira, que además puede fingir estar roto. */
function almacenFalso(inicial = {}, { rompe = false } = {}) {
  const datos = new Map(Object.entries(inicial))
  return {
    get length() { return datos.size },
    key: (i) => [...datos.keys()][i] ?? null,
    getItem: (k) => {
      if (rompe) throw new Error('modo privado')
      return datos.has(k) ? datos.get(k) : null
    },
    setItem: (k, v) => {
      if (rompe) throw new Error('modo privado')
      datos.set(k, String(v))
    },
    removeItem: (k) => {
      if (rompe) throw new Error('modo privado')
      datos.delete(k)
    },
    _datos: datos
  }
}

const GREMIOS = [
  { id: 'b', name: 'El piso', created_at: '2026-06-01T00:00:00Z' },
  { id: 'a', name: 'La casa', created_at: '2026-01-01T00:00:00Z' },
  { id: 'c', name: 'El equipo', created_at: '2026-09-01T00:00:00Z' }
]

describe('cuál de mis gremios se abre', () => {
  it('el guardado, si sigue siendo mío', () => {
    expect(elegirActivo(GREMIOS, 'c').id).toBe('c')
  })

  it('y si ya no lo es, el más antiguo', () => {
    // `C-3`: abandonar desde otro aparato o que te expulsen no puede dejar la
    // app operando sobre un gremio ajeno ni enseñando una pantalla en blanco.
    expect(elegirActivo(GREMIOS, 'gremio-que-ya-no-es-mio').id).toBe('a')
  })

  it('sin nada guardado, el más antiguo', () => {
    // Es exactamente lo que hacía el `order('created_at')` de `loadFamily`, y
    // por eso desplegar esto no cambia de gremio a nadie.
    expect(elegirActivo(GREMIOS, null).id).toBe('a')
  })

  it('el orden lo pone esta función, no el que venga', () => {
    // La lista llega desordenada a propósito en este test: confiar en el
    // orden de la respuesta es lo que la migración 017 tuvo que arreglar.
    expect(elegirActivo([...GREMIOS].reverse(), null).id).toBe('a')
  })

  it('sin gremios, ninguno', () => {
    expect(elegirActivo([], 'a')).toBe(null)
    expect(elegirActivo(undefined, null)).toBe(null)
  })
})

describe('el gremio activo se recuerda por aparato', () => {
  it('se escribe y se lee', () => {
    // `C-2`: es una preferencia de este aparato, no un dato del gremio ni de
    // la persona. Por eso vive en `localStorage` y no en la base.
    const a = almacenFalso()
    recordarGremioActivo('b', a)
    expect(a._datos.get(CLAVE_ACTIVO)).toBe('b')
    expect(leerGremioActivo(a)).toBe('b')
  })

  it('y un almacén roto no tumba nada', () => {
    // Modo privado de Safari: `localStorage` existe y lanza al escribir.
    const roto = almacenFalso({}, { rompe: true })
    expect(() => recordarGremioActivo('b', roto)).not.toThrow()
    expect(leerGremioActivo(roto)).toBe(null)
  })
})

describe('el personaje es de cada gremio', () => {
  it('cada uno con su clave', () => {
    const a = almacenFalso()
    recordarPerfil('casa', 'p1', a)
    recordarPerfil('piso', 'p2', a)
    expect(leerPerfil('casa', a)).toBe('p1')
    expect(leerPerfil('piso', a)).toBe('p2')
  })

  it('y no se pisan al soltar uno', () => {
    const a = almacenFalso()
    recordarPerfil('casa', 'p1', a)
    recordarPerfil('piso', 'p2', a)
    olvidarPerfil('casa', a)
    expect(leerPerfil('casa', a)).toBe(null)
    expect(leerPerfil('piso', a)).toBe('p2')
  })

  it('la clave vieja se rescata la primera vez', () => {
    // Lo que evita que desplegar la 6.2 expulse a toda la familia de su
    // personaje y les haga volver a elegirlo.
    const a = almacenFalso({ [CLAVE_PERFIL_VIEJA]: 'p-de-siempre' })
    expect(leerPerfil('casa', a)).toBe('p-de-siempre')
    expect(a._datos.get(clavePerfil('casa'))).toBe('p-de-siempre')
  })

  it('y se retira, para que no la herede un segundo gremio', () => {
    const a = almacenFalso({ [CLAVE_PERFIL_VIEJA]: 'p-de-siempre' })
    leerPerfil('casa', a)
    expect(a._datos.has(CLAVE_PERFIL_VIEJA)).toBe(false)
    // Que el rescate se lo lleve el primero que pregunta no es un problema:
    // el día del despliegue nadie tiene dos gremios, y la 6.1 mantuvo esa
    // invariante justo para que este momento fuera seguro.
    expect(leerPerfil('piso', a)).toBe(null)
  })

  it('la propia manda sobre la vieja', () => {
    const a = almacenFalso({ [CLAVE_PERFIL_VIEJA]: 'viejo', [clavePerfil('casa')]: 'nuevo' })
    expect(leerPerfil('casa', a)).toBe('nuevo')
    expect(a._datos.get(CLAVE_PERFIL_VIEJA)).toBe('viejo')
  })

  it('sin gremio no hay clave que leer ni que escribir', () => {
    const a = almacenFalso({ [CLAVE_PERFIL_VIEJA]: 'p' })
    expect(leerPerfil(null, a)).toBe(null)
    recordarPerfil(undefined, 'x', a)
    expect(a._datos.size).toBe(1)
  })
})

describe('al cerrar sesión no queda nada apuntado', () => {
  it('se van el activo y el personaje de TODOS los gremios', () => {
    // Dejar apuntado en un aparato compartido quién era alguien en un gremio
    // del que ya no hay sesión es justo lo que esta limpieza venía a evitar.
    const a = almacenFalso({
      [CLAVE_ACTIVO]: 'casa',
      [clavePerfil('casa')]: 'p1',
      [clavePerfil('piso')]: 'p2',
      [CLAVE_PERFIL_VIEJA]: 'p0',
      'otra_cosa_del_aparato': 'se queda'
    })
    olvidarTodo(a)
    expect([...a._datos.keys()]).toEqual(['otra_cosa_del_aparato'])
  })

  it('y un almacén roto tampoco impide salir', () => {
    expect(() => olvidarTodo(almacenFalso({}, { rompe: true }))).not.toThrow()
  })
})

// ------------------------------------------------------------------
// Y lo que no se puede comprobar con funciones puras: que App las use.
// ------------------------------------------------------------------

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

describe('la carga deja de suponer un solo gremio', () => {
  it('`loadFamily` ya no lleva `limit 1`', () => {
    const i = app.indexOf('const loadFamily')
    const cuerpo = app.slice(i, app.indexOf('}, [])', i))
    expect(cuerpo).toContain("from('families')")
    expect(cuerpo).not.toContain('.limit(1)')
    expect(cuerpo).toContain('elegirActivo(')
  })

  it('y nadie lee la clave global en toda la app', () => {
    // Los siete sitios que la leían están migrados. Si vuelve a aparecer, es
    // que alguien ha añadido un octavo sin enterarse.
    const ficheros = ['src/App.jsx', 'src/screens/Avisos.jsx', 'src/screens/ParentPanel.jsx',
                      'src/screens/ModoLimpieza.jsx', 'src/lib/acciones.js', 'src/lib/fakeBackend.js']
    for (const f of ficheros) {
      const texto = readFileSync(new URL('../' + f, import.meta.url), 'utf8')
      expect(texto, `${f} todavía lee la clave global`).not.toContain("'gremio_profile'")
    }
  })
})

describe('cambiar de gremio no arrastra nada', () => {
  const i = app.indexOf('function cambiarGremio')
  const cuerpo = app.slice(i, app.indexOf('\n  }', i))

  it('existe y recuerda el nuevo activo', () => {
    expect(i).toBeGreaterThan(-1)
    expect(cuerpo).toContain('recordarGremioActivo(id)')
  })

  it('suelta el personaje, el panel y los datos', () => {
    // `C-6`: una validación pendiente, un canje sin confirmar o un panel
    // abierto pertenecen al gremio donde se empezaron.
    for (const suelta of ['setProfileId(null)', 'setData(null)', 'setParentMode(false)']) {
      expect(cuerpo, `no suelta ${suelta}`).toContain(suelta)
    }
  })

  it('y las referencias de celebración, que sobreviven al render', () => {
    // `ultimoVisto` e `historialSellos` son refs: no se limpian solas al
    // cambiar de datos, y arrastrarían la marca de un gremio al otro.
    expect(cuerpo).toContain('ultimoVisto.current = null')
    expect(cuerpo).toContain('historialSellos.current = null')
  })

  it('vuelve a cargar, y con eso se recalculan zona y temporada', () => {
    // `C-4`, y está en la definición de hecho de la fase. `configurarZona` es
    // un singleton de módulo que se fija al cargar el gremio: sin volver a
    // llamarlo, el día se contaría en la zona del gremio anterior y una racha
    // viva se leería como rota.
    expect(cuerpo).toContain('loadFamily(id)')
    const iCarga = app.indexOf('const loadFamily')
    expect(app.slice(iCarga, app.indexOf('}, [])', iCarga))).toContain('configurarZona(gremio?.timezone)')
  })
})

describe('el selector solo aparece si hay a dónde ir', () => {
  const picker = readFileSync(new URL('../src/screens/ProfilePicker.jsx', import.meta.url), 'utf8')

  it('con un gremio, la pantalla es la de siempre', () => {
    // No se le enseña a nadie una elección que no tiene.
    expect(picker).toContain('const varios = gremios.length > 1')
    expect(picker).toContain('{varios && (')
  })

  it('y cada gremio dice de qué tipo es', () => {
    // `C-5`: pasar de la casa al trabajo sin darse cuenta es el error de uso
    // más probable de esta funcionalidad, y el más incómodo.
    expect(picker).toContain('g.tipo_visible')
  })

  it('el nombre del tipo sale de la plantilla, no de una lista escrita aquí', () => {
    // La regla que la 053 dejó puesta: cero condicionales por tipo fuera de
    // la plantilla.
    expect(app).toContain("supabase.rpc('plantilla_de_gremio')")
    expect(picker).not.toMatch(/'hogar'|'amigos'|'equipo'/)
  })
})
