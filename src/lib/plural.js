// ------------------------------------------------------------------
// Singular y plural.
//
// «1 estrellas guardadas» delata que nadie ha leído esa frase, y en la
// pantalla de la peque es la única que se lee en voz alta: ahí el texto
// visible son dibujos, y el `aria-label` es TODO lo que oye quien navega
// con lector de pantalla.
//
// Vivía suelto dentro de `sellos-lore.js`, donde nadie más podía usarlo.
// ------------------------------------------------------------------

/** `plural(1, 'estrella', 'estrellas')` → «1 estrella». */
export function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`
}
