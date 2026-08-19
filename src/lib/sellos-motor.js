// ------------------------------------------------------------------
// El motor de los sellos.
//
// Dos pasos, separados a propósito:
//
//   proyeccionDe(perfil, datos)  →  qué ha hecho esta persona
//   evaluar(proyeccion)          →  qué sellos cumple con eso
//
// El segundo no toca fechas ni filtra nada: recibe números y compara. Eso
// hace que las reglas del catálogo se puedan probar con una proyección
// escrita a mano, sin fabricar cien completions falsas para mover un
// contador.
//
// LO QUE ESTE FICHERO NO HACE: conceder. Devuelve qué se cumple; quien
// escribe en `profile_badges` es `App.jsx`. Aquí no hay red ni estado.
//
// ── La regla de seguridad ──────────────────────────────────────────
//
// Una insignia concedida NO SE QUITA (regla 1 de INSIGNIAS-01). Eso
// convierte un falso positivo en un daño permanente en el perfil de una
// persona, y es la razón de que la proyección lleve `completa`: si el
// historial que se le ha pasado puede estar truncado, las reglas que
// necesitan ver TODA la vida no se evalúan. Se queda corto antes que
// repartir lo que no toca.
// ------------------------------------------------------------------

import { dayKey, weekKey, monthKey } from './supabase'

/**
 * Las reglas que solo son verdad si se ha visto el historial entero.
 *
 * `regreso` mira HUECOS, y un hueco puede ser un hueco de verdad o el
 * borde de lo que se ha cargado: con medio historial, la primera fila
 * visible siempre parece «volver después de una pausa». Es el único
 * grupo que puede dar un falso POSITIVO al truncar; los demás solo se
 * quedan cortos, que es seguro.
 *
 * `equilibrio` va aquí por otro motivo: mide una PROPORCIÓN entre
 * habilidades, y una proporción sobre una muestra recortada puede salir
 * repartida cuando la vida entera está concentrada.
 */
const NECESITAN_HISTORIAL_COMPLETO = new Set(['regreso', 'equilibrio'])

const aprobadasDe = (completions, profileId) =>
  completions.filter((c) => c.profile_id === profileId && c.status === 'aprobado' && c.resolved_at)

/**
 * El día de una completación es el de su PETICIÓN, no el de su
 * validación, y el catálogo lo pide así (§2.1): quien hace la cama el
 * lunes por la noche y recibe el visto bueno el martes trabajó el lunes.
 * La aprobación habilita el crédito; no lo fecha.
 *
 * Se cae a `resolved_at` solo si no hay `requested_at`, que no debería
 * pasar porque la columna es `not null`.
 */
const fechaDe = (c) => new Date(c.requested_at || c.resolved_at)

const distintos = (lista) => new Set(lista).size

/**
 * Qué habilidad, familia y frecuencia entrenó una completación.
 *
 * Manda el SNAPSHOT (migración 029): lo que se guardó cuando la persona
 * hizo la cosa. Editar la habilidad de una misión ya no reescribe el
 * pasado, y borrar la misión ya no se lleva su historia por delante.
 *
 * El respaldo al `challenge` actual queda para dos casos, los dos
 * legítimos: filas anteriores a la migración en una base donde el
 * backfill aún no ha corrido, y el modo demo recién sembrado a mano.
 * Cuando ni una cosa ni la otra, la familia es el `challenge_id`, que
 * aguanta renombrar el título aunque no duplicar la misión.
 */
function contextoDe(completion, retosPorId) {
  const reto = retosPorId.get(completion.challenge_id)
  return {
    habilidad: completion.snapshot_skill ?? reto?.skill ?? null,
    familia: completion.snapshot_mission_family_id
      || reto?.mission_family_id
      || completion.challenge_id,
    frecuencia: completion.snapshot_frequency ?? reto?.frequency ?? null,
    xp: completion.snapshot_xp ?? completion.xp ?? 0,
    // Cuánta ayuda hizo falta. `null` mientras la misión no lo registre,
    // que es el estado de casi todas: los sellos de Autonomía no se
    // conceden sin este dato y no se infiere de nada.
    ayuda: completion.assistance_level ?? null
  }
}

/** Los periodos distintos que toca una lista de completaciones. */
function periodos(lista) {
  const dias = [], semanas = [], meses = []
  for (const c of lista) {
    const f = fechaDe(c)
    dias.push(dayKey(f))
    semanas.push(weekKey(f))
    meses.push(monthKey(f))
  }
  return {
    dias: distintos(dias),
    semanas: distintos(semanas),
    meses: distintos(meses)
  }
}

/**
 * Las pausas de una persona: tramos sin un solo día activo.
 *
 * Devuelve, por cada hueco, cuánto duró y cuántos días activos hubo antes
 * y después dentro de la ventana. Con eso se resuelven los tres escalones
 * de Regreso sin que cada uno recorra el historial por su cuenta.
 */
function pausasDe(lista) {
  if (!lista.length) return []

  const aMedianoche = (f) => {
    const [a, m, d] = dayKey(f).split('-').map(Number)
    return new Date(a, m - 1, d).getTime()
  }
  const dias = [...new Set(lista.map((c) => aMedianoche(fechaDe(c))))].sort((x, y) => x - y)

  const DIA = 86400000
  const pausas = []
  for (let i = 1; i < dias.length; i++) {
    const hueco = Math.round((dias[i] - dias[i - 1]) / DIA)
    if (hueco < 2) continue

    const vuelta = dias[i]
    pausas.push({
      // Días de hueco REAL: entre el lunes y el jueves hay dos días
      // muertos, no tres. Si contáramos la distancia entre marcas, una
      // pausa de «7 días» se cumpliría faltando solo seis.
      pausaDias: hueco - 1,
      base: {
        dias: dias.slice(0, i).length,
        semanas: distintos(dias.slice(0, i).map((t) => weekKey(new Date(t)))),
        meses: distintos(dias.slice(0, i).map((t) => monthKey(new Date(t))))
      },
      // Cuántos días activos hay DESPUÉS de volver, por ventana. Se
      // calcula aquí porque cada escalón usa una ventana distinta.
      despuesEn: (ventanaDias) =>
        dias.filter((t) => t >= vuelta && t < vuelta + ventanaDias * DIA).length
    })
  }
  return pausas
}

/**
 * Todo lo que las reglas necesitan saber de una persona.
 *
 * `completa` dice si `completions` trae la vida entera o solo una ventana
 * reciente. Quien la llama es responsable de decir la verdad ahí: si
 * miente, el motor concede sobre datos recortados.
 */
export function proyeccionDe(perfil, datos = {}) {
  const {
    completions = [],
    challenges = [],
    metas = [],
    completa = false
  } = datos

  const retosPorId = new Map(challenges.map((c) => [c.id, c]))
  const aprobadas = aprobadasDe(completions, perfil.id)
  const ctx = aprobadas.map((c) => ({ c, ...contextoDe(c, retosPorId) }))

  const global = periodos(aprobadas)

  // Por habilidad. Solo las que tienen habilidad declarada: una misión
  // sin `skill` no entrena ningún camino, y meterla en uno cualquiera
  // sería inventarse el dato.
  const porHabilidad = {}
  for (const item of ctx) {
    if (!item.habilidad) continue
    const h = (porHabilidad[item.habilidad] ||= { xp: 0, completions: [], familias: new Set() })
    h.xp += item.xp
    h.completions.push(item.c)
    h.familias.add(item.familia)
  }
  const habilidades = {}
  for (const [id, h] of Object.entries(porHabilidad)) {
    const p = periodos(h.completions)
    habilidades[id] = {
      xp: h.xp,
      dias: p.dias,
      semanas: p.semanas,
      meses: p.meses,
      familias: h.familias.size
    }
  }

  const xpTotalHabilidades = Object.values(habilidades).reduce((t, h) => t + h.xp, 0)
  const xpMayor = Object.values(habilidades).reduce((m, h) => Math.max(m, h.xp), 0)

  return {
    completa,
    aprobadas: aprobadas.length,
    diasActivos: global.dias,
    semanasActivas: global.semanas,
    mesesActivos: global.meses,
    habilidades,
    habilidadesTocadas: Object.keys(habilidades).length,
    familias: distintos(ctx.map((i) => i.familia)),
    frecuencias: distintos(ctx.map((i) => i.frecuencia).filter(Boolean)),
    xpTotalHabilidades,
    // Qué parte de la experiencia se la lleva la habilidad dominante.
    // Sin XP no hay concentración que medir, y 0/0 no es 1.
    concentracion: xpTotalHabilidades ? xpMayor / xpTotalHabilidades : 0,
    obrasCerradas: metas.filter((m) => m.achieved).length,
    pausas: pausasDe(aprobadas),
    // Para los descubrimientos, que miran DENTRO de un periodo.
    porSemana: agrupar(ctx, (i) => weekKey(fechaDe(i.c))),
    porMes: agrupar(ctx, (i) => monthKey(fechaDe(i.c)))
  }
}

function agrupar(items, clave) {
  const mapa = new Map()
  for (const i of items) {
    const k = clave(i)
    if (!mapa.has(k)) mapa.set(k, [])
    mapa.get(k).push(i)
  }
  return [...mapa.values()]
}

// ── Evaluación ────────────────────────────────────────────────────

const cumpleUmbrales = (p, regla) => {
  const compara = {
    aprobadas: p.aprobadas,
    diasActivos: p.diasActivos,
    semanasActivas: p.semanasActivas,
    mesesActivos: p.mesesActivos,
    habilidadesTocadas: p.habilidadesTocadas,
    familias: p.familias,
    frecuencias: p.frecuencias,
    obrasCerradas: p.obrasCerradas
  }
  return Object.entries(regla).every(([clave, minimo]) => {
    if (!(clave in compara)) return true
    return compara[clave] >= minimo
  })
}

function cumpleOficio(p, regla) {
  const h = p.habilidades[regla.habilidad]
  if (!h) return false
  return h.xp >= regla.xp &&
    h.dias >= regla.dias &&
    h.semanas >= regla.semanas &&
    h.familias >= regla.familias &&
    (regla.meses === undefined || h.meses >= regla.meses)
}

function cumpleEquilibrio(p, e) {
  const califican = Object.values(p.habilidades).filter(
    (h) => h.xp >= e.xp && h.dias >= e.dias && h.familias >= e.familias
  )
  return califican.length >= e.habilidades &&
    p.xpTotalHabilidades >= e.xpTotal &&
    p.concentracion <= e.concentracionMax
}

function cumpleRegreso(p, r) {
  return p.pausas.some((pausa) =>
    pausa.pausaDias >= r.pausaDias &&
    pausa.base.dias >= r.baseDias &&
    (r.baseSemanas === undefined || pausa.base.semanas >= r.baseSemanas) &&
    (r.baseMeses === undefined || pausa.base.meses >= r.baseMeses) &&
    pausa.despuesEn(r.ventanaDias) >= r.despuesDias
  )
}

const cumpleEnUnPeriodo = (grupos, cond) =>
  grupos.some((items) => {
    const dias = distintos(items.map((i) => dayKey(fechaDe(i.c))))
    if (dias < cond.dias) return false
    if (cond.habilidades) {
      return distintos(items.map((i) => i.habilidad).filter(Boolean)) >= cond.habilidades
    }
    const suyas = new Set(items.map((i) => i.frecuencia))
    return cond.frecuencias.every((f) => suyas.has(f))
  })

/** ¿Cumple ESTA regla la proyección? */
export function cumple(proyeccion, regla) {
  if (!regla) return false
  if (regla.habilidad) return cumpleOficio(proyeccion, regla)
  if (regla.equilibrio) return cumpleEquilibrio(proyeccion, regla.equilibrio)
  if (regla.regreso) return cumpleRegreso(proyeccion, regla.regreso)
  if (regla.enUnaSemana) return cumpleEnUnPeriodo(proyeccion.porSemana, regla.enUnaSemana)
  if (regla.enUnMes) return cumpleEnUnPeriodo(proyeccion.porMes, regla.enUnMes)
  return cumpleUmbrales(proyeccion, regla)
}

// ── Cuánto falta ───────────────────────────────────────────────────

const ETIQUETAS = {
  aprobadas: 'Encargos',
  diasActivos: 'Días',
  semanasActivas: 'Semanas',
  mesesActivos: 'Meses',
  habilidadesTocadas: 'Habilidades',
  familias: 'Actividades',
  frecuencias: 'Ritmos',
  obrasCerradas: 'Obras'
}

const ETIQUETAS_OFICIO = {
  xp: 'XP',
  dias: 'Días',
  semanas: 'Semanas',
  meses: 'Meses',
  familias: 'Actividades'
}

/**
 * Los requisitos de una regla, con lo que se lleva de cada uno.
 *
 * Devuelve una lista, no un porcentaje. Un porcentaje medio sería mentira:
 * tener el 100 % de la XP y el 0 % de las semanas no es «medio camino»,
 * porque las semanas no se pueden acelerar. Enseñar las dos cifras deja
 * ver POR QUÉ falta, que es lo único accionable.
 *
 * Vacío para las reglas ocultas —regresos y descubrimientos—: enseñar su
 * progreso convertiría una sorpresa en una lista de deberes, y en el caso
 * del regreso además dibujaría una cuenta atrás hacia desaparecer.
 */
export function requisitosDe(proyeccion, regla) {
  if (!regla || regla.regreso || regla.enUnaSemana || regla.enUnMes) return []

  if (regla.habilidad) {
    const h = proyeccion.habilidades[regla.habilidad] || {}
    return Object.entries(ETIQUETAS_OFICIO)
      .filter(([clave]) => regla[clave] !== undefined)
      .map(([clave, etiqueta]) => ({
        etiqueta,
        actual: h[clave] || 0,
        objetivo: regla[clave],
        cumple: (h[clave] || 0) >= regla[clave]
      }))
  }

  if (regla.equilibrio) {
    const e = regla.equilibrio
    const califican = Object.values(proyeccion.habilidades).filter(
      (h) => h.xp >= e.xp && h.dias >= e.dias && h.familias >= e.familias
    ).length
    return [
      { etiqueta: 'Caminos con base', actual: califican, objetivo: e.habilidades, cumple: califican >= e.habilidades },
      { etiqueta: 'XP repartida', actual: proyeccion.xpTotalHabilidades, objetivo: e.xpTotal, cumple: proyeccion.xpTotalHabilidades >= e.xpTotal },
      // Este va al revés: se cumple estando POR DEBAJO. Se enseña en
      // porcentaje porque «0,42» no dice nada a nadie.
      {
        etiqueta: 'Camino dominante',
        actual: Math.round(proyeccion.concentracion * 100),
        objetivo: Math.round(e.concentracionMax * 100),
        sufijo: '%',
        menorEsMejor: true,
        cumple: proyeccion.concentracion <= e.concentracionMax
      }
    ]
  }

  return Object.entries(ETIQUETAS)
    .filter(([clave]) => regla[clave] !== undefined)
    .map(([clave, etiqueta]) => ({
      etiqueta,
      actual: proyeccion[clave] || 0,
      objetivo: regla[clave],
      cumple: (proyeccion[clave] || 0) >= regla[clave]
    }))
}

/** La familia de reglas de un sello, para saber si exige historial entero. */
const familiaDeRegla = (regla) =>
  regla.regreso ? 'regreso' : regla.equilibrio ? 'equilibrio' : 'otra'

/**
 * Los sellos que esta persona cumple y todavía no tiene.
 *
 * `yaTiene` es el conjunto de códigos ya concedidos: se pasa entero para
 * no proponer lo que ya está, que en un lote retroactivo es casi todo.
 */
export function sellosGanados(proyeccion, catalogo, yaTiene = new Set()) {
  return catalogo.filter((s) => {
    if (!s.regla || yaTiene.has(s.id)) return false
    if (!proyeccion.completa && NECESITAN_HISTORIAL_COMPLETO.has(familiaDeRegla(s.regla))) return false
    return cumple(proyeccion, s.regla)
  })
}
