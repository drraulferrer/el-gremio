-- Migracion 045 · el aislamiento deja de ser propiedad y pasa a ser pertenencia.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Segundo paso de la Fase 2. Es el paso CONVIVIR de "ampliar -> convivir ->
-- contraer": las politicas aceptan LAS DOS condiciones a la vez.
--
-- ------------------------------------------------------------------
-- QUE CAMBIA, Y POR QUE HOY NO CAMBIA NADA
--
-- Hasta ahora, cada politica terminaba en la misma subconsulta:
--
--     family_id in (select id from public.families where owner = auth.uid())
--
-- que dice "este gremio es de mi cuenta". A partir de aqui todas preguntan a
-- `mis_gremios()`, que dice "a estos gremios llego yo", y que hoy responde con
-- TRES ramas: la propiedad de siempre, la credencial compartida de la 044
-- --que apunta al mismo gremio que la propiedad-- y la pertenencia activa, que
-- no tiene todavia ni una fila.
--
-- Asi que el conjunto que devuelve es, hoy, exactamente el mismo de ayer para
-- todo el mundo. Ese es el objetivo: desplegar el predicado nuevo y observarlo
-- funcionando ANTES de que nadie dependa de el.
--
-- La tercera rama es la que abre la puerta: el dia que exista una pertenencia,
-- esa persona vera los datos de ese gremio aunque la cuenta no sea suya, que es
-- justo lo que hoy es imposible.
--
-- ------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE, Y ES DELIBERADO
--
-- **No retira la rama de propiedad.** Ese es el paso CONTRAER, y hacerlo antes
-- de tiempo --mientras haya clientes viejos en la calle-- deja a esas casas
-- viendo su gremio vacio y creyendo que han perdido el historial. Es
-- exactamente el fallo que documenta la migracion 017. Cuando toque, se borra
-- UNA rama de `mis_gremios()` y no se toca ninguna politica.
--
-- ------------------------------------------------------------------
-- LAS FUNCIONES TAMBIEN, Y NO SOLO LAS POLITICAS
--
-- Seis funciones `security definer` llevaban la misma comprobacion escrita a
-- mano por dentro:
--
--     if not exists (select 1 from public.families f
--                     where f.id = v_family and f.owner = auth.uid()) then
--       return 'no_es_tuyo';
--
-- Un `security definer` se salta el RLS, asi que esa linea NO es una
-- duplicacion de la politica: es la unica autorizacion que hay ahi dentro. Si
-- se quedara como esta, la primera persona que se convierta y entre con su
-- correo propio recibiria 'no_es_tuyo' al pedir su estrella diaria, con
-- pertenencia activa y todo. Se cambian ahora, mientras el cambio es un no-op
-- comprobable, y no dentro de tres fases con alguien dependiendo de ellas.
--
-- Las seis quedan identicas salvo esa comprobacion, que pasa a ser
-- `public.es_mi_gremio(v_family)`. El resto del cuerpo no se toca.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · LAS POLITICAS DE LAS TRECE TABLAS DEL BUCLE
--
-- Todas van declaradas `to authenticated`. Sin eso Postgres evalua la politica
-- --y con ella la subconsulta-- tambien para el rol anonimo, que no va a
-- cumplirla nunca porque `auth.uid()` es nulo. La clave anon es publica: decir
-- que no tiene que ser barato.
-- ------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['profiles','challenges','completions','rewards','redemptions','family_goals','profile_badges','plan_diario','mission_families','campanas_limpieza','zonas_casa','informes_fallo','reconocimientos']
  loop
    execute format('drop policy if exists familia_miembro on public.%I', t);
    execute format($f$
      create policy familia_miembro on public.%I
        for all to authenticated
        using (family_id in (select public.mis_gremios()))
        with check (family_id in (select public.mis_gremios()))
    $f$, t);
  end loop;
end $$;

-- ------------------------------------------------------------------
-- 2 · EL GREMIO SE LEE POR PERTENENCIA, PERO SOLO SE LEE
--
-- Va aparte de `familia_owner` y solo para `select` a proposito: pertenecer da
-- acceso a los datos, no da la potestad de renombrar el gremio, cambiarle la
-- zona horaria ni borrarlo. Eso sigue siendo de la cuenta que lo fundo hasta
-- que exista el modelo de capacidades. Las dos politicas son permisivas y se
-- suman: quien es duena conserva todo lo que tenia.
-- ------------------------------------------------------------------

drop policy if exists familia_miembro_lee on public.families;
create policy familia_miembro_lee on public.families
  for select to authenticated
  using (id in (select public.mis_gremios()));

-- ------------------------------------------------------------------
-- 3 · LAS DEMAS TABLAS CON `family_id`
-- ------------------------------------------------------------------

drop policy if exists logs_lectura on public.app_logs;
create policy logs_lectura on public.app_logs
  for select to authenticated
  using (family_id in (select public.mis_gremios()));

drop policy if exists logs_escritura on public.app_logs;
create policy logs_escritura on public.app_logs
  for insert to authenticated
  with check (
    auth.uid() is not null
    and (family_id is null or family_id in (select public.mis_gremios()))
  );

drop policy if exists ritmo_familia on public.rate_limits;
create policy ritmo_familia on public.rate_limits
  for all to authenticated
  using (family_id in (select public.mis_gremios()))
  with check (family_id in (select public.mis_gremios()));

drop policy if exists bonuses_lectura on public.bonuses;
create policy bonuses_lectura on public.bonuses
  for select to authenticated
  using (family_id in (select public.mis_gremios()));

drop policy if exists power_uses_lectura on public.power_uses;
create policy power_uses_lectura on public.power_uses
  for select to authenticated
  using (family_id in (select public.mis_gremios()));

drop policy if exists push_subs_familia on public.push_subs;
create policy push_subs_familia on public.push_subs
  for all to authenticated
  using (family_id in (select public.mis_gremios()))
  with check (family_id in (select public.mis_gremios()));

drop policy if exists push_log_lectura on public.push_log;
create policy push_log_lectura on public.push_log
  for select to authenticated
  using (family_id in (select public.mis_gremios()));

-- El libro de las monedas (042). Mismo nombre de politica que las trece del
-- bucle, otra tabla.
drop policy if exists familia_miembro on public.movimientos_coins;
create policy familia_miembro on public.movimientos_coins
  for all to authenticated
  using (family_id in (select public.mis_gremios()))
  with check (family_id in (select public.mis_gremios()));

-- ------------------------------------------------------------------
-- 4 · LAS SEIS FUNCIONES `security definer`
--
-- Copiadas de schema.sql tal cual: lo unico que cambia en cada una es la
-- comprobacion de arriba.
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

  if not public.es_mi_gremio(v_family) then
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

  if not public.es_mi_gremio(v_family) then
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

create or replace function public.crear_campana_limpieza(
  p_activada_por uuid,
  p_tipo text,
  p_clave text,
  p_titulo text,
  p_emoji text,
  p_dias integer,
  p_tareas jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_rol text;
  v_tz text;
  v_hoy date;
  v_campana uuid;
  t jsonb;
  v_perfil uuid;
  v_xp integer;
  v_coins integer;
  v_title text;
  v_familia_perfil uuid;
  v_rol_perfil text;
  v_activo boolean;
begin
  select family_id, role into v_family, v_rol
    from public.profiles where id = p_activada_por and active;
  if v_family is null then return 'quien_no_existe'; end if;

  if not public.es_mi_gremio(v_family) then
    return 'no_es_tuyo';
  end if;

  if v_rol <> 'adulto' then return 'no_es_adulto'; end if;

  if p_tipo is null or p_tipo not in ('blitz','zona','profunda') then return 'tipo_invalido'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 30 then return 'duracion_invalida'; end if;
  if p_titulo is null or length(btrim(p_titulo)) < 3 or length(p_titulo) > 120 then return 'titulo_invalido'; end if;
  if p_tareas is null or jsonb_typeof(p_tareas) <> 'array'
     or jsonb_array_length(p_tareas) < 1 or jsonb_array_length(p_tareas) > 40 then
    return 'sin_tareas';
  end if;

  -- Una operación cada vez: dos campañas solapadas dejan de ser un
  -- acontecimiento y pasan a ser el tablón de siempre con otro nombre.
  if exists (
    select 1 from public.campanas_limpieza c where c.family_id = v_family and c.estado = 'activa'
  ) then
    return 'ya_hay_activa';
  end if;

  -- Se valida TODO antes de escribir NADA: o entra la campaña entera o
  -- no entra ninguna fila. El `exception` caza un profile_id que no sea
  -- ni siquiera un uuid.
  begin
    for t in select * from jsonb_array_elements(p_tareas) loop
      v_perfil := (t->>'profile_id')::uuid;
      v_xp := (t->>'xp')::integer;
      v_coins := (t->>'coins')::integer;
      v_title := t->>'title';

      if v_title is null or length(btrim(v_title)) < 3 or length(v_title) > 120 then return 'tarea_invalida'; end if;
      -- Topes de cordura contra el dedo gordo, no antifraude: una tarea
      -- no puede pagar más que un premio a mano pequeño.
      if v_xp is null or v_xp < 1 or v_xp > 60 then return 'tarea_invalida'; end if;
      if v_coins is null or v_coins < 1 or v_coins > 40 then return 'tarea_invalida'; end if;

      select family_id, role, active into v_familia_perfil, v_rol_perfil, v_activo
        from public.profiles where id = v_perfil;
      if v_familia_perfil is distinct from v_family or not coalesce(v_activo, false)
         or v_rol_perfil = 'mascota' then
        return 'tarea_invalida';
      end if;
    end loop;
  exception
    when invalid_text_representation then return 'tarea_invalida';
    when numeric_value_out_of_range then return 'tarea_invalida';
  end;

  select timezone into v_tz from public.families where id = v_family;
  v_hoy := (now() at time zone coalesce(v_tz, 'Europe/Madrid'))::date;

  -- La carrera de dos aparatos lanzando a la vez se resuelve AQUÍ: los
  -- dos pasan la comprobación de arriba y el índice único parcial tumba
  -- al segundo. Comprobar antes con un select y capturar la violación
  -- es el mismo par que usa grant_daily_bonus con su tope diario.
  begin
    insert into public.campanas_limpieza (family_id, tipo, clave, titulo, emoji, empieza, termina, activada_por)
    values (v_family, p_tipo, left(coalesce(nullif(btrim(p_clave), ''), p_tipo), 80), btrim(p_titulo),
            coalesce(nullif(p_emoji, ''), '🧹'), v_hoy, v_hoy + (p_dias - 1), p_activada_por)
    returning id into v_campana;
  exception when unique_violation then
    return 'ya_hay_activa';
  end;

  for t in select * from jsonb_array_elements(p_tareas) loop
    insert into public.challenges (family_id, profile_id, title, emoji, xp, coins, frequency, skill, campana_id)
    values (v_family, (t->>'profile_id')::uuid, btrim(t->>'title'),
            coalesce(nullif(t->>'emoji', ''), '🧹'),
            (t->>'xp')::integer, (t->>'coins')::integer, 'unico', 'hogar', v_campana);
  end loop;

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

  if not public.es_mi_gremio(v_family) then
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
  v_tope constant integer := 5;
  v_max_dias constant integer := 90;
begin
  if p_tipo is null or p_tipo not in ('salva_racha', 'asigna_tarea') then
    return 'poder_no_gastable';
  end if;

  select family_id into v_family from public.profiles where id = p_id and active;
  if v_family is null then
    return 'no_existe';
  end if;

  if not public.es_mi_gremio(v_family) then
    return 'no_es_tuyo';
  end if;

  -- El `for update` serializa dos gastos simultáneos de la misma insignia.
  select earned_at into v_earned
    from public.profile_badges
   where profile_id = p_id and code = p_code
   for update;

  if v_earned is null then
    return 'no_la_tienes';
  end if;

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

  -- La voz de mando CREA la misión, en la misma transacción que el gasto
  -- del uso: en dos llamadas, un fallo de red entre medias dejaría el uso
  -- gastado y a nadie encargado de nada. Aparece en el tablero de quien la
  -- recibe como una misión única más, sin interfaz nueva.
  if p_tipo = 'asigna_tarea' then
    insert into public.challenges (family_id, profile_id, title, emoji, xp, coins, frequency, skill)
    values (v_family, p_target, left(btrim(p_nota), 80), '📣', 10, 5, 'unico', 'cooperacion');
  end if;

  return 'ok';
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

  if not public.es_mi_gremio(v_family) then
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

-- ------------------------------------------------------------------
-- 5 · LOS PERMISOS, QUE ESTABAN MAL EN DOS SITIOS
--
-- `create or replace` no cambia los permisos, asi que estas lineas se
-- repetirian de todas formas para que una base reconstruida desde cero quede
-- igual que esta. Pero al compararlas con produccion antes de aplicar la 045
-- salieron dos cosas, y ninguna era de esta fase:
--
-- 1 · `grant_manual_bonus` se revocaba con la firma de CUATRO argumentos, y
--     tiene CINCO desde la 042. Una firma que no existe no da un aviso: da
--     "function does not exist" y corta la reconstruccion ahi mismo.
--
-- 2 · `revoke ... from public` NO quita la concesion explicita que Supabase
--     da a `anon` por privilegios por defecto. Por eso hoy `anon` puede
--     llamar a `crear_campana_limpieza`, `cerrar_campana_limpieza` y
--     `grant_manual_bonus`. No escriben nada --sin sesion, `auth.uid()` es
--     nulo y devuelven 'no_es_tuyo'-- pero son un oraculo de existencia
--     gratis para quien no ha entrado, y la clave anon es publica. Se anade
--     el `from anon` a las seis, que es la convencion que ya siguen las
--     funciones nuevas del proyecto (`es_operador`, `sin_mision_ese_dia`).
--
-- Lo que queda fuera: `zona_de_perfil` y los disparadores `tg_*` tambien los
-- puede ejecutar `anon`. **Lo cierra la 046**, que arregla el barrido general
-- que la 021 dejo al final de schema.sql: ese barrido solo quitaba `anon`, y
-- `anon` hereda de PUBLIC, asi que no cerraba nada. Escrito aparte porque es
-- otro asunto y otra migracion. Sigue abierta la revision de `truncate` que
-- dejo la Fase 0.
-- ------------------------------------------------------------------

revoke all on function public.grant_daily_bonus(uuid, text) from public;
revoke all on function public.grant_daily_bonus(uuid, text) from anon;
grant execute on function public.grant_daily_bonus(uuid, text) to authenticated;
-- La firma lleva CINCO argumentos desde la 042, que le anadio `p_clave`.
-- Estas dos lineas se quedaron con la de cuatro, y una firma que no existe no
-- es un aviso: `revoke` falla con "function does not exist" y **corta la
-- reconstruccion de la base ahi mismo**. Encontrado el 30-ago-2026 al
-- comparar el fichero con produccion, donde ademas se veia el efecto: es la
-- unica de las seis con PUBLIC todavia en la lista de permisos, justo porque
-- ese `revoke` nunca llego a ejecutarse.
revoke all on function public.grant_manual_bonus(uuid, integer, text, uuid, text) from public;
revoke all on function public.grant_manual_bonus(uuid, integer, text, uuid, text) from anon;
grant execute on function public.grant_manual_bonus(uuid, integer, text, uuid, text) to authenticated;
revoke all on function public.crear_campana_limpieza(uuid, text, text, text, text, integer, jsonb) from public;
revoke all on function public.crear_campana_limpieza(uuid, text, text, text, text, integer, jsonb) from anon;
grant execute on function public.crear_campana_limpieza(uuid, text, text, text, text, integer, jsonb) to authenticated;
revoke all on function public.cerrar_campana_limpieza(uuid, uuid) from public;
revoke all on function public.cerrar_campana_limpieza(uuid, uuid) from anon;
grant execute on function public.cerrar_campana_limpieza(uuid, uuid) to authenticated;
revoke all on function public.spend_power(uuid, text, text, integer, integer, uuid, text) from public;
revoke all on function public.spend_power(uuid, text, text, integer, integer, uuid, text) from anon;
grant execute on function public.spend_power(uuid, text, text, integer, integer, uuid, text) to authenticated;
revoke all on function public.claim_streak(uuid, integer) from public;
revoke all on function public.claim_streak(uuid, integer) from anon;
grant execute on function public.claim_streak(uuid, integer) to authenticated;

-- ------------------------------------------------------------------
-- El barrido de la 021, corregido por la 046: retira el permiso de ejecucion
-- de toda funcion `security definer`, PUBLIC incluido. Va al final de toda
-- migracion que cree o reemplace una de esas funciones, porque cada `create
-- or replace` estrena los privilegios por defecto de Supabase y vuelve a
-- conceder a `anon`. Es idempotente y no quita ningun `grant execute ... to
-- authenticated` explicito.
-- ------------------------------------------------------------------

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public', f.firma);
    execute format('revoke all on function %s from anon', f.firma);
  end loop;
end $$;

-- ------------------------------------------------------------------
-- COMPROBACION
--
-- Ninguna politica puede quedar hablando de propiedad. Esto tiene que devolver
-- CERO filas, y `familia_owner` es la unica excepcion legitima --es la que
-- dice quien puede TOCAR el gremio, no quien puede leerlo--:
--
--   select tablename, policyname
--     from pg_policies
--    where schemaname = 'public'
--      and (coalesce(qual,'') like '%owner = auth.uid()%'
--        or coalesce(with_check,'') like '%owner = auth.uid()%')
--      and policyname <> 'familia_owner';
--
-- Y para cualquier sesion de hoy, estas dos tienen que dar el mismo numero:
--
--   select count(*) from public.families where owner = auth.uid();
--   select count(*) from public.mis_gremios();
-- ------------------------------------------------------------------
