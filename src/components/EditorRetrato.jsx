import Retrato from './Retrato'
import {
  PIELES, PELOS, PEINADOS, GAFAS, TUNICAS, BARBAS, FLEQUILLOS,
  piezasDe, faseDePerfil, admiteFlequillo, usaColorDePelo
} from '../lib/retratos'
import { flex } from '../lib/genero'

// ------------------------------------------------------------------
// Elegir las piezas del retrato.
//
// Vive fuera de Miembros porque lo usan dos sitios: el panel parental,
// donde un adulto monta el de cualquiera, y la pestaña Progreso, donde
// cada cual monta el suyo. Dos copias del mismo formulario acabarían
// ofreciendo catálogos distintos, que es como una casa termina con dos
// listas de peinados.
//
// Lo que NO está aquí, y es la línea que sostiene toda la escalera: no se
// elige NADA del equipo. Túnica sí —es ropa de diario, no rango—, pero ni
// delantal, ni manto, ni farol. Si se pudiera elegir un manto, el manto
// dejaría de significar «maestría» y las nueve fases se quedarían sin
// idioma. Lo elegible es quién eres; lo ganado es hasta dónde has llegado.
// ------------------------------------------------------------------

/**
 * @param vistaPrevia  la figura y el nombre de la fase, arriba del todo.
 *   Se apaga donde el sitio ya la enseña —Progreso tiene su propia
 *   cabecera con el retrato más grande— para no pintar dos veces la misma
 *   persona una encima de otra.
 */
export default function EditorRetrato({ perfil, onCambiar, genero = 'neutro', vistaPrevia = true }) {
  const piezas = piezasDe(perfil)
  const fase = faseDePerfil(perfil)

  return (
    <div className="editor-retrato">
      {vistaPrevia && (
        <div className="fila" style={{ alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <Retrato perfil={perfil} tamano={78} vista="cuerpo" />
          <span className="suave crece">
            La figura gana equipo al subir de nivel: no se compra ni se elige, se alcanza.
            Ahora mismo, <strong>{flex(fase.nombre, genero)}</strong>.
          </span>
        </div>
      )}

      <Muestras
        titulo="Piel"
        lista={PIELES}
        valor={piezas.piel}
        onElegir={(id) => onCambiar({ retrato_piel: id })}
      />

      {/* El color de pelo también manda en la BARBA, así que se ofrece
          aunque la cabeza vaya sin pelo mientras haya barba que teñir.
          Esconderlo al marcar «sin pelo» obligaba a ponerse un peinado,
          elegir el color y volver a quitárselo. Solo desaparece cuando de
          verdad no pinta nada. */}
      {usaColorDePelo(piezas) && (
        <Muestras
          titulo={piezas.peinado === 'calvo' ? 'Color de la barba' : 'Pelo'}
          lista={PELOS}
          valor={piezas.pelo}
          onElegir={(id) => onCambiar({ retrato_pelo: id })}
        />
      )}

      <Pastillas
        titulo="Peinado"
        lista={PEINADOS}
        valor={piezas.peinado}
        onElegir={(id) => onCambiar({ retrato_peinado: id })}
      />

      {admiteFlequillo(piezas.peinado) && (
        <Pastillas
          titulo="Flequillo"
          lista={FLEQUILLOS}
          valor={piezas.flequillo}
          onElegir={(id) => onCambiar({ retrato_flequillo: id })}
        />
      )}

      <Pastillas
        titulo="Barba"
        lista={BARBAS}
        valor={piezas.barba}
        onElegir={(id) => onCambiar({ retrato_barba: id })}
      />

      <Pastillas
        titulo="Gafas"
        lista={GAFAS}
        valor={piezas.gafas}
        onElegir={(id) => onCambiar({ retrato_gafas: id })}
      />

      <Pastillas
        titulo="Túnica"
        lista={TUNICAS}
        valor={piezas.tunica}
        onElegir={(id) => onCambiar({ retrato_tunica: id })}
        // La túnica se elige por nombre y no por muestra de color porque
        // una de las opciones no TIENE color propio: «como mi color» es
        // una regla, no un tono, y como cuadradito de color mentiría.
      />
    </div>
  )
}

function Muestras({ titulo, lista, valor, onElegir }) {
  return (
    <div className="campo">
      <label>{titulo}</label>
      <div className="grid-colores">
        {lista.map((x) => (
          <button
            key={x.id}
            type="button"
            className={valor === x.id ? 'sel' : ''}
            style={{ background: x.hex }}
            onClick={() => onElegir(x.id)}
            aria-label={`${titulo} ${x.id}`}
            aria-pressed={valor === x.id}
          />
        ))}
      </div>
    </div>
  )
}

function Pastillas({ titulo, lista, valor, onElegir }) {
  return (
    <div className="campo">
      <label>{titulo}</label>
      <div className="grid-habilidades">
        {lista.map((x) => (
          <button
            key={x.id}
            type="button"
            className={'pastilla-habilidad' + (valor === x.id ? ' sel' : '')}
            onClick={() => onElegir(x.id)}
            aria-pressed={valor === x.id}
          >
            {x.nombre || x.id}
          </button>
        ))}
      </div>
    </div>
  )
}
