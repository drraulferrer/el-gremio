// ------------------------------------------------------------------
// «Mi ficha», la versión de tres años.
//
// El cuadro de mando del panel contesta las mismas preguntas con cifras y
// porcentajes, y a esta edad eso no es una versión resumida de nada: es
// texto que no se puede leer. Aquí las mismas respuestas van dibujadas.
//
//  · cuántas he hecho  → estrellas, una por misión, no un número
//  · qué días          → siete casillas, que se cuentan con los ojos
//  · qué hacemos todos → la barra del gremio, sin cifras
//  · qué me he llevado → los premios, con su emoji
//
// SOLO SE VE A SÍ MISMA, y eso no es una limitación técnica: la app no
// tiene ranking a propósito, y a los tres años una comparación no se lee
// como información, se lee como quién va ganando.
//
// Se abre tocando su propio avatar, que es el gesto más descubrible que
// hay para quien no sabe leer: tócate a ti para verte a ti.
// ------------------------------------------------------------------

import { useState } from 'react'
import Icono from '../components/Icono'
import Retrato from '../components/Retrato'
import EditorRetrato from '../components/EditorRetrato'
import { guardarRetrato } from '../lib/acciones'
import { semanaEnCasillas, resumenDePersona } from '../lib/resumen'
import { goalProgress } from '../lib/supabase'
import { flex } from '../lib/genero'
import { muroDe } from '../lib/muro'
import Muro from '../components/Muro'

// Tope de la fila de estrellas: cuarenta estrellas dibujadas no se
// cuentan, se convierten en textura. A partir de aquí se resume.
const ESTRELLAS_MAX = 12

export default function FichaPeque({ data, profile, genero, refresh, onCerrar }) {
  // Copia local: la figura se mueve al tocar, sin esperar a la ida y
  // vuelta. A los tres años una respuesta que tarda medio segundo se lee
  // como que el botón no funciona, y se vuelve a tocar.
  const [borrador, setBorrador] = useState(null)
  const perfilLocal = borrador || profile

  async function cambiarRetrato(cambios) {
    const siguiente = { ...perfilLocal, ...cambios }
    setBorrador(siguiente)
    const { ok } = await guardarRetrato({ profile, piezas: siguiente })
    if (ok) await refresh?.()
    // Sin cartel de error a propósito: si falla, la figura ya se ha
    // movido en su pantalla y un aviso que no puede leer no arregla nada.
    // El adulto lo verá en el panel, que es quien puede hacer algo.
  }

  const dias = semanaEnCasillas(profile, data.completions)
  const hechas = resumenDePersona(profile, data).completadas.semana

  const meta = data.goal
  const pct = meta
    ? Math.min(100, Math.round((100 * goalProgress(meta, data.completions)) / meta.target_xp))
    : 0

  const premioDe = (id) => data.rewards.find((r) => r.id === id)
  const mios = data.redemptions
    .filter((r) => r.profile_id === profile.id && r.status === 'entregado')
    .sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at))

  return (
    <div className="kid-tienda kid-ficha" role="dialog" aria-label={`La ficha de ${profile.name}`}>
      <div className="kid-tienda-cabecera">
        <Retrato perfil={perfilLocal} tamano={64} vista="cuerpo" disco={false} />
        <span className="kid-tienda-titulo crece">{profile.name}</span>
        <button className="kid-tienda-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <Icono nombre="cerrar" tamano={28} />
        </button>
      </div>

      <div className="kid-ficha-cuerpo">
        {/* Su retrato, en su ficha y no detrás del PIN.
            Aquí no hay explicación de fases ni de niveles: a los tres años
            eso no es un resumen, es texto que no se puede leer. Lo que sí
            entiende es tocar un color y ver que su figura cambia, y para
            eso no hace falta saber leer las etiquetas.
            Un adulto tiene el mismo editor en el panel para cuando quiera
            montárselo con ella. */}
        <p className="kid-ficha-rotulo">Cómo soy</p>
        <div className="kid-retrato">
          {/* Su figura grande y NADA de texto: la vista previa del editor
              explica lo de las fases y los niveles, que aquí no sirve de
              nada. Lo que ella necesita es verse cambiar mientras toca. */}
          <div className="kid-retrato-espejo">
            <Retrato perfil={perfilLocal} tamano={104} vista="cuerpo" disco={false} />
          </div>
          <EditorRetrato
            perfil={perfilLocal}
            onCambiar={cambiarRetrato}
            genero={profile.gender || 'neutro'}
            vistaPrevia={false}
          />
        </div>

        <p className="kid-ficha-rotulo">Esta semana</p>

        <div className="kid-semana" aria-label={`${hechas} misiones esta semana`}>
          {dias.map((d) => (
            <span
              key={d.clave}
              className={
                'kid-dia' +
                (d.hecho ? ' hecho' : '') +
                (d.hoy ? ' hoy' : '') +
                (d.futuro ? ' futuro' : '')
              }
            >
              <span className="kid-dia-letra">{d.letra}</span>
              <span className="kid-dia-marca" aria-hidden="true">{d.hecho ? '★' : ''}</span>
            </span>
          ))}
        </div>

        {hechas === 0 ? (
          <p className="kid-ficha-vacio">Todavía ninguna. ¡Hoy es un buen día!</p>
        ) : (
          <div className="kid-ficha-estrellas" aria-hidden="true">
            {Array.from({ length: Math.min(hechas, ESTRELLAS_MAX) }, (_, i) => (
              <span key={i}>★</span>
            ))}
            {hechas > ESTRELLAS_MAX && <span className="kid-mas">+{hechas - ESTRELLAS_MAX}</span>}
          </div>
        )}

        {meta && (
          <>
            <p className="kid-ficha-rotulo">Lo que hacemos todos juntos</p>
            <div className="kid-meta-barra" aria-label={`La meta del gremio va por ${pct} de cada 100`}>
              <span style={{ width: pct + '%' }} />
              <em aria-hidden="true">{meta.emoji}</em>
            </div>
          </>
        )}

        {/* Antes que los premios a propósito: lo que le han dicho pesa
            más que lo que se ha llevado, y en su pantalla el orden ES la
            jerarquía. La frase va pequeña, para el adulto que pase. */}
        <p className="kid-ficha-rotulo">Lo que me han dicho</p>
        <Muro
          elogios={muroDe({ completions: data.completions, reconocimientos: data.reconocimientos, perfiles: data.profiles }, profile.id)}
          challenges={data.challenges}
          formato="peque"
        />

        <p className="kid-ficha-rotulo">Mis premios</p>
        {mios.length === 0 ? (
          <p className="kid-ficha-vacio">Todavía ninguno. ¡Ya llegará!</p>
        ) : (
          <div className="kid-ficha-premios">
            {mios.map((r) => (
              <span className="kid-ficha-premio" key={r.id}>
                <span className="kid-ficha-premio-emoji">{premioDe(r.reward_id)?.emoji || '🎁'}</span>
                <span className="kid-ficha-premio-nombre">
                  {flex(premioDe(r.reward_id)?.title, genero) || 'Premio'}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
