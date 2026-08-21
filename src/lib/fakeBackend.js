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
  'plan_diario',
  // Sin esta tabla el recordatorio de avisos del panel revienta en modo
  // demo mientras en producción funciona: la peor combinación, porque la
  // demo es justo donde se prueba.
  'push_subs',
  'campanas_limpieza',
  'zonas_casa',
  'informes_fallo'
]

const vacia = () => TABLAS.reduce((acc, t) => ({ ...acc, [t]: [] }), {})

// Valores por defecto de cada tabla, copiados de schema.sql. Sin esto una
// fila recién insertada sale sin `status` y la función que la aprueba no
// la encuentra nunca: el fallo silencioso perfecto.
// Coherencia de especie, copiada de `profiles_especie_coherente` (027).
//
// Está aquí porque su ausencia dejó pasar un fallo hasta producción: el
// onboarding ofrecía el rol «mascota» sin pedir especie, en demo se creaba
// tan campante y en Postgres la fila entera se caía. Un demo más
// permisivo que la base es peor que no tener demo: da luz verde a lo que
// va a romperse en casa de alguien.
function especieCoherente(fila) {
  return fila.role === 'mascota'
    ? fila.species === 'perro' || fila.species === 'gato'
    : fila.species === null || fila.species === undefined
}

const DEFECTOS_TABLA = {
  profiles: { emoji: '🙂', color: '#a78bfa', xp: 0, coins: 0, active: true, gender: 'neutro' },
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
  informes_fallo: { profile_id: null, pantalla: null, version_app: null, agente: null, huellas: [], estado: 'nuevo' }
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
  families: ['created_at'],
  campanas_limpieza: ['created_at'],
  zonas_casa: ['created_at'],
  informes_fallo: ['created_at']
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

  // `in` existe porque la pantalla de Estado pide los registros de dos
  // niveles a la vez. Sin esto, la llamada revienta con «this.in is not
  // a function» SOLO en demo: producción funciona y la demo miente
  // diciendo que no hay errores, que es la peor combinación posible y
  // ya pasó una vez con `grant_manual_bonus`.
  in(columna, valores) {
    this.conjuntos = [...(this.conjuntos || []), { columna, valores: [...valores] }]
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

  // Paginación, para el historial completo que evalúa los sellos
  // (`sellos-carga.js`). Ambos extremos van INCLUIDOS, como en PostgREST:
  // `range(0, 999)` son mil filas, no 999. Sin esto la demo devolvía el
  // historial entero en la primera página, el cargador veía menos filas
  // que el tamaño de página, daba por bueno el final y por casualidad
  // acertaba... hasta la primera familia de demo con más de mil.
  range(desde, hasta) {
    this.desde = desde
    this.hasta = hasta
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
      this.rangos.every((r) => (fila[r.columna] ?? '') >= r.valor) &&
      (this.conjuntos || []).every((c) => c.valores.includes(fila[c.columna]))
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
      if (this.desde !== undefined) filas = filas.slice(this.desde, this.hasta + 1)
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
        const nueva = {
          ...(DEFECTOS_TABLA[this.tabla] || {}),
          ...sellos,
          ...fila,
          id: fila.id || uuid()
        }
        // Igual que Postgres: la fila entera se cae, no se guarda a
        // medias. El mensaje imita al de la base para que quien lo lea en
        // demo reconozca el de producción.
        // Espejo de `tg_completion_snapshot` (migración 029). Sin esto,
        // la demo guardaría completaciones sin contexto congelado y los
        // sellos de oficio se calcularían por el respaldo en vez de por
        // el camino real: se probaría una cosa y se publicaría otra.
        if (this.tabla === 'completions') {
          const reto = (db.challenges || []).find((c) => c.id === nueva.challenge_id)
          nueva.snapshot_title = nueva.snapshot_title ?? (reto?.title || '').slice(0, 160)
          nueva.snapshot_skill = nueva.snapshot_skill ?? reto?.skill ?? null
          nueva.snapshot_frequency = nueva.snapshot_frequency ?? reto?.frequency ?? null
          nueva.snapshot_mission_family_id =
            nueva.snapshot_mission_family_id ?? reto?.mission_family_id ?? null
          nueva.snapshot_xp = nueva.snapshot_xp ?? nueva.xp
          nueva.snapshot_coins = nueva.snapshot_coins ?? nueva.coins
          nueva.snapshot_quality = nueva.snapshot_quality ?? (reto ? 'native' : 'legacy_current_state')
          // El nivel de ayuda solo cuenta si la misión lo registra.
          if (nueva.assistance_level && !reto?.track_assistance) nueva.assistance_level = null
        }

        // Y de `tg_challenge_familia`: toda misión nace con familia.
        if (this.tabla === 'challenges' && !nueva.mission_family_id) {
          nueva.mission_family_id = `mf:${nueva.id}`
        }

        if (this.tabla === 'profiles' && !especieCoherente(nueva)) {
          return {
            data: null,
            error: {
              message:
                'new row for relation "profiles" violates check constraint "profiles_especie_coherente"'
            }
          }
        }
        nuevas.push(nueva)
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

  // Espejo de crear_campana_limpieza (migración 031). Se replican las
  // reglas, no solo el efecto: sin adulto no se lanza, con una activa no
  // entra otra, y las tareas fuera de tope rebotan enteras. Un demo más
  // permisivo que la base da luz verde a lo que va a romperse en casa.
  if (nombre === 'crear_campana_limpieza') {
    const quien = db.profiles.find((x) => x.id === args.p_activada_por && x.active !== false)
    if (!quien) return { data: 'quien_no_existe', error: null }
    if (quien.role !== 'adulto') return { data: 'no_es_adulto', error: null }
    if (!['blitz', 'zona', 'profunda'].includes(args.p_tipo)) return { data: 'tipo_invalido', error: null }
    const dias = Number(args.p_dias)
    if (!Number.isInteger(dias) || dias < 1 || dias > 30) return { data: 'duracion_invalida', error: null }
    const titulo = String(args.p_titulo || '').trim()
    if (titulo.length < 3 || titulo.length > 120) return { data: 'titulo_invalido', error: null }
    const tareas = args.p_tareas
    if (!Array.isArray(tareas) || tareas.length < 1 || tareas.length > 40) return { data: 'sin_tareas', error: null }
    const campanas = db.campanas_limpieza || []
    if (campanas.some((c) => c.family_id === quien.family_id && c.estado === 'activa')) {
      return { data: 'ya_hay_activa', error: null }
    }
    // Todo o nada, igual que la transacción de Postgres.
    for (const t of tareas) {
      const tit = String(t.title || '').trim()
      if (tit.length < 3 || tit.length > 120) return { data: 'tarea_invalida', error: null }
      if (!Number.isInteger(t.xp) || t.xp < 1 || t.xp > 60) return { data: 'tarea_invalida', error: null }
      if (!Number.isInteger(t.coins) || t.coins < 1 || t.coins > 40) return { data: 'tarea_invalida', error: null }
      const p = db.profiles.find((x) => x.id === t.profile_id)
      if (!p || p.family_id !== quien.family_id || p.active === false || p.role === 'mascota') {
        return { data: 'tarea_invalida', error: null }
      }
    }
    const hoy = new Date()
    const fin = new Date(hoy.getTime() + (dias - 1) * 86400000)
    const idCampana = uuid()
    const ahora = new Date().toISOString()
    const campana = {
      id: idCampana,
      family_id: quien.family_id,
      tipo: args.p_tipo,
      clave: String(args.p_clave || args.p_tipo).slice(0, 80),
      titulo,
      emoji: args.p_emoji || '🧹',
      empieza: hoy.toLocaleDateString('sv-SE'),
      termina: fin.toLocaleDateString('sv-SE'),
      estado: 'activa',
      activada_por: quien.id,
      cerrada_at: null,
      created_at: ahora
    }
    const nuevas = tareas.map((t) => ({
      id: uuid(),
      family_id: quien.family_id,
      profile_id: t.profile_id,
      title: String(t.title).trim(),
      emoji: t.emoji || '🧹',
      xp: t.xp,
      coins: t.coins,
      frequency: 'unico',
      skill: 'hogar',
      target_roles: null,
      days: null,
      active: true,
      campana_id: idCampana,
      // Igual que el insert normal del demo: toda misión nace con familia
      // (espejo de tg_challenge_familia, 028).
      mission_family_id: null,
      created_at: ahora
    }))
    nuevas.forEach((ch) => { ch.mission_family_id = `mf:${ch.id}` })
    escribir({
      ...db,
      campanas_limpieza: [...campanas, campana],
      challenges: [...db.challenges, ...nuevas]
    })
    notificar()
    return { data: 'ok', error: null }
  }

  // Espejo de cerrar_campana_limpieza (migración 031). El desenlace lo
  // decide el estado guardado, no el botón: botín si está completa,
  // expiración si venció, y 'aun_no' si sigue en plazo.
  if (nombre === 'cerrar_campana_limpieza') {
    const campana = (db.campanas_limpieza || []).find((c) => c.id === args.p_campana)
    if (!campana) return { data: 'no_existe', error: null }
    const quien = db.profiles.find((x) => x.id === args.p_quien && x.active !== false)
    if (!quien || quien.family_id !== campana.family_id) return { data: 'quien_no_existe', error: null }
    if (quien.role !== 'adulto') return { data: 'no_es_adulto', error: null }
    if (campana.estado !== 'activa') return { data: 'ya_cerrada', error: null }

    const misiones = db.challenges.filter((ch) => ch.campana_id === campana.id)
    const aprobada = (ch) =>
      db.completions.some((co) => co.challenge_id === ch.id && co.status === 'aprobado')
    const completa = misiones.length > 0 && misiones.every(aprobada)
    const hoy = new Date().toLocaleDateString('sv-SE')

    if (completa) {
      // La misma cuenta que botinPrevisto: la mitad de lo aprobado por
      // participante, hacia abajo.
      const ids = new Set(misiones.map((ch) => ch.id))
      const ganado = new Map()
      for (const co of db.completions) {
        if (co.status !== 'aprobado' || !ids.has(co.challenge_id)) continue
        ganado.set(co.profile_id, (ganado.get(co.profile_id) || 0) + (co.coins || 0))
      }
      const bonuses = [...(db.bonuses || [])]
      let profiles = db.profiles
      for (const [profileId, coins] of ganado) {
        const botin = Math.floor(coins / 2)
        if (botin <= 0) continue
        bonuses.push({
          id: uuid(),
          family_id: campana.family_id,
          profile_id: profileId,
          dia: hoy,
          tipo: 'limpieza:' + campana.id,
          coins: botin,
          motivo: 'Botín de «' + campana.titulo + '»',
          otorgado_por: quien.id,
          created_at: new Date().toISOString()
        })
        profiles = profiles.map((x) => (x.id === profileId ? { ...x, coins: x.coins + botin } : x))
      }
      escribir({
        ...db,
        bonuses,
        profiles,
        campanas_limpieza: db.campanas_limpieza.map((c) =>
          c.id === campana.id ? { ...c, estado: 'completada', cerrada_at: new Date().toISOString() } : c
        )
      })
      notificar()
      return { data: 'ok', error: null }
    }

    if (hoy > campana.termina) {
      escribir({
        ...db,
        challenges: db.challenges.map((ch) =>
          ch.campana_id === campana.id && !aprobada(ch) ? { ...ch, active: false } : ch
        ),
        campanas_limpieza: db.campanas_limpieza.map((c) =>
          c.id === campana.id ? { ...c, estado: 'expirada', cerrada_at: new Date().toISOString() } : c
        )
      })
      notificar()
      return { data: 'expirada', error: null }
    }

    return { data: 'aun_no', error: null }
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
    // Espejo del guardarraíl de la 031: una tarea de una operación de
    // limpieza ya COMPLETADA no se deshace, porque su botín se repartió
    // contándola. Sin este espejo, en demo se podría deshacer lo que en
    // producción rebota, que es la trampa clásica del §7.
    const reto = db.challenges.find((ch) => ch.id === c.challenge_id)
    if (reto?.campana_id) {
      const campana = (db.campanas_limpieza || []).find((x) => x.id === reto.campana_id)
      if (campana?.estado === 'completada') return { data: 'campana_cerrada', error: null }
    }
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
