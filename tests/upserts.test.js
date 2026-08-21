import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ------------------------------------------------------------------
// Un `onConflict` que no encaja con ningún índice único.
//
// Esta prueba nace de un fallo que estuvo TRES DÍAS vivo en producción
// sin que nadie lo viera: la migración 030 cambió el índice único de
// `profile_badges` de `(profile_id, code)` a `(profile_id, code,
// instance_key)` para que un sello pudiera repetirse por temporada, y dos
// `upsert` se quedaron pidiendo el índice viejo.
//
// Postgres contesta 42P10 —«there is no unique or exclusion constraint
// matching the ON CONFLICT specification»—, la fila entera se cae y el
// código, que capturaba el error y seguía, no concedía NINGÚN sello. Cien
// errores al día en `app_logs`, ni una insignia nueva, y la app
// aparentemente bien. Se descubrió leyendo los registros por otro motivo.
//
// Ni el build, ni los tipos, ni los tests de dominio pueden ver esto:
// la incoherencia es entre una cadena de texto del cliente y un índice
// que vive en el esquema. Aquí es el único sitio donde se cruzan.
// ------------------------------------------------------------------

const RAIZ = new URL('..', import.meta.url).pathname
const esquema = readFileSync(join(RAIZ, 'schema.sql'), 'utf8')

function ficheros(dir) {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n)
    if (statSync(ruta).isDirectory()) return ficheros(ruta)
    return /\.(js|jsx)$/.test(n) ? [ruta] : []
  })
}

/**
 * Pares (tabla, columnas del onConflict) que hay en el cliente.
 *
 * Se busca hacia atrás desde cada `onConflict` hasta el `.from('tabla')`
 * más cercano, que es como se encadenan estas llamadas en supabase-js.
 */
function upsertsDelCliente() {
  const encontrados = []
  for (const ruta of ficheros(join(RAIZ, 'src'))) {
    // El backend simulado LEE la opción, no la declara: no es un upsert.
    if (ruta.endsWith('fakeBackend.js')) continue
    const texto = readFileSync(ruta, 'utf8')
    const re = /onConflict:\s*'([^']+)'/g
    let m
    while ((m = re.exec(texto)) !== null) {
      const antes = texto.slice(0, m.index)
      const froms = [...antes.matchAll(/\.from\('([a-z_]+)'\)/g)]
      const tabla = froms.length ? froms[froms.length - 1][1] : null
      encontrados.push({
        fichero: ruta.replace(RAIZ, ''),
        tabla,
        columnas: m[1].split(',').map((c) => c.trim())
      })
    }
  }
  return encontrados
}

/** Todos los juegos de columnas que el esquema declara ÚNICOS para una tabla. */
function unicosDelEsquema(tabla) {
  const juegos = []

  const cuerpo = esquema.match(
    new RegExp(`create table if not exists public\\.${tabla} \\(([\\s\\S]*?)\\n\\);`)
  )
  if (cuerpo) {
    // `constraint x unique (a, b)` y `unique (a, b)` dentro de la tabla.
    for (const m of cuerpo[1].matchAll(/unique\s*\(([^)]+)\)/g)) {
      juegos.push(m[1].split(',').map((c) => c.trim()))
    }
    // Y la forma corta de una sola columna: `endpoint text not null unique`.
    // Sin el `constraint` de por medio: esa línea ya la ha leído el bucle
    // de arriba, y colarla aquí inventaría una columna llamada
    // «constraint» que podría dar por bueno un onConflict que no lo es.
    for (const m of cuerpo[1].matchAll(/^\s*(?!constraint\b)([a-z_]+)\s+[a-z]+[^,\n]*\bunique\b/gim)) {
      juegos.push([m[1]])
    }
  }

  // Índices únicos sueltos. Los PARCIALES (con `where`) no valen como
  // destino de un onConflict sin su misma cláusula, así que se descartan:
  // que existan no basta, y darlos por buenos sería justo el fallo que
  // esta prueba persigue.
  const re = new RegExp(
    `create unique index[^;]*?on public\\.${tabla}[^;(]*\\(([^)]+)\\)([^;]*);`,
    'gi'
  )
  for (const m of esquema.matchAll(re)) {
    if (/\bwhere\b/i.test(m[2])) continue
    juegos.push(m[1].split(',').map((c) => c.trim().replace(/\s+\w+$/, '')))
  }

  return juegos
}

const mismasColumnas = (a, b) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join()

describe('cada onConflict tiene su índice único en el esquema', () => {
  const upserts = upsertsDelCliente()

  it('hay upserts que revisar (si no, la prueba no está mirando nada)', () => {
    expect(upserts.length).toBeGreaterThan(0)
    expect(upserts.every((u) => u.tabla)).toBe(true)
  })

  it.each(upsertsDelCliente())(
    '$fichero · $tabla ($columnas)',
    ({ tabla, columnas }) => {
      const juegos = unicosDelEsquema(tabla)
      const encaja = juegos.some((j) => mismasColumnas(j, columnas))
      expect(
        encaja,
        `onConflict '${columnas.join(',')}' sobre ${tabla}, y el esquema solo declara únicos: ` +
          (juegos.length ? juegos.map((j) => `(${j.join(', ')})`).join(' · ') : 'ninguno') +
          '. Postgres responderá 42P10 y la fila entera se caerá.'
      ).toBe(true)
    }
  )
})
