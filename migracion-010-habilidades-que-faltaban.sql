-- Migración 010 · asignar la habilidad a las misiones que no la tenían.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Es idempotente: solo
-- toca las filas con `skill is null`, así que volver a ejecutarlo no pisa
-- ninguna elección posterior.
--
-- La columna `skill` la creó la migración 004, pero las misiones que ya
-- existían se quedaron a null y nadie las rellenó: 16 de 19, incluidas las
-- ocho de los adultos. El efecto es que «Habilidades, no tareas» —lo que
-- según docs/FUNDAMENTO-CIENTIFICO.md separa un sistema que aguanta de uno
-- que se apaga en la semana tres— estaba construido y girando en el vacío:
-- rangos, progreso por competencia y pantalla de habilidades alimentados
-- por tres misiones de diecinueve.
--
-- Criterio, por orden de preferencia:
--   1. Si el título existe igual en el catálogo (src/lib/tareas.js), se usa
--      la habilidad que el catálogo ya le da. Sin opinión nueva.
--   2. Si existe una variante casi idéntica, la de la variante.
--   3. Si no hay equivalente —las cuatro de los adultos, que el catálogo no
--      cubre—, se elige por el lema de la habilidad en habilidades.js.
--
-- Las dos únicas discutibles, por si alguien quiere cambiarlas:
--   · «Cena sin móviles» → amabilidad («tratar bien a quien tienes cerca»)
--     y no cooperación, porque no se trata de sacar nada adelante en
--     equipo, sino de estar presente con quien tienes delante.
--   · «Leer antes de dormir» → aprendizaje y no salud: la misión es leer,
--     no dormir. Si lo que se quería premiar era la rutina de sueño,
--     cámbiala a 'salud'.

update public.challenges set skill = case
  when title like 'Cena sin m%'             then 'amabilidad'
  when title like 'Leer antes de dormir%'   then 'aprendizaje'
  when title like 'Mover el cuerpo%'        then 'salud'
  when title like 'Planificar el men%'      then 'hogar'
  when title like 'Leer 20 minutos%'        then 'aprendizaje'
  when title like 'Poner o quitar la mesa%' then 'cooperacion'
  when title like 'Preparar la mochila%'    then 'autonomia'
  when title like 'Apagar las luces%'       then 'hogar'
  when title like 'Guardar los cuentos%'    then 'responsabilidad'
  when title like 'Lavarse los dientes%'    then 'salud'
  when title like 'Llevar la ropa sucia%'   then 'responsabilidad'
  when title like 'Recoger los juguetes%'   then 'responsabilidad'
  when title like 'Vestirse%'               then 'autonomia'
end
where skill is null;

-- Un título que no encaje en ningún `when` devuelve null y se queda como
-- estaba: la sentencia no puede borrar una habilidad ya puesta.
--
-- APLICADA el 15-ago-2026. Resultado: 19 de 19 con habilidad, ninguna a
-- null. La guarda `where skill is null` se ganó el sueldo con «Apagar las
-- luces», que ya tenía 'responsabilidad' puesta a mano: el `when` de esta
-- migración le habría dado 'hogar' y se respetó la elección anterior.
--
--   responsabilidad  5   Apagar las luces · Guardar los cuentos ·
--                        Llevar la ropa sucia al cesto · Ordenar tu ropa ·
--                        Recoger los juguetes
--   salud            3   Lavarse los dientes · Mover el cuerpo 30 minutos
--   aprendizaje      3   Leer 20 minutos · Leer antes de dormir
--   hogar            3   Planificar el menú semanal · Quitar el lavavajillas
--   autonomia        2   Preparar la mochila · Vestirse
--   amabilidad       2   Cena sin móviles
--   cooperacion      1   Poner o quitar la mesa
--   creatividad      0   ← ninguna misión la entrena
--
-- Ese cero de creatividad no lo arregla una migración: no hay ninguna
-- misión que la entrene porque no existe, no porque le falte la etiqueta.
-- El catálogo tiene candidatas (Dibujar, Juego libre sin pantallas).
--
-- Comprobación. Debe salir 0 en `sin_habilidad`:
--
-- select count(*) filter (where skill is null) as sin_habilidad,
--        count(*) as total
--   from public.challenges;
--
-- Y el reparto por competencia:
--
-- select skill, count(*) from public.challenges group by skill order by 2 desc;
