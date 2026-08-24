// ------------------------------------------------------------------
// El retrato del gremialista.
//
// Un perfil ya no es solo un emoji: es una figura que se monta por capas
// —cara, peinado, color de túnica— y que **gana equipo al subir de
// nivel**. La identidad y el progreso van por caminos separados a
// propósito:
//
//   · lo que IDENTIFICA (piel, pelo, peinado, color) lo elige la persona
//     y no cambia nunca solo;
//   · lo que CRECE (el equipo) lo pone la escalera de fases y no se
//     elige: se alcanza.
//
// Esa separación es la que evita el problema que hundió la idea de
// comprar cosméticos con Talis. Aquí no se compra nada. La XP no se
// gasta (ver `xpForLevel` en supabase.js), así que desbloquear equipo con
// ella no compite con la tienda de premios reales ni convierte el
// andamio en el motor.
//
// El dibujo vive en components/Retrato.jsx. Aquí solo está lo que se
// puede razonar sin pintar, que es lo que los tests fijan.
// ------------------------------------------------------------------

/**
 * Tope de la escalera. Decisión de la familia (24-ago-2026): «hasta 50 de
 * momento». Por encima el nivel sigue subiendo —la curva 50·L·(L-1) no
 * tiene techo— y lo único que se acaba es el dibujo.
 */
export const NIVEL_TOPE = 50

/**
 * Las nueve fases.
 *
 * Los niveles NO son números redondos, y no es descuido. La curva de
 * nivel es cuadrática, así que repartir fases cada N niveles da saltos de
 * TIEMPO que crecen sin parar: entre dos fases equiespaciadas en nivel
 * pueden pasar tres días al principio y tres años al final.
 *
 * Están colocadas en hitos de CALENDARIO de un adulto que cumple los
 * supuestos de economia.js (8 misiones activas, 60 % de adherencia = 48
 * XP/día): una semana, un mes, tres, seis, un año, dos, cuatro, siete.
 * El nivel es la consecuencia. La junior gana 72 XP/día y llega antes a
 * todas, que es exactamente lo que debe pasar porque hace más.
 *
 * `equipo` no es decoración de la tabla: es lo que Retrato.jsx dibuja, y
 * es acumulativo. El oro entra en la fase 4 y la luz se enciende en la 8,
 * siguiendo la regla de la hoja de estilo: el dorado no decora, reconoce.
 */
export const FASES = [
  { n: 1, nivel: 1, nombre: 'Aprendiz', equipo: 'Túnica y cinto de cuerda' },
  { n: 2, nivel: 3, nombre: 'Ayudante', equipo: 'Pañuelo al cuello' },
  { n: 3, nivel: 6, nombre: '{Artesana|Artesano|Artesanía}', equipo: 'Delantal del taller' },
  { n: 4, nivel: 10, nombre: '{Forjadora|Forjador|Forja}', equipo: 'Cinto con hebilla' },
  { n: 5, nivel: 14, nombre: '{Maestra|Maestro|Maestría}', equipo: 'Manto corto' },
  { n: 6, nivel: 20, nombre: '{Decana|Decano|Decanato}', equipo: 'Broche del gremio' },
  { n: 7, nivel: 27, nombre: '{Guardiana|Guardián|Guardia}', equipo: 'Farol, aún apagado' },
  { n: 8, nivel: 38, nombre: '{Insigne|Insigne|Insigne}', equipo: 'Farol encendido' },
  { n: 9, nivel: NIVEL_TOPE, nombre: '{Custodia|Custodio|Custodia} del taller', equipo: 'Filigrana en el manto' }
]

// ------------------------------------------------------------------
// Las piezas que se eligen.
//
// Pocas y con nombre. El catálogo crece con migraciones porque cada
// pieza nueva necesita también su dibujo y su despliegue: no se gana
// nada dejando la columna libre.
// ------------------------------------------------------------------

export const PIELES = [
  { id: 'clara', hex: '#f0c9a8' },
  { id: 'media', hex: '#d9a173' },
  { id: 'tostada', hex: '#b97d4e' },
  { id: 'morena', hex: '#a9724a' },
  { id: 'oscura', hex: '#7a4f30' },
  { id: 'profunda', hex: '#5a3722' }
]

export const PELOS = [
  { id: 'negro', hex: '#2b2118' },
  { id: 'castano', hex: '#5a3a22' },
  { id: 'rubio', hex: '#c9a227' },
  { id: 'pelirrojo', hex: '#b8552e' },
  { id: 'gris', hex: '#8a8ab0' },
  { id: 'blanco', hex: '#dcdce8' }
]

export const PEINADOS = [
  { id: 'corto', nombre: 'Corto' },
  { id: 'largo', nombre: 'Largo' },
  { id: 'rizado', nombre: 'Rizado' }
]

const POR_DEFECTO = { piel: 'media', pelo: 'negro', peinado: 'corto' }

/** XP acumulada que exige un nivel. Misma curva que supabase.js. */
function xpDeNivel(nivel) {
  return 50 * nivel * (nivel - 1)
}

/** El nivel que corresponde a una XP. Misma curva que supabase.js. */
function nivelDeXp(xp) {
  let l = 1
  while (xp >= xpDeNivel(l + 1)) l++
  return l
}

/**
 * La fase que toca a un nivel. Por encima del tope se queda en la última:
 * el progreso no se detiene, se detiene el vestuario.
 */
export function faseDeNivel(nivel) {
  let fase = FASES[0]
  for (const f of FASES) if (nivel >= f.nivel) fase = f
  return fase
}

/**
 * LA REGLA DE LA MARCA DE AGUA, y es la decisión importante de este
 * fichero: la fase se calcula contra la XP MÁXIMA que ha tenido el
 * perfil, nunca contra la de ahora.
 *
 * El README promete que todo se puede deshacer, y deshacer devuelve la
 * XP. Si el personaje se desvistiera al deshacer, un adulto corrigiendo
 * un toque equivocado le estaría quitando el manto a alguien: deshacer
 * pasaría a sentirse como un castigo y la gente dejaría de hacerlo, que
 * es justo lo contrario de lo que se buscaba.
 *
 * Es el mismo razonamiento que ya sostiene el rango del Estandarte, que
 * sobrevive al cierre de una meta aunque la barra se vacíe.
 *
 * La columna `xp_maxima` la mantiene un trigger en Postgres (migración
 * 035) precisamente para que el cliente no pueda olvidarse.
 */
export function faseDePerfil(perfil) {
  const xp = Math.max(Number(perfil?.xp) || 0, Number(perfil?.xp_maxima) || 0)
  return faseDeNivel(nivelDeXp(xp))
}

/**
 * Las piezas de un perfil, con los huecos rellenos.
 *
 * Devuelve siempre algo dibujable: un perfil antiguo —sin ninguna de las
 * tres columnas— sale con las piezas por defecto en vez de romper. Eso es
 * lo que permite desplegar el cliente nuevo sin haber tocado un solo
 * perfil todavía.
 */
export function piezasDe(perfil) {
  const enCatalogo = (lista, valor, fallback) =>
    lista.some((x) => x.id === valor) ? valor : fallback

  return {
    piel: enCatalogo(PIELES, perfil?.retrato_piel, POR_DEFECTO.piel),
    pelo: enCatalogo(PELOS, perfil?.retrato_pelo, POR_DEFECTO.pelo),
    peinado: enCatalogo(PEINADOS, perfil?.retrato_peinado, POR_DEFECTO.peinado)
  }
}

/** El hex de una pieza, buscando en su catálogo. */
export function hexDe(lista, id) {
  const x = lista.find((p) => p.id === id)
  return x ? x.hex : lista[0].hex
}

/**
 * ¿Este perfil lleva figura o medallón de emoji?
 *
 * Las mascotas llevan medallón (decisión del 24-ago-2026: se quedan con
 * emoji «de momento»). No es solo que no haya piezas de perro: es que un
 * perro no tiene fase, y meterlo en la escalera de aprendiz a maestra
 * diría algo que este proyecto no quiere decir sobre un animal.
 */
export function llevaFigura(perfil) {
  return perfil?.role !== 'mascota'
}
