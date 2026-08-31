// ------------------------------------------------------------------
// Expandirse: lo que la pantalla dice, sin la pantalla.
//
// El servidor ya decide todo lo que importa —`oportunidades_expansion()`
// devuelve el estado de cada escalón y `forjar_llave()` lo vuelve a
// comprobar entero antes de cobrar—. Aquí solo se traduce eso a frases.
//
// Y esa separación es la regla de la casa (`SEC-1`): el cliente SOLO
// MUESTRA. Que esta pantalla enseñe un botón no autoriza nada; si el
// servidor dice que no, dice que no, y la pantalla se limita a contarlo
// bien.
//
// Por eso los estados de aquí abajo son EXACTAMENTE los que devuelve
// `oportunidades_expansion`, en el mismo orden, y hay un test que compara
// las dos listas contra `schema.sql`. Si alguien añade un estado en el
// servidor y no aquí, la pantalla se quedaría muda justo en el caso nuevo.
// ------------------------------------------------------------------

/** Los estados que devuelve `oportunidades_expansion()`, en su orden. */
export const ESTADOS = ['forjada', 'tipo_no_forja', 'falta_nivel', 'en_el_limite', 'falta_monedas', 'puedes']

/**
 * Qué se le dice a la persona de un escalón.
 *
 * `puede` no es «tiene permiso»: es «el botón tiene sentido». La respuesta
 * de verdad la da el servidor al pulsarlo.
 */
export function loQueFalta(o = {}) {
  switch (o.estado) {
    case 'forjada':
      return { puede: false, titulo: 'Ya forjada', detalle: 'Esta llave ya es tuya.' }
    case 'tipo_no_forja':
      return {
        puede: false,
        titulo: 'Desde aquí no',
        detalle: 'Este gremio no abre camino a otros. Puedes forjar desde otro de los tuyos.'
      }
    case 'falta_nivel':
      return {
        puede: false,
        titulo: `Nivel ${o.nivel_exigido}`,
        // La XP no se gasta, así que «te falta» aquí es una cuenta atrás
        // honesta: se llega jugando y no se puede acelerar con dinero.
        detalle: `Te faltan ${o.falta_xp} de experiencia en este gremio.`
      }
    case 'en_el_limite':
      return {
        puede: false,
        titulo: 'Estás en el límite',
        // Y se dice antes que el dinero a propósito, igual que en el
        // servidor: no llegar de saldo es cuestión de una semana; esto es
        // una decisión, y merece saberse antes de ahorrar para nada.
        detalle: 'Ya perteneces a todos los gremios que se pueden a la vez. Deja uno para poder forjar.'
      }
    case 'falta_monedas':
      return {
        puede: false,
        titulo: `Faltan ${o.falta_monedas}`,
        detalle: `Tienes el nivel. Te faltan ${o.falta_monedas} para pagarla.`
      }
    case 'puedes':
      return { puede: true, titulo: 'Puedes forjarla', detalle: `Cuesta ${o.coste}.` }
    default:
      // Un estado que esta versión del cliente no conoce. No se inventa un
      // botón: se dice que no se sabe, que es la verdad.
      return { puede: false, titulo: 'No disponible', detalle: '' }
  }
}

/**
 * El escalón que toca mirar: el primero que no esté forjado.
 *
 * Los de más arriba se enseñan, pero el que manda la atención es este.
 */
export function siguienteEscalon(oportunidades = []) {
  return oportunidades.find((o) => o.estado !== 'forjada') || null
}

/** Cuántas llaves tengo sin gastar. */
export function llavesDisponibles(llaves = []) {
  return llaves.filter((l) => l.estado === 'disponible')
}

/**
 * Lo que se le contesta a cada código de `forjar_llave()`.
 *
 * Están TODOS, incluidos los que esta pantalla no debería poder provocar
 * —`sin_pertenencia`, `escalon_desconocido`—, y eso es a propósito: si
 * alguno aparece, es que la pantalla y el servidor han dejado de estar de
 * acuerdo, y un mensaje genérico lo escondería.
 */
export const RESPUESTAS_FORJA = {
  ok: null,
  sin_sesion: 'Se ha cerrado la sesión. Vuelve a entrar.',
  clave_invalida: 'No se ha podido preparar la operación. Inténtalo otra vez.',
  exige_identidad_personal: 'Para forjar necesitas una identidad propia.',
  sin_pertenencia: 'Ya no perteneces a este gremio.',
  sin_personaje: 'No tienes personaje en este gremio.',
  tipo_no_forja: 'Este gremio no abre camino a otros.',
  escalon_desconocido: 'Ese escalón ya no existe. Vuelve a cargar la pantalla.',
  nivel_insuficiente: 'Todavía no tienes nivel para esta llave.',
  ya_forjado: 'Esa llave ya era tuya.',
  en_el_limite: 'Estás en el límite de gremios. Deja uno para poder forjar.',
  sin_monedas: 'No te llega para pagarla.'
}

// `in` y no `??`: la entrada de `ok` vale `null` a propósito —«no digas
// nada»— y `null ?? x` devuelve `x`, así que con el operador cómodo el caso
// bueno salía con cara de fallo. Lo cazó el test.
export function mensajeDeForja(codigo) {
  return codigo in RESPUESTAS_FORJA
    ? RESPUESTAS_FORJA[codigo]
    : 'No se ha podido forjar. Inténtalo dentro de un rato.'
}

/**
 * Y lo mismo para la conversión, que es la puerta de todo esto.
 *
 * `correo_es_la_clave_de_casa` merece su frase entera: es el error que
 * cualquiera cometería la primera vez, porque el correo de la casa es el
 * único que esa persona ha usado nunca con esta app.
 */
export const RESPUESTAS_CONVERSION = {
  ok: null,
  sin_sesion: 'Se ha cerrado la sesión. Vuelve a entrar.',
  correo_invalido: 'Ese correo no tiene buena pinta. Repásalo.',
  correo_no_disponible: 'Ese correo ya está en uso.',
  correo_es_la_clave_de_casa:
    'Ese es el correo con el que entra toda la casa. Tu identidad necesita uno tuyo, distinto de ese.',
  pin_incorrecto: 'El PIN no es correcto.',
  solo_adulto: 'Solo un perfil adulto puede crear una identidad propia.',
  junior_bloqueado: 'Las identidades de menores todavía no están disponibles.',
  ya_es_persona: 'Este personaje ya tiene identidad propia.',
  ya_tienes_solicitud: 'Ya hay una solicitud en marcha. Mira tu correo.',
  no_existe: 'No se encuentra ese personaje.',
  no_es_tuyo: 'Ese personaje no es de este gremio.'
}

export function mensajeDeConversion(codigo) {
  return codigo in RESPUESTAS_CONVERSION
    ? RESPUESTAS_CONVERSION[codigo]
    : 'No se ha podido empezar. Inténtalo dentro de un rato.'
}

/**
 * Y el final del camino: lo que contesta `completar_conversion()` cuando
 * se vuelve desde el enlace del correo.
 *
 * Dos códigos van a `null` a propósito y no es pereza: `ya_clasificada` y
 * `sin_solicitud` son la respuesta NORMAL de quien acaba de fundar un
 * gremio, que llega por este mismo enlace. Enseñarle un error a esa
 * persona sería inventarle un problema el día que se da de alta.
 *
 * `sin_solicitud` es además el único código que depende del aparato: si
 * aquí SÍ se pidió una identidad, entonces es que caducó, y eso hay que
 * decirlo. Ver la nota de `acceso.js`.
 */
export const RESPUESTAS_TERMINAR = {
  ok: null,
  ya_clasificada: null,
  sin_solicitud: null,
  sin_sesion: 'Se ha cerrado la sesión. Vuelve a entrar.',
  correo_sin_confirmar: 'Todavía falta confirmar ese correo. Abre el enlace que te hemos enviado.',
  personaje_ocupado: 'Ese personaje ya tiene otra identidad detrás.',
  ya_estas_en_el_gremio: 'Ya tienes un personaje en ese gremio con otra identidad.'
}

/** El consejo que sirve para todos los finales malos: tu casa sigue ahí. */
const SIGUE_INTACTO =
  'Vuelve a entrar con el correo de tu casa: tu gremio y tu personaje siguen intactos.'

export function mensajeDeTerminar(codigo, habiaSolicitud = false) {
  if (codigo === 'sin_solicitud' && habiaSolicitud) {
    return 'La solicitud de identidad ha caducado: duran 72 horas. ' + SIGUE_INTACTO
  }
  return codigo in RESPUESTAS_TERMINAR
    ? RESPUESTAS_TERMINAR[codigo]
    : 'No se ha podido terminar tu identidad. ' + SIGUE_INTACTO
}

// ------------------------------------------------------------------
// Gastar la llave, e invitar (6.3, segunda mitad).
//
// Mismo criterio que arriba: están TODOS los códigos, incluidos los que la
// pantalla no debería poder provocar. Un `sin_pertenencia` en la bandeja
// significa que pantalla y servidor han dejado de estar de acuerdo, y un
// mensaje genérico lo escondería justo cuando hay que verlo.
// ------------------------------------------------------------------

export const RESPUESTAS_CREAR = {
  ok: null,
  sin_sesion: 'Se ha cerrado la sesión. Vuelve a entrar.',
  exige_identidad_personal: 'Para crear un gremio necesitas una identidad propia.',
  nombre_invalido: 'El nombre tiene que tener entre 2 y 60 caracteres.',
  pin_invalido: 'Hace falta un PIN para el gremio nuevo.',
  pais_invalido: 'Elige un país.',
  tipo_no_ofrecido: 'Ese tipo de gremio no se puede crear todavía.',
  tipo_no_publicado_ahi: 'Ese tipo de gremio no está disponible en ese país.',
  sin_configuracion: 'No se ha podido comprobar el límite. Inténtalo dentro de un rato.',
  en_el_limite: 'Estás en el límite de gremios. Deja uno antes de crear otro.',
  llave_no_existe: 'Esa llave ya no existe.',
  llave_ajena: 'Esa llave no es tuya.',
  llave_no_disponible: 'Esa llave ya se ha usado.'
}

export function mensajeDeCrear(codigo) {
  return codigo in RESPUESTAS_CREAR
    ? RESPUESTAS_CREAR[codigo]
    : 'No se ha podido crear el gremio. Inténtalo dentro de un rato.'
}

export const RESPUESTAS_ACEPTAR = {
  ok: null,
  sin_sesion: 'Se ha cerrado la sesión. Vuelve a entrar.',
  exige_identidad_personal: 'Para entrar en otro gremio necesitas una identidad propia.',
  no_existe: 'Esa invitación ya no existe.',
  no_es_tuya: 'Esa invitación no es para este correo.',
  ya_resuelta: 'Esa invitación ya se había resuelto.',
  // No es un fallo de nadie: es el reloj. Por eso se dice con la fecha y no
  // como un error.
  caducada: 'La invitación ha caducado. Pide que te la manden otra vez.',
  ya_estas_dentro: 'Ya estás en ese gremio.',
  sin_configuracion: 'No se ha podido comprobar el límite. Inténtalo dentro de un rato.',
  en_el_limite: 'Estás en el límite de gremios. Deja uno para poder entrar en otro.',
  hace_falta_llave: 'Para entrar en un gremio más necesitas una llave. Fórjala desde Progreso.',
  llave_no_existe: 'Esa llave ya no existe.',
  llave_ajena: 'Esa llave no es tuya.',
  llave_no_disponible: 'Esa llave ya se ha usado.'
}

export function mensajeDeAceptar(codigo) {
  return codigo in RESPUESTAS_ACEPTAR
    ? RESPUESTAS_ACEPTAR[codigo]
    : 'No se ha podido aceptar. Inténtalo dentro de un rato.'
}

export const RESPUESTAS_INVITAR = {
  ok: null,
  sin_sesion: 'Se ha cerrado la sesión. Vuelve a entrar.',
  no_es_tuyo: 'Ese gremio no es tuyo.',
  no_puede: 'No tienes permiso para invitar en este gremio.',
  correo_invalido: 'Ese correo no tiene buena pinta. Repásalo.',
  ya_esta_dentro: 'Esa persona ya está en el gremio.',
  ya_invitada: 'Ya hay una invitación en marcha para ese correo.',
  gremio_lleno: 'El gremio está lleno.',
  sin_configuracion: 'No se ha podido preparar la invitación. Inténtalo dentro de un rato.'
}

export function mensajeDeInvitar(codigo) {
  return codigo in RESPUESTAS_INVITAR
    ? RESPUESTAS_INVITAR[codigo]
    : 'No se ha podido invitar. Inténtalo dentro de un rato.'
}

/**
 * Si una invitación se puede aceptar todavía.
 *
 * El estado ya viene resuelto del servidor —una pendiente vencida se lee
 * como caducada— así que aquí no se vuelve a mirar el reloj: mirarlo sería
 * tener dos relojes, y `T-3` dice que el que manda es el del servidor.
 */
export function aceptables(invitaciones = []) {
  return invitaciones.filter((i) => i.estado === 'pendiente')
}

// ------------------------------------------------------------------
// Fase 7: reclamar un perfil, y la credencial compartida.
// ------------------------------------------------------------------

export const RESPUESTAS_RECLAMAR = {
  ok: null,
  sin_sesion: 'Se ha cerrado la sesión. Vuelve a entrar.',
  exige_identidad_personal: 'Para reclamar un personaje necesitas una identidad propia.',
  // El mismo mensaje para «no existe» y para «existe y no se puede», porque
  // el servidor devuelve el mismo código a propósito (`SEC-9`). Escribir dos
  // frases distintas aquí desharía en el cliente lo que allí se cuidó.
  no_reclamable: 'Ese identificador no sirve para reclamar ningún personaje.',
  junior_bloqueado: 'Los personajes de menores todavía no se pueden reclamar.',
  ya_tienes_personaje: 'Ya tienes un personaje en ese gremio.',
  ya_estas_dentro: 'Ya perteneces a ese gremio.',
  ya_solicitada: 'Ya hay una solicitud en marcha para ese personaje.',
  sin_configuracion: 'No se ha podido preparar la solicitud. Inténtalo dentro de un rato.'
}

export function mensajeDeReclamar(codigo) {
  return codigo in RESPUESTAS_RECLAMAR
    ? RESPUESTAS_RECLAMAR[codigo]
    : 'No se ha podido pedir. Inténtalo dentro de un rato.'
}

export const RESPUESTAS_APROBAR = {
  ok: null,
  sin_sesion: 'Se ha cerrado la sesión. Vuelve a entrar.',
  no_existe: 'Esa solicitud ya no existe.',
  no_es_tuyo: 'Ese gremio no es tuyo.',
  no_puede: 'No tienes permiso para aprobar esto.',
  ya_resuelta: 'Esa solicitud ya estaba resuelta.',
  caducada: 'La solicitud ha caducado. Que la vuelvan a pedir.',
  perfil_no_disponible: 'Ese personaje ya no está disponible.',
  ya_reclamado: 'Ese personaje ya tiene una identidad detrás.',
  sin_configuracion: 'No se ha podido comprobar el límite. Inténtalo dentro de un rato.',
  // Es de la persona que reclama, no de quien aprueba, y conviene decirlo:
  // si no, la administración cree que el fallo es suyo.
  en_el_limite: 'Esa persona está en su límite de gremios. No se puede aprobar hasta que deje uno.',
  sin_cuenta: 'Esa persona ya no tiene cuenta.'
}

export function mensajeDeAprobar(codigo) {
  return codigo in RESPUESTAS_APROBAR
    ? RESPUESTAS_APROBAR[codigo]
    : 'No se ha podido aprobar. Inténtalo dentro de un rato.'
}

/**
 * Por qué no se puede quitar la clave compartida.
 *
 * Los motivos vienen del inventario del servidor, y cada uno se explica con
 * la salida: decir solo «no se puede» deja a alguien atascado sin saber qué
 * le falta.
 */
export const MOTIVOS_CREDENCIAL = {
  no_es_tuyo: 'Este gremio no es tuyo.',
  sin_persona_con_administracion:
    'Hace falta al menos una persona con identidad propia que administre el gremio. ' +
    'Sin ella, nadie podría entrar a gestionarlo.',
  adultos_sin_identidad:
    'Hay perfiles de personas adultas sin identidad propia. Si se quita la clave común, ' +
    'se quedarían fuera: primero tienen que crearse la suya.',
  nadie_para_operarlos:
    'Quedan perfiles que no pueden tener identidad —peques, mascotas— y nadie con ' +
    'identidad propia que se ocupe de ellos.'
}

export function motivoDeCredencial(codigo) {
  return MOTIVOS_CREDENCIAL[codigo] || 'No se puede quitar todavía.'
}

export const RESPUESTAS_CREDENCIAL = {
  ok: null,
  sin_sesion: 'Se ha cerrado la sesión. Vuelve a entrar.',
  exige_identidad_personal: 'Esto lo tiene que hacer una persona con su propia identidad.',
  no_es_tuyo: 'Este gremio no es tuyo.',
  no_puede: 'No tienes permiso para esto.',
  ya_desactivada: 'Este gremio ya no tiene clave común.',
  ya_hay_una: 'Este gremio ya tiene una clave común.',
  cuenta_no_existe: 'No hay ninguna cuenta con ese correo. Créala antes y confirma el correo.',
  correo_sin_confirmar: 'Esa cuenta todavía no ha confirmado su correo.',
  cuenta_ya_clasificada: 'Ese correo ya se usa para otra cosa. La clave nueva tiene que ser una cuenta nueva.'
}

export function mensajeDeCredencial(codigo) {
  if (typeof codigo === 'string' && codigo.startsWith('bloqueada:')) {
    return motivoDeCredencial(codigo.slice('bloqueada:'.length))
  }
  return codigo in RESPUESTAS_CREDENCIAL
    ? RESPUESTAS_CREDENCIAL[codigo]
    : 'No se ha podido. Inténtalo dentro de un rato.'
}
