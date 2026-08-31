// ------------------------------------------------------------------
// La capa de RPC de las fases 3 a 7, en la demo.
//
// Hasta hoy el backend simulado solo conocía las funciones de la economía
// —validar, canjear, bonificar, limpiar— y contestaba «función desconocida»
// a las veintisiete de identidad, expansión, invitación y reclamación. Eso
// dejaba media aplicación sin poder verse funcionando en el navegador, que
// es donde este proyecto ha cazado sus tres bugs más caros.
//
// La regla de siempre, y aquí más que en ningún sitio: **una demo más
// permisiva que la base es peor que no tener demo**. Así que lo que se
// copia son las COMPROBACIONES en su orden, no solo el efecto. Un botón que
// aquí funciona y en casa de alguien rebota es exactamente lo que esto
// viene a impedir.
//
// Lo único que la demo no puede imitar es el correo: no hay buzón al que
// escribir. Se dice dónde afecta —el alta de una identidad— y se resuelve
// sin relajar ninguna regla, solo el transporte.
//
// Aquí viven las fases 6 y 7 —invitar, entrar, salir, reclamar y la clave
// de casa— y el despachador de todas. Las fases 3 y 5 están en
// `fakeExpansion.js`, y las primitivas que comparten, en `fakeIdentidad.js`.
// ------------------------------------------------------------------

import { escribir, filaNueva, leer, notificar, uidActual } from './fakeAlmacen'
import { PARAMETROS, tipoPublicado, tiposOfrecidos } from './fakeCatalogo'
import {
  CORREO, abrirCartera, ahora, anotaCoins, claseCredencial, consumirLlave,
  correoDe, enDias, entrarEnGremio, esMiGremio, estadoVivo, moverCartera,
  pertenenciasActivas, plantillaDeFamilia, puede, usuarioPorCorreo
} from './fakeIdentidad'
import {
  completarConversion, forjarLlave, misLlaves, misPertenencias,
  oportunidadesExpansion, plantillaDeGremio, saldosVisibles, solicitarConversion
} from './fakeExpansion'

// ------------------------------------------------------------------
// Fase 6 · gremios múltiples
// ------------------------------------------------------------------

function crearGremioConLlave(db, uid, a) {
  const nombre = String(a.p_nombre || '').trim()
  const pais = String(a.p_pais || '').trim().toUpperCase()

  if (!uid) return { fila: { resultado: 'sin_sesion', family_id: null } }
  if (claseCredencial(db, uid) !== 'personal') {
    return { fila: { resultado: 'exige_identidad_personal', family_id: null } }
  }
  if (nombre.length < 2 || nombre.length > 60) {
    return { fila: { resultado: 'nombre_invalido', family_id: null } }
  }
  if (!a.p_pin_hash || String(a.p_pin_hash).trim().length < 8) {
    return { fila: { resultado: 'pin_invalido', family_id: null } }
  }
  if (!/^[A-Z]{2}$/.test(pais)) return { fila: { resultado: 'pais_invalido', family_id: null } }

  // El tipo tiene que estar OFRECIDO y además PUBLICADO para ese país.
  const ofrecido = tiposOfrecidos().find((t) => t.tipo === a.p_tipo)
  if (!ofrecido) return { fila: { resultado: 'tipo_no_ofrecido', family_id: null } }
  if (!tipoPublicado(a.p_tipo, pais)) {
    return { fila: { resultado: 'tipo_no_publicado_ahi', family_id: null } }
  }

  // La columna vieja, que solo conoce dos valores: mientras `tipo_gremio`
  // exista, un tipo sin equivalente ahí no se puede crear.
  const tipoGremio = a.p_tipo === 'hogar' ? 'familia' : a.p_tipo === 'hogar_compartido' ? 'piso' : null
  if (!tipoGremio) return { fila: { resultado: 'tipo_no_ofrecido', family_id: null } }

  if (pertenenciasActivas(db, uid) + 1 > PARAMETROS.limite_global) {
    return { fila: { resultado: 'en_el_limite', family_id: null } }
  }

  const llave = (db.derechos_expansion || []).find((d) => d.id === a.p_llave)
  if (!llave) return { fila: { resultado: 'llave_no_existe', family_id: null } }
  if (llave.persona !== uid) return { fila: { resultado: 'llave_ajena', family_id: null } }
  if (llave.estado !== 'disponible') return { fila: { resultado: 'llave_no_disponible', family_id: null } }

  const nuevo = filaNueva('families', {
    owner: uid,
    name: nombre,
    parent_pin_hash: a.p_pin_hash,
    tipo_gremio: tipoGremio,
    tipo_plantilla: a.p_tipo,
    plantilla_version: ofrecido.version,
    pais,
    pais_declarado_at: ahora(),
    pais_declarado_por: uid
  })

  let siguiente = { ...db, families: [...(db.families || []), nuevo] }
  // Espejo de `tg_credencial_de_gremio`, con su `do nothing`: quien funda
  // con llave ya es personal, y reescribirlo a compartida sería justo el
  // accidente que la clave primaria impide.
  if (!(siguiente.credenciales || []).some((c) => c.user_id === uid)) {
    siguiente = {
      ...siguiente,
      credenciales: [
        ...(siguiente.credenciales || []),
        { user_id: uid, clase: 'compartida', family_id: nuevo.id, activa: true, created_at: ahora() }
      ]
    }
  }

  // Titular: lo fundó esta persona, y cerrar o traspasar es suyo.
  siguiente = entrarEnGremio(siguiente, uid, {
    familyId: nuevo.id, rol: 'titular', origen: 'llave', personaje: a.p_personaje
  }).db
  siguiente = consumirLlave(siguiente, uid, llave.id, nuevo.id, nombre)

  return { fila: { resultado: 'ok', family_id: nuevo.id }, db: siguiente }
}

function invitar(db, uid, { p_family: familyId, p_correo, p_profile: profileId }) {
  if (!uid) return { codigo: 'sin_sesion' }
  if (!esMiGremio(db, uid, familyId)) return { codigo: 'no_es_tuyo' }
  // `CAP-01`, y no una etiqueta (054).
  if (puede(db, uid, familyId, 'CAP-01', profileId) === 'no') return { codigo: 'no_puede' }

  const correo = String(p_correo || '').trim().toLowerCase()
  if (!CORREO.test(correo)) return { codigo: 'correo_invalido' }

  const invitado = usuarioPorCorreo(db, correo)
  if (invitado && (db.pertenencias || []).some(
    (p) => p.persona === invitado.id && p.family_id === familyId && p.estado === 'activa'
  )) {
    return { codigo: 'ya_esta_dentro' }
  }

  // El tope de gente sale de la PLANTILLA. Si no lo declara, no hay tope:
  // un 8 escrito aquí sería otra constante repartida, que es justo lo que
  // la 053 vino a retirar.
  const tope = plantillaDeFamilia(db, familyId)?.limites?.miembros_humanos
  if (tope != null) {
    const dentro = (db.profiles || []).filter(
      (p) => p.family_id === familyId && p.active && p.role !== 'mascota'
    ).length
    if (dentro >= Number(tope)) return { codigo: 'gremio_lleno' }
  }

  if ((db.invitaciones || []).some(
    (i) => i.family_id === familyId && i.correo === correo && i.estado === 'pendiente'
  )) {
    // No es un fallo: el estado que se pedía ya existe.
    return { codigo: 'ya_invitada' }
  }

  return {
    codigo: 'ok',
    db: {
      ...db,
      invitaciones: [
        ...(db.invitaciones || []),
        filaNueva('invitaciones', {
          family_id: familyId,
          correo,
          emitida_por: uid,
          emitida_por_personaje: profileId || null,
          estado: 'pendiente',
          caduca_at: enDias(PARAMETROS.invitacion_dias)
        })
      ]
    }
  }
}

/** La bandeja es DE LA PERSONA y no del gremio activo (`F-2` paso 3). */
function misInvitaciones(db, uid) {
  const correo = correoDe(db, uid)
  if (!correo) return []
  return (db.invitaciones || [])
    .filter((i) => i.correo === correo)
    .sort((a, b) => (a.emitida_at > b.emitida_at ? -1 : 1))
    .map((i) => {
      const f = (db.families || []).find((x) => x.id === i.family_id) || {}
      return {
        id: i.id,
        family_id: i.family_id,
        gremio: f.name || null,
        tipo: f.tipo_plantilla || null,
        tipo_visible: plantillaDeFamilia(db, i.family_id)?.nombre_visible || null,
        estado: estadoVivo(i),
        emitida_at: i.emitida_at,
        caduca_at: i.caduca_at
      }
    })
}

function invitacionesDelGremio(db, uid, familyId) {
  if (!esMiGremio(db, uid, familyId)) return []
  return (db.invitaciones || [])
    .filter((i) => i.family_id === familyId)
    .sort((a, b) => (a.emitida_at > b.emitida_at ? -1 : 1))
    .map((i) => ({
      id: i.id,
      correo: i.correo,
      estado: estadoVivo(i),
      emitida_at: i.emitida_at,
      caduca_at: i.caduca_at
    }))
}

function rechazarInvitacion(db, uid, invitacionId) {
  if (!uid) return { codigo: 'sin_sesion' }
  const i = (db.invitaciones || []).find((x) => x.id === invitacionId)
  if (!i) return { codigo: 'no_existe' }
  if (i.correo !== correoDe(db, uid)) return { codigo: 'no_es_tuya' }
  if (i.estado !== 'pendiente') return { codigo: 'ya_resuelta' }
  return { codigo: 'ok', db: resolverInvitacion(db, i.id, 'rechazada') }
}

function revocarInvitacion(db, uid, invitacionId, profileId) {
  if (!uid) return { codigo: 'sin_sesion' }
  const i = (db.invitaciones || []).find((x) => x.id === invitacionId)
  if (!i) return { codigo: 'no_existe' }
  if (!esMiGremio(db, uid, i.family_id)) return { codigo: 'no_es_tuyo' }
  if (puede(db, uid, i.family_id, 'CAP-02', profileId) === 'no') return { codigo: 'no_puede' }
  // `T-4`: revocar una ya aceptada no existe. Para eso está expulsar.
  if (i.estado !== 'pendiente') return { codigo: 'ya_resuelta' }
  return { codigo: 'ok', db: resolverInvitacion(db, i.id, 'revocada') }
}

function resolverInvitacion(db, id, estado, persona = null) {
  return {
    ...db,
    invitaciones: db.invitaciones.map((x) =>
      x.id === id ? { ...x, estado, persona, resuelta_at: ahora() } : x
    )
  }
}

/**
 * Espejo de `aceptar_invitacion()`. Si algo falla, la invitación no se
 * acepta y la llave sigue disponible: no es una comprobación, es que las
 * dos escrituras viven en la misma transacción y se deshacen juntas.
 */
function aceptarInvitacion(db, uid, { p_invitacion: id, p_llave: llaveId, p_personaje: personaje }) {
  if (!uid) return { fila: { resultado: 'sin_sesion', family_id: null } }
  if (claseCredencial(db, uid) !== 'personal') {
    return { fila: { resultado: 'exige_identidad_personal', family_id: null } }
  }

  const i = (db.invitaciones || []).find((x) => x.id === id)
  if (!i) return { fila: { resultado: 'no_existe', family_id: null } }
  if (i.correo !== correoDe(db, uid)) return { fila: { resultado: 'no_es_tuya', family_id: null } }
  if (i.estado !== 'pendiente') return { fila: { resultado: 'ya_resuelta', family_id: null } }

  // La caducidad se evalúa al usarla, y usarla es lo que la cierra.
  if (i.caduca_at <= ahora()) {
    return {
      fila: { resultado: 'caducada', family_id: null },
      db: resolverInvitacion(db, i.id, 'caducada')
    }
  }

  if ((db.pertenencias || []).some(
    (p) => p.persona === uid && p.family_id === i.family_id && p.estado === 'activa'
  )) {
    return { fila: { resultado: 'ya_estas_dentro', family_id: null } }
  }

  const activas = pertenenciasActivas(db, uid)
  if (activas + 1 > PARAMETROS.limite_global) {
    return { fila: { resultado: 'en_el_limite', family_id: null } }
  }

  // `S-10`: la primera pertenencia no cuesta llave. Todo lo demás, sí.
  let llave = null
  if (activas > 0) {
    if (!llaveId) return { fila: { resultado: 'hace_falta_llave', family_id: null } }
    llave = (db.derechos_expansion || []).find((d) => d.id === llaveId)
    if (!llave) return { fila: { resultado: 'llave_no_existe', family_id: null } }
    if (llave.persona !== uid) return { fila: { resultado: 'llave_ajena', family_id: null } }
    if (llave.estado !== 'disponible') return { fila: { resultado: 'llave_no_disponible', family_id: null } }
  }

  const fam = (db.families || []).find((f) => f.id === i.family_id)
  let siguiente = entrarEnGremio(db, uid, {
    familyId: i.family_id, rol: 'miembro', origen: 'invitacion', personaje
  }).db
  siguiente = resolverInvitacion(siguiente, i.id, 'aceptada', uid)
  // La llave se consume DESPUÉS de que la entrada haya funcionado.
  if (llave) siguiente = consumirLlave(siguiente, uid, llave.id, i.family_id, fam?.name || '')

  return { fila: { resultado: 'ok', family_id: i.family_id }, db: siguiente }
}

/** Sin salida el límite global es una trampa (`R-23`). */
function abandonarGremio(db, uid, familyId) {
  if (!uid) return { codigo: 'sin_sesion' }
  const mia = (db.pertenencias || []).find(
    (p) => p.persona === uid && p.family_id === familyId && p.estado === 'activa'
  )
  if (!mia) return { codigo: 'no_estas_dentro' }

  // `I-12`: quien titula no puede limitarse a salir. O traspasa, o cierra.
  const otros = (db.pertenencias || []).filter(
    (p) => p.family_id === familyId && p.estado === 'activa' &&
      p.persona !== uid && (p.rol === 'titular' || p.rol === 'gestor')
  ).length
  if (mia.rol === 'titular' && otros === 0) return { codigo: 'eres_quien_titula' }

  return { codigo: 'ok', db: salir(db, familyId, uid, 'abandonada') }
}

function expulsarDeGremio(db, uid, { p_family: familyId, p_persona: persona, p_profile: profileId }) {
  if (!uid) return { codigo: 'sin_sesion' }
  if (!persona) return { codigo: 'no_estaba_dentro' }
  if (persona === uid) return { codigo: 'usa_abandonar' }
  if (!esMiGremio(db, uid, familyId)) return { codigo: 'no_es_tuyo' }
  if (puede(db, uid, familyId, 'CAP-03', profileId) === 'no') return { codigo: 'no_puede' }

  const suya = (db.pertenencias || []).find(
    (p) => p.persona === persona && p.family_id === familyId && p.estado === 'activa'
  )
  if (!suya) return { codigo: 'no_estaba_dentro' }

  // No se puede dejar el gremio sin nadie que lo administre (`I-12`).
  const otros = (db.pertenencias || []).filter(
    (p) => p.family_id === familyId && p.estado === 'activa' &&
      p.persona !== persona && (p.rol === 'titular' || p.rol === 'gestor')
  ).length
  if ((suya.rol === 'titular' || suya.rol === 'gestor') && otros === 0) {
    return { codigo: 'dejaria_sin_administracion' }
  }

  return { codigo: 'ok', db: salir(db, familyId, persona, 'expulsada') }
}

/**
 * El personaje se RETIRA, no se borra (`H-14`, `T-9`): conserva historial y
 * la XP que aportó a metas ya cerradas, que es lo que permite que el
 * reingreso devuelva a la misma persona su progreso. La cartera no se toca:
 * es de la persona, no del gremio.
 */
function salir(db, familyId, persona, estado) {
  return {
    ...db,
    pertenencias: db.pertenencias.map((p) =>
      p.persona === persona && p.family_id === familyId && p.estado === 'activa'
        ? { ...p, estado, hasta: ahora() }
        : p
    ),
    profiles: (db.profiles || []).map((p) =>
      p.family_id === familyId && p.persona === persona ? { ...p, active: false } : p
    )
  }
}

// ------------------------------------------------------------------
// Fase 7 · reclamar un perfil, y la credencial compartida
// ------------------------------------------------------------------

function solicitarReclamacion(db, uid, profileId) {
  if (!uid) return { codigo: 'sin_sesion' }
  if (claseCredencial(db, uid) !== 'personal') return { codigo: 'exige_identidad_personal' }
  if (!profileId) return { codigo: 'no_reclamable' }

  const pr = (db.profiles || []).find((p) => p.id === profileId)
  // `SEC-9`: el mismo código para «no existe» y para «existe y no se
  // puede». Distinguirlos convertiría esto en un detector de perfiles.
  if (!pr || !pr.active || pr.persona || pr.role === 'mascota') return { codigo: 'no_reclamable' }
  // Los juniors exigen autorización adulta concreta, que es la Fase 8a. Se
  // dice con su propio código porque aquí no hay nada que ocultar: quien
  // reclama sabe que ese perfil existe.
  if (pr.role === 'junior') return { codigo: 'junior_bloqueado' }

  if ((db.profiles || []).some((p) => p.family_id === pr.family_id && p.persona === uid)) {
    return { codigo: 'ya_tienes_personaje' }
  }
  if ((db.pertenencias || []).some(
    (p) => p.persona === uid && p.family_id === pr.family_id && p.estado === 'activa'
  )) {
    return { codigo: 'ya_estas_dentro' }
  }

  // Se responde igual sea mía o de otra persona: decir «la ha pedido
  // alguien» también es revelar.
  if ((db.reclamaciones || []).some((r) => r.profile_id === profileId && r.estado === 'pendiente')) {
    return { codigo: 'ya_solicitada' }
  }

  return {
    codigo: 'ok',
    db: {
      ...db,
      reclamaciones: [
        ...(db.reclamaciones || []),
        filaNueva('reclamaciones', {
          persona: uid,
          profile_id: profileId,
          family_id: pr.family_id,
          estado: 'pendiente',
          caduca_at: enDias(PARAMETROS.invitacion_dias)
        })
      ]
    }
  }
}

function misReclamaciones(db, uid) {
  return (db.reclamaciones || [])
    .filter((r) => r.persona === uid)
    .sort((a, b) => (a.solicitada_at > b.solicitada_at ? -1 : 1))
    .map((r) => ({
      id: r.id,
      family_id: r.family_id,
      gremio: (db.families || []).find((f) => f.id === r.family_id)?.name || null,
      personaje: (db.profiles || []).find((p) => p.id === r.profile_id)?.name || null,
      estado: estadoVivo(r),
      solicitada_at: r.solicitada_at,
      caduca_at: r.caduca_at
    }))
}

function reclamacionesDelGremio(db, uid, familyId) {
  if (!esMiGremio(db, uid, familyId)) return []
  return (db.reclamaciones || [])
    .filter((r) => r.family_id === familyId)
    .sort((a, b) => (a.solicitada_at > b.solicitada_at ? -1 : 1))
    .map((r) => ({
      id: r.id,
      personaje: r.profile_id,
      personaje_nombre: (db.profiles || []).find((p) => p.id === r.profile_id)?.name || null,
      correo: correoDe(db, r.persona),
      estado: estadoVivo(r),
      solicitada_at: r.solicitada_at,
      caduca_at: r.caduca_at
    }))
}

/**
 * Espejo de `aprobar_reclamacion()`. El vínculo NO reinicia el progreso: el
 * personaje se queda con su nivel, su marca de agua, sus insignias y su
 * historial, que es lo que esta función viene a respetar.
 */
function aprobarReclamacion(db, uid, reclamacionId, profileId) {
  if (!uid) return { codigo: 'sin_sesion' }
  const r = (db.reclamaciones || []).find((x) => x.id === reclamacionId)
  if (!r) return { codigo: 'no_existe' }
  if (!esMiGremio(db, uid, r.family_id)) return { codigo: 'no_es_tuyo' }
  // `CAP-10`: administrar miembros. Y no la etiqueta (054).
  if (puede(db, uid, r.family_id, 'CAP-10', profileId) === 'no') return { codigo: 'no_puede' }

  if (r.estado !== 'pendiente') return { codigo: 'ya_resuelta' }
  if (r.caduca_at <= ahora()) {
    return { codigo: 'caducada', db: resolverReclamacion(db, r.id, 'caducada', uid, profileId) }
  }

  const pr = (db.profiles || []).find((p) => p.id === r.profile_id)
  if (!pr || !pr.active) return { codigo: 'perfil_no_disponible' }
  if (pr.persona) return { codigo: 'ya_reclamado' }

  // `R-86`: ocupa plaza. Y se mira AHORA, no cuando se pidió.
  if (pertenenciasActivas(db, r.persona) + 1 > PARAMETROS.limite_global) {
    return { codigo: 'en_el_limite' }
  }

  const correo = correoDe(db, r.persona)
  if (!correo) return { codigo: 'sin_cuenta' }

  const saldo = pr.coins
  let siguiente = {
    ...db,
    // `reclamacion` es el único origen que no consume llave, y `gestor` y
    // no `titular` por lo mismo que en la conversión.
    pertenencias: [
      ...(db.pertenencias || []),
      filaNueva('pertenencias', {
        persona: r.persona, family_id: r.family_id, rol: 'gestor', estado: 'activa', origen: 'reclamacion'
      })
    ],
    profiles: db.profiles.map((p) =>
      p.id === pr.id ? { ...p, persona: r.persona, coins: 0, saldo_local_cerrado: true } : p
    )
  }
  siguiente = abrirCartera(siguiente, r.persona)
  if (saldo > 0) {
    siguiente = anotaCoins(siguiente, {
      profileId: pr.id, tipo: 'conversion', importe: -saldo,
      antes: saldo, despues: 0, referencia: r.id
    })
  }
  const movida = moverCartera(siguiente, {
    persona: r.persona, profileId: pr.id, tipo: 'conversion', importe: saldo, referencia: r.id
  })

  return {
    codigo: 'ok',
    db: resolverReclamacion(
      {
        ...movida.db,
        // El asiento de la conversión va donde van todos.
        conversiones: [
          ...(movida.db.conversiones || []),
          filaNueva('conversiones', {
            profile_id: pr.id,
            family_id: r.family_id,
            correo,
            estado: 'completada',
            persona: r.persona,
            saldo_local_antes: saldo,
            importe: saldo,
            saldo_cartera_despues: movida.saldo,
            resultado: 'ok',
            caduca_at: ahora(),
            resuelta_at: ahora()
          })
        ]
      },
      r.id, 'aprobada', uid, profileId
    )
  }
}

function rechazarReclamacion(db, uid, reclamacionId, profileId) {
  if (!uid) return { codigo: 'sin_sesion' }
  const r = (db.reclamaciones || []).find((x) => x.id === reclamacionId)
  if (!r) return { codigo: 'no_existe' }

  // La puede retirar quien la pidió, o rechazarla la administración del
  // gremio. Las dos cosas dejan la misma fila resuelta.
  if (r.persona !== uid) {
    if (!esMiGremio(db, uid, r.family_id)) return { codigo: 'no_es_tuyo' }
    if (puede(db, uid, r.family_id, 'CAP-10', profileId) === 'no') return { codigo: 'no_puede' }
  }
  if (r.estado !== 'pendiente') return { codigo: 'ya_resuelta' }

  return { codigo: 'ok', db: resolverReclamacion(db, r.id, 'rechazada', uid, profileId) }
}

function resolverReclamacion(db, id, estado, uid, profileId) {
  return {
    ...db,
    reclamaciones: db.reclamaciones.map((x) =>
      x.id === id
        ? {
            ...x, estado, resuelta_at: ahora(),
            resuelta_por: uid, resuelta_por_personaje: profileId || null
          }
        : x
    )
  }
}

/**
 * Espejo de `inventario_credencial()` (`R-88`). Se calcula ENTERO aquí: lo
 * que la pantalla enseña y lo que se comprueba al desactivar salen de la
 * misma función, así que no pueden decir cosas distintas.
 */
function inventarioCredencial(db, uid, familyId) {
  if (!esMiGremio(db, uid, familyId)) {
    return { puede: false, motivos: ['no_es_tuyo'] }
  }
  const perfiles = (db.profiles || []).filter((p) => p.family_id === familyId && p.active)

  // Personas adultas con identidad, pertenencia activa y administración:
  // las que pueden quedarse a cargo de todo lo demás.
  const responsables = perfiles
    .filter((p) => p.role === 'adulto' && p.persona && (db.pertenencias || []).some(
      (pe) => pe.persona === p.persona && pe.family_id === familyId &&
        pe.estado === 'activa' && (pe.rol === 'titular' || pe.rol === 'gestor')
    ))
    .map((p) => ({ profile_id: p.id, nombre: p.name }))

  const hayAdmin = responsables.length > 0
  const adultosCon = perfiles.filter((p) => p.role === 'adulto' && p.persona).length
  // Lo que BLOQUEA: un perfil adulto activo sin identidad se quedaría fuera.
  const adultosSin = perfiles
    .filter((p) => p.role === 'adulto' && !p.persona)
    .map((p) => ({ profile_id: p.id, nombre: p.name }))
  // Lo que NO bloquea por sí solo (`D-29`), pero necesita quien lo opere.
  const noConvertidos = perfiles
    .filter((p) => !p.persona && ['junior', 'peque', 'mascota'].includes(p.role))
    .map((p) => ({ profile_id: p.id, nombre: p.name, rol: p.role }))

  const motivos = []
  if (!hayAdmin) motivos.push('sin_persona_con_administracion')
  if (adultosSin.length > 0) motivos.push('adultos_sin_identidad')
  if (noConvertidos.length > 0 && !hayAdmin) motivos.push('nadie_para_operarlos')

  return {
    puede: motivos.length === 0,
    motivos,
    adultos_con_identidad: adultosCon,
    adultos_sin_identidad: adultosSin,
    no_convertidos: noConvertidos,
    responsables,
    activa: (db.credenciales || []).some(
      (c) => c.family_id === familyId && c.clase === 'compartida' && c.activa !== false
    )
  }
}

function desactivarCredencial(db, uid, familyId, profileId) {
  if (!uid) return { codigo: 'sin_sesion' }
  // `E-11.9`: no la pide la propia clave. Sería una credencial decidiendo
  // dejar de existir, sin nadie detrás que responda por ello.
  if (claseCredencial(db, uid) !== 'personal') return { codigo: 'exige_identidad_personal' }
  if (!esMiGremio(db, uid, familyId)) return { codigo: 'no_es_tuyo' }
  if (puede(db, uid, familyId, 'CAP-04', profileId) === 'no') return { codigo: 'no_puede' }

  const compartida = (db.credenciales || []).find(
    (c) => c.family_id === familyId && c.clase === 'compartida' && c.activa !== false
  )
  if (!compartida) return { codigo: 'ya_desactivada' }

  // Se vuelve a calcular aquí dentro aunque la pantalla ya lo haya pedido
  // para pintarlo: entre una cosa y otra ha podido cambiar cualquiera, y lo
  // que diga el cliente no autoriza nada.
  const inv = inventarioCredencial(db, uid, familyId)
  if (!inv.puede) return { codigo: 'bloqueada:' + inv.motivos[0] }

  return {
    codigo: 'ok',
    db: {
      ...db,
      // La titularidad pasa a esta persona. Sin esto la desactivación sería
      // una casilla: `mis_gremios()` deja entrar por `families.owner`.
      families: db.families.map((f) => (f.id === familyId ? { ...f, owner: uid } : f)),
      // Y la credencial se retira. Ni se borra la fila ni se toca la cuenta.
      credenciales: db.credenciales.map((c) =>
        c.user_id === compartida.user_id ? { ...c, activa: false } : c
      )
    }
  }
}

function crearCredencial(db, uid, familyId, p_correo, profileId) {
  if (!uid) return { codigo: 'sin_sesion' }
  if (claseCredencial(db, uid) !== 'personal') return { codigo: 'exige_identidad_personal' }
  if (!esMiGremio(db, uid, familyId)) return { codigo: 'no_es_tuyo' }
  if (puede(db, uid, familyId, 'CAP-04', profileId) === 'no') return { codigo: 'no_puede' }

  if ((db.credenciales || []).some(
    (c) => c.family_id === familyId && c.clase === 'compartida' && c.activa !== false
  )) {
    return { codigo: 'ya_hay_una' }
  }

  const cuenta = usuarioPorCorreo(db, p_correo)
  if (!cuenta) return { codigo: 'cuenta_no_existe' }
  // La trampa que el proyecto ya conoce desde la 047: `signUp` no falla
  // cuando falta confirmar, solo devuelve una sesión vacía.
  if (!cuenta.email_confirmed_at) return { codigo: 'correo_sin_confirmar' }
  // Una cuenta es compartida o personal, nunca las dos. Y una compartida
  // retirada tampoco vale: la anterior no vuelve.
  if ((db.credenciales || []).some((c) => c.user_id === cuenta.id)) {
    return { codigo: 'cuenta_ya_clasificada' }
  }

  return {
    codigo: 'ok',
    db: {
      ...db,
      credenciales: [
        ...(db.credenciales || []),
        { user_id: cuenta.id, clase: 'compartida', family_id: familyId, activa: true, created_at: ahora() }
      ]
    }
  }
}

// ------------------------------------------------------------------
// El despachador
// ------------------------------------------------------------------

const escalar = ({ codigo, db }) => ({ data: codigo, db })
const unaFila = ({ fila, db }) => ({ data: [fila], db })

// Cada entrada devuelve `{ data, db? }`. Si trae `db`, se guarda y se avisa;
// si no, la llamada fue una lectura y no ha cambiado nada.
const FUNCIONES = {
  clase_credencial: (db, uid) => ({ data: claseCredencial(db, uid) }),
  // La demo no tiene tabla de operadores: nadie lo es, que es la respuesta
  // que recibe cualquier cuenta normal en producción.
  es_operador: () => ({ data: false }),
  actividad_reciente: () => ({ data: [] }),
  plantilla_de_gremio: (db, uid) => ({ data: plantillaDeGremio(db, uid) }),
  saldos_visibles: (db, uid) => ({ data: saldosVisibles(db, uid) }),
  tipos_ofrecidos: () => ({ data: tiposOfrecidos() }),
  mis_pertenencias: (db, uid) => ({ data: misPertenencias(db, uid) }),
  mis_llaves: (db, uid) => ({ data: misLlaves(db, uid) }),

  oportunidades_expansion: (db, uid, a) => ({ data: oportunidadesExpansion(db, uid, a.p_family) }),
  forjar_llave: (db, uid, a) => escalar(forjarLlave(db, uid, a)),

  solicitar_conversion: (db, uid, a) => escalar(solicitarConversion(db, uid, a)),
  completar_conversion: (db, uid, a) => escalar(completarConversion(db, uid, a.p_clave ?? null)),

  crear_gremio_con_llave: (db, uid, a) => unaFila(crearGremioConLlave(db, uid, a)),
  invitar: (db, uid, a) => escalar(invitar(db, uid, a)),
  mis_invitaciones: (db, uid) => ({ data: misInvitaciones(db, uid) }),
  invitaciones_del_gremio: (db, uid, a) => ({ data: invitacionesDelGremio(db, uid, a.p_family) }),
  rechazar_invitacion: (db, uid, a) => escalar(rechazarInvitacion(db, uid, a.p_invitacion)),
  revocar_invitacion: (db, uid, a) => escalar(revocarInvitacion(db, uid, a.p_invitacion, a.p_profile)),
  aceptar_invitacion: (db, uid, a) => unaFila(aceptarInvitacion(db, uid, a)),
  abandonar_gremio: (db, uid, a) => escalar(abandonarGremio(db, uid, a.p_family)),
  expulsar_de_gremio: (db, uid, a) => escalar(expulsarDeGremio(db, uid, a)),

  solicitar_reclamacion: (db, uid, a) => escalar(solicitarReclamacion(db, uid, a.p_profile)),
  mis_reclamaciones: (db, uid) => ({ data: misReclamaciones(db, uid) }),
  reclamaciones_del_gremio: (db, uid, a) => ({ data: reclamacionesDelGremio(db, uid, a.p_family) }),
  aprobar_reclamacion: (db, uid, a) => escalar(aprobarReclamacion(db, uid, a.p_reclamacion, a.p_profile)),
  rechazar_reclamacion: (db, uid, a) => escalar(rechazarReclamacion(db, uid, a.p_reclamacion, a.p_profile)),

  inventario_credencial: (db, uid, a) => ({ data: inventarioCredencial(db, uid, a.p_family) }),
  desactivar_credencial_compartida: (db, uid, a) =>
    escalar(desactivarCredencial(db, uid, a.p_family, a.p_profile)),
  crear_credencial_compartida: (db, uid, a) =>
    escalar(crearCredencial(db, uid, a.p_family, a.p_correo, a.p_profile))
}

/** Los nombres que atiende esta capa. Lo usa el test que compara listas. */
export const RPC_DE_GREMIOS = Object.keys(FUNCIONES)

/**
 * Atiende una RPC de las fases 3 a 7, o devuelve null si no es suya —y
 * entonces el backend simulado sigue buscándola donde estaban las de
 * siempre.
 */
export function rpcDeGremios(nombre, args = {}) {
  const fn = FUNCIONES[nombre]
  if (!fn) return null

  const db = leer()
  const uid = uidActual()
  let salida
  try {
    salida = fn(db, uid, args || {})
  } catch (err) {
    // Las que lanzan son las internas que en Postgres viven dentro de una
    // transacción —consumir la llave, mover la cartera—. Que lancen es lo
    // correcto: lo que NO puede pasar es que lo escrito hasta ahí se quede.
    // Aquí se consigue solo, porque nada se ha guardado todavía.
    return { data: null, error: { message: String(err.message || err) } }
  }

  if (salida.db) {
    escribir(salida.db)
    notificar()
  }
  return { data: salida.data, error: null }
}

// Para el arranque de la demo: la vuelta del enlace, sin pasar por el
// despachador, porque la hace el propio acceso.
export { completarConversion }
