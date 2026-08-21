// ------------------------------------------------------------------
// Leer el registro: convertir filas de `app_logs` en algo mirable.
//
// Este fichero nace de un fallo concreto. Del 19 al 21 de agosto la app
// no concedió ni un sello —`onConflict` contra un índice que la 030 se
// había llevado— y escribió 294 líneas de error diciéndolo. El panel
// parental las tenía delante y enseñaba esto:
//
//     error.capturado
//     21/8/2026, 23:50:30 · 2.14.0+9794e97 · petición —
//
// Siete veces seguidas. El nombre del evento («error.capturado») es el
// mismo para TODOS los errores de la app, así que la lista decía «ha
// fallado algo» siete veces y jamás decía QUÉ. Lo que hacía falta —la
// huella, el código de Postgres, de dónde salía— estaba guardado en
// `datos` y no se pintaba.
//
// Dos reglas, y las dos vienen de ahí:
//
//   1. Lo primero que se lee es el mensaje, no el nombre del evento.
//   2. Lo repetido se agrupa y se cuenta. Un fallo que ocurre 294 veces
//      y uno que ocurre una vez no pueden ocupar el mismo espacio: la
//      lista sin agrupar entierra lo grave bajo lo repetido.
// ------------------------------------------------------------------

/**
 * Lo que se puede contar de una fila de registro, con el nombre que se
 * lee en pantalla. Defensivo a propósito: `datos` es JSON libre y las
 * filas viejas no tienen por qué traer los campos de hoy.
 */
export function resumenDeFila(fila) {
  const datos = fila?.datos || {}
  const detalle = datos.detalle || {}
  return {
    id: fila?.id,
    nivel: fila?.nivel || 'error',
    evento: fila?.evento || 'desconocido',
    // La huella ya viene normalizada por monitoring.js (sin UUIDs ni
    // cifras), que es justo lo que permite agrupar. Si falta, se cae al
    // mensaje y, en último caso, al nombre del evento.
    huella: datos.huella || detalle.message || detalle.mensaje || fila?.evento || 'desconocido',
    codigo: detalle.code || null,
    origen: datos.origen || null,
    // `ajeno` lo calcula `origenDelError`: fichero, línea y columna
    // vacíos significan que el fallo viene de fuera de nuestro código
    // —una extensión del navegador, casi siempre— y que no se puede
    // diagnosticar. Marcarlo evita perseguir fantasmas durante una tarde.
    ajeno: datos.ajeno === true,
    release: fila?.release || datos.release || null,
    ts: fila?.ts || datos.ts || null
  }
}

/**
 * Agrupa por huella. Devuelve lo más repetido primero y, a igualdad, lo
 * más reciente: si dos fallos han pasado una vez cada uno, importa el de
 * hace diez minutos y no el del martes.
 */
export function agruparErrores(filas = []) {
  const porHuella = new Map()

  for (const fila of filas) {
    const r = resumenDeFila(fila)
    const previo = porHuella.get(r.huella)
    if (!previo) {
      porHuella.set(r.huella, {
        huella: r.huella,
        nivel: r.nivel,
        codigo: r.codigo,
        origen: r.origen,
        ajeno: r.ajeno,
        veces: 1,
        primera: r.ts,
        ultima: r.ts,
        releases: r.release ? [r.release] : []
      })
      continue
    }
    porHuella.set(r.huella, {
      ...previo,
      veces: previo.veces + 1,
      // Las filas llegan de la más nueva a la más vieja, pero no se da
      // por supuesto: se comparan las fechas.
      primera: menor(previo.primera, r.ts),
      ultima: mayor(previo.ultima, r.ts),
      // Un error que aparece en varias versiones es un error que sobrevivió
      // a un despliegue, y eso cambia cómo se busca.
      releases: r.release && !previo.releases.includes(r.release)
        ? [...previo.releases, r.release]
        : previo.releases,
      // Un `error` manda sobre un `warn` con la misma huella.
      nivel: previo.nivel === 'error' || r.nivel === 'error' ? 'error' : previo.nivel,
      codigo: previo.codigo || r.codigo,
      origen: previo.origen || r.origen
    })
  }

  return [...porHuella.values()].sort((a, b) =>
    b.veces !== a.veces ? b.veces - a.veces : String(b.ultima || '').localeCompare(String(a.ultima || ''))
  )
}

const menor = (a, b) => (!a ? b : !b ? a : a < b ? a : b)
const mayor = (a, b) => (!a ? b : !b ? a : a > b ? a : b)

/**
 * Una frase para la cabecera: cuántos fallos distintos y cuántas veces
 * en total. Es lo único que hay que leer para saber si hay que mirar.
 */
export function tituloDeErrores(grupos = []) {
  if (grupos.length === 0) return 'Ni un error registrado. Buena señal.'
  const veces = grupos.reduce((n, g) => n + g.veces, 0)
  const propios = grupos.filter((g) => !g.ajeno).length
  const distintos = grupos.length === 1 ? '1 fallo distinto' : `${grupos.length} fallos distintos`
  const total = veces === 1 ? '1 vez' : `${veces} veces`
  // Se dice cuántos son ajenos porque cambia la conclusión: cinco fallos
  // de extensiones del navegador no son cinco fallos de la app.
  const ajenos = grupos.length - propios
  return ajenos > 0
    ? `${distintos}, ${total}. ${ajenos} de fuera de la app.`
    : `${distintos}, ${total}.`
}
