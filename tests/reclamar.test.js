import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// Reclamar un perfil (migración 059 · Fase 7.1 · `F-11`).
//
// Tres cosas se pueden romper aquí, y cada una cuesta distinto:
//
//   1 · QUE NO OCUPE PLAZA. Sería la vía para eludir la progresión y el
//       coste de expansión enteros: en vez de forjar, te haces perfil
//       interno de cinco gremios y los reclamas. `R-86`, y por eso la
//       comprobación va DENTRO de la transacción que aprueba.
//
//   2 · QUE LO APRUEBE QUIEN RECLAMA. Sin la administración del gremio de
//       destino, cualquiera con el identificador de un perfil se lo queda —y
//       ese identificador viaja en cuanto alguien lo pega en un chat.
//
//   3 · QUE LA RESPUESTA DELATE. Si «no existe» y «no se puede» respondieran
//       distinto, la función sería un detector de perfiles.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m059 = leer('migracion-059-reclamar-un-perfil.sql')

const soloSql = (sql) =>
  sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')

function funcion(sql, nombre) {
  const i = sql.indexOf(`create or replace function public.${nombre}(`)
  if (i < 0) return ''
  const j = sql.indexOf('\nas $fn$', i)
  const m = /\n(?:end )?\$fn\$;/.exec(sql.slice(j))
  return sql.slice(i, j + m.index + m[0].length)
}

const FUNCIONES = [
  'solicitar_reclamacion', 'mis_reclamaciones', 'reclamaciones_del_gremio',
  'aprobar_reclamacion', 'rechazar_reclamacion'
]

const solicitar = soloSql(funcion(schema, 'solicitar_reclamacion'))
const aprobar = soloSql(funcion(schema, 'aprobar_reclamacion'))

describe('no cuesta llave, pero ocupa plaza', () => {
  it('no toca ninguna llave', () => {
    // `R-81`: el perfil y su historia existían antes de que esa persona
    // activara su identidad. Cobrarla sería cobrar por esa historia.
    for (const cuerpo of [solicitar, aprobar]) {
      expect(cuerpo).not.toContain('derechos_expansion')
      expect(cuerpo).not.toContain('consumir_llave')
    }
  })

  it('pero comprueba el límite global', () => {
    // `R-86`. Sin esto, hacerse perfil interno de cinco gremios y
    // reclamarlos sería la manera de saltarse la progresión entera.
    expect(aprobar).toContain('public.parametros_expansion()')
    expect(aprobar).toContain("if v_activas + 1 > v_limite then return 'en_el_limite'")
  })

  it('y lo comprueba al APROBAR, no al pedirlo', () => {
    // Entre pedirlo y aprobarlo pueden pasar días, y en ese rato la persona
    // puede haber entrado en dos gremios más.
    expect(solicitar).not.toContain('limite_global')
    const iLimite = aprobar.indexOf("return 'en_el_limite'")
    const iPertenencia = aprobar.indexOf('insert into public.pertenencias')
    expect(iLimite).toBeGreaterThan(-1)
    expect(iLimite).toBeLessThan(iPertenencia)
  })
})

describe('lo aprueba el gremio de destino', () => {
  it('con `CAP-10`, y no con una etiqueta', () => {
    expect(aprobar).toContain("public.puede(r.family_id, 'CAP-10', p_profile) = 'no'")
    expect(aprobar).not.toMatch(/rol\s*=\s*'(gestor|titular)'/)
  })

  it('y quien aprueba tiene que estar en ese gremio', () => {
    expect(aprobar).toContain('if not public.es_mi_gremio(r.family_id) then')
  })

  it('quien reclama puede retirar la suya, pero no aprobarla', () => {
    const rechazar = soloSql(funcion(schema, 'rechazar_reclamacion'))
    expect(rechazar).toContain('if r.persona is distinct from auth.uid() then')
    // Y el que aprueba no tiene esa puerta: no hay forma de aprobarse a una
    // misma sin `CAP-10` en el gremio de destino.
    expect(aprobar).not.toContain('r.persona is distinct from auth.uid()')
  })
})

describe('la respuesta no delata', () => {
  it('«no existe» y «no se puede» son el mismo código', () => {
    // `SEC-9`. Con códigos distintos se prueban identificadores hasta que
    // uno responde diferente, y eso dice quién está en qué gremio.
    expect(solicitar).toMatch(
      /if pr\.id is null or not pr\.active or pr\.persona is not null or pr\.role = 'mascota' then\s+return 'no_reclamable'/
    )
  })

  it('y «ya la ha pedido alguien» tampoco distingue de quién', () => {
    // El índice es por `profile_id` a secas, así que el choque salta igual
    // si la pendiente es mía o de otra persona, y el manejador devuelve un
    // solo código sin mirar de quién era. Decir «la ha pedido alguien»
    // también sería revelar.
    expect(solicitar).toContain("return 'ya_solicitada'")
    const manejador = solicitar.slice(solicitar.indexOf('exception when unique_violation'))
    expect(manejador).not.toContain('persona')
    expect(solicitar.match(/return 'ya_solicitada'/g)).toHaveLength(1)
  })

  it('la tabla no se lee por la API', () => {
    // Una política por `profile_id` sería el detector que la función evita.
    expect(m059).toContain('alter table public.reclamaciones enable row level security;')
    expect(m059).toContain('revoke all on table public.reclamaciones from authenticated;')
    expect(m059).not.toMatch(/create policy \w+ on public\.reclamaciones/)
  })
})

describe('dos reclamaciones a la vez', () => {
  it('el perfil se bloquea antes de mirarlo', () => {
    // `E-11.4`: la segunda aprobación espera, y cuando entra ve `persona`
    // puesta. Sin el `for update`, las dos leerían `persona is null` y las
    // dos escribirían.
    expect(aprobar).toContain('select * into pr from public.profiles where id = r.profile_id for update')
    expect(aprobar).toContain("if pr.persona is not null then return 'ya_reclamado'")
  })

  it('y solo puede haber una solicitud pendiente por perfil', () => {
    for (const sql of [schema, m059]) {
      expect(sql).toMatch(
        /create unique index if not exists idx_reclamacion_pendiente\s+on public\.reclamaciones \(profile_id\) where estado = 'pendiente'/
      )
    }
  })
})

describe('el progreso no se reinicia y el saldo se mueve una vez', () => {
  it('el personaje conserva lo suyo', () => {
    // Es justo lo que esta función viene a respetar: nivel, marca de agua,
    // insignias e historial. Solo se pone `persona` y se cierra el saldo.
    expect(aprobar).toMatch(/set persona = r\.persona,\s+coins = 0,\s+saldo_local_cerrado = true/)
    expect(aprobar).not.toMatch(/xp\s*=\s*0/)
    expect(aprobar).not.toMatch(/xp_maxima\s*=\s*0/)
  })

  it('y el saldo pasa por la única puerta que mueve carteras', () => {
    // Una transferencia entre monederos son DOS asientos, y eso ya costó un
    // descuadre una vez (051).
    expect(aprobar).toContain("public.motivo_coins('conversion', r.id, null)")
    expect(aprobar).toContain("public.mover_cartera(r.persona, pr.id, 'conversion', pr.coins, r.id, null)")
  })

  it('con su asiento de conversión, donde van todos', () => {
    // `R-52` lo pide con nombre: persona, personaje, gremio, saldo antes,
    // importe, saldo después, fecha y resultado.
    expect(aprobar).toContain('insert into public.conversiones')
    expect(aprobar).toContain("'completada'")
  })
})

describe('los juniors no se reclaman todavía', () => {
  it('se rechazan con su propio código', () => {
    // `R-81` exige autorización adulta concreta (`R-57`) para un junior, y
    // eso es la Fase 8a, bloqueada por su revisión jurídica. Un permiso que
    // no existe no se da por supuesto.
    expect(solicitar).toContain("if pr.role = 'junior' then return 'junior_bloqueado'")
  })

  it('y las mascotas tampoco, pero sin decirlo', () => {
    // Una mascota no es de nadie: no hay identidad que vincular. Cae en el
    // código genérico porque aquí sí hay algo que ocultar.
    expect(solicitar).toContain("pr.role = 'mascota'")
  })
})

describe('las dos copias del esquema', () => {
  it('los cuerpos son iguales hasta el último acento', () => {
    for (const n of FUNCIONES) {
      expect(funcion(schema, n), `${n} difiere entre schema.sql y la 059`)
        .toBe(funcion(m059, n))
    }
  })

  it('y los permisos', () => {
    for (const firma of [
      'public.solicitar_reclamacion(uuid)',
      'public.mis_reclamaciones()',
      'public.reclamaciones_del_gremio(uuid)',
      'public.aprobar_reclamacion(uuid, uuid)',
      'public.rechazar_reclamacion(uuid, uuid)'
    ]) {
      for (const sql of [schema, m059]) {
        expect(sql).toContain(`revoke all on function ${firma} from anon;`)
        expect(sql).toContain(`grant execute on function ${firma} to authenticated;`)
      }
    }
  })

  it('la migración termina pegando el barrido de la 021', () => {
    const cola = m059.slice(m059.lastIndexOf('do $$'))
    expect(cola).toContain('revoke all on function %s from public')
    expect(cola).toContain('revoke all on function %s from anon')
  })
})
