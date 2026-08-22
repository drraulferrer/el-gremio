import { habilidad } from './habilidades'

// ------------------------------------------------------------------
// El Retrato: quién has sido esta semana.
//
// P4 de `docs/RECONOCIMIENTOS.md`, y la pieza más barata de la F3: no
// guarda nada. Se calcula de lo que ya hay cada vez que se pinta.
//
// Por qué existe teniendo sellos: los sellos dan identidad a LARGO plazo
// —73 piezas, cuatro grados por oficio, meses de camino— y no contestan
// la pregunta corta, que es la que uno se hace el domingo: «¿en qué he
// andado yo esta semana?».
//
// Y una regla que manda sobre el contenido: **aquí no se cuenta nada de
// lo recibido**. La spec proponía componerlo también con los gracias, y
// la decisión §10.1 lo acota: se puede decir que alguien se acordó de
// decírtelo, nunca cuántas veces. Un número de reconocimientos recibidos
// convierte esto en un marcador, y el marcador es justo lo que la app no
// tiene a propósito.
// ------------------------------------------------------------------

const DIAS = 7

/**
 * Las habilidades en las que más ha andado esta persona estos siete días,
 * de más a menos. Se lee del contexto CONGELADO de cada completación
 * (`snapshot_skill`) y solo se cae a la misión de hoy si aquella no lo
 * trae: si mañana una misión cambia de habilidad, la semana pasada no
 * puede cambiar con ella.
 */
export function habilidadesDe(profileId, { completions = [], challenges = [] } = {}, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - DIAS * 86400000).toISOString()
  const cuenta = new Map()

  for (const c of completions) {
    if (c.profile_id !== profileId || c.status !== 'aprobado') continue
    if (String(c.resolved_at || '') < desde) continue
    const skill = c.snapshot_skill ?? challenges.find((x) => x.id === c.challenge_id)?.skill ?? null
    if (!skill) continue
    cuenta.set(skill, (cuenta.get(skill) || 0) + 1)
  }

  return [...cuenta.entries()]
    .map(([id, veces]) => ({ id, veces, nombre: habilidad(id)?.nombre || id, emoji: habilidad(id)?.emoji || '' }))
    .sort((a, b) => (b.veces !== a.veces ? b.veces - a.veces : a.id.localeCompare(b.id)))
}

/** ¿Le ha dicho alguien algo esta semana? Sí o no. Nunca cuántas veces. */
export function leHanDicho(profileId, { reconocimientos = [] } = {}, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - DIAS * 86400000).toISOString()
  return reconocimientos.some((r) => r.a_profile === profileId && String(r.created_at || '') >= desde)
}

/**
 * La frase. Dos habilidades como mucho: con tres deja de ser un retrato y
 * pasa a ser un inventario.
 */
export function retratoDe(profileId, datos = {}, ahora = new Date()) {
  const habilidades = habilidadesDe(profileId, datos, ahora)
  const dicho = leHanDicho(profileId, datos, ahora)

  if (habilidades.length === 0) {
    return {
      habilidades,
      frase: dicho
        ? 'Esta semana no hay nada validado todavía, pero alguien se ha acordado de decirte algo.'
        : 'Esta semana todavía no hay nada validado.'
    }
  }

  const dos = habilidades.slice(0, 2).map((h) => h.nombre)
  const donde = dos.length === 2 ? `${dos[0]} y ${dos[1]}` : dos[0]
  const base = `Esta semana el gremio te ha visto sobre todo en ${donde}.`

  return { habilidades, frase: dicho ? `${base} Y alguien se ha acordado de decírtelo.` : base }
}
