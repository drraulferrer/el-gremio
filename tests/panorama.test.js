import { describe, it, expect } from 'vitest'
import { diaDe, lecturaDelDia, relojesDe, saludo, semanaDe } from '../src/lib/panorama'
import { diasSalvados } from '../src/lib/rachas'
import { dayKey } from '../src/lib/supabase'

const perfil = { id: 'p1', role: 'junior', xp: 240, coins: 30 }

// El día de referencia es un MIÉRCOLES, y eso importa: las barras de la
// semana empiezan en lunes, así que con un día en medio se comprueba a la
// vez que hay pasado y que hay futuro.
const AHORA = new Date('2026-08-19T18:00:00.000Z')

const reto = (id, extra = {}) => ({
  id,
  family_id: 'f1',
  title: 'Misión ' + id,
  frequency: 'diario',
  xp: 10,
  skill: 'hogar',
  active: true,
  role: 'junior',
  ...extra
})

const hecha = (challenge_id, cuando, extra = {}) => ({
  id: 'c-' + challenge_id + cuando,
  profile_id: 'p1',
  challenge_id,
  status: 'aprobado',
  xp: 10,
  coins: 3,
  requested_at: cuando,
  resolved_at: cuando,
  ...extra
})

// `canDo` lee el reloj de verdad por su cuenta (ver el aviso en
// `diaDe`), así que estas pruebas van con la hora real: con una fecha
// inventada, el plan se movería y la disponibilidad no, y las cuentas
// dejarían de cuadrar por un motivo que no es el que se está probando.
describe('cómo va el día', () => {
  const HOY = new Date()

  it('sin misiones asignadas no inventa un cero', () => {
    // Un día neutro no es un día suspendido. Si el arco marcara 0 %, la
    // pantalla estaría regañando por algo que nadie ha pedido.
    const d = diaDe(perfil, { challenges: [], completions: [] }, HOY)
    expect(d.tocan).toBe(0)
    expect(d.pct).toBe(0)
    expect(lecturaDelDia(d, 4).estado).toBe('libre')
  })

  it('cuenta lo enviado, no lo validado', () => {
    // La decisión de fondo del arco: quien ha hecho su parte y espera el
    // visto bueno de un adulto ha terminado su día. Medir la validación
    // sería enseñarle la diligencia del adulto como si fuera suya.
    const challenges = [reto('a'), reto('b')]
    const completions = [
      { id: 'x', profile_id: 'p1', challenge_id: 'a', status: 'pendiente', xp: 10, requested_at: HOY.toISOString() }
    ]
    const d = diaDe(perfil, { challenges, completions }, HOY)
    expect(d.tocan).toBe(2)
    expect(d.hechas).toBe(1)
    expect(d.quedan).toBe(1)
    expect(d.validadas).toBe(0)
    expect(d.pct).toBe(50)
  })

  it('cerrado es cerrado aunque nadie haya validado todavía', () => {
    const challenges = [reto('a')]
    const completions = [
      { id: 'x', profile_id: 'p1', challenge_id: 'a', status: 'pendiente', xp: 10, requested_at: HOY.toISOString() }
    ]
    const d = diaDe(perfil, { challenges, completions }, HOY)
    const lectura = lecturaDelDia(d, 0)
    expect(d.pct).toBe(100)
    expect(lectura.estado).toBe('cerrado')
    expect(lectura.frase).toMatch(/visto bueno/)
  })

  it('lo devuelto vuelve a contar como pendiente de hacer', () => {
    // `canDo` no cuenta los rechazos, así que una misión devuelta vuelve
    // a estar en el plato. El arco tiene que reflejarlo o diría que el
    // día está cerrado con trabajo por rehacer.
    const challenges = [reto('a')]
    const completions = [
      { id: 'x', profile_id: 'p1', challenge_id: 'a', status: 'rechazado', xp: 10, requested_at: HOY.toISOString(), resolved_at: HOY.toISOString() }
    ]
    const d = diaDe(perfil, { challenges, completions }, HOY)
    expect(d.quedan).toBe(1)
    expect(d.pct).toBe(0)
  })

  it('la XP del día solo cuenta lo validado hoy', () => {
    const ayer = new Date(HOY.getTime() - 86400000).toISOString()
    const challenges = [reto('a'), reto('b')]
    const completions = [hecha('a', HOY.toISOString()), hecha('b', ayer)]
    expect(diaDe(perfil, { challenges, completions }, HOY).xp).toBe(10)
  })
})

describe('la lectura del día', () => {
  const casos = [
    [{ tocan: 0, quedan: 0, hechas: 0, pct: 0 }, 'libre'],
    [{ tocan: 4, quedan: 4, hechas: 0, pct: 0 }, 'en-blanco'],
    [{ tocan: 4, quedan: 3, hechas: 1, pct: 25 }, 'arrancado'],
    [{ tocan: 4, quedan: 1, hechas: 3, pct: 75 }, 'medio'],
    [{ tocan: 4, quedan: 0, hechas: 4, pct: 100 }, 'cerrado']
  ]

  it('cada tramo tiene su palabra', () => {
    for (const [dia, estado] of casos) expect(lecturaDelDia(dia, 0).estado).toBe(estado)
  })

  it('el titular nunca repite la cifra del arco', () => {
    // Debajo del arco ya hay un número enorme. Volver a decirlo en letra
    // no añade nada: lo que hace falta ahí es la palabra que lo lee.
    for (const [dia] of casos) expect(lecturaDelDia(dia, 3).titulo).not.toMatch(/\d/)
  })

  it('la frase dice qué falta, en singular y en plural', () => {
    expect(lecturaDelDia({ tocan: 4, quedan: 1, hechas: 3, pct: 75 }, 0).frase).toMatch(/queda una misión/)
    expect(lecturaDelDia({ tocan: 4, quedan: 3, hechas: 1, pct: 25 }, 0).frase).toMatch(/quedan 3 misiones/)
  })

  it('en blanco con racha viva recuerda la racha, sin amenazar', () => {
    const f = lecturaDelDia({ tocan: 2, quedan: 2, hechas: 0, pct: 0 }, 9).frase
    expect(f).toMatch(/9 días/)
    expect(f).not.toMatch(/perder|pierdes|romper/)
  })
})

describe('la semana en barras', () => {
  const challenges = [reto('a')]
  const lunes = '2026-08-17T10:00:00.000Z'
  const martes = '2026-08-18T10:00:00.000Z'
  const completions = [
    hecha('a', lunes),
    hecha('a', martes, { id: 'c2' }),
    hecha('a', martes, { id: 'c3', xp: 30 })
  ]

  it('son siete y empiezan en lunes', () => {
    const s = semanaDe('p1', completions, AHORA)
    expect(s.dias).toHaveLength(7)
    expect(s.dias.map((d) => d.letra)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D'])
  })

  it('marca hoy y deja el futuro sin dibujar', () => {
    const s = semanaDe('p1', completions, AHORA)
    expect(s.dias.filter((d) => d.esHoy)).toHaveLength(1)
    expect(s.dias.find((d) => d.esHoy).letra).toBe('X')
    expect(s.dias.filter((d) => d.futuro).map((d) => d.letra)).toEqual(['J', 'V', 'S', 'D'])
  })

  it('escala contra el mejor día de la semana, no contra un techo fijo', () => {
    // Con un techo fijo, una semana floja sale plana y no se lee nada.
    // Lo que interesa ver es la forma: dónde se concentra el esfuerzo.
    const s = semanaDe('p1', completions, AHORA)
    const porLetra = Object.fromEntries(s.dias.map((d) => [d.letra, d]))
    expect(porLetra.M.xp).toBe(40)
    expect(porLetra.M.alto).toBe(100)
    expect(porLetra.L.xp).toBe(10)
    expect(porLetra.L.alto).toBe(25)
    expect(s.xp).toBe(50)
    expect(s.misiones).toBe(3)
  })

  it('un día con poca XP sigue siendo una barra visible', () => {
    const flojo = [hecha('a', lunes, { xp: 1 }), hecha('a', martes, { id: 'c9', xp: 200 })]
    const s = semanaDe('p1', flojo, AHORA)
    expect(s.dias.find((d) => d.letra === 'L').alto).toBeGreaterThanOrEqual(8)
  })

  it('una semana en blanco no deja barras a medias', () => {
    const s = semanaDe('p1', [], AHORA)
    expect(s.mejor).toBe(0)
    expect(s.dias.every((d) => d.alto === 0)).toBe(true)
  })

  it('no cuenta lo de otra persona', () => {
    const ajenas = completions.map((c) => ({ ...c, profile_id: 'p2' }))
    expect(semanaDe('p1', ajenas, AHORA).xp).toBe(0)
  })
})

describe('los tres relojes', () => {
  const base = {
    challenges: [reto('a')],
    completions: [
      hecha('a', '2026-08-19T10:00:00.000Z'),
      hecha('a', '2026-08-18T10:00:00.000Z', { id: 'c2' })
    ],
    powerUses: [],
    goals: [],
    goal: null
  }

  it('trae racha, nivel y temporada', () => {
    const r = relojesDe(perfil, base, AHORA)
    expect(r.racha).toBe(2)
    expect(r.nivel.level).toBeGreaterThan(0)
    expect(r.temporada.temporada).toBe(1)
    expect(r.meta).toBe(null)
  })

  it('la meta trae su porcentaje ya calculado y con techo', () => {
    // Con techo porque la barra no puede pasar del 100 %: el gremio
    // sigue sumando XP después de conseguirla y sin el mínimo la barra
    // se salía de la tarjeta.
    const goal = { id: 'g1', title: 'Excursión', emoji: '🏔️', target_xp: 15, starts_at: '2026-08-01T00:00:00.000Z' }
    const r = relojesDe(perfil, { ...base, goal, goals: [goal] }, AHORA)
    expect(r.meta.hecho).toBe(15)
    expect(r.meta.pct).toBe(100)
    expect(r.meta.lograda).toBe(true)
  })

  it('un comodín tapa el día que salvó', () => {
    // El agujero del 18 lo tapa el comodín: sin él la racha se corta en 1.
    const soloHoy = [hecha('a', '2026-08-19T10:00:00.000Z')]
    const conHueco = [hecha('a', '2026-08-19T10:00:00.000Z'), hecha('a', '2026-08-17T10:00:00.000Z', { id: 'c3' })]
    expect(relojesDe(perfil, { ...base, completions: conHueco }, AHORA).racha).toBe(1)

    const powerUses = [{ profile_id: 'p1', tipo: 'salva_racha', used_at: '2026-08-18T12:00:00.000Z' }]
    expect(relojesDe(perfil, { ...base, completions: [...conHueco], powerUses }, AHORA).racha).toBe(3)
    expect(relojesDe(perfil, { ...base, completions: soloHoy, powerUses }, AHORA).racha).toBe(2)
  })
})

describe('los días salvados hablan el mismo idioma que la racha', () => {
  it('la clave sale de dayKey, no de la fecha del aparato', () => {
    // Se comparan dentro de un Set contra las de `diasConAlgo`. Escrita a
    // mano con getDate(), la clave solo coincide mientras el móvil esté
    // en la zona de la familia.
    const usos = [
      { profile_id: 'p1', tipo: 'salva_racha', used_at: '2026-08-18T12:00:00.000Z' },
      { profile_id: 'p2', tipo: 'salva_racha', used_at: '2026-08-18T12:00:00.000Z' },
      { profile_id: 'p1', tipo: 'otra_cosa', used_at: '2026-08-18T12:00:00.000Z' }
    ]
    expect(diasSalvados(usos, 'p1')).toEqual([dayKey(new Date('2026-08-18T12:00:00.000Z'))])
  })
})

describe('el saludo', () => {
  it('cambia con la hora del aparato', () => {
    const a = (h) => saludo(new Date(2026, 7, 19, h, 0, 0))
    expect(a(3)).toBe('Buenas noches')
    expect(a(9)).toBe('Buenos días')
    expect(a(17)).toBe('Buenas tardes')
    expect(a(23)).toBe('Buenas noches')
  })
})
