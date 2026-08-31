import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, configured, modoDemo, crearSinkDeLogs, mensajeDeError, configurarZona } from './lib/supabase'
import { ganablesPor, insigniaPorCodigo } from './lib/insignias'
import { meritosDe } from './lib/meritos'
import { proyeccionDe, sellosGanados } from './lib/sellos-motor'
import { EVALUABLES } from './lib/sellos'
import { historialAprobado, conNuevas } from './lib/sellos-carga'
import { log, setContexto, setSink, instalarVaciadoAlSalir, nuevoRequestId } from './lib/log'
import { instalarMonitorizacion, capturar } from './lib/monitoring'
import { instalarActividadExterna } from './lib/actividadExterna'
import { flag } from './lib/flags'
import { vibrar, LOGRO } from './lib/vibrar'
import { marcaDe, queCelebrar } from './lib/celebracion'
import { generoDe } from './lib/genero'
import { levelProgress } from './lib/supabase'
import { perfilesActivos, estaActivo } from './lib/miembros'
import {
  elegirActivo, leerGremioActivo, recordarGremioActivo,
  leerPerfil, recordarPerfil, olvidarPerfil
} from './lib/gremios'
import { RELEASE } from './lib/version'
import { registrarServiceWorker, apuntarPerfil } from './lib/push'
import { PinModal, Celebracion } from './components/ui'
import Retrato from './components/Retrato'
import LoteDeSellos from './components/LoteDeSellos'
import TalisAMano from './components/TalisAMano'
import { manualesDe, pendientesDeAviso, leerAvisados, marcarAvisados } from './lib/premioManual'
import Login from './screens/Login'
import NuevaClave from './screens/NuevaClave'
import {
  esRecuperacion, esConfirmacion, hayIdentidadEnMarcha, olvidarIdentidadEnMarcha
} from './lib/acceso'
import { terminarIdentidad } from './lib/acciones'
import { mensajeDeTerminar } from './lib/expansion'
import Onboarding from './screens/Onboarding'
import Invitaciones from './screens/Invitaciones'
import ProfilePicker from './screens/ProfilePicker'
import ReportarFallo from './screens/ReportarFallo'
import { useVersionNueva } from './lib/actualizacion'
import Home from './screens/Home'
import KidHome from './screens/KidHome'
import ParentPanel from './screens/ParentPanel'
import ReconsentimientoLegal from './screens/ReconsentimientoLegal'
import { VERSION_LEGAL } from './lib/legal'
import Tutorial, { tutorialPendiente } from './screens/Tutorial'

const iconoUrl = import.meta.env.BASE_URL + 'assets/emblema-gremio.png'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = comprobando
  const [family, setFamily] = useState(undefined) // undefined = cargando · null = aún no existe
  // Todos mis gremios, para el selector. Con uno solo —que es el caso de
  // hoy— la lista tiene un elemento y no se enseña ningún selector.
  const [gremios, setGremios] = useState([])
  const [data, setData] = useState(null)
  const [errorCarga, setErrorCarga] = useState('')
  // Ya NO se inicializa desde `localStorage` aquí: el personaje es por
  // gremio, y hasta que no se sabe cuál es el activo no hay clave que leer.
  // Lo pone `loadFamily`.
  const [profileId, setProfileId] = useState(null)
  const [pidePin, setPidePin] = useState(false)
  // Los códigos recién concedidos a quien mira, para celebrarlos en UN
  // lote. `perfilActual` es la misma cosa en forma de ref porque
  // `otorgarInsignias` corre fuera del render y leería un valor viejo.
  const [loteNuevo, setLoteNuevo] = useState([])
  // La celebración de una validación o de un nivel.
  //
  // VIVE AQUÍ Y NO EN HOME, y eso es lo que arregla el fallo de la
  // 2.23.2: la detección es una DIFERENCIA entre dos cargas de datos, y
  // Home se desmonta entero cada vez que alguien entra en el panel
  // parental —que es justo donde se valida—. Al volver, Home montaba de
  // cero, su `prev` era null y la primera pasada solo servía para tomar
  // la referencia: quien validaba su propia misión no veía nunca ni la
  // celebración ni la cuenta de la Bolsa. En un móvil con un solo
  // adulto, eso era TODAS las veces.
  //
  // App no se desmonta nunca, así que la referencia sobrevive al panel y
  // la celebración sale al salir de él.
  const [celeb, setCeleb] = useState(null)
  const ultimoVisto = useRef(null)

  // Los Talis entregados a mano que todavía no se le han contado a quien
  // los recibió. Ver src/components/TalisAMano.jsx.
  const [talisAMano, setTalisAMano] = useState([])
  const perfilActual = useRef(profileId)
  useEffect(() => { perfilActual.current = profileId }, [profileId])
  // El historial completo para los sellos: se pagina una vez y se va
  // completando. `null` = todavía no se ha traído.
  const historialSellos = useRef(null)
  // Espejo en estado del historial de arriba, para que Progreso pueda
  // calcular «cuánto te falta» sin volver a pedirlo.
  const [historialUI, setHistorialUI] = useState(null)
  // Ojo: el estado se inicializa UNA vez desde localStorage y no se
  // consulta en cada render. Si se leyera cada vez, cerrar el tutorial
  // llamaría a setVerTutorial(false) sobre un false y React no
  // re-renderizaría: la pantalla se quedaría pegada para siempre.
  const [verTutorial, setVerTutorial] = useState(() => (tutorialPendiente() ? 'todo' : null))
  const [parentMode, setParentMode] = useState(false)
  // La hoja de «algo va mal». Vive aquí y no dentro del selector para que
  // sobreviva a que el selector se recargue por realtime mientras alguien
  // está escribiendo: perder lo escrito es perder el informe.
  const [contandoFallo, setContandoFallo] = useState(false)
  // La bandeja es de la PERSONA, así que vive aquí y no dentro de un gremio.
  const [viendoInvitaciones, setViendoInvitaciones] = useState(false)
  // Si hay publicada una versión distinta de la que corre aquí. No
  // recarga sola: avisa. Ver src/lib/actualizacion.js.
  const versionNueva = useVersionNueva()
  // Viene del enlace del correo. Se mira la URL ya en el primer render
  // además de escuchar el evento: supabase-js consume el hash al arrancar
  // y puede avisar antes de que esto esté escuchando.
  const [cambiandoClave, setCambiandoClave] = useState(
    () => esRecuperacion(window.location.hash, window.location.search)
  )
  // Y la otra vuelta del correo, la de confirmar la cuenta. `terminando`
  // mientras `completar_conversion()` decide, y después el aviso si no
  // salió: ver el efecto de abajo.
  const [identidad, setIdentidad] = useState(
    () => (esConfirmacion(window.location.hash, window.location.search)
      ? { estado: 'terminando', aviso: '' }
      : { estado: 'nada', aviso: '' })
  )
  // El cinturón se prueba UNA vez por carga. Con `useRef` y no con estado
  // porque el efecto que lo usa mira `family`, y un `set` ahí dentro sería
  // un bucle.
  const cinturonIdentidad = useRef(false)

  // Observabilidad: monitorización de errores globales y destino de logs.
  useEffect(() => {
    const quitarMonitor = instalarMonitorizacion()
    const quitarVaciado = instalarVaciadoAlSalir()
    instalarActividadExterna()
    setSink(crearSinkDeLogs())
    log.info('app.arranque', { release: RELEASE, demo: modoDemo, configurado: configured })
    return () => {
      quitarMonitor()
      quitarVaciado()
    }
  }, [])

  // El service worker se registra al arrancar y no pide permiso a nadie:
  // registrarlo es gratis y silencioso, y sin él la pantalla de Avisos no
  // tendría a qué suscribirse cuando alguien pulse el botón.
  useEffect(() => {
    registrarServiceWorker().catch((err) => log.warn('push.sw.error', { detalle: String(err) }))
  }, [])

  // Sesión
  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data: d }) => setSession(d.session))
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s)
      // El enlace del correo ABRE SESIÓN. Sin atender este evento, quien
      // venía a cambiar la contraseña entra en su gremio, lo ve todo
      // normal y se va sin haberla cambiado.
      if (evento === 'PASSWORD_RECOVERY') setCambiandoClave(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Familia
  //
  // Desde la 6.2 se traen TODOS mis gremios y se abre el ACTIVO. El
  // `limit 1` de antes no era un descuido: la migración 017 puso un índice
  // único para que una cuenta no pudiera tener dos, y ese índice dejó de ser
  // único en la 057. Desde la 045 la RLS ya deja leer `families` a quien
  // pertenece, así que sin este cambio el segundo gremio no es que se viera
  // mal: sería invisible.
  const loadFamily = useCallback(async (preferido = null) => {
    const { data: fams, error } = await supabase
      .from('families')
      .select('*')
      .order('created_at')
    if (error) {
      capturar(error, { origen: 'loadFamily' })
      setErrorCarga(mensajeDeError(error))
      return
    }
    // Y el nombre visible de su tipo, para que el selector pueda decir en
    // qué clase de sitio es cada uno (`C-5`). Sale de la PLANTILLA y no de
    // una lista de nombres escrita aquí, que es la regla que la 053 dejó
    // puesta. Degradable: sin la migración viene vacío y los chips salen
    // solo con el nombre del gremio.
    const { data: plantillas } = await supabase.rpc('plantilla_de_gremio')
    const visibles = new Map((plantillas || []).map((t) => [t.family_id, t.nombre_visible]))
    const mios = (fams || []).map((f) => ({ ...f, tipo_visible: visibles.get(f.id) || null }))
    setGremios(mios)
    // `elegirActivo` cae al más antiguo si el guardado ya no es mío, que es
    // `C-3`: abandonar desde otro aparato no puede dejar la app en blanco.
    const gremio = elegirActivo(mios, preferido || leerGremioActivo()) || null

    // El día de esta casa lo decide la familia, no el aparato. Se
    // configura aquí, en el único sitio por el que pasa siempre, y antes
    // de que nada pinte: si se hiciera más abajo, la primera pasada de
    // `dayKey` usaría la zona del dispositivo y «hecho hoy» podría salir
    // vacío durante un cuadro. Una base sin la migración 018 no trae la
    // columna: en ese caso se queda la del dispositivo, que es lo que
    // había antes.
    configurarZona(gremio?.timezone)

    // El personaje es de ESTE gremio. `leerPerfil` rescata además la clave
    // global de antes de la 6.2, para que desplegar esto no expulse a nadie
    // de su personaje.
    if (gremio) {
      recordarGremioActivo(gremio.id)
      setProfileId(leerPerfil(gremio.id))
    } else {
      setProfileId(null)
    }

    setFamily(gremio)
  }, [])

  // La vuelta del enlace del correo TERMINA la conversión (`F-9` paso 3).
  //
  // Va ANTES de cargar el gremio y no en paralelo, y esa es la parte que
  // importa: la pertenencia que crea `completar_conversion()` es lo que
  // hace que el gremio exista para esta cuenta. Cargando primero, quien
  // acaba de crearse una identidad vería «Fundad vuestro gremio» durante
  // un cuarto de segundo, que es tiempo de sobra para el susto.
  useEffect(() => {
    if (!session || identidad.estado !== 'terminando') return
    let vivo = true
    terminarIdentidad(session.user?.id).then((codigo) => {
      if (!vivo) return
      const aviso = mensajeDeTerminar(codigo, hayIdentidadEnMarcha())
      // La nota se retira en cuanto deja de poder explicar nada: o salió
      // bien, o el motivo ya no es la caducidad.
      if (codigo !== 'sin_solicitud' || !aviso) olvidarIdentidadEnMarcha()
      setIdentidad({ estado: 'hecho', aviso: aviso || '' })
    })
    return () => { vivo = false }
  }, [session, identidad.estado])

  useEffect(() => {
    if (!session) {
      setFamily(undefined)
      setData(null)
      return
    }
    if (identidad.estado !== 'terminando') loadFamily()
  }, [session, loadFamily, identidad.estado])

  // El cinturón, que es el mismo patrón que `esRecuperacion` sigue con su
  // evento: supabase-js consume el hash al arrancar y puede habérselo
  // llevado antes de que esto mirara, y además el enlace se puede abrir
  // hoy y volver a la app mañana. La señal entonces es la única que queda:
  // hay sesión y NINGÚN gremio, que es o alguien nuevo —y contesta
  // `sin_solicitud`, gratis— o alguien cuya conversión se quedó a medias.
  //
  // Solo se intenta sin gremio, así que a quien ya tiene uno no le cuesta
  // ni una llamada.
  useEffect(() => {
    if (family !== null || cinturonIdentidad.current) return
    cinturonIdentidad.current = true
    terminarIdentidad(session?.user?.id).then((codigo) => {
      if (codigo !== 'ok') return
      olvidarIdentidadEnMarcha()
      loadFamily()
    })
  }, [family, session, loadFamily])

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
      supabase.from('power_uses').select('*').eq('family_id', fid),
      supabase.from('push_log').select('*').eq('family_id', fid).order('dia', { ascending: false }).limit(30),
      // El plan de los últimos días. Solo lo reciente: la purga lo mantiene
      // corto, y este `gte` es una red por si no ha corrido. Va al final del
      // bloque degradable como las dos de arriba: sin la migración 025 la
      // tabla no existe y la app sigue entera menos esta pieza.
      supabase.from('plan_diario').select('*')
        .eq('family_id', fid)
        .gte('dia', new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)),
      // Las campañas del modo limpieza. En el bloque degradable por lo
      // mismo que las demás: sin la migración 031 la tabla no existe y
      // la app sigue entera menos esta pieza.
      supabase.from('campanas_limpieza').select('*')
        .eq('family_id', fid)
        .order('created_at', { ascending: false })
        .limit(20),
      // Las zonas de la casa (migración 032). Degradable como las demás:
      // sin la tabla, el modo limpieza cae a las zonas por defecto.
      supabase.from('zonas_casa').select('*').eq('family_id', fid).order('orden'),
      // Los reconocimientos (migración 034). Degradable como las demás:
      // sin la tabla, el muro enseña solo los elogios de validación y dar
      // las gracias no aparece. Nada más se cae.
      supabase.from('reconocimientos').select('*')
        .eq('family_id', fid)
        .order('created_at', { ascending: false })
        .limit(400),
      // Lo que de verdad puede gastar cada personaje (migración 052). Desde la
      // 051, quien tiene identidad personal tiene su saldo en la cartera y su
      // `profiles.coins` vale cero: sin esto, la tienda le enseñaría cero Talis
      // y todos los premios en gris teniendo dinero. Va la última y en el
      // bloque degradable: sin la migración, la respuesta viene vacía y el
      // saldo se queda el de `profiles`, que es exactamente lo de siempre.
      supabase.rpc('saldos_visibles'),
      // La plantilla del tipo de gremio (migración 053). Es lo que sustituye a
      // los `if` por tipo repartidos por las pantallas: el vocabulario y los
      // interruptores salen de aquí, no de comparar `tipo_gremio` a mano. En el
      // bloque degradable como las demás: sin la migración viene vacía y cada
      // pantalla cae a lo que hacía antes.
      supabase.rpc('plantilla_de_gremio')
    ])

    const fallo = respuestas.slice(0, 7).find((r) => r.error)
    if (fallo) {
      capturar(fallo.error, { origen: 'loadAll', request_id: requestId })
      setErrorCarga(mensajeDeError(fallo.error))
      return
    }
    setErrorCarga('')

    const [pr, ch, co, rw, rd, gl, bg, bo, pu, pl, pd, cl, zc, rc, sv, pt] = respuestas
    const metas = gl.data || []

    // El saldo que se puede gastar sustituye a `coins` en el objeto que ve la
    // interfaz. Es lo que TODAS las pantallas quieren decir cuando dicen
    // «coins», así que ninguna tiene que enterarse de que hay dos monederos:
    // la tienda, el tablero de la peque y la lista de miembros siguen igual.
    // La columna de la base no se toca; esto es solo lo que se pinta.
    const saldos = new Map((sv?.data || []).map((s) => [s.profile_id, s.saldo]))
    const perfiles = (pr.data || []).map((p) =>
      saldos.has(p.id) && saldos.get(p.id) !== p.coins ? { ...p, coins: saldos.get(p.id) } : p
    )

    const next = {
      // La plantilla de ESTE gremio, o null si la migración no está. Las
      // pantallas la leen con `rasgoDeTipo`, que sabe caer a lo de siempre.
      plantilla: (pt?.data || []).find((t) => t.family_id === fid) || null,
      profiles: perfiles,
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
      powerUses: pu.error ? [] : pu.data || [],
      pushLog: pl.error ? [] : pl.data || [],
      planDiario: pd.error ? [] : pd.data || [],
      campanas: cl.error ? [] : cl.data || [],
      zonas: zc.error ? [] : zc.data || [],
      reconocimientos: rc.error ? [] : rc.data || []
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

    // Los sellos del catálogo v1. Van al MISMO lote que las 16 de siempre
    // para que una acción que desbloquea las dos cosas produzca una sola
    // celebración, no dos seguidas.
    //
    // Su historial se pide aparte y entero: las 400 completions del
    // tablero no alcanzan para preguntar por mil días. Si esa carga falla
    // o se queda a medias, `completa` sale false y el motor se abstiene de
    // las reglas que podrían dar un falso positivo.
    if (flag('sellosV2')) {
      // Se pagina una vez por sesión; después basta con pegarle lo que
      // haya llegado nuevo, que siempre viene en el lote reciente.
      if (!historialSellos.current) {
        historialSellos.current = await historialAprobado(supabase, fid)
      } else {
        historialSellos.current = conNuevas(historialSellos.current, d.completions)
      }
      const { filas, completa } = historialSellos.current
      // El mismo historial que evalúa lo usa la pantalla de Colecciones
      // para decir cuánto falta. Va a estado —y no se queda solo en el
      // ref— porque el ref no repinta: sin esto, «te faltan 3 días» se
      // quedaba congelado hasta recargar la app entera.
      setHistorialUI(historialSellos.current)

      for (const p of activos) {
        const tiene = new Set(d.badges.filter((b) => b.profile_id === p.id).map((b) => b.code))
        const proyeccion = proyeccionDe(p, {
          completions: filas,
          challenges: d.challenges,
          metas: d.goals || [],
          completa
        })
        for (const s of sellosGanados(proyeccion, EVALUABLES, tiene)) {
          normales.push({ family_id: fid, profile_id: p.id, code: s.id })
        }
      }
    }

    if (!normales.length && !unicas.length) return

    otorgando.current = true
    let puestas = 0

    if (normales.length) {
      // Las TRES columnas del índice único, no dos. La 030 cambió
      // `(profile_id, code)` por `(profile_id, code, instance_key)` para
      // que un sello pueda repetirse por temporada, y este `onConflict`
      // se quedó pidiendo el índice viejo: Postgres responde 42P10, la
      // fila entera se cae y NO se concede nada. `instance_key` no viaja
      // en la fila —la base pone su '' por defecto antes de resolver el
      // conflicto—, pero el destino del conflicto sí tiene que nombrarla.
      const { error } = await supabase
        .from('profile_badges')
        .upsert(normales, { onConflict: 'profile_id,code,instance_key', ignoreDuplicates: true })
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

      // El lote de QUIEN está mirando la app, no el de toda la familia:
      // celebrar en el móvil de alguien lo que ha ganado otra persona
      // convierte su pantalla en el tablón de los demás.
      const mios = [...normales, ...unicas]
        .filter((f) => f.profile_id === perfilActual.current)
        .map((f) => f.code)
      // Se SUMA al lote abierto en vez de sustituirlo. Conceder recarga
      // los datos, y esa recarga vuelve a pasar por aquí: la segunda
      // tanda llegaba como un modal nuevo encima del que se estaba
      // leyendo. Un desbloqueo múltiple tiene que producir una sola
      // experiencia (INSIGNIAS-04 §9.6), venga en una pasada o en tres.
      if (mios.length) setLoteNuevo((prev) => [...new Set([...prev, ...mios])])
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campanas_limpieza', filter: 'family_id=eq.' + family.id }, programarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zonas_casa', filter: 'family_id=eq.' + family.id }, programarRecarga)
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

  // A quién avisa este aparato. Desde la 058 hay dos casos y `apuntarPerfil`
  // los distingue: si el personaje nuevo lleva detrás MI cuenta soy yo en
  // otro gremio —y la suscripción se suma—; si no, el aparato ha cambiado de
  // manos y se sustituye. Por eso hace falta pasarle quién soy.
  useEffect(() => {
    if (!family || !profile) return
    let vivo = true
    supabase.auth.getUser().then(({ data }) => {
      if (vivo) apuntarPerfil({ family, profile, persona: data?.user?.id || null })
    })
    return () => { vivo = false }
  }, [family?.id, profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ¿Han caído Talis a mano sin avisar? Se mira aquí y no dentro de Home
  // por lo mismo que el lote de sellos: el aviso tiene que sobrevivir a
  // que la pantalla se recargue por realtime mientras se está leyendo.
  //
  // Lo viejo se marca como visto en silencio: estrenar la app en un móvil
  // nuevo no puede sacar de golpe los premios a mano de toda la historia
  // del gremio.
  useEffect(() => {
    if (!data || !profile) return
    const manuales = manualesDe(data.bonuses, profile.id, data.profiles)
    const { avisar, callar } = pendientesDeAviso(manuales, leerAvisados(profile.id))
    if (callar.length) marcarAvisados(profile.id, callar.map((m) => m.id))
    if (avisar.length) setTalisAMano(avisar)
  }, [data, profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Qué hay nuevo desde la última carga. La regla vive en
  // `lib/celebracion.js` y está probada allí; aquí solo se le da de
  // comer y se guarda la marca para la próxima.
  useEffect(() => {
    if (!data || !profile) return

    // El mundo de la peque queda fuera: su pantalla se aprueba en el
    // acto y tiene su propia respuesta (estrella, sonido, háptico). Una
    // segunda celebración encima, con texto que todavía no lee, sería
    // ruido sobre lo que ya funciona.
    if (profile.role === 'peque' && flag('modoPeque')) {
      ultimoVisto.current = null
      return
    }

    const aprobadas = data.completions.filter(
      (c) => c.profile_id === profile.id && c.status === 'aprobado'
    )
    const nivel = levelProgress(profile.xp).level
    // El género va aquí porque el nombre de una fase lleva las tres formas
    // —{Decana|Decano|Decanato}— y sin esto la celebración enseñaría las
    // llaves en pantalla. Lo pilló un test, no la pantalla.
    const fiesta = queCelebrar({
      antes: ultimoVisto.current, aprobadas, nivel,
      profileId: profile.id, genero: generoDe(profile)
    })

    if (fiesta) {
      vibrar(LOGRO)
      setCeleb(fiesta)
    }
    ultimoVisto.current = marcaDe({ aprobadas, nivel, profileId: profile.id })
  }, [data, profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function cerrarTalisAMano() {
    marcarAvisados(profile.id, talisAMano.map((m) => m.id))
    setTalisAMano([])
  }

  function elegirPerfil(id) {
    recordarPerfil(family?.id, id)
    setProfileId(id)
  }

  function cambiarPerfil() {
    olvidarPerfil(family?.id)
    setProfileId(null)
    setParentMode(false)
  }

  // Cambiar de gremio es una LECTURA, no una transacción: no cuesta, no
  // caduca nada, no consume nada (`C-1`).
  //
  // Y no arrastra nada a medias (`C-6`): una validación pendiente, un canje
  // sin confirmar o un panel abierto pertenecen al gremio donde se
  // empezaron. Por eso se sueltan `data`, el personaje, el panel y las dos
  // referencias de celebración antes de recargar. La zona horaria y la
  // temporada se recalculan solas porque `loadFamily` vuelve a llamar a
  // `configurarZona` y `loadAll` vuelve a traer las metas: es `C-4`, la
  // trampa más probable de este flujo.
  function cambiarGremio(id) {
    if (!id || id === family?.id) return
    log.info('gremio.cambiado', { family_id: id })
    recordarGremioActivo(id)
    setParentMode(false)
    setProfileId(null)
    setData(null)
    setCeleb(null)
    setLoteNuevo([])
    setTalisAMano([])
    ultimoVisto.current = null
    historialSellos.current = null
    setHistorialUI(null)
    setFamily(undefined)
    loadFamily(id)
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
    // Va ANTES que el gremio a propósito: quien viene del enlace del
    // correo tiene que cambiar la contraseña antes de nada, y si se
    // dibujara después vería su tablero y se le olvidaría.
    if (session && cambiandoClave) return <NuevaClave onHecho={() => setCambiandoClave(false)} />
    if (!session) return <Login />
    // Igual que arriba: primero se termina lo que el correo dejó a medias.
    // Dura una llamada, pero es la llamada que decide si esta cuenta tiene
    // gremio o no, así que la pantalla lo dice en vez de fingir que carga.
    if (identidad.estado === 'terminando') return <Cargando mensaje="Terminando de crear tu identidad…" />
    if (family === undefined) return <Cargando error={errorCarga} onReintentar={loadFamily} />
    // Al terminar el setup se apaga el tutorial ADEMÁS de marcarlo visto:
    // `verTutorial` se calculó en el primer render, cuando todavía estaba
    // pendiente, así que solo con la marca la familia se comía las once
    // diapositivas justo después de haber contestado las preguntas que
    // vienen a contar lo mismo.
    if (family === null) {
      // Si la vuelta del correo no salió bien, esta persona está en una
      // cuenta nueva y vacía y su casa parece haber desaparecido. Decirlo
      // aquí es lo único que la separa de creer que ha roto algo: el aviso
      // termina siempre en que su gremio sigue intacto.
      return (
        <>
          {identidad.aviso && (
            <p className="aviso" role="alert" style={{ margin: 16 }}>{identidad.aviso}</p>
          )}
          <Onboarding onDone={() => { setVerTutorial(null); loadFamily() }} />
        </>
      )
    }
    if (!data) return <Cargando error={errorCarga} onReintentar={recargar} />

    // El tutorial explica cómo funciona y dónde está cada cosa. Se enseña
    // una vez por dispositivo y se reabre desde ⚙️.
    if (verTutorial) return <Tutorial modo={verTutorial} onCerrar={() => setVerTutorial(null)} />

    if (parentMode) {
      // Consentir es cosa de quien tiene la patria potestad, y esta es la
      // única puerta del panel: entrar por aquí ya demostró el PIN. Se
      // enseña ANTES que el panel y no en el resto de la app a propósito.
      if (family.legal_version !== VERSION_LEGAL) {
        return (
          <ReconsentimientoLegal family={family} onAceptado={loadFamily} onSalir={() => setParentMode(false)} />
        )
      }
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

        {/* Va aquí y no más arriba a propósito: la pantalla de la peque
            sale antes de este punto, y un cartel de texto que ella no
            puede leer solo sería ruido. Cuando un adulto salga de su
            pantalla al selector, lo verá. */}
        {versionNueva && (
          <p className="aviso-carga" role="status">
            Hay una versión nueva del gremio. Esta lleva abierta un rato y puede que le falten arreglos.
            <button className="btn btn-mini" style={{ marginLeft: 8 }} onClick={() => window.location.reload()}>
              Recargar
            </button>
          </p>
        )}

        {profile ? (
          <Home
            family={family}
            data={data}
            profile={profile}
            refresh={recargar}
            onSwitchProfile={cambiarPerfil}
            onParent={() => setPidePin(true)}
            historial={historialUI}
            onCelebrar={setCeleb}
            onIrAlGremio={cambiarGremio}
          />
        ) : (
          <ProfilePicker
            family={family}
            // Sin mascotas: nadie «entra como el perro». Es la
            // exclusión más fácil de olvidar y la más visible si se
            // olvida, porque sale en la primera pantalla.
            profiles={perfilesActivos(data.profiles).filter((p) => p.role !== 'mascota')}
            onPick={elegirPerfil}
            onParent={() => setPidePin(true)}
            onReportar={() => setContandoFallo(true)}
            gremios={gremios}
            onCambiarGremio={cambiarGremio}
            onVerInvitaciones={() => setViendoInvitaciones(true)}
          />
        )}

        {viendoInvitaciones && (
          <Invitaciones
            onClose={() => setViendoInvitaciones(false)}
            /* Aceptar deja dentro de un gremio nuevo, así que lo natural es
               abrirlo. Es el mismo camino que el selector. */
            onIrAlGremio={(id) => { loadFamily(id); recordarGremioActivo(id) }}
          />
        )}

        {contandoFallo && (
          <ReportarFallo
            pantalla="selector"
            familyId={family.id}
            profileId={profile?.id || null}
            onClose={() => setContandoFallo(false)}
          />
        )}

        {/* La celebración se DETECTA arriba, en App, para que sobreviva al
            panel parental; se PINTA aquí, dentro de la rama de los
            mayores, para no invadir el mundo de la peque, que tiene su
            propia respuesta. Si se validó algo estando en el panel, sale
            al salir de él, que es cuando hay alguien mirando. */}
        {/* La celebración ESPERA a que no haya un modal encima.
            Su temporizador corre desde que se monta, así que si sale
            debajo del lote de sellos —y sale, porque la misma validación
            puede conceder sello y subir de fase— se apaga sin que nadie
            la vea. Aquí no se pierde: se queda en el estado y se pinta
            cuando la pantalla vuelve a estar libre.

            Se comprueban los dos modales de premio porque son los que
            coinciden con una validación. El PIN y el parte de fallo los
            abre una persona a mano, y ahí no hay nada que atropellar. */}
        {celeb && loteNuevo.length === 0 && talisAMano.length === 0 && (
          <Celebracion
            emoji={celeb.emoji}
            texto={celeb.texto}
            nota={celeb.nota}
            elogio={celeb.elogio}
            intensidad={celeb.intensidad}
            /* En un cambio de fase se enseña la figura con el equipo ya
               puesto: el perfil llega con la XP nueva, así que Retrato
               dibuja la fase recién ganada sin que haya que decírselo. */
            figura={celeb.fase ? <Retrato perfil={profile} tamano={120} vista="cuerpo" /> : null}
            onDone={() => setCeleb(null)}
          />
        )}

        {/* Va fuera de Home a propósito: el lote se concede desde aquí y
            tiene que sobrevivir a que Home se recargue por realtime. */}
        {profile && loteNuevo.length > 0 && (
          <LoteDeSellos
            codigos={loteNuevo}
            genero={profile.gender}
            onClose={() => setLoteNuevo([])}
          />
        )}

        {/* Va fuera de Home por lo mismo que el lote de sellos: el aviso
            tiene que sobrevivir a una recarga por realtime. Y NO se
            monta en la pantalla de la peque, que es a propósito: su
            mundo es de papel crema y botones enormes, y un motivo
            escrito no le dice nada a quien todavía no lee. Cuando
            reciba Talis a mano se lo cuenta quien se los da, que es
            como funciona a esa edad. */}
        {profile && talisAMano.length > 0 && (
          <TalisAMano premios={talisAMano} onClose={cerrarTalisAMano} />
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

function Cargando({ error, onReintentar, mensaje }) {
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
      <p className="suave">{mensaje || 'Abriendo el gremio…'}</p>
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
