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

// --- Series numéricas ------------------------------------------------
// Ritmo y Trayectoria comparten forma: ocho escalones que suben de metal
// y terminan en legendaria. Los umbrales son los del catálogo v1 y aquí
// solo sirven de etiqueta: nada los evalúa todavía.

const ESCALA_OCHO = ['bronce', 'bronce', 'plata', 'plata', 'plata', 'oro', 'oro', 'legendaria']

const serieDeOcho = (prefijo, categoria, umbrales) =>
  umbrales.map((umbral, i) => {
    const n = String(i + 1).padStart(2, '0')
    return sello(`${prefijo}_${n}`, `${prefijo}-${n}`, categoria, ESCALA_OCHO[i], { umbral })
  })

// --- Catálogo v1 (73) ------------------------------------------------

export const SELLOS_V1 = [
  sello('inicio_primer_encargo', 'inicio-primer-encargo', 'primeros_encargos', 'bronce'),

  ...serieDeOcho('ritmo', 'ritmo', [3, 10, 25, 60, 120, 250, 500, 1000]),
  ...serieDeOcho('trayectoria', 'trayectoria', [10, 50, 100, 250, 500, 1000, 2500, 5000]),

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
        { habilidad, grado }
      )
    )
  ),

  sello('exploracion_4_habilidades', 'exploracion-habilidades-4', 'exploracion', 'plata'),
  sello('exploracion_8_habilidades', 'exploracion-habilidades-8', 'exploracion', 'oro'),
  sello('exploracion_5_familias', 'exploracion-familias-5', 'exploracion', 'bronce'),
  sello('exploracion_15_familias', 'exploracion-familias-15', 'exploracion', 'plata'),
  sello('exploracion_30_familias', 'exploracion-familias-30', 'exploracion', 'oro'),
  sello('exploracion_4_frecuencias', 'exploracion-frecuencias-4', 'exploracion', 'plata'),

  sello('equilibrio_4_caminos', 'equilibrio-04', 'equilibrio', 'bronce'),
  sello('equilibrio_6_caminos', 'equilibrio-06', 'equilibrio', 'oro-gema'),
  sello('equilibrio_8_caminos', 'equilibrio-08', 'equilibrio', 'legendaria'),

  sello('autonomia_transicion_01', 'autonomia-transicion-01', 'autonomia', 'bronce'),
  sello('autonomia_transicion_02', 'autonomia-transicion-02', 'autonomia', 'plata'),
  sello('autonomia_transicion_03', 'autonomia-transicion-03', 'autonomia', 'oro'),
  sello('autonomia_transicion_04', 'autonomia-transicion-04', 'autonomia', 'oro-gema'),

  sello('obra_comun_temporada', 'obra-comun-temporada', 'obra_comun', 'oro-gema'),
  sello('obra_comun_participante', 'obra-comun-participante', 'obra_comun', 'bronce'),
  sello('obra_comun_05', 'obra-comun-05', 'obra_comun', 'plata'),
  sello('obra_comun_10', 'obra-comun-10', 'obra_comun', 'oro-gema'),
  sello('obra_comun_25', 'obra-comun-25', 'obra_comun', 'legendaria'),

  sello('regreso_01', 'regreso-01', 'regreso_al_taller', 'plata'),
  sello('regreso_02', 'regreso-02', 'regreso_al_taller', 'oro'),
  sello('regreso_03', 'regreso-03', 'regreso_al_taller', 'oro-gema'),

  sello('descubrimiento_semana_variada', 'descubrimiento-semana-variada', 'descubrimientos', 'descubrimiento'),
  sello('descubrimiento_tres_ritmos', 'descubrimiento-tres-ritmos', 'descubrimientos', 'descubrimiento'),
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

/** Los códigos de insignia que hoy tienen sello. Lo usan los tests. */
export const INSIGNIAS_CON_SELLO = Object.keys(POR_INSIGNIA)
