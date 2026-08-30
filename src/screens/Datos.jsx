import { useState } from 'react'
import { supabase, mensajeDeError, zonaDelDispositivo, esColumnaQueNoExiste, configurarZona } from '../lib/supabase'
import DejarElGremio from './DejarElGremio'
import {
  TABLAS_EXPORTADAS, construirExportacion, nombreFichero,
  resumenDeBorrado, confirmacionValida, mensajeDeBorrado
} from '../lib/datos'
import { RELEASE } from '../lib/version'
import { log } from '../lib/log'
import { cerrarSesion } from '../lib/acciones'

// ------------------------------------------------------------------
// Tus datos: la zona horaria de la casa, la copia que te puedes llevar y
// el borrado de la cuenta entera.
//
// Las tres van juntas porque las tres responden a la misma pregunta —de
// quién son estos datos— y porque las dos últimas son obligación legal en
// cuanto esto lo use alguien de fuera: aquí hay nombres y actividad diaria
// de menores.
//
// Vive detrás del PIN, como el resto de ⚙️: no es para que la encuentre
// quien está jugando.
// ------------------------------------------------------------------

// Un puñado de zonas frecuentes para el desplegable. La lista completa la
// da el navegador cuando sabe (`supportedValuesOf`); estas son la red por
// si no, y cubren de dónde puede ser realmente quien use esto hoy.
const ZONAS_FRECUENTES = [
  'Europe/Madrid', 'Atlantic/Canary', 'Europe/Lisbon', 'Europe/London',
  'Europe/Paris', 'Europe/Berlin', 'America/Mexico_City', 'America/Bogota',
  'America/Lima', 'America/Santiago', 'America/Argentina/Buenos_Aires',
  'America/New_York', 'America/Los_Angeles'
]

function zonasDisponibles() {
  try {
    const todas = Intl.supportedValuesOf('timeZone')
    if (todas && todas.length) return todas
  } catch {
    // Navegador sin `supportedValuesOf` (Safari antiguo): con la lista
    // corta se sigue pudiendo elegir, que es lo que importa.
  }
  return ZONAS_FRECUENTES
}

const FALLO_SALIR = 'salir'

export default function Datos({ family, onCambiada, onCuentaBorrada }) {
  const [zona, setZona] = useState(family?.timezone || zonaDelDispositivo())
  const [guardando, setGuardando] = useState(false)
  const [guardada, setGuardada] = useState(false)
  const [fallo, setFallo] = useState('')

  const [bajando, setBajando] = useState(false)
  const [copiaHecha, setCopiaHecha] = useState('')

  // Dos toques para salir, sin modal. Está detrás del PIN, así que no hace
  // falta una ceremonia; pero cerrar la sesión de la casa entera por un
  // roce sí merece una pregunta.
  const [confirmandoSalida, setConfirmandoSalida] = useState(false)
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    if (!confirmandoSalida) {
      setConfirmandoSalida(true)
      return
    }
    setSaliendo(true)
    const { ok } = await cerrarSesion()
    if (!ok) {
      setSaliendo(false)
      setConfirmandoSalida(false)
      setFallo(FALLO_SALIR)
    }
    // Si sale bien no se toca nada más: `onAuthStateChange` en App se
    // entera de que ya no hay sesión y devuelve al login solo.
  }

  const [abierto, setAbierto] = useState(false)
  const [resumen, setResumen] = useState(null)
  const [escrito, setEscrito] = useState('')
  const [borrando, setBorrando] = useState(false)

  const zonas = zonasDisponibles()
  const laDelAparato = zonaDelDispositivo()
  const zonaGuardada = family?.timezone || null

  async function guardarZona() {
    setFallo('')
    setGuardada(false)
    setGuardando(true)
    const { error } = await supabase.from('families').update({ timezone: zona }).eq('id', family.id)
    setGuardando(false)
    if (error) {
      setFallo(esColumnaQueNoExiste(error)
        ? 'Esta base de datos todavía no tiene la migración 018. Ejecútala y vuelve a intentarlo.'
        : mensajeDeError(error))
      return
    }
    // Se aplica en caliente: si no, el resto de la sesión seguiría
    // contando los días con la zona anterior hasta recargar.
    configurarZona(zona)
    log.warn('zona.cambiada', { zona })
    setGuardada(true)
    if (onCambiada) onCambiada()
  }

  // Se descargan las filas en el momento, no se usan las que ya tiene la
  // app en memoria: la pantalla carga lo que necesita para pintar, y una
  // copia a medias es peor que no tenerla.
  async function traerTodo() {
    const tablas = {}
    for (const tabla of TABLAS_EXPORTADAS) {
      const { data, error } = await supabase.from(tabla).select('*')
      if (error) {
        // Una tabla que no existe (base sin migrar) no rompe la copia:
        // sale vacía y el resto se lleva igual.
        if (!esColumnaQueNoExiste(error) && error.code !== '42P01') throw error
        tablas[tabla] = []
        continue
      }
      tablas[tabla] = data || []
    }
    return tablas
  }

  async function descargar() {
    setFallo('')
    setCopiaHecha('')
    setBajando(true)
    try {
      const tablas = await traerTodo()
      const fichero = construirExportacion({ family, tablas, release: RELEASE })
      const nombre = nombreFichero(family)
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(fichero, null, 2)], { type: 'application/json' })
      )
      const a = document.createElement('a')
      a.href = url
      a.download = nombre
      a.click()
      URL.revokeObjectURL(url)
      log.warn('datos.exportados')
      setCopiaHecha(nombre)
    } catch (e) {
      setFallo(mensajeDeError(e))
    } finally {
      setBajando(false)
    }
  }

  async function abrirBorrado() {
    setFallo('')
    setAbierto(true)
    if (resumen) return
    try {
      setResumen(resumenDeBorrado(await traerTodo()))
    } catch (e) {
      setFallo(mensajeDeError(e))
    }
  }

  async function borrar() {
    setFallo('')
    setBorrando(true)
    const { data, error } = await supabase.rpc('delete_my_account')
    if (error) {
      setBorrando(false)
      setFallo(mensajeDeError(error))
      return
    }
    const problema = mensajeDeBorrado(data)
    if (problema) {
      setBorrando(false)
      setFallo(problema)
      return
    }
    // No se registra nada después: la cuenta ya no existe y el registro
    // iría a una tabla que acaba de perder su familia.
    await supabase.auth.signOut()
    if (onCuentaBorrada) onCuentaBorrada()
  }

  const puedeBorrar = confirmacionValida(escrito, family?.name)

  return (
    <div>
      <div className="titulo-seccion">Cerrar sesión</div>

      <div className="carta">
        <p className="suave" style={{ marginTop: 0 }}>
          La cuenta es una sola para toda la casa, así que esto cierra la sesión
          <strong> de este aparato</strong> y habrá que volver a entrar con el correo y la
          contraseña. Para dejarle el sitio a otra persona del gremio no hace falta:
          eso es <strong>Cambiar</strong>, en la barra de abajo.
        </p>
        {fallo === FALLO_SALIR && <p className="error-texto">No se pudo cerrar la sesión. Inténtalo otra vez.</p>}
        <button
          className={'btn btn-bloque' + (confirmandoSalida ? '' : ' btn-fantasma')}
          disabled={saliendo}
          onClick={salir}
        >
          {saliendo ? 'Cerrando…' : confirmandoSalida ? 'Sí, cerrar sesión' : 'Cerrar sesión'}
        </button>
      </div>

      <div className="titulo-seccion">La hora de esta casa</div>

      <div className="carta">
        <div className="campo">
          <label htmlFor="zona-gremio">Zona horaria</label>
          <select
            id="zona-gremio"
            value={zonas.includes(zona) ? zona : ''}
            onChange={(e) => { setZona(e.target.value); setGuardada(false) }}
          >
            {!zonas.includes(zona) && <option value="">{zona}</option>}
            {zonas.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>

        {zona !== laDelAparato && (
          <p className="suave">
            ⚠ Este aparato está en <strong>{laDelAparato}</strong>. Si la familia vive ahí, cámbiala:
            con dos zonas distintas, «hoy» son dos días distintos.
          </p>
        )}

        {fallo && <p className="error-texto" role="alert">{fallo}</p>}
        {guardada && <p style={{ color: 'var(--exito)', fontWeight: 800 }}>✓ Zona guardada.</p>}

        <button
          className="btn btn-bloque"
          disabled={guardando || zona === zonaGuardada}
          onClick={guardarZona}
        >
          {guardando ? 'Guardando…' : 'Guardar zona'}
        </button>

        <p className="suave">
          Decide cuándo empieza el día para las rachas, para la estrella diaria de la peque y para las
          misiones de cada día. La ponen todos los dispositivos por igual, así que da lo mismo desde dónde
          se abra la app.
        </p>
      </div>

      <div className="titulo-seccion">Llevarte tus datos</div>

      <div className="carta">
        <p className="suave">
          Un fichero con todo lo del gremio: miembros, misiones, historial, premios, insignias y metas.
          Se descarga en este aparato y no pasa por ningún sitio más.
        </p>
        <button className="btn btn-fantasma btn-bloque" disabled={bajando} onClick={descargar}>
          {bajando ? 'Preparando…' : '⬇ Descargar una copia (JSON)'}
        </button>
        {copiaHecha && (
          <p style={{ color: 'var(--exito)', fontWeight: 800 }}>✓ Descargado: {copiaHecha}</p>
        )}
        <p className="suave">
          No entran los registros técnicos de errores, que son diagnósticos y no historia de la familia.
          Están en ⚙️ → Estado.
        </p>
      </div>

      {/* Va ANTES de borrar la cuenta y no después, y no es casual: quien
          entra aquí buscando la salida suele querer irse de UN gremio, no
          disolver la casa entera. Si lo primero que encuentra es el botón
          rojo, la puerta que ve es la que no quería. */}
      <DejarElGremio family={family} />

      <div className="titulo-seccion">Borrar la cuenta</div>

      <div className="carta">
        <p className="suave">
          Borra <strong>el gremio entero y la cuenta</strong>: miembros, historial, premios e insignias de
          todo el mundo. No hay papelera y no se puede deshacer. Si quieres guardar recuerdo de esto,
          descarga antes la copia.
        </p>

        {!abierto && (
          <button className="btn btn-peligro btn-bloque" onClick={abrirBorrado}>
            Quiero borrar la cuenta
          </button>
        )}

        {abierto && (
          <>
            {resumen === null && <p className="suave">Contando lo que se va a perder…</p>}
            {resumen && resumen.length > 0 && (
              <ul className="suave">
                {resumen.map((f) => (
                  <li key={f.tabla}><strong>{f.cuantas}</strong> {f.nombre}</li>
                ))}
              </ul>
            )}

            <div className="campo">
              <label htmlFor="confirmar-borrado">
                Escribe el nombre del gremio (<strong>{family?.name}</strong>) para confirmar
              </label>
              <input
                id="confirmar-borrado"
                autoComplete="off"
                value={escrito}
                onChange={(e) => setEscrito(e.target.value)}
              />
            </div>

            {fallo && <p className="error-texto" role="alert">{fallo}</p>}

            <button
              className="btn btn-peligro btn-bloque"
              disabled={!puedeBorrar || borrando}
              onClick={borrar}
            >
              {borrando ? 'Borrando…' : 'Borrar para siempre'}
            </button>
            <button
              className="btn btn-fantasma btn-bloque"
              style={{ marginTop: 8 }}
              disabled={borrando}
              onClick={() => { setAbierto(false); setEscrito(''); setFallo('') }}
            >
              Mejor no
            </button>
          </>
        )}
      </div>
    </div>
  )
}
