import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  leerInvitacionesDelGremio, invitar, revocarInvitacion,
  leerPersonasDelGremio, expulsarDeGremio,
  leerReclamacionesDelGremio, aprobarReclamacion, rechazarReclamacion
} from '../lib/acciones'
import { mensajeDeInvitar, mensajeDeAprobar } from '../lib/expansion'
import { leerPerfil } from '../lib/gremios'

// ------------------------------------------------------------------
// La gente de fuera: personas, no perfiles.
//
// LA DISTINCIÓN QUE ESTA PANTALLA TIENE QUE DEJAR CLARA, porque es la que
// más confunde: un **miembro** es un perfil de esta casa y entra con la
// clave compartida; una **persona invitada** trae su propia cuenta, su
// propio saldo y su propio historial, y puede estar en otros gremios.
//
// Por eso va en un bloque aparte y no mezclada con la lista de miembros.
//
// Solo aparece cuando hay algo que enseñar —alguna persona dentro o alguna
// invitación—, o cuando quien mira puede invitar. Con una casa como las de
// hoy, donde no hay ninguna persona todavía, esto es un botón y nada más.
// ------------------------------------------------------------------

export default function GenteDeFuera({ family, data, refresh }) {
  const [invitaciones, setInvitaciones] = useState([])
  const [personas, setPersonas] = useState([])
  const [reclamaciones, setReclamaciones] = useState([])
  const [correo, setCorreo] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [abriendo, setAbriendo] = useState(false)
  const [yo, setYo] = useState(null)

  // El personaje de este aparato: es lo que el servidor usa para saber si
  // quien pide tiene la capacidad (`CAP-01`) y si hace falta el PIN.
  const quien = leerPerfil(family?.id)

  async function cargar() {
    const [i, p, rec, sesion] = await Promise.all([
      leerInvitacionesDelGremio(family.id),
      leerPersonasDelGremio(family.id),
      leerReclamacionesDelGremio(family.id),
      supabase.auth.getUser()
    ])
    setInvitaciones(i)
    setPersonas(p)
    setReclamaciones(rec)
    setYo(sesion?.data?.user?.id || null)
  }

  useEffect(() => {
    if (abriendo) cargar()
  }, [abriendo]) // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar() {
    setOcupado(true)
    setAviso('')
    const codigo = await invitar(family.id, correo.trim().toLowerCase(), quien)
    setOcupado(false)
    const mensaje = mensajeDeInvitar(codigo)
    if (mensaje) return setAviso(mensaje)
    setCorreo('')
    cargar()
  }

  async function revocar(id) {
    await revocarInvitacion(id, quien)
    cargar()
  }

  async function echar(persona) {
    // Echar a alguien no se deshace desde aquí: vuelve con invitación nueva
    // y llave nueva (`R-63`). Por eso se pregunta.
    if (!window.confirm('¿Seguro? Para volver necesitará una invitación nueva.')) return
    await expulsarDeGremio(family.id, persona, quien)
    cargar()
    refresh?.()
  }

  const pendientes = invitaciones.filter((i) => i.estado === 'pendiente')
  const porAprobar = reclamaciones.filter((r) => r.estado === 'pendiente')

  async function aprobar(id) {
    setAviso('')
    const codigo = await aprobarReclamacion(id, quien)
    const mensaje = mensajeDeAprobar(codigo)
    if (mensaje) setAviso(mensaje)
    cargar()
    refresh?.()
  }

  async function rechazarRec(id) {
    await rechazarReclamacion(id, quien)
    cargar()
  }

  if (!abriendo) {
    return (
      <button
        className="btn btn-mini btn-bloque"
        style={{ marginBottom: 12 }}
        onClick={() => setAbriendo(true)}
      >
        ✉️ Invitar a alguien de fuera
      </button>
    )
  }

  return (
    <div className="carta" style={{ marginBottom: 12 }}>
      <h4>Gente de fuera</h4>
      <p className="suave">
        Quien entra por invitación trae <strong>su propia cuenta</strong>: su saldo y su
        historial son suyos y le acompañan si se va. No es lo mismo que añadir un
        miembro de esta casa.
      </p>

      <label className="campo">
        <span>Su correo</span>
        <input
          type="email"
          value={correo}
          autoComplete="off"
          onChange={(e) => setCorreo(e.target.value)}
        />
      </label>

      {aviso && <p className="aviso" role="alert">{aviso}</p>}

      <button
        className="btn btn-bloque"
        disabled={!correo.includes('@') || ocupado}
        onClick={enviar}
      >
        {ocupado ? 'Un momento…' : 'Invitar'}
      </button>

      {pendientes.length > 0 && (
        <>
          <h4 style={{ marginTop: 16 }}>Invitaciones en marcha</h4>
          <ul className="lista-invitaciones">
            {pendientes.map((i) => (
              <li key={i.id}>
                <span>{i.correo}</span>
                <button className="btn btn-mini btn-fantasma" onClick={() => revocar(i.id)}>
                  Retirar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Reclamaciones: alguien que YA tiene identidad y que además es un
          perfil de esta casa. No es lo mismo que una invitación —esa persona
          ya estaba aquí— y por eso se aprueba en vez de invitarse. */}
      {porAprobar.length > 0 && (
        <>
          <h4 style={{ marginTop: 16 }}>Quieren reclamar su personaje</h4>
          <p className="suave">
            Ya tienen identidad propia y dicen que este personaje es suyo. Si lo apruebas,
            entran en el gremio con él: conserva su nivel, su historial y sus Talis.
          </p>
          <ul className="lista-invitaciones">
            {porAprobar.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>{r.personaje_nombre}</strong>
                  <span className="chip">{r.correo}</span>
                </span>
                <div className="fila-botones">
                  <button className="btn btn-mini" onClick={() => aprobar(r.id)}>Aprobar</button>
                  <button className="btn btn-mini btn-fantasma" onClick={() => rechazarRec(r.id)}>
                    No
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {personas.length > 0 && (
        <>
          <h4 style={{ marginTop: 16 }}>Personas dentro</h4>
          <ul className="lista-invitaciones">
            {personas.map((p) => (
              <li key={p.persona}>
                <span>
                  {/* El nombre sale de los perfiles que ya están cargados:
                      cada personaje con persona detrás es una de estas
                      personas, y así no hace falta pedir nada más. */}
                  {data.profiles.find((x) => x.persona === p.persona)?.name || 'Sin personaje'}
                  <span className="chip">{p.rol}</span>
                </span>
                {/* Sin botón para una misma: para salir está «dejar el
                    gremio», que comprueba otras cosas. */}
                {p.persona !== yo && (
                  <button className="btn btn-mini btn-peligro" onClick={() => echar(p.persona)}>
                    Echar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        className="btn btn-mini btn-fantasma btn-bloque"
        style={{ marginTop: 12 }}
        onClick={() => setAbriendo(false)}
      >
        Cerrar
      </button>
    </div>
  )
}
