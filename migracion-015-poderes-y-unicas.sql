-- Migración 015 · los poderes se gastan y las únicas son únicas.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Cierra las dos cosas que el modelo de temporadas daba por hechas y que
-- hasta ahora solo existían en JavaScript:
--
--  1. Un poder gastable (comodín, voz de mando) tiene usos contados. Si la
--     cuenta vive en el navegador, recargar la página devuelve los usos.
--     Es exactamente el bug que tuvo el juego de globos, y se arregla
--     igual: la cuenta la lleva Postgres.
--  2. Una insignia `unica` la tiene UNA persona del gremio. Sin índice,
--     dos dispositivos otorgando a la vez se la dan a dos personas, y ser
--     la única era lo único que la hacía valer.
--
-- ANTES DE EJECUTAR, si el gremio lleva tiempo funcionando, comprueba que
-- no hay ya duplicados de las únicas (debe dar 0 filas, o el índice falla):
--
--   select family_id, code, count(*) from public.profile_badges
--    where code in ('primer_nivel10','mano_derecha','coleccionista')
--    group by 1,2 having count(*) > 1;

-- ------------------------------------------------------------------
-- 1. Los usos gastados
-- ------------------------------------------------------------------

create table if not exists public.power_uses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- La insignia que da el poder. Los usos se cuentan POR INSIGNIA y no por
  -- tipo: dos insignias distintas que den comodín dan sus usos cada una,
  -- que es lo que hace que ganar la segunda signifique algo.
  code text not null,
  tipo text not null check (tipo in ('salva_racha', 'asigna_tarea')),
  -- A quién se le encarga la misión (voz de mando). Nulo en los demás.
  target_id uuid references public.profiles(id) on delete set null,
  nota text,
  used_at timestamptz not null default now()
);

create index if not exists idx_power_uses_profile on public.power_uses (profile_id, code);
create index if not exists idx_power_uses_family on public.power_uses (family_id, used_at desc);

alter table public.power_uses enable row level security;

drop policy if exists power_uses_lectura on public.power_uses;
create policy power_uses_lectura on public.power_uses
  for select using (family_id in (select id from public.families where owner = auth.uid()));

-- Sin política de insert, igual que en `bonuses`: se entra por la función,
-- que es la que cuenta. Con insert abierto, gastar un uso sería escribir
-- una fila y no gastarlo sería no escribirla, o sea, nada.

do $$ begin alter publication supabase_realtime add table public.power_uses; exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------
-- 2. Las únicas, únicas de verdad
--
-- Índice PARCIAL y con los códigos escritos a mano. Es feo tener el
-- catálogo repetido en dos sitios (aquí y en src/lib/insignias.js), pero
-- la alternativa —una columna `clase` en profile_badges— sería el mismo
-- catálogo duplicado y además desincronizable fila a fila. Si algún día se
-- añade una insignia única, hay que añadirla también aquí, y el test
-- tests/insignias.test.js recuerda esa deuda.
--
-- «Mano derecha» cambia de dueño con cada meta: el índice no lo impide,
-- solo obliga a borrar la anterior antes de dar la nueva, que es
-- justamente lo que significa cambiar de dueño.
-- ------------------------------------------------------------------

create unique index if not exists idx_badges_unica_por_gremio
  on public.profile_badges (family_id, code)
  where code in ('primer_nivel10', 'mano_derecha', 'coleccionista');

-- ------------------------------------------------------------------
-- 3. Gastar un uso
--
-- Devuelve texto, como el resto de RPC del proyecto:
--   'ok'                 → gastado
--   'sin_usos'           → no le quedan (o el poder ya caducó)
--   'no_la_tienes'       → no tiene esa insignia
--   'poder_no_gastable'  → monedas_x y abre_premio no se gastan, se tienen
--   'sin_destino' · 'destino_no_existe' · 'a_ti_no' → voz de mando
--   'no_existe' · 'no_es_tuyo'
--
-- Qué comprueba Postgres y qué no, que es la parte importante:
--
--  · La cuenta de usos y que la insignia esté GANADA las comprueba aquí,
--    porque son las dos que el navegador puede falsear sin querer con solo
--    recargar o con una copia vieja de la app en caché.
--  · `p_usos` y `p_dias` vienen del catálogo del cliente. No son una
--    defensa: son el mismo tope contra el dedo gordo que en el premio a
--    mano, con un techo duro por si llega un disparate.
-- ------------------------------------------------------------------

create or replace function public.spend_power(
  p_id uuid,
  p_code text,
  p_tipo text,
  p_usos integer,
  p_dias integer default null,
  p_target uuid default null,
  p_nota text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_earned timestamptz;
  v_gastados integer;
  v_tope constant integer := 5;    -- techo duro de usos por insignia
  v_max_dias constant integer := 90;
begin
  if p_tipo is null or p_tipo not in ('salva_racha', 'asigna_tarea') then
    return 'poder_no_gastable';
  end if;

  select family_id into v_family from public.profiles where id = p_id and active;
  if v_family is null then
    return 'no_existe';
  end if;

  if not exists (
    select 1 from public.families f where f.id = v_family and f.owner = auth.uid()
  ) then
    return 'no_es_tuyo';
  end if;

  -- El `for update` es lo que serializa dos gastos simultáneos de la misma
  -- insignia: sin cerrojo los dos leerían «cero gastados» y entrarían los
  -- dos. Se bloquea la fila de la insignia, no la del perfil, para no
  -- frenar de paso las validaciones de misiones.
  select earned_at into v_earned
    from public.profile_badges
   where profile_id = p_id and code = p_code
   for update;

  if v_earned is null then
    return 'no_la_tienes';
  end if;

  -- Caducidad. Un poder permanente deja de ser premio y pasa a ser ventaja
  -- estructural: quien lo ganó primero se aleja del resto para siempre.
  if p_dias is not null and now() > v_earned + least(p_dias, v_max_dias) * interval '1 day' then
    return 'sin_usos';
  end if;

  select count(*) into v_gastados
    from public.power_uses
   where profile_id = p_id and code = p_code;

  if v_gastados >= least(coalesce(p_usos, 0), v_tope) then
    return 'sin_usos';
  end if;

  if p_tipo = 'asigna_tarea' then
    if p_target is null then
      return 'sin_destino';
    end if;
    if p_target = p_id then
      return 'a_ti_no';
    end if;
    if not exists (
      select 1 from public.profiles
       where id = p_target and active and family_id = v_family
    ) then
      return 'destino_no_existe';
    end if;
    if p_nota is null or length(btrim(p_nota)) < 3 then
      return 'sin_encargo';
    end if;
  end if;

  insert into public.power_uses (family_id, profile_id, code, tipo, target_id, nota)
  values (v_family, p_id, p_code, p_tipo, p_target, nullif(btrim(p_nota), ''));

  -- La voz de mando CREA la misión, no la anuncia. Va en la misma
  -- transacción que el gasto del uso a propósito: si se hicieran en dos
  -- llamadas desde el navegador, un fallo de red entre medias dejaría el
  -- uso gastado y a nadie encargado de nada.
  --
  -- Aparece en el tablero de quien la recibe sin una sola línea de interfaz
  -- nueva: es una misión única más, se valida como todas y desaparece de la
  -- lista al hacerla. Con XP y monedas de misión diaria corriente: encargar
  -- no puede ser la vía rápida para enriquecer a nadie.
  if p_tipo = 'asigna_tarea' then
    insert into public.challenges (family_id, profile_id, title, emoji, xp, coins, frequency, skill)
    values (v_family, p_target, left(btrim(p_nota), 80), '📣', 10, 5, 'unico', 'cooperacion');
  end if;

  return 'ok';
end $fn$;

revoke all on function public.spend_power(uuid, text, text, integer, integer, uuid, text) from public;
grant execute on function public.spend_power(uuid, text, text, integer, integer, uuid, text) to authenticated;

-- Comprobación de qué se ha gastado y quién lo gastó:
--
-- select u.used_at, p.name as quien, u.code, u.tipo,
--        t.name as a_quien, u.nota
--   from public.power_uses u
--   join public.profiles p on p.id = u.profile_id
--   left join public.profiles t on t.id = u.target_id
--  order by u.used_at desc;
