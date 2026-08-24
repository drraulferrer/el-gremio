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
  { id: 'palida', hex: '#f7ddc4' },
  { id: 'clara', hex: '#f0c9a8' },
  { id: 'media', hex: '#d9a173' },
  { id: 'tostada', hex: '#b97d4e' },
  { id: 'morena', hex: '#a9724a' },
  { id: 'oscura', hex: '#7a4f30' },
  { id: 'profunda', hex: '#5a3722' },
  { id: 'ebano', hex: '#402515' }
]

export const PELOS = [
  { id: 'negro', hex: '#2b2118' },
  { id: 'castano', hex: '#5a3a22' },
  { id: 'castanoclaro', hex: '#8c6239' },
  { id: 'rubio', hex: '#c9a227' },
  { id: 'pelirrojo', hex: '#b8552e' },
  { id: 'gris', hex: '#8a8ab0' },
  { id: 'blanco', hex: '#dcdce8' },
  // Uno que no es de nadie y por eso lo quiere todo el mundo con once
  // años. No desentona: sale del violeta que ya usa la app.
  { id: 'violeta', hex: '#9b7fd4' }
]

export const PEINADOS = [
  { id: 'corto', nombre: 'Corto' },
  { id: 'largo', nombre: 'Largo' },
  { id: 'rizado', nombre: 'Rizado' },
  { id: 'coleta', nombre: 'Coleta' },
  { id: 'mono', nombre: 'Moño' },
  { id: 'trenzas', nombre: 'Trenzas' },
  { id: 'rapado', nombre: 'Rapado' },
  // Sin pelo es un peinado más y no una casilla aparte: así el editor
  // sigue siendo una sola elección y no una elección con excepción.
  { id: 'calvo', nombre: 'Sin pelo' }
]

/**
 * Gafas. Es la pieza que más rinde de todas las que se pueden añadir, y
 * no por gusto: como las listas dibujan solo la cabeza, únicamente lo que
 * está en la cara sirve para distinguir a alguien de un vistazo. Una
 * túnica nueva no ayuda a saber quién es; unas gafas, sí.
 */
export const GAFAS = [
  { id: 'ninguna', nombre: 'Sin gafas' },
  { id: 'redondas', nombre: 'Redondas' },
  { id: 'cuadradas', nombre: 'Cuadradas' }
]

/**
 * Barba. Va del color del pelo, como en la vida: no es una elección
 * aparte porque un color de barba independiente del pelo se ve raro casi
 * siempre y añade un mando más a un formulario que ya tiene seis.
 */
export const BARBAS = [
  { id: 'ninguna', nombre: 'Sin barba' },
  { id: 'bigote', nombre: 'Bigote' },
  { id: 'perilla', nombre: 'Perilla' },
  { id: 'corta', nombre: 'Barba corta' },
  { id: 'larga', nombre: 'Barba larga' }
]

/**
 * Color de la túnica, separado del color del miembro.
 *
 * Eran el mismo dato y por eso el aro y la ropa iban siempre a juego.
 * Partirlos multiplica las combinaciones sin dibujar una sola pieza
 * nueva, que es la ampliación más barata que tiene este retrato.
 *
 * `null` sigue significando «la del color del miembro», así que nadie
 * tiene que elegir para que se vea bien.
 */
export const TUNICAS = [
  { id: 'perfil', nombre: 'Como mi color', hex: null },
  { id: 'indigo', hex: '#5a5a9c' },
  { id: 'musgo', hex: '#5f8a5f' },
  { id: 'vino', hex: '#9c5a6a' },
  { id: 'arena', hex: '#b09068' },
  { id: 'pizarra', hex: '#5f7285' },
  { id: 'ciruela', hex: '#7d5f9c' }
]

const POR_DEFECTO = { piel: 'media', pelo: 'negro', peinado: 'corto', gafas: 'ninguna', tunica: 'perfil', barba: 'ninguna' }

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
 * Cada cuántos días de los supuestos de economia.js se considera que la
 * fase siguiente está «cerca».
 *
 * Existe porque enseñar siempre lo que falta sería contraproducente con
 * esta escalera: de la fase 7 a la 8 hay dos años, y de la 8 a la 9,
 * tres. «Te faltan 1.465 días para el farol» no empuja, deshincha. Seis
 * semanas es el horizonte en el que una cifra todavía se siente como algo
 * que depende de ti.
 */
export const DIAS_CERCA = 45

/**
 * La fase siguiente, SOLO si está cerca. `null` el resto del tiempo, que
 * es la mayor parte.
 *
 * Devolver null no es quedarse corto: es la decisión. Lo que se enseña
 * cuando no hay nada cerca es lo que ya se lleva puesto, no una cuenta
 * atrás de años.
 */
export function faseSiguiente(perfil, xpPorDia = 48) {
  const actual = faseDePerfil(perfil)
  const siguiente = FASES.find((f) => f.n === actual.n + 1)
  if (!siguiente) return null

  const xp = Math.max(Number(perfil?.xp) || 0, Number(perfil?.xp_maxima) || 0)
  const faltan = Math.max(0, xpDeNivel(siguiente.nivel) - xp)
  const dias = Math.ceil(faltan / Math.max(1, xpPorDia))

  return dias <= DIAS_CERCA ? { fase: siguiente, faltan, dias } : null
}

/**
 * ¿Este salto de nivel ha traído fase nueva?
 *
 * Lo usa la celebración. Se pregunta por NIVELES y no por perfiles porque
 * quien celebra ya tiene los dos números a mano y no debería tener que
 * fabricar dos perfiles falsos para preguntarlo.
 */
export function hayFaseNueva(nivelAntes, nivelAhora) {
  return faseDeNivel(nivelAhora).n > faseDeNivel(nivelAntes).n
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
    peinado: enCatalogo(PEINADOS, perfil?.retrato_peinado, POR_DEFECTO.peinado),
    gafas: enCatalogo(GAFAS, perfil?.retrato_gafas, POR_DEFECTO.gafas),
    tunica: enCatalogo(TUNICAS, perfil?.retrato_tunica, POR_DEFECTO.tunica),
    barba: enCatalogo(BARBAS, perfil?.retrato_barba, POR_DEFECTO.barba)
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

// ------------------------------------------------------------------
// La paleta del retrato, y por qué está aquí y no en el componente.
//
// El arco de fase iba en oro sobre el aro del miembro, y el oro no
// contrasta con NINGÚN color de la paleta: medido, entre 1,04 (teal) y
// 1,49 (coral). Se veía en las capturas por el fondo de alrededor, no por
// el aro, y en un miembro ámbar directamente no se veía. Nadie lo había
// medido nunca porque el contraste se miraba a ojo.
//
// Ahora las cifras están aquí y hay un test que las vigila: si alguien
// cambia un tono, se entera antes que la familia.
// ------------------------------------------------------------------

export const PALETA_RETRATO = {
  oro: '#f2b33d',
  oroClaro: '#ffd77a',
  oroHondo: '#c9821f',
  // Canal oscuro bajo el arco: le da al oro su propio borde, así que el
  // progreso se lee contra cualquier color de miembro. Mismo tono que la
  // tinta de los ojos, para no meter un color nuevo en la hoja.
  canal: '#1b1b2e',
  apagado: '#5a5a72'
}

/** Contraste WCAG entre dos hex. 1 = idénticos, 21 = negro sobre blanco. */
export function contraste(a, b) {
  const canal = (hex, i) => parseInt(String(hex).slice(1 + i * 2, 3 + i * 2), 16)
  const lineal = (v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const luz = (hex) =>
    0.2126 * lineal(canal(hex, 0)) + 0.7152 * lineal(canal(hex, 1)) + 0.0722 * lineal(canal(hex, 2))
  const [x, y] = [luz(a), luz(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

// ------------------------------------------------------------------
// Mezcla de color, aquí y no en el componente, porque de aquí sale
// también `separar()` y las dos quieren vivir donde hay tests.
// ------------------------------------------------------------------

function mezcla(hex, f, hacia) {
  const n = parseInt(String(hex).slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const d = c.map((v) => Math.round(hacia === 'claro' ? v + (255 - v) * f : v * (1 - f)))
  return '#' + d.map((v) => v.toString(16).padStart(2, '0')).join('')
}

export const oscuro = (hex, f) => mezcla(hex, f, 'oscuro')
export const claro = (hex, f) => mezcla(hex, f, 'claro')

/**
 * Un color que se despegue del fondo sobre el que se pinta.
 *
 * Nace de un fallo que llegó a producción en la 2.24.0: la cara llevaba
 * ojos de tinta fija y el pelo su color tal cual, y sobre una piel muy
 * oscura las dos cosas desaparecían. Medido: en piel «ébano» los ojos
 * contrastaban 1,20 y el pelo negro 1,12, o sea nada. Quien eligiera la
 * piel más oscura del catálogo se quedaba sin cara.
 *
 * No corrige a ojo ni a base de excepciones por tono: mueve el color lo
 * MÍNIMO que haga falta hasta despegarlo, y si ya se veía no lo toca. Por
 * eso una piel clara con pelo negro sale exactamente igual que antes.
 */
export function separar(color, fondo, minimo = 1.9) {
  if (contraste(color, fondo) >= minimo) return color

  let mejor = color
  for (let f = 0.12; f <= 0.72; f += 0.12) {
    for (const candidato of [claro(color, f), oscuro(color, f)]) {
      if (contraste(candidato, fondo) >= minimo) return candidato
      if (contraste(candidato, fondo) > contraste(mejor, fondo)) mejor = candidato
    }
  }
  return mejor
}
