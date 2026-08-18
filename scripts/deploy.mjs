#!/usr/bin/env node
// ------------------------------------------------------------------
// Despliegue versionado a GitHub Pages.
//
//   npm run deploy
//
// Sin GitHub Actions a propósito: el token de `gh` de esta máquina no
// tiene el scope `workflow` y no puede subir ficheros de Actions. Esto
// compila en local y publica el resultado en la rama gh-pages.
//
// Cada despliegue deja una etiqueta git, que es la que luego se le pasa
// a `npm run rollback` para volver a esa versión exacta.
// ------------------------------------------------------------------

import { existsSync, rmSync, readFileSync } from 'node:fs'
import { publicarDist, prepararDist, urlDePages, sh, shOut, intentar, fallar } from './publicar.mjs'

const DIST = 'dist'

if (!intentar('git rev-parse --git-dir')) fallar('Esto no es un repositorio git.')
if (!intentar('git remote get-url origin')) {
  fallar('No hay remoto "origin". Crea el repositorio en GitHub y añádelo antes de desplegar.')
}

if (intentar('git status --porcelain')) {
  console.warn('⚠  Hay cambios sin confirmar: se desplegará el árbol de trabajo tal cual está.')
}

const commit = sh('git rev-parse --short HEAD')
const rama = sh('git rev-parse --abbrev-ref HEAD')
const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const sello = new Date().toISOString()

// La versión es un campo a mano de package.json, y lo que depende de
// acordarse no se hace: estuvo en 1.0.0 durante 55 despliegues y 102
// commits, con el hash del commit haciendo todo el trabajo de identificar
// qué corría cada dispositivo. Esto no bloquea el despliegue —a veces se
// republica lo mismo a propósito, por ejemplo tras un rollback— pero lo
// dice en voz alta.
const ultimoDeploy = intentar('git tag --list "deploy-*" --sort=-creatordate')?.split('\n')[0]
if (ultimoDeploy) {
  const antes = intentar(`git show ${ultimoDeploy}:package.json`)
  const versionAntes = antes ? JSON.parse(antes).version : null
  if (versionAntes === version) {
    console.warn(
      `⚠  La versión sigue en ${version}, la misma que en ${ultimoDeploy}.\n` +
      '   Si esto trae algo nuevo, súbela antes y anótala en CHANGELOG.md:\n' +
      '     npm version patch|minor|major --no-git-tag-version\n'
    )
  }
}

console.log(`\n▸ Desplegando El Gremio ${version} (${commit}, rama ${rama})\n`)

if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true })
shOut(`APP_COMMIT=${commit} npm run build`)

prepararDist(DIST, { version, commit, rama, desplegado: sello, origen: 'deploy' })

const publicado = publicarDist({
  distDir: DIST,
  mensaje: `deploy ${version} desde ${commit} (${sello})`
})

if (publicado) console.log(`\n✓ Publicado ${version} (${commit})`)

const etiqueta = `deploy-${sello.slice(0, 10)}-${sello.slice(11, 16).replace(':', '')}`
if (intentar(`git tag ${etiqueta}`) !== null) {
  intentar(`git push origin ${etiqueta}`)
  console.log(`✓ Etiqueta ${etiqueta}. Para volver a esta versión: npm run rollback -- ${etiqueta}`)
}

const url = urlDePages()
if (url) console.log(`\n▸ En un par de minutos: ${url}\n`)
