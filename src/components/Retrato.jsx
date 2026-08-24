import { useId } from 'react'
import { PIELES, PELOS, piezasDe, hexDe, faseDePerfil, llevaFigura, FASES, PALETA_RETRATO } from '../lib/retratos'

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

function mezcla(hex, f, hacia) {
  const n = parseInt(String(hex).slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const d = c.map((v) => Math.round(hacia === 'claro' ? v + (255 - v) * f : v * (1 - f)))
  return '#' + d.map((v) => v.toString(16).padStart(2, '0')).join('')
}
const oscuro = (h, f) => mezcla(h, f, 'oscuro')
const claro = (h, f) => mezcla(h, f, 'claro')

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
    </>
  )
}

function Cara({ piel, pelo, peinado, uid }) {
  return (
    <>
      <Pelo estilo={peinado} color={pelo} uid={uid} />
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
          <rect x="28" y="12" width="44" height={peinado === 'rizado' ? 16 : 14} fill={pelo} />
        </g>
      )}
      <circle cx="43" cy="37" r="2.9" fill="#1b1b2e" />
      <circle cx="57" cy="37" r="2.9" fill="#1b1b2e" />
      <path d="M45,45 q5,4.5 10,0" stroke="#1b1b2e" strokeWidth="2" fill="none" strokeLinecap="round" />
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
          <Cuerpo color={color} piel={piel} />
          <Equipo fase={fase.n} color={color} uid={uid} />
        </>
      )}
      <Cara piel={piel} pelo={pelo} peinado={piezas.peinado} uid={uid} />
    </svg>
  )
}
