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
