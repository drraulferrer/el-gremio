#!/usr/bin/env node
// ------------------------------------------------------------------
// Copia de seguridad cifrada de la base.
//
//   npm run respaldo              # vuelca, cifra y COMPRUEBA la copia
//   npm run respaldo -- --estado  # dice qué copias hay y no toca nada
//   npm run respaldo -- --podar 30  # borra las copias más viejas de las 30 últimas
//
// POR QUÉ EXISTE. Hasta hoy no había ninguna copia de esta base ni forma
// escrita de restaurarla: un borrado accidental o una migración mal
// aplicada se llevaba por delante las misiones, las rachas y los
// reconocimientos de la familia, sin vuelta atrás. El plan gratuito de
// Supabase tampoco guarda nada por su cuenta.
//
// QUÉ GUARDA. Todas las tablas de `public` que existan AHORA —se
// preguntan al catálogo, no hay lista escrita a mano, así que una tabla
// nueva entra sola en vez de quedarse fuera en silencio— y además
// `auth.users`, que es donde viven las cuentas: sin ella, una base
// restaurada tendría las familias pero nadie podría entrar.
//
// Un `.tar.gz` cifrado con AES-256, porque el volcado lleva nombres de
// menores, correos de los adultos y los hash de sus contraseñas.
// Dejarlo en claro sería cambiar un riesgo por otro.
//
// LO QUE HAY QUE HACER UNA VEZ, y solo una:
//
//   1. Enlazar el proyecto (pide la contraseña de la base, que está en
//      el panel de Supabase → Settings → Database):
//
//        supabase link --project-ref <ref>
//
//   2. Elegir una contraseña larga para las copias y guardarla en el
//      Llavero. Sin `-w <valor>`: así te la pide sin mostrarla y no
//      queda en el historial de la terminal.
//
//        security add-generic-password -a $USER -s el-gremio-respaldo -w
//
// PARA QUE SE DISPARE SOLO, una línea de cron en este Mac:
//
//   23 4 * * * cd ~/el-gremio && /usr/bin/node scripts/respaldo.mjs \
//     >> ~/el-gremio-respaldos/respaldo.log 2>&1
//
// ABRIR UNA COPIA A MANO:
//
//   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
//     -pass pass:"$(security find-generic-password -s el-gremio-respaldo -w)" \
//     -in respaldo-AAAA-MM-DD-hhmmss.tar.gz.enc | tar -xzf -
//
// RESTAURARLA:  npm run restaurar -- --ultimo --a <ref-de-un-proyecto-vacio>
// ------------------------------------------------------------------

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SERVICIO = 'el-gremio-respaldo'
export const DESTINO = join(homedir(), 'el-gremio-respaldos')
export const ITERACIONES = 200000

// Fuera del repositorio a propósito: lleva datos personales y no puede acabar
// en Git ni, por descuido, dentro de un `vite build`.

// --- herramientas ---------------------------------------------------------

/**
 * Ruta absoluta de un binario. **cron arranca con un PATH pelado**
 * (`/usr/bin:/bin:/usr/sbin:/sbin`) y `supabase` vive en `~/.local/bin`, así
 * que buscarlo por PATH funciona en el terminal y falla en el cron, que es
 * justo donde nadie lo mira.
 */
export function binario(nombre) {
  const candidatos = [
    join(homedir(), '.local/bin', nombre),
    join('/opt/homebrew/bin', nombre),
    join('/usr/local/bin', nombre),
    join('/usr/bin', nombre),
    join('/bin', nombre)
  ]
  for (const c of candidatos) if (existsSync(c)) return c
  try {
    return execFileSync('/usr/bin/which', [nombre], { encoding: 'utf8' }).trim()
  } catch {
    morir(`No se encuentra \`${nombre}\`. Si esto sale del cron, es que su PATH no lo alcanza.`)
  }
}

function morir(mensaje) {
  console.error(`✗ ${mensaje}`)
  process.exit(1)
}

// Hora local, no UTC: el log lo lee una persona, y `sv` da el formato ISO sin
// tener que montar el string a mano.
const sello = () => new Date().toLocaleString('sv')
// 2026-08-23 12:34:56 → 2026-08-23-123456. Con segundos, para que dos respaldos
// seguidos no compartan nombre.
const nombreDeFichero = () => {
  const [dia, hora] = new Date().toLocaleString('sv').split(' ')
  return `${dia}-${hora.replaceAll(':', '')}`
}

// --- proyecto y contraseña ------------------------------------------------

/** El project-ref enlazado. No se escribe a mano: se lee de donde ya está. */
export function proyecto() {
  const enlace = 'supabase/.temp/linked-project.json'
  if (!existsSync(enlace)) {
    morir('No hay proyecto enlazado. Ejecuta primero:\n' +
          '    supabase link --project-ref <ref>\n' +
          '  (te pedirá la contraseña de la base, del panel de Supabase)')
  }
  return JSON.parse(readFileSync(enlace, 'utf8')).ref
}

export function contrasena() {
  const r = spawnSync(binario('security'), ['find-generic-password', '-s', SERVICIO, '-w'],
    { encoding: 'utf8' })
  const clave = (r.stdout || '').trim()
  if (r.status !== 0 || !clave) {
    morir(`Falta la contraseña de respaldo en el Llavero. Créala con:\n` +
          `    security add-generic-password -a $USER -s ${SERVICIO} -w\n` +
          '  (sin valor: te la pide sin mostrarla y no queda en el historial)')
  }
  return clave
}

// --- consultas ------------------------------------------------------------

/**
 * Una consulta por el CLI. Reintenta: el «login role» de Supabase falla a la
 * primera con más frecuencia de la que uno esperaría, y un respaldo que se
 * rinde al primer intento es un respaldo que un día no está.
 */
export function consulta(ref, sql) {
  let ultimo = ''
  for (let intento = 1; intento <= 4; intento++) {
    const r = spawnSync(binario('supabase'),
      ['db', 'query', sql, '--linked', '--project-ref', ref, '-o', 'json'],
      { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
    if (r.status === 0) {
      try {
        // El CLI devuelve dos formas según si cree que le habla un agente: un
        // objeto `{"rows": [...]}` envuelto, o la lista pelada. Desde cron es
        // lo segundo, y dar por hecha la primera revienta donde nadie mira.
        const salida = JSON.parse(r.stdout)
        return Array.isArray(salida) ? salida : salida.rows
      } catch { /* reintenta */ }
    }
    ultimo = ((r.stderr || r.stdout) || '').trim()
  }
  morir(`La consulta falló tras 4 intentos: ${ultimo.slice(-300)}`)
}

/** Las tablas que existan AHORA, más las cuentas. Sin lista escrita a mano. */
export function objetivos(ref) {
  const filas = consulta(ref,
    "select tablename from pg_tables where schemaname = 'public' order by tablename;")
  const lista = filas.map((f) => ['public', f.tablename])
  // `auth.users` no es de este repositorio, pero sin ella una base restaurada
  // tiene las familias y ni una sola cuenta con la que entrar.
  lista.push(['auth', 'users'])
  return lista
}

export function volcar(ref, carpeta) {
  const recuento = {}
  for (const [esquema, tabla] of objetivos(ref)) {
    // `to_jsonb` conserva tipos, fechas y arrays sin escribir un SELECT por
    // columna, y `restaurar.mjs` los reconstruye con `jsonb_populate_recordset`.
    const filas = consulta(ref,
      `select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) as datos from ${esquema}.${tabla} x;`)[0].datos
    const nombre = esquema === 'public' ? tabla : `${esquema}.${tabla}`
    writeFileSync(join(carpeta, `${nombre}.json`), JSON.stringify(filas), 'utf8')
    recuento[nombre] = filas.length
  }
  return recuento
}

// --- cifrado y comprobación ----------------------------------------------

/**
 * tar.gz → AES-256-CBC con PBKDF2. La contraseña viaja por variable de
 * entorno, nunca por argumento: los argumentos de un proceso los ve cualquiera
 * con `ps`.
 */
export function cifrar(carpeta, salida, clave) {
  const taller = mkdtempSync(join(tmpdir(), 'respaldo-'))
  const comprimido = join(taller, 'datos.tar.gz')
  try {
    execFileSync(binario('tar'), ['-czf', comprimido, '-C', dirname(carpeta), 'datos'])
    const r = spawnSync(binario('openssl'),
      ['enc', '-aes-256-cbc', '-pbkdf2', '-iter', String(ITERACIONES), '-salt',
        '-pass', 'env:RESPALDO_PASS', '-in', comprimido, '-out', salida],
      { encoding: 'utf8', env: { ...process.env, RESPALDO_PASS: clave } })
    if (r.status !== 0) morir(`No se pudo cifrar: ${(r.stderr || '').trim().slice(0, 200)}`)
  } finally {
    rmSync(taller, { recursive: true, force: true })
  }
}

/**
 * Abrir lo que se acaba de escribir y contar las filas que hay dentro. Un
 * respaldo que no se ha vuelto a abrir no es un respaldo, es un fichero.
 */
export function comprobar(salida, clave, recuento) {
  const tmp = mkdtempSync(join(tmpdir(), 'verificar-'))
  try {
    const descifrado = join(tmp, 'datos.tar.gz')
    const r = spawnSync(binario('openssl'),
      ['enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', String(ITERACIONES),
        '-pass', 'env:RESPALDO_PASS', '-in', salida, '-out', descifrado],
      { encoding: 'utf8', env: { ...process.env, RESPALDO_PASS: clave } })
    if (r.status !== 0) morir('El fichero cifrado no se puede volver a abrir. NO se da por bueno.')
    execFileSync(binario('tar'), ['-xzf', descifrado, '-C', tmp])

    const dentro = {}
    for (const f of readdirSync(join(tmp, 'datos'))) {
      if (f.endsWith('.json')) dentro[f.slice(0, -5)] = JSON.parse(readFileSync(join(tmp, 'datos', f), 'utf8')).length
    }
    const faltan = Object.entries(recuento).filter(([k, v]) => dentro[k] !== v)
    if (faltan.length) morir(`El respaldo no cuadra con la base: ${JSON.stringify(Object.fromEntries(faltan))}`)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

// --- inventario -----------------------------------------------------------

export function copias() {
  if (!existsSync(DESTINO)) return []
  return readdirSync(DESTINO)
    .filter((f) => f.endsWith('.tar.gz.enc'))
    .sort()
    .map((f) => ({ nombre: f, ruta: join(DESTINO, f), bytes: statSync(join(DESTINO, f)).size }))
}

function estado() {
  const lista = copias()
  if (!lista.length) {
    console.log('· No hay ninguna copia todavía.')
    return
  }
  const total = lista.reduce((a, c) => a + c.bytes, 0)
  console.log(`· ${lista.length} copias en ${DESTINO} (${(total / 1024 / 1024).toFixed(1)} MB)`)
  console.log(`· La más antigua: ${lista[0].nombre}`)
  console.log(`· La más reciente: ${lista[lista.length - 1].nombre}`)
  if (lista.length > 30) {
    console.log(`· Son bastantes. Con \`--podar 30\` se quedan las 30 últimas.`)
  }
}

function podar(cuantas) {
  const lista = copias()
  const sobran = lista.slice(0, Math.max(0, lista.length - cuantas))
  if (!sobran.length) {
    console.log(`· Nada que podar: hay ${lista.length} copias y el tope es ${cuantas}.`)
    return
  }
  for (const c of sobran) {
    unlinkSync(c.ruta)
    console.log(`  borrada ${c.nombre}`)
  }
  console.log(`· Quedan ${lista.length - sobran.length}.`)
}

// --- principal ------------------------------------------------------------

function main(argv) {
  console.log(`\n═══ ${sello()} ═══`)

  if (argv.includes('--estado')) { estado(); return 0 }
  if (argv.includes('--podar')) {
    const n = Number(argv[argv.indexOf('--podar') + 1])
    if (!Number.isInteger(n) || n < 1) morir('`--podar` necesita cuántas copias conservar. Ej.: --podar 30')
    podar(n)
    return 0
  }

  const ref = proyecto()
  const clave = contrasena()
  mkdirSync(DESTINO, { recursive: true })

  // Segundos en el sello y negativa a sobrescribir: con resolución de minuto,
  // dos respaldos seguidos se pisan en silencio, que es la peor forma de
  // perder una copia.
  const salida = join(DESTINO, `respaldo-${nombreDeFichero()}.tar.gz.enc`)
  if (existsSync(salida)) morir(`Ya existe ${salida}. No se sobrescribe un respaldo.`)

  console.log(`\n· Volcando ${ref}…`)
  const tmp = mkdtempSync(join(tmpdir(), 'volcado-'))
  try {
    const carpeta = join(tmp, 'datos')
    mkdirSync(carpeta)
    const recuento = volcar(ref, carpeta)
    for (const [nombre, n] of Object.entries(recuento).sort()) {
      console.log(`    ${nombre.padEnd(24)} ${String(n).padStart(6)}`)
    }
    cifrar(carpeta, salida, clave)
    comprobar(salida, clave, recuento)
    const mb = (statSync(salida).size / 1024 / 1024).toFixed(1)
    console.log(`\n✓ ${salida} (${mb} MB, abierto y comprobado)`)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  return 0
}

// Solo corre si se invoca directamente: así los tests pueden importar las
// piezas sin disparar un respaldo.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)))
}
