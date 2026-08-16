import { PRINCIPIOS, REFERENCIAS, LIMITE_HONESTO } from '../lib/evidencia'

// ------------------------------------------------------------------
// Fundamento científico, dentro del panel parental.
//
// Va aquí y no en un documento aparte porque el momento en que hace
// falta es cuando algo del sistema chirría: por qué el elogio pide
// detalle, por qué los premios buenos son decisiones, por qué hay que
// retirarlos. Tenerlo a un toque evita que la duda acabe en abandono.
// ------------------------------------------------------------------

// La exposición larga vive en public/narrativa/, fuera del bundle: es una
// página estática que no necesita React ni sesión, y así se puede pasar a
// alguien de fuera sin que entre en el gremio. La URL sale del mismo sitio
// que la del QR (src/lib/dominio.js), que desde la mudanza es el CNAME y
// no el origen del navegador.

export default function Evidencia() {
  return (
    <div>
      <div className="titulo-seccion">La versión larga</div>
      <a
        className="carta"
        href={URL_NARRATIVA}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
      >
        <strong>📖 Cómo funciona El Gremio, entero</strong>
        <div className="suave">
          Exposición completa: el problema que resuelve, las ocho habilidades, el día a
          día, la economía y sus cifras, la pantalla de la peque, las temporadas, las
          seis referencias y en qué se separa de las apps de tareas al uso. Se abre en
          otra pestaña y se puede compartir con quien no use la app.
        </div>
      </a>

      <div className="titulo-seccion">En qué se apoya cada decisión</div>

      {PRINCIPIOS.map((p) => (
        <div className="carta" key={p.id}>
          <strong>{p.titulo}</strong>
          <div className="suave">{p.detalle}</div>
        </div>
      ))}

      <div className="titulo-seccion">Referencias</div>
      <p className="suave" style={{ margin: '0 4px 12px' }}>
        Solo revisiones sistemáticas, metaanálisis y trabajos fundacionales.
      </p>

      {REFERENCIAS.map((r, i) => (
        <div className="carta referencia" key={r.id}>
          <div className="fila-separada" style={{ alignItems: 'flex-start' }}>
            <span className="numero-ref">{i + 1}</span>
            {r.pmid && (
              <a
                className="chip"
                href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`}
                target="_blank"
                rel="noopener noreferrer"
              >
                PMID {r.pmid}
              </a>
            )}
          </div>
          <p className="cita">{r.cita}</p>
          <div className="titulo-seccion" style={{ margin: '10px 4px 4px' }}>Qué aporta</div>
          <p className="suave" style={{ margin: 0 }}>{r.aporta}</p>
          <div className="titulo-seccion" style={{ margin: '10px 4px 4px' }}>Dónde se ve en el gremio</div>
          <p style={{ margin: 0, fontSize: '0.92rem' }}>{r.enElGremio}</p>
        </div>
      ))}

      <div className="carta" style={{ borderStyle: 'dashed' }}>
        <strong>Hasta dónde llega esto</strong>
        <p className="suave" style={{ marginBottom: 0 }}>{LIMITE_HONESTO}</p>
      </div>
    </div>
  )
}
