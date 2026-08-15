// ------------------------------------------------------------------
// Biblioteca de tareas de la casa.
// Catálogo sin puntos: cada tarea declara los roles aptos y una
// frecuencia sugerida. Los puntos se asignan al ACTIVAR la tarea
// como misión para un perfil concreto (ahí vive la proporcionalidad
// por edades: la misma tarea puede valer distinto para cada persona).
// Una tarea puede pertenecer a varios roles sin duplicarse aquí.
// ------------------------------------------------------------------

// Valores por defecto al activar, según el rol del perfil asignado.
// A quien más le cuesta la tarea, más XP. Editables misión a misión.
export const DEFAULTS_ROL = {
  peque: { xp: 10, coins: 5 },
  junior: { xp: 15, coins: 8 },
  adulto: { xp: 10, coins: 5 }
}

export const CASA = [
  {
    grupo: 'Dormitorios',
    tareas: [
      { t: 'Recoger los juguetes', e: '🧸', roles: ['peque', 'junior', 'adulto'], f: 'diario' },
      { t: 'Guardar cuentos en su sitio', e: '📚', roles: ['peque', 'junior'], f: 'diario' },
      { t: 'Guardar zapatos', e: '👟', roles: ['peque', 'junior', 'adulto'], f: 'diario' },
      { t: 'Colocar cojines y peluches de su cama', e: '🧶', roles: ['peque'], f: 'diario' },
      { t: 'Ayudar a estirar la colcha', e: '🛏️', roles: ['peque'], f: 'diario' },
      { t: 'Recoger objetos pequeños y llevarlos a su sitio', e: '🧩', roles: ['peque'], f: 'diario' },
      { t: 'Hacer la cama', e: '🛏️', roles: ['junior', 'adulto'], f: 'diario' },
      { t: 'Ordenar el dormitorio a fondo', e: '🚪', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Guardar ropa y objetos personales', e: '🧥', roles: ['junior', 'adulto'], f: 'diario' },
      { t: 'Cambiar las sábanas de su cama', e: '🧵', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Limpiar su escritorio', e: '🖊️', roles: ['junior', 'adulto'], f: 'semanal' }
    ]
  },
  {
    grupo: 'Salón',
    tareas: [
      { t: 'Recoger y ordenar el salón', e: '🛋️', roles: ['junior', 'adulto'], f: 'diario' },
      { t: 'Colocar cojines y mantas', e: '🧣', roles: ['junior', 'adulto'], f: 'diario' },
      { t: 'Quitar el polvo de muebles accesibles', e: '🪶', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Quitar polvo con paño seco en superficies bajas', e: '🪶', roles: ['peque'], f: 'semanal' },
      { t: 'Limpiar espejos accesibles', e: '🪞', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Barrer habitaciones', e: '🧹', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Ayudar a barrer con escoba pequeña', e: '🧹', roles: ['peque'], f: 'semanal' },
      { t: 'Pasar la aspiradora', e: '🌀', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Fregar zonas sencillas', e: '🪣', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Vaciar papeleras pequeñas', e: '🗑️', roles: ['junior', 'adulto'], f: 'semanal' }
    ]
  },
  {
    grupo: 'Cocina y mesa',
    tareas: [
      { t: 'Llevar servilletas a la mesa', e: '🧻', roles: ['peque'], f: 'diario' },
      { t: 'Llevar su vaso y plato (si no es frágil)', e: '🥤', roles: ['peque'], f: 'diario' },
      { t: 'Poner la mesa', e: '🍽️', roles: ['junior', 'adulto'], f: 'diario' },
      { t: 'Recoger la mesa', e: '🍽️', roles: ['junior', 'adulto'], f: 'diario' },
      { t: 'Limpiar la mesa después de comer', e: '🧽', roles: ['junior', 'adulto'], f: 'diario' },
      { t: 'Cargar el lavavajillas', e: '🫧', roles: ['junior', 'adulto'], f: 'diario' },
      { t: 'Vaciar el lavavajillas (sin objetos peligrosos)', e: '🫧', roles: ['junior', 'adulto'], f: 'diario' },
      { t: 'Limpiar la encimera con productos seguros', e: '🧴', roles: ['junior', 'adulto'], f: 'diario' },
      { t: 'Barrer la cocina', e: '🧹', roles: ['junior', 'adulto'], f: 'diario' },
      { t: 'Ayudar a guardar la compra', e: '🛒', roles: ['peque', 'junior', 'adulto'], f: 'semanal' }
    ]
  },
  {
    grupo: 'Colada y ropa',
    tareas: [
      { t: 'Llevar la ropa sucia al cesto', e: '🧺', roles: ['peque', 'junior', 'adulto'], f: 'diario' },
      { t: 'Emparejar calcetines', e: '🧦', roles: ['peque', 'junior'], f: 'semanal' },
      { t: 'Guardar prendas sencillas en cajones bajos', e: '🗄️', roles: ['peque'], f: 'semanal' },
      { t: 'Dar pinzas o prendas mientras se tiende', e: '🧷', roles: ['peque'], f: 'semanal' },
      { t: 'Doblar ropa', e: '👕', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Guardar ropa limpia', e: '🧥', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Ayudar a poner la lavadora', e: '🌊', roles: ['junior'], f: 'semanal' },
      { t: 'Tender ropa', e: '🧺', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Recoger ropa del tendedero', e: '🧺', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Barrer el tendedero', e: '🧹', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Ayudar a ordenar armarios y cajones', e: '🗄️', roles: ['junior'], f: 'mensual' }
    ]
  },
  {
    grupo: 'Baño',
    tareas: [
      { t: 'Cambiar toallas', e: '🧖', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Repasar el lavabo con productos seguros', e: '🚰', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Ordenar productos de higiene', e: '🧴', roles: ['junior', 'adulto'], f: 'semanal' }
    ]
  },
  {
    grupo: 'Plantas y terraza',
    tareas: [
      { t: 'Regar plantas', e: '🪴', roles: ['peque', 'junior', 'adulto'], f: 'semanal' },
      { t: 'Recoger objetos de la terraza (zonas seguras)', e: '🏡', roles: ['peque'], f: 'semanal' },
      { t: 'Barrer zonas seguras de la terraza', e: '🧹', roles: ['junior', 'adulto'], f: 'semanal' },
      { t: 'Sacar basura ligera (acompañada)', e: '🗑️', roles: ['junior'], f: 'diario' }
    ]
  },
  {
    grupo: 'A fondo (solo personas adultas)',
    tareas: [
      { t: 'Limpieza completa de inodoros', e: '🚽', roles: ['adulto'], f: 'semanal' },
      { t: 'Limpieza profunda de baños', e: '🛁', roles: ['adulto'], f: 'semanal' },
      { t: 'Duchas y bañeras', e: '🚿', roles: ['adulto'], f: 'semanal' },
      { t: 'Mamparas y desincrustado', e: '🫧', roles: ['adulto'], f: 'mensual' },
      { t: 'Limpiezas con lejía o químicos fuertes', e: '⚠️', roles: ['adulto'], f: 'mensual' },
      { t: 'Limpieza profunda de cocina', e: '🍳', roles: ['adulto'], f: 'mensual' },
      { t: 'Placa de cocina', e: '🔥', roles: ['adulto'], f: 'semanal' },
      { t: 'Horno', e: '♨️', roles: ['adulto'], f: 'mensual' },
      { t: 'Campana extractora y filtros', e: '💨', roles: ['adulto'], f: 'mensual' },
      { t: 'Frigorífico y congelador a fondo', e: '🧊', roles: ['adulto'], f: 'mensual' },
      { t: 'Detrás y debajo de electrodomésticos', e: '🔌', roles: ['adulto'], f: 'mensual' },
      { t: 'Armarios altos', e: '🗄️', roles: ['adulto'], f: 'mensual' },
      { t: 'Ventanas y cristales de difícil acceso', e: '🪟', roles: ['adulto'], f: 'mensual' },
      { t: 'Persianas', e: '🪟', roles: ['adulto'], f: 'mensual' },
      { t: 'Lámparas y zonas altas', e: '💡', roles: ['adulto'], f: 'mensual' },
      { t: 'Limpieza exterior o de riesgo en terraza', e: '🏡', roles: ['adulto'], f: 'mensual' },
      { t: 'Desagües', e: '🕳️', roles: ['adulto'], f: 'mensual' },
      { t: 'Juntas y posibles humedades', e: '🦠', roles: ['adulto'], f: 'mensual' },
      { t: 'Mover muebles pesados', e: '🪑', roles: ['adulto'], f: 'mensual' },
      { t: 'Aspirar debajo y detrás de muebles pesados', e: '🌀', roles: ['adulto'], f: 'mensual' },
      { t: 'Limpieza profunda de sofá y textiles', e: '🛋️', roles: ['adulto'], f: 'mensual' },
      { t: 'Aspirar y rotar colchones', e: '🛏️', roles: ['adulto'], f: 'mensual' },
      { t: 'Colocar o retirar cortinas', e: '🪟', roles: ['adulto'], f: 'unico' },
      { t: 'Radiadores o aire acondicionado', e: '🌡️', roles: ['adulto'], f: 'mensual' },
      { t: 'Manipular objetos cortantes o cristales', e: '🔪', roles: ['adulto'], f: 'unico' },
      { t: 'Sacar residuos pesados o peligrosos', e: '🗑️', roles: ['adulto'], f: 'mensual' },
      { t: 'Tareas con escalera o en altura', e: '🪜', roles: ['adulto'], f: 'unico' },
      { t: 'Limpieza profunda de calendario (trimestral o anual)', e: '🗓️', roles: ['adulto'], f: 'unico' }
    ]
  }
]
