import { describe, it, expect } from 'vitest'
import { CATALOGO, tareasDeRol, accionDeMision } from '../src/lib/tareas'
import { flex } from '../src/lib/genero'
import { CATALOGO_PREMIOS } from '../src/lib/premios'

// ------------------------------------------------------------------
// Este fichero fija el catálogo contra la lista que escribió la familia.
// La comparación se hace sobre la forma FEMENINA, porque así es como la
// escribieron ("Vestirse sola"): si un título deja de decir lo mismo al
// flexionarlo, salta aquí.
// No comprueba lógica: comprueba que nadie (yo el primero) "mejora" los
// títulos por su cuenta. Si algún día se quiere cambiar un nombre, se
// cambia aquí también, a propósito y a la vista.
// ------------------------------------------------------------------

const FUENTE = {
  peque: {
    Autocuidado: ['Vestirse sola', 'Elegir la ropa', 'Ponerse los zapatos', 'Lavarse las manos',
      'Cepillarse los dientes con ayuda', 'Peinarse', 'Llevar la ropa sucia'],
    'Organización': ['Recoger juguetes', 'Guardar cuentos', 'Hacer «la búsqueda» de objetos fuera de sitio',
      'Preparar la mochila', 'Guardar zapatos'],
    'Ayudante de casa': ['Poner servilletas', 'Llevar cubiertos', 'Llevar fruta', 'Regar plantas',
      'Dar comida a la mascota', 'Emparejar calcetines', 'Llevar pinzas'],
    Desarrollo: ['Leer un cuento', 'Dibujar', 'Hacer un puzle', 'Practicar números', 'Practicar letras',
      'Juego libre sin pantallas'],
    Movimiento: ['Bailar', 'Circuito motor', 'Saltar', 'Caminar', 'Yoga infantil'],
    Social: ['Dar las gracias', 'Pedir las cosas correctamente', 'Esperar turno', 'Compartir', 'Ayudar a alguien']
  },
  junior: {
    Autocuidado: ['Hacer la cama', 'Preparar la mochila', 'Organizar el escritorio',
      'Preparar la ropa del día siguiente', 'Higiene completa'],
    Hogar: ['Aspirar', 'Barrer', 'Doblar ropa', 'Tender', 'Vaciar lavavajillas (sin objetos peligrosos)',
      'Poner mesa', 'Recoger mesa', 'Encimera', 'Regar plantas'],
    Aprendizaje: ['Leer 20 minutos', 'Idiomas', 'Matemáticas', 'Instrumento', 'Proyecto personal',
      'Manualidades', 'Programación', 'Escritura'],
    Salud: ['Ejercicio', 'Paseo', 'Estiramientos', 'Dormir a la hora', 'Preparar una merienda saludable'],
    'Desarrollo personal': ['Ayudar a su hermana', 'Enseñar algo', 'Resolver un problema sola',
      'Gestionar una emoción', 'Practicar gratitud', 'Diario']
  },
  adulto: {
    Salud: ['Entrenamiento', 'Caminar', 'Dormir 7-8 h', 'Comer fruta', 'Beber agua', 'Meditación'],
    Hogar: ['Limpieza', 'Compra', 'Cocina', 'Lavadoras', 'Reparaciones'],
    Familia: ['Leer con las niñas', 'Juego familiar', 'Salida', 'Tiempo individual con cada hija',
      'Conversación sin móviles'],
    Profesional: ['Formación', 'Lectura científica', 'Proyecto', 'Organización semanal'],
    Personal: ['Leer', 'Hobby', 'Amigos', 'Descanso', 'Finanzas']
  }
}

const PREMIOS_FUENTE = {
  1: ['Tiempo de calidad', 'Elegir una actividad', 'Elegir un juego',
    'Elegir el cuento', 'Elegir la música del coche', 'Elegir la película', 'Elegir el desayuno del domingo',
    'Elegir la excursión', 'Elegir el menú del viernes'],
  2: ['Cocinar juntos', 'Dormir en un fuerte de mantas', 'Noche de juegos', 'Picnic', 'Cine', 'Helado',
    'Ir a la piscina', 'Excursión especial'],
  3: ['Elegir una actividad de fin de semana', 'Ir al parque de aventuras', 'Ir a comer fuera', 'Bolera', 'Acampada',
    'Museo a elegir', 'Noche especial con uno de los padres']
}

describe('el catálogo respeta la lista de la familia', () => {
  for (const rol of Object.keys(FUENTE)) {
    for (const [grupo, esperadas] of Object.entries(FUENTE[rol])) {
      it(`${rol} · ${grupo}`, () => {
        const bloque = CATALOGO[rol].find((g) => g.grupo === grupo)
        expect(bloque, `falta el grupo "${grupo}" en ${rol}`).toBeTruthy()
        expect(bloque.tareas.map((t) => flex(t.t, 'femenino'))).toEqual(esperadas)
      })
    }
  }

  it('el bloque doméstico a fondo sigue siendo exclusivo de adultos', () => {
    expect(CATALOGO.adulto.some((g) => g.grupo.includes('a fondo'))).toBe(true)
    expect(CATALOGO.peque.some((g) => g.grupo.includes('a fondo'))).toBe(false)
    expect(CATALOGO.junior.some((g) => g.grupo.includes('a fondo'))).toBe(false)
  })

  it('ninguna misión se ha quedado por el camino', () => {
    for (const rol of Object.keys(FUENTE)) {
      const dellista = Object.values(FUENTE[rol]).flat()
      const enCatalogo = new Set(tareasDeRol(rol).map((t) => flex(t.t, 'femenino')))
      for (const titulo of dellista) expect(enCatalogo.has(titulo), `${rol}: ${titulo}`).toBe(true)
    }
  })
})

describe('los títulos que son sustantivos tienen su acción', () => {
  // "Encimera" no puede acabar en "te has acordado tú de encimera".
  const sospechosos = ['Encimera', 'Ejercicio', 'Paseo', 'Estiramientos', 'Idiomas', 'Matemáticas',
    'Instrumento', 'Manualidades', 'Programación', 'Escritura', 'Diario', 'Entrenamiento', 'Meditación',
    'Limpieza', 'Compra', 'Cocina', 'Lavadoras', 'Reparaciones', 'Formación', 'Proyecto', 'Hobby',
    'Amigos', 'Descanso', 'Finanzas', 'Higiene completa', 'Organización semanal', 'Juego familiar', 'Salida']

  for (const titulo of sospechosos) {
    it(`"${titulo}" se convierte en una acción`, () => {
      const accion = accionDeMision(titulo)
      expect(accion).not.toBe(titulo.toLocaleLowerCase('es'))
      expect(accion.length).toBeGreaterThan(3)
    })
  }
})

describe('el catálogo de premios respeta la lista', () => {
  for (const nivel of [1, 2, 3]) {
    it(`nivel ${nivel}`, () => {
      const mios = CATALOGO_PREMIOS.filter((p) => p.tier === nivel).map((p) => p.title)
      expect(mios).toEqual(PREMIOS_FUENTE[nivel])
    })
  }
})

// ------------------------------------------------------------------
// La tienda no vende reconocimiento (F3 · RECONOCIMIENTOS.md §4/P5).
// ------------------------------------------------------------------
describe('lo que la tienda NO puede vender', () => {
  it('ningún premio es un elogio, un gracias ni un reconocimiento', () => {
    const sospechosos = CATALOGO_PREMIOS.filter((p) => /elogio|gracias|reconocimiento/i.test(p.title))
    expect(sospechosos.map((p) => p.title)).toEqual([])
  })
})
