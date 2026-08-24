import { useId } from 'react'
import {
  PIELES, PELOS, TUNICAS, piezasDe, hexDe, faseDePerfil, llevaFigura, FASES,
  PALETA_RETRATO, oscuro, claro, separar, admiteFlequillo, colorDeRaya
} from '../lib/retratos'

// ------------------------------------------------------------------
// El dibujo del retrato.
//
// Dos reglas salieron del prototipo (docs/prototipos/retrato.html) y las
// dos vienen de mirar la pantalla, no de razonarlas:
//
// 1 · POR DEBAJO DE 64 px SE RECORTA A LA CABEZA. Un cuerpo entero a 30
//     o 40 px es una mancha: no se distingue quién es ni qué lleva. La
//     cabeza sola con su aro se lee perfectamente a los dos tamaños. Y no
//     se pierde nada, porque abajo lo único que hace falta saber es quién
//     es; el equipo se mira en la ficha.
//
// 2 · EN EL TABLERO, DISCO DE FONDO. Un miembro de pelo y piel oscuros se
//     disolvía en el índigo a 30 px y quedaba el aro flotando sin cara
//     dentro. Un disco claro muy tenue devuelve la silueta.
//
// La fase se dibuja acumulando equipo, nunca cambiando el tamaño: dos
// miembros de fases distintas ocupan lo mismo. Eso es lo que hace que la
// escalera conviva con «sin ranking entre miembros».
//
// Sin dependencias, como Icono.jsx: son formas geométricas y no compensa
// arrastrar una librería.
// ------------------------------------------------------------------

// Los tonos viven en lib/retratos.js: hay un test que vigila que el oro
// siga contrastando contra el canal y el canal contra cada color de
// miembro. Se miraba a ojo y por eso el progreso no se veía en ámbar.
const { oro: ORO, oroClaro: ORO_CLARO, oroHondo: ORO_HONDO, canal: CANAL, apagado: APAGADO } =
  PALETA_RETRATO

// Umbral del recorte. 64 px es el primer tamaño donde el cuerpo entero
// aporta algo; por debajo estorba.
//
// Ojo: pasar el umbral no basta para que el cuerpo MEREZCA la pena. El
// picker se probó a 72 px con cuerpo entero y el farol de las fases 7-9
// salía como una caja gris suelta de diez píxeles, además de perderse el
// aro (que solo se dibuja en el recorte). Las listas piden vista="cabeza"
// aunque quepan: el equipo se mira en la ficha, donde hay sitio.
const UMBRAL_CUERPO = 64

// Cuánto flequillo cae sobre el cráneo en cada peinado. El rapado se
// distingue del corto por esto y solo por esto, así que el número no es
// decorativo: con el mismo alto son el mismo dibujo.
const ALTO_FLEQUILLO = { rizado: 16, rapado: 9, mono: 12, coleta: 13 }

function Pelo({ estilo, color, uid }) {
  // Detrás de la cabeza va el volumen; delante, lo que se recorta al
  // cráneo. Dibujar el pelo entero recortado deja calvas a las melenas.
  if (estilo === 'calvo') return null
  return (
    <>
      {estilo === 'largo' && (
        <>
          <path d="M28,30 q-5,20 -1,30 q7,4 10,-2 q-5,-14 -3,-28 z" fill={color} />
          <path d="M72,30 q5,20 1,30 q-7,4 -10,-2 q5,-14 3,-28 z" fill={color} />
        </>
      )}
      {estilo === 'rizado' && (
        <>
          <circle cx="35" cy="21" r="9" fill={color} />
          <circle cx="50" cy="14" r="10" fill={color} />
          <circle cx="65" cy="21" r="9" fill={color} />
        </>
      )}
      {estilo === 'coleta' && (
        <>
          <ellipse cx="76" cy="48" rx="7" ry="14" fill={color} />
          <rect x="68" y="32" width="9" height="5" rx="2.5" fill={oscuro(color, 0.3)} />
        </>
      )}
      {estilo === 'mono' && <circle cx="50" cy="13" r="9.5" fill={color} />}
      {estilo === 'trenzas' && (
        <>
          {[44, 52, 60].map((y) => (
            <circle key={'i' + y} cx="29" cy={y} r="5.2" fill={color} />
          ))}
          {[44, 52, 60].map((y) => (
            <circle key={'d' + y} cx="71" cy={y} r="5.2" fill={color} />
          ))}
        </>
      )}
    </>
  )
}

// Gafas. Van DESPUÉS de los ojos y con la lente algo clara: sobre una piel
// oscura una montura pelada se pierde, y el detalle más pequeño de la cara
// es justo el que no puede depender del tono de piel.
function Gafas({ tipo }) {
  if (!tipo || tipo === 'ninguna') return null
  const comun = { fill: '#eaeaf4', fillOpacity: 0.22, stroke: '#241f2e', strokeWidth: 2 }
  return (
    <>
      {tipo === 'redondas' ? (
        <>
          <circle cx="43" cy="37" r="6.4" {...comun} />
          <circle cx="57" cy="37" r="6.4" {...comun} />
        </>
      ) : (
        <>
          <rect x="36.4" y="31.6" width="13" height="10.8" rx="2.5" {...comun} />
          <rect x="50.6" y="31.6" width="13" height="10.8" rx="2.5" {...comun} />
        </>
      )}
      <path d="M49.4,37 h1.2" stroke="#241f2e" strokeWidth="2" strokeLinecap="round" />
    </>
  )
}


// La barba va del color del pelo y DEBAJO de la boca: dibujada encima, la
// boca desaparece y la cara se queda sin expresión, que es lo único que
// esta figura tiene. Se recorta al cráneo salvo la larga, que por
// definición sobra por abajo.
//
// El borde de arriba es una CURVA, alta en las patillas y hundida en el
// centro, como una barba de verdad. Con un borde recto —y con melena del
// mismo color— la cabeza salía de un solo tono con una franja de piel a
// la altura de los ojos: cara de antifaz. La curva deja el pómulo a la
// vista y la boca por encima del pelo.
function Barba({ tipo, color, uid }) {
  if (!tipo || tipo === 'ninguna') return null

  const bigote = <path d="M41,44 q9,-3.5 18,0 q-3.5,3.2 -9,3.2 q-5.5,0 -9,-3.2 z" fill={color} />
  if (tipo === 'bigote') return bigote
  if (tipo === 'perilla') {
    return (
      <>
        <ellipse cx="50" cy="52" rx="5.2" ry="4" fill={color} />
        {bigote}
      </>
    )
  }

  const larga = tipo === 'larga' || tipo === 'largabigote'
  const conBigote = tipo === 'cortabigote' || tipo === 'largabigote'
  return (
    <>
      {/* La parte larga va DEBAJO de la recortada para que el borde de la
          mandíbula quede limpio. Y es una forma MACIZA: la primera versión
          eran dos curvas encaradas y lo que salía era el hueco entre
          ellas, una barba con el centro vacío. */}
      {larga && <path d="M32,47 Q33,68 50,76 Q67,68 68,47 Z" fill={color} />}
      <g clipPath={`url(#${uid}-h)`}>
        <path d="M27,42 q23,15 46,0 L73,61 L27,61 Z" fill={color} />
      </g>
      {conBigote && bigote}
    </>
  )
}

// El flequillo, recortado al cráneo. `base` es dónde termina el pelo que
// cae sobre la frente, y sale del alto que pide cada peinado.
function Flequillo({ forma, alto, color, piel }) {
  const base = 12 + alto

  if (forma === 'cortina') {
    // Cortina, y la clave es cuánto pelo se quita: casi nada.
    //
    // La primera versión abría un pico ancho en mitad de la frente y lo
    // que se veía no era una raya, era una calva. Una cortina no descubre
    // la frente: cae ENTERA y solo se separa en una raya.
    //
    // Así que el pelo cubre igual que el flequillo recto —un poco más
    // largo por los lados, que es lo que la distingue— y la raya es una
    // cuña fina de piel de tres unidades, que a 40 px es un pelo de
    // ancho y a tamaño grande se lee como lo que es.
    return (
      <>
        <path d={`M28,12 H72 V${base + 6} Q50,${base - 2} 28,${base + 6} Z`} fill={color} />
        {/* La raya parte de la piel EN SOMBRA y se separa del pelo.
            Piel a secas no valía: en rubio sobre piel pálida las dos son
            casi el mismo tono (1,85 de contraste) y la raya desaparecía.
            Y una raya del pelo está en sombra de verdad, así que no hay
            que elegir entre que se vea y que sea creíble. Medido, con
            esto ninguna combinación del catálogo baja de 2,3. */}
        <path
          d={`M48.4,12 L51.6,12 L50.9,${base + 3} L49.1,${base + 3} Z`}
          fill={colorDeRaya(piel, color)}
        />
      </>
    )
  }
  if (forma === 'despejado') {
    // Pelo recogido hacia atrás: la frente queda despejada pero el pelo
    // sigue ahí. Con el borde más alto parecía media calva en vez de un
    // peinado, que es justo lo contrario de lo que se elige aquí.
    return <path d={`M28,12 H72 V${base - 2} Q50,${base - 9} 28,${base - 2} Z`} fill={color} />
  }
  return <rect x="28" y="12" width="44" height={alto} fill={color} />
}

function Cara({ piel, pelo, peinado, gafas, barba, flequillo, uid }) {
  // Pelo negro sobre piel muy oscura contrastaba 1,12: eran la misma
  // mancha. `separar` lo mueve lo mínimo para despegarlo y no toca nada
  // cuando ya se veía, que es la mayoría de las combinaciones.
  const tinte = separar(pelo, piel)
  return (
    <>
      <Pelo estilo={peinado} color={tinte} uid={uid} />
      <circle cx="31" cy="37" r="4.5" fill={piel} />
      <circle cx="69" cy="37" r="4.5" fill={piel} />
      <circle cx="50" cy="34" r="20" fill={piel} />
      <defs>
        <clipPath id={uid + '-h'}>
          <circle cx="50" cy="34" r="20" />
        </clipPath>
      </defs>
      {/* El flequillo se recorta al cráneo. Sin pelo no hay nada que
          recortar: se salta entero en vez de pintar una franja de altura
          cero, que en algunos navegadores deja una línea de un píxel. */}
      {peinado !== 'calvo' && (
        <g clipPath={`url(#${uid}-h)`}>
          <Flequillo
            forma={admiteFlequillo(peinado) ? flequillo : 'recto'}
            alto={ALTO_FLEQUILLO[peinado] ?? 14}
            color={tinte}
            piel={piel}
          />
        </g>
      )}
      {/* Ojo con blanco y pupila, y no un punto de tinta. Un punto oscuro
          desaparece sobre una piel oscura —medido: 1,20 de contraste en
          «ébano»— y quien elegía esa piel se quedaba sin cara. El blanco
          se ve sobre cualquier tono, que es justo lo que hace falta. */}
      <Barba tipo={barba} color={tinte} uid={uid} />
      <circle cx="43" cy="37" r="3.3" fill="#f7f4ee" />
      <circle cx="57" cy="37" r="3.3" fill="#f7f4ee" />
      <circle cx="43" cy="37" r="1.9" fill="#1b1b2e" />
      <circle cx="57" cy="37" r="1.9" fill="#1b1b2e" />
      <path
        d="M45,45.5 q5,4.5 10,0"
        stroke={separar('#1b1b2e', piel)}
        strokeWidth="2" fill="none" strokeLinecap="round"
      />
      <Gafas tipo={gafas} />
    </>
  )
}

function Cuerpo({ color, piel }) {
  const manga = oscuro(color, 0.18)
  const pierna = oscuro(color, 0.5)
  return (
    <>
      <rect x="39" y="102" width="10" height="31" rx="5" fill={pierna} />
      <rect x="51" y="102" width="10" height="31" rx="5" fill={pierna} />
      {/* Los brazos llevan tono propio: del mismo color que el torso
          desaparecen en cuanto la figura baja de 60 px. */}
      <path d="M34,71 q-8,15 -8,29" stroke={manga} strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M66,71 q8,15 8,29" stroke={manga} strokeWidth="10" fill="none" strokeLinecap="round" />
      <rect x="45" y="50" width="10" height="11" rx="4" fill={oscuro(piel, 0.18)} />
      <path d="M33,67 Q50,60 67,67 L70,104 Q50,109 30,104 Z" fill={color} />
      <circle cx="26" cy="101" r="5.5" fill={piel} />
      <circle cx="74" cy="101" r="5.5" fill={piel} />
    </>
  )
}

function Equipo({ fase, color, uid }) {
  const f = fase
  const encendido = f >= 8
  return (
    <>
      {/* 1 · cinto de cuerda. Sin oro: aún no hay nada que reconocer. */}
      {f >= 1 && f < 4 && <rect x="32" y="87" width="36" height="4" rx="2" fill={oscuro(color, 0.4)} />}
      {/* 2 · pañuelo. Va oscuro: en claro sobre la misma túnica no se veía. */}
      {f >= 2 && <path d="M39,58 L61,58 L50,76 Z" fill={oscuro(color, 0.5)} />}
      {/* 3 · delantal */}
      {f >= 3 && <path d="M40,73 L60,73 L63,104 Q50,108 37,104 Z" fill={claro(color, 0.6)} />}
      {/* 4 · el oro entra aquí, y entra como reconocimiento. */}
      {f >= 4 && (
        <>
          <rect x="30" y="85" width="40" height="7" rx="2.5" fill="#2b2118" />
          <rect x="45" y="83" width="10" height="11" rx="2.5" fill={ORO} />
        </>
      )}
      {/* 5 · manto MÁS ANCHO que los hombros: cambiar la silueta es lo
          único que hace legible una fase de un vistazo. */}
      {f >= 5 && (
        <path d="M23,73 Q50,57 77,73 L81,93 Q66,86 50,86 Q34,86 19,93 Z" fill={oscuro(color, 0.55)} />
      )}
      {f >= 6 && <circle cx="50" cy="67" r="4.5" fill={ORO} />}
      {f >= 9 && (
        <path d="M19,93 Q34,86 50,86 Q66,86 81,93" stroke={ORO} strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      {/* 7 y 8 · el farol: primero se lleva, después se enciende. Separarlos
          es deliberado: encender la luz del taller es el gesto que da
          nombre a toda la paleta de la app. */}
      {f >= 7 && (
        <>
          {encendido && (
            <>
              <defs>
                <radialGradient id={uid + '-g'}>
                  <stop offset="0%" stopColor={ORO_CLARO} stopOpacity="0.9" />
                  <stop offset="55%" stopColor={ORO} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={ORO} stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="83" cy="112" r="21" fill={`url(#${uid}-g)`} />
            </>
          )}
          <path
            d="M75,100 q4,-3 8,4"
            stroke={encendido ? ORO_HONDO : APAGADO}
            strokeWidth="2.2" fill="none" strokeLinecap="round"
          />
          <rect
            x="76" y="104" width="14" height="17" rx="3" fill="#1d1d36"
            stroke={encendido ? ORO : APAGADO} strokeWidth="2"
          />
          <circle cx="83" cy="113" r="4.2" fill={encendido ? ORO_CLARO : '#3a3a52'} />
        </>
      )}
    </>
  )
}

// El aro. Un ARCO proporcional y no muescas: con nueve fases las muescas
// no caben, y a 30 px una muesca es una mota. El arco se lee desde unos
// 48 px y cuando no se lee no molesta —parece un reflejo—.
//
// EL CANAL OSCURO NO ES ADORNO. El oro sobre el color del miembro no
// contrasta con NINGUNO de la paleta: medido, el ratio va de 1,04 (teal)
// a 1,49 (coral), y 1,29 en el ámbar, que es donde se notó. Parecía
// legible en las capturas por el fondo de alrededor, no por el aro.
//
// Oscurecer el aro no bastaba: el ámbar se quedaba en 2,23, por debajo de
// lo que se lee de un vistazo a 46 px. Y cambiar el oro por otro color no
// es opción, porque la hoja de estilo dice que **el dorado no decora,
// reconoce**: el progreso tiene que ir en oro o no significa lo mismo.
//
// La salida es dar al arco un canal oscuro debajo, un poco más ancho, de
// modo que el oro lleve siempre su propio borde. Contra el canal el
// contraste es alto sea cual sea el color del miembro, y el aro conserva
// su tono a plena saturación para seguir identificando.
function Aro({ color, fase }) {
  const R = 27
  const vuelta = 2 * Math.PI * R
  const arco = (vuelta * fase) / FASES.length
  const trazos = `${arco.toFixed(1)} 999`
  return (
    <>
      {/* El aro de base va APAGADO, no a plena saturación. Es lo que
          todavía no se ha conseguido, y así la diferencia entre hecho y
          por hacer no depende del tono: el tramo ganado brilla y el resto
          queda hundido. Sin esto, un miembro ámbar o amarillo llevaba oro
          sobre oro y el progreso solo se adivinaba por el borde. El tono
          se conserva —solo baja el brillo—, así que sigue identificando. */}
      <circle cx="50" cy="34" r={R} fill="none" stroke={oscuro(color, 0.34)} strokeWidth="3" />
      <circle
        cx="50" cy="34" r={R} fill="none" stroke={CANAL} strokeWidth="5.8"
        strokeLinecap="round" strokeDasharray={trazos}
        transform="rotate(-90 50 34)"
      />
      <circle
        cx="50" cy="34" r={R} fill="none" stroke={ORO} strokeWidth="3.2"
        strokeLinecap="round" strokeDasharray={trazos}
        transform="rotate(-90 50 34)"
      />
    </>
  )
}

/**
 * El retrato de un perfil.
 *
 * @param perfil  la fila de profiles
 * @param tamano  ancho en px
 * @param vista   'auto' decide por el tamaño (el umbral de 64); 'cabeza' y
 *                'cuerpo' lo fuerzan. Hace falta forzar en los dos
 *                sentidos: la cabecera de la peque mide 66 px y aun así
 *                quiere cabeza, y su ficha quiere cuerpo entero.
 * @param disco   fondo claro tras la cabeza. true en el tablero, false en pergamino
 * @param titulo  si se pasa, el retrato se anuncia; si no, es decorativo
 */
export default function Retrato({ perfil, tamano = 64, vista = 'auto', disco = true, titulo, className }) {
  const uid = 'rt' + useId().replace(/:/g, '')
  const entero = vista === 'cuerpo' || (vista === 'auto' && tamano >= UMBRAL_CUERPO)
  const color = perfil?.color || '#a78bfa'

  // Las mascotas llevan medallón de emoji: mismo aro y mismo tamaño que
  // las personas, sin arco, porque una mascota no tiene fase.
  if (!llevaFigura(perfil)) {
    return (
      <svg
        className={'retrato' + (className ? ' ' + className : '')}
        width={tamano} height={tamano} viewBox="18 2 64 64"
        role={titulo ? 'img' : undefined} aria-hidden={titulo ? undefined : 'true'} focusable="false"
      >
        {titulo && <title>{titulo}</title>}
        <circle cx="50" cy="34" r="27" fill="#1d1d36" stroke={color} strokeWidth="3" />
        <text x="50" y="34" textAnchor="middle" dominantBaseline="central" fontSize="30">
          {perfil?.emoji || '🐾'}
        </text>
      </svg>
    )
  }

  const piezas = piezasDe(perfil)
  const piel = hexDe(PIELES, piezas.piel)
  const pelo = hexDe(PELOS, piezas.pelo)
  // La túnica ya no es el color del miembro: son dos datos distintos, así
  // que el aro y la ropa pueden dejar de ir a juego. 'perfil' —el valor
  // por defecto— significa «la del color del miembro», y por eso su hex
  // es null: quien no elige nada sigue viéndose como antes.
  const tunica = TUNICAS.find((t) => t.id === piezas.tunica)?.hex || color
  const fase = faseDePerfil(perfil)

  return (
    <svg
      className={'retrato' + (className ? ' ' + className : '')}
      width={tamano}
      height={entero ? Math.round(tamano * 1.42) : tamano}
      viewBox={entero ? '0 -2 100 140' : '18 2 64 64'}
      role={titulo ? 'img' : undefined}
      aria-hidden={titulo ? undefined : 'true'}
      focusable="false"
    >
      {titulo && <title>{titulo}</title>}
      {!entero && disco && <circle cx="50" cy="34" r="25.5" fill="#eaeaf4" opacity="0.14" />}
      {!entero && <Aro color={color} fase={fase.n} />}
      {entero && (
        <>
          <Cuerpo color={tunica} piel={piel} />
          <Equipo fase={fase.n} color={tunica} uid={uid} />
        </>
      )}
      <Cara piel={piel} pelo={pelo} peinado={piezas.peinado} gafas={piezas.gafas} barba={piezas.barba} flequillo={piezas.flequillo} uid={uid} />
    </svg>
  )
}
