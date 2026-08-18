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
  'app_logs',
  'bonuses',
  'power_uses',
  'push_log',
  'plan_diario'
]

const vacia = () => TABLAS.reduce((acc, t) => ({ ...acc, [t]: [] }), {})

// Valores por defecto de cada tabla, copiados de schema.sql. Sin esto una
// fila recién insertada sale sin `status` y la función que la aprueba no
// la encuentra nunca: el fallo silencioso perfecto.
const DEFECTOS_TABLA = {
  profiles: { emoji: '🙂', color: '#a78bfa', xp: 0, coins: 0, active: true, gender: 'neutro' },
  challenges: { emoji: '⭐', xp: 10, coins: 5, frequency: 'diario', active: true, profile_id: null, target_roles: null, skill: null, days: null },
  completions: { status: 'pendiente', resolved_at: null, praise: null },
  rewards: { emoji: '🎁', cost: 50, active: true, tier: 2 },
  redemptions: { status: 'pendiente', resolved_at: null },
  family_goals: { emoji: '🏆', target_xp: 1000, achieved: false, achieved_at: null },
  profile_badges: {},
  app_logs: { datos: {} },
  bonuses: { tipo: 'globos', coins: 5 },
  power_uses: { target_id: null, nota: null },
  families: { timezone: 'Europe/Madrid' },
  push_log: { franja: 'tarde', enviados: 0 },
  plan_diario: { origen: 'patron' }
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
  power_uses: ['used_at'],
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
    this.rangos = []
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

  // Solo lo básico que usa la app (la carga del plan filtra por fecha
  // mínima). Comparar cadenas ISO 'YYYY-MM-DD' con >= funciona porque el
  // orden lexicográfico coincide con el cronológico.
  gte(columna, valor) {
    this.rangos = [...this.rangos, { columna, valor }]
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
    return this.filtros.every((f) => fila[f.columna] === f.valor) &&
      this.rangos.every((r) => (fila[r.columna] ?? '') >= r.valor)
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

  // Espejo de grant_daily_bonus (migración 012). El tope de una vez al día
  // se replica aquí a propósito: en producción lo garantiza un índice
  // único, y si el modo demo no lo imitara, el juego de globos se
  // probaría en un mundo donde se puede cobrar quince veces seguidas y el
  // fallo solo aparecería con datos reales.
  if (nombre === 'grant_daily_bonus') {
    const p = db.profiles.find((x) => x.id === args.p_id && x.active !== false)
    if (!p) return { data: 'no_existe', error: null }
    const tipo = args.p_tipo || 'globos'
    // Con ceros, igual que un `date` de Postgres: si el demo usara otro
    // formato, la comparación con el día de hoy funcionaría aquí y
    // fallaría en producción, que es el peor sitio para enterarse.
    const dia = new Date().toLocaleDateString('sv-SE')
    const bonuses = db.bonuses || []
    if (bonuses.some((b) => b.profile_id === p.id && b.dia === dia && b.tipo === tipo)) {
      return { data: 'ya_hoy', error: null }
    }
    const monedas = 5
    escribir({
      ...db,
      bonuses: [...bonuses, { id: uuid(), family_id: p.family_id, profile_id: p.id, dia, tipo, coins: monedas }],
      profiles: db.profiles.map((x) => (x.id === p.id ? { ...x, coins: x.coins + monedas } : x))
    })
    notificar()
    return { data: 'ok', error: null }
  }

  // Espejo de grant_manual_bonus (migración 014). Se replican las tres
  // reglas, no solo el efecto: sin motivo no entra, sin adulto que lo
  // conceda tampoco, y la XP no se toca. Un demo más permisivo que la
  // producción sirve para probar exactamente lo que no va a pasar.
  if (nombre === 'grant_manual_bonus') {
    const monedas = Number(args.p_coins)
    if (!monedas || monedas <= 0 || monedas > 200) return { data: 'cantidad_invalida', error: null }
    if (!String(args.p_motivo || '').trim() || String(args.p_motivo).trim().length < 3) {
      return { data: 'sin_motivo', error: null }
    }
    const p = db.profiles.find((x) => x.id === args.p_id && x.active !== false)
    if (!p) return { data: 'no_existe', error: null }
    const quien = db.profiles.find((x) => x.id === args.p_otorgado_por && x.active !== false)
    if (!quien || quien.family_id !== p.family_id) return { data: 'quien_no_existe', error: null }
    if (quien.role !== 'adulto') return { data: 'no_es_adulto', error: null }

    escribir({
      ...db,
      bonuses: [
        ...(db.bonuses || []),
        {
          id: uuid(),
          family_id: p.family_id,
          profile_id: p.id,
          dia: new Date().toLocaleDateString('sv-SE'),
          tipo: 'manual',
          coins: monedas,
          motivo: String(args.p_motivo).trim(),
          otorgado_por: quien.id,
          created_at: new Date().toISOString()
        }
      ],
      // Solo monedas: la XP se queda igual, igual que en Postgres.
      profiles: db.profiles.map((x) => (x.id === p.id ? { ...x, coins: x.coins + monedas } : x))
    })
    notificar()
    return { data: 'ok', error: null }
  }

  // Espejo de spend_power (migración 015). Lo importante que hay que
  // imitar es que el uso se cuenta CONTRA LO GUARDADO y no contra un
  // contador en memoria: si el demo dejara gastar infinitas veces
  // recargando, el bug solo aparecería con la familia delante.
  if (nombre === 'spend_power') {
    if (!['salva_racha', 'asigna_tarea'].includes(args.p_tipo)) {
      return { data: 'poder_no_gastable', error: null }
    }
    const p = db.profiles.find((x) => x.id === args.p_id && x.active !== false)
    if (!p) return { data: 'no_existe', error: null }

    const ganada = (db.profile_badges || []).find((b) => b.profile_id === p.id && b.code === args.p_code)
    if (!ganada) return { data: 'no_la_tienes', error: null }

    if (args.p_dias != null) {
      const caduca = new Date(ganada.earned_at).getTime() + Math.min(Number(args.p_dias), 90) * 86400000
      if (Date.now() > caduca) return { data: 'sin_usos', error: null }
    }

    const usados = (db.power_uses || []).filter((u) => u.profile_id === p.id && u.code === args.p_code).length
    if (usados >= Math.min(Number(args.p_usos) || 0, 5)) return { data: 'sin_usos', error: null }

    let challenges = db.challenges
    if (args.p_tipo === 'asigna_tarea') {
      if (!args.p_target) return { data: 'sin_destino', error: null }
      if (args.p_target === p.id) return { data: 'a_ti_no', error: null }
      const destino = db.profiles.find((x) => x.id === args.p_target && x.active !== false && x.family_id === p.family_id)
      if (!destino) return { data: 'destino_no_existe', error: null }
      if (String(args.p_nota || '').trim().length < 3) return { data: 'sin_encargo', error: null }
      challenges = [
        ...db.challenges,
        {
          id: uuid(),
          family_id: p.family_id,
          profile_id: destino.id,
          title: String(args.p_nota).trim().slice(0, 80),
          emoji: '📣',
          xp: 10,
          coins: 5,
          frequency: 'unico',
          skill: 'cooperacion',
          target_roles: null,
          active: true,
          created_at: new Date().toISOString()
        }
      ]
    }

    escribir({
      ...db,
      challenges,
      power_uses: [
        ...(db.power_uses || []),
        {
          id: uuid(),
          family_id: p.family_id,
          profile_id: p.id,
          code: args.p_code,
          tipo: args.p_tipo,
          target_id: args.p_target || null,
          nota: String(args.p_nota || '').trim() || null,
          used_at: new Date().toISOString()
        }
      ]
    })
    notificar()
    return { data: 'ok', error: null }
  }

  // Espejo de claim_streak (migración 016). Se replica también la
  // comprobación de la racha, no solo el pago: un demo que paga sin mirar
  // haría imposible descubrir aquí el fallo que sí aparecería en casa.
  if (nombre === 'claim_streak') {
    const IMPORTES = { 3: 5, 7: 15, 14: 25, 21: 40, 30: 60, 50: 100, 100: 200 }
    const coins = IMPORTES[args.p_hito]
    if (!coins) return { data: 'hito_invalido', error: null }

    const p = db.profiles.find((x) => x.id === args.p_id && x.active !== false)
    if (!p) return { data: 'no_existe', error: null }

    const clave = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    const dias = new Set([
      ...db.completions
        .filter((c) => c.profile_id === p.id && c.status === 'aprobado' && c.resolved_at)
        .map((c) => clave(new Date(c.resolved_at))),
      ...(db.power_uses || [])
        .filter((u) => u.profile_id === p.id && u.tipo === 'salva_racha')
        .map((u) => clave(new Date(u.used_at)))
    ])

    const cursor = new Date()
    if (!dias.has(clave(cursor))) cursor.setDate(cursor.getDate() - 1)
    let racha = 0
    while (dias.has(clave(cursor)) && racha < 400) {
      racha++
      cursor.setDate(cursor.getDate() - 1)
    }
    if (racha < args.p_hito) return { data: 'aun_no', error: null }

    const tipo = 'racha:' + args.p_hito
    if ((db.bonuses || []).some((b) => b.profile_id === p.id && b.tipo === tipo)) {
      return { data: 'ya_cobrado', error: null }
    }

    escribir({
      ...db,
      bonuses: [
        ...(db.bonuses || []),
        {
          id: uuid(),
          family_id: p.family_id,
          profile_id: p.id,
          dia: new Date().toLocaleDateString('sv-SE'),
          tipo,
          coins,
          motivo: 'Racha de ' + args.p_hito + ' días',
          created_at: new Date().toISOString()
        }
      ],
      profiles: db.profiles.map((x) => (x.id === p.id ? { ...x, coins: x.coins + coins } : x))
    })
    notificar()
    return { data: 'ok', error: null }
  }

  // Espejo de delete_my_account (migración 018). En demo no hay cuenta de
  // autenticación que borrar, así que se vacía el almacén entero: es el
  // equivalente exacto de lo que ve la familia, y además deja la demo
  // lista para volver a empezar.
  if (nombre === 'delete_my_account') {
    const habia = db.families.length
    escribir(TABLAS.reduce((acc, t) => ({ ...acc, [t]: [] }), {}))
    notificar()
    return { data: habia ? 'ok' : 'ok_sin_gremio', error: null }
  }

  if (nombre === 'undo_completion') {
    const c = db.completions.find((x) => x.id === args.c_id)
    if (!c) return { data: 'no_existe', error: null }
    const profiles =
      c.status === 'aprobado'
        ? db.profiles.map((p) =>
            p.id === c.profile_id
              ? { ...p, xp: Math.max(0, p.xp - c.xp), coins: Math.max(0, p.coins - c.coins) }
              : p
          )
        : db.profiles
    escribir({ ...db, profiles, completions: db.completions.filter((x) => x.id !== c.id) })
    notificar()
    return { data: 'ok', error: null }
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
  // La demo se trastea desde la consola del navegador, y hasta ahora eso
  // significaba editar `localStorage` a mano. `reiniciarDemo` existía
  // exportada y sin llamarla nadie, o sea, inalcanzable justo desde el
  // único sitio donde sirve. Aquí queda a un `gremio.reiniciar()`.
  if (typeof window !== 'undefined') {
    window.gremio = { reiniciar: () => { reiniciarDemo(); location.reload() }, volcar: leer }
  }

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
      },
      // La demo no manda correos, pero tiene que RESPONDER: sin estos dos
      // métodos, pulsar «He olvidado la contraseña» en modo demo revienta
      // con un TypeError, que es justo el bug que ya se coló una vez con
      // el `grant_manual_bonus` que faltaba aquí.
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ data: { user: sesionGuardada()?.user || null }, error: null })
    }
  }
}

/**
 * Equivalente al UPDATE de migracion-007: pasa los títulos literales a la
 * forma con marcas de género. Lo llama la propia demo al arrancar para no
 * quedarse con datos de antes del cambio.
 */
export function migrarTitulosDemo() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return 0
    const db = JSON.parse(crudo)
    const mapa = {
      'Vestirse sola': 'Vestirse {solo|sola|sin ayuda}',
      'Vestirse solo': 'Vestirse {solo|sola|sin ayuda}',
      'Resolver un problema sola': 'Resolver un problema {solo|sola|sin ayuda}',
      'Resolver un problema solo': 'Resolver un problema {solo|sola|sin ayuda}'
    }
    let cambiados = 0
    const challenges = (db.challenges || []).map((c) => {
      if (!mapa[c.title]) return c
      cambiados++
      return { ...c, title: mapa[c.title] }
    })
    if (cambiados) escribir({ ...db, challenges })
    return cambiados
  } catch {
    return 0
  }
}

/** Borra todos los datos de la demo. Útil para volver a empezar. */
export function reiniciarDemo() {
  localStorage.removeItem(CLAVE)
  localStorage.removeItem(CLAVE_SESION)
  localStorage.removeItem('gremio_profile')
}
