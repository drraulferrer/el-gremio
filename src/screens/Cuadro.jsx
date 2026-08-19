// ------------------------------------------------------------------
// Cuadro de mando del panel parental.
//
// Lo que hay que ver antes de repartir misiones otra vez, en una sola
// pantalla: quién tiene qué, quién está cumpliendo, quién puso qué en la
// meta y qué premios se ha llevado.
//
// Vive detrás del PIN y no se enseña en el tablero de nadie. La app no
// tiene ranking a propósito, y esto lo sería si lo viesen las niñas: por
// eso el reparto se dibuja como una sola barra repartida —la meta es de
// todos— y las fichas van ordenadas por rol, nunca por lo aportado.
// ------------------------------------------------------------------

import { resumenDelGremio } from '../lib/resumen'
import { avisoDeCarga } from '../lib/economia'
import { misionesDe } from '../lib/misiones'
import { perfilesActivos } from '../lib/miembros'
import { flex, generoDe } from '../lib/genero'
import { estadoDeTemporada } from '../lib/temporadas'
import { ROLE_LABEL } from '../lib/supabase'
import { Talis } from '../components/ui'

const DIA_MS = 86400000

function haceCuanto(fecha) {
  const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / DIA_MS)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  const semanas = Math.round(dias / 7)
  return semanas === 1 ? 'hace una semana' : `hace ${semanas} semanas`
}

export default function Cuadro({ data }) {
  // Solo gente activa: un perfil retirado conserva su historial, pero
  // meterlo aquí sería contar con alguien que ya no hace misiones y dejar
  // el reparto de la meta descuadrado para siempre.
  const activos = perfilesActivos(data.profiles)
  const gremio = resumenDelGremio({ ...data, profiles: activos })
  const temporada = estadoDeTemporada(data.goals || [])

  return (
    <div>
      <div className="titulo-seccion">El gremio de un vistazo</div>

      <div className="carta">
        <div className="fila-separada" style={{ marginBottom: 10 }}>
          <strong style={{ fontFamily: 'var(--display)' }}>
            {temporada.rango.emoji} {temporada.rango.nombre}
          </strong>
          <span className="suave">{gremio.xpSemana} XP esta semana</span>
        </div>

        {gremio.meta ? (
          <>
            <div className="fila-separada">
              <span>{gremio.meta.emoji} {gremio.meta.titulo}</span>
              <span className="suave">{gremio.meta.progreso} / {gremio.meta.objetivo} XP</span>
            </div>

            {/* Una sola barra repartida, no una por persona. Cuatro barras
                enfrentadas son una clasificación; esta enseña lo mismo y
                sigue diciendo que la meta es de todos. */}
            <div className="barra-reparto" style={{ marginTop: 8 }}>
              {gremio.personas
                .filter((r) => r.meta.xp > 0)
                .map((r) => (
                  <span
                    key={r.perfil.id}
                    style={{ width: r.meta.pct + '%', background: r.perfil.color }}
                    title={`${r.perfil.name}: ${r.meta.xp} XP`}
                  />
                ))}
            </div>
            <div className="leyenda-reparto">
              {gremio.personas
                .filter((r) => r.meta.xp > 0)
                .map((r) => (
                  <span key={r.perfil.id}>
                    <i style={{ background: r.perfil.color }} /> {r.perfil.emoji} {r.meta.pct} %
                  </span>
                ))}
            </div>
          </>
        ) : (
          <p className="suave" style={{ margin: 0 }}>
            Sin meta activa. Se propone la siguiente desde la pestaña Meta.
          </p>
        )}

        {gremio.sinActividad.length > 0 && (
          <p className="suave" style={{ margin: '10px 0 0' }}>
            Esta semana no ha validado nada: <strong>{gremio.sinActividad.join(', ')}</strong>.
          </p>
        )}
      </div>

      <div className="titulo-seccion">Persona a persona</div>

      {gremio.personas.map((r) => (
        <FichaPersona key={r.perfil.id} r={r} challenges={data.challenges} />
      ))}
    </div>
  )
}

function FichaPersona({ r, challenges }) {
  const p = r.perfil
  const genero = generoDe(p)
  const carga = avisoDeCarga(misionesDe(p, challenges), p.name)

  return (
    <div className="carta">
      <div className="fila" style={{ marginBottom: 10 }}>
        <div className="avatar" style={{ borderColor: p.color }}>{p.emoji}</div>
        <div className="crece">
          <div className="fila-separada">
            <strong>{p.name}</strong>
            <span className="suave">{flex(ROLE_LABEL[p.role], genero)} · nivel {r.nivel}</span>
          </div>
          <div className="suave" style={{ fontSize: '0.82rem' }}>
            {r.xp} XP · <Talis n={r.monedas} />
            {r.extras.aMano > 0 && ` (${r.extras.aMano} a mano)`}
            {r.extras.limpieza > 0 && ` (${r.extras.limpieza} de botín)`}
          </div>
        </div>
      </div>

      <div className="rejilla-cifras">
        <Cifra n={r.asignadas.total} pie="asignadas" detalle={`${r.asignadas.diario || 0} al día`} />
        <Cifra n={r.completadas.semana} pie="esta semana" detalle={`${r.completadas.hoy} hoy`} />
        <Cifra n={r.meta.pct + ' %'} pie="de la meta" detalle={`${r.meta.xp} XP`} />
        <Cifra n={r.premios.entregados} pie="premios" detalle={r.premios.enCamino ? `${r.premios.enCamino} en camino` : null} />
      </div>

      {/* La línea de abajo es la que de verdad se lee: lo que hay que
          hacer con esta persona hoy, si es que hay algo. */}
      {r.pendientes > 0 && (
        <p className="suave" style={{ margin: '8px 0 0' }}>
          ⏳ {r.pendientes} {r.pendientes === 1 ? 'misión espera' : 'misiones esperan'} tu validación.
        </p>
      )}
      {r.devueltas > 0 && (
        <p className="suave" style={{ margin: '4px 0 0' }}>
          ↩︎ {r.devueltas} {r.devueltas === 1 ? 'devuelta' : 'devueltas'} esta semana.
        </p>
      )}
      {r.asignadas.total === 0 && (
        <p className="suave" style={{ margin: '8px 0 0' }}>
          No tiene ninguna misión asignada: su tablero le sale vacío.
        </p>
      )}
      {r.premios.ultimo && (
        <p className="suave" style={{ margin: '4px 0 0' }}>
          🎁 Último premio: {r.premios.ultimo.titulo}, {haceCuanto(r.premios.ultimo.cuando)}.
        </p>
      )}
      {carga && (
        <p className="suave" style={{ margin: '8px 0 0', color: '#d99a2b' }}>{carga.texto}</p>
      )}
    </div>
  )
}

function Cifra({ n, pie, detalle }) {
  return (
    <div className="cifra">
      <strong>{n}</strong>
      <span className="cifra-pie">{pie}</span>
      {detalle && <span className="cifra-detalle">{detalle}</span>}
    </div>
  )
}
