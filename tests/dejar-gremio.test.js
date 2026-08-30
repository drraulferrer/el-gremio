import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// Dejar un gremio (6.3, la última pieza).
//
// Lo que este fichero defiende es sobre todo una cosa: que salir **no se
// parezca a borrar la cuenta**. Están uno al lado del otro en la misma
// pantalla y hacen cosas muy distintas:
//
//   · Borrar es definitivo, se lleva el gremio entero con todo el mundo
//     dentro, y por eso pide escribir el nombre.
//   · Salir retira tu personaje y lo puedes recuperar: si te vuelven a
//     invitar vuelve con su nivel, su historial y sus insignias (`R-63`).
//
// Darle a salir la misma fricción que a borrar sugeriría una gravedad que no
// tiene; dársela menor a borrar sería peligroso. Aquí se comprueba que cada
// uno conserva la suya.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const pantalla = leer('src/screens/DejarElGremio.jsx')
const datos = leer('src/screens/Datos.jsx')
const schema = leer('schema.sql')

function funcion(sql, nombre) {
  const i = sql.indexOf(`create or replace function public.${nombre}(`)
  if (i < 0) return ''
  const j = sql.indexOf('\nas $fn$', i)
  const m = /\n(?:end )?\$fn\$;/.exec(sql.slice(j))
  return sql.slice(i, j + m.index + m[0].length)
}

describe('solo aparece si hay algo que dejar', () => {
  it('quien opera con la clave compartida no lo ve', () => {
    // No «pertenece» al gremio: ES el gremio. Para esa persona la salida es
    // borrar la cuenta, que está justo debajo. Enseñarle además un «dejar el
    // gremio» que no le corresponde solo sería una forma de asustar.
    expect(pantalla).toContain('leerPertenencias()')
    expect(pantalla).toContain('mias.some((p) => p.family_id === family?.id)')
    expect(pantalla).toContain('if (!tengo) return null')
  })

  it('y mientras no se sabe, tampoco', () => {
    // `null` de partida y no `false`: así no parpadea un botón de salida
    // durante la primera pasada.
    expect(pantalla).toMatch(/useState\(null\)\s*\/\/ null = todavía no se sabe/)
  })
})

describe('salir no se parece a borrar', () => {
  it('no pide escribir el nombre del gremio', () => {
    // Eso es de borrar la cuenta, que sí es definitivo.
    expect(pantalla).not.toContain('para confirmar')
    expect(pantalla).not.toMatch(/escrito/i)
  })

  it('pero sí enseña lo que pasa antes de hacerlo', () => {
    expect(pantalla).toContain('se retira, no se borra')
    expect(pantalla).toContain('recuperas ese mismo personaje')
  })

  it('y dice lo que cuesta volver, que es lo que de verdad hay que saber', () => {
    // `R-63`: el reingreso exige invitación nueva Y llave nueva. Callarlo
    // sería vender una salida más barata de lo que es.
    expect(pantalla).toContain('una llave nueva')
  })

  it('dice que los Talis son suyos y no se tocan', () => {
    // `R-06`: la cartera es de la persona, no del gremio.
    expect(pantalla).toContain('son tuyos')
  })

  it('y que no se devuelve nada', () => {
    // Ni llaves ni Talis. Es lo que más se puede malinterpretar de una
    // salida, y decirlo después sería tarde.
    expect(pantalla).toContain('No se devuelve nada por salir')
  })

  it('borrar la cuenta conserva su fricción', () => {
    // Si alguien la quitara pensando que «ya está lo de salir», borrar el
    // gremio entero pasaría a ser un clic.
    expect(datos).toContain('para confirmar')
    expect(datos).toContain('btn-peligro')
  })
})

describe('el único caso que para de verdad', () => {
  it('quien titula en solitario no puede limitarse a salir', () => {
    // `I-12`. Y se explica entero: la salida existe, solo que pasa por otro
    // sitio. Un «no puedes» a secas dejaría a alguien atrapado sin saber qué
    // hacer.
    expect(pantalla).toContain('eres_quien_titula')
    expect(pantalla).toContain('pasa la titularidad a otra persona o cierra el gremio')
  })

  it('y la pantalla conoce todos los códigos que devuelve el servidor', () => {
    const cuerpo = funcion(schema, 'abandonar_gremio')
    expect(cuerpo.length).toBeGreaterThan(200)
    const codigos = [...cuerpo.matchAll(/return '([a-z_]+)'/g)].map((m) => m[1])
    expect(codigos.length).toBeGreaterThan(2)
    for (const c of codigos) {
      expect(pantalla, `falta la frase de '${c}'`).toContain(c)
    }
  })
})

describe('después de salir', () => {
  it('la app arranca de cero', () => {
    // Salir cambia a la vez el gremio activo, el personaje, el PIN, la zona
    // horaria y todos los datos. `elegirActivo` ya sabe caer a otro de los
    // míos cuando el guardado deja de serlo (`C-3`), así que recargar es el
    // camino que esa regla describe, no un atajo.
    expect(pantalla).toContain('window.location.reload()')
  })
})

describe('dónde está', () => {
  it('antes de borrar la cuenta, no después', () => {
    // Quien entra aquí buscando la salida suele querer irse de UN gremio, no
    // disolver la casa. Si lo primero que encuentra es el botón rojo, la
    // puerta que ve es la que no quería.
    expect(datos.indexOf('<DejarElGremio')).toBeLessThan(datos.indexOf('Borrar la cuenta'))
  })
})
