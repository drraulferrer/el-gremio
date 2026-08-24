// ------------------------------------------------------------------
// Feature flags. Sirven para dos cosas:
//  1. Apagar una función a medias sin desplegar código nuevo.
//  2. Rollback selectivo: si una novedad rompe algo, se apaga la bandera
//     en lugar de revertir toda la build.
//
// Precedencia: localStorage (por dispositivo) > variable de entorno > valor
// por defecto. La sobreescritura local es un cerrojo doméstico, no un
// control de acceso: cualquiera con la consola abierta puede cambiarla.
// ------------------------------------------------------------------

const DEFECTOS = {
  // Pantalla infantil propia para el rol "peque".
  modoPeque: true,
  // Envío de logs estructurados a Supabase (los de nivel warn y error).
  logsRemotos: true,
  // Persistir también los logs informativos. Ruidoso; solo para depurar.
  logsInfo: false,
  // Luz ambiental del fondo. Si el fondo tintinea en algún aparato, esto
  // lo apaga sin esperar a un despliegue.
  luzAmbiental: true,
  // Y esto deja la luz pero quieta: mantiene el color que el cristal
  // necesita para refractar, sin nada en movimiento.
  luzEnMovimiento: true,
  // El motor de los sellos de oficio (catálogo v1). Encendido: concede.
  //
  // Tiene interruptor porque una insignia concedida NO SE QUITA. Si el
  // evaluador se equivocara, apagar esto detiene el daño en el acto y sin
  // esperar a un despliegue; lo ya concedido se queda, que es la regla,
  // pero deja de crecer.
  sellosV2: true,
  // El modo limpieza: campañas de limpieza que lanza un adulto. Con la
  // bandera apagada desaparecen el botón del panel y el bloque de los
  // tableros, pero las misiones ya lanzadas siguen saliendo como únicas
  // normales: apagarla no le quita a nadie trabajo ya encargado.
  modoLimpieza: true,
  // Backend simulado en memoria, para ver la app sin Supabase.
  demo: false,
  // Entrar con Google. Encendida el 24-ago, cuando el proveedor quedó
  // configurado en Supabase (Client ID y Secret desde Google Cloud, en el
  // proyecto `ElGremio`). Nació apagada por un motivo que sigue valiendo:
  // sin proveedor, el botón existe pero lleva a un error de Supabase que
  // no dice nada útil. Si algún día caducan las credenciales, apagarla
  // aquí quita el botón sin revertir nada más.
  google: true
}

const ENV = {
  modoPeque: import.meta.env.VITE_FLAG_MODO_PEQUE,
  logsRemotos: import.meta.env.VITE_FLAG_LOGS_REMOTOS,
  logsInfo: import.meta.env.VITE_FLAG_LOGS_INFO,
  luzAmbiental: import.meta.env.VITE_FLAG_LUZ,
  luzEnMovimiento: import.meta.env.VITE_FLAG_LUZ_MOVIMIENTO,
  sellosV2: import.meta.env.VITE_FLAG_SELLOS_V2,
  modoLimpieza: import.meta.env.VITE_FLAG_MODO_LIMPIEZA,
  google: import.meta.env.VITE_FLAG_GOOGLE,
  demo: import.meta.env.VITE_DEMO
}

const CLAVE_LOCAL = 'gremio_flags'

function locales() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_LOCAL) || '{}')
  } catch {
    return {}
  }
}

function aBooleano(valor, porDefecto) {
  if (valor === undefined || valor === null || valor === '') return porDefecto
  if (typeof valor === 'boolean') return valor
  return ['1', 'true', 'si', 'sí', 'on'].includes(String(valor).toLowerCase())
}

export function flag(nombre) {
  const local = locales()[nombre]
  if (local !== undefined) return aBooleano(local, DEFECTOS[nombre])
  return aBooleano(ENV[nombre], DEFECTOS[nombre])
}

export function setFlag(nombre, valor) {
  const siguiente = { ...locales(), [nombre]: Boolean(valor) }
  localStorage.setItem(CLAVE_LOCAL, JSON.stringify(siguiente))
  return siguiente
}

export function todasLasFlags() {
  return Object.keys(DEFECTOS).reduce((acc, k) => ({ ...acc, [k]: flag(k) }), {})
}

export { DEFECTOS }
