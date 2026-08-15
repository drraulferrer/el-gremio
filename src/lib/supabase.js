import { createClient } from '@supabase/supabase-js'
import { flag } from './flags'
import { crearClienteDemo, migrarTitulosDemo } from './fakeBackend'
import { log } from './log'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

const hayCredenciales = Boolean(url && key && !url.includes('TU-PROYECTO'))
export const modoDemo = flag('demo')

export const configured = hayCredenciales || modoDemo
export const supabase = modoDemo ? crearClienteDemo() : hayCredenciales ? createClient(url, key) : null

// La demo guarda sus datos en el navegador y no pasa por las migraciones,
// así que se pone al día sola al arrancar.
if (modoDemo) migrarTitulosDemo()

// ------------------------------------------------------------------
// Errores: traducirlos aquí evita que la interfaz enseñe jerga de
// Postgres y, sobre todo, evita el peor patrón posible, que es tragarse
// el error en silencio y dejar a quien usa la app sin saber qué pasó.
// ------------------------------------------------------------------

export function mensajeDeError(error) {
  if (!error) return ''
  const texto = error.message || String(error)
  if (/limite_de_ritmo/i.test(texto)) {
    return 'Demasiadas acciones seguidas. Espera un momento y vuelve a intentarlo.'
  }
  if (/violates row-level security|permission denied/i.test(texto)) {
    return 'Esta sesión no tiene permiso para eso. Cierra sesión y vuelve a entrar.'
  }
  if (/duplicate key/i.test(texto)) return 'Eso ya estaba registrado.'
  if (/column .*active.* does not exist/i.test(texto)) {
    return 'Falta ejecutar migracion-003-miembros.sql en el SQL Editor de Supabase.'
  }
  if (/Failed to fetch|NetworkError|ERR_INTERNET/i.test(texto)) {
    return 'Sin conexión con el gremio. Comprueba la red e inténtalo otra vez.'
  }
  return texto
}

/**
 * Ejecuta una operación contra Supabase registrando el resultado.
 * Devuelve { data, error, mensaje } y nunca lanza.
 */
/**
 * Nombre del evento para la línea de éxito.
 *
 * Quien llama pasa el nombre del FALLO ('mision.deshecha.error'), que es
 * el que importa cuando algo va mal. Usarlo tal cual en la línea de éxito
 * llenaba `app_logs` de filas `*.error` que eran operaciones correctas:
 * ocho «mision.deshecha.error» resultaron ser ocho deshaceres que
 * funcionaron. Se distinguían solo por el nivel (`debug` frente a
 * `error`) y por la ausencia de `detalle`, que es mucho pedirle a quien
 * mira los logs a las once de la noche.
 */
export function eventoDeExito(eventoError) {
  return eventoError.replace(/[._]error$/, '') + '.ok'
}

export async function operacion(eventoError, fn, campos = {}) {
  const inicio = Date.now()
  try {
    const { data, error } = await fn()
    if (error) {
      log.error(eventoError, { ...campos, ms: Date.now() - inicio, detalle: error })
      return { data: null, error, mensaje: mensajeDeError(error) }
    }
    log.debug(eventoDeExito(eventoError), { ...campos, ms: Date.now() - inicio })
    return { data, error: null, mensaje: '' }
  } catch (err) {
    log.error(eventoError, { ...campos, ms: Date.now() - inicio, detalle: err })
    return { data: null, error: err, mensaje: mensajeDeError(err) }
  }
}

/**
 * Destino persistente del registro: inserta los logs en la tabla app_logs.
 * Se le pasa a `setSink` cuando ya hay sesión.
 */
export function crearSinkDeLogs() {
  return async (lote) => {
    if (!supabase) return
    const filas = lote.map((l) => ({
      family_id: l.family_id || null,
      profile_id: l.profile_id || null,
      ts: l.ts,
      nivel: l.nivel,
      evento: l.evento,
      release: l.release,
      sesion_id: l.sesion_id,
      request_id: l.request_id || null,
      datos: l
    }))
    await supabase.from('app_logs').insert(filas)
  }
}

// ------------------------------------------------------------------
// Economía: la XP nunca se gasta (marca el nivel); las monedas sí
// (se canjean en la tienda). Curva de nivel triangular y suave.
// ------------------------------------------------------------------

export function xpForLevel(level) {
  return 50 * level * (level - 1) // N1: 0 · N2: 100 · N3: 300 · N4: 600 · N5: 1000
}

export function levelFromXp(xp) {
  let l = 1
  while (xp >= xpForLevel(l + 1)) l++
  return l
}

export function levelProgress(xp) {
  const level = levelFromXp(xp)
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  const pct = Math.max(0, Math.min(100, Math.round((100 * (xp - base)) / (next - base))))
  return { level, pct, current: xp - base, needed: next - base, nextAt: next }
}

// ------------------------------------------------------------------
// Frecuencia de misiones
// ------------------------------------------------------------------

export function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function weekKey(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const year = date.getUTCFullYear()
  const start = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((date - start) / 86400000 + 1) / 7)
  return `${year}-w${week}`
}

export function monthKey(d) {
  return `${d.getFullYear()}-m${d.getMonth() + 1}`
}

// ¿Puede este perfil pedir esta misión ahora mismo?
export function canDo(challenge, completions, profileId) {
  const mine = completions.filter(
    (c) => c.challenge_id === challenge.id && c.profile_id === profileId && c.status !== 'rechazado'
  )
  if (challenge.frequency === 'unico') return mine.length === 0
  const now = new Date()
  if (challenge.frequency === 'diario') {
    return !mine.some((c) => dayKey(new Date(c.requested_at)) === dayKey(now))
  }
  if (challenge.frequency === 'mensual') {
    return !mine.some((c) => monthKey(new Date(c.requested_at)) === monthKey(now))
  }
  return !mine.some((c) => weekKey(new Date(c.requested_at)) === weekKey(now))
}

export function goalProgress(goal, completions) {
  if (!goal) return 0
  const since = new Date(goal.starts_at).getTime()
  return completions
    .filter((c) => c.status === 'aprobado' && c.resolved_at && new Date(c.resolved_at).getTime() >= since)
    .reduce((sum, c) => sum + c.xp, 0)
}

// ------------------------------------------------------------------
// Insignias (las automáticas se evalúan en cliente tras cada carga)
// ------------------------------------------------------------------

export const BADGES = [
  { code: 'primera', name: 'Primera misión', emoji: '🌟', desc: 'Completa tu primera misión', test: (s) => s.approved >= 1 },
  { code: 'x10', name: 'Diez misiones', emoji: '🔥', desc: '10 misiones aprobadas', test: (s) => s.approved >= 10 },
  { code: 'x25', name: '{Veterano|Veterana|Veteranía}', emoji: '🏅', desc: '25 misiones aprobadas', test: (s) => s.approved >= 25 },
  { code: 'x50', name: 'Leyenda', emoji: '👑', desc: '50 misiones aprobadas', test: (s) => s.approved >= 50 },
  { code: 'nivel5', name: 'Nivel 5', emoji: '💎', desc: 'Alcanza el nivel 5', test: (s) => s.level >= 5 },
  { code: 'nivel10', name: 'Nivel 10', emoji: '🚀', desc: 'Alcanza el nivel 10', test: (s) => s.level >= 10 },
  { code: 'canje1', name: 'Primer canje', emoji: '🛍️', desc: 'Canjea tu primer premio', test: (s) => s.redemptions >= 1 },
  { code: 'gremio', name: 'Meta del gremio', emoji: '🏰', desc: 'Lograsteis una meta familiar juntos', test: () => false }
]

// Las plantillas de misiones viven ahora en src/lib/tareas.js (por
// habilidad) y las de premios en src/lib/premios.js (por nivel). Aquí
// solo queda la meta cooperativa de arranque.

// 1600 XP no es un número redondo elegido a ojo: es lo que una familia de
// cuatro genera en unos doce días con el 60 % de adherencia. Ver
// src/lib/economia.js. Con los 600 de antes se cerraba en cuatro días y
// medio, y una meta que cae sola deja de ser una meta.
export const META_INICIAL = { title: 'Noche de pizza y peli', emoji: '🍕', target_xp: 1600 }

// 'Junior' y 'Peque' son epicenos; 'Adulto' no.
export const ROLE_LABEL = { adulto: '{Adulto|Adulta|Persona adulta}', junior: 'Junior', peque: 'Peque' }

export const EMOJIS = ['🦊', '🐣', '🦄', '🐨', '🐙', '🦖', '🐼', '🐬', '🦁', '🌟', '🌈', '🚀', '🧙', '🧝', '🐲', '🦉']

export const COLORS = ['#ff6b6b', '#4ecdc4', '#a78bfa', '#ffd166', '#6ee7a0', '#7fb3ff']

export const FREQ_LABEL = { diario: 'Diaria', semanal: 'Semanal', mensual: 'Mensual', unico: 'Única' }

// PIN parental: hash SHA-256 en cliente. Es un cerrojo doméstico dentro de la
// sesión familiar, no seguridad criptográfica de verdad.
export async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('gremio:' + pin))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
