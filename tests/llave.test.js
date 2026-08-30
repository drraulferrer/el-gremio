import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { xpForLevel, levelFromXp } from '../src/lib/supabase'

// ------------------------------------------------------------------
// La llave se forja (migración 056 · Fase 5).
//
// Este fichero defiende tres cosas distintas, y la primera es la que costará
// más cara si se rompe:
//
//   1 · QUE LAS DOS COPIAS DE LA FÓRMULA DEL NIVEL DIGAN LO MISMO. Desde hoy
//       el nivel se calcula en JS y en SQL, y el servidor cobra según la suya.
//       Si se separan, alguien paga una llave que la pantalla decía que podía
//       forjar, o al revés. El plan de la Fase 1 aplazó esta copia justo por
//       esto y dejó escrito que, cuando entrara, «hace falta algo que
//       garantice que SQL y JS coinciden». Esto es ese algo.
//
//   2 · QUE NO SE COBRE POR UNA LLAVE QUE NO SE PUEDE USAR (`R-61`). El orden
//       de las comprobaciones es la especificación: todo lo que puede decir
//       que no, dice que no ANTES de tocar la cartera.
//
//   3 · QUE UN HITO ALCANZADO NO SE RETIRE (`E-4.5`). El nivel sale de la
//       marca de agua, no de la XP de hoy: deshacer una misión mal validada no
//       puede quitarle a nadie una oportunidad ya ganada.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m056 = leer('migracion-056-la-llave-se-forja.sql')

const soloSql = (sql) =>
  sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')

function funcion(sql, nombre, delim = '$fn$') {
  const i = sql.indexOf(`create or replace function public.${nombre}(`)
  if (i < 0) return ''
  const j = sql.indexOf(`\nas ${delim}`, i)
  const re = new RegExp(`\\n(?:end )?\\${delim[0]}${delim.slice(1).replace(/\$/g, '\\$')};`)
  const m = re.exec(sql.slice(j))
  return sql.slice(i, j + m.index + m[0].length)
}

const FUNCIONES = [
  'xp_de_nivel', 'nivel_de_xp', 'nivel_en_gremio',
  'oportunidades_expansion', 'forjar_llave', 'mis_llaves',
  'consumir_llave', 'revertir_llave'
]

const forja = soloSql(funcion(schema, 'forjar_llave'))
const oportunidades = soloSql(funcion(schema, 'oportunidades_expansion'))
const consumir = soloSql(funcion(schema, 'consumir_llave'))
const revertir = soloSql(funcion(schema, 'revertir_llave'))

describe('la fórmula del nivel dice lo mismo en SQL que en JS', () => {
  // Se extrae la aritmética del SQL y se ejecuta en JS. Comparar los textos no
  // valdría —`50 * n * (n - 1)` y `50 * (n * n - n)` son la misma curva
  // escrita distinto, y una reescritura inocente haría caer la prueba sin que
  // nada se hubiera roto—. Lo que importa son los valores.
  const cuerpo = funcion(schema, 'xp_de_nivel')
  const expr = /select \(([^;]+)\)::integer;/.exec(cuerpo)?.[1]

  it('la expresión se encuentra en el SQL', () => {
    // Si el parseo falla, todo lo de abajo pasaría comparando undefined con
    // undefined, que es la forma más silenciosa de no comprobar nada.
    expect(expr, 'no se ha podido extraer la aritmética de xp_de_nivel').toBeTruthy()
  })

  it('y produce exactamente `xpForLevel` del nivel 1 al 40', () => {
    const enSql = new Function('p_nivel', `return ${expr}`)
    for (let n = 1; n <= 40; n++) {
      expect(enSql(n), `xp_de_nivel(${n}) difiere de xpForLevel(${n})`).toBe(xpForLevel(n))
    }
  })

  it('`nivel_de_xp` recorre la escala con el mismo bucle que `levelFromXp`', () => {
    // Y no con una fórmula cerrada: `floor((1 + sqrt(1 + xp / 12.5)) / 2)` en
    // coma flotante devuelve el nivel ANTERIOR justo en el valor exacto de un
    // hito, que es el único sitio donde esta función decide algo.
    const cuerpoNivel = soloSql(funcion(schema, 'nivel_de_xp'))
    expect(cuerpoNivel).toContain('while v_nivel < 999 and p_xp >= public.xp_de_nivel(v_nivel + 1) loop')
    expect(cuerpoNivel).not.toMatch(/sqrt|\^\s*0\.5|power\(/)
  })

  it('y el bucle es el mismo algoritmo, comprobado en los límites exactos', () => {
    // Se reproduce el bucle del SQL en JS y se compara con `levelFromXp` justo
    // en los bordes, que es donde una implementación distinta se delata.
    const enSql = new Function('p_nivel', `return ${expr}`)
    const nivelSql = (xp) => {
      let n = 1
      while (n < 999 && xp >= enSql(n + 1)) n++
      return n
    }
    for (let n = 1; n <= 30; n++) {
      for (const xp of [xpForLevel(n) - 1, xpForLevel(n), xpForLevel(n) + 1]) {
        if (xp < 0) continue
        expect(nivelSql(xp), `en xp=${xp}`).toBe(levelFromXp(xp))
      }
    }
  })
})

describe('el hito alcanzado no se retira', () => {
  it('el nivel sale de la marca de agua y no de la XP de hoy', () => {
    // `E-4.5`. Deshacer una misión baja `xp`; `xp_maxima` no baja nunca.
    const enGremio = soloSql(funcion(schema, 'nivel_en_gremio'))
    expect(enGremio).toContain('greatest(coalesce(p.xp_maxima, 0), coalesce(p.xp, 0))')
  })

  it('y la forja lee lo mismo', () => {
    expect(forja).toContain('greatest(coalesce(pr.xp_maxima, 0), coalesce(pr.xp, 0))')
  })

  it('la pantalla también, para que no digan cosas distintas', () => {
    expect(oportunidades).toContain('greatest(coalesce(pr.xp_maxima, 0), coalesce(pr.xp, 0))')
  })
})

describe('nada cobra antes de haber dicho que sí', () => {
  // El orden ES la especificación. Se comprueba por posición en el texto: lo
  // que puede negar tiene que aparecer antes de lo que cobra.
  const pos = (aguja) => {
    const i = forja.indexOf(aguja)
    expect(i, `no se encuentra en forjar_llave: ${aguja}`).toBeGreaterThan(-1)
    return i
  }

  it('el cobro es la última línea que toca dinero', () => {
    const cobro = pos("public.mover_cartera(v_uid, v_profile, 'forja_llave'")
    for (const antes of [
      "return 'exige_identidad_personal'",
      "return 'sin_pertenencia'",
      "return 'sin_personaje'",
      "return 'tipo_no_forja'",
      "return 'escalon_desconocido'",
      "return 'nivel_insuficiente'",
      "return 'ya_forjado'",
      "return 'en_el_limite'",
      "return 'sin_monedas'"
    ]) {
      expect(pos(antes), `${antes} tiene que decidirse antes de cobrar`).toBeLessThan(cobro)
    }
  })

  it('el límite global se comprueba antes que el saldo', () => {
    // No llegar de dinero es cuestión de una semana; estar en el límite es una
    // decisión —salir de un gremio—. Decir primero lo que no se arregla solo.
    expect(pos("return 'en_el_limite'")).toBeLessThan(pos("return 'sin_monedas'"))
  })

  it('y el límite sale de la configuración, no de un 5 escrito aquí', () => {
    expect(forja).toContain('public.parametros_expansion()')
    expect(forja).not.toMatch(/>=\s*5\b/)
  })

  it('sin configuración válida se deniega, nunca se regala', () => {
    // `CFG-6`. Cero filas en `hito_expansion()` quiere decir «no hay
    // configuración» o «no hay tal escalón», y las dos se responden igual.
    expect(forja).toContain('select * into h from public.hito_expansion(p_orden)')
    expect(forja).toContain("if not found then return 'escalon_desconocido'")
  })

  it('el coste lo pone el servidor y no llega del cliente', () => {
    // `R-26`, `SEC-1`. La firma no admite un coste, y el que se cobra es
    // `h.coste`, que sale de la configuración vigente.
    expect(schema).toContain('create or replace function public.forjar_llave(\n  p_family uuid,\n  p_orden integer,\n  p_clave text default null\n)')
    expect(forja).toContain('-h.coste')
  })
})

describe('un intento fallido también es historia', () => {
  it('quedarse sin TALIS deja asiento, y con el saldo igual antes y después', () => {
    // `R-08`, `F-5` paso 5. Sin esto, un pico de gente que no llega a la
    // primera llave no se ve en ninguna parte.
    expect(forja).toContain(
      "public.anota_coins(v_profile, 'forja_llave', -h.coste, v_saldo, v_saldo,"
    )
    expect(forja).toContain("'sin_monedas', null, p_clave)")
  })

  it('pero un nivel insuficiente no ensucia el libro', () => {
    // Solo el rechazo por saldo deja asiento: es el único que es económico.
    // Anotar «te falta nivel» llenaría el libro de cosas que no son dinero.
    // Se corta justo donde empieza la comprobación de saldo: el `anota_coins`
    // del rechazo va dentro de ese bloque, y cortando en el `return` quedaría
    // del lado equivocado.
    const antesDelSaldo = forja.slice(0, forja.indexOf('v_saldo := coalesce('))
    expect(antesDelSaldo.length).toBeGreaterThan(500)
    expect(antesDelSaldo).not.toContain('anota_coins')
  })

  it('y el mismo intento repetido devuelve lo mismo sin forjar dos veces', () => {
    expect(forja).toContain('select resultado into v_previo from public.movimientos_coins where clave = p_clave')
  })
})

describe('el mismo escalón no se compra dos veces', () => {
  it('lo garantiza un índice, no un `select` previo', () => {
    // Entre el `select` y el `insert` cabe otra petición: es el oficio de
    // `idx_bonuses_uno_al_dia`.
    for (const sql of [schema, m056]) {
      expect(sql).toMatch(
        /create unique index if not exists idx_derecho_escalon_una_vez\s+on public\.derechos_expansion \(persona, origen, orden\)\s+where estado in \('disponible','consumido'\)/
      )
    }
  })

  it('y una llave revertida NO bloquea el escalón', () => {
    // Revertir devuelve el dinero (`T-12`). Si además se quedara con la
    // oportunidad, la persona habría perdido las dos cosas.
    expect(m056).toContain("where estado in ('disponible','consumido')")
    expect(forja).toContain("and d.estado in ('disponible','consumido')")
  })

  it('el choque simultáneo se traduce a `ya_forjado` sin haber cobrado', () => {
    expect(forja).toContain('exception when unique_violation then')
    // Y el manejador rodea solo al `insert`: al final de la función se tragaría
    // también el choque de claves del libro, y un problema de idempotencia
    // saldría disfrazado de `ya_forjado`.
    const iInsert = forja.indexOf('insert into public.derechos_expansion')
    const iHandler = forja.indexOf('exception when unique_violation then')
    const iCobro = forja.indexOf("public.mover_cartera(v_uid, v_profile, 'forja_llave'")
    expect(iInsert).toBeLessThan(iHandler)
    expect(iHandler).toBeLessThan(iCobro)
  })
})

describe('la llave, una vez forjada', () => {
  it('registra lo que `R-18` enumera', () => {
    for (const col of [
      'persona uuid not null', 'origen uuid not null', 'origen_nombre text not null',
      'personaje uuid', 'orden integer not null', 'temporada integer',
      'coste integer not null', 'version text not null', 'estado text not null',
      'destino uuid', 'forjada_at timestamptz not null'
    ]) {
      expect(m056, `falta la columna: ${col}`).toContain(col)
    }
  })

  it('el origen sobrevive al cierre del gremio de origen', () => {
    // `E-7.4`: «sigue registrando A como gremio de origen». Con `cascade` un
    // gremio cerrado borraría llaves pagadas; con `set null` borraría la
    // trazabilidad que pide `R-22`. Por eso no hay clave ajena, y por eso se
    // guarda el nombre: un uuid huérfano registra el origen para la base, no
    // para quien lee su lista de llaves.
    const tabla = m056.slice(
      m056.indexOf('create table if not exists public.derechos_expansion'),
      m056.indexOf('create unique index if not exists idx_derecho_escalon_una_vez')
    )
    expect(tabla).not.toMatch(/origen uuid not null references/)
    expect(tabla).toContain('origen_nombre text not null')
  })

  it('«consumida» no es solo una palabra en una columna', () => {
    expect(m056).toContain('constraint derecho_consumido_con_destino')
    expect(m056).toContain("when 'disponible' then destino is null and cerrada_at is null")
    expect(m056).toContain("when 'consumido'  then destino is not null and cerrada_at is not null")
  })

  it('y no la puede crear nadie por la API', () => {
    // Crear una llave a mano sería crear dinero.
    expect(m056).toContain('revoke all on table public.derechos_expansion from authenticated;')
    expect(m056).toContain('grant select on table public.derechos_expansion to authenticated;')
    expect(m056).toContain('for select to authenticated\n  using (persona = auth.uid())')
  })

  it('cambiar la configuración después no la toca', () => {
    // `T-15`, `E-7.2`, `E-7.3`: la versión y el coste se GUARDAN en la fila.
    expect(forja).toContain('coalesce(v_temporada, 1), h.coste, h.version)')
  })
})

describe('una llave, un uso', () => {
  it('`consumir_llave` rechaza la que no está disponible', () => {
    // `E-9.12`.
    expect(consumir).toContain("if v_estado <> 'disponible' then")
    expect(consumir).toContain("raise exception 'llave_no_disponible'")
  })

  it('y la que no es tuya', () => {
    expect(consumir).toContain("raise exception 'llave_ajena'")
  })

  it('lanza en vez de devolver un código, y no la puede llamar el cliente', () => {
    // `R-20` y `T-10`: la llave se consume solo cuando la operación de destino
    // ha terminado bien, y la única forma de garantizarlo es que las dos cosas
    // se deshagan juntas. Un cliente que pudiera llamarla suelta consumiría una
    // llave sin crear nada.
    expect(m056).toContain('revoke all on function public.consumir_llave(uuid, uuid, text) from authenticated;')
    expect(m056).not.toContain('grant execute on function public.consumir_llave')
  })

  it('hoy no la llama nadie: gastarla es la Fase 6', () => {
    const cuerpos = schema.split('$fn$').filter((_, i) => i % 2 === 1)
    expect(cuerpos.filter((c) => c.includes('public.consumir_llave('))).toEqual([])
  })
})

describe('devolver una llave', () => {
  it('es de operador y exige motivo escrito', () => {
    expect(revertir).toContain('if not public.es_operador() then')
    expect(revertir).toContain("length(btrim(p_motivo)) < 10")
  })

  it('una consumida no se revierte', () => {
    // `T-13`: habría que deshacer una pertenencia y un personaje ya en uso.
    expect(revertir).toContain("if d.estado = 'consumido' then return 'ya_consumida'")
  })

  it('y el dinero vuelve con un asiento nuevo, no borrando el viejo', () => {
    // `I-7`, `T-12`.
    expect(revertir).toContain("public.mover_cartera(d.persona, v_profile, 'devolucion_llave', d.coste")
    expect(revertir).not.toMatch(/delete from public\.movimientos_coins/)
  })

  it('y el libro conoce los dos motivos nuevos', () => {
    for (const sql of [schema, m056]) {
      expect(sql).toContain("'forja_llave', 'devolucion_llave',")
    }
  })
})

describe('el tipo decide, y lo dice la plantilla', () => {
  it('la forja pregunta a la plantilla, no compara el tipo', () => {
    // `R-114` y la lección de la 053: cero condicionales por tipo fuera de la
    // plantilla. Equipo no origina llaves porque su plantilla dice
    // `expansion_desde_tipo = false`, no porque aquí haya un `if`.
    expect(forja).toContain('coalesce(t.expansion_desde_tipo, false)')
    expect(forja).not.toMatch(/tipo_plantilla\s*=\s*'equipo'/)
    expect(oportunidades).not.toMatch(/tipo_plantilla\s*=\s*'equipo'/)
  })
})

describe('la pantalla solo muestra', () => {
  it('`oportunidades_expansion` responde en el mismo orden que la forja', () => {
    // Si la pantalla dijera «puedes» donde el servidor dice «te falta nivel»,
    // el botón mentiría. El orden de los `when` es el de las comprobaciones.
    const casos = [...oportunidades.matchAll(/then '([a-z_]+)'/g)].map((m) => m[1])
    expect(casos.slice(0, 5)).toEqual([
      'forjada', 'tipo_no_forja', 'falta_nivel', 'en_el_limite', 'falta_monedas'
    ])
  })

  it('y devuelve cuánto falta, no solo que falta', () => {
    expect(oportunidades).toContain('greatest(0, public.xp_de_nivel(e.nivel_exigido) - v_xp)')
    expect(oportunidades).toContain('greatest(0, e.coste - v_saldo)')
  })

  it('pero no autoriza nada: la forja lo vuelve a comprobar todo', () => {
    for (const c of ['clase_credencial', 'hito_expansion', 'parametros_expansion', 'mover_cartera']) {
      expect(forja, `forjar_llave no comprueba ${c}`).toContain(c)
    }
  })
})

describe('las dos copias del esquema', () => {
  it('los cuerpos son iguales hasta el último acento', () => {
    for (const n of FUNCIONES) {
      expect(funcion(schema, n), `${n} difiere entre schema.sql y la 056`)
        .toBe(funcion(m056, n))
    }
  })

  it('y los permisos, iguales y deliberados', () => {
    for (const [firma, publica] of [
      ['public.nivel_en_gremio(uuid)', true],
      ['public.oportunidades_expansion(uuid)', true],
      ['public.forjar_llave(uuid, integer, text)', true],
      ['public.mis_llaves()', true],
      ['public.revertir_llave(uuid, text)', true],
      ['public.consumir_llave(uuid, uuid, text)', false]
    ]) {
      for (const sql of [schema, m056]) {
        expect(sql).toContain(`revoke all on function ${firma} from anon;`)
        if (publica) expect(sql).toContain(`grant execute on function ${firma} to authenticated;`)
        else expect(sql).toContain(`revoke all on function ${firma} from authenticated;`)
      }
    }
  })

  it('la migración termina pegando el barrido de la 021', () => {
    const cola = m056.slice(m056.lastIndexOf('do $$'))
    expect(cola).toContain('revoke all on function %s from public')
    expect(cola).toContain('revoke all on function %s from anon')
  })
})
