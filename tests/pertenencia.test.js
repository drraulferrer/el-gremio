import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// Identidad y pertenencia (migraciones 044 y 045).
//
// Lo que defiende este fichero es el cambio de sujeto del aislamiento: hasta
// la 045 el permiso lo daba SER LA DUEÑA de la cuenta del gremio; a partir de
// ella, PERTENECER al gremio. Es el cambio con más riesgo de todo el plan
// porque toca las políticas de todas las tablas sobre datos vivos, y porque
// hoy es un no-op: si alguien lo rompiera, no se notaría hasta que la primera
// persona con identidad propia entrara en su casa y la viera vacía.
//
// Se lee el SQL como texto a propósito. No sustituye a ejecutar la migración
// —eso se hace contra la base, y en su bloque de comprobación— pero sí caza
// las dos formas de romperlo sin enterarse: escribir una política nueva con el
// predicado viejo, y cambiar una de las dos copias del esquema y no la otra.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m044 = leer('migracion-044-persona-y-pertenencia.sql')
const m045 = leer('migracion-045-aislamiento-por-pertenencia.sql')

/** Sin los comentarios: lo que promete la prosa no es lo que ejecuta Postgres. */
const soloSql = (sql) =>
  sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')

/** Cada `create policy ... ;` del fichero, con su nombre. */
function politicas(sql) {
  const texto = soloSql(sql)
  const salida = []
  const re = /create policy\s+(\w+)\s+on\s+public\.(\w+)/g
  let m
  while ((m = re.exec(texto))) {
    const fin = texto.indexOf(';', m.index)
    salida.push({ nombre: m[1], tabla: m[2], cuerpo: texto.slice(m.index, fin) })
  }
  return salida
}

/** El cuerpo de una función, del `create` a su `$fn$;`. */
function funcion(sql, nombre) {
  const i = sql.indexOf(`create or replace function public.${nombre}(`)
  if (i < 0) return ''
  const j = sql.indexOf('\nas $fn$', i)
  const m = /\n(?:end )?\$fn\$;/.exec(sql.slice(j))
  return sql.slice(i, j + m.index + m[0].length)
}

// Las seis que llevaban la comprobación de propiedad escrita a mano por
// dentro. Un `security definer` se salta el RLS, así que esa línea no era una
// copia de la política: era la única autorización que había ahí.
const SEIS = [
  'grant_daily_bonus',
  'grant_manual_bonus',
  'crear_campana_limpieza',
  'cerrar_campana_limpieza',
  'spend_power',
  'claim_streak'
]

// Las que la 045 dejó y otra migración posterior volvió a escribir. Se
// comparan con el esquema para lo que este fichero defiende —que preguntan por
// pertenencia— pero NO byte a byte contra la 045: una migración registra lo que
// hizo ese día, y quien manda es la última que la tocó. Editar una migración ya
// aplicada es justo lo que no se hace.
const REESCRITAS_DESPUES = [
  'grant_manual_bonus',        // 054 · pregunta por capacidad, no por etiqueta
  'crear_campana_limpieza',    // 054
  'cerrar_campana_limpieza'    // 054
]

describe('el aislamiento ya no pregunta de quién es la cuenta', () => {
  it('ninguna política habla de propiedad, salvo la que decide quién TOCA el gremio', () => {
    // `familia_owner` es la excepción legítima y la única: dice quién puede
    // renombrar, reconfigurar o borrar el gremio, no quién puede leerlo.
    // Pertenecer da acceso a los datos; no da la potestad sobre la casa.
    const sospechosas = politicas(schema)
      .filter((p) => p.nombre !== 'familia_owner')
      .filter((p) => p.cuerpo.includes('owner = auth.uid()'))
      .map((p) => `${p.tabla}.${p.nombre}`)
    expect(sospechosas).toEqual([])
  })

  it('las catorce tablas con `family_id` preguntan a `mis_gremios()`', () => {
    // El bucle de las trece más el libro de las monedas. Si aparece una tabla
    // nueva con `family_id` y su política escrita a mano con el predicado
    // viejo, este test no la ve: la caza la de arriba.
    const conPredicado = politicas(schema).filter((p) =>
      p.cuerpo.includes('select public.mis_gremios()')
    )
    expect(conPredicado.length).toBeGreaterThanOrEqual(9)
  })

  it('las seis funciones `security definer` también', () => {
    for (const nombre of SEIS) {
      const cuerpo = soloSql(funcion(schema, nombre))
      expect(cuerpo, `${nombre} no existe en schema.sql`).not.toBe('')
      expect(cuerpo, `${nombre} sigue comprobando la propiedad`).not.toContain(
        'f.owner = auth.uid()'
      )
      expect(cuerpo, `${nombre} no pregunta por pertenencia`).toContain(
        'public.es_mi_gremio(v_family)'
      )
    }
  })
})

describe('`mis_gremios()`, el predicado en un solo sitio', () => {
  const fn = soloSql(funcion(schema, 'mis_gremios'))

  it('responde con las tres ramas', () => {
    // 1 · propiedad (temporal, se retira en el paso «contraer»)
    expect(fn).toContain('from public.families f where f.owner = auth.uid()')
    // 2 · credencial compartida
    expect(fn).toMatch(/from public\.credenciales c[\s\S]*clase = 'compartida'/)
    // 3 · pertenencia activa, la que todavía no tiene ni una fila
    expect(fn).toMatch(/from public\.pertenencias p[\s\S]*estado = 'activa'/)
  })

  it('es `security definer`, que es lo que evita que la política se llame a sí misma', () => {
    // `pertenencia_visible` pregunta a `mis_gremios()`, y `mis_gremios()` lee
    // `pertenencias`. Sin `security definer` eso es recursión.
    expect(fn).toContain('security definer')
    expect(fn).toContain('set search_path = public')
    expect(fn).toContain('stable')
  })
})

describe('un correo es una cosa o la otra, nunca las dos', () => {
  it('una fila por cuenta, y la cuenta es la clave', () => {
    expect(schema).toContain(
      'user_id uuid primary key references auth.users(id) on delete cascade'
    )
    expect(schema).toMatch(/clase text not null check \(clase in \('compartida','personal'\)\)/)
  })

  it('el alcance va en un `case` y no en un `and`/`or`', () => {
    // Un CHECK que da NULL PASA: solo rechaza cuando da FALSE. La forma obvia
    // —`(clase='compartida' and family_id is not null) or ...`— acepta la fila
    // que quiere rechazar en cuanto hay un nulo por medio. Ya mordió en
    // `profiles_especie_coherente` el día que se ejecutó la 027.
    const i = schema.indexOf('constraint credenciales_alcance check (')
    expect(i).toBeGreaterThan(-1)
    const cuerpo = schema.slice(i, schema.indexOf(');', i))
    expect(cuerpo).toContain('case')
    expect(cuerpo).toContain("when clase = 'compartida' then family_id is not null")
    expect(cuerpo).toContain('else family_id is null')
  })

  it('la clase la resuelve el servidor, y sin sesión no hay clase', () => {
    const fn = soloSql(funcion(schema, 'clase_credencial'))
    expect(fn).toContain('security definer')
    expect(fn).toContain("'sin_clasificar'")
    // No acepta ningún parámetro: el alcance de una sesión no lo puede
    // declarar quien llama.
    expect(schema).toContain('create or replace function public.clase_credencial()')
  })
})

describe('la puerta de las operaciones de persona', () => {
  const fn = soloSql(funcion(schema, 'exige_persona'))

  it('existe antes que la primera operación que la necesita', () => {
    // Se escribe ahora, con su prueba, porque una garantía que llega después
    // se le olvida a alguien y no se entera nadie. Hoy no la llama nadie.
    expect(fn).not.toBe('')
  })

  it('solo deja pasar a una identidad personal', () => {
    expect(fn).toContain("public.clase_credencial() <> 'personal'")
    expect(fn).toContain("raise exception 'exige_identidad_personal'")
    expect(fn).toContain("raise exception 'sin_sesion'")
  })

  it('no recibe nada de quien llama', () => {
    expect(schema).toContain('create or replace function public.exige_persona()')
  })
})

describe('la pertenencia', () => {
  it('una activa por persona y gremio, con un índice y no con un `select` previo', () => {
    // Entre el `select` y el `insert` cabe otra petición. Parcial, porque
    // abandonar y volver a entrar tiene que poder dejar dos filas.
    expect(schema).toMatch(
      /create unique index if not exists idx_pertenencia_activa\s+on public\.pertenencias \(persona, family_id\) where estado = 'activa'/
    )
  })

  it('salir es un estado, no una fila menos', () => {
    expect(schema).toMatch(
      /estado text not null default 'activa' check \(estado in \('activa','abandonada','expulsada'\)\)/
    )
  })

  it('guarda cómo se entró, y solo por los cuatro caminos que existen', () => {
    expect(schema).toMatch(
      /origen text not null check \(origen in \('fundacion','llave','invitacion','reclamacion'\)\)/
    )
  })

  it('una baja sin fecha de baja no se puede escribir', () => {
    const i = schema.indexOf('constraint pertenencias_baja_fechada check (')
    expect(i).toBeGreaterThan(-1)
    const cuerpo = schema.slice(i, schema.indexOf(');', i))
    expect(cuerpo).toContain('case when')
    expect(cuerpo).toContain('hasta is null')
    expect(cuerpo).toContain('hasta is not null')
  })
})

describe('el vínculo personaje ↔ persona', () => {
  it('es opcional, y lo normal es que sea nulo', () => {
    expect(schema).toContain('persona uuid references auth.users(id) on delete set null')
  })

  it('un personaje, una persona; una persona, un personaje por gremio', () => {
    // Lo primero lo garantiza la columna, que es una sola. Lo segundo, el
    // índice: vincular a la persona equivocada es el fallo más difícil de
    // deshacer del modelo, y una comprobación previa no lo impide.
    expect(schema).toMatch(
      /create unique index if not exists idx_profiles_persona_unica\s+on public\.profiles \(family_id, persona\) where persona is not null/
    )
  })

  it('la clave de la casa no puede quedar detrás de un personaje', () => {
    // Si se pudiera vincular una credencial compartida, la clave del gremio se
    // convertiría en la identidad de quien la usara primero.
    const fn = soloSql(funcion(schema, 'tg_persona_es_personal'))
    expect(fn).toContain("c.clase = 'personal'")
    expect(fn).toContain('raise exception')
    expect(schema).toMatch(
      /create trigger profiles_persona_personal\s+before insert or update of persona on public\.profiles/
    )
  })
})

describe('lo que la 044 NO hace', () => {
  const sql = soloSql(m044)

  it('no convierte a nadie: no crea ninguna identidad personal', () => {
    expect(sql).not.toMatch(/'personal'\s*,/)
    expect(sql).not.toContain('insert into public.pertenencias')
  })

  it('clasifica lo que ya existe, y sin pisar lo que encuentre', () => {
    // `do nothing` y no `do update`: si una cuenta ya estuviera clasificada
    // como personal, reescribirla a compartida sería el accidente que la clave
    // primaria intenta impedir.
    expect(sql).toContain('on conflict (user_id) do nothing')
    expect(sql).toMatch(/insert into public\.credenciales[\s\S]*from public\.families f/)
  })
})

describe('las dos copias del esquema', () => {
  it('las seis funciones son idénticas en la migración y en el esquema', () => {
    // La regla de la casa: cada cambio de esquema se escribe dos veces. Si se
    // toca una copia y no la otra, la base reconstruida desde cero deja de ser
    // la que está en producción, que es exactamente lo que la Fase 0 encontró.
    for (const nombre of SEIS.filter((n) => !REESCRITAS_DESPUES.includes(n))) {
      expect(funcion(m045, nombre), `${nombre} difiere entre 045 y schema.sql`)
        .toBe(funcion(schema, nombre))
    }
  })

  it('lo que crea la 044 está también en el esquema', () => {
    for (const trozo of [
      'create table if not exists public.credenciales (',
      'create table if not exists public.pertenencias (',
      'create or replace function public.mis_gremios()',
      'create or replace function public.es_mi_gremio(p_family uuid)',
      'create or replace function public.clase_credencial()',
      'create or replace function public.exige_persona()',
      'create trigger families_credencial'
    ]) {
      expect(m044, `falta en la 044: ${trozo}`).toContain(trozo)
      expect(schema, `falta en schema.sql: ${trozo}`).toContain(trozo)
    }
  })

  it('las dos migraciones se pueden volver a ejecutar sin romper nada', () => {
    // Ejecutar dos veces la misma migración pasa: se ejecuta a mano en el
    // editor SQL, y la segunda vez tiene que ser inofensiva.
    for (const [nombre, sql] of [['044', m044], ['045', m045]]) {
      const texto = soloSql(sql)
      const creaPoliticas = (texto.match(/create policy/g) || []).length
      const borraAntes = (texto.match(/drop policy if exists/g) || []).length
      expect(borraAntes, `la ${nombre} crea políticas sin borrarlas antes`)
        .toBeGreaterThanOrEqual(creaPoliticas)
      expect(texto.match(/create table (?!if not exists)/), `la ${nombre} crea una tabla sin `
        + '`if not exists`').toBe(null)
      expect(texto.match(/create index (?!if not exists)/), `la ${nombre} crea un índice sin `
        + '`if not exists`').toBe(null)
    }
  })
})
