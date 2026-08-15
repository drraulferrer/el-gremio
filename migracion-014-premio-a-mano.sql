-- Migración 014 · premio a mano: monedas extra por algo excepcional.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Reutiliza la tabla `bonuses` que creó la 012 para el juego de globos:
-- las dos cosas son lo mismo —monedas que no vienen de una misión— y
-- tenerlas juntas hace que el historial de «de dónde salieron estas
-- monedas» se lea en una sola consulta.
--
-- Tres reglas, y las tres se garantizan AQUÍ y no solo en la interfaz,
-- porque una regla que solo vive en el navegador no es una regla:
--
--  1. No da XP. La función solo toca `coins`. La XP marca el nivel y
--     alimenta la meta del gremio, y las dos están calculadas contra un
--     ritmo; un extra a mano que subiera de nivel convertiría el premio
--     excepcional en la vía rápida.
--  2. El motivo es obligatorio: `not null` con longitud mínima.
--  3. Lo concede un adulto, y queda registrado cuál. La función comprueba
--     el rol contra la tabla, no se fía de quien llama.

alter table public.bonuses
  add column if not exists motivo text,
  add column if not exists otorgado_por uuid references public.profiles(id) on delete set null;

-- El tope de «uno al día» era para el juego. Un premio a mano puede darse
-- varias veces el mismo día —la vida no viene de uno en uno—, así que la
-- restricción pasa a ser un índice PARCIAL que deja fuera los manuales.
alter table public.bonuses drop constraint if exists bonuses_profile_id_dia_tipo_key;

create unique index if not exists idx_bonuses_uno_al_dia
  on public.bonuses (profile_id, dia, tipo)
  where tipo <> 'manual';

create or replace function public.grant_manual_bonus(
  p_id uuid,
  p_coins integer,
  p_motivo text,
  p_otorgado_por uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_rol_quien text;
  v_family_quien uuid;
begin
  -- Tope contra el dedo gordo: teclear 500 donde iban 50 descuadra la
  -- economía de un mes, y eso sí pasa. No es antifraude.
  if p_coins is null or p_coins <= 0 or p_coins > 200 then
    return 'cantidad_invalida';
  end if;

  if p_motivo is null or length(btrim(p_motivo)) < 3 then
    return 'sin_motivo';
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

  -- Quién lo concede: tiene que ser adulto, activo y de la misma familia.
  select role, family_id into v_rol_quien, v_family_quien
    from public.profiles where id = p_otorgado_por and active;

  if v_rol_quien is null or v_family_quien is distinct from v_family then
    return 'quien_no_existe';
  end if;

  if v_rol_quien <> 'adulto' then
    return 'no_es_adulto';
  end if;

  insert into public.bonuses (family_id, profile_id, tipo, coins, motivo, otorgado_por)
  values (v_family, p_id, 'manual', p_coins, btrim(p_motivo), p_otorgado_por);

  -- Solo monedas. La XP no se toca a propósito.
  update public.profiles set coins = coins + p_coins where id = p_id;

  return 'ok';
end $fn$;

revoke all on function public.grant_manual_bonus(uuid, integer, text, uuid) from public;
grant execute on function public.grant_manual_bonus(uuid, integer, text, uuid) to authenticated;

-- El historial de monedas que no vienen de misiones:
--
-- select b.created_at, p.name as para, b.tipo, b.coins, b.motivo,
--        q.name as lo_concedio
--   from public.bonuses b
--   join public.profiles p on p.id = b.profile_id
--   left join public.profiles q on q.id = b.otorgado_por
--  order by b.created_at desc;
