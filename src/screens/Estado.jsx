import { useEffect, useState } from 'react'
import { supabase, modoDemo, mensajeDeError } from '../lib/supabase'
import { VERSION, COMMIT, BUILT_AT, RELEASE } from '../lib/version'
import { todasLasFlags, setFlag } from '../lib/flags'
import { resumenErrores } from '../lib/monitoring'
import { vaciar } from '../lib/log'
import { diagnosticoEconomia, veredicto, SUPUESTOS } from '../lib/economia'

// ------------------------------------------------------------------
// Estado del sistema, dentro del panel parental.
//
// Responde a las tres preguntas que uno se hace cuando algo va raro:
// qué versión está corriendo, si el backend responde, y qué ha fallado
// últimamente. Es la contraparte visible de la capa de producción.
// ------------------------------------------------------------------

const DIAS_ROTACION = 90

export default function Estado({ family, data }) {
  const [salud, setSalud] = useState({ estado: 'comprobando' })
  const [flags, setFlags] = useState(() => todasLasFlags())
  const [errores, setErrores] = useState([])

  async function comprobar() {
    setSalud({ estado: 'comprobando' })
    const inicio = Date.now()
    const { data: res, error } = await supabase.rpc('health')
    if (error) setSalud({ estado: 'caido', mensaje: mensajeDeError(error), ms: Date.now() - inicio })
    else setSalud({ estado: 'ok', detalle: res, ms: Date.now() - inicio })
  }

  async function cargarErrores() {
    const { data: filas } = await supabase
      .from('app_logs')
      .select('*')
      .eq('family_id', family.id)
      .order('ts', { ascending: false })
      .limit(20)
    setErrores((filas || []).filter((f) => f.nivel === 'error' || f.nivel === 'warn'))
  }

  useEffect(() => {
    comprobar()
    cargarErrores()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rotadoEn = import.meta.env.VITE_SECRETS_ROTATED_AT
  const diasDesdeRotacion = rotadoEn
    ? Math.floor((Date.now() - new Date(rotadoEn).getTime()) / 86400000)
    : null

  const enMemoria = resumenErrores()
  const eco = diagnosticoEconomia(data)

  return (
    <div>
      <div className="titulo-seccion">Versión desplegada</div>
      <div className="carta">
        <div className="fila-separada">
          <strong>{VERSION}</strong>
          <span className="chip">{COMMIT}</span>
        </div>
        <div className="suave" style={{ marginTop: 6 }}>
          Compilada el {BUILT_AT ? new Date(BUILT_AT).toLocaleString('es-ES') : '—'}
        </div>
        <div className="suave">
          Volver atrás: <code>npm run rollback -- --lista</code> y luego la etiqueta que toque.
        </div>
      </div>

      <div className="titulo-seccion">Salud del backend</div>
      <div className="carta">
        <div className="fila-separada">
          <strong>
            {salud.estado === 'ok' && '🟢 Responde'}
            {salud.estado === 'caido' && '🔴 No responde'}
            {salud.estado === 'comprobando' && '⏳ Comprobando…'}
          </strong>
          {salud.ms !== undefined && <span className="chip">{salud.ms} ms</span>}
        </div>
        {salud.mensaje && <p className="error-texto">{salud.mensaje}</p>}
        {salud.detalle && (
          <div className="suave" style={{ marginTop: 6 }}>
            Postgres {salud.detalle.postgres} · {salud.detalle.pendientes} por validar ·{' '}
            {salud.detalle.errores_24h} errores en 24 h
          </div>
        )}
        {modoDemo && <p className="suave">Modo demo: los datos viven solo en este navegador.</p>}
        <button className="btn btn-fantasma btn-mini" style={{ marginTop: 10 }} onClick={comprobar}>
          Volver a comprobar
        </button>
      </div>

      <div className="titulo-seccion">Rotación de credenciales</div>
      <div className="carta">
        {diasDesdeRotacion === null ? (
          <p className="suave">
            Sin fecha de última rotación. Ponla en <code>VITE_SECRETS_ROTATED_AT</code> y sigue{' '}
            <code>docs/ROTACION-SECRETOS.md</code>.
          </p>
        ) : (
          <div className="fila-separada">
            <strong>{diasDesdeRotacion} días desde la última rotación</strong>
            <span className={'chip' + (diasDesdeRotacion > DIAS_ROTACION ? ' chip-pendiente' : ' chip-hecho')}>
              {diasDesdeRotacion > DIAS_ROTACION ? 'toca rotar' : 'al día'}
            </span>
          </div>
        )}
      </div>

      <div className="titulo-seccion">Equilibrio de la economía</div>
      <p className="suave" style={{ margin: '0 4px 10px' }}>
        Con lo que hay activo ahora mismo y una adherencia del {Math.round(SUPUESTOS.adherencia * 100)} %. Si un
        nivel se consigue demasiado rápido, los premios dejan de valer; si cuesta demasiado, nadie llega.
      </p>

      <div className="carta">
        {eco.porPersona.map((x) => (
          <div className="fila-separada" key={x.perfil.id} style={{ padding: '5px 0' }}>
            <span>{x.perfil.emoji} {x.perfil.name}</span>
            <span className="suave">
              {x.misiones} misiones · {x.monedasDia.toFixed(0)} 🪙/día · {x.xpDia.toFixed(0)} XP/día
            </span>
          </div>
        ))}
      </div>

      {eco.niveles.map((n) => {
        const v = veredicto(n.diasMax, n.objetivo)
        return (
          <div className="carta" key={n.nivel}>
            <div className="fila-separada">
              <strong>{'⭐'.repeat(n.nivel)} Nivel {n.nivel}</strong>
              <span className={'chip' + (v.estado === 'ok' ? ' chip-hecho' : v.estado === 'sin_datos' ? '' : ' chip-pendiente')}>
                {v.texto}
              </span>
            </div>
            <div className="suave" style={{ marginTop: 4 }}>
              {n.premios === 0
                ? 'Sin premios activos de este nivel.'
                : `${n.premios} premios, ${Math.round(n.precioMedio)} 🪙 de media · se consigue cada ${n.diasMin.toFixed(0)}-${n.diasMax.toFixed(0)} días (objetivo: ${n.objetivo})`}
            </div>
          </div>
        )
      })}

      {eco.meta && (
        <div className="carta">
          <div className="fila-separada">
            <strong>🏰 Meta del gremio</strong>
            <span className={'chip' + (veredicto(eco.meta.dias, eco.cadenciaMeta).estado === 'ok' ? ' chip-hecho' : ' chip-pendiente')}>
              {veredicto(eco.meta.dias, eco.cadenciaMeta).texto}
            </span>
          </div>
          <div className="suave" style={{ marginTop: 4 }}>
            {eco.meta.objetivoXp} XP a {eco.xpFamiliaDia.toFixed(0)} XP/día ={' '}
            {isFinite(eco.meta.dias) ? eco.meta.dias.toFixed(0) : '∞'} días (objetivo: {eco.cadenciaMeta})
          </div>
        </div>
      )}

      <div className="titulo-seccion">Banderas</div>
      <div className="carta">
        {Object.entries(flags).map(([nombre, valor]) => (
          <label key={nombre} className="fila" style={{ padding: '8px 0', cursor: 'pointer' }}>
            <input
              type="checkbox"
              style={{ width: 22, height: 22, flex: 'none' }}
              checked={valor}
              onChange={(e) => {
                setFlag(nombre, e.target.checked)
                setFlags(todasLasFlags())
              }}
            />
            <span className="crece">{nombre}</span>
          </label>
        ))}
        <p className="suave">Solo afectan a este dispositivo. Sirven para apagar algo sin desplegar.</p>
      </div>

      <div className="titulo-seccion">Últimos avisos y errores</div>
      {errores.length === 0 && enMemoria.length === 0 && <div className="vacio">Ni un error registrado. Buena señal.</div>}

      {enMemoria.length > 0 && (
        <div className="carta">
          <strong>En esta sesión</strong>
          {enMemoria.slice(0, 5).map((e) => (
            <div className="fila-separada suave" key={e.huella} style={{ marginTop: 6 }}>
              <span className="crece">{e.huella}</span>
              <span className="chip">×{e.veces}</span>
            </div>
          ))}
        </div>
      )}

      {errores.map((e) => (
        <div className="carta" key={e.id}>
          <div className="fila-separada">
            <strong style={{ fontSize: '0.95rem' }}>{e.evento}</strong>
            <span className={'chip ' + (e.nivel === 'error' ? 'chip-pendiente' : '')}>{e.nivel}</span>
          </div>
          <div className="suave">
            {new Date(e.ts).toLocaleString('es-ES')} · {e.release || '—'} · petición {e.request_id || '—'}
          </div>
        </div>
      ))}

      <button
        className="btn btn-fantasma btn-bloque"
        style={{ marginTop: 12 }}
        onClick={async () => {
          await vaciar()
          await cargarErrores()
        }}
      >
        Enviar logs pendientes y recargar
      </button>

      <p className="suave" style={{ margin: '12px 4px 0' }}>
        Release {RELEASE} · {data.profiles.length} perfiles · {data.challenges.length} misiones
      </p>
    </div>
  )
}
