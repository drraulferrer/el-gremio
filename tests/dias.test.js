import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DIAS_SEMANA,
  diasDe,
  tocaDia,
  tocaEl,
  alternarDia,
  textoDias,
  misionesDe,
  diasNeutros
} from '../src/lib/misiones'
import { rachaActual, enRiesgo } from '../src/lib/rachas'
import { rachaMaxima } from '../src/lib/meritos'
import { cargaDe, cuantasALaVez, revisarCarga } from '../src/lib/economia'
import { configurarZona, diaSemana } from '../src/lib/supabase'

// ------------------------------------------------------------------
// Planificar por días de la semana.
//
// Lo que defienden estos tests son las DOS decisiones que sostienen la
// funcionalidad, no la forma de una lista:
//
//  1. Se planifica por día de la semana y no por «semana que empieza
//     hoy». Un patrón de siete casillas no tiene fecha de inicio, así que
//     empezar a usarlo un jueves no deja ninguna semana a medias.
//  2. Un día sin misiones asignadas es NEUTRO para la racha: ni la rompe
//     ni la alarga. Sin esto, la planificación se lleva por delante el
//     sistema de rachas entero.
//
// La segunda es la que más fácil se rompe al tocar otra cosa, y es la que
// tiene aquí más comprobaciones.
// ------------------------------------------------------------------

afterEach(() => configurarZona(null))

// 2026: el 10 de agosto fue lunes. Todas las fechas de aquí salen de ahí.
const LUNES = new Date(2026, 7, 10)
const dia = (n) => new Date(2026, 7, 9 + n) // n = 1 lunes … 7 domingo

describe('el patrón, tal y como se guarda', () => {
  it('sin patrón es todos los días', () => {
    expect(diasDe({})).toBe(null)
    expect(diasDe({ days: null })).toBe(null)
  })

  it('los siete marcados y el conjunto vacío valen lo mismo: null', () => {
    // No es una simplificación: guardar `{}` dejaría una misión activa
    // que no sale NUNCA en ningún tablero y que nadie sabría por qué.
    expect(diasDe({ days: [] })).toBe(null)
    expect(diasDe({ days: [1, 2, 3, 4, 5, 6, 7] })).toBe(null)
  })

  it('se ordena, se quitan repetidos y se descarta lo que no es un día', () => {
    expect(diasDe({ days: [5, 1, 5, 3] })).toEqual([1, 3, 5])
    expect(diasDe({ days: [0, 8, 2, 'x', null] })).toEqual([2])
  })

  it('las siete casillas van de lunes a domingo, como el isodow de Postgres', () => {
    expect(DIAS_SEMANA.map((d) => d.n)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(DIAS_SEMANA.map((d) => d.letra).join('')).toBe('LMXJVSD')
    expect(diaSemana(LUNES)).toBe(1)
    expect(diaSemana(dia(7))).toBe(7)
  })
})

describe('qué toca cada día', () => {
  const alternos = { id: 'c1', active: true, days: [1, 3, 5] }
  const siempre = { id: 'c2', active: true }

  it('sin patrón toca todos los días', () => {
    for (let n = 1; n <= 7; n++) expect(tocaEl(siempre, dia(n))).toBe(true)
  })

  it('con patrón toca solo esos días', () => {
    expect(tocaEl(alternos, dia(1))).toBe(true)
    expect(tocaEl(alternos, dia(2))).toBe(false)
    expect(tocaEl(alternos, dia(5))).toBe(true)
    expect(tocaEl(alternos, dia(7))).toBe(false)
  })

  it('el patrón no tiene fecha de inicio: la semana siguiente dice lo mismo', () => {
    // Esta es la decisión 1 entera. Si empezar en jueves obligara a
    // normalizar algo, este test sería imposible de escribir.
    for (let n = 1; n <= 7; n++) {
      const estaSemana = dia(n)
      const laQueViene = new Date(estaSemana)
      laQueViene.setDate(laQueViene.getDate() + 7)
      expect(tocaEl(alternos, laQueViene)).toBe(tocaEl(alternos, estaSemana))
    }
  })

  it('el día se lee en la zona de la familia, no en la del aparato', () => {
    // Lunes a las 00:30 en Madrid es todavía domingo en México. La misión
    // de los lunes tiene que salir el lunes de la casa.
    const instante = new Date('2026-08-09T22:30:00Z')
    configurarZona('Europe/Madrid')
    expect(diaSemana(instante)).toBe(1)
    configurarZona('America/Mexico_City')
    expect(diaSemana(instante)).toBe(7)
  })

  it('marcar y desmarcar devuelve ya lo que se guarda', () => {
    expect(alternarDia(null, 3)).toEqual([1, 2, 4, 5, 6, 7]) // partía de todos
    expect(alternarDia([1, 3], 5)).toEqual([1, 3, 5])
    expect(alternarDia([1, 3], 3)).toEqual([1])
    // Desmarcar el último no deja una misión que no sale nunca.
    expect(alternarDia([3], 3)).toBe(null)
    // Y marcar el séptimo vuelve a «todos los días».
    expect(alternarDia([1, 2, 3, 4, 5, 6], 7)).toBe(null)
  })

  it('se lee en palabras', () => {
    expect(textoDias({ days: null })).toBe('Todos los días')
    expect(textoDias({ days: [1, 4] })).toBe('lunes, jueves')
  })
})

describe('el tablero pregunta por hoy; el panel, por lo asignado', () => {
  const perfil = { id: 'p1', role: 'junior' }
  const todas = [
    { id: 'c1', active: true, profile_id: 'p1', days: [1, 3, 5] },
    { id: 'c2', active: true, profile_id: 'p1' },
    { id: 'c3', active: true, profile_id: 'otro' }
  ]

  it('sin `dia` salen todas las suyas, toquen hoy o no', () => {
    // Si el panel escondiera la de los lunes un martes, se editaría dos
    // veces por no encontrarla.
    expect(misionesDe(perfil, todas).map((m) => m.id)).toEqual(['c1', 'c2'])
  })

  it('con `dia` sale solo lo que toca ese día', () => {
    expect(misionesDe(perfil, todas, { dia: dia(1) }).map((m) => m.id)).toEqual(['c1', 'c2'])
    expect(misionesDe(perfil, todas, { dia: dia(2) }).map((m) => m.id)).toEqual(['c2'])
  })
})

describe('los días neutros', () => {
  const perfil = { id: 'p1', role: 'junior' }
  const soloLunesYJueves = [{ id: 'c1', active: true, profile_id: 'p1', days: [1, 4] }]

  it('mientras nadie use el patrón, no hay ni un día neutro', () => {
    // El atajo que hace que la racha se comporte exactamente igual que
    // antes de que esto existiera.
    const sinPatron = [{ id: 'c1', active: true, profile_id: 'p1' }]
    expect(diasNeutros(perfil, sinPatron, { hoy: LUNES })).toEqual([])
  })

  it('sin ninguna misión activa tampoco hay días neutros', () => {
    // Si los hubiera, un perfil recién creado tendría 400 días neutros y
    // su racha caminaría hacia atrás hasta el tope sin haber hecho nada.
    expect(diasNeutros(perfil, [], { hoy: LUNES })).toEqual([])
    expect(diasNeutros(perfil, [{ id: 'c1', active: false, profile_id: 'p1', days: [1] }], { hoy: LUNES })).toEqual([])
  })

  it('son los días en los que no le toca nada', () => {
    const neutros = diasNeutros(perfil, soloLunesYJueves, { hoy: dia(7), ventana: 7 })
    // Del domingo hacia atrás: D S V (neutros), J (no), X M (neutros), L (no).
    expect(neutros).toEqual(['2026-8-16', '2026-8-15', '2026-8-14', '2026-8-12', '2026-8-11'])
  })

  it('una misión de otra persona no le salva ningún día', () => {
    const deOtra = [...soloLunesYJueves, { id: 'c9', active: true, profile_id: 'p9' }]
    expect(diasNeutros(perfil, deOtra, { hoy: dia(7), ventana: 7 }).length).toBe(5)
  })
})

describe('la racha con días neutros', () => {
  const hecho = (dias) => dias.map((d, i) => ({
    id: `x${i}`, profile_id: 'p1', status: 'aprobado', resolved_at: new Date(2026, 7, d, 12).toISOString()
  }))

  // Lunes 10, miércoles 12 y viernes 14. Martes y jueves, libres.
  const alternos = ['2026-8-11', '2026-8-13']

  it('un día libre no rompe la racha', () => {
    const c = hecho([10, 12, 14])
    expect(rachaActual(c, 'p1', [], new Date(2026, 7, 14), [])).toBe(1)
    expect(rachaActual(c, 'p1', [], new Date(2026, 7, 14), alternos)).toBe(3)
  })

  it('un día libre tampoco la alarga: cuenta días CUMPLIDOS', () => {
    // La diferencia con el comodín, y la razón de que vayan separados: si
    // los neutros contaran como día hecho, quien solo tuviera misiones
    // los lunes llegaría a cien días sin haber hecho nada.
    const soloLunes = hecho([10])
    const libres = ['2026-8-11', '2026-8-12', '2026-8-13', '2026-8-14']
    expect(rachaActual(soloLunes, 'p1', [], new Date(2026, 7, 14), libres)).toBe(1)
  })

  it('un día que tocaba y no se hizo sigue rompiéndola', () => {
    const c = hecho([10, 12, 14])
    // El martes es libre, pero el jueves 13 no lo es: ahí se corta.
    expect(rachaActual(c, 'p1', [], new Date(2026, 7, 14), ['2026-8-11'])).toBe(1)
  })

  it('nadie está en riesgo un día en el que no le toca nada', () => {
    const c = hecho([10, 12])
    const hoy = new Date(2026, 7, 13) // jueves libre
    expect(enRiesgo(c, 'p1', [], hoy, [])).toBe(true)
    expect(enRiesgo(c, 'p1', [], hoy, ['2026-8-13'])).toBe(false)
  })

  it('la racha máxima puentea el hueco neutro sin contarlo', () => {
    const c = hecho([10, 12, 14])
    expect(rachaMaxima(c, 'p1')).toBe(1)
    expect(rachaMaxima(c, 'p1', [], alternos)).toBe(3)
  })

  it('un hueco con un día NO neutro dentro no se puentea', () => {
    const c = hecho([10, 14])
    // Faltan tres días de por medio y solo dos son libres.
    expect(rachaMaxima(c, 'p1', [], ['2026-8-11', '2026-8-13'])).toBe(1)
  })

  it('los días neutros no inventan racha donde no hay nada hecho', () => {
    expect(rachaMaxima([], 'p1', [], ['2026-8-11', '2026-8-12'])).toBe(0)
  })
})

describe('la carga con el reparto por días', () => {
  const diaria = (id, days) => ({ id, frequency: 'diario', days })

  it('una diaria repartida en tres días pesa 3/7, no 1', () => {
    expect(cargaDe([diaria('a')])).toBe(1)
    expect(cargaDe([diaria('a', [1, 3, 5])])).toBeCloseTo(3 / 7, 5)
  })

  it('el reparto no toca a las semanales: una vez por semana es una vez por semana', () => {
    // Dividirlas otra vez las contaría siete veces menos de lo que cuestan.
    expect(cargaDe([{ id: 'a', frequency: 'semanal', days: [6] }])).toBeCloseTo(1 / 7, 5)
  })

  it('el tope de diarias mira el peor día, no el total', () => {
    // Repartir ocho diarias en cuatro y cuatro deja cuatro por día, y
    // avisar de que se pasa de siete sería regañar por haber hecho justo
    // lo que el aviso pide.
    const ocho = [1, 2, 3, 4].map((i) => diaria(`l${i}`, [1, 2, 3])).concat(
      [5, 6, 7, 8].map((i) => diaria(`j${i}`, [4, 5, 6]))
    )
    expect(cuantasALaVez(ocho, 'diario')).toBe(4)
    expect(revisarCarga(ocho).porFrecuencia.find((f) => f.frecuencia === 'diario').excede).toBe(false)
    // Y las mismas ocho sin repartir sí se pasan.
    const sinRepartir = ocho.map((m) => ({ ...m, days: null }))
    expect(cuantasALaVez(sinRepartir, 'diario')).toBe(8)
    expect(revisarCarga(sinRepartir).porFrecuencia.find((f) => f.frecuencia === 'diario').excede).toBe(true)
  })

  it('tocaDia acepta el número del día directamente', () => {
    expect(tocaDia({ days: [2] }, 2)).toBe(true)
    expect(tocaDia({ days: [2] }, 3)).toBe(false)
    expect(tocaDia({}, 3)).toBe(true)
  })
})

// ------------------------------------------------------------------
// Las dos mitades tienen que decir lo mismo
//
// La racha se DIBUJA en el cliente y se CERTIFICA en Postgres. Si solo se
// arreglara una, la pantalla diría 12 y la base pagaría por 4. Estos
// tests no ejecutan SQL: fijan que la regla esté escrita en los dos
// sitios, que es lo que se olvida al tocar uno de ellos.
// ------------------------------------------------------------------

describe('cliente y base cuentan igual', () => {
  const migracion = readFileSync(new URL('../migracion-024-dias-de-la-semana.sql', import.meta.url), 'utf8')
  const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')

  it('la columna existe en las dos, con el array vacío prohibido', () => {
    for (const sql of [migracion, schema]) {
      expect(sql).toMatch(/days smallint\[\]/)
      expect(sql).toMatch(/cardinality\(days\) between 1 and 7/)
    }
  })

  it('las dos tienen el espejo del predicado de misiones.js', () => {
    for (const sql of [migracion, schema]) {
      expect(sql).toMatch(/create or replace function public\.sin_mision_ese_dia/)
      expect(sql).toMatch(/extract\(isodow from p_dia\)/)
    }
  })

  it('streak_days atraviesa los días sin misiones en las dos', () => {
    for (const sql of [migracion, schema]) {
      expect(sql).toMatch(/exit when v_dia < v_hoy and not public\.sin_mision_ese_dia/)
    }
  })

  it('la vista de avisos calla en un día libre, en las dos', () => {
    for (const sql of [migracion, schema]) {
      expect(sql).toMatch(/sin_mision_ese_dia\(p\.id, h\.dia\) as dia_libre/)
      expect(sql).toMatch(/when a\.dia_libre and a\.role <> 'adulto' then null/)
    }
  })

  it('1 = lunes en los dos lados', () => {
    // `isodow` de Postgres da 1 para lunes y 7 para domingo. Si el
    // cliente contara desde el domingo, como getDay(), la misión de los
    // lunes saldría los martes.
    expect(DIAS_SEMANA[0].nombre).toBe('lunes')
    expect(diaSemana(LUNES)).toBe(1)
    expect(migracion).toMatch(/1 = lunes/)
  })
})
