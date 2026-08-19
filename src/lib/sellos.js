// ------------------------------------------------------------------
// Sellos de oficio: la cara visible de las insignias.
//
// Hasta ahora una insignia era un emoji. Un emoji se dibuja distinto en
// cada sistema, no hereda la paleta del tablero y, sobre todo, no sabe
// decir CUÁNTO cuesta: 🌟 y 👑 pesan lo mismo en pantalla aunque una sea
// la primera misión y la otra cincuenta. El sello sí lo dice, porque el
// MATERIAL es la escala:
//
//   bronce → plata → oro → oro con gema → legendaria
//
// La misma pieza grabada, cada vez en un metal mejor. Se lee sin leer.
//
// Esto es solo la CAPA VISUAL del catálogo de 73 que describen
// `docs/INSIGNIAS-01..06`. El motor sigue siendo el de las 16 de
// `insignias.js`: aquí no se concede nada, no se evalúa ninguna
// condición y no se toca la economía. Cuando llegue el motor v2, las
// definiciones ya tendrán su sello esperando y esta tabla no cambia.
//
// Las imágenes son WebP de 192 px (~10 KB) y se piden en diferido: solo
// bajan las que se ven, y solo al abrir Progreso. Ver `docs/GUIA-ASSETS.md`.
// ------------------------------------------------------------------

const RUTA = '/assets/insignias'

/**
 * Materiales, de menor a mayor. El orden IMPORTA: es la escala de la
 * colección y algún día ordenará una vitrina.
 */
export const MATERIALES = ['bronce', 'plata', 'oro', 'oro-gema', 'legendaria']

/** Los cuatro grados de cada camino de oficio, en orden. */
export const GRADOS_OFICIO = ['Oficialía', 'Veteranía', 'Maestría', 'Obra maestra']

const MATERIAL_POR_GRADO = ['bronce', 'plata', 'oro', 'oro-gema']

/** Las ocho habilidades, con el mismo orden y los mismos ids que `habilidades.js`. */
const HABILIDADES_OFICIO = [
  'hogar', 'salud', 'aprendizaje', 'amabilidad',
  'responsabilidad', 'cooperacion', 'creatividad', 'autonomia'
]

const sello = (id, fichero, categoria, material, extra = {}) => ({
  id,
  categoria,
  material,
  src: `${RUTA}/${fichero}.webp`,
  ...extra
})

// ------------------------------------------------------------------
// Las REGLAS.
//
// Cada sello evaluable lleva un objeto `regla` declarativo. No son
// funciones: son datos que `sellos-motor.js` interpreta. Esa separación
// es la misma que ya había entre `insignias.js` y `meritos.js`, y existe
// por lo mismo —el catálogo se lee de un vistazo y las cuentas se prueban
// sin tocarlo—, pero además aquí hace falta para otra cosa: un día estas
// mismas reglas tendrán que evaluarse en Postgres, y un objeto se traduce
// a SQL mientras que un `(s) => s.x >= 3` no.
//
// Un sello SIN `regla` no se concede nunca. Es el estado correcto para
// los que aún no tienen dato que los sostenga (Autonomía) o modelo donde
// vivir (los repetibles de temporada). Ver `EVALUABLES` al final.
// ------------------------------------------------------------------

// --- Series numéricas ------------------------------------------------
// Ritmo y Trayectoria comparten forma: ocho escalones que suben de metal
// y terminan en legendaria. Los umbrales son los del catálogo v1 y aquí
// solo sirven de etiqueta: nada los evalúa todavía.

const ESCALA_OCHO = ['bronce', 'bronce', 'plata', 'plata', 'plata', 'oro', 'oro', 'legendaria']

const serieDeOcho = (prefijo, categoria, escalones) =>
  escalones.map(({ umbral, regla }, i) => {
    const n = String(i + 1).padStart(2, '0')
    return sello(`${prefijo}_${n}`, `${prefijo}-${n}`, categoria, ESCALA_OCHO[i], { umbral, regla })
  })

/**
 * Ritmo: días con presencia real, sin exigir que sean seguidos.
 * Un día cuenta UNA vez aunque se hagan diez misiones.
 */
const RITMO = [3, 10, 25, 60, 120, 250, 500, 1000]
  .map((d) => ({ umbral: d, regla: { diasActivos: d } }))

/**
 * Trayectoria: volumen CON dispersión. El número solo nunca basta a
 * partir del segundo escalón, porque si bastara, crear cincuenta misiones
 * fáciles un domingo compraría años de trayectoria.
 */
const TRAYECTORIA = [
  { umbral: 10, regla: { aprobadas: 10, diasActivos: 3 } },
  { umbral: 50, regla: { aprobadas: 50, diasActivos: 14, semanasActivas: 3 } },
  { umbral: 100, regla: { aprobadas: 100, diasActivos: 25, semanasActivas: 6 } },
  { umbral: 250, regla: { aprobadas: 250, diasActivos: 60, mesesActivos: 3 } },
  { umbral: 500, regla: { aprobadas: 500, diasActivos: 120, mesesActivos: 6 } },
  { umbral: 1000, regla: { aprobadas: 1000, diasActivos: 220, mesesActivos: 12 } },
  { umbral: 2500, regla: { aprobadas: 2500, diasActivos: 500, mesesActivos: 24 } },
  { umbral: 5000, regla: { aprobadas: 5000, diasActivos: 900, mesesActivos: 48 } }
]

/**
 * Caminos de oficio. La XP sola no acredita un oficio: hacen falta días
 * distintos, semanas distintas y VARIEDAD de misiones dentro de esa
 * habilidad. Repetir la misma tarea cien veces demuestra constancia, que
 * ya la reconoce Ritmo, no dominio.
 */
const GRADO_REGLA = [
  { xp: 100, dias: 3, semanas: 2, familias: 2 },
  { xp: 300, dias: 10, semanas: 4, familias: 3 },
  { xp: 700, dias: 25, semanas: 12, meses: 3, familias: 4 },
  { xp: 1500, dias: 60, semanas: 24, meses: 9, familias: 5 }
]

// --- Catálogo v1 (73) ------------------------------------------------

export const SELLOS_V1 = [
  sello('inicio_primer_encargo', 'inicio-primer-encargo', 'primeros_encargos', 'bronce',
    { regla: { aprobadas: 1 } }),

  ...serieDeOcho('ritmo', 'ritmo', RITMO),
  ...serieDeOcho('trayectoria', 'trayectoria', TRAYECTORIA),

  // Ocho caminos × cuatro grados. Se componen en vez de escribirse a
  // mano: 32 literales casi idénticos es el sitio donde se cuela una
  // errata que nadie ve hasta que falta una imagen en pantalla.
  ...HABILIDADES_OFICIO.flatMap((habilidad) =>
    GRADOS_OFICIO.map((grado, i) =>
      sello(
        `oficio_${habilidad}_${i + 1}`,
        `oficio-${habilidad}-${i + 1}`,
        'caminos_de_oficio',
        MATERIAL_POR_GRADO[i],
        { habilidad, grado, regla: { habilidad, ...GRADO_REGLA[i] } }
      )
    )
  ),

  // Exploración: valores DISTINTOS. Repetir no amplía nada, y por eso
  // ninguna de estas reglas mira cuántas veces se hizo algo.
  sello('exploracion_4_habilidades', 'exploracion-habilidades-4', 'exploracion', 'plata',
    { regla: { habilidadesTocadas: 4, diasActivos: 3 } }),
  sello('exploracion_8_habilidades', 'exploracion-habilidades-8', 'exploracion', 'oro',
    { regla: { habilidadesTocadas: 8, diasActivos: 8 } }),
  sello('exploracion_5_familias', 'exploracion-familias-5', 'exploracion', 'bronce',
    { regla: { familias: 5, habilidadesTocadas: 3, diasActivos: 5 } }),
  sello('exploracion_15_familias', 'exploracion-familias-15', 'exploracion', 'plata',
    { regla: { familias: 15, habilidadesTocadas: 6, semanasActivas: 6 } }),
  sello('exploracion_30_familias', 'exploracion-familias-30', 'exploracion', 'oro',
    { regla: { familias: 30, habilidadesTocadas: 8, mesesActivos: 6 } }),
  sello('exploracion_4_frecuencias', 'exploracion-frecuencias-4', 'exploracion', 'plata',
    { regla: { frecuencias: 4, diasActivos: 8, semanasActivas: 4 } }),

  // Equilibrio: mínimos en varias habilidades y un techo de
  // concentración. No exige barras iguales —una especialidad es legítima—
  // solo que no haya UNA que se lo coma todo.
  sello('equilibrio_4_caminos', 'equilibrio-04', 'equilibrio', 'bronce',
    { regla: { equilibrio: { habilidades: 4, xp: 100, dias: 3, familias: 2, xpTotal: 500, concentracionMax: 0.60 } } }),
  sello('equilibrio_6_caminos', 'equilibrio-06', 'equilibrio', 'oro-gema',
    { regla: { equilibrio: { habilidades: 6, xp: 300, dias: 10, familias: 3, xpTotal: 2200, concentracionMax: 0.45 } } }),
  sello('equilibrio_8_caminos', 'equilibrio-08', 'equilibrio', 'legendaria',
    { regla: { equilibrio: { habilidades: 8, xp: 700, dias: 25, familias: 4, xpTotal: 6500, concentracionMax: 0.35 } } }),

  // Autonomía: SIN regla, a propósito. Necesita que alguien declare el
  // nivel de ayuda de cada misión, y ese dato no existe todavía. No se
  // infiere del título ni del volumen: hacer algo cien veces no demuestra
  // hacerlo con menos ayuda. Ver `docs/INSIGNIAS-03-CATALOGO.md` §11.
  sello('autonomia_transicion_01', 'autonomia-transicion-01', 'autonomia', 'bronce'),
  sello('autonomia_transicion_02', 'autonomia-transicion-02', 'autonomia', 'plata'),
  sello('autonomia_transicion_03', 'autonomia-transicion-03', 'autonomia', 'oro'),
  sello('autonomia_transicion_04', 'autonomia-transicion-04', 'autonomia', 'oro-gema'),

  // Los dos repetibles de temporada tampoco llevan regla: `profile_badges`
  // tiene `unique(profile_id, code)` y no sabe guardar una instancia por
  // temporada. Necesitan el modelo de instancias de INSIGNIAS-05.
  sello('obra_comun_temporada', 'obra-comun-temporada', 'obra_comun', 'oro-gema'),
  sello('obra_comun_participante', 'obra-comun-participante', 'obra_comun', 'bronce'),

  sello('obra_comun_05', 'obra-comun-05', 'obra_comun', 'plata', { regla: { obrasCerradas: 5 } }),
  sello('obra_comun_10', 'obra-comun-10', 'obra_comun', 'oro-gema', { regla: { obrasCerradas: 10 } }),
  sello('obra_comun_25', 'obra-comun-25', 'obra_comun', 'legendaria', { regla: { obrasCerradas: 25 } }),

  // Regreso: hace falta historia previa, una pausa REAL y continuidad
  // después. Las tres cosas juntas. Premiar la vuelta sola convertiría
  // desaparecer un mes en una jugada.
  sello('regreso_01', 'regreso-01', 'regreso_al_taller', 'plata',
    { regla: { regreso: { baseDias: 5, pausaDias: 7, despuesDias: 2, ventanaDias: 7 } } }),
  sello('regreso_02', 'regreso-02', 'regreso_al_taller', 'oro',
    { regla: { regreso: { baseDias: 25, baseSemanas: 8, pausaDias: 21, despuesDias: 3, ventanaDias: 14 } } }),
  sello('regreso_03', 'regreso-03', 'regreso_al_taller', 'oro-gema',
    { regla: { regreso: { baseDias: 60, baseMeses: 6, pausaDias: 60, despuesDias: 5, ventanaDias: 21 } } }),

  sello('descubrimiento_semana_variada', 'descubrimiento-semana-variada', 'descubrimientos', 'descubrimiento',
    { regla: { enUnaSemana: { habilidades: 4, dias: 3 } } }),
  sello('descubrimiento_tres_ritmos', 'descubrimiento-tres-ritmos', 'descubrimientos', 'descubrimiento',
    { regla: { enUnMes: { frecuencias: ['diario', 'semanal', 'mensual'], dias: 4 } } }),
  // Sin regla: necesita banda evolutiva por perfil, que no está en el
  // modelo. `role` no sirve: una función doméstica no es una edad.
  sello('descubrimiento_varias_generaciones', 'descubrimiento-mesa-compartida', 'descubrimientos', 'descubrimiento')
]

// --- Sellos de legado ------------------------------------------------
// Siete insignias vivas que el catálogo v1 NO sucede: nivel general,
// canje, hora de validación y las tres competitivas. El catálogo las
// retira a propósito —comparar personas contradice el sistema— pero
// quien las ganó las conserva, así que necesitan cara propia. Sin ellas
// la rejilla mezclaría sellos y emoji, que es peor que cualquiera de las
// dos cosas por separado.

export const SELLOS_LEGADO = [
  sello('legado_nivel_05', 'legado-nivel-05', 'legado', 'bronce'),
  sello('legado_nivel_10', 'legado-nivel-10', 'legado', 'plata'),
  sello('legado_canje', 'legado-canje', 'legado', 'bronce'),
  sello('legado_madrugador', 'legado-madrugador', 'legado', 'plata'),
  sello('legado_pionero', 'legado-pionero', 'legado', 'oro'),
  sello('legado_mano_derecha', 'legado-mano-derecha', 'legado', 'oro'),
  sello('legado_coleccionista', 'legado-coleccionista', 'legado', 'oro')
]

export const SELLOS = [...SELLOS_V1, ...SELLOS_LEGADO]

const POR_ID = new Map(SELLOS.map((s) => [s.id, s]))

/**
 * Qué sello le toca a cada una de las 16 insignias que HOY se conceden.
 *
 * Donde el catálogo v1 declara sucesora, se usa la suya. Donde no la
 * hay, se usa su sello de legado.
 *
 * Y donde la sucesora existe pero con otro umbral —`x25` no tiene
 * escalón propio en Trayectoria— NO se coge el peldaño contiguo: se
 * coge uno de cada material. Con 01/02/03 las tres salían en bronce y
 * bronce, y en la rejilla «Diez misiones» y «Veterana» se leían como la
 * misma insignia repetida. Saltando a 01/03/06 la escala se ve de un
 * vistazo: bronce, plata, oro.
 *
 * Esta tabla es un mapa de imágenes, no una migración: no cambia ninguna
 * condición ni promete que la sucesora se vaya a conceder.
 */
const POR_INSIGNIA = {
  primera: 'inicio_primer_encargo',
  x10: 'trayectoria_01',
  x25: 'trayectoria_03',
  x50: 'trayectoria_06',
  nivel5: 'legado_nivel_05',
  nivel10: 'legado_nivel_10',
  canje1: 'legado_canje',
  gremio: 'obra_comun_temporada',
  racha7: 'ritmo_02',
  racha21: 'ritmo_03',
  ocho_habilidades: 'exploracion_8_habilidades',
  madrugador: 'legado_madrugador',
  ayuda10: 'oficio_amabilidad_1',
  primer_nivel10: 'legado_pionero',
  mano_derecha: 'legado_mano_derecha',
  coleccionista: 'legado_coleccionista'
}

/** El sello de una insignia viva, o `null` si no lo tiene. */
export function selloDeInsignia(code) {
  return POR_ID.get(POR_INSIGNIA[code]) || null
}

/** El sello por su propio id dentro del catálogo. */
export function selloPorId(id) {
  return POR_ID.get(id) || null
}

/**
 * El sello de CUALQUIER código que pueda aparecer en `profile_badges`.
 *
 * Esa tabla mezcla dos vocabularios desde que el motor v1 concede: los 16
 * códigos de siempre (`primera`, `x10`) y los ids del catálogo nuevo
 * (`ritmo_01`, `oficio_hogar_3`). Quien pinta una insignia no debería
 * tener que saber de cuál de los dos viene, así que se resuelve aquí y
 * en un solo sitio.
 */
export function selloDeCodigo(code) {
  return POR_ID.get(code) || selloDeInsignia(code)
}

/** Los códigos de insignia que hoy tienen sello. Lo usan los tests. */
export const INSIGNIAS_CON_SELLO = Object.keys(POR_INSIGNIA)

/**
 * Los sellos que el motor puede conceder hoy: los que tienen regla.
 *
 * Los otros seis no son un olvido y no deben "arreglarse" poniéndoles una
 * regla aproximada. Cuatro de Autonomía esperan a que exista el nivel de
 * ayuda; dos de temporada esperan al modelo de instancias; y el
 * descubrimiento de generaciones espera a la banda evolutiva. Conceder
 * una insignia por una condición que el sistema no puede demostrar es la
 * regla 6 de `INSIGNIAS-01`, y es la única que no se puede deshacer,
 * porque una insignia dada no se quita.
 */
export const EVALUABLES = SELLOS_V1.filter((s) => s.regla)
