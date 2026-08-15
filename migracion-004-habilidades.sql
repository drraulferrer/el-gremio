-- Migración 004 · habilidades, niveles de premio y elogio específico.
--
-- Ejecuta este fichero en el SQL Editor de Supabase si ya tenías el
-- esquema creado. Si empiezas de cero, schema.sql ya lo incluye.
-- Es idempotente.
--
-- Qué cambia y por qué:
--
--   challenges.skill      Cada misión entrena una habilidad. Es el giro
--                         del sistema: deja de ser "una tarea que se
--                         cobra" y pasa a ser "un entrenamiento".
--
--   rewards.tier          1 decidir · 2 vivir · 3 celebrar. Sirve para
--                         que la tienda no se llene de premios grandes,
--                         que son los que peor sostienen el hábito.
--
--   completions.praise    El elogio concreto que escribe quien valida.
--                         Es el componente con más respaldo de todo el
--                         sistema (Leijten 2019; Owen 2012) y hasta
--                         ahora se perdía en el aire.

alter table public.challenges
  add column if not exists skill text
    check (skill is null or skill in (
      'hogar','salud','aprendizaje','amabilidad',
      'responsabilidad','cooperacion','creatividad','autonomia'
    ));

alter table public.rewards
  add column if not exists tier integer not null default 2
    check (tier between 1 and 3);

alter table public.completions
  add column if not exists praise text;

create index if not exists idx_challenges_skill on public.challenges (family_id, skill);

-- IMPORTANTE: `create or replace` no sustituye la función si cambia la
-- firma, deja una sobrecarga, y entonces PostgREST no sabe cuál llamar
-- (PGRST203). Se retira la versión de dos argumentos ANTES de crear la
-- nueva.
drop function if exists public.resolve_completion(uuid, text);

-- El elogio viaja con la validación, de forma atómica: si se abona la XP
-- se guarda el elogio, y si no, ninguna de las dos cosas.
create or replace function public.resolve_completion(
  c_id uuid,
  new_status text,
  praise_text text default null
)
returns void
language plpgsql
security invoker
as $$
declare c public.completions%rowtype;
begin
  if new_status not in ('aprobado','rechazado') then
    raise exception 'estado no válido';
  end if;
  select * into c from public.completions where id = c_id and status = 'pendiente' for update;
  if not found then return; end if;

  update public.completions
    set status = new_status,
        resolved_at = now(),
        praise = nullif(btrim(coalesce(praise_text, '')), '')
    where id = c_id;

  if new_status = 'aprobado' then
    update public.profiles set xp = xp + c.xp, coins = coins + c.coins where id = c.profile_id;
  end if;
end $$;
