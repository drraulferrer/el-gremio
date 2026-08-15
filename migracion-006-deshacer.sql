-- Migración 006 · deshacer una misión.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Por qué hace falta: con una peque de tres años tocando botones, el toque
-- equivocado no es una hipótesis, es el martes. Y un adulto también valida
-- de más cuando tiene cinco cosas pendientes y el móvil en una mano.
--
-- Qué hace: borra la petición y, si ya estaba aprobada, devuelve la XP y
-- las monedas. Es lo contrario exacto de resolve_completion.
--
-- Límite honesto: si las monedas YA se gastaron en un premio, no se pueden
-- recuperar de la nada. En ese caso el saldo se queda en cero en lugar de
-- irse a negativo, y el canje sigue en pie: se cancela a mano desde el
-- panel si procede.

create or replace function public.undo_completion(c_id uuid)
returns text
language plpgsql
security invoker
as $$
declare c public.completions%rowtype;
begin
  select * into c from public.completions where id = c_id for update;
  if not found then return 'no_existe'; end if;

  -- Solo se devuelve lo que se llegó a abonar.
  if c.status = 'aprobado' then
    update public.profiles
      set xp = greatest(0, xp - c.xp),
          coins = greatest(0, coins - c.coins)
      where id = c.profile_id;
  end if;

  delete from public.completions where id = c_id;
  return 'ok';
end $$;
