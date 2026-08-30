import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// El saldo de quien tiene identidad vive en su cartera (migración 051).
//
// `D-02` en su opción C: quien tiene identidad personal cobra y paga de su
// cartera; quien no la tiene —una peque, una junior, una mascota, un perfil sin
// convertir— conserva su saldo local exactamente como hoy.
//
// El plan avisaba de lo que puede tumbar esta fase: «que la cartera y el saldo
// local se mezclen en algún camino». Casi todo lo que defiende este fichero es
// eso, y en particular la excepción del disparador, que es la pieza que hace
// que la conversión y el borrado de identidad sigan funcionando.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m051 = leer('migracion-051-la-cartera-cobra-y-paga.sql')

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

const encaminar = soloSql(funcion(schema, 'tg_encaminar_coins'))
const mover = soloSql(funcion(schema, 'mover_cartera'))
const saldoDe = soloSql(funcion(schema, 'saldo_de'))
const canjear = soloSql(funcion(schema, 'redeem_reward', '$$'))
const deshacer = soloSql(funcion(schema, 'undo_completion', '$$'))

describe('el encaminamiento vive en un disparador, no en las ocho funciones', () => {
  it('hay un disparador `before update of coins`', () => {
    // Tocar las ocho funciones es lo que la 043 ya descartó para el libro, y
    // por lo mismo: funciona mientras nadie se olvide, y el día que alguien
    // añada la novena esa persona cobra en el monedero que no es.
    expect(schema).toMatch(
      /create trigger trg_encaminar_coins\s+before update of coins on public\.profiles/
    )
    expect(encaminar).not.toBe('')
  })

  it('y las seis que solo suman siguen sin enterarse', () => {
    // `grant_daily_bonus` y compañía siguen escribiendo `coins = coins + N`.
    // Si alguna empezara a mirar la cartera por su cuenta, habría dos sitios
    // que decidir y volveríamos al punto de partida.
    for (const n of ['grant_daily_bonus', 'grant_manual_bonus', 'claim_streak']) {
      const f = soloSql(funcion(schema, n))
      expect(f, `${n} se ha puesto a mirar la cartera`).not.toContain('public.carteras')
      expect(f).toContain('update public.profiles set coins = coins +')
    }
  })
})

describe('la excepción que hace que todo lo demás siga funcionando', () => {
  it('si `persona` cambia en el mismo update, el disparador no se mete', () => {
    // Es LA línea de este fichero. La conversión pone `persona` y deja `coins`
    // a cero en el MISMO update; el borrado hace lo contrario. Si el disparador
    // mirara `new.persona`, leería la conversión como «acaba de gastar 424» y
    // se lo restaría a una cartera que todavía está vacía.
    expect(encaminar).toContain('if new.persona is distinct from old.persona then')
    const iExcepcion = encaminar.indexOf('new.persona is distinct from old.persona')
    const iCartera = encaminar.indexOf('public.mover_cartera')
    expect(iExcepcion).toBeGreaterThan(-1)
    expect(iCartera).toBeGreaterThan(iExcepcion)
  })

  it('y las dos funciones que mueven el saldo entre monederos mueven las dos partes', () => {
    // Por eso el disparador las deja pasar: cada una escribe la salida de un
    // monedero y la entrada en el otro, y las dos entradas van por la única
    // puerta, así que las dos dejan asiento.
    const convertir = soloSql(funcion(schema, 'completar_conversion'))
    const borrar = soloSql(funcion(schema, 'borrar_mi_identidad'))
    expect(convertir).toContain("public.mover_cartera(v_uid, c.profile_id, 'conversion', v_saldo")
    // Y la pata de la cartera va SIN clave: el índice de idempotencia es único
    // en todo el libro, así que las dos patas de un traspaso no pueden llevar
    // la misma. La lleva la de salida, y el «una sola vez» ya lo garantiza
    // `conversiones.clave`. Lo encontró el ensayo, con un choque de clave.
    expect(convertir).toContain("'conversion', v_saldo, c.id, null)")
    expect(convertir).toContain('persona = v_uid')
    expect(borrar).toContain("public.mover_cartera(v_uid, v_perfil, 'devolucion_conversion', -v_saldo")
    expect(borrar).toContain('persona = null')
  })

  it('sin persona detrás, no se encamina nada', () => {
    expect(encaminar).toContain('if new.persona is null then')
  })
})

describe('una cartera solo se mueve por una puerta', () => {
  it('mover el saldo y anotarlo van juntos, y no hay otra vía', () => {
    // La misma decisión que la 043 con el libro: si mover la cartera y anotar
    // el movimiento son dos pasos que cada función da por su cuenta, funciona
    // hasta que alguien da uno y olvida el otro. Y ya había pasado: la
    // conversión anotaba la salida del saldo local y no la entrada en la
    // cartera, así que la cartera tenía 424 y el libro decía 0.
    expect(mover).toContain('update public.carteras set saldo = v_despues')
    expect(mover).toContain('insert into public.movimientos_coins')

    // Nadie más escribe en `carteras` salvo la creación vacía.
    const sospechosas = ['tg_encaminar_coins', 'completar_conversion',
                         'completar_migracion_correo', 'borrar_mi_identidad']
      .filter((n) => /update public\.carteras/.test(soloSql(funcion(schema, n))))
    expect(sospechosas).toEqual([])
  })

  it('bloquea la cartera antes de leerla', () => {
    // El cerrojo evita que dos peticiones lean el mismo saldo y escriban las
    // dos. No es lo mismo que la idempotencia y hacen falta los dos.
    expect(mover).toContain('for update')
  })

  it('no deja la cartera en negativo', () => {
    expect(mover).toContain('if v_despues < 0 then')
    expect(mover).toContain('raise exception')
  })

  it('un movimiento de cero no ensucia el libro', () => {
    expect(mover).toContain('if p_importe = 0 then')
  })

  it('el encaminador deja el saldo local donde estaba, y por eso no hay dos asientos', () => {
    // `tg_movimiento_coins` corre después y empieza comprobando si `coins`
    // cambió. Al devolverlo a su valor, sale por la rama corta.
    expect(encaminar).toContain('new.coins := old.coins;')
    expect(encaminar).toContain("perform set_config('app.coins_tipo', '', true);")
  })
})

describe('quién lee el saldo para decidir', () => {
  it('hay una sola respuesta a «cuánto tiene»', () => {
    expect(saldoDe).toContain('when p.persona is null then p.coins')
    expect(saldoDe).toContain('from public.carteras c where c.persona = p.persona')
  })

  it('y no se le concede a nadie: la usan otras funciones del servidor', () => {
    expect(schema).toContain('revoke all on function public.saldo_de(uuid) from authenticated;')
  })

  it('el canje la usa, y ya no rechaza a quien tiene el saldo en la cartera', () => {
    // Ese rechazo existía mientras la cartera no podía pagar. Ahora paga, así
    // que quien no llega recibe 'sin_monedas' como todo el mundo.
    expect(canjear).toContain('v_saldo := public.saldo_de(p_id);')
    expect(canjear).toContain('if v_saldo < rw.cost then')
    expect(canjear).not.toContain('saldo_en_cartera')
  })

  it('y deshacer una misión recorta contra el saldo de verdad', () => {
    // Estaba `greatest(0, coins - c.coins)`, y ese cero es el del saldo LOCAL:
    // para un personaje convertido vale cero siempre, así que deshacer no le
    // quitaba nada y la cartera se quedaba con monedas de un trabajo que la
    // base ya no considera hecho.
    expect(deshacer).toContain('v_quitar := least(c.coins, public.saldo_de(c.profile_id));')
    expect(deshacer).not.toContain('greatest(0, coins - c.coins)')
  })
})

describe('el libro cuadra, y se puede comprobar', () => {
  it('sabe de qué monedero salió cada movimiento', () => {
    expect(schema).toContain('persona uuid references auth.users(id) on delete set null')
    expect(schema).toMatch(/create index if not exists idx_movimientos_persona/)
  })

  it('los saldos que existían antes del libro tienen su apertura', () => {
    // El libro nació con la 042 y los saldos son anteriores: sin un asiento de
    // apertura, la comprobación de descuadre nace dando falsos positivos para
    // todo el mundo y nadie la vuelve a mirar.
    expect(m051).toContain("'apertura', p.coins, 0, p.coins, 'ok'")
    expect(m051).toContain("where m.profile_id = p.id and m.tipo = 'apertura'")
    expect(schema).toContain("'apertura',")
  })

  it('y hay una función que enseña el descuadre, con los dos monederos aparte', () => {
    const d = soloSql(funcion(schema, 'descuadre_saldos'))
    expect(d).toContain('m.persona is null')
    expect(d).toContain('from public.carteras c')
    expect(d).toContain('having')
  })
})

describe('la marca no puede mentir', () => {
  it('`saldo_local_cerrado` va atada a `persona`', () => {
    // Quien manda es `persona`. Tener las dos cosas por separado sería tener
    // dos fuentes de la misma verdad, que es contra lo que pelea medio esquema.
    expect(schema).toMatch(
      /constraint profiles_marca_de_cartera check \(\s*saldo_local_cerrado = \(persona is not null\)\s*\)/
    )
  })
})

describe('las dos copias del esquema', () => {
  it('las funciones de la 051 son idénticas en la migración y en el esquema', () => {
    for (const [n, d] of [
      ['saldo_de', '$fn$'], ['mover_cartera', '$fn$'], ['tg_encaminar_coins', '$fn$'],
      ['descuadre_saldos', '$fn$'], ['completar_conversion', '$fn$'],
      ['completar_migracion_correo', '$fn$'], ['borrar_mi_identidad', '$fn$'],
      ['anota_coins', '$$'], ['redeem_reward', '$$'], ['undo_completion', '$$']
    ]) {
      expect(funcion(m051, n, d), `${n} difiere entre la 051 y schema.sql`)
        .toBe(funcion(schema, n, d))
    }
  })
})
