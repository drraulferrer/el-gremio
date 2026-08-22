// ------------------------------------------------------------------
// El Muro: todo lo bueno que te han dicho, junto y sin caducar.
//
// F1 de `docs/RECONOCIMIENTOS.md`, y la pieza más barata de toda la spec
// porque **no hace falta ni un dato nuevo**. Los elogios se escriben al
// validar desde el primer día y se guardan en `completions.praise`. Lo
// único que hacía la app era dejar de enseñarlos: el historial va por
// semanas, y al rodar la semana desaparecían de la vista. Nadie podía
// leer de una vez lo que le habían dicho.
//
// Una limitación que hay que mirar de frente: **`completions` no guarda
// quién validó**, así que un elogio no se puede firmar. Se enseña con su
// fecha y con el encargo del que cuelga, que es lo que hay. La firma
// llega con los gracias de la F2, que sí tienen remitente; y si algún día
// interesa firmar también los elogios, la columna `resolved_by` entra en
// la migración 034 y desde ese día en adelante quedan firmados.
// ------------------------------------------------------------------

const CLAVE_VISITA = 'gremio_muro_visto_'

/**
 * Lo que le han dicho a esta persona, lo último primero.
 *
 * Solo cuenta lo aprobado: un elogio escrito en una validación que luego
 * se corrigió a «rechazado» no es un elogio, es un accidente.
 */
export function elogiosDe(completions = [], profileId) {
  return completions
    .filter((c) => c.profile_id === profileId && c.status === 'aprobado' && c.praise && String(c.praise).trim())
    .map((c) => ({
      id: c.id,
      texto: String(c.praise).trim(),
      // `resolved_at` y no `requested_at`: la frase se escribió al
      // validar, no al pedir la misión.
      ts: c.resolved_at || c.requested_at || null,
      challengeId: c.challenge_id || null
    }))
    .sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')))
}

/** ¿Hay algo posterior a la última vez que abrió su muro? */
export function hayNuevo(elogios = [], visto = null) {
  const ultimo = elogios[0]?.ts
  if (!ultimo) return false
  if (!visto) return true
  return String(ultimo) > String(visto)
}

// --- Cuándo lo vio, por dispositivo ---------------------------------
//
// En `localStorage` y no en la base, igual que la Crónica: es una marca
// de un aparato, no un dato del gremio. Que el móvil y la tablet lleven
// cuentas distintas no rompe nada, y a cambio no cuesta una migración.

export function leerVisita(profileId, almacen = localStorage) {
  try {
    return almacen.getItem(CLAVE_VISITA + profileId)
  } catch {
    return null
  }
}

export function sellarVisita(profileId, ts = new Date().toISOString(), almacen = localStorage) {
  try {
    almacen.setItem(CLAVE_VISITA + profileId, String(ts))
  } catch {
    // Sin almacenamiento, el aviso saldrá siempre. Molesta; no rompe.
  }
}

/**
 * Una fecha corta y legible para cada frase: «14 de julio». Sin año
 * cuando es de este mismo año, que es el caso normal y el año sobra.
 */
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

export function fechaCorta(ts, ahora = new Date()) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const dia = `${d.getDate()} de ${MESES[d.getMonth()]}`
  return d.getFullYear() === ahora.getFullYear() ? dia : `${dia} de ${d.getFullYear()}`
}

/**
 * El muro completo: los elogios de validación MÁS los reconocimientos
 * que le ha dado el resto del gremio (F2), en una sola lista.
 *
 * Los dos tipos conviven a propósito y no en pestañas separadas: para
 * quien lo lee no son dos cosas, es todo lo bueno que le han dicho. La
 * diferencia se ve en la firma —los gracias la llevan, los elogios no
 * pueden llevarla porque `completions` no guarda quién validó— y en el
 * dibujo de cada tarjeta.
 */
export function muroDe({ completions = [], reconocimientos = [], perfiles = [] } = {}, profileId) {
  const quien = (id) => perfiles.find((p) => p.id === id) || null

  const gracias = reconocimientos
    .filter((r) => r.a_profile === profileId)
    .map((r) => ({
      id: r.id,
      texto: r.texto ? String(r.texto).trim() : '',
      ts: r.created_at || null,
      challengeId: r.completion_id ? completionAReto(completions, r.completion_id) : null,
      de: quien(r.de_profile),
      tipo: r.tipo || 'gracias'
    }))

  const elogios = elogiosDe(completions, profileId).map((e) => ({ ...e, de: null, tipo: 'elogio' }))

  return [...gracias, ...elogios].sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')))
}

const completionAReto = (completions, id) => completions.find((c) => c.id === id)?.challenge_id || null
