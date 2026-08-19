import { describe, it, expect, beforeEach } from 'vitest'
import { crearClienteDemo } from '../src/lib/fakeBackend'
import {
  ESFUERZO,
  BOTIN_FACTOR,
  TIPOS,
  CAMPANAS,
  campanasDeTipo,
  campanaDeCatalogo,
  puntosDeTarea,
  minutosDe,
  puedeLanzarCampana,
  tareaApta,
  repartoSugerido,
  tareasParaLanzar,
  resumenDeReparto,
  campanaActiva,
  misionesDeCampana,
  progresoDeCampana,
  botinPrevisto,
  campanaVencida,
  diasRestantes
} from '../src/lib/limpieza'
import { DEFAULTS_ROL } from '../src/lib/tareas'
import { marcasDe } from '../src/lib/genero'

const ADULTA = { id: 'a1', role: 'adulto', active: true }
const ADULTO2 = { id: 'a2', role: 'adulto', active: true }
const JUNIOR = { id: 'j1', role: 'junior', active: true }
const PEQUE = { id: 'p1', role: 'peque', active: true }
const PERRO = { id: 'm1', role: 'mascota', active: true }
const FAMILIA = [ADULTA, ADULTO2, JUNIOR, PEQUE, PERRO]

describe('el catálogo', () => {
  it('cada campaña está bien formada', () => {
    const claves = new Set()
    for (const c of CAMPANAS) {
      expect(claves.has(c.clave), c.clave).toBe(false)
      claves.add(c.clave)
      expect(TIPOS.some((t) => t.id === c.tipo), c.clave).toBe(true)
      expect(c.titulo.length, c.clave).toBeLessThanOrEqual(120)
      expect(c.dias, c.clave).toBeGreaterThanOrEqual(1)
      expect(c.dias, c.clave).toBeLessThanOrEqual(30)
      expect(c.tareas.length, c.clave).toBeGreaterThanOrEqual(1)
      expect(c.tareas.length, c.clave).toBeLessThanOrEqual(40)
      for (const t of c.tareas) {
        expect(t.t.length, t.t).toBeLessThanOrEqual(120)
        expect(ESFUERZO[t.esf], `${c.clave}: ${t.t}`).toBeTruthy()
        expect(t.roles.length, t.t).toBeGreaterThan(0)
        for (const rol of t.roles) {
          expect(['peque', 'junior', 'adulto'], `${t.t}: ${rol}`).toContain(rol)
        }
      }
    }
  })

  it('los tres formatos tienen campañas: relámpago, zona y profunda', () => {
    expect(campanasDeTipo('blitz').length).toBeGreaterThanOrEqual(3)
    expect(campanasDeTipo('zona').length).toBe(5)
    expect(campanasDeTipo('profunda').length).toBeGreaterThanOrEqual(5)
  })

  it('ningún título necesita marca de género: ninguna tarea habla de quien la hace', () => {
    for (const c of CAMPANAS) {
      expect(marcasDe(c.titulo), c.titulo).toEqual([])
      for (const t of c.tareas) expect(marcasDe(t.t), t.t).toEqual([])
    }
  })

  it('la peque tiene tareas de verdad en casi todas las campañas', () => {
    // A los tres años participar es el premio: una operación familiar
    // donde ella no tiene baldosa es una fiesta a la que no la invitaron.
    const conPeque = CAMPANAS.filter((c) => c.tareas.some((t) => t.roles.includes('peque')))
    expect(conPeque.length).toBeGreaterThanOrEqual(CAMPANAS.length - 3)
  })

  it('lo peligroso —químicos, horno, altura— es solo de personas adultas', () => {
    const peligrosas = ['Limpiar el horno', 'Fregar azulejos y juntas', 'Quitar las telarañas de las esquinas altas']
    for (const titulo of peligrosas) {
      const tarea = CAMPANAS.flatMap((c) => c.tareas).find((t) => t.t === titulo)
      expect(tarea, titulo).toBeTruthy()
      expect(tarea.roles, titulo).toEqual(['adulto'])
    }
  })

  it('campanaDeCatalogo encuentra por clave y devuelve null para lo inventado', () => {
    expect(campanaDeCatalogo('zona_cocina')?.tipo).toBe('zona')
    expect(campanaDeCatalogo('no_existe')).toBe(null)
  })
})

describe('la economía de la limpieza', () => {
  it('LA PROMESA: por proporción, es la mayor fuente de Talis del sistema', () => {
    // Una misión normal paga ~0,5 Talis por XP (DEFAULTS_ROL). Cualquier
    // tarea de limpieza, del esfuerzo que sea, paga MÁS Talis por XP y
    // más Talis absolutos que la misión normal de ese rol. Si este test
    // cae, el modo limpieza ha dejado de cumplir para lo que se creó.
    for (const rol of Object.keys(DEFAULTS_ROL)) {
      const normal = DEFAULTS_ROL[rol]
      for (const esf of Object.keys(ESFUERZO)) {
        const p = puntosDeTarea({ esf }, rol)
        expect(p.coins / p.xp, `${rol} ${esf}`).toBeGreaterThan(normal.coins / normal.xp)
        expect(p.coins, `${rol} ${esf}`).toBeGreaterThanOrEqual(normal.coins * 2)
      }
    }
  })

  it('la XP se queda cerca de la de una misión normal: el nivel no se compra fregando', () => {
    for (const rol of Object.keys(DEFAULTS_ROL)) {
      for (const esf of Object.keys(ESFUERZO)) {
        expect(puntosDeTarea({ esf }, rol).xp).toBeLessThanOrEqual(DEFAULTS_ROL[rol].xp * 2)
      }
    }
  })

  it('ninguna tarea del catálogo se sale de los topes de la base (xp ≤ 60, Talis ≤ 40)', () => {
    for (const c of CAMPANAS) {
      for (const t of c.tareas) {
        for (const rol of t.roles) {
          const p = puntosDeTarea(t, rol)
          expect(p.xp, `${t.t} (${rol})`).toBeLessThanOrEqual(60)
          expect(p.coins, `${t.t} (${rol})`).toBeLessThanOrEqual(40)
        }
      }
    }
  })

  it('el peor caso —la campaña entera para una sola persona— no descuadra el mes', () => {
    // La junior gana ~38 Talis/día esperados con el tablón normal. Una
    // campaña completa con botín es un pico, y tiene que quedarse en el
    // orden de una semana de juego normal, no de un mes.
    for (const c of CAMPANAS) {
      const suyas = c.tareas.filter((t) => t.roles.includes('junior'))
      const ganado = suyas.reduce((total, t) => total + puntosDeTarea(t, 'junior').coins, 0)
      const conBotin = ganado + Math.floor(ganado * BOTIN_FACTOR)
      expect(conBotin, c.clave).toBeLessThanOrEqual(300)
    }
  })

  it('los minutos salen del esfuerzo', () => {
    expect(minutosDe({ esf: 'rapida' })).toBe(8)
    expect(minutosDe({ esf: 'media' })).toBe(20)
    expect(minutosDe({ esf: 'intensa' })).toBe(35)
    expect(minutosDe({ esf: 'inventado' })).toBe(0)
  })
})

describe('quién puede lanzarla', () => {
  it('un adulto activo, y solo un adulto', () => {
    expect(puedeLanzarCampana({ quienId: 'a1', perfiles: FAMILIA, campanas: [] })).toBe(null)
    expect(puedeLanzarCampana({ quienId: 'j1', perfiles: FAMILIA, campanas: [] })).toMatch(/adulto/)
    expect(puedeLanzarCampana({ quienId: 'p1', perfiles: FAMILIA, campanas: [] })).toMatch(/adulto/)
    expect(puedeLanzarCampana({ quienId: 'nadie', perfiles: FAMILIA, campanas: [] })).toMatch(/adulto/)
  })

  it('un adulto retirado ya no lanza nada', () => {
    const perfiles = [{ ...ADULTA, active: false }, JUNIOR]
    expect(puedeLanzarCampana({ quienId: 'a1', perfiles, campanas: [] })).toMatch(/retirado/)
  })

  it('con una operación en marcha no se lanza otra', () => {
    const campanas = [{ id: 'c1', estado: 'activa' }]
    expect(puedeLanzarCampana({ quienId: 'a1', perfiles: FAMILIA, campanas })).toMatch(/en marcha/)
    const cerradas = [{ id: 'c1', estado: 'completada' }, { id: 'c2', estado: 'expirada' }]
    expect(puedeLanzarCampana({ quienId: 'a1', perfiles: FAMILIA, campanas: cerradas })).toBe(null)
  })
})

describe('el reparto', () => {
  const camp = campanaDeCatalogo('blitz_60')

  it('respeta los roles aptos y no le da nada a la mascota', () => {
    const reparto = repartoSugerido(camp.tareas, FAMILIA)
    camp.tareas.forEach((tarea, i) => {
      const quien = FAMILIA.find((p) => p.id === reparto[i])
      expect(quien, tarea.t).toBeTruthy()
      expect(tareaApta(tarea, quien), tarea.t).toBe(true)
      expect(quien.role, tarea.t).not.toBe('mascota')
    })
  })

  it('es determinista: mismo grupo, mismo reparto', () => {
    expect(repartoSugerido(camp.tareas, FAMILIA)).toEqual(repartoSugerido(camp.tareas, FAMILIA))
  })

  it('equilibra por minutos: nadie carga con todo teniendo pares', () => {
    const reparto = repartoSugerido(camp.tareas, [ADULTA, ADULTO2])
    const minutos = (id) =>
      camp.tareas.reduce((t, tarea, i) => (reparto[i] === id ? t + minutosDe(tarea) : t), 0)
    const a = minutos('a1')
    const b = minutos('a2')
    expect(Math.abs(a - b)).toBeLessThanOrEqual(35)
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(0)
  })

  it('si nadie del grupo puede con una tarea, queda sin asignar', () => {
    const soloPeque = repartoSugerido(camp.tareas, [PEQUE])
    camp.tareas.forEach((tarea, i) => {
      if (tarea.roles.includes('peque')) expect(soloPeque[i]).toBe('p1')
      else expect(soloPeque[i], tarea.t).toBe(null)
    })
  })

  it('tareasParaLanzar construye las filas con los puntos del rol de cada cual', () => {
    const reparto = repartoSugerido(camp.tareas, FAMILIA)
    const filas = tareasParaLanzar(camp, reparto, FAMILIA)
    expect(filas.length).toBe(camp.tareas.length)
    for (const fila of filas) {
      const perfil = FAMILIA.find((p) => p.id === fila.profile_id)
      const tarea = camp.tareas.find((t) => t.t === fila.title)
      expect(fila).toEqual({
        profile_id: perfil.id,
        title: tarea.t,
        emoji: tarea.e,
        ...puntosDeTarea(tarea, perfil.role)
      })
    }
  })

  it('quitar una tarea (asignación null) la deja fuera del envío', () => {
    const reparto = repartoSugerido(camp.tareas, FAMILIA)
    reparto[0] = null
    expect(tareasParaLanzar(camp, reparto, FAMILIA).length).toBe(camp.tareas.length - 1)
  })

  it('una asignación a alguien no apto no cuela: se descarta en vez de enviarse', () => {
    const reparto = camp.tareas.map(() => 'p1')
    const filas = tareasParaLanzar(camp, reparto, FAMILIA)
    const aptas = camp.tareas.filter((t) => t.roles.includes('peque')).length
    expect(filas.length).toBe(aptas)
  })

  it('resumenDeReparto suma tareas, minutos y puntos por persona', () => {
    const reparto = repartoSugerido(camp.tareas, [JUNIOR, PEQUE])
    const resumen = resumenDeReparto(camp, reparto, [JUNIOR, PEQUE, ADULTA])
    const junior = resumen.find((r) => r.perfil.id === 'j1')
    expect(junior.tareas).toBeGreaterThan(0)
    // En limpieza los Talis superan a la XP; en el tablón normal es al revés.
    expect(junior.coins).toBeGreaterThan(junior.xp)
    expect(resumen.some((r) => r.perfil.id === 'a1')).toBe(false)
  })
})

describe('leer una campaña en marcha', () => {
  const campana = { id: 'c1', estado: 'activa', termina: '2026-08-21' }
  const challenges = [
    { id: 'ch1', campana_id: 'c1', coins: 24 },
    { id: 'ch2', campana_id: 'c1', coins: 10 },
    { id: 'ch3', campana_id: 'c1', coins: 15 },
    { id: 'ch9', campana_id: null, coins: 8 }
  ]

  it('campanaActiva encuentra la activa y solo la activa', () => {
    expect(campanaActiva([{ id: 'x', estado: 'completada' }, campana])).toBe(campana)
    expect(campanaActiva([{ id: 'x', estado: 'expirada' }])).toBe(null)
    expect(campanaActiva([])).toBe(null)
  })

  it('misionesDeCampana no arrastra las misiones normales', () => {
    expect(misionesDeCampana(campana, challenges).map((c) => c.id)).toEqual(['ch1', 'ch2', 'ch3'])
  })

  it('el progreso distingue aprobadas, pendientes y sin hacer', () => {
    const completions = [
      { challenge_id: 'ch1', status: 'aprobado', coins: 24 },
      { challenge_id: 'ch2', status: 'pendiente', coins: 10 },
      { challenge_id: 'ch3', status: 'rechazado', coins: 15 }
    ]
    const p = progresoDeCampana(campana, challenges, completions)
    expect(p).toEqual({ total: 3, aprobadas: 1, pendientes: 1, completa: false })
  })

  it('completa solo cuando TODAS están aprobadas, y nunca con cero tareas', () => {
    const completions = challenges
      .filter((c) => c.campana_id === 'c1')
      .map((c) => ({ challenge_id: c.id, status: 'aprobado', coins: c.coins }))
    expect(progresoDeCampana(campana, challenges, completions).completa).toBe(true)
    expect(progresoDeCampana(campana, [], []).completa).toBe(false)
  })

  it('el botín es la mitad de lo aprobado, por persona y hacia abajo', () => {
    // La misma cuenta que hace cerrar_campana_limpieza en Postgres
    // (floor(sum/2)). Si se toca aquí, hay que tocar el SQL: son espejo.
    const completions = [
      { challenge_id: 'ch1', profile_id: 'j1', status: 'aprobado', coins: 24 },
      { challenge_id: 'ch2', profile_id: 'j1', status: 'aprobado', coins: 9 },
      { challenge_id: 'ch3', profile_id: 'p1', status: 'aprobado', coins: 15 },
      { challenge_id: 'ch9', profile_id: 'j1', status: 'aprobado', coins: 8 }
    ]
    const botin = botinPrevisto(campana, challenges, completions)
    expect(botin).toContainEqual({ profileId: 'j1', ganados: 33, botin: 16 })
    expect(botin).toContainEqual({ profileId: 'p1', ganados: 15, botin: 7 })
  })

  it('sin nada aprobado no hay botín', () => {
    expect(botinPrevisto(campana, challenges, [])).toEqual([])
  })

  it('la fecha de fin cuenta entera: vence al día SIGUIENTE de terminar', () => {
    // Y sin new Date(cadena), que clava la medianoche UTC y retrocede un
    // día según la zona: se compara por clave, como el plan diario.
    expect(campanaVencida(campana, new Date(2026, 7, 21, 23, 30))).toBe(false)
    expect(campanaVencida(campana, new Date(2026, 7, 22, 0, 30))).toBe(true)
    expect(diasRestantes(campana, new Date(2026, 7, 19))).toBe(3)
    expect(diasRestantes(campana, new Date(2026, 7, 21))).toBe(1)
    expect(diasRestantes(campana, new Date(2026, 7, 25))).toBe(0)
  })
})

describe('las reglas de la 031, comprobadas en el espejo del demo', () => {
  // El backend simulado persiste en localStorage, que en Node no existe.
  // Un doble en memoria basta: lo que se prueba es qué acepta y qué
  // rechaza, no dónde lo guarda. Mismo patrón que mascotas.test.
  beforeEach(() => {
    const memoria = new Map()
    globalThis.localStorage = {
      getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
      setItem: (k, v) => memoria.set(k, String(v)),
      removeItem: (k) => memoria.delete(k)
    }
  })

  function sembrar(demo, { estadoCampana }) {
    return (async () => {
      await demo.from('families').insert([{ id: 'f1', name: 'Prueba' }])
      await demo.from('profiles').insert([
        { id: 'a1', family_id: 'f1', name: 'Adulta', role: 'adulto', species: null },
        { id: 'j1', family_id: 'f1', name: 'Junior', role: 'junior', species: null }
      ])
      await demo.from('campanas_limpieza').insert([
        { id: 'c1', family_id: 'f1', tipo: 'blitz', clave: 'blitz_15', titulo: 'ZZ operación', empieza: '2026-08-19', termina: '2026-08-19', estado: estadoCampana }
      ])
      await demo.from('challenges').insert([
        { id: 'ch1', family_id: 'f1', profile_id: 'j1', title: 'ZZ tarea', frequency: 'unico', skill: 'hogar', xp: 15, coins: 16, campana_id: 'c1' }
      ])
      await demo.from('completions').insert([
        { id: 'co1', family_id: 'f1', challenge_id: 'ch1', profile_id: 'j1', status: 'aprobado', xp: 15, coins: 16, resolved_at: new Date().toISOString() }
      ])
    })()
  }

  it('una tarea de operación COMPLETADA no se deshace: el botín ya contó con ella', async () => {
    const demo = crearClienteDemo()
    await sembrar(demo, { estadoCampana: 'completada' })
    const { data } = await demo.rpc('undo_completion', { c_id: 'co1' })
    expect(data).toBe('campana_cerrada')
  })

  it('con la operación todavía activa, deshacer funciona como siempre', async () => {
    const demo = crearClienteDemo()
    await sembrar(demo, { estadoCampana: 'activa' })
    const { data } = await demo.rpc('undo_completion', { c_id: 'co1' })
    expect(data).toBe('ok')
  })

  it('el demo no deja lanzar con otra operación en marcha, igual que Postgres', async () => {
    const demo = crearClienteDemo()
    await sembrar(demo, { estadoCampana: 'activa' })
    const { data } = await demo.rpc('crear_campana_limpieza', {
      p_activada_por: 'a1',
      p_tipo: 'blitz',
      p_clave: 'blitz_15',
      p_titulo: 'ZZ segunda',
      p_emoji: '🧹',
      p_dias: 1,
      p_tareas: [{ profile_id: 'j1', title: 'ZZ tarea 2', emoji: '🧹', xp: 15, coins: 16 }]
    })
    expect(data).toBe('ya_hay_activa')
  })

  it('y solo un adulto lanza, también en demo', async () => {
    const demo = crearClienteDemo()
    await sembrar(demo, { estadoCampana: 'completada' })
    const { data } = await demo.rpc('crear_campana_limpieza', {
      p_activada_por: 'j1',
      p_tipo: 'blitz',
      p_clave: 'blitz_15',
      p_titulo: 'ZZ de la junior',
      p_emoji: '🧹',
      p_dias: 1,
      p_tareas: [{ profile_id: 'j1', title: 'ZZ tarea 3', emoji: '🧹', xp: 15, coins: 16 }]
    })
    expect(data).toBe('no_es_adulto')
  })
})
