import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// Convertir un perfil en persona (migración 047, flujo F-9).
//
// Lo que defiende este fichero son las decisiones que hacen que la conversión
// no destruya nada, y casi todas son decisiones de ORDEN: qué pasa antes que
// qué. Cambiar ese orden no rompe ningún test de comportamiento y sí rompe a
// una familia: el saldo se transfiere a una identidad que nadie confirmó, o el
// vínculo se propone por parecido y acaba en la persona equivocada.
//
// Se lee el SQL como texto, igual que en `pertenencia.test.js`, y por lo mismo:
// no sustituye a ejecutarlo, pero caza el descuido que no se ve leyendo.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m047 = leer('migracion-047-conversion-de-perfil-a-persona.sql')

const soloSql = (sql) =>
  sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')

function funcion(sql, nombre, delim = '$fn$') {
  const i = sql.indexOf(`create or replace function public.${nombre}(`)
  if (i < 0) return ''
  const j = sql.indexOf(`\nas ${delim}`, i)
  const k = sql.indexOf(`\nend ${delim};`, j)
  return sql.slice(i, k + `\nend ${delim};`.length)
}

const solicitar = soloSql(funcion(schema, 'solicitar_conversion'))
const completar = soloSql(funcion(schema, 'completar_conversion'))
const canjear = soloSql(funcion(schema, 'redeem_reward', '$$'))

describe('son dos pasos, y el segundo espera al correo confirmado', () => {
  it('las dos funciones existen y son distintas', () => {
    expect(solicitar).not.toBe('')
    expect(completar).not.toBe('')
  })

  it('sin correo confirmado no se completa nada', () => {
    // `signUp` devuelve `error: null` y `session: null` cuando falta
    // confirmar: no falla, solo no entra. Si el saldo se moviera antes, un
    // correo mal escrito lo dejaría en una identidad que no controla nadie.
    expect(completar).toContain('email_confirmed_at')
    expect(completar).toContain("return 'correo_sin_confirmar'")
  })

  it('el paso 1 no mueve ni una moneda ni crea ninguna pertenencia', () => {
    // Es una petición, no una reserva.
    expect(solicitar).not.toContain('public.carteras')
    expect(solicitar).not.toContain('public.pertenencias')
    expect(solicitar).not.toContain('public.credenciales (')
    expect(solicitar).not.toContain('coins')
  })

  it('la comprobación del correo confirmado va ANTES de tocar nada', () => {
    const iConfirmado = completar.indexOf('email_confirmed_at')
    const iEscribe = completar.indexOf('insert into public.credenciales')
    expect(iConfirmado).toBeGreaterThan(-1)
    expect(iEscribe).toBeGreaterThan(iConfirmado)
  })
})

describe('el vínculo nunca se infiere', () => {
  it('el personaje llega como parámetro, elegido a mano', () => {
    expect(schema).toContain(
      'create or replace function public.solicitar_conversion(\n  p_profile uuid,'
    )
  })

  it('no se busca a nadie por nombre, edad ni orden de creación', () => {
    // Vincular a la persona equivocada es el fallo más difícil de deshacer de
    // todo el modelo. Ninguna de las dos funciones puede elegir por su cuenta.
    for (const [cual, fn] of [['solicitar', solicitar], ['completar', completar]]) {
      expect(fn, `${cual} mira el nombre`).not.toMatch(/\bp\.name\b/)
      expect(fn, `${cual} mira la edad o el orden`).not.toMatch(/created_at|order by/)
    }
  })

  it('y el PIN es lo que demuestra que hay una persona adulta delante', () => {
    expect(solicitar).toContain('parent_pin_hash')
    expect(solicitar).toContain("return 'pin_incorrecto'")
  })
})

describe('quién se puede convertir, y quién todavía no', () => {
  it('un junior no, y con su propio código', () => {
    // No es que no pueda progresar: es que crear un correo y una contraseña
    // para una menor tiene requisitos legales sin mirar. Va detrás de su
    // revisión jurídica, y hasta entonces el servidor dice que no.
    expect(solicitar).toContain("v_rol = 'junior'")
    expect(solicitar).toContain("return 'junior_bloqueado'")
  })

  it('una peque o una mascota, nunca', () => {
    expect(solicitar).toContain("v_rol <> 'adulto'")
    expect(solicitar).toContain("return 'solo_adulto'")
  })

  it('un personaje que ya tiene persona detrás, tampoco', () => {
    expect(solicitar).toContain("return 'ya_es_persona'")
    expect(completar).toContain("return 'personaje_ocupado'")
  })

  it('ni una persona que ya tiene personaje en ese gremio', () => {
    expect(completar).toContain("return 'ya_estas_en_el_gremio'")
  })
})

describe('lo que se dice cuando el correo no sirve', () => {
  it('la clave de la casa tiene su propio mensaje, y no «ya registrado»', () => {
    // Es el caso MÁS frecuente: quien fundó la casa usó su correo personal.
    // Un «ese correo ya existe» le deja sin saber que la salida es la
    // migración guiada y no inventarse otro correo.
    expect(solicitar).toContain("clase = 'compartida'")
    expect(solicitar).toContain("return 'correo_es_la_clave_de_casa'")
  })

  it('cualquier otro correo en uso se responde sin decir de quién', () => {
    // Un mensaje más concreto convierte la pantalla en un comprobador de qué
    // correos están dados de alta.
    expect(solicitar).toContain("return 'correo_no_disponible'")
    expect(solicitar).not.toMatch(/return '[a-z_]*ya_registrad/)
  })
})

describe('la transferencia del saldo', () => {
  it('sale del personaje y entra en la cartera, con su motivo declarado', () => {
    expect(completar).toContain("public.motivo_coins('conversion'")
    // Por la única puerta que mueve carteras, para que la ENTRADA deje asiento
    // igual que la salida: una transferencia entre monederos son dos apuntes.
    expect(completar).toContain("public.mover_cartera(v_uid, c.profile_id, 'conversion'")
  })

  it('el saldo local queda cerrado, y cerrado quiere decir que no se gasta', () => {
    expect(completar).toContain('saldo_local_cerrado = true')
    // La 051 cambió cómo se defiende esto, y para mejor: `redeem_reward` ya no
    // rechaza el canje de quien tiene el saldo en la cartera —ahora la cartera
    // paga—, así que lo que hay que comprobar es que lee el saldo por donde
    // toca. Mirar `p.coins` daría cero para todo el mundo convertido.
    expect(canjear).toContain('v_saldo := public.saldo_de(p_id);')
    expect(canjear).not.toContain("'saldo_en_cartera'")
  })

  it('el libro conoce el motivo, en las dos copias del esquema', () => {
    expect(schema).toMatch(/'conversion',/)
    expect(m047).toContain("'conversion',")
  })

  it('una sola vez: misma clave, misma respuesta y sin repetir', () => {
    expect(completar).toMatch(/clave = p_clave and estado = 'completada'/)
    expect(completar).toContain("return 'ok'")
  })

  it('con cerrojo sobre las dos filas que se mueven', () => {
    // Idempotencia y bloqueo no son lo mismo y hacen falta los dos: el
    // bloqueo evita que dos peticiones se pisen; la clave evita que dos
    // peticiones legítimas hagan dos cosas cuando se quería una.
    expect((completar.match(/for update/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('cómo entra la persona en su gremio', () => {
  it('por reclamación, que es el único origen que no consume llave', () => {
    // No crea una relación nueva: formaliza la de quien ya operaba ese
    // personaje.
    expect(completar).toContain("'reclamacion'")
  })

  it('como gestora y no como titular', () => {
    // Pertenecer da acceso y gestión, no la potestad de cerrar el gremio, que
    // hoy sigue siendo de la credencial compartida que lo fundó.
    expect(completar).toContain("'gestor'")
    expect(completar).not.toContain("'titular'")
  })

  it('la identidad se crea ANTES del vínculo, que es lo que exige el disparador', () => {
    // `tg_persona_es_personal` rechaza vincular a quien no sea de clase
    // personal. Invertir estas dos líneas hace fallar la conversión entera.
    const iCred = completar.indexOf('insert into public.credenciales')
    const iVinc = completar.indexOf('set persona = v_uid')
    expect(iCred).toBeGreaterThan(-1)
    expect(iVinc).toBeGreaterThan(iCred)
  })
})

describe('una solicitud viva por personaje y por correo', () => {
  it('con índices parciales, no con un `select` previo', () => {
    expect(schema).toMatch(
      /create unique index if not exists idx_conversion_pendiente_perfil\s+on public\.conversiones \(profile_id\) where estado = 'pendiente'/
    )
    expect(schema).toMatch(
      /create unique index if not exists idx_conversion_pendiente_correo\s+on public\.conversiones \(correo\) where estado = 'pendiente'/
    )
  })

  it('y se puede retirar, o el índice es una trampa de 72 horas', () => {
    expect(schema).toContain('create or replace function public.cancelar_conversion(')
  })

  it('las caducadas se apartan antes de mirar si hay una viva', () => {
    expect(solicitar).toContain("set estado = 'caducada'")
  })
})

describe('las dos copias del esquema', () => {
  it('las funciones de la conversión son idénticas en la migración y en el esquema', () => {
    for (const n of ['solicitar_conversion', 'cancelar_conversion']) {
      expect(funcion(m047, n), `${n} difiere entre la 047 y schema.sql`)
        .toBe(funcion(schema, n))
    }
    // OJO: `completar_conversion` ya no se compara aquí. La 051 la volvió a escribir para
    // que la entrada del saldo en la cartera pase por `mover_cartera` y deje
    // asiento. Una migración registra lo que hizo ese día; quien manda es la
    // última que la tocó, y editar una ya aplicada es justo lo que no se hace.
    // La comparación viva está en `tests/cartera.test.js`, contra la 051.
    // `redeem_reward` NO se compara aquí, y conviene entender por qué: la 051
    // volvió a escribirla para que lea el saldo por `saldo_de`. Una migración
    // es el registro de lo que hizo ese día, no la versión vigente; quien
    // manda es la última que la tocó. Comparar contra la 047 exigiría editar
    // una migración ya aplicada, que es justo lo que no se hace.
    // La comparación viva está en `tests/cartera.test.js`, contra la 051.
  })

  it('las tablas nuevas están en los dos ficheros', () => {
    for (const trozo of [
      'create table if not exists public.carteras (',
      'create table if not exists public.conversiones (',
      'saldo_local_cerrado'
    ]) {
      expect(m047, `falta en la 047: ${trozo}`).toContain(trozo)
      expect(schema, `falta en schema.sql: ${trozo}`).toContain(trozo)
    }
  })
})
