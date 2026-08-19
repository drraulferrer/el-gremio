// ------------------------------------------------------------------
// Talis: el vocabulario de la moneda del Gremio, en un solo sitio.
//
// Hasta la 2.4.0 esto se llamaba «monedas» y se escribía a mano en cada
// pantalla. El problema no era el nombre: era que un sistema que dice
// «monedas» está diciendo, sin querer, «te pago por hacer esto». Y ese
// es exactamente el marco que el resto del diseño lleva un mes evitando
// (ver el Tutorial y docs/FUNDAMENTO-CIENTIFICO.md: la recompensa
// externa estorba cuando acaba siendo el único motivo).
//
// Un Talis no es un pago. Es una ficha de reconocimiento: la marca de
// que alguien ha contribuido. Se sigue gastando en la tienda igual que
// antes —la mecánica no cambia—, pero lo que se cuenta al ganarlo sí:
//
//   Encargo → Misión → Acción → Talis → Recompensa
//
// DECISIÓN IMPORTANTE, para que nadie la deshaga por «coherencia»:
// dentro del código y en Postgres el recurso se sigue llamando `coins`.
// No hay migración. El propio documento de lore separa el «concepto
// funcional» del «nombre narrativo», y esa separación es la que hace que
// se pueda cambiar el relato sin tocar el esquema ni las funciones que
// abonan. `coins` es la columna; Talis es lo que lee la familia.
//
// Y la regla que sostiene todo lo demás: los Talis se ganan y se gastan;
// las insignias no se compran. Si algún día algo deja canjear una
// insignia por Talis, esto se convierte en una tienda de puntos y deja
// de significar nada.
// ------------------------------------------------------------------

/** Nombre canónico. Invariable: `1 Talis`, `20 Talis`. Nunca «Talises». */
export const TALIS = 'Talis'

/** Dónde se guardan. Es el saldo, con nombre de gremio. */
export const BOLSA = 'Bolsa de Talis'

/** El catálogo de premios, con nombre de gremio. */
export const CASA = 'Casa de Recompensas'

/** Lo que resume el sistema entero en cuatro palabras. */
export const LEMA = 'Tu esfuerzo deja marca.'

/**
 * Cantidad + nombre, con el separador de miles en español.
 *
 * Existe para que nadie vuelva a escribir `${n} moneda${n === 1 ? '' : 's'}`:
 * Talis no pluraliza, y la única forma de que eso no se olvide en la
 * pantalla número catorce es que no haya que decidirlo cada vez.
 */
export function talis(n) {
  return `${Number(n || 0).toLocaleString('es-ES')} ${TALIS}`
}

// Aquí vivía `conFicha(n)`, que devolvía `🪙 45 Talis`. Se retira en la
// 2.8.1 por dos motivos a la vez: no la llamaba nadie —solo su propio
// test— y dejaba el emoji escrito en una función con nombre atractivo,
// así que el próximo que buscara «cómo se pinta un importe» habría
// reintroducido justo el problema que esa versión venía a arreglar.
//
// Un importe con ficha se pinta con el componente `<Talis n={...} />` de
// `components/ui.jsx`, que usa la pieza grabada. Para texto plano —una
// plantilla, un aviso, un `aria-label`— está `talis(n)`, que devuelve
// «45 Talis» y no necesita ninguna imagen.

// ------------------------------------------------------------------
// La historia, que no se cuenta entera de golpe.
//
// Soltar el lore completo en el onboarding es la forma más rápida de que
// nadie lo lea. Se descubre a trozos, y cada trozo llega cuando la
// persona ya ha vivido lo que el texto cuenta: el primero al ganar el
// primer Talis, el último cuando ya tiene insignias y puede entender por
// qué esas no se compran.
//
// Los umbrales van sobre Talis GANADOS en total, no sobre el saldo. Si
// fueran sobre el saldo, gastar en la tienda borraría la historia, que
// es justo lo contrario de lo que estos textos dicen.
// ------------------------------------------------------------------

export const FRAGMENTOS = [
  {
    id: 'primer-talis',
    romano: 'I',
    titulo: 'El primer Talis',
    ganados: 1,
    insignias: 0,
    texto:
      'Hace mucho tiempo, los miembros del Gremio comenzaron a marcar pequeñas ' +
      'piezas con su emblema para reconocer los encargos cumplidos. Aquellas ' +
      'piezas recibieron un nombre: Talis.'
  },
  {
    id: 'el-valor',
    romano: 'II',
    titulo: 'El valor',
    ganados: 100,
    insignias: 0,
    texto:
      'Los antiguos maestros decían que un Talis vacío no valía nada. Era la ' +
      'historia detrás de cada pieza la que le daba valor.'
  },
  {
    id: 'la-bolsa',
    romano: 'III',
    titulo: 'La bolsa',
    ganados: 500,
    insignias: 0,
    texto:
      'Los miembros guardaban sus Talis como recuerdo de los encargos ' +
      'realizados. Una bolsa llena significaba que alguien había trabajado ' +
      'muchas veces por su comunidad.'
  },
  {
    id: 'la-obra',
    romano: 'IV',
    titulo: 'La obra',
    ganados: 500,
    insignias: 1,
    texto:
      'Ningún aprendiz se convertía en maestro por acumular monedas. Tenía que ' +
      'demostrar lo aprendido. Por eso los Talis podían abrir puertas, pero ' +
      'nunca comprar la maestría.'
  }
]

/**
 * Los fragmentos que esta persona ya se ha ganado, en orden.
 *
 * `ganados` es el total histórico, no el saldo. El cuarto pide además una
 * insignia: es el que explica por qué las insignias no se compran, y
 * decirlo a quien todavía no tiene ninguna es contestar una pregunta que
 * nadie se ha hecho.
 */
export function fragmentosDesbloqueados({ ganados = 0, insignias = 0 } = {}) {
  return FRAGMENTOS.filter((f) => ganados >= f.ganados && insignias >= f.insignias)
}

/** El último que se ha abierto, que es el único que merece sitio en pantalla. */
export function ultimoFragmento(progreso) {
  const abiertos = fragmentosDesbloqueados(progreso)
  return abiertos.length ? abiertos[abiertos.length - 1] : null
}

/**
 * Los Talis GANADOS en la vida de una persona, y cuántas insignias lleva.
 *
 * Ganados, no saldo: se suma lo que abonaron las misiones aprobadas más
 * los extras —el juego de la peque y los premios a mano—, y NO se resta
 * lo gastado en la tienda. Es la diferencia entre «cuánto has hecho por
 * el Gremio» y «cuánto te queda en la bolsa», y la historia va sobre lo
 * primero.
 *
 * Se calcula aquí y no en el JSX por la regla de siempre: una cuenta
 * metida en una pantalla no se puede probar.
 */
export function progresoDeTalis(perfil, datos) {
  const { completions = [], bonuses = [], badges = [] } = datos || {}
  const id = perfil?.id
  const deMisiones = completions
    .filter((c) => c.profile_id === id && c.status === 'aprobado')
    .reduce((t, c) => t + (c.coins || 0), 0)
  const extras = bonuses
    .filter((b) => b.profile_id === id)
    .reduce((t, b) => t + (b.coins || 0), 0)
  return {
    ganados: deMisiones + extras,
    insignias: badges.filter((b) => b.profile_id === id).length
  }
}

/**
 * Qué falta para abrir un fragmento cerrado, ya redactado.
 *
 * Un candado sin explicación se lee como un fallo de la app. Decir qué
 * falta lo convierte en algo que se puede ir a buscar, que es justo lo
 * que hace un sistema de progresión. Devuelve null si ya está abierto.
 *
 * Devuelve la frase entera, y no las piezas, por dos motivos: el verbo
 * concuerda distinto («falta una insignia» pero «faltan 450 Talis»), y
 * porque montarla en el JSX tienta a hacer un `toLowerCase()` que se
 * comería la mayúscula de Talis, que es canon.
 */
export function queFaltaPara(fragmento, progreso) {
  const { ganados = 0, insignias = 0 } = progreso || {}
  const faltanTalis = Math.max(0, fragmento.ganados - ganados)
  const faltaInsignia = insignias < fragmento.insignias
  if (!faltanTalis && !faltaInsignia) return null
  if (faltanTalis && faltaInsignia) return `Te faltan ${talis(faltanTalis)} y una insignia`
  if (faltanTalis) return `Te falta${faltanTalis === 1 ? '' : 'n'} ${talis(faltanTalis)}`
  return 'Te falta una insignia'
}

/**
 * Los que se han abierto y todavía no ha visto nadie.
 *
 * `leidos` son ids ya vistos. El orden importa poco aquí, pero la lista
 * sale en el del canon para que la Crónica se lea como una historia y no
 * como un montón de tarjetas.
 */
export function fragmentosNuevos(progreso, leidos = []) {
  const vistos = new Set(leidos)
  return fragmentosDesbloqueados(progreso).filter((f) => !vistos.has(f.id))
}
