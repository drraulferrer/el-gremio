// ------------------------------------------------------------------
// A quién le toca cada misión, y en qué orden se enseñan.
//
// Una misión puede dirigirse a tres sitios distintos:
//
//   · a una persona concreta →  profile_id = su id
//   · a un rol entero        →  profile_id null, target_role 'adulto'
//   · a todo el gremio       →  profile_id null, target_role null
//
// El del medio es nuevo y existe por un problema real: «Planificar el menú
// semanal» la hacen los dos adultos, y la única forma de conseguirlo era
// duplicar la misión, una fila por cada uno. Dos filas que editar, dos que
// pausar, y un historial partido en dos mitades que no se suman. Marcarla
// como «Todos» tampoco valía: se la habría comido también la peque de tres
// años en su pantalla.
//
// `canDo` cuenta las veces hechas POR PERFIL, así que una misión de rol la
// completa cada persona por su cuenta sin quitársela a la otra.
//
// El predicado vive aquí y solo aquí. Antes estaba copiado en cinco
// ficheros —KidHome, Home, dos sitios de ParentPanel y economia—, que es
// exactamente el número de sitios donde había que acordarse de añadir el
// rol para que esto funcionara.
// ------------------------------------------------------------------

/** ¿Esta misión va dirigida a este perfil? No mira si está activa. */
export function esParaPerfil(reto, perfil) {
  if (!reto || !perfil) return false
  if (reto.profile_id) return reto.profile_id === perfil.id
  if (reto.target_role) return reto.target_role === perfil.role
  return true
}

/**
 * Las misiones de un perfil. Por defecto solo las activas, que es lo que
 * quieren los tableros; el panel parental pide también las pausadas.
 */
export function misionesDe(perfil, challenges = [], { incluirPausadas = false } = {}) {
  return challenges.filter((ch) => (incluirPausadas || ch.active) && esParaPerfil(ch, perfil))
}

// ------------------------------------------------------------------
// El destino, como un solo valor para el formulario
//
// En la base son dos columnas, pero en pantalla es UNA pregunta: «¿para
// quién?». Dos desplegables permitirían decir a la vez «para Marta» y
// «para los adultos», que es un estado sin sentido que luego hay que
// explicar. Uno solo lo hace imposible por construcción.
//
// «Cualquier adulto» y no «los adultos» a propósito: el masculino genérico
// está descartado en este proyecto, y «cualquier» es invariable, se lee en
// voz alta sin tropiezos y además describe la regla de verdad —la puede
// hacer cualquiera de ellos, cada cual por su cuenta.
// ------------------------------------------------------------------

export const ETIQUETA_ROL = {
  adulto: 'Cualquier adulto',
  junior: 'Cualquier junior',
  peque: 'Cualquier peque'
}

/** De una misión al valor del desplegable. */
export function destinoDe(reto) {
  if (reto?.profile_id) return reto.profile_id
  if (reto?.target_role) return `rol:${reto.target_role}`
  return ''
}

/** Del valor del desplegable a las dos columnas. Nunca deja las dos puestas. */
export function destinoA(valor) {
  if (!valor) return { profile_id: null, target_role: null }
  if (String(valor).startsWith('rol:')) return { profile_id: null, target_role: String(valor).slice(4) }
  return { profile_id: valor, target_role: null }
}

// ------------------------------------------------------------------
// Agrupación por frecuencia
//
// Una lista plana de quince misiones donde conviven «Lavarse los dientes»
// (hoy, otra vez mañana) y «Planificar el menú» (una vez por semana) obliga
// a leerlas todas para saber cuáles tocan ahora. Separadas, la pregunta
// «¿qué me queda hoy?» se responde mirando el primer bloque.
//
// El orden es por urgencia, de lo que caduca antes a lo que no caduca:
// diario, semanal, mensual y única.
// ------------------------------------------------------------------

export const ORDEN_FRECUENCIA = ['diario', 'semanal', 'mensual', 'unico']

export const FRECUENCIA_TITULO = {
  diario: 'Cada día',
  semanal: 'Esta semana',
  mensual: 'Este mes',
  unico: 'Una sola vez'
}

/**
 * Agrupa por frecuencia respetando ORDEN_FRECUENCIA y descarta los bloques
 * vacíos: un encabezado «Este mes» sin nada debajo es ruido, no estructura.
 * Una frecuencia desconocida no se pierde, cae al final en su propio grupo.
 */
export function agruparPorFrecuencia(misiones = []) {
  const conocidas = ORDEN_FRECUENCIA.map((frecuencia) => ({
    frecuencia,
    titulo: FRECUENCIA_TITULO[frecuencia],
    misiones: misiones.filter((m) => m.frequency === frecuencia)
  }))
  const otras = misiones.filter((m) => !ORDEN_FRECUENCIA.includes(m.frequency))
  const grupos = otras.length
    ? [...conocidas, { frecuencia: 'otras', titulo: 'Otras', misiones: otras }]
    : conocidas
  return grupos.filter((g) => g.misiones.length > 0)
}
