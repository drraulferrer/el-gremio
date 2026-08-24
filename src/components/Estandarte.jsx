// ------------------------------------------------------------------
// El estandarte del gremio: rango de la temporada y meta compartida.
//
// Estaba escrito dentro de Home y hubo que sacarlo cuando el Panorama
// pasó a ser la primera pantalla: lo necesitaban los dos, y dos copias
// del mismo bloque es como una acaba diciendo una cosa y la otra otra.
//
// La decisión que lleva dentro no ha cambiado: el sello va ENCIMA de la
// meta y el bloque entero sobrevive a que no haya meta activa. La barra
// se vacía al cerrar una meta, y si con ella desapareciera el rango,
// cerrar una meta se sentiría como perder el progreso. Es justo lo que
// las temporadas venían a arreglar.
// ------------------------------------------------------------------

import { goalProgress } from '../lib/supabase'
import { estadoDeTemporada } from '../lib/temporadas'

export default function Estandarte({ data }) {
  const goal = data.goal
  const temporada = estadoDeTemporada(data.goals || [])
  const progreso = goalProgress(goal, data.completions)

  if (!goal && temporada.metasLogradas === 0) return null

  return (
    <div className="estandarte">
      <div className="sello-gremio">
        <span className="sello-emoji" aria-hidden="true">{temporada.rango.emoji}</span>
        <div className="crece">
          <div className="sello-nombre">{temporada.rango.nombre}</div>
          {temporada.metasLogradas > 0 && (
            <div className="suave" style={{ fontSize: '0.78rem' }}>
              {temporada.metasLogradas} {temporada.metasLogradas === 1 ? 'meta lograda' : 'metas logradas'} ·
              {' '}{temporada.xpHistorica} XP de por vida
            </div>
          )}
        </div>
      </div>

      {/* Decorativa: separa el rango de la meta. aria-hidden porque no
          hay nada que anunciar. */}
      <div className="filigrana" aria-hidden="true" />

      {goal ? (
        <>
          <div className="fila-separada">
            <strong style={{ fontFamily: 'var(--display)' }}>{goal.emoji} {goal.title}</strong>
            <span className="suave">{Math.min(progreso, goal.target_xp)} / {goal.target_xp} XP</span>
          </div>
          <div className="xpbar" style={{ marginTop: 8 }}>
            {/* Sin color en línea: la meta es reconocimiento y su oro lo
                pone `.estandarte .xpbar-fill` en la hoja. */}
            <div
              className="xpbar-fill"
              style={{ width: Math.min(100, Math.round((100 * progreso) / goal.target_xp)) + '%' }}
            />
            <div className="xpbar-pips"><span /><span /><span /><span /><span /></div>
          </div>
          {progreso >= goal.target_xp && (
            <p style={{ marginTop: 8, color: 'var(--exito)', fontWeight: 800 }}>¡Meta del gremio conseguida! 🎉</p>
          )}
        </>
      ) : (
        <p className="suave" style={{ margin: 0 }}>
          Temporada {temporada.temporada}: sin meta todavía. Un adulto puede proponer la siguiente desde el panel.
        </p>
      )}
    </div>
  )
}
