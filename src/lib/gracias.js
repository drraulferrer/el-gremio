// ------------------------------------------------------------------
// Dar las gracias: el primer canal horizontal de la app.
//
// F2 de `docs/RECONOCIMIENTOS.md`. Hasta aquí todo lo que la app
// reconocía bajaba de arriba abajo —el adulto valida y elogia— o lo
// dictaba el motor de sellos. Esto permite lo que faltaba: que la junior
// reconozca a su hermana, que la peque reconozca a quien sea, y —lo que
// nunca había pasado— que alguien reconozca a los adultos.
//
// Dos reglas que gobiernan el fichero entero:
//
//  1. **Ni Talis ni XP, en ninguna dirección.** No hay ni un campo para
//     ello. Que no exista es más fuerte que acordarse de no usarlo.
//  2. **Nada de folio en blanco.** El flujo propone hechos REALES de esa
//     persona —lo que hizo estos días— y escribir es la salida, no la
//     entrada. Es la misma lección del elogio al validar, donde cada
//     sugerencia ES el botón: sin sugerencias, no se usa.
// ------------------------------------------------------------------

import { supabase, operacion, dayKey } from './supabase'
import { log, nuevoRequestId } from './log'

export const TOPE_DIARIO = 3
export const TEXTO_MINIMO = 3
export const TEXTO_MAXIMO = 240

/** Cuántos hechos se proponen. Más de cinco es una lista, no una ayuda. */
export const SUGERENCIAS = 5

/** Días hacia atrás de los que se sacan hechos. Más allá ya no se recuerda. */
export const DIAS_DE_MEMORIA = 7

export function validarTexto(texto) {
  const limpio = String(texto || '').trim()
  if (limpio.length < TEXTO_MINIMO) {
    return { ok: false, mensaje: 'Escribe al menos una palabra de verdad.' }
  }
  if (limpio.length > TEXTO_MAXIMO) {
    return { ok: false, mensaje: `Demasiado largo: el tope son ${TEXTO_MAXIMO} caracteres.` }
  }
  return { ok: true, mensaje: '' }
}

/**
 * Hechos recientes de esa persona que se pueden reconocer.
 *
 * **No se ofrece lo que YA tiene palabras** (§10.3 de la spec). La regla
 * no mira quién validó —`completions` no guarda quién fue— sino si ese
 * hecho ya recibió un elogio: reconocer dos veces el mismo hecho es
 * repetir el mismo acto, no sumar uno nuevo.
 */
export function hechosDe(profileId, { completions = [], challenges = [] } = {}, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - DIAS_DE_MEMORIA * 86400000).toISOString()
  return completions
    .filter((c) =>
      c.profile_id === profileId &&
      c.status === 'aprobado' &&
      !c.praise &&
      String(c.resolved_at || c.requested_at || '') >= desde
    )
    .sort((a, b) => String(b.resolved_at || '').localeCompare(String(a.resolved_at || '')))
    .slice(0, SUGERENCIAS)
    .map((c) => {
      const reto = challenges.find((x) => x.id === c.challenge_id)
      return {
        completionId: c.id,
        emoji: reto?.emoji || '✅',
        titulo: reto?.title || 'algo que hizo',
        ts: c.resolved_at || c.requested_at || null
      }
    })
}

/**
 * La fila tal cual va a la base. Pura, y con la lista de campos cerrada:
 * el día que alguien añada uno, el test lo dice en voz alta.
 */
export function construirReconocimiento({
  familyId,
  deProfile,
  aProfile,
  tipo = 'gracias',
  texto = null,
  completionId = null,
  dia
}) {
  return {
    family_id: familyId,
    de_profile: deProfile,
    a_profile: aProfile,
    tipo,
    // Un gesto es una cara y una estrella: sin texto, y la base lo exige.
    texto: tipo === 'gesto' ? null : String(texto || '').trim(),
    completion_id: tipo === 'gracias' ? completionId : null,
    dia
  }
}

/** Cuántos ha dado hoy esta persona, para enseñar lo que queda. */
export function dadosHoy(reconocimientos = [], profileId, dia) {
  return reconocimientos.filter((r) => r.de_profile === profileId && r.dia === dia).length
}

export function quedanHoy(reconocimientos = [], profileId, dia) {
  return Math.max(0, TOPE_DIARIO - dadosHoy(reconocimientos, profileId, dia))
}

/**
 * A quién se le puede dar: el gremio menos uno mismo y menos las
 * mascotas. Reconocer al perro es una broma buena que la base rechaza
 * igual —no tiene sentido— y aquí ni se ofrece.
 */
export function aQuienPuedoDar(perfiles = [], yo) {
  return perfiles.filter((p) => p.id !== yo && p.active !== false && p.role !== 'mascota')
}

/**
 * Manda el reconocimiento. Nunca lanza: devuelve `{ ok, mensaje }`.
 *
 * El cliente se inyecta —con el de verdad por defecto— en vez de
 * parchearse desde fuera: en CI ese cliente es `null`.
 */
export async function darGracias({
  family,
  de,
  a,
  tipo = 'gracias',
  texto = null,
  completionId = null,
  cliente = supabase,
  ahora = new Date()
}) {
  if (tipo !== 'gesto') {
    const revision = validarTexto(texto)
    if (!revision.ok) return { ok: false, mensaje: revision.mensaje }
  }
  if (!cliente) return { ok: false, mensaje: 'Esta copia no está conectada al gremio.' }
  if (!a || a === de) return { ok: false, mensaje: 'Elige a otra persona del gremio.' }

  const requestId = nuevoRequestId()
  const fila = construirReconocimiento({
    familyId: family.id,
    deProfile: de,
    aProfile: a,
    tipo,
    texto,
    completionId,
    // El día del GREMIO y no el del reloj del aparato: a las 00:30 de un
    // lunes, una tablet en otra zona seguiría contando el domingo.
    dia: dayKey(ahora, family.timezone)
  })

  log.info('gracias.dado', { request_id: requestId, tipo, con_frase: Boolean(fila.texto) })

  const { error, mensaje } = await operacion(
    'gracias.dado.error',
    () => cliente.from('reconocimientos').insert(fila),
    { request_id: requestId, tipo }
  )

  return { ok: !error, mensaje }
}
