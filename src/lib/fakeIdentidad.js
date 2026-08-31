// ------------------------------------------------------------------
// Quién es esta sesión, y qué puede · en la demo.
//
// Las primitivas que en `schema.sql` usan casi todas las funciones de las
// fases 3 a 7: `mis_gremios()`, `es_mi_gremio()`, `clase_credencial()`,
// `puede()`, la cartera y `entrar_en_gremio()`. Están aquí y no repetidas
// dentro de cada RPC por lo mismo que allí: si la respuesta a «¿puede esta
// persona?» vive en quince sitios, un día quince sitios dejan de decir lo
// mismo.
//
// La demo no tiene esquema `auth`, así que las cuentas viven en `usuarios`,
// que es su espejo: id, correo y si está confirmado. Lo demás es igual.
// ------------------------------------------------------------------

import { filaNueva, uuid } from './fakeAlmacen'
import { nivelDeXp, permisoDe, plantillaDe } from './fakeCatalogo'

// ------------------------------------------------------------------
// Cuentas
// ------------------------------------------------------------------

/** El correo de una cuenta, en minúsculas. Espejo de `auth.users.email`. */
export function correoDe(db, uid) {
  const u = (db.usuarios || []).find((x) => x.id === uid)
  return u ? String(u.email).toLowerCase() : null
}

export function usuarioPorCorreo(db, correo) {
  const buscado = String(correo || '').trim().toLowerCase()
  return (db.usuarios || []).find((u) => String(u.email).toLowerCase() === buscado) || null
}

/**
 * La cuenta de un correo, creándola si no estaba.
 *
 * El identificador de la PRIMERA es `demo-user`, que es el que la demo usó
 * mientras solo había una cuenta posible. Así una demo de antes de esto
 * —con su gremio, sus misiones y su historial— sigue siendo de quien entre,
 * en vez de quedarse huérfana el día que la sesión pasó a tener identidad.
 */
export function altaDeCuenta(db, correo) {
  const existente = usuarioPorCorreo(db, correo)
  if (existente) return { db, usuario: existente }
  const usuarios = db.usuarios || []
  const usuario = filaNueva('usuarios', {
    id: usuarios.length === 0 ? 'demo-user' : 'demo:' + uuid(),
    email: String(correo || '').trim().toLowerCase(),
    // La demo no manda correos, así que no hay nada que confirmar. Lo que
    // NO se salta es la comprobación: `crear_credencial_compartida` y la
    // conversión siguen mirando esta columna, porque es la trampa que el
    // proyecto ya conoce desde la 047.
    email_confirmed_at: new Date().toISOString()
  })
  return { db: { ...db, usuarios: [...usuarios, usuario] }, usuario }
}

// ------------------------------------------------------------------
// Alcance
// ------------------------------------------------------------------

/** Espejo de `mis_gremios()` (060): las tres puertas, y solo esas tres. */
export function misGremios(db, uid) {
  if (!uid) return new Set()
  const ids = new Set()
  for (const f of db.families || []) if (f.owner === uid) ids.add(f.id)
  for (const c of db.credenciales || []) {
    if (c.user_id === uid && c.clase === 'compartida' && c.family_id && c.activa !== false) {
      ids.add(c.family_id)
    }
  }
  for (const p of db.pertenencias || []) {
    if (p.persona === uid && p.estado === 'activa') ids.add(p.family_id)
  }
  return ids
}

export function esMiGremio(db, uid, familyId) {
  return Boolean(familyId) && misGremios(db, uid).has(familyId)
}

/**
 * Espejo de `clase_credencial()`. Una cuenta sin fila devuelve
 * 'sin_clasificar': existe, no ha fundado nada y todavía no es nada.
 */
export function claseCredencial(db, uid) {
  const c = (db.credenciales || []).find((x) => x.user_id === uid)
  return c ? c.clase : 'sin_clasificar'
}

/**
 * Espejo de `puede()` (054, reescrita en la 060). Devuelve 'no', 'si' o
 * 'pin', y el permiso se comprueba contra la pertenencia activa **en el
 * gremio de la operación**, nunca contra el gremio activo de la sesión.
 */
export function puede(db, uid, familyId, capacidad, profileId = null) {
  if (!uid || !familyId) return 'no'
  const fam = (db.families || []).find((f) => f.id === familyId)
  if (!fam || !fam.tipo_plantilla) return 'no'

  // 1 · Pertenencia activa en ESE gremio.
  const propia = (db.pertenencias || []).find(
    (p) => p.persona === uid && p.family_id === familyId && p.estado === 'activa'
  )
  let rol = propia ? propia.rol : null

  // 2 · O la credencial compartida de ese gremio, y entonces manda el rol
  //     del personaje que se opera. Solo si sigue ACTIVA: una credencial
  //     retirada no autoriza nada.
  if (!rol) {
    const compartida = (db.credenciales || []).find(
      (c) => c.user_id === uid && c.clase === 'compartida' && c.family_id === familyId && c.activa !== false
    )
    if (!compartida) return 'no'
    if (!profileId) return 'no'
    const pr = (db.profiles || []).find(
      (p) => p.id === profileId && p.family_id === familyId && p.active
    )
    if (!pr) return 'no'
    rol = pr.role
  }

  return permisoDe(rol, capacidad)
}

/** La plantilla con la que nació un gremio. Null si es de antes de la 053. */
export function plantillaDeFamilia(db, familyId) {
  const fam = (db.families || []).find((f) => f.id === familyId)
  if (!fam) return null
  return plantillaDe(fam.tipo_plantilla, fam.plantilla_version)
}

// ------------------------------------------------------------------
// La cartera
// ------------------------------------------------------------------

export function saldoDe(db, persona) {
  const c = (db.carteras || []).find((x) => x.persona === persona)
  return c ? c.saldo : 0
}

/** El asiento de un intento que no movió nada. Espejo de `anota_coins()`. */
export function anotaCoins(db, { profileId, tipo, importe, antes, despues, resultado = 'ok', referencia = null, clave = null }) {
  const pr = (db.profiles || []).find((p) => p.id === profileId)
  if (!pr) return db
  return {
    ...db,
    movimientos_coins: [
      ...(db.movimientos_coins || []),
      filaNueva('movimientos_coins', {
        family_id: pr.family_id,
        profile_id: profileId,
        persona: pr.persona || null,
        tipo,
        importe,
        saldo_antes: antes,
        saldo_despues: despues,
        resultado,
        referencia,
        clave
      })
    ]
  }
}

/**
 * Espejo de `mover_cartera()` (051), que es la ÚNICA puerta que mueve
 * carteras: así cada movimiento deja su asiento sin que quince funciones
 * tengan que acordarse de escribirlo.
 *
 * Lanza si el saldo no llega, igual que en Postgres: quien cobra tiene que
 * haber comprobado antes con `saldoDe`.
 */
export function moverCartera(db, { persona, profileId, tipo, importe, referencia = null, clave = null }) {
  if (!persona) throw new Error('mover_cartera sin persona')
  const carteras = db.carteras || []
  const tenia = carteras.some((c) => c.persona === persona)
  const antes = saldoDe(db, persona)
  if (importe === 0) {
    return tenia
      ? { db, saldo: antes }
      : { db: { ...db, carteras: [...carteras, { persona, saldo: 0, created_at: new Date().toISOString() }] }, saldo: 0 }
  }
  const despues = antes + importe
  if (despues < 0) throw new Error('la cartera no llega: ' + antes + ' + ' + importe)

  const siguiente = tenia
    ? carteras.map((c) => (c.persona === persona ? { ...c, saldo: despues } : c))
    : [...carteras, { persona, saldo: despues, created_at: new Date().toISOString() }]

  const pr = (db.profiles || []).find((p) => p.id === profileId)
  return {
    db: {
      ...db,
      carteras: siguiente,
      movimientos_coins: [
        ...(db.movimientos_coins || []),
        filaNueva('movimientos_coins', {
          family_id: pr?.family_id || null,
          profile_id: profileId,
          persona,
          tipo: tipo || 'desconocido',
          importe,
          saldo_antes: antes,
          saldo_despues: despues,
          resultado: 'ok',
          referencia,
          clave
        })
      ]
    },
    saldo: despues
  }
}

/** La cartera vacía de quien todavía no tiene. `on conflict do nothing`. */
export function abrirCartera(db, persona) {
  if ((db.carteras || []).some((c) => c.persona === persona)) return db
  return {
    ...db,
    carteras: [...(db.carteras || []), { persona, saldo: 0, created_at: new Date().toISOString() }]
  }
}

// ------------------------------------------------------------------
// Entrar
// ------------------------------------------------------------------

/**
 * Espejo de `entrar_en_gremio()` (057). Lo común a crear con llave y a
 * aceptar una invitación, escrito una vez.
 *
 * Y aquí vive `R-63`, que es la regla menos evidente: al REINGRESAR no se
 * crea un personaje nuevo, se reactiva el anterior con su XP, su marca de
 * agua, sus insignias y su historial. Sin esto, volver a casa costaría el
 * historial, que es un castigo por marcharse.
 */
export function entrarEnGremio(db, uid, { familyId, rol, origen, personaje }) {
  const plantilla = plantillaDeFamilia(db, familyId)
  const rolPersonaje = plantilla?.roles?.al_fundar || 'adulto'

  const anterior = (db.profiles || []).find((p) => p.family_id === familyId && p.persona === uid)
  let profiles
  let profileId
  if (anterior) {
    profileId = anterior.id
    profiles = db.profiles.map((p) => (p.id === anterior.id ? { ...p, active: true } : p))
  } else {
    // `slice(0, 40)` porque `profiles.name` no admite más: un nombre largo
    // tiene que quedarse corto, no tumbar la entrada al gremio.
    const nuevo = filaNueva('profiles', {
      family_id: familyId,
      name: (String(personaje || '').trim() || 'Yo').slice(0, 40),
      role: rolPersonaje,
      xp: 0,
      xp_maxima: 0,
      coins: 0,
      persona: uid,
      saldo_local_cerrado: true,
      active: true
    })
    profileId = nuevo.id
    profiles = [...(db.profiles || []), nuevo]
  }

  return {
    db: {
      ...db,
      profiles,
      pertenencias: [
        ...(db.pertenencias || []),
        filaNueva('pertenencias', { persona: uid, family_id: familyId, rol, estado: 'activa', origen })
      ]
    },
    profileId
  }
}

/** Cuántas pertenencias activas tiene una persona. Es lo que mide el límite. */
export function pertenenciasActivas(db, persona) {
  return (db.pertenencias || []).filter((p) => p.persona === persona && p.estado === 'activa').length
}

/** El nivel de un personaje, desde la MARCA DE AGUA y no de la XP de hoy. */
export function nivelEnGremio(perfil) {
  return nivelDeXp(Math.max(Number(perfil?.xp_maxima) || 0, Number(perfil?.xp) || 0))
}

// ------------------------------------------------------------------
// Auxiliares que usan las dos mitades de la capa de RPC
// ------------------------------------------------------------------

export const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const ahora = () => new Date().toISOString()

/** El estado VIVO: una pendiente que ya venció se lee como caducada. */
export function estadoVivo(fila) {
  if (fila.estado !== 'pendiente') return fila.estado
  return fila.caduca_at && fila.caduca_at <= ahora() ? 'caducada' : 'pendiente'
}

export function enDias(dias) {
  return new Date(Date.now() + dias * 86400000).toISOString()
}

/**
 * Espejo de `consumir_llave()` (056). Lanza en vez de devolver un código
 * porque su sitio es dentro de una transacción que ya no debe continuar: si
 * falla, la pertenencia y la invitación se deshacen con ella.
 */
export function consumirLlave(db, uid, derechoId, destino, destinoNombre) {
  const d = (db.derechos_expansion || []).find((x) => x.id === derechoId)
  if (!d) throw new Error('llave_no_existe')
  if (d.persona !== uid) throw new Error('llave_ajena')
  if (d.estado !== 'disponible') throw new Error('llave_no_disponible')
  if (!destino) throw new Error('llave_sin_destino')
  return {
    ...db,
    derechos_expansion: db.derechos_expansion.map((x) =>
      x.id === derechoId
        ? { ...x, estado: 'consumido', destino, destino_nombre: destinoNombre, cerrada_at: ahora() }
        : x
    )
  }
}
