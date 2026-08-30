-- Migracion 043 · que ningun movimiento de monedas pueda escaparse.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- ------------------------------------------------------------------
-- LO QUE CAMBIA RESPECTO A LA 042
--
-- La 042 dejo el libro montado y una sola funcion escribiendo en el. El plan
-- era enganchar las otras siete a mano, y al ir a hacerlo se vio que ese
-- camino es una costumbre, no una garantia: funciona mientras nadie se
-- olvide, y el dia que alguien anada la novena funcion el saldo deja de
-- cuadrar sin que nadie se entere.
--
-- Asi que el libro lo escribe ahora un DISPARADOR sobre profiles. No hay
-- forma de mover una moneda sin dejar asiento. Cada funcion solo declara su
-- motivo justo antes —una linea— y si se olvida, el asiento sale como
-- 'desconocido': ruidoso y localizable, en vez de invisible.
--
-- ------------------------------------------------------------------
-- IDEMPOTENCIA: SOLO UNA DE LAS OCHO LA NECESITA
--
-- Seis ya estaban protegidas por su propio estado y no hacia falta tocarlas:
--
--   resolve_completion, resolve_redemption   filtran por status='pendiente'
--   undo_completion                          borra la fila
--   grant_daily_bonus, claim_streak          capturan unique_violation del
--                                            indice de bonuses
--   cerrar_campana_limpieza                  exige estado='activa'
--
-- La septima, redeem_reward, ya tiene su clave desde la 042.
--
-- La octava, grant_manual_bonus, es la unica sin guarda, y a proposito: un
-- premio a mano se puede repetir de verdad, y por eso el indice unico de
-- bonuses excluye el tipo 'manual'. Sin clave, un doble clic regala dos
-- veces. Estrena p_clave, con valor por defecto para no romper al cliente.
--
-- Anadir clave a las otras seis seria ceremonia: no protegen de nada que su
-- propio estado no proteja ya.
--
-- ------------------------------------------------------------------
-- AHORA SI: LA REGLA DE LA SUMA SE CUMPLE
--
-- Con las ocho enganchadas, la suma de los asientos con resultado 'ok'
-- reproduce el saldo, y el libro pasa a ser la verdad. Lo que la 042 avisaba
-- de que todavia no era.
-- ------------------------------------------------------------------

alter table public.movimientos_coins drop constraint if exists movimientos_coins_tipo_check;
alter table public.movimientos_coins add constraint movimientos_coins_tipo_check
  check (tipo in ('canje', 'devolucion_canje', 'mision', 'deshacer_mision',
                  'bonus_diario', 'bonus_manual', 'botin_limpieza', 'racha', 'desconocido'));

create or replace function public.motivo_coins(
  p_tipo text,
  p_ref uuid default null,
  p_clave text default null
)
returns void
language plpgsql
as $$
begin
  perform set_config('app.coins_tipo', coalesce(p_tipo, ''), true);
  perform set_config('app.coins_ref', coalesce(p_ref::text, ''), true);
  perform set_config('app.coins_clave', coalesce(p_clave, ''), true);
end $$;

create or replace function public.tg_movimiento_coins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_ref text;
begin
  if new.coins is not distinct from old.coins then return new; end if;
  v_ref := nullif(current_setting('app.coins_ref', true), '');

  insert into public.movimientos_coins
    (family_id, profile_id, tipo, importe, saldo_antes, saldo_despues, resultado, referencia, clave)
  values (
    new.family_id, new.id,
    coalesce(nullif(current_setting('app.coins_tipo', true), ''), 'desconocido'),
    new.coins - old.coins, old.coins, new.coins, 'ok',
    v_ref::uuid,
    nullif(current_setting('app.coins_clave', true), '')
  );

  -- El motivo se consume. Si el siguiente movimiento de la misma transaccion
  -- no declara el suyo, sale 'desconocido' en vez de heredar uno ajeno.
  perform set_config('app.coins_tipo', '', true);
  perform set_config('app.coins_ref', '', true);
  perform set_config('app.coins_clave', '', true);
  return new;
end $$;

drop trigger if exists trg_movimiento_coins on public.profiles;
create trigger trg_movimiento_coins
  after update of coins on public.profiles
  for each row execute function public.tg_movimiento_coins();

-- grant_manual_bonus estrena parametro: fuera la firma vieja, o la llamada con
-- cuatro argumentos se vuelve ambigua ("function is not unique").
drop function if exists public.grant_manual_bonus(uuid, integer, text, uuid);

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
    perform public.motivo_coins('mision', c.id);
    update public.profiles set xp = xp + c.xp, coins = coins + c.coins where id = c.profile_id;
  end if;
end $$;

create or replace function public.undo_completion(c_id uuid)
returns text
language plpgsql
security invoker
as $$
declare c public.completions%rowtype;
begin
  select * into c from public.completions where id = c_id for update;
  if not found then return 'no_existe'; end if;

  -- Una tarea de una operación de limpieza ya COMPLETADA no se deshace
  -- (migración 031): su botín se repartió contando esta tarea, y
  -- deshacerla dejaría monedas pagadas por trabajo que la base ya no
  -- considera hecho. Las de operaciones activas o expiradas se deshacen
  -- como siempre, que ahí no hay botín que descuadrar.
  if exists (
    select 1
      from public.challenges ch
      join public.campanas_limpieza ca on ca.id = ch.campana_id
     where ch.id = c.challenge_id and ca.estado = 'completada'
  ) then
    return 'campana_cerrada';
  end if;

  if c.status = 'aprobado' then
    perform public.motivo_coins('deshacer_mision', c.id);
    update public.profiles
      set xp = greatest(0, xp - c.xp),
          coins = greatest(0, coins - c.coins)
      where id = c.profile_id;
  end if;

  delete from public.completions where id = c_id;
  return 'ok';
end $$;

create or replace function public.redeem_reward(rw_id uuid, p_id uuid, p_clave text default null)
returns text
language plpgsql
security invoker
as $$
declare
  rw public.rewards%rowtype;
  p public.profiles%rowtype;
  v_previo text;
begin
  -- Idempotencia, antes de tocar nada. Mismo intento, misma respuesta.
  if p_clave is not null then
    select resultado into v_previo from public.movimientos_coins where clave = p_clave;
    if found then return v_previo; end if;
  end if;

  select * into rw from public.rewards where id = rw_id and active = true;
  if not found then return 'no_disponible'; end if;
  select * into p from public.profiles where id = p_id for update;
  if not found then return 'no_disponible'; end if;
  -- El premio y quien lo canjea, de la misma casa (041).
  if rw.family_id is distinct from p.family_id then return 'no_disponible'; end if;

  if p.coins < rw.cost then
    -- Un intento fallido tambien es historia: sin el, un pico de gente que
    -- no llega al premio no se ve en ninguna parte.
    perform public.anota_coins(p_id, 'canje', -rw.cost, p.coins, p.coins, 'sin_monedas', rw.id, p_clave);
    return 'sin_monedas';
  end if;

  perform public.motivo_coins('canje', rw.id, p_clave);
  update public.profiles set coins = coins - rw.cost where id = p_id;
  insert into public.redemptions (family_id, reward_id, profile_id, cost)
    values (rw.family_id, rw.id, p_id, rw.cost);
  return 'ok';
end $$;

create or replace function public.resolve_redemption(r_id uuid, new_status text)
returns void
language plpgsql
security invoker
as $$
declare r public.redemptions%rowtype;
begin
  if new_status not in ('entregado','cancelado') then
    raise exception 'estado no válido';
  end if;
  select * into r from public.redemptions where id = r_id and status = 'pendiente' for update;
  if not found then return; end if;
  update public.redemptions set status = new_status, resolved_at = now() where id = r_id;
  if new_status = 'cancelado' then
    perform public.motivo_coins('devolucion_canje', r.id);
    update public.profiles set coins = coins + r.cost where id = r.profile_id;
  end if;
end $$;

create or replace function public.grant_daily_bonus(p_id uuid, p_tipo text default 'globos')
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_tz text;
  v_coins integer := 5;   -- una estrella exacta (MONEDAS_POR_ESTRELLA)
begin
  select family_id into v_family from public.profiles where id = p_id and active;
  if v_family is null then
    return 'no_existe';
  end if;

  if not exists (
    select 1 from public.families f where f.id = v_family and f.owner = auth.uid()
  ) then
    return 'no_es_tuyo';
  end if;

  select timezone into v_tz from public.families where id = v_family;

  -- La carrera se resuelve aquí: dos toques simultáneos entran los dos al
  -- insert y uno se lleva la violación de unicidad. Comprobar antes con un
  -- select y luego insertar dejaría la ventana abierta.
  begin
    insert into public.bonuses (family_id, profile_id, tipo, coins, dia)
    values (v_family, p_id, p_tipo, v_coins, (now() at time zone v_tz)::date);
  exception when unique_violation then
    return 'ya_hoy';
  end;

  perform public.motivo_coins('bonus_diario');
  update public.profiles set coins = coins + v_coins where id = p_id;
  return 'ok';
end $fn$;

create or replace function public.grant_manual_bonus(
  p_id uuid,
  p_coins integer,
  p_motivo text,
  p_otorgado_por uuid,
  p_clave text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_tz text;
  v_rol_quien text;
  v_family_quien uuid;
begin
  -- Idempotencia. Es la UNICA de las ocho sin guarda propia: un premio a
  -- mano se puede repetir a proposito, y por eso el indice unico de bonuses
  -- excluye el tipo 'manual'. Sin clave, un doble clic regala dos veces.
  if p_clave is not null and exists (select 1 from public.movimientos_coins where clave = p_clave) then
    return 'ok';
  end if;
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

  select role, family_id into v_rol_quien, v_family_quien
    from public.profiles where id = p_otorgado_por and active;

  if v_rol_quien is null or v_family_quien is distinct from v_family then
    return 'quien_no_existe';
  end if;

  if v_rol_quien <> 'adulto' then
    return 'no_es_adulto';
  end if;

  select timezone into v_tz from public.families where id = v_family;

  insert into public.bonuses (family_id, profile_id, tipo, coins, motivo, otorgado_por, dia)
  values (v_family, p_id, 'manual', p_coins, btrim(p_motivo), p_otorgado_por,
          (now() at time zone v_tz)::date);

  -- Solo monedas. La XP no se toca a propósito: marca el nivel y alimenta
  -- la meta, y las dos están calculadas contra un ritmo.
  perform public.motivo_coins('bonus_manual', null, p_clave);
  update public.profiles set coins = coins + p_coins where id = p_id;

  return 'ok';
end $fn$;

create or replace function public.cerrar_campana_limpieza(p_campana uuid, p_quien uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_estado text;
  v_titulo text;
  v_termina date;
  v_rol text;
  v_family_quien uuid;
  v_tz text;
  v_hoy date;
  v_total integer;
  v_hechas integer;
  r record;
begin
  select family_id, estado, titulo, termina into v_family, v_estado, v_titulo, v_termina
    from public.campanas_limpieza where id = p_campana;
  if v_family is null then return 'no_existe'; end if;

  if not exists (
    select 1 from public.families f where f.id = v_family and f.owner = auth.uid()
  ) then
    return 'no_es_tuyo';
  end if;

  select role, family_id into v_rol, v_family_quien
    from public.profiles where id = p_quien and active;
  if v_rol is null or v_family_quien is distinct from v_family then return 'quien_no_existe'; end if;
  if v_rol <> 'adulto' then return 'no_es_adulto'; end if;

  if v_estado <> 'activa' then return 'ya_cerrada'; end if;

  select timezone into v_tz from public.families where id = v_family;
  v_hoy := (now() at time zone coalesce(v_tz, 'Europe/Madrid'))::date;

  select count(*),
         count(*) filter (where exists (
           select 1 from public.completions co
            where co.challenge_id = ch.id and co.status = 'aprobado'))
    into v_total, v_hechas
    from public.challenges ch
   where ch.campana_id = p_campana;

  if v_total > 0 and v_hechas = v_total then
    -- La misma cuenta que botinPrevisto en src/lib/limpieza.js: si se
    -- toca un redondeo, hay que tocar los dos sitios.
    begin
      for r in
        select co.profile_id, floor(sum(co.coins) / 2.0)::integer as botin
          from public.completions co
          join public.challenges ch on ch.id = co.challenge_id
         where ch.campana_id = p_campana and co.status = 'aprobado'
         group by co.profile_id
      loop
        if r.botin > 0 then
          insert into public.bonuses (family_id, profile_id, tipo, coins, motivo, otorgado_por, dia)
          values (v_family, r.profile_id, 'limpieza:' || p_campana::text, r.botin,
                  'Botín de «' || v_titulo || '»', p_quien, v_hoy);
          perform public.motivo_coins('botin_limpieza', p_campana);
          update public.profiles set coins = coins + r.botin where id = r.profile_id;
        end if;
      end loop;

      update public.campanas_limpieza set estado = 'completada', cerrada_at = now() where id = p_campana;
    exception when unique_violation then
      -- Dos adultos cerrando a la vez: el índice de «uno al día» de
      -- bonuses tumba al segundo al pagar el mismo botín, y su
      -- transacción entera se deshace —monedas incluidas—. El primero
      -- ya cerró: esto es un 'ya_cerrada' con otra cara, no un fallo.
      return 'ya_cerrada';
    end;
    return 'ok';
  end if;

  if v_hoy > v_termina then
    -- Lo no hecho se pausa, no se borra: pausada vuelve a la biblioteca
    -- del panel, y borrarla con historial ni siquiera dejaría (029).
    update public.challenges ch set active = false
     where ch.campana_id = p_campana
       and not exists (
         select 1 from public.completions co
          where co.challenge_id = ch.id and co.status = 'aprobado'
       );
    update public.campanas_limpieza set estado = 'expirada', cerrada_at = now() where id = p_campana;
    return 'expirada';
  end if;

  return 'aun_no';
end $fn$;

create or replace function public.claim_streak(p_id uuid, p_hito integer)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_tz text;
  v_coins integer;
  v_racha integer;
begin
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

  select p.family_id, f.timezone into v_family, v_tz
    from public.profiles p join public.families f on f.id = p.family_id
   where p.id = p_id and p.active;

  if v_family is null then
    return 'no_existe';
  end if;

  if not exists (
    select 1 from public.families f where f.id = v_family and f.owner = auth.uid()
  ) then
    return 'no_es_tuyo';
  end if;

  v_racha := public.streak_days(p_id, coalesce(v_tz, 'Europe/Madrid'));

  if v_racha < p_hito then
    return 'aun_no';
  end if;

  begin
    insert into public.bonuses (family_id, profile_id, tipo, coins, motivo)
    values (v_family, p_id, 'racha:' || p_hito, v_coins, 'Racha de ' || p_hito || ' días');
  exception when unique_violation then
    return 'ya_cobrado';
  end;

  perform public.motivo_coins('racha');
  update public.profiles set coins = coins + v_coins where id = p_id;

  return 'ok';
end $fn$;
