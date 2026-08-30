// ------------------------------------------------------------------
// El gremio activo, y el personaje de cada gremio.
//
// Hasta la 6.2 la app cargaba UN gremio —`limit 1`, el más antiguo— y
// guardaba el personaje elegido en una sola clave global,
// `gremio_profile`. Las dos cosas funcionaban porque una cuenta solo podía
// tener un gremio, y eso lo garantizaba un índice único en la base.
//
// Desde la migración 057 ya no. Este módulo es lo que sustituye a los dos
// supuestos:
//
//   · CUÁL ES EL GREMIO ACTIVO. Se recuerda **por dispositivo** y no en la
//     base (`C-2`): es una preferencia de este aparato, no un dato del
//     gremio ni de la persona. El mismo criterio que la Crónica y el muro.
//
//   · QUÉ PERSONAJE SOY EN CADA UNO. Una clave por gremio, porque el id
//     guardado pertenece a uno solo: con la clave global, cambiar de gremio
//     dejaba apuntando a un perfil que no está en el gremio activo, y los
//     siete sitios que la leen fallaban cada uno a su manera —unos con un
//     `undefined` y los peores cogiendo el primero de la lista.
//
// El almacén se inyecta (`almacen = localStorage`), como en latido.js y
// temporizador.js: los tests corren en Node, donde no existe.
// ------------------------------------------------------------------

export const CLAVE_ACTIVO = 'gremio_activo'
export const CLAVE_PERFIL = 'gremio_perfil'

/** La clave global de antes de la 6.2. Se lee una vez y se retira. */
export const CLAVE_PERFIL_VIEJA = 'gremio_profile'

export function clavePerfil(familyId) {
  return `${CLAVE_PERFIL}:${familyId}`
}

// Todo lo que toca el almacén pasa por estas dos: en el modo privado de
// Safari `localStorage` existe y lanza al escribir, y perder el gremio
// activo no es motivo para que la app no arranque.
function leer(almacen, clave) {
  try {
    return almacen.getItem(clave)
  } catch {
    return null
  }
}

function escribir(almacen, clave, valor) {
  try {
    if (valor === null) almacen.removeItem(clave)
    else almacen.setItem(clave, valor)
  } catch {
    // Sin almacén la elección dura lo que la pestaña. Es peor, no es grave.
  }
}

export function leerGremioActivo(almacen = localStorage) {
  return leer(almacen, CLAVE_ACTIVO)
}

export function recordarGremioActivo(familyId, almacen = localStorage) {
  escribir(almacen, CLAVE_ACTIVO, familyId || null)
}

/**
 * Cuál de mis gremios se abre.
 *
 * El guardado, si sigue estando entre los míos; si no, el más antiguo.
 * Esa segunda parte es `C-3`: si la pertenencia desapareció mientras tanto
 * —abandoné desde otro aparato, o me expulsaron— la app no puede quedarse
 * operando sobre un gremio al que ya no pertenezco, ni enseñar una pantalla
 * en blanco. Vuelve a uno que sí es mío.
 *
 * El orden importa y por eso se ordena aquí y no se confía en el que venga:
 * es la misma razón por la que `loadFamily` llevaba un `order('created_at')`
 * desde la migración 017.
 */
export function elegirActivo(gremios = [], guardado = null) {
  if (!gremios.length) return null
  const ordenados = [...gremios].sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || ''))
  )
  return ordenados.find((g) => g.id === guardado) || ordenados[0]
}

/**
 * El personaje elegido en ESTE gremio, en ESTE aparato.
 *
 * Y el rescate de la clave vieja: si este gremio todavía no tiene la suya y
 * existe la global, se adopta. Sin esto, desplegar la 6.2 expulsaría a toda
 * la familia de su personaje y les haría volver a elegirlo.
 *
 * Que el rescate se lo lleve el primer gremio que pregunte no es un
 * problema, y conviene tener claro por qué: **el día del despliegue nadie
 * tiene dos gremios**. La 6.1 dejó el servidor listo pero mantuvo esa
 * invariante justo para que este momento fuera seguro.
 */
export function leerPerfil(familyId, almacen = localStorage) {
  if (!familyId) return null
  const propio = leer(almacen, clavePerfil(familyId))
  if (propio) return propio

  const viejo = leer(almacen, CLAVE_PERFIL_VIEJA)
  if (viejo) {
    escribir(almacen, clavePerfil(familyId), viejo)
    escribir(almacen, CLAVE_PERFIL_VIEJA, null)
    return viejo
  }
  return null
}

export function recordarPerfil(familyId, profileId, almacen = localStorage) {
  if (!familyId) return
  escribir(almacen, clavePerfil(familyId), profileId || null)
}

export function olvidarPerfil(familyId, almacen = localStorage) {
  if (!familyId) return
  escribir(almacen, clavePerfil(familyId), null)
}

/**
 * Al cerrar sesión: se van el gremio activo y el personaje de TODOS los
 * gremios, no solo el del activo. Dejar apuntado en un aparato compartido
 * quién era alguien en un gremio del que ya no hay sesión es justo lo que
 * la limpieza de `signOut` venía a evitar.
 */
export function olvidarTodo(almacen = localStorage) {
  try {
    const claves = []
    for (let i = 0; i < almacen.length; i++) {
      const k = almacen.key(i)
      if (k === CLAVE_ACTIVO || k === CLAVE_PERFIL_VIEJA || k?.startsWith(`${CLAVE_PERFIL}:`)) {
        claves.push(k)
      }
    }
    claves.forEach((k) => almacen.removeItem(k))
  } catch {
    // Modo privado de Safari y poco más. No es motivo para no salir.
  }
}
