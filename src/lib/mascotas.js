// ------------------------------------------------------------------
// Perfiles de mascota: catálogo y reglas.
//
// La justificación completa, con la literatura, está en
// `docs/MASCOTAS.md`. Aquí solo lo que el código necesita saber, pero
// hay tres cosas que conviene tener delante al tocar este fichero:
//
// 1. **Ninguna misión puede ser aversiva.** La AVSAB (2021) recomienda
//    solo métodos basados en recompensa, también en agresividad. Si
//    alguien añade aquí «corregir» o «regañar», la app estaría enseñando
//    a la familia a hacerle daño al animal con la coartada de un sistema
//    de puntos. Hay un test que lo vigila.
//
// 2. **Truco y hábito no son lo mismo, y esa distinción sostiene todo.**
//    Demant et al. (2011): los perros entrenados 1–2 veces por semana
//    adquieren MEJOR que los entrenados a diario. Por eso los trucos
//    salen con patrón de días alternos y NO como diarios, al revés que
//    todo lo demás en esta app. Los hábitos sí son diarios, porque ahí la
//    constancia no es una técnica de aprendizaje: es una necesidad del
//    animal.
//
// 3. **Para un gato el premio por defecto no es comida.** Vitale Shreve
//    et al. (2017): el 50 % prefiere interacción social humana frente al
//    37 % que prefiere comida.
// ------------------------------------------------------------------

export const ESPECIES = ['perro', 'gato']

/** Días alternos: lunes, miércoles y viernes. Ver punto 2 de arriba. */
export const DIAS_TRUCO = [1, 3, 5]

export function esMascota(perfil) {
  return perfil?.role === 'mascota'
}

export function especieValida(especie) {
  return ESPECIES.includes(especie)
}

// ------------------------------------------------------------------
// Catálogo de misiones
//
// `tipo`: 'truco' (espaciado) | 'habito' (diario).
// `adulto`: la tiene que hacer o supervisar una persona adulta. Comida,
// medicación, salidas a la calle y manejo veterinario. Un sistema de
// puntos no es garantía de que un menor se acuerde, y el animal depende
// de que se haga.
// ------------------------------------------------------------------

const PERRO = [
  { emoji: '🎯', title: 'Sesión de clicker, 5 minutos', tipo: 'truco', xp: 20, coins: 10 },
  { emoji: '🐕', title: 'Practicar la llamada en casa', tipo: 'truco', xp: 20, coins: 10 },
  { emoji: '🧎', title: 'Sentado y tumbado, con premio', tipo: 'truco', xp: 15, coins: 5 },
  { emoji: '✋', title: 'Dejarse tocar patas y orejas', tipo: 'truco', xp: 20, coins: 10 },
  { emoji: '👃', title: 'Paseo de olfateo, sin prisa', tipo: 'habito', xp: 20, coins: 10, adulto: true },
  { emoji: '🪥', title: 'Cepillado', tipo: 'habito', xp: 10, coins: 5 },
  { emoji: '💧', title: 'Agua limpia y fresca', tipo: 'habito', xp: 10, coins: 5, adulto: true },
  { emoji: '🧩', title: 'Comida en comedero de puzle', tipo: 'habito', xp: 10, coins: 5, adulto: true },
  { emoji: '🦷', title: 'Higiene dental', tipo: 'habito', xp: 15, coins: 5, adulto: true }
]

const GATO = [
  { emoji: '🎯', title: 'Clicker: tocar la mano con el morro', tipo: 'truco', xp: 20, coins: 10 },
  { emoji: '📦', title: 'Entrar solo al transportín', tipo: 'truco', xp: 25, coins: 10 },
  { emoji: '🪶', title: 'Juego con caña, dos ratos cortos', tipo: 'habito', xp: 20, coins: 10 },
  { emoji: '🫱', title: 'Diez minutos de estar juntos', tipo: 'habito', xp: 15, coins: 5 },
  { emoji: '🧹', title: 'Arenero limpio', tipo: 'habito', xp: 15, coins: 5, adulto: true },
  { emoji: '🍽️', title: 'Comida y agua lejos del arenero', tipo: 'habito', xp: 10, coins: 5, adulto: true },
  { emoji: '🧗', title: 'Dejar libre su sitio en alto', tipo: 'habito', xp: 10, coins: 5 },
  { emoji: '👃', title: 'Respetar su olor: no lavarlo todo a la vez', tipo: 'habito', xp: 10, coins: 5 },
  { emoji: '🧩', title: 'Comida en juguete dispensador', tipo: 'habito', xp: 10, coins: 5, adulto: true }
]

/** Las misiones que se ofrecen al dar de alta una mascota. */
export function catalogoDe(especie) {
  if (especie === 'perro') return PERRO
  if (especie === 'gato') return GATO
  return []
}

// ------------------------------------------------------------------
// Catálogo de premios
//
// Con los niveles que ya usa la app: 1 decidir · 2 vivir · 3 celebrar.
// En ninguna de las dos listas el premio principal es comida. Para el
// gato lo dice el estudio de preferencias; para el perro, la misma razón
// por la que esta app pone los premios de nivel 1 por encima de las
// cosas: lo que sostiene el hábito es la autonomía y el rato compartido.
// ------------------------------------------------------------------

const PREMIOS_PERRO = [
  { emoji: '🧭', title: 'Elige él la ruta del paseo', tier: 1, cost: 30 },
  { emoji: '🌳', title: 'Paseo largo de olfateo', tier: 2, cost: 60 },
  { emoji: '🪢', title: 'Sesión de juego de tirar', tier: 2, cost: 50 },
  { emoji: '🧩', title: 'Juguete de puzle nuevo', tier: 2, cost: 90 },
  { emoji: '🏞️', title: 'Excursión a un sitio nuevo', tier: 3, cost: 150 }
]

const PREMIOS_GATO = [
  { emoji: '🛏️', title: 'Elige él dónde dormir: se le deja el sitio', tier: 1, cost: 30 },
  { emoji: '🪶', title: 'Diez minutos de caña sin interrupciones', tier: 2, cost: 50 },
  { emoji: '📦', title: 'Caja nueva', tier: 2, cost: 40 },
  { emoji: '🌿', title: 'Hierba gatera', tier: 2, cost: 60 },
  { emoji: '🧗', title: 'Sitio nuevo en alto para trepar', tier: 3, cost: 150 }
]

export function premiosDe(especie) {
  if (especie === 'perro') return PREMIOS_PERRO
  if (especie === 'gato') return PREMIOS_GATO
  return []
}

/**
 * Cómo se guarda una misión del catálogo.
 *
 * Un truco sale con `days` y frecuencia semanal; un hábito, diario y sin
 * patrón. Es la traducción directa de Demant 2011 al esquema, y es la
 * línea que no hay que "simplificar" poniéndolo todo diario.
 */
export function filaDeMision(plantilla, { familyId, profileId }) {
  const esTruco = plantilla.tipo === 'truco'
  return {
    family_id: familyId,
    profile_id: profileId,
    title: plantilla.title,
    emoji: plantilla.emoji,
    xp: plantilla.xp,
    coins: plantilla.coins,
    frequency: esTruco ? 'semanal' : 'diario',
    days: esTruco ? DIAS_TRUCO : null,
    target_roles: ['mascota'],
    active: true
  }
}

export function filaDePremio(plantilla, { familyId }) {
  return {
    family_id: familyId,
    title: plantilla.title,
    emoji: plantilla.emoji,
    cost: plantilla.cost,
    tier: plantilla.tier,
    target_role: 'mascota',
    active: true
  }
}

/**
 * Los premios que puede canjear este perfil.
 *
 * Sin esto, «paseo largo de olfateo» sale en la tienda de la junior y
 * «tarde de peli» en la del perro. `target_role` nulo significa «de la
 * familia», que es lo que son todos los premios anteriores a esto: la
 * columna nació sin tocar ni una fila.
 */
export function premiosParaPerfil(premios = [], perfil) {
  const paraMascota = esMascota(perfil)
  return premios.filter((r) => (r?.target_role === 'mascota') === paraMascota)
}
