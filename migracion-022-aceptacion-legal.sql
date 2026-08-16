-- Migración 022 · qué versión de los textos aceptó cada gremio.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente y no toca ni un dato.
--
-- La aceptación se pide en la pantalla de alta (una casilla que bloquea
-- el botón) y se guarda en DOS sitios a propósito:
--
--  1. En los metadatos de la cuenta, al registrarse. Existe desde el
--     primer instante, incluso antes de confirmar el correo, que es
--     justo cuando todavía no hay gremio donde escribir.
--  2. Aquí, al fundar el gremio, que es el primer momento con sesión.
--
-- Guardar la VERSIÓN y no un simple `true` es lo que hace que esto sirva
-- de algo: dentro de un año, «aceptó las condiciones» no dice nada si
-- nadie sabe qué decían entonces. La versión es la fecha del documento y
-- vive también en src/lib/legal.js, que es lo que pinta la casilla.
--
-- Si algún día cambian los textos de forma relevante: sube la versión en
-- `src/lib/legal.js` y en los dos HTML, y compara con esta columna para
-- saber a quién hay que volver a preguntar.

alter table public.families add column if not exists legal_version text;
alter table public.families add column if not exists legal_at timestamptz;

comment on column public.families.legal_version is
  'Versión de los textos legales aceptada al fundar el gremio (fecha, p.ej. 2026-08-16).';
comment on column public.families.legal_at is
  'Cuándo se aceptó. Se rellena en el alta; los gremios anteriores a la 022 lo tienen a null.';

-- Los gremios creados antes de que existiera la casilla se quedan a null
-- a propósito, y no se rellenan con una fecha inventada: null significa
-- «nadie lo aceptó porque todavía no se pedía», que es la verdad. Cuando
-- haya que pedirlo a los ya existentes, es justo la consulta que los
-- encuentra:
--
--   select id, name from public.families where legal_version is null;

-- ------------------------------------------------------------------
-- Comprobación
-- ------------------------------------------------------------------
-- select count(*) filter (where legal_version is not null) as con_aceptacion,
--        count(*) as gremios
-- from public.families;
