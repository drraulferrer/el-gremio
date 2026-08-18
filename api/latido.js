// ------------------------------------------------------------------
// El latido que impide que Supabase se duerma.
//
// POR QUÉ EXISTE: el fallo más probable de esta app no es el alojamiento,
// es que **el plan gratuito de Supabase pausa el proyecto tras 7 días sin
// actividad** (§7 del arranque). Cuando eso pasa, la web se sirve
// perfectamente y no funciona nada: ni entrar, ni misiones, ni los avisos
// —que viven en un `pg_cron` DENTRO del proyecto pausado y por tanto
// también se paran—. Reactivarlo es a mano y tarda un par de minutos, y
// hasta hoy dependía de que alguien se diera cuenta.
//
// Una consulta al día basta para que el contador de inactividad no llegue
// nunca a siete. Lo lanza el cron declarado en `vercel.json`.
//
// Llama a `rpc/health`, que es la MISMA función que usa `npm run health`:
// así el latido no es una ruta muerta que solo se ejercita a sí misma, y
// si un día deja de responder, falla por la misma razón por la que
// fallaría la comprobación de salud de siempre.
// ------------------------------------------------------------------

const TIEMPO_LIMITE = 10000

/**
 * @param {import('http').IncomingMessage & { headers: Record<string, string> }} req
 * @param {import('http').ServerResponse & { status: (c: number) => any, json: (b: unknown) => void }} res
 */
export default async function handler(req, res) {
  // Vercel firma sus propias llamadas de cron con este secreto. Si está
  // configurado se exige; sin él, cualquiera podría disparar el latido a
  // voluntad. No es que hacerlo rompa nada —la consulta es de solo
  // lectura— pero una ruta abierta que habla con la base de datos es una
  // ruta que alguien acabará usando para medir cuánto aguanta.
  const secreto = process.env.CRON_SECRET
  if (secreto && req.headers.authorization !== `Bearer ${secreto}`) {
    return res.status(401).json({ ok: false, error: 'no autorizado' })
  }

  const url = process.env.VITE_SUPABASE_URL
  const clave = process.env.VITE_SUPABASE_ANON_KEY

  // Sin credenciales el latido no puede latir. Devolverlo como 500 y no
  // como un 200 silencioso es deliberado: un cron que dice «bien» sin
  // haber hecho nada es peor que un cron que no existe, porque además
  // convence de que el problema está resuelto.
  if (!url || !clave) {
    return res.status(500).json({
      ok: false,
      error: 'faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno'
    })
  }

  const control = new AbortController()
  const temporizador = setTimeout(() => control.abort(), TIEMPO_LIMITE)
  const inicio = Date.now()

  try {
    const respuesta = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/health`, {
      method: 'POST',
      signal: control.signal,
      headers: {
        apikey: clave,
        Authorization: `Bearer ${clave}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    })

    const texto = await respuesta.text()
    const ms = Date.now() - inicio

    if (!respuesta.ok) {
      return res.status(502).json({
        ok: false,
        ms,
        error: `HTTP ${respuesta.status}`,
        detalle: texto.slice(0, 200)
      })
    }

    const cuerpo = JSON.parse(texto)
    return res.status(200).json({
      ok: cuerpo.status === 'ok',
      ms,
      postgres: cuerpo.postgres,
      momento: new Date().toISOString()
    })
  } catch (error) {
    return res.status(502).json({
      ok: false,
      ms: Date.now() - inicio,
      error: error instanceof Error ? error.message : 'error desconocido'
    })
  } finally {
    clearTimeout(temporizador)
  }
}
