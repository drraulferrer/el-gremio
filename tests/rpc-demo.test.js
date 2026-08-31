import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { crearClienteDemo } from '../src/lib/fakeBackend'
import { RPC_DE_GREMIOS } from '../src/lib/fakeRpc'
import { xpDeNivel, nivelDeXp } from '../src/lib/fakeCatalogo'
import { xpForLevel, levelFromXp } from '../src/lib/supabase'

// ------------------------------------------------------------------
// La capa de RPC de la demo.
//
// Hasta esta tanda el backend simulado no conocía ninguna función de las
// fases 5 a 7, así que ninguna de sus pantallas se podía ver funcionando:
// todas las verificaciones de esas fases fueron «el caso negativo en
// pantalla, el positivo por tests». Este fichero defiende que eso ya no
// pasa, y sobre todo defiende lo que hace peligroso arreglarlo:
//
//   1 · QUE NO FALTE NINGUNA. El fallo caro de este fichero ya ocurrió una
//       vez con `grant_manual_bonus`: la demo contestaba «función
//       desconocida» y en producción funcionaba, o sea que se probaba en el
//       único sitio donde el bug no existía.
//
//   2 · QUE NO SEA MÁS PERMISIVA QUE LA BASE. Un código de respuesta que
//       aquí existe y allí no —o al revés— convierte la demo en un sitio
//       donde se prueba otra aplicación.
//
//   3 · QUE LAS REGLAS SEAN LAS DE VERDAD: el nivel desde la marca de agua,
//       el límite antes de cobrar, la primera pertenencia sin llave, el
//       mismo código para «no existe» y «no se puede».
// ------------------------------------------------------------------

const RAIZ = new URL('..', import.meta.url).pathname
const leer = (f) => readFileSync(join(RAIZ, f), 'utf8')
const schema = leer('schema.sql')

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

function ficheros(dir) {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n)
    if (statSync(ruta).isDirectory()) return ficheros(ruta)
    return /\.(js|jsx)$/.test(n) ? [ruta] : []
  })
}

// ------------------------------------------------------------------
// 1 · Ninguna se queda sin respuesta
// ------------------------------------------------------------------

describe('la demo contesta a todas las funciones que la app llama', () => {
  const llamadas = new Set()
  for (const ruta of ficheros(join(RAIZ, 'src'))) {
    if (/fake(Backend|Rpc)\.js$/.test(ruta)) continue
    for (const m of leer(ruta.replace(RAIZ, '')).matchAll(/\.rpc\(\s*'([a-z_]+)'/g)) {
      llamadas.add(m[1])
    }
  }

  // Las de la economía siguen donde estaban; las de identidad y expansión
  // se declaran en `RPC_DE_GREMIOS`.
  const deSiempre = new Set(
    [...leer('src/lib/fakeBackend.js').matchAll(/nombre === '([a-z_]+)'/g)].map((m) => m[1])
  )
  const atendidas = new Set([...deSiempre, ...RPC_DE_GREMIOS])

  it('la app llama a las que llama, y son unas cuantas', () => {
    // Un número escrito no defiende nada; que el barrido encuentre algo, sí.
    expect(llamadas.size).toBeGreaterThan(30)
  })

  it('y no hay ni una sin atender', () => {
    const huerfanas = [...llamadas].filter((n) => !atendidas.has(n)).sort()
    expect(huerfanas, 'la demo diría «función desconocida» donde producción funciona')
      .toEqual([])
  })

  it('y ninguna de las que atiende se ha quedado sin usarse', () => {
    // La otra dirección: código muerto en el sitio donde menos se mira.
    // `completar_conversion` es la excepción declarada: la app todavía no la
    // llama —ese es el hueco de la vuelta del enlace— y la demo la necesita
    // para poder crear una identidad sin correo.
    const sobrantes = RPC_DE_GREMIOS
      .filter((n) => !llamadas.has(n) && n !== 'completar_conversion')
      .sort()
    expect(sobrantes).toEqual([])
  })
})

// ------------------------------------------------------------------
// 2 · Los mismos códigos que la base
// ------------------------------------------------------------------

describe('los códigos de respuesta son los de la función de verdad', () => {
  // El fallo que esto impide es de una letra: si la demo contesta
  // `sin_pertenencias` y la base `sin_pertenencia`, el mensaje que ve la
  // persona se decide en `src/lib/expansion.js` por comparación de cadenas
  // y sale el genérico. Se prueba en demo, se ve bien, y en casa no.
  const PARES = [
    ['forjarLlave', 'forjar_llave', 'fakeExpansion'],
    ['solicitarConversion', 'solicitar_conversion', 'fakeExpansion'],
    ['completarConversion', 'completar_conversion', 'fakeExpansion'],
    ['crearGremioConLlave', 'crear_gremio_con_llave', 'fakeRpc'],
    ['invitar', 'invitar', 'fakeRpc'],
    ['rechazarInvitacion', 'rechazar_invitacion', 'fakeRpc'],
    ['revocarInvitacion', 'revocar_invitacion', 'fakeRpc'],
    ['aceptarInvitacion', 'aceptar_invitacion', 'fakeRpc'],
    ['abandonarGremio', 'abandonar_gremio', 'fakeRpc'],
    ['expulsarDeGremio', 'expulsar_de_gremio', 'fakeRpc'],
    ['solicitarReclamacion', 'solicitar_reclamacion', 'fakeRpc'],
    ['aprobarReclamacion', 'aprobar_reclamacion', 'fakeRpc'],
    ['rechazarReclamacion', 'rechazar_reclamacion', 'fakeRpc'],
    ['desactivarCredencial', 'desactivar_credencial_compartida', 'fakeRpc'],
    ['crearCredencial', 'crear_credencial_compartida', 'fakeRpc']
  ]

  /**
   * El cuerpo de una función de JavaScript, contando llaves.
   *
   * Se salta primero la lista de parámetros contando paréntesis: varias de
   * estas funciones desestructuran los argumentos, y empezar a contar en la
   * primera llave daría por cuerpo el propio patrón de desestructuración.
   */
  function cuerpoJs(texto, nombre) {
    const i = texto.indexOf(`function ${nombre}(`)
    if (i < 0) return ''
    let k = texto.indexOf('(', i)
    let parens = 0
    for (; k < texto.length; k++) {
      if (texto[k] === '(') parens++
      else if (texto[k] === ')' && --parens === 0) break
    }
    let nivel = 0
    for (let j = texto.indexOf('{', k); j < texto.length; j++) {
      if (texto[j] === '{') nivel++
      else if (texto[j] === '}' && --nivel === 0) return texto.slice(i, j + 1)
    }
    return texto.slice(i)
  }

  for (const [enJs, enSql, fichero] of PARES) {
    it(`${enSql} no inventa ni un código`, () => {
      const cuerpo = cuerpoJs(leer(`src/lib/${fichero}.js`), enJs)
      expect(cuerpo, `no se encuentra ${enJs} en ${fichero}.js`).not.toBe('')

      const sql = soloSql(funcion(schema, enSql))
      expect(sql, `no se encuentra ${enSql} en schema.sql`).not.toBe('')

      const codigos = [
        ...cuerpo.matchAll(/(?:codigo|resultado):\s*'([a-z_]+)'/g)
      ].map((m) => m[1])
      expect(codigos.length, 'no devuelve ningún código').toBeGreaterThan(0)

      const inventados = [...new Set(codigos)]
        .filter((c) => !new RegExp(`'${c}'`).test(sql))
        .sort()
      expect(inventados, `${enSql} contesta en demo lo que la base no contesta`).toEqual([])
    })
  }

  it('y `bloqueada:` conserva el motivo, que es lo que pide `E-11.6`', () => {
    // Un «no se puede» a secas deja a alguien atascado. El motivo viaja
    // pegado al código, y hay un test en la app que comprueba que no cae en
    // el mensaje genérico: si la demo lo perdiera, ese camino no se podría
    // probar aquí.
    const cuerpo = leer('src/lib/fakeRpc.js')
    expect(cuerpo).toContain("'bloqueada:' + inv.motivos[0]")
    expect(soloSql(funcion(schema, 'desactivar_credencial_compartida')))
      .toContain("'bloqueada:'")
  })
})

// ------------------------------------------------------------------
// 3 · Y las fórmulas de nivel, que están copiadas tres veces
// ------------------------------------------------------------------

describe('las tres copias de la escala de nivel dicen lo mismo', () => {
  it('la del catálogo de la demo y la del cliente', () => {
    // `schema.sql` ya compara la suya contra el cliente en llave.test.js.
    // Esta es la tercera copia, y la que nadie miraría.
    for (let n = 1; n <= 20; n++) expect(xpDeNivel(n)).toBe(xpForLevel(n))
    // Y los valores exactos de un hito, que es donde una fórmula cerrada
    // con coma flotante devuelve el nivel anterior: el único sitio donde
    // esta función decide algo.
    for (const xp of [0, 1, 99, 100, 299, 300, 1499, 1500, 4200, 99999]) {
      expect(nivelDeXp(xp), `la demo no coincide con el cliente en ${xp} XP`).toBe(levelFromXp(xp))
    }
  })
})

// ------------------------------------------------------------------
// 4 · El comportamiento, contra la demo de verdad
// ------------------------------------------------------------------

describe('la demo se comporta como la base', () => {
  // El backend simulado persiste en localStorage, que en Node no existe.
  // Un doble en memoria basta: lo que se prueba es qué acepta y qué
  // rechaza, no dónde lo guarda. Mismo patrón que limpieza.test.
  let demo
  beforeEach(() => {
    const memoria = new Map()
    globalThis.localStorage = {
      getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
      setItem: (k, v) => memoria.set(k, String(v)),
      removeItem: (k) => memoria.delete(k)
    }
    demo = crearClienteDemo()
  })

  const almacen = () => JSON.parse(localStorage.getItem('gremio_demo_db') || '{}')
  const guardar = (db) => localStorage.setItem('gremio_demo_db', JSON.stringify(db))
  const parchear = (fn) => { const db = almacen(); fn(db); guardar(db) }

  /** Un gremio recién fundado, como lo deja el alta: con clave de casa. */
  async function fundar({ correo = 'casa@ejemplo.test', nombre = 'Prueba' } = {}) {
    const { data } = await demo.auth.signInWithPassword({ email: correo, password: 'x' })
    const { data: fam } = await demo
      .from('families')
      .insert({ owner: data.session.user.id, name: nombre, parent_pin_hash: 'pinpinpin' })
      .select()
      .single()
    const { data: perfiles } = await demo
      .from('profiles')
      .insert([
        { family_id: fam.id, name: 'Adulta', role: 'adulto', coins: 300 },
        { family_id: fam.id, name: 'Peque', role: 'peque' }
      ])
      .select()
    return { uid: data.session.user.id, fam, adulto: perfiles[0], peque: perfiles[1] }
  }

  /** Y la identidad propia de ese adulto, por el camino de la conversión. */
  async function identidad({ adulto, correo = 'mia@ejemplo.test' }) {
    const { data: pedida } = await demo.rpc('solicitar_conversion', {
      p_profile: adulto.id, p_correo: correo, p_pin_hash: 'pinpinpin'
    })
    expect(pedida).toBe('ok')
    await demo.auth.signUp({ email: correo, password: 'una-buena' })
    await demo.auth.signOut()
    const { data } = await demo.auth.signInWithPassword({ email: correo, password: 'una-buena' })
    return data.session.user.id
  }

  // ----------------------------------------------------------------
  describe('la identidad', () => {
    it('quien funda entra con la clave de casa, y esa clave no forja', async () => {
      const { fam } = await fundar()
      const { data: clase } = await demo.rpc('clase_credencial')
      expect(clase).toBe('compartida')

      const { data } = await demo.rpc('forjar_llave', { p_family: fam.id, p_orden: 1 })
      expect(data).toBe('exige_identidad_personal')
    })

    it('el PIN no es un adorno: sin él la conversión no empieza', async () => {
      const { adulto } = await fundar()
      const { data } = await demo.rpc('solicitar_conversion', {
        p_profile: adulto.id, p_correo: 'mia@ejemplo.test', p_pin_hash: 'otra-cosa'
      })
      expect(data).toBe('pin_incorrecto')
    })

    it('el correo de la casa se dice por su nombre, no como «ya existe»', async () => {
      const { adulto } = await fundar({ correo: 'casa@ejemplo.test' })
      const { data } = await demo.rpc('solicitar_conversion', {
        p_profile: adulto.id, p_correo: 'casa@ejemplo.test', p_pin_hash: 'pinpinpin'
      })
      expect(data).toBe('correo_es_la_clave_de_casa')
    })

    it('una peque no se convierte, y una junior tiene su propio motivo', async () => {
      const { fam, peque } = await fundar()
      const { data: dePeque } = await demo.rpc('solicitar_conversion', {
        p_profile: peque.id, p_correo: 'p@ejemplo.test', p_pin_hash: 'pinpinpin'
      })
      expect(dePeque).toBe('solo_adulto')

      const { data: junior } = await demo
        .from('profiles').insert({ family_id: fam.id, name: 'Junior', role: 'junior' }).select().single()
      const { data: deJunior } = await demo.rpc('solicitar_conversion', {
        p_profile: junior.id, p_correo: 'j@ejemplo.test', p_pin_hash: 'pinpinpin'
      })
      expect(deJunior).toBe('junior_bloqueado')
    })

    it('y al completarla el saldo se muda a la cartera, con sus dos asientos', async () => {
      const { adulto } = await fundar()
      const persona = await identidad({ adulto })

      const { data: clase } = await demo.rpc('clase_credencial')
      expect(clase).toBe('personal')

      const db = almacen()
      expect(db.carteras.find((c) => c.persona === persona).saldo).toBe(300)
      expect(db.profiles.find((p) => p.id === adulto.id).coins).toBe(0)
      // Una transferencia entre dos monederos son DOS apuntes.
      const asientos = db.movimientos_coins.filter((m) => m.tipo === 'conversion')
      expect(asientos.map((m) => m.importe).sort((a, b) => a - b)).toEqual([-300, 300])
      // Y la pertenencia: gestor, no titular.
      expect(db.pertenencias.find((p) => p.persona === persona).rol).toBe('gestor')
    })

    it('el personaje conserva su progreso: convertirse no reinicia nada', async () => {
      const { adulto } = await fundar()
      parchear((db) => {
        db.profiles = db.profiles.map((p) => (p.id === adulto.id ? { ...p, xp: 900, xp_maxima: 1200 } : p))
      })
      await identidad({ adulto })
      const p = almacen().profiles.find((x) => x.id === adulto.id)
      expect([p.xp, p.xp_maxima]).toEqual([900, 1200])
    })
  })

  // ----------------------------------------------------------------
  describe('la forja', () => {
    /** Un gremio con identidad, el nivel pedido y el saldo que se diga. */
    async function conNivel(nivel, saldo) {
      const { fam, adulto } = await fundar()
      parchear((db) => {
        db.profiles = db.profiles.map((p) =>
          p.id === adulto.id ? { ...p, xp: 0, xp_maxima: xpDeNivel(nivel), coins: saldo } : p
        )
      })
      const persona = await identidad({ adulto })
      return { fam, adulto, persona }
    }

    it('el nivel sale de la marca de agua, no de la XP de hoy', async () => {
      // Se pone la marca en el nivel 6 y la XP a cero: si mirara `xp`, la
      // pantalla diría que faltan 1500 y el botón no saldría.
      const { fam } = await conNivel(6, 300)
      const { data } = await demo.rpc('oportunidades_expansion', { p_family: fam.id })
      expect(data[0].nivel_actual).toBe(6)
      expect(data[0].estado).toBe('puedes')
    })

    it('con nivel de sobra pero sin monedas, dice qué falta y cuánto', async () => {
      const { fam } = await conNivel(6, 40)
      const { data } = await demo.rpc('oportunidades_expansion', { p_family: fam.id })
      expect(data[0].estado).toBe('falta_monedas')
      expect(data[0].falta_monedas).toBe(260)
    })

    it('sin nivel, lo que falta es XP y el escalón no se puede comprar', async () => {
      const { fam } = await conNivel(1, 5000)
      const { data } = await demo.rpc('oportunidades_expansion', { p_family: fam.id })
      expect(data[0].estado).toBe('falta_nivel')
      expect(data[0].falta_xp).toBe(xpDeNivel(6))
    })

    it('forjar cobra una vez, deja la llave disponible y su asiento', async () => {
      const { fam, persona } = await conNivel(6, 300)
      const { data } = await demo.rpc('forjar_llave', { p_family: fam.id, p_orden: 1 })
      expect(data).toBe('ok')

      const db = almacen()
      expect(db.carteras.find((c) => c.persona === persona).saldo).toBe(0)
      const llaves = db.derechos_expansion
      expect(llaves).toHaveLength(1)
      expect(llaves[0]).toMatchObject({ estado: 'disponible', orden: 1, coste: 300, origen: fam.id })
      // El origen se guarda con su NOMBRE, no solo con su id: una llave
      // tiene que seguir contando de dónde salió aunque el gremio se cierre.
      expect(llaves[0].origen_nombre).toBe('Prueba')
      expect(db.movimientos_coins.some((m) => m.tipo === 'forja_llave' && m.importe === -300)).toBe(true)
    })

    it('el mismo escalón no se compra dos veces', async () => {
      const { fam } = await conNivel(6, 5000)
      await demo.rpc('forjar_llave', { p_family: fam.id, p_orden: 1 })
      const { data } = await demo.rpc('forjar_llave', { p_family: fam.id, p_orden: 1 })
      expect(data).toBe('ya_forjado')
      expect(almacen().derechos_expansion).toHaveLength(1)
    })

    it('sin monedas no se cobra, pero queda escrito el intento', async () => {
      const { fam, persona } = await conNivel(6, 40)
      const { data } = await demo.rpc('forjar_llave', { p_family: fam.id, p_orden: 1 })
      expect(data).toBe('sin_monedas')

      const db = almacen()
      expect(db.derechos_expansion).toHaveLength(0)
      expect(db.carteras.find((c) => c.persona === persona).saldo).toBe(40)
      const fallido = db.movimientos_coins.find((m) => m.resultado === 'sin_monedas')
      expect([fallido.saldo_antes, fallido.saldo_despues]).toEqual([40, 40])
    })

    it('un doble clic con la misma clave no paga dos llaves', async () => {
      const { fam } = await conNivel(6, 5000)
      const clave = 'forja-1234-abcd'
      const uno = await demo.rpc('forjar_llave', { p_family: fam.id, p_orden: 1, p_clave: clave })
      const dos = await demo.rpc('forjar_llave', { p_family: fam.id, p_orden: 1, p_clave: clave })
      expect([uno.data, dos.data]).toEqual(['ok', 'ok'])
      expect(almacen().derechos_expansion).toHaveLength(1)
      expect(almacen().carteras[0].saldo).toBe(4700)
    })

    it('un gremio de Equipo no origina llaves, y lo decide la plantilla', async () => {
      const { fam } = await conNivel(6, 5000)
      // Un Equipo hoy no se puede crear, así que se fuerza el tipo: lo que
      // se prueba es que quien lo mira es `expansion_desde_tipo` y no un
      // `if` por nombre de tipo.
      parchear((db) => {
        db.families = db.families.map((f) =>
          f.id === fam.id ? { ...f, tipo_plantilla: 'equipo' } : f)
      })
      const { data: opts } = await demo.rpc('oportunidades_expansion', { p_family: fam.id })
      expect(opts[0].estado).toBe('tipo_no_forja')
      const { data } = await demo.rpc('forjar_llave', { p_family: fam.id, p_orden: 1 })
      expect(data).toBe('tipo_no_forja')
    })
  })

  // ----------------------------------------------------------------
  describe('gastar la llave', () => {
    async function conLlave() {
      const { fam, adulto } = await fundar()
      parchear((db) => {
        db.profiles = db.profiles.map((p) =>
          p.id === adulto.id ? { ...p, xp_maxima: xpDeNivel(6), coins: 300 } : p)
      })
      const persona = await identidad({ adulto })
      await demo.rpc('forjar_llave', { p_family: fam.id, p_orden: 1 })
      return { fam, persona, llave: almacen().derechos_expansion[0] }
    }

    const nuevoGremio = (llave, extra = {}) => ({
      p_llave: llave.id, p_nombre: 'El segundo', p_tipo: 'hogar', p_pais: 'ES',
      p_pin_hash: 'otropinlargo', p_personaje: 'Yo allí', ...extra
    })

    it('crear un gremio no cuesta nada más, y la llave se gasta', async () => {
      const { llave, persona } = await conLlave()
      const { data } = await demo.rpc('crear_gremio_con_llave', nuevoGremio(llave))
      expect(data[0].resultado).toBe('ok')

      const db = almacen()
      expect(db.carteras.find((c) => c.persona === persona).saldo).toBe(0)
      expect(db.derechos_expansion[0]).toMatchObject({
        estado: 'consumido', destino: data[0].family_id, destino_nombre: 'El segundo'
      })
      // Y el personaje nace a cero: del gremio de origen no se copia nada.
      const alli = db.profiles.find((p) => p.family_id === data[0].family_id)
      expect([alli.name, alli.xp, alli.coins]).toEqual(['Yo allí', 0, 0])
      expect(db.pertenencias.find((p) => p.family_id === data[0].family_id).rol).toBe('titular')
    })

    it('un tipo que no se ofrece no se crea, aunque exista', async () => {
      const { llave } = await conLlave()
      const { data } = await demo.rpc('crear_gremio_con_llave', nuevoGremio(llave, { p_tipo: 'equipo' }))
      expect(data[0].resultado).toBe('tipo_no_ofrecido')
      expect(almacen().derechos_expansion[0].estado).toBe('disponible')
    })

    it('y un país donde no está publicado tampoco', async () => {
      const { llave } = await conLlave()
      const { data } = await demo.rpc('crear_gremio_con_llave', nuevoGremio(llave, { p_pais: 'FR' }))
      expect(data[0].resultado).toBe('tipo_no_publicado_ahi')
    })

    it('una llave ya gastada no abre un segundo gremio', async () => {
      const { llave } = await conLlave()
      await demo.rpc('crear_gremio_con_llave', nuevoGremio(llave))
      const { data } = await demo.rpc('crear_gremio_con_llave', nuevoGremio(llave, { p_nombre: 'El tercero' }))
      expect(data[0].resultado).toBe('llave_no_disponible')
      expect(almacen().families).toHaveLength(2)
    })

    it('con dos gremios, el selector los ve los dos y con su nivel', async () => {
      const { llave } = await conLlave()
      await demo.rpc('crear_gremio_con_llave', nuevoGremio(llave))
      const { data } = await demo.rpc('mis_pertenencias')
      expect(data).toHaveLength(2)
      expect(data.map((p) => p.gremio)).toEqual(['Prueba', 'El segundo'])
      expect(data[0].nivel).toBe(6)
      expect(data[1].nivel).toBe(1)
      expect(data[1].tipo_visible).toBe('Hogar')
    })
  })

  // ----------------------------------------------------------------
  describe('invitar, entrar y salir', () => {
    async function gremioConPersona() {
      const { fam, adulto } = await fundar()
      const persona = await identidad({ adulto })
      return { fam, adulto, persona }
    }

    it('invitar exige la capacidad, y el correo tiene que parecerlo', async () => {
      const { fam } = await gremioConPersona()
      const { data: malo } = await demo.rpc('invitar', { p_family: fam.id, p_correo: 'sin-arroba' })
      expect(malo).toBe('correo_invalido')

      const { data } = await demo.rpc('invitar', { p_family: fam.id, p_correo: 'Otra@Ejemplo.test' })
      expect(data).toBe('ok')
      // En minúsculas siempre: es lo que se compara al aceptarla.
      expect(almacen().invitaciones[0].correo).toBe('otra@ejemplo.test')
    })

    it('el mismo gremio no invita dos veces al mismo correo a la vez', async () => {
      const { fam } = await gremioConPersona()
      await demo.rpc('invitar', { p_family: fam.id, p_correo: 'otra@ejemplo.test' })
      const { data } = await demo.rpc('invitar', { p_family: fam.id, p_correo: 'otra@ejemplo.test' })
      expect(data).toBe('ya_invitada')
    })

    it('la bandeja es de la persona y dice a qué clase de sitio la llaman', async () => {
      const { fam } = await gremioConPersona()
      await demo.rpc('invitar', { p_family: fam.id, p_correo: 'otra@ejemplo.test' })

      await demo.auth.signOut()
      await demo.auth.signInWithPassword({ email: 'otra@ejemplo.test', password: 'x' })
      const { data } = await demo.rpc('mis_invitaciones')
      expect(data).toHaveLength(1)
      expect(data[0]).toMatchObject({ gremio: 'Prueba', tipo_visible: 'Hogar', estado: 'pendiente' })
    })

    it('una invitación vencida se lee caducada, y usarla es lo que la cierra', async () => {
      const { fam } = await gremioConPersona()
      await demo.rpc('invitar', { p_family: fam.id, p_correo: 'otra@ejemplo.test' })
      parchear((db) => {
        db.invitaciones = db.invitaciones.map((i) => ({ ...i, caduca_at: '2020-01-01T00:00:00.000Z' }))
      })

      await demo.auth.signOut()
      await demo.auth.signInWithPassword({ email: 'otra@ejemplo.test', password: 'x' })
      const { data: bandeja } = await demo.rpc('mis_invitaciones')
      expect(bandeja[0].estado).toBe('caducada')
      // La fila sigue diciendo 'pendiente' hasta que alguien la usa.
      expect(almacen().invitaciones[0].estado).toBe('pendiente')

      personal('otra@ejemplo.test')
      const { data } = await demo.rpc('aceptar_invitacion', { p_invitacion: bandeja[0].id })
      expect(data[0].resultado).toBe('caducada')
      expect(almacen().invitaciones[0].estado).toBe('caducada')
    })

    /** Le da identidad personal a una cuenta, que es lo que exige entrar. */
    function personal(correo) {
      parchear((db) => {
        const u = db.usuarios.find((x) => x.email === correo)
        db.credenciales = [
          ...db.credenciales.filter((c) => c.user_id !== u.id),
          { user_id: u.id, clase: 'personal', family_id: null, activa: true, created_at: '2026-01-01T00:00:00.000Z' }
        ]
      })
    }

    it('la primera pertenencia no cuesta llave; la segunda sí', async () => {
      const { fam } = await gremioConPersona()
      await demo.rpc('invitar', { p_family: fam.id, p_correo: 'otra@ejemplo.test' })

      await demo.auth.signOut()
      await demo.auth.signInWithPassword({ email: 'otra@ejemplo.test', password: 'x' })
      personal('otra@ejemplo.test')

      const { data: bandeja } = await demo.rpc('mis_invitaciones')
      const { data } = await demo.rpc('aceptar_invitacion', {
        p_invitacion: bandeja[0].id, p_personaje: 'La nueva'
      })
      expect(data[0]).toMatchObject({ resultado: 'ok', family_id: fam.id })
      expect(almacen().pertenencias.find((p) => p.origen === 'invitacion').rol).toBe('miembro')

      // Y un segundo gremio, ya con una pertenencia encima, pide llave.
      const dos = almacen()
      const otra = dos.families[0]
      parchear((db) => {
        db.families = [...db.families, { ...otra, id: 'f-otra', name: 'Otra casa' }]
        db.invitaciones = [...db.invitaciones, {
          id: 'i2', family_id: 'f-otra', correo: 'otra@ejemplo.test', estado: 'pendiente',
          emitida_at: '2026-01-01T00:00:00.000Z', caduca_at: '2099-01-01T00:00:00.000Z'
        }]
      })
      const { data: sinLlave } = await demo.rpc('aceptar_invitacion', { p_invitacion: 'i2' })
      expect(sinLlave[0].resultado).toBe('hace_falta_llave')
    })

    it('quien entra y sale y vuelve recupera su personaje, no empieza de cero', async () => {
      const { fam } = await gremioConPersona()
      await demo.rpc('invitar', { p_family: fam.id, p_correo: 'otra@ejemplo.test' })
      await demo.auth.signOut()
      await demo.auth.signInWithPassword({ email: 'otra@ejemplo.test', password: 'x' })
      personal('otra@ejemplo.test')
      const { data: bandeja } = await demo.rpc('mis_invitaciones')
      await demo.rpc('aceptar_invitacion', { p_invitacion: bandeja[0].id, p_personaje: 'La nueva' })

      const suyo = almacen().profiles.find((p) => p.name === 'La nueva')
      parchear((db) => {
        db.profiles = db.profiles.map((p) => (p.id === suyo.id ? { ...p, xp: 420, xp_maxima: 500 } : p))
      })

      const { data: salida } = await demo.rpc('abandonar_gremio', { p_family: fam.id })
      expect(salida).toBe('ok')
      // El personaje se retira, no se borra.
      expect(almacen().profiles.find((p) => p.id === suyo.id)).toMatchObject({ active: false, xp: 420 })

      parchear((db) => {
        db.invitaciones = [...db.invitaciones, {
          id: 'i3', family_id: fam.id, correo: 'otra@ejemplo.test', estado: 'pendiente',
          emitida_at: '2026-01-01T00:00:00.000Z', caduca_at: '2099-01-01T00:00:00.000Z'
        }]
      })
      await demo.rpc('aceptar_invitacion', { p_invitacion: 'i3', p_personaje: 'Otro nombre' })
      const vueltos = almacen().profiles.filter((p) => p.family_id === fam.id && p.name === 'La nueva')
      expect(vueltos).toHaveLength(1)
      expect(vueltos[0]).toMatchObject({ active: true, xp: 420, xp_maxima: 500 })
    })

    it('quien titula no puede limitarse a marcharse', async () => {
      const { fam, llave } = await (async () => {
        const { fam, adulto } = await fundar()
        parchear((db) => {
          db.profiles = db.profiles.map((p) =>
            p.id === adulto.id ? { ...p, xp_maxima: xpDeNivel(6), coins: 300 } : p)
        })
        await identidad({ adulto })
        await demo.rpc('forjar_llave', { p_family: fam.id, p_orden: 1 })
        return { fam, llave: almacen().derechos_expansion[0] }
      })()
      const { data: creado } = await demo.rpc('crear_gremio_con_llave', {
        p_llave: llave.id, p_nombre: 'El segundo', p_tipo: 'hogar', p_pais: 'ES', p_pin_hash: 'otropinlargo'
      })
      const { data } = await demo.rpc('abandonar_gremio', { p_family: creado[0].family_id })
      expect(data).toBe('eres_quien_titula')
      expect(fam.id).toBeTruthy()
    })

    it('a uno mismo no se le expulsa: eso es marcharse', async () => {
      const { fam, persona } = await gremioConPersona()
      const { data } = await demo.rpc('expulsar_de_gremio', { p_family: fam.id, p_persona: persona })
      expect(data).toBe('usa_abandonar')
    })
  })

  // ----------------------------------------------------------------
  describe('reclamar un perfil', () => {
    it('no existe y no se puede se responden igual', async () => {
      const { fam, adulto, peque } = await fundar()
      await identidad({ adulto })

      // Inventado, mascota y ya vinculado: el mismo código para los tres.
      const inventado = await demo.rpc('solicitar_reclamacion', { p_profile: 'no-existe' })
      const { data: mascota } = await demo
        .from('profiles')
        .insert({ family_id: fam.id, name: 'Perro', role: 'mascota', species: 'perro' })
        .select().single()
      const deMascota = await demo.rpc('solicitar_reclamacion', { p_profile: mascota.id })
      const vinculado = await demo.rpc('solicitar_reclamacion', { p_profile: adulto.id })

      expect([inventado.data, deMascota.data, vinculado.data])
        .toEqual(['no_reclamable', 'no_reclamable', 'no_reclamable'])
      expect(peque.id).toBeTruthy()
    })

    it('quien ya tiene personaje ahí dentro no reclama otro', async () => {
      const { peque, adulto } = await fundar()
      await identidad({ adulto })
      const { data } = await demo.rpc('solicitar_reclamacion', { p_profile: peque.id })
      expect(data).toBe('ya_tienes_personaje')
    })

    it('lo aprueba el gremio, y el perfil llega con su historial y su saldo', async () => {
      // Una casa con una peque sin identidad; alguien de fuera la reclama.
      const { fam, adulto, peque } = await fundar()
      const dueña = await identidad({ adulto })
      parchear((db) => {
        db.profiles = db.profiles.map((p) =>
          p.id === peque.id ? { ...p, role: 'adulto', xp: 700, xp_maxima: 900, coins: 55 } : p)
      })

      await demo.auth.signOut()
      const { data: sesion } = await demo.auth.signInWithPassword({ email: 'fuera@ejemplo.test', password: 'x' })
      const fuera = sesion.session.user.id
      parchear((db) => {
        db.credenciales = [...db.credenciales, {
          user_id: fuera, clase: 'personal', family_id: null, activa: true, created_at: '2026-01-01T00:00:00.000Z'
        }]
      })
      const { data: pedida } = await demo.rpc('solicitar_reclamacion', { p_profile: peque.id })
      expect(pedida).toBe('ok')

      // Desde fuera no se aprueba sola.
      const { data: solo } = await demo.rpc('aprobar_reclamacion', {
        p_reclamacion: almacen().reclamaciones[0].id
      })
      expect(solo).toBe('no_es_tuyo')

      await demo.auth.signOut()
      await demo.auth.signInWithPassword({ email: 'mia@ejemplo.test', password: 'una-buena' })
      const { data: lista } = await demo.rpc('reclamaciones_del_gremio', { p_family: fam.id })
      expect(lista[0]).toMatchObject({ correo: 'fuera@ejemplo.test', estado: 'pendiente' })

      const { data } = await demo.rpc('aprobar_reclamacion', { p_reclamacion: lista[0].id })
      expect(data).toBe('ok')

      const db = almacen()
      const suyo = db.profiles.find((p) => p.id === peque.id)
      // Ni nivel, ni marca de agua, ni historial: nada se reinicia.
      expect(suyo).toMatchObject({ persona: fuera, xp: 700, xp_maxima: 900, coins: 0 })
      expect(db.carteras.find((c) => c.persona === fuera).saldo).toBe(55)
      expect(db.pertenencias.find((p) => p.persona === fuera)).toMatchObject({
        rol: 'gestor', origen: 'reclamacion'
      })
      expect(dueña).toBeTruthy()
    })
  })

  // ----------------------------------------------------------------
  describe('la clave de casa', () => {
    it('no se retira mientras quede un adulto sin identidad', async () => {
      const { fam, adulto } = await fundar()
      await demo.from('profiles').insert({ family_id: fam.id, name: 'Otro', role: 'adulto' })
      await identidad({ adulto })

      const { data: inv } = await demo.rpc('inventario_credencial', { p_family: fam.id })
      expect(inv.puede).toBe(false)
      expect(inv.motivos).toContain('adultos_sin_identidad')
      expect(inv.adultos_sin_identidad[0].nombre).toBe('Otro')

      const { data } = await demo.rpc('desactivar_credencial_compartida', { p_family: fam.id })
      // El motivo viaja pegado: un «no se puede» a secas deja a alguien atascado.
      expect(data).toBe('bloqueada:adultos_sin_identidad')
    })

    it('y cuando se puede, la titularidad pasa a quien la retira', async () => {
      const { fam, adulto, peque } = await fundar()
      const persona = await identidad({ adulto })
      // La peque no bloquea por sí sola: bloquea si no queda quien la opere.
      const { data: inv } = await demo.rpc('inventario_credencial', { p_family: fam.id })
      expect(inv.puede).toBe(true)
      expect(inv.no_convertidos.map((p) => p.profile_id)).toEqual([peque.id])

      const { data } = await demo.rpc('desactivar_credencial_compartida', { p_family: fam.id })
      expect(data).toBe('ok')

      const db = almacen()
      expect(db.families.find((f) => f.id === fam.id).owner).toBe(persona)
      expect(db.credenciales.find((c) => c.clase === 'compartida').activa).toBe(false)
      // Y el gremio sigue siendo suyo: la desactivación no lo hace desaparecer.
      const { data: fams } = await demo.from('families').select('*')
      expect(fams.map((f) => f.id)).toEqual([fam.id])
    })

    it('la anterior no vuelve, y la nueva tiene que existir y estar confirmada', async () => {
      const { fam, adulto } = await fundar()
      await identidad({ adulto })
      await demo.rpc('desactivar_credencial_compartida', { p_family: fam.id })

      const { data: sinCuenta } = await demo.rpc('crear_credencial_compartida', {
        p_family: fam.id, p_correo: 'nadie@ejemplo.test'
      })
      expect(sinCuenta).toBe('cuenta_no_existe')

      // Una cuenta que ya es otra cosa tampoco vale.
      const { data: yaEs } = await demo.rpc('crear_credencial_compartida', {
        p_family: fam.id, p_correo: 'casa@ejemplo.test'
      })
      expect(yaEs).toBe('cuenta_ya_clasificada')
    })
  })

  // ----------------------------------------------------------------
  describe('el alcance', () => {
    it('cada cuenta ve sus gremios y no los de al lado', async () => {
      await fundar({ correo: 'casa1@ejemplo.test', nombre: 'La primera' })
      await demo.auth.signOut()
      await fundar({ correo: 'casa2@ejemplo.test', nombre: 'La segunda' })

      const { data: mios } = await demo.from('families').select('*')
      expect(mios.map((f) => f.name)).toEqual(['La segunda'])

      await demo.auth.signOut()
      await demo.auth.signInWithPassword({ email: 'casa1@ejemplo.test', password: 'x' })
      const { data: otros } = await demo.from('families').select('*')
      expect(otros.map((f) => f.name)).toEqual(['La primera'])
    })

    it('y sin sesión no se ve ninguno', async () => {
      await fundar()
      await demo.auth.signOut()
      const { data } = await demo.from('families').select('*')
      expect(data).toEqual([])
    })

    it('el gremio que nace recibe su plantilla y su credencial', async () => {
      const { fam, uid } = await fundar()
      const db = almacen()
      const f = db.families.find((x) => x.id === fam.id)
      expect([f.tipo_plantilla, f.plantilla_version]).toEqual(['hogar', '2026-08-30.1'])
      expect(db.credenciales.find((c) => c.user_id === uid)).toMatchObject({
        clase: 'compartida', family_id: fam.id
      })
    })

    it('y la plantilla llega a la app con su vocabulario', async () => {
      const { fam } = await fundar()
      const { data } = await demo.rpc('plantilla_de_gremio')
      expect(data).toHaveLength(1)
      expect(data[0]).toMatchObject({ family_id: fam.id, tipo: 'hogar', nombre_visible: 'Hogar' })
      expect(data[0].vocabulario.zonas_intro).toContain('modo limpieza')
    })

    it('la tienda ve el saldo que de verdad se puede gastar', async () => {
      const { adulto, peque } = await fundar()
      await identidad({ adulto })
      const { data } = await demo.rpc('saldos_visibles')
      const porPerfil = Object.fromEntries(data.map((s) => [s.profile_id, s.saldo]))
      // El adulto gasta de su cartera; la peque, de su saldo local.
      expect(porPerfil[adulto.id]).toBe(300)
      expect(porPerfil[peque.id]).toBe(0)
    })
  })
})
