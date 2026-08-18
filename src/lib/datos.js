// ------------------------------------------------------------------
// Llevarse los datos y borrar la cuenta.
//
// Las dos son obligación legal en cuanto esto lo use alguien que no sea
// la familia que lo escribió: aquí hay nombres y actividad diaria de
// menores. Y las dos son, además, el argumento comercial del proyecto —
// si esto se cierra, tus datos salen contigo—, así que conviene que
// funcionen de verdad y no como un formulario que abre un correo.
//
// Este fichero es solo la parte que se puede probar sin red: qué tablas
// entran, qué forma tiene el fichero y cuándo se considera confirmado un
// borrado. La pantalla (Datos.jsx) descarga, llama y desconecta.
// ------------------------------------------------------------------

// Todo lo que cuelga de la familia y describe su vida en la app.
//
// `app_logs` NO entra a propósito: son diagnósticos (errores, avisos, ids
// de petición), no lo que la familia ha creado, y su volumen ahogaría el
// fichero justo donde alguien quiere leer el historial de su criatura.
// Quien los necesite los tiene en ⚙️ → Estado.
export const TABLAS_EXPORTADAS = [
  'profiles',
  'challenges',
  'completions',
  'rewards',
  'redemptions',
  'family_goals',
  'profile_badges',
  'bonuses',
  'power_uses'
]

// Nombres legibles para el resumen previo al borrado. Que alguien lea
// «342 misiones conseguidas» antes de escribir el nombre del gremio es
// justo lo que hace que ese botón no se pulse por error.
//
// Con singular y plural porque «1 metas» delata que nadie ha mirado la
// pantalla, y esta es justo la pantalla en la que hace falta que se note
// que alguien la ha mirado.
export const NOMBRES_TABLA = {
  profiles: ['miembro', 'miembros'],
  challenges: ['misión', 'misiones'],
  completions: ['misión pedida', 'misiones pedidas'],
  rewards: ['premio', 'premios'],
  redemptions: ['canje', 'canjes'],
  family_goals: ['meta', 'metas'],
  profile_badges: ['insignia', 'insignias'],
  bonuses: ['Talis de regalo', 'Talis de regalo'],
  power_uses: ['poder gastado', 'poderes gastados']
}

export const FORMATO_EXPORTACION = 1

// El fichero que se descarga. Lleva su propia cabecera porque un JSON
// suelto dentro de dos años no dice de qué app salió ni con qué versión.
export function construirExportacion({ family, tablas, generadoEn, release }) {
  const filas = tablas || {}
  return {
    formato: FORMATO_EXPORTACION,
    aplicacion: 'El Gremio',
    release: release || null,
    generado_en: (generadoEn || new Date()).toISOString(),
    gremio: family
      ? {
          id: family.id,
          name: family.name,
          timezone: family.timezone || null,
          created_at: family.created_at || null
        }
      : null,
    // El hash del PIN no viaja: no le sirve a nadie fuera y es lo único
    // parecido a una credencial que hay en la tabla.
    datos: TABLAS_EXPORTADAS.reduce((acc, tabla) => {
      acc[tabla] = filas[tabla] || []
      return acc
    }, {})
  }
}

export function nombreFichero(family, fecha = new Date()) {
  const dia = fecha.toISOString().slice(0, 10)
  const base = (family?.name || 'gremio')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${base || 'gremio'}-${dia}.json`
}

// Cuántas filas se va a llevar por delante el borrado, en el orden en el
// que se enseñan.
export function resumenDeBorrado(tablas) {
  const filas = tablas || {}
  return TABLAS_EXPORTADAS
    .map((tabla) => {
      const cuantas = (filas[tabla] || []).length
      const [uno, varios] = NOMBRES_TABLA[tabla]
      return { tabla, nombre: cuantas === 1 ? uno : varios, cuantas }
    })
    .filter((f) => f.cuantas > 0)
}

// Para borrar hay que escribir el nombre del gremio. Se comparan sin
// mayúsculas, sin acentos y sin espacios de sobra: la confirmación existe
// para obligar a mirar lo que se está borrando, no para ganar un examen
// de mecanografía.
export function confirmacionValida(escrito, nombreGremio) {
  const normalizar = (t) =>
    (t || '')
      .trim()
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
  const objetivo = normalizar(nombreGremio)
  return objetivo.length > 0 && normalizar(escrito) === objetivo
}

// Las respuestas de delete_my_account, en castellano.
export function mensajeDeBorrado(respuesta) {
  if (respuesta === 'ok' || respuesta === 'ok_sin_gremio') return null
  if (respuesta === 'sin_sesion') return 'La sesión ha caducado. Vuelve a entrar e inténtalo otra vez.'
  return 'No se ha podido borrar la cuenta. No se ha tocado nada.'
}
