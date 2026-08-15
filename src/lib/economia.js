// ------------------------------------------------------------------
// Equilibrio de la economía.
//
// El problema clásico de cualquier sistema con moneda: si se gana más
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

export const SUPUESTOS = {
  // Nadie completa el tablón entero todos los días, y el sistema no
  // debería estar calculado para que haga falta. 60 % es lo que se
  // sostiene en una casa normal.
  adherencia: 0.6,
  // Misiones activas por persona. Coincide con el consejo de la
  // Biblioteca: de 3 a 6, y 5 en medio.
  misionesActivas: 5,
  // Cada cuántos días debería caer un premio de cada nivel.
  // Nivel 1 son decisiones (elegir la peli): pueden ser casi diarias.
  // Nivel 3 son planes que cuestan dinero y una tarde entera.
  cadencia: { 1: 2, 2: 7, 3: 30 },
  // Y cada cuánto debería cerrarse una meta del gremio.
  cadenciaMeta: 12
}

/** Monedas por día que gana un rol si cumple la adherencia supuesta. */
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
    const suyas = (data.challenges || []).filter(
      (c) => c.active && (c.profile_id === p.id || c.profile_id === null)
    )
    // Solo lo repetible entra en el ritmo diario; lo único es un extra.
    const factor = { diario: 1, semanal: 1 / 7, mensual: 1 / 30, unico: 0 }
    const monedasDia = suyas.reduce((t, c) => t + c.coins * (factor[c.frequency] ?? 0), 0) * s.adherencia
    const xpDia = suyas.reduce((t, c) => t + c.xp * (factor[c.frequency] ?? 0), 0) * s.adherencia
    return { perfil: p, misiones: suyas.length, monedasDia, xpDia }
  })

  const xpFamiliaDia = porPersona.reduce((t, x) => t + x.xpDia, 0)
  const activas = (data.rewards || []).filter((r) => r.active)

  const niveles = [1, 2, 3].map((nivel) => {
    const precios = activas.filter((r) => (r.tier || 2) === nivel).map((r) => r.cost)
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

  return { porPersona, xpFamiliaDia, niveles, meta, cadenciaMeta: s.cadenciaMeta }
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
