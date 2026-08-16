// ------------------------------------------------------------------
// Endpoint de salud, como Edge Function de Supabase.
//
//   GET https://<proyecto>.functions.supabase.co/health
//
// Es el punto que puede consultar un balanceador o un monitor externo
// (UptimeRobot, Better Stack, un cron) sin credenciales de sesión.
// Devuelve 200 si la base responde y 503 si no, que es lo que un
// monitor necesita para distinguir "vivo" de "responde pero roto".
//
// Desplegar (requiere la CLI de Supabase, ver docs/RUNBOOK.md):
//   supabase functions deploy health --no-verify-jwt
//
// La app NO depende de esto: dentro de la sesión usa la función SQL
// health() directamente. Esto es para vigilancia desde fuera.
// ------------------------------------------------------------------

const VERSION = Deno.env.get('APP_VERSION') ?? 'desconocida'

// El único CORS de este proyecto que se puede configurar, porque es el
// único servidor propio. Ni el REST de Supabase ni GitHub Pages dejan
// tocarlo: los dos responden `*` por diseño.
//
// Se restringe al sitio de la app y no a `*` por lo de siempre —no
// repartir más de lo que hace falta—, pero conviene ser honestos sobre lo
// que compra: CORS es una regla del NAVEGADOR. Un monitor externo, un
// `curl` o un script la ignoran por completo, y este endpoint está hecho
// justamente para que lo lea un monitor. O sea que esto no lo esconde de
// nadie: solo evita que la página de un tercero lo lea desde el navegador
// de quien la visita. Lo que de verdad protege este endpoint es que no
// devuelve nada sensible: versión, si la base responde y cuánto tarda.
const ORIGEN = Deno.env.get('APP_ORIGIN') ?? 'https://elgremioapp.com'

Deno.serve(async (peticion) => {
  const inicio = Date.now()
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_ANON_KEY')

  const cabeceras = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': ORIGEN,
    // Sin esto, un proxy que cachee la respuesta puede servirle a un
    // origen la cabecera calculada para otro.
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff'
  }

  // El preflight tiene que contestarse o el navegador ni llega a pedir.
  if (peticion.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...cabeceras, 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Max-Age': '3600' }
    })
  }

  if (!url || !key) {
    return new Response(
      JSON.stringify({ status: 'error', motivo: 'faltan SUPABASE_URL o SUPABASE_ANON_KEY' }),
      { status: 503, headers: cabeceras }
    )
  }

  try {
    const respuesta = await fetch(`${url}/rest/v1/rpc/health`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(5000)
    })

    const ms = Date.now() - inicio

    if (!respuesta.ok) {
      return new Response(
        JSON.stringify({
          status: 'error',
          version: VERSION,
          ms,
          checks: { database: { ok: false, http: respuesta.status } }
        }),
        { status: 503, headers: cabeceras }
      )
    }

    const cuerpo = await respuesta.json()
    return new Response(
      JSON.stringify({
        status: 'ok',
        version: VERSION,
        ms,
        ts: new Date().toISOString(),
        checks: { database: { ok: true, postgres: cuerpo?.postgres } }
      }),
      { status: 200, headers: cabeceras }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        version: VERSION,
        ms: Date.now() - inicio,
        checks: { database: { ok: false, motivo: String(error) } }
      }),
      { status: 503, headers: cabeceras }
    )
  }
})
