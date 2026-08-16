// ------------------------------------------------------------------
// Edge Function `notificar` · el que reparte los avisos.
//
// La despierta `pg_cron` cada hora. Esta función NO decide a quién avisar:
// eso lo dice la vista `push_pendientes`, en SQL, donde se puede mirar y
// corregir desde el editor sin volver a desplegar nada. Aquí solo se
// compone la frase, se firma y se manda.
//
// EL ORDEN IMPORTA: primero se apunta en `push_log` y después se envía.
// Al revés, un fallo a mitad de envío dejaría el día sin apuntar y el
// siguiente disparo del cron —una hora después— volvería a escribir a
// quien ya recibió el aviso. Perder un aviso por un fallo de red es
// molesto; mandar dos es lo que hace que se silencie la app.
//
// Seguridad: no lleva JWT de Supabase (está desplegada con verify_jwt en
// false) sino un secreto propio en la cabecera. Así el cron no necesita
// llevar encima la clave de servicio, que no debe salir del panel; la
// clave de servicio la lee esta función de su propio entorno y no viaja.
// ------------------------------------------------------------------

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { componerAviso, type Motivo } from './mensajes.ts'

// Franja en la que se avisa, en hora LOCAL DE LA FAMILIA (la vista ya la
// devuelve convertida). De 17 a 20: por la mañana nadie va a ponerse a
// hacer misiones camino del colegio, y más tarde de las nueve el aviso
// solo sirve para acostarse con una tarea pendiente en la cabeza.
const DESDE = 17
const HASTA = 20

const url = Deno.env.get('SUPABASE_URL')!
const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const secreto = Deno.env.get('GREMIO_CRON_SECRET')!

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:nadie@example.com',
  Deno.env.get('VAPID_PUBLIC')!,
  Deno.env.get('VAPID_PRIVATE')!
)

interface Pendiente {
  profile_id: string
  family_id: string
  name: string
  role: string
  dia: string
  hora: number
  racha: number
  motivo: Motivo | null
  por_validar: number
}

async function repartir(forzar: boolean) {
  const db = createClient(url, servicio, { auth: { persistSession: false } })
  const resumen = { candidatos: 0, avisados: 0, enviados: 0, caducadas: 0, saltados: [] as string[] }

  const { data, error } = await db.from('push_pendientes').select('*').not('motivo', 'is', null)
  if (error) throw error

  const pendientes = (data || []) as Pendiente[]
  resumen.candidatos = pendientes.length

  for (const p of pendientes) {
    if (!forzar && (p.hora < DESDE || p.hora > HASTA)) {
      resumen.saltados.push(`${p.name}: fuera de horario (${p.hora}h)`)
      continue
    }

    const n = p.motivo === 'sin_validar' ? p.por_validar : p.racha
    const aviso = componerAviso(p.motivo!, {
      nombre: p.name,
      n,
      dia: p.dia,
      profileId: p.profile_id
    })

    // Apuntar ANTES de enviar. El índice único de `push_log` es el que
    // garantiza «una al día»: si ya hay fila, este insert falla y aquí se
    // acaba el trabajo para esta persona.
    const apunte = await db.from('push_log').insert({
      family_id: p.family_id,
      profile_id: p.profile_id,
      dia: p.dia,
      motivo: p.motivo,
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo
    })
    if (apunte.error) {
      resumen.saltados.push(`${p.name}: ya avisado hoy`)
      continue
    }
    resumen.avisados++

    const { data: subs } = await db
      .from('push_subs')
      .select('*')
      .eq('profile_id', p.profile_id)
      .eq('activa', true)

    let ok = 0
    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ titulo: aviso.titulo, cuerpo: aviso.cuerpo, motivo: p.motivo })
        )
        ok++
        await db.from('push_subs').update({ ultimo_ok: new Date().toISOString(), fallos: 0 }).eq('id', sub.id)
      } catch (err) {
        // 404 y 410 significan que ese aparato ya no existe: se desinstaló
        // la app o se limpió el sitio. No es un error que reintentar, es
        // una suscripción muerta, y dejarla viva hace que cada envío
        // arrastre para siempre destinatarios que no van a leer nada.
        const codigo = (err as { statusCode?: number }).statusCode
        if (codigo === 404 || codigo === 410) {
          await db.from('push_subs').update({ activa: false }).eq('id', sub.id)
          resumen.caducadas++
        } else {
          await db.from('push_subs').update({ fallos: (sub.fallos || 0) + 1 }).eq('id', sub.id)
        }
      }
    }

    resumen.enviados += ok
    await db.from('push_log').update({ enviados: ok }).eq('profile_id', p.profile_id).eq('dia', p.dia)
  }

  return resumen
}

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-gremio-secreto') !== secreto) {
    return new Response(JSON.stringify({ error: 'no autorizado' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    })
  }

  // `?forzar=1` salta la franja horaria para poder probar a cualquier
  // hora. No salta el tope de una al día: ese no se salta ni probando,
  // porque probar mandando tres avisos a la familia sería el peor ensayo
  // posible.
  const forzar = new URL(req.url).searchParams.get('forzar') === '1'

  try {
    const resumen = await repartir(forzar)
    return new Response(JSON.stringify(resumen), { headers: { 'content-type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
})
