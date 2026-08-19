import { describe, it, expect } from 'vitest'
import { historialAprobado } from '../src/lib/sellos-carga'

// ------------------------------------------------------------------
// La paginación importa más de lo que parece: `completa` decide si el
// motor se atreve a conceder las reglas que miran huecos. Si el cargador
// se equivoca y dice «lo tengo todo» teniendo media vida, el motor
// reparte «has vuelto al taller» a quien nunca se fue.
//
// Se prueba contra un doble, no contra Supabase: lo que hay que fijar es
// el CONTRATO —cuántas páginas pide, con qué rangos y cuándo para—, y eso
// no necesita una base de datos.
// ------------------------------------------------------------------

/** Un supabase de mentira que sirve `total` filas paginando de verdad. */
function supabaseCon(total, { fallaEnPagina = null } = {}) {
  const peticiones = []
  const filas = Array.from({ length: total }, (_, i) => ({
    profile_id: 'p1', challenge_id: 'r1', status: 'aprobado', xp: 10,
    requested_at: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}.000Z`,
    resolved_at: '2026-01-01T00:00:00.000Z'
  }))

  const consulta = {
    select: () => consulta,
    eq: () => consulta,
    order: () => consulta,
    range: (desde, hasta) => {
      peticiones.push([desde, hasta])
      if (fallaEnPagina !== null && peticiones.length === fallaEnPagina) {
        return Promise.resolve({ data: null, error: { message: 'se cayó la red' } })
      }
      return Promise.resolve({ data: filas.slice(desde, hasta + 1), error: null })
    }
  }
  return { cliente: { from: () => consulta }, peticiones }
}

describe('traer el historial entero', () => {
  it('con menos de una página, una sola petición y completa', async () => {
    const { cliente, peticiones } = supabaseCon(60)
    const r = await historialAprobado(cliente, 'fam')
    expect(r.filas).toHaveLength(60)
    expect(r.completa).toBe(true)
    expect(peticiones).toEqual([[0, 999]])
  })

  it('pide páginas hasta que una viene incompleta', async () => {
    const { cliente, peticiones } = supabaseCon(2500)
    const r = await historialAprobado(cliente, 'fam')
    expect(r.filas).toHaveLength(2500)
    expect(r.completa).toBe(true)
    expect(peticiones).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('los rangos no se solapan ni dejan huecos', async () => {
    // Una fila contada dos veces infla los días activos; una que se cae
    // los desinfla. Las dos rompen el motor en silencio.
    const { cliente } = supabaseCon(2500)
    const r = await historialAprobado(cliente, 'fam')
    const marcas = r.filas.map((f) => f.requested_at + '|' + r.filas.indexOf(f))
    expect(new Set(r.filas).size).toBe(2500)
    expect(marcas).toHaveLength(2500)
  })

  it('un total múltiplo exacto de la página pide una más y para', async () => {
    // El borde clásico: con 2000 filas la segunda página viene llena y no
    // se puede saber si hay más sin preguntar.
    const { cliente, peticiones } = supabaseCon(2000)
    const r = await historialAprobado(cliente, 'fam')
    expect(r.filas).toHaveLength(2000)
    expect(r.completa).toBe(true)
    expect(peticiones).toHaveLength(3)
  })

  it('si una página falla, devuelve lo leído y NO se dice completa', async () => {
    const { cliente } = supabaseCon(2500, { fallaEnPagina: 2 })
    const r = await historialAprobado(cliente, 'fam')
    expect(r.completa).toBe(false)
    expect(r.error).toBeTruthy()
    expect(r.filas).toHaveLength(1000)
  })

  it('sin nada que traer, completa y vacío', async () => {
    const { cliente } = supabaseCon(0)
    const r = await historialAprobado(cliente, 'fam')
    expect(r.filas).toEqual([])
    expect(r.completa).toBe(true)
  })
})

describe('el backend simulado pagina igual que el de verdad', () => {
  // La demo tiene que dar el MISMO resultado, o se prueba una cosa y se
  // publica otra. `range` estaba sin implementar: devolvía el historial
  // entero en la primera página y el cargador acertaba por casualidad.
  it('range incluye los dos extremos, como PostgREST', async () => {
    // El backend simulado persiste en localStorage, que en Node no
    // existe. Un doble en memoria basta: lo que se prueba es qué tramo
    // devuelve, no dónde lo guarda.
    const memoria = new Map()
    globalThis.localStorage = {
      getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
      setItem: (k, v) => memoria.set(k, String(v)),
      removeItem: (k) => memoria.delete(k)
    }

    const { crearClienteDemo, reiniciarDemo } = await import('../src/lib/fakeBackend')
    reiniciarDemo()
    const cliente = crearClienteDemo()

    const filas = Array.from({ length: 25 }, (_, i) => ({
      family_id: 'fam', profile_id: 'p1', challenge_id: 'r1',
      status: 'aprobado', xp: 10,
      requested_at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`
    }))
    await cliente.from('completions').insert(filas)

    const { data } = await cliente.from('completions').select('*')
      .eq('family_id', 'fam').order('requested_at', { ascending: true }).range(0, 9)
    expect(data).toHaveLength(10)

    const { data: resto } = await cliente.from('completions').select('*')
      .eq('family_id', 'fam').order('requested_at', { ascending: true }).range(10, 19)
    expect(resto).toHaveLength(10)

    const { data: cola } = await cliente.from('completions').select('*')
      .eq('family_id', 'fam').order('requested_at', { ascending: true }).range(20, 29)
    expect(cola).toHaveLength(5)

    reiniciarDemo()
  })
})

describe('completar el historial sin volver a paginarlo', () => {
  const fila = (id, status = 'aprobado') => ({
    id, profile_id: 'p1', challenge_id: 'r1', status, xp: 10,
    requested_at: '2026-02-01T10:00:00.000Z',
    resolved_at: status === 'aprobado' ? '2026-02-01T10:00:00.000Z' : null
  })

  it('pega solo lo que falta, sin duplicar lo que ya estaba', async () => {
    // Las dos fuentes se solapan a propósito: la última página y el lote
    // reciente comparten los últimos días. Contar dos veces una misión
    // infla el volumen y podría abrir un escalón que no toca.
    const { conNuevas } = await import('../src/lib/sellos-carga')
    const base = { filas: [fila('a'), fila('b')], completa: true }
    const r = conNuevas(base, [fila('b'), fila('c')])
    expect(r.filas.map((f) => f.id)).toEqual(['a', 'b', 'c'])
  })

  it('lo pendiente o rechazado no entra', async () => {
    const { conNuevas } = await import('../src/lib/sellos-carga')
    const base = { filas: [fila('a')], completa: true }
    const r = conNuevas(base, [fila('b', 'pendiente'), fila('c', 'rechazado')])
    expect(r.filas.map((f) => f.id)).toEqual(['a'])
  })

  it('sin nada nuevo devuelve el MISMO objeto, para no recalcular de balde', async () => {
    const { conNuevas } = await import('../src/lib/sellos-carga')
    const base = { filas: [fila('a')], completa: true }
    expect(conNuevas(base, [fila('a')])).toBe(base)
  })

  it('conserva `completa`: pegar lo nuevo no arregla un historial a medias', async () => {
    const { conNuevas } = await import('../src/lib/sellos-carga')
    const aMedias = { filas: [fila('a')], completa: false }
    expect(conNuevas(aMedias, [fila('b')]).completa).toBe(false)
  })
})
