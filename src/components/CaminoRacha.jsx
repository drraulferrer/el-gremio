// ------------------------------------------------------------------
// El camino de la racha.
//
// Un contador suelto («llevas 9 días») no dice qué hacer con eso. El
// camino sí: enseña de dónde vienes, en qué tramo estás y cuánto falta
// para el siguiente hito, que es la única frase accionable de las tres.
//
// Se dibuja en VERTICAL y con los logrados arriba. Horizontal obligaba a
// desplazar de lado para ver el final —o a encoger los hitos hasta que no
// se leen— y esta app se usa en un móvil de 360 px.
//
// El cobro se dispara solo al alcanzar un hito. Un botón de «reclamar»
// aquí sería una trampa: quien no lo pulsa se queda sin lo que ya se ha
// ganado, y eso convierte una recompensa en un examen de atención.
// ------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'
import { caminoDe, rachaActual, enRiesgo, hitosPorCobrar, siguienteHito } from '../lib/rachas'
import { cobrarRacha } from '../lib/acciones'
import { diasNeutros } from '../lib/misiones'
import { Talis } from './ui'

export default function CaminoRacha({ data, profile, refresh }) {
  const salvados = (data.powerUses || [])
    .filter((u) => u.profile_id === profile.id && u.tipo === 'salva_racha')
    .map((u) => {
      const d = new Date(u.used_at)
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    })

  // Los días sin misiones asignadas no rompen la racha ni la alargan. Se
  // calculan aquí y se pasan a las dos cuentas: si solo una de las dos los
  // supiera, el camino diría un número y el aviso de riesgo otro.
  const neutros = diasNeutros(profile, data.challenges)
  const racha = rachaActual(data.completions, profile.id, salvados, new Date(), neutros)
  const riesgo = enRiesgo(data.completions, profile.id, salvados, new Date(), neutros)
  const camino = caminoDe(racha)
  const siguiente = siguienteHito(racha)
  const [cobrando, setCobrando] = useState(null)

  // Cobro automático de lo alcanzado y no pagado. El guardia evita que
  // dos renders seguidos disparen dos llamadas por el mismo hito; la
  // regla de verdad —una vez en la vida— la sostiene el índice único de
  // Postgres, no este `useRef`.
  const enCurso = useRef(false)
  useEffect(() => {
    const pendientes = hitosPorCobrar(racha, data.bonuses, profile.id)
    if (!pendientes.length || enCurso.current) return

    let vivo = true
    enCurso.current = true
    ;(async () => {
      for (const hito of pendientes) {
        if (!vivo) break
        setCobrando(hito)
        const { ok } = await cobrarRacha(profile.id, hito.dias)
        if (ok && vivo) await refresh()
      }
      if (vivo) setCobrando(null)
      enCurso.current = false
    })()

    return () => {
      vivo = false
    }
  }, [racha, data.bonuses, profile.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="titulo-seccion">Tu racha</div>

      {cobrando && (
        <div className="carta carta-hito">
          <span className="hito-emoji-grande">{cobrando.emoji}</span>
          <div>
            <strong>¡{cobrando.nombre}!</strong>
            <div className="suave">+{cobrando.monedas} Talis por {cobrando.dias} días seguidos</div>
          </div>
        </div>
      )}

      <div className="carta">
        <div className="fila-separada" style={{ marginBottom: 4 }}>
          {/* La llama se mueve SOLO cuando la racha está en riesgo, que
              es la otra mitad de la lección del `latido` (§ lib/latido):
              una animación permanente deja de comunicar en dos días.
              Duolingo apaga su llama cuando no has practicado; aquí no
              se apaga —sería castigar a mediodía, que es lo que este
              camino evita a propósito— sino que se inquieta, y solo el
              día que hay algo que hacer. */}
          <span className={'racha-numero' + (riesgo ? ' inquieta' : '')}>
            <span className="racha-llama" aria-hidden="true">{racha > 0 ? '🔥' : '🌑'}</span> {racha}
            <em>{racha === 1 ? ' día' : ' días'}</em>
          </span>
          {siguiente && (
            <span className="suave">
              {siguiente.faltan ?? siguiente.dias - racha} para {siguiente.emoji}
            </span>
          )}
        </div>

        {/* El aviso es la pieza que hace levantarse del sofá, y por eso
            NO dice «la vas a perder»: dice qué falta para conservarla.
            Amenazar funciona una semana; recordar funciona siempre. */}
        {riesgo ? (
          <p className="racha-aviso">Hoy todavía no has validado nada. Una misión y sigue viva.</p>
        ) : racha === 0 ? (
          <p className="suave" style={{ margin: 0 }}>
            Una misión hoy y empieza la racha.
          </p>
        ) : (
          <p className="suave" style={{ margin: 0 }}>
            Al día. Vuelve mañana para que siga creciendo.
          </p>
        )}

        <ol className="camino">
          {camino.map((h) => (
            <li key={h.dias} className={'hito ' + h.estado}>
              <span className="hito-marca" aria-hidden="true">{h.estado === 'logrado' ? '✓' : h.emoji}</span>
              <div className="crece">
                <div className="fila-separada">
                  <strong>{h.nombre}</strong>
                  <span className="suave">{h.dias} días · <Talis n={h.monedas} /></span>
                </div>
                {h.estado === 'siguiente' && (
                  <>
                    <div className="barra-hito">
                      <div style={{ width: h.pct + '%' }} />
                    </div>
                    <div className="suave" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                      {h.faltan === 1 ? 'Falta 1 día' : `Faltan ${h.faltan} días`}
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}
