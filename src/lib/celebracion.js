// ------------------------------------------------------------------
// Celebrar en escala.
//
// La lección de Duolingo que más se pasa por alto no es que celebre: es
// que NO celebra siempre igual. Acertar una frase saca un tic y un
// sonido corto; terminar la lección saca la pantalla entera; subir de
// liga saca la grande. La escala es lo que hace que la grande siga
// significando algo.
//
// Aquí estaba todo en el mismo escalón: la misma lluvia de diez
// estrellas y los mismos 1,9 s para aprobar una misión, para subir de
// nivel y para confirmar que un premio se ha pedido. Tres cosas que no
// pesan lo mismo, celebradas igual, es la vía más rápida a que ninguna
// de las tres se note.
//
// TRES ESCALONES, Y EL DE ABAJO ES EL IMPORTANTE:
//
// · `chispa` — una confirmación. «Pedido al gremio.» No has logrado
//   nada: has hecho algo y ha salido bien. Corta y pequeña, para que se
//   quite de en medio.
// · `normal` — una misión aprobada. El caso de todos los días.
// · `hito` — subir de nivel, un hito de racha. Lo que pasa una vez cada
//   muchas veces. Si esto durase lo mismo que aprobar una misión, subir
//   de nivel no se distinguiría de un martes cualquiera.
//
// LA PARTE QUE NO SE VE: el escalón no cambia solo cuánto dura, cambia
// cuántas estrellas salen y cuánto crece la caja. Alargar la misma
// animación no la hace más grande, la hace más lenta —que es lo
// contrario de celebrar—.
// ------------------------------------------------------------------

/**
 * Los tres escalones.
 *
 * `estrellas` sale en la lluvia, `ms` es lo que se queda en pantalla y
 * `clase` es el modificador CSS que decide el tamaño.
 *
 * Las cifras están puestas contra el reloj de la app, no al gusto: los
 * 1.900 ms de `normal` son los que ya tenía la celebración de siempre y
 * llevan desde la 1.0 sin que nadie se queje, así que son la referencia
 * y los otros dos escalones se miden desde ahí.
 */
export const ESCALONES = {
  chispa: { estrellas: 4, ms: 1100, clase: 'celebracion-chispa' },
  normal: { estrellas: 10, ms: 1900, clase: '' },
  hito: { estrellas: 18, ms: 3200, clase: 'celebracion-hito' }
}

export const ESCALON_POR_DEFECTO = 'normal'

/**
 * El escalón pedido, o el de siempre.
 *
 * Cae al de en medio ante cualquier cosa rara en vez de tirar: una
 * celebración es lo último que puede romper una pantalla, y quedarse
 * corto de fiesta nunca ha roto nada.
 */
export function escalonDe(nombre) {
  return ESCALONES[nombre] || ESCALONES[ESCALON_POR_DEFECTO]
}

/**
 * Cuánto se queda en pantalla.
 *
 * El elogio alarga, y no un poco: es texto escrito por otra persona
 * —«qué bien has recogido hoy»— y hay que darle tiempo a leerse. Una
 * junior de 11 años lee esa frase en algo menos de dos segundos; por
 * debajo de eso el elogio se convierte en un parpadeo, y el elogio es la
 * pieza que de verdad tiene efecto (§ la celebración de `Home`).
 *
 * Se suma en vez de multiplicar porque lo que hay que cubrir es leer una
 * frase, y eso cuesta lo mismo en un escalón que en otro.
 */
export const EXTRA_ELOGIO_MS = 1700

export function duracionCelebracion(nombre, conElogio = false) {
  const { ms } = escalonDe(nombre)
  return conElogio ? ms + EXTRA_ELOGIO_MS : ms
}

/**
 * Cuántas estrellas volanderas dibujar.
 *
 * Con `prefers-reduced-motion` no salen: ninguna. La caja con el texto
 * sí se queda —quien pide menos movimiento sigue necesitando saber que
 * la misión se aprobó—, pero la lluvia es puro movimiento y es justo lo
 * que se estaba pidiendo evitar.
 */
export function estrellasDe(nombre, menosMovimiento = false) {
  if (menosMovimiento) return 0
  return escalonDe(nombre).estrellas
}

// ------------------------------------------------------------------
// Qué hay que celebrar entre dos cargas de datos.
//
// Vive aquí y no dentro del componente por la razón de siempre en esta
// casa: una cuenta metida en la pantalla no se puede probar. Y esta en
// concreto había que poder probarla, porque su fallo no se ve en un
// portátil —hay que salir del panel parental para reproducirlo— y llegó
// hasta el móvil de casa sin que nadie lo notara.
//
// EL FALLO QUE ARREGLA, para que no vuelva: la comparación necesita
// acordarse de lo que había ANTES. Esa memoria vivía en Home, y Home se
// desmonta entero al entrar en el panel parental, que es justo donde se
// valida. Al salir, Home montaba de cero y la primera pasada solo servía
// para tomar la referencia: quien validaba su propia misión no veía
// nunca la celebración. Con un solo adulto y un solo móvil, eso era
// TODAS las veces. Ahora la memoria vive en App, que no se desmonta.
// ------------------------------------------------------------------

import { talis } from './talis'

/** La foto de referencia: lo que ya se ha visto de esta persona. */
export function marcaDe({ aprobadas = [], nivel = 0, profileId = null } = {}) {
  return { ids: new Set(aprobadas.map((c) => c.id)), nivel, profileId }
}

/**
 * Qué celebrar, comparando con la marca anterior. `null` si nada.
 *
 * Sin marca previa no se celebra NADA, y esa es la regla que evita el
 * otro fallo posible: abrir la app y comerse de golpe la fiesta de todo
 * lo que se validó ayer. La primera pasada solo toma la referencia.
 *
 * El nivel gana a las misiones cuando coinciden: si una validación sube
 * de nivel, lo que ha pasado es que se ha subido de nivel. Dos
 * celebraciones seguidas por el mismo gesto le quitan valor a la grande.
 */
export function queCelebrar({ antes, aprobadas = [], nivel = 0, profileId = null } = {}) {
  if (!antes || antes.profileId !== profileId) return null

  if (nivel > antes.nivel) {
    return { emoji: '💎', texto: `¡Nivel ${nivel}!`, elogio: '', intensidad: 'hito' }
  }

  const nuevas = aprobadas.filter((c) => !antes.ids.has(c.id))
  if (!nuevas.length) return null

  const xp = nuevas.reduce((t, c) => t + (c.xp || 0), 0)
  const monedas = nuevas.reduce((t, c) => t + (c.coins || 0), 0)
  // El elogio es lo que de verdad tiene efecto; la XP y los Talis
  // acompañan. El orden importa: primero lo que se ha ganado, y el
  // elogio debajo con más peso visual, no al revés.
  const conElogio = nuevas.find((c) => c.praise)

  return {
    emoji: '🌟',
    texto: monedas > 0 ? `+${xp} XP · +${talis(monedas)}` : `+${xp} XP`,
    elogio: conElogio?.praise || '',
    intensidad: 'normal'
  }
}
