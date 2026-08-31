// ------------------------------------------------------------------
// El catálogo del producto, en la demo.
//
// Son las cuatro tablas de `schema.sql` que NO son de una familia sino del
// producto: cómo nace un gremio de cada tipo (`plantillas_tipo`, 053), qué
// puede cada rol (`plantilla_capacidades`, 054), qué cuesta cada escalón
// (`configuracion_expansion` y `escalones_expansion`, 050) y dónde está
// publicado cada tipo (`disponibilidad_tipos`).
//
// Van como constantes y no en `localStorage` por lo mismo que en Postgres
// llevan RLS encendido y sin políticas y un disparador que impide editarlas:
// no son datos de nadie, y una demo donde se pudieran tocar probaría una
// escala que no existe. Los números son los de la versión `2026-08-30.1`,
// copiados sin cambiar ninguno.
// ------------------------------------------------------------------

/** La versión vigente. En la demo solo hay una, que es la publicada. */
export const VERSION = '2026-08-30.1'

// Copia de `configuracion_expansion`. Sin `coste_base` ni `factor`, igual
// que `parametros_expansion()`: el coste ya viaja hecho en la escala, y
// quien no recibe la fórmula no la puede recalcular mal.
export const PARAMETROS = {
  version: VERSION,
  limite_global: 5,
  escalones_por_gremio: 4,
  regla_crecimiento: 'geometrica',
  invitacion_dias: 14,
  // NULO quiere decir QUE NO CADUCA, y no es un olvido: es `R-62`.
  llave_dias: null,
  solicitud_junior_dias: 14,
  autorizacion_adulta_horas: 72
}

// Hitos 6-8-10-12 y coste 300 x 2,5^(k-1), con el cuarto redondeado.
export const ESCALONES = [
  { version: VERSION, orden: 1, nivel_exigido: 6, coste: 300 },
  { version: VERSION, orden: 2, nivel_exigido: 8, coste: 750 },
  { version: VERSION, orden: 3, nivel_exigido: 10, coste: 1875 },
  { version: VERSION, orden: 4, nivel_exigido: 12, coste: 4690 }
]

// La matriz tipo x país. Lo que no está declarado NO está publicado: una
// fila que falta deniega, no concede.
export const DISPONIBILIDAD = [
  { version: VERSION, tipo: 'hogar', pais: 'ES', estado: 'publicado' },
  { version: VERSION, tipo: 'amigos', pais: 'ES', estado: 'publicado' },
  { version: VERSION, tipo: 'equipo', pais: 'ES', estado: 'no_publicado' },
  { version: VERSION, tipo: 'hogar_compartido', pais: 'ES', estado: 'no_publicado' }
]

export const PLANTILLAS = [
  {
    tipo: 'hogar', version: VERSION, nombre_visible: 'Hogar', se_ofrece: true,
    vocabulario: {
      zonas_intro: 'El mapa del modo limpieza: de estas zonas salen las campañas de zona y de limpieza profunda.'
    },
    roles: { visibles: ['adulto', 'junior', 'peque', 'mascota'], al_fundar: 'adulto' },
    funciones: { encargos: true, zonas_privadas: false },
    limites: {},
    progreso_individual: true, expansion_desde_tipo: true
  },
  {
    tipo: 'hogar_compartido', version: VERSION, nombre_visible: 'Hogar compartido', se_ofrece: false,
    vocabulario: {
      zonas_intro: 'Este gremio es de compañeros de piso: cada habitación tiene su dueño, y las campañas se la sugieren a esa persona.'
    },
    roles: { visibles: ['adulto'], al_fundar: 'adulto' },
    funciones: { encargos: false, zonas_privadas: true },
    limites: {},
    progreso_individual: true, expansion_desde_tipo: true
  },
  {
    tipo: 'amigos', version: VERSION, nombre_visible: 'Amigos', se_ofrece: false,
    vocabulario: { zonas_intro: 'Las zonas de este grupo: de aquí salen las campañas compartidas.' },
    roles: { visibles: ['adulto'], al_fundar: 'adulto' },
    funciones: { encargos: false, zonas_privadas: false },
    limites: {},
    progreso_individual: true, expansion_desde_tipo: true
  },
  {
    tipo: 'equipo', version: VERSION, nombre_visible: 'Equipo', se_ofrece: false,
    vocabulario: { zonas_intro: 'Las zonas de este equipo.' },
    roles: { visibles: ['adulto'], al_fundar: 'adulto' },
    funciones: { encargos: true, zonas_privadas: false },
    limites: {},
    // Los dos interruptores de `TIP-13`: si el progreso de un equipo contara
    // y se pudiera forjar desde ahí, un gremio de trabajo sería la vía más
    // barata de subir de nivel y ganar monedas para gastarlas fuera.
    progreso_individual: false, expansion_desde_tipo: false
  }
]

// `plantilla_capacidades`, en la misma forma y con el mismo orden: los
// permisos van de CAP-01 a CAP-17. Los dos juegos de roles conviven en la
// misma tabla a propósito: son el mismo eje —«qué soy yo en este gremio»—
// resuelto por dos caminos, la pertenencia de una persona y el personaje
// que opera con la credencial compartida.
const CAPACIDADES = {
  //          01    02    03     04     05    06    07    08    09    10     11    12    13    14    15     16     17
  titular: ['si', 'si', 'pin', 'pin', 'si', 'si', 'si', 'si', 'si', 'pin', 'si', 'si', 'si', 'si', 'pin', 'pin', 'no'],
  // gestor · como titular salvo cerrar o traspasar el gremio, que es de
  // quien lo fundó y de nadie más.
  gestor: ['si', 'si', 'pin', 'pin', 'si', 'si', 'si', 'si', 'si', 'pin', 'si', 'si', 'si', 'si', 'no', 'pin', 'no'],
  // miembro · está dentro y juega; no administra.
  miembro: ['no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'si', 'si', 'si', 'si', 'no', 'no', 'no'],
  // adulto · lo de siempre, con el PIN. Forjar y usar llaves (13 y 14) son
  // de PERSONA: una credencial compartida no puede, porque no hay a quien
  // cargarle el gasto.
  adulto: ['pin', 'pin', 'pin', 'pin', 'pin', 'pin', 'pin', 'pin', 'pin', 'pin', 'pin', 'si', 'no', 'no', 'pin', 'pin', 'si'],
  junior: ['no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'si', 'no', 'no', 'no', 'no', 'no'],
  peque: ['no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'si', 'no', 'no', 'no', 'no', 'no'],
  mascota: ['no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'si', 'no', 'no', 'no', 'no', 'no']
}

/**
 * El permiso de un rol sobre una capacidad: 'no', 'si' o 'pin'.
 *
 * Lo que no está declarado, no está permitido: una capacidad inventada
 * después de publicar una plantilla no la gana nadie por sorpresa.
 */
export function permisoDe(rol, capacidad) {
  const fila = CAPACIDADES[rol]
  if (!fila) return 'no'
  const n = Number(String(capacidad || '').replace('CAP-', ''))
  if (!Number.isInteger(n) || n < 1 || n > fila.length) return 'no'
  return fila[n - 1]
}

/** La plantilla con la que nació un gremio, o null si no la tiene. */
export function plantillaDe(tipo, version) {
  return PLANTILLAS.find((p) => p.tipo === tipo && p.version === version) || null
}

/** La versión más reciente publicada de un tipo. Para el gremio que nace. */
export function versionDeTipo(tipo) {
  const suyas = PLANTILLAS.filter((p) => p.tipo === tipo).map((p) => p.version)
  return suyas.length ? suyas.sort().at(-1) : null
}

/** Espejo de `tipos_ofrecidos()`: los que se pueden crear hoy. */
export function tiposOfrecidos() {
  return PLANTILLAS
    .filter((p) => p.se_ofrece && p.version === versionDeTipo(p.tipo))
    .map((p) => ({ tipo: p.tipo, version: p.version, nombre_visible: p.nombre_visible }))
    .sort((a, b) => (a.tipo < b.tipo ? -1 : 1))
}

/**
 * Espejo de `hito_expansion()`. Devuelve null cuando no hay tal escalón, y
 * también cuando cae fuera de `escalones_por_gremio`: las dos cosas se
 * responden igual, porque las dos quieren decir que no se puede comprar.
 */
export function hitoExpansion(orden) {
  if (orden > PARAMETROS.escalones_por_gremio) return null
  return ESCALONES.find((e) => e.orden === orden) || null
}

/**
 * Espejo de `tipo_publicado()`. Hoy solo hay tipos publicados en ES, así que
 * declarar otro país no desbloquea nada: deniega.
 */
export function tipoPublicado(tipo, pais) {
  const buscado = String(pais || '').trim().toUpperCase()
  return DISPONIBILIDAD.some(
    (d) => d.tipo === tipo && d.pais === buscado && d.estado === 'publicado'
  )
}

// Las dos fórmulas de nivel, copiadas de `xpForLevel` y `levelFromXp` de
// `src/lib/supabase.js`, que es lo mismo que hace `schema.sql` con
// `xp_de_nivel` y `nivel_de_xp`. Se copian y no se importan para no cerrar
// un ciclo entre el cliente y su propio backend simulado; que las tres
// copias digan lo mismo lo vigila un test, igual que en producción.
export function xpDeNivel(nivel) {
  return 50 * nivel * (nivel - 1)
}

export function nivelDeXp(xp) {
  if (!xp || xp < 0) return 1
  let nivel = 1
  while (nivel < 999 && xp >= xpDeNivel(nivel + 1)) nivel++
  return nivel
}
