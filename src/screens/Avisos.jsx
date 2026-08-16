// ------------------------------------------------------------------
// Avisos push, en Ajustes.
//
// Se enciende POR APARATO y para la persona que lo está usando: es lo que
// espera cualquiera («activar en este móvil») y además es lo único que el
// navegador permite, porque la suscripción pertenece a la instalación.
//
// El botón está aquí, detrás del PIN, y no en la pantalla de la junior a
// propósito: pedir el permiso es un gesto de una sola vez y, si se
// deniega, el navegador no vuelve a preguntar nunca. Mejor que lo haga un
// adulto con el móvil en la mano que una niña de once años a la carrera.
// ------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { estadoDePush, activarAvisos, apagarAvisos } from '../lib/push'
import { perfilesActivos } from '../lib/miembros'

const EXPLICACION = {
  imposible: {
    tono: 'suave',
    texto:
      'Este aparato no admite avisos. En iPhone hay que abrir la app desde el icono de la pantalla de inicio, no desde una pestaña de Safari.'
  },
  'sin-clave': {
    tono: 'error-texto',
    texto: 'Falta la clave pública de avisos (VITE_VAPID_PUBLIC) en el despliegue.'
  },
  bloqueado: {
    tono: 'error-texto',
    texto:
      'Los avisos están bloqueados en este aparato. Hay que volver a permitirlos desde los ajustes del navegador; desde aquí ya no se puede preguntar.'
  }
}

export default function Avisos({ family, data }) {
  const [estado, setEstado] = useState('cargando')
  const [quien, setQuien] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const gente = perfilesActivos(data.profiles).filter((p) => p.role !== 'peque')

  useEffect(() => {
    estadoDePush().then(setEstado)
    // El perfil por defecto es el que tiene elegido ESTE aparato: casi
    // siempre es el correcto, porque quien enciende los avisos en un móvil
    // es quien lo usa.
    setQuien(localStorage.getItem('gremio_profile') || gente[0]?.id || '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function encender() {
    const profile = gente.find((p) => p.id === quien)
    if (!profile) return setAviso('Elige para quién es este aparato.')
    setOcupado(true)
    setAviso('')
    const { ok, mensaje } = await activarAvisos({ family, profile })
    setEstado(await estadoDePush())
    setAviso(ok ? '' : mensaje)
    setOcupado(false)
  }

  async function apagar() {
    setOcupado(true)
    const { ok, mensaje } = await apagarAvisos()
    setEstado(await estadoDePush())
    setAviso(ok ? '' : mensaje)
    setOcupado(false)
  }

  const explicacion = EXPLICACION[estado]

  return (
    <div>
      <p className="suave" style={{ margin: '0 4px 12px' }}>
        Un aviso al día como mucho, entre las cinco y las nueve de la tarde, y solo cuando hay algo que hacer:
        una racha a punto de romperse, misiones esperando validación o alguien que lleva días sin aparecer.
        Quien ya ha hecho algo ese día no recibe nada.
      </p>

      {aviso && <p className="error-texto" role="alert">{aviso}</p>}

      {explicacion && <p className={explicacion.tono} style={{ margin: '0 4px 12px' }}>{explicacion.texto}</p>}

      {estado === 'apagado' && (
        <div className="carta">
          <div className="campo">
            <label htmlFor="avisos-quien">¿De quién es este aparato?</label>
            <select id="avisos-quien" value={quien} onChange={(e) => setQuien(e.target.value)}>
              <option value="">Elige a alguien</option>
              {gente.map((p) => (
                <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
              ))}
            </select>
            <span className="suave">
              Recibirá los avisos aquí. Si luego se cambia de perfil en este aparato, se ajusta solo.
            </span>
          </div>
          <button className="btn btn-bloque" disabled={ocupado || !quien} onClick={encender}>
            🔔 Activar avisos en este aparato
          </button>
        </div>
      )}

      {estado === 'encendido' && (
        <div className="carta">
          <div className="fila-separada">
            <strong>🔔 Avisos activados en este aparato</strong>
            <button className="btn btn-fantasma btn-mini" disabled={ocupado} onClick={apagar}>
              Apagar
            </button>
          </div>
          <p className="suave" style={{ margin: '8px 0 0' }}>
            La peque nunca recibe avisos, aunque este aparato sea el suyo.
          </p>
        </div>
      )}

      {data.pushLog?.length > 0 && (
        <>
          <div className="titulo-seccion">Últimos avisos enviados</div>
          {data.pushLog.slice(0, 8).map((l) => {
            const p = data.profiles.find((x) => x.id === l.profile_id)
            return (
              <div className="carta" key={l.id}>
                <div className="fila-separada">
                  <strong>{p?.emoji} {l.titulo}</strong>
                  <span className="suave">{l.dia}</span>
                </div>
                <div className="suave">{l.cuerpo}</div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
