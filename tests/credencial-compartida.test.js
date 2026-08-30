import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// Quitar la llave de debajo del felpudo (migración 060 · Fase 7.2 · `F-12`).
//
// LO QUE SE PUEDE ROMPER AQUÍ, Y ES CARO: que desactivar sea una casilla.
//
// La credencial compartida entra en el gremio por DOS sitios, los dos en
// `mis_gremios()`: por `families.owner = auth.uid()` y por su fila de
// `credenciales`. Poner `activa = false` cierra el segundo y deja el primero
// abierto de par en par. Una desactivación que no corta el acceso no es una
// desactivación: es una promesa incumplida escrita en la interfaz.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m060 = leer('migracion-060-quitar-la-llave-del-felpudo.sql')

const soloSql = (sql) =>
  sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')

/** La ÚLTIMA definición: la que queda viva al aplicar `schema.sql` entero. */
function ultimaFuncion(sql, nombre) {
  const i = sql.lastIndexOf(`create or replace function public.${nombre}(`)
  if (i < 0) return ''
  const j = sql.indexOf('\nas $fn$', i)
  const m = /\n(?:end )?\$fn\$;/.exec(sql.slice(j))
  return sql.slice(i, j + m.index + m[0].length)
}

const desactivar = soloSql(ultimaFuncion(schema, 'desactivar_credencial_compartida'))
const inventario = soloSql(ultimaFuncion(schema, 'inventario_credencial'))
const crear = soloSql(ultimaFuncion(schema, 'crear_credencial_compartida'))

describe('desactivar corta los DOS caminos', () => {
  it('el de la fila: `mis_gremios` exige que siga activa', () => {
    const fn = soloSql(ultimaFuncion(schema, 'mis_gremios'))
    expect(fn).toContain("c.clase = 'compartida' and c.family_id is not null")
    expect(fn).toContain('and c.activa')
  })

  it('y el de la titularidad: el gremio pasa a la persona', () => {
    // Sin esto la bandera no sirve de nada: `families.owner = auth.uid()` es
    // la PRIMERA rama de `mis_gremios()`, y la credencial retirada seguiría
    // entrando por ahí.
    expect(desactivar).toContain('update public.families set owner = v_uid where id = p_family')
  })

  it('`puede()` también deja de autorizarla', () => {
    // Es la otra función que pregunta «quién es esta sesión». Sin esto, una
    // credencial retirada seguiría teniendo permisos de adulto con el PIN.
    const fn = soloSql(ultimaFuncion(schema, 'puede'))
    expect(fn).toMatch(/c\.clase = 'compartida' and c\.family_id = p_family\s+and c\.activa/)
  })

  it('y se le caen las sesiones abiertas', () => {
    // Si no, el móvil que estaba dentro sigue dentro hasta que caduque el
    // testigo, y eso es justo lo que se estaba retirando.
    expect(desactivar).toContain('delete from auth.sessions where user_id = v_compartida')
    expect(desactivar).toContain('delete from auth.refresh_tokens')
  })
})

describe('la cuenta no se borra y la contraseña no se revela', () => {
  it('la fila se marca, no se borra', () => {
    // `R-82`: lo que se retira es el acceso, no el rastro.
    expect(desactivar).toContain('update public.credenciales set activa = false')
    expect(desactivar).not.toMatch(/delete from public\.credenciales/)
  })

  it('ni se toca `auth.users`', () => {
    expect(desactivar).not.toMatch(/delete from auth\.users/)
    expect(desactivar).not.toMatch(/encrypted_password/)
  })

  it('y la anterior nunca vuelve: crear es crear otra', () => {
    // Volver a encender la vieja sería resucitar una clave que alguien pudo
    // haber compartido, que es de lo que se estaba huyendo.
    expect(crear).toContain('if exists (select 1 from public.credenciales where user_id = v_nueva)')
    expect(crear).toContain("return 'cuenta_ya_clasificada'")
    expect(crear).not.toMatch(/set activa = true/)
  })
})

describe('las cinco comprobaciones', () => {
  it('no la puede pedir la propia clave', () => {
    // `E-11.9`: sería una credencial decidiendo dejar de existir, sin nadie
    // detrás que responda por ello.
    expect(desactivar).toContain("if public.clase_credencial() <> 'personal' then return 'exige_identidad_personal'")
  })

  it('quien la pide tiene la capacidad, y con el PIN', () => {
    expect(desactivar).toContain("public.puede(p_family, 'CAP-04', p_profile) = 'no'")
  })

  it('un perfil adulto activo sin identidad la bloquea', () => {
    // Esa persona se quedaría fuera del gremio.
    expect(inventario).toContain("pr.role = 'adulto' and pr.persona is null")
    expect(inventario).toContain('adultos_sin_identidad')
  })

  it('pero una peque NO bloquea por sí sola, si queda quien la opere', () => {
    // `D-29`. La versión anterior exigía que no quedara ningún perfil sin
    // identidad, y en un hogar con una peque de tres años eso no pasa nunca:
    // la función era letra muerta justo donde más se usa.
    expect(inventario).toContain("pr.role in ('junior','peque','mascota')")
    expect(inventario).toContain('if jsonb_array_length(v_no_convertidos) > 0 and not v_hay_admin then')
    expect(inventario).toContain('nadie_para_operarlos')
  })

  it('y hace falta alguien con identidad y administración', () => {
    expect(inventario).toContain("pe.rol in ('titular','gestor')")
    expect(inventario).toContain('sin_persona_con_administracion')
  })
})

describe('el inventario y la comprobación son la misma cuenta', () => {
  it('desactivar vuelve a calcularlo, no se fía de la pantalla', () => {
    // Mismo criterio que `borrar_mi_identidad` en la 049: entre pintar y
    // confirmar ha podido cambiar cualquier cosa.
    expect(desactivar).toContain('v_inv := public.inventario_credencial(p_family)')
    expect(desactivar).toContain("if not (v_inv->>'puede')::boolean then")
  })

  it('y devuelve QUÉ lo impide, no un «no» a secas', () => {
    // `E-11.6` pide que se indique qué perfiles lo impiden.
    expect(desactivar).toContain("return 'bloqueada:' || (v_inv->'motivos'->>0)")
  })
})

describe('las dos copias del esquema', () => {
  it('los cuerpos son iguales hasta el último acento', () => {
    for (const n of [
      'inventario_credencial', 'desactivar_credencial_compartida',
      'crear_credencial_compartida', 'mis_gremios', 'puede'
    ]) {
      expect(ultimaFuncion(schema, n), `${n} difiere entre schema.sql y la 060`)
        .toBe(ultimaFuncion(m060, n))
    }
  })

  it('y la columna nace activa, para no retirarle el acceso a nadie', () => {
    for (const sql of [schema, m060]) {
      expect(sql).toContain('add column if not exists activa boolean not null default true')
    }
  })
})
