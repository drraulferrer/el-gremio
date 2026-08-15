// ------------------------------------------------------------------
// Los poderes de las insignias, en la pantalla.
//
// Una insignia decorativa se mira una vez; una que hace algo se busca. De
// eso va esta sección: enseña SOLO lo que está activo ahora mismo y lo que
// se puede gastar, no el catálogo entero. El catálogo completo ya está más
// abajo, en la parrilla de insignias, y repetirlo aquí convertiría un
// botón útil en una lista más.
//
// Los usos los cuenta Postgres (`spend_power`). Aquí se dibujan los que
// quedan, pero quien decide si queda alguno es la base: si la cuenta
// viviera en el navegador, recargar devolvería los usos.
// ------------------------------------------------------------------

import { useState } from 'react'
import { Modal } from './ui'
import { PODERES, PODERES_LISTOS, insigniaPorCodigo, poderActivo, usosRestantes } from '../lib/insignias'
import { gastarPoder } from '../lib/acciones'
import { perfilesActivos } from '../lib/miembros'
import { flex } from '../lib/genero'

function diasQueQuedan(ganada, poder) {
  if (!poder?.dias || !ganada?.earned_at) return null
  const caduca = new Date(ganada.earned_at).getTime() + poder.dias * 86400000
  return Math.max(0, Math.ceil((caduca - Date.now()) / 86400000))
}

export default function Poderes({ data, profile, refresh, genero }) {
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(null)
  const [encargando, setEncargando] = useState(null)

  const gastados = (data.powerUses || [])
    .filter((u) => u.profile_id === profile.id)
    .reduce((acc, u) => ({ ...acc, [u.code]: (acc[u.code] || 0) + 1 }), {})

  const activos = data.badges
    .filter((b) => b.profile_id === profile.id)
    .map((ganada) => ({ ganada, def: insigniaPorCodigo(ganada.code), poder: poderActivo(ganada) }))
    // Solo los que hacen algo hoy: ver PODERES_LISTOS en insignias.js.
    .filter((x) => x.def && x.poder && PODERES_LISTOS.has(x.poder.tipo))

  async function usar({ code, poder, destino = null, nota = '' }) {
    setOcupado(code)
    setAviso('')
    const { ok, mensaje } = await gastarPoder({
      profileId: profile.id,
      code,
      tipo: poder.tipo,
      usos: poder.usos,
      dias: poder.dias || null,
      destino,
      nota
    })
    if (ok) {
      setEncargando(null)
      await refresh()
    } else {
      setAviso(mensaje || 'No se pudo usar el poder.')
    }
    setOcupado(null)
  }

  if (!activos.length) return null

  return (
    <>
      <div className="titulo-seccion">Tus poderes</div>

      {aviso && (
        <p className="error-texto" role="alert" style={{ margin: '0 4px 10px' }}>{aviso}</p>
      )}

      <div className="carta">
        {activos.map(({ ganada, def, poder }) => {
          const meta = PODERES[poder.tipo]
          const gastable = poder.tipo === 'salva_racha' || poder.tipo === 'asigna_tarea'
          const restantes = gastable ? usosRestantes(ganada, gastados) : null
          const dias = diasQueQuedan(ganada, poder)

          return (
            <div className="fila-poder" key={def.code}>
              <span className="hab-emoji">{def.emoji}</span>
              <div className="crece">
                <div className="fila-separada">
                  <strong style={{ fontSize: '0.95rem' }}>{meta.nombre}</strong>
                  {dias !== null && (
                    <span className="suave" style={{ fontSize: '0.78rem' }}>
                      {dias === 0 ? 'caduca hoy' : dias === 1 ? 'queda 1 día' : `quedan ${dias} días`}
                    </span>
                  )}
                </div>
                <div className="suave" style={{ fontSize: '0.82rem' }}>
                  {meta.describe(poder)} · por {flex(def.name, genero)}
                </div>
                {gastable && (
                  <div style={{ marginTop: 6 }}>
                    {restantes > 0 ? (
                      <button
                        className="btn btn-mini"
                        disabled={ocupado === def.code}
                        onClick={() =>
                          poder.tipo === 'asigna_tarea'
                            ? setEncargando({ code: def.code, poder })
                            : usar({ code: def.code, poder })
                        }
                      >
                        {poder.tipo === 'asigna_tarea' ? 'Encargar una misión' : 'Salvar un día'}
                        {restantes > 1 ? ` (${restantes})` : ''}
                      </button>
                    ) : (
                      <span className="suave" style={{ fontSize: '0.8rem' }}>Ya lo has usado.</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {encargando && (
        <ModalEncargo
          data={data}
          profile={profile}
          ocupado={ocupado === encargando.code}
          onCerrar={() => setEncargando(null)}
          onEncargar={(destino, nota) => usar({ ...encargando, destino, nota })}
        />
      )}
    </>
  )
}

/**
 * Encargar una misión a otra persona.
 *
 * Lleva aviso explícito de que se va a enterar todo el gremio, y no es
 * decoración: entre hermanas, un poder para mandar sin que se vea de quién
 * viene acaba en discusión. Que quede con nombre lo convierte en un favor
 * que se pide y no en una orden anónima.
 */
function ModalEncargo({ data, profile, ocupado, onCerrar, onEncargar }) {
  const [destino, setDestino] = useState('')
  const [texto, setTexto] = useState('')
  const gente = perfilesActivos(data.profiles).filter((p) => p.id !== profile.id)
  const valido = destino && texto.trim().length >= 3

  return (
    <Modal titulo="Voz de mando" onClose={onCerrar}>
      <p className="suave" style={{ marginBottom: 12 }}>
        Le aparecerá como una misión suya, con tu nombre detrás. Se valida como cualquier otra.
      </p>

      <div className="campo">
        <label htmlFor="poder-destino">¿A quién?</label>
        <select id="poder-destino" value={destino} onChange={(e) => setDestino(e.target.value)}>
          <option value="">Elige a alguien</option>
          {gente.map((p) => (
            <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label htmlFor="poder-encargo">¿Qué le encargas?</label>
        <input
          id="poder-encargo"
          type="text"
          value={texto}
          maxLength={80}
          placeholder="Recoger la mesa del salón"
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>

      <button
        className="btn btn-bloque"
        disabled={!valido || ocupado}
        onClick={() => onEncargar(destino, texto)}
      >
        {ocupado ? 'Encargando…' : 'Encargar'}
      </button>
    </Modal>
  )
}
