// ------------------------------------------------------------------
// El premio intermedio de la peque: los globos.
//
// Problema que resuelve. Su tienda funciona, pero un premio de seis
// estrellas está a tres o cuatro días vista, y a los tres años eso no
// existe como incentivo. Entre «he tocado una baldosa» y «tengo el
// cuento» no había nada. Los globos son ese algo: llegan hoy, se ven
// venir, y dan una estrella de verdad para el tarro.
//
// Por qué la MITAD y no el pleno. Exigir todas las misiones convierte
// cualquier día regular en un cero, y un cero repetido apaga el sistema
// entero. La mitad es alcanzable un martes malo y sigue costando algo.
// Se redondea hacia arriba: con cinco misiones hacen falta tres, no dos.
//
// Lo que NO está aquí: el tope de una vez al día. Vive en Postgres
// (migración 012, índice único por perfil y día). Si viviera en esta
// función, recargar la página daría globos infinitos y jugar desde dos
// dispositivos daría dos estrellas.
// ------------------------------------------------------------------

import { MONEDAS_POR_ESTRELLA } from './premios'

/** Globos que hay que reventar. Ni tantos que canse, ni tan pocos que no sepa a nada. */
export const GLOBOS_DEL_JUEGO = 6

/** Lo que paga, una estrella exacta. El valor de verdad lo pone la base. */
export const MONEDAS_DEL_JUEGO = MONEDAS_POR_ESTRELLA

/**
 * ¿Ese día de la base es hoy?
 *
 * Postgres devuelve un `date` como '2026-08-15', con ceros, y el `dayKey`
 * del cliente monta '2026-8-15' sin ellos. Comparados en crudo no casan
 * NUNCA, y el efecto sería que el juego se puede cobrar todos los días
 * varias veces... hasta que la base lo rechaza y la niña ve un error en
 * vez de una estrella. Se normalizan los dos lados por número.
 */
export function esDeHoy(dia, hoy) {
  if (!dia || !hoy) return false
  const partes = String(dia).split('-').map(Number)
  if (partes.length !== 3 || partes.some(Number.isNaN)) return false
  return `${partes[0]}-${partes[1]}-${partes[2]}` === String(hoy)
}

/** Cuántas misiones hacen falta hoy. Mitad, redondeando hacia arriba. */
export function metaDelDia(total) {
  return total > 0 ? Math.ceil(total / 2) : 0
}

/**
 * En qué punto está el juego.
 *
 * `disponible` es lo que abre el botón; `cobrado` deja la puerta cerrada
 * pero enseña que hoy ya cayó, que no es lo mismo que no haber llegado.
 */
export function estadoDelJuego({ total = 0, hechas = 0, yaCobrado = false } = {}) {
  const meta = metaDelDia(total)
  const alcanzada = meta > 0 && hechas >= meta
  return {
    meta,
    hechas,
    alcanzada,
    cobrado: Boolean(yaCobrado),
    disponible: alcanzada && !yaCobrado,
    faltan: Math.max(0, meta - hechas)
  }
}

// ------------------------------------------------------------------
// El siguiente premio
//
// La tienda ya enseña todos los premios con sus estrellas encendidas y
// apagadas, pero hay que abrirla para verlo. En la pantalla principal
// basta con UNO: el más barato que todavía no alcanza, que es el que
// contesta «¿para qué estoy haciendo esto?» mientras lo hace.
// ------------------------------------------------------------------

/**
 * El premio hacia el que va. El más barato de los que aún no puede pedir;
 * si ya le llega para todos, el más caro que puede pedir, para que la tira
 * no se quede vacía justo cuando más ha conseguido.
 */
export function siguientePremio(premios = [], estrellas = 0, costeEnEstrellas = (p) => p.cost) {
  if (!premios.length) return null
  const ordenados = [...premios].sort((a, b) => costeEnEstrellas(a) - costeEnEstrellas(b))
  const pendiente = ordenados.find((p) => costeEnEstrellas(p) > estrellas)
  if (pendiente) {
    return { premio: pendiente, cuesta: costeEnEstrellas(pendiente), alcanza: false }
  }
  const ultimo = ordenados[ordenados.length - 1]
  return { premio: ultimo, cuesta: costeEnEstrellas(ultimo), alcanza: true }
}
