-- Migración 003 · retirar miembros sin perder su historia.
--
-- Ejecuta este fichero en el SQL Editor de Supabase si ya tenías el
-- esquema creado. Si empiezas de cero, schema.sql ya lo incluye.
-- Es idempotente: correrlo dos veces no rompe nada.
--
-- Por qué una columna y no un borrado: borrar un perfil arrastra en
-- cascada sus misiones completadas, sus canjes y sus insignias, y con
-- ellos la XP que aportó a las metas ya cerradas. Retirar lo saca del
-- selector y lo deja fuera de juego, pero la historia del gremio queda
-- intacta.

alter table public.profiles
  add column if not exists active boolean not null default true;

create index if not exists idx_profiles_family_active
  on public.profiles (family_id, active);
