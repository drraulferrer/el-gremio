import { Component } from 'react'
import { capturar } from '../lib/monitoring'
import { RELEASE } from '../lib/version'
import ReportarFallo from '../screens/ReportarFallo'

// Sin esto, un fallo de render deja una pantalla en blanco y nadie se
// entera. Con esto, el error queda registrado con su traza y quien lo
// sufre ve algo que puede hacer.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, contando: false }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    capturar(error, { origen: 'react', componentStack: info?.componentStack })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="pantalla-centrada">
        <div className="aviso-config">
          <h2 style={{ marginBottom: 8 }}>El gremio ha tropezado</h2>
          <p>Algo se rompió al dibujar esta pantalla. El fallo ya ha quedado registrado.</p>
          <p className="suave">Versión {RELEASE}</p>
          <button className="btn btn-bloque" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>
            Recargar
          </button>
          {/* «Registrado» quería decir «en la consola de este móvil», que
              es tanto como decir en ninguna parte. Este botón es el que
              lo saca de aquí, y esta pantalla es el mejor momento para
              preguntarlo: quien la está viendo acaba de ver el fallo. */}
          <button
            className="btn btn-fantasma btn-bloque"
            style={{ marginTop: 8 }}
            onClick={() => this.setState({ contando: true })}
          >
            Contar qué estabas haciendo
          </button>
        </div>

        {this.state.contando && (
          <ReportarFallo pantalla="tropiezo" onClose={() => this.setState({ contando: false })} />
        )}
      </div>
    )
  }
}
