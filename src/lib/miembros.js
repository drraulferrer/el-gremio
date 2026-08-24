// ------------------------------------------------------------------
// Reglas de los miembros del gremio.
//
// Aparte por dos motivos: son las reglas que hay que poder probar sin
// navegador, y son las que impiden dejar el gremio en un estado sin
// salida (por ejemplo, sin ninguna persona adulta que valide nada).
// ------------------------------------------------------------------

import { especieValida } from './mascotas'

export const MAX_PERFILES = 8
const MAX_NOMBRE = 40

// Las mascotas cuentan APARTE, y no por generosidad: el gremio de casa ya
// tenía los ocho sitios ocupados el día que se añadió esto, así que un
// tope compartido significaba «no cabe el perro». Y son categorías
// distintas de verdad: un perfil de persona consume un sitio en el
// selector, en los avisos y en la meta; una mascota no aparece en el
// selector ni recibe avisos.
export const MAX_MASCOTAS = 4

export const ROLES = ['adulto', 'junior', 'peque']
export const ROLES_CON_MASCOTA = [...ROLES, 'mascota']

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
  if (!ROLES_CON_MASCOTA.includes(miembro?.role)) return { ok: false, mensaje: 'Ese rol no existe.' }

  // La especie es obligatoria en una mascota y prohibida en una persona.
  // Lo mismo que vigila la base (`profiles_especie_coherente`), aquí para
  // poder decirlo con palabras en vez de con un error de Postgres.
  const esAnimal = miembro.role === 'mascota'
  if (esAnimal && !especieValida(miembro?.species)) {
    return { ok: false, mensaje: 'Di si es perro o gato.' }
  }
  if (!esAnimal && miembro?.species) {
    return { ok: false, mensaje: 'Solo las mascotas tienen especie.' }
  }

  const repetido = perfiles.some(
    (p) => p.id !== miembro.id && estaActivo(p) && normalizar(p.name) === normalizar(nombre)
  )
  if (repetido) return { ok: false, mensaje: `Ya hay alguien que se llama ${nombre}.` }

  const esNuevo = !miembro.id
  const activos = perfilesActivos(perfiles)
  if (esNuevo && esAnimal && activos.filter((p) => p.role === 'mascota').length >= MAX_MASCOTAS) {
    return { ok: false, mensaje: `El gremio admite hasta ${MAX_MASCOTAS} mascotas.` }
  }
  if (esNuevo && !esAnimal && activos.filter((p) => p.role !== 'mascota').length >= MAX_PERFILES) {
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

/**
 * La fila que se escribe en `profiles` al guardar un miembro.
 *
 * Esto vivía dentro del formulario y de ahí salió un fallo caro: la lista
 * de columnas es EXPLÍCITA, así que cuando el retrato añadió tres
 * columnas nuevas (035) nadie las metió aquí. El editor las cambiaba, el
 * `update` las descartaba, Supabase devolvía éxito y la pantalla decía
 * «Guardado». Un fallo mudo, que es el peor: no hay error que leer.
 *
 * Está fuera del componente para que un test pueda comprobar que la fila
 * lleva TODO lo que el editor puede tocar. Si mañana se añade una pieza
 * más y no se añade aquí, el test cae antes que la familia.
 *
 * Los null son explícitos y no `undefined`: `undefined` no viaja en el
 * JSON, así que al dejar de ser mascota la especie se quedaría puesta.
 */
export function filaDeMiembro(m, familyId) {
  const esMascota = m.role === 'mascota'
  return {
    family_id: familyId,
    name: String(m.name || '').trim(),
    role: m.role,
    emoji: m.emoji,
    color: m.color,
    gender: m.gender || 'neutro',
    species: esMascota ? m.species : null,
    // Una mascota lleva medallón de emoji y no tiene retrato: la base lo
    // exige (`profiles_retrato_solo_personas`) y aquí se cumple en vez de
    // esperar a que Postgres lo rechace con un error que no dice nada.
    retrato_piel: esMascota ? null : m.retrato_piel ?? null,
    retrato_pelo: esMascota ? null : m.retrato_pelo ?? null,
    retrato_peinado: esMascota ? null : m.retrato_peinado ?? null,
    retrato_gafas: esMascota ? null : m.retrato_gafas ?? null,
    retrato_tunica: esMascota ? null : m.retrato_tunica ?? null,
    retrato_barba: esMascota ? null : m.retrato_barba ?? null,
    retrato_flequillo: esMascota ? null : m.retrato_flequillo ?? null
  }
}
