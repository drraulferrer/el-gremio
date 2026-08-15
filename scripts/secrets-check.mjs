#!/usr/bin/env node
// ------------------------------------------------------------------
// Control de credenciales.
//
//   npm run secrets:check
//
// Tres comprobaciones, en orden de gravedad:
//   1. que .env no esté versionado (lo peor que puede pasar);
//   2. que ningún fichero rastreado contenga algo con pinta de secreto;
//   3. que la última rotación no pase de 90 días.
//
// La clave anon de Supabase es pública por diseño y viaja en el bundle:
// aparecer ahí no es una fuga. La que nunca debe salir del panel de
// Supabase es la service_role. Ver docs/ROTACION-SECRETOS.md.
// ------------------------------------------------------------------

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const DIAS_MAXIMOS = 90

const PATRONES = [
  { nombre: 'clave service_role de Supabase', regex: /service_role/i },
  { nombre: 'JWT largo', regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./ },
  { nombre: 'clave de OpenAI/Anthropic', regex: /\b(sk-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9-]{20,})\b/ },
  { nombre: 'token de GitHub', regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { nombre: 'clave privada', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ }
]

const IGNORAR = /^(package-lock\.json|dist\/|node_modules\/|scripts\/secrets-check\.mjs$)/

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()
let problemas = 0
let avisos = 0

console.log('\nEl Gremio · credenciales\n')

// 1. .env fuera del control de versiones ----------------------------------

const rastreados = sh('git ls-files').split('\n').filter(Boolean)

if (rastreados.some((f) => f === '.env' || f.endsWith('/.env'))) {
  console.log('🔴 .env está en git. Sácalo ya: git rm --cached .env  y rota todo lo que contenga.')
  problemas++
} else {
  console.log('🟢 .env no está versionado')
}

if (!readFileSync('.gitignore', 'utf8').includes('.env')) {
  console.log('🔴 .gitignore no ignora .env')
  problemas++
}

// 2. Rastro de secretos en ficheros versionados ---------------------------

let encontrados = 0
for (const fichero of rastreados) {
  if (IGNORAR.test(fichero) || !existsSync(fichero)) continue
  let contenido
  try {
    contenido = readFileSync(fichero, 'utf8')
  } catch {
    continue // binario
  }
  for (const patron of PATRONES) {
    if (patron.regex.test(contenido)) {
      console.log(`🔴 ${fichero}: parece contener ${patron.nombre}`)
      encontrados++
      problemas++
    }
  }
}
if (encontrados === 0) console.log('🟢 Ningún secreto aparente en los ficheros versionados')

// 3. Antigüedad de la última rotación -------------------------------------

const env = existsSync('.env') ? readFileSync('.env', 'utf8') : ''
const fecha = (env.match(/VITE_SECRETS_ROTATED_AT=(.+)/) || [])[1]?.trim()

if (!fecha) {
  console.log('🟡 Sin fecha de rotación. Añade VITE_SECRETS_ROTATED_AT=AAAA-MM-DD a .env')
  avisos++
} else {
  const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)
  if (Number.isNaN(dias)) {
    console.log(`🟡 VITE_SECRETS_ROTATED_AT no es una fecha válida: ${fecha}`)
    avisos++
  } else if (dias > DIAS_MAXIMOS) {
    console.log(`🟡 Última rotación hace ${dias} días (máximo ${DIAS_MAXIMOS}). Toca: docs/ROTACION-SECRETOS.md`)
    avisos++
  } else {
    console.log(`🟢 Última rotación hace ${dias} días`)
  }
}

console.log('')
if (problemas > 0) {
  console.error(`✖ ${problemas} problema(s) de credenciales.\n`)
  process.exit(1)
}
if (avisos > 0) console.log(`▸ ${avisos} aviso(s), nada bloqueante.\n`)
process.exit(0)
