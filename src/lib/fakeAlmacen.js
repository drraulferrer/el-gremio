// ------------------------------------------------------------------
// El almacén de la demo: dónde viven los datos y quién es la sesión.
//
// Sale de `fakeBackend.js` porque desde la capa de RPC de las fases 5 a 7
// hay tres ficheros que necesitan lo mismo —leer, escribir, avisar y saber
// quién ha entrado— y dejarlo dentro del cliente obligaba a importar el
// cliente desde sus propias piezas.
//
// No hay nada nuevo aquí: es el mismo código, movido.
// ------------------------------------------------------------------

export const CLAVE = 'gremio_demo_db'
export const CLAVE_SESION = 'gremio_demo_sesion'

export const TABLAS = [
  'families',
  'profiles',
  'challenges',
  'completions',
  'rewards',
  'redemptions',
  'family_goals',
  'profile_badges',
  'app_logs',
  'bonuses',
  'power_uses',
  'push_log',
  'plan_diario',
  // Sin esta tabla el recordatorio de avisos del panel revienta en modo
  // demo mientras en producción funciona: la peor combinación, porque la
  // demo es justo donde se prueba.
  'push_subs',
  'campanas_limpieza',
  'zonas_casa',
  'informes_fallo',
  'reconocimientos',
  // Identidad y pertenencia (044 a 052). `usuarios` es el espejo de
  // `auth.users`: la demo no tiene esquema `auth`, pero tres funciones
  // buscan por correo —las invitaciones, la credencial nueva, la lectura
  // de reclamaciones— y sin una tabla de cuentas no se pueden escribir.
  'usuarios',
  'credenciales',
  'pertenencias',
  'carteras',
  'movimientos_coins',
  'conversiones',
  // Expansión, invitaciones y reclamación (056 a 059).
  'derechos_expansion',
  'invitaciones',
  'reclamaciones'
]

export const vacia = () => TABLAS.reduce((acc, t) => ({ ...acc, [t]: [] }), {})

export function leer() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return crudo ? { ...vacia(), ...JSON.parse(crudo) } : vacia()
  } catch {
    return vacia()
  }
}

// Espejo de `trg_marca_de_agua_xp` (migración 035): xp_maxima nunca baja.
//
// Va aquí, en la escritura, y no en el insert/update de Consulta. Las RPC
// —resolve_completion, el premio a mano, deshacer— tocan `profiles` y
// escriben directas, saltándose ese camino. En Postgres las cubre a todas
// un trigger BEFORE, y el único punto equivalente en la demo es este. Si
// se pusiera en el update, deshacer una validación bajaría la marca en
// demo y no en producción: el personaje se desvestiría solo aquí, que es
// justo el sitio donde se prueba.
function marcaDeAguaXp(db) {
  if (!Array.isArray(db.profiles)) return db
  return {
    ...db,
    profiles: db.profiles.map((p) => ({
      ...p,
      xp_maxima: Math.max(Number(p.xp_maxima) || 0, Number(p.xp) || 0)
    }))
  }
}

export function escribir(db) {
  localStorage.setItem(CLAVE, JSON.stringify(marcaDeAguaXp(db)))
}

export function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

export const oyentes = new Set()

export function notificar() {
  // Asíncrono a propósito: imita el realtime de Supabase, que nunca
  // responde dentro del mismo tick que la escritura.
  setTimeout(() => oyentes.forEach((fn) => fn({ eventType: 'demo' })), 30)
}

/** La sesión guardada, o null. Equivale a `auth.getSession()`. */
export function sesionActual() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null')
  } catch {
    return null
  }
}

/** `auth.uid()` de la demo. Null cuando no hay nadie dentro. */
export function uidActual() {
  return sesionActual()?.user?.id || null
}

// Valores por defecto de cada tabla, copiados de schema.sql. Sin esto una
// fila recién insertada sale sin `status` y la función que la aprueba no
// la encuentra nunca: el fallo silencioso perfecto.
export const DEFECTOS_TABLA = {
  profiles: { emoji: '🙂', color: '#a78bfa', xp: 0, coins: 0, active: true, gender: 'neutro', xp_maxima: 0, retrato_piel: null, retrato_pelo: null, retrato_peinado: null, retrato_gafas: null, retrato_tunica: null, retrato_barba: null, retrato_flequillo: null },
  challenges: { emoji: '⭐', xp: 10, coins: 5, frequency: 'diario', active: true, profile_id: null, target_roles: null, skill: null, days: null, campana_id: null },
  completions: { status: 'pendiente', resolved_at: null, praise: null },
  rewards: { emoji: '🎁', cost: 50, active: true, tier: 2 },
  redemptions: { status: 'pendiente', resolved_at: null },
  family_goals: { emoji: '🏆', target_xp: 1000, achieved: false, achieved_at: null },
  // `instance_key` con su '' por defecto, igual que en la 030: sin él,
  // la demo dedupe por un juego de claves distinto al de la base.
  profile_badges: { instance_key: '' },
  app_logs: { datos: {} },
  bonuses: { tipo: 'globos', coins: 5 },
  power_uses: { target_id: null, nota: null },
  families: { timezone: 'Europe/Madrid', tipo_gremio: 'familia' },
  push_log: { franja: 'tarde', enviados: 0 },
  plan_diario: { origen: 'patron' },
  push_subs: { activa: true, fallos: 0, ultimo_ok: null },
  campanas_limpieza: { emoji: '🧹', estado: 'activa', cerrada_at: null, activada_por: null },
  zonas_casa: { emoji: '🚪', plantilla: 'generica', tipo: 'comun', dueno: null, orden: 0 },
  informes_fallo: { profile_id: null, pantalla: null, version_app: null, agente: null, huellas: [], estado: 'nuevo' },
  reconocimientos: { tipo: 'gracias', texto: null, completion_id: null },
  // Identidad, pertenencia y expansión.
  pertenencias: { rol: 'miembro', estado: 'activa', hasta: null },
  movimientos_coins: { resultado: 'ok', referencia: null, clave: null, persona: null },
  conversiones: { estado: 'pendiente', persona: null, saldo_local_antes: null, importe: null, saldo_cartera_despues: null, resultado: null, clave: null, resuelta_at: null },
  derechos_expansion: { estado: 'disponible', personaje: null, temporada: null, destino: null, destino_nombre: null, cerrada_at: null, motivo: null },
  invitaciones: { estado: 'pendiente', persona: null, emitida_por: null, emitida_por_personaje: null, resuelta_at: null },
  reclamaciones: { estado: 'pendiente', resuelta_por: null, resuelta_por_personaje: null, resuelta_at: null }
}

/** Columnas de fecha que la base rellena sola, por tabla. */
export const SELLOS_TABLA = {
  profiles: ['created_at'],
  challenges: ['created_at'],
  completions: ['requested_at'],
  rewards: ['created_at'],
  redemptions: ['requested_at'],
  family_goals: ['starts_at'],
  profile_badges: ['earned_at'],
  power_uses: ['used_at'],
  app_logs: ['ts'],
  families: ['created_at'],
  campanas_limpieza: ['created_at'],
  zonas_casa: ['created_at'],
  informes_fallo: ['created_at'],
  reconocimientos: ['created_at'],
  usuarios: ['created_at'],
  credenciales: ['created_at'],
  pertenencias: ['desde'],
  carteras: ['created_at'],
  movimientos_coins: ['created_at'],
  conversiones: ['solicitada_at'],
  derechos_expansion: ['forjada_at'],
  invitaciones: ['emitida_at'],
  reclamaciones: ['solicitada_at']
}

/**
 * Una fila nueva de una tabla: sus valores por defecto, sus sellos de fecha
 * y su identificador. Lo usan el `insert` del constructor de consultas y la
 * capa de RPC, que escribe sin pasar por él.
 */
export function filaNueva(tabla, fila) {
  const ahora = new Date().toISOString()
  const sellos = (SELLOS_TABLA[tabla] || []).reduce((acc, c) => ({ ...acc, [c]: ahora }), {})
  return {
    ...(DEFECTOS_TABLA[tabla] || {}),
    ...sellos,
    ...fila,
    id: fila.id || uuid()
  }
}
