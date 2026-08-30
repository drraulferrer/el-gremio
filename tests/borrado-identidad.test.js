import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// Borrar la identidad personal sin llevarse la casa (migración 049, F-8d).
//
// Es la pieza que la especificación dice que bloquea el lanzamiento, y el
// motivo cabe en una línea: hasta hoy, `delete_my_account` hacía
// `delete from families where owner = auth.uid()`, y desde la 047 eso puede
// llevarse por delante el personaje, el historial y la cartera de gente que no
// ha pedido nada. Las claves ajenas en cascada no preguntan.
//
// Lo que defiende este fichero es que las dos puertas son distintas y que
// ninguna de las dos puede borrar lo de terceros.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m049 = leer('migracion-049-borrar-mi-identidad-sin-borrar-la-casa.sql')

const soloSql = (sql) =>
  sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')

function funcion(sql, nombre) {
  const i = sql.indexOf(`create or replace function public.${nombre}(`)
  if (i < 0) return ''
  const j = sql.indexOf('\nas $fn$', i)
  const k = sql.indexOf('\nend $fn$;', j)
  return sql.slice(i, k + '\nend $fn$;'.length)
}

const efecto = soloSql(funcion(schema, 'efecto_de_borrarme'))
const borrar = soloSql(funcion(schema, 'borrar_mi_identidad'))
const cuenta = soloSql(funcion(schema, 'delete_my_account'))

describe('la puerta vieja ya no puede llevarse lo de nadie', () => {
  it('una identidad personal no borra gremios: tiene su propia puerta', () => {
    expect(cuenta).toContain("public.clase_credencial() = 'personal'")
    expect(cuenta).toContain("return 'usa_borrar_identidad'")
  })

  it('y la clave de la casa se niega si dentro vive alguien', () => {
    // Que la casa se disuelva no puede decidirlo quien tiene la clave sin
    // contar con quien vive dentro: su personaje, su historial y su cartera no
    // son suyos.
    expect(cuenta).toContain("return 'hay_personas_dentro'")
    expect(cuenta).toMatch(/from public\.pertenencias p[\s\S]*?f\.owner = v_uid[\s\S]*?p\.estado = 'activa'/)
  })

  it('las dos comprobaciones van ANTES del delete', () => {
    const iPersonal = cuenta.indexOf("return 'usa_borrar_identidad'")
    const iDentro = cuenta.indexOf("return 'hay_personas_dentro'")
    const iDelete = cuenta.indexOf('delete from public.families')
    expect(iDelete).toBeGreaterThan(iPersonal)
    expect(iDelete).toBeGreaterThan(iDentro)
  })

  it('y sigue haciendo lo de siempre cuando no hay nadie más', () => {
    // Con una cuenta por casa, borrar la cuenta ES borrar el gremio, y eso es
    // exactamente lo que la persona pide. No se le quita.
    expect(cuenta).toContain("return 'ok_sin_gremio'")
    expect(cuenta).toContain('delete from public.families where owner = v_uid')
  })
})

describe('el efecto lo calcula el servidor, y antes de preguntar nada', () => {
  it('hay una función que lo devuelve entero, gremio por gremio', () => {
    expect(efecto).not.toBe('')
    expect(efecto).toContain("'accion'")
    expect(efecto).toContain("'abandonar'")
    expect(efecto).toContain("'transferir'")
    expect(efecto).toContain("'cerrar'")
  })

  it('un gremio con clave de casa nunca se queda sin administración', () => {
    // Un perfil adulto con el PIN administra la casa como siempre, así que ahí
    // la acción es abandonar y no hay nada que traspasar ni que cerrar. Como
    // hoy todos los gremios tienen clave de casa, hoy borrarse no cierra
    // ninguno.
    expect(efecto).toMatch(/when g\.con_clave_de_casa then 'abandonar'/)
  })

  it('y la lista de gremios NO llega del cliente', () => {
    // `borrar_mi_identidad` recibe decisiones, no la lista, y vuelve a
    // calcularla entera aunque el cliente ya la haya pedido para pintarla.
    expect(borrar).toContain('v_efecto := public.efecto_de_borrarme();')
    expect(schema).toContain('create or replace function public.borrar_mi_identidad(\n  p_decisiones jsonb')
  })
})

describe('no se toca nada hasta que están todas las decisiones', () => {
  it('primero se comprueban todas, y solo después se ejecuta', () => {
    // Quedarse a medias aquí es dejar a alguien fuera de un gremio que no
    // llegó a traspasar. Son dos recorridos del mismo array a propósito.
    const iFalta = borrar.indexOf("return 'falta_decision'")
    const iEjecuta = borrar.indexOf('update public.pertenencias\n       set estado =')
    expect(iFalta).toBeGreaterThan(-1)
    expect(iEjecuta).toBeGreaterThan(iFalta)
  })

  it('a quien se traspasa tiene que estar dentro, y no ser una misma', () => {
    expect(borrar).toContain("return 'destino_invalido'")
    expect(borrar).toContain('v_destino = v_uid')
  })

  it('cerrar es la única rama que borra, y hay que haberla escrito', () => {
    expect(borrar).toMatch(/if v_accion = 'cerrar' then\s+delete from public\.families/)
  })
})

describe('el dinero del juego no se evapora', () => {
  it('la cartera vuelve al personaje y el saldo local se reabre', () => {
    // Simétrico de la conversión. Sin esto, quien borra su cuenta se lleva por
    // delante los Talis de un personaje que se queda en la casa, a la vista de
    // todos, con cero.
    expect(borrar).toContain("public.motivo_coins('devolucion_conversion'")
    expect(borrar).toContain('coins = coins + v_saldo')
    expect(borrar).toContain('saldo_local_cerrado = false')
    expect(borrar).toContain('persona = null')
  })

  it('el libro conoce la vuelta, en las dos copias', () => {
    expect(schema).toContain("'devolucion_conversion',")
    expect(m049).toContain("'devolucion_conversion',")
  })

  it('con más de un gremio se niega en vez de repartir a ojo', () => {
    // No pasa hoy —una persona tiene un personaje— y la función prefiere no
    // hacer nada antes que inventarse a dónde vuelve el saldo. Se resuelve en
    // la Fase 6, que es cuando puede ocurrir.
    expect(borrar).toContain("return 'varios_gremios_no_resuelto'")
    expect(efecto).toContain("'cartera_resuelta'")
  })
})

describe('lo que sobrevive a la persona', () => {
  it('la historia de la llave no se va con quien la tuvo', () => {
    // `migraciones_correo.antigua` estaba en cascada: borrar esa identidad se
    // llevaba el registro de que la llave de esta casa cambió de manos tal
    // día. Eso es historia del gremio, no suya.
    expect(schema).toContain('antigua uuid references auth.users(id) on delete set null')
    expect(schema).not.toContain('antigua uuid not null references auth.users(id) on delete cascade')
    expect(m049).toContain('on delete set null')
  })

  it('y los importes de su conversión también', () => {
    // `conversiones.persona` ya era `set null`: la fila se queda sin persona y
    // conserva los números.
    expect(schema).toContain('persona uuid references auth.users(id) on delete set null')
  })
})

describe('las dos copias del esquema', () => {
  it('las tres funciones son idénticas en la migración y en el esquema', () => {
    for (const n of ['efecto_de_borrarme', 'borrar_mi_identidad', 'delete_my_account']) {
      expect(funcion(m049, n), `${n} difiere entre la 049 y schema.sql`)
        .toBe(funcion(schema, n))
    }
  })
})
