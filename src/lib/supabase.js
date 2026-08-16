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
//
// Todo esto cuelga de una sola pregunta: ¿qué día es hoy en esta casa?
//
// Hasta la migración 018 había DOS respuestas distintas y nadie las
// comparaba: Postgres contaba en Europe/Madrid y el navegador en la hora
// del aparato. Con la familia en Madrid coinciden y no se nota nada; con
// la familia en México se separan siete horas y entonces la estrella
// diaria de la peque se puede pedir dos veces o ninguna, y una racha viva
// se lee como rota. Ahora la zona la pone la familia y se configura una
// vez al cargarla (`configurarZona`), de modo que las funciones de abajo
// mantienen su firma y ningún sitio de llamada tuvo que cambiar.
// ------------------------------------------------------------------

// null = la del dispositivo, que es lo que hacía antes. Se queda como
// comportamiento por defecto para que los tests y el modo demo no
// dependan de una configuración previa.
let ZONA = null

export function configurarZona(tz) {
  ZONA = tz || null
  return ZONA
}

export function zonaActual() {
  return ZONA || zonaDelDispositivo()
}

// La que dice el aparato. Con red de seguridad: si el navegador no
// resuelve ninguna (pasa en entornos raros), Europe/Madrid, que es el
// valor por defecto de la columna y deja las dos partes de acuerdo.
export function zonaDelDispositivo() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'
  } catch {
    return 'Europe/Madrid'
  }
}

// «Esa columna no existe» dicho por PostgREST. Sirve para escribir contra
// una base que aún no tiene la última migración sin dejar tirada a la
// familia: se reintenta sin la columna nueva.
export function esColumnaQueNoExiste(error) {
  if (!error) return false
  const codigo = error.code || ''
  const texto = `${error.message || ''} ${error.details || ''}`.toLowerCase()
  return codigo === 'PGRST204' || codigo === '42703' ||
    (texto.includes('column') && texto.includes('does not exist'))
}

// Año, mes y día tal y como se ven EN esa zona. 'en-CA' porque da
// AAAA-MM-DD, que se parte sin ambigüedad.
function partesEnZona(d, tz) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d).split('-').map(Number)
  return { anio: partes[0], mes: partes[1], dia: partes[2] }
}

// El formato NO lleva ceros a la izquierda, y eso es deliberado: es el que
// ya estaba y hay claves guardadas y comparadas con él por toda la app.
export function dayKey(d, tz = ZONA) {
  if (!tz) return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  const p = partesEnZona(d, tz)
  return `${p.anio}-${p.mes}-${p.dia}`
}

// El día de la semana EN esa zona, 1 = lunes … 7 = domingo (el mismo
// número que `isodow` de Postgres, que es quien decide lo mismo del otro
// lado). No se usa `getDay()` por lo mismo que dayKey no usa `getDate()`:
// a las 00:30 de un lunes en Madrid un aparato puesto en otra zona sigue
// en domingo, y la misión de los lunes tiene que salir el lunes de la
// casa, no el del reloj.
export function diaSemana(d, tz = ZONA) {
  const p = tz
    ? partesEnZona(d, tz)
    : { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() }
  return new Date(Date.UTC(p.anio, p.mes - 1, p.dia)).getUTCDay() || 7
}

export function weekKey(d, tz = ZONA) {
  const p = tz
    ? partesEnZona(d, tz)
    : { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() }
  const date = new Date(Date.UTC(p.anio, p.mes - 1, p.dia))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const year = date.getUTCFullYear()
  const start = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((date - start) / 86400000 + 1) / 7)
  return `${year}-w${week}`
}

export function monthKey(d, tz = ZONA) {
  if (!tz) return `${d.getFullYear()}-m${d.getMonth() + 1}`
  const p = partesEnZona(d, tz)
  return `${p.anio}-m${p.mes}`
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

// Las insignias viven en src/lib/insignias.js desde que dejaron de ser
// decorativas. Aquí hubo un `BADGES` con las ocho originales que sobrevivió
// a la mudanza sin que lo usara nadie más que sus tests: dos catálogos, uno
// de 8 y otro de 16, y el viejo era el que revisaba el test de género. Por
// eso las ocho nuevas nunca se comprobaron.

// Las plantillas de misiones viven ahora en src/lib/tareas.js (por
// habilidad) y las de premios en src/lib/premios.js (por nivel). Aquí
// solo queda la meta cooperativa de arranque.

// 1600 XP no es un número redondo elegido a ojo: es lo que una familia de
// cuatro genera en unos doce días con el 60 % de adherencia. Ver
// src/lib/economia.js. Con los 600 de antes se cerraba en cuatro días y
// medio, y una meta que cae sola deja de ser una meta.
// 8100 XP y no 1600: la cadencia de meta pasó de 12 a 60 días, y una meta
// que se cierra cada dos semanas compite con los premios individuales en
// vez de ser el horizonte largo. El número sale de metaObjetivo() con los
// supuestos del modelo; hay un test que falla si se separan.
// La meta inicial la calcula `setup.js` con los roles reales de la casa
// (`metaObjetivo`), no una cifra fija: una familia de dos tardaría el
// triple en cerrar la misma meta.

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
