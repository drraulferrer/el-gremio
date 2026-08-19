import { useState } from 'react'
import {
  supabase, hashPin, EMOJIS, COLORS, ROLE_LABEL, mensajeDeError,
  zonaDelDispositivo, esColumnaQueNoExiste
} from '../lib/supabase'
import {
  PREGUNTAS, RESPUESTAS_POR_DEFECTO, preguntaResuelta, alternar, planDeArranque
} from '../lib/setup'
import { habilidad } from '../lib/habilidades'
import {
  zonasDesdeVivienda, VIVIENDA_POR_DEFECTO, EXTRAS_VIVIENDA,
  nuevaZona, nombreDeZonaValido, PLANTILLAS_ZONA, IDS_PLANTILLA
} from '../lib/zonas'
import { log } from '../lib/log'
import { MAX_PERFILES, ROLES } from '../lib/miembros'
import { GENEROS, flex } from '../lib/genero'
import Icono from '../components/Icono'
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

const MIEMBRO_NUEVO = (rol = 'junior') => ({ name: '', role: rol, emoji: '🦊', color: COLORS[0], gender: 'neutro' })

// «quienes» va ANTES de miembros porque decide qué roles se ofrecen; la
// casa va DESPUÉS, porque en modo piso las habitaciones llevan el nombre
// de cada conviviente.
const PASOS = ['nombre', 'quienes', 'miembros', 'casa', ...PREGUNTAS.map((p) => p.id), 'pin', 'avisos', 'resumen']

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
  // 'familia' o 'piso' (compañeros de piso). Cambia qué roles se ofrecen
  // y cómo se siembran las zonas: en un piso cada conviviente tiene su
  // habitación, además de las comunes.
  const [tipoGremio, setTipoGremio] = useState('familia')
  const [vivienda, setVivienda] = useState(VIVIENDA_POR_DEFECTO)
  // La lista de zonas que la vivienda dibuja, editable en el mismo paso.
  // `huella` detecta que la vivienda o los miembros cambiaron por debajo
  // y regenera (descartando los retoques, que dependían de esos datos).
  const [zonasCasa, setZonasCasa] = useState(null)
  const [huella, setHuella] = useState('')
  const [saltarCasa, setSaltarCasa] = useState(false)
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)

  const paso = PASOS[indice]
  const conNombre = miembros.filter((m) => m.name.trim())
  const plan = planDeArranque(respuestas, miembros)

  const huellaActual = JSON.stringify([tipoGremio, vivienda, conNombre.map((m) => m.name.trim())])
  if (paso === 'casa' && huella !== huellaActual) {
    // Regenerar en el render y no en un efecto: el estado deriva de otros
    // estados y React tolera este patrón (setState durante render con
    // guarda). Con efecto habría un cuadro con la lista vieja.
    setZonasCasa(zonasDesdeVivienda(vivienda, { tipoGremio, miembros: conNombre }))
    setHuella(huellaActual)
  }

  function setMiembro(i, cambios) {
    setMiembros(miembros.map((m, j) => (j === i ? { ...m, ...cambios } : m)))
  }

  function responder(cambios) {
    setRespuestas({ ...respuestas, ...cambios })
  }

  function elegirTipoGremio(tipo) {
    setTipoGremio(tipo)
    // En un piso todo el mundo es adulto: no hay peque a la que adaptarle
    // la pantalla ni junior que espere visto bueno. Se fuerza al elegir,
    // no en el insert, para que el paso de miembros diga la verdad.
    if (tipo === 'piso') setMiembros(miembros.map((m) => ({ ...m, role: 'adulto' })))
  }

  function setZona(i, cambios) {
    setZonasCasa(zonasCasa.map((z, j) => (j === i ? { ...z, ...cambios } : z)))
  }

  function quitarZona(i) {
    setZonasCasa(zonasCasa.filter((_, j) => j !== i))
  }

  function anadirZona() {
    setZonasCasa([...zonasCasa, { ...nuevaZona(), orden: zonasCasa.length }])
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
    if (paso === 'casa') {
      if (saltarCasa) return null
      if ((zonasCasa || []).some((z) => !nombreDeZonaValido(z.nombre))) {
        return 'Hay una zona sin nombre (o con uno demasiado corto). Ponle nombre o quítala.'
      }
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
          tipo_gremio: tipoGremio,
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
          // En un piso todo el mundo es adulto, elija lo que elija una
          // fila vieja: el cinturón del tirante de elegirTipoGremio.
          role: tipoGremio === 'piso' ? 'adulto' : m.role,
          emoji: m.emoji,
          color: m.color,
          gender: m.gender || 'neutro'
        })))
        .select()
      if (e2) throw e2

      // Las zonas de la casa. `dueno` viene como ÍNDICE del miembro (los
      // perfiles no existían al generar la lista); se traduce aquí con el
      // mismo casado por posición que usan las misiones. Y si la base no
      // tiene la migración 032, se sigue sin zonas en vez de tumbar el
      // alta: el modo limpieza cae a las de por defecto.
      if (!saltarCasa && (zonasCasa || []).length) {
        const filasZonas = zonasCasa.map((z, i) => ({
          family_id: fam.id,
          nombre: z.nombre.trim(),
          emoji: z.emoji || '🚪',
          plantilla: z.plantilla,
          tipo: z.tipo,
          dueno: z.dueno == null ? null : perfiles[z.dueno]?.id ?? null,
          orden: i
        }))
        const { error: eZonas } = await supabase.from('zonas_casa').insert(filasZonas)
        if (eZonas) {
          log.warn('gremio.zonas_sin_crear', { motivo: eZonas.code || eZonas.message })
        }
      }

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
        tipo_gremio: tipoGremio,
        zonas: saltarCasa ? 0 : (zonasCasa || []).length,
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

      {paso === 'quienes' && (
        <PasoSimple
          titulo="¿Quiénes formáis el gremio?"
          ayuda="Cambia el arranque, no las reglas: los puntos y la validación funcionan igual en los dos."
          porque="En una familia hay edades distintas y el sistema se adapta a cada una: la peque tiene su pantalla, la junior espera el visto bueno. En un piso compartido todo el mundo es adulto, y lo que cambia es la casa: cada conviviente tiene su habitación, además de las zonas comunes."
        >
          <div className="setup-opciones">
            {[
              { id: 'familia', emoji: '🏡', etiqueta: 'Una familia', detalle: 'Con peques, junior o como sea la vuestra' },
              { id: 'piso', emoji: '🗝️', etiqueta: 'Compañeros de piso', detalle: 'Convivientes: cada cual con su habitación, y las zonas comunes de todos' }
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                className={'setup-opcion' + (tipoGremio === o.id ? ' sel' : '')}
                aria-pressed={tipoGremio === o.id}
                onClick={() => elegirTipoGremio(o.id)}
              >
                <span className="setup-emoji">{o.emoji}</span>
                <span className="crece">
                  <strong>{o.etiqueta}</strong>
                  <em>{o.detalle}</em>
                </span>
                {tipoGremio === o.id && <span className="setup-tic">✓</span>}
              </button>
            ))}
          </div>
        </PasoSimple>
      )}

      {paso === 'miembros' && (
        <PasoSimple
          titulo="¿Quiénes sois?"
          ayuda={tipoGremio === 'piso'
            ? 'Deja el nombre vacío para saltarte una fila. Con el nombre de cada conviviente se crea también su habitación, en el paso siguiente.'
            : 'Deja el nombre vacío para saltarte una fila. Los animales de la casa se dan de alta después, en el panel: necesitan especie y se les crea su propio catálogo de misiones.'}
          porque={tipoGremio === 'piso'
            ? 'En un piso compartido no hay roles que repartir: todo el mundo valida y todo el mundo hace. Lo que sí importa es el nombre, porque la habitación de cada cual sale de aquí.'
            : 'El rol no es una etiqueta: cambia la app entera. La peque tiene pantalla propia de botones enormes con estrella al momento; la junior pide y espera el visto bueno; quien es adulto además valida.'}
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
                {/* En un piso no hay rol que elegir: todo el mundo es
                    adulto, y un desplegable de una sola opción es ruido. */}
                {tipoGremio === 'familia' && (
                  <select
                    style={{ width: 120 }}
                    value={m.role}
                    onChange={(e) => setMiembro(i, { role: e.target.value })}
                  >
                    {/* ROLES, no ROLE_LABEL entero: este último incluye
                        «mascota», y aquí eso era una trampa. El insert de
                        abajo no manda `species`, así que Postgres rechazaba
                        la fila por `profiles_especie_coherente` y se caía el
                        alta del gremio entera. Y aunque no se cayera, la
                        mascota nacería sin sus misiones: el catálogo se crea
                        en el panel de Miembros, no aquí. */}
                    {ROLES.map((v) => (
                      <option key={v} value={v}>{flex(ROLE_LABEL[v], m.gender)}</option>
                    ))}
                  </select>
                )}
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
              onClick={() => setMiembros([...miembros, MIEMBRO_NUEVO(tipoGremio === 'piso' ? 'adulto' : 'junior')])}
            >
              + Añadir otro miembro
            </button>
          )}
        </PasoSimple>
      )}

      {paso === 'casa' && (
        <PasoSimple
          titulo="¿Cómo es la casa?"
          ayuda="De aquí sale el mapa del modo limpieza: las zonas sobre las que se lanzan las operaciones. Retoca la lista aquí mismo, y siempre después en ⚙️ → Casa."
          porque="Ninguna casa es la del catálogo: hay chalets con dos baños y pisos con buhardilla. Y las plantas no se guardan como dato: solo deciden nombres, «Baño de arriba» y «Baño de abajo», que es todo lo que una planta aporta a la limpieza."
        >
          {!saltarCasa && (
            <>
              <div className="carta">
                <Contador
                  etiqueta="Baños"
                  valor={vivienda.banos}
                  min={1}
                  max={4}
                  onCambiar={(n) => setVivienda({ ...vivienda, banos: n })}
                />
                {tipoGremio === 'familia' ? (
                  <Contador
                    etiqueta="Dormitorios"
                    valor={vivienda.dormitorios}
                    min={1}
                    max={6}
                    onCambiar={(n) => setVivienda({ ...vivienda, dormitorios: n })}
                  />
                ) : (
                  <p className="suave" style={{ margin: '6px 0' }}>
                    Las habitaciones salen del paso anterior: una por conviviente, suya.
                  </p>
                )}

                <label className="fila" style={{ cursor: 'pointer', padding: '6px 0' }}>
                  <input
                    type="checkbox"
                    style={{ width: 22, height: 22, flex: 'none' }}
                    checked={vivienda.masDeUnaPlanta}
                    onChange={(e) => setVivienda({ ...vivienda, masDeUnaPlanta: e.target.checked })}
                  />
                  <span className="crece">Más de una planta (chalet, dúplex…)</span>
                </label>

                <div className="fila" style={{ flexWrap: 'wrap' }}>
                  {EXTRAS_VIVIENDA.map((extra) => {
                    const sel = (vivienda.extras || []).includes(extra.id)
                    return (
                      <button
                        key={extra.id}
                        type="button"
                        className={'pastilla-habilidad' + (sel ? ' sel' : '')}
                        aria-pressed={sel}
                        onClick={() => setVivienda({
                          ...vivienda,
                          extras: sel
                            ? vivienda.extras.filter((x) => x !== extra.id)
                            : [...(vivienda.extras || []), extra.id]
                        })}
                      >
                        {extra.emoji} {extra.etiqueta}
                      </button>
                    )
                  })}
                </div>

                <p className="suave" style={{ fontSize: '0.8rem', margin: '8px 0 0' }}>
                  Cambiar estos números rehace la lista de abajo y descarta los retoques.
                </p>
              </div>

              {(zonasCasa || []).map((z, i) => (
                <div className="fila fila-reparto" key={i}>
                  <span style={{ fontSize: '1.15rem' }}>{z.emoji}</span>
                  <input
                    className="crece"
                    value={z.nombre}
                    maxLength={60}
                    placeholder="Nombre de la zona"
                    onChange={(e) => { setZona(i, { nombre: e.target.value }); setError('') }}
                    aria-label={`Nombre de la zona ${i + 1}`}
                  />
                  {z.tipo === 'privada' ? (
                    <span className="chip">suya</span>
                  ) : (
                    <select
                      style={{ flex: 'none', width: 'auto' }}
                      value={z.plantilla}
                      onChange={(e) => setZona(i, { plantilla: e.target.value, emoji: PLANTILLAS_ZONA[e.target.value].emoji })}
                      aria-label={`Qué clase de zona es ${z.nombre || 'esta'}`}
                    >
                      {IDS_PLANTILLA.map((id) => (
                        <option key={id} value={id}>{PLANTILLAS_ZONA[id].nombre}</option>
                      ))}
                    </select>
                  )}
                  <button
                    className="btn-icono"
                    onClick={() => quitarZona(i)}
                    aria-label={`Quitar ${z.nombre || 'esta zona'}`}
                  >
                    <Icono nombre="cerrar" tamano={18} />
                  </button>
                </div>
              ))}

              <button className="btn btn-fantasma btn-mini btn-bloque" style={{ marginTop: 8 }} onClick={anadirZona}>
                + Añadir otra zona
              </button>
            </>
          )}

          <label className="fila carta" style={{ cursor: 'pointer', marginTop: 10 }}>
            <input
              type="checkbox"
              style={{ width: 22, height: 22, flex: 'none' }}
              checked={saltarCasa}
              onChange={(e) => { setSaltarCasa(e.target.checked); setError('') }}
            />
            <span className="crece suave">
              Prefiero configurar la casa después, desde el panel. El modo limpieza usará las zonas de siempre mientras tanto.
            </span>
          </label>
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

/**
 * Un contador de − / +. No es un input numérico a propósito: en un móvil
 * el teclado numérico tapa media pantalla para elegir entre 1 y 4.
 */
function Contador({ etiqueta, valor, min, max, onCambiar }) {
  return (
    <div className="fila" style={{ padding: '6px 0' }}>
      <span className="crece">{etiqueta}</span>
      <button
        className="btn-icono"
        disabled={valor <= min}
        onClick={() => onCambiar(Math.max(min, valor - 1))}
        aria-label={`Menos ${etiqueta.toLocaleLowerCase('es')}`}
      >
        −
      </button>
      <strong style={{ minWidth: 24, textAlign: 'center' }} aria-live="polite">{valor}</strong>
      <button
        className="btn-icono"
        disabled={valor >= max}
        onClick={() => onCambiar(Math.min(max, valor + 1))}
        aria-label={`Más ${etiqueta.toLocaleLowerCase('es')}`}
      >
        +
      </button>
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
              La peque tiene además sus propias recompensas, por debajo de {resumen.techoPeque} Talis: a su ritmo,
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
