#!/usr/bin/env node
// ------------------------------------------------------------------
// Busca código que existe y no llama nadie.
//
// Nació de un fallo concreto: `PremioAMano` era un componente completo,
// con su formulario, sus validaciones y hasta su `useState` en el panel…
// que nadie renderizaba. Funcionalidad terminada e invisible durante una
// sesión entera. No la caza el build, no la cazan los tests y no la caza
// leer el fichero, porque el código está ahí y parece vivo.
//
// Tres clases, y solo la primera es siempre un problema:
//
//   A · muerto        nadie lo nombra: ni su fichero, ni la app, ni los
//                     tests. O se borra, o se cablea.
//   B · solo tests    la app no lo llama nunca. A veces es un modelo
//                     escrito por adelantado a propósito (y entonces
//                     conviene que esté dicho en el fichero); a veces es
//                     otro premio a mano esperando a que alguien lo vea.
//   C · export de más solo lo usa su propio fichero. Ruido, no fallo.
//
// Es un análisis de texto, no un grafo de módulos: puede equivocarse con
// nombres muy cortos o repetidos. Sirve para levantar la liebre, no para
// borrar a ciegas.
// ------------------------------------------------------------------

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))

function ficheros(dir, exts) {
  const salida = []
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) salida.push(...ficheros(ruta, exts))
    else if (exts.some((e) => nombre.endsWith(e))) salida.push(ruta)
  }
  return salida.sort()
}

const FUENTES = ficheros(join(RAIZ, 'src'), ['.js', '.jsx'])
const OTROS = [...ficheros(join(RAIZ, 'tests'), ['.js']), ...ficheros(join(RAIZ, 'scripts'), ['.mjs'])]
const texto = new Map([...FUENTES, ...OTROS].map((p) => [p, readFileSync(p, 'utf8')]))

const RE_EXPORT_FN = /^export\s+(?:async\s+)?function\s+(\w+)/gm
const RE_EXPORT_DECL = /^export\s+(?:const|let|class)\s+(\w+)/gm
const RE_EXPORT_DEFAULT = /^export\s+default\s+(?:async\s+)?function\s+(\w+)/gm
const RE_LOCAL_FN = /^(?:async\s+)?function\s+(\w+)/gm

const todas = (re, s) => [...s.matchAll(re)].map((m) => m[1])
const cuenta = (nombre, s) => (s.match(new RegExp(`\\b${nombre}\\b`, 'g')) || []).length

const muertos = []
const soloTests = []
const soloDentro = []

for (const p of FUENTES) {
  const cuerpo = texto.get(p)
  const exportados = new Set([...todas(RE_EXPORT_FN, cuerpo), ...todas(RE_EXPORT_DECL, cuerpo)])
  const porDefecto = new Set(todas(RE_EXPORT_DEFAULT, cuerpo))

  for (const nombre of [...exportados].sort()) {
    const dentro = cuenta(nombre, cuerpo) - 1 // menos su propia definición
    const enApp = FUENTES.filter((q) => q !== p).reduce((t, q) => t + cuenta(nombre, texto.get(q)), 0)
    const enTests = OTROS.reduce((t, q) => t + cuenta(nombre, texto.get(q)), 0)

    if (dentro === 0 && enApp === 0 && enTests === 0) muertos.push([p, nombre, 'exportado'])
    else if (dentro === 0 && enApp === 0) soloTests.push([p, nombre, enTests])
    else if (enApp === 0 && enTests === 0) soloDentro.push([p, nombre])
  }

  // Funciones locales: el caso PremioAMano.
  for (const nombre of todas(RE_LOCAL_FN, cuerpo)) {
    if (exportados.has(nombre) || porDefecto.has(nombre)) continue
    if (cuenta(nombre, cuerpo) - 1 <= 0) muertos.push([p, nombre, 'local'])
  }
}

const corto = (p) => relative(RAIZ, p)

console.log('\nEl Gremio · código sin usar\n')

console.log(`A · muerto: no lo nombra nadie (${muertos.length})`)
if (!muertos.length) console.log('  🟢 nada')
for (const [p, nombre, clase] of muertos) console.log(`  🔴 ${corto(p)}: ${nombre} (${clase})`)

console.log(`\nB · lo usan los tests pero la app no (${soloTests.length})`)
for (const [p, nombre, n] of soloTests) console.log(`  🟡 ${corto(p)}: ${nombre} · ${n} refs en tests`)

console.log(`\nC · exportado sin salir de su fichero (${soloDentro.length})`)
for (const [p, nombre] of soloDentro) console.log(`  ⚪ ${corto(p)}: ${nombre}`)

console.log()
// Solo la clase A rompe el proceso: las otras dos son para mirar, no para
// bloquear un despliegue a las once de la noche.
process.exit(muertos.length ? 1 : 0)
