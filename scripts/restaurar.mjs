#!/usr/bin/env node
// ------------------------------------------------------------------
// Restaurar una copia cifrada en un proyecto de Supabase.
//
//   npm run restaurar -- --ultimo --a <ref>            # la copia más reciente
//   npm run restaurar -- --fichero <ruta.enc> --a <ref>
//   npm run restaurar -- --ultimo --a <ref> --ensayo   # enseña el plan y no toca nada
//
// ANTES DE ESTO, el proyecto de destino necesita el esquema:
//
//   supabase db query -f schema.sql --linked --project-ref <ref>
//
// (o pegar las migraciones en su editor SQL, que es como se hace aquí).
// Esto restaura DATOS, no estructura.
//
// POR QUÉ EXISTE. Un respaldo que nunca se ha restaurado no es una
// protección, es un fichero que da tranquilidad. Esto es la otra mitad:
// sin ella, la copia cifrada no vale para lo único que tiene que valer.
//
// QUÉ HACE, EN ESTE ORDEN:
//   1. Descifra y abre la copia en un directorio temporal.
//   2. Pregunta al catálogo del DESTINO en qué orden se pueden tocar las
//      tablas sin romper una clave ajena — no hay lista escrita a mano,
//      que es lo que se queda desfasado en cuanto alguien añade una tabla.
//   3. Vacía las tablas en orden inverso e inserta en orden directo.
//   4. Recoloca las secuencias, o el primer `insert` de después chocaría
//      con una clave que ya existe.
//
// SEGURIDAD. Si el destino es el mismo proyecto que está enlazado —es
// decir, producción— hace falta `--si-de-verdad`. Restaurar encima de una
// base viva borra lo que haya después de la copia, y eso no puede pasar
// por un despiste al copiar un ref.
// ------------------------------------------------------------------

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { binario, contrasena, copias, ITERACIONES, proyecto } from './respaldo.mjs'

// El endpoint de `db query` devuelve 413 por encima de ~1 MB: hay que trocear.
// Se deja margen porque el JSON crece al escaparlo dentro del SQL.
export const LIMITE = 700_000

function morir(mensaje) {
  console.error(`✗ ${mensaje}`)
  process.exit(1)
}

// --- abrir la copia -------------------------------------------------------

export function abrir(fichero, destino, clave) {
  const descifrado = join(destino, 'datos.tar.gz')
  const r = spawnSync(binario('openssl'),
    ['enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', String(ITERACIONES),
      '-pass', 'env:RESPALDO_PASS', '-in', fichero, '-out', descifrado],
    { encoding: 'utf8', env: { ...process.env, RESPALDO_PASS: clave } })
  if (r.status !== 0) morir('No se puede descifrar la copia. ¿Es la contraseña del Llavero de este proyecto?')
  execFileSync(binario('tar'), ['-xzf', descifrado, '-C', destino])
  return join(destino, 'datos')
}

// --- orden de las tablas --------------------------------------------------

const SQL_ORDEN = `
with recursive dep as (
  select c.oid as tabla, 0 as nivel
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and not exists (select 1 from pg_constraint k
                      where k.conrelid = c.oid and k.contype = 'f' and k.confrelid <> c.oid)
  union all
  select k.conrelid, d.nivel + 1
    from dep d
    join pg_constraint k on k.confrelid = d.tabla and k.contype = 'f' and k.conrelid <> d.tabla
   where d.nivel < 20
)
select c.relname as tabla, max(d.nivel) as nivel
  from dep d join pg_class c on c.oid = d.tabla
 group by c.relname order by 2, 1;`

/**
 * Las tablas del destino, de las que no dependen de nadie a las que dependen
 * de todas. El tope de 20 niveles es un cortacircuitos: con una dependencia
 * circular, la recursiva no pararía nunca.
 */
export function orden(ref) {
  const filas = consultaEn(ref, SQL_ORDEN)
  return filas.map((f) => f.tabla)
}

function consultaEn(ref, sql) {
  let ultimo = ''
  for (let intento = 1; intento <= 4; intento++) {
    const r = spawnSync(binario('supabase'), ['db', 'query', sql, '--linked', '--project-ref', ref, '-o', 'json'],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    if (r.status === 0) {
      try {
        const salida = JSON.parse(r.stdout)
        return Array.isArray(salida) ? salida : salida.rows
      } catch { /* reintenta */ }
    }
    ultimo = ((r.stderr || r.stdout) || '').trim()
  }
  morir(`La consulta falló tras 4 intentos: ${ultimo.slice(-300)}`)
}

function ejecutar(ref, sql, etiqueta) {
  const tmp = mkdtempSync(join(tmpdir(), 'sql-'))
  const fichero = join(tmp, 'trozo.sql')
  try {
    writeFileSync(fichero, sql, 'utf8')
    const r = spawnSync(binario('supabase'), ['db', 'query', '-f', fichero, '--linked', '--project-ref', ref],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    if (r.status !== 0) morir(`Falló ${etiqueta}: ${((r.stderr || r.stdout) || '').trim().slice(-400)}`)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

// --- generación del SQL ---------------------------------------------------

export const literal = (texto) => `'${texto.replaceAll("'", "''")}'`

export function inserta(esquema, tabla, filas) {
  const crudo = JSON.stringify(filas)
  return `insert into ${esquema}.${tabla} select * from ` +
         `jsonb_populate_recordset(null::${esquema}.${tabla}, ${literal(crudo)}::jsonb);`
}

/**
 * Trocea las filas de una tabla en sentencias por debajo del tope. Una fila
 * suelta que ya pase del tope se manda igual y que falle con su mensaje: es
 * mejor que descartarla en silencio.
 */
export function trozosDe(esquema, tabla, filas) {
  const partes = []
  let lote = []
  for (const fila of filas) {
    const tentativa = [...lote, fila]
    if (lote.length && JSON.stringify(tentativa).length > LIMITE) {
      partes.push(inserta(esquema, tabla, lote))
      lote = [fila]
    } else {
      lote = tentativa
    }
  }
  if (lote.length) partes.push(inserta(esquema, tabla, lote))
  return partes
}

const SQL_SECUENCIAS = `do $$
declare s record;
begin
  for s in
    select seq.relname as secuencia, tab.relname as tabla, att.attname as columna
      from pg_class seq
      join pg_depend d on d.objid = seq.oid and d.classid = 'pg_class'::regclass and d.deptype = 'a'
      join pg_class tab on tab.oid = d.refobjid
      join pg_attribute att on att.attrelid = tab.oid and att.attnum = d.refobjsubid
      join pg_namespace n on n.oid = seq.relnamespace
     where seq.relkind = 'S' and n.nspname = 'public'
  loop
    execute format('select setval(%L, coalesce((select max(%I) from public.%I), 0) + 1, false)',
                   'public.' || s.secuencia, s.columna, s.tabla);
  end loop;
end $$;`

/** El plan entero: qué se borra, qué se inserta y en qué orden. */
export function plan(datos, ordenTablas) {
  const presentes = {}
  for (const f of readdirSync(datos)) {
    if (f.endsWith('.json')) presentes[f.slice(0, -5)] = JSON.parse(readFileSync(join(datos, f), 'utf8'))
  }

  const enOrden = ordenTablas.filter((t) => t in presentes)
  // Lo que está en la copia pero no en el catálogo del destino va al final:
  // mejor intentar restaurarlo y que falle con su mensaje, que perderlo en
  // silencio por no estar en una lista.
  const sueltas = Object.keys(presentes)
    .filter((t) => !enOrden.includes(t) && !t.includes('.'))
    .sort()

  const tablas = [...enOrden, ...sueltas]
  const fuera = Object.keys(presentes).filter((t) => t.includes('.'))

  const partes = []
  partes.push([...tablas].reverse().map((t) => `delete from public.${t} where true;`).join('\n'))
  for (const tabla of tablas) {
    if (presentes[tabla].length) partes.push(...trozosDe('public', tabla, presentes[tabla]))
  }
  partes.push(SQL_SECUENCIAS)

  return { partes, tablas, sueltas, fuera, presentes }
}

// --- principal ------------------------------------------------------------

function argumento(argv, nombre) {
  const i = argv.indexOf(nombre)
  return i === -1 ? null : argv[i + 1]
}

function main(argv) {
  const destino = argumento(argv, '--a')
  if (!destino) morir('Falta `--a <project-ref>`: en qué proyecto se restaura.')

  const fichero = argv.includes('--ultimo')
    ? (copias().at(-1)?.ruta ?? morir('No hay ninguna copia que restaurar.'))
    : argumento(argv, '--fichero')
  if (!fichero) morir('Elige qué copia: `--ultimo` o `--fichero <ruta.enc>`.')
  if (!existsSync(fichero)) morir(`No existe ${fichero}`)

  if (existsSync('supabase/.temp/linked-project.json') && destino === proyecto() && !argv.includes('--si-de-verdad')) {
    morir(`${destino} es el proyecto enlazado, o sea PRODUCCIÓN.\n` +
          '  Restaurar encima borra todo lo que haya pasado desde la copia.\n' +
          '  Si de verdad es lo que quieres, añade `--si-de-verdad`.')
  }

  const clave = contrasena()
  const tmp = mkdtempSync(join(tmpdir(), 'restaurar-'))
  try {
    console.log(`· Abriendo ${fichero}`)
    const datos = abrir(fichero, tmp, clave)
    console.log(`· Preguntando al catálogo de ${destino} en qué orden van las tablas`)
    const { partes, tablas, sueltas, fuera, presentes } = plan(datos, orden(destino))

    console.log(`\n  ${tablas.length} tablas · ${Object.values(presentes).reduce((a, f) => a + f.length, 0)} filas · ${partes.length} sentencias`)
    for (const t of tablas) console.log(`    ${t.padEnd(24)} ${String(presentes[t].length).padStart(6)}`)
    if (sueltas.length) console.log(`  ⚠ no están en el catálogo del destino, se intentan igual: ${sueltas.join(', ')}`)
    if (fuera.length) {
      console.log(`\n  ⚠ ${fuera.join(', ')} está en la copia pero NO se restaura desde aquí.`)
      console.log('    `auth.users` la gestiona Supabase: insertarla a mano deja las cuentas a')
      console.log('    medias (sin `identities` no se puede iniciar sesión). Para un proyecto')
      console.log('    nuevo, crea las cuentas con la API de admin y luego restaura los datos;')
      console.log('    el volcado está ahí para saber QUIÉN había, no para recrearlo de golpe.')
    }

    if (argv.includes('--ensayo')) {
      console.log('\n(ensayo: no se ha tocado nada)')
      return 0
    }

    console.log(`\n· Restaurando en ${destino}…`)
    partes.forEach((sql, i) => {
      ejecutar(destino, sql, `la sentencia ${i + 1}/${partes.length}`)
      process.stdout.write(`\r    ${i + 1}/${partes.length}`)
    })
    console.log('\n\n✓ Restaurado. Comprueba que puedes entrar con una cuenta antes de darlo por bueno.')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)))
}
