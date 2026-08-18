// ------------------------------------------------------------------
// El recordatorio de que los avisos están sin activar.
//
// Vive arriba del panel parental y en ningún sitio más. El porqué, y el
// porqué de que el «no me lo enseñes más» se guarde en el aparato y no en
// la base, están en `lib/avisosPendientes.js`.
//
// Dos detalles de comportamiento que no son adorno:
//
// 1. **Al ocultarlo no desaparece sin más**: primero explica dónde
//    encontrarlo luego. Un banner que se esfuma para siempre en cuanto lo
//    tocas deja a quien lo tocó sin saber que había una puerta ahí.
// 2. **No se pinta mientras `estadoDePush()` está resolviéndose.** El
//    panel ya está en pantalla para entonces, y un aviso que aparece medio
//    segundo después empuja el contenido hacia abajo justo cuando alguien
//    va a pulsar algo.
// ------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { estadoDePush, perfilesConAvisos } from '../lib/push'
import { debeRecordar, perfilesSinAparato, textoDelAviso, claveDeOculto } from '../lib/avisosPendientes'

export default function AvisoPush({ family, data, onIrAAvisos }) {
  const [estado, setEstado] = useState('cargando')
  const [sinAparato, setSinAparato] = useState(0)
  const [oculto, setOculto] = useState(true)
  const [despidiendo, setDespidiendo] = useState(false)

  const clave = claveDeOculto(family?.id)

  useEffect(() => {
    let vivo = true
    setOculto(localStorage.getItem(clave) === '1')
    estadoDePush().then((e) => vivo && setEstado(e))
    // El recuento es accesorio: si falla, `perfilesConAvisos` devuelve null
    // y el aviso habla solo de este aparato en vez de inventarse una cifra.
    perfilesConAvisos(family?.id).then((ids) => {
      if (vivo) setSinAparato(perfilesSinAparato(data?.profiles, ids))
    })
    return () => {
      vivo = false
    }
  }, [clave, family?.id, data?.profiles])

  // Se apunta el olvido Y se marca oculto a la vez. Tenerlo en dos sitios
  // costó un bug de los que solo se ven en pantalla: si «Entendido» era el
  // que ponía `oculto`, el mensaje de despedida seguía tapando el panel
  // para siempre, porque el `if (despidiendo)` de abajo corta antes de que
  // `oculto` llegue a mirarse. Aquí queda todo dicho de una vez y
  // «Entendido» solo cierra la despedida.
  function dejarDeMostrar() {
    localStorage.setItem(clave, '1')
    setOculto(true)
    setDespidiendo(true)
  }

  if (despidiendo) {
    return (
      <div className="aviso-panel aviso-panel-calmado" role="status">
        <p style={{ margin: 0 }}>
          Hecho, no vuelve a salir en este aparato. Puedes activarlos cuando quieras en{' '}
          <strong>Panel parental → ⚙️ Ajustes → 🔔 Avisos</strong>.
        </p>
        <div className="fila" style={{ marginTop: 10 }}>
          <button className="btn btn-mini" onClick={() => setDespidiendo(false)}>
            Entendido
          </button>
        </div>
      </div>
    )
  }

  if (!debeRecordar({ estado, oculto })) return null

  return (
    <div className="aviso-panel" role="status">
      <p style={{ margin: 0 }}>
        <strong>🔔 {textoDelAviso(sinAparato)}</strong>
      </p>
      <p className="suave" style={{ margin: '6px 0 0' }}>
        Se activan por aparato: hay que encenderlos en cada móvil, y quien lo use tiene que hacerlo desde el suyo.
      </p>
      <div className="fila" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
        <button className="btn btn-mini" onClick={onIrAAvisos}>
          Activar avisos
        </button>
        <button className="btn btn-fantasma btn-mini" onClick={dejarDeMostrar}>
          Dejar de mostrar
        </button>
      </div>
    </div>
  )
}
