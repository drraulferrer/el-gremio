// ------------------------------------------------------------------
// Backend simulado en memoria (modo demo).
//
// Implementa el subconjunto del cliente de Supabase que usa la app, con
// los datos en localStorage. Sirve para dos cosas honestas:
//  - probar la app entera sin haber creado todavía el proyecto Supabase;
//  - verificar la interfaz en un navegador sin tocar datos reales.
//
// No es un sustituto de Supabase: no hay RLS, ni concurrencia, ni red.
// Se activa solo con la bandera `demo` (VITE_DEMO=1) y nunca debería
// llegar encendido a producción.
// ------------------------------------------------------------------

const CLAVE = 'gremio_demo_db'

const TABLAS = [
  'families',
  'profiles',
  'challenges',
  'completions',
  'rewards',
  'redemptions',
  'family_goals',
  'profile_badges',
  'app_logs'
]

const vacia = () => TABLAS.reduce((acc, t) => ({ ...acc, [t]: [] }), {})

// Valores por defecto de cada tabla, copiados de schema.sql. Sin esto una
// fila recién insertada sale sin `status` y la función que la aprueba no
// la encuentra nunca: el fallo silencioso perfecto.
const DEFECTOS_TABLA = {
  profiles: { emoji: '🙂', color: '#a78bfa', xp: 0, coins: 0, active: true },
  challenges: { emoji: '⭐', xp: 10, coins: 5, frequency: 'diario', active: true, profile_id: null, skill: null },
  completions: { status: 'pendiente', resolved_at: null, praise: null },
  rewards: { emoji: '🎁', cost: 50, active: true, tier: 2 },
  redemptions: { status: 'pendiente', resolved_at: null },
  family_goals: { emoji: '🏆', target_xp: 1000, achieved: false, achieved_at: null },
  profile_badges: {},
  app_logs: { datos: {} },
  families: {}
}

/** Columnas de fecha que la base rellena sola, por tabla. */
const SELLOS_TABLA = {
  profiles: ['created_at'],
  challenges: ['created_at'],
  completions: ['requested_at'],
  rewards: ['created_at'],
  redemptions: ['requested_at'],
  family_goals: ['starts_at'],
  profile_badges: ['earned_at'],
  app_logs: ['ts'],
  families: ['created_at']
}

function leer() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return crudo ? { ...vacia(), ...JSON.parse(crudo) } : vacia()
  } catch {
    return vacia()
  }
}

function escribir(db) {
  localStorage.setItem(CLAVE, JSON.stringify(db))
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

const oyentes = new Set()

function notificar() {
  // Asíncrono a propósito: imita el realtime de Supabase, que nunca
  // responde dentro del mismo tick que la escritura.
  setTimeout(() => oyentes.forEach((fn) => fn({ eventType: 'demo' })), 30)
}

// ------------------------------------------------------------------
// Constructor de consultas encadenables (thenable)
// ------------------------------------------------------------------

class Consulta {
  constructor(tabla) {
    this.tabla = tabla
    this.op = null
    this.filtros = []
    this.orden = null
    this.tope = null
    this.filas = null
    this.cambios = null
    this.retornar = false
    this.unico = false
    this.conflicto = null
    this.ignorarDuplicados = false
  }

  select() {
    if (this.op) this.retornar = true
    else this.op = 'select'
    return this
  }

  insert(filas) {
    this.op = 'insert'
    this.filas = Array.isArray(filas) ? filas : [filas]
    return this
  }

  upsert(filas, opciones = {}) {
    this.op = 'upsert'
    this.filas = Array.isArray(filas) ? filas : [filas]
    this.conflicto = opciones.onConflict || null
    this.ignorarDuplicados = Boolean(opciones.ignoreDuplicates)
    return this
  }

  update(cambios) {
    this.op = 'update'
    this.cambios = cambios
    return this
  }

  delete() {
    this.op = 'delete'
    return this
  }

  eq(columna, valor) {
    this.filtros = [...this.filtros, { columna, valor }]
    return this
  }

  order(columna, opciones = {}) {
    this.orden = { columna, ascendente: opciones.ascending !== false }
    return this
  }

  limit(n) {
    this.tope = n
    return this
  }

  single() {
    this.unico = true
    return this
  }

  then(resolver, rechazar) {
    try {
      resolver(this.ejecutar())
    } catch (err) {
      if (rechazar) rechazar(err)
      else resolver({ data: null, error: { message: err.message } })
    }
  }

  coincide(fila) {
    return this.filtros.every((f) => fila[f.columna] === f.valor)
  }

  ejecutar() {
    const db = leer()
    const tabla = db[this.tabla] || []

    if (this.op === 'select') {
      let filas = tabla.filter((f) => this.coincide(f))
      if (this.orden) {
        const { columna, ascendente } = this.orden
        filas = [...filas].sort((a, b) => {
          const va = a[columna] ?? ''
          const vb = b[columna] ?? ''
          return (va < vb ? -1 : va > vb ? 1 : 0) * (ascendente ? 1 : -1)
        })
      }
      if (this.tope) filas = filas.slice(0, this.tope)
      return { data: this.unico ? filas[0] || null : filas, error: null }
    }

    if (this.op === 'insert' || this.op === 'upsert') {
      const nuevas = []
      const claves = this.conflicto ? this.conflicto.split(',').map((c) => c.trim()) : []
      for (const fila of this.filas) {
        if (this.op === 'upsert' && claves.length) {
          const existe = tabla.some((f) => claves.every((c) => f[c] === fila[c]))
          if (existe && this.ignorarDuplicados) continue
        }
        const ahora = new Date().toISOString()
        const sellos = (SELLOS_TABLA[this.tabla] || []).reduce((acc, c) => ({ ...acc, [c]: ahora }), {})
        nuevas.push({
          ...(DEFECTOS_TABLA[this.tabla] || {}),
          ...sellos,
          ...fila,
          id: fila.id || uuid()
        })
      }
      escribir({ ...db, [this.tabla]: [...tabla, ...nuevas] })
      notificar()
      const salida = this.retornar ? nuevas : null
      return { data: this.unico ? salida?.[0] || null : salida, error: null }
    }

    if (this.op === 'update') {
      const siguientes = tabla.map((f) => (this.coincide(f) ? { ...f, ...this.cambios } : f))
      escribir({ ...db, [this.tabla]: siguientes })
      notificar()
      return { data: null, error: null }
    }

    if (this.op === 'delete') {
      escribir({ ...db, [this.tabla]: tabla.filter((f) => !this.coincide(f)) })
      notificar()
      return { data: null, error: null }
    }

    return { data: null, error: { message: 'operación no soportada en demo' } }
  }
}

// ------------------------------------------------------------------
// Funciones (RPC) equivalentes a las de schema.sql
// ------------------------------------------------------------------

function rpc(nombre, args = {}) {
  const db = leer()

  if (nombre === 'resolve_completion') {
    const c = db.completions.find((x) => x.id === args.c_id && x.status === 'pendiente')
    if (!c) return { data: null, error: null }
    const completions = db.completions.map((x) =>
      x.id === c.id
        ? {
            ...x,
            status: args.new_status,
            resolved_at: new Date().toISOString(),
            praise: (args.praise_text || '').trim() || null
          }
        : x
    )
    const profiles =
      args.new_status === 'aprobado'
        ? db.profiles.map((p) => (p.id === c.profile_id ? { ...p, xp: p.xp + c.xp, coins: p.coins + c.coins } : p))
        : db.profiles
    escribir({ ...db, completions, profiles })
    notificar()
    return { data: null, error: null }
  }

  if (nombre === 'redeem_reward') {
    const rw = db.rewards.find((r) => r.id === args.rw_id && r.active)
    const p = db.profiles.find((x) => x.id === args.p_id)
    if (!rw || !p) return { data: 'no_disponible', error: null }
    if (p.coins < rw.cost) return { data: 'sin_monedas', error: null }
    escribir({
      ...db,
      profiles: db.profiles.map((x) => (x.id === p.id ? { ...x, coins: x.coins - rw.cost } : x)),
      redemptions: [
        ...db.redemptions,
        {
          id: uuid(),
          family_id: rw.family_id,
          reward_id: rw.id,
          profile_id: p.id,
          cost: rw.cost,
          status: 'pendiente',
          requested_at: new Date().toISOString()
        }
      ]
    })
    notificar()
    return { data: 'ok', error: null }
  }

  if (nombre === 'resolve_redemption') {
    const r = db.redemptions.find((x) => x.id === args.r_id && x.status === 'pendiente')
    if (!r) return { data: null, error: null }
    escribir({
      ...db,
      redemptions: db.redemptions.map((x) =>
        x.id === r.id ? { ...x, status: args.new_status, resolved_at: new Date().toISOString() } : x
      ),
      profiles:
        args.new_status === 'cancelado'
          ? db.profiles.map((p) => (p.id === r.profile_id ? { ...p, coins: p.coins + r.cost } : p))
          : db.profiles
    })
    notificar()
    return { data: null, error: null }
  }

  if (nombre === 'health') {
    return {
      data: {
        status: 'ok',
        postgres: 'demo (sin base de datos)',
        ts: new Date().toISOString(),
        familias_visibles: db.families.length,
        pendientes: db.completions.filter((c) => c.status === 'pendiente').length,
        errores_24h: db.app_logs.filter((l) => l.nivel === 'error').length
      },
      error: null
    }
  }

  return { data: null, error: { message: 'función desconocida en demo: ' + nombre } }
}

// ------------------------------------------------------------------
// Cliente
// ------------------------------------------------------------------

const CLAVE_SESION = 'gremio_demo_sesion'

export function crearClienteDemo() {
  const sesionGuardada = () => {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null')
    } catch {
      return null
    }
  }

  let escuchadores = []
  const avisarSesion = (s) => escuchadores.forEach((fn) => fn('DEMO', s))

  return {
    esDemo: true,
    from: (tabla) => new Consulta(tabla),
    rpc: (nombre, args) => Promise.resolve(rpc(nombre, args)),
    channel: () => {
      const handlers = []
      return {
        on(_evento, _filtro, fn) {
          handlers.push(fn)
          oyentes.add(fn)
          return this
        },
        subscribe() {
          return this
        },
        _handlers: handlers
      }
    },
    removeChannel: (canal) => {
      ;(canal?._handlers || []).forEach((fn) => oyentes.delete(fn))
    },
    auth: {
      getSession: async () => ({ data: { session: sesionGuardada() } }),
      getUser: async () => ({ data: { user: sesionGuardada()?.user || null } }),
      onAuthStateChange: (fn) => {
        escuchadores = [...escuchadores, fn]
        return { data: { subscription: { unsubscribe: () => { escuchadores = escuchadores.filter((f) => f !== fn) } } } }
      },
      signInWithPassword: async ({ email }) => {
        const sesion = { user: { id: 'demo-user', email }, demo: true }
        localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
        avisarSesion(sesion)
        return { data: { session: sesion }, error: null }
      },
      signUp: async ({ email }) => {
        const sesion = { user: { id: 'demo-user', email }, demo: true }
        localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
        avisarSesion(sesion)
        return { data: { session: sesion }, error: null }
      },
      signOut: async () => {
        localStorage.removeItem(CLAVE_SESION)
        avisarSesion(null)
        return { error: null }
      }
    }
  }
}

/** Borra todos los datos de la demo. Útil para volver a empezar. */
export function reiniciarDemo() {
  localStorage.removeItem(CLAVE)
  localStorage.removeItem(CLAVE_SESION)
  localStorage.removeItem('gremio_profile')
}
