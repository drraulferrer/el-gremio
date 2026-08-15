// ------------------------------------------------------------------
// Reglas de los miembros del gremio.
//
// Aparte por dos motivos: son las reglas que hay que poder probar sin
// navegador, y son las que impiden dejar el gremio en un estado sin
// salida (por ejemplo, sin ninguna persona adulta que valide nada).
// ------------------------------------------------------------------

export const MAX_PERFILES = 8
const MAX_NOMBRE = 40

export const ROLES = ['adulto', 'junior', 'peque']

/** Un perfil sin `active` es activo: así funciona antes de la migración 003. */
export function estaActivo(perfil) {
  return perfil?.active !== false
}

export function perfilesActivos(perfiles = []) {
  return perfiles.filter(estaActivo)
}

export function perfilesRetirados(perfiles = []) {
  return perfiles.filter((p) => !estaActivo(p))
}

function normalizar(nombre) {
  return String(nombre || '')
    .trim()
    .toLocaleLowerCase('es')
}

/**
 * ¿Se puede guardar este miembro?
 * @param {{id?: string, name: string, role: string}} miembro
 * @param {Array} perfiles todos los perfiles de la familia
 * @returns {{ok: boolean, mensaje: string}}
 */
export function validarMiembro(miembro, perfiles = []) {
  const nombre = String(miembro?.name || '').trim()

  if (!nombre) return { ok: false, mensaje: 'Hace falta un nombre.' }
  if (nombre.length > MAX_NOMBRE) {
    return { ok: false, mensaje: `El nombre no puede pasar de ${MAX_NOMBRE} caracteres.` }
  }
  if (!ROLES.includes(miembro?.role)) return { ok: false, mensaje: 'Ese rol no existe.' }

  const repetido = perfiles.some(
    (p) => p.id !== miembro.id && estaActivo(p) && normalizar(p.name) === normalizar(nombre)
  )
  if (repetido) return { ok: false, mensaje: `Ya hay alguien que se llama ${nombre}.` }

  const esNuevo = !miembro.id
  if (esNuevo && perfilesActivos(perfiles).length >= MAX_PERFILES) {
    return { ok: false, mensaje: `El gremio admite hasta ${MAX_PERFILES} miembros activos.` }
  }

  // Cambiar de rol al último adulto deja el gremio sin quien valide.
  if (!esNuevo && miembro.role !== 'adulto' && esUltimoAdulto(miembro.id, perfiles)) {
    return { ok: false, mensaje: 'Es la única persona adulta: alguien tiene que poder validar.' }
  }

  return { ok: true, mensaje: '' }
}

function esUltimoAdulto(perfilId, perfiles) {
  const adultos = perfilesActivos(perfiles).filter((p) => p.role === 'adulto')
  return adultos.length === 1 && adultos[0].id === perfilId
}

/** ¿Se puede retirar (o borrar) este perfil? */
export function puedeRetirar(perfil, perfiles = []) {
  if (!perfil) return { ok: false, mensaje: 'No existe ese perfil.' }
  if (esUltimoAdulto(perfil.id, perfiles)) {
    return { ok: false, mensaje: 'Es la única persona adulta del gremio. Añade otra antes de retirarla.' }
  }
  if (perfilesActivos(perfiles).length <= 1) {
    return { ok: false, mensaje: 'No puedes dejar el gremio sin nadie.' }
  }
  return { ok: true, mensaje: '' }
}

/** Qué se pierde al borrar de verdad, para poder avisarlo con números. */
export function loQueSePierde(perfil, datos) {
  if (!perfil || !datos) return { misiones: 0, canjes: 0, insignias: 0, xp: 0 }
  const misiones = datos.completions.filter((c) => c.profile_id === perfil.id)
  return {
    misiones: misiones.length,
    canjes: datos.redemptions.filter((r) => r.profile_id === perfil.id).length,
    insignias: datos.badges.filter((b) => b.profile_id === perfil.id).length,
    xp: misiones.filter((c) => c.status === 'aprobado').reduce((s, c) => s + c.xp, 0)
  }
}
