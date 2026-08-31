import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  RESPUESTAS_TERMINAR, mensajeDeTerminar,
  RESPUESTAS_CANCELAR, mensajeDeCancelar
} from '../src/lib/expansion'

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

// ------------------------------------------------------------------
// El paso 3: la vuelta desde el enlace del correo.
//
// `completar_conversion()` estuvo en la base desde el 29-ago **sin que la
// llamara nadie**, y como es la única manera de que una credencial pase a
// `personal`, con ella se quedaron cerradas las fases 5, 6 y 7 enteras:
// forjar, aceptar una invitación, reclamar y retirar la clave común exigen
// las cuatro `clase_credencial() = 'personal'`. Ni un test lo vio, porque
// todos leían el SQL y el SQL estaba bien.
//
// Lo que sigue defiende la otra mitad: que alguien la llame, cuándo, y qué
// se dice cuando no sale.
// ------------------------------------------------------------------

const app = leer('src/App.jsx')

describe('alguien llama a completar_conversion', () => {
  it('la app la llama, y por su envoltorio', () => {
    expect(leer('src/lib/acciones.js')).toContain("supabase.rpc('completar_conversion'")
    expect(app).toContain('terminarIdentidad')
  })

  it('y ANTES de cargar el gremio, no a la vez', () => {
    // Es la parte que importa: la pertenencia que crea esa función es lo
    // que hace que el gremio exista para la cuenta nueva. Cargando en
    // paralelo, quien acaba de crearse una identidad vería «Fundad
    // vuestro gremio» mientras tanto, que es el susto que esto evita.
    expect(app).toMatch(/if \(identidad\.estado !== 'terminando'\) loadFamily\(\)/)
  })

  it('hay un cinturón para cuando la URL no lo dice', () => {
    // supabase-js consume el hash al arrancar y puede llevárselo antes de
    // que la app mire; y el enlace se puede abrir hoy y volver mañana. La
    // señal que queda es: hay sesión y NINGÚN gremio.
    expect(app).toContain('if (family !== null || cinturonIdentidad.current) return')
  })

  it('y el cinturón no le cuesta nada a quien ya tiene gremio', () => {
    // `family !== null` corta antes de llamar. Si algún día se quitara esa
    // condición, cada arranque de cada aparato pagaría una RPC de más.
    const i = app.indexOf('cinturonIdentidad.current) return')
    const j = app.indexOf('terminarIdentidad(session?.user?.id)')
    expect(i).toBeGreaterThan(0)
    expect(j).toBeGreaterThan(i)
  })
})

describe('lo que se dice al volver del enlace', () => {
  it('ningún código sale de la manga: todos están en la función', () => {
    // El mismo cruce que ya se hace con la forja y con la conversión: un
    // código mal escrito aquí sale como mensaje genérico y esconde justo
    // lo que había que enseñar.
    for (const codigo of Object.keys(RESPUESTAS_TERMINAR)) {
      expect(completar, `completar_conversion no devuelve '${codigo}'`)
        .toContain(`'${codigo}'`)
    }
  })

  it('quien funda un gremio no ve ningún error', () => {
    // Fundar llega por el MISMO enlace `type=signup`, y para el servidor es
    // «no hay solicitud». Hablar aquí sería inventarle un problema a alguien
    // el día que se da de alta.
    expect(mensajeDeTerminar('ok')).toBe(null)
    expect(mensajeDeTerminar('sin_solicitud')).toBe(null)
    expect(mensajeDeTerminar('ya_clasificada')).toBe(null)
  })

  it('pero si en este aparato SÍ se pidió, es que ha caducado y se dice', () => {
    const aviso = mensajeDeTerminar('sin_solicitud', true)
    expect(aviso).toContain('caducado')
    expect(aviso).toContain('72 horas')
  })

  it('y todo final malo termina diciendo que la casa sigue ahí', () => {
    // Quien llega aquí está en una cuenta nueva y vacía y su gremio parece
    // haber desaparecido. Un mensaje que no diga cómo volver es peor que
    // ninguno.
    for (const codigo of ['sin_solicitud', 'lo_que_sea']) {
      expect(mensajeDeTerminar(codigo, true)).toContain('siguen intactos')
    }
  })

  it('un código desconocido no se traga: avisa', () => {
    expect(mensajeDeTerminar('algo_nuevo_del_servidor')).toContain('No se ha podido terminar')
  })
})

describe('retirar una solicitud que estorba', () => {
  // El índice «una pendiente por personaje» es una trampa sin esto, y su
  // propia migración lo dice. La trampa se cerró sola el 30-ago: el alta
  // falló por el captcha, la solicitud se quedó viva, y el reintento
  // contestaba «ya hay una en marcha, mira tu correo» — un correo que no
  // existía, durante 72 horas y sin forma de retirarla desde la app.
  const cancelar = soloSql(funcion(schema, 'cancelar_conversion'))

  it('la app la llama, que hasta hoy no lo hacía nadie', () => {
    expect(leer('src/lib/acciones.js')).toContain("supabase.rpc('cancelar_conversion'")
    expect(leer('src/screens/Expandirse.jsx')).toContain('cancelarConversion')
  })

  it('y solo cuando el servidor dice que hay una en marcha', () => {
    // No se ofrece «por si acaso»: se ofrece con el código que lo explica.
    expect(leer('src/screens/Expandirse.jsx'))
      .toContain("if (codigo === 'ya_tienes_solicitud')")
  })

  it('ningún código sale de la manga', () => {
    for (const codigo of Object.keys(RESPUESTAS_CANCELAR)) {
      expect(cancelar, `cancelar_conversion no devuelve '${codigo}'`).toContain(`'${codigo}'`)
    }
  })

  it('el PIN se exige también para retirarla', () => {
    // Pedirla exige PIN; retirarla también, o cualquiera que pase por
    // delante del móvil podría tumbar la conversión de otra persona.
    expect(cancelar).toContain('pin_incorrecto')
    expect(leer('src/screens/Expandirse.jsx')).toContain('cancelarConversion(estorba.id, await hashPin(pin))')
  })

  it('retirar y volver a pedir son dos actos, no uno', () => {
    // Si la solicitud anterior SÍ estaba viva de verdad —el correo salió y
    // alguien está a punto de abrirlo—, reintentar solo la rompería.
    const pantalla = leer('src/screens/Expandirse.jsx')
    expect(pantalla).toContain('Ya puedes pedirla otra vez')
    expect(pantalla).not.toMatch(/setEstorba\(null\)[\s\S]{0,80}empezar\(\)/)
  })

  it('que ya estuviera resuelta no es un error que contar', () => {
    expect(mensajeDeCancelar('ok')).toBe(null)
    expect(mensajeDeCancelar('ya_resuelta')).toBe(null)
    expect(mensajeDeCancelar('pin_incorrecto')).toContain('PIN')
    expect(mensajeDeCancelar('vete_a_saber')).toContain('No se ha podido retirar')
  })
})

describe('las dos puertas a la identidad', () => {
  // La primera —dentro de Expandirse— la pone `F-4` paso 3: se pide justo
  // cuando hace falta y «no antes, no por si acaso» (`R-48`). Esa decisión
  // no se toca. La segunda, en ⚙️ → Datos, es para quien va a BUSCARLA en
  // vez de tropezársela, que era la queja de §7cd: la identidad vivía
  // detrás de un botón a media pantalla en Progreso y no la encontraba
  // nadie que no fuera ya a expandirse.
  const expandirse = leer('src/screens/Expandirse.jsx')
  const identidad = leer('src/screens/TuIdentidad.jsx')

  it('son la misma pieza, no dos formularios', () => {
    // Dos formularios que piden lo mismo acaban pidiéndolo distinto: uno
    // se queda sin el captcha, o sin el aviso de solicitud caducada.
    expect(expandirse).toContain('export function Conversion(')
    expect(identidad).toContain("from './Expandirse'")
    expect(identidad).toContain('<Conversion')
  })

  it('pero cada puerta explica lo suyo', () => {
    // Reusar la pieza tal cual decía «Para expandirte necesitas…» a quien
    // había entrado en Ajustes a buscar su identidad.
    expect(expandirse).toContain('<Conversion family={family} profile={profile} />')
    expect(identidad).toContain('conIntroduccion={false}')
    expect(expandirse).toContain('conIntroduccion && (')
  })

  it('la nueva puerta solo ofrece lo que el servidor acepta', () => {
    // `solicitar_conversion` responde `solo_adulto` a todo lo demás.
    // Ofrecer a una junior un botón que va a rebotar es peor que no
    // ofrecerlo: parece que se puede y no se puede.
    expect(identidad).toContain("p.role === 'adulto' && !p.persona")
    expect(solicitar).toContain("'solo_adulto'")
  })

  it('y dice en qué estado estás, que no lo decía ninguna pantalla', () => {
    expect(identidad).toContain("supabase.rpc('clase_credencial')")
    expect(identidad).toContain('clase === \'personal\'')
    // Degradable: sin respuesta no pinta nada, como el resto de la app.
    expect(identidad).toContain('if (!clase')
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
