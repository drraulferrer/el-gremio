// ------------------------------------------------------------------
// Qué se le dice a cada quien.
//
// El tono es el de Duolingo a propósito: pique, guiño y algo de morro
// («a que no…»), porque un recordatorio neutro —«tienes tareas
// pendientes»— se lee como una factura y se silencia en tres días. Lo que
// engancha es que parezca que alguien te habla.
//
// CUATRO REGLAS que valen más que las frases:
//
// 1. NADA DE CULPA. Ni «has fallado», ni «llevas X días sin hacer nada»,
//    ni cuentas de lo que no se hizo. Esto lo va a leer una niña de once
//    años en su móvil, y la app no puede ser una voz que riñe. Se pica,
//    se echa de menos y se reta; no se reprocha.
//
// 2. SIN MARCA DE GÉNERO. Ni una sola forma que haya que concordar: en
//    esta casa hay dos niñas, dos adultos y un perfil que puede no haber
//    dicho su género. Todas las frases están escritas para que valgan
//    igual, sin barras ni arrobas. Hay un test que lo comprueba.
//
// 3. VARIACIÓN DETERMINISTA. La frase se elige por el día y el perfil, no
//    al azar: así dos personas no reciben lo mismo el mismo día, nadie ve
//    la misma frase dos días seguidos, y encima se puede probar. Con
//    `Math.random()` no habría forma de escribir un test.
//
// 4. EL NÚMERO SIEMPRE ES REAL. Si dice «12 días», son doce. Un contador
//    inflado para motivar se descubre a la primera y se lleva por delante
//    la credibilidad de todo lo demás.
// ------------------------------------------------------------------

export type Motivo = 'racha_riesgo' | 'sin_validar' | 'vuelve'

export interface Aviso {
  titulo: string
  cuerpo: string
}

type Plantilla = (datos: { nombre: string; n: number }) => Aviso

// «1 día» y no «1 días». El banco de validar ya cuidaba el singular y
// este se olvidó, así que a quien llevaba un día de racha le llegó «1
// días seguidos». Es el detalle que delata que detrás no hay nadie, y
// justo en el aviso que pretende sonar a persona que te pica.
function dias(n: number): string {
  return n === 1 ? '1 día' : `${n} días`
}

function diasSeguidos(n: number): string {
  return n === 1 ? '1 día seguido' : `${n} días seguidos`
}

const RACHA_RIESGO: Plantilla[] = [
  ({ n }) => ({ titulo: `Tu racha de ${dias(n)}`, cuerpo: 'Sigue viva. Una misión y aquí no ha pasado nada.' }),
  ({ n }) => ({ titulo: 'A que no…', cuerpo: `A que no llegas a ${diasSeguidos(n + 1)}. Demuéstramelo.` }),
  ({ n }) => ({ titulo: diasSeguidos(n), cuerpo: 'Sería una pena justo hoy, ¿no te parece?' }),
  ({ nombre }) => ({ titulo: `${nombre}, dos minutos`, cuerpo: 'Con una misión salvas el día. Literalmente.' }),
  ({ n }) => ({ titulo: 'Se acaba el día', cuerpo: `Tienes ${dias(n)} de racha esperando a que hagas algo.` })
]

const VUELVE: Plantilla[] = [
  ({ nombre }) => ({ titulo: 'Te echo de menos', cuerpo: `El gremio está muy tranquilo sin ti, ${nombre}.` }),
  () => ({ titulo: '¿Vuelves?', cuerpo: 'Prometo empezar por una misión de las cortas.' }),
  () => ({ titulo: 'Aquí sigue todo', cuerpo: 'Tus misiones, tus monedas y una racha por empezar.' }),
  ({ nombre }) => ({ titulo: `Se te echa en falta`, cuerpo: `${nombre}, ¿empezamos otra racha hoy?` }),
  () => ({ titulo: 'A que no…', cuerpo: 'A que no arrancas una racha nueva justo hoy.' })
]

const SIN_VALIDAR: Plantilla[] = [
  ({ n }) => ({
    titulo: n === 1 ? 'Una misión espera' : `${n} misiones esperan`,
    cuerpo: 'Alguien ya ha hecho lo suyo y espera que se lo valides.'
  }),
  ({ n }) => ({
    titulo: 'Te toca a ti',
    cuerpo: n === 1 ? 'Hay una misión sin validar. Son diez segundos.' : `Hay ${n} misiones sin validar. Son diez segundos.`
  }),
  ({ n }) => ({
    titulo: 'El gremio está parado',
    cuerpo: `${n === 1 ? 'Una misión hecha espera' : `${n} misiones hechas esperan`} tu visto bueno.`
  })
]

const BANCOS: Record<Motivo, Plantilla[]> = {
  racha_riesgo: RACHA_RIESGO,
  vuelve: VUELVE,
  sin_validar: SIN_VALIDAR
}

/**
 * Un número estable a partir de dos textos. Sirve para que la frase
 * dependa del día Y de la persona: el mismo día, dos personas reciben
 * frases distintas; la misma persona, dos días seguidos, tampoco repite.
 */
function semilla(dia: string, profileId: string): number {
  const texto = `${dia}|${profileId}`
  let h = 0
  for (let i = 0; i < texto.length; i++) {
    h = (h * 31 + texto.charCodeAt(i)) >>> 0
  }
  return h
}

export function componerAviso(
  motivo: Motivo,
  { nombre, n, dia, profileId }: { nombre: string; n: number; dia: string; profileId: string }
): Aviso {
  const banco = BANCOS[motivo]
  if (!banco) throw new Error(`motivo desconocido: ${motivo}`)
  return banco[semilla(dia, profileId) % banco.length]({ nombre, n: Math.max(0, n) })
}

/** Todas las frases posibles. Solo lo usan los tests. */
export function todasLasPlantillas(): Aviso[] {
  return Object.values(BANCOS).flatMap((banco) =>
    banco.flatMap((p) => [p({ nombre: 'Nombre', n: 1 }), p({ nombre: 'Nombre', n: 12 })])
  )
}
