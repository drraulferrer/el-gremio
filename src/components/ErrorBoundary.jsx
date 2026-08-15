import { Component } from 'react'
import { capturar } from '../lib/monitoring'
import { RELEASE } from '../lib/version'

// Sin esto, un fallo de render deja una pantalla en blanco y nadie se
// entera. Con esto, el error queda registrado con su traza y quien lo
// sufre ve algo que puede hacer.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
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
        </div>
      </div>
    )
  }
}
