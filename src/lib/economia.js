// ------------------------------------------------------------------
// Equilibrio de la economía.
//
// El problema clásico de cualquier sistema con moneda (aquí, Talis): si se gana más
// deprisa de lo que cuestan las cosas, los premios pierden valor y la
// familia acaba debiendo salidas que no puede sostener. Si se gana
// demasiado despacio, nadie llega a nada y el sistema se abandona.
//
// Aquí no se ajusta a ojo. Se declaran los supuestos, se derivan los
// precios, y hay tests que avisan si alguien cambia los valores de las
// misiones y descuadra la cadencia sin darse cuenta.
//
// Medición de partida (agosto 2026), con los valores originales:
//   nivel 1 → 1,7-2,8 días   (bien)
//   nivel 2 → 4,2-6,8 días   (algo rápido)
//   nivel 3 → 11-18 días     (el doble de rápido de lo que debería)
//   meta    → 4,4 días       (tres veces más rápido de lo prometido)
// ------------------------------------------------------------------

import { DEFAULTS_ROL } from './tareas'
import { misionesDe, diasDe, tocaDia, DIAS_SEMANA } from './misiones'

export const SUPUESTOS = {
  // Nadie completa el tablón entero todos los días, y el sistema no
  // debería estar calculado para que haga falta. 60 % es lo que se
  // sostiene en una casa normal.
  adherencia: 0.6,
  // Presupuesto de carga por persona, en misiones-diarias equivalentes.
  // Subido de 5 a 8 el 15-ago-2026: la familia quiere 6-7 diarias porque
  // con cuatro se quedaban fuera cosas que sí hay que tener en cuenta a
  // diario. El número no es libre: es exactamente lo que hace falta para
  // que quepan los TOPES de abajo (7 + 5/7 + 8/30 = 7,98).
  //
  // Subir el presupuesto SUBE los precios en la misma proporción: si se
  // gana un 60 % más al día, un premio que debe caer cada 30 días tiene
  // que costar un 60 % más. Lo contrario sería regalar la tienda.
  misionesActivas: 8,
  // Cada cuántos días debería caer un premio de cada nivel. Decisión de
  // la familia (15-ago-2026), bastante más espaciada que la original
  // (2/7/30): con premios cada dos días la tienda se convierte en una
  // máquina expendedora y deja de significar nada. Espaciarlos hace que
  // el canje sea un acontecimiento, y de paso encaja con la meta a 60
  // días, que ahora es el horizonte que los envuelve a todos.
  cadencia: { 1: 15, 2: 30, 3: 45 },
  // Y cada cuánto debería cerrarse una meta del gremio. 60 días, decisión
  // de la familia (15-ago-2026): una meta compartida es una cosa de
  // temporada, no de quincena. Con 12 días la meta competía con los
  // premios individuales en vez de ser el horizonte largo, y cerrarla
  // cinco veces al trimestre le quita el carácter de acontecimiento.
  cadenciaMeta: 60
}

/** Talis por día que gana un rol si cumple la adherencia supuesta. */
export function monedasPorDia(rol, s = SUPUESTOS) {
  const d = DEFAULTS_ROL[rol]
  if (!d) return 0
  return s.misionesActivas * d.coins * s.adherencia
}

/** XP por día de un rol, con los mismos supuestos. */
export function xpPorDia(rol, s = SUPUESTOS) {
  const d = DEFAULTS_ROL[rol]
  if (!d) return 0
  return s.misionesActivas * d.xp * s.adherencia
}

/**
 * Tasa de referencia para poner precios. Se usa una sola porque hay una
 * sola tienda: si se afinara por rol, la junior (que gana más) pagaría
 * lo mismo que la peque por lo mismo y no sería tienda, sería tarifa.
 * Se toma la media de los tres roles.
 */
export function tasaDeReferencia(s = SUPUESTOS) {
  const roles = Object.keys(DEFAULTS_ROL)
  return roles.reduce((suma, rol) => suma + monedasPorDia(rol, s), 0) / roles.length
}

/** Precio objetivo de un nivel: lo que se gana en su cadencia. */
export function precioObjetivo(nivel, s = SUPUESTOS) {
  return Math.round(tasaDeReferencia(s) * (s.cadencia[nivel] || 1))
}

/** Banda aceptable alrededor del objetivo: ±25 %. */
export function bandaDePrecio(nivel, s = SUPUESTOS) {
  const objetivo = precioObjetivo(nivel, s)
  return [Math.round(objetivo * 0.75), Math.round(objetivo * 1.25)]
}

/** XP objetivo de una meta del gremio, para una familia de perfiles dados. */
export function metaObjetivo(roles = ['adulto', 'adulto', 'junior', 'peque'], s = SUPUESTOS) {
  const porDia = roles.reduce((suma, rol) => suma + xpPorDia(rol, s), 0)
  return Math.round((porDia * s.cadenciaMeta) / 50) * 50
}

/** Días que tarda alguien con esta tasa en permitirse algo de este coste. */
export function diasParaPermitirse(coste, monedasDia) {
  if (!monedasDia) return Infinity
  return coste / monedasDia
}

// ------------------------------------------------------------------
// Diagnóstico en vivo
//
// Lo anterior son supuestos. Esto mira lo que la familia tiene ACTIVO de
// verdad: si han encendido quince misiones por persona, la economía se
// dispara aunque los precios sean correctos, y conviene que lo vean.
// ------------------------------------------------------------------

export function diagnosticoEconomia(data, s = SUPUESTOS) {
  const activos = (data.profiles || []).filter((p) => p.active !== false)

  const porPersona = activos.map((p) => {
    const suyas = misionesDe(p, data.challenges || [])
    // Solo lo repetible entra en el ritmo diario; lo único es un extra. Y
    // una diaria repartida en tres días de la semana rinde 3/7 de lo que
    // rendiría todos los días, igual que en `cargaDe`.
    const factor = { diario: 1, semanal: 1 / 7, mensual: 1 / 30, unico: 0 }
    const porDia = (c) => {
      const dias = c.frequency === 'diario' ? diasDe(c) : null
      const base = factor[c.frequency] ?? 0
      return dias ? (base * dias.length) / 7 : base
    }
    const monedasDia = suyas.reduce((t, c) => t + c.coins * porDia(c), 0) * s.adherencia
    const xpDia = suyas.reduce((t, c) => t + c.xp * porDia(c), 0) * s.adherencia
    return { perfil: p, misiones: suyas.length, monedasDia, xpDia }
  })

  const xpFamiliaDia = porPersona.reduce((t, x) => t + x.xpDia, 0)
  const activas = (data.rewards || []).filter((r) => r.active)

  // El andamio se cuenta aparte y NO entra en las medias por nivel: los
  // premios de la peque (15-55) y los de arranque (80-240) están por
  // debajo del suelo del modelo, y promediarlos con los de verdad daba un
  // nivel 1 de 190 Talis y un aviso de «se consigue demasiado rápido»
  // sobre premios que cuestan 325. No se esconden —salen en su propia
  // cifra—, pero no se miden contra una cadencia que no es la suya.
  const suelo = bandaDePrecio(1, s)[0]
  const delModelo = activas.filter((r) => r.cost >= suelo)
  const fueraDelModelo = activas.length - delModelo.length

  const niveles = [1, 2, 3].map((nivel) => {
    const precios = delModelo.filter((r) => (r.tier || 2) === nivel).map((r) => r.cost)
    const medio = precios.length ? precios.reduce((a, b) => a + b, 0) / precios.length : null
    const dias = porPersona
      .filter((x) => x.monedasDia > 0)
      .map((x) => (medio === null ? null : diasParaPermitirse(medio, x.monedasDia)))
      .filter((d) => d !== null)
    return {
      nivel,
      premios: precios.length,
      precioMedio: medio,
      diasMin: dias.length ? Math.min(...dias) : null,
      diasMax: dias.length ? Math.max(...dias) : null,
      objetivo: s.cadencia[nivel]
    }
  })

  const meta = data.goal
    ? { objetivoXp: data.goal.target_xp, dias: xpFamiliaDia ? data.goal.target_xp / xpFamiliaDia : Infinity }
    : null

  return { porPersona, xpFamiliaDia, niveles, meta, fueraDelModelo, cadenciaMeta: s.cadenciaMeta }
}

/**
 * Traduce el diagnóstico a un veredicto legible. Sin colorines: si algo
 * va tres veces más rápido de lo previsto, lo dice.
 */
export function veredicto(dias, objetivo) {
  if (dias === null || !isFinite(dias)) return { estado: 'sin_datos', texto: 'Sin datos' }
  const razon = dias / objetivo
  if (razon < 0.5) return { estado: 'rapido', texto: 'Se consigue demasiado rápido' }
  if (razon > 2) return { estado: 'lento', texto: 'Cuesta demasiado' }
  return { estado: 'ok', texto: 'En su sitio' }
}

// ------------------------------------------------------------------
// Topes de misiones por persona
//
// El modelo de arriba supone 5 misiones activas por persona. Ese número
// no es una preferencia estética: es el que hace que los precios de la
// tienda y la meta del gremio caigan en su cadencia. Activar quince
// dispara la economía aunque los precios sean correctos.
//
// Pero contar misiones a secas engaña: siete semanales pesan lo mismo que
// UNA diaria. Lo que hay que medir es la CARGA, en misiones-diarias
// equivalentes, y ahí el presupuesto es el mismo 5 del modelo.
//
// De ese presupuesto salen los topes por frecuencia, repartidos para que
// sumados quepan dentro (7 + 5/7 + 8/30 = 7,98):
// ------------------------------------------------------------------

export const TOPES = { diario: 7, semanal: 5, mensual: 8, unico: Infinity }

/** Cuánto pesa cada frecuencia en misiones-diarias equivalentes. */
export const PESO_FRECUENCIA = { diario: 1, semanal: 1 / 7, mensual: 1 / 30, unico: 0 }

/**
 * La carga de un conjunto de misiones, en misiones-diarias equivalentes.
 *
 * Una diaria repartida en tres días de la semana pesa 3/7, no 1: es lo
 * que de verdad se pide. El reparto solo afecta a las diarias —una
 * semanal puesta en sábado sigue siendo una vez por semana, y volver a
 * dividirla la contaría siete veces menos de lo que cuesta.
 */
export function cargaDe(misiones = []) {
  return misiones.reduce((t, m) => {
    const peso = PESO_FRECUENCIA[m.frequency] ?? 0
    const dias = m.frequency === 'diario' ? diasDe(m) : null
    return t + (dias ? (peso * dias.length) / 7 : peso)
  }, 0)
}

/**
 * Cuántas misiones de esa frecuencia caen a la vez. Para las diarias es
 * el peor día de la semana y no el total: repartir ocho diarias en cuatro
 * y cuatro deja cuatro por día, y avisar de que se pasa de siete sería
 * regañar por haber hecho justo lo que el aviso pide.
 */
export function cuantasALaVez(misiones = [], frecuencia) {
  const suyas = misiones.filter((m) => m.frequency === frecuencia)
  if (frecuencia !== 'diario') return suyas.length
  return DIAS_SEMANA.reduce((max, d) => Math.max(max, suyas.filter((m) => tocaDia(m, d.n)).length), 0)
}

/**
 * ¿Este perfil se pasa del presupuesto?
 *
 * Devuelve la carga, el tope y qué frecuencias van por encima de su
 * máximo. `excedida` es la que importa: el resto es detalle para el
 * mensaje.
 */
export function revisarCarga(misiones = [], s = SUPUESTOS) {
  const carga = cargaDe(misiones)
  const tope = s.misionesActivas
  const porFrecuencia = Object.keys(TOPES).map((frecuencia) => {
    const cuantas = cuantasALaVez(misiones, frecuencia)
    return { frecuencia, cuantas, tope: TOPES[frecuencia], excede: cuantas > TOPES[frecuencia] }
  })
  return {
    carga: Math.round(carga * 100) / 100,
    tope,
    excedida: carga > tope,
    razon: tope ? Math.round((carga / tope) * 100) / 100 : 0,
    porFrecuencia: porFrecuencia.filter((f) => isFinite(f.tope))
  }
}

/**
 * El aviso, ya redactado. Null si no hay nada que decir: un aviso que sale
 * siempre deja de leerse a la semana.
 */
export function avisoDeCarga(misiones = [], nombre = 'Este perfil', s = SUPUESTOS) {
  const r = revisarCarga(misiones, s)
  if (!r.excedida) return null
  const pasadas = r.porFrecuencia.filter((f) => f.excede)
  const detalle = pasadas.length
    ? pasadas.map((f) => `${f.cuantas} ${f.frecuencia === 'diario' ? 'diarias' : f.frecuencia === 'semanal' ? 'semanales' : 'mensuales'} (máximo ${f.tope})`).join(' y ')
    : `una carga de ${r.carga} misiones diarias equivalentes`
  return {
    ...r,
    texto: `${nombre} va a ${r.razon}× de lo que la economía tiene calculado: ${detalle}. Con esta carga los premios y los niveles caen antes de lo previsto. Pausa alguna, o sube el precio de los premios.`
  }
}

// ------------------------------------------------------------------
// El techo: cuánto se puede acumular como máximo
//
// La pregunta que faltaba responder. Los topes de arriba limitan CUÁNTAS
// misiones hay; esto traduce eso a puntos, que es la unidad en la que se
// nota. Se da en dos versiones a propósito:
//
//  · `maximo`   → cumpliéndolo TODO, todos los días. No pasa nunca, pero
//                 es el techo duro: por encima de esto nadie puede subir.
//  · `esperado` → con la adherencia real que supone el modelo (60 %), que
//                 es contra lo que hay que poner los precios.
//
// Poner precios contra el máximo sería castigar a quien cumple a medias,
// que es todo el mundo; ponerlos contra el esperado y olvidar el máximo
// deja la puerta abierta a que una semana perfecta descuadre el mes.
// ------------------------------------------------------------------

export function techoDe(rol, s = SUPUESTOS) {
  const d = DEFAULTS_ROL[rol]
  if (!d) return null
  const porDia = (valor) =>
    TOPES.diario * valor + (TOPES.semanal * valor) / 7 + (TOPES.mensual * valor) / 30
  const monedas = porDia(d.coins)
  const xp = porDia(d.xp)
  const r = (n) => Math.round(n * 10) / 10
  return {
    rol,
    maximo: { monedasDia: r(monedas), xpDia: r(xp), monedasSemana: r(monedas * 7), xpSemana: r(xp * 7) },
    esperado: {
      monedasDia: r(monedas * s.adherencia),
      xpDia: r(xp * s.adherencia),
      monedasSemana: r(monedas * 7 * s.adherencia),
      xpSemana: r(xp * 7 * s.adherencia)
    }
  }
}

/** El techo de toda la familia, para dimensionar la meta del gremio. */
export function techoFamiliar(roles = ['adulto', 'adulto', 'junior', 'peque'], s = SUPUESTOS) {
  const techos = roles.map((rol) => techoDe(rol, s)).filter(Boolean)
  const suma = (via, campo) => Math.round(techos.reduce((t, x) => t + x[via][campo], 0) * 10) / 10
  return {
    maximo: { xpDia: suma('maximo', 'xpDia'), xpSemana: suma('maximo', 'xpSemana') },
    esperado: { xpDia: suma('esperado', 'xpDia'), xpSemana: suma('esperado', 'xpSemana') }
  }
}
