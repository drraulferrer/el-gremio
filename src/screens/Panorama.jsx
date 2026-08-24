// ------------------------------------------------------------------
// El Panorama: la pantalla por la que abre el gremio.
//
// Las cuentas están todas en `src/lib/panorama.js`. Aquí solo se pinta.
//
// EL ORDEN DE LA PÁGINA ES LA DECISIÓN, y va de lo que cambia cada hora
// a lo que cambia cada mes:
//
//   1. el arco de hoy, con su titular y su única frase accionable;
//   2. los tres relojes —racha, nivel, gremio—;
//   3. la semana en barras: la primera cosa que no es de hoy;
//   4. la meta del gremio, que es de todos y va a meses vista;
//   5. en qué habilidades anda, que es identidad y no marcador;
//   6. lo último que le han dicho;
//   7. y al final, el botón a las misiones.
//
// El botón va al FINAL a propósito, y es lo más discutible de esta
// pantalla. La tentación es ponerlo arriba —«empieza ya»— pero entonces
// el panorama vuelve a ser un trámite antes de la lista de deberes, que
// es exactamente lo que venía a dejar de ser. Quien quiera ir directo
// tiene la pestaña de Misiones a un toque, siempre visible abajo.
// ------------------------------------------------------------------

import Arco from '../components/Arco'
import Estandarte from '../components/Estandarte'
import Muro from '../components/Muro'
import { Bolsa, Plegable, Talis } from '../components/ui'
import { diaDe, lecturaDelDia, relojesDe, saludo, semanaDe } from '../lib/panorama'
import { HABILIDADES, rangoDeHabilidad, xpPorHabilidad } from '../lib/habilidades'
import { retratoDe } from '../lib/retrato'
import { flex } from '../lib/genero'
import Retrato from '../components/Retrato'

export default function Panorama({
  data,
  profile,
  genero,
  elogios = [],
  muroNuevo = false,
  alVerMuro,
  onIrA, onVerRetrato}) {
  const ahora = new Date()
  const relojes = relojesDe(profile, data, ahora)
  const dia = diaDe(profile, data, ahora)
  const lectura = lecturaDelDia(dia, relojes.racha)
  const sem = semanaDe(profile.id, data.completions, ahora)
  const retrato = retratoDe(profile.id, data, ahora)

  const porHabilidad = xpPorHabilidad(profile.id, data.completions, data.challenges)
  // De más entrenada a menos, y las de cero al final: la tira responde
  // «¿en qué andas?», y una habilidad sin XP no contesta a eso. No se
  // esconden, que ver lo que falta es media motivación, pero van detrás.
  const habilidades = [...HABILIDADES].sort((a, b) => (porHabilidad[b.id] || 0) - (porHabilidad[a.id] || 0))

  return (
    <div className="panorama">
      <header className="panorama-cabecera">
        <button
          className="btn-retrato"
          onClick={onVerRetrato}
          aria-label="Tu retrato: mirarlo y cambiarlo"
        >
          <Retrato perfil={profile} tamano={52} />
        </button>
        <div className="crece">
          <p className="panorama-saludo">{saludo(ahora)},</p>
          <h2 className="panorama-nombre">{profile.name}</h2>
        </div>
        <div className="panorama-marcas">
          {/* La misma llama inquieta que el camino de la racha, y por
              la misma razón: en riesgo no se apaga —eso sería castigar a
              mediodía— sino que se mueve, y solo el día que hay algo que
              hacer. Dos pantallas que enseñan la misma racha no pueden
              contarla de dos maneras. */}
          <span
            className={'chip-racha racha-numero' + (relojes.riesgo ? ' inquieta' : '')}
            aria-label={`Racha de ${relojes.racha} ${relojes.racha === 1 ? 'día' : 'días'}`}
          >
            <span className="racha-llama" aria-hidden="true">{relojes.racha > 0 ? '🔥' : '🌑'}</span> {relojes.racha}
          </span>
          <Bolsa n={profile.coins} />
        </div>
      </header>

      {/* El bloque del día. Arco, titular y frase van juntos y en ese
          orden: la cifra llama, la palabra la interpreta y la frase dice
          qué hacer. Separarlos con una tarjeta por medio rompe la
          lectura, que es de arriba abajo y de un solo golpe. */}
      <section className="panorama-dia">
        <Arco
          pct={dia.pct}
          cifra={dia.tocan === 0 ? '—' : `${dia.hechas}/${dia.tocan}`}
          rotulo="EL DÍA"
          cerrado={dia.tocan > 0 && dia.quedan === 0}
          topes={dia.tocan > 0 ? ['0', String(dia.tocan)] : null}
          etiqueta={
            dia.tocan === 0
              ? 'Hoy no hay misiones asignadas'
              : `${dia.hechas} de ${dia.tocan} misiones de hoy resueltas`
          }
        />

        <h3 className="panorama-titular">{lectura.titulo}</h3>
        <p className="panorama-frase">{lectura.frase}</p>

        {/* Los tres relojes, colgando del arco como en Opal. Son botones
            porque cada uno lleva al sitio donde eso se explica entero:
            un dato que no se puede abrir se queda en adorno. */}
        <div className="relojes">
          <button className="reloj" onClick={() => onIrA('progreso')}>
            <span className="reloj-cifra">
              <span aria-hidden="true">{relojes.racha > 0 ? '🔥' : '🌑'}</span> {relojes.racha}
            </span>
            <span className="reloj-nombre">Racha</span>
          </button>
          <button className="reloj" onClick={() => onIrA('progreso')}>
            <span className="reloj-cifra">
              <span aria-hidden="true">💎</span> {relojes.nivel.level}
            </span>
            <span className="reloj-nombre">Nivel</span>
          </button>
          <button className="reloj" onClick={() => onIrA('progreso')}>
            <span className="reloj-cifra">
              <span aria-hidden="true">{relojes.temporada.rango.emoji}</span>{' '}
              {relojes.meta ? `${relojes.meta.pct}%` : relojes.temporada.temporada}
            </span>
            <span className="reloj-nombre">{relojes.meta ? 'Meta' : 'Temporada'}</span>
          </button>
        </div>
      </section>

      {/* La semana. Es lo primero que no es de hoy, y la única
          comparación que esta app se permite: uno consigo mismo. Sin
          medias de nadie, sin «gente como tú». */}
      <section className="carta panorama-semana">
        <div className="fila-separada" style={{ marginBottom: 10 }}>
          <strong style={{ fontFamily: 'var(--display)' }}>Tu semana</strong>
          <span className="suave" style={{ fontSize: '0.78rem' }}>
            {sem.misiones === 0
              ? 'Todavía nada'
              : `${sem.misiones} ${sem.misiones === 1 ? 'misión' : 'misiones'} · ${sem.xp} XP`}
          </span>
        </div>

        <ol className="barras-semana">
          {sem.dias.map((d) => (
            <li
              key={d.clave}
              className={'barra-dia' + (d.esHoy ? ' es-hoy' : '') + (d.futuro ? ' es-futuro' : '')}
            >
              <div className="barra-carril">
                <div
                  className="barra-valor"
                  style={{ height: d.alto + '%' }}
                  title={`${d.misiones} ${d.misiones === 1 ? 'misión' : 'misiones'} · ${d.xp} XP`}
                />
              </div>
              <span className="barra-letra" aria-hidden="true">{d.letra}</span>
              <span className="sr">
                {d.letra}: {d.misiones} {d.misiones === 1 ? 'misión' : 'misiones'}, {d.xp} XP
              </span>
            </li>
          ))}
        </ol>

        {sem.mejor === 0 && (
          <p className="suave" style={{ margin: '8px 0 0', fontSize: '0.82rem' }}>
            En cuanto validen la primera misión, esta semana empieza a dibujarse.
          </p>
        )}
      </section>

      {/* La meta del gremio. Baja de la cabecera de todas las pestañas a
          aquí: es progreso, y el progreso vive en esta pantalla. En las
          demás sigue saliendo, con el mismo componente, para que nadie
          pierda de vista lo que es de todos. */}
      <Estandarte data={data} />

      {/* En qué anda. Tira horizontal como la de Oura, y por el mismo
          motivo: ocho barras apiladas son una tabla, ocho fichas en
          fila son un vistazo. La pantalla de Progreso sigue teniendo la
          versión larga con sus barras y sus rangos. */}
      <section className="carta">
        <div className="fila-separada" style={{ marginBottom: 4 }}>
          <strong style={{ fontFamily: 'var(--display)' }}>En qué andas</strong>
          <button className="btn btn-fantasma btn-mini" onClick={() => onIrA('progreso')}>
            Ver todo
          </button>
        </div>
        <p className="suave" style={{ margin: '0 0 10px', fontSize: '0.82rem' }}>{retrato.frase}</p>

        {/* Qué significa el aro, dicho en una línea. Sin esto la tira
            se lee mal a la primera: un 144 con el aro casi vacío al lado
            de un 98 con el aro lleno parece un fallo, y no lo es —el aro
            mide lo que falta para el rango siguiente, no la XP—. */}
        <p className="suave leyenda-aro">El aro dice cuánto te falta para el rango siguiente.</p>

        <ul className="tira-habilidades">
          {habilidades.map((h) => {
            const xp = porHabilidad[h.id] || 0
            const rango = rangoDeHabilidad(xp)
            return (
              <li key={h.id} className={'ficha-hab' + (xp === 0 ? ' apagada' : '')}>
                <span className="ficha-hab-aro" style={{ '--hab-pct': rango.pct + '%' }}>
                  <img src={h.icono} alt="" className="ficha-hab-icono" />
                </span>
                <span className="ficha-hab-xp">{xp}</span>
                <span className="ficha-hab-nombre">{h.nombre}</span>
                <span className="sr">{flex(rango.nombre, genero)}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Lo que le han dicho. Aquí solo asoma lo último; el muro entero
          sigue en Progreso. Y no lleva número por lo de siempre (§10.1):
          contar los reconocimientos recibidos los convierte en marcador. */}
      <Plegable
        id="panorama-muro"
        titulo="Lo que te han dicho"
        pista={elogios[0] ? `Lo último: “${elogios[0].texto || 'te dieron las gracias'}”` : 'Todavía nada'}
        marca={muroNuevo}
        alAbrir={alVerMuro}
      >
        <Muro elogios={elogios} challenges={data.challenges} genero={genero} />
      </Plegable>

      <button className="btn btn-bloque" style={{ marginTop: 12 }} onClick={() => onIrA('misiones')}>
        {dia.quedan === 0
          ? 'Ver mis misiones'
          : `Ver ${dia.quedan === 1 ? 'la misión que queda' : `las ${dia.quedan} que quedan`}`}
      </button>

      {relojes.hito && relojes.racha > 0 && (
        <p className="suave panorama-pie">
          {relojes.hito.faltan ?? relojes.hito.dias - relojes.racha}{' '}
          {(relojes.hito.faltan ?? relojes.hito.dias - relojes.racha) === 1 ? 'día' : 'días'} para{' '}
          {relojes.hito.emoji} {relojes.hito.nombre} · <Talis n={relojes.hito.monedas} />
        </p>
      )}
    </div>
  )
}
