// ------------------------------------------------------------------
// ¿Hay que recordar que los avisos están sin activar?
//
// EL PROBLEMA QUE RESUELVE, medido el 18-ago y no supuesto: de ocho
// perfiles activos, **cinco no tenían ningún aparato registrado**. El
// sistema les escribía avisos en `push_log` que no salían a ninguna parte,
// y nadie se enteraba porque el fallo no se ve: la app funciona igual y el
// registro dice que el aviso «se apuntó». La ironía es que los tres que
// ese día tenían motivo `vuelve` —«hace días que no apareces», justo a
// quien más le serviría— eran de los que no tenían dónde recibirlo.
//
// LA DECISIÓN DE DÓNDE VA: en el panel parental y en ningún sitio más.
// No es pereza, es la misma razón que ya está escrita en `Avisos.jsx`:
// pedir el permiso del navegador es un gesto de UNA sola vez y, si se
// deniega, el navegador **no vuelve a preguntar nunca**. Mejor que lo haga
// un adulto con el móvil en la mano que una niña de once años a la
// carrera. Un banner en el tablero de la junior invitaría justo a eso.
//
// LA DECISIÓN DE DÓNDE SE GUARDA EL «no me lo enseñes más»: en este
// aparato, no en la base. Una suscripción push pertenece a la instalación,
// así que «aquí no hay avisos» es una verdad LOCAL: guardarlo por perfil
// escondería el recordatorio en el móvil de al lado, donde sigue haciendo
// falta. Y por familia, para que dos gremios en el mismo navegador —que
// pasa en las pruebas— no se pisen.
// ------------------------------------------------------------------

const PREFIJO = 'gremio_aviso_push_oculto'

/** Dónde se apunta que alguien dijo «deja de mostrarlo» en ESTE aparato. */
export function claveDeOculto(familyId) {
  return `${PREFIJO}:${familyId || 'sin-gremio'}`
}

/**
 * Estados de `estadoDePush()` en los que NO tiene sentido insistir.
 *
 * - `encendido`: ya está, no hay nada que recordar.
 * - `imposible`: el aparato no puede, y repetirlo es culpar a quien no
 *   tiene la culpa (el caso típico es Safari sin instalar en iPhone).
 * - `bloqueado`: el navegador ya no deja preguntar. Enlazar a un botón que
 *   no puede funcionar es peor que callarse.
 * - `sin-clave`: falta configuración del despliegue. Es un problema
 *   nuestro, no de la familia; sale en Ajustes y no aquí.
 */
const SIN_NADA_QUE_HACER = ['encendido', 'imposible', 'bloqueado', 'sin-clave']

/**
 * ¿Se enseña el recordatorio?
 *
 * @param {object} p
 * @param {string} p.estado    lo que devuelve `estadoDePush()`
 * @param {boolean} p.oculto   si ya dijeron «deja de mostrarlo» aquí
 * @returns {boolean}
 */
export function debeRecordar({ estado, oculto }) {
  if (oculto) return false
  if (!estado || estado === 'cargando') return false
  return !SIN_NADA_QUE_HACER.includes(estado)
}

/**
 * Cuántos perfiles del gremio se quedarían sin recibir nada.
 *
 * Cuenta los ACTIVOS que no son la peque —que nunca recibe avisos, es una
 * decisión del producto y no un olvido— y a los que no les consta ningún
 * aparato. Es el número que convierte «esto va bien» en «a cinco personas
 * no les llega».
 *
 * @param {Array} perfiles      todos los perfiles del gremio
 * @param {Array<string>} conAparato  ids de perfil con alguna suscripción
 * @returns {number}
 */
export function perfilesSinAparato(perfiles, conAparato) {
  const tienen = new Set(conAparato || [])
  return (perfiles || []).filter(
    (p) => p && p.active && p.role !== 'peque' && !tienen.has(p.id)
  ).length
}

/**
 * El texto del recordatorio, que cambia según a cuánta gente afecta.
 *
 * Se separa de la pantalla porque es una decisión de producto —qué se le
 * dice a la familia— y esas se prueban, no se miran a ojo.
 */
export function textoDelAviso(sinAparato) {
  if (sinAparato > 1) {
    return `Los avisos están sin activar. Hay ${sinAparato} miembros del gremio que no recibirían ninguno.`
  }
  if (sinAparato === 1) {
    return 'Los avisos están sin activar. Hay 1 miembro del gremio que no recibiría ninguno.'
  }
  // Sin recuento fiable —o con todos cubiertos— se habla solo de este
  // aparato, que es lo único que aquí se puede afirmar con certeza.
  return 'Los avisos están sin activar en este aparato.'
}
