import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { textoDeTipo, rasgoDeTipo } from '../src/lib/plantilla'

// ------------------------------------------------------------------
// El tipo de gremio deja de ser un `if` repetido (migración 053).
//
// El tipo ya existía y ya cambiaba el comportamiento, pero escrito como
// `tipo_gremio === 'piso'` a mano donde hiciera falta. Con dos tipos y dos
// efectos se aguanta; con los tres que vienen y siete ejes de efecto son
// decenas de `if` en sitios que nadie recuerda. El mismo problema que la 050
// resolvió con los números de la expansión.
//
// Lo que defiende este fichero es sobre todo la línea que separa las dos
// cosas: la plantilla decide **cómo nace** un gremio; lo que el grupo edita
// después es suyo, y ninguna plantilla mejorada puede pisarlo.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m053 = leer('migracion-053-el-tipo-deja-de-ser-un-if.sql')

describe('una plantilla publicada es historia', () => {
  it('no se edita ni se borra: se publica otra versión', () => {
    expect(schema).toMatch(
      /create trigger plantillas_tipo_sellada\s+before update or delete on public\.plantillas_tipo/
    )
    expect(schema).toContain('una plantilla de tipo no se edita ni se borra')
  })

  it('y cada gremio guarda la versión con la que nació', () => {
    // Es lo que impide que una plantilla mejorada reescriba gremios que ya
    // existen: estaría pisando decisiones que ya no son suyas.
    expect(schema).toContain('plantilla_version text')
    expect(schema).toContain('un gremio conserva la version de plantilla con la que nacio')
  })

  it('el tipo es inmutable, y ahora por decisión y no de casualidad', () => {
    // Hasta hoy lo era «de hecho»: no había pantalla que lo tocara. Eso no es
    // una garantía, es una ausencia.
    expect(schema).toContain('el tipo de un gremio no se cambia (TIP-2)')
    expect(schema).toMatch(
      /create trigger families_tipo_inmutable\s+before update on public\.families/
    )
    // El tipo viejo también, que es el que de verdad lee el cliente.
    expect(schema).toContain('new.tipo_gremio is distinct from old.tipo_gremio')
  })
})

describe('los cuatro tipos, y cuál se ofrece', () => {
  it('están los cuatro nombres de la especificación', () => {
    for (const t of ['hogar', 'hogar_compartido', 'amigos', 'equipo']) {
      expect(m053, `falta la plantilla de ${t}`).toContain(`('${t}', '2026-08-30.1'`)
    }
  })

  it('solo Hogar se ofrece al crear', () => {
    // El legado no se ofrece —son los `piso` que ya existen y siguen igual—;
    // Amigos espera a que su catálogo se valide con un grupo real, porque un
    // tipo que nace vacío es peor que un tipo que no está; y Equipo espera a
    // su revisión jurídica.
    const ofrecidos = [...m053.matchAll(/\('(\w+)', '2026-08-30\.1', '[^']+', (true|false)/g)]
      .filter((m) => m[2] === 'true').map((m) => m[1])
    expect(ofrecidos).toEqual(['hogar'])
  })

  it('y quién puede ofrecerse lo decide el servidor', () => {
    // Un cliente que pinte un tipo de más no consigue nada: quien crea el
    // gremio mira esto.
    expect(schema).toContain('create or replace function public.tipos_ofrecidos()')
    expect(schema).toContain('where t.se_ofrece')
  })
})

describe('Equipo no puede ser la vía barata de forjar llaves', () => {
  it('nace con el progreso individual apagado y la expansión prohibida', () => {
    // Si el progreso de un equipo contara y se pudiera forjar desde ahí, un
    // gremio de trabajo sería la forma más barata de subir de nivel y ganar
    // monedas para gastarlas fuera. Los dos interruptores van en columnas
    // propias y no dentro de un `jsonb` precisamente por eso.
    const equipo = m053.slice(m053.indexOf("('equipo', '2026-08-30.1'"))
    expect(equipo).toMatch(/false, false,/)
    expect(schema).toContain('progreso_individual boolean not null default true')
    expect(schema).toContain('expansion_desde_tipo boolean not null default true')
  })
})

describe('ningún gremio existente cambia de nada', () => {
  it("'familia' pasa a 'hogar' y 'piso' a 'hogar_compartido', y ahí se acaba", () => {
    expect(m053).toContain("case tipo_gremio when 'piso' then 'hogar_compartido' else 'hogar' end")
  })

  it('y `tipo_gremio` no se retira: es lo que lee el cliente viejo', () => {
    expect(schema).toContain("tipo_gremio text not null default 'familia'")
  })

  it('los textos sembrados son EXACTAMENTE los que ya había', () => {
    // El criterio de esta migración: ningún gremio cambia de nada, solo cambia
    // de dónde sale el texto. Si el texto de la plantilla no es el que estaba
    // escrito a mano, alguien ha cambiado el producto sin querer.
    const casa = leer('src/screens/Casa.jsx')
    for (const t of [
      'Este gremio es de compañeros de piso: cada habitación tiene su dueño, y las campañas se la sugieren a esa persona.',
      'El mapa del modo limpieza: de estas zonas salen las campañas de zona y de limpieza profunda.'
    ]) {
      expect(m053, 'la plantilla no dice lo que decía el cliente').toContain(t)
      expect(casa, 'el respaldo sin plantilla ya no dice lo que decía').toContain(t)
    }
  })
})

describe('cero condicionales por tipo fuera de la plantilla', () => {
  it('solo dos ficheros comparan el tipo, y los dos como respaldo', () => {
    // Es el punto de la definición de hecho de la fase. Las dos apariciones que
    // quedan son el valor por defecto que se le pasa a `textoDeTipo` y a
    // `rasgoDeTipo`: lo que hacía el código antes, para que sin plantilla no
    // cambie nada. Un tercer fichero que compare el tipo hace caer este test.
    //
    // `fakeBackend.js` queda fuera porque no es cliente: es el espejo de
    // `tg_plantilla_de_gremio_nuevo`, que es justamente EL sitio del servidor
    // donde esa comparación tiene que estar. Que la haga es lo correcto; que
    // la hiciera distinta es lo que hay que impedir, y de eso va la
    // comprobación de abajo.
    const ficheros = []
    for (const dir of ['src/lib', 'src/screens', 'src/components']) {
      for (const f of readdirSync(new URL(dir + '/', raiz))) {
        if (!/\.jsx?$/.test(f) || f === 'fakeBackend.js') continue
        // Sin comentarios: `plantilla.js` explica en su cabecera el patrón que
        // viene a sustituir, y eso es prosa, no un condicional.
        const t = leer(`${dir}/${f}`)
          .split('\n')
          .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
          .join('\n')
        if (/tipo_gremio\s*[!=]==/.test(t)) ficheros.push(`${dir}/${f}`)
      }
    }
    expect(ficheros.sort()).toEqual(['src/screens/Casa.jsx', 'src/screens/DarGracias.jsx'])

    for (const f of ficheros) {
      expect(leer(f), `${f} compara el tipo sin pasar por la plantilla`)
        .toMatch(/from '\.\.\/lib\/plantilla'/)
    }
  })

  it('y el espejo de la demo traduce el tipo igual que el disparador', () => {
    // Misma expresión, palabra por palabra: si el disparador cambiara de
    // criterio y la demo no, un gremio nacería con una plantilla aquí y con
    // otra en casa de alguien, que es la clase de desacuerdo que no se ve
    // hasta que ya está publicado.
    expect(m053).toContain("case new.tipo_gremio when 'piso' then 'hogar_compartido' else 'hogar' end")
    expect(leer('src/lib/fakeBackend.js'))
      .toContain("nueva.tipo_gremio === 'piso' ? 'hogar_compartido' : 'hogar'")
  })

  it('y la app trae la plantilla en el bloque que degrada solo', () => {
    const app = leer('src/App.jsx')
    expect(app).toContain("supabase.rpc('plantilla_de_gremio')")
    expect(app).toContain('plantilla: (pt?.data || [])')
  })
})

describe('sin plantilla, nada cambia', () => {
  it('los dos ayudantes caen al valor de antes', () => {
    expect(textoDeTipo(null, 'zonas_intro', 'lo de siempre')).toBe('lo de siempre')
    expect(textoDeTipo({ vocabulario: {} }, 'zonas_intro', 'lo de siempre')).toBe('lo de siempre')
    expect(textoDeTipo({ vocabulario: { zonas_intro: 'lo nuevo' } }, 'zonas_intro', 'x')).toBe('lo nuevo')

    expect(rasgoDeTipo(null, 'encargos', true)).toBe(true)
    expect(rasgoDeTipo({ funciones: {} }, 'encargos', true)).toBe(true)
    expect(rasgoDeTipo({ funciones: { encargos: false } }, 'encargos', true)).toBe(false)
  })

  it('y un texto vacío no cuenta como texto', () => {
    // Una plantilla con la clave puesta a '' dejaría la pantalla muda. Vale
    // más el respaldo que un hueco.
    expect(textoDeTipo({ vocabulario: { zonas_intro: '' } }, 'zonas_intro', 'lo de siempre'))
      .toBe('lo de siempre')
  })
})

describe('las dos copias del esquema', () => {
  it('las cuatro funciones son idénticas en la migración y en el esquema', () => {
    const fn = (sql, n) => {
      const i = sql.indexOf(`create or replace function public.${n}(`)
      if (i < 0) return ''
      const j = sql.indexOf('\nas $fn$', i)
      const m = /\n(?:end )?\$fn\$;/.exec(sql.slice(j))
      return sql.slice(i, j + m.index + m[0].length)
    }
    for (const n of ['tg_plantilla_sellada', 'tg_tipo_inmutable',
                     'plantilla_de_gremio', 'tipos_ofrecidos', 'tg_plantilla_de_gremio_nuevo']) {
      expect(fn(m053, n), `${n} difiere entre la 053 y schema.sql`).toBe(fn(schema, n))
    }
  })
})
