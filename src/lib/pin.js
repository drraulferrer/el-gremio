// ------------------------------------------------------------------
// Reglas del PIN parental.
//
// Recordatorio de lo que esto es y lo que no: un cerrojo doméstico
// dentro de la sesión familiar, con hash SHA-256 en cliente. Frena a
// quien tenga once años y curiosidad, no a quien sepa abrir la consola
// del navegador. Por eso las reglas de aquí son de sentido común (que no
// sea 0000, que no sea el mismo de antes) y no una política de
// contraseñas: pedir símbolos y mayúsculas en un teclado numérico que va
// a teclear un adulto veinte veces al día sería teatro.
// ------------------------------------------------------------------

export const PIN_MINIMO = 4
export const PIN_MAXIMO = 8

const TRIVIALES = ['0000', '1111', '1234', '00000', '11111', '12345', '123456', '000000', '111111']

export function esSoloDigitos(pin) {
  return /^\d+$/.test(String(pin || ''))
}

export function esTrivial(pin) {
  return TRIVIALES.includes(String(pin || ''))
}

/**
 * ¿Se puede guardar este PIN nuevo?
 * @param {{nuevo: string, repetido: string, actual?: string}} datos
 * @returns {{ok: boolean, mensaje: string, aviso: string}}
 */
export function validarPin({ nuevo, repetido, actual }) {
  const n = String(nuevo || '')

  if (n.length < PIN_MINIMO) {
    return { ok: false, mensaje: `El PIN necesita al menos ${PIN_MINIMO} dígitos.`, aviso: '' }
  }
  if (n.length > PIN_MAXIMO) {
    return { ok: false, mensaje: `El PIN no puede pasar de ${PIN_MAXIMO} dígitos.`, aviso: '' }
  }
  if (!esSoloDigitos(n)) {
    return { ok: false, mensaje: 'El PIN solo puede tener números.', aviso: '' }
  }
  if (n !== String(repetido || '')) {
    return { ok: false, mensaje: 'Los dos PIN no coinciden.', aviso: '' }
  }
  if (actual !== undefined && n === String(actual)) {
    return { ok: false, mensaje: 'Ese es el PIN que ya tenías.', aviso: '' }
  }

  // Un PIN trivial no bloquea: avisa. Quien decide es quien lo teclea.
  return {
    ok: true,
    mensaje: '',
    aviso: esTrivial(n) ? 'Ese PIN es de los primeros que prueba cualquiera. ¿Seguro?' : ''
  }
}
