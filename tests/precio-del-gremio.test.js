import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

// ------------------------------------------------------------------
// El precio es el del gremio donde se gasta (migración 052, `R-53`).
//
// Esta pieza es rara entre las de la fase: casi todo lo que pide **ya pasaba**.
// Y precisamente por eso hace falta escribirlo, porque lo que se cumple sin
// que nadie lo defienda es lo que se rompe sin que nadie lo note. Cada premio
// es de un gremio, el servidor cobra el precio guardado de ese premio, y la
// temporada ya está dentro de ese número: la subida del 30 % la escribe un
// adulto sobre `rewards.cost` al abrir temporada, no se calcula al cobrar.
//
// Lo que sí faltaba era consecuencia de la 051: la tienda lee `profiles.coins`
// y para un personaje convertido eso vale cero.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const app = leer('src/App.jsx')
const home = leer('src/screens/Home.jsx')

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

const canjear = soloSql(funcion(schema, 'redeem_reward', '$$'))
const visibles = soloSql(funcion(schema, 'saldos_visibles'))

describe('el precio que se cobra es el del gremio donde se gasta', () => {
  it('el premio y quien lo canjea, de la misma casa', () => {
    expect(canjear).toContain('if rw.family_id is distinct from p.family_id then')
  })

  it('se cobra el precio guardado del premio, y nada más', () => {
    // Ni un multiplicador, ni una tabla de precios aparte, ni la temporada
    // recalculada al cobrar: `rw.cost` ES el precio vigente de esa casa.
    expect(canjear).toContain('update public.profiles set coins = coins - rw.cost')
    expect(canjear).toContain('if v_saldo < rw.cost then')
    expect(canjear).not.toMatch(/temporada|1\.3|SUBIDA/i)
  })

  it('el cliente no tiene por dónde declarar un coste', () => {
    // Si algún día alguien añade un parámetro de coste «para la vista previa»,
    // este test cae. Es la mitad de `SEC-3` que se puede defender leyendo.
    expect(schema).toContain(
      'create or replace function public.redeem_reward(rw_id uuid, p_id uuid, p_clave text default null)'
    )
  })

  it('la subida de temporada se escribe, no se calcula al cobrar', () => {
    // Vive en el panel del adulto, que reescribe `rewards.cost` una vez al
    // abrir temporada. Por eso el precio guardado ya trae su temporada dentro.
    const panel = leer('src/screens/ParentPanel.jsx')
    expect(panel).toContain('precioSiguienteTemporada')
    expect(panel).toMatch(/update\(\{ cost: precioSiguienteTemporada/)
  })
})

describe('ningún número de expansión vive ya en `src/lib`', () => {
  it('la escala está en la base, no en el código', () => {
    // Es el último punto de la definición de hecho de la fase. Los números los
    // trajo la 050 a `escalones_expansion`; aquí solo se comprueba que no han
    // vuelto a aparecer escritos en el cliente.
    // Se buscan los números que SOLO pueden ser de la escala de expansión:
    // los dos costes altos y el nombre del coste base. Nada de `HITOS` a
    // secas — ese nombre lo usan también los hitos de racha, que son otra
    // cosa y viven en `src/lib/rachas.js` con todo el derecho.
    //
    // `fakeCatalogo.js` queda fuera, y es la única excepción: no es cliente,
    // es la copia que el backend simulado hace del SERVIDOR, igual que
    // `fakeBackend.js` copia los disparadores. Que la demo no tenga la escala
    // sería tener una demo que no puede probar la expansión, que es
    // exactamente lo que esta tanda vino a arreglar. Lo que sí hay que
    // defender es que esa copia no se desvíe, y de eso va el test de abajo.
    const libs = readdirSync(new URL('src/lib/', raiz))
      .filter((f) => f.endsWith('.js') && f !== 'fakeCatalogo.js')
    const culpables = libs.filter((f) => {
      const t = leer(`src/lib/${f}`)
      return /\b1875\b|\b4690\b|coste_base|COSTE_BASE/.test(t)
    })
    expect(culpables).toEqual([])
  })

  it('y la copia de la demo dice los mismos números que la migración', () => {
    // Una demo con otra escala es peor que una demo sin escala: enseñaría un
    // botón de forjar por un precio que la base no va a cobrar. Se comparan
    // los cuatro escalones, uno a uno, contra el `insert` de la 050.
    const catalogo = leer('src/lib/fakeCatalogo.js')
    const m050 = leer('migracion-050-las-reglas-dejan-de-ser-constantes.sql')
    for (const [orden, nivel, coste] of [[1, 6, 300], [2, 8, 750], [3, 10, 1875], [4, 12, 4690]]) {
      expect(soloSql(m050)).toContain(`(v_version, ${orden},`)
      expect(catalogo, `el escalón ${orden} no dice lo mismo que la 050`)
        .toContain(`orden: ${orden}, nivel_exigido: ${nivel}, coste: ${coste}`)
    }
    // Y el límite global, que es el otro número que decide si se puede.
    expect(soloSql(m050)).toContain('5,      -- R-60')
    expect(catalogo).toContain('limite_global: 5')
  })
})

describe('el saldo que ve la tienda', () => {
  it('devuelve lo que de verdad se puede gastar, mire donde mire', () => {
    expect(visibles).toContain('when p.persona is null then p.coins')
    expect(visibles).toContain('from public.carteras c where c.persona = p.persona')
  })

  it('y solo de los personajes de mis gremios', () => {
    expect(visibles).toContain('where p.family_id in (select public.mis_gremios())')
    expect(schema).toContain('grant execute on function public.saldos_visibles() to authenticated;')
  })

  it('la app lo usa, y si falla se queda con lo de siempre', () => {
    // Va en el bloque degradable: sin la migración la respuesta viene vacía y
    // el saldo sigue siendo el de `profiles`, que es exactamente el de hoy.
    expect(app).toContain("supabase.rpc('saldos_visibles')")
    expect(app).toContain('(sv?.data || [])')
    // Y no toca la columna de la base: solo lo que se pinta.
    expect(app).toContain('{ ...p, coins: saldos.get(p.id) }')
  })

  it('la tienda dice cuánto falta, no solo que falta', () => {
    // «No tienes suficientes» obliga a restar de cabeza para saber si es
    // cuestión de una misión o de una semana.
    expect(home).toContain('te faltan <Talis n={r.cost - profile.coins} />')
  })
})
