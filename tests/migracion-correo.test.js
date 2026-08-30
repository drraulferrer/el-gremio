import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// El correo de la casa se hace tuyo (migración 048, flujo F-13).
//
// Lo que hay que proteger aquí es una sola cosa, y no es abstracta: **que la
// casa no se quede sin llave**. Ese correo lo tienen abierto el móvil de quien
// fundó el gremio y las tabletas de las peques. Si se reclasifica como
// identidad personal antes de que exista otra llave que funcione, la familia
// entera se queda fuera y no hay vuelta atrás amable.
//
// Casi todo lo que defiende este fichero es, otra vez, ORDEN: qué se comprueba
// antes de tocar la llave, y qué ocurre dentro de la misma transacción.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m048 = leer('migracion-048-el-correo-de-la-casa-se-hace-tuyo.sql')

const soloSql = (sql) =>
  sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')

function funcion(sql, nombre) {
  const i = sql.indexOf(`create or replace function public.${nombre}(`)
  if (i < 0) return ''
  const j = sql.indexOf('\nas $fn$', i)
  const k = sql.indexOf('\nend $fn$;', j)
  return sql.slice(i, k + '\nend $fn$;'.length)
}

const solicitar = soloSql(funcion(schema, 'solicitar_migracion_correo'))
const probar = soloSql(funcion(schema, 'probar_credencial_nueva'))
const completar = soloSql(funcion(schema, 'completar_migracion_correo'))

describe('la del medio no escribe nada, y en eso consiste todo', () => {
  it('las tres llamadas existen', () => {
    expect(solicitar).not.toBe('')
    expect(probar).not.toBe('')
    expect(completar).not.toBe('')
  })

  it('probar la llave nueva no toca el gremio', () => {
    // Que esta llamada llegue ya demuestra lo que hay que demostrar: hay
    // cuenta, el correo está confirmado y se ha podido entrar. Si además
    // enganchara la credencial al gremio, existiría el estado de DOS llaves
    // válidas que la especificación daba por inevitable.
    expect(probar).not.toContain('public.families')
    expect(probar).not.toContain('public.credenciales (')
    expect(probar).not.toContain('public.pertenencias')
    expect(probar).not.toContain('public.carteras')
    // Lo único que escribe es el estado de su propia fila.
    expect(probar).toContain('update public.migraciones_correo')
  })

  it('y pedirlo tampoco', () => {
    expect(solicitar).not.toContain('update public.families')
    expect(solicitar).not.toContain('public.pertenencias')
    expect(solicitar).not.toContain('public.carteras')
  })

  it('no se completa sin haber probado la llave', () => {
    expect(completar).toContain("m.estado <> 'credencial_probada'")
    expect(completar).toContain("return 'aun_sin_probar'")
  })

  it('y se vuelve a comprobar la llave nueva ENTERA antes del cambio', () => {
    // Entre probarla y completar pueden pasar tres días. Si en ese rato la
    // cuenta se clasificó como otra cosa o dejó de estar confirmada, seguir
    // adelante dejaría a la casa sin llave.
    expect(completar).toContain('email_confirmed_at')
    expect(completar).toContain('public.credenciales where user_id = m.nueva')
    expect(completar).toContain("return 'credencial_nueva_no_vale'")

    const iComprueba = completar.indexOf("return 'credencial_nueva_no_vale'")
    const iTocaLlave = completar.indexOf('update public.credenciales')
    expect(iTocaLlave).toBeGreaterThan(iComprueba)
  })
})

describe('el cambio de llave, en una sola transacción', () => {
  it('la antigua deja de serlo antes de que entre la nueva', () => {
    // El CHECK de `credenciales` exige que una personal no lleve gremio, así
    // que el orden no es estético: al revés no pasa.
    const iSuelta = completar.indexOf("set clase = 'personal', family_id = null")
    const iEntra = completar.indexOf('insert into public.credenciales')
    const iOwner = completar.indexOf('update public.families set owner')
    expect(iSuelta).toBeGreaterThan(-1)
    expect(iEntra).toBeGreaterThan(iSuelta)
    expect(iOwner).toBeGreaterThan(iEntra)
  })

  it('quien era la llave entra por pertenencia, como cualquier otra conversión', () => {
    expect(completar).toContain("'gestor', 'activa', 'reclamacion'")
  })

  it('y el asiento va donde van todos los de conversión', () => {
    // Dos tablas, dos hechos: `migraciones_correo` cuenta cómo cambió de manos
    // la llave; `conversiones` cuenta quién se convirtió y cuánto se movió. Los
    // importes no se escriben dos veces.
    expect(completar).toContain('insert into public.conversiones')
    expect(schema).not.toMatch(/migraciones_correo[\s\S]{0,1200}?saldo_local_antes/)
  })

  it('el saldo se transfiere y el local queda cerrado', () => {
    expect(completar).toContain("public.motivo_coins('conversion'")
    expect(completar).toContain('saldo_local_cerrado = true')
    expect(completar).toContain('update public.carteras set saldo = saldo +')
  })

  it('misma clave, misma respuesta', () => {
    expect(completar).toMatch(/clave = p_clave and estado = 'completada'/)
  })
})

describe('las sesiones antiguas se caen', () => {
  it('se retiran en el servidor, no fiándolo al cliente', () => {
    // Es el paso 7 de F-13 y no es limpieza. Si la sesión de la tableta de una
    // peque sobrevive al cambio, esa tableta pasa a ser una sesión PERSONAL de
    // otra persona: mismo `auth.uid()`, clase nueva.
    expect(completar).toContain('delete from auth.sessions where user_id = v_uid')
    expect(completar).toContain('delete from auth.refresh_tokens')
  })

  it('y si esas tablas no existen, no revienta', () => {
    // Son internas de Supabase: pueden cambiar de sitio en una actualización, y
    // el cambio de llave no puede depender de eso.
    expect((completar.match(/to_regclass\('auth\./g) || []).length).toBe(2)
  })
})

describe('quién puede pedirlo', () => {
  it('solo la llave de la casa: una identidad personal no tiene nada que migrar', () => {
    expect(solicitar).toContain("c.clase = 'compartida'")
    expect(solicitar).toContain("return 'no_es_compartida'")
  })

  it('con el PIN, y sobre un personaje adulto del propio gremio', () => {
    expect(solicitar).toContain('parent_pin_hash')
    expect(solicitar).toContain("return 'pin_incorrecto'")
    expect(solicitar).toContain("return 'no_es_tuyo'")
    expect(solicitar).toContain("return 'junior_bloqueado'")
    expect(solicitar).toContain("return 'solo_adulto'")
  })

  it('el correo nuevo tiene que estar libre y ser otro', () => {
    expect(solicitar).toContain("return 'correo_es_el_de_ahora'")
    expect(solicitar).toContain("return 'correo_no_disponible'")
  })

  it('una viva por gremio, y se puede retirar', () => {
    expect(schema).toMatch(
      /create unique index if not exists idx_migracion_correo_viva_gremio\s+on public\.migraciones_correo \(family_id\) where estado in \('pendiente','credencial_probada'\)/
    )
    expect(schema).toContain('create or replace function public.cancelar_migracion_correo(')
  })
})

describe('las dos copias del esquema', () => {
  it('las cuatro funciones son idénticas en la migración y en el esquema', () => {
    for (const n of [
      'solicitar_migracion_correo',
      'probar_credencial_nueva',
      'completar_migracion_correo',
      'cancelar_migracion_correo'
    ]) {
      expect(funcion(m048, n), `${n} difiere entre la 048 y schema.sql`)
        .toBe(funcion(schema, n))
    }
  })

  it('la tabla está en los dos ficheros', () => {
    for (const f of [m048, schema]) {
      expect(f).toContain('create table if not exists public.migraciones_correo (')
    }
  })
})
