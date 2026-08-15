// ------------------------------------------------------------------
// Feature flags. Sirven para dos cosas:
//  1. Apagar una función a medias sin desplegar código nuevo.
//  2. Rollback selectivo: si una novedad rompe algo, se apaga la bandera
//     en lugar de revertir toda la build.
//
// Precedencia: localStorage (por dispositivo) > variable de entorno > valor
// por defecto. La sobreescritura local es un cerrojo doméstico, no un
// control de acceso: cualquiera con la consola abierta puede cambiarla.
// ------------------------------------------------------------------

const DEFECTOS = {
  // Pantalla infantil propia para el rol "peque".
  modoPeque: true,
  // Envío de logs estructurados a Supabase (los de nivel warn y error).
  logsRemotos: true,
  // Persistir también los logs informativos. Ruidoso; solo para depurar.
  logsInfo: false,
  // Backend simulado en memoria, para ver la app sin Supabase.
  demo: false
}

const ENV = {
  modoPeque: import.meta.env.VITE_FLAG_MODO_PEQUE,
  logsRemotos: import.meta.env.VITE_FLAG_LOGS_REMOTOS,
  logsInfo: import.meta.env.VITE_FLAG_LOGS_INFO,
  demo: import.meta.env.VITE_DEMO
}

const CLAVE_LOCAL = 'gremio_flags'

function locales() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_LOCAL) || '{}')
  } catch {
    return {}
  }
}

function aBooleano(valor, porDefecto) {
  if (valor === undefined || valor === null || valor === '') return porDefecto
  if (typeof valor === 'boolean') return valor
  return ['1', 'true', 'si', 'sí', 'on'].includes(String(valor).toLowerCase())
}

export function flag(nombre) {
  const local = locales()[nombre]
  if (local !== undefined) return aBooleano(local, DEFECTOS[nombre])
  return aBooleano(ENV[nombre], DEFECTOS[nombre])
}

export function setFlag(nombre, valor) {
  const siguiente = { ...locales(), [nombre]: Boolean(valor) }
  localStorage.setItem(CLAVE_LOCAL, JSON.stringify(siguiente))
  return siguiente
}

export function todasLasFlags() {
  return Object.keys(DEFECTOS).reduce((acc, k) => ({ ...acc, [k]: flag(k) }), {})
}

export { DEFECTOS }
