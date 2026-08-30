-- Migracion 060 · quitar la llave de debajo del felpudo.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Pieza 7.2 de la Fase 7 (`F-12`, `R-82`, `R-87`, `R-88`). Con ella la Fase 7
-- queda cerrada.
--
-- ------------------------------------------------------------------
-- QUE ES ESTO
--
-- Un gremio donde ya todo el mundo tiene su identidad no necesita una clave
-- comun, y mantenerla es una llave de mas debajo del felpudo: un correo y una
-- contrasena que abren la casa entera y que no representan a nadie.
--
-- ------------------------------------------------------------------
-- DESACTIVAR TIENE QUE CORTAR **DOS** CAMINOS, NO UNO
--
-- Y esto es lo que convierte la pieza en algo mas que una bandera. La
-- credencial compartida entra en el gremio por DOS sitios distintos, los dos
-- en `mis_gremios()`:
--
--   1 · `families.owner = auth.uid()` -- la cuenta ES la duena del gremio
--   2 · su fila de `credenciales`, con `clase = 'compartida'`
--
-- Poner `activa = false` cierra el segundo y **deja el primero abierto de par
-- en par**. Una desactivacion que no corta el acceso no es una
-- desactivacion: es una casilla.
--
-- Asi que al desactivar, **la titularidad del gremio pasa a la persona que lo
-- hace**. No es un efecto colateral: es exactamente la forma que ya tienen
-- los gremios creados con llave desde la 057, donde `owner` es una cuenta
-- personal y no hay credencial compartida. El gremio deja de tener duena-
-- llave y pasa a tener duena-persona.
--
-- ------------------------------------------------------------------
-- LA CUENTA NO SE BORRA, Y LA CONTRASENA NO SE REVELA (`R-82`)
--
-- La fila de `credenciales` se queda, marcada inactiva, y la cuenta de
-- `auth.users` sigue existiendo. Ni se borra ni se toca su contrasena: lo que
-- se retira es el acceso, no el rastro.
--
-- Y **la anterior no vuelve**. Reactivar es dar de alta una credencial
-- **nueva**, con correo y contrasena nuevos. Volver a encender la vieja seria
-- resucitar una clave que alguien pudo haber compartido, que es justo de lo
-- que se estaba huyendo.
--
-- ------------------------------------------------------------------
-- LAS CINCO COMPROBACIONES, Y LA QUE `D-29` CAMBIO
--
-- La version anterior de la especificacion exigia que no quedara **ningun**
-- perfil sin identidad. En un hogar con una peque de tres anos eso no pasa
-- nunca: la funcion era letra muerta justo donde mas se usa.
--
-- Ahora los perfiles que **no pueden** tener identidad -peque, mascota,
-- junior- no bloquean por si solos, **siempre que quede una persona adulta
-- con identidad propia que pueda operarlos**. Lo que sigue bloqueando es un
-- perfil ADULTO activo sin identidad: esa persona se quedaria fuera.
--
-- ------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE
--
-- **No la puede pedir la propia credencial compartida** (`E-11.9`). Seria una
-- clave decidiendo dejar de existir, sin nadie detras que responda.
--
-- **No hay desactivacion automatica** por numero de perfiles, inactividad ni
-- migracion (`R-82`). Solo a mano y con el PIN.
--
-- **No hay pantalla.** El inventario esta escrito para que la haya.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · LA BANDERA
-- ------------------------------------------------------------------

alter table public.credenciales
  add column if not exists activa boolean not null default true;

comment on column public.credenciales.activa is
  'Una credencial compartida desactivada (060) conserva su fila y su cuenta: lo que se retira es el acceso, no el rastro. La contrasena nunca se revela y la credencial nunca se reactiva: se crea otra.';

-- ------------------------------------------------------------------
-- 2 · LOS DOS SITIOS QUE TENIAN QUE ENTERARSE
--
-- Sin esto la bandera no sirve de nada. Son las dos funciones que preguntan
-- "quien es esta sesion": la que decide a que gremios llega y la que decide
-- que puede hacer.
-- ------------------------------------------------------------------

create or replace function public.mis_gremios()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select f.id from public.families f where f.owner = auth.uid()
  union
  select c.family_id from public.credenciales c
   where c.user_id = auth.uid() and c.clase = 'compartida' and c.family_id is not null
     and c.activa
  union
  select p.family_id from public.pertenencias p
   where p.persona = auth.uid() and p.estado = 'activa';
$fn$;

revoke all on function public.mis_gremios() from public;
revoke all on function public.mis_gremios() from anon;
grant execute on function public.mis_gremios() to authenticated;

create or replace function public.puede(
  p_family uuid,
  p_capacidad text,
  p_profile uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_rol text;
  v_tipo text;
  v_version text;
  v_permiso text;
begin
  if v_uid is null or p_family is null then return 'no'; end if;

  select tipo_plantilla, plantilla_version into v_tipo, v_version
    from public.families where id = p_family;
  if v_tipo is null then return 'no'; end if;

  -- 1 · Pertenencia activa EN ESE GREMIO. Nunca el gremio activo de la sesion.
  select p.rol into v_rol
    from public.pertenencias p
   where p.persona = v_uid and p.family_id = p_family and p.estado = 'activa';

  -- 2 · O la credencial compartida de ese gremio, y entonces manda el rol del
  --     personaje que se opera. Desde la 060, solo si sigue ACTIVA: una
  --     credencial retirada no autoriza nada.
  if v_rol is null then
    if not exists (
      select 1 from public.credenciales c
       where c.user_id = v_uid and c.clase = 'compartida' and c.family_id = p_family
         and c.activa
    ) then
      return 'no';
    end if;
    if p_profile is null then return 'no'; end if;
    select pr.role into v_rol
      from public.profiles pr
     where pr.id = p_profile and pr.family_id = p_family and pr.active;
    if v_rol is null then return 'no'; end if;
  end if;

  select c.permiso into v_permiso
    from public.plantilla_capacidades c
   where c.tipo = v_tipo and c.version = v_version
     and c.rol = v_rol and c.capacidad = p_capacidad;

  -- Lo que no esta declarado, no esta permitido. Una capacidad inventada
  -- despues de publicar una plantilla no la gana nadie por sorpresa.
  return coalesce(v_permiso, 'no');
end $fn$;

revoke all on function public.puede(uuid, text, uuid) from public;
revoke all on function public.puede(uuid, text, uuid) from anon;
grant execute on function public.puede(uuid, text, uuid) to authenticated;

-- ------------------------------------------------------------------
-- 3 · EL INVENTARIO (`R-88`)
--
-- Se calcula ENTERO en servidor y se devuelve para pintarlo. La pantalla no
-- suma nada por su cuenta: lo que ensena y lo que se comprueba al desactivar
-- salen de la misma funcion, asi que no pueden decir cosas distintas.
--
-- Mismo criterio que `efecto_de_borrarme()` en la 049.
-- ------------------------------------------------------------------

create or replace function public.inventario_credencial(p_family uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_adultos_con integer;
  v_adultos_sin jsonb;
  v_no_convertidos jsonb;
  v_responsables jsonb;
  v_hay_admin boolean;
  v_motivos jsonb := '[]'::jsonb;
begin
  if not public.es_mi_gremio(p_family) then
    return jsonb_build_object('puede', false, 'motivos', jsonb_build_array('no_es_tuyo'));
  end if;

  -- Personas adultas con identidad, pertenencia activa y administracion. Son
  -- las que pueden quedarse a cargo de todo lo demas.
  select coalesce(jsonb_agg(jsonb_build_object('profile_id', pr.id, 'nombre', pr.name)), '[]'::jsonb)
    into v_responsables
    from public.profiles pr
    join public.pertenencias pe
      on pe.persona = pr.persona and pe.family_id = pr.family_id and pe.estado = 'activa'
   where pr.family_id = p_family and pr.active and pr.role = 'adulto'
     and pr.persona is not null
     and pe.rol in ('titular','gestor');

  v_hay_admin := jsonb_array_length(v_responsables) > 0;
  select count(*) into v_adultos_con
    from public.profiles pr
   where pr.family_id = p_family and pr.active and pr.role = 'adulto' and pr.persona is not null;

  -- Lo que BLOQUEA: un perfil adulto activo sin identidad se quedaria fuera.
  select coalesce(jsonb_agg(jsonb_build_object('profile_id', pr.id, 'nombre', pr.name)), '[]'::jsonb)
    into v_adultos_sin
    from public.profiles pr
   where pr.family_id = p_family and pr.active and pr.role = 'adulto' and pr.persona is null;

  -- Lo que NO bloquea por si solo (`D-29`), pero necesita quien lo opere.
  select coalesce(jsonb_agg(jsonb_build_object(
           'profile_id', pr.id, 'nombre', pr.name, 'rol', pr.role)), '[]'::jsonb)
    into v_no_convertidos
    from public.profiles pr
   where pr.family_id = p_family and pr.active and pr.persona is null
     and pr.role in ('junior','peque','mascota');

  if not v_hay_admin then
    v_motivos := v_motivos || jsonb_build_array('sin_persona_con_administracion');
  end if;
  if jsonb_array_length(v_adultos_sin) > 0 then
    v_motivos := v_motivos || jsonb_build_array('adultos_sin_identidad');
  end if;
  -- Los no convertidos solo bloquean si NO queda quien los opere.
  if jsonb_array_length(v_no_convertidos) > 0 and not v_hay_admin then
    v_motivos := v_motivos || jsonb_build_array('nadie_para_operarlos');
  end if;

  return jsonb_build_object(
    'puede', jsonb_array_length(v_motivos) = 0,
    'motivos', v_motivos,
    'adultos_con_identidad', v_adultos_con,
    'adultos_sin_identidad', v_adultos_sin,
    'no_convertidos', v_no_convertidos,
    'responsables', v_responsables,
    'activa', exists (
      select 1 from public.credenciales c
       where c.family_id = p_family and c.clase = 'compartida' and c.activa
    )
  );
end $fn$;

revoke all on function public.inventario_credencial(uuid) from public;
revoke all on function public.inventario_credencial(uuid) from anon;
grant execute on function public.inventario_credencial(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 4 · DESACTIVARLA
--
-- Se vuelve a calcular el inventario aqui dentro, aunque la pantalla ya lo
-- haya pedido para pintarlo: entre una cosa y otra ha podido cambiar
-- cualquiera, y lo que diga el cliente no autoriza nada.
-- ------------------------------------------------------------------

create or replace function public.desactivar_credencial_compartida(
  p_family uuid,
  p_profile uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_inv jsonb;
  v_compartida uuid;
begin
  if v_uid is null then return 'sin_sesion'; end if;

  -- `E-11.9`: no la pide la propia clave. Seria una credencial decidiendo
  -- dejar de existir, sin nadie detras que responda por ello.
  if public.clase_credencial() <> 'personal' then return 'exige_identidad_personal'; end if;

  if not public.es_mi_gremio(p_family) then return 'no_es_tuyo'; end if;
  -- `CAP-04`, con el PIN: es un ajuste del gremio, y de los grandes.
  if public.puede(p_family, 'CAP-04', p_profile) = 'no' then return 'no_puede'; end if;

  select c.user_id into v_compartida
    from public.credenciales c
   where c.family_id = p_family and c.clase = 'compartida' and c.activa
   for update;
  if v_compartida is null then return 'ya_desactivada'; end if;

  v_inv := public.inventario_credencial(p_family);
  if not (v_inv->>'puede')::boolean then
    -- El motivo se devuelve tal cual para que la pantalla pueda decir QUE lo
    -- impide, que es lo que pide `E-11.6`.
    return 'bloqueada:' || (v_inv->'motivos'->>0);
  end if;

  -- La titularidad pasa a esta persona. Sin esto la desactivacion seria una
  -- casilla: `mis_gremios()` deja entrar por `families.owner` tambien.
  update public.families set owner = v_uid where id = p_family;

  -- Y la credencial se retira. Ni se borra la fila ni se toca la cuenta.
  update public.credenciales set activa = false where user_id = v_compartida;

  -- Se caen sus sesiones abiertas: si no, el movil que estaba dentro sigue
  -- dentro hasta que caduque el testigo, y eso es justo lo que se retiraba.
  if to_regclass('auth.sessions') is not null then
    delete from auth.sessions where user_id = v_compartida;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    delete from auth.refresh_tokens where user_id = v_compartida::text;
  end if;

  return 'ok';
end $fn$;

revoke all on function public.desactivar_credencial_compartida(uuid, uuid) from public;
revoke all on function public.desactivar_credencial_compartida(uuid, uuid) from anon;
grant execute on function public.desactivar_credencial_compartida(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------
-- 5 · VOLVER A TENER UNA, QUE ES OTRA
--
-- La cuenta nueva se da de alta y confirma su correo por su cuenta, igual que
-- en la migracion de correo de la 048: aqui solo se la engancha, y solo si
-- esta confirmada y no es ya otra cosa.
--
-- **La anterior no vuelve.** Su fila se queda inactiva para siempre: volver a
-- encenderla seria resucitar una clave que alguien pudo compartir.
-- ------------------------------------------------------------------

create or replace function public.crear_credencial_compartida(
  p_family uuid,
  p_correo text,
  p_profile uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_correo text := lower(btrim(coalesce(p_correo, '')));
  v_nueva uuid;
  v_confirmado timestamptz;
begin
  if v_uid is null then return 'sin_sesion'; end if;
  if public.clase_credencial() <> 'personal' then return 'exige_identidad_personal'; end if;
  if not public.es_mi_gremio(p_family) then return 'no_es_tuyo'; end if;
  if public.puede(p_family, 'CAP-04', p_profile) = 'no' then return 'no_puede'; end if;

  if exists (
    select 1 from public.credenciales c
     where c.family_id = p_family and c.clase = 'compartida' and c.activa
  ) then
    return 'ya_hay_una';
  end if;

  select u.id, u.email_confirmed_at into v_nueva, v_confirmado
    from auth.users u where lower(u.email) = v_correo;
  if v_nueva is null then return 'cuenta_no_existe'; end if;
  -- La trampa que el proyecto ya conoce desde la 047: `signUp` no falla
  -- cuando falta confirmar, solo devuelve una sesion vacia.
  if v_confirmado is null then return 'correo_sin_confirmar'; end if;
  -- Una cuenta es compartida o personal, nunca las dos. Y una compartida
  -- retirada tampoco vale: la anterior no vuelve.
  if exists (select 1 from public.credenciales where user_id = v_nueva) then
    return 'cuenta_ya_clasificada';
  end if;

  insert into public.credenciales (user_id, clase, family_id, activa)
  values (v_nueva, 'compartida', p_family, true);

  return 'ok';
end $fn$;

revoke all on function public.crear_credencial_compartida(uuid, text, uuid) from public;
revoke all on function public.crear_credencial_compartida(uuid, text, uuid) from anon;
grant execute on function public.crear_credencial_compartida(uuid, text, uuid) to authenticated;

-- Y el barrido de la 021, corregido por la 046.
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
--   select clase, activa, count(*) from public.credenciales group by 1,2;
--   -- todas activas tras aplicar: la columna nace en `true`
--
--   select public.inventario_credencial('<gremio>');
--   -- con la casa de hoy: `puede` = false y el motivo, adultos sin identidad
-- ------------------------------------------------------------------
