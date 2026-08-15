#!/usr/bin/env node
// ------------------------------------------------------------------
// Prueba de concurrencia contra la base real.
//
//   GREMIO_EMAIL=... GREMIO_PASSWORD=... npm run prueba:concurrencia
//
// Por qué esta y no una prueba de carga al uso: simular 100 usuarios en
// una app que usan cuatro personas no dice nada. El riesgo real aquí no
// es el volumen, es la CARRERA: dos dedos tocando el mismo botón a la
// vez, o dos adultos validando la misma misión desde dos móviles. La
// documentación afirma que `resolve_completion`, `redeem_reward` y
// `undo_completion` son atómicas. Esto lo comprueba en vez de creerlo.
//
// Qué hace, en la familia de la cuenta que se le pase:
//   1. crea una misión temporal llamada PRUEBA-CONCURRENCIA;
//   2. lanza N validaciones simultáneas de la misma petición;
//   3. comprueba que la XP se abonó UNA sola vez;
//   4. repite con canjes y con deshacer;
//   5. borra todo lo que creó y deja el saldo como estaba.
//
// Si algo falla a mitad, imprime qué quedó sin limpiar para poder
// borrarlo a mano. No toca ninguna misión ni ningún premio existente.
// ------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const CONCURRENCIA = Number(process.env.CONCURRENCIA || 8)
const MARCA = 'PRUEBA-CONCURRENCIA'

function leerEnv() {
  if (!existsSync('.env')) return {}
  return readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .reduce((acc, linea) => {
      const i = linea.indexOf('=')
      return i === -1 ? acc : { ...acc, [linea.slice(0, i).trim()]: linea.slice(i + 1).trim() }
    }, {})
}

const env = { ...leerEnv(), ...process.env }
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
const email = env.GREMIO_EMAIL
const password = env.GREMIO_PASSWORD

if (!url || !key) {
  console.error('✖ Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env')
  process.exit(1)
}
if (!email || !password) {
  console.error('✖ Hace falta la cuenta familiar para poder escribir (RLS):')
  console.error('  GREMIO_EMAIL=... GREMIO_PASSWORD=... npm run prueba:concurrencia')
  console.error('  No se guardan en ningún sitio; solo viven en esta ejecución.')
  process.exit(1)
}

const supabase = createClient(url, key)

let salida = 0
const linea = (ok, texto) => {
  console.log(`${ok ? '🟢' : '🔴'} ${texto}`)
  if (!ok) salida = 1
}

const { data: sesion, error: errorLogin } = await supabase.auth.signInWithPassword({ email, password })
if (errorLogin) {
  console.error('✖ No se pudo entrar:', errorLogin.message)
  process.exit(1)
}
console.log(`\nEl Gremio · concurrencia · ${CONCURRENCIA} llamadas simultáneas\n`)

const { data: familias } = await supabase.from('families').select('*').limit(1)
const family = familias?.[0]
if (!family) {
  console.error('✖ Esa cuenta no tiene ningún gremio creado.')
  process.exit(1)
}

const { data: perfiles } = await supabase.from('profiles').select('*').eq('family_id', family.id).limit(1)
const perfil = perfiles?.[0]
if (!perfil) {
  console.error('✖ El gremio no tiene perfiles.')
  process.exit(1)
}

const creado = { challenge: null, reward: null }

async function limpiar() {
  if (creado.challenge) await supabase.from('challenges').delete().eq('id', creado.challenge)
  if (creado.reward) await supabase.from('rewards').delete().eq('id', creado.reward)
}

try {
  // ----------------------------------------------------------------
  // 1. Validar la misma misión N veces a la vez
  // ----------------------------------------------------------------
  const { data: reto, error: e1 } = await supabase
    .from('challenges')
    .insert({
      family_id: family.id,
      profile_id: perfil.id,
      title: MARCA,
      emoji: '🧪',
      xp: 10,
      coins: 5,
      frequency: 'unico',
      active: false
    })
    .select()
    .single()
  if (e1) throw e1
  creado.challenge = reto.id

  const { data: antes } = await supabase.from('profiles').select('xp, coins').eq('id', perfil.id).single()

  const { data: peticion, error: e2 } = await supabase
    .from('completions')
    .insert({ family_id: family.id, challenge_id: reto.id, profile_id: perfil.id, xp: 10, coins: 5 })
    .select()
    .single()
  if (e2) throw e2

  await Promise.all(
    Array.from({ length: CONCURRENCIA }, () =>
      supabase.rpc('resolve_completion', { c_id: peticion.id, new_status: 'aprobado', praise_text: null })
    )
  )

  const { data: despues } = await supabase.from('profiles').select('xp, coins').eq('id', perfil.id).single()
  const ganado = despues.xp - antes.xp

  linea(ganado === 10, `validación simultánea: +${ganado} XP (debe ser +10, no +${10 * CONCURRENCIA})`)

  // ----------------------------------------------------------------
  // 2. Deshacer la misma misión N veces a la vez
  // ----------------------------------------------------------------
  await Promise.all(
    Array.from({ length: CONCURRENCIA }, () => supabase.rpc('undo_completion', { c_id: peticion.id }))
  )

  const { data: trasDeshacer } = await supabase.from('profiles').select('xp, coins').eq('id', perfil.id).single()
  linea(
    trasDeshacer.xp === antes.xp && trasDeshacer.coins === antes.coins,
    `deshacer simultáneo: el saldo vuelve a ${antes.xp} XP / ${antes.coins} 🪙 (quedó en ${trasDeshacer.xp} / ${trasDeshacer.coins})`
  )

  // ----------------------------------------------------------------
  // 3. Canjear N veces a la vez con monedas para uno solo
  // ----------------------------------------------------------------
  const saldo = trasDeshacer.coins
  const coste = Math.max(1, saldo)

  if (saldo < 1) {
    console.log('🟡 canje simultáneo: omitido, el perfil no tiene monedas')
  } else {
    const { data: premio, error: e3 } = await supabase
      .from('rewards')
      .insert({ family_id: family.id, title: MARCA, emoji: '🧪', cost: coste, active: true })
      .select()
      .single()
    if (e3) throw e3
    creado.reward = premio.id

    const respuestas = await Promise.all(
      Array.from({ length: CONCURRENCIA }, () =>
        supabase.rpc('redeem_reward', { rw_id: premio.id, p_id: perfil.id })
      )
    )
    const oks = respuestas.filter((r) => r.data === 'ok').length

    const { data: trasCanje } = await supabase.from('profiles').select('coins').eq('id', perfil.id).single()
    linea(oks === 1, `canje simultáneo: ${oks} canje(s) aceptado(s) de ${CONCURRENCIA} (debe ser 1)`)
    linea(trasCanje.coins >= 0, `saldo nunca negativo: ${trasCanje.coins} 🪙`)

    // Devolver las monedas cancelando los canjes de la prueba
    const { data: canjes } = await supabase.from('redemptions').select('id').eq('reward_id', premio.id)
    for (const c of canjes || []) {
      await supabase.rpc('resolve_redemption', { r_id: c.id, new_status: 'cancelado' })
    }
    const { data: final } = await supabase.from('profiles').select('coins').eq('id', perfil.id).single()
    linea(final.coins === saldo, `monedas devueltas: ${final.coins} 🪙 (eran ${saldo})`)
  }
} catch (err) {
  console.error('\n✖ La prueba falló a mitad:', err.message)
  console.error('  Revisa si quedó algo llamado', MARCA, 'en misiones o premios.')
  salida = 1
} finally {
  await limpiar()
  await supabase.auth.signOut()
}

console.log('')
process.exit(salida)
