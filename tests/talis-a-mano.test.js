import { describe, it, expect } from 'vitest'
import {
  manualesDe,
  pendientesDeAviso,
  leerAvisados,
  marcarAvisados,
  DIAS_DE_AVISO
} from '../src/lib/premioManual'

const AHORA = new Date('2026-08-24T10:00:00.000Z')
const haceDias = (n) => new Date(AHORA.getTime() - n * 86400000).toISOString()

const perfiles = [
  { id: 'p1', name: 'Nora', role: 'junior' },
  { id: 'p2', name: 'Marta', role: 'adulto' }
]

const bonuses = [
  { id: 'b1', profile_id: 'p1', tipo: 'manual', coins: 40, motivo: '  Por ayudar con la mudanza  ', otorgado_por: 'p2', created_at: haceDias(1) },
  { id: 'b2', profile_id: 'p1', tipo: 'manual', coins: 15, motivo: 'Por quedarse con el peque', otorgado_por: 'p2', created_at: haceDias(3) },
  { id: 'b3', profile_id: 'p1', tipo: 'globos', coins: 5, motivo: null, otorgado_por: null, created_at: haceDias(1) },
  { id: 'b4', profile_id: 'p2', tipo: 'manual', coins: 20, motivo: 'Otra persona', otorgado_por: 'p2', created_at: haceDias(1) },
  { id: 'b5', profile_id: 'p1', tipo: 'manual', coins: 10, motivo: 'De hace mucho', otorgado_por: 'pX', created_at: haceDias(90) }
]

// Un `localStorage` de mentira, para no depender del navegador.
function almacenFalso(inicial = {}) {
  const datos = { ...inicial }
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v) },
    _datos: datos
  }
}

describe('los premios a mano de una persona', () => {
  it('solo los suyos y solo los manuales', () => {
    const m = manualesDe(bonuses, 'p1', perfiles)
    expect(m.map((x) => x.id)).toEqual(['b1', 'b2', 'b5'])
  })

  it('vienen del más reciente al más viejo', () => {
    const revueltos = [bonuses[1], bonuses[4], bonuses[0]]
    expect(manualesDe(revueltos, 'p1', perfiles).map((x) => x.id)).toEqual(['b1', 'b2', 'b5'])
  })

  it('traen el nombre de quien lo concedió', () => {
    // Sin nombre el aviso dice «te han dado», que es de nadie. Con él
    // dice quién se acordó, que es la mitad del reconocimiento.
    const [primero] = manualesDe(bonuses, 'p1', perfiles)
    expect(primero.quien).toBe('Marta')
    expect(primero.motivo).toBe('Por ayudar con la mudanza')
    expect(primero.coins).toBe(40)
  })

  it('aguanta que quien lo concedió ya no esté', () => {
    const viejo = manualesDe(bonuses, 'p1', perfiles).find((m) => m.id === 'b5')
    expect(viejo.quien).toBe(null)
  })
})

describe('qué se avisa y qué se calla', () => {
  const manuales = manualesDe(bonuses, 'p1', perfiles)

  it('lo reciente y no visto se avisa', () => {
    const { avisar } = pendientesDeAviso(manuales, [], AHORA)
    expect(avisar.map((m) => m.id)).toEqual(['b1', 'b2'])
  })

  it('lo viejo se calla, pero se marca igual', () => {
    // Si no se marcara, se volvería a mirar en cada arranque para nada.
    const { avisar, callar } = pendientesDeAviso(manuales, [], AHORA)
    expect(avisar.map((m) => m.id)).not.toContain('b5')
    expect(callar.map((m) => m.id)).toEqual(['b5'])
  })

  it('lo ya avisado no vuelve', () => {
    const { avisar, callar } = pendientesDeAviso(manuales, ['b1', 'b2', 'b5'], AHORA)
    expect(avisar).toEqual([])
    expect(callar).toEqual([])
  })

  it('el borde de la ventana entra, no se cae', () => {
    const justo = [{ id: 'z', coins: 5, motivo: 'x', cuando: haceDias(DIAS_DE_AVISO - 0.01), quien: null }]
    expect(pendientesDeAviso(justo, [], AHORA).avisar).toHaveLength(1)
  })
})

describe('la marca de avisado', () => {
  it('se guarda y se lee', () => {
    const almacen = almacenFalso()
    marcarAvisados('p1', ['b1', 'b2'], almacen)
    expect(leerAvisados('p1', almacen)).toEqual(['b1', 'b2'])
  })

  it('no pisa lo que ya había ni repite', () => {
    const almacen = almacenFalso()
    marcarAvisados('p1', ['b1'], almacen)
    marcarAvisados('p1', ['b2', 'b1'], almacen)
    expect(leerAvisados('p1', almacen)).toEqual(['b2', 'b1'])
  })

  it('va por perfil: la tablet compartida no mezcla avisos', () => {
    const almacen = almacenFalso()
    marcarAvisados('p1', ['b1'], almacen)
    expect(leerAvisados('p2', almacen)).toEqual([])
  })

  it('con basura guardada no revienta, empieza de cero', () => {
    const almacen = almacenFalso({ 'gremio_manual_avisado:p1': '{no es json' })
    expect(leerAvisados('p1', almacen)).toEqual([])
  })

  it('la lista no crece sin fin', () => {
    const almacen = almacenFalso()
    for (let i = 0; i < 90; i++) marcarAvisados('p1', ['b' + i], almacen)
    expect(leerAvisados('p1', almacen).length).toBeLessThanOrEqual(60)
    // Y lo último avisado sigue estando, que es lo que evita el bucle.
    expect(leerAvisados('p1', almacen)[0]).toBe('b89')
  })
})
