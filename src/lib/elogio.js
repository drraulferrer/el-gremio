// ------------------------------------------------------------------
// Elogio específico.
//
// Owen et al. (2012), sobre 41 estudios: el elogio funciona cuando es
// específico, sincero e inmediato. El "muy bien" genérico pierde efecto
// por repetición. Leijten et al. (2019) lo sitúan entre los componentes
// con más efecto de todos los programas de crianza.
//
// De ahí este fichero: al validar, en lugar de un botón mudo, el panel
// propone frases que nombran LO QUE HIZO. No las escribe la app por
// nadie, las propone para que escribir una cueste dos segundos y no se
// acabe cayendo en el "muy bien" de siempre.
// ------------------------------------------------------------------

import { dayKey } from './supabase'
import { accionDeMision } from './tareas'

// Los títulos del catálogo están en infinitivo ("Hacer la cama"), así que
// toda plantilla tiene que encajar con un infinitivo. Es el detalle que
// separa "Has conseguido hacer la cama" de "Has hacer la cama", y un
// elogio mal construido no suena sincero, que es justo lo que necesita.
//
// Ninguna plantilla lleva marca de género, y es deliberado: se puede
// elogiar sin marcar. "Lo has hecho por tu cuenta" vale para cualquiera
// y se lee mejor que cualquier apaño con barras. La concordancia entra
// igualmente por {accion}, que viene del título y ese sí puede flexionar.
const PLANTILLAS_POR_HABILIDAD = {
  autonomia: ['Has conseguido {accion} sin que nadie te lo recordara.', 'Lo has hecho por tu cuenta: {accion}.'],
  responsabilidad: ['Te has acordado tú de {accion}.', 'Has cumplido con lo tuyo: {accion}.'],
  cooperacion: ['Nos has echado una mano con {accion} y se ha notado.', 'Con {accion} nos has facilitado la tarde.'],
  amabilidad: ['Has tratado bien a los demás: {accion}.', 'Eso de {accion} ha hecho sentir bien a alguien.'],
  salud: ['Has cuidado tu cuerpo: {accion}.', 'Has ido a {accion} aunque daba pereza.'],
  aprendizaje: ['Hoy sabes algo que ayer no: {accion}.', 'Has puesto cabeza en {accion}.'],
  creatividad: ['Has hecho aparecer algo que no estaba: {accion}.', 'Te has inventado algo con {accion}.'],
  hogar: ['La casa está mejor porque te has puesto a {accion}.', 'Has dejado hecho lo de {accion} sin que nadie insistiera.']
}

const PLANTILLAS_ESFUERZO = [
  'Te estaba costando y lo has hecho igual.',
  'Lo has hecho a la primera, sin protestar.',
  'Has ido a por ello en cuanto lo has visto.'
]

// La acción sale del catálogo, no del título: la familia escribió
// "Encimera" y "Ejercicio", y un elogio no puede decir "te has acordado
// tú de encimera". El catálogo guarda el infinitivo para estos casos.
function accionDe(titulo) {
  return accionDeMision(titulo)
}

/**
 * Racha de días naturales consecutivos con esta misión aprobada.
 * La constancia es lo que interesa reconocer: el resultado de hoy se ve,
 * el hábito de doce días no lo ve nadie si no se nombra.
 */
export function rachaDeMision(challengeId, profileId, completions, hoy = new Date()) {
  const dias = new Set(
    completions
      .filter((c) => c.challenge_id === challengeId && c.profile_id === profileId && c.status === 'aprobado' && c.resolved_at)
      .map((c) => dayKey(new Date(c.resolved_at)))
  )

  let racha = 0
  const cursor = new Date(hoy)
  // Se empieza por ayer: la de hoy todavía se está validando.
  cursor.setDate(cursor.getDate() - 1)
  while (dias.has(dayKey(cursor)) && racha < 400) {
    racha++
    cursor.setDate(cursor.getDate() - 1)
  }
  return racha
}

/**
 * Propuestas de elogio para una validación concreta.
 * @returns {string[]} de 3 a 4 frases, la primera siempre ligada a la habilidad
 */
export function sugerenciasDeElogio({ reto, racha = 0 }) {
  const accion = accionDe(reto?.title)
  const porHabilidad = PLANTILLAS_POR_HABILIDAD[reto?.skill] || [
    'Te has ocupado de {accion} y se nota.',
    'Has cumplido con {accion}.'
  ]

  const sugerencias = porHabilidad.map((p) => p.replace('{accion}', accion))

  if (racha >= 2) {
    sugerencias.push(`Llevas ${racha + 1} días seguidos con esto. Eso ya no es suerte.`)
  }
  sugerencias.push(PLANTILLAS_ESFUERZO[racha % PLANTILLAS_ESFUERZO.length])

  // Sin duplicados y como mucho cuatro: una lista larga se lee menos que
  // ninguna y acaba en el botón de validar sin elogio.
  return [...new Set(sugerencias)].slice(0, 4)
}

/** Un elogio vacío no es un error: obligar a escribir acabaría en "ok". */
export function elogioValido(texto) {
  const t = String(texto || '').trim()
  return t.length === 0 || t.length <= 240
}

// ------------------------------------------------------------------
// No validar, y que sirva de algo
//
// Rechazar existía como un icono mudo: la misión volvía a la lista y la
// niña no se enteraba de por qué. Eso enseña que el adulto es
// impredecible, que es lo contrario de lo que buscamos.
//
// Las frases de abajo siguen tres reglas, y son las tres que separan una
// corrección de una regañina:
//
//  1. Hablan de LA TAREA, nunca de la persona. «Falta la mesa de la
//     cocina», no «no te has esforzado». Lo primero se puede arreglar en
//     dos minutos; lo segundo es una etiqueta.
//  2. Dicen qué falta EXACTAMENTE, para que se pueda terminar. Un «no»
//     sin siguiente paso es un castigo, no una enseñanza.
//  3. Dejan la puerta abierta: la misión vuelve a estar disponible, así
//     que el mensaje termina en «y lo validamos», no en «hoy ya no».
//
// El texto se guarda en la misma columna que el elogio (`praise`), que a
// estas alturas es «la nota de la validación» y no solo el elogio. No
// merecía una columna nueva ni una migración.
// ------------------------------------------------------------------

const PLANTILLAS_CORRECCION = [
  'Todavía falta un poco para {accion}. Termínalo y lo validamos.',
  'Se ha quedado a medias. Repasa {accion} y avísame.',
  'Aún no está: mira otra vez y cuando esté, lo validamos.'
]

/**
 * Propuestas para NO validar. Mismo formato que las de elogio, para que
 * el gesto sea el mismo: cada sugerencia ES el botón.
 * @returns {string[]} tres frases, ninguna sobre la persona
 */
export function sugerenciasDeCorreccion({ reto }) {
  const accion = accionDe(reto?.title)
  return PLANTILLAS_CORRECCION.map((p) => p.replace('{accion}', accion))
}

/**
 * Un motivo de rechazo NO puede ir vacío, al contrario que el elogio.
 * Rechazar sin decir por qué es justo el caso que veníamos a arreglar.
 */
export function correccionValida(texto) {
  const t = String(texto || '').trim()
  return t.length >= 3 && t.length <= 240
}
