// ------------------------------------------------------------------
// El latido del avatar: enseñar un gesto que no se ve.
//
// La ficha de la peque se abre tocando su propio avatar, y ese gesto no
// tiene ninguna pista visual: para alguien que no lee, un botón que
// parece un adorno es un botón que no existe. El latido lo señala.
//
// Y SE APAGA, que es la mitad importante. Una animación permanente deja
// de comunicar en dos días y pasa a ser ruido en una pantalla que ya
// tiene bastante movimiento. Se apaga por dos vías, la que llegue antes:
//
//   · ya lo ha encontrado (lo ha abierto unas cuantas veces), o
//   · han pasado los días de gracia y no lo va a encontrar sola, así que
//     el latido tampoco está sirviendo.
//
// El estado vive en el dispositivo, no en la base: es una ayuda de
// aprendizaje de ESTA pantalla, y si la abre en la tablet del salón, ahí
// también conviene enseñárselo.
// ------------------------------------------------------------------

export const APERTURAS_PARA_APRENDER = 3
export const DIAS_DE_GRACIA = 10

const DIA_MS = 86400000

/**
 * ¿Sigue haciendo falta el latido?
 * @param {number} aperturas veces que ha abierto la ficha en este aparato
 * @param {number|null} desde primera vez que se vio la pantalla (ms)
 */
export function debeLatir({ aperturas = 0, desde = null, ahora = Date.now() } = {}) {
  if (aperturas >= APERTURAS_PARA_APRENDER) return false
  if (desde && ahora - desde > DIAS_DE_GRACIA * DIA_MS) return false
  return true
}

// --- Persistencia por dispositivo y por perfil ----------------------
// Por perfil y no global: dos criaturas en la misma tablet aprenden cada
// una a su ritmo, y el contador de una no puede apagarle la pista a la
// otra.

const clave = (profileId, que) => `gremio_ficha_${que}_${profileId}`

export function leerLatido(profileId, almacen = localStorage) {
  try {
    const aperturas = Number(almacen.getItem(clave(profileId, 'aperturas'))) || 0
    const desdeCrudo = almacen.getItem(clave(profileId, 'desde'))
    // La primera vez se sella ahora: sin sello, los días de gracia no
    // empezarían a contar nunca y el latido sería eterno.
    const desde = desdeCrudo ? Number(desdeCrudo) : null
    return { aperturas, desde }
  } catch {
    return { aperturas: 0, desde: null }
  }
}

export function sellarPrimeraVez(profileId, ahora = Date.now(), almacen = localStorage) {
  try {
    if (!almacen.getItem(clave(profileId, 'desde'))) {
      almacen.setItem(clave(profileId, 'desde'), String(ahora))
    }
  } catch {
    // Un navegador sin almacenamiento no puede aprender, pero tampoco
    // debe romperse: el latido se quedará encendido y ya está.
  }
}

export function contarApertura(profileId, almacen = localStorage) {
  try {
    const { aperturas } = leerLatido(profileId, almacen)
    almacen.setItem(clave(profileId, 'aperturas'), String(aperturas + 1))
    return aperturas + 1
  } catch {
    return 0
  }
}
