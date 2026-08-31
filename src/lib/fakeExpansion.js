// ------------------------------------------------------------------
// Identidad y expansión, en la demo · fases 3 y 5.
//
// La mitad de la capa de RPC que responde a «quién soy y hasta dónde
// llego»: lo que se ve del gremio, lo que se puede gastar, la escalera de
// la expansión, la forja de una llave y el alta de una identidad propia.
//
// La otra mitad —invitar, entrar, salir, reclamar y la clave de casa— vive
// en `fakeRpc.js`, que es además quien despacha las dos.
// ------------------------------------------------------------------

import { filaNueva } from './fakeAlmacen'
import { ESCALONES, PARAMETROS, hitoExpansion, xpDeNivel, nivelDeXp } from './fakeCatalogo'
import {
  CORREO, abrirCartera, ahora, anotaCoins, claseCredencial, correoDe, esMiGremio,
  misGremios, moverCartera, nivelEnGremio, pertenenciasActivas, plantillaDeFamilia,
  saldoDe, usuarioPorCorreo
} from './fakeIdentidad'

// ------------------------------------------------------------------
// Lecturas
// ------------------------------------------------------------------

export function plantillaDeGremio(db, uid) {
  const mios = misGremios(db, uid)
  return (db.families || [])
    .filter((f) => mios.has(f.id))
    .map((f) => ({ f, t: plantillaDeFamilia(db, f.id) }))
    .filter((x) => x.t)
    .map(({ f, t }) => ({
      family_id: f.id,
      tipo: t.tipo,
      version: t.version,
      nombre_visible: t.nombre_visible,
      vocabulario: t.vocabulario,
      roles: t.roles,
      funciones: t.funciones,
      limites: t.limites,
      progreso_individual: t.progreso_individual,
      expansion_desde_tipo: t.expansion_desde_tipo
    }))
}

/**
 * Espejo de `saldos_visibles()` (052). Quien tiene identidad gasta de su
 * cartera; quien no la tiene conserva su saldo local exactamente como hoy.
 */
export function saldosVisibles(db, uid) {
  const mios = misGremios(db, uid)
  return (db.profiles || [])
    .filter((p) => mios.has(p.family_id))
    .map((p) => ({
      profile_id: p.id,
      saldo: p.persona ? saldoDe(db, p.persona) : p.coins
    }))
}

/** Espejo de `mis_pertenencias()` (057): el selector de gremios. */
export function misPertenencias(db, uid) {
  return (db.pertenencias || [])
    .filter((p) => p.persona === uid && p.estado === 'activa')
    .sort((a, b) => (a.desde < b.desde ? -1 : 1))
    .map((p) => {
      const f = (db.families || []).find((x) => x.id === p.family_id) || {}
      const t = plantillaDeFamilia(db, p.family_id)
      const pr = (db.profiles || []).find(
        (x) => x.family_id === p.family_id && x.persona === uid && x.active
      )
      return {
        family_id: p.family_id,
        gremio: f.name || null,
        tipo: f.tipo_plantilla || null,
        tipo_visible: t?.nombre_visible || null,
        zona: f.timezone || null,
        rol: p.rol,
        origen: p.origen,
        desde: p.desde,
        personaje: pr?.id || null,
        personaje_nombre: pr?.name || null,
        nivel: pr ? nivelEnGremio(pr) : null
      }
    })
}

/** Espejo de `mis_llaves()`. Deja fuera `motivo`, que es de soporte. */
export function misLlaves(db, uid) {
  return (db.derechos_expansion || [])
    .filter((d) => d.persona === uid)
    .sort((a, b) => (a.forjada_at > b.forjada_at ? -1 : 1))
    .map((d) => ({
      id: d.id,
      origen: d.origen,
      origen_nombre: d.origen_nombre,
      orden: d.orden,
      temporada: d.temporada,
      coste: d.coste,
      version: d.version,
      estado: d.estado,
      destino_nombre: d.destino_nombre,
      forjada_at: d.forjada_at,
      cerrada_at: d.cerrada_at
    }))
}

// ------------------------------------------------------------------
// Fase 5 · la expansión
// ------------------------------------------------------------------

/**
 * Espejo de `oportunidades_expansion()`. El `estado` responde con la razón
 * PRINCIPAL por la que hoy no se puede, y en el mismo orden que la forja:
 * ya forjada, el tipo no forja, falta nivel, estás en el límite, falta
 * saldo. Si esta pantalla y el servidor no coincidieran, la app diría una
 * cosa y el botón haría otra.
 */
export function oportunidadesExpansion(db, uid, familyId) {
  if (!uid || !familyId) return []
  const dentro = (db.pertenencias || []).some(
    (p) => p.persona === uid && p.family_id === familyId && p.estado === 'activa'
  )
  if (!dentro) return []

  const pr = (db.profiles || []).find(
    (p) => p.family_id === familyId && p.persona === uid && p.active
  )
  if (!pr) return []

  const xp = Math.max(Number(pr.xp_maxima) || 0, Number(pr.xp) || 0)
  const nivel = nivelDeXp(xp)
  const saldo = saldoDe(db, uid)
  // Por plantilla y no por `if tipo === 'equipo'`: es lo que la 053 vino a
  // arreglar, y `R-114` lo pide con ese nombre.
  const forja = Boolean(plantillaDeFamilia(db, familyId)?.expansion_desde_tipo)
  const activas = pertenenciasActivas(db, uid)

  return ESCALONES.map((e) => {
    const yaForjada = (db.derechos_expansion || []).some(
      (d) => d.persona === uid && d.origen === familyId && d.orden === e.orden &&
        (d.estado === 'disponible' || d.estado === 'consumido')
    )
    const estado =
      yaForjada ? 'forjada'
        : !forja ? 'tipo_no_forja'
          : nivel < e.nivel_exigido ? 'falta_nivel'
            : activas >= PARAMETROS.limite_global ? 'en_el_limite'
              : saldo < e.coste ? 'falta_monedas'
                : 'puedes'
    return {
      orden: e.orden,
      nivel_exigido: e.nivel_exigido,
      coste: e.coste,
      nivel_actual: nivel,
      estado,
      falta_xp: Math.max(0, xpDeNivel(e.nivel_exigido) - xp),
      falta_monedas: Math.max(0, e.coste - saldo)
    }
  })
}

/**
 * Espejo de `forjar_llave()`. El orden de las comprobaciones ES la
 * especificación, y por eso va escrito en columna: nada anterior al paso 11
 * toca la cartera. Es lo que quiere decir «no se descuentan monedas por una
 * llave que no se puede usar».
 */
export function forjarLlave(db, uid, { p_family: familyId, p_orden: orden, p_clave: clave }) {
  if (!uid) return { codigo: 'sin_sesion' }
  if (clave != null && (clave.length < 8 || clave.length > 120)) return { codigo: 'clave_invalida' }

  // 2 · Idempotencia, antes de tocar nada: la clave vive en el libro, así
  //     que un doble clic devuelve el resultado del primero.
  if (clave != null) {
    const previo = (db.movimientos_coins || []).find((m) => m.clave === clave)
    if (previo) return { codigo: previo.resultado === 'ok' ? 'ok' : previo.resultado }
  }

  // 3 · Una llave la compra una PERSONA. Una credencial compartida no
  //     forja: no hay a quien cargarle el gasto.
  if (claseCredencial(db, uid) !== 'personal') return { codigo: 'exige_identidad_personal' }

  const dentro = (db.pertenencias || []).some(
    (p) => p.persona === uid && p.family_id === familyId && p.estado === 'activa'
  )
  if (!dentro) return { codigo: 'sin_pertenencia' }

  const pr = (db.profiles || []).find(
    (p) => p.family_id === familyId && p.persona === uid && p.active
  )
  if (!pr) return { codigo: 'sin_personaje' }

  const fam = (db.families || []).find((f) => f.id === familyId)
  if (!plantillaDeFamilia(db, familyId)?.expansion_desde_tipo) return { codigo: 'tipo_no_forja' }

  const h = hitoExpansion(orden)
  if (!h) return { codigo: 'escalon_desconocido' }

  // 7 · El nivel, de la marca de agua.
  if (nivelEnGremio(pr) < h.nivel_exigido) return { codigo: 'nivel_insuficiente' }

  if ((db.derechos_expansion || []).some(
    (d) => d.persona === uid && d.origen === familyId && d.orden === orden &&
      (d.estado === 'disponible' || d.estado === 'consumido')
  )) {
    return { codigo: 'ya_forjado' }
  }

  // 9 y 10 · El límite y el saldo, los dos ANTES de cobrar.
  if (pertenenciasActivas(db, uid) >= PARAMETROS.limite_global) return { codigo: 'en_el_limite' }

  const saldo = saldoDe(db, uid)
  if (saldo < h.coste) {
    // Un intento fallido también es historia: queda asiento con el saldo
    // igual antes y después.
    return {
      codigo: 'sin_monedas',
      db: anotaCoins(db, {
        profileId: pr.id, tipo: 'forja_llave', importe: -h.coste,
        antes: saldo, despues: saldo, resultado: 'sin_monedas', clave
      })
    }
  }

  // La temporada del gremio en ESTE momento (`S-05`): se guarda y no se
  // deriva, porque derivarla después daría la de hoy y no la de entonces.
  const cerradas = (db.family_goals || []).filter((g) => g.family_id === familyId && g.achieved)
  const temporada = Math.max(
    0, ...cerradas.map((g) => Number(g.season_number) || 0), cerradas.length
  ) + 1

  const derecho = filaNueva('derechos_expansion', {
    persona: uid,
    origen: familyId,
    origen_nombre: fam?.name || '',
    personaje: pr.id,
    orden,
    temporada,
    coste: h.coste,
    version: h.version,
    estado: 'disponible'
  })

  const conLlave = { ...db, derechos_expansion: [...(db.derechos_expansion || []), derecho] }
  const { db: cobrado } = moverCartera(conLlave, {
    persona: uid, profileId: pr.id, tipo: 'forja_llave', importe: -h.coste,
    referencia: derecho.id, clave
  })
  return { codigo: 'ok', db: cobrado }
}

// ------------------------------------------------------------------
// Fase 3 · la identidad propia
// ------------------------------------------------------------------

/** Espejo de `solicitar_conversion()` (047): el paso 1 de `F-9`. */
export function solicitarConversion(db, uid, { p_profile: profileId, p_correo, p_pin_hash: pinHash }) {
  if (!uid) return { codigo: 'sin_sesion' }
  const correo = String(p_correo || '').trim().toLowerCase()
  if (!CORREO.test(correo) || correo.length > 254) return { codigo: 'correo_invalido' }

  const pr = (db.profiles || []).find((p) => p.id === profileId && p.active)
  if (!pr) return { codigo: 'no_existe' }
  if (!esMiGremio(db, uid, pr.family_id)) return { codigo: 'no_es_tuyo' }

  // El PIN, que es lo único que demuestra que hay una persona adulta
  // delante. Llega ya resumido, como todo el resto del proyecto.
  const fam = (db.families || []).find((f) => f.id === pr.family_id)
  if (!fam?.parent_pin_hash || !pinHash || pinHash !== fam.parent_pin_hash) {
    return { codigo: 'pin_incorrecto' }
  }

  if (pr.role === 'junior') return { codigo: 'junior_bloqueado' }
  if (pr.role !== 'adulto') return { codigo: 'solo_adulto' }
  if (pr.persona) return { codigo: 'ya_es_persona' }

  // El caso frecuente —quien fundó la casa con su correo personal— se dice
  // con su nombre: es SU casa y su correo, y merece saber que la salida es
  // la migración guiada y no inventarse otro correo.
  const cuenta = usuarioPorCorreo(db, correo)
  if (cuenta) {
    const clase = (db.credenciales || []).find((c) => c.user_id === cuenta.id)
    if (clase?.clase === 'compartida') return { codigo: 'correo_es_la_clave_de_casa' }
    // Cualquier otra: no se dice de quién ni de qué. Un mensaje más concreto
    // convierte esta pantalla en un comprobador de correos dados de alta.
    return { codigo: 'correo_no_disponible' }
  }

  // Las caducadas se retiran antes de mirar si hay una viva, o el índice
  // único deja atrapado a quien se equivocó de correo hace una semana.
  const conversiones = (db.conversiones || []).map((c) =>
    c.estado === 'pendiente' && c.caduca_at < ahora()
      ? { ...c, estado: 'caducada', resultado: 'caducada' }
      : c
  )
  if (conversiones.some((c) => c.estado === 'pendiente' && c.profile_id === profileId)) {
    return { codigo: 'ya_tienes_solicitud' }
  }

  return {
    codigo: 'ok',
    db: {
      ...db,
      conversiones: [
        ...conversiones,
        filaNueva('conversiones', {
          profile_id: profileId,
          family_id: pr.family_id,
          correo,
          estado: 'pendiente',
          caduca_at: new Date(Date.now() + 72 * 3600000).toISOString()
        })
      ]
    }
  }
}

/**
 * Espejo de `completar_conversion()` (047), que es lo que en producción
 * ocurre al volver desde el enlace del correo.
 *
 * En la demo no hay correo, así que la vuelta la hace el ACCESO con la
 * cuenta nueva: entrar con ese correo es el equivalente exacto de haber
 * abierto el enlace. Lo que no se relaja es ninguna comprobación: sigue
 * exigiendo cuenta confirmada, credencial sin clasificar, solicitud viva y
 * personaje libre, y transfiere el saldo por la única puerta que mueve
 * carteras.
 */
export function completarConversion(db, uid, clave = null) {
  if (!uid) return { codigo: 'sin_sesion' }

  if (clave != null && (db.conversiones || []).some(
    (c) => c.clave === clave && c.estado === 'completada' && c.persona === uid
  )) {
    return { codigo: 'ok' }
  }

  const cuenta = (db.usuarios || []).find((u) => u.id === uid)
  if (!cuenta) return { codigo: 'sin_sesion' }
  if (!cuenta.email_confirmed_at) return { codigo: 'correo_sin_confirmar' }
  if ((db.credenciales || []).some((c) => c.user_id === uid)) return { codigo: 'ya_clasificada' }

  const correo = correoDe(db, uid)
  const c = (db.conversiones || []).find(
    (x) => x.correo === correo && x.estado === 'pendiente' && x.caduca_at > ahora()
  )
  if (!c) return { codigo: 'sin_solicitud' }

  const pr = (db.profiles || []).find((p) => p.id === c.profile_id && p.active)
  if (!pr) return { codigo: 'sin_solicitud' }
  if (pr.persona) return { codigo: 'personaje_ocupado' }
  if ((db.profiles || []).some((p) => p.family_id === c.family_id && p.persona === uid)) {
    return { codigo: 'ya_estas_en_el_gremio' }
  }

  const saldo = pr.coins
  let siguiente = {
    ...db,
    // 1 · La identidad. Va primero porque el vínculo exige que la persona
    //     sea de clase personal antes de dejarla entrar en `profiles`.
    credenciales: [
      ...(db.credenciales || []),
      { user_id: uid, clase: 'personal', family_id: null, activa: true, created_at: ahora() }
    ],
    // 2 · La pertenencia. `reclamacion` y no `fundacion`: no crea una
    //     relación nueva, formaliza la de quien ya operaba ese personaje. Y
    //     `gestor` y no `titular`: pertenecer da acceso y gestión, no la
    //     potestad de cerrar el gremio.
    pertenencias: [
      ...(db.pertenencias || []),
      filaNueva('pertenencias', {
        persona: uid, family_id: c.family_id, rol: 'gestor', estado: 'activa', origen: 'reclamacion'
      })
    ],
    profiles: db.profiles.map((p) =>
      p.id === pr.id ? { ...p, persona: uid, coins: 0, saldo_local_cerrado: true } : p
    )
  }
  siguiente = abrirCartera(siguiente, uid)
  // La salida del saldo local deja su asiento, y la entrada en la cartera
  // el suyo: una transferencia entre dos monederos son DOS apuntes, y
  // anotar uno solo ya costó un descuadre.
  if (saldo > 0) {
    siguiente = anotaCoins(siguiente, {
      profileId: pr.id, tipo: 'conversion', importe: -saldo,
      antes: saldo, despues: 0, referencia: c.id
    })
  }
  const movida = moverCartera(siguiente, {
    persona: uid, profileId: pr.id, tipo: 'conversion', importe: saldo, referencia: c.id
  })

  return {
    codigo: 'ok',
    db: {
      ...movida.db,
      conversiones: movida.db.conversiones.map((x) =>
        x.id === c.id
          ? {
              ...x,
              estado: 'completada',
              persona: uid,
              saldo_local_antes: saldo,
              importe: saldo,
              saldo_cartera_despues: movida.saldo,
              resultado: 'ok',
              clave,
              resuelta_at: ahora()
            }
          : x
      )
    }
  }
}
