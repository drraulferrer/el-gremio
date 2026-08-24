import { useState } from 'react'
import { supabase, mensajeDeError, EMOJIS, COLORS, ROLE_LABEL } from '../lib/supabase'
import {
  perfilesActivos,
  perfilesRetirados,
  validarMiembro,
  puedeRetirar,
  loQueSePierde,
  MAX_PERFILES,
  MAX_MASCOTAS,
  ROLES_CON_MASCOTA
} from '../lib/miembros'
import { log } from '../lib/log'
import { ESPECIES, EMOJI_DE_ESPECIE, catalogoDe, premiosDe, filaDeMision, filaDePremio } from '../lib/mascotas'
import { GENEROS, flex, generoDe } from '../lib/genero'
import { Modal, Gema, Talis } from '../components/ui'
import Icono from '../components/Icono'
import Retrato from '../components/Retrato'
import { PIELES, PELOS, PEINADOS, piezasDe, faseDePerfil } from '../lib/retratos'

// ------------------------------------------------------------------
// Gestión de miembros del gremio.
//
// La baja por defecto es "retirar", no "borrar": borrar arrastra en
// cascada misiones, canjes e insignias, y con ellos la XP que esa
// persona aportó a metas ya cerradas. Retirar la saca del selector y
// deja la historia intacta.
// ------------------------------------------------------------------

const MIEMBRO_NUEVO = () => ({ name: '', role: 'junior', species: null, emoji: '🦊', color: COLORS[0], gender: 'neutro', active: true })

const AYUDA_ROL = {
  adulto: 'Pide misiones, valida las de los demás y entra al panel con el PIN.',
  junior: 'Pide sus misiones desde su dispositivo y espera el visto bueno.',
  peque: 'Pantalla propia de botones enormes. La estrella cae al momento, sin validación.',
  mascota:
    'No entra en la app ni recibe avisos: sus misiones las apunta un adulto desde el panel. Se le crean sus misiones y premios al guardarla.'
}

const ESPECIE_LABEL = { perro: '🐕 Perro', gato: '🐈 Gato' }

export default function Miembros({ family, data, refresh }) {
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)
  const [fallo, setFallo] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const activos = perfilesActivos(data.profiles)
  const personas = activos.filter((p) => p.role !== 'mascota')
  const animales = activos.filter((p) => p.role === 'mascota')
  const retirados = perfilesRetirados(data.profiles)

  async function guardar(m) {
    const { ok, mensaje } = validarMiembro(m, data.profiles)
    if (!ok) {
      setFallo(mensaje)
      return
    }

    setOcupado(true)
    const fila = {
      family_id: family.id,
      name: m.name.trim(),
      role: m.role,
      emoji: m.emoji,
      color: m.color,
      gender: m.gender || 'neutro',
      // Null explícito y no `undefined`: al dejar de ser mascota hay que
      // BORRAR la especie en la base, y `undefined` no viaja en el JSON,
      // así que la fila se quedaría con perro y rol junior. La base lo
      // rechazaría, pero con un error que no dice nada.
      species: m.role === 'mascota' ? m.species : null
    }

    // Se necesita el id para colgarle las misiones, así que en el alta se
    // pide la fila de vuelta.
    const { data: creado, error } = m.id
      ? await supabase.from('profiles').update(fila).eq('id', m.id)
      : await supabase.from('profiles').insert(fila).select().single()

    if (error) {
      setOcupado(false)
      setFallo(mensajeDeError(error))
      return
    }

    // Una mascota recién dada de alta llega con su catálogo puesto. Sin
    // esto habría que escribir a mano nueve misiones y cinco premios
    // antes de que sirviera para algo, y nadie lo haría: se quedaría como
    // un perfil vacío con un nombre bonito.
    //
    // Si esto falla, el perfil YA está creado y no se deshace: es mejor
    // una mascota sin catálogo —que se puede rellenar a mano— que perder
    // el alta entera por no poder escribir una misión.
    if (!m.id && m.role === 'mascota' && creado?.id) {
      const misiones = catalogoDe(m.species).map((x) =>
        filaDeMision(x, { familyId: family.id, profileId: creado.id })
      )
      const premios = premiosDe(m.species).map((x) => filaDePremio(x, { familyId: family.id }))
      const [r1, r2] = await Promise.all([
        supabase.from('challenges').insert(misiones),
        supabase.from('rewards').insert(premios)
      ])
      if (r1.error || r2.error) {
        log.warn('mascota.catalogo.fallo', { error: (r1.error || r2.error)?.message })
        setFallo('Se creó la mascota, pero no sus misiones. Puedes añadirlas a mano.')
      }
    }

    setOcupado(false)
    log.info(m.id ? 'miembro.editado' : 'miembro.creado', { rol: m.role })
    setFallo('')
    setEditando(null)
    await refresh()
  }

  async function cambiarActivo(perfil, activo) {
    if (!activo) {
      const { ok, mensaje } = puedeRetirar(perfil, data.profiles)
      if (!ok) {
        setFallo(mensaje)
        return
      }
    }
    setOcupado(true)
    const { error } = await supabase.from('profiles').update({ active: activo }).eq('id', perfil.id)
    setOcupado(false)

    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    log.info(activo ? 'miembro.reincorporado' : 'miembro.retirado', { profile_id: perfil.id })
    setFallo('')
    await refresh()
  }

  async function borrarDeVerdad(perfil) {
    setOcupado(true)
    const { error } = await supabase.from('profiles').delete().eq('id', perfil.id)
    setOcupado(false)

    if (error) {
      setFallo(mensajeDeError(error))
      return
    }
    log.warn('miembro.borrado', { profile_id: perfil.id, rol: perfil.role })
    setBorrando(null)
    setFallo('')
    await refresh()
  }

  return (
    <div>
      {fallo && <p className="error-texto" role="alert">{fallo}</p>}

      <button
        className="btn btn-mini btn-bloque"
        style={{ marginBottom: 12 }}
        disabled={personas.length >= MAX_PERFILES && animales.length >= MAX_MASCOTAS}
        onClick={() => { setFallo(''); setEditando(MIEMBRO_NUEVO()) }}
      >
        + Añadir miembro
      </button>

      {/* Dos cuentas, porque son dos cupos: la validación ya los separa
          y un solo «2 de 8» haría creer que el perro ocupa el sitio de
          una persona. */}
      <div className="titulo-seccion">
        En el gremio · {personas.length} de {MAX_PERFILES}
        {animales.length > 0 && ` · ${animales.length} de ${MAX_MASCOTAS} mascotas`}
      </div>

      {activos.map((p) => (
        <div className="carta" key={p.id}>
          <div className="fila">
            <Retrato perfil={p} tamano={46} />
            <div className="crece">
              <strong>{p.name}</strong>
              <div className="suave">
                {flex(ROLE_LABEL[p.role], generoDe(p))} · {p.xp} XP · <Talis n={p.coins} />
              </div>
            </div>
            <Gema xp={p.xp} color={p.color} mini />
            <button className="btn-icono" onClick={() => { setFallo(''); setEditando(p) }} aria-label={`Editar a ${p.name}`}>
              <Icono nombre="editar" />
            </button>
          </div>
          <button
            className="btn btn-fantasma btn-mini btn-bloque"
            style={{ marginTop: 10 }}
            disabled={ocupado}
            onClick={() => cambiarActivo(p, false)}
          >
            Retirar del gremio
          </button>
        </div>
      ))}

      {retirados.length > 0 && (
        <>
          <div className="titulo-seccion">Retirados</div>
          <p className="suave" style={{ margin: '0 4px 10px' }}>
            Fuera del selector de perfiles, pero su historial y su aportación a las metas siguen contando.
          </p>
          {retirados.map((p) => (
            <div className="carta" key={p.id} style={{ opacity: 0.6 }}>
              <div className="fila">
                <Retrato perfil={p} tamano={46} />
                <div className="crece">
                  <strong>{p.name}</strong>
                  <div className="suave">{flex(ROLE_LABEL[p.role], generoDe(p))} · {p.xp} XP</div>
                </div>
              </div>
              <div className="fila" style={{ marginTop: 10 }}>
                <button
                  className="btn btn-mini crece"
                  disabled={ocupado || perfilesActivos(data.profiles).filter((x) => x.role !== 'mascota').length >= MAX_PERFILES}
                  onClick={() => cambiarActivo(p, true)}
                >
                  Reincorporar
                </button>
                <button className="btn btn-peligro btn-mini" disabled={ocupado} onClick={() => setBorrando(p)}>
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {editando && (
        <FormMiembro
          miembro={editando}
          ocupado={ocupado}
          onGuardar={guardar}
          onClose={() => setEditando(null)}
        />
      )}

      {borrando && (
        <ConfirmarBorrado
          perfil={borrando}
          perdida={loQueSePierde(borrando, data)}
          ocupado={ocupado}
          onBorrar={() => borrarDeVerdad(borrando)}
          onClose={() => setBorrando(null)}
        />
      )}
    </div>
  )
}

function FormMiembro({ miembro, ocupado, onGuardar, onClose }) {
  const [m, setM] = useState({ ...miembro })
  // Igual que en las misiones del panel: la app propone emoji hasta que
  // alguien elige uno, y a partir de ahí se calla. Editar a un miembro
  // que ya existe nunca le cambia la cara.
  const [emojiAMano, setEmojiAMano] = useState(Boolean(miembro.id))
  const set = (cambios) => setM({ ...m, ...cambios })

  function elegirEspecie(especie) {
    set(emojiAMano ? { species: especie } : { species: especie, emoji: EMOJI_DE_ESPECIE[especie] })
  }

  return (
    <Modal titulo={m.id ? `Editar a ${miembro.name}` : 'Nuevo miembro'} onClose={onClose}>
      <div className="campo">
        <label>Nombre</label>
        <input value={m.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} autoFocus />
      </div>

      <div className="campo">
        <label>Rol</label>
        <select
          value={m.role}
          onChange={(e) => {
            // Al dejar de ser mascota hay que soltar la especie, o la
            // base rechaza la fila entera (profiles_especie_coherente).
            const role = e.target.value
            set(role === 'mascota' ? { role } : { role, species: null })
          }}
        >
          {ROLES_CON_MASCOTA.map((r) => (
            <option key={r} value={r}>{flex(ROLE_LABEL[r], m.gender || 'neutro')}</option>
          ))}
        </select>
        <span className="suave">{AYUDA_ROL[m.role]}</span>
      </div>

      {m.role === 'mascota' && (
        <div className="campo">
          <label>¿Perro o gato?</label>
          <div className="grid-habilidades">
            {ESPECIES.map((e) => (
              <button
                key={e}
                type="button"
                className={'pastilla-habilidad' + (m.species === e ? ' sel' : '')}
                onClick={() => elegirEspecie(e)}
              >
                {ESPECIE_LABEL[e]}
              </button>
            ))}
          </div>
          <span className="suave">
            Decide qué misiones y premios se le crean. Solo perro y gato: son las dos especies
            para las que el catálogo tiene respaldo (ver docs/MASCOTAS.md).
          </span>
        </div>
      )}

      <div className="campo">
        <label>¿Cómo le habla la app?</label>
        <div className="grid-habilidades">
          {GENEROS.map((g) => (
            <button
              key={g.id}
              type="button"
              className={'pastilla-habilidad' + ((m.gender || 'neutro') === g.id ? ' sel' : '')}
              onClick={() => set({ gender: g.id })}
            >
              {g.etiqueta}
            </button>
          ))}
        </div>
        <span className="suave">
          Así se leerá: «{GENEROS.find((g) => g.id === (m.gender || 'neutro'))?.ejemplo}». Sin especificar, la app
          usa textos escritos para que no haga falta marca de género: ni arrobas ni barras, que no se pueden leer
          en voz alta.
        </span>
      </div>

      {/* El retrato solo tiene sentido en las personas: una mascota lleva
          medallón de emoji y no tiene fase (migración 035). */}
      {m.role !== 'mascota' && (
        <div className="campo">
          <label>Retrato</label>
          <div className="fila" style={{ alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <Retrato perfil={m} tamano={78} vista="cuerpo" />
            <span className="suave crece">
              La figura gana equipo al subir de nivel: no se compra ni se elige, se alcanza.
              Ahora mismo, <strong>{flex(faseDePerfil(m).nombre, m.gender || 'neutro')}</strong>.
            </span>
          </div>

          <label>Piel</label>
          <div className="grid-colores">
            {PIELES.map((x) => (
              <button
                key={x.id}
                className={piezasDe(m).piel === x.id ? 'sel' : ''}
                style={{ background: x.hex }}
                onClick={() => set({ retrato_piel: x.id })}
                aria-label={'Piel ' + x.id}
              />
            ))}
          </div>

          <label>Pelo</label>
          <div className="grid-colores">
            {PELOS.map((x) => (
              <button
                key={x.id}
                className={piezasDe(m).pelo === x.id ? 'sel' : ''}
                style={{ background: x.hex }}
                onClick={() => set({ retrato_pelo: x.id })}
                aria-label={'Pelo ' + x.id}
              />
            ))}
          </div>

          <label>Peinado</label>
          <div className="grid-habilidades">
            {PEINADOS.map((x) => (
              <button
                key={x.id}
                type="button"
                className={'pastilla-habilidad' + (piezasDe(m).peinado === x.id ? ' sel' : '')}
                onClick={() => set({ retrato_peinado: x.id })}
              >
                {x.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="campo">
        {/* El emoji no se va: sigue siendo el respaldo del retrato y lo
            único que llevan las mascotas. También es lo que ven los
            clientes viejos que aún no han recargado. */}
        <label>Emoji</label>
        <div className="grid-emojis">
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={m.emoji === e ? 'sel' : ''}
              onClick={() => { setEmojiAMano(true); set({ emoji: e }) }}
            >{e}</button>
          ))}
        </div>
      </div>

      <div className="campo">
        <label>Color</label>
        <div className="grid-colores">
          {COLORS.map((c) => (
            <button
              key={c}
              className={m.color === c ? 'sel' : ''}
              style={{ background: c }}
              onClick={() => set({ color: c })}
              aria-label={'Color ' + c}
            />
          ))}
        </div>
      </div>

      <button className="btn btn-bloque" disabled={ocupado || !m.name.trim()} onClick={() => onGuardar(m)}>
        {ocupado ? 'Guardando…' : 'Guardar'}
      </button>
    </Modal>
  )
}

function ConfirmarBorrado({ perfil, perdida, ocupado, onBorrar, onClose }) {
  const [texto, setTexto] = useState('')
  const confirmado = texto.trim().toLocaleLowerCase('es') === perfil.name.trim().toLocaleLowerCase('es')
  const hayHistoria = perdida.misiones + perdida.canjes + perdida.insignias > 0

  return (
    <Modal titulo={`Borrar a ${perfil.name}`} onClose={onClose}>
      <p>Esto no se puede deshacer. Se borrará para siempre:</p>
      <ul className="suave" style={{ margin: '8px 0 12px', paddingLeft: 20 }}>
        <li>{perdida.misiones} misiones de su historial ({perdida.xp} XP aprobada)</li>
        <li>{perdida.canjes} canjes</li>
        <li>{perdida.insignias} insignias</li>
      </ul>
      {hayHistoria && (
        <p className="suave">
          Esa XP dejará de contar en las metas del gremio ya cerradas. Si solo quieres que deje de jugar,
          cierra esto y usa <strong>Retirar</strong>.
        </p>
      )}

      <div className="campo" style={{ marginTop: 12 }}>
        <label>Escribe «{perfil.name}» para confirmar</label>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
      </div>

      <button className="btn btn-peligro btn-bloque" disabled={!confirmado || ocupado} onClick={onBorrar}>
        {ocupado ? 'Borrando…' : 'Borrar definitivamente'}
      </button>
      <button className="btn btn-fantasma btn-bloque" style={{ marginTop: 10 }} onClick={onClose}>
        Cancelar
      </button>
    </Modal>
  )
}
