import { insigniaPorCodigo, PODERES, PODERES_LISTOS } from './insignias'

// ------------------------------------------------------------------
// Lo que cuenta un sello cuando lo abres.
//
// Tres cosas, y en este orden:
//
//   significado → qué reconoce, en lenguaje directo
//   lore        → la misma idea contada desde el Gremio
//   implica     → qué cambia por tenerlo
//
// Van POR SERIE y no por pieza. Setenta y tres textos distintos serían
// setenta y tres ocasiones de decir lo mismo un poco peor, y además el
// significado de «10 días» y el de «250 días» es el mismo: lo que cambia
// es la escala, y de eso ya habla la cifra. Donde el grado sí cambia el
// sentido —una obra maestra, una legendaria— hay una nota extra.
//
// ── La regla que gobierna «implica» ────────────────────────────────
//
// Un sello NO da Talis, NO da XP y NO da poderes (INSIGNIAS-01 §13.1).
// Así que este texto no puede prometer nada mecánico, y ahí está la
// tentación: escribir «te acerca a…» o «desbloquea…» para que suene a
// premio. Sería mentira, y además convertiría la insignia en el cupón que
// todo el sistema evita ser.
//
// Lo que sí implica es real y se puede decir sin inflarlo: queda escrito,
// no se pierde, y describe a alguien. Las dieciséis viejas son otra cosa
// —algunas sí dan un poder— y ese poder se nombra tal cual.
// ------------------------------------------------------------------

const COMUN = {
  primeros_encargos: {
    significado: 'Reconoce la primera aportación aprobada. No vuelve a pasar: solo hay un primer encargo.',
    lore: 'En el taller, la primera pieza de alguien no se juzga por lo buena que salga. Se guarda porque es la primera, y porque a partir de ahí ya hay con qué comparar.',
    implica: 'Marca el día en que tu historia en el Gremio empieza a contarse. Todo lo que venga después se mide desde aquí.'
  },

  ritmo: {
    significado: 'Reconoce días distintos con algo hecho. Un día cuenta una vez, aunque hagas diez misiones, y no hace falta que sean seguidos.',
    lore: 'El taller no pregunta cuánto hiciste el martes. Pregunta cuántas veces has cruzado la puerta. Un oficio se construye apareciendo, no apretando un día suelto.',
    implica: 'Dice que estás, y que sigues estando. Faltar una semana no te lo quita: los días que viniste ya los viniste.'
  },

  trayectoria: {
    significado: 'Reconoce volumen repartido en el tiempo. Cuenta los encargos, pero también en cuántos días, semanas y meses distintos ocurrieron.',
    lore: 'Un archivo no se llena en una tarde. Se llena porque alguien volvió muchas veces, durante mucho tiempo, y cada vez dejó algo dentro.',
    implica: 'Es la medida de cuánto camino llevas. No se puede acelerar amontonando misiones un domingo: el tiempo que pide es tiempo de verdad.'
  },

  caminos_de_oficio: {
    significado: 'Reconoce práctica sostenida en una habilidad concreta: experiencia, días distintos, semanas distintas y variedad de actividades dentro de ella.',
    lore: 'Un oficio no se acredita repitiendo una tarea hasta que salga sola. Se acredita habiendo hecho cosas distintas dentro del mismo oficio, en momentos distintos, hasta que el conjunto se sostiene.',
    implica: 'Dice que esto ya forma parte de lo que sabes hacer. No es una nota ni te compara con nadie: describe una competencia tuya.'
  },

  exploracion: {
    significado: 'Reconoce haber probado cosas diferentes: habilidades distintas, actividades distintas o ritmos distintos. Repetir no amplía nada.',
    lore: 'Quien solo conoce su rincón del taller trabaja bien hasta el día en que le toca otra cosa. Los que han abierto puertas saben, al menos, dónde están.',
    implica: 'Dice que tu experiencia es ancha, no solo profunda. Es la otra mitad de un oficio, y la que casi nadie mide.'
  },

  equilibrio: {
    significado: 'Reconoce tener base real en varias habilidades a la vez, sin que ninguna se lo lleve casi todo.',
    lore: 'Una mesa con una pata magnífica y tres cortas no es una mesa magnífica: es una mesa que se cae. El taller aprecia la especialidad, pero se apoya en lo que se sostiene solo.',
    implica: 'Dice que te desarrollas ancho. No obliga a repartirte a partes iguales ni te lo quita si después te especializas: lo que ya estaba repartido, estuvo.'
  },

  autonomia: {
    significado: 'Reconoce hacer con menos ayuda algo que antes necesitaba más. Hace falta que alguien lo anote; no se deduce de repetir una tarea.',
    lore: 'El día que un aprendiz deja de preguntar dónde están las herramientas no se anuncia. Alguien que estaba mirando se da cuenta, y ese día cuenta.',
    implica: 'Dice que ahora puedes con algo tú. No mide obediencia ni cuánto haces: mide cuánta ayuda hace falta, que es otra cosa y cambia según el día.'
  },

  obra_comun: {
    significado: 'Reconoce lo que el Gremio terminó entre varias personas, no lo que hizo cada una.',
    lore: 'Hay obras que no caben en unas manos. Cuando una se termina, no se anota quién puso más: se anota que se terminó, y quiénes estaban.',
    implica: 'Dice que formaste parte. No dice cuánto pusiste ni lo compara con nadie, y no señala a quien no pudo estar.'
  },

  regreso_al_taller: {
    significado: 'Reconoce haber vuelto después de una pausa real y haber retomado el ritmo. No basta con aparecer una vez.',
    lore: 'La puerta del taller no se cierra con llave por dentro. Quien vuelve después de meses no encuentra un reproche: encuentra su sitio como estaba, y polvo encima.',
    implica: 'Dice que volver también es avanzar. No premia haberte ido —hace falta continuidad después— y no aparece a la vista mientras estás viniendo.'
  },

  descubrimientos: {
    significado: 'Aparece solo, al coincidir algo que no se estaba buscando. No hay forma de perseguirlo.',
    lore: 'Algunas cosas del taller no están en ningún manual. Se cuentan cuando pasan, y quien las oye ya no las olvida.',
    implica: 'No cambia nada y ese es el chiste. Está para el gusto de encontrarlo, que es la única razón por la que existen las sorpresas.'
  }
}

/**
 * Notas por grado, donde el escalón cambia lo que significa.
 *
 * Solo tres casos, y los tres reales: la cuarta grada de un oficio es una
 * obra maestra, las legendarias son de años, y el primer escalón de
 * cualquier serie es el que dice «esto ha empezado».
 */
const POR_MATERIAL = {
  'oro-gema': {
    caminos_de_oficio: 'Es el grado más alto de este camino: meses de práctica variada dentro de la misma habilidad.'
  },
  legendaria: {
    ritmo: 'Es una de las cuatro legendarias del catálogo. Mil días con presencia son años, no meses.',
    trayectoria: 'Es una de las cuatro legendarias del catálogo. Está calibrada para tardar años en llegar.',
    equilibrio: 'Es una de las cuatro legendarias del catálogo: base sólida en las ocho habilidades a la vez.',
    obra_comun: 'Es una de las cuatro legendarias del catálogo. Veinticinco obras comunes son más de cuatro años de temporadas.'
  }
}

/** Lo que se enseña de un sello del catálogo v1. */
export function loreDeSello(sello) {
  if (!sello) return null
  const base = COMUN[sello.categoria]
  if (!base) return null
  return {
    ...base,
    nota: POR_MATERIAL[sello.material]?.[sello.categoria] || null
  }
}

// ------------------------------------------------------------------
// Las dieciséis de siempre.
//
// Van aparte porque son otra cosa: algunas SÍ dan un poder, y decir «no
// cambia nada» sobre una que reparte comodines sería falso. Y tres de
// ellas el catálogo nuevo las retira a propósito —comparan personas—, así
// que su texto lo dice en vez de disimularlo.
// ------------------------------------------------------------------

const LEGADO = {
  primera: {
    significado: 'La primera misión aprobada.',
    lore: 'Todo el mundo tiene una. Es la que menos cuesta y la única que no se puede repetir.',
    implica: 'Abre tu historial. A partir de aquí ya hay algo que contar.'
  },
  x10: { serie: 'Diez misiones aprobadas.' },
  x25: { serie: 'Veinticinco misiones aprobadas.' },
  x50: { serie: 'Cincuenta misiones aprobadas.' },
  nivel5: { nivel: 'Haber llegado al nivel 5.' },
  nivel10: { nivel: 'Haber llegado al nivel 10.' },
  canje1: {
    significado: 'El primer premio canjeado en la Casa de Recompensas.',
    lore: 'Los Talis se ganan para gastarlos. El primer canje es el día en que eso deja de ser una promesa.',
    implica: 'No reconoce una habilidad, sino haber usado el sistema. El catálogo nuevo no tiene sucesora suya: gastar no es biografía.'
  },
  gremio: {
    significado: 'Una meta familiar lograda entre todos.',
    lore: 'La primera obra común que terminó este Gremio.',
    implica: 'Las metas siguientes dejan su marca en «Obra común», que sí guarda una por temporada.'
  },
  racha7: {
    significado: 'Siete días seguidos sin fallar una misión diaria.',
    lore: 'Una semana entera. En el taller, la primera vez que alguien encadena siete jornadas se nota sin que nadie lo diga.',
    implica: 'El catálogo nuevo mide presencia flexible en vez de días seguidos, así que esta no se vuelve a conceder. La tuya se queda, y su poder también.'
  },
  racha21: {
    significado: 'Veintiún días seguidos.',
    lore: 'Veintiún jornadas seguidas son muchas jornadas seguidas.',
    implica: 'Se llamó «Hábito», y ese nombre estaba mal: la evidencia sobre formación de hábitos da medianas de dos meses y variaciones de cuatro a trescientos días. Se conserva porque se ganó; no se vuelve a conceder.'
  },
  ocho_habilidades: {
    significado: 'Haber entrenado las ocho competencias al menos una vez.',
    lore: 'Haber pisado los ocho caminos, aunque sea una vez cada uno.',
    implica: 'Su sucesora, «Los ocho caminos», pide además días distintos: tocar una habilidad una vez no es haberla explorado.'
  },
  madrugador: {
    significado: 'Diez misiones validadas antes de las nueve de la mañana.',
    lore: 'El taller abría temprano.',
    implica: 'Medía la hora en que un adulto validaba, no la hora en que alguien hacía algo. Por eso el catálogo nuevo la retira: no demostraba una conducta tuya. Se conserva porque se ganó.'
  },
  ayuda10: {
    significado: 'Diez misiones de amabilidad aprobadas.',
    lore: 'Diez veces que alguien hizo algo por otra persona y quedó anotado.',
    implica: 'Su continuación es el camino de oficio de Amabilidad, que pide además variedad y tiempo. Contar diez veces lo mismo no es un oficio, pero diez veces sí es diez veces.'
  },
  primer_nivel10: {
    significado: 'La primera persona del Gremio en llegar al nivel 10.',
    lore: 'Alguien tenía que abrir camino.',
    implica: 'Solo puede tenerla una persona. El catálogo nuevo no crea ninguna más así: «llegar primero» compara a los miembros, y eso es justo lo que el rediseño quita. Se conserva porque se ganó.'
  },
  mano_derecha: {
    significado: 'Quien más XP aportó a la meta del Gremio.',
    lore: 'La persona a la que se recurría cuando faltaba un par de manos.',
    implica: 'Ya no cambia de dueño al cerrar una meta, y no tiene sucesora: mandar sobre alguien choca con la autonomía que el resto del sistema defiende.'
  },
  coleccionista: {
    significado: 'La primera persona en juntar diez insignias.',
    lore: 'Quien primero llenó su vitrina.',
    implica: 'Solo puede tenerla una persona. Cuenta únicamente las dieciséis originales: si contara los sellos nuevos, se la llevaría quien abriera la app primero después de encender el motor, y eso no es un mérito.'
  }
}

const PLANTILLA_SERIE = (texto) => ({
  significado: texto,
  lore: 'Del archivo viejo del Gremio, cuando las insignias se contaban por misiones y no por caminos.',
  implica: 'Sigue en tu historial. Su continuación es «Trayectoria», que cuenta lo mismo pero exige que esté repartido en el tiempo.'
})

const PLANTILLA_NIVEL = (texto) => ({
  significado: texto,
  lore: 'El nivel mide la XP acumulada, sin mirar en qué la ganaste.',
  implica: 'El catálogo nuevo no repite el nivel general: ya lo enseña tu barra. Los sellos cuentan otra cosa —qué sabes hacer y cuánto lo has sostenido—, así que esta no tiene sucesora.'
})

/** Lo que se enseña de una de las dieciséis. */
export function loreDeInsignia(code) {
  const bruto = LEGADO[code]
  if (!bruto) return null
  if (bruto.serie) return PLANTILLA_SERIE(bruto.serie)
  if (bruto.nivel) return PLANTILLA_NIVEL(bruto.nivel)
  return bruto
}

// ------------------------------------------------------------------
// Por qué la tienes.
//
// Se compone de la REGLA, no de un texto escrito a mano. Un texto a mano
// dice lo que decía el día que se escribió: cambias un umbral en el
// catálogo y la pantalla sigue prometiendo el viejo. Aquí, si la regla
// cambia, la frase cambia con ella.
// ------------------------------------------------------------------

const HABILIDAD_NOMBRE = {
  hogar: 'Hogar', salud: 'Salud', aprendizaje: 'Aprendizaje', amabilidad: 'Amabilidad',
  responsabilidad: 'Responsabilidad', cooperacion: 'Cooperación', creatividad: 'Creatividad',
  autonomia: 'Autonomía'
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

const FRASES = {
  aprobadas: (n) => plural(n, 'encargo aprobado', 'encargos aprobados'),
  diasActivos: (n) => `${plural(n, 'día distinto', 'días distintos')} con algo hecho`,
  semanasActivas: (n) => plural(n, 'semana distinta', 'semanas distintas'),
  mesesActivos: (n) => plural(n, 'mes distinto', 'meses distintos'),
  habilidadesTocadas: (n) => plural(n, 'habilidad distinta', 'habilidades distintas'),
  familias: (n) => plural(n, 'actividad distinta', 'actividades distintas'),
  frecuencias: (n) => `los ${n} ritmos de encargo: diario, semanal, mensual y único`,
  obrasCerradas: (n) => plural(n, 'obra común terminada', 'obras comunes terminadas')
}

/**
 * La condición de un sello, como lista de frases.
 *
 * Lista y no párrafo a propósito: una regla de oficio tiene cinco partes
 * y en prosa se convierte en una frase que nadie termina de leer.
 */
export function condicionDe(sello) {
  const r = sello?.regla
  if (!r) return []

  if (r.habilidad) {
    const nombre = HABILIDAD_NOMBRE[r.habilidad] || r.habilidad
    const partes = [`${r.xp} XP en ${nombre}`]
    if (r.dias) partes.push(FRASES.diasActivos(r.dias))
    if (r.semanas) partes.push(FRASES.semanasActivas(r.semanas))
    if (r.meses) partes.push(FRASES.mesesActivos(r.meses))
    if (r.familias) partes.push(`${FRASES.familias(r.familias)} dentro de ${nombre}`)
    return partes
  }

  if (r.equilibrio) {
    const e = r.equilibrio
    return [
      `${plural(e.habilidades, 'habilidad', 'habilidades')} con al menos ${e.xp} XP cada una`,
      `${e.xpTotal} XP repartida entre habilidades`,
      `ninguna por encima del ${Math.round(e.concentracionMax * 100)} % del total`
    ]
  }

  if (r.regreso) {
    const g = r.regreso
    return [
      `haber estado activo al menos ${plural(g.baseDias, 'día', 'días')} antes`,
      `una pausa de ${plural(g.pausaDias, 'día', 'días')} o más`,
      `volver y estar ${plural(g.despuesDias, 'día', 'días')} en las siguientes ${g.ventanaDias} jornadas`
    ]
  }

  if (r.enUnaSemana) {
    return [`${FRASES.habilidadesTocadas(r.enUnaSemana.habilidades)} en una misma semana, en ${plural(r.enUnaSemana.dias, 'día', 'días')}`]
  }
  if (r.enUnMes) {
    return [`encargos diarios, semanales y mensuales dentro del mismo mes, en ${plural(r.enUnMes.dias, 'día', 'días')}`]
  }

  return Object.entries(FRASES)
    .filter(([clave]) => r[clave] !== undefined)
    .map(([clave, frase]) => frase(r[clave]))
}

// ------------------------------------------------------------------
// El poder de una de las dieciséis.
//
// Sale de la definición REAL (`insignias.js`) y no de la prosa de arriba.
// Si mañana un comodín pasa de un uso a dos, esta línea cambia sola; un
// texto a mano seguiría prometiendo lo de antes, y aquí eso significa
// prometer a alguien algo que la app no le va a dar.
//
// Solo los poderes cableados de punta a punta: anunciar un multiplicador
// que no llega a las Talis sería mentirle a quien se lo ganó.
// ------------------------------------------------------------------

export function poderDeInsignia(code) {
  const def = insigniaPorCodigo(code)
  if (!def?.poder || !PODERES_LISTOS.has(def.poder.tipo)) return null
  const meta = PODERES[def.poder.tipo]
  return `${meta.nombre}: ${meta.describe(def.poder)}`
}
