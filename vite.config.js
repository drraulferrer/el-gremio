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

export default defineConfig({
  base,
  plugins: [react()],
  define: {
    // Sello de versión: lo lee el registro de logs y la pantalla de estado,
    // y es lo que permite saber qué build está desplegada al hacer rollback.
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    __APP_COMMIT__: JSON.stringify(process.env.APP_COMMIT || gitCommit()),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
    __DOMINIO__: JSON.stringify(dominioCanonico())
  },
  build: {
    sourcemap: true
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
})
