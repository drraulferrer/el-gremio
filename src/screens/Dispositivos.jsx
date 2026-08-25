import { useState } from 'react'
import QR from '../components/QR'
import GuiaInstalar from '../components/GuiaInstalar'
import { urlDelGremio, urlDeLaNarrativa, mirandoDireccionVieja } from '../lib/dominio'

// ------------------------------------------------------------------
// Alta de dispositivos.
//
// La URL sale de public/CNAME y no del origen del navegador. Durante un
// tiempo bastó con calcularla del origen, pero con la mudanza a dominio
// propio dejó de valer: la dirección vieja sigue viva, y una PWA
// instalada desde ella conserva su origen para siempre. Esta pantalla
// ENSEÑA la dirección a los demás, así que calcularla del origen
// significaba imprimir QR con la dirección vieja y dejarla circulando.
// El razonamiento entero está en src/lib/dominio.js.
// ------------------------------------------------------------------

export default function Dispositivos() {
  const url = urlDelGremio()
  const heredada = mirandoDireccionVieja()
  const [copiado, setCopiado] = useState('')

  async function copiar(texto, cual) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(cual)
      setTimeout(() => setCopiado(''), 2000)
    } catch {
      // Sin permiso de portapapeles (Safari en algunos contextos): la URL
      // está a la vista y el QR sigue funcionando, que es lo que importa.
      setCopiado('')
    }
  }

  return (
    <div>
      <div className="titulo-seccion">Abrir en otro dispositivo</div>

      {heredada && (
        <div className="carta" style={{ borderStyle: 'dashed' }}>
          <strong>⚠️ Estás en la dirección antigua</strong>
          <p className="suave" style={{ marginBottom: 0 }}>
            Esta pestaña se abrió desde <code>{window.location.hostname}</code>, que
            sigue funcionando porque redirige sola. El QR de aquí abajo ya apunta a la
            dirección buena, así que puedes repartirlo sin problema; pero si tienes la
            app instalada desde la vieja, bórrala y vuelve a instalarla desde{' '}
            <strong>{url}</strong>.
          </p>
        </div>
      )}

      <div className="carta tarjeta-qr">
        <QR texto={url} tamano={230} titulo={`Código QR de ${url}`} />
        <p className="suave" style={{ textAlign: 'center', marginTop: 4 }}>
          Apunta con la cámara del móvil o del iPad.
        </p>
        <code className="url-gremio">{url}</code>
        <button
          className="btn btn-fantasma btn-bloque"
          style={{ marginTop: 10 }}
          onClick={() => copiar(url, 'app')}
        >
          {copiado === 'app' ? '✓ Copiada' : 'Copiar dirección'}
        </button>
      </div>

      <div className="titulo-seccion">Explicar el gremio a alguien</div>

      <div className="carta">
        <strong>📖 Cómo funciona El Gremio, entero</strong>
        <p className="suave">
          Una página que cuenta el sistema completo: por qué son habilidades y no tareas,
          el elogio como forma de validar, la economía con sus números, los topes por
          persona y las seis referencias en las que se apoya. <strong>No pide cuenta ni
          entra en el gremio</strong>, así que se le puede pasar a la familia, al colegio
          o a quien pregunte qué es esto.
        </p>
        <a
          className="btn btn-bloque"
          href={urlDeLaNarrativa()}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none', textAlign: 'center' }}
        >
          Abrirla
        </a>
        <button
          className="btn btn-fantasma btn-bloque"
          style={{ marginTop: 10 }}
          onClick={() => copiar(urlDeLaNarrativa(), 'narrativa')}
        >
          {copiado === 'narrativa' ? '✓ Copiada' : 'Copiar su enlace'}
        </button>
      </div>

      <div className="titulo-seccion">Instalarla como app</div>

      {/* La misma guía que ve quien entra desde el aparato nuevo. Estaba
          escrita aquí en texto y duplicarla acabaría con dos versiones de
          las instrucciones, cada una desactualizada por su lado.
          OJO: esta pantalla la mira un adulto en SU aparato para enseñar
          a otro, así que la guía detectará ESTE móvil y no aquel. Por eso
          se enseñan los dos sistemas y no solo el detectado. */}
      <div className="carta">
        <GuiaInstalar todos />
      </div>

      <div className="carta">
        <strong>Después, en cada aparato</strong>
        <p className="suave">
          Se entra con la <strong>misma cuenta familiar</strong> (un email y una contraseña para todos) y se
          elige perfil. El dispositivo lo recuerda, así que la tablet de la peque abre directamente en sus
          botones y no vuelve a pedir nada.
        </p>
      </div>
    </div>
  )
}
