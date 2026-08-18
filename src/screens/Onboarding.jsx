import { useState } from 'react'
import {
  supabase, hashPin, EMOJIS, COLORS, ROLE_LABEL, mensajeDeError,
  zonaDelDispositivo, esColumnaQueNoExiste
} from '../lib/supabase'
import {
  PREGUNTAS, RESPUESTAS_POR_DEFECTO, preguntaResuelta, alternar, planDeArranque
} from '../lib/setup'
import { habilidad } from '../lib/habilidades'
import { log } from '../lib/log'
import { MAX_PERFILES } from '../lib/miembros'
import { GENEROS, flex } from '../lib/genero'
import { marcarTutorialVisto } from './Tutorial'

// ------------------------------------------------------------------
// Fundar el gremio, en forma de setup.
//
// Antes esto eran tres pantallas de datos y, después, once diapositivas
// explicando el sistema a alguien que todavía no había visto nada. Ahora
// son ocho pasos con barra de progreso donde cada pregunta CONSTRUYE algo
// —las misiones, la tienda, la meta— y lleva debajo el principio que la
// sostiene. Se aprende configurando, que es la única forma en la que se
// aprende algo en una app.
//
// La explicación larga no se ha perdido: sigue entera en ⚙️ → Evidencia,
// y quien quiera leerla la tiene. Lo que se ha quitado es la obligación
// de leerla antes de empezar.
// ------------------------------------------------------------------

const MIEMBRO_NUEVO = () => ({ name: '', role: 'junior', emoji: '🦊', color: COLORS[0], gender: 'neutro' })

const PASOS = ['nombre', 'miembros', ...PREGUNTAS.map((p) => p.id), 'pin', 'avisos', 'resumen']

export default function Onboarding({ onDone }) {
  const [indice, setIndice] = useState(0)
  const [nombre, setNombre] = useState('')
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [miembros, setMiembros] = useState([
    { name: '', role: 'adulto', emoji: '🧙', color: COLORS[2], gender: 'neutro' },
    { name: '', role: 'adulto', emoji: '🦉', color: COLORS[1], gender: 'neutro' },
    { name: '', role: 'junior', emoji: '🦄', color: COLORS[0], gender: 'neutro' },
    { name: '', role: 'peque', emoji: '🐣', color: COLORS[3], gender: 'neutro' }
  ])
  const [respuestas, setRespuestas] = useState(RESPUESTAS_POR_DEFECTO)
  const [enBlanco, setEnBlanco] = useState(false)
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)

  const paso = PASOS[indice]
  const conNombre = miembros.filter((m) => m.name.trim())
  const plan = planDeArranque(respuestas, miembros)

  function setMiembro(i, cambios) {
    setMiembros(miembros.map((m, j) => (j === i ? { ...m, ...cambios } : m)))
  }

  function responder(cambios) {
    setRespuestas({ ...respuestas, ...cambios })
  }

  // Qué falta para poder seguir. Devuelve null si se puede.
  function loQueFalta() {
    if (paso === 'nombre') return nombre.trim() ? null : 'Ponle nombre al gremio.'
    if (paso === 'miembros') {
      if (!conNombre.length) return 'Hace falta al menos una persona.'
      if (!conNombre.some((m) => m.role === 'adulto')) return 'Hace falta al menos una persona adulta: alguien tiene que validar.'
      const nombres = conNombre.map((m) => m.name.trim().toLocaleLowerCase('es'))
      if (new Set(nombres).size !== nombres.length) return 'Hay dos miembros con el mismo nombre.'
      return null
    }
    if (paso === 'pin') {
      if (pin1.length < 4) return 'El PIN necesita al menos 4 dígitos.'
      if (pin1 !== pin2) return 'Los dos PIN no coinciden.'
      return null
    }
    const pregunta = PREGUNTAS.find((p) => p.id === paso)
    if (pregunta) return preguntaResuelta(pregunta, respuestas) ? null : 'Elige al menos una opción.'
    return null
  }

  const falta = loQueFalta()

  function siguiente() {
    if (falta) { setError(falta); return }
    setError('')
    setIndice(Math.min(indice + 1, PASOS.length - 1))
  }

  function atras() {
    setError('')
    setIndice(Math.max(indice - 1, 0))
  }

  async function crear() {
    setError('')
    setCreando(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const pinHash = await hashPin(pin1)
      // La zona se detecta, no se pregunta: nadie se equivoca al decir en
      // qué país vive, y el setup ya tiene ocho pasos. Se cambia después
      // en ⚙️ → Datos, que es cuando importa (una mudanza).
      const base = { owner: userData.user.id, name: nombre.trim(), parent_pin_hash: pinHash }
      let { data: fam, error: e1 } = await supabase
        .from('families')
        // La aceptación de los textos legales viaja aquí, no en `base`:
        // `base` es el insert mínimo al que se cae si la base todavía no
        // tiene las columnas, y tiene que seguir siendo válido siempre.
        // Sale de los metadatos del alta, que es donde se guardó al
        // registrarse; si la cuenta es anterior a la casilla va a null y
        // así se queda, porque inventarle una fecha sería fabricar un
        // consentimiento que nadie dio.
        .insert({
          ...base,
          timezone: zonaDelDispositivo(),
          legal_version: userData.user.user_metadata?.legal_version || null,
          legal_at: userData.user.user_metadata?.legal_aceptado_en || null
        })
        .select()
        .single()

      // Una base sin la migración 018 no tiene la columna. Se reintenta
      // sin ella en vez de dejar a la familia sin poder darse de alta:
      // mismo criterio que con `profiles.active` en la 003.
      if (e1 && esColumnaQueNoExiste(e1)) {
        ;({ data: fam, error: e1 } = await supabase
          .from('families')
          .insert(base)
          .select()
          .single())
      }
      if (e1) throw e1

      const { data: perfiles, error: e2 } = await supabase
        .from('profiles')
        .insert(conNombre.map((m) => ({
          family_id: fam.id,
          name: m.name.trim(),
          role: m.role,
          emoji: m.emoji,
          color: m.color,
          gender: m.gender || 'neutro'
        })))
        .select()
      if (e2) throw e2

      if (!enBlanco) {
        // Las misiones se casan por posición: `plan.porMiembro` sale de la
        // misma lista filtrada y en el mismo orden que el insert de
        // arriba, así que el índice vale. Casarlas por nombre sería más
        // frágil, no menos: dos personas pueden llamarse igual el día que
        // se quite la comprobación de nombres repetidos.
        const retos = perfiles.flatMap((p, i) =>
          (plan.porMiembro[i]?.misiones || []).map((t) => ({ ...t, family_id: fam.id, profile_id: p.id }))
        )
        if (retos.length) {
          const { error: e3 } = await supabase.from('challenges').insert(retos)
          if (e3) throw e3
        }

        const { error: e4 } = await supabase
          .from('rewards')
          .insert(plan.premios.map((r) => ({ ...r, family_id: fam.id })))
        if (e4) throw e4

        const { error: e5 } = await supabase
          .from('family_goals')
          .insert({ ...plan.meta, family_id: fam.id })
        if (e5) throw e5
      }

      log.info('gremio.fundado', {
        perfiles: perfiles.length,
        en_blanco: enBlanco,
        focos: respuestas.focos,
        ritmo: respuestas.ritmo,
        misiones: enBlanco ? 0 : plan.resumen.misiones
      })

      // El setup ES el tutorial. Quien lo ha hecho ya ha leído las cuatro
      // ideas del sistema mientras decidía, así que enseñarle once
      // diapositivas a continuación sería repetirse. Sigue disponible en
      // ⚙️ → Evidencia, y en un dispositivo NUEVO de una familia que ya
      // existe se abre solo, que es donde de verdad hace falta.
      marcarTutorialVisto()
      onDone()
    } catch (err) {
      setError(mensajeDeError(err) || 'Algo falló al crear el gremio.')
      setCreando(false)
    }
  }

  return (
    <div className="app setup">
      <Progreso indice={indice} total={PASOS.length} />

      {paso === 'nombre' && (
        <PasoSimple
          titulo="Fundad vuestro gremio"
          ayuda="El nombre saldrá en la cabecera de todos los perfiles."
        >
          <div className="campo">
            <label htmlFor="nombre-gremio">Nombre del gremio</label>
            <input
              id="nombre-gremio"
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); setError('') }}
              placeholder="El Gremio de los…"
              autoFocus
            />
          </div>
        </PasoSimple>
      )}

      {paso === 'miembros' && (
        <PasoSimple
          titulo="¿Quiénes sois?"
          ayuda="Deja el nombre vacío para saltarte una fila."
          porque="El rol no es una etiqueta: cambia la app entera. La peque tiene pantalla propia de botones enormes con estrella al momento; la junior pide y espera el visto bueno; quien es adulto además valida."
        >
          {miembros.map((m, i) => (
            <div className="carta" key={i}>
              <div className="fila" style={{ marginBottom: 10 }}>
                <div className="avatar" style={{ borderColor: m.color }}>{m.emoji}</div>
                <input
                  className="crece"
                  placeholder="Nombre"
                  value={m.name}
                  onChange={(e) => { setMiembro(i, { name: e.target.value }); setError('') }}
                />
                <select
                  style={{ width: 120 }}
                  value={m.role}
                  onChange={(e) => setMiembro(i, { role: e.target.value })}
                >
                  {Object.entries(ROLE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{flex(l, m.gender)}</option>
                  ))}
                </select>
              </div>
              <div className="grid-habilidades" style={{ marginBottom: 8 }}>
                {GENEROS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={'pastilla-habilidad' + (m.gender === g.id ? ' sel' : '')}
                    onClick={() => setMiembro(i, { gender: g.id })}
                  >
                    {g.etiqueta}
                  </button>
                ))}
              </div>
              <div className="grid-emojis" style={{ marginBottom: 8 }}>
                {EMOJIS.slice(0, 8).map((e) => (
                  <button key={e} className={m.emoji === e ? 'sel' : ''} onClick={() => setMiembro(i, { emoji: e })}>{e}</button>
                ))}
              </div>
              <div className="grid-colores">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={m.color === c ? 'sel' : ''}
                    style={{ background: c }}
                    onClick={() => setMiembro(i, { color: c })}
                    aria-label={'Color ' + c}
                  />
                ))}
              </div>
            </div>
          ))}

          {miembros.length < MAX_PERFILES && (
            <button
              className="btn btn-fantasma btn-bloque"
              onClick={() => setMiembros([...miembros, MIEMBRO_NUEVO()])}
            >
              + Añadir otro miembro
            </button>
          )}
        </PasoSimple>
      )}

      {PREGUNTAS.map((pregunta) => paso === pregunta.id && (
        <Pregunta
          key={pregunta.id}
          pregunta={pregunta}
          respuestas={respuestas}
          onResponder={(cambios) => { responder(cambios); setError('') }}
        />
      ))}

      {paso === 'pin' && (
        <PasoSimple
          titulo="El PIN parental"
          ayuda="Protege el panel donde se valida y se crean premios. De 4 a 8 dígitos."
          porque="Guarda el panel dentro de la sesión familiar para que unas manos curiosas no se validen sus propias misiones. No es seguridad criptográfica y por eso ahí no vive nada sensible."
        >
          <div className="campo">
            <label htmlFor="pin1">PIN</label>
            <input id="pin1" type="password" inputMode="numeric" value={pin1}
              onChange={(e) => { setPin1(e.target.value); setError('') }} />
          </div>
          <div className="campo">
            <label htmlFor="pin2">Repite el PIN</label>
            <input id="pin2" type="password" inputMode="numeric" value={pin2}
              onChange={(e) => { setPin2(e.target.value); setError('') }} />
          </div>
        </PasoSimple>
      )}

      {paso === 'avisos' && (
        <PasoSimple
          titulo="Los avisos"
          ayuda="Un aviso al día como mucho, entre las cinco y las nueve de la tarde, y otro a la noche para dejar programado mañana. Solo cuando hay algo que hacer: una racha a punto de romperse, misiones esperando validación o alguien que lleva días sin aparecer."
          porque="Se activan APARATO POR APARATO, no de una vez para todo el gremio: el permiso lo concede el navegador de cada móvil y nadie puede darlo por otro. Por eso no se puede hacer aquí todavía —el gremio aún no existe— y por eso hay que repetirlo en cada teléfono."
        >
          <div className="carta">
            <p style={{ margin: 0 }}>
              <strong>Dónde se activan:</strong> Panel parental → ⚙️ Ajustes → 🔔 Avisos.
            </p>
            <p className="suave" style={{ margin: '8px 0 0' }}>
              En cuanto entres al panel te lo recordaremos ahí arriba, y seguirá saliendo
              hasta que los actives o le digas que deje de mostrarlo. La peque nunca recibe
              avisos, aunque el aparato sea el suyo.
            </p>
          </div>
        </PasoSimple>
      )}

      {paso === 'resumen' && (
        <Resumen
          plan={plan}
          nombre={nombre}
          enBlanco={enBlanco}
          onEnBlanco={setEnBlanco}
        />
      )}

      {error && <p className="error-texto" role="alert">{error}</p>}

      <div className="setup-pie">
        {indice > 0 && (
          <button className="btn btn-fantasma" onClick={atras} disabled={creando}>Atrás</button>
        )}
        {paso !== 'resumen' ? (
          <button className="btn crece" onClick={siguiente} disabled={Boolean(falta)}>Seguir</button>
        ) : (
          <button className="btn crece" onClick={crear} disabled={creando}>
            {creando ? 'Fundando…' : '⚔️ Fundar el gremio'}
          </button>
        )}
      </div>
    </div>
  )
}

function Progreso({ indice, total }) {
  const pct = Math.round(((indice + 1) / total) * 100)
  return (
    <div className="setup-progreso">
      <div
        className="setup-barra"
        role="progressbar"
        aria-valuenow={indice + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Paso ${indice + 1} de ${total}`}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="setup-cuenta">Paso {indice + 1} de {total}</p>
    </div>
  )
}

function PasoSimple({ titulo, ayuda, porque, children }) {
  return (
    <div className="setup-paso">
      <h1>{titulo}</h1>
      {ayuda && <p className="suave setup-ayuda">{ayuda}</p>}
      {children}
      {porque && <p className="setup-porque"><strong>Por qué</strong> · {porque}</p>}
    </div>
  )
}

function Pregunta({ pregunta, respuestas, onResponder }) {
  const varios = pregunta.tipo === 'varios'
  const valor = respuestas[pregunta.id]
  const elegido = (id) => (varios ? (valor || []).includes(id) : valor === id)

  function pulsar(id) {
    if (varios) onResponder({ [pregunta.id]: alternar(valor || [], id, pregunta.max) })
    else onResponder({ [pregunta.id]: id })
  }

  const tope = varios && (valor || []).length >= pregunta.max

  return (
    <div className="setup-paso">
      <h1>{pregunta.titulo}</h1>
      {pregunta.ayuda && <p className="suave setup-ayuda">{pregunta.ayuda}</p>}

      <div className="setup-opciones">
        {pregunta.opciones.map((o) => {
          const sel = elegido(o.id)
          return (
            <button
              key={o.id}
              type="button"
              className={'setup-opcion' + (sel ? ' sel' : '')}
              aria-pressed={sel}
              disabled={!sel && tope}
              onClick={() => pulsar(o.id)}
            >
              <span className="setup-emoji">{o.emoji}</span>
              <span className="crece">
                <strong>{o.etiqueta}</strong>
                {o.detalle && <em>{o.detalle}</em>}
              </span>
              {o.recomendada && !sel && <span className="setup-sello">recomendado</span>}
              {sel && <span className="setup-tic">✓</span>}
            </button>
          )
        })}
      </div>

      {pregunta.id === 'meta' && respuestas.meta === 'propia' && (
        <div className="campo">
          <label htmlFor="meta-propia">Vuestra meta</label>
          <input
            id="meta-propia"
            value={respuestas.metaPropia || ''}
            maxLength={60}
            placeholder="Un fin de semana en la playa"
            onChange={(e) => onResponder({ metaPropia: e.target.value })}
          />
        </div>
      )}

      {tope && <p className="suave">Ya van {pregunta.max}, que es el máximo. Quita una para cambiarla.</p>}

      <p className="setup-porque"><strong>Por qué</strong> · {pregunta.porque}</p>
    </div>
  )
}

function Resumen({ plan, nombre, enBlanco, onEnBlanco }) {
  const { resumen, meta, porMiembro } = plan

  return (
    <div className="setup-paso">
      <h1>Esto es {nombre.trim() || 'vuestro gremio'}</h1>
      <p className="suave setup-ayuda">
        Se crea ahora y se puede cambiar entero desde el panel: añadir, quitar, pausar o poner otros puntos.
      </p>

      {!enBlanco && (
        <>
          <div className="setup-cifras">
            <div className="carta"><strong>{resumen.personas}</strong><span>personas</span></div>
            <div className="carta"><strong>{resumen.misiones}</strong><span>misiones</span></div>
            <div className="carta"><strong>{resumen.premios}</strong><span>premios</span></div>
            <div className="carta"><strong>{resumen.habilidades.length}</strong><span>habilidades</span></div>
          </div>

          <div className="carta">
            <strong>{meta.emoji} {meta.title}</strong>
            <p className="suave">
              Meta del gremio: {meta.target_xp.toLocaleString('es')} XP entre todo el mundo. La cifra sale del
              modelo de economía con vuestros roles, para que caiga alrededor de los dos meses.
            </p>
          </div>

          {porMiembro.map(({ miembro, misiones }) => (
            <div className="carta" key={miembro.name}>
              <strong>{miembro.emoji} {miembro.name.trim()}</strong>
              <ul className="setup-lista">
                {misiones.map((m) => (
                  <li key={m.title}>
                    <span>{m.emoji} {m.title}</span>
                    {m.skill && <em>{habilidad(m.skill).nombre}</em>}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {resumen.techoPeque && (
            <p className="suave">
              La peque tiene además sus propios premios, por debajo de {resumen.techoPeque} monedas: a su ritmo,
              uno de los de arriba estaría a más de dos semanas y eso no es un premio, es una decoración.
            </p>
          )}
        </>
      )}

      <label className="fila carta" style={{ cursor: 'pointer' }}>
        <input
          type="checkbox"
          style={{ width: 22, height: 22 }}
          checked={enBlanco}
          onChange={(e) => onEnBlanco(e.target.checked)}
        />
        <span className="crece suave">
          Prefiero empezar en blanco y escribirlo todo desde el panel.
        </span>
      </label>
    </div>
  )
}
