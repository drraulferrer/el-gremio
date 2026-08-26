/**
 * Los textos legales y su aceptación.
 *
 * Viven en `public/legal/` como páginas sueltas, no dentro del bundle, por
 * la misma razón que la exposición pública: hay que poder leerlos SIN
 * tener cuenta y sin cargar React, porque justo se leen antes de decidir
 * si se crea la cuenta. Un texto legal que solo se ve desde dentro de la
 * app no está publicado.
 */

/**
 * Versión vigente. Es la fecha del documento, no un número de serie: así
 * la que se guarda junto a la cuenta se puede comparar de un vistazo con
 * la que encabeza la página.
 *
 * ⚠️ Si cambias `public/legal/*.html` de forma relevante, sube esto Y la
 * fecha de los dos documentos. La versión guardada es la prueba de QUÉ
 * aceptó cada familia; si el texto cambia y la versión no, esa prueba
 * pasa a decir algo falso.
 */
export const VERSION_LEGAL = '2026-08-26'

export const DOCUMENTOS = {
  privacidad: { archivo: 'legal/privacidad.html', titulo: 'Política de privacidad' },
  terminos: { archivo: 'legal/terminos.html', titulo: 'Condiciones de uso' }
}

/**
 * URL de un documento a partir de la raíz canónica del gremio (la que
 * devuelve `urlDelGremio()` en src/lib/dominio.js). Se pasa como
 * argumento en vez de leerla aquí para que esto se pueda probar sin
 * navegador.
 *
 * Se pide el fichero por su nombre —`privacidad.html` y no `privacidad/`—
 * a propósito: el servidor de Vite no sirve el índice de un directorio de
 * `public/`, así que la dirección corta funciona en producción y parece
 * rota justo al comprobarla en local. Es la misma trampa que ya tiene
 * documentada `urlDeLaNarrativa()`.
 */
export function urlLegal(doc, raiz = '/') {
  const archivo = DOCUMENTOS[doc]?.archivo
  if (!archivo) return raiz
  return (raiz.endsWith('/') ? raiz : raiz + '/') + archivo
}

/**
 * Lo que se guarda junto a la cuenta como prueba de la aceptación.
 *
 * Va en los metadatos del alta —viaja con la cuenta desde el primer
 * instante, incluso antes de confirmar el correo— y se copia al gremio al
 * fundarlo, que es cuando ya hay sesión. Dos sitios a propósito: el
 * primero existe siempre, el segundo no lo puede reescribir quien usa la
 * app sin dejar rastro.
 */
export function datosDeAceptacion(ahora = new Date()) {
  return {
    legal_version: VERSION_LEGAL,
    legal_aceptado_en: ahora.toISOString()
  }
}

/**
 * ¿Puede seguir el alta?
 *
 * Existe como función y no como `if (marcado)` suelto en la pantalla
 * porque es la regla que convierte «hay una casilla» en «hay
 * consentimiento»: sin marcarla el alta no sale, y eso hay que poder
 * probarlo sin abrir el navegador.
 */
export function puedeAceptar(marcado) {
  return marcado === true
}
