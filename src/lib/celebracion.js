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
