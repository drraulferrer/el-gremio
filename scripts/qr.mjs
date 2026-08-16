#!/usr/bin/env node
// ------------------------------------------------------------------
// Genera el QR del gremio para imprimir o mandar por mensaje.
//
//   npm run qr
//   npm run qr -- https://otra-direccion/
//
// Deja dos ficheros en docs/:
//   qr-el-gremio.svg   el código a secas, para pegar donde haga falta
//   qr-el-gremio.html  una tarjeta A5 lista para imprimir y colgar
//
// La app también enseña este QR en Panel parental → ⚙️ → Dispositivos,
// calculado en el propio dispositivo. Esto es para el mundo de papel.
// ------------------------------------------------------------------

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { urlDePages } from './publicar.mjs'

const require = createRequire(import.meta.url)
const qrcode = require('qrcode-generator')

function urlPorDefecto() {
  if (existsSync('.env')) {
    const env = readFileSync('.env', 'utf8')
    const encontrada = (env.match(/HEALTH_URL=(.+)/) || [])[1]?.trim()
    if (encontrada) return encontrada
  }
  // El dominio propio, deducido de public/CNAME: un QR impreso con la URL
  // vieja se queda colgado en una pared durante meses.
  return urlDePages() || 'https://elgremioapp.com/'
}

const url = process.argv.slice(2).filter((a) => a !== '--')[0] || urlPorDefecto()

const qr = qrcode(0, 'M')
qr.addData(url)
qr.make()

const n = qr.getModuleCount()
const margen = 2
const lado = n + margen * 2

const rectangulos = []
for (let fila = 0; fila < n; fila++) {
  for (let col = 0; col < n; col++) {
    if (qr.isDark(fila, col)) {
      rectangulos.push(`<rect x="${col + margen}" y="${fila + margen}" width="1" height="1"/>`)
    }
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="512" height="512" shape-rendering="crispEdges">
  <rect width="${lado}" height="${lado}" fill="#ffffff"/>
  <g fill="#10122a">
    ${rectangulos.join('\n    ')}
  </g>
</svg>
`

const tarjeta = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>El Gremio · QR</title>
<style>
  @page { size: A5; margin: 12mm; }
  body {
    font-family: 'Fredoka', system-ui, sans-serif;
    background: #fff;
    color: #1e2140;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
    text-align: center;
  }
  h1 { font-size: 34px; margin: 0 0 4px; }
  p  { margin: 4px 0; color: #4a4f7a; font-size: 15px; }
  .qr { width: 260px; height: 260px; margin: 18px 0 10px; }
  .url {
    font-family: ui-monospace, monospace;
    font-size: 13px;
    background: #f2f0ea;
    border-radius: 8px;
    padding: 8px 12px;
    word-break: break-all;
    max-width: 320px;
  }
  ol { text-align: left; max-width: 320px; font-size: 13px; color: #4a4f7a; padding-left: 18px; }
  li { margin: 5px 0; }
</style>
</head>
<body>
  <h1>⚔️ El Gremio</h1>
  <p>Misiones, estrellas y premios de casa</p>
  ${svg.replace('<svg ', '<svg class="qr" ')}
  <div class="url">${url}</div>
  <ol>
    <li>Apunta con la cámara y abre el enlace.</li>
    <li><strong>iPhone y iPad:</strong> en Safari, botón compartir ↑ → Añadir a pantalla de inicio.</li>
    <li><strong>Android:</strong> en Chrome, menú ⋮ → Añadir a pantalla de inicio.</li>
    <li>Entra con la cuenta familiar y elige tu perfil. El aparato lo recuerda.</li>
  </ol>
</body>
</html>
`

mkdirSync('docs', { recursive: true })
writeFileSync('docs/qr-el-gremio.svg', svg)
writeFileSync('docs/qr-el-gremio.html', tarjeta)

console.log(`\n✓ QR de ${url}`)
console.log('  docs/qr-el-gremio.svg   código suelto')
console.log('  docs/qr-el-gremio.html  tarjeta A5 para imprimir\n')
