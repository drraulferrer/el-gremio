// ------------------------------------------------------------------
// Las ocho habilidades del gremio.
//
// Este es el cambio de fondo del sistema: una misión no es una tarea que
// se cobra, es un entrenamiento de una habilidad. El objetivo deja de ser
// "hacer la cama" y pasa a ser "volverse más autónoma". La diferencia no
// es de redacción: cambia qué se refuerza y, con ello, cuánto dura la
// motivación cuando la novedad se apaga.
//
// Base: teoría de la autodeterminación (Ryan y Deci, 2000). Las tres
// necesidades que sostienen un hábito son autonomía, competencia y
// relación. Las habilidades hacen visible la competencia; poder elegir
// misiones da autonomía; la meta del gremio pone la relación.
// ------------------------------------------------------------------

export const HABILIDADES = [
  {
    id: 'hogar',
    nombre: 'Hogar',
    emoji: '🏡',
    icono: '/assets/icono-hogar.png',
    color: '#7fb3ff',
    lema: 'Cuidar el sitio donde vivimos'
  },
  {
    id: 'salud',
    nombre: 'Salud',
    emoji: '💪',
    icono: '/assets/icono-salud.png',
    color: '#6ee7a0',
    lema: 'Cuidar el cuerpo y el descanso'
  },
  {
    id: 'aprendizaje',
    nombre: 'Aprendizaje',
    emoji: '📚',
    icono: '/assets/icono-aprendizaje.png',
    color: '#ffd166',
    lema: 'Saber algo que ayer no sabías'
  },
  {
    id: 'amabilidad',
    nombre: 'Amabilidad',
    emoji: '❤️',
    icono: '/assets/icono-amabilidad.png',
    color: '#ff6b6b',
    lema: 'Tratar bien a quien tienes cerca'
  },
  {
    id: 'responsabilidad',
    nombre: 'Responsabilidad',
    emoji: '🌱',
    icono: '/assets/icono-responsabilidad.png',
    color: '#8fd694',
    lema: 'Hacerse cargo de lo propio'
  },
  {
    id: 'cooperacion',
    nombre: 'Cooperación',
    emoji: '🤝',
    icono: '/assets/icono-cooperacion.png',
    color: '#4ecdc4',
    lema: 'Sacar las cosas adelante en equipo'
  },
  {
    id: 'creatividad',
    nombre: 'Creatividad',
    emoji: '🎨',
    icono: '/assets/icono-creatividad.png',
    color: '#c9a0ff',
    lema: 'Hacer aparecer algo que no estaba'
  },
  {
    id: 'autonomia',
    nombre: 'Autonomía',
    emoji: '🧠',
    icono: '/assets/icono-autonomia.png',
    color: '#ffa96b',
    lema: 'Poder solo, sin que nadie lo recuerde'
  }
]

export const IDS_HABILIDAD = HABILIDADES.map((h) => h.id)

const PORID = Object.fromEntries(HABILIDADES.map((h) => [h.id, h]))

export function habilidad(id) {
  return PORID[id] || null
}

/**
 * XP acumulada por habilidad para un perfil, contando solo lo aprobado.
 * Es lo que alimenta la pantalla de progreso: ver que una barra sube es
 * la forma más directa de sentirse capaz.
 */
export function xpPorHabilidad(profileId, completions, challenges) {
  const porReto = Object.fromEntries(challenges.map((c) => [c.id, c.skill]))
  const acumulado = Object.fromEntries(IDS_HABILIDAD.map((id) => [id, 0]))

  for (const c of completions) {
    if (c.profile_id !== profileId || c.status !== 'aprobado') continue
    const skill = porReto[c.challenge_id]
    if (skill && acumulado[skill] !== undefined) acumulado[skill] += c.xp
  }
  return acumulado
}

/** Habilidad con más XP; sirve para titular el carnet ("aprendiz de..."). */
export function habilidadDominante(acumulado) {
  const entradas = Object.entries(acumulado).filter(([, xp]) => xp > 0)
  if (entradas.length === 0) return null
  const [id] = entradas.sort((a, b) => b[1] - a[1])[0]
  return habilidad(id)
}

/**
 * Rango dentro de una habilidad. Escala corta a propósito: la primera
 * subida llega pronto, que es cuando más falta hace ver que se avanza.
 */
// Aprendiz, Oficial y Leyenda valen igual para cualquier género; las dos
// del medio no, así que llevan sus tres formas. Las neutras son nombres
// de rango en abstracto, como "Bronce" u "Oro": no describen a nadie.
const RANGOS = [
  { desde: 0, nombre: 'Aprendiz' },
  { desde: 100, nombre: 'Oficial' },
  { desde: 300, nombre: '{Veterano|Veterana|Veteranía}' },
  { desde: 700, nombre: '{Maestro|Maestra|Maestría}' },
  { desde: 1500, nombre: 'Leyenda' }
]

export function rangoDeHabilidad(xp) {
  let actual = RANGOS[0]
  let siguiente = RANGOS[1]
  for (let i = 0; i < RANGOS.length; i++) {
    if (xp >= RANGOS[i].desde) {
      actual = RANGOS[i]
      siguiente = RANGOS[i + 1] || null
    }
  }
  const techo = siguiente ? siguiente.desde : actual.desde
  const base = actual.desde
  const pct = siguiente ? Math.round((100 * (xp - base)) / (techo - base)) : 100
  return { nombre: actual.nombre, pct: Math.max(0, Math.min(100, pct)), siguiente: siguiente?.nombre || null, techo }
}
