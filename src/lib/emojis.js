// ------------------------------------------------------------------
// Emojis para los premios.
//
// Había doce escritos a mano dentro del formulario, y con doce todos los
// premios de una casa acaban pareciéndose: el emoji es lo único que se ve
// de un premio en la tienda de la junior y, en la de la peque, lo ÚNICO
// que se ve, porque ahí no hay texto ni cifras. Que dos premios distintos
// lleven el mismo dibujo es, para ella, el mismo premio.
//
// Van agrupados y con nombre. El nombre no es documentación: es lo que
// hace que el buscador funcione, y con noventa emojis un buscador deja de
// ser un lujo. Los nombres están en castellano y con sinónimos de esta
// casa («peli» además de «película»), porque quien escribe en esa caja
// escribe como habla.
// ------------------------------------------------------------------

export const GRUPOS_EMOJI_PREMIO = [
  {
    grupo: 'Decidir',
    ayuda: 'Elegir algo. Los que mejor aguantan.',
    emojis: [
      { e: '🎬', n: 'película peli cine' },
      { e: '🎵', n: 'música canción' },
      { e: '📖', n: 'cuento libro leer' },
      { e: '🍝', n: 'cena menú pasta' },
      { e: '🥞', n: 'desayuno tortitas' },
      { e: '🗓️', n: 'plan actividad día' },
      { e: '🎲', n: 'juego de mesa dado' },
      { e: '👕', n: 'ropa vestirse' },
      { e: '🧭', n: 'excursión rumbo' },
      { e: '🪑', n: 'sitio asiento mesa' },
      { e: '🎤', n: 'karaoke cantar' },
      { e: '📻', n: 'radio emisora' }
    ]
  },
  {
    grupo: 'En casa',
    ayuda: 'Planes que no cuestan dinero.',
    emojis: [
      { e: '🏕️', n: 'fuerte de mantas acampada dentro' },
      { e: '👩‍🍳', n: 'cocinar receta' },
      { e: '🧁', n: 'repostería magdalena hornear' },
      { e: '🍿', n: 'palomitas sesión' },
      { e: '🛋️', n: 'sofá manta peli' },
      { e: '🎨', n: 'pintar dibujar manualidades' },
      { e: '🧩', n: 'puzle rompecabezas' },
      { e: '🪁', n: 'cometa jugar' },
      { e: '🛁', n: 'baño burbujas' },
      { e: '🌙', n: 'acostarse tarde noche cuento' },
      { e: '💛', n: 'tiempo de calidad juntos' },
      { e: '📣', n: 'elogio delante de todos' }
    ]
  },
  {
    grupo: 'Fuera',
    ayuda: 'Salidas. Cuestan más y valen más.',
    emojis: [
      { e: '🧺', n: 'picnic merienda campo' },
      { e: '🏞️', n: 'excursión monte naturaleza' },
      { e: '🏖️', n: 'playa arena' },
      { e: '🏊', n: 'piscina nadar' },
      { e: '🎡', n: 'feria noria parque de atracciones' },
      { e: '🎢', n: 'montaña rusa atracciones' },
      { e: '🦁', n: 'zoo animales' },
      { e: '🐠', n: 'acuario peces' },
      { e: '🏛️', n: 'museo exposición' },
      { e: '🎳', n: 'bolos bolera' },
      { e: '🛝', n: 'parque columpios tobogán' },
      { e: '🚂', n: 'tren viaje' },
      { e: '⛺', n: 'acampada tienda dormir fuera' },
      { e: '🌳', n: 'parque árbol aire libre' }
    ]
  },
  {
    grupo: 'Comer',
    ayuda: 'Con cuidado: la comida como premio se paga cara.',
    emojis: [
      { e: '🍕', n: 'pizza' },
      { e: '🍦', n: 'helado' },
      { e: '🍫', n: 'chocolate' },
      { e: '🥐', n: 'bollo croissant desayuno' },
      { e: '🍔', n: 'hamburguesa comer fuera' },
      { e: '🍽️', n: 'restaurante comer fuera cena' },
      { e: '🍓', n: 'fresa fruta' },
      { e: '🥤', n: 'batido bebida' },
      { e: '🍪', n: 'galleta' }
    ]
  },
  {
    grupo: 'Jugar y moverse',
    emojis: [
      { e: '⚽', n: 'fútbol pelota balón' },
      { e: '🏀', n: 'baloncesto canasta' },
      { e: '🚲', n: 'bici bicicleta' },
      { e: '🛼', n: 'patines patinar' },
      { e: '🛹', n: 'monopatín skate' },
      { e: '🤸', n: 'gimnasia saltar volteretas' },
      { e: '🥋', n: 'judo kárate artes marciales' },
      { e: '🏓', n: 'ping pong palas' },
      { e: '🧗', n: 'escalada rocódromo' },
      { e: '🏸', n: 'bádminton raqueta' },
      { e: '🎯', n: 'diana puntería juego' },
      { e: '🪀', n: 'yoyó juguete' }
    ]
  },
  {
    grupo: 'Aficiones',
    emojis: [
      { e: '🎮', n: 'videojuego consola pantalla' },
      { e: '🎸', n: 'guitarra música tocar' },
      { e: '🎻', n: 'violín música' },
      { e: '🎹', n: 'piano teclado' },
      { e: '🎭', n: 'teatro disfraz actuar' },
      { e: '📸', n: 'foto cámara' },
      { e: '🔭', n: 'estrellas telescopio astronomía' },
      { e: '🔬', n: 'ciencia experimento microscopio' },
      { e: '🪴', n: 'planta jardín cuidar' },
      { e: '🧶', n: 'lana coser tejer' },
      { e: '✂️', n: 'recortar manualidades' },
      { e: '🧱', n: 'construcción bloques piezas' }
    ]
  },
  {
    grupo: 'Con quien sea',
    ayuda: 'Premios que son una persona, no una cosa.',
    emojis: [
      { e: '👪', n: 'familia todos juntos' },
      { e: '🧑‍🤝‍🧑', n: 'amigo amiga invitar' },
      { e: '🐶', n: 'perro mascota' },
      { e: '🐱', n: 'gato mascota' },
      { e: '👵', n: 'abuela abuelos visita' },
      { e: '🎈', n: 'fiesta globos celebración' },
      { e: '🎂', n: 'cumpleaños tarta' },
      { e: '💌', n: 'carta nota sorpresa' },
      { e: '🌟', n: 'noche especial a solas con papa mama' }
    ]
  },
  {
    grupo: 'Grandes',
    ayuda: 'Para metas largas, no para un martes.',
    emojis: [
      { e: '🏆', n: 'trofeo meta gremio' },
      { e: '🎁', n: 'regalo sorpresa' },
      { e: '🗺️', n: 'viaje mapa aventura' },
      { e: '✈️', n: 'avión viaje' },
      { e: '🎟️', n: 'entrada espectáculo' },
      { e: '🚀', n: 'cohete grande' },
      { e: '🏰', n: 'castillo gremio' },
      { e: '⭐', n: 'estrella premio' }
    ]
  }
]

// ------------------------------------------------------------------
// Y los de las misiones, que son otra cosa.
//
// Aquí no valen los de premio: una misión es una acción de la casa, y el
// dibujo tiene que decir cuál en un vistazo, que es como lo lee la peque
// en su rejilla. Van agrupados por HABILIDAD y no por zona de la casa,
// que es la misma decisión que gobierna el resto del sistema: lo que se
// entrena no es la tarea, es la competencia.
// ------------------------------------------------------------------

export const GRUPOS_EMOJI_MISION = [
  {
    grupo: 'Autonomía',
    ayuda: 'Apañárselas solo.',
    emojis: [
      { e: '👕', n: 'ropa vestirse camiseta' },
      { e: '🧦', n: 'calcetines' },
      { e: '👟', n: 'zapatos zapatillas atarse' },
      { e: '🥿', n: 'zapatos guardar calzado' },
      { e: '👚', n: 'ropa doblar guardar' },
      { e: '💇', n: 'peinarse pelo' },
      { e: '🎒', n: 'mochila colegio preparar' },
      { e: '🛏️', n: 'cama hacer la cama' },
      { e: '🥪', n: 'bocadillo merienda prepararse' },
      { e: '🧠', n: 'pensar decidir resolver' },
      { e: '⏰', n: 'despertador hora levantarse' },
      { e: '🔑', n: 'llaves salir' }
    ]
  },
  {
    grupo: 'Salud',
    ayuda: 'Cuerpo, higiene y descanso.',
    emojis: [
      { e: '🪥', n: 'dientes cepillo' },
      { e: '🧼', n: 'manos jabon lavarse' },
      { e: '🚿', n: 'ducha' },
      { e: '🌊', n: 'agua mojarse' },
      { e: '💧', n: 'beber agua hidratarse' },
      { e: '🍎', n: 'fruta comer sano' },
      { e: '🏃', n: 'correr ejercicio' },
      { e: '🚶', n: 'andar paseo caminar' },
      { e: '🤸', n: 'gimnasia volteretas' },
      { e: '🦘', n: 'saltar' },
      { e: '💃', n: 'bailar' },
      { e: '🧘', n: 'respirar calma relajarse' },
      { e: '🏋️', n: 'pesas fuerza gimnasio' },
      { e: '😴', n: 'dormir siesta descansar' },
      { e: '🌙', n: 'noche acostarse' },
      { e: '🛋️', n: 'descansar sofa' }
    ]
  },
  {
    grupo: 'Responsabilidad',
    ayuda: 'Hacerse cargo de lo suyo.',
    emojis: [
      { e: '🧸', n: 'juguetes recoger' },
      { e: '📚', n: 'libros guardar cuentos' },
      { e: '🧺', n: 'ropa sucia colada llevar' },
      { e: '🔎', n: 'buscar encontrar revisar' },
      { e: '🐶', n: 'mascota perro cuidar' },
      { e: '🖊️', n: 'apuntar boligrafo anotar' },
      { e: '🗓️', n: 'agenda planificar semana' },
      { e: '📊', n: 'cuentas datos revisar' },
      { e: '💰', n: 'dinero ahorro finanzas' },
      { e: '📋', n: 'lista tareas repasar' }
    ]
  },
  {
    grupo: 'Cooperación',
    ayuda: 'Hacer cosas con los demás.',
    emojis: [
      { e: '🍽️', n: 'mesa platos poner' },
      { e: '🍴', n: 'cubiertos llevar' },
      { e: '🧻', n: 'servilletas' },
      { e: '🧷', n: 'pinzas tender' },
      { e: '🧽', n: 'fregar ayudar limpiar' },
      { e: '🧑‍🏫', n: 'enseñar explicar ayudar' },
      { e: '🎲', n: 'juego con otros mesa' },
      { e: '🏞️', n: 'salida en familia excursion' },
      { e: '👥', n: 'equipo juntos' },
      { e: '🤝', n: 'colaborar acuerdo' }
    ]
  },
  {
    grupo: 'Hogar',
    ayuda: 'La casa. Cuidado con lo que hay de adultos.',
    emojis: [
      { e: '🧹', n: 'barrer escoba' },
      { e: '🪴', n: 'plantas regar' },
      { e: '🌀', n: 'lavadora centrifugado' },
      { e: '🫧', n: 'burbujas limpiar' },
      { e: '🧴', n: 'producto limpieza bote' },
      { e: '🛒', n: 'compra supermercado' },
      { e: '🍳', n: 'cocinar sarten' },
      { e: '🔧', n: 'arreglar herramientas' },
      { e: '🚽', n: 'inodoro water bano' },
      { e: '🛁', n: 'banera bano' },
      { e: '🪟', n: 'ventanas cristales' },
      { e: '🗄️', n: 'armario ordenar cajones' },
      { e: '🪑', n: 'sillas muebles' },
      { e: '🗑️', n: 'basura tirar' },
      { e: '🔪', n: 'cuchillo cortar' },
      { e: '🔥', n: 'fuego cocina placa' },
      { e: '♨️', n: 'plancha vapor' },
      { e: '💨', n: 'ventilar aire' },
      { e: '🧊', n: 'congelador hielo nevera' },
      { e: '🔌', n: 'enchufe electrodomestico' },
      { e: '💡', n: 'luz bombilla' },
      { e: '🌡️', n: 'temperatura termostato' },
      { e: '🦠', n: 'desinfectar germenes' },
      { e: '🕳️', n: 'rincones huecos a fondo' },
      { e: '🪜', n: 'escalera altura' },
      { e: '⚠️', n: 'cuidado peligro supervision' },
      { e: '🏡', n: 'casa entera' }
    ]
  },
  {
    grupo: 'Aprendizaje',
    ayuda: 'Leer, estudiar, entender.',
    emojis: [
      { e: '📖', n: 'leer cuento libro' },
      { e: '🧩', n: 'puzle encajar' },
      { e: '🔢', n: 'numeros contar' },
      { e: '🔤', n: 'letras abecedario' },
      { e: '➗', n: 'mates division cuentas' },
      { e: '🌍', n: 'mundo geografia' },
      { e: '💻', n: 'ordenador informatica' },
      { e: '🎓', n: 'estudiar examen curso' },
      { e: '🔬', n: 'ciencia experimento' },
      { e: '🚀', n: 'espacio cohete' },
      { e: '🗺️', n: 'mapa explorar' },
      { e: '📰', n: 'noticias leer prensa' }
    ]
  },
  {
    grupo: 'Creatividad',
    ayuda: 'Inventar y hacer.',
    emojis: [
      { e: '🎨', n: 'pintar dibujar' },
      { e: '🖍️', n: 'colorear ceras' },
      { e: '✂️', n: 'recortar manualidades' },
      { e: '✍️', n: 'escribir redactar' },
      { e: '📓', n: 'cuaderno diario' },
      { e: '🎻', n: 'violin musica tocar' },
      { e: '🪁', n: 'cometa inventar jugar' },
      { e: '🧱', n: 'construir bloques piezas' },
      { e: '🎭', n: 'teatro disfraz' },
      { e: '📷', n: 'foto camara' }
    ]
  },
  {
    grupo: 'Amabilidad',
    ayuda: 'Cómo se trata a los demás.',
    emojis: [
      { e: '🫶', n: 'carino abrazo querer' },
      { e: '🤲', n: 'compartir dar' },
      { e: '💬', n: 'hablar conversar contar' },
      { e: '⏳', n: 'esperar turno paciencia' },
      { e: '🙏', n: 'gracias por favor pedir' },
      { e: '👭', n: 'hermana hermano amigo ayudar' },
      { e: '📵', n: 'sin pantallas atencion' },
      { e: '🍻', n: 'brindis celebrar juntos' },
      { e: '💐', n: 'detalle regalo flores' },
      { e: '📞', n: 'llamar telefono' }
    ]
  }
]

/** Lista plana de los de misión. */
export const EMOJIS_MISION = GRUPOS_EMOJI_MISION.flatMap((g) => g.emojis)

/** Lista plana, por si hace falta recorrerla entera. */
export const EMOJIS_PREMIO = GRUPOS_EMOJI_PREMIO.flatMap((g) => g.emojis)

/**
 * Busca por nombre en el catálogo que se le pase. Sin acentos y sin
 * mayúsculas, porque nadie escribe «película» con tilde en una caja de
 * búsqueda.
 */
export function buscarEmoji(texto, catalogo = EMOJIS_PREMIO) {
  const limpio = normalizar(texto)
  if (!limpio) return catalogo
  return catalogo.filter((x) => normalizar(x.n).includes(limpio))
}

/**
 * El emoji que le pega a un título.
 *
 * Se usa solo al CREAR, y solo mientras el emoji siga siendo el que venía
 * por defecto: en cuanto alguien elige uno a mano, manda esa elección.
 * Escribir «Elegir la peli del viernes» y ver aparecer 🎬 ahorra el paso
 * de bajar a la rejilla, que es donde se abandona.
 */
export function emojiSugerido(titulo, porDefecto = '🎁', catalogo = EMOJIS_PREMIO) {
  const limpio = normalizar(titulo)
  if (!limpio) return porDefecto
  // Gana la palabra más larga que aparezca: «cuento» le gana a «ver» en
  // «ver un cuento». Y en caso de empate gana la que aparece MÁS TARDE en
  // el título, porque en castellano el objeto va detrás del verbo y es el
  // objeto el que manda: «Limpiar el inodoro» es 🚽, no 🧽.
  let mejor = null
  for (const x of catalogo) {
    for (const palabra of normalizar(x.n).split(' ')) {
      if (palabra.length < 3) continue
      const donde = limpio.indexOf(palabra)
      if (donde < 0) continue
      const gana = !mejor ||
        palabra.length > mejor.largo ||
        (palabra.length === mejor.largo && donde > mejor.donde)
      if (gana) mejor = { e: x.e, largo: palabra.length, donde }
    }
  }
  return mejor ? mejor.e : porDefecto
}

function normalizar(texto) {
  return (texto || '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
