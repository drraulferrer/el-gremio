// ------------------------------------------------------------------
// El arco del día.
//
// Es la pieza de Oura y de Opal: un arco abierto por abajo, la cifra
// dentro y el rótulo debajo. Un arco y no un círculo cerrado por una
// razón práctica: el hueco de abajo deja sitio para colgar los tres
// relojes sin que la composición se amontone, y de paso el arco se lee
// como un medidor —tiene principio y final visibles— mientras que un
// anillo cerrado no dice dónde empieza.
//
// EL COLOR NO ES DECORACIÓN. El trazo va en teal mientras el día está
// en marcha, porque teal es «vas por aquí»; al cerrarse pasa a oro,
// porque el oro de esta casa solo aparece cuando alguien ha cumplido.
// Esa es toda la regla de la hoja de estilo aplicada a un componente:
// si brilla en dorado, es que está hecho.
//
// El SVG se dibuja con `pathLength="100"` para que el guion del trazo se
// pueda escribir directamente en por ciento, sin calcular la longitud
// del arco a mano. Es lo que evita el fallo clásico de estos medidores:
// una fórmula de circunferencia que deja de cuadrar en cuanto alguien
// toca el radio.
// ------------------------------------------------------------------

export default function Arco({ pct = 0, cifra, rotulo, cerrado = false, etiqueta, topes = null }) {
  const valor = Math.max(0, Math.min(100, Math.round(pct)))

  return (
    <div className={'arco' + (cerrado ? ' arco-cerrado' : '')} role="img" aria-label={etiqueta}>
      <svg viewBox="0 0 200 116" className="arco-svg" aria-hidden="true">
        <defs>
          <linearGradient id="arco-trazo" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={cerrado ? 'var(--oro-hondo)' : 'var(--teal)'} />
            <stop offset="100%" stopColor={cerrado ? 'var(--oro-claro)' : 'var(--menta)'} />
          </linearGradient>
        </defs>

        {/* El carril entero, siempre visible: sin él no se ve cuánto
            falta, solo cuánto hay, y eso convierte el medidor en una
            barra de adorno. */}
        <path className="arco-carril" d="M18 104 A 82 82 0 0 1 182 104" pathLength="100" />
        <path
          className="arco-trazo"
          d="M18 104 A 82 82 0 0 1 182 104"
          pathLength="100"
          stroke="url(#arco-trazo)"
          style={{
            strokeDasharray: `${valor} 100`,
            // A cero se apaga del todo. Con `stroke-linecap: round`, un
            // guion de longitud cero deja pintado el redondeo del cabo
            // en algunos navegadores: un puntito teal al principio del
            // carril que parece suciedad, no un medidor vacío.
            strokeOpacity: valor === 0 ? 0 : 1
          }}
        />

        {/* Los dos extremos de la escala, como en el medidor de Oura: sin
            ellos el arco no dice contra qué se mide. Y dicen la escala DE
            VERDAD, no un 0–100 de adorno: con «3/6» dentro y un «100» en
            la punta, el arco estaba midiendo dos cosas distintas a la vez
            y ninguna de las dos se entendía. */}
        {topes && (
          <>
            <text className="arco-tope" x="10" y="114">{topes[0]}</text>
            <text className="arco-tope arco-tope-fin" x="190" y="114">{topes[1]}</text>
          </>
        )}
      </svg>

      <div className="arco-centro">
        <span className="arco-cifra">{cifra}</span>
        {rotulo && <span className="arco-rotulo">{rotulo}</span>}
      </div>
    </div>
  )
}
