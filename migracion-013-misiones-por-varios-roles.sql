-- Migración 013 · una misión puede ir a VARIOS roles.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Sustituye al `target_role` de la migración 011, que solo aguantaba un
-- rol. El caso que lo tumbó llegó el mismo día: «poner la mesa» la hacen
-- la junior y la peque, cada una a su manera, y no pinta nada en el
-- tablero de los adultos. Con un solo rol había que volver a duplicar la
-- misión, que es exactamente el problema que la 011 venía a quitar.
--
-- La 011 estuvo viva media hora y con una sola fila usándola («Hobby»),
-- así que se migra el dato y se retira la columna en vez de arrastrar dos
-- fuentes de verdad. El cliente lee las dos durante la transición
-- (src/lib/misiones.js, función `rolesDe`), de modo que da igual el orden
-- entre desplegar y ejecutar esto.

alter table public.challenges
  add column if not exists target_roles text[];

-- Traer lo que hubiera en la columna de una sola pieza.
update public.challenges
   set target_roles = array[target_role]
 where target_role is not null
   and (target_roles is null or cardinality(target_roles) = 0);

-- Que no se cuele un rol inventado. Se añade solo si no existe ya, porque
-- `add constraint` no admite `if not exists`.
do $$ begin
  alter table public.challenges
    add constraint challenges_target_roles_validos
    check (
      target_roles is null
      or (cardinality(target_roles) > 0
          and target_roles <@ array['adulto','junior','peque']::text[])
    );
exception when duplicate_object then null; end $$;

-- Comprobar que no queda nada por migrar ANTES de retirar la columna:
--
-- select count(*) as sin_migrar from public.challenges
--  where target_role is not null and target_roles is null;
--
-- Debe dar 0. Entonces, y solo entonces:
--
-- alter table public.challenges drop column if exists target_role;
--
-- Va comentado a propósito: retirar la columna con un cliente antiguo
-- todavía en la calle deja a esas misiones sin destino, y en la app eso
-- se lee como «para todos» — es decir, las de adultos aparecerían en la
-- pantalla de la peque. Primero despliega, comprueba, y luego bórrala.

-- Comprobación:
--
-- select title, target_roles, profile_id is null as sin_persona, active
--   from public.challenges
--  where target_roles is not null or target_role is not null
--  order by title;
