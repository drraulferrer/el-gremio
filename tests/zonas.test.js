import { describe, it, expect } from 'vitest'
import {
  PLANTILLAS_ZONA,
  IDS_PLANTILLA,
  plantillaDe,
  nombreDeZonaValido,
  ZONAS_POR_DEFECTO,
  zonasDeLaCasa,
  EXTRAS_VIVIENDA,
  VIVIENDA_POR_DEFECTO,
  zonasDesdeVivienda,
  nuevaZona,
  campanaDeZona
} from '../src/lib/zonas'
import { ESFUERZO, puntosDeTarea, tareaApta } from '../src/lib/limpieza'
import { DEFAULTS_ROL } from '../src/lib/tareas'
import { marcasDe } from '../src/lib/genero'

describe('las plantillas', () => {
  it('cada plantilla está bien formada, en la pasada semanal y en la de fondo', () => {
    for (const id of IDS_PLANTILLA) {
      const p = PLANTILLAS_ZONA[id]
      expect(p.id, id).toBe(id)
      expect(p.nombre.length, id).toBeGreaterThan(1)
      for (const lista of [p.semanal, p.fondo]) {
        expect(lista.length, id).toBeGreaterThanOrEqual(4)
        expect(lista.length, id).toBeLessThanOrEqual(15)
        for (const t of lista) {
          expect(t.t.length, t.t).toBeLessThanOrEqual(120)
          expect(ESFUERZO[t.esf], `${id}: ${t.t}`).toBeTruthy()
          expect(t.roles.length, t.t).toBeGreaterThan(0)
          for (const rol of t.roles) {
            expect(['peque', 'junior', 'adulto'], `${t.t}: ${rol}`).toContain(rol)
          }
          expect(marcasDe(t.t), t.t).toEqual([])
        }
      }
    }
  })

  it('ninguna tarea de plantilla se sale de los topes de la base (xp ≤ 60, Talis ≤ 40)', () => {
    for (const p of Object.values(PLANTILLAS_ZONA)) {
      for (const t of [...p.semanal, ...p.fondo]) {
        for (const rol of Object.keys(DEFAULTS_ROL)) {
          const puntos = puntosDeTarea(t, rol)
          expect(puntos.xp, t.t).toBeLessThanOrEqual(60)
          expect(puntos.coins, t.t).toBeLessThanOrEqual(40)
        }
      }
    }
  })

  it('lo peligroso —químicos, horno, altura— es solo de personas adultas', () => {
    const peligrosas = ['Limpiar el horno', 'Fregar azulejos y juntas', 'Quitar las telarañas de las esquinas altas']
    const todas = Object.values(PLANTILLAS_ZONA).flatMap((p) => [...p.semanal, ...p.fondo])
    for (const titulo of peligrosas) {
      const tarea = todas.find((t) => t.t === titulo)
      expect(tarea, titulo).toBeTruthy()
      expect(tarea.roles, titulo).toEqual(['adulto'])
      // Y la jerarquía no lo abre hacia abajo: la junior sigue sin poder.
      expect(tareaApta(tarea, { role: 'junior' }), titulo).toBe(false)
    }
  })

  it('plantillaDe cae a la genérica cuando la zona trae una desconocida', () => {
    expect(plantillaDe({ plantilla: 'cocina' })).toBe(PLANTILLAS_ZONA.cocina)
    expect(plantillaDe({ plantilla: 'sotano' })).toBe(PLANTILLAS_ZONA.generica)
    expect(plantillaDe(null)).toBe(PLANTILLAS_ZONA.generica)
  })
})

describe('las zonas por defecto', () => {
  it('sin zonas guardadas, la casa es la de siempre: nadie pierde nada', () => {
    expect(zonasDeLaCasa({ zonas: [] })).toBe(ZONAS_POR_DEFECTO)
    expect(zonasDeLaCasa({})).toBe(ZONAS_POR_DEFECTO)
    expect(ZONAS_POR_DEFECTO.length).toBeGreaterThanOrEqual(5)
    for (const z of ZONAS_POR_DEFECTO) {
      expect(IDS_PLANTILLA, z.nombre).toContain(z.plantilla)
      expect(z.virtual, z.nombre).toBe(true)
    }
  })

  it('con zonas guardadas se usan esas, ordenadas por orden y nombre', () => {
    const guardadas = [
      { id: 'b', nombre: 'Buhardilla', orden: 2 },
      { id: 'a', nombre: 'Cocina', orden: 1 }
    ]
    expect(zonasDeLaCasa({ zonas: guardadas }).map((z) => z.nombre)).toEqual(['Cocina', 'Buhardilla'])
  })
})

describe('la pregunta de la vivienda', () => {
  it('un piso normal dibuja lo básico: cocina, salón, entrada, baño y dormitorios', () => {
    const zonas = zonasDesdeVivienda(VIVIENDA_POR_DEFECTO, { tipoGremio: 'familia' })
    expect(zonas.map((z) => z.nombre)).toEqual([
      'Cocina', 'Salón', 'Entrada y comedor', 'Baño', 'Dormitorio principal', 'Dormitorio 2'
    ])
    expect(zonas.every((z) => z.tipo === 'comun')).toBe(true)
  })

  it('LA DECISIÓN DE LAS PLANTAS: no son un dato, son un nombre', () => {
    // Chalet con dos baños y dos plantas → «de arriba» y «de abajo».
    const chalet = zonasDesdeVivienda(
      { banos: 2, dormitorios: 3, masDeUnaPlanta: true, extras: [] },
      { tipoGremio: 'familia' }
    )
    const banos = chalet.filter((z) => z.plantilla === 'bano').map((z) => z.nombre)
    expect(banos).toEqual(['Baño de arriba', 'Baño de abajo'])
    // Con tres baños la planta ya no basta para nombrar: se numeran.
    const tresBanos = zonasDesdeVivienda(
      { banos: 3, dormitorios: 2, masDeUnaPlanta: true, extras: [] },
      { tipoGremio: 'familia' }
    )
    expect(tresBanos.filter((z) => z.plantilla === 'bano').map((z) => z.nombre))
      .toEqual(['Baño', 'Baño 2', 'Baño 3'])
    // Y en una sola planta, dos baños se numeran sin inventar pisos.
    const unaPlanta = zonasDesdeVivienda(
      { banos: 2, dormitorios: 2, masDeUnaPlanta: false, extras: [] },
      { tipoGremio: 'familia' }
    )
    expect(unaPlanta.filter((z) => z.plantilla === 'bano').map((z) => z.nombre))
      .toEqual(['Baño', 'Baño 2'])
  })

  it('en modo piso cada conviviente recibe SU habitación, con el dueño como índice', () => {
    const miembros = [{ name: 'Ana' }, { name: '' }, { name: 'Bo' }]
    const zonas = zonasDesdeVivienda(
      { banos: 1, dormitorios: 4, masDeUnaPlanta: false, extras: [] },
      { tipoGremio: 'piso', miembros }
    )
    const privadas = zonas.filter((z) => z.tipo === 'privada')
    expect(privadas.map((z) => z.nombre)).toEqual(['Habitación de Ana', 'Habitación de Bo'])
    // El índice es sobre la lista COMPLETA de miembros, saltando los
    // vacíos… no: es el índice original, que es como se casa después con
    // los perfiles insertados. La fila vacía no genera habitación.
    expect(privadas.map((z) => z.dueno)).toEqual([0, 2])
    // Y los dormitorios «contados» no salen: en un piso no se pregunta.
    expect(zonas.filter((z) => z.plantilla === 'dormitorio' && z.tipo === 'comun')).toEqual([])
  })

  it('los extras existen solo si se marcan', () => {
    const sin = zonasDesdeVivienda(VIVIENDA_POR_DEFECTO, { tipoGremio: 'familia' })
    expect(sin.some((z) => z.plantilla === 'lavadero')).toBe(false)
    const con = zonasDesdeVivienda(
      { ...VIVIENDA_POR_DEFECTO, extras: ['lavadero', 'exterior'] },
      { tipoGremio: 'familia' }
    )
    expect(con.some((z) => z.nombre === 'Lavadero')).toBe(true)
    expect(con.some((z) => z.nombre === 'Terraza o jardín')).toBe(true)
    for (const extra of EXTRAS_VIVIENDA) {
      expect(IDS_PLANTILLA, extra.id).toContain(extra.plantilla)
    }
  })

  it('el orden queda numerado para que la lista no baile entre cargas', () => {
    const zonas = zonasDesdeVivienda(VIVIENDA_POR_DEFECTO, { tipoGremio: 'familia' })
    expect(zonas.map((z) => z.orden)).toEqual(zonas.map((_, i) => i))
  })

  it('la zona nueva nace en blanco y el nombre tiene el mismo límite que la base', () => {
    expect(nuevaZona()).toEqual({ nombre: '', emoji: '🚪', plantilla: 'generica', tipo: 'comun', dueno: null })
    expect(nombreDeZonaValido('Buhardilla')).toBe(true)
    expect(nombreDeZonaValido(' x ')).toBe(false)
    expect(nombreDeZonaValido('')).toBe(false)
    expect(nombreDeZonaValido('z'.repeat(61))).toBe(false)
  })
})

describe('de una zona a una campaña', () => {
  const zona = { id: 'z1', nombre: 'Baño de arriba', emoji: '🛁', plantilla: 'bano', tipo: 'comun', dueno: null }

  it('la pasada semanal dura 7 días y se llama como la zona', () => {
    const c = campanaDeZona(zona, 'semanal')
    expect(c.tipo).toBe('zona')
    expect(c.dias).toBe(7)
    expect(c.titulo).toBe('Zona de la semana · Baño de arriba')
    expect(c.clave).toBe('zona:z1')
    expect(c.tareas).toEqual(PLANTILLAS_ZONA.bano.semanal)
  })

  it('la limpieza a fondo dura 3 días y trae la lista profunda', () => {
    const c = campanaDeZona(zona, 'fondo')
    expect(c.tipo).toBe('profunda')
    expect(c.dias).toBe(3)
    expect(c.titulo).toBe('Baño de arriba a fondo')
    expect(c.tareas).toEqual(PLANTILLAS_ZONA.bano.fondo)
  })

  it('las tareas son COPIAS: editar la campaña no toca la plantilla', () => {
    const c = campanaDeZona(zona, 'semanal')
    c.tareas[0].t = 'Otra cosa'
    c.tareas[0].roles.push('peque')
    expect(PLANTILLAS_ZONA.bano.semanal[0].t).not.toBe('Otra cosa')
    expect(PLANTILLAS_ZONA.bano.semanal[0].roles).not.toContain('peque')
  })

  it('una zona rara limpia con la plantilla genérica', () => {
    const c = campanaDeZona({ id: 'z9', nombre: 'Buhardilla', plantilla: 'generica' }, 'fondo')
    expect(c.tareas).toEqual(PLANTILLAS_ZONA.generica.fondo)
    expect(c.emoji).toBe(PLANTILLAS_ZONA.generica.emoji)
  })
})

describe('la jerarquía de roles aptos', () => {
  it('una tarea «de peque» la puede hacer cualquiera con más años', () => {
    const tarea = { roles: ['peque'] }
    expect(tareaApta(tarea, { role: 'peque' })).toBe(true)
    expect(tareaApta(tarea, { role: 'junior' })).toBe(true)
    expect(tareaApta(tarea, { role: 'adulto' })).toBe(true)
  })

  it('lo de adultos sigue siendo solo de adultos, y la mascota nunca limpia', () => {
    expect(tareaApta({ roles: ['adulto'] }, { role: 'junior' })).toBe(false)
    expect(tareaApta({ roles: ['junior', 'adulto'] }, { role: 'peque' })).toBe(false)
    expect(tareaApta({ roles: ['peque'] }, { role: 'mascota' })).toBe(false)
  })
})
