-- Migración 016 · el camino de la racha se cobra una vez en la vida.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- ⚠️ El editor levantará el aviso «Potential issue detected · destructive
-- operations» por el `revoke` del final. No toca ni un dato: hay que
-- pulsar «Run query» y esperar el «Success. No rows returned». Si se
-- cierra ese diálogo sin pulsar, NO SE EJECUTA NADA y tampoco avisa.
--
-- Reutiliza `bonuses`, como el juego de globos y el premio a mano: los
-- tres son lo mismo —monedas que no vienen de una misión— y tenerlos
-- juntos hace que «de dónde salieron estas monedas» siga leyéndose de una
-- sola consulta. El tipo es 'racha:7', 'racha:30', etc.
--
-- LAS DOS REGLAS, y las dos viven aquí y no en el navegador:
--
--  1. Cada hito se paga UNA VEZ EN LA VIDA, no una por racha. Si se rompe
--     y se vuelve a los siete días, no se cobra otra vez. Sin esto, romper
--     la racha a propósito cada semana sería la forma más rentable de
--     jugar y el sistema premiaría lo contrario de lo que quiere premiar.
--  2. La racha se COMPRUEBA aquí. El cliente dice «he llegado a 7» y
--     Postgres lo verifica contra las misiones aprobadas antes de pagar,
--     porque quien pide el cobro es la misma pantalla que dibuja el
--     contador y no puede ser también quien lo certifique.
--
-- Las monedas las decide esta función, no quien llama: si el importe
-- viajara como argumento, el tope contra el dedo gordo sería un tope
-- contra nada.

-- ------------------------------------------------------------------
-- 1. Un hito, un cobro
-- ------------------------------------------------------------------

create unique index if not exists idx_bonuses_hito_una_vez
  on public.bonuses (profile_id, tipo)
  where tipo like 'racha:%';

-- ------------------------------------------------------------------
-- 2. El cobro, con la racha verificada
--
-- Devuelve texto, como el resto de RPC:
--   'ok'          → cobrado, monedas abonadas
--   'ya_cobrado'  → ese hito ya se pagó. NO es un error: es el caso normal
--                   de volver a abrir la pantalla
--   'aun_no'      → la racha real no llega a ese hito
--   'hito_invalido' · 'no_existe' · 'no_es_tuyo'
-- ------------------------------------------------------------------

create or replace function public.claim_streak(p_id uuid, p_hito integer)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_coins integer;
  v_racha integer := 0;
  v_dia date;
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  -- El importe lo pone la base. La tabla de hitos vive también en
  -- src/lib/rachas.js y hay un test que compara las dos: si se añade un
  -- hito allí y no aquí, el test cae antes que la familia.
  v_coins := case p_hito
    when 3 then 5
    when 7 then 15
    when 14 then 25
    when 21 then 40
    when 30 then 60
    when 50 then 100
    when 100 then 200
    else null
  end;

  if v_coins is null then
    return 'hito_invalido';
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

  -- La racha, contada aquí y no aceptada de quien llama.
  --
  -- Se camina hacia atrás día a día, igual que en el cliente, en vez de
  -- resolverlo con ventanas: son cuatro líneas más largas y cualquiera
  -- que abra esto dentro de un año entiende exactamente qué cuenta.
  -- Un día vale si tiene una misión aprobada O si está tapado con un
  -- comodín, que para eso existe el comodín.
  --
  -- Se empieza por hoy; si hoy aún no hay nada, se empieza por ayer: el
  -- día no ha terminado y la racha sigue viva.
  v_dia := v_hoy;
  if not exists (
    select 1 from public.completions
     where profile_id = p_id and status = 'aprobado' and resolved_at is not null
       and (resolved_at at time zone 'Europe/Madrid')::date = v_dia
  ) and not exists (
    select 1 from public.power_uses
     where profile_id = p_id and tipo = 'salva_racha'
       and (used_at at time zone 'Europe/Madrid')::date = v_dia
  ) then
    v_dia := v_dia - 1;
  end if;

  while v_racha < 400 loop
    exit when not (
      exists (
        select 1 from public.completions
         where profile_id = p_id and status = 'aprobado' and resolved_at is not null
           and (resolved_at at time zone 'Europe/Madrid')::date = v_dia
      )
      or exists (
        select 1 from public.power_uses
         where profile_id = p_id and tipo = 'salva_racha'
           and (used_at at time zone 'Europe/Madrid')::date = v_dia
      )
    );
    v_racha := v_racha + 1;
    v_dia := v_dia - 1;
  end loop;

  if v_racha < p_hito then
    return 'aun_no';
  end if;

  -- La carrera se resuelve en el insert, igual que en el juego de globos:
  -- dos pestañas abiertas entran las dos y una se lleva la violación de
  -- unicidad. Comprobar antes con un select dejaría la ventana abierta.
  begin
    insert into public.bonuses (family_id, profile_id, tipo, coins, motivo)
    values (v_family, p_id, 'racha:' || p_hito, v_coins, 'Racha de ' || p_hito || ' días');
  exception when unique_violation then
    return 'ya_cobrado';
  end;

  -- Solo monedas, como el premio a mano: la XP marca el nivel y alimenta
  -- la meta, y las dos están calculadas contra un ritmo de misiones.
  update public.profiles set coins = coins + v_coins where id = p_id;

  return 'ok';
end $fn$;

revoke all on function public.claim_streak(uuid, integer) from public;
grant execute on function public.claim_streak(uuid, integer) to authenticated;

-- Qué rachas se han cobrado y cuándo:
--
-- select b.created_at, p.name, b.tipo, b.coins
--   from public.bonuses b join public.profiles p on p.id = b.profile_id
--  where b.tipo like 'racha:%'
--  order by b.created_at desc;
