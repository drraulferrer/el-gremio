// ------------------------------------------------------------------
// Qué secciones deja uno abiertas.
//
// Preferencia de un aparato y no dato del gremio, igual que el orden de
// la tienda o la Crónica: que el móvil y la tablet lleven cuentas
// distintas no rompe nada, y a cambio no cuesta una migración.
//
// Por defecto se pliegan. El motivo es de pantalla: con la semana llena,
// «Lo que has hecho» y «Lo que te han dicho» ocupan tanto que el resto de
// Progreso —la racha, las habilidades, los sellos— queda a tres pantallas
// de scroll. Pero **si alguien lo abre, se queda abierto**: obligar a
// desplegar lo mismo cada vez es la forma más rápida de que deje de
// abrirse.
// ------------------------------------------------------------------

const CLAVE = 'gremio_plegado_'

export function estaAbierto(id, almacen = localStorage, pordefecto = false) {
  try {
    const guardado = almacen.getItem(CLAVE + id)
    if (guardado === null) return pordefecto
    return guardado === '1'
  } catch {
    return pordefecto
  }
}

export function recordarAbierto(id, abierto, almacen = localStorage) {
  try {
    almacen.setItem(CLAVE + id, abierto ? '1' : '0')
  } catch {
    // Sin almacenamiento se pliega en cada visita. Molesta; no rompe.
  }
  return abierto
}
