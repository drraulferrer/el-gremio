// ------------------------------------------------------------------
// El tablero de la mascota, dentro del panel parental.
//
// Vive aquí y no en una pantalla propia porque **una mascota no es un
// jugador**: no entra en la app, no elige perfil y no pulsa nada. Sus
// misiones las apunta una persona, y el sitio donde una persona apunta
// cosas de la casa es el panel.
//
// Lo que se ve: su nivel y sus Talis, las misiones que le tocan HOY, y
// sus premios. El XP va a ella; quien la cuida no se lleva nada
// (§2.1 de docs/MASCOTAS.md).
//
// Y dos cosas que el catálogo trae marcadas y aquí se enseñan, porque son
// las que evitan que esto sea un juego con un animal dentro:
//
// - **Los trucos no son diarios.** Salen con patrón de días alternos
//   porque entrenar a diario adquiere PEOR que espaciarlo (Demant 2011).
//   La app dice el tamaño de la sesión para que nadie lo alargue creyendo
//   que ayuda.
// - **Algunas necesitan a un adulto.** Comida, agua, arenero, dental y
//   salir a la calle. El animal depende de que se haga y un sistema de
//   puntos no es una garantía.
// ------------------------------------------------------------------

import { useState } from 'react'
import { misionesDe } from '../lib/misiones'
import { apuntarMisionDeMascota } from '../lib/acciones'
import { premiosParaPerfil, catalogoDe } from '../lib/mascotas'
import { Gema, XPBar, Talis } from '../components/ui'

const ESPECIE = { perro: '🐕', gato: '🐈' }

/** Lo que el catálogo sabía de esta misión: si es truco y si pide adulto. */
function marcasDe(reto, especie) {
  const plantilla = catalogoDe(especie).find((m) => m.title === reto.title)
  return { truco: plantilla?.tipo === 'truco', adulto: Boolean(plantilla?.adulto) }
}

export default function TableroMascota({ family, data, mascota, quien, refresh }) {
  const [ocupado, setOcupado] = useState('')
  const [fallo, setFallo] = useState('')

  const hoy = misionesDe(mascota, data.challenges, { dia: new Date() })
  const hechasHoy = data.completions.filter(
    (c) =>
      c.profile_id === mascota.id &&
      c.status === 'aprobado' &&
      c.resolved_at &&
      new Date(c.resolved_at).toDateString() === new Date().toDateString()
  )
  const yaHecha = (retoId) => hechasHoy.some((c) => c.challenge_id === retoId)
  const premios = premiosParaPerfil(data.rewards, mascota).filter((r) => r.active)

  async function apuntar(reto) {
    setOcupado(reto.id)
    setFallo('')
    const { ok, mensaje } = await apuntarMisionDeMascota({ family, mascota, reto, quien })
    setOcupado('')
    if (!ok) return setFallo(mensaje || 'No se pudo apuntar.')
    refresh()
  }

  return (
    <div>
      <div className="carta">
        <div className="fila">
          <div className="avatar" style={{ borderColor: mascota.color }}>{mascota.emoji}</div>
          <div className="crece">
            <strong>{mascota.name}</strong>
            <div className="suave">{ESPECIE[mascota.species]} · <Talis n={mascota.coins} /></div>
          </div>
          <Gema xp={mascota.xp} color={mascota.color} mini />
        </div>
        <div style={{ marginTop: 10 }}><XPBar xp={mascota.xp} /></div>
      </div>

      {fallo && <p className="error-texto" role="alert">{fallo}</p>}

      <div className="titulo-seccion">Hoy le toca</div>
      {hoy.length === 0 && (
        <div className="vacio">
          Hoy no le toca nada. Los trucos van en días alternos a propósito: entrenar a diario
          se aprende peor que espaciarlo.
        </div>
      )}

      {hoy.map((reto) => {
        const { truco, adulto } = marcasDe(reto, mascota.species)
        const hecha = yaHecha(reto.id)
        return (
          <div className="carta" key={reto.id}>
            <div className="fila">
              <div className="crece">
                <strong>{reto.emoji} {reto.title}</strong>
                <div className="suave">
                  +{reto.xp} XP · <Talis n={reto.coins} />
                  {truco && ' · truco, 5 minutos y mejor otro día que más rato'}
                  {adulto && ' · lo hace o supervisa un adulto'}
                </div>
              </div>
              <button
                className={'btn btn-mini' + (hecha ? ' btn-fantasma' : '')}
                disabled={hecha || ocupado === reto.id}
                onClick={() => apuntar(reto)}
              >
                {hecha ? 'Hecho hoy' : ocupado === reto.id ? '…' : 'Apuntar'}
              </button>
            </div>
          </div>
        )
      })}

      <div className="titulo-seccion">Sus premios</div>
      {premios.length === 0 && <div className="vacio">Todavía no tiene premios.</div>}
      {premios.map((p) => (
        <div className="carta" key={p.id}>
          <div className="fila-separada">
            <strong>{p.emoji} {p.title}</strong>
            <span className={mascota.coins >= p.cost ? '' : 'suave'}><Talis n={p.cost} /></span>
          </div>
        </div>
      ))}
      <p className="suave" style={{ margin: '8px 4px 0' }}>
        Los premios de la mascota se entregan a mano: no hay cola de canjes porque no hay
        nadie a quien pedírselo. Cuando le toque uno, dádselo y ya.
      </p>
    </div>
  )
}
