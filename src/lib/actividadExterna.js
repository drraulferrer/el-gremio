import posthog from 'posthog-js'
import { modoDemo } from './supabase'

// ------------------------------------------------------------------
// Los dos contadores agregados que ve PostHog: misión validada, premio
// canjeado. Nada más. Ver legal/privacidad.html §2 y §5, y RUNBOOK §3d.
//
// Apagado sin VITE_POSTHOG_KEY: no se carga nada ni sale un byte hacia
// terceros, igual que Sentry en monitoring.js.
//
// Encendido, con salvaguardas por partida doble —en el código Y en la
// configuración del proyecto de PostHog, porque apagar solo una no
// basta si la otra lo enciende sola (grabación de sesión viene ON por
// defecto en un proyecto nuevo)—:
//  - Región EU (VITE_POSTHOG_HOST), igual que Supabase.
//  - Sin grabación de sesión, sin autocaptura de clics, sin pageview.
//  - `advanced_disable_decide`: ni siquiera pide configuración remota,
//    así que un cambio futuro en el panel de PostHog no puede reactivar
//    nada de esto por sorpresa.
//  - `distinct_id` es el id del GREMIO, el mismo que ya usa Supabase, no
//    uno nuevo: un contador por familia, nunca por persona ni por perfil,
//    para que no se pueda aislar la actividad de un menor.
//  - Sin propiedades además del nombre del evento: ni texto libre
//    (misiones, premios, elogios) ni nada que lo acompañe viaja nunca.
// ------------------------------------------------------------------

let activo = false

/**
 * Idempotente, como instalarMonitorizacion(). En modo demo no hay
 * gremio real que contar, así que ni se intenta: lo contrario ensuciaría
 * el proyecto de verdad con actividad de nadie.
 */
export function instalarActividadExterna() {
  if (activo || modoDemo || typeof window === 'undefined') return
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) return
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    advanced_disable_decide: true
  })
  activo = true
}

function evento(nombre, familyId) {
  if (!activo || !familyId) return
  posthog.identify(familyId)
  posthog.capture(nombre)
}

export function misionValidada(familyId) {
  evento('mision_validada', familyId)
}

export function premioCanjeado(familyId) {
  evento('premio_canjeado', familyId)
}
