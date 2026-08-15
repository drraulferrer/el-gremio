-- Migración 001 · frecuencia mensual
-- Solo hace falta si ejecutaste schema.sql ANTES de esta versión.
-- Si aún no habías creado el proyecto de Supabase, ignora este fichero:
-- el schema.sql actual ya la incluye.

alter table public.challenges drop constraint if exists challenges_frequency_check;
alter table public.challenges
  add constraint challenges_frequency_check
  check (frequency in ('diario','semanal','mensual','unico'));
