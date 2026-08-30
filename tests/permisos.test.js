import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

// ------------------------------------------------------------------
// Los permisos de las funciones del esquema.
//
// Este fichero nace de dos fallos reales encontrados el 30-ago-2026 al
// comparar `schema.sql` con producción antes de aplicar la 045, y los dos eran
// invisibles leyendo el fichero:
//
// 1 · `grant_manual_bonus` se revocaba con la firma de CUATRO argumentos y
//     tiene CINCO desde la 042. Una firma que no existe no da un aviso: da
//     «function does not exist» y **corta la reconstrucción de la base ahí
//     mismo**. Como nadie reconstruye la base a diario, llevaba semanas así.
//
// 2 · Los permisos de ejecución necesitan **las dos** revocaciones, y cada una
//     por su motivo. `revoke ... from public` no quita la concesión explícita
//     que Supabase da a `anon` por privilegios por defecto; y `revoke ... from
//     anon` no quita la de PUBLIC, de la que `anon` hereda. Quitar solo una
//     deja la puerta abierta y da la impresión contraria.
//
//     Las dos caras habían mordido: tres funciones de la economía se podían
//     llamar sin haber entrado por lo primero, y el barrido general que la 021
//     dejó al final de `schema.sql` llevaba desde agosto sin cerrar nada por lo
//     segundo. Lo arregla la 046.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const schema = readFileSync(new URL('schema.sql', raiz), 'utf8')

/** Los argumentos declarados de cada función, por su nombre. */
function firmasDeclaradas(sql) {
  const mapa = new Map()
  const re = /create or replace function public\.(\w+)\s*\(/g
  let m
  while ((m = re.exec(sql))) {
    let i = re.lastIndex
    let nivel = 1
    while (nivel > 0 && i < sql.length) {
      if (sql[i] === '(') nivel++
      else if (sql[i] === ')') nivel--
      i++
    }
    const dentro = sql.slice(re.lastIndex, i - 1)
    const tipos = dentro
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      // `p_dias integer default null` → integer
      .map((p) => p.split(/\s+/)[1])
    mapa.set(m[1], tipos)
  }
  return mapa
}

/** Cada línea `revoke|grant ... on function public.X(args)`. */
function permisosEscritos(sql) {
  const salida = []
  const re = /^(revoke|grant)\b[^\n]*? on function public\.(\w+)\(([^)]*)\)[^\n]*$/gm
  let m
  while ((m = re.exec(sql))) {
    salida.push({
      verbo: m[1],
      nombre: m[2],
      tipos: m[3].split(',').map((t) => t.trim()).filter(Boolean),
      linea: m[0]
    })
  }
  return salida
}

const declaradas = firmasDeclaradas(schema)
const escritos = permisosEscritos(schema)

describe('las firmas de los `grant` y los `revoke`', () => {
  it('hay líneas de permisos que comprobar', () => {
    expect(escritos.length).toBeGreaterThan(10)
  })

  it('cada una nombra una función que existe en el fichero', () => {
    const fantasmas = escritos
      .filter((p) => !declaradas.has(p.nombre))
      .map((p) => p.nombre)
    expect([...new Set(fantasmas)]).toEqual([])
  })

  it('y con la firma exacta, o la reconstrucción de la base se para ahí', () => {
    // Postgres identifica una función por su lista COMPLETA de tipos, con los
    // que tienen valor por defecto incluidos. `f(uuid, integer, text, uuid)`
    // no es «f con cuatro de los cinco»: es otra función, y no existe.
    const desajustadas = escritos
      .filter((p) => declaradas.has(p.nombre))
      .filter((p) => p.tipos.join(',') !== declaradas.get(p.nombre).join(','))
      .map((p) => `${p.nombre}: escrito (${p.tipos}) · declarado (${declaradas.get(p.nombre)})`)
    expect(desajustadas).toEqual([])
  })
})

describe('quién puede ejecutar una función `security definer`', () => {
  // Una `security definer` corre con los permisos de quien la creó y se salta
  // el RLS: quién puede llamarla es toda la puerta que tiene. La 021 escribió
  // la regla y dejó un barrido al final de `schema.sql` para cumplirla sin
  // acordarse. La 046 lo arregló, porque cerraba media puerta.
  // Fábrica y no constante: un regex con /g guarda `lastIndex` entre llamadas
  // a `.test()`, así que el mismo objeto dentro de un `filter` va dando
  // resultados alternos. Es un fallo que pasa los tests el día que se escribe.
  const barrido = () => /do \$\$[\s\S]*?prosecdef[\s\S]*?end \$\$;/g

  const barridos = schema.match(barrido()) || []
  const ultimo = barridos[barridos.length - 1]

  it('`schema.sql` termina con el barrido, y no crea funciones después', () => {
    // Si alguien añade una función por debajo del barrido, esa función nace
    // con los privilegios por defecto y nadie la retira. Por eso el barrido
    // es lo último del fichero y no un apartado más.
    expect(ultimo, 'no encuentro el barrido en schema.sql').toBeTruthy()
    const cola = schema.slice(schema.lastIndexOf(ultimo) + ultimo.length)
    expect(cola.trim(), 'hay algo después del barrido').toBe('')
  })

  it('el barrido quita PUBLIC además de `anon`, que era el fallo', () => {
    // `anon` HEREDA de PUBLIC. Mientras PUBLIC conserve el permiso --y es el
    // que Postgres da por defecto a toda función nueva-- quitárselo a `anon`
    // no cierra nada: `has_function_privilege` sigue diciendo `true`, que es
    // lo único que mira PostgREST. El barrido de la 021 llevaba así desde
    // agosto, pareciendo que funcionaba.
    expect(ultimo).toContain("revoke all on function %s from public")
    expect(ultimo).toContain("revoke all on function %s from anon")
  })

  it('toda migración desde la 044 que toque una `security definer` acaba barriendo', () => {
    // Cada `create or replace` estrena los privilegios por defecto de
    // Supabase, que conceden a `anon`. Entre la 022 y la 043 no se volvió a
    // barrer ni una vez, y así fue creciendo la lista de funciones que
    // contestaban sin sesión. La regla empieza en la 044: las anteriores son
    // historia y las arregla la 046 de una vez.
    const migraciones = readdirSync(new URL('.', raiz))
      .filter((f) => /^migracion-(\d{3})-.*\.sql$/.test(f))
      .filter((f) => Number(f.slice(10, 13)) >= 44)

    expect(migraciones.length).toBeGreaterThan(0)

    const sinBarrer = migraciones.filter((f) => {
      const sql = readFileSync(new URL(f, raiz), 'utf8')
      const tocaDefiner = /create or replace function[\s\S]{0,400}?security definer/.test(sql)
      return tocaDefiner && !barrido().test(sql)
    })
    expect(sinBarrer).toEqual([])
  })
})
