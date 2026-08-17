import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { romperMarco } from './lib/marco'
import './styles.css'

// Lo PRIMERO, antes de montar nada. Si esto se está abriendo dentro del
// iframe de otra página, la app no llega a existir: o salta fuera, o se
// niega a pintarse. Ver src/lib/marco.js para por qué esto no lo resuelve
// la CSP.
const marco = romperMarco()

if (marco === 'atrapado') {
  // Un marco que no deja salir. Nada de la app se monta: ni sesión, ni
  // formulario de entrada, ni panel. Solo un enlace para llegar al sitio
  // de verdad, que es lo único útil que se le puede ofrecer a quien haya
  // llegado aquí de buena fe.
  // Se construye con nodos y no con innerHTML. Hoy la cadena es literal y
  // no habría diferencia; el problema es el de mañana, cuando alguien
  // quiera meter aquí el origen del marco o un mensaje de error y lo
  // concatene sin pensarlo. En este repo no hay ni un `innerHTML`, y esa
  // propiedad vale más que las cuatro líneas que ahorra.
  const salida = document.createElement('p')
  salida.style.cssText = 'font:16px/1.5 system-ui,sans-serif;padding:24px;text-align:center'
  salida.append('El Gremio no se abre dentro de otra página. ')

  const enlace = document.createElement('a')
  enlace.href = 'https://elgremioapp.com/'
  enlace.target = '_blank'
  enlace.rel = 'noopener noreferrer'
  enlace.textContent = 'Ábrelo aquí'
  salida.append(enlace, '.')

  document.getElementById('root').append(salida)
} else if (marco === 'suelto') {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
}
// Con 'saliendo' no se monta nada a propósito: el navegador ya está yendo
// a la página de verdad y montar la app sería pintarla, un instante, justo
// dentro del marco del que se está saliendo.
