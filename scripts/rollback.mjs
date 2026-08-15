#!/usr/bin/env node
// ------------------------------------------------------------------
// Vuelta a una versión anterior, en menos de dos minutos.
//
//   npm run rollback -- deploy-2026-08-15-0930
//   npm run rollback -- a1b2c3d
//   npm run rollback -- --lista        (ver despliegues disponibles)
//
// No reescribe nada: compila el código de esa referencia y lo publica
// como un commit nuevo en gh-pages. Si el rollback tampoco va bien,
// se puede volver hacia delante igual de rápido.
// ------------------------------------------------------------------

import { existsSync, rmSync, readFileSync, symlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { publicarDist, prepararDist, urlDePages, sh, shOut, intentar, fallar } from './publicar.mjs'

const WORKTREE = '.rollback-worktree'
const argumentos = process.argv.slice(2).filter((a) => a !== '--')

if (!intentar('git rev-parse --git-dir')) fallar('Esto no es un repositorio git.')

if (argumentos.includes('--lista') || argumentos.length === 0) {
  const etiquetas = intentar('git tag --list "deploy-*" --sort=-creatordate') || ''
  const historial = intentar('git log origin/gh-pages --oneline -n 10') || '(sin historial remoto)'
  console.log('\nDespliegues etiquetados (más reciente primero):\n')
  console.log(etiquetas || '  (ninguno todavía)')
  console.log('\nHistorial de la rama publicada:\n')
  console.log(historial)
  console.log('\nUso: npm run rollback -- <etiqueta-o-commit>\n')
  process.exit(argumentos.length === 0 ? 1 : 0)
}

const referencia = argumentos[0]
if (!intentar(`git rev-parse --verify ${referencia}^{commit}`)) {
  fallar(`No existe la referencia "${referencia}". Prueba: npm run rollback -- --lista`)
}

const commit = sh(`git rev-parse --short ${referencia}^{commit}`)
const sello = new Date().toISOString()

console.log(`\n▸ Rollback a ${referencia} (${commit})\n`)

if (existsSync(WORKTREE)) {
  intentar(`git worktree remove ${WORKTREE} --force`)
  rmSync(WORKTREE, { recursive: true, force: true })
}

sh(`git worktree add --detach ${WORKTREE} ${commit}`)

try {
  // Reutilizar node_modules evita un `npm ci` completo en cada rollback.
  // Si el enlace falla (por ejemplo en Windows), se instala de verdad.
  try {
    symlinkSync(resolve('node_modules'), resolve(WORKTREE, 'node_modules'), 'dir')
  } catch {
    console.log('▸ Instalando dependencias en el worktree…')
    shOut('npm ci', { cwd: WORKTREE })
  }

  const version = JSON.parse(readFileSync(`${WORKTREE}/package.json`, 'utf8')).version
  shOut(`APP_COMMIT=${commit} npm run build`, { cwd: WORKTREE })

  prepararDist(`${WORKTREE}/dist`, {
    version,
    commit,
    referencia,
    desplegado: sello,
    origen: 'rollback'
  })

  const publicado = publicarDist({
    distDir: `${WORKTREE}/dist`,
    mensaje: `rollback a ${referencia} (${commit}) el ${sello}`
  })

  if (publicado) {
    console.log(`\n✓ Rollback publicado: ${version} (${commit})`)
    const url = urlDePages()
    if (url) console.log(`▸ ${url}\n`)
  }
} finally {
  intentar(`git worktree remove ${WORKTREE} --force`)
  rmSync(WORKTREE, { recursive: true, force: true })
}
