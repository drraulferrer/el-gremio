// ------------------------------------------------------------------
// Premio a mano: Talis extra por algo excepcional.
//
// Existe porque la vida no cabe en el catálogo. Un día se porta de una
// manera que nadie había previsto, ayuda en algo que no era su tarea, o
// pasa algo que merece reconocerse y no hay misión para ello.
//
// Tres reglas, y las tres tienen su porqué:
//
//  1. NO da XP, solo Talis. La XP marca el nivel y alimenta la meta del
//     gremio, y las dos están calculadas contra un ritmo. Un extra a mano
//     que subiera de nivel convertiría el premio excepcional en la vía
//     rápida, y en dos semanas nadie haría misiones.
//  2. El motivo es OBLIGATORIO. Sin él, dentro de un mes nadie recuerda
//     por qué esa persona tiene cincuenta Talis de más, y el sistema
//     pasa de tener reglas a depender del humor del adulto de turno.
//  3. Lo concede un adulto, y queda registrado CUÁL. No es desconfianza:
//     es que si mañana hay que explicar el saldo, la respuesta tiene que
//     existir en algún sitio.
//
// El tope no es antifraude —nadie va a estafar aquí—, es contra el dedo
// gordo: teclear 500 donde iban 50 descuadra la economía de un mes, y
// eso sí pasa.
// ------------------------------------------------------------------

/** Lo máximo que se puede dar de una vez. Un error de un dígito, contenido. */
export const MAXIMO_MANUAL = 200

/** A partir de aquí conviene mirarlo dos veces, pero no se bloquea. */
export const AVISO_MANUAL = 60

export function motivoValido(texto) {
  const t = String(texto || '').trim()
  return t.length >= 3 && t.length <= 240
}

export function cantidadValida(monedas) {
  const n = Number(monedas)
  return Number.isInteger(n) && n > 0 && n <= MAXIMO_MANUAL
}

/**
 * ¿Se puede conceder? Devuelve el primer problema en un mensaje, o null si
 * todo está bien. Un solo sitio decide, para que la interfaz y lo que se
 * envía no puedan discrepar.
 */
export function revisarPremioManual({ monedas, motivo, otorgadoPor, perfiles = [] }) {
  if (!cantidadValida(monedas)) {
    return `Los Talis tienen que ser un número entero entre 1 y ${MAXIMO_MANUAL}.`
  }
  if (!motivoValido(motivo)) {
    return 'Escribe el motivo: sin él, dentro de un mes nadie sabrá por qué.'
  }
  const quien = perfiles.find((p) => p.id === otorgadoPor)
  if (!quien) return 'Falta decir qué adulto lo concede.'
  if (quien.role !== 'adulto') return 'Solo un adulto puede conceder un premio a mano.'
  if (quien.active === false) return 'Ese perfil está retirado.'
  return null
}

/** Aviso blando cuando la cantidad es alta. No impide nada. */
export function avisoDeCantidad(monedas) {
  const n = Number(monedas)
  if (!Number.isFinite(n) || n <= AVISO_MANUAL) return null
  return `${n} Talis son bastantes: en la tienda eso se acerca a una recompensa entera. ¿Seguro?`
}

// ------------------------------------------------------------------
// El aviso de que han caído Talis a mano.
//
// Esto faltaba, y faltaba de una forma que dejaba coja la regla 2 de
// arriba. El motivo es obligatorio «para que dentro de un mes se sepa
// por qué», pero hasta ahora ese motivo solo lo leía quien lo escribió:
// a quien los recibe le subía la Bolsa de golpe y nadie le decía nada.
// Reconocer algo sin decírselo a la persona no es reconocer, es
// contabilizar.
//
// Se avisa UNA vez por concesión y por aparato, con la marca en
// `localStorage` igual que la visita al muro: es una marca de un
// dispositivo, no un dato del gremio, y que el móvil y la tablet lleven
// cuentas distintas no rompe nada y ahorra una migración.
// ------------------------------------------------------------------

const CLAVE_AVISADOS = 'gremio_manual_avisado:'

/** Cuántas concesiones se recuerdan por perfil. */
const TOPE_RECUERDO = 60

/**
 * Lo viejo no se anuncia, se calla.
 *
 * Sin esta ventana, estrenar la app en un móvil nuevo sacaría de golpe
 * el aviso de todos los premios a mano de la historia del gremio. Y un
 * «te han dado 20 Talis» de hace cuatro meses no reconoce nada: solo
 * desconcierta. Catorce días es lo que dura la conversación de casa
 * sobre algo que pasó.
 */
export const DIAS_DE_AVISO = 14

/** Los premios a mano de una persona, del más reciente al más viejo. */
export function manualesDe(bonuses = [], profileId, perfiles = []) {
  return bonuses
    .filter((b) => b.tipo === 'manual' && b.profile_id === profileId)
    .map((b) => ({
      id: b.id,
      coins: Number(b.coins) || 0,
      motivo: String(b.motivo || '').trim(),
      cuando: b.created_at || null,
      // El nombre de quien lo concedió, si sigue en el gremio. Sin él el
      // aviso dice «te han dado», que es de nadie; con él dice quién se
      // acordó, que es la mitad del reconocimiento.
      quien: perfiles.find((p) => p.id === b.otorgado_por)?.name || null
    }))
    .sort((a, b) => String(b.cuando || '').localeCompare(String(a.cuando || '')))
}

/**
 * Qué hacer con cada premio pendiente: `avisar` los recientes que no se
 * han enseñado, `callar` los que ya no vienen a cuento.
 *
 * Devuelve las dos listas y no solo la primera a propósito: lo viejo hay
 * que marcarlo como visto igual, o volvería a mirarse en cada arranque.
 */
export function pendientesDeAviso(manuales = [], avisados = [], ahora = new Date()) {
  const vistos = new Set(avisados)
  const limite = new Date(ahora.getTime() - DIAS_DE_AVISO * 86400000).toISOString()
  const nuevos = manuales.filter((m) => m.id && !vistos.has(m.id))
  return {
    avisar: nuevos.filter((m) => String(m.cuando || '') >= limite),
    callar: nuevos.filter((m) => String(m.cuando || '') < limite)
  }
}

export function leerAvisados(profileId, almacen = localStorage) {
  try {
    const crudo = almacen.getItem(CLAVE_AVISADOS + profileId)
    const lista = crudo ? JSON.parse(crudo) : []
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

export function marcarAvisados(profileId, ids = [], almacen = localStorage) {
  if (!ids.length) return
  try {
    // Los más recientes primero y con tope: esta lista solo sirve para no
    // repetir un aviso, y sin recorte crecería sin fin en un aparato que
    // lleve años en la cocina.
    const juntos = [...new Set([...ids, ...leerAvisados(profileId, almacen)])].slice(0, TOPE_RECUERDO)
    almacen.setItem(CLAVE_AVISADOS + profileId, JSON.stringify(juntos))
  } catch {
    // Sin almacenamiento el aviso saldrá otra vez. Molesta; no rompe.
  }
}
