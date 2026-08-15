// ------------------------------------------------------------------
// Catálogo de misiones, por rol y por habilidad.
//
// Los títulos son los que escribió la familia, literales. Se respetan
// aunque sean sustantivos sueltos ("Encimera", "Finanzas"): esta es la
// versión base y la personalización viene después, no antes.
//
// Cada tarea lleva hasta cuatro cosas:
//   t      título, tal cual. Es lo que se ve.
//   a      la acción en infinitivo, solo cuando el título es un
//          sustantivo. La usan las frases de elogio: sin ella saldría
//          "Te has acordado tú de encimera" en vez de "de limpiar la
//          encimera".
//   skill  qué habilidad entrena.
//   f      frecuencia sugerida: diario · semanal · mensual · unico.
//
// Sin puntos: nacen al activar la misión para una persona concreta, que
// es donde vive la proporcionalidad por edades. Los matices de seguridad
// van entre paréntesis en el propio título, no en una nota aparte.
// ------------------------------------------------------------------

// Valores por defecto al activar, según el rol. A quien más le cuesta,
// más XP. Los adultos puntúan bajo en lo trivial para no inflar la meta
// cooperativa con tareas que ya hacían igualmente.
export const DEFAULTS_ROL = {
  peque: { xp: 10, coins: 5 },
  junior: { xp: 15, coins: 8 },
  adulto: { xp: 10, coins: 5 }
}

export const CATALOGO = {
  // ----------------------------------------------------------------
  // 3 años. Casi todo diario: a esta edad el hábito se construye por
  // repetición en un contexto estable, no por esfuerzo de voluntad.
  // ----------------------------------------------------------------
  peque: [
    {
      grupo: 'Autocuidado',
      tareas: [
        { t: 'Vestirse sola', e: '👕', f: 'diario', skill: 'autonomia' },
        { t: 'Elegir la ropa', e: '🧦', f: 'diario', skill: 'autonomia' },
        { t: 'Ponerse los zapatos', e: '👟', f: 'diario', skill: 'autonomia' },
        { t: 'Lavarse las manos', e: '🧼', f: 'diario', skill: 'salud' },
        { t: 'Cepillarse los dientes con ayuda', e: '🪥', f: 'diario', skill: 'salud' },
        { t: 'Peinarse', e: '💇', f: 'diario', skill: 'autonomia' },
        { t: 'Llevar la ropa sucia', e: '🧺', f: 'diario', skill: 'responsabilidad' }
      ]
    },
    {
      grupo: 'Organización',
      tareas: [
        { t: 'Recoger juguetes', e: '🧸', f: 'diario', skill: 'responsabilidad' },
        { t: 'Guardar cuentos', e: '📚', f: 'diario', skill: 'responsabilidad' },
        { t: 'Hacer «la búsqueda» de objetos fuera de sitio', e: '🔎', f: 'diario', skill: 'responsabilidad' },
        { t: 'Preparar la mochila', e: '🎒', f: 'diario', skill: 'autonomia' },
        { t: 'Guardar zapatos', e: '🥿', f: 'diario', skill: 'responsabilidad' }
      ]
    },
    {
      grupo: 'Ayudante de casa',
      tareas: [
        { t: 'Poner servilletas', e: '🧻', f: 'diario', skill: 'cooperacion' },
        { t: 'Llevar cubiertos', e: '🍴', f: 'diario', skill: 'cooperacion' },
        { t: 'Llevar fruta', e: '🍎', f: 'diario', skill: 'cooperacion' },
        { t: 'Regar plantas', e: '🪴', f: 'semanal', skill: 'hogar' },
        { t: 'Dar comida a la mascota', e: '🐶', f: 'diario', skill: 'responsabilidad' },
        { t: 'Emparejar calcetines', e: '🧦', f: 'semanal', skill: 'cooperacion' },
        { t: 'Llevar pinzas', e: '🧷', f: 'semanal', skill: 'cooperacion' }
      ]
    },
    {
      grupo: 'Desarrollo',
      tareas: [
        { t: 'Leer un cuento', e: '📖', f: 'diario', skill: 'aprendizaje' },
        { t: 'Dibujar', e: '🖍️', f: 'diario', skill: 'creatividad' },
        { t: 'Hacer un puzle', e: '🧩', f: 'diario', skill: 'aprendizaje' },
        { t: 'Practicar números', e: '🔢', f: 'diario', skill: 'aprendizaje' },
        { t: 'Practicar letras', e: '🔤', f: 'diario', skill: 'aprendizaje' },
        { t: 'Juego libre sin pantallas', a: 'jugar libre, sin pantallas', e: '🪁', f: 'diario', skill: 'creatividad' }
      ]
    },
    {
      grupo: 'Movimiento',
      tareas: [
        { t: 'Bailar', e: '💃', f: 'diario', skill: 'salud' },
        { t: 'Circuito motor', a: 'hacer el circuito motor', e: '🤸', f: 'diario', skill: 'salud' },
        { t: 'Saltar', e: '🦘', f: 'diario', skill: 'salud' },
        { t: 'Caminar', e: '🚶', f: 'diario', skill: 'salud' },
        { t: 'Yoga infantil', a: 'hacer yoga', e: '🧘', f: 'semanal', skill: 'salud' }
      ]
    },
    {
      grupo: 'Social',
      tareas: [
        { t: 'Dar las gracias', e: '🙏', f: 'diario', skill: 'amabilidad' },
        { t: 'Pedir las cosas correctamente', e: '💬', f: 'diario', skill: 'amabilidad' },
        { t: 'Esperar turno', e: '⏳', f: 'diario', skill: 'amabilidad' },
        { t: 'Compartir', e: '🤲', f: 'diario', skill: 'amabilidad' },
        { t: 'Ayudar a alguien', e: '🫶', f: 'diario', skill: 'amabilidad' }
      ]
    }
  ],

  // ----------------------------------------------------------------
  // 11 años. Aquí ya cabe lo semanal y los proyectos propios: es la edad
  // en la que la autonomía deja de ser "hacerlo sola" y pasa a ser
  // "decidir cuándo y cómo".
  // ----------------------------------------------------------------
  junior: [
    {
      grupo: 'Autocuidado',
      tareas: [
        { t: 'Hacer la cama', e: '🛏️', f: 'diario', skill: 'autonomia' },
        { t: 'Preparar la mochila', e: '🎒', f: 'diario', skill: 'autonomia' },
        { t: 'Organizar el escritorio', e: '🖊️', f: 'semanal', skill: 'responsabilidad' },
        { t: 'Preparar la ropa del día siguiente', e: '👚', f: 'diario', skill: 'autonomia' },
        { t: 'Higiene completa', a: 'hacer la higiene completa', e: '🚿', f: 'diario', skill: 'salud' }
      ]
    },
    {
      grupo: 'Hogar',
      tareas: [
        { t: 'Aspirar', e: '🌀', f: 'semanal', skill: 'hogar' },
        { t: 'Barrer', e: '🧹', f: 'semanal', skill: 'hogar' },
        { t: 'Doblar ropa', e: '👕', f: 'semanal', skill: 'hogar' },
        { t: 'Tender', e: '🧺', f: 'semanal', skill: 'hogar' },
        { t: 'Vaciar lavavajillas (sin objetos peligrosos)', a: 'vaciar el lavavajillas', e: '🫧', f: 'diario', skill: 'hogar' },
        { t: 'Poner mesa', a: 'poner la mesa', e: '🍽️', f: 'diario', skill: 'cooperacion' },
        { t: 'Recoger mesa', a: 'recoger la mesa', e: '🧽', f: 'diario', skill: 'cooperacion' },
        { t: 'Encimera', a: 'limpiar la encimera con productos seguros', e: '🧴', f: 'diario', skill: 'hogar' },
        { t: 'Regar plantas', e: '🪴', f: 'semanal', skill: 'hogar' }
      ]
    },
    {
      grupo: 'Aprendizaje',
      tareas: [
        { t: 'Leer 20 minutos', e: '📚', f: 'diario', skill: 'aprendizaje' },
        { t: 'Idiomas', a: 'practicar idiomas', e: '🌍', f: 'diario', skill: 'aprendizaje' },
        { t: 'Matemáticas', a: 'practicar matemáticas', e: '➗', f: 'diario', skill: 'aprendizaje' },
        { t: 'Instrumento', a: 'tocar el instrumento', e: '🎻', f: 'diario', skill: 'creatividad' },
        { t: 'Proyecto personal', a: 'avanzar su proyecto personal', e: '🚀', f: 'semanal', skill: 'creatividad' },
        { t: 'Manualidades', a: 'hacer manualidades', e: '✂️', f: 'semanal', skill: 'creatividad' },
        { t: 'Programación', a: 'programar', e: '💻', f: 'semanal', skill: 'aprendizaje' },
        { t: 'Escritura', a: 'escribir', e: '✍️', f: 'semanal', skill: 'creatividad' }
      ]
    },
    {
      grupo: 'Salud',
      tareas: [
        { t: 'Ejercicio', a: 'hacer ejercicio', e: '🏃', f: 'diario', skill: 'salud' },
        { t: 'Paseo', a: 'salir a pasear', e: '🚶', f: 'diario', skill: 'salud' },
        { t: 'Estiramientos', a: 'hacer estiramientos', e: '🤸', f: 'diario', skill: 'salud' },
        { t: 'Dormir a la hora', e: '🌙', f: 'diario', skill: 'salud' },
        { t: 'Preparar una merienda saludable', e: '🥪', f: 'diario', skill: 'autonomia' }
      ]
    },
    {
      grupo: 'Desarrollo personal',
      tareas: [
        { t: 'Ayudar a su hermana', e: '👭', f: 'diario', skill: 'amabilidad' },
        { t: 'Enseñar algo', e: '🧑‍🏫', f: 'semanal', skill: 'cooperacion' },
        { t: 'Resolver un problema sola', e: '🧠', f: 'semanal', skill: 'autonomia' },
        { t: 'Gestionar una emoción', e: '🌊', f: 'diario', skill: 'autonomia' },
        { t: 'Practicar gratitud', e: '🙏', f: 'diario', skill: 'amabilidad' },
        { t: 'Diario', a: 'escribir en su diario', e: '📓', f: 'diario', skill: 'creatividad' }
      ]
    }
  ],

  // ----------------------------------------------------------------
  // Adultos. Van con XP baja en lo trivial: el sistema no está para
  // premiarse por fregar, está para que las niñas vean que en esta casa
  // todo el mundo entrena algo.
  // ----------------------------------------------------------------
  adulto: [
    {
      grupo: 'Salud',
      tareas: [
        { t: 'Entrenamiento', a: 'entrenar', e: '🏋️', f: 'diario', skill: 'salud' },
        { t: 'Caminar', e: '🚶', f: 'diario', skill: 'salud' },
        { t: 'Dormir 7-8 h', e: '😴', f: 'diario', skill: 'salud' },
        { t: 'Comer fruta', e: '🍎', f: 'diario', skill: 'salud' },
        { t: 'Beber agua', e: '💧', f: 'diario', skill: 'salud' },
        { t: 'Meditación', a: 'meditar', e: '🧘', f: 'diario', skill: 'salud' }
      ]
    },
    {
      grupo: 'Hogar',
      tareas: [
        { t: 'Limpieza', a: 'limpiar', e: '🧽', f: 'semanal', skill: 'hogar' },
        { t: 'Compra', a: 'hacer la compra', e: '🛒', f: 'semanal', skill: 'hogar' },
        { t: 'Cocina', a: 'cocinar', e: '🍳', f: 'diario', skill: 'hogar' },
        { t: 'Lavadoras', a: 'poner una lavadora', e: '🌊', f: 'diario', skill: 'hogar' },
        { t: 'Reparaciones', a: 'arreglar lo que estaba roto', e: '🔧', f: 'mensual', skill: 'hogar' }
      ]
    },
    {
      grupo: 'Familia',
      tareas: [
        { t: 'Leer con las niñas', e: '📖', f: 'diario', skill: 'amabilidad' },
        { t: 'Juego familiar', a: 'jugar en familia', e: '🎲', f: 'semanal', skill: 'cooperacion' },
        { t: 'Salida', a: 'salir en familia', e: '🏞️', f: 'semanal', skill: 'cooperacion' },
        { t: 'Tiempo individual con cada hija', a: 'pasar tiempo a solas con cada hija', e: '👥', f: 'semanal', skill: 'amabilidad' },
        { t: 'Conversación sin móviles', a: 'conversar sin móviles', e: '📵', f: 'diario', skill: 'amabilidad' }
      ]
    },
    {
      grupo: 'Profesional',
      tareas: [
        { t: 'Formación', a: 'formarse', e: '🎓', f: 'semanal', skill: 'aprendizaje' },
        { t: 'Lectura científica', a: 'leer algo científico', e: '🔬', f: 'semanal', skill: 'aprendizaje' },
        { t: 'Proyecto', a: 'avanzar el proyecto', e: '🚀', f: 'semanal', skill: 'aprendizaje' },
        { t: 'Organización semanal', a: 'organizar la semana', e: '🗓️', f: 'semanal', skill: 'responsabilidad' }
      ]
    },
    {
      grupo: 'Personal',
      tareas: [
        { t: 'Leer', e: '📚', f: 'diario', skill: 'aprendizaje' },
        { t: 'Hobby', a: 'dedicar rato al hobby', e: '🎨', f: 'semanal', skill: 'creatividad' },
        { t: 'Amigos', a: 'ver a los amigos', e: '🍻', f: 'semanal', skill: 'amabilidad' },
        { t: 'Descanso', a: 'descansar de verdad', e: '🛋️', f: 'semanal', skill: 'salud' },
        { t: 'Finanzas', a: 'revisar las finanzas', e: '📊', f: 'mensual', skill: 'responsabilidad' }
      ]
    },
    {
      // Bloque heredado del catálogo doméstico que aportó la familia. Se
      // queda porque es trabajo real de la casa y porque, por riesgo,
      // químicos o altura, solo lo hacen personas adultas.
      grupo: 'Casa a fondo (solo personas adultas)',
      tareas: [
        { t: 'Limpieza completa de inodoros', e: '🚽', f: 'semanal', skill: 'hogar' },
        { t: 'Limpieza profunda de baños', e: '🛁', f: 'semanal', skill: 'hogar' },
        { t: 'Duchas y bañeras', a: 'limpiar duchas y bañeras', e: '🚿', f: 'semanal', skill: 'hogar' },
        { t: 'Mamparas y desincrustado', a: 'desincrustar las mamparas', e: '🫧', f: 'mensual', skill: 'hogar' },
        { t: 'Limpiezas con lejía o químicos fuertes', a: 'limpiar con químicos fuertes', e: '⚠️', f: 'mensual', skill: 'hogar' },
        { t: 'Limpieza profunda de cocina', e: '🍳', f: 'mensual', skill: 'hogar' },
        { t: 'Placa de cocina', a: 'limpiar la placa', e: '🔥', f: 'semanal', skill: 'hogar' },
        { t: 'Horno', a: 'limpiar el horno', e: '♨️', f: 'mensual', skill: 'hogar' },
        { t: 'Campana extractora y filtros', a: 'limpiar la campana y los filtros', e: '💨', f: 'mensual', skill: 'hogar' },
        { t: 'Frigorífico y congelador a fondo', a: 'limpiar el frigorífico a fondo', e: '🧊', f: 'mensual', skill: 'hogar' },
        { t: 'Detrás y debajo de electrodomésticos', a: 'limpiar detrás de los electrodomésticos', e: '🔌', f: 'mensual', skill: 'hogar' },
        { t: 'Armarios altos', a: 'ordenar los armarios altos', e: '🗄️', f: 'mensual', skill: 'hogar' },
        { t: 'Ventanas y cristales de difícil acceso', a: 'limpiar los cristales de difícil acceso', e: '🪟', f: 'mensual', skill: 'hogar' },
        { t: 'Persianas', a: 'limpiar las persianas', e: '🪟', f: 'mensual', skill: 'hogar' },
        { t: 'Lámparas y zonas altas', a: 'limpiar las zonas altas', e: '💡', f: 'mensual', skill: 'hogar' },
        { t: 'Limpieza exterior o de riesgo en terraza', e: '🏡', f: 'mensual', skill: 'hogar' },
        { t: 'Desagües', a: 'desatascar los desagües', e: '🕳️', f: 'mensual', skill: 'hogar' },
        { t: 'Juntas y posibles humedades', a: 'revisar juntas y humedades', e: '🦠', f: 'mensual', skill: 'hogar' },
        { t: 'Mover muebles pesados', e: '🪑', f: 'mensual', skill: 'hogar' },
        { t: 'Limpieza profunda de sofá y textiles', e: '🛋️', f: 'mensual', skill: 'hogar' },
        { t: 'Aspirar y rotar colchones', e: '🛏️', f: 'mensual', skill: 'hogar' },
        { t: 'Colocar o retirar cortinas', e: '🪟', f: 'unico', skill: 'hogar' },
        { t: 'Radiadores o aire acondicionado', a: 'revisar radiadores o aire acondicionado', e: '🌡️', f: 'mensual', skill: 'hogar' },
        { t: 'Manipular objetos cortantes o cristales', e: '🔪', f: 'unico', skill: 'hogar' },
        { t: 'Sacar residuos pesados o peligrosos', e: '🗑️', f: 'mensual', skill: 'hogar' },
        { t: 'Tareas con escalera o en altura', a: 'hacer las tareas en altura', e: '🪜', f: 'unico', skill: 'hogar' }
      ]
    }
  ]
}

/** Todas las misiones sugeridas de un rol, aplanadas. */
export function tareasDeRol(rol) {
  return (CATALOGO[rol] || []).flatMap((g) => g.tareas)
}

const TODAS = ['peque', 'junior', 'adulto'].flatMap((rol) => tareasDeRol(rol))

const ACCION_POR_TITULO = new Map(TODAS.filter((t) => t.a).map((t) => [t.t, t.a]))

/**
 * La acción en infinitivo de una misión, para construir el elogio.
 * Las misiones que crea un adulto a mano no están en el catálogo: para
 * ellas se usa el propio título en minúscula, que es lo más honesto que
 * se puede hacer sin adivinar.
 */
export function accionDeMision(titulo) {
  const t = String(titulo || '').trim()
  if (!t) return 'esto'
  const conocida = ACCION_POR_TITULO.get(t)
  if (conocida) return conocida
  return t.charAt(0).toLocaleLowerCase('es') + t.slice(1)
}

/**
 * Arranque recomendado: pocas y repartidas entre habilidades distintas.
 * Un tablón con treinta misiones deja de ser un juego, y concentrar todo
 * en una sola habilidad hace que el progreso se vea plano.
 */
export const RECOMENDADAS = { min: 3, max: 6 }

// Selección de salida del asistente: cinco por persona, cada una de una
// habilidad distinta, y todas cotidianas. La idea es que el primer día
// se pueda completar el tablón entero: empezar ganando es lo que hace
// que haya segundo día.
const ARRANQUE_TITULOS = {
  peque: ['Vestirse sola', 'Recoger juguetes', 'Cepillarse los dientes con ayuda', 'Poner servilletas', 'Leer un cuento'],
  junior: ['Hacer la cama', 'Leer 20 minutos', 'Poner mesa', 'Ejercicio', 'Ayudar a su hermana'],
  adulto: ['Leer con las niñas', 'Caminar', 'Cocina', 'Juego familiar', 'Organización semanal']
}

/** Misiones de arranque para un rol, listas para insertar. */
export function misionesDeArranque(rol) {
  const titulos = ARRANQUE_TITULOS[rol] || []
  const defaults = DEFAULTS_ROL[rol] || DEFAULTS_ROL.junior
  return tareasDeRol(rol)
    .filter((t) => titulos.includes(t.t))
    .map((t) => ({
      title: t.t,
      emoji: t.e,
      frequency: t.f,
      skill: t.skill,
      xp: defaults.xp,
      coins: defaults.coins
    }))
}
