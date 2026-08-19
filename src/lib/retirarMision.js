import { supabase } from './supabase'

// ------------------------------------------------------------------
// Borrar una misión, o retirarla si tiene historia.
//
// Antes el botón decía «¿Borrar … y su historial?» y hacía exactamente
// eso: la cascada se llevaba las completaciones. Desde la migración 029
// la clave es `restrict`, porque no pueden ser verdad a la vez estas dos
// cosas:
//
//   · una insignia ganada no se pierde;
//   · cualquiera puede borrar la prueba de que se ganó.
//
// Quien borra una misión casi nunca quiere borrar el año pasado: quiere
// que deje de salir. Eso es retirarla, y es el flujo que ya existía.
//
// Se INTENTA borrar y se mira lo que dice Postgres, en vez de contar
// primero las completaciones cargadas: el tablero solo tiene las 400
// recientes, así que una misión con historia antigua parecería vacía y
// el borrado fallaría igual, pero con un mensaje incomprensible.
// ------------------------------------------------------------------

/** Violación de clave ajena: hay filas que dependen de esta. */
const TIENE_HISTORIA = '23503'

/**
 * Devuelve `{ resultado, error }` donde resultado es:
 *   'borrada'   → no tenía historia y ya no existe
 *   'retirada'  → tenía historia; deja de aparecer y se conserva
 *   'cancelado' → la persona dijo que no
 */
export async function borrarORetirar(mision, { confirmar = window.confirm } = {}) {
  const titulo = mision.titulo || mision.title || 'esta misión'

  if (!confirmar(`¿Borrar "${titulo}"?`)) {
    return { resultado: 'cancelado', error: null }
  }

  const { error } = await supabase.from('challenges').delete().eq('id', mision.id)
  if (!error) return { resultado: 'borrada', error: null }

  if (error.code !== TIENE_HISTORIA) return { resultado: null, error }

  const seguir = confirmar(
    `"${titulo}" ya tiene historial, y ahí está la prueba de las insignias que sostiene.\n\n` +
    '¿La retiramos en su lugar? Dejará de aparecer en el tablero y todo lo hecho se conserva.'
  )
  if (!seguir) return { resultado: 'cancelado', error: null }

  const { error: fallo } = await supabase
    .from('challenges')
    .update({ active: false })
    .eq('id', mision.id)

  return fallo ? { resultado: null, error: fallo } : { resultado: 'retirada', error: null }
}
