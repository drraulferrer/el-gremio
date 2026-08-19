import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// La app vive en su propio dominio (elgremioapp.com, declarado en
// public/CNAME), así que la base es la raíz. Se puede sobrescribir con
// BASE_PATH para publicar bajo subcarpeta, que es lo que hacía falta
// mientras el sitio colgaba de usuario.github.io/el-gremio/.
const base = process.env.BASE_PATH || '/'

// El dominio de verdad, leído de public/CNAME, que es donde ya vive esa
// decisión. Va al bundle porque el QR de Dispositivos no puede deducirlo
// del origen: quien abra la app desde la dirección vieja, o desde una PWA
// instalada con ella, estaría enseñando a los demás una dirección que ya
// no es la buena. Vacío si no hay CNAME (despliegue bajo subcarpeta).
function dominioCanonico() {
  try {
    return readFileSync(new URL('./public/CNAME', import.meta.url), 'utf8').trim()
  } catch {
    return ''
  }
}

function gitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'sin-git'
  }
}

// Quién construye esto. En Vercel el repositorio se clona en superficie y
// `git` puede no contar toda la verdad, así que se prefieren sus variables
// —que sí son fiables— y se cae a git solo si no están.
const enVercel = Boolean(process.env.VERCEL)

function commitActual() {
  if (process.env.APP_COMMIT) return process.env.APP_COMMIT
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  return gitCommit()
}

function ramaActual() {
  if (process.env.VERCEL_GIT_COMMIT_REF) return process.env.VERCEL_GIT_COMMIT_REF
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'sin-git'
  }
}

/**
 * Emite `version.json` dentro de la build.
 *
 * POR QUÉ EXISTE: hasta la mudanza a Vercel este fichero lo escribía
 * `prepararDist` en el momento de publicar, porque publicar y construir
 * eran el mismo acto y lo hacía el mismo portátil. Vercel construye por su
 * cuenta y nunca pasa por ese script: sin esto, `npm run health` se queda
 * sin el fichero que consulta y la pantalla de Estado no sabe qué versión
 * corre. Que es justo lo que uno necesita saber cuando algo va mal.
 *
 * Los dos caminos conviven a propósito y NO se pisan de forma ambigua:
 * este plugin pone el sello siempre, y `prepararDist` lo SOBRESCRIBE en la
 * ruta de gh-pages porque allí se sabe más (si fue un deploy o un
 * rollback, y a qué referencia). El último que escribe es el que publica,
 * que es el que tiene la información buena.
 */
function selloDeVersion(datos) {
  return {
    name: 'sello-de-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(datos, null, 2) + '\n'
      })
    }
  }
}

const version = process.env.npm_package_version || '0.0.0'
const commit = commitActual()
const construido = new Date().toISOString()

export default defineConfig({
  base,
  plugins: [
    react(),
    selloDeVersion({
      version,
      commit,
      rama: ramaActual(),
      desplegado: construido,
      origen: enVercel ? 'vercel' : 'local'
    })
  ],
  define: {
    // Sello de versión: lo lee el registro de logs y la pantalla de estado,
    // y es lo que permite saber qué build está desplegada al hacer rollback.
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_BUILT_AT__: JSON.stringify(construido),
    __DOMINIO__: JSON.stringify(dominioCanonico())
  },
  // El puerto sale de PORT si está puesto. Sirve para que dos sesiones de
  // trabajo puedan levantar la demo a la vez sin pelearse por el 5177;
  // sin variable, vite elige el suyo de siempre.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
  build: {
    sourcemap: true
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
})
