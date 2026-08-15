import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, configured, modoDemo, crearSinkDeLogs, mensajeDeError } from './lib/supabase'
import { ganablesPor, insigniaPorCodigo } from './lib/insignias'
import { meritosDe } from './lib/meritos'
import { log, setContexto, setSink, instalarVaciadoAlSalir, nuevoRequestId } from './lib/log'
import { instalarMonitorizacion, capturar } from './lib/monitoring'
import { flag } from './lib/flags'
import { perfilesActivos, estaActivo } from './lib/miembros'
import { RELEASE } from './lib/version'
import { PinModal } from './components/ui'
import Login from './screens/Login'
import Onboarding from './screens/Onboarding'
import ProfilePicker from './screens/ProfilePicker'
import Home from './screens/Home'
import KidHome from './screens/KidHome'
import ParentPanel from './screens/ParentPanel'
import Tutorial, { tutorialPendiente } from './screens/Tutorial'

const iconoUrl = import.meta.env.BASE_URL + 'icon.svg'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = comprobando
  const [family, setFamily] = useState(undefined) // undefined = cargando · null = aún no existe
  const [data, setData] = useState(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [profileId, setProfileId] = useState(() => localStorage.getItem('gremio_profile'))
  const [pidePin, setPidePin] = useState(false)
  // Ojo: el estado se inicializa UNA vez desde localStorage y no se
  // consulta en cada render. Si se leyera cada vez, cerrar el tutorial
  // llamaría a setVerTutorial(false) sobre un false y React no
  // re-renderizaría: la pantalla se quedaría pegada para siempre.
  const [verTutorial, setVerTutorial] = useState(() => (tutorialPendiente() ? 'todo' : null))
  const [parentMode, setParentMode] = useState(false)

  // Observabilidad: monitorización de errores globales y destino de logs.
  useEffect(() => {
    const quitarMonitor = instalarMonitorizacion()
    const quitarVaciado = instalarVaciadoAlSalir()
    setSink(crearSinkDeLogs())
    log.info('app.arranque', { release: RELEASE, demo: modoDemo, configurado: configured })
    return () => {
      quitarMonitor()
      quitarVaciado()
    }
  }, [])

  // Sesión
  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data: d }) => setSession(d.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Familia
  const loadFamily = useCallback(async () => {
    const { data: fams, error } = await supabase.from('families').select('*').limit(1)
    if (error) {
      capturar(error, { origen: 'loadFamily' })
      setErrorCarga(mensajeDeError(error))
      return
    }
    setFamily(fams && fams.length ? fams[0] : null)
  }, [])

  useEffect(() => {
    if (session) loadFamily()
    else {
      setFamily(undefined)
      setData(null)
    }
  }, [session, loadFamily])

  // Datos
  const loadAll = useCallback(async () => {
    if (!family) return
    const fid = family.id
    const requestId = nuevoRequestId()
    const inicio = Date.now()

    const respuestas = await Promise.all([
      supabase.from('profiles').select('*').eq('family_id', fid).order('created_at'),
      supabase.from('challenges').select('*').eq('family_id', fid).order('created_at'),
      supabase.from('completions').select('*').eq('family_id', fid).order('requested_at', { ascending: false }).limit(400),
      supabase.from('rewards').select('*').eq('family_id', fid).order('created_at'),
      supabase.from('redemptions').select('*').eq('family_id', fid).order('requested_at', { ascending: false }).limit(200),
      // TODAS las metas, no solo la activa: las logradas son las que dicen
      // en qué temporada va el gremio y cuánta XP lleva acumulada de por
      // vida. Sin ellas, cerrar una meta parecía perder el progreso.
      supabase.from('family_goals').select('*').eq('family_id', fid).order('starts_at', { ascending: false }).limit(50),
      supabase.from('profile_badges').select('*').eq('family_id', fid),
      // Las dos últimas van al final y su fallo NO tumba la carga: si la
      // migración correspondiente no se ha ejecutado, la tabla no existe y
      // la app tiene que seguir funcionando entera menos esa pieza.
      // Degradar con una cosa de menos, no con la pantalla en blanco.
      supabase.from('bonuses').select('*').eq('family_id', fid),
      supabase.from('power_uses').select('*').eq('family_id', fid)
    ])

    const fallo = respuestas.slice(0, 7).find((r) => r.error)
    if (fallo) {
      capturar(fallo.error, { origen: 'loadAll', request_id: requestId })
      setErrorCarga(mensajeDeError(fallo.error))
      return
    }
    setErrorCarga('')

    const [pr, ch, co, rw, rd, gl, bg, bo, pu] = respuestas
    const metas = gl.data || []
    const next = {
      profiles: pr.data || [],
      challenges: ch.data || [],
      completions: co.data || [],
      rewards: rw.data || [],
      redemptions: rd.data || [],
      // `goal` sigue siendo la meta EN CURSO, que es lo que mira media
      // app; `goals` es la historia completa, para las temporadas.
      goal: metas.find((g) => !g.achieved) || null,
      goals: metas,
      badges: bg.data || [],
      bonuses: bo.error ? [] : bo.data || [],
      powerUses: pu.error ? [] : pu.data || []
    }
    log.debug('datos.cargados', {
      request_id: requestId,
      ms: Date.now() - inicio,
      perfiles: next.profiles.length,
      misiones: next.challenges.length
    })
    setData(next)
    otorgarInsignias(fid, next)
  }, [family])

  // Insignias automáticas: se comprueban tras cada carga.
  //
  // Las normales entran juntas de un upsert. Las ÚNICAS van una a una y
  // tolerando el duplicado, y esa diferencia no es un detalle: desde la
  // migración 015 hay un índice único por gremio para esos tres códigos,
  // así que dentro de un lote una sola colisión tumbaría el insert entero
  // y se perderían de paso todas las insignias normales de esa pasada.
  const otorgando = useRef(false)
  async function otorgarInsignias(fid, d) {
    if (otorgando.current) return

    // Quien está retirado no compite por una única: se llevaría un título
    // que ya no puede defender y lo dejaría bloqueado para el resto.
    const activos = perfilesActivos(d.profiles)
    const tomadas = new Set(
      d.badges.filter((b) => insigniaPorCodigo(b.code)?.clase === 'unica').map((b) => b.code)
    )

    const normales = []
    const unicas = []
    for (const p of activos) {
      const tiene = new Set(d.badges.filter((b) => b.profile_id === p.id).map((b) => b.code))
      for (const b of ganablesPor(meritosDe(p, { ...d, profiles: activos }), tomadas, tiene)) {
        const fila = { family_id: fid, profile_id: p.id, code: b.code }
        if (b.clase === 'unica') {
          unicas.push(fila)
          // Se reserva ya, dentro de la misma pasada: si dos personas
          // cumplen a la vez, la lista no puede proponer las dos.
          tomadas.add(b.code)
        } else {
          normales.push(fila)
        }
      }
    }
    if (!normales.length && !unicas.length) return

    otorgando.current = true
    let puestas = 0

    if (normales.length) {
      const { error } = await supabase
        .from('profile_badges')
        .upsert(normales, { onConflict: 'profile_id,code', ignoreDuplicates: true })
      if (error) capturar(error, { origen: 'otorgarInsignias' })
      else puestas += normales.length
    }

    for (const fila of unicas) {
      const { error } = await supabase.from('profile_badges').insert(fila)
      if (!error) {
        puestas++
      } else if (error.code === '23505') {
        // Otro dispositivo llegó primero. Es el caso normal de una carrera
        // por una insignia única, no un fallo que haya que enseñar.
        log.info('insignia.unica.ya_tomada', { code: fila.code })
      } else {
        capturar(error, { origen: 'otorgarInsignias.unica', code: fila.code })
      }
    }

    if (puestas) {
      log.info('insignias.otorgadas', { cuantas: puestas, unicas: unicas.length })
      const { data: bg } = await supabase.from('profile_badges').select('*').eq('family_id', fid)
      setData((prev) => (prev ? { ...prev, badges: bg || prev.badges } : prev))
    }
    otorgando.current = false
  }

  // Recargas agrupadas.
  //
  // Validar una misión dispara realtime en `completions` Y en `profiles`,
  // y cada evento pedía las siete tablas otra vez: tres recargas completas
  // por una sola acción. Se agrupan en una ventana de 250 ms, y si llega
  // otra mientras hay una en vuelo se encola una sola al final.
  const recargaPendiente = useRef(null)
  const cargando = useRef(false)
  const sucio = useRef(false)

  const recargar = useCallback(async () => {
    if (cargando.current) {
      sucio.current = true
      return
    }
    cargando.current = true
    try {
      await loadAll()
    } finally {
      cargando.current = false
      if (sucio.current) {
        sucio.current = false
        recargar()
      }
    }
  }, [loadAll])

  const programarRecarga = useCallback(() => {
    if (recargaPendiente.current) clearTimeout(recargaPendiente.current)
    recargaPendiente.current = setTimeout(() => {
      recargaPendiente.current = null
      recargar()
    }, 250)
  }, [recargar])

  // Carga inicial + realtime + recarga al volver a la app
  useEffect(() => {
    if (!family) return
    loadAll()

    const canal = supabase
      .channel('gremio-' + family.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions', filter: 'family_id=eq.' + family.id }, programarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'redemptions', filter: 'family_id=eq.' + family.id }, programarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'family_id=eq.' + family.id }, programarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges', filter: 'family_id=eq.' + family.id }, programarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards', filter: 'family_id=eq.' + family.id }, programarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_goals', filter: 'family_id=eq.' + family.id }, programarRecarga)
      .subscribe()

    const alVolver = () => {
      if (document.visibilityState === 'visible') programarRecarga()
    }
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      supabase.removeChannel(canal)
      document.removeEventListener('visibilitychange', alVolver)
      if (recargaPendiente.current) clearTimeout(recargaPendiente.current)
    }
  }, [family, loadAll, programarRecarga])

  // Un perfil retirado deja de ser elegible: si el dispositivo recordaba
  // ese perfil, vuelve al selector en lugar de abrir una sesión fantasma.
  const profile = data?.profiles.find((p) => p.id === profileId && estaActivo(p))
  useEffect(() => {
    setContexto({
      family_id: family?.id || null,
      profile_id: profile?.id || null,
      rol: profile?.role || null
    })
  }, [family?.id, profile?.id, profile?.role])

  function elegirPerfil(id) {
    localStorage.setItem('gremio_profile', id)
    setProfileId(id)
  }

  function cambiarPerfil() {
    localStorage.removeItem('gremio_profile')
    setProfileId(null)
    setParentMode(false)
  }

  // ---------------- render ----------------
  //
  // Ojo con la estructura: la luz ambiental se monta UNA sola vez, por
  // encima de todas las ramas. Estuvo dentro de cada una y el resultado
  // era que al cambiar de pantalla React la desmontaba, la animación
  // volvía a cero y el fondo daba un salto de casi cien píxeles. Eso era
  // el parpadeo. Si alguna vez hay que moverla, que sea sin meterla
  // dentro de un `return` condicional.

  function contenido() {
    if (!configured) return <ConfigError />
    if (session === undefined) return <Cargando />
    if (!session) return <Login />
    if (family === undefined) return <Cargando error={errorCarga} onReintentar={loadFamily} />
    if (family === null) return <Onboarding onDone={loadFamily} />
    if (!data) return <Cargando error={errorCarga} onReintentar={recargar} />

    // El tutorial explica cómo funciona y dónde está cada cosa. Se enseña
    // una vez por dispositivo y se reabre desde ⚙️.
    if (verTutorial) return <Tutorial modo={verTutorial} onCerrar={() => setVerTutorial(null)} />

    if (parentMode) {
      return (
        <ParentPanel
          family={family}
          data={data}
          refresh={recargar}
          refreshFamily={loadFamily}
          onVerTutorial={(modo) => { setParentMode(false); setVerTutorial(modo || 'todo') }}
          onExit={() => setParentMode(false)}
        />
      )
    }

    // La peque tiene su propia pantalla: botones enormes y estrella al momento.
    if (profile && profile.role === 'peque' && flag('modoPeque')) {
      return <KidHome family={family} data={data} profile={profile} refresh={recargar} onSalir={cambiarPerfil} />
    }

    return (
      <div>
        <div className="velo-superior" aria-hidden="true" />
        {profile ? (
          <Home
            family={family}
            data={data}
            profile={profile}
            refresh={recargar}
            onSwitchProfile={cambiarPerfil}
            onParent={() => setPidePin(true)}
          />
        ) : (
          <ProfilePicker
            family={family}
            profiles={perfilesActivos(data.profiles)}
            onPick={elegirPerfil}
            onParent={() => setPidePin(true)}
          />
        )}

        {pidePin && (
          <PinModal
            family={family}
            onOk={() => {
              setPidePin(false)
              setParentMode(true)
              log.info('panel.abierto')
            }}
            onClose={() => setPidePin(false)}
          />
        )}
      </div>
    )
  }

  return (
    <>
      <Ambiente />
      {contenido()}
    </>
  )
}

/**
 * Luz ambiental de fondo. Sin color detrás, un cristal solo enseña gris:
 * no hay nada que refractar. Tres manchas muy desenfocadas y muy lentas
 * bastan para que el material cambie de tono al desplazarse por encima.
 * Se para sola con `prefers-reduced-motion` y desaparece con
 * `prefers-reduced-transparency`.
 */
function Ambiente() {
  if (!flag('luzAmbiental')) return null
  const quieta = !flag('luzEnMovimiento')
  return (
    <div className={'ambiente' + (quieta ? ' quieta' : '')} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  )
}

function Cargando({ error, onReintentar }) {
  if (error) {
    return (
      <div className="pantalla-centrada">
        <div className="aviso-config">
          <h2 style={{ marginBottom: 8 }}>No se pudo cargar el gremio</h2>
          <p>{error}</p>
          <button className="btn btn-bloque" style={{ marginTop: 12 }} onClick={onReintentar}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="pantalla-centrada">
      <img src={iconoUrl} alt="" width="72" height="72" style={{ borderRadius: 18 }} />
      <p className="suave">Abriendo el gremio…</p>
    </div>
  )
}

function ConfigError() {
  return (
    <div className="pantalla-centrada">
      <div className="aviso-config">
        <h2 style={{ marginBottom: 8 }}>Falta configurar Supabase</h2>
        <p>1. Copia <code>.env.example</code> a <code>.env</code>.</p>
        <p>2. Pega la URL del proyecto y la clave <code>anon</code> (Supabase → Project Settings → API).</p>
        <p>3. Ejecuta <code>schema.sql</code> en el SQL Editor de Supabase.</p>
        <p>4. Reinicia <code>npm run dev</code>.</p>
        <p className="suave">
          ¿Solo quieres verla funcionar? Arranca con <code>npm run dev:demo</code>: usa un backend simulado en el
          navegador, sin Supabase y sin datos reales.
        </p>
      </div>
    </div>
  )
}
