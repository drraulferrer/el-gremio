import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

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
// 2 · `revoke ... from public` NO quita la concesión explícita que Supabase da
//     a `anon` por privilegios por defecto. Tres funciones `security definer`
//     de la economía se podían llamar sin haber entrado.
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
  // el RLS: quién puede llamarla es toda la puerta que tiene.
  const definers = [...schema.matchAll(/create or replace function public\.(\w+)\s*\([\s\S]{0,400}?security definer/g)]
    .map((m) => m[1])

  // Deuda declarada, no permiso concedido. Son anteriores a esta regla y se
  // resuelven en la revisión de grants que dejó pendiente la Fase 0, junto con
  // el `truncate` para `authenticated`. Cuatro de las siete están hoy
  // EXPUESTAS en producción (`zona_de_perfil` y las tres `tg_*`); las otras
  // tres solo lo estarían en una base reconstruida desde el fichero, que es
  // igual de real pero no se ve mirando el panel.
  //
  // La lista solo puede MENGUAR. Si crece, este test falla, que es justo lo
  // que se quiere: la regla existe para las funciones que vengan.
  const PENDIENTES = [
    'zona_de_perfil',
    'purge_logs',
    'tg_challenge_familia',
    'tg_completion_snapshot',
    'delete_my_account',
    'streak_days',
    'tg_movimiento_coins'
  ]

  const revocadaA = (n, rol) =>
    new RegExp(`revoke all on function public\\.${n}\\([^)]*\\) from ${rol};`).test(schema)

  it('ninguna función `security definer` nueva se queda sin revocarle a `anon`', () => {
    // `revoke ... from public` NO basta: quita la concesión implícita de
    // PUBLIC, no la explícita que Supabase da a `anon` por privilegios por
    // defecto. Son dos cosas distintas y hacen falta las dos.
    const sinRevoke = definers
      .filter((n) => !PENDIENTES.includes(n))
      .filter((n) => !revocadaA(n, 'anon'))
    expect(sinRevoke).toEqual([])
  })

  it('la lista de deuda no ha crecido', () => {
    // Si alguien resuelve una, que la quite de aquí: el test lo celebra.
    expect(PENDIENTES).toHaveLength(7)
    for (const n of PENDIENTES) {
      expect(definers, `${n} ya no existe: quítalo de PENDIENTES`).toContain(n)
      expect(revocadaA(n, 'anon'), `${n} ya está revocada: quítala de PENDIENTES`).toBe(false)
    }
  })
})
