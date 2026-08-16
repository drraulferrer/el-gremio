-- ------------------------------------------------------------------
-- Migración 018 · zona horaria por familia y borrado de cuenta
--
-- Dos cosas que no se notan con una familia en Madrid y que bloquean
-- cualquier otra:
--
-- 1. LA ZONA HORARIA ESTABA CLAVADA. `bonuses.dia`, `claim_streak` y el
--    `dayKey` del navegador daban por hecho Europe/Madrid unos y la hora
--    del dispositivo otro. Para una familia en Madrid coinciden y no se
--    nota nada. Para una en México se separan siete horas: la estrella
--    diaria de la peque se puede pedir dos veces o ninguna, y una racha
--    viva se lee como rota. Es el peor tipo de fallo: da resultados
--    incorrectos EN SILENCIO.
--
-- 2. NO HABÍA FORMA DE BORRAR LA CUENTA. Esto guarda actividad diaria de
--    menores. Sin borrado efectivo no se puede abrir el registro a nadie
--    de fuera, y menos cobrar. El borrado tiene que llevarse por delante
--    también la cuenta de autenticación, o queda un correo huérfano en
--    `auth.users` que nadie puede quitar desde la app.
--
-- Idempotente. Ejecutar entera en el SQL Editor.
--
-- ⚠ El editor levantará el aviso «This query includes destructive
--   operations» por los `revoke`. Hay que pulsar «Run query» y esperar el
--   «Success. No rows returned»: si se cierra el diálogo, NO ejecuta nada
--   y tampoco avisa de que no lo ha hecho.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- Paso 1 · la zona vive en la familia
--
-- Por defecto Europe/Madrid, que es lo que las familias que ya están
-- dentro tienen de facto: cambiar el valor por defecto a otra cosa les
-- movería el día bajo los pies.
-- ------------------------------------------------------------------

alter table public.families
  add column if not exists timezone text not null default 'Europe/Madrid';

-- Se valida contra el catálogo de Postgres, no contra una lista escrita a
-- mano: una lista propia envejece cada vez que un país cambia de horario.
-- Va en disparador y no en `check` porque un check no puede consultar una
-- tabla.
create or replace function public.zona_valida()
returns trigger
language plpgsql
as $fn$
begin
  if new.timezone is null
     or not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'zona horaria desconocida: %', new.timezone;
  end if;
  return new;
end $fn$;

drop trigger if exists families_zona_valida on public.families;
create trigger families_zona_valida
  before insert or update of timezone on public.families
  for each row execute function public.zona_valida();

-- La zona de la familia a la que pertenece un perfil. Devuelve siempre
-- algo: si el perfil no existe, la de por defecto, porque quien la llama
-- ya comprueba la pertenencia por su cuenta y aquí un null solo serviría
-- para reventar la fecha.
create or replace function public.zona_de_perfil(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select f.timezone
       from public.profiles p
       join public.families f on f.id = p.family_id
      where p.id = p_id),
    'Europe/Madrid'
  );
$fn$;

-- ------------------------------------------------------------------
-- Paso 2 · el juego diario de la peque, en la zona de su casa
--
-- El `dia` deja de venir del valor por defecto de la columna y se calcula
-- al insertar. El valor por defecto se queda como red: si algún día entra
-- una fila por otro camino, no cae en null.
-- ------------------------------------------------------------------

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

  update public.profiles set coins = coins + v_coins where id = p_id;
  return 'ok';
end $fn$;

revoke all on function public.grant_daily_bonus(uuid, text) from public;
grant execute on function public.grant_daily_bonus(uuid, text) to authenticated;

-- ------------------------------------------------------------------
-- Paso 3 · el premio a mano, igual
-- ------------------------------------------------------------------

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
  v_tz text;
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
  update public.profiles set coins = coins + p_coins where id = p_id;

  return 'ok';
end $fn$;

revoke all on function public.grant_manual_bonus(uuid, integer, text, uuid) from public;
grant execute on function public.grant_manual_bonus(uuid, integer, text, uuid) to authenticated;

-- ------------------------------------------------------------------
-- Paso 4 · la racha, contada en la zona de la familia
--
-- Aquí es donde más se notaba: con el servidor en Madrid y el móvil en
-- Ciudad de México, «hoy» eran dos días distintos y el camino de rachas
-- —que se paga UNA VEZ EN LA VIDA— podía quedar fuera de alcance para
-- siempre por una diferencia de husos.
-- ------------------------------------------------------------------

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
  v_racha integer := 0;
  v_dia date;
  v_hoy date;
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

  select timezone into v_tz from public.families where id = v_family;
  v_hoy := (now() at time zone v_tz)::date;

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
       and (resolved_at at time zone v_tz)::date = v_dia
  ) and not exists (
    select 1 from public.power_uses
     where profile_id = p_id and tipo = 'salva_racha'
       and (used_at at time zone v_tz)::date = v_dia
  ) then
    v_dia := v_dia - 1;
  end if;

  while v_racha < 400 loop
    exit when not (
      exists (
        select 1 from public.completions
         where profile_id = p_id and status = 'aprobado' and resolved_at is not null
           and (resolved_at at time zone v_tz)::date = v_dia
      )
      or exists (
        select 1 from public.power_uses
         where profile_id = p_id and tipo = 'salva_racha'
           and (used_at at time zone v_tz)::date = v_dia
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
  -- unicidad. El índice único es (profile_id, tipo) para 'racha:%', sin
  -- el día: por eso cada hito se paga una vez en la vida.
  begin
    insert into public.bonuses (family_id, profile_id, tipo, coins, motivo, dia)
    values (v_family, p_id, 'racha:' || p_hito, v_coins,
            'Racha de ' || p_hito || ' días', v_hoy);
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

-- ------------------------------------------------------------------
-- Paso 5 · borrar la cuenta entera desde la app
--
-- Se lleva por delante el gremio (y con él, en cascada, perfiles,
-- misiones, historial, premios, insignias, bonus, poderes y registros) y
-- después la propia cuenta de `auth.users`.
--
-- Va en la base y no en una Edge Function a propósito: una Edge Function
-- exige la CLI de Supabase y una clave de servicio guardada en algún
-- sitio. Aquí el permiso lo da ser `security definer` con dueño
-- `postgres`, y la única fila que puede tocar es la de `auth.uid()`.
--
-- No hay confirmación por argumento (ni «escribe BORRAR») porque eso vive
-- en la interfaz. Lo que sí hay es que no se puede borrar la cuenta de
-- otro: no se acepta ningún identificador desde fuera.
-- ------------------------------------------------------------------

create or replace function public.delete_my_account()
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_gremios integer;
begin
  if v_uid is null then
    return 'sin_sesion';
  end if;

  delete from public.families where owner = v_uid;
  get diagnostics v_gremios = row_count;

  -- Los registros SIN familia no se tocan, y conviene saber por qué: son
  -- errores anteriores a saber de qué casa era la sesión, no tienen forma
  -- fiable de atribuirse a una cuenta, y borrarlos por sesión se llevaría
  -- por delante los de otra gente. Los barre `purge_logs` por antigüedad,
  -- que para eso es `security definer`. Los que SÍ llevan familia se van
  -- en la cascada de arriba.
  delete from public.user_limits where user_id = v_uid;
  delete from auth.users where id = v_uid;

  if v_gremios = 0 then
    return 'ok_sin_gremio';
  end if;
  return 'ok';
end $fn$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ------------------------------------------------------------------
-- Comprobación. Pegar después de ejecutar; debe salir todo a 1.
-- ------------------------------------------------------------------

-- select
--   (select count(*) from information_schema.columns
--      where table_schema='public' and table_name='families' and column_name='timezone') as col_timezone,
--   (select count(*) from pg_trigger where tgname='families_zona_valida') as disparador,
--   (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--      where n.nspname='public' and p.proname='zona_de_perfil') as fn_zona,
--   (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--      where n.nspname='public' and p.proname='delete_my_account') as fn_borrado,
--   (select count(distinct timezone) from public.families) as zonas_distintas;
