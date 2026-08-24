// ------------------------------------------------------------------
// El Panorama: lo primero que se ve al entrar en el gremio.
//
// Hasta aquí la app abría por la lista de misiones, o sea, por los
// deberes. Y abrir por los deberes tiene un problema que no es de gusto:
// la primera pantalla dice lo mismo el día que quedan quince misiones y
// el día que no queda ninguna, y no cuenta NADA de lo que se lleva
// hecho. Todo el progreso —la racha, el nivel, las habilidades, la meta
// del gremio— vivía dentro de una pestaña a la que hay que ir a buscar.
//
// La referencia son los cuadros de Oura y Opal, y de ellos se toman
// tres decisiones concretas:
//
//  1. UNA cifra manda. Un arco, un número grande, y debajo una frase.
//     No cinco tarjetas del mismo tamaño compitiendo entre ellas: si
//     todo destaca, no destaca nada.
//  2. La cifra va con PALABRA, no sola. «78» no dice si eso es bueno;
//     «Más de la mitad» sí. Un número sin lectura obliga a aprenderse
//     una escala que nadie ha explicado.
//  3. Tres subíndices colgando del principal —racha, nivel y gremio—,
//     que son los tres relojes que corren de verdad en esta app: el de
//     hoy, el personal a largo plazo y el compartido.
//
// Y una que es de aquí y no de Oura: **el panorama no compara con
// nadie**. Ni con la media, ni con el hermano, ni con «gente como tú».
// Opal enseña «un 19 % menos que tus iguales» y funciona muy bien en una
// app de adultos que compiten consigo mismos; en una casa, eso mismo es
// una liga entre hermanos. La única comparación que hay aquí es contra
// uno mismo la semana pasada y contra la meta compartida.
//
// Todo se calcula en este fichero y nada en el JSX, por la razón de
// siempre: una cuenta metida en la pantalla no se puede probar.
// ------------------------------------------------------------------

import { canDo, dayKey, diaSemana, levelProgress, goalProgress } from './supabase'
import { planDelDia, diasNeutros } from './misiones'
import { rachaActual, enRiesgo, siguienteHito, diasSalvados } from './rachas'
import { estadoDeTemporada } from './temporadas'

/**
 * Cómo va el día: qué tocaba, qué está resuelto y qué queda.
 *
 * El arco cuenta lo ENVIADO, no lo validado. Quien ha hecho su parte y
 * espera el visto bueno de un adulto ya ha terminado su día: dejar el
 * arco a cero hasta que alguien valide sería medir la diligencia del
 * adulto y enseñársela a la criatura como si fuera culpa suya.
 *
 * Una semanal ya hecha el lunes cuenta como resuelta el martes, aunque
 * siga saliendo en la lista. El arco responde «¿qué me queda por
 * delante?», no «¿qué he hecho en las últimas 24 horas?».
 *
 * OJO CON `ahora`: gobierna QUÉ toca hoy (el patrón semanal y el plan),
 * pero no la disponibilidad, que la decide `canDo` leyendo el reloj de
 * verdad por su cuenta. En la app las dos cosas son el mismo instante y
 * no hay diferencia; en un test, pasar una fecha inventada mueve el plan
 * y no mueve `canDo`, y las cuentas dejan de cuadrar.
 */
export function diaDe(perfil, datos = {}, ahora = new Date()) {
  const { challenges = [], completions = [], planDiario = [] } = datos
  if (!perfil) return { tocan: 0, hechas: 0, quedan: 0, esperando: 0, validadas: 0, xp: 0, pct: 0 }

  const clave = dayKey(ahora)
  const mias = completions.filter((c) => c.profile_id === perfil.id)
  const tocan = planDelDia(perfil, challenges, planDiario, ahora)
  const quedan = tocan.filter((ch) => canDo(ch, completions, perfil.id))
  const validadas = mias.filter(
    (c) => c.status === 'aprobado' && c.resolved_at && dayKey(new Date(c.resolved_at)) === clave
  )
  const esperando = mias.filter((c) => c.status === 'pendiente')
  const hechas = Math.max(0, tocan.length - quedan.length)

  return {
    tocan: tocan.length,
    hechas,
    quedan: quedan.length,
    esperando: esperando.length,
    validadas: validadas.length,
    xp: validadas.reduce((t, c) => t + (c.xp || 0), 0),
    pct: tocan.length ? Math.round((100 * hechas) / tocan.length) : 0
  }
}

/**
 * La lectura del día: el titular y la frase que lo explica.
 *
 * El titular es corto y en palabras, nunca un número repetido: debajo
 * del arco ya hay una cifra enorme, y ponerla otra vez en letra no añade
 * nada. La frase de debajo es la única que dice qué HACER, y por eso
 * siempre es concreta: «te quedan dos», no «sigue así».
 *
 * Las marcas {m|f|n} las resuelve `flex` en la pantalla.
 */
export function lecturaDelDia(dia = {}, racha = 0) {
  const { tocan = 0, quedan = 0, esperando = 0 } = dia
  const cuantas = quedan === 1 ? 'una misión' : `${quedan} misiones`

  if (tocan === 0) {
    return {
      estado: 'libre',
      titulo: 'Día libre',
      frase: 'Hoy no te toca ninguna misión, y por eso la racha no corre peligro.'
    }
  }
  if (quedan === 0) {
    return {
      estado: 'cerrado',
      titulo: 'Día cerrado',
      frase: esperando > 0
        ? 'Ya está todo enviado. Ahora falta que alguien le dé el visto bueno.'
        : 'No te queda nada por hoy. El gremio ya tiene lo tuyo.'
    }
  }
  if (dia.hechas === 0) {
    return {
      estado: 'en-blanco',
      titulo: 'Sin estrenar',
      frase: racha > 0
        ? `Llevas ${racha} ${racha === 1 ? 'día' : 'días'} seguidos. Con una sola sigue viva.`
        : `Hoy te ${tocan === 1 ? 'toca una misión' : `tocan ${tocan} misiones`}. Con la primera empieza la racha.`
    }
  }
  if (dia.pct >= 50) {
    return {
      estado: 'medio',
      titulo: 'Más de la mitad',
      frase: `Te ${quedan === 1 ? 'queda' : 'quedan'} ${cuantas} para cerrar el día.`
    }
  }
  return {
    estado: 'arrancado',
    titulo: 'Ya has empezado',
    frase: `Te ${quedan === 1 ? 'queda' : 'quedan'} ${cuantas} para cerrar el día.`
  }
}

// Lunes primero, como `weekKey` y como el historial. La X del miércoles
// es la abreviatura española de siempre: con dos emes seguidas no se
// distingue martes de miércoles de un vistazo, que es justo lo único que
// esta fila tiene que conseguir.
const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/**
 * La semana en siete barras.
 *
 * Las barras se escalan contra el MEJOR día de esa misma semana, no
 * contra un techo fijo: lo que interesa ver es la forma —dónde se
 * concentra el esfuerzo, qué días se cae— y con un techo fijo una
 * semana floja sale plana y no se lee nada.
 *
 * Los días que aún no han llegado se marcan `futuro` y se dibujan como
 * huecos: una barra vacía en el jueves de un martes parece un fallo.
 */
export function semanaDe(profileId, completions = [], ahora = new Date()) {
  const hoy = dayKey(ahora)
  const indiceHoy = diaSemana(ahora) // 1 = lunes … 7 = domingo
  const suyas = completions.filter(
    (c) => c.profile_id === profileId && c.status === 'aprobado' && c.resolved_at
  )

  const dias = []
  for (let i = 1; i <= 7; i++) {
    const cursor = new Date(ahora)
    cursor.setDate(cursor.getDate() + (i - indiceHoy))
    const clave = dayKey(cursor)
    const delDia = suyas.filter((c) => dayKey(new Date(c.resolved_at)) === clave)
    dias.push({
      clave,
      letra: LETRAS[i - 1],
      xp: delDia.reduce((t, c) => t + (c.xp || 0), 0),
      misiones: delDia.length,
      esHoy: i === indiceHoy,
      futuro: i > indiceHoy
    })
  }

  const mejor = dias.reduce((m, d) => Math.max(m, d.xp), 0)
  return {
    // El 8 % de suelo es para que un día con poca XP siga siendo una
    // barra visible y no una raya indistinguible de un día en blanco.
    dias: dias.map((d) => ({ ...d, alto: mejor && d.xp ? Math.max(8, Math.round((100 * d.xp) / mejor)) : 0 })),
    xp: dias.reduce((t, d) => t + d.xp, 0),
    misiones: dias.reduce((t, d) => t + d.misiones, 0),
    mejor
  }
}

/**
 * Los tres relojes que cuelgan del arco.
 *
 * Racha (hoy), nivel (lo tuyo a largo plazo) y gremio (lo de todos). Sin
 * meta activa el tercero enseña el rango de la temporada, que es lo que
 * queda cuando la barra se vacía: cerrar una meta no puede parecer
 * perder el progreso.
 */
export function relojesDe(perfil, datos = {}, ahora = new Date()) {
  const { completions = [], challenges = [], powerUses = [], goals = [], goal = null } = datos
  const salvados = diasSalvados(powerUses, perfil?.id)
  const neutros = diasNeutros(perfil, challenges, { hoy: ahora })
  const racha = rachaActual(completions, perfil?.id, salvados, ahora, neutros)
  const temporada = estadoDeTemporada(goals)
  const hechoMeta = goal ? Math.min(goalProgress(goal, completions), goal.target_xp) : 0

  return {
    racha,
    riesgo: enRiesgo(completions, perfil?.id, salvados, ahora, neutros),
    hito: siguienteHito(racha),
    nivel: levelProgress(perfil?.xp || 0),
    temporada,
    meta: goal
      ? {
          ...goal,
          hecho: hechoMeta,
          pct: goal.target_xp ? Math.min(100, Math.round((100 * hechoMeta) / goal.target_xp)) : 0,
          lograda: hechoMeta >= goal.target_xp
        }
      : null
  }
}

/**
 * El saludo, por la hora que es en el aparato.
 *
 * Por el aparato y no por la zona de la familia a propósito: esto no
 * decide nada —ni qué día es, ni si una misión toca—, solo dice buenos
 * días o buenas noches, y quien lo lee está mirando ESA pantalla. Si
 * alguien viaja, el saludo correcto es el de donde está.
 */
export function saludo(ahora = new Date()) {
  const h = ahora.getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 14) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}
