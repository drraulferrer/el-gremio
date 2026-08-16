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

import { dayKey, diaSemana } from './supabase'

/**
 * Los roles a los que apunta una misión, o null si no apunta a ninguno.
 *
 * Lee `target_roles` (array) y, si no está, el `target_role` de una sola
 * pieza que tuvo la columna durante media hora. Aceptar los dos hace que
 * dé igual el orden entre desplegar y migrar: con el orden equivocado, y
 * sin esto, «Hobby» se le aparecería a la peque hasta que cuadraran las
 * dos mitades. Cuando la columna vieja se retire, esta rama sobra.
 */
export function rolesDe(reto) {
  if (Array.isArray(reto?.target_roles) && reto.target_roles.length) return reto.target_roles
  if (reto?.target_role) return [reto.target_role]
  return null
}

/** ¿Esta misión va dirigida a este perfil? No mira si está activa. */
export function esParaPerfil(reto, perfil) {
  if (!reto || !perfil) return false
  if (reto.profile_id) return reto.profile_id === perfil.id
  const roles = rolesDe(reto)
  if (roles) return roles.includes(perfil.role)
  return true
}

/**
 * Las misiones de un perfil. Por defecto solo las activas, que es lo que
 * quieren los tableros; el panel parental pide también las pausadas.
 *
 * `dia` filtra además por el patrón semanal. Va aparte y no siempre
 * puesto porque son dos preguntas distintas: el tablero pregunta «¿qué me
 * toca HOY?» y el panel, la economía y el aviso de carga preguntan «¿qué
 * tiene asignado?». Una misión de lunes y jueves sigue estando asignada
 * un martes: si el panel la escondiera, se editaría dos veces por no
 * encontrarla.
 */
export function misionesDe(perfil, challenges = [], { incluirPausadas = false, dia = null } = {}) {
  return challenges.filter(
    (ch) =>
      (incluirPausadas || ch.active) &&
      esParaPerfil(ch, perfil) &&
      (!dia || tocaEl(ch, dia))
  )
}

// ------------------------------------------------------------------
// Qué días de la semana toca cada misión
//
// Lo pidió la familia: las misiones de la junior y de la peque son las
// mismas todos los días, y hace falta repartirlas —días alternos, lunes
// y jueves, lo que sea—.
//
// SE PLANIFICA POR DÍA DE LA SEMANA, NO POR «SEMANA QUE EMPIEZA HOY».
// Esa es la decisión que sostiene todo lo demás, y es la respuesta a «una
// semana puede empezar cualquier día»: un patrón de siete casillas NO
// TIENE fecha de inicio. Se repite solo, y empezar a usarlo un jueves no
// produce ninguna semana parcial que haya que normalizar. El problema
// desaparece por construcción en vez de resolverse.
//
// Por eso NO existe el modo «cada N días»: ese sí necesita una fecha
// ancla por misión, y con ancla vuelve entero el problema que el patrón
// semanal no tiene. Si algún día se quiere, va con su `anchor_date`.
//
// `null` es «todos los días», que es el comportamiento de siempre y el de
// todas las misiones que ya existen.
// ------------------------------------------------------------------

export const DIAS_SEMANA = [
  { n: 1, letra: 'L', nombre: 'lunes' },
  { n: 2, letra: 'M', nombre: 'martes' },
  { n: 3, letra: 'X', nombre: 'miércoles' },
  { n: 4, letra: 'J', nombre: 'jueves' },
  { n: 5, letra: 'V', nombre: 'viernes' },
  { n: 6, letra: 'S', nombre: 'sábado' },
  { n: 7, letra: 'D', nombre: 'domingo' }
]

/**
 * Los días de una misión, ordenados y sin repetidos, o null si va todos
 * los días.
 *
 * Los siete marcados valen null y el conjunto vacío TAMBIÉN: los dos
 * significan lo mismo de cara a quien la hace —«no hay ningún día en el
 * que no toque» y «no hay ningún día en el que toque» son estados que
 * nadie quiere—, y guardar `{}` dejaría una misión activa que no sale
 * nunca en ningún tablero y que nadie sabría por qué no sale.
 */
export function diasDe(reto) {
  if (!Array.isArray(reto?.days)) return null
  const limpios = [...new Set(reto.days.map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b)
  return limpios.length === 0 || limpios.length === 7 ? null : limpios
}

/** ¿Toca esta misión los martes? (1 = lunes … 7 = domingo). */
export function tocaDia(reto, n) {
  const dias = diasDe(reto)
  return !dias || dias.includes(n)
}

/** ¿Toca esta misión esa fecha? Sin patrón, todos los días. */
export function tocaEl(reto, fecha = new Date()) {
  return tocaDia(reto, diaSemana(fecha))
}

/**
 * Marcar o desmarcar un día, para el formulario. Devuelve siempre lo que
 * se guarda en la columna, ya normalizado: nunca los siete, nunca vacío.
 */
export function alternarDia(days, n) {
  const actuales = diasDe({ days }) || DIAS_SEMANA.map((d) => d.n)
  const nuevos = actuales.includes(n) ? actuales.filter((x) => x !== n) : [...actuales, n]
  return diasDe({ days: nuevos })
}

/** Cómo se lee el patrón en una lista. */
export function textoDias(reto) {
  const dias = diasDe(reto)
  if (!dias) return 'Todos los días'
  return dias.map((n) => DIAS_SEMANA.find((d) => d.n === n)?.nombre).join(', ')
}

/**
 * Los días de los últimos `ventana` en los que esta persona NO tenía
 * ninguna misión asignada.
 *
 * Son los días NEUTROS de la racha: ni la rompen ni la alargan. Sin esto
 * la planificación por días se lleva por delante el sistema de rachas —a
 * quien le tocan lunes, miércoles y viernes, el martes no tiene nada que
 * hacer y hoy eso le rompería la racha—, que es la razón por la que las
 * dos cosas se construyen a la vez y no una detrás de otra.
 *
 * Dos cautelas dentro:
 *
 *  · Si no tiene NINGUNA misión activa no hay días neutros. Sin este
 *    corte, un perfil recién creado tendría los 400 días neutros y su
 *    racha caminaría hacia atrás hasta el tope sin haber hecho nada.
 *  · Se mira el patrón de HOY, no el que había entonces. La columna no
 *    guarda historia y no va a guardarla: reconstruir «qué días le
 *    tocaban en marzo» pediría versionar la tabla entera para afinar un
 *    número que ya es una aproximación amable.
 */
export function diasNeutros(perfil, challenges = [], { hoy = new Date(), ventana = 400 } = {}) {
  const suyas = misionesDe(perfil, challenges)
  // El atajo no es solo velocidad: mientras nadie use el patrón semanal,
  // esta función devuelve [] y la racha se comporta exactamente igual que
  // antes de que existiera.
  if (!suyas.length || !suyas.some((ch) => diasDe(ch))) return []

  const salida = []
  const cursor = new Date(hoy)
  for (let i = 0; i < ventana; i++) {
    if (!suyas.some((ch) => tocaEl(ch, cursor))) salida.push(dayKey(cursor))
    cursor.setDate(cursor.getDate() - 1)
  }
  return salida
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

/**
 * Grupos de más de un rol. «Poner la mesa» la hacen la junior y la peque,
 * cada una a su manera, y no tiene sentido que salga en el tablero de los
 * adultos. Son combinaciones con nombre y no una lista de casillas porque
 * a esta escala solo hay dos que se pidan de verdad, y un nombre («Las
 * niñas y el niño no», «los mayores») se elige más rápido que tres
 * casillas que además permiten marcar el conjunto vacío.
 */
export const GRUPOS_ROL = [
  { id: 'ninos', roles: ['junior', 'peque'], etiqueta: 'Los peques y la junior' },
  { id: 'mayores', roles: ['adulto', 'junior'], etiqueta: 'Adultos y junior' }
]

const mismoConjunto = (a = [], b = []) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join()

/** El grupo con nombre que corresponde a unos roles, si lo hay. */
export function grupoDe(roles) {
  if (!roles || roles.length < 2) return null
  return GRUPOS_ROL.find((g) => mismoConjunto(g.roles, roles)) || null
}

/** Cómo se lee el destino de una misión en una lista. */
export function textoDestino(reto, nombrePorId = () => null) {
  if (reto?.profile_id) return nombrePorId(reto.profile_id) || '—'
  const roles = rolesDe(reto)
  if (!roles) return 'Todos'
  return grupoDe(roles)?.etiqueta || ETIQUETA_ROL[roles[0]] || 'Todos'
}

/** De una misión al valor del desplegable. */
export function destinoDe(reto) {
  if (reto?.profile_id) return reto.profile_id
  const roles = rolesDe(reto)
  if (!roles) return ''
  const grupo = grupoDe(roles)
  return grupo ? `grupo:${grupo.id}` : `rol:${roles[0]}`
}

/** Del valor del desplegable a las columnas. Nunca deja las dos puestas. */
export function destinoA(valor) {
  const v = String(valor || '')
  if (!v) return { profile_id: null, target_roles: null }
  if (v.startsWith('grupo:')) {
    const grupo = GRUPOS_ROL.find((g) => g.id === v.slice(6))
    return { profile_id: null, target_roles: grupo ? [...grupo.roles] : null }
  }
  if (v.startsWith('rol:')) return { profile_id: null, target_roles: [v.slice(4)] }
  return { profile_id: v, target_roles: null }
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
