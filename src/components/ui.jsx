import { useEffect, useState } from 'react'
import { levelProgress, hashPin } from '../lib/supabase'
import { estaAbierto, recordarAbierto } from '../lib/plegado'
import Icono from './Icono'
import { BOLSA, TALIS, talis } from '../lib/talis'
import { useContador, quiereMenosMovimiento } from '../lib/contador'
import { duracionCelebracion, escalonDe, estrellasDe } from '../lib/celebracion'

/**
 * Pestaña de la barra inferior. Icono + rótulo siempre: una barra de solo
 * iconos obliga a adivinar, y el estado activo se marca con fondo, color
 * y pastilla, nunca solo con color.
 */
export function Pestana({ icono, etiqueta, activa = false, onClick, aviso, punto = false }) {
  // `punto` es un aviso SIN número, y existe por una regla de producto: lo
  // que hay detrás son reconocimientos recibidos, y esos no se cuentan en
  // ninguna pantalla (§10.1 de docs/RECONOCIMIENTOS.md). Un número ahí
  // convertiría el muro en un marcador.
  const etiquetaLeida = aviso
    ? `${etiqueta}, ${aviso} pendientes`
    : punto ? `${etiqueta}, hay algo nuevo` : etiqueta
  return (
    <button
      className={'tab' + (activa ? ' activa' : '')}
      onClick={onClick}
      aria-current={activa ? 'page' : undefined}
      aria-label={etiquetaLeida}
    >
      <Icono nombre={icono} className="tab-icono" />
      <span className="tab-etiqueta">{etiqueta}</span>
      {aviso > 0 && <span className="tab-aviso" aria-hidden="true">{aviso}</span>}
      {!aviso && punto && <span className="tab-aviso tab-punto" aria-hidden="true" />}
    </button>
  )
}

export function Gema({ xp, color, mini = false }) {
  const { level } = levelProgress(xp)
  // El color del miembro va al halo, no a la piedra: la gema es la misma
  // pieza para todos —cristal teal con aro dorado— y lo que distingue a
  // cada cual es la luz que proyecta por detrás.
  const halo = { '--gema-halo': color, ...(mini ? { width: 44, height: 44 } : {}) }
  return (
    <div className="gema-wrap" style={halo}>
      <div className={'gema' + (mini ? ' gema-mini' : '')}>
        {level}
      </div>
    </div>
  )
}

export function XPBar({ xp, tone }) {
  const p = levelProgress(xp)

  // La cifra sube a la vez que la barra se llena. Antes la barra se
  // movía 0,6 s y el número de al lado ya estaba puesto desde el primer
  // fotograma: la mitad de la animación contradecía a la otra mitad.
  //
  // Al subir de NIVEL, `current` baja (vuelve a empezar el tramo), y
  // `useContador` no anima las bajadas: el número se planta, que es lo
  // correcto —ahí lo que se celebra es el nivel, no el contador—.
  const actual = useContador(p.current)

  return (
    <div>
      <div className="xpbar" aria-label={`Nivel ${p.level}, ${p.current} de ${p.needed} XP`}>
        <div className={'xpbar-fill' + (tone ? ' ' + tone : '')} style={{ width: p.pct + '%' }} />
        <div className="xpbar-pips">
          <span /><span /><span /><span /><span />
        </div>
      </div>
      <div className="fila-separada suave" style={{ marginTop: 4 }}>
        <span>Nivel {p.level}</span>
        <span>{actual} / {p.needed} XP</span>
      </div>
    </div>
  )
}

// La Bolsa de Talis. Desde la 2.5.0 la ficha es la pieza grabada de la
// guía en vez del emoji 🪙: un Talis no es una moneda cualquiera, y con
// el emoji del sistema cada plataforma dibujaba una distinta.
export function Bolsa({ n }) {
  // Sube contando al ganar; al gastar en la tienda se planta en el
  // número nuevo. El `aria-label` lleva SIEMPRE la cifra de verdad: un
  // lector de pantalla leyendo una cuenta atrás de siete números
  // intermedios no está celebrando nada, está estorbando.
  const mostrado = useContador(n)
  return (
    <span className="bolsa" aria-label={`${BOLSA}: ${talis(n)}`}>
      <img src="/assets/talis.png" alt="" className="ficha-talis" />
      <span aria-hidden="true">{mostrado}</span>
    </span>
  )
}

/**
 * Una cantidad de Talis en medio de cualquier texto: precios de la
 * tienda, resúmenes, importes del panel.
 *
 * En 2.5.0 la ficha grabada solo llegó a la Bolsa de la cabecera, y el
 * emoji 🪙 se quedó en los otros veinte sitios donde aparece un importe
 * —la tienda entre ellos—. Cada plataforma lo dibuja distinto, así que
 * la misma app enseñaba dos monedas diferentes en la misma pantalla.
 *
 * La ficha se mide en `em`, no en píxeles: aquí va dentro de texto de
 * 0,78 rem tanto como de 1 rem, y a 18 px fijos se comía la línea.
 *
 * Para un lector de pantalla esto dice «120 Talis», que es más de lo que
 * decía el emoji: 🪙 se leía como «moneda», justo el marco que el
 * vocabulario de `talis.js` lleva desde la 2.4.0 evitando.
 */
export function Talis({ n, children }) {
  return (
    <span className="importe-talis">
      {n !== undefined ? Number(n || 0).toLocaleString('es-ES') : children}
      <img src="/assets/talis.png" alt={TALIS} className="ficha-linea" />
    </span>
  )
}

export function Modal({ titulo, onClose, children }) {
  return (
    <div className="modal-fondo" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="fila-separada" style={{ marginBottom: 12 }}>
          <h3>{titulo}</h3>
          <button className="btn-icono" onClick={onClose} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function PinModal({ family, onOk, onClose }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  async function comprobar() {
    const h = await hashPin(pin)
    if (h === family.parent_pin_hash) onOk()
    else { setError('Ese PIN no es. Prueba otra vez.'); setPin('') }
  }

  return (
    <Modal titulo="Panel parental" onClose={onClose}>
      <div className="campo">
        <label>PIN parental</label>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') comprobar() }}
          placeholder="····"
        />
      </div>
      {error && <p className="error-texto">{error}</p>}
      <button className="btn btn-bloque" onClick={comprobar} disabled={pin.length < 4}>Entrar</button>
    </Modal>
  )
}

const ESTRELLAS = ['⭐', '✨', '🌟', '💫']

/**
 * La celebración, en tres tamaños.
 *
 * `intensidad` decide cuánto dura, cuántas estrellas caen y cuánto crece
 * la caja: `chispa` para confirmar algo, `normal` para una misión
 * aprobada, `hito` para lo que pasa una vez cada muchas (subir de nivel).
 * El porqué de la escala está en `lib/celebracion.js`.
 *
 * Sin `intensidad` se comporta exactamente como antes de la 2.22.0, que
 * es lo que hace que este cambio no toque las veinte llamadas que ya
 * había repartidas por la app.
 */
export function Celebracion({ emoji = '🌟', texto, elogio, intensidad = 'normal', onDone }) {
  const { clase } = escalonDe(intensidad)
  const cuantas = estrellasDe(intensidad, quiereMenosMovimiento())

  useEffect(() => {
    const t = setTimeout(onDone, duracionCelebracion(intensidad, Boolean(elogio)))
    return () => clearTimeout(t)
  }, [onDone, elogio, intensidad])

  return (
    <div className={'celebracion' + (clase ? ' ' + clase : '')} onClick={onDone}>
      {Array.from({ length: cuantas }, (_, i) => {
        const ang = (i / cuantas) * Math.PI * 2
        const dist = 120 + (i % 3) * 55
        const style = {
          left: '50%',
          top: '45%',
          '--dx': Math.cos(ang) * dist + 'px',
          '--dy': Math.sin(ang) * dist + 'px'
        }
        return <span key={i} className="estrella-volandera" style={style}>{ESTRELLAS[i % ESTRELLAS.length]}</span>
      })}
      <div className="celebracion-caja">
        <span className="celebracion-emoji">{emoji}</span>
        <span className="celebracion-texto">{texto}</span>
        {elogio && <span className="celebracion-elogio">“{elogio}”</span>}
      </div>
    </div>
  )
}

/**
 * Sección plegable con memoria.
 *
 * `<details>` de verdad y no un div con `onClick`: el navegador ya sabe
 * abrirlo con el teclado, anunciarlo a un lector de pantalla y buscar
 * dentro del texto plegado. Reescribir eso a mano siempre sale peor.
 *
 * La `pista` es lo que se ve SIN abrir, y es lo que decide si esto ayuda
 * o estorba: una cabecera muda obliga a abrir para saber si hay algo.
 * `marca` es un punto sin número —lo que hay detrás son reconocimientos
 * recibidos, y esos no se cuentan en ninguna pantalla (§10.1)—.
 */
export function Plegable({ id, titulo, pista = '', marca = false, alAbrir, children }) {
  const [abierto, setAbierto] = useState(() => estaAbierto(id))

  return (
    <details
      className="plegable"
      open={abierto}
      onToggle={(e) => {
        const ahora = e.currentTarget.open
        if (ahora === abierto) return
        setAbierto(recordarAbierto(id, ahora))
        if (ahora) alAbrir?.()
      }}
    >
      <summary>
        <span className="crece">
          {titulo}
          {pista && <span className="plegable-pista">{pista}</span>}
        </span>
        {marca && <span className="tab-aviso tab-punto plegable-marca" aria-label="hay algo nuevo" />}
        <span className="plegable-flecha" aria-hidden="true">{abierto ? '▾' : '▸'}</span>
      </summary>
      <div className="plegable-cuerpo">{children}</div>
    </details>
  )
}
