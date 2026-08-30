/**
 * Lo que el tipo de gremio decide, leído de su plantilla.
 *
 * Hasta la migración 053 esto era `family.tipo_gremio === 'piso'` escrito a
 * mano en cada pantalla que lo necesitaba. Con dos tipos y dos efectos se
 * aguantaba; con los tres que vienen y siete ejes de efecto, son decenas de
 * `if` en sitios que nadie recuerda. Es el mismo motivo por el que los números
 * de la expansión dejaron de vivir en `src/lib`: **el tipo es una plantilla, no
 * una condición**.
 *
 * Las dos funciones de aquí abajo son la única puerta. Y las dos caen a lo que
 * hacía el código viejo cuando la plantilla no está —porque la migración no se
 * ha ejecutado, o porque el gremio es más antiguo que ella—, así que la app
 * entera sigue funcionando sin ella.
 */

/** Un texto del vocabulario del tipo. */
export function textoDeTipo(plantilla, clave, porDefecto = '') {
  const v = plantilla?.vocabulario?.[clave]
  return typeof v === 'string' && v.length > 0 ? v : porDefecto
}

/**
 * Un interruptor de las funciones que el tipo enciende o apaga.
 *
 * `porDefecto` es lo que hacía el código antes de la plantilla, y por eso hay
 * que pasarlo siempre: sin plantilla, nada cambia.
 */
export function rasgoDeTipo(plantilla, clave, porDefecto) {
  const v = plantilla?.funciones?.[clave]
  return typeof v === 'boolean' ? v : porDefecto
}
