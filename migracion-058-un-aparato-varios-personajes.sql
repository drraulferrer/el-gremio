-- Migracion 058 · un aparato, varios personajes.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Lo ultimo que quedaba de la Fase 6 en el servidor: los avisos con varios
-- gremios.
--
-- ------------------------------------------------------------------
-- LA PREGUNTA QUE PARECIA SER Y LA QUE ERA
--
-- Durante tres sesiones esto se apunto como "decidir si los avisos son del
-- gremio o de la persona". Al mirar como funciona el envio de verdad, esa
-- pregunta no tiene sentido:
--
--   * `notificar` YA elige a quien avisar **por `profile_id`**, no por
--     gremio. Los avisos son de un PERSONAJE desde siempre.
--   * y no pueden ser "de la persona": lo que dicen es "hoy te falta una
--     mision" o "tu racha", calculado en el DIA de ese gremio, con SU zona
--     horaria. Una persona en tres gremios tiene tres dias distintos y tres
--     rachas distintas. No hay version personal de ese mensaje.
--
-- Lo unico que estorbaba era esto: `push_subs.endpoint` era UNICO, o sea
-- **una fila por aparato**. Un movil solo podia estar suscrito a un
-- personaje, y cambiar de gremio repuntaba esa fila y te dejaba sin los
-- avisos del otro sin decirtelo.
--
-- Asi que la clave pasa a ser **(endpoint, profile_id)**. Y la Edge Function
-- NO se toca: ya consultaba por `profile_id`.
--
-- ------------------------------------------------------------------
-- LO QUE NO CAMBIA PARA NADIE HOY
--
-- Las filas que existen se quedan como estan: una por aparato. Nadie queda
-- suscrito a nada a lo que no lo estuviera. La familia de hoy no nota nada;
-- lo que cambia es que a partir de ahora PUEDE haber mas de una.
--
-- Y `push_log` ya impide el ruido por su cuenta: lleva un apunte por
-- (personaje, dia, franja), asi que un aparato con tres personajes recibe
-- como mucho un aviso de cada uno por franja, no tres del mismo.
-- ------------------------------------------------------------------

-- El indice de aparato deja de ser unico y pasa a serlo por personaje.
alter table public.push_subs drop constraint if exists push_subs_endpoint_key;

create unique index if not exists idx_push_subs_aparato_personaje
  on public.push_subs (endpoint, profile_id);

-- Y `endpoint` conserva el suyo, no unico: apagar los avisos de este aparato
-- borra TODAS sus filas de golpe, y esa consulta filtra solo por endpoint.
create index if not exists idx_push_subs_endpoint
  on public.push_subs (endpoint);

comment on index public.idx_push_subs_aparato_personaje is
  'Un aparato puede estar suscrito a varios personajes: uno por gremio (058). Antes era una fila por aparato y cambiar de gremio te dejaba sin los avisos del otro.';
