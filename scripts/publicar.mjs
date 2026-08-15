// ------------------------------------------------------------------
// Publicación en la rama gh-pages. Lo usan deploy.mjs y rollback.mjs.
//
// Modelo append-only: cada publicación es un commit nuevo encima de
// gh-pages. Nunca se reescribe historia, así que un rollback es una
// publicación más y siempre se puede deshacer publicando otra cosa.
// ------------------------------------------------------------------

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, cpSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const RAMA = 'gh-pages'
const WORKTREE = '.gh-pages-worktree'

export const sh = (cmd, opciones = {}) =>
  execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opciones }).trim()

export const shOut = (cmd, opciones = {}) => execSync(cmd, { stdio: 'inherit', ...opciones })

export function intentar(cmd, opciones = {}) {
  try {
    return sh(cmd, opciones)
  } catch {
    return null
  }
}

export function fallar(mensaje) {
  console.error(`\n✖ ${mensaje}\n`)
  process.exit(1)
}

/** Añade a la build los ficheros que necesita GitHub Pages. */
export function prepararDist(distDir, metadatos) {
  if (!existsSync(join(distDir, 'index.html'))) {
    fallar(`La compilación no generó ${distDir}/index.html.`)
  }
  writeFileSync(join(distDir, 'version.json'), JSON.stringify(metadatos, null, 2) + '\n')
  // Sin .nojekyll, Pages procesa la build con Jekyll y se come ficheros.
  writeFileSync(join(distDir, '.nojekyll'), '')
  // Sin servidor propio no hay reescritura de rutas: la 404 sirve la app.
  cpSync(join(distDir, 'index.html'), join(distDir, '404.html'))
}

/** Copia distDir a la rama gh-pages y la sube. Devuelve true si publicó. */
export function publicarDist({ distDir, mensaje }) {
  if (existsSync(WORKTREE)) {
    intentar(`git worktree remove ${WORKTREE} --force`)
    rmSync(WORKTREE, { recursive: true, force: true })
  }

  intentar(`git fetch origin ${RAMA}`)
  const existeRemota = intentar(`git rev-parse --verify origin/${RAMA}`)

  if (existeRemota) {
    sh(`git worktree add -B ${RAMA} ${WORKTREE} origin/${RAMA}`)
  } else {
    console.log(`▸ La rama ${RAMA} no existe todavía: se crea huérfana.`)
    mkdirSync(WORKTREE, { recursive: true })
    sh(`git worktree add --detach ${WORKTREE}`)
    sh(`git -C ${WORKTREE} checkout --orphan ${RAMA}`)
    intentar(`git -C ${WORKTREE} rm -rf .`)
  }

  // Vaciar (menos .git) para que lo borrado desaparezca de verdad.
  for (const entrada of readdirSync(WORKTREE)) {
    if (entrada === '.git') continue
    rmSync(join(WORKTREE, entrada), { recursive: true, force: true })
  }

  cpSync(distDir, WORKTREE, { recursive: true })
  sh(`git -C ${WORKTREE} add -A`)

  // `diff --cached --quiet` sale con código 1 cuando SÍ hay cambios.
  const hayCambios = intentar(`git -C ${WORKTREE} diff --cached --quiet`) === null

  let publicado = false
  if (!hayCambios) {
    console.log('▸ Nada que publicar: la build es idéntica a la desplegada.')
  } else {
    sh(`git -C ${WORKTREE} commit -m ${JSON.stringify(mensaje)}`)
    shOut(`git -C ${WORKTREE} push origin ${RAMA}`)
    publicado = true
  }

  intentar(`git worktree remove ${WORKTREE} --force`)
  return publicado
}

/** URL pública de GitHub Pages a partir del remoto origin. */
export function urlDePages() {
  const remoto = intentar('git remote get-url origin')
  if (!remoto) return null
  const limpio = remoto.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '')
  const partes = limpio.split('/')
  const repo = partes.pop()
  const usuario = partes.pop()
  return `https://${usuario}.github.io/${repo}/`
}
