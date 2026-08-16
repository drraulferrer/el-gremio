// ------------------------------------------------------------------
// Sacar la app de un iframe ajeno (clickjacking).
//
// POR QUÉ ESTO EXISTE Y NO ES UNA LÍNEA DE LA CSP: la política de
// `index.html` viaja en un `<meta>` porque GitHub Pages no deja poner
// cabeceras, y **`frame-ancestors` se ignora cuando la política llega por
// meta**. O sea que la defensa normal contra el iframe no está
// disponible, y `X-Frame-Options` tampoco: como meta también se ignora.
// Mientras el alojamiento no sirva cabeceras, esto es lo único que queda.
//
// Qué se evita: alguien mete elgremioapp.com en un iframe invisible bajo
// su propia página y coloca sus botones encima. Quien cree que pulsa allí
// está pulsando aquí, con la sesión del gremio abierta. Los dos sitios que
// duelen son la pantalla de entrada y el panel parental.
//
// Hay dos desenlaces y los dos hay que tratarlos. Saltar fuera funciona
// casi siempre; con un iframe `sandbox` sin `allow-top-navigation` la
// navegación al padre lanza SecurityError y la app se quedaría DENTRO,
// pintada y funcionando, que es exactamente lo que no puede pasar. Por eso
// esto devuelve el desenlace en vez de un booleano: quien llama tiene que
// poder negarse a arrancar.
// ------------------------------------------------------------------

/**
 * ¿Estamos dentro de un marco?
 *
 * En duda, sí. Comparar `self` y `top` no suele fallar ni entre orígenes
 * distintos, pero si algún día falla, la respuesta prudente es la que no
 * arranca la app dentro de la página de otro.
 */
export function enMarco(v = window) {
  try {
    return v.self !== v.top
  } catch {
    return true
  }
}

/**
 * Intenta salir. Devuelve qué ha pasado:
 *
 *   'suelto'   → no había marco, seguir con normalidad
 *   'saliendo' → se ha pedido al navegador ir a la página de verdad
 *   'atrapado' → el marco no deja salir; NO se puede pintar la app
 */
export function romperMarco(v = window) {
  if (!enMarco(v)) return 'suelto'
  try {
    v.top.location = v.self.location.href
    return 'saliendo'
  } catch {
    return 'atrapado'
  }
}
