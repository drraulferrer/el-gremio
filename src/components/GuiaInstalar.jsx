import { useEffect, useState } from 'react'
import {
  abiertaComoApp,
  plataformaDeEsteAparato,
  queOfrecer
} from '../lib/instalacion'

// ------------------------------------------------------------------
// Cómo poner El Gremio en la pantalla de inicio.
//
// Las instrucciones existían, pero en texto y detrás del PIN, en Panel →
// ⚙️ → Dispositivos. Ahí no llega quien las necesita: quien instala está
// en el móvil NUEVO, acaba de escanear el QR y muchas veces no tiene el
// PIN. Por eso esto vive donde cae la gente al abrir la app.
//
// Y va dibujado en vez de escrito porque los pasos son «toca ESE botón»:
// el de compartir de iOS y los tres puntos de Android no se describen
// bien con palabras —«el cuadrado con la flecha hacia arriba»— y sí se
// reconocen de un vistazo. Los iconos son SVG propios, con el mismo
// criterio que Icono.jsx: son cuatro trazos y no compensa una librería.
// ------------------------------------------------------------------

function IconoCompartir() {
  // El de iOS: cuadrado abierto por arriba con una flecha saliendo.
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v7A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 17.5 10H16" />
      <path d="M12 14V3.5" />
      <path d="m8.5 7 3.5-3.5L15.5 7" />
    </svg>
  )
}

function IconoMenu() {
  // Los tres puntos de Chrome en Android.
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  )
}

function IconoMas() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  )
}

// El móvil de mentira donde se enseña dónde está cada botón. Sale más a
// cuenta dibujarlo que capturar pantallas: una captura envejece con cada
// versión de iOS y encima habría que hacer una por idioma.
function Movil({ arriba = false, children }) {
  return (
    <div className="movil-guia" aria-hidden="true">
      <div className={'movil-barra' + (arriba ? ' arriba' : '')}>{children}</div>
      <div className="movil-pantalla">
        <img src={import.meta.env.BASE_URL + 'icon-192.png'} alt="" width="42" height="42" />
      </div>
    </div>
  )
}

function Paso({ n, children }) {
  return (
    <li className="paso-instalar">
      <span className="paso-numero">{n}</span>
      <span className="crece">{children}</span>
    </li>
  )
}

/**
 * @param todos  enseña los pasos de iOS Y de Android, en vez de solo los
 *   de este aparato. Hace falta en Panel → Dispositivos: ahí un adulto
 *   mira SU móvil para explicárselo a quien tiene otro, así que detectar
 *   la plataforma acertaría con la persona equivocada.
 */
export default function GuiaInstalar({ onCerrar, todos = false }) {
  const [evento, setEvento] = useState(null)
  const instalada = abiertaComoApp()
  const plataforma = plataformaDeEsteAparato()

  useEffect(() => {
    // Android y escritorio avisan de que se puede instalar. Hay que
    // quedarse el evento: solo se puede usar UNA vez y solo si se guardó
    // cuando llegó, que puede ser antes de que nadie abra esta pantalla.
    const alPoder = (e) => {
      e.preventDefault()
      setEvento(e)
    }
    window.addEventListener('beforeinstallprompt', alPoder)
    return () => window.removeEventListener('beforeinstallprompt', alPoder)
  }, [])

  const ofrecer = queOfrecer({ instalada, plataforma, hayEvento: Boolean(evento) })

  async function instalarYa() {
    if (!evento) return
    evento.prompt()
    await evento.userChoice
    // El evento no se puede reutilizar, lo diga el usuario o no.
    setEvento(null)
  }

  const verIos = todos || plataforma === 'ios'
  const verAndroid = todos || plataforma === 'android'

  if (instalada && !todos) {
    return (
      <div className="guia-instalar">
        <p className="suave">
          Ya la tienes instalada en este aparato: la has abierto desde su icono. No hay nada que hacer.
        </p>
        {onCerrar && <button className="btn btn-bloque" onClick={onCerrar}>Cerrar</button>}
      </div>
    )
  }

  return (
    <div className="guia-instalar">
      <p className="suave" style={{ marginTop: 0 }}>
        Ponla en la pantalla de inicio y se abre como una app: a pantalla completa, sin la barra del
        navegador. En iPhone además es la <strong>única forma</strong> de que lleguen los avisos.
      </p>

      {ofrecer === 'boton' && (
        <>
          <button className="btn btn-bloque" onClick={instalarYa}>Instalar en este aparato</button>
          <p className="suave" style={{ fontSize: '.8rem' }}>
            Tu navegador puede hacerlo de un toque. Si prefieres, también está en su menú.
          </p>
        </>
      )}

      {verIos && (
        <div className="carta">
          {todos && <strong>📱 iPhone y iPad</strong>}
          <div className="fila" style={{ alignItems: 'center', gap: 14 }}>
            <Movil><IconoCompartir /></Movil>
            <ol className="lista-instalar crece">
              <Paso n="1">
                Toca <strong>Compartir</strong> <IconoCompartir />, abajo del todo en Safari.
              </Paso>
              <Paso n="2">
                Baja por la lista y elige <strong>Añadir a pantalla de inicio</strong> <IconoMas />.
              </Paso>
              <Paso n="3">Toca <strong>Añadir</strong> y listo: ya tienes el icono.</Paso>
            </ol>
          </div>
          <p className="suave" style={{ fontSize: '.8rem' }}>
            Si no ves esa opción, abre <strong>elgremioapp.com</strong> en <strong>Safari</strong>: otros
            navegadores del iPhone no siempre la ofrecen.
          </p>
        </div>
      )}

      {verAndroid && (
        <div className="carta">
          {todos && <strong>🤖 Android</strong>}
          <div className="fila" style={{ alignItems: 'center', gap: 14 }}>
            <Movil arriba><IconoMenu /></Movil>
            <ol className="lista-instalar crece">
              <Paso n="1">
                Toca el menú <strong>⋮</strong> <IconoMenu />, arriba a la derecha en Chrome.
              </Paso>
              <Paso n="2">
                Elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.
              </Paso>
              <Paso n="3">Confirma y ya está: aparece con las demás apps.</Paso>
            </ol>
          </div>
        </div>
      )}

      {!todos && ofrecer === null && plataforma === 'escritorio' && (
        <p className="suave">
          En ordenador se usa igual desde el navegador; no hace falta instalar nada. La instalación tiene
          sentido en el móvil y en la tablet, que es donde se usa a diario.
        </p>
      )}

      {onCerrar && (
        <button className="btn btn-fantasma btn-bloque" style={{ marginTop: 10 }} onClick={onCerrar}>
          Cerrar
        </button>
      )}
    </div>
  )
}
