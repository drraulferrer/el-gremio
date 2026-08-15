// ------------------------------------------------------------------
// Concordancia de género.
//
// El problema: el castellano marca género en adjetivos y participios, y
// media app le habla directamente a una persona ("lo has resuelto tú
// sola"). Con perfiles de cualquier género, o se concuerda o se dice mal.
//
// La solución NO es la arroma ni la "-e": nadie las lee en voz alta, y
// aquí hay una criatura de tres años a la que le leen la pantalla. Se
// usan tres formas escritas a mano, con la neutra REESCRITA para que no
// necesite marca:
//
//   'Vestirse {solo|sola|sin ayuda}'
//              ▲     ▲      ▲
//              m     f      neutra
//
// La forma neutra es la que se ve cuando no se ha dicho nada, así que es
// la que más se lee: merece estar bien escrita, no ser un apaño.
// ------------------------------------------------------------------

// Los ejemplos son texto REAL de la app (el título de una misión del
// catálogo), no una frase inventada para la ocasión: así lo que se ve al
// elegir es exactamente lo que se va a leer después.
export const GENEROS = [
  { id: 'femenino', etiqueta: 'Femenino', ejemplo: 'Vestirse sola · Veterana' },
  { id: 'masculino', etiqueta: 'Masculino', ejemplo: 'Vestirse solo · Veterano' },
  { id: 'neutro', etiqueta: 'Sin especificar', ejemplo: 'Vestirse sin ayuda · Veteranía' }
]

export const IDS_GENERO = GENEROS.map((g) => g.id)

const ORDEN = { masculino: 0, femenino: 1, neutro: 2 }

/** Un perfil sin género declarado se trata en neutro. */
export function generoDe(perfil) {
  const g = perfil?.gender
  return IDS_GENERO.includes(g) ? g : 'neutro'
}

const MARCA = /\{([^{}]*)\}/g

/**
 * Resuelve las marcas {m|f|n} de una plantilla.
 * @param {string} plantilla texto con cero o más marcas
 * @param {string} genero    femenino · masculino · neutro
 * @returns {string}
 */
export function flex(plantilla, genero = 'neutro') {
  const i = ORDEN[genero] !== undefined ? ORDEN[genero] : ORDEN.neutro
  return String(plantilla ?? '').replace(MARCA, (completo, dentro) => {
    const partes = dentro.split('|')
    // Con menos de tres formas se devuelve la última disponible en vez de
    // romper el texto: es preferible una frase algo torpe a un "{o|a}"
    // en pantalla. El test de plantillas se encarga de que no pase.
    return partes[i] !== undefined ? partes[i] : partes[partes.length - 1]
  })
}

/** ¿Esta plantilla trae las tres formas en todas sus marcas? */
export function plantillaCompleta(plantilla) {
  const marcas = String(plantilla ?? '').match(MARCA) || []
  return marcas.every((m) => m.slice(1, -1).split('|').length === 3)
}

/** Todas las marcas de un texto, para revisarlas de una vez. */
export function marcasDe(plantilla) {
  return (String(plantilla ?? '').match(MARCA) || []).map((m) => m.slice(1, -1).split('|'))
}
