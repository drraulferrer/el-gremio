// ------------------------------------------------------------------
// Registro estructurado.
//
// Cada línea es un objeto JSON con marca de tiempo, nivel, evento, id de
// sesión del dispositivo, id de petición y los identificadores de familia
// y perfil. Eso es lo que convierte "algo falló" en una traza que se puede
// seguir: sin id de petición, un fallo en producción es una aguja en un
// pajar con los ojos vendados.
//
// Dos destinos:
//  - consola del navegador, siempre (una sola línea JSON, no texto suelto);
//  - tabla `app_logs` de Supabase para warn y error, en cola y por lotes,
//    de forma que un fallo del registro nunca rompa la app.
//
// Nunca se registran email, contraseña, PIN ni tokens: `redactar` los
// elimina aunque alguien los pase por descuido.
// ------------------------------------------------------------------

import { RELEASE } from './version'
import { flag } from './flags'

const NIVEL_VALOR = { debug: 10, info: 20, warn: 30, error: 40 }

const PROHIBIDAS = /^(email|correo|password|pass|contrasena|contraseña|pin|pin_hash|parent_pin_hash|token|access_token|refresh_token|apikey|api_key|key|anon_key|authorization)$/i

const MAX_TEXTO = 300
const MAX_COLA = 50
const INTERVALO_VACIADO = 5000

const sesionId = idCorto()

let contexto = {}
let sink = null
let cola = []
let temporizador = null

function idCorto() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8)
  return Math.random().toString(16).slice(2, 10)
}

export function nuevoRequestId() {
  return idCorto()
}

/** Datos que acompañan a todas las líneas a partir de ahora. */
export function setContexto(campos) {
  contexto = { ...contexto, ...campos }
}

export function limpiarContexto() {
  contexto = {}
}

/** Destino persistente. Lo inyecta la app cuando hay sesión de Supabase. */
export function setSink(fn) {
  sink = fn
}

export function redactar(valor, profundidad = 0) {
  if (valor === null || valor === undefined) return valor
  if (profundidad > 4) return '[profundo]'
  if (typeof valor === 'string') {
    return valor.length > MAX_TEXTO ? valor.slice(0, MAX_TEXTO) + '…' : valor
  }
  if (typeof valor === 'number' || typeof valor === 'boolean') return valor
  if (valor instanceof Error) {
    // Los errores de PostgREST son un Error con `code`, `details` y `hint`
    // colgados encima, y esos tres son justo los que dicen qué hacer: en un
    // 42501 el `hint` trae el GRANT literal que lo arregla, y `code` es el
    // que distingue "falta la migración" de "RLS te ha parado". Como no son
    // propiedades de Error, esta rama los tiraba y en `app_logs` solo
    // quedaba el resumen humano, que es el menos útil de los cuatro campos.
    const extra = {}
    for (const [k, v] of Object.entries(valor)) {
      if (k === 'name' || k === 'message' || k === 'stack') continue
      extra[k] = PROHIBIDAS.test(k) ? '[redactado]' : redactar(v, profundidad + 1)
    }
    return {
      nombre: valor.name,
      mensaje: redactar(valor.message, profundidad + 1),
      ...extra,
      stack: redactar(valor.stack, profundidad + 1)
    }
  }
  if (Array.isArray(valor)) return valor.slice(0, 20).map((v) => redactar(v, profundidad + 1))
  if (typeof valor === 'object') {
    const salida = {}
    for (const [k, v] of Object.entries(valor)) {
      salida[k] = PROHIBIDAS.test(k) ? '[redactado]' : redactar(v, profundidad + 1)
    }
    return salida
  }
  return String(valor)
}

function linea(nivel, evento, campos) {
  return {
    ts: new Date().toISOString(),
    nivel,
    evento,
    sesion_id: sesionId,
    release: RELEASE,
    ...contexto,
    ...redactar(campos || {})
  }
}

function encolar(entrada) {
  if (!sink || !flag('logsRemotos')) return
  if (NIVEL_VALOR[entrada.nivel] < NIVEL_VALOR.warn && !flag('logsInfo')) return

  cola = [...cola, entrada].slice(-MAX_COLA)
  if (cola.length >= 10) {
    vaciar()
    return
  }
  if (!temporizador) {
    temporizador = setTimeout(vaciar, INTERVALO_VACIADO)
  }
}

/** Envía la cola pendiente. Nunca lanza: el registro no puede tirar la app. */
export async function vaciar() {
  if (temporizador) {
    clearTimeout(temporizador)
    temporizador = null
  }
  if (!sink || cola.length === 0) return
  const lote = cola
  cola = []
  try {
    await sink(lote)
  } catch (err) {
    // Un fallo al persistir se queda en la consola y se descarta el lote:
    // reencolar aquí es la forma más rápida de construir un bucle infinito.
    emitirConsola({ ...linea('warn', 'log.sink_error'), detalle: redactar(err) })
  }
}

function emitirConsola(entrada) {
  const texto = JSON.stringify(entrada)
  /* eslint-disable no-console */
  if (entrada.nivel === 'error') console.error(texto)
  else if (entrada.nivel === 'warn') console.warn(texto)
  else console.info(texto)
  /* eslint-enable no-console */
}

function emitir(nivel, evento, campos) {
  const entrada = linea(nivel, evento, campos)
  emitirConsola(entrada)
  encolar(entrada)
  return entrada
}

export const log = {
  debug: (evento, campos) => emitir('debug', evento, campos),
  info: (evento, campos) => emitir('info', evento, campos),
  warn: (evento, campos) => emitir('warn', evento, campos),
  error: (evento, campos) => emitir('error', evento, campos)
}

/** Vacía la cola cuando la pestaña se va: si no, los últimos logs se pierden. */
export function instalarVaciadoAlSalir() {
  if (typeof document === 'undefined') return () => {}
  const alOcultar = () => {
    if (document.visibilityState === 'hidden') vaciar()
  }
  document.addEventListener('visibilitychange', alOcultar)
  window.addEventListener('pagehide', vaciar)
  return () => {
    document.removeEventListener('visibilitychange', alOcultar)
    window.removeEventListener('pagehide', vaciar)
  }
}
