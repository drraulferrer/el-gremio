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

Deno.serve(async () => {
  const inicio = Date.now()
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_ANON_KEY')

  const cabeceras = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
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
