// ------------------------------------------------------------------
// Monitorización de errores.
//
// Objetivo del punto 2 de la especificación: enterarse de que algo falla
// antes de que lo cuente quien lo sufre. Aquí se capturan los errores no
// atrapados y las promesas rechazadas, con traza, contexto y frecuencia.
//
// El proveedor externo (Sentry, Rollbar, Bugsnag) queda como adaptador
// enchufable y APAGADO: sin `VITE_SENTRY_DSN` no se carga nada ni se sale
// un solo byte hacia terceros. Ver docs/RUNBOOK.md para activarlo.
// ------------------------------------------------------------------

import { log } from './log'

const frecuencia = new Map()
let proveedor = null
let instalado = false

/** Agrupa errores iguales para poder contar cuántas veces pasa cada uno. */
export function huella(error) {
  const nombre = error?.name || 'Error'
  const mensaje = String(error?.message || error || 'desconocido')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\d+/g, '<n>')
    .slice(0, 120)
  return `${nombre}: ${mensaje}`
}

/**
 * Registra un adaptador de monitorización externa.
 * @param {{ captureException: (error: unknown, contexto: object) => void }} adaptador
 */
export function setProveedor(adaptador) {
  proveedor = adaptador
}

export function capturar(error, contexto = {}) {
  const clave = huella(error)
  const veces = (frecuencia.get(clave) || 0) + 1
  frecuencia.set(clave, veces)

  log.error('error.capturado', { huella: clave, veces, detalle: error, ...contexto })

  if (proveedor) {
    try {
      proveedor.captureException(error, { huella: clave, veces, ...contexto })
    } catch {
      // Un fallo del proveedor de monitorización no puede tumbar la app.
    }
  }
  return { huella: clave, veces }
}

export function resumenErrores() {
  return [...frecuencia.entries()]
    .map(([huella, veces]) => ({ huella, veces }))
    .sort((a, b) => b.veces - a.veces)
}

/** Engancha los errores globales del navegador. Idempotente. */
export function instalarMonitorizacion() {
  if (instalado || typeof window === 'undefined') return () => {}
  instalado = true

  const alError = (evento) => capturar(evento.error || evento.message, { origen: 'window.onerror' })
  const alRechazo = (evento) => capturar(evento.reason, { origen: 'unhandledrejection' })

  window.addEventListener('error', alError)
  window.addEventListener('unhandledrejection', alRechazo)

  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (dsn) {
    log.info('monitorizacion.proveedor_pendiente', {
      nota: 'Hay DSN configurado; instala @sentry/browser y registra el adaptador con setProveedor().'
    })
  }

  return () => {
    window.removeEventListener('error', alError)
    window.removeEventListener('unhandledrejection', alRechazo)
    instalado = false
  }
}
