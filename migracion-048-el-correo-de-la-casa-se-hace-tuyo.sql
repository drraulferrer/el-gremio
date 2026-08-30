-- Migracion 048 · el correo compartido pasa a ser una identidad personal.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Pieza 2.6 de la Fase 2: el flujo F-13 de la especificacion.
--
-- ------------------------------------------------------------------
-- ES EL CASO MAS FRECUENTE DE TODOS
--
-- Quien fundo la casa uso SU correo personal como clave compartida. Ahora lo
-- necesita para ser ella misma, y la 047 le contesta
-- `correo_es_la_clave_de_casa`, que es correcto pero no le resuelve nada.
--
-- Un correo es credencial compartida **o** identidad personal, nunca las dos:
-- dos principios de autenticacion con el mismo correo y distinto alcance es una
-- confusion de privilegios esperando a ocurrir. Asi que la salida no es
-- permitir las dos cosas, sino **mover la llave de la casa a otro correo** y
-- dejar el antiguo en manos de su duena.
--
-- ------------------------------------------------------------------
-- LO QUE HAY QUE PROTEGER, Y ES UNA SOLA COSA
--
-- **Que la casa no se quede sin llave.** Ese correo lo usan hoy el movil de
-- quien lo fundo y las tabletas de las peques. Si se reclasifica como identidad
-- personal antes de que exista otra llave que funcione, la familia entera se
-- queda fuera de su gremio. No hay vuelta atras amable de eso: hay que
-- recuperar contrasenas de una cuenta que ya no da acceso a nada.
--
-- ------------------------------------------------------------------
-- TRES LLAMADAS, Y LA DEL MEDIO NO ESCRIBE NADA
--
--   1 · `solicitar_migracion_correo`, DESDE LA SESION COMPARTIDA y con el PIN.
--       Se elige el correo nuevo de la casa y el personaje al que se vincula el
--       antiguo. Deja una fila y **no toca el gremio**.
--
--   2 · La persona da de alta el correo nuevo, lo confirma, entra con el, y
--       llama a `probar_credencial_nueva`. Esa llamada **no escribe nada en el
--       gremio**: lo unico que hace es dejar constancia de que esa cuenta
--       EXISTE, esta confirmada y SE PUEDE ENTRAR CON ELLA. Que es justo lo que
--       hay que demostrar antes de tocar la llave de una casa.
--
--   3 · `completar_migracion_correo`, otra vez DESDE LA SESION COMPARTIDA. En
--       UNA transaccion: la llave pasa al correo nuevo, el antiguo se
--       reclasifica como identidad personal, se vincula al personaje elegido,
--       entra en el gremio por pertenencia, estrena cartera y recibe su saldo.
--
-- ------------------------------------------------------------------
-- POR QUE ASI Y NO COMO LO CUENTA LA ESPECIFICACION
--
-- F-13 describe ocho pasos en los que la credencial nueva se crea y se engancha
-- al gremio ANTES de reclasificar la antigua, y admite --en `L-46`-- un estado
-- intermedio con DOS credenciales compartidas validas a la vez, con la nota de
-- que hay que poder retirar la sobrante a mano si la cosa se interrumpe ahi.
--
-- Con el orden de arriba **ese estado no llega a existir**. La llamada del
-- medio demuestra lo mismo que el paso 4 de la especificacion --que la
-- credencial nueva entra de verdad-- sin engancharla a nada, y el cambio de
-- llave ocurre entero dentro de una transaccion. Si el proceso se abandona en
-- cualquier punto anterior, en el gremio **no ha cambiado absolutamente nada**
-- y la fila caduca sola a las 72 horas.
--
-- Es mas fuerte que lo que pedia `R-84`, no menos. `L-46` se queda sin caso, y
-- eso hay que llevarlo a la especificacion.
--
-- ------------------------------------------------------------------
-- LAS SESIONES ANTIGUAS SE CAEN, Y ES LO QUE TIENE QUE PASAR
--
-- Es el paso 7 de F-13 y no es un detalle de limpieza. Ese correo estaba
-- abierto en la tableta de una peque. Si esa sesion sobrevive al cambio, esa
-- tableta pasa a ser **una sesion personal de la madre**: mismo `auth.uid()`,
-- clase nueva. Asi que al terminar se retiran todas las sesiones de la cuenta
-- antigua, la que hace la llamada incluida. Cada aparato vuelve a entrar por
-- donde le toca: las tabletas con la llave nueva de la casa, y quien se acaba
-- de convertir con su identidad.
--
-- Se hace en el servidor y no confiando en que el cliente se acuerde, que es la
-- misma leccion que dejo la 043 con el libro de las monedas.
--
-- ------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE
--
-- **No crea la cuenta nueva.** Eso es un `signUp` del cliente y una persona
-- eligiendo una contrasena. Aqui solo se comprueba que existe, que esta
-- confirmada y que se ha podido entrar con ella.
--
-- **No hay pantalla**, por lo mismo que en la 047: la identidad personal solo
-- se ofrece cuando hay que cruzar el limite de un gremio, y ese disparo llega
-- en la Fase 5.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · LA MIGRACION EN CURSO
--
-- Los importes NO viven aqui: viven en `conversiones`, que es donde vive
-- cualquier conversion venga por donde venga. Esta tabla cuenta como cambio de
-- manos la llave de la casa, y nada mas.
-- ------------------------------------------------------------------

create table if not exists public.migraciones_correo (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  -- La cuenta que hoy es la llave de la casa y manana sera una persona.
  antigua uuid not null references auth.users(id) on delete cascade,
  -- El personaje al que se vincula. Se elige a mano, como en toda conversion.
  profile_id uuid not null references public.profiles(id) on delete cascade,
  correo_nuevo text not null check (correo_nuevo = lower(correo_nuevo) and correo_nuevo like '%_@_%'),
  -- La cuenta nueva, cuando se ha demostrado que se puede entrar con ella.
  nueva uuid references auth.users(id) on delete set null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','credencial_probada','completada','caducada','cancelada')),
  resultado text,
  clave text check (clave is null or length(clave) between 8 and 120),
  solicitada_at timestamptz not null default now(),
  probada_at timestamptz,
  caduca_at timestamptz not null,
  resuelta_at timestamptz,
  -- Probada quiere decir que hay una cuenta detras. Pendiente, que no.
  constraint migraciones_correo_probada_coherente check (
    case
      when estado = 'pendiente' then nueva is null and probada_at is null
      when estado in ('credencial_probada','completada') then nueva is not null and probada_at is not null
      else true
    end
  )
);

-- Una viva por gremio y una por correo nuevo. Con indices y no con un `select`
-- previo: entre el select y el insert cabe otra peticion.
create unique index if not exists idx_migracion_correo_viva_gremio
  on public.migraciones_correo (family_id) where estado in ('pendiente','credencial_probada');
create unique index if not exists idx_migracion_correo_viva_correo
  on public.migraciones_correo (correo_nuevo) where estado in ('pendiente','credencial_probada');

alter table public.migraciones_correo enable row level security;

drop policy if exists migracion_correo_visible on public.migraciones_correo;
create policy migracion_correo_visible on public.migraciones_correo
  for select to authenticated
  using (family_id in (select public.mis_gremios()) or antigua = auth.uid());

revoke all on table public.migraciones_correo from anon;
revoke all on table public.migraciones_correo from authenticated;
grant select on table public.migraciones_correo to authenticated;

-- ------------------------------------------------------------------
-- 2 · PASO 1 · PEDIRLO, DESDE LA SESION COMPARTIDA
--
--   'ok'
--   'sin_sesion'
--   'no_es_compartida'      una identidad personal no tiene nada que migrar
--   'no_existe'             el personaje no esta o esta retirado
--   'no_es_tuyo'
--   'pin_incorrecto'
--   'solo_adulto' · 'junior_bloqueado'
--   'ya_es_persona'
--   'correo_invalido' · 'correo_es_el_de_ahora'
--   'correo_no_disponible'
--   'ya_hay_una_en_marcha'
-- ------------------------------------------------------------------

create or replace function public.solicitar_migracion_correo(
  p_profile uuid,
  p_correo_nuevo text,
  p_pin_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_correo text := lower(btrim(p_correo_nuevo));
  v_family uuid;
  v_family_perfil uuid;
  v_rol text;
  v_persona uuid;
  v_pin text;
  v_correo_actual text;
begin
  if v_uid is null then return 'sin_sesion'; end if;

  -- Solo migra quien ES la llave de la casa. Una identidad personal no tiene
  -- nada que mover, y una cuenta sin clasificar tampoco.
  select c.family_id into v_family
    from public.credenciales c
   where c.user_id = v_uid and c.clase = 'compartida';
  if v_family is null then return 'no_es_compartida'; end if;

  if v_correo is null or v_correo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or length(v_correo) > 254 then
    return 'correo_invalido';
  end if;

  select lower(u.email) into v_correo_actual from auth.users u where u.id = v_uid;
  if v_correo = v_correo_actual then return 'correo_es_el_de_ahora'; end if;

  select f.parent_pin_hash into v_pin from public.families f where f.id = v_family;
  if v_pin is null or p_pin_hash is null or p_pin_hash <> v_pin then
    return 'pin_incorrecto';
  end if;

  select p.family_id, p.role, p.persona into v_family_perfil, v_rol, v_persona
    from public.profiles p where p.id = p_profile and p.active;
  if v_family_perfil is null then return 'no_existe'; end if;
  if v_family_perfil is distinct from v_family then return 'no_es_tuyo'; end if;
  if v_rol = 'junior' then return 'junior_bloqueado'; end if;
  if v_rol <> 'adulto' then return 'solo_adulto'; end if;
  if v_persona is not null then return 'ya_es_persona'; end if;

  -- El correo nuevo tiene que estar libre. Aqui se puede ser vago sin coste:
  -- lo esta eligiendo quien pregunta, y decirle "elige otro" le vale.
  if exists (select 1 from auth.users u where lower(u.email) = v_correo) then
    return 'correo_no_disponible';
  end if;

  update public.migraciones_correo
     set estado = 'caducada', resultado = 'caducada', resuelta_at = now()
   where estado in ('pendiente','credencial_probada') and caduca_at < now();

  begin
    insert into public.migraciones_correo (family_id, antigua, profile_id, correo_nuevo, caduca_at)
    values (v_family, v_uid, p_profile, v_correo, now() + interval '72 hours');
  exception when unique_violation then
    return 'ya_hay_una_en_marcha';
  end;

  return 'ok';
end $fn$;

revoke all on function public.solicitar_migracion_correo(uuid, text, text) from public;
revoke all on function public.solicitar_migracion_correo(uuid, text, text) from anon;
grant execute on function public.solicitar_migracion_correo(uuid, text, text) to authenticated;

-- ------------------------------------------------------------------
-- 3 · PASO 2 · PROBAR LA LLAVE NUEVA, DESDE LA SESION NUEVA
--
-- Que esta llamada llegue ya lo demuestra todo: hay cuenta, el correo esta
-- confirmado y se ha podido entrar. **No escribe nada en el gremio**, y esa es
-- toda su gracia: hasta el paso 3 no hay forma de que la casa se quede sin
-- llave, porque la llave no se ha tocado.
--
--   'ok' · 'sin_sesion' · 'correo_sin_confirmar' · 'ya_clasificada'
--   'sin_solicitud'
-- ------------------------------------------------------------------

create or replace function public.probar_credencial_nueva()
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_correo text;
  v_confirmado timestamptz;
  v_id uuid;
begin
  if v_uid is null then return 'sin_sesion'; end if;

  select lower(u.email), u.email_confirmed_at into v_correo, v_confirmado
    from auth.users u where u.id = v_uid;
  if v_correo is null then return 'sin_sesion'; end if;
  if v_confirmado is null then return 'correo_sin_confirmar'; end if;

  -- Una cuenta que ya es algo no puede ser ademas la llave de otra casa.
  if exists (select 1 from public.credenciales where user_id = v_uid) then
    return 'ya_clasificada';
  end if;

  update public.migraciones_correo
     set estado = 'credencial_probada', nueva = v_uid, probada_at = now()
   where correo_nuevo = v_correo and estado = 'pendiente' and caduca_at > now()
  returning id into v_id;

  if v_id is null then return 'sin_solicitud'; end if;
  return 'ok';
end $fn$;

revoke all on function public.probar_credencial_nueva() from public;
revoke all on function public.probar_credencial_nueva() from anon;
grant execute on function public.probar_credencial_nueva() to authenticated;

-- ------------------------------------------------------------------
-- 4 · PASO 3 · EL CAMBIO DE LLAVE, EN UNA SOLA TRANSACCION
--
--   'ok' · 'sin_sesion' · 'sin_solicitud' · 'aun_sin_probar'
--   'credencial_nueva_no_vale'  la cuenta nueva ya no sirve (se clasifico,
--                               se borro, o dejo de estar confirmada)
--   'personaje_ocupado'
-- ------------------------------------------------------------------

create or replace function public.completar_migracion_correo(p_clave text default null)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  m public.migraciones_correo%rowtype;
  v_saldo integer;
  v_persona_actual uuid;
  v_cartera integer;
  v_correo_antiguo text;
  v_confirmado timestamptz;
begin
  if v_uid is null then return 'sin_sesion'; end if;

  -- Idempotencia, antes de tocar nada.
  if p_clave is not null then
    if exists (select 1 from public.migraciones_correo
                where clave = p_clave and estado = 'completada' and antigua = v_uid) then
      return 'ok';
    end if;
  end if;

  select * into m from public.migraciones_correo
   where antigua = v_uid and estado in ('pendiente','credencial_probada')
     and caduca_at > now()
   for update;
  if not found then return 'sin_solicitud'; end if;
  if m.estado <> 'credencial_probada' then return 'aun_sin_probar'; end if;

  -- La llave nueva, otra vez y entera: entre el paso 2 y este han podido pasar
  -- tres dias. Si algo de esto ha cambiado, la casa se quedaria sin llave.
  select u.email_confirmed_at into v_confirmado from auth.users u where u.id = m.nueva;
  if v_confirmado is null
     or exists (select 1 from public.credenciales where user_id = m.nueva) then
    return 'credencial_nueva_no_vale';
  end if;

  select p.coins, p.persona into v_saldo, v_persona_actual
    from public.profiles p where p.id = m.profile_id and p.active
   for update;
  if v_saldo is null then return 'sin_solicitud'; end if;
  if v_persona_actual is not null then return 'personaje_ocupado'; end if;

  select lower(u.email) into v_correo_antiguo from auth.users u where u.id = v_uid;

  -- 1 · La llave pasa de mano. Primero la antigua deja de serlo --el CHECK de
  --     `credenciales` exige que una personal no lleve gremio-- y despues entra
  --     la nueva. Las dos dentro de la misma transaccion: en ningun instante
  --     visible hay dos llaves ni ninguna.
  update public.credenciales
     set clase = 'personal', family_id = null
   where user_id = v_uid;

  insert into public.credenciales (user_id, clase, family_id)
  values (m.nueva, 'compartida', m.family_id);

  update public.families set owner = m.nueva where id = m.family_id;

  -- 2 · Y quien era la llave pasa a estar dentro por pertenencia, como en
  --     cualquier otra conversion: reclamacion, y rol gestor.
  insert into public.pertenencias (persona, family_id, rol, estado, origen)
  values (v_uid, m.family_id, 'gestor', 'activa', 'reclamacion');

  insert into public.carteras (persona, saldo) values (v_uid, 0)
  on conflict (persona) do nothing;

  perform public.motivo_coins('conversion', m.id, p_clave);
  update public.profiles
     set persona = v_uid,
         coins = 0,
         saldo_local_cerrado = true
   where id = m.profile_id;

  update public.carteras set saldo = saldo + v_saldo where persona = v_uid
    returning saldo into v_cartera;

  -- 3 · El asiento de la conversion va donde van todos, y no aqui.
  insert into public.conversiones
    (profile_id, family_id, correo, estado, persona,
     saldo_local_antes, importe, saldo_cartera_despues, resultado, clave,
     caduca_at, resuelta_at)
  values
    (m.profile_id, m.family_id, v_correo_antiguo, 'completada', v_uid,
     v_saldo, v_saldo, v_cartera, 'ok', p_clave,
     now(), now());

  update public.migraciones_correo
     set estado = 'completada', resultado = 'ok', clave = p_clave, resuelta_at = now()
   where id = m.id;

  -- 4 · Y se caen todas las sesiones de la cuenta antigua, esta incluida. Sin
  --     esto, la tableta de una peque que estaba dentro con la llave de la casa
  --     se convierte en una sesion personal de otra persona. Va en el servidor
  --     y no fiado a que el cliente llame a `signOut`, por lo mismo que el
  --     libro de las monedas lo escribe un disparador y no ocho funciones.
  if to_regclass('auth.sessions') is not null then
    delete from auth.sessions where user_id = v_uid;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    delete from auth.refresh_tokens where user_id = v_uid::text;
  end if;

  return 'ok';
end $fn$;

revoke all on function public.completar_migracion_correo(text) from public;
revoke all on function public.completar_migracion_correo(text) from anon;
grant execute on function public.completar_migracion_correo(text) to authenticated;

-- ------------------------------------------------------------------
-- 5 · RETIRARLA
--
-- Mientras no se haya completado no hay nada que deshacer en el gremio: se
-- marca y ya. Existe porque el indice de "una viva por gremio" es una trampa
-- sin esto.
-- ------------------------------------------------------------------

create or replace function public.cancelar_migracion_correo(p_migracion uuid, p_pin_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_estado text;
  v_pin text;
begin
  if auth.uid() is null then return 'sin_sesion'; end if;

  select family_id, estado into v_family, v_estado
    from public.migraciones_correo where id = p_migracion;
  if v_family is null then return 'no_existe'; end if;
  if not public.es_mi_gremio(v_family) then return 'no_es_tuyo'; end if;

  select f.parent_pin_hash into v_pin from public.families f where f.id = v_family;
  if v_pin is null or p_pin_hash is null or p_pin_hash <> v_pin then
    return 'pin_incorrecto';
  end if;

  if v_estado not in ('pendiente','credencial_probada') then return 'ya_resuelta'; end if;

  update public.migraciones_correo
     set estado = 'cancelada', resultado = 'cancelada', resuelta_at = now()
   where id = p_migracion;
  return 'ok';
end $fn$;

revoke all on function public.cancelar_migracion_correo(uuid, text) from public;
revoke all on function public.cancelar_migracion_correo(uuid, text) from anon;
grant execute on function public.cancelar_migracion_correo(uuid, text) to authenticated;

-- ------------------------------------------------------------------
-- El barrido de la 021, corregido por la 046.
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
-- Mientras no migre nadie, esto tiene que dar ceros y una fila por gremio:
--
--   select
--     (select count(*) from public.migraciones_correo)                     as migraciones,
--     (select count(*) from public.credenciales where clase = 'compartida') as llaves,
--     (select count(*) from public.families)                               as gremios;
--
-- Y despues de cualquier migracion, cada gremio sigue teniendo UNA llave:
--
--   select f.id, count(c.user_id) as llaves
--     from public.families f
--     left join public.credenciales c on c.family_id = f.id and c.clase = 'compartida'
--    group by f.id having count(c.user_id) <> 1;
-- ------------------------------------------------------------------
