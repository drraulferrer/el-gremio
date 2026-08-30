import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// Una persona, varios gremios (migración 057 · Fase 6.1).
//
// Lo que este fichero defiende, en orden de lo que costaría más caro:
//
//   1 · QUE LA LLAVE NO SE CONSUMA SI LA ENTRADA FALLA. `R-20` y `R-21`. No es
//       una comprobación: es que las dos escrituras viven en la misma
//       transacción. Partirlas en dos llamadas sería el fallo caro de la fase,
//       porque deja a alguien pagando por una puerta que no se abrió.
//
//   2 · QUE VOLVER NO CUESTE EL HISTORIAL. `R-63`. Al reingresar se reactiva el
//       personaje anterior; crear uno nuevo sería castigar por haberse ido.
//
//   3 · QUE NADIE SE QUEDE SIN ADMINISTRACIÓN. `I-12`. Ni saliendo ni echando.
//
//   4 · QUE UNA INVITACIÓN NO TOQUE NUNCA UNA LLAVE. `T-2`. Rechazar, revocar
//       y caducar cambian el estado de la invitación y nada más.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m057 = leer('migracion-057-una-persona-varios-gremios.sql')

const soloSql = (sql) =>
  sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')

function funcion(sql, nombre, delim = '$fn$') {
  const i = sql.indexOf(`create or replace function public.${nombre}(`)
  if (i < 0) return ''
  const j = sql.indexOf(`\nas ${delim}`, i)
  const re = new RegExp(`\\n(?:end )?\\${delim[0]}${delim.slice(1).replace(/\$/g, '\\$')};`)
  const m = re.exec(sql.slice(j))
  return sql.slice(i, j + m.index + m[0].length)
}

const FUNCIONES = [
  'entrar_en_gremio', 'invitar', 'mis_invitaciones', 'invitaciones_del_gremio',
  'rechazar_invitacion', 'revocar_invitacion', 'aceptar_invitacion',
  'crear_gremio_con_llave', 'abandonar_gremio', 'expulsar_de_gremio',
  'mis_pertenencias'
]

const entrar = soloSql(funcion(schema, 'entrar_en_gremio'))
const aceptar = soloSql(funcion(schema, 'aceptar_invitacion'))
const crear = soloSql(funcion(schema, 'crear_gremio_con_llave'))
const abandonar = soloSql(funcion(schema, 'abandonar_gremio'))
const expulsar = soloSql(funcion(schema, 'expulsar_de_gremio'))
const invitar = soloSql(funcion(schema, 'invitar'))

describe('una cuenta puede tener varios gremios', () => {
  it('el índice de `owner` deja de ser único y NO desaparece', () => {
    // Sin él, `mis_gremios()` —que empieza por `families.owner = auth.uid()`—
    // recorrería la tabla de familias entera en cada petición de cada casa.
    expect(schema).toContain('create index if not exists idx_families_owner on public.families (owner);')
    expect(schema).not.toContain('create unique index if not exists idx_families_owner')
    expect(m057).toContain('drop index if exists public.idx_families_owner;')
  })

  it('y `delete_my_account` sigue sin poder borrar los gremios de una persona', () => {
    // Con `owner` siendo una persona que puede tener tres gremios, esta función
    // habría sido un desastre. La 049 ya le puso la puerta; aquí se vigila que
    // siga puesta.
    expect(soloSql(funcion(schema, 'delete_my_account')))
      .toContain("if public.clase_credencial() = 'personal' then")
  })
})

describe('la llave y la puerta se deshacen juntas', () => {
  it('al aceptar, la llave se consume DESPUÉS de entrar y en la misma función', () => {
    // `R-20`: el derecho no se consume hasta que la aceptación termina bien.
    // Si `consumir_llave` lanza —una carrera con otra petición usando la misma
    // llave—, se deshace todo: pertenencia, invitación y consumo (`R-21`).
    const iEntrar = aceptar.indexOf('public.entrar_en_gremio(')
    const iConsumir = aceptar.indexOf('public.consumir_llave(')
    expect(iEntrar).toBeGreaterThan(-1)
    expect(iConsumir).toBeGreaterThan(iEntrar)
  })

  it('y al crear, igual', () => {
    const iEntrar = crear.indexOf('public.entrar_en_gremio(')
    const iConsumir = crear.indexOf('public.consumir_llave(')
    expect(iEntrar).toBeGreaterThan(-1)
    expect(iConsumir).toBeGreaterThan(iEntrar)
  })

  it('ninguna de las dos captura la excepción de `consumir_llave`', () => {
    // Capturarla sería quedarse con la puerta abierta y la llave sin gastar.
    for (const [n, cuerpo] of [['aceptar_invitacion', aceptar], ['crear_gremio_con_llave', crear]]) {
      const desde = cuerpo.indexOf('public.consumir_llave(')
      expect(cuerpo.slice(desde), `${n} captura la excepción del consumo`).not.toContain('exception')
    }
  })

  it('la primera pertenencia no cuesta llave, y las demás sí', () => {
    // `S-10`: entrar en tu primer gremio no es expandirse.
    expect(aceptar).toContain('if v_activas > 0 then')
    expect(aceptar).toContain("resultado := 'hace_falta_llave'")
  })

  it('crear un gremio no cobra: el pago fue al forjar', () => {
    // Cobrar aquí sería cobrar dos veces.
    expect(crear).not.toContain('mover_cartera')
    expect(crear).not.toContain('anota_coins')
  })
})

describe('volver no cuesta el historial', () => {
  it('el reingreso reactiva el personaje anterior', () => {
    // `R-63`, `R-64`, `D-08`. «Empezar desde cero en cada gremio» es la primera
    // vez que entras, no cada vez.
    expect(entrar).toContain('select p.id into v_profile')
    expect(entrar).toContain('where p.family_id = p_family and p.persona = v_uid')
    expect(entrar).toContain('update public.profiles set active = true where id = v_profile')
  })

  it('y nunca crea un segundo personaje de la misma persona en el mismo gremio', () => {
    expect(entrar).toContain('if v_profile is not null then')
    expect(entrar).toContain('else')
  })

  it('el personaje nuevo nace a cero y no copia nada del origen', () => {
    // `R-03`, `I-11`: ni nivel, ni misiones, ni premios, ni insignias, ni saldo.
    expect(entrar).toContain('0, 0, 0, v_uid, true, true)')
  })

  it('y su rol lo declara la plantilla, no una cadena escrita aquí', () => {
    expect(entrar).toContain("t.roles->>'al_fundar'")
  })

  it('salir retira el personaje, no lo borra', () => {
    // `H-14`, `T-9`: conserva historial y la XP que aportó a metas cerradas, y
    // es lo que permite que el reingreso devuelva el progreso.
    for (const cuerpo of [abandonar, expulsar]) {
      expect(cuerpo).toContain('update public.profiles set active = false')
      expect(cuerpo).not.toMatch(/delete from public\.profiles/)
    }
  })

  it('y no toca la cartera: es de la persona, no del gremio', () => {
    // `R-06`.
    for (const cuerpo of [abandonar, expulsar]) {
      expect(cuerpo).not.toContain('carteras')
      expect(cuerpo).not.toContain('mover_cartera')
    }
  })
})

describe('nadie se queda sin administración', () => {
  it('quien titula no puede limitarse a salir', () => {
    // `I-12`: o traspasa, o cierra. Salir sin más dejaría el gremio huérfano.
    expect(abandonar).toContain("if v_rol = 'titular' and v_otros = 0 then")
    expect(abandonar).toContain("return 'eres_quien_titula'")
  })

  it('y expulsar no puede dejar el gremio sin quien lo administre', () => {
    expect(expulsar).toContain("if v_rol in ('titular','gestor') and v_otros = 0 then")
    expect(expulsar).toContain("return 'dejaria_sin_administracion'")
  })

  it('expulsarse a uno mismo no es expulsar', () => {
    expect(expulsar).toContain("if p_persona = v_uid then return 'usa_abandonar'")
  })

  it('y expulsar pide capacidad, no etiqueta', () => {
    expect(expulsar).toContain("public.puede(p_family, 'CAP-03', p_profile) = 'no'")
    expect(expulsar).not.toMatch(/rol\s*=\s*'gestor'/)
  })
})

describe('la invitación', () => {
  it('caduca a los días que diga la configuración, no a un 14 escrito aquí', () => {
    expect(invitar).toContain('select pa.invitacion_dias into v_dias from public.parametros_expansion() pa')
    expect(invitar).not.toMatch(/interval '14 days'/)
  })

  it('la caducidad se evalúa al usarla, y ese intento es el que la cierra', () => {
    // `T-3`: no hay reloj que la mueva sola. Un proceso que marcara caducadas
    // por su cuenta sería una transición disparada por el tiempo.
    expect(aceptar).toContain('if i.caduca_at <= now() then')
    expect(aceptar).toContain("update public.invitaciones set estado = 'caducada'")
    expect(m057).not.toMatch(/cron\.schedule[^\n]*invitacion/)
  })

  it('y ninguna transición suya toca una llave', () => {
    // `T-2`, `R-21`.
    for (const n of ['rechazar_invitacion', 'revocar_invitacion']) {
      const cuerpo = soloSql(funcion(schema, n))
      expect(cuerpo.length, `no se ha encontrado ${n}`).toBeGreaterThan(100)
      expect(cuerpo, `${n} toca una llave`).not.toContain('derechos_expansion')
      expect(cuerpo, `${n} toca una llave`).not.toContain('consumir_llave')
    }
  })

  it('revocar una ya aceptada no existe: para eso está expulsar', () => {
    // `T-4`.
    expect(soloSql(funcion(schema, 'revocar_invitacion')))
      .toContain("if i.estado <> 'pendiente' then return 'ya_resuelta'")
  })

  it('una por gremio y correo, pero varias de gremios distintos', () => {
    // `T-5`: el índice es por (family_id, correo), no por correo.
    expect(m057).toMatch(
      /create unique index if not exists idx_invitacion_pendiente\s+on public\.invitaciones \(family_id, correo\) where estado = 'pendiente'/
    )
  })

  it('la bandeja es de la persona, no del gremio activo', () => {
    // `F-2` paso 3: se ven desde cualquier sitio.
    const mias = soloSql(funcion(schema, 'mis_invitaciones'))
    expect(mias).toContain('where i.correo = (select lower(u.email) from auth.users u where u.id = auth.uid())')
    // Y dice de qué tipo es el gremio: entrar en un equipo de trabajo y entrar
    // en una casa no son la misma decisión.
    expect(mias).toContain('t.nombre_visible')
  })

  it('y una pendiente vencida se lee como caducada aunque su fila no lo diga', () => {
    for (const n of ['mis_invitaciones', 'invitaciones_del_gremio']) {
      expect(soloSql(funcion(schema, n)))
        .toContain("case when i.estado = 'pendiente' and i.caduca_at <= now()")
    }
  })

  it('nadie la lee por la API: RLS encendido y sin políticas', () => {
    expect(m057).toContain('alter table public.invitaciones enable row level security;')
    expect(m057).toContain('revoke all on table public.invitaciones from authenticated;')
    expect(m057).not.toMatch(/create policy \w+ on public\.invitaciones/)
  })

  it('invitar pide `CAP-01`', () => {
    expect(invitar).toContain("public.puede(p_family, 'CAP-01', p_profile) = 'no'")
  })
})

describe('el límite global y el país, al crear', () => {
  it('el límite sale de la configuración y se mira antes de escribir', () => {
    const iLimite = crear.indexOf("resultado := 'en_el_limite'")
    const iInsert = crear.indexOf('insert into public.families')
    expect(crear).toContain('public.parametros_expansion()')
    expect(iLimite).toBeGreaterThan(-1)
    expect(iLimite).toBeLessThan(iInsert)
  })

  it('el tipo tiene que estar ofrecido Y publicado para ese país', () => {
    // `R-103`. El país llega como parámetro porque `R-102` dice que se elige
    // explícitamente al crear; lo que `R-108` prohíbe es que ese parámetro
    // AUTORICE algo, y por eso se cruza contra la matriz del servidor.
    expect(crear).toContain('from public.tipos_ofrecidos() o where o.tipo = p_tipo')
    expect(crear).toContain('if not public.tipo_publicado(p_tipo, v_pais) then')
  })

  it('y es la primera función que llama a `tipo_publicado()`', () => {
    // La 050 la escribió para este momento y la dejó sin conceder a
    // `authenticated` precisamente para que la llamara una función del servidor.
    const cuerpos = schema.split('$fn$').filter((_, i) => i % 2 === 1)
    const llaman = cuerpos.filter((c) => c.includes('public.tipo_publicado('))
    expect(llaman.length).toBe(2) // `disponibilidad_de_tipo` y `crear_gremio_con_llave`
    expect(schema).toContain('revoke all on function public.tipo_publicado(text, text) from authenticated;')
  })

  it('el país va en el `insert`, que es la elección explícita', () => {
    // El disparador de la 055 vigila los `update`, no los nacimientos.
    expect(crear).toContain('pais, pais_declarado_at, pais_declarado_por)')
    expect(crear).not.toContain('app.declarando_pais')
  })

  it('un tipo sin equivalente en la columna vieja no se crea', () => {
    // `families.tipo_gremio` solo conoce 'familia' y 'piso', que es lo que lee
    // el cliente viejo. Ensanchar esa columna —o retirarla— es requisito para
    // publicar Amigos.
    expect(crear).toContain("v_tipo_gremio := case p_tipo when 'hogar' then 'familia'")
    expect(crear).toContain("if v_tipo_gremio is null then resultado := 'tipo_no_ofrecido'")
  })
})

describe('el tope de miembros no se inventa aquí', () => {
  it('sale de la plantilla, y si no lo declara no hay tope', () => {
    // `R-74` dice ocho, y ese número vive hoy en el cliente. Su sitio es
    // `plantillas_tipo.limites`. Escribir un 8 aquí sería repetir exactamente
    // la constante repartida que la 050 y la 053 vinieron a retirar.
    expect(invitar).toContain("(t.limites->>'miembros_humanos')::integer")
    expect(invitar).toContain('if v_tope is not null then')
    expect(invitar).not.toMatch(/>=\s*8\b/)
  })
})

describe('el selector tendrá con qué pintar', () => {
  it('cada gremio con SU tipo, SU personaje y SU nivel', () => {
    // `F-3` paso 2: son progresos distintos y la pantalla no debe sugerir lo
    // contrario (`R-03`).
    const mias = soloSql(funcion(schema, 'mis_pertenencias'))
    expect(mias).toContain('t.nombre_visible')
    expect(mias).toContain('public.nivel_de_xp(greatest(coalesce(pr.xp_maxima, 0), coalesce(pr.xp, 0)))')
    // Y la zona horaria, que hay que reconfigurar al cambiar de gremio (`C-4`).
    expect(mias).toContain('f.timezone')
    expect(mias).toContain("p.estado = 'activa'")
  })
})

describe('las dos copias del esquema', () => {
  it('los cuerpos son iguales hasta el último acento', () => {
    for (const n of FUNCIONES) {
      expect(funcion(schema, n), `${n} difiere entre schema.sql y la 057`)
        .toBe(funcion(m057, n))
    }
  })

  it('y los permisos, iguales y deliberados', () => {
    for (const [firma, publica] of [
      ['public.invitar(uuid, text, uuid)', true],
      ['public.mis_invitaciones()', true],
      ['public.invitaciones_del_gremio(uuid)', true],
      ['public.rechazar_invitacion(uuid)', true],
      ['public.revocar_invitacion(uuid, uuid)', true],
      ['public.aceptar_invitacion(uuid, uuid, text)', true],
      ['public.crear_gremio_con_llave(uuid, text, text, text, text, text)', true],
      ['public.abandonar_gremio(uuid)', true],
      ['public.expulsar_de_gremio(uuid, uuid, uuid)', true],
      ['public.mis_pertenencias()', true],
      // Interna: la llaman las dos funciones de entrada dentro de su
      // transacción. Suelta crearía una pertenencia sin llave ni invitación.
      ['public.entrar_en_gremio(uuid, text, text, text)', false]
    ]) {
      for (const sql of [schema, m057]) {
        expect(sql).toContain(`revoke all on function ${firma} from anon;`)
        if (publica) expect(sql).toContain(`grant execute on function ${firma} to authenticated;`)
        else expect(sql).toContain(`revoke all on function ${firma} from authenticated;`)
      }
    }
  })

  it('la migración termina pegando el barrido de la 021', () => {
    const cola = m057.slice(m057.lastIndexOf('do $$'))
    expect(cola).toContain('revoke all on function %s from public')
    expect(cola).toContain('revoke all on function %s from anon')
  })
})
