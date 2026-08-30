import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// El país de operación se declara, nunca se deduce (migración 055).
//
// Lo que este fichero defiende, en una frase: que nadie reciba un país sin
// haberlo dicho, y que nadie se quede fuera por no haberlo dicho todavía.
//
// Las dos mitades se rompen de maneras distintas y las dos son fáciles. La
// primera se rompe por comodidad —`timezone` dice 'Europe/Madrid' para todos
// los gremios que existen, y sacar 'ES' de ahí es una línea—, y produce un
// país inventado por el servidor con apariencia de dato declarado. La segunda
// se rompe por prudencia: poner un `not null`, o tratar 'sin_pais' como un
// 'no', bloquea a los gremios que llevan desde agosto funcionando.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m055 = leer('migracion-055-el-pais-se-declara-nunca-se-deduce.sql')

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
  'tg_pais_inmutable',
  'declarar_pais',
  'pais_de_gremio',
  'disponibilidad_de_tipo',
  'exige_pais'
]

const declarar = soloSql(funcion(schema, 'declarar_pais'))
const inmutable = soloSql(funcion(schema, 'tg_pais_inmutable'))
const disponibilidad = soloSql(funcion(schema, 'disponibilidad_de_tipo'))
const exige = soloSql(funcion(schema, 'exige_pais'))

describe('ningún gremio recibe un país por inferencia', () => {
  it('la columna nace nula y no tiene valor por defecto', () => {
    const col = /pais text\s*\n?\s*check \(pais is null or pais ~ '\^\[A-Z\]\{2\}\$'\)/
    expect(schema).toMatch(col)
    expect(m055).toMatch(col)
    // Y se comprueba dentro de la tabla, no en todo el fichero: un `not null`
    // o un `default 'ES'` ahí es la inferencia escrita en el esquema.
    const tabla = soloSql(
      schema.slice(
        schema.indexOf('create table if not exists public.families ('),
        schema.indexOf('create or replace function public.zona_valida()')
      )
    )
    expect(tabla).toMatch(/\n {2}pais text\n/)
    expect(tabla).not.toMatch(/pais[^\n]*default/)
    expect(tabla).not.toMatch(/pais[^\n]*not null/)
  })

  it('y la zona horaria no se convierte en país en ninguna parte', () => {
    // La tentación de al lado: `timezone` existe desde la 018 y dice
    // 'Europe/Madrid' para todos. Media línea y el país queda «deducido».
    for (const f of FUNCIONES) {
      expect(soloSql(funcion(schema, f)), `${f} mira la zona horaria`).not.toContain('timezone')
    }
    expect(soloSql(funcion(schema, 'declarar_pais'))).not.toContain('Europe/Madrid')
  })

  it('la migración no declara el país de ningún gremio', () => {
    // Ni el de la casa real. Hacerlo aquí sería la inferencia por otro camino.
    expect(soloSql(m055)).not.toMatch(/update public\.families\s+set pais = '[A-Z]{2}'/)
  })

  it('solo se admiten dos letras mayúsculas, sin traducir ni adivinar', () => {
    expect(declarar).toContain("upper(btrim(coalesce(p_pais, '')))")
    expect(declarar).toContain("if v_pais !~ '^[A-Z]{2}$' then return 'pais_invalido'")
  })
})

describe('se declara una vez, y por la puerta', () => {
  it('una vez declarado no se cambia ni se retira', () => {
    expect(inmutable).toContain('if old.pais is not null then')
    expect(inmutable).toContain('if new.pais is null then')
    expect(inmutable).toMatch(/errcode = 'restrict_violation'/)
  })

  it('y un `update` a mano no lo pone la primera vez', () => {
    // Sin esto la comprobación de capacidad sería decorativa: la política
    // `familia_owner` es `for all`, así que la cuenta del gremio escribe en
    // `families` por la API y se pondría el país sin pasar por `CAP-04`.
    expect(inmutable).toContain("current_setting('app.declarando_pais', true)")
    expect(inmutable).toContain('<> new.id::text')
  })

  it('el pestillo lleva el gremio dentro y dura lo que la transacción', () => {
    // Un pestillo abierto para el gremio A no puede abrir el B, y no puede
    // sobrevivir a la llamada que lo abrió.
    expect(declarar).toContain("set_config('app.declarando_pais', p_family::text, true)")
    expect(declarar).toContain("set_config('app.declarando_pais', '', true)")
  })

  it('el disparador está puesto sobre `families`', () => {
    for (const sql of [schema, m055]) {
      expect(sql).toMatch(
        /create trigger families_pais_inmutable\s+before update on public\.families/
      )
    }
  })

  it('y el apunte de la declaración no se reescribe', () => {
    expect(inmutable).toContain('new.pais_declarado_at is distinct from old.pais_declarado_at')
    expect(inmutable).toContain('new.pais_declarado_por is distinct from old.pais_declarado_por')
  })
})

describe('quién puede declararlo', () => {
  it('por capacidad, y la capacidad es `CAP-04`', () => {
    // «Cambiar los ajustes del gremio». Hoy reparte 'pin' a titular, gestor y
    // adulto: el perfil adulto con el PIN y la persona con administración que
    // pide `R-117`, palabra por palabra.
    expect(declarar).toContain("public.puede(p_family, 'CAP-04', p_profile) = 'no'")
    expect(declarar).toContain("return 'no_puede'")
  })

  it('y no inventa una capacidad nueva', () => {
    // Inventar `CAP-18` tendría un efecto que solo se ve leyendo la 054: lo
    // que no está declarado no está permitido, así que ninguna plantilla
    // publicada la tendría y la declaración sería imposible para todos.
    // Se mira el SQL, no los comentarios: el porqué sí está escrito arriba
    // del todo de la migración, y ahí `CAP-18` se nombra para descartarla.
    expect(soloSql(m055)).not.toMatch(/CAP-18/)
    expect(soloSql(m055)).not.toMatch(/insert into public\.capacidades/)
  })

  it('nunca por etiqueta', () => {
    expect(declarar).not.toMatch(/role\s*=\s*'adulto'/)
  })

  it('y el gremio tiene que ser mío', () => {
    expect(declarar).toContain('if not public.es_mi_gremio(p_family) then')
  })
})

describe('declarar dos veces', () => {
  it('el mismo país es `ok`: un doble clic no es un error', () => {
    expect(declarar).toContain("if v_actual = v_pais then return 'ok'; end if;")
  })

  it('uno distinto se ignora y el intento queda registrado (E-12.6)', () => {
    // El servidor se queda con lo que tiene y anota el intento. El apunte
    // permanente —quién declaró, cuándo y qué— está en `families`; `app_logs`
    // es para lo que hay que mirar, no para lo que hay que guardar siempre.
    expect(declarar).toContain("'warn', 'pais_ya_declarado'")
    expect(declarar).toContain("jsonb_build_object('declarado', v_actual, 'intentado', v_pais)")
    expect(declarar).toContain("return 'ya_declarado'")
  })

  it('y el registro del intento no puede tumbar la transacción', () => {
    // `app_logs.profile_id` tiene clave ajena: un id inventado dejaría el
    // intento sin registrar por culpa del propio registro.
    expect(declarar).toMatch(/select pr\.id from public\.profiles pr\s+where pr\.id = p_profile and pr\.family_id = p_family/)
  })
})

describe('la matriz se resuelve en servidor', () => {
  it('la función recibe el gremio y NO recibe un país', () => {
    // Eso es `R-108` y `SEC-29` escritos en la firma, y es la razón de que
    // esta sí se pueda conceder a `authenticated` y `tipo_publicado()` no.
    expect(schema).toContain('create or replace function public.disponibilidad_de_tipo(p_family uuid, p_tipo text)')
    expect(disponibilidad).toContain('select f.pais into v_pais from public.families f where f.id = p_family')
    expect(disponibilidad).toContain('public.tipo_publicado(p_tipo, v_pais)')
  })

  it('y `tipo_publicado()` sigue sin concederse a `authenticated`', () => {
    expect(schema).toContain('revoke all on function public.tipo_publicado(text, text) from authenticated;')
    expect(schema).not.toContain('grant execute on function public.tipo_publicado(text, text) to authenticated')
  })

  it('«sin país» no es «no»', () => {
    // La diferencia entera de `R-117`: 'sin_pais' es lo único que dispara la
    // pregunta. Tratarlo como un 'no' bloquea un gremio por no haber
    // declarado, que es justo lo que la regla prohíbe.
    expect(disponibilidad).toContain("if v_pais is null then return 'sin_pais'; end if;")
    expect(disponibilidad).toContain("return 'si'")
  })

  it('`tipos_ofrecidos()` no gana un parámetro de país', () => {
    // Un gremio que se está creando todavía no tiene país: el cruce con la
    // matriz es de la creación de gremios (Fase 6). Añadirlo hoy sería darle
    // al cliente la palanca que `R-108` prohíbe, sin nadie que la comprobara.
    expect(schema).toContain('create or replace function public.tipos_ofrecidos()')
    expect(schema).not.toMatch(/function public\.tipos_ofrecidos\(p_pais/)
  })
})

describe('a nadie se le bloquea nada', () => {
  it('la puerta existe y hoy no la llama nadie', () => {
    // `exige_pais()` existe antes que su primer uso a propósito, igual que
    // `exige_persona()` en la 044. Mientras nadie la llame, ningún gremio
    // está bloqueado por no haber declarado.
    expect(exige).toContain("raise exception 'pais_sin_declarar'")
    // Se busca dentro de los CUERPOS: fuera de ellos la firma aparece cuatro
    // veces —la definición, dos `revoke` y el `grant`—, que no son llamadas.
    const cuerpos = schema.split('$fn$').filter((_, i) => i % 2 === 1)
    const llaman = cuerpos.filter((c) => c.includes('public.exige_pais('))
    expect(llaman, 'alguien ha empezado a exigir el país').toEqual([])
  })

  it('ninguna función viva empieza a mirar el país', () => {
    for (const n of [
      'grant_manual_bonus', 'crear_campana_limpieza', 'cerrar_campana_limpieza',
      'redeem_reward', 'undo_completion', 'solicitar_conversion'
    ]) {
      const cuerpo = soloSql(funcion(schema, n))
      // Sin esta línea el test pasaría solo porque el parseo falló y `cuerpo`
      // salió vacío, que es la forma más silenciosa de no comprobar nada.
      expect(cuerpo.length, `no se ha encontrado ${n} en schema.sql`).toBeGreaterThan(100)
      expect(cuerpo, `${n} ha empezado a exigir país`).not.toContain('pais')
    }
  })

  it('y el cliente puede saber si tiene que preguntar', () => {
    expect(schema).toContain('grant execute on function public.pais_de_gremio() to authenticated;')
    // Pero `pais_declarado_por` no sale de la base: mismo criterio que
    // `publicada_por` y `motivo` en la 050. La auditoría se guarda, no se
    // publica.
    expect(funcion(schema, 'pais_de_gremio')).not.toContain('pais_declarado_por')
  })
})

describe('las dos copias del esquema', () => {
  it('los cuerpos son iguales hasta el último acento', () => {
    // Postgres guarda el cuerpo TAL CUAL en `pg_proc.prosrc`, comentarios
    // incluidos: dos copias que difieren en un acento producen objetos
    // distintos en la base.
    for (const n of FUNCIONES) {
      expect(funcion(schema, n), `${n} difiere entre schema.sql y la 055`)
        .toBe(funcion(m055, n))
    }
  })

  it('y las cuatro funciones tienen su `grant` o su ausencia deliberada', () => {
    for (const [firma, publica] of [
      ['public.declarar_pais(uuid, text, uuid)', true],
      ['public.pais_de_gremio()', true],
      ['public.disponibilidad_de_tipo(uuid, text)', true],
      ['public.exige_pais(uuid)', true],
      // Un disparador no lo llama nadie desde fuera.
      ['public.tg_pais_inmutable()', false]
    ]) {
      for (const sql of [schema, m055]) {
        expect(sql).toContain(`revoke all on function ${firma} from anon;`)
        if (publica) expect(sql).toContain(`grant execute on function ${firma} to authenticated;`)
        else expect(sql).toContain(`revoke all on function ${firma} from authenticated;`)
      }
    }
  })

  it('la migración termina pegando el barrido de la 021', () => {
    const cola = m055.slice(m055.lastIndexOf('do $$'))
    expect(cola).toContain('revoke all on function %s from public')
    expect(cola).toContain('revoke all on function %s from anon')
  })
})
