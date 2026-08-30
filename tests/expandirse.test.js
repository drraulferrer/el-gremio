import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ESTADOS, loQueFalta, siguienteEscalon, llavesDisponibles,
  RESPUESTAS_FORJA, mensajeDeForja,
  RESPUESTAS_CONVERSION, mensajeDeConversion,
  RESPUESTAS_CREAR, mensajeDeCrear,
  RESPUESTAS_ACEPTAR, mensajeDeAceptar,
  RESPUESTAS_INVITAR, mensajeDeInvitar,
  aceptables
} from '../src/lib/expansion'

// ------------------------------------------------------------------
// Expandirse (6.3).
//
// Lo que este fichero defiende es una sola cosa, dicha de varias maneras:
// que la pantalla y el servidor no se separen. El cliente SOLO MUESTRA
// (`SEC-1`), pero mostrar mal tiene consecuencias caras:
//
//   · un botón donde el servidor va a decir que no es una promesa rota;
//   · un estado que la pantalla no conoce se pintaría como un hueco mudo
//     justo en el caso nuevo, que es el que nadie ha probado;
//   · un código de error sin frase sale como «algo ha fallado», que es la
//     forma más rápida de que un fallo real no se investigue nunca.
// ------------------------------------------------------------------

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')

function funcion(sql, nombre) {
  const i = sql.indexOf(`create or replace function public.${nombre}(`)
  if (i < 0) return ''
  const j = sql.indexOf('\nas $fn$', i)
  const m = /\n(?:end )?\$fn\$;/.exec(sql.slice(j))
  return sql.slice(i, j + m.index + m[0].length)
}

describe('la pantalla conoce los mismos estados que el servidor', () => {
  it('los seis, y en el mismo orden', () => {
    // El orden importa además del conjunto: es el orden de prioridad con el
    // que el servidor decide qué decir primero, y la pantalla lo repite.
    // `else` además de `then`: el último caso —`puedes`— es la rama por
    // defecto del `case`, y buscando solo `then` se quedaba fuera.
    const enSql = [...funcion(schema, 'oportunidades_expansion').matchAll(/(?:then|else) '([a-z_]+)'/g)]
      .map((m) => m[1])
    expect(enSql.slice(0, 6)).toEqual(ESTADOS)
  })

  it('y ninguno se queda sin frase', () => {
    for (const estado of ESTADOS) {
      const { titulo } = loQueFalta({ estado, nivel_exigido: 6, coste: 300, falta_xp: 80, falta_monedas: 40 })
      expect(titulo, `${estado} no tiene título`).toBeTruthy()
    }
  })

  it('un estado desconocido no inventa un botón', () => {
    // Si el servidor gana un estado y este cliente todavía no lo conoce, lo
    // honrado es decir que no se sabe. Pintar «puedes» sería peor.
    const r = loQueFalta({ estado: 'algo_que_vendra_en_la_6_4' })
    expect(r.puede).toBe(false)
    expect(r.titulo).toBe('No disponible')
  })

  it('solo `puedes` habilita el botón', () => {
    for (const estado of ESTADOS) {
      expect(loQueFalta({ estado }).puede, estado).toBe(estado === 'puedes')
    }
  })
})

describe('cuánto falta se dice con números, no con «todavía no»', () => {
  it('la XP que falta, cuando falta nivel', () => {
    const r = loQueFalta({ estado: 'falta_nivel', nivel_exigido: 6, falta_xp: 180 })
    expect(r.titulo).toBe('Nivel 6')
    expect(r.detalle).toContain('180')
  })

  it('y lo que falta de saldo, cuando ya hay nivel', () => {
    const r = loQueFalta({ estado: 'falta_monedas', falta_monedas: 40 })
    expect(r.titulo).toContain('40')
    expect(r.detalle).toContain('Tienes el nivel')
  })

  it('estar en el límite se explica como lo que es: una decisión', () => {
    // Y no como «no puedes». Quien está en el límite puede forjar mañana si
    // deja un gremio; quien no tiene nivel, no.
    const r = loQueFalta({ estado: 'en_el_limite' })
    expect(r.detalle).toContain('Deja uno')
  })
})

describe('el escalón que toca', () => {
  const oportunidades = [
    { orden: 1, estado: 'forjada' },
    { orden: 2, estado: 'falta_nivel' },
    { orden: 3, estado: 'falta_nivel' }
  ]

  it('es el primero sin forjar', () => {
    expect(siguienteEscalon(oportunidades).orden).toBe(2)
  })

  it('y no hay ninguno si están todos forjados', () => {
    expect(siguienteEscalon([{ orden: 1, estado: 'forjada' }])).toBe(null)
    expect(siguienteEscalon([])).toBe(null)
  })
})

describe('las llaves', () => {
  it('solo cuentan las disponibles', () => {
    // Una consumida abrió su gremio y una revertida se devolvió: ninguna de
    // las dos sirve para entrar en ningún sitio.
    const llaves = [
      { id: '1', estado: 'disponible' },
      { id: '2', estado: 'consumido' },
      { id: '3', estado: 'revertido' },
      { id: '4', estado: 'disponible' }
    ]
    expect(llavesDisponibles(llaves).map((l) => l.id)).toEqual(['1', '4'])
  })
})

describe('cada código del servidor tiene su frase', () => {
  it('los de forjar, todos', () => {
    // Se sacan del propio `forjar_llave` en `schema.sql`: si mañana devuelve
    // uno nuevo y nadie le escribe frase, este test cae.
    const enSql = new Set(
      [...funcion(schema, 'forjar_llave').matchAll(/return '([a-z_]+)'/g)].map((m) => m[1])
    )
    for (const codigo of enSql) {
      expect(RESPUESTAS_FORJA, `falta la frase de '${codigo}'`).toHaveProperty(codigo)
    }
  })

  it('los de la conversión, también', () => {
    const enSql = new Set(
      [...funcion(schema, 'solicitar_conversion').matchAll(/return '([a-z_]+)'/g)].map((m) => m[1])
    )
    for (const codigo of enSql) {
      expect(RESPUESTAS_CONVERSION, `falta la frase de '${codigo}'`).toHaveProperty(codigo)
    }
  })

  it('`ok` no dice nada, que es lo correcto', () => {
    expect(mensajeDeForja('ok')).toBe(null)
    expect(mensajeDeConversion('ok')).toBe(null)
  })

  it('y un código desconocido cae en algo presentable', () => {
    expect(mensajeDeForja('lo_que_sea')).toContain('No se ha podido')
    expect(mensajeDeConversion('lo_que_sea')).toContain('No se ha podido')
  })

  it('el correo de la casa se explica entero', () => {
    // Es el error que cualquiera comete la primera vez: el correo del gremio
    // es el único que esa persona ha usado nunca con esta app.
    expect(mensajeDeConversion('correo_es_la_clave_de_casa')).toContain('toda la casa')
  })
})


// ------------------------------------------------------------------
// Gastar la llave, e invitar (la segunda mitad de la 6.3).
// ------------------------------------------------------------------

describe('gastar la llave y las invitaciones', () => {
  // Las cuatro funciones que devuelven códigos. Se comprueban igual que las
  // dos de arriba: extrayendo del propio `schema.sql` lo que el servidor
  // puede contestar. Un código sin frase saldría como «algo ha fallado».
  const PUERTAS = [
    ['crear_gremio_con_llave', RESPUESTAS_CREAR],
    ['aceptar_invitacion', RESPUESTAS_ACEPTAR],
    ['invitar', RESPUESTAS_INVITAR]
  ]

  it('cada código del servidor tiene su frase', () => {
    for (const [nombre, tabla] of PUERTAS) {
      const cuerpo = funcion(schema, nombre)
      expect(cuerpo.length, `no se ha encontrado ${nombre}`).toBeGreaterThan(200)
      // Las dos formas: `return 'x'` y `resultado := 'x'`, que es como
      // devuelven las que traen una tabla.
      const codigos = new Set([
        ...[...cuerpo.matchAll(/return '([a-z_]+)'/g)].map((m) => m[1]),
        ...[...cuerpo.matchAll(/resultado := '([a-z_]+)'/g)].map((m) => m[1])
      ])
      expect(codigos.size, `${nombre} no devuelve códigos`).toBeGreaterThan(3)
      for (const codigo of codigos) {
        expect(tabla, `${nombre}: falta la frase de '${codigo}'`).toHaveProperty(codigo)
      }
    }
  })

  it('y los tres `ok` callan', () => {
    expect(mensajeDeCrear('ok')).toBe(null)
    expect(mensajeDeAceptar('ok')).toBe(null)
    expect(mensajeDeInvitar('ok')).toBe(null)
  })

  it('una caducada se explica sin culpar a nadie', () => {
    // No es un fallo de quien la recibe: es el reloj. Y `R-21` dice que no
    // toca la llave, así que el mensaje no puede sugerir que se ha perdido.
    const m = mensajeDeAceptar('caducada')
    expect(m).toContain('caducado')
    expect(m).toContain('otra vez')
    expect(m).not.toContain('llave')
  })

  it('y quedarse sin llave dice dónde se consigue una', () => {
    expect(mensajeDeAceptar('hace_falta_llave')).toContain('Progreso')
  })

  it('solo se ofrece aceptar lo que sigue pendiente', () => {
    // El estado ya viene resuelto del servidor: una pendiente vencida se lee
    // como caducada. Aquí no se vuelve a mirar el reloj, que serían dos.
    const invitaciones = [
      { id: '1', estado: 'pendiente' },
      { id: '2', estado: 'caducada' },
      { id: '3', estado: 'aceptada' },
      { id: '4', estado: 'revocada' },
      { id: '5', estado: 'pendiente' }
    ]
    expect(aceptables(invitaciones).map((i) => i.id)).toEqual(['1', '5'])
  })
})
