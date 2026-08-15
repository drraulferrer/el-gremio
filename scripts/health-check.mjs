#!/usr/bin/env node
// ------------------------------------------------------------------
// Comprobación de salud, para monitor externo o para el final de un
// despliegue.
//
//   npm run health
//   npm run health -- https://usuario.github.io/el-gremio/
//
// Comprueba dos cosas, que son las dos que pueden caer por separado:
//   1. la web publicada responde y qué versión sirve;
//   2. el backend de Supabase responde (función health() del esquema).
//
// Sale con código 1 si algo falla, para que un cron o un monitor lo
// detecte sin leer la salida.
// ------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs'

const TIEMPO_LIMITE = 10000

function leerEnv() {
  const ruta = existsSync('.env') ? '.env' : existsSync('.env.local') ? '.env.local' : null
  if (!ruta) return {}
  return readFileSync(ruta, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .reduce((acc, linea) => {
      const i = linea.indexOf('=')
      if (i === -1) return acc
      return { ...acc, [linea.slice(0, i).trim()]: linea.slice(i + 1).trim() }
    }, {})
}

async function conLimite(promesa) {
  const control = new AbortController()
  const t = setTimeout(() => control.abort(), TIEMPO_LIMITE)
  try {
    return await promesa(control.signal)
  } finally {
    clearTimeout(t)
  }
}

async function comprobarWeb(url) {
  const inicio = Date.now()
  try {
    const respuesta = await conLimite((signal) =>
      fetch(new URL('version.json', url).href, { signal, cache: 'no-store' })
    )
    const ms = Date.now() - inicio
    if (!respuesta.ok) return { nombre: 'web', ok: false, ms, detalle: `HTTP ${respuesta.status}` }
    const cuerpo = await respuesta.json()
    return { nombre: 'web', ok: true, ms, detalle: `${cuerpo.version} (${cuerpo.commit}) · ${cuerpo.desplegado}` }
  } catch (err) {
    return { nombre: 'web', ok: false, ms: Date.now() - inicio, detalle: err.message }
  }
}

async function comprobarSupabase(url, key) {
  const inicio = Date.now()
  try {
    const respuesta = await conLimite((signal) =>
      fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/health`, {
        method: 'POST',
        signal,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: '{}'
      })
    )
    const ms = Date.now() - inicio
    const texto = await respuesta.text()
    if (!respuesta.ok) return { nombre: 'supabase', ok: false, ms, detalle: `HTTP ${respuesta.status}: ${texto.slice(0, 160)}` }
    const cuerpo = JSON.parse(texto)
    return { nombre: 'supabase', ok: cuerpo.status === 'ok', ms, detalle: `postgres ${cuerpo.postgres}` }
  } catch (err) {
    return { nombre: 'supabase', ok: false, ms: Date.now() - inicio, detalle: err.message }
  }
}

const env = { ...leerEnv(), ...process.env }
const urlWeb = process.argv[2] || env.HEALTH_URL || null
const urlSupabase = env.VITE_SUPABASE_URL
const keySupabase = env.VITE_SUPABASE_ANON_KEY

const comprobaciones = []

if (urlWeb) comprobaciones.push(comprobarWeb(urlWeb))
if (urlSupabase && keySupabase && !urlSupabase.includes('TU-PROYECTO')) {
  comprobaciones.push(comprobarSupabase(urlSupabase, keySupabase))
}

if (comprobaciones.length === 0) {
  console.error('✖ Nada que comprobar: falta la URL publicada y/o las credenciales de Supabase en .env')
  process.exit(1)
}

const resultados = await Promise.all(comprobaciones)

console.log(`\nEl Gremio · salud · ${new Date().toISOString()}\n`)
for (const r of resultados) {
  console.log(`${r.ok ? '🟢' : '🔴'} ${r.nombre.padEnd(9)} ${String(r.ms).padStart(5)} ms  ${r.detalle}`)
}
console.log('')

process.exit(resultados.every((r) => r.ok) ? 0 : 1)
