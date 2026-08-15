// ------------------------------------------------------------------
// El historial, por semanas.
//
// Nada se borra: «archivar» aquí significa salir de la vista, no de la
// base. Borrar historial de verdad sería tirar la XP que sostiene las
// metas ya cerradas y las insignias ya ganadas.
//
// Por qué semanas y no una lista infinita: una lista que solo crece deja
// de leerse al mes. En cambio «esta semana» es una unidad que se puede
// mirar entera, comentar en la cena y comparar con la anterior. Y el
// límite de 400 completions que carga la app cabe holgadamente en varios
// meses de semanas.
//
// La semana empieza en LUNES, igual que `weekKey` en supabase.js, que es
// lo que decide si una misión semanal ya está hecha. Si aquí empezara en
// domingo, el historial y la disponibilidad contarían semanas distintas y
// nadie entendería por qué.
// ------------------------------------------------------------------

const DIA_MS = 86400000

/** El lunes de la semana de esa fecha, a las 00:00 locales. */
export function lunesDe(fecha) {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  // getDay(): 0 es domingo. Se convierte a 1-7 con lunes = 1.
  const dia = d.getDay() || 7
  d.setDate(d.getDate() - (dia - 1))
  return d
}

/** La semana como intervalo [desde, hasta), desplazada N semanas atrás. */
export function semana(referencia, atras = 0) {
  const desde = lunesDe(referencia)
  desde.setDate(desde.getDate() - atras * 7)
  const hasta = new Date(desde.getTime() + 7 * DIA_MS)
  return { desde, hasta, atras }
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

/**
 * Cómo se lee esa semana. «Esta semana» y «La semana pasada» tienen
 * nombre propio porque son las dos que se consultan de verdad; a partir
 * de ahí, las fechas, que es lo que pidieron: poder ir por fechas.
 */
export function etiquetaDeSemana({ desde, hasta, atras }) {
  if (atras === 0) return 'Esta semana'
  if (atras === 1) return 'La semana pasada'
  const fin = new Date(hasta.getTime() - DIA_MS)
  const d1 = desde.getDate()
  const d2 = fin.getDate()
  const m1 = MESES[desde.getMonth()]
  const m2 = MESES[fin.getMonth()]
  const anio = fin.getFullYear() !== new Date().getFullYear() ? ` de ${fin.getFullYear()}` : ''
  return m1 === m2 ? `${d1}–${d2} de ${m1}${anio}` : `${d1} de ${m1} – ${d2} de ${m2}${anio}`
}

/**
 * Lo resuelto de un perfil dentro de esa semana, lo más reciente primero.
 *
 * `estado` existe para poder pedir también lo devuelto sin copiar el
 * filtro de la semana en otro fichero, que es como se acaba con dos
 * definiciones de «semana» que no coinciden en domingo por la noche.
 */
export function validadasDe(completions = [], profileId, rango, estado = 'aprobado') {
  return completions
    .filter((c) => {
      if (c.profile_id !== profileId || c.status !== estado || !c.resolved_at) return false
      const t = new Date(c.resolved_at).getTime()
      return t >= rango.desde.getTime() && t < rango.hasta.getTime()
    })
    .sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at))
}

/**
 * Cuántas semanas hacia atrás hay algo que enseñar. Sirve para no dejar
 * navegar hasta 1970: una flecha que lleva a diez pantallas vacías es
 * peor que no tener flecha.
 */
export function semanasConDatos(completions = [], profileId, referencia = new Date()) {
  const suyas = completions.filter(
    (c) => c.profile_id === profileId && c.status === 'aprobado' && c.resolved_at
  )
  if (!suyas.length) return 0
  const masVieja = suyas.reduce(
    (min, c) => Math.min(min, new Date(c.resolved_at).getTime()),
    Infinity
  )
  const lunesActual = lunesDe(referencia).getTime()
  const lunesViejo = lunesDe(new Date(masVieja)).getTime()
  return Math.max(0, Math.round((lunesActual - lunesViejo) / (7 * DIA_MS)))
}

/** El resumen de la semana: lo que se mira antes que la lista. */
export function resumenDeSemana(validadas = []) {
  return {
    misiones: validadas.length,
    xp: validadas.reduce((t, c) => t + (c.xp || 0), 0),
    monedas: validadas.reduce((t, c) => t + (c.coins || 0), 0),
    conElogio: validadas.filter((c) => c.praise).length
  }
}
