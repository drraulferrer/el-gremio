import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { proyeccionDe, cumple } from '../src/lib/sellos-motor'
import { selloPorId } from '../src/lib/sellos'

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

// ------------------------------------------------------------------
// El contexto congelado (migración 029) existe para que editar una
// misión no reescriba el pasado. Estas pruebas fijan justo eso: que el
// motor lee el SNAPSHOT y no el challenge de hoy.
// ------------------------------------------------------------------

const PERFIL = { id: 'p1', xp: 0 }
const dia = (iso) => `${iso}T12:00:00.000Z`

let n = 0
const hecha = (fecha, extra = {}) => ({
  id: `c${++n}`,
  profile_id: PERFIL.id,
  challenge_id: 'r1',
  status: 'aprobado',
  xp: 25,
  requested_at: dia(fecha),
  resolved_at: dia(fecha),
  ...extra
})

describe('el motor lee el contexto congelado', () => {
  it('editar la habilidad de una misión NO reescribe el pasado', () => {
    // El fallo que cierra: «Hacer la cama» pasa de Hogar a
    // Responsabilidad y, sin snapshot, las cuarenta veces que se hizo el
    // año pasado dejaban de haber entrenado Hogar. La Maestría seguía en
    // el perfil, sin nada detrás.
    const completions = ['2026-01-05', '2026-01-06', '2026-01-13'].map((f) =>
      hecha(f, { snapshot_skill: 'hogar', snapshot_mission_family_id: 'mf-1' })
    ).concat(
      ['2026-01-07'].map((f) =>
        hecha(f, { snapshot_skill: 'hogar', snapshot_mission_family_id: 'mf-2' }))
    )

    // El challenge dice HOY que es de responsabilidad.
    const challenges = [{ id: 'r1', skill: 'responsabilidad', frequency: 'diario' }]
    const p = proyeccionDe(PERFIL, { completions, challenges, completa: true })

    expect(p.habilidades.hogar).toBeTruthy()
    expect(p.habilidades.responsabilidad).toBeUndefined()
    expect(cumple(p, selloPorId('oficio_hogar_1').regla)).toBe(true)
  })

  it('la familia del snapshot manda sobre el challenge_id', () => {
    // Dos challenges distintos que comparten familia NO son variedad.
    const completions = [
      hecha('2026-01-05', { challenge_id: 'r1', snapshot_skill: 'hogar', snapshot_mission_family_id: 'mf-1' }),
      hecha('2026-01-06', { challenge_id: 'r2', snapshot_skill: 'hogar', snapshot_mission_family_id: 'mf-1' }),
      hecha('2026-01-13', { challenge_id: 'r3', snapshot_skill: 'hogar', snapshot_mission_family_id: 'mf-1' })
    ]
    const p = proyeccionDe(PERFIL, { completions, challenges: [], completa: true })
    expect(p.habilidades.hogar.familias).toBe(1)
    // Sin dos familias no hay Oficialía, aunque haya XP, días y semanas.
    expect(cumple(p, selloPorId('oficio_hogar_1').regla)).toBe(false)
  })

  it('sin snapshot cae al challenge actual, que es lo que había antes', () => {
    // La ventana entre desplegar y ejecutar la migración es real: la
    // corre una persona a mano. Durante ese rato el motor sigue.
    const completions = [hecha('2026-01-05')]
    const challenges = [{ id: 'r1', skill: 'salud', frequency: 'diario', mission_family_id: 'mf-9' }]
    const p = proyeccionDe(PERFIL, { completions, challenges, completa: true })
    expect(p.habilidades.salud).toBeTruthy()
    expect(p.habilidades.salud.familias).toBe(1)
  })

  it('la XP del snapshot manda: abaratar una misión no rebaja el pasado', () => {
    const completions = [hecha('2026-01-05', { xp: 5, snapshot_xp: 40, snapshot_skill: 'hogar' })]
    const p = proyeccionDe(PERFIL, { completions, challenges: [], completa: true })
    expect(p.habilidades.hogar.xp).toBe(40)
  })
})

describe('las migraciones dicen lo que el esquema dice', () => {
  // La regla de la casa: cada cambio se escribe dos veces, en
  // `schema.sql` y en su migración. Si se escribe en una sola, la base
  // nueva y la que ya existe dejan de parecerse y el fallo aparece meses
  // después, en la única base que importa.
  const schema = leer('schema.sql')
  const m028 = leer('migracion-028-familias-de-mision.sql')
  const m029 = leer('migracion-029-snapshot-historico.sql')
  const m030 = leer('migracion-030-sellos-por-temporada.sql')

  it('la tabla de familias de misión está en los dos sitios', () => {
    expect(schema).toMatch(/create table if not exists public\.mission_families/)
    expect(m028).toMatch(/create table if not exists public\.mission_families/)
  })

  it('las columnas del snapshot están en los dos sitios', () => {
    for (const col of ['snapshot_title', 'snapshot_skill', 'snapshot_frequency',
      'snapshot_mission_family_id', 'snapshot_xp', 'snapshot_coins',
      'snapshot_quality', 'assistance_level']) {
      expect(schema, `${col} falta en schema.sql`).toContain(col)
      expect(m029, `${col} falta en la migración`).toContain(col)
    }
  })

  it('borrar una misión ya no se lleva su historial', () => {
    // `cascade` aquí significaba que el botón de borrar destruía la
    // prueba de las insignias ya concedidas.
    expect(schema).toMatch(/challenge_id uuid not null references public\.challenges\(id\) on delete restrict/)
    expect(m029).toMatch(/on delete restrict/)
  })

  it('la unicidad de insignias admite instancias por temporada', () => {
    expect(schema).toMatch(/unique \(profile_id, code, instance_key\)/)
    expect(m030).toMatch(/unique \(profile_id, code, instance_key\)/)
    // Y la de las tres únicas por gremio NO se toca.
    expect(schema).toMatch(/idx_badges_unica_por_gremio/)
  })

  it('instance_key es cadena vacía y no NULL', () => {
    // Con NULL, `unique` deja pasar duplicados —NULL no es igual a
    // NULL— y la restricción no protegería el caso de siempre.
    expect(schema).toMatch(/instance_key text not null default ''/)
    expect(m030).toMatch(/instance_key text not null default ''/)
  })

  it('todas son idempotentes: se pueden ejecutar dos veces', () => {
    for (const [nombre, sql] of [['028', m028], ['029', m029], ['030', m030]]) {
      const creaTablas = sql.match(/create table (?!if not exists)/g)
      expect(creaTablas, `${nombre} crea una tabla sin guarda`).toBeNull()
      const creaIndices = sql.match(/create (unique )?index (?!if not exists)/g)
      expect(creaIndices, `${nombre} crea un índice sin guarda`).toBeNull()
      const columnas = sql.match(/add column (?!if not exists)/g)
      expect(columnas, `${nombre} añade una columna sin guarda`).toBeNull()
    }
  })

  it('el trigger del snapshot solo dispara al INSERTAR', () => {
    // Si disparara al validar, una misión pedida el lunes y aprobada el
    // jueves guardaría la habilidad del jueves.
    expect(m029).toMatch(/create trigger tg_completion_snapshot\s+before insert on public\.completions/)
  })

  it('el nivel de ayuda no se acepta si la misión no lo registra', () => {
    // Si no, un cliente podría marcar «independiente» en cualquier cosa
    // y abrir los sellos de Autonomía sin que nadie lo haya observado.
    expect(m029).toMatch(/track_assistance/)
    expect(schema).toMatch(/track_assistance/)
  })
})

describe('la demo congela el contexto igual que Postgres', () => {
  beforeEach(() => {
    const memoria = new Map()
    globalThis.localStorage = {
      getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
      setItem: (k, v) => memoria.set(k, String(v)),
      removeItem: (k) => memoria.delete(k)
    }
  })

  it('rellena los snapshot_* al insertar una completación', async () => {
    const { crearClienteDemo, reiniciarDemo } = await import('../src/lib/fakeBackend')
    reiniciarDemo()
    const cliente = crearClienteDemo()

    await cliente.from('challenges').insert({
      id: 'r1', family_id: 'fam', title: 'Hacer la cama', skill: 'hogar', frequency: 'diario', xp: 10, coins: 5
    })
    await cliente.from('completions').insert({
      family_id: 'fam', challenge_id: 'r1', profile_id: 'p1', xp: 10, coins: 5
    })

    const { data } = await cliente.from('completions').select('*').eq('family_id', 'fam')
    expect(data[0].snapshot_skill).toBe('hogar')
    expect(data[0].snapshot_frequency).toBe('diario')
    expect(data[0].snapshot_quality).toBe('native')
    expect(data[0].snapshot_mission_family_id).toBe('mf:r1')
    reiniciarDemo()
  })

  it('descarta el nivel de ayuda si la misión no lo registra', async () => {
    const { crearClienteDemo, reiniciarDemo } = await import('../src/lib/fakeBackend')
    reiniciarDemo()
    const cliente = crearClienteDemo()

    await cliente.from('challenges').insert({
      id: 'r2', family_id: 'fam', title: 'Leer', skill: 'aprendizaje', frequency: 'diario', xp: 10, coins: 5
    })
    await cliente.from('completions').insert({
      family_id: 'fam', challenge_id: 'r2', profile_id: 'p1', xp: 10, coins: 5,
      assistance_level: 'independent'
    })

    const { data } = await cliente.from('completions').select('*').eq('family_id', 'fam')
    expect(data[0].assistance_level).toBeNull()
    reiniciarDemo()
  })
})

describe('borrar una misión con historia', () => {
  // El botón decía «¿Borrar … y su historial?» y hacía eso. Con la clave
  // en `restrict` ya no puede, y la app tiene que ofrecer lo que quien
  // pulsa quería de verdad: que deje de salir.
  // El cliente entra INYECTADO, nunca parcheando el export real: sin
  // credenciales (el caso de CI) ese export es null, y `null.from = …`
  // hacía que estos cuatro tests pasaran en local y reventaran en CI.
  it('sin historia, se borra y ya está', async () => {
    const { borrarORetirar } = await import('../src/lib/retirarMision')
    const cliente = { from: () => ({ delete: () => ({ eq: async () => ({ error: null }) }) }) }
    const r = await borrarORetirar({ id: 'r1', title: 'Recién creada' }, { confirmar: () => true, cliente })
    expect(r.resultado).toBe('borrada')
  })

  it('con historia, se ofrece retirarla y se retira', async () => {
    const { borrarORetirar } = await import('../src/lib/retirarMision')
    let actualizado = null
    const cliente = {
      from: () => ({
        delete: () => ({ eq: async () => ({ error: { code: '23503' } }) }),
        update: (cambio) => { actualizado = cambio; return { eq: async () => ({ error: null }) } }
      })
    }
    const preguntas = []
    const r = await borrarORetirar({ id: 'r1', title: 'Hacer la cama' }, {
      confirmar: (texto) => { preguntas.push(texto); return true },
      cliente
    })
    expect(r.resultado).toBe('retirada')
    expect(actualizado).toEqual({ active: false })
    expect(preguntas[1]).toMatch(/se conserva/)
  })

  it('si dice que no al retirar, no se toca nada', async () => {
    const { borrarORetirar } = await import('../src/lib/retirarMision')
    let toco = false
    const cliente = {
      from: () => ({
        delete: () => ({ eq: async () => ({ error: { code: '23503' } }) }),
        update: () => { toco = true; return { eq: async () => ({ error: null }) } }
      })
    }
    const r = await borrarORetirar({ id: 'r1', title: 'X' }, {
      confirmar: (t) => !/se conserva/.test(t),
      cliente
    })
    expect(r.resultado).toBe('cancelado')
    expect(toco).toBe(false)
  })

  it('un error que NO es de clave ajena se propaga tal cual', async () => {
    const { borrarORetirar } = await import('../src/lib/retirarMision')
    const cliente = {
      from: () => ({ delete: () => ({ eq: async () => ({ error: { code: '42501', message: 'sin permiso' } }) }) })
    }
    const r = await borrarORetirar({ id: 'r1', title: 'X' }, { confirmar: () => true, cliente })
    expect(r.resultado).toBeNull()
    expect(r.error.code).toBe('42501')
  })
})
