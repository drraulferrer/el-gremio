// ------------------------------------------------------------------
// Catálogo de misiones, por rol y por habilidad.
//
// Reescrito en agosto de 2026 con un cambio de enfoque: ya no es una
// lista de tareas domésticas, es un catálogo de entrenamientos. Cada
// misión declara qué habilidad entrena, y esa etiqueta es la que viaja
// hasta el carnet de cada persona.
//
// Principios que se mantienen del catálogo anterior:
//  - Sin puntos: aquí solo hay título, dibujo, habilidad y frecuencia
//    sugerida. Los puntos nacen al activar la misión para alguien, que
//    es donde vive la proporcionalidad por edades.
//  - Los matices de seguridad van en el propio título (con ayuda,
//    productos seguros, acompañada), no en una nota que nadie lee.
//
// Frecuencias: diario · semanal · mensual · unico.
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
        { t: 'Elegir su ropa', e: '🧦', f: 'diario', skill: 'autonomia' },
        { t: 'Ponerse los zapatos', e: '👟', f: 'diario', skill: 'autonomia' },
        { t: 'Lavarse las manos', e: '🧼', f: 'diario', skill: 'salud' },
        { t: 'Cepillarse los dientes con ayuda', e: '🪥', f: 'diario', skill: 'salud' },
        { t: 'Peinarse', e: '💇', f: 'diario', skill: 'autonomia' },
        { t: 'Llevar la ropa sucia al cesto', e: '🧺', f: 'diario', skill: 'responsabilidad' }
      ]
    },
    {
      grupo: 'Orden',
      tareas: [
        { t: 'Recoger los juguetes', e: '🧸', f: 'diario', skill: 'responsabilidad' },
        { t: 'Guardar los cuentos', e: '📚', f: 'diario', skill: 'responsabilidad' },
        { t: 'La búsqueda: objetos fuera de sitio', e: '🔎', f: 'diario', skill: 'responsabilidad' },
        { t: 'Preparar la mochila', e: '🎒', f: 'diario', skill: 'autonomia' },
        { t: 'Guardar los zapatos', e: '🥿', f: 'diario', skill: 'responsabilidad' }
      ]
    },
    {
      grupo: 'Ayudante de casa',
      tareas: [
        { t: 'Poner las servilletas', e: '🧻', f: 'diario', skill: 'cooperacion' },
        { t: 'Llevar los cubiertos', e: '🍴', f: 'diario', skill: 'cooperacion' },
        { t: 'Llevar la fruta a la mesa', e: '🍎', f: 'diario', skill: 'cooperacion' },
        { t: 'Regar las plantas', e: '🪴', f: 'semanal', skill: 'hogar' },
        { t: 'Dar de comer a la mascota', e: '🐶', f: 'diario', skill: 'responsabilidad' },
        { t: 'Emparejar calcetines', e: '🧦', f: 'semanal', skill: 'cooperacion' },
        { t: 'Dar las pinzas al tender', e: '🧷', f: 'semanal', skill: 'cooperacion' }
      ]
    },
    {
      grupo: 'Cabeza y manos',
      tareas: [
        { t: 'Leer un cuento juntos', e: '📖', f: 'diario', skill: 'aprendizaje' },
        { t: 'Dibujar', e: '🖍️', f: 'diario', skill: 'creatividad' },
        { t: 'Hacer un puzle', e: '🧩', f: 'diario', skill: 'aprendizaje' },
        { t: 'Practicar los números', e: '🔢', f: 'diario', skill: 'aprendizaje' },
        { t: 'Practicar las letras', e: '🔤', f: 'diario', skill: 'aprendizaje' },
        { t: 'Jugar libre, sin pantallas', e: '🪁', f: 'diario', skill: 'creatividad' }
      ]
    },
    {
      grupo: 'Movimiento',
      tareas: [
        { t: 'Bailar', e: '💃', f: 'diario', skill: 'salud' },
        { t: 'Circuito motor', e: '🤸', f: 'diario', skill: 'salud' },
        { t: 'Saltar', e: '🦘', f: 'diario', skill: 'salud' },
        { t: 'Salir a caminar', e: '🚶', f: 'diario', skill: 'salud' },
        { t: 'Yoga infantil', e: '🧘', f: 'semanal', skill: 'salud' }
      ]
    },
    {
      grupo: 'Con los demás',
      tareas: [
        { t: 'Dar las gracias', e: '🙏', f: 'diario', skill: 'amabilidad' },
        { t: 'Pedir las cosas por favor', e: '💬', f: 'diario', skill: 'amabilidad' },
        { t: 'Esperar su turno', e: '⏳', f: 'diario', skill: 'amabilidad' },
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
        { t: 'Dejar lista la ropa del día siguiente', e: '👚', f: 'diario', skill: 'autonomia' },
        { t: 'Higiene completa', e: '🚿', f: 'diario', skill: 'salud' }
      ]
    },
    {
      grupo: 'Hogar',
      tareas: [
        { t: 'Pasar la aspiradora', e: '🌀', f: 'semanal', skill: 'hogar' },
        { t: 'Barrer', e: '🧹', f: 'semanal', skill: 'hogar' },
        { t: 'Doblar la ropa', e: '👕', f: 'semanal', skill: 'hogar' },
        { t: 'Tender la ropa', e: '🧺', f: 'semanal', skill: 'hogar' },
        { t: 'Vaciar el lavavajillas (sin objetos peligrosos)', e: '🫧', f: 'diario', skill: 'hogar' },
        { t: 'Poner la mesa', e: '🍽️', f: 'diario', skill: 'cooperacion' },
        { t: 'Recoger la mesa', e: '🧽', f: 'diario', skill: 'cooperacion' },
        { t: 'Limpiar la encimera con productos seguros', e: '🧴', f: 'diario', skill: 'hogar' },
        { t: 'Regar las plantas', e: '🪴', f: 'semanal', skill: 'hogar' },
        { t: 'Ordenar su cuarto a fondo', e: '🚪', f: 'semanal', skill: 'responsabilidad' },
        { t: 'Cambiar las sábanas de su cama', e: '🧵', f: 'semanal', skill: 'hogar' },
        { t: 'Sacar la basura ligera (acompañada)', e: '🗑️', f: 'diario', skill: 'hogar' }
      ]
    },
    {
      grupo: 'Aprendizaje',
      tareas: [
        { t: 'Leer 20 minutos', e: '📚', f: 'diario', skill: 'aprendizaje' },
        { t: 'Practicar idiomas', e: '🌍', f: 'diario', skill: 'aprendizaje' },
        { t: 'Practicar matemáticas', e: '➗', f: 'diario', skill: 'aprendizaje' },
        { t: 'Programar', e: '💻', f: 'semanal', skill: 'aprendizaje' },
        { t: 'Tocar el instrumento', e: '🎻', f: 'diario', skill: 'creatividad' },
        { t: 'Avanzar su proyecto personal', e: '🚀', f: 'semanal', skill: 'creatividad' },
        { t: 'Manualidades', e: '✂️', f: 'semanal', skill: 'creatividad' },
        { t: 'Escribir', e: '✍️', f: 'semanal', skill: 'creatividad' }
      ]
    },
    {
      grupo: 'Salud',
      tareas: [
        { t: 'Hacer ejercicio', e: '🏃', f: 'diario', skill: 'salud' },
        { t: 'Salir a pasear', e: '🚶', f: 'diario', skill: 'salud' },
        { t: 'Estiramientos', e: '🤸', f: 'diario', skill: 'salud' },
        { t: 'Irse a dormir a su hora', e: '🌙', f: 'diario', skill: 'salud' },
        { t: 'Prepararse una merienda saludable', e: '🥪', f: 'diario', skill: 'autonomia' }
      ]
    },
    {
      grupo: 'Crecer por dentro',
      tareas: [
        { t: 'Ayudar a su hermana', e: '👭', f: 'diario', skill: 'amabilidad' },
        { t: 'Enseñar algo a alguien', e: '🧑‍🏫', f: 'semanal', skill: 'cooperacion' },
        { t: 'Resolver un problema sola', e: '🧠', f: 'semanal', skill: 'autonomia' },
        { t: 'Gestionar una emoción difícil', e: '🌊', f: 'diario', skill: 'autonomia' },
        { t: 'Decir tres cosas que agradece', e: '🙏', f: 'diario', skill: 'amabilidad' },
        { t: 'Escribir en su diario', e: '📓', f: 'diario', skill: 'creatividad' }
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
        { t: 'Entrenar', e: '🏋️', f: 'diario', skill: 'salud' },
        { t: 'Caminar', e: '🚶', f: 'diario', skill: 'salud' },
        { t: 'Dormir de 7 a 8 horas', e: '😴', f: 'diario', skill: 'salud' },
        { t: 'Comer fruta', e: '🍎', f: 'diario', skill: 'salud' },
        { t: 'Beber agua', e: '💧', f: 'diario', skill: 'salud' },
        { t: 'Meditar', e: '🧘', f: 'diario', skill: 'salud' }
      ]
    },
    {
      grupo: 'Hogar',
      tareas: [
        { t: 'Limpieza', e: '🧽', f: 'semanal', skill: 'hogar' },
        { t: 'La compra', e: '🛒', f: 'semanal', skill: 'hogar' },
        { t: 'Cocinar', e: '🍳', f: 'diario', skill: 'hogar' },
        { t: 'Poner una lavadora', e: '🌊', f: 'diario', skill: 'hogar' },
        { t: 'Reparaciones', e: '🔧', f: 'mensual', skill: 'hogar' }
      ]
    },
    {
      grupo: 'Familia',
      tareas: [
        { t: 'Leer con las niñas', e: '📖', f: 'diario', skill: 'amabilidad' },
        { t: 'Juego en familia', e: '🎲', f: 'semanal', skill: 'cooperacion' },
        { t: 'Salida familiar', e: '🏞️', f: 'semanal', skill: 'cooperacion' },
        { t: 'Tiempo a solas con cada hija', e: '👥', f: 'semanal', skill: 'amabilidad' },
        { t: 'Conversación sin móviles', e: '📵', f: 'diario', skill: 'amabilidad' }
      ]
    },
    {
      grupo: 'Profesional',
      tareas: [
        { t: 'Formación', e: '🎓', f: 'semanal', skill: 'aprendizaje' },
        { t: 'Lectura científica', e: '🔬', f: 'semanal', skill: 'aprendizaje' },
        { t: 'Avanzar un proyecto', e: '🚀', f: 'semanal', skill: 'aprendizaje' },
        { t: 'Organizar la semana', e: '🗓️', f: 'semanal', skill: 'responsabilidad' }
      ]
    },
    {
      grupo: 'Personal',
      tareas: [
        { t: 'Leer', e: '📚', f: 'diario', skill: 'aprendizaje' },
        { t: 'Dedicar rato a un hobby', e: '🎨', f: 'semanal', skill: 'creatividad' },
        { t: 'Ver a los amigos', e: '🍻', f: 'semanal', skill: 'amabilidad' },
        { t: 'Descansar de verdad', e: '🛋️', f: 'semanal', skill: 'salud' },
        { t: 'Revisar las finanzas', e: '📊', f: 'mensual', skill: 'responsabilidad' }
      ]
    },
    {
      // Bloque heredado del catálogo que aportó la familia. Se queda
      // porque es trabajo real de la casa y porque, por riesgo, químicos
      // o altura, solo lo hacen personas adultas.
      grupo: 'Casa a fondo (solo personas adultas)',
      tareas: [
        { t: 'Limpieza completa de inodoros', e: '🚽', f: 'semanal', skill: 'hogar' },
        { t: 'Limpieza profunda de baños', e: '🛁', f: 'semanal', skill: 'hogar' },
        { t: 'Duchas y bañeras', e: '🚿', f: 'semanal', skill: 'hogar' },
        { t: 'Mamparas y desincrustado', e: '🫧', f: 'mensual', skill: 'hogar' },
        { t: 'Limpiezas con lejía o químicos fuertes', e: '⚠️', f: 'mensual', skill: 'hogar' },
        { t: 'Limpieza profunda de cocina', e: '🍳', f: 'mensual', skill: 'hogar' },
        { t: 'Placa de cocina', e: '🔥', f: 'semanal', skill: 'hogar' },
        { t: 'Horno', e: '♨️', f: 'mensual', skill: 'hogar' },
        { t: 'Campana extractora y filtros', e: '💨', f: 'mensual', skill: 'hogar' },
        { t: 'Frigorífico y congelador a fondo', e: '🧊', f: 'mensual', skill: 'hogar' },
        { t: 'Detrás y debajo de electrodomésticos', e: '🔌', f: 'mensual', skill: 'hogar' },
        { t: 'Armarios altos', e: '🗄️', f: 'mensual', skill: 'hogar' },
        { t: 'Ventanas y cristales de difícil acceso', e: '🪟', f: 'mensual', skill: 'hogar' },
        { t: 'Persianas', e: '🪟', f: 'mensual', skill: 'hogar' },
        { t: 'Lámparas y zonas altas', e: '💡', f: 'mensual', skill: 'hogar' },
        { t: 'Limpieza exterior o de riesgo en terraza', e: '🏡', f: 'mensual', skill: 'hogar' },
        { t: 'Desagües', e: '🕳️', f: 'mensual', skill: 'hogar' },
        { t: 'Juntas y posibles humedades', e: '🦠', f: 'mensual', skill: 'hogar' },
        { t: 'Mover muebles pesados', e: '🪑', f: 'mensual', skill: 'hogar' },
        { t: 'Limpieza profunda de sofá y textiles', e: '🛋️', f: 'mensual', skill: 'hogar' },
        { t: 'Aspirar y rotar colchones', e: '🛏️', f: 'mensual', skill: 'hogar' },
        { t: 'Colocar o retirar cortinas', e: '🪟', f: 'unico', skill: 'hogar' },
        { t: 'Radiadores o aire acondicionado', e: '🌡️', f: 'mensual', skill: 'hogar' },
        { t: 'Manipular objetos cortantes o cristales', e: '🔪', f: 'unico', skill: 'hogar' },
        { t: 'Sacar residuos pesados o peligrosos', e: '🗑️', f: 'mensual', skill: 'hogar' },
        { t: 'Tareas con escalera o en altura', e: '🪜', f: 'unico', skill: 'hogar' }
      ]
    }
  ]
}

/** Todas las misiones sugeridas de un rol, aplanadas. */
export function tareasDeRol(rol) {
  return (CATALOGO[rol] || []).flatMap((g) => g.tareas)
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
  peque: [
    'Vestirse sola',
    'Recoger los juguetes',
    'Cepillarse los dientes con ayuda',
    'Poner las servilletas',
    'Leer un cuento juntos'
  ],
  junior: [
    'Hacer la cama',
    'Leer 20 minutos',
    'Poner la mesa',
    'Hacer ejercicio',
    'Ayudar a su hermana'
  ],
  adulto: [
    'Leer con las niñas',
    'Caminar',
    'Cocinar',
    // Juego en familia y no "conversación sin móviles": las dos son
    // buenas, pero las dos entrenan lo mismo y el arranque busca cinco
    // habilidades distintas para que el carnet no salga torcido.
    'Juego en familia',
    'Organizar la semana'
  ]
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
