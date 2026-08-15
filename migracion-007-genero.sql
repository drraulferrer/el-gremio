-- Migración 007 · género de cada perfil, para que el texto concuerde.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- El castellano marca género en adjetivos y participios, y la app le
-- habla a cada persona de tú ("lo has resuelto tú sola"). Sin este dato
-- solo caben dos salidas malas: hablar a todo el mundo en masculino, o
-- llenar la pantalla de barras y arrobas que nadie lee en voz alta.
--
-- 'neutro' es el valor por defecto y significa "no se ha dicho": la app
-- usa entonces frases reescritas que no necesitan marca de género. No es
-- un tercer sexo, es la ausencia de dato.

alter table public.profiles
  add column if not exists gender text not null default 'neutro'
    check (gender in ('femenino', 'masculino', 'neutro'));

-- Las misiones creadas ANTES de este cambio guardan el título literal
-- ("Vestirse sola"), así que no concordarían con nadie. Se pasan a la
-- forma con marcas. Solo afecta a los dos títulos del catálogo que
-- hablan de quien hace la misión; los demás son neutros de partida.
update public.challenges
  set title = 'Vestirse {solo|sola|sin ayuda}'
  where title in ('Vestirse sola', 'Vestirse solo');

update public.challenges
  set title = 'Resolver un problema {solo|sola|sin ayuda}'
  where title in ('Resolver un problema sola', 'Resolver un problema solo');
