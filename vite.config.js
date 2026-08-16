import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// La app vive en su propio dominio (elgremioapp.com, declarado en
// public/CNAME), así que la base es la raíz. Se puede sobrescribir con
// BASE_PATH para publicar bajo subcarpeta, que es lo que hacía falta
// mientras el sitio colgaba de usuario.github.io/el-gremio/.
const base = process.env.BASE_PATH || '/'

function gitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'sin-git'
  }
}

export default defineConfig({
  base,
  plugins: [react()],
  define: {
    // Sello de versión: lo lee el registro de logs y la pantalla de estado,
    // y es lo que permite saber qué build está desplegada al hacer rollback.
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    __APP_COMMIT__: JSON.stringify(process.env.APP_COMMIT || gitCommit()),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString())
  },
  build: {
    sourcemap: true
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
})
