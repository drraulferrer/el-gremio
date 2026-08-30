import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ------------------------------------------------------------------
// La etiqueta visible no autoriza nada (migración 054).
//
// Tres ejes que hoy son uno solo. La CAPACIDAD es lo único que autoriza; el
// ROL INTERNO es un paquete de capacidades; el ROL VISIBLE es la etiqueta que
// lee la gente y no autoriza nada. El tercero es el que trae los accidentes:
// es comodísimo escribir `if rol = 'gestor'` en una función, y el día que un
// tipo llame «Organizador» a otra cosa, esa línea autoriza a quien no debía.
//
// Lo que defiende este fichero es sobre todo que la matriz devuelva HOY
// exactamente lo mismo que devolvían las cadenas escritas a mano. Un modelo de
// permisos que estrena permisos al nacer no es un modelo, es un incidente.
// ------------------------------------------------------------------

const raiz = new URL('../', import.meta.url)
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8')

const schema = leer('schema.sql')
const m054 = leer('migracion-054-la-etiqueta-no-autoriza.sql')

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

/**
 * La ÚLTIMA definición de una función, que es la que queda viva al aplicar
 * `schema.sql` de arriba abajo.
 *
 * Hace falta desde que la 060 reescribe `puede` y `mis_gremios`: con
 * `indexOf` se leía la copia vieja y el test pasaba comparando lo que ya no
 * manda. Es el mismo criterio que el arranque dejó escrito: «una migración
 * registra lo que hizo ese día, no la versión vigente».
 */
function ultimaFuncion(sql, nombre, delim = '$fn$') {
  let i = -1
  for (;;) {
    const k = sql.indexOf(`create or replace function public.${nombre}(`, i + 1)
    if (k < 0) break
    i = k
  }
  if (i < 0) return ''
  const j = sql.indexOf(`\nas ${delim}`, i)
  const re = new RegExp(`\\n(?:end )?\\${delim[0]}${delim.slice(1).replace(/\$/g, '\\$')};`)
  const m = re.exec(sql.slice(j))
  return sql.slice(i, j + m.index + m[0].length)
}

const m060 = leer('migracion-060-quitar-la-llave-del-felpudo.sql')

// La VIGENTE, que desde la 060 ya no es la de la 054.
const puede = soloSql(ultimaFuncion(schema, 'puede'))

/** El permiso que la matriz siembra para un rol y una capacidad. */
function permiso(rol, cap) {
  const m = new RegExp(`\\('${rol}','${cap}','(no|si|pin)'\\)`).exec(m054.replace(/\s+/g, ''))
  return m ? m[1] : null
}

describe('el permiso se resuelve donde ocurre la operación', () => {
  it('contra la pertenencia activa EN ESE gremio', () => {
    // Nunca contra el gremio activo de la sesión: en cuanto hay dos gremios son
    // cosas distintas, y confundirlas deja entrar a alguien donde no está.
    expect(puede).toContain('where p.persona = v_uid and p.family_id = p_family')
    expect(puede).toContain("p.estado = 'activa'")
  })

  it('o contra la credencial compartida DE ESE gremio', () => {
    expect(puede).toContain("c.clase = 'compartida' and c.family_id = p_family")
  })

  it('y entonces manda el rol del personaje que se opera', () => {
    // Es lo que hay hoy: en una casa manda quien sabe el PIN, y las peques no.
    expect(puede).toContain('select pr.role into v_rol')
    expect(puede).toContain('pr.family_id = p_family and pr.active')
  })

  it('quien no es nada ahí, no puede nada', () => {
    expect(puede).toMatch(/return 'no';/)
  })

  it('y lo que no está declarado tampoco', () => {
    // Una capacidad inventada después de publicar una plantilla no la gana
    // nadie por sorpresa.
    expect(puede).toContain("return coalesce(v_permiso, 'no');")
  })
})

describe('el PIN sigue siendo una puerta, y por eso hay tres respuestas', () => {
  it('la matriz distingue «sí» de «sí, pasando por el PIN»', () => {
    expect(schema).toContain("permiso text not null check (permiso in ('no','si','pin'))")
  })

  it('un adulto con la clave de la casa administra con PIN, como siempre', () => {
    for (const cap of ['CAP-01', 'CAP-05', 'CAP-09', 'CAP-10']) {
      expect(permiso('adulto', cap), `adulto/${cap}`).toBe('pin')
    }
  })
})

describe('la matriz dice hoy lo mismo que decían las cadenas a mano', () => {
  it('un adulto puede conceder recompensas y una junior o una peque no', () => {
    // Es literalmente lo que comprobaba `role = 'adulto'` en el premio a mano.
    expect(permiso('adulto', 'CAP-09')).toBe('pin')
    expect(permiso('junior', 'CAP-09')).toBe('no')
    expect(permiso('peque', 'CAP-09')).toBe('no')
    expect(permiso('mascota', 'CAP-09')).toBe('no')
  })

  it('y lo mismo para las campañas de limpieza', () => {
    expect(permiso('adulto', 'CAP-05')).toBe('pin')
    expect(permiso('junior', 'CAP-05')).toBe('no')
    expect(permiso('peque', 'CAP-05')).toBe('no')
  })

  it('las tres funciones preguntan por capacidad, no por etiqueta', () => {
    const manual = soloSql(funcion(schema, 'grant_manual_bonus'))
    const crear = soloSql(funcion(schema, 'crear_campana_limpieza'))
    const cerrar = soloSql(funcion(schema, 'cerrar_campana_limpieza'))
    expect(manual).toContain("public.puede(v_family, 'CAP-09', p_otorgado_por) = 'no'")
    expect(crear).toContain("public.puede(v_family, 'CAP-05', p_activada_por) = 'no'")
    expect(cerrar).toContain("public.puede(v_family, 'CAP-05', p_quien) = 'no'")
    // Y ya no comparan la etiqueta.
    for (const [n, f] of [['manual', manual], ['crear', crear], ['cerrar', cerrar]]) {
      expect(f, `${n} sigue comparando el rol a mano`).not.toMatch(/v_rol\w* <> 'adulto'/)
    }
  })
})

describe('forjar y usar llaves son de persona', () => {
  it('una credencial compartida no puede, mire quién la use', () => {
    // No hay a quién cargarle el gasto: los TALIS de una llave son de una
    // persona, y un personaje sin identidad no es una.
    for (const rol of ['adulto', 'junior', 'peque', 'mascota']) {
      expect(permiso(rol, 'CAP-13'), `${rol}/CAP-13`).toBe('no')
      expect(permiso(rol, 'CAP-14'), `${rol}/CAP-14`).toBe('no')
    }
  })

  it('y quien tiene pertenencia sí, sea del rol que sea', () => {
    for (const rol of ['titular', 'gestor', 'miembro']) {
      expect(permiso(rol, 'CAP-13'), `${rol}/CAP-13`).toBe('si')
    }
  })

  it('el catálogo las marca como capacidades de persona', () => {
    expect(m054).toContain("('CAP-13', 'Forjar una llave desde este gremio', true)")
    expect(m054).toContain("('CAP-14', 'Usar una llave', true)")
  })
})

describe('quién puede cerrar el gremio', () => {
  it('solo quien lo fundó, y con PIN', () => {
    expect(permiso('titular', 'CAP-15')).toBe('pin')
    expect(permiso('gestor', 'CAP-15')).toBe('no')
    expect(permiso('miembro', 'CAP-15')).toBe('no')
  })
})

describe('el reparto es de la plantilla, y una publicada no se toca', () => {
  it('va colgado de (tipo, versión)', () => {
    // Un gremio se rige por el reparto con el que nació, igual que por el resto
    // de su plantilla.
    expect(schema).toContain(
      'foreign key (tipo, version) references public.plantillas_tipo(tipo, version) on delete restrict'
    )
  })

  it('y está sellado, como la plantilla', () => {
    expect(schema).toMatch(
      /create trigger plantilla_capacidades_sellada\s+before update or delete on public\.plantilla_capacidades/
    )
  })
})

describe('las dos copias del esquema', () => {
  it('`puede` y las tres reescritas son idénticas en la migración y en el esquema', () => {
    // `puede` la reescribió la 060 para que una credencial retirada no
    // autorice nada, así que la copia viva se compara contra ESA. La de la
    // 054 sigue en el fichero y se comprueba contra la primera del esquema:
    // las dos tienen que seguir siendo fieles a su día.
    expect(funcion(m054, 'puede')).toBe(funcion(schema, 'puede'))
    expect(ultimaFuncion(m060, 'puede')).toBe(ultimaFuncion(schema, 'puede'))
    for (const n of ['grant_manual_bonus', 'crear_campana_limpieza', 'cerrar_campana_limpieza']) {
      expect(funcion(m054, n), `${n} difiere entre la 054 y schema.sql`).toBe(funcion(schema, n))
    }
  })
})
