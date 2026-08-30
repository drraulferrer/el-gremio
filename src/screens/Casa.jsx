import { useState } from 'react'
import { supabase, mensajeDeError } from '../lib/supabase'
import { perfilesActivos } from '../lib/miembros'
import { textoDeTipo } from '../lib/plantilla'
import Icono from '../components/Icono'
import {
  PLANTILLAS_ZONA, IDS_PLANTILLA, ZONAS_POR_DEFECTO,
  nombreDeZonaValido, zonasDeLaCasa
} from '../lib/zonas'

// --------------------------------------------------------------
// ⚙️ → Casa: el mapa de zonas sobre el que limpia el modo limpieza.
//
// Las zonas se siembran en el setup y se retocan aquí cuando la casa
// cambie: una reforma, un traslado, una buhardilla que por fin se
// ordena. Cada zona tiene el NOMBRE de esta casa y la PLANTILLA que
// dice qué se limpia ahí; la habitación de alguien lleva además su
// dueño, y las campañas se la sugieren a esa persona.
//
// Un gremio sin zonas guardadas no está roto: el modo limpieza usa las
// de siempre. Desde aquí se adoptan con un botón y se hacen propias.
// --------------------------------------------------------------

function faltaMigracion(error) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export default function Casa({ family, data, refresh }) {
  const [fallo, setFallo] = useState('')
  const zonas = data.zonas || []
  const gente = perfilesActivos(data.profiles).filter((p) => p.role !== 'mascota')

  async function operar(promesa) {
    setFallo('')
    const { error } = await promesa
    if (error) {
      setFallo(faltaMigracion(error)
        ? 'La casa necesita la migración 032, que aún no está en la base.'
        : mensajeDeError(error))
      return false
    }
    await refresh()
    return true
  }

  function adoptarLasDeSiempre() {
    return operar(
      supabase.from('zonas_casa').insert(
        ZONAS_POR_DEFECTO.map((z, i) => ({
          family_id: family.id,
          nombre: z.nombre,
          emoji: z.emoji,
          plantilla: z.plantilla,
          tipo: 'comun',
          dueno: null,
          orden: i
        }))
      )
    )
  }

  return (
    <div>
      <p className="suave" style={{ marginTop: 0 }}>
        {textoDeTipo(
          data?.plantilla,
          'zonas_intro',
          // Sin plantilla, exactamente lo que decía antes.
          family.tipo_gremio === 'piso'
            ? 'Este gremio es de compañeros de piso: cada habitación tiene su dueño, y las campañas se la sugieren a esa persona.'
            : 'El mapa del modo limpieza: de estas zonas salen las campañas de zona y de limpieza profunda.'
        )}
      </p>

      {fallo && <p className="error-texto" role="alert">{fallo}</p>}

      {zonas.length === 0 ? (
        <div className="carta">
          <p style={{ marginTop: 0 }}>
            Todavía no hay zonas guardadas: el modo limpieza está usando las de siempre
            ({ZONAS_POR_DEFECTO.map((z) => z.nombre.toLocaleLowerCase('es')).join(', ')}).
          </p>
          <button className="btn btn-bloque" onClick={adoptarLasDeSiempre}>
            🏠 Adoptar esas zonas y hacerlas nuestras
          </button>
          <p className="suave" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
            Al adoptarlas se pueden renombrar, quitar o ampliar aquí mismo.
          </p>
        </div>
      ) : (
        zonasDeLaCasa(data).map((z) => (
          <ZonaFila key={z.id} zona={z} gente={gente} operar={operar} />
        ))
      )}

      <NuevaZonaFila family={family} zonas={zonas} operar={operar} />
    </div>
  )
}

/**
 * Una zona guardada, editable en su propia fila: el nombre se confirma
 * (para no escribir en la base a cada tecla), la plantilla y el dueño se
 * guardan al elegirse, y quitar pide confirmación porque no hay papelera.
 */
function ZonaFila({ zona, gente, operar }) {
  const [nombre, setNombre] = useState(zona.nombre)
  const cambiado = nombre.trim() !== zona.nombre

  async function guardarNombre() {
    if (!cambiado) return
    if (!nombreDeZonaValido(nombre)) return
    await operar(supabase.from('zonas_casa').update({ nombre: nombre.trim() }).eq('id', zona.id))
  }

  function cambiarPlantilla(plantilla) {
    return operar(
      supabase.from('zonas_casa')
        .update({ plantilla, emoji: PLANTILLAS_ZONA[plantilla].emoji })
        .eq('id', zona.id)
    )
  }

  // El dueño y el tipo son la misma decisión: con dueño es privada, sin
  // dueño es común. Dos controles serían dos formas de contradecirse.
  function cambiarDueno(id) {
    return operar(
      supabase.from('zonas_casa')
        .update({ dueno: id || null, tipo: id ? 'privada' : 'comun' })
        .eq('id', zona.id)
    )
  }

  function quitar() {
    if (!window.confirm(`¿Quitar «${zona.nombre}» del mapa de la casa? Las campañas ya lanzadas no cambian.`)) return
    return operar(supabase.from('zonas_casa').delete().eq('id', zona.id))
  }

  return (
    <div className="carta">
      <div className="fila">
        <span style={{ fontSize: '1.2rem' }}>{zona.emoji}</span>
        <input
          className="crece"
          value={nombre}
          maxLength={60}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={guardarNombre}
          onKeyDown={(e) => { if (e.key === 'Enter') guardarNombre() }}
          aria-label={`Nombre de ${zona.nombre}`}
        />
        {cambiado && (
          <button className="btn btn-mini" disabled={!nombreDeZonaValido(nombre)} onClick={guardarNombre}>
            Guardar
          </button>
        )}
        <button className="btn-icono" onClick={quitar} aria-label={`Quitar ${zona.nombre}`}>
          <Icono nombre="cerrar" tamano={18} />
        </button>
      </div>
      <div className="fila" style={{ marginTop: 8 }}>
        <select
          className="crece"
          value={zona.plantilla}
          onChange={(e) => cambiarPlantilla(e.target.value)}
          aria-label={`Qué clase de zona es ${zona.nombre}`}
        >
          {IDS_PLANTILLA.map((id) => (
            <option key={id} value={id}>{PLANTILLAS_ZONA[id].nombre}</option>
          ))}
        </select>
        <select
          className="crece"
          value={zona.dueno || ''}
          onChange={(e) => cambiarDueno(e.target.value)}
          aria-label={`De quién es ${zona.nombre}`}
        >
          <option value="">De todo el gremio</option>
          {gente.map((p) => (
            <option key={p.id} value={p.id}>De {p.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function NuevaZonaFila({ family, zonas, operar }) {
  const [nombre, setNombre] = useState('')
  const [plantilla, setPlantilla] = useState('generica')

  async function anadir() {
    const ok = await operar(
      supabase.from('zonas_casa').insert({
        family_id: family.id,
        nombre: nombre.trim(),
        emoji: PLANTILLAS_ZONA[plantilla].emoji,
        plantilla,
        tipo: 'comun',
        dueno: null,
        orden: zonas.length
      })
    )
    if (ok) {
      setNombre('')
      setPlantilla('generica')
    }
  }

  return (
    <div className="carta">
      <div className="titulo-seccion" style={{ marginTop: 0 }}>Añadir una zona</div>
      <div className="fila">
        <input
          className="crece"
          value={nombre}
          maxLength={60}
          placeholder="La buhardilla, el garaje…"
          onChange={(e) => setNombre(e.target.value)}
          aria-label="Nombre de la zona nueva"
        />
        <select
          style={{ flex: 'none', width: 'auto' }}
          value={plantilla}
          onChange={(e) => setPlantilla(e.target.value)}
          aria-label="Qué clase de zona es la nueva"
        >
          {IDS_PLANTILLA.map((id) => (
            <option key={id} value={id}>{PLANTILLAS_ZONA[id].nombre}</option>
          ))}
        </select>
        <button className="btn btn-mini" disabled={!nombreDeZonaValido(nombre)} onClick={anadir}>
          Añadir
        </button>
      </div>
      <p className="suave" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
        La clase decide qué tareas trae su limpieza; «Otra zona» limpia lo que toda estancia tiene.
      </p>
    </div>
  )
}
