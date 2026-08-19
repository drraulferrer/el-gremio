// ------------------------------------------------------------------
// Traer el historial ENTERO para evaluar los sellos.
//
// El tablero carga las últimas 400 completions y con eso le sobra: dibuja
// la semana, el historial reciente y las misiones de hoy. Los sellos no
// pueden vivir con eso. «Mil días en el Gremio» y «cinco mil aportaciones»
// son preguntas sobre una vida entera, y una familia de cuatro llena esas
// 400 filas en tres semanas.
//
// La otra opción era calcular los agregados en Postgres, que es lo que
// pide INSIGNIAS-02 y sigue siendo el destino. Esto es el paso de en
// medio: se pagina desde el cliente, se piden solo las seis columnas que
// las reglas miran y se ordena por fecha para que las páginas sean
// estables.
//
// El contrato importante es `completa`. Si por lo que sea no se pudo
// traer todo —error de red, tope de seguridad—, sale `false` y el motor
// deja de evaluar las reglas que podrían dar un falso positivo. Mentir
// aquí es conceder insignias que nadie ha ganado.
// ------------------------------------------------------------------

/** Tope de PostgREST por petición. Pedir más de mil no trae más de mil. */
const PAGINA = 1000

/**
 * Freno de mano: 60.000 aprobadas son unos ocho años de una familia de
 * cuatro al ritmo del modelo. Si se llega aquí, algo va mal —un bucle,
 * una familia irreal— y es mejor quedarse corto que encadenar peticiones
 * hasta agotar el móvil de alguien.
 */
const TOPE = 60 * PAGINA

// `id` no lo mira ninguna regla: está para poder añadir después lo nuevo
// sin contar dos veces la misma fila (ver `conNuevas`).
const COLUMNAS = 'id,profile_id,challenge_id,status,xp,requested_at,resolved_at'

/**
 * Todas las completaciones aprobadas de una familia, de la más antigua a
 * la más reciente.
 *
 * Devuelve `{ filas, completa }`. Nunca lanza: un fallo devuelve lo que
 * se hubiera podido leer con `completa: false`, porque media verdad sirve
 * para PINTAR progreso y no sirve para CONCEDER, y quien llama ya sabe
 * distinguir esas dos cosas.
 */
export async function historialAprobado(supabase, familyId) {
  const filas = []

  for (let desde = 0; desde < TOPE; desde += PAGINA) {
    const { data, error } = await supabase
      .from('completions')
      .select(COLUMNAS)
      .eq('family_id', familyId)
      .eq('status', 'aprobado')
      // Ascendente y por una columna `not null`: si el orden no fuera
      // estable, una fila podría colarse en dos páginas o en ninguna.
      .order('requested_at', { ascending: true })
      .range(desde, desde + PAGINA - 1)

    if (error) return { filas, completa: false, error }

    const pagina = data || []
    filas.push(...pagina)

    // Una página incompleta es el final: no hay más que pedir.
    if (pagina.length < PAGINA) return { filas, completa: true, error: null }
  }

  return { filas, completa: false, error: null }
}

/**
 * Añade a un historial ya traído las aprobadas que aún no estén en él.
 *
 * Existe por una razón de coste. `otorgarInsignias` corre después de CADA
 * carga, y una carga ocurre al abrir la app y cada vez que realtime avisa
 * de una validación. Paginar la vida entera en cada una de esas pasadas
 * son veinte peticiones por misión validada en una familia con años de
 * historia: el móvil de alguien pagando el tráfico de una biografía
 * completa para descubrir que no ha cambiado nada.
 *
 * Lo nuevo, en cambio, siempre viene en el lote reciente que el tablero
 * ya tiene cargado. Así que se pagina UNA vez por sesión y a partir de
 * ahí solo se pegan las filas que falten. Se deduplica por `id` porque
 * las dos fuentes se solapan: la última página y el lote reciente
 * comparten las completaciones de los últimos días.
 */
export function conNuevas(historial, recientes = []) {
  const vistas = new Set(historial.filas.map((f) => f.id))
  const nuevas = recientes.filter(
    (c) => c.status === 'aprobado' && c.resolved_at && !vistas.has(c.id)
  )
  if (!nuevas.length) return historial

  return {
    ...historial,
    filas: [...historial.filas, ...nuevas]
  }
}
