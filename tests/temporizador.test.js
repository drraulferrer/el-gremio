import { describe, it, expect } from 'vitest'
import {
  CADUCIDAD_MS,
  iniciarTarea,
  inicioDe,
  olvidarTarea,
  restanteDe,
  textoDeRestante
} from '../src/lib/temporizador'
import { ESFUERZO, esfuerzoDeMision, esDeOperacion } from '../src/lib/limpieza'

const AHORA = new Date(2026, 7, 19, 17, 0, 0).getTime()
const MIN = 60000

// Un almacén de mentira, como en latido.test: los tests no deben
// depender de que exista localStorage ni dejar basura en el de nadie.
function almacenFalso(inicial = {}) {
  const datos = { ...inicial }
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v) }
  }
}

describe('la cuenta del reloj', () => {
  it('descuenta desde el inicio guardado, no desde un contador', () => {
    expect(restanteDe(AHORA, 25, AHORA)).toEqual({ ms: 25 * MIN, agotado: false })
    expect(restanteDe(AHORA, 25, AHORA + 10 * MIN)).toEqual({ ms: 15 * MIN, agotado: false })
  })

  it('al agotarse se queda en cero: no castiga ni se pone negativo', () => {
    expect(restanteDe(AHORA, 10, AHORA + 10 * MIN)).toEqual({ ms: 0, agotado: true })
    expect(restanteDe(AHORA, 10, AHORA + 3 * 60 * MIN)).toEqual({ ms: 0, agotado: true })
  })

  it('se pinta como m:ss, redondeando el segundo hacia arriba', () => {
    expect(textoDeRestante(25 * MIN)).toBe('25:00')
    expect(textoDeRestante(9 * MIN + 5000)).toBe('9:05')
    // 4,2 s restantes se leen como 5: un reloj que enseña 0:04 cuando
    // aún quedan más de cuatro segundos parece que se salta uno.
    expect(textoDeRestante(4200)).toBe('0:05')
    expect(textoDeRestante(0)).toBe('0:00')
  })
})

describe('guardar y recuperar el reloj', () => {
  it('lo que se arranca se recupera, por persona y misión', () => {
    const almacen = almacenFalso()
    iniciarTarea('p1', 'ch1', AHORA, almacen)
    expect(inicioDe('p1', 'ch1', AHORA + MIN, almacen)).toBe(AHORA)
    // Ni otra misión ni otra persona heredan el reloj.
    expect(inicioDe('p1', 'ch2', AHORA + MIN, almacen)).toBe(null)
    expect(inicioDe('p2', 'ch1', AHORA + MIN, almacen)).toBe(null)
  })

  it('olvidar retira el reloj, que es lo que pasa al marcar la tarea', () => {
    const almacen = almacenFalso()
    iniciarTarea('p1', 'ch1', AHORA, almacen)
    olvidarTarea('p1', 'ch1', AHORA, almacen)
    expect(inicioDe('p1', 'ch1', AHORA, almacen)).toBe(null)
  })

  it('un reloj de ayer ya no existe: era de una campaña que pasó', () => {
    const almacen = almacenFalso()
    iniciarTarea('p1', 'ch1', AHORA - CADUCIDAD_MS - MIN, almacen)
    expect(inicioDe('p1', 'ch1', AHORA, almacen)).toBe(null)
    // Y arrancar otro purga los caducados del almacén.
    iniciarTarea('p1', 'ch2', AHORA, almacen)
    expect(JSON.parse(almacen.getItem('gremio_relojes'))).toEqual({ 'p1:ch2': AHORA })
  })

  it('un almacén con basura no revienta: se lee como vacío', () => {
    const almacen = almacenFalso({ gremio_relojes: '{{{' })
    expect(inicioDe('p1', 'ch1', AHORA, almacen)).toBe(null)
  })
})

describe('el esfuerzo de una misión ya guardada', () => {
  it('se recupera por título desde el catálogo', () => {
    expect(esfuerzoDeMision({ title: 'Limpiar el horno' })).toBe(ESFUERZO.intensa)
    expect(esfuerzoDeMision({ title: 'Reponer el papel higiénico' })).toBe(ESFUERZO.rapida)
  })

  it('un título editado a mano cae a «media»: mejor reloj aproximado que sin reloj', () => {
    expect(esfuerzoDeMision({ title: 'Algo que escribió un adulto' })).toBe(ESFUERZO.media)
    expect(esfuerzoDeMision({})).toBe(ESFUERZO.media)
  })

  it('cada esfuerzo tiene su reloj, y el reloj es el techo de la horquilla', () => {
    expect(ESFUERZO.rapida.temporizador).toBe(10)
    expect(ESFUERZO.media.temporizador).toBe(25)
    expect(ESFUERZO.intensa.temporizador).toBe(40)
  })

  it('esDeOperacion distingue las misiones de campaña', () => {
    expect(esDeOperacion({ campana_id: 'c1' })).toBe(true)
    expect(esDeOperacion({ campana_id: null })).toBe(false)
    expect(esDeOperacion(null)).toBe(false)
  })
})
