import { describe, it, expect } from 'vitest'
import { proyeccionDe, cumple, sellosGanados } from '../src/lib/sellos-motor'
import { EVALUABLES, SELLOS_V1, selloPorId } from '../src/lib/sellos'

// ------------------------------------------------------------------
// Este fichero existe por una razón muy concreta: una insignia concedida
// NO SE QUITA. Un falso positivo aquí no es un test en rojo, es una
// insignia que un crío tiene para siempre sin haberla ganado.
//
// Por eso casi todas las pruebas de abajo comprueban que algo NO se
// concede. Que sí se conceda cuando toca es la parte fácil.
// ------------------------------------------------------------------

const PERFIL = { id: 'p1', xp: 0 }

// Un día concreto a mediodía, para no rozar cambios de día por zona.
const dia = (iso) => `${iso}T12:00:00.000Z`

let n = 0
const hecha = (fecha, { skill = 'hogar', reto = 'r1', xp = 10 } = {}) => ({
  id: `c${++n}`,
  profile_id: PERFIL.id,
  challenge_id: reto,
  status: 'aprobado',
  xp,
  requested_at: dia(fecha),
  resolved_at: dia(fecha)
})

const RETOS = [
  { id: 'r1', skill: 'hogar', frequency: 'diario' },
  { id: 'r2', skill: 'hogar', frequency: 'semanal' },
  { id: 'r3', skill: 'salud', frequency: 'mensual' },
  { id: 'r4', skill: 'aprendizaje', frequency: 'unico' },
  { id: 'r5', skill: 'amabilidad', frequency: 'diario' }
]

const proy = (completions, extra = {}) =>
  proyeccionDe(PERFIL, { completions, challenges: RETOS, completa: true, ...extra })

describe('lo que cuenta y lo que no', () => {
  it('una misión pendiente o rechazada no cuenta', () => {
    const p = proy([
      { ...hecha('2026-01-05'), status: 'pendiente' },
      { ...hecha('2026-01-06'), status: 'rechazado' }
    ])
    expect(p.aprobadas).toBe(0)
    expect(p.diasActivos).toBe(0)
  })

  it('diez misiones el mismo día son UN día', () => {
    const p = proy(Array.from({ length: 10 }, () => hecha('2026-01-05')))
    expect(p.aprobadas).toBe(10)
    expect(p.diasActivos).toBe(1)
  })

  it('cuenta por el día en que se PIDIÓ, no en el que se validó', () => {
    // Quien hace la cama el lunes por la noche y recibe el visto bueno el
    // martes trabajó el lunes. Si contara la validación, el día activo se
    // movería según cuándo abre la app una persona adulta.
    const p = proy([{
      ...hecha('2026-01-05'),
      requested_at: dia('2026-01-05'),
      resolved_at: dia('2026-01-09')
    }])
    expect(p.diasActivos).toBe(1)
    expect(p.semanasActivas).toBe(1)
  })

  it('una misión sin habilidad no entrena ningún camino', () => {
    const p = proyeccionDe(PERFIL, {
      completions: [hecha('2026-01-05', { reto: 'rX' })],
      challenges: [{ id: 'rX', skill: null, frequency: 'diario' }],
      completa: true
    })
    expect(p.aprobadas).toBe(1)
    expect(p.habilidadesTocadas).toBe(0)
    expect(p.habilidades).toEqual({})
  })
})

describe('ritmo y trayectoria', () => {
  it('tres días distintos abren el primer sello de ritmo', () => {
    const p = proy(['2026-01-05', '2026-01-08', '2026-01-20'].map((d) => hecha(d)))
    expect(cumple(p, selloPorId('ritmo_01').regla)).toBe(true)
    expect(cumple(p, selloPorId('ritmo_02').regla)).toBe(false)
  })

  it('el ritmo NO exige días seguidos', () => {
    // Meses de distancia entre uno y otro: siguen siendo tres días con
    // presencia. Ritmo reconoce constancia flexible, no perfección.
    const p = proy(['2026-01-05', '2026-04-08', '2026-09-20'].map((d) => hecha(d)))
    expect(cumple(p, selloPorId('ritmo_01').regla)).toBe(true)
  })

  it('cincuenta misiones en dos días NO dan el segundo de trayectoria', () => {
    // Es la defensa central de la serie: el volumen sin dispersión no es
    // trayectoria. Cincuenta misiones un sábado son un sábado.
    const golpe = [
      ...Array.from({ length: 25 }, () => hecha('2026-01-05')),
      ...Array.from({ length: 25 }, () => hecha('2026-01-06'))
    ]
    const p = proy(golpe)
    expect(p.aprobadas).toBe(50)
    expect(cumple(p, selloPorId('trayectoria_02').regla)).toBe(false)
  })

  it('las mismas cincuenta repartidas sí lo dan', () => {
    // 14 días distintos en 3 semanas, que es justo lo que pide la regla.
    const fechas = [
      '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09',
      '2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15', '2026-01-16',
      '2026-01-19', '2026-01-20', '2026-01-21', '2026-01-22'
    ]
    const reparto = fechas.flatMap((f) => [hecha(f), hecha(f), hecha(f), hecha(f)])
    const p = proy(reparto)
    expect(p.aprobadas).toBeGreaterThanOrEqual(50)
    expect(p.diasActivos).toBe(14)
    expect(p.semanasActivas).toBe(3)
    expect(cumple(p, selloPorId('trayectoria_02').regla)).toBe(true)
  })
})

describe('caminos de oficio', () => {
  const mucho = (reto, veces, fechas) =>
    fechas.flatMap((f) => Array.from({ length: veces }, () => hecha(f, { reto, xp: 25 })))

  it('cien XP repitiendo UNA sola misión no abre el camino', () => {
    // Pide dos familias distintas justo para esto: repetir la misma tarea
    // demuestra constancia, que ya premia Ritmo, no oficio.
    const p = proy(mucho('r1', 2, ['2026-01-05', '2026-01-06', '2026-01-07']))
    expect(p.habilidades.hogar.xp).toBeGreaterThanOrEqual(100)
    expect(p.habilidades.hogar.familias).toBe(1)
    expect(cumple(p, selloPorId('oficio_hogar_1').regla)).toBe(false)
  })

  it('con dos familias, dos semanas y tres días, sí', () => {
    const p = proy([
      ...mucho('r1', 2, ['2026-01-05', '2026-01-06']),
      ...mucho('r2', 2, ['2026-01-13'])
    ])
    const h = p.habilidades.hogar
    expect([h.xp >= 100, h.dias >= 3, h.semanas >= 2, h.familias >= 2]).toEqual([true, true, true, true])
    expect(cumple(p, selloPorId('oficio_hogar_1').regla)).toBe(true)
  })

  it('la XP de una habilidad no cuenta para el camino de otra', () => {
    const p = proy(mucho('r3', 8, ['2026-01-05', '2026-01-06', '2026-01-07']))
    expect(p.habilidades.salud.xp).toBeGreaterThanOrEqual(100)
    expect(cumple(p, selloPorId('oficio_hogar_1').regla)).toBe(false)
  })
})

describe('equilibrio', () => {
  // Cuatro habilidades con base real y ninguna dominante.
  const repartido = () => {
    const retos = [
      { id: 'a', skill: 'hogar' }, { id: 'b', skill: 'hogar' },
      { id: 'c', skill: 'salud' }, { id: 'd', skill: 'salud' },
      { id: 'e', skill: 'aprendizaje' }, { id: 'f', skill: 'aprendizaje' },
      { id: 'g', skill: 'amabilidad' }, { id: 'h', skill: 'amabilidad' }
    ]
    const fechas = ['2026-01-05', '2026-01-06', '2026-01-07']
    const comps = retos.flatMap((r) =>
      fechas.flatMap((f) => [hecha(f, { reto: r.id, xp: 25 }), hecha(f, { reto: r.id, xp: 25 })])
    )
    return proyeccionDe(PERFIL, { completions: comps, challenges: retos, completa: true })
  }

  it('cuatro caminos con base y sin dominante lo cumplen', () => {
    const p = repartido()
    expect(cumple(p, selloPorId('equilibrio_4_caminos').regla)).toBe(true)
  })

  it('una habilidad que se lo come todo lo tumba, aunque sobre XP', () => {
    const retos = [{ id: 'a', skill: 'hogar' }, { id: 'b', skill: 'hogar' }]
    const comps = ['2026-01-05', '2026-01-06', '2026-01-07'].flatMap((f) =>
      [hecha(f, { reto: 'a', xp: 200 }), hecha(f, { reto: 'b', xp: 200 })]
    )
    const p = proyeccionDe(PERFIL, { completions: comps, challenges: retos, completa: true })
    expect(p.concentracion).toBe(1)
    expect(cumple(p, selloPorId('equilibrio_4_caminos').regla)).toBe(false)
  })

  it('sin XP la concentración es 0, no 1: 0/0 no es dominar nada', () => {
    expect(proy([]).concentracion).toBe(0)
  })
})

describe('regreso al taller', () => {
  const base = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05']

  it('volver tras una semana y seguir otro día lo cumple', () => {
    const p = proy([...base, '2026-01-15', '2026-01-17'].map((d) => hecha(d)))
    expect(cumple(p, selloPorId('regreso_01').regla)).toBe(true)
  })

  it('volver UN solo día no basta: eso premiaría desaparecer', () => {
    const p = proy([...base, '2026-01-15'].map((d) => hecha(d)))
    expect(cumple(p, selloPorId('regreso_01').regla)).toBe(false)
  })

  it('sin historia previa suficiente no hay a dónde volver', () => {
    const p = proy(['2026-01-01', '2026-01-15', '2026-01-17'].map((d) => hecha(d)))
    expect(cumple(p, selloPorId('regreso_01').regla)).toBe(false)
  })

  it('una pausa corta no cuenta, y el hueco se mide en días muertos', () => {
    // Del 5 al 12 hay SEIS días muertos, no siete. Si se midiera la
    // distancia entre marcas, una pausa de siete se cobraría con seis.
    const p = proy([...base, '2026-01-12', '2026-01-14'].map((d) => hecha(d)))
    expect(cumple(p, selloPorId('regreso_01').regla)).toBe(false)

    const justo = proy([...base, '2026-01-13', '2026-01-15'].map((d) => hecha(d)))
    expect(cumple(justo, selloPorId('regreso_01').regla)).toBe(true)
  })
})

describe('descubrimientos', () => {
  it('cuatro habilidades en la MISMA semana y tres días', () => {
    const retos = [
      { id: 'a', skill: 'hogar' }, { id: 'b', skill: 'salud' },
      { id: 'c', skill: 'aprendizaje' }, { id: 'd', skill: 'amabilidad' }
    ]
    const comps = [
      hecha('2026-01-05', { reto: 'a' }), hecha('2026-01-06', { reto: 'b' }),
      hecha('2026-01-07', { reto: 'c' }), hecha('2026-01-07', { reto: 'd' })
    ]
    const p = proyeccionDe(PERFIL, { completions: comps, challenges: retos, completa: true })
    expect(cumple(p, selloPorId('descubrimiento_semana_variada').regla)).toBe(true)
  })

  it('las mismas cuatro repartidas en semanas distintas NO', () => {
    const retos = [
      { id: 'a', skill: 'hogar' }, { id: 'b', skill: 'salud' },
      { id: 'c', skill: 'aprendizaje' }, { id: 'd', skill: 'amabilidad' }
    ]
    const comps = [
      hecha('2026-01-05', { reto: 'a' }), hecha('2026-01-13', { reto: 'b' }),
      hecha('2026-01-21', { reto: 'c' }), hecha('2026-01-29', { reto: 'd' })
    ]
    const p = proyeccionDe(PERFIL, { completions: comps, challenges: retos, completa: true })
    expect(cumple(p, selloPorId('descubrimiento_semana_variada').regla)).toBe(false)
  })
})

describe('la regla de seguridad: historial truncado', () => {
  // El caso que la motiva: si solo se cargan las últimas N filas, la
  // primera que se ve SIEMPRE parece venir después de un silencio. Sin
  // esta guarda, media familia recibiría «has vuelto al taller» por haber
  // pasado del límite de carga.
  const conPausa = [
    '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05',
    '2026-01-15', '2026-01-17'
  ].map((d) => hecha(d))

  it('con historial completo, el regreso se concede', () => {
    const p = proy(conPausa)
    const ganados = sellosGanados(p, EVALUABLES).map((s) => s.id)
    expect(ganados).toContain('regreso_01')
  })

  it('con historial truncado, NO se concede', () => {
    const p = proy(conPausa, { completa: false })
    const ganados = sellosGanados(p, EVALUABLES).map((s) => s.id)
    expect(ganados).not.toContain('regreso_01')
  })

  it('el equilibrio también espera: es una proporción sobre la muestra', () => {
    const retos = [
      { id: 'a', skill: 'hogar' }, { id: 'b', skill: 'hogar' },
      { id: 'c', skill: 'salud' }, { id: 'd', skill: 'salud' },
      { id: 'e', skill: 'aprendizaje' }, { id: 'f', skill: 'aprendizaje' },
      { id: 'g', skill: 'amabilidad' }, { id: 'h', skill: 'amabilidad' }
    ]
    const comps = retos.flatMap((r) =>
      ['2026-01-05', '2026-01-06', '2026-01-07'].flatMap((f) =>
        [hecha(f, { reto: r.id, xp: 25 }), hecha(f, { reto: r.id, xp: 25 })])
    )
    const truncada = proyeccionDe(PERFIL, { completions: comps, challenges: retos, completa: false })
    expect(sellosGanados(truncada, EVALUABLES).map((s) => s.id)).not.toContain('equilibrio_4_caminos')
  })

  it('lo que solo puede quedarse corto sí se evalúa aunque esté truncado', () => {
    // Ritmo y trayectoria con datos recortados dan MENOS de lo real,
    // nunca más. Bloquearlos también sería castigar sin motivo.
    const p = proy(['2026-01-05', '2026-01-08', '2026-01-20'].map((d) => hecha(d)), { completa: false })
    expect(sellosGanados(p, EVALUABLES).map((s) => s.id)).toContain('ritmo_01')
  })
})

describe('nada se concede dos veces ni sin regla', () => {
  it('lo ya conseguido no vuelve a proponerse', () => {
    const p = proy(['2026-01-05', '2026-01-08', '2026-01-20'].map((d) => hecha(d)))
    const yaTiene = new Set(['ritmo_01', 'inicio_primer_encargo'])
    const ganados = sellosGanados(p, EVALUABLES, yaTiene).map((s) => s.id)
    expect(ganados).not.toContain('ritmo_01')
    expect(ganados).not.toContain('inicio_primer_encargo')
  })

  it('un perfil sin nada hecho no gana absolutamente nada', () => {
    expect(sellosGanados(proy([]), EVALUABLES)).toEqual([])
  })

  it('los seis sin dato que los sostenga no se conceden JAMÁS', () => {
    // Autonomía (4), los dos repetibles de temporada y el descubrimiento
    // de generaciones. No tienen regla a propósito: conceder por una
    // condición que el sistema no puede demostrar es lo único que no se
    // puede deshacer.
    const sinRegla = SELLOS_V1.filter((s) => !s.regla).map((s) => s.id)
    expect(sinRegla).toEqual([
      'autonomia_transicion_01', 'autonomia_transicion_02',
      'autonomia_transicion_03', 'autonomia_transicion_04',
      'obra_comun_temporada', 'obra_comun_participante',
      'descubrimiento_varias_generaciones'
    ])

    // Ni con una vida entera de actividad aparecen.
    const vidaEntera = proy(
      Array.from({ length: 400 }, (_, i) =>
        hecha(`2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`))
    )
    const ganados = sellosGanados(vidaEntera, EVALUABLES).map((s) => s.id)
    for (const id of sinRegla) expect(ganados, id).not.toContain(id)
  })

  it('EVALUABLES son exactamente los que tienen regla', () => {
    expect(EVALUABLES.every((s) => s.regla)).toBe(true)
    expect(EVALUABLES).toHaveLength(SELLOS_V1.length - 7)
  })
})

describe('convivencia con las dieciséis de siempre', () => {
  it('los sellos nuevos NO cuentan para «Coleccionista»', async () => {
    // El fallo que esto fija: al encender el motor, un perfil salta de
    // tres insignias a doce en una pasada retroactiva y la única del
    // gremio se la lleva quien abra la app primero. Eso no es un mérito.
    const { meritosDe } = await import('../src/lib/meritos')
    const perfil = { id: 'p1', xp: 0 }
    const badges = [
      { profile_id: 'p1', code: 'primera' },
      { profile_id: 'p1', code: 'x10' },
      ...['ritmo_01', 'ritmo_02', 'trayectoria_01', 'trayectoria_02',
        'oficio_hogar_1', 'inicio_primer_encargo', 'exploracion_5_familias',
        'equilibrio_4_caminos'].map((code) => ({ profile_id: 'p1', code }))
    ]
    expect(badges).toHaveLength(10)
    expect(meritosDe(perfil, { badges }).insignias).toBe(2)
  })
})
