// ------------------------------------------------------------------
// El reloj de las tareas de limpieza.
//
// El planificador del que sale el catálogo lo dice tal cual: «usa un
// temporizador para dividir tareas en bloques manejables». Aquí el reloj
// es eso, una ayuda para arrancar y mantener el foco: NO es un requisito
// —una tarea se puede marcar hecha sin haberlo tocado— y NO certifica
// nada, porque lo que certifica es la validación del adulto, como
// siempre.
//
// Tres decisiones, con su porqué:
//
//  1. Se guarda el INSTANTE de inicio, no un contador. Un contador que
//     descuenta en memoria se congela con la pestaña en segundo plano y
//     se reinicia al recargar: es la lección de `mantenerPulsado.js`.
//     Con el instante guardado, el tiempo restante se calcula y da
//     igual cuántas veces se recargue.
//  2. Vive en localStorage, no en la base. Es cosmética de un aparato:
//     que el reloj de la tablet no sepa que el del móvil ya corre no
//     rompe nada, y a cambio no cuesta una tabla ni una migración. El
//     mismo criterio que la fiesta del día completo de la peque.
//  3. Agotarse no castiga. Al llegar a cero el reloj dice «¡Tiempo!» y
//     se queda ahí: la tarea sigue igual de disponible. Un reloj que
//     penaliza convierte la ayuda en un examen, y de esos ya hay
//     bastantes fuera de esta app.
//
// El almacén se inyecta (`almacen = localStorage`), como en latido.js:
// los tests corren en Node, donde localStorage no existe.
// ------------------------------------------------------------------

const CLAVE = 'gremio_relojes'

// Un reloj de hace más de un día es de una campaña que ya pasó: se
// purga al escribir para que esto no crezca para siempre, igual que
// hace `purge_logs` con los logs.
export const CADUCIDAD_MS = 24 * 60 * 60 * 1000

function leer(almacen) {
  try {
    return JSON.parse(almacen.getItem(CLAVE) || '{}')
  } catch {
    return {}
  }
}

function escribir(almacen, relojes, ahora) {
  const vivos = Object.fromEntries(
    Object.entries(relojes).filter(([, inicio]) => ahora - inicio < CADUCIDAD_MS)
  )
  almacen.setItem(CLAVE, JSON.stringify(vivos))
}

const claveDe = (profileId, challengeId) => `${profileId}:${challengeId}`

/** Arranca el reloj de una tarea para una persona. Devuelve el inicio. */
export function iniciarTarea(profileId, challengeId, ahora = Date.now(), almacen = localStorage) {
  const relojes = leer(almacen)
  relojes[claveDe(profileId, challengeId)] = ahora
  escribir(almacen, relojes, ahora)
  return ahora
}

/** Cuándo se arrancó, o null si no se ha arrancado (o ya caducó). */
export function inicioDe(profileId, challengeId, ahora = Date.now(), almacen = localStorage) {
  const inicio = leer(almacen)[claveDe(profileId, challengeId)]
  if (!inicio || ahora - inicio >= CADUCIDAD_MS) return null
  return inicio
}

/** Retira el reloj: al marcar la tarea, o si alguien se arrepiente. */
export function olvidarTarea(profileId, challengeId, ahora = Date.now(), almacen = localStorage) {
  const relojes = leer(almacen)
  delete relojes[claveDe(profileId, challengeId)]
  escribir(almacen, relojes, ahora)
}

/**
 * El estado del reloj, calculado y sin efectos: cuántos ms quedan y si
 * ya se agotó. Separado de la persistencia para poder probarlo con
 * fechas fijas.
 */
export function restanteDe(inicio, minutos, ahora = Date.now()) {
  const ms = Math.max(0, inicio + minutos * 60000 - ahora)
  return { ms, agotado: ms === 0 }
}

/** 'm:ss' para pintar. Con horas no hace falta: el reloj más largo es de 40 min. */
export function textoDeRestante(ms) {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
