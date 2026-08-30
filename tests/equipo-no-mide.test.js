import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// En Equipo no se mide a nadie (migración 061).
//
// ESTE FICHERO ES UN CRITERIO DE SALIDA, no una comprobación más.
//
// La respuesta jurídica del 31-ago (`specs/el-gremio-respuesta-legal.md` §2)
// pide, para poder publicar el tipo Equipo, «una prueba de que las APIs
// **también** bloquean toda métrica individual». Esto es esa prueba.
//
// Y su valor no está en el día que llegue el dictamen: está en los meses de
// antes. La plantilla declaraba `progreso_individual = false` desde la 053 y
// no lo leía nadie — era una casilla que describía una intención sin impedir
// nada. Entre hoy y el día que se encienda Equipo, nadie iba a repasar las
// quince funciones que tocan XP y monedas. Este test es quien mira.
//
// LO QUE ENUMERA la respuesta: «ni tareas asignadas a una persona, ni
// historial por persona, ni tiempo, rachas, ranking, exportación, analítica
// individual, salario, descuentos, bonus, sanciones o evaluaciones».
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m061 = leer('migracion-061-equipo-no-mide-a-nadie.sql')
const m053 = leer('migracion-053-el-tipo-deja-de-ser-un-if.sql')

/**
 * Las tablas que guardan algo de UNA persona. Si mañana aparece una octava y
 * nadie la añade aquí ni al disparador, este test cae: esa es su función.
 */
const TABLAS_INDIVIDUALES = [
  'completions',
  'bonuses',
  'profile_badges',
  'reconocimientos',
  'redemptions',
  'movimientos_coins',
  'power_uses'
]

describe('la plantilla lo declara', () => {
  it('Equipo tiene el progreso individual apagado', () => {
    // Sembrado en la 053. Si alguien lo pusiera a `true`, todo lo de abajo
    // dejaría de aplicarse sin que ningún disparador se quejara.
    const equipo = m053.slice(m053.indexOf("('equipo', '"), m053.indexOf("'producto · R-77"))
    expect(equipo).toContain('false, false')
  })

  it('y los demás tipos no', () => {
    for (const tipo of ['hogar', 'amigos', 'hogar_compartido']) {
      const i = m053.indexOf(`('${tipo}', '`)
      expect(i, `no se encuentra la plantilla de ${tipo}`).toBeGreaterThan(-1)
      const bloque = m053.slice(i, i + 1200)
      expect(bloque, `${tipo} no debería tener el progreso apagado`).toContain('true, true')
    }
  })
})

describe('y ahora alguien lo lee', () => {
  it('hay una sola función que responde la pregunta', () => {
    expect(schema).toContain('create or replace function public.mide_a_las_personas(p_family uuid)')
    expect(schema).toContain('t.progreso_individual')
  })

  it('y dice que SÍ cuando no lo sabe', () => {
    // Un gremio sin plantilla es de los de antes de la 053, y esos miden como
    // siempre. Negar por defecto apagaría la economía de una casa real por una
    // fila que falta.
    const fn = schema.slice(schema.indexOf('function public.mide_a_las_personas'))
    expect(fn.slice(0, 700)).toContain('true\n  );')
  })
})

describe('las APIs también lo bloquean', () => {
  // Es la palabra que pide el criterio de salida. PostgREST expone las tablas:
  // una guarda que solo viviera dentro de las RPC dejaría la puerta de al lado
  // abierta, y con RLS por gremio alguien podría escribir su propia fila.
  it('cada tabla individual tiene su disparador', () => {
    for (const tabla of TABLAS_INDIVIDUALES) {
      expect(m061, `falta ${tabla} en la lista del disparador`).toContain(`'${tabla}'`)
    }
  })

  it('y el disparador se crea sobre todas, en el mismo bucle', () => {
    for (const sql of [schema, m061]) {
      expect(sql).toContain('drop trigger if exists sin_progreso_individual on public.%I')
      expect(sql).toMatch(
        /create trigger sin_progreso_individual before insert on public\.%I\s+for each row execute function public\.tg_sin_progreso_individual\(\)/
      )
    }
  })

  it('la lista del bucle es EXACTAMENTE la esperada', () => {
    // Comparando lista contra lista: si alguien quita una, cae; si añade una
    // sin ponerla aquí, también. Es lo que convierte esto en un criterio de
    // salida y no en una comprobación aproximada.
    const bloque = m061.slice(m061.indexOf('foreach t in array array['), m061.indexOf(']\n  loop'))
    const enSql = [...bloque.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    expect(enSql.sort()).toEqual([...TABLAS_INDIVIDUALES].sort())
  })

  it('y la XP, la marca de agua y las monedas no pueden subir', () => {
    // Aquí no vale bloquear el `insert`: un gremio de Equipo tiene personajes,
    // solo que no puntúan. Lo que se bloquea es que suban.
    expect(schema).toContain('create trigger profiles_sin_puntuacion')
    expect(schema).toContain('before update of xp, xp_maxima, coins on public.profiles')
    const fn = schema.slice(schema.indexOf('function public.tg_sin_puntuacion_individual'))
    expect(fn.slice(0, 900)).toContain('new.xp is distinct from old.xp')
    expect(fn.slice(0, 900)).toContain('new.xp_maxima is distinct from old.xp_maxima')
    expect(fn.slice(0, 900)).toContain('new.coins is distinct from old.coins')
  })
})

describe('lo que NO se bloquea, y es a propósito', () => {
  it('los personajes: un Equipo los tiene, solo que no puntúan', () => {
    // Un disparador sobre el `insert` de `profiles` dejaría un gremio de
    // Equipo sin poder tener a nadie dentro.
    expect(m061).not.toMatch(/on public\.profiles\s+for each row execute function public\.tg_sin_progreso_individual/)
  })

  it('ni las metas, que son el progreso COLECTIVO', () => {
    // `R-113`: es lo único que Equipo sí tiene.
    expect(m061).not.toContain("'family_goals'")
  })
})

describe('y forjar sigue prohibido desde Equipo', () => {
  it('por la otra bandera de la misma plantilla', () => {
    // `R-111`, `R-115`. Va aparte de `progreso_individual` a propósito: son
    // dos cosas distintas y podrían no ir juntas en un tipo futuro.
    // `create or replace` y no solo el nombre: los `revoke`/`grant` del final
    // también llevan la firma, y `lastIndexOf` se quedaba con uno de esos.
    const forja = schema.slice(schema.lastIndexOf('create or replace function public.forjar_llave'))
    expect(forja.slice(0, 3000)).toContain('coalesce(t.expansion_desde_tipo, false)')
  })
})
