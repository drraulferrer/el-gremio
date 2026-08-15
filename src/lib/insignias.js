// ------------------------------------------------------------------
// Insignias con utilidad.
//
// Las ocho originales eran decorativas: se ganaban y se quedaban ahí. Las
// de aquí hacen algo, y esa es toda la diferencia entre una medalla y un
// incentivo.
//
// TRES CLASES, y la clase importa más que el nombre:
//
//  · normal   → se puede tener varias personas a la vez. Reconocen un
//               hito personal (diez misiones, nivel 5).
//  · unica    → SOLO UNA PERSONA del gremio puede tenerla. Se la lleva
//               quien llega primero y ya no la puede ganar nadie más.
//               Es lo que la hace valiosa: si todos acaban teniéndola,
//               deja de significar nada.
//  · temporada → se gana en una temporada concreta y se queda con su
//               sello. «Legendario de la temporada 2» no lo puede ganar
//               nadie en la 3.
//
// LOS SUPERPODERES. Cuatro, y cada uno con un coste de diseño distinto:
//
//  · monedas_x    toca la economía → lleva tope y caduca.
//  · salva_racha  no toca la economía → es el más seguro de los cuatro.
//  · asigna_tarea toca la convivencia → limitado a una vez y con aviso,
//                 porque entre hermanas esto puede acabar en pelea.
//  · abre_premio  desbloquea un premio que solo canjea quien la tiene.
//
// Todos los poderes CADUCAN salvo abre_premio. Un poder permanente deja
// de ser un premio y pasa a ser una ventaja estructural: quien lo ganó
// primero se aleja del resto para siempre.
// ------------------------------------------------------------------

export const PODERES = {
  monedas_x: {
    nombre: 'Vena de oro',
    describe: (p) => `×${p.factor} monedas durante ${p.dias} días`,
    // El tope existe porque esto sí mueve la economía: sin él, dos
    // insignias apiladas doblarían el ritmo de toda una temporada.
    maxFactor: 1.5
  },
  salva_racha: {
    nombre: 'Comodín',
    describe: (p) => `Salva la racha ${p.usos} ${p.usos === 1 ? 'vez' : 'veces'}`
  },
  asigna_tarea: {
    nombre: 'Voz de mando',
    describe: (p) => `Puedes encargar una misión extra a otra persona (${p.usos} uso)`
  },
  abre_premio: {
    nombre: 'Llave',
    describe: () => 'Desbloquea un premio que solo puedes canjear tú'
  }
}

/**
 * Los poderes que hoy HACEN algo de verdad.
 *
 * `salva_racha` y `asigna_tarea` están cableados de punta a punta: el
 * comodín tapa un día en el cálculo de la racha (src/lib/meritos.js) y la
 * voz de mando crea la misión dentro de `spend_power`, en la misma
 * transacción que gasta el uso.
 *
 * Los otros dos NO, y por eso no se dibujan todavía:
 *  · `monedas_x` tendría que multiplicar lo que abona `resolve_completion`,
 *    que vive en Postgres y hoy no sabe nada de insignias.
 *  · `abre_premio` necesita que un premio pueda tener dueño, y `rewards`
 *    no tiene esa columna.
 *
 * El modelo se queda escrito y probado —cambiar eso costaría más que
 * mantenerlo—, pero anunciar en pantalla un ×1,25 que no llega a las
 * monedas sería mentirle a quien se lo ha ganado. Se enseñan cuando
 * existan, no antes.
 */
export const PODERES_LISTOS = new Set(['salva_racha', 'asigna_tarea'])

export const INSIGNIAS = [
  // --- Las ocho originales, ahora con clase explícita ------------------
  { code: 'primera', name: 'Primera misión', emoji: '🌟', desc: 'Completa tu primera misión', clase: 'normal', test: (s) => s.approved >= 1 },
  { code: 'x10', name: 'Diez misiones', emoji: '🔥', desc: '10 misiones aprobadas', clase: 'normal', test: (s) => s.approved >= 10 },
  { code: 'x25', name: '{Veterano|Veterana|Veteranía}', emoji: '🏅', desc: '25 misiones aprobadas', clase: 'normal', test: (s) => s.approved >= 25 },
  { code: 'x50', name: 'Leyenda', emoji: '👑', desc: '50 misiones aprobadas', clase: 'normal', test: (s) => s.approved >= 50 },
  { code: 'nivel5', name: 'Nivel 5', emoji: '💎', desc: 'Alcanza el nivel 5', clase: 'normal', test: (s) => s.level >= 5 },
  { code: 'nivel10', name: 'Nivel 10', emoji: '🚀', desc: 'Alcanza el nivel 10', clase: 'normal', test: (s) => s.level >= 10 },
  { code: 'canje1', name: 'Primer canje', emoji: '🛍️', desc: 'Canjea tu primer premio', clase: 'normal', test: (s) => s.redemptions >= 1 },
  { code: 'gremio', name: 'Meta del gremio', emoji: '🏰', desc: 'Lograsteis una meta familiar juntos', clase: 'normal', test: () => false },

  // --- Nuevas con poder -----------------------------------------------
  {
    code: 'racha7', name: 'Siete de siete', emoji: '📅',
    desc: 'Una semana entera sin fallar una sola misión diaria',
    clase: 'normal', test: (s) => s.rachaMax >= 7,
    poder: { tipo: 'salva_racha', usos: 1, dias: 30 }
  },
  {
    code: 'racha21', name: 'Hábito', emoji: '🧗',
    desc: 'Veintiún días seguidos: eso ya no es esfuerzo, es costumbre',
    clase: 'normal', test: (s) => s.rachaMax >= 21,
    poder: { tipo: 'monedas_x', factor: 1.25, dias: 7 }
  },
  {
    code: 'ocho_habilidades', name: 'Completo', emoji: '🧭',
    desc: 'Has entrenado las ocho competencias al menos una vez',
    clase: 'normal', test: (s) => s.habilidadesTocadas >= 8,
    poder: { tipo: 'abre_premio' }
  },
  {
    code: 'madrugador', name: 'Antes de las nueve', emoji: '🌅',
    desc: '10 misiones validadas antes de las nueve de la mañana',
    clase: 'normal', test: (s) => s.antesDeLasNueve >= 10
  },
  {
    code: 'ayuda10', name: 'Buena gente', emoji: '🫶',
    desc: '10 misiones de amabilidad aprobadas',
    clase: 'normal', test: (s) => (s.porHabilidad?.amabilidad || 0) >= 10,
    poder: { tipo: 'salva_racha', usos: 2, dias: 30 }
  },

  // --- Únicas: solo una persona del gremio puede tenerlas --------------
  {
    code: 'primer_nivel10', name: 'Pionera', emoji: '🥇',
    desc: 'La primera del gremio en llegar al nivel 10. Solo puede tenerla una persona',
    clase: 'unica', test: (s) => s.level >= 10,
    poder: { tipo: 'monedas_x', factor: 1.5, dias: 14 }
  },
  {
    code: 'mano_derecha', name: 'Mano derecha', emoji: '🤝',
    desc: 'Quien más XP aportó a la meta del gremio. Cambia de dueño con cada meta',
    clase: 'unica', test: (s) => s.topAportacion === true,
    poder: { tipo: 'asigna_tarea', usos: 1, dias: 14 }
  },
  {
    code: 'coleccionista', name: 'Coleccionista', emoji: '🗝️',
    desc: 'La primera en juntar diez insignias. Solo una',
    clase: 'unica', test: (s) => s.insignias >= 10,
    poder: { tipo: 'abre_premio' }
  }
]

/** Solo las que hacen algo. Útil para explicarlas en la pantalla. */
export const CON_PODER = INSIGNIAS.filter((b) => b.poder)

export function insigniaPorCodigo(code) {
  return INSIGNIAS.find((b) => b.code === code) || null
}

/**
 * ¿Sigue activo el poder de esta insignia ganada?
 *
 * `abre_premio` no caduca: es una llave, y una llave que se oxida no
 * abre nada. El resto sí, porque un multiplicador permanente deja de ser
 * premio y pasa a ser ventaja estructural: quien llegó primero se aleja
 * del resto para siempre.
 */
export function poderActivo(ganada, ahora = new Date()) {
  const def = insigniaPorCodigo(ganada?.code)
  if (!def?.poder) return null
  if (def.poder.tipo === 'abre_premio') return def.poder
  if (!ganada.earned_at || !def.poder.dias) return null
  const caduca = new Date(ganada.earned_at).getTime() + def.poder.dias * 86400000
  return ahora.getTime() < caduca ? def.poder : null
}

/**
 * El multiplicador de monedas que le toca ahora mismo a una persona.
 *
 * NO se acumulan: se coge el mayor. Dos insignias apiladas doblarían el
 * ritmo de una temporada entera, y la economía está calculada contra un
 * ritmo, no contra el mejor caso.
 */
export function multiplicadorDe(ganadas = [], ahora = new Date()) {
  const factores = ganadas
    .map((g) => poderActivo(g, ahora))
    .filter((p) => p?.tipo === 'monedas_x')
    .map((p) => Math.min(p.factor, PODERES.monedas_x.maxFactor))
  return factores.length ? Math.max(...factores) : 1
}

/** Los usos que le quedan de un poder gastable, ya descontados. */
export function usosDisponibles(ganadas = [], tipo, gastados = {}, ahora = new Date()) {
  return ganadas.reduce((total, g) => {
    const p = poderActivo(g, ahora)
    if (p?.tipo !== tipo) return total
    return total + Math.max(0, (p.usos || 0) - (gastados[g.code] || 0))
  }, 0)
}

/**
 * Qué insignias puede ganar esta persona ahora, respetando las únicas.
 * `yaTomadas` son los códigos de únicas que ya tiene alguien del gremio.
 */
export function ganablesPor(stats, yaTomadas = new Set(), yaTiene = new Set()) {
  return INSIGNIAS.filter((b) => {
    if (yaTiene.has(b.code)) return false
    if (b.clase === 'unica' && yaTomadas.has(b.code)) return false
    return b.test(stats)
  })
}
