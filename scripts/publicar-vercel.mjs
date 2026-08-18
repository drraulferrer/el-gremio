#!/usr/bin/env node
// ------------------------------------------------------------------
// Publicar en Vercel, a mano y a propósito.
//
//   npm run vercel
//
// POR QUÉ EXISTE: al conectar el repositorio, Vercel publica producción
// en CADA empujón a `main`. Aquí se empuja documentación varias veces al
// día —el 18-ago producción acabó sirviendo un commit de solo texto— y
// §7l ya había decidido que eso no se quiere: publicar en cada empujón
// convierte el despliegue en ruido, y así es como se acaba publicando
// algo a medias un martes por la noche.
//
// Así que el automático está apagado en `vercel.json`
// (`git.deploymentEnabled.main = false`) y la publicación vuelve a ser un
// acto deliberado, igual que `npm run deploy` con GitHub Pages.
//
// Esto NO compila nada: solo toca el timbre. Vercel se trae `main` de
// GitHub y construye allí. Por eso hay que EMPUJAR ANTES lo que se quiera
// publicar; si no, se publica lo que ya hubiera en el remoto, que es una
// forma silenciosa de desplegar algo que no es lo que tienes delante.
// ------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const TIEMPO_LIMITE = 20000

function leerEnv() {
  if (!existsSync('.env')) return {}
  return readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .reduce((acc, linea) => {
      const i = linea.indexOf('=')
      return i === -1 ? acc : { ...acc, [linea.slice(0, i).trim()]: linea.slice(i + 1).trim() }
    }, {})
}

function intentar(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function fallar(mensaje) {
  console.error(`\n✖ ${mensaje}\n`)
  process.exit(1)
}

const env = { ...leerEnv(), ...process.env }
const hook = env.VERCEL_DEPLOY_HOOK

if (!hook) {
  fallar(
    'Falta VERCEL_DEPLOY_HOOK en el .env.\n' +
    '  Se saca de Vercel → el-gremio → Settings → Git → Deploy Hooks.\n' +
    '  Es un secreto: quien tenga esa URL puede publicar. No va al repositorio.'
  )
}

// Vercel construye lo que hay en el REMOTO, no lo que hay aquí. Avisar de
// la diferencia antes de publicar es barato; descubrirla después, no.
const rama = intentar('git rev-parse --abbrev-ref HEAD')
if (rama && rama !== 'main') {
  console.warn(`⚠  Estás en la rama "${rama}", pero el hook publica SIEMPRE main.`)
}

const local = intentar('git rev-parse --short HEAD')
const remoto = intentar('git rev-parse --short origin/main')
if (local && remoto && local !== remoto) {
  console.warn(
    `⚠  Local (${local}) y origin/main (${remoto}) no coinciden.\n` +
    '   Vercel publicará origin/main. Empuja antes si querías publicar lo tuyo.'
  )
}
if (intentar('git status --porcelain')) {
  console.warn('⚠  Hay cambios sin confirmar: NO van a publicarse, esto construye desde el remoto.')
}

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
console.log(`\n▸ Pidiendo a Vercel que publique main (versión ${version} en package.json)\n`)

const control = new AbortController()
const temporizador = setTimeout(() => control.abort(), TIEMPO_LIMITE)

try {
  const respuesta = await fetch(hook, { method: 'POST', signal: control.signal })
  const texto = await respuesta.text()

  if (!respuesta.ok) {
    fallar(`Vercel respondió HTTP ${respuesta.status}: ${texto.slice(0, 300)}`)
  }

  const cuerpo = JSON.parse(texto)
  const id = cuerpo.job?.id || '(sin id)'
  console.log(`✓ Publicación lanzada (job ${id}, estado ${cuerpo.job?.state || '?'})`)
  console.log('\n▸ Tarda un par de minutos. Para comprobar que llegó:\n')
  console.log('    npm run health\n')
} catch (error) {
  fallar(error instanceof Error ? error.message : 'error desconocido al llamar al hook')
} finally {
  clearTimeout(temporizador)
}
