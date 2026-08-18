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

// DOS franjas, las dos en hora LOCAL DE LA FAMILIA (la vista ya la
// convierte). Cada franja es un trabajo distinto, y por eso el tope pasó
// de «uno al día» a «uno por franja» (push_log, migración 026):
//
//   · TARDE (17-19): hacer las misiones de hoy. Por la mañana nadie se
//     pone camino del colegio; es el hueco de después de comer y deberes.
//   · NOCHE (20-22): el recordatorio para el adulto de registrar lo suyo
//     y dejar programado mañana. Más tarde ya no sirve: se acuesta con la
//     tarea en la cabeza en vez de hacerla.
//
// No se solapan: si lo hicieran, a las 20:00 llegarían las dos.
const TARDE_DESDE = 17
const TARDE_HASTA = 19
const NOCHE_DESDE = 20
const NOCHE_HASTA = 22

type Franja = 'tarde' | 'noche'

function franjaDe(hora: number): Franja | null {
  if (hora >= TARDE_DESDE && hora <= TARDE_HASTA) return 'tarde'
  if (hora >= NOCHE_DESDE && hora <= NOCHE_HASTA) return 'noche'
  return null
}

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
  sin_plan_manana: boolean
}

async function repartir(forzarFranja: Franja | null) {
  const db = createClient(url, servicio, { auth: { persistSession: false } })
  const resumen = { candidatos: 0, avisados: 0, enviados: 0, caducadas: 0, saltados: [] as string[] }

  // Sin filtro por motivo: un candidato de NOCHE (adulto sin plan de
  // mañana) puede tener el motivo de tarde en null y aun así necesitar
  // aviso. La franja y el motivo los decide el bucle, no el filtro.
  const { data, error } = await db.from('push_pendientes').select('*')
  if (error) throw error

  const pendientes = (data || []) as Pendiente[]
  resumen.candidatos = pendientes.length

  for (const p of pendientes) {
    // La franja: forzada para probar, o la que toca por la hora local.
    const franja = forzarFranja ?? franjaDe(p.hora)
    if (!franja) {
      resumen.saltados.push(`${p.name}: fuera de horario (${p.hora}h)`)
      continue
    }

    // Cada franja tiene su motivo. La noche es SOLO el recordatorio de
    // programar, y solo para el adulto que no ha dejado plan de mañana; la
    // tarde, lo de siempre (racha, validar, vuelve).
    const motivo: Motivo | null = franja === 'noche'
      ? (p.role === 'adulto' && p.sin_plan_manana ? 'sin_programar' : null)
      : p.motivo
    if (!motivo) {
      resumen.saltados.push(`${p.name}: nada que decir de ${franja}`)
      continue
    }

    const n = motivo === 'sin_validar' ? p.por_validar : p.racha
    const aviso = componerAviso(motivo, {
      nombre: p.name,
      n,
      dia: p.dia,
      profileId: p.profile_id
    })

    // Apuntar ANTES de enviar. El único de `push_log` (perfil, dia,
    // franja) es el tope: si ya hay fila de ESTA franja, el insert falla y
    // aquí se acaba el trabajo. La tarde y la noche no se pisan.
    const apunte = await db.from('push_log').insert({
      family_id: p.family_id,
      profile_id: p.profile_id,
      dia: p.dia,
      franja,
      motivo,
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo
    })
    if (apunte.error) {
      resumen.saltados.push(`${p.name}: ya avisado (${franja})`)
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
          JSON.stringify({ titulo: aviso.titulo, cuerpo: aviso.cuerpo, motivo })
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
    await db.from('push_log').update({ enviados: ok })
      .eq('profile_id', p.profile_id).eq('dia', p.dia).eq('franja', franja)
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

  // `?forzar=tarde|noche` fuerza una franja para poder probar a cualquier
  // hora; `?forzar=1` es la tarde (compatibilidad). No salta el tope por
  // franja: ese no se salta ni probando, porque probar mandando avisos de
  // más a la familia sería el peor ensayo posible.
  const q = new URL(req.url).searchParams.get('forzar')
  const forzarFranja: Franja | null = q === 'noche' ? 'noche' : (q === 'tarde' || q === '1') ? 'tarde' : null

  try {
    const resumen = await repartir(forzarFranja)
    return new Response(JSON.stringify(resumen), { headers: { 'content-type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
})
