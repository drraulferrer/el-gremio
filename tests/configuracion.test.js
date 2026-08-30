import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// La configuración versionada de la expansión (migración 050, pieza 3.1).
//
// Lo que defiende este fichero no son los números —de eso ya se ocupa
// `expansion.test.js`, que ahora los lee de aquí— sino las cuatro propiedades
// que hacen que tenerlos en una tabla sirva de algo:
//
//   1 · que estén en UN solo sitio, y que el sitio sea el servidor (`CFG-1`,
//       `CFG-2`). Si el cliente recibe la fórmula, la recalcula, y ya hay dos;
//   2 · que una versión publicada no se pueda tocar (`CFG-3`). Sin eso, el
//       recibo de una llave comprada ayer miente en cuanto alguien sube un
//       precio, y `CAM-1` a `CAM-6` dejan de cumplirse solas;
//   3 · que quede dicho quién la cambió y por qué (`CFG-4`);
//   4 · que la ausencia de configuración DENIEGUE (`CFG-6`). Es la que más
//       fácil se pierde: basta un `coalesce(coste, 300)` en la función que
//       forje, dentro de tres meses, para regalar la expansión a todo el
//       mundo el día que alguien retire una versión.
//
// Se lee el SQL como texto, igual que en `pertenencia.test.js` y en
// `conversion.test.js`, y por el mismo motivo: no sustituye a ejecutarlo, pero
// caza las dos formas de romperlo sin enterarse —cambiar una de las dos copias
// del esquema y no la otra, y añadir un valor por defecto donde no lo había—.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m050 = leer('migracion-050-las-reglas-dejan-de-ser-constantes.sql')

/** Sin los comentarios: lo que promete la prosa no es lo que ejecuta Postgres. */
const soloSql = (sql) =>
  sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')

/** El cuerpo de una función, del `create` a su `$fn$;`. */
function funcion(sql, nombre) {
  const i = sql.indexOf(`create or replace function public.${nombre}(`)
  if (i < 0) return ''
  const j = sql.indexOf('\nas $fn$', i)
  const m = /\n(?:end )?\$fn\$;/.exec(sql.slice(j))
  return sql.slice(i, j + m.index + m[0].length)
}

/** Una tabla, del `create table` a su `);`. */
function tabla(sql, nombre) {
  const i = sql.indexOf(`create table if not exists public.${nombre} (`)
  if (i < 0) return ''
  const j = sql.indexOf('\n);', i)
  return sql.slice(i, j + 3)
}

/** El bloque entero de la 050, desde la primera tabla hasta el final de la semilla. */
function bloque(sql) {
  const i = sql.indexOf('create table if not exists public.configuracion_expansion')
  const j = sql.indexOf("'hogar_compartido', 'ES', 'no_publicado');", i)
  const k = sql.indexOf('end $$;', j)
  return sql.slice(i, k + 'end $$;'.length)
}

const LECTORAS = [
  'configuracion_expansion_vigente',
  'parametros_expansion',
  'escala_expansion',
  'hito_expansion',
  'tipo_publicado'
]

describe('las dos copias del esquema dicen lo mismo', () => {
  it('el bloque de la 050 es idéntico en `schema.sql` y en la migración', () => {
    // La regla de la casa es que cada cambio de esquema se escribe dos veces.
    // El precio de esa regla es que se puede corregir una copia y olvidar la
    // otra, y entonces una base reconstruida desde `schema.sql` no es la de
    // producción. Se comparan las líneas ejecutables, normalizando los acentos
    // porque los `.sql` nuevos van sin ellos y `schema.sql` los conserva.
    const normalizar = (sql) =>
      soloSql(sql)
        .split('\n')
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')

    expect(normalizar(bloque(schema))).toBe(normalizar(bloque(m050)))
  })

  it('la migración termina pegando el barrido de la 021', () => {
    // La regla que la 046 tuvo que rescatar: toda migración que cree o
    // reemplace una función `security definer` acaba con el barrido, y retira
    // PUBLIC además de `anon` porque `anon` HEREDA de PUBLIC.
    const cola = soloSql(m050).slice(-1200)
    expect(cola).toContain('where n.nspname = \'public\' and p.prosecdef')
    expect(cola).toContain("revoke all on function %s from public")
    expect(cola).toContain("revoke all on function %s from anon")
  })
})

describe('los campos mínimos de `R-66` están todos', () => {
  const cabecera = tabla(schema, 'configuracion_expansion')
  const escalones = tabla(schema, 'escalones_expansion')

  it('la cabecera declara identificador, vigencia, límite y regla de crecimiento', () => {
    // §11.4 los enumera uno a uno. Si falta cualquiera, la configuración no
    // responde a la pregunta para la que se creó.
    for (const campo of [
      'version text primary key',
      'vigente_desde timestamptz not null',
      'limite_global integer not null',
      'escalones_por_gremio integer not null',
      'regla_crecimiento text not null',
      'coste_base integer not null',
      'factor numeric'
    ]) {
      expect(cabecera, `falta ${campo}`).toContain(campo)
    }
  })

  it('y las caducidades decididas, con la de la llave nula a propósito', () => {
    // `R-62`: las invitaciones caducan a los 14 días y las llaves NO caducan.
    // El nulo de `llave_dias` es la decisión, no un hueco: una llave comprada
    // y caducada es dinero perdido sin haber recibido nada.
    expect(cabecera).toContain('invitacion_dias integer not null')
    expect(cabecera).toContain('solicitud_junior_dias integer not null')
    expect(cabecera).toContain('autorizacion_adulta_horas integer not null')
    expect(cabecera).toMatch(/llave_dias integer check/)
    expect(cabecera).not.toMatch(/llave_dias integer not null/)
  })

  it('la auditoría es obligatoria salvo el uid', () => {
    // `CFG-4`. `motivo` y `aprobada_por` son `not null` porque una versión sin
    // motivo es una versión que nadie sabrá explicar dentro de un año.
    expect(cabecera).toContain('motivo text not null')
    expect(cabecera).toContain('aprobada_por text not null')
    expect(cabecera).toContain('publicada_at timestamptz not null')
  })

  it('`publicada_por` no tiene clave ajena, y eso es deliberado', () => {
    // Con `on delete set null`, borrar la cuenta de quien publicó dispararía
    // un `update` que el disparador prohíbe: el borrado de la cuenta fallaría.
    // Un apunte de auditoría tiene que sobrevivir a la cuenta que nombra.
    expect(cabecera).toMatch(/publicada_por uuid,/)
    expect(cabecera).not.toMatch(/publicada_por uuid references/)
  })

  it('un escalón declara su orden, su nivel y su coste', () => {
    expect(escalones).toContain('orden integer not null')
    expect(escalones).toContain('nivel_exigido integer not null')
    expect(escalones).toContain('coste integer not null')
    expect(escalones).toContain('primary key (version, orden)')
  })

  it('ningún escalón puede exigir el nivel 1', () => {
    // `R-13`: el hito no puede ser alcanzable al empezar. Un `nivel_exigido`
    // de 1 sería una llave regalada en el primer minuto.
    expect(escalones).toContain('nivel_exigido integer not null check (nivel_exigido between 2 and 200)')
  })
})

describe('el coste vive en una sola fila (`CFG-1`)', () => {
  it('el cliente recibe el coste, nunca la fórmula para recalcularlo', () => {
    // Es la misma trampa que la curva de nivel escrita dos veces (`H-22`): en
    // cuanto el cliente pueda calcular `coste_base × factor^(k−1)`, hay dos
    // fuentes y un día dejan de coincidir. `parametros_expansion` devuelve
    // todo lo demás y esos dos NO.
    const p = soloSql(funcion(schema, 'parametros_expansion'))
    expect(p).toContain('limite_global')
    expect(p).toContain('invitacion_dias')
    expect(p).not.toContain('coste_base')
    expect(p).not.toContain('factor')
  })

  it('lo que se cobra sale de la fila del escalón', () => {
    const h = soloSql(funcion(schema, 'hito_expansion'))
    expect(h).toContain('from public.escalones_expansion e')
    expect(h).toContain('e.coste')
    // Ni potencias ni multiplicaciones: si aquí apareciera un `power`, el
    // número cobrado dejaría de ser el número guardado.
    expect(h).not.toContain('power(')
  })

  it('la regla declarada y las filas guardadas tienen que cuadrar', () => {
    // Guardar los costes uno a uno abre la puerta a que la escala y la regla
    // se separen: `regla_crecimiento` diría «geométrica ×2,5» y las filas
    // dirían otra cosa. El validador lo impide al publicar.
    const v = soloSql(funcion(schema, 'valida_escala_expansion'))
    expect(v).toContain("v_cfg.regla_crecimiento = 'geometrica'")
    expect(v).toContain('power(v_cfg.factor, (r.orden - 1)::numeric)')
  })
})

describe('una versión publicada no se toca (`CFG-3`)', () => {
  const sellada = soloSql(funcion(schema, 'tg_configuracion_sellada'))
  const hija = soloSql(funcion(schema, 'tg_hija_de_version_nueva'))

  it('`update` y `delete` fallan en las tres tablas', () => {
    // Las tres, no dos: la escala y la matriz de disponibilidad son parte de
    // la versión igual que su cabecera.
    expect(sellada).toContain('raise exception')
    for (const t of ['configuracion_expansion', 'escalones_expansion', 'disponibilidad_tipos']) {
      expect(
        soloSql(schema),
        `${t} admite update o delete`
      ).toMatch(new RegExp(`before update or delete on public\\.${t}\\b`))
    }
  })

  it('tampoco se le pueden añadir escalones después', () => {
    // Sin esto el sello no cierra nada: añadir mañana un quinto escalón a la
    // versión de hoy no es un `update`, y cambia lo que cobraba una versión
    // que ya se usó. Se reconoce por `publicada_at`, que la pone el servidor.
    expect(hija).toContain('v_publicada <> now()')
    expect(soloSql(schema)).toMatch(/before insert on public\.escalones_expansion/)
    expect(soloSql(schema)).toMatch(/before insert on public\.disponibilidad_tipos/)
    expect(soloSql(funcion(schema, 'tg_configuracion_fechada'))).toContain(
      'new.publicada_at := now()'
    )
  })

  it('la escala se valida al cerrar la transacción, y desde los dos lados', () => {
    // Diferido porque una escala se inserta fila a fila y a mitad de camino no
    // cuadra. Y desde la cabecera además de desde los escalones: publicar una
    // versión SIN escala tiene que fallar igual que publicar una torcida.
    const sql = soloSql(schema)
    expect(sql).toMatch(
      /create constraint trigger configuracion_expansion_coherente[\s\S]{0,200}deferrable initially deferred/
    )
    expect(sql).toMatch(
      /create constraint trigger escalones_expansion_coherentes[\s\S]{0,200}deferrable initially deferred/
    )
  })

  it('el validador defiende las cuatro reglas de la escala', () => {
    const v = soloSql(funcion(schema, 'valida_escala_expansion'))
    // Al menos un escalón (CFG-6), consecutivos desde 1, nivel creciente
    // (R-14) y coste al menos el doble (R-15, el mínimo que fijó
    // `expansion.test.js` al aprobar la calibración).
    expect(v).toContain('if v_n = 0 then')
    expect(v).toContain('v_min <> 1 or v_max <> v_n')
    expect(v).toContain('r.nivel_exigido <= r.nivel_previo')
    expect(v).toContain('r.coste < r.coste_previo * 2')
  })
})

describe('sin configuración válida se deniega (`CFG-6`)', () => {
  it('ninguna lectora tiene un valor por defecto escondido', () => {
    // La forma de la denegación es CERO FILAS, y es así a propósito: cero
    // filas no se confunde con un permiso. Un `coalesce` o un `default` aquí
    // convertiría la ausencia de reglas en una barra libre.
    for (const nombre of LECTORAS) {
      const f = soloSql(funcion(schema, nombre))
      expect(f, `${nombre} no existe`).not.toBe('')
      expect(f, `${nombre} tiene un coalesce`).not.toContain('coalesce')
      expect(f, `${nombre} tiene un default`).not.toContain('default')
    }
  })

  it('la vigente es una consulta, no una constante', () => {
    // Si no hay ninguna versión con la fecha cumplida, esto devuelve nulo, y
    // todo lo que cuelga de ello devuelve cero filas.
    const v = soloSql(funcion(schema, 'configuracion_expansion_vigente'))
    expect(v).toContain('c.vigente_desde <= now()')
    expect(v).toContain('order by c.vigente_desde desc')
    expect(v).toContain('limit 1')
  })

  it('todas las lectoras cuelgan de ella', () => {
    // Si alguna leyera la tabla por su cuenta, podría contestar con una
    // versión retirada o con una que aún no rige.
    for (const nombre of ['parametros_expansion', 'escala_expansion', 'hito_expansion', 'tipo_publicado']) {
      expect(soloSql(funcion(schema, nombre)), nombre).toContain(
        'public.configuracion_expansion_vigente()'
      )
    }
  })

  it('un tipo no declarado no está publicado', () => {
    // `exists` y no un `not exists` ni un nulo: lo que falta deniega. Añadir
    // un país a una lista del cliente no puede abrir un tipo que no ha pasado
    // su revisión jurídica.
    const t = soloSql(funcion(schema, 'tipo_publicado'))
    expect(t).toContain('select exists (')
    expect(t).toContain("d.estado = 'publicado'")
  })
})

describe('quién puede leer y quién no', () => {
  it('las tres tablas no se conceden a nadie por la API', () => {
    // Mismo patrón que `operadores`: RLS encendido y sin políticas. Así
    // `motivo` y `publicada_por` no salen por una petición cualquiera.
    const sql = soloSql(schema)
    for (const t of ['configuracion_expansion', 'escalones_expansion', 'disponibilidad_tipos']) {
      expect(sql, `${t} sin RLS`).toContain(`alter table public.${t} enable row level security`)
      expect(sql, `${t} concedida`).not.toMatch(new RegExp(`grant [a-z]+ on table public\\.${t}`))
      expect(sql).toContain(`revoke all on table public.${t} from anon`)
      expect(sql).toContain(`revoke all on table public.${t} from authenticated`)
    }
  })

  it('`anon` no puede ejecutar ninguna de las lectoras', () => {
    const sql = soloSql(m050)
    for (const nombre of LECTORAS) {
      expect(sql, `${nombre} no revoca anon`).toMatch(
        new RegExp(`revoke all on function public\\.${nombre}\\([^)]*\\) from anon`)
      )
    }
    expect(sql).not.toMatch(/grant execute on function public\.\w+\([^)]*\) to anon/)
  })

  it('`tipo_publicado` NO se concede a `authenticated`, y es la única', () => {
    // `R-108` y `SEC-29`: un cliente no declara en qué país está para
    // desbloquear un tipo. El país es un parámetro de esta función, así que la
    // llama el servidor —la creación de gremios de la Fase 4.4— y nadie más.
    const sql = soloSql(m050)
    expect(sql).toContain('revoke all on function public.tipo_publicado(text, text) from authenticated')
    expect(sql).not.toMatch(/grant execute on function public\.tipo_publicado/)
    for (const nombre of ['parametros_expansion', 'escala_expansion', 'hito_expansion']) {
      expect(sql, `${nombre} no se concede a authenticated`).toMatch(
        new RegExp(`grant execute on function public\\.${nombre}\\([^)]*\\) to authenticated`)
      )
    }
  })
})

describe('la primera versión es la calibración aprobada, sin retocar', () => {
  // Se lee la semilla del propio SQL. Estos números NO se eligen aquí: salen
  // de la calibración del 29-ago-2026 y los defiende `expansion.test.js`, que
  // desde la 050 los lee del mismo sitio que este fichero.
  const semilla = soloSql(bloque(schema))
  const escala = [...semilla.matchAll(/\(v_version,\s*(\d+),\s*(\d+),\s*(\d+)\)/g)].map(
    ([, orden, nivel, coste]) => ({ orden: +orden, nivel: +nivel, coste: +coste })
  )

  it('hay cuatro escalones, consecutivos', () => {
    expect(escala.map((e) => e.orden)).toEqual([1, 2, 3, 4])
  })

  it('el primer hito es el nivel 6 y cuesta 300', () => {
    // Los dos números aprobados: el nivel 6 cae hacia el día 31 de una
    // temporada de 60, y 300 Talis caben en lo que queda tras canjear un
    // premio de nivel 1. El porqué entero está en `expansion.test.js`.
    expect(escala[0]).toEqual({ orden: 1, nivel: 6, coste: 300 })
  })

  it('los hitos son 6, 8, 10 y 12', () => {
    expect(escala.map((e) => e.nivel)).toEqual([6, 8, 10, 12])
  })

  it('los costes siguen la regla geométrica declarada, al múltiplo de cinco', () => {
    // ×2,5 sobre el anterior. El cuarto sale 4687,5 y se redondea a 4690: no
    // se estrena una segunda regla de redondeo para un solo caso.
    const esperados = escala.map((_, i) => Math.round((300 * Math.pow(2.5, i)) / 5) * 5)
    expect(escala.map((e) => e.coste)).toEqual(esperados)
    expect(escala.map((e) => e.coste)).toEqual([300, 750, 1875, 4690])
  })

  it('la cabecera declara esa misma regla', () => {
    expect(semilla).toContain("'geometrica', 300, 2.5")
  })

  it('el límite global es cinco', () => {
    // `R-60`, el gremio inicial incluido. Bajarlo no expulsa a nadie
    // (`R-25`): eso lo cumple quien compra, no la tabla.
    expect(semilla).toMatch(/\n\s*5,\s*--\s*R-60/)
  })

  it('la matriz publica Hogar y Amigos en España, y nada más', () => {
    // §11.4. Equipo espera a su revisión jurídica (`R-77`, `R-93`) y el tipo
    // legado sigue funcionando pero no se ofrece al crear (`R-78`, `TIP-9`).
    const filas = [...semilla.matchAll(/\(v_version, '(\w+)',\s*'(\w+)', '(\w+)'\)/g)].map(
      ([, tipo, pais, estado]) => `${tipo}/${pais}/${estado}`
    )
    expect(filas).toEqual([
      'hogar/ES/publicado',
      'amigos/ES/publicado',
      'equipo/ES/no_publicado',
      'hogar_compartido/ES/no_publicado'
    ])
  })
})

describe('ningún número de la expansión vive ya en el cliente (`CFG-2`)', () => {
  it('`src/lib` no declara la escala, ni el límite, ni el coste base', () => {
    // Es la condición de hecho de la pieza 3.1 del plan. Hoy no hay ninguno
    // —los números vivían en el test de calibración— y este test existe para
    // que no vuelvan: dejarlos en un módulo del cliente es la opción cómoda
    // que `CFG-2` descarta, porque el servidor no la lee al cobrar.
    const modulos = ['economia.js', 'temporadas.js', 'premios.js', 'supabase.js', 'acciones.js']
    const prohibido = /\b(COSTE_BASE|COSTE_EXPANSION|HITOS|HITOS_EXPANSION|FACTOR_EXPANSION|LIMITE_GLOBAL|ESCALA_EXPANSION|MAX_GREMIOS)\b/
    for (const m of modulos) {
      expect(leer(`src/lib/${m}`), `${m} declara configuración de expansión`).not.toMatch(prohibido)
    }
  })
})
