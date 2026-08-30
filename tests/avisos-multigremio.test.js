import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// Los avisos con varios gremios (migración 058).
//
// LA PREGUNTA QUE PARECÍA SER Y LA QUE ERA. Esto se apuntó tres veces como
// «decidir si los avisos son del gremio o de la persona». Mirando cómo
// funciona el envío, esa pregunta no tenía sentido:
//
//   · `notificar` ya elegía a quién avisar por `profile_id`. Los avisos son
//     de un PERSONAJE desde siempre.
//   · y no pueden ser «de la persona»: dicen «hoy te falta una misión» o
//     «tu racha», calculado en el día de ESE gremio, con SU zona horaria.
//     Una persona en tres gremios tiene tres días y tres rachas distintas.
//
// Lo único que estorbaba era que `push_subs.endpoint` fuese único: una fila
// por aparato, así que un móvil solo podía estar suscrito a un personaje.
//
// Lo que este fichero defiende es que eso siga siendo así de simple: que la
// Edge Function no haya tenido que cambiar, y que el cliente distinga los
// dos casos que se parecen y no son el mismo.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m058 = leer('migracion-058-un-aparato-varios-personajes.sql')
const push = leer('src/lib/push.js')
const notificar = leer('supabase/functions/notificar/index.ts')

describe('un aparato puede estar suscrito a varios personajes', () => {
  it('la clave es (aparato, personaje), no el aparato', () => {
    for (const sql of [schema, m058]) {
      expect(sql).toMatch(
        /create unique index if not exists idx_push_subs_aparato_personaje\s+on public\.push_subs \(endpoint, profile_id\)/
      )
    }
  })

  it('y `endpoint` deja de ser único', () => {
    // Era `endpoint text not null unique`. Si vuelve, un móvil vuelve a
    // poder estar en un solo gremio.
    expect(schema).not.toMatch(/endpoint text not null unique/)
    expect(m058).toContain('drop constraint if exists push_subs_endpoint_key')
  })

  it('pero conserva índice, porque apagar borra por aparato', () => {
    // `apagarAvisos` borra TODAS las filas de este aparato de golpe, y esa
    // consulta filtra solo por endpoint.
    expect(schema).toContain('create index if not exists idx_push_subs_endpoint')
    expect(push).toMatch(/delete\(\)\s*\.eq\('endpoint', endpoint\)/)
  })
})

describe('la Edge Function no ha tenido que cambiar', () => {
  it('porque ya elegía por personaje y no por gremio', () => {
    // Es lo que hace que todo esto sea un índice y no un rediseño. Si
    // alguien la cambiara a `family_id`, un aparato recibiría los avisos de
    // todos los personajes de un gremio en vez de los suyos.
    expect(notificar).toContain(".eq('profile_id', p.profile_id)")
    expect(notificar).not.toMatch(/from\('push_subs'\)[\s\S]{0,120}\.eq\('family_id'/)
  })

  it('y el ruido ya lo acota `push_log`, por personaje y franja', () => {
    // Un aparato con tres personajes recibe como mucho un aviso de cada uno
    // por franja, no tres del mismo.
    expect(notificar).toMatch(/\.eq\('profile_id', p\.profile_id\)\.eq\('dia', p\.dia\)\.eq\('franja', franja\)/)
  })
})

describe('los dos casos que se parecen y no son el mismo', () => {
  const fn = push.slice(push.indexOf('export async function apuntarPerfil'))

  it('la misma persona en otro gremio: se SUMA', () => {
    // Quitarle los avisos de un gremio por haber abierto el otro es perder
    // cosas sin avisar, que es el fallo que la 058 viene a corregir.
    expect(fn).toContain('const esMio = Boolean(persona) && profile.persona === persona')
    expect(fn).toContain('if (esMio) {')
    expect(fn).toMatch(/upsert\([\s\S]{0,200}onConflict: 'endpoint,profile_id'/)
  })

  it('otra persona coge el aparato: se SUSTITUYE', () => {
    // Es la tablet de la casa pasando de mano en mano, que es justo para lo
    // que se escribió esta función.
    const sustituye = fn.slice(fn.indexOf('Cambió de manos'))
    expect(sustituye).toContain(".delete().eq('endpoint', endpoint)")
    expect(sustituye).toContain('.insert(')
  })

  it('sin identidad detrás, siempre se sustituye', () => {
    // Los personajes de una casa con clave compartida no tienen `persona`,
    // así que `esMio` es falso y el aparato cambia de manos. Es el
    // comportamiento de siempre, que es lo que hoy tiene la familia.
    expect(fn).toContain('Boolean(persona)')
  })

  it('y quien llama le dice quién es', () => {
    // Sin esto `persona` sería siempre null y nunca se sumaría nada.
    const app = leer('src/App.jsx')
    expect(app).toContain('apuntarPerfil({ family, profile, persona:')
  })
})

describe('activar los avisos', () => {
  it('escribe una fila por personaje, no una por aparato', () => {
    const activar = push.slice(0, push.indexOf('export async function apagarAvisos'))
    expect(activar).toContain("onConflict: 'endpoint,profile_id'")
    expect(activar).not.toContain("onConflict: 'endpoint' }")
  })
})
