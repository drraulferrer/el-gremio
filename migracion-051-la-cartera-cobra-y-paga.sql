-- Migracion 051 · el saldo de quien tiene identidad vive en su cartera.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Pieza 3.2 de la Fase 3: el modelo hibrido de saldo.
--
-- ------------------------------------------------------------------
-- QUE FALTABA
--
-- La 047 creo la cartera y le paso el saldo del personaje al convertirse. Pero
-- ahi se acababa: las ocho funciones que mueven monedas seguian escribiendo en
-- `profiles.coins`, asi que a partir del dia siguiente esa persona ganaba en un
-- monedero y tenia el dinero en el otro. Por eso la 047 se escribio con la
-- conversion sin disparo --nadie puede convertirse todavia-- y con un aviso: la
-- Fase 3 tiene que llegar antes que la Fase 5. Esto es esa Fase 3.
--
-- La regla, que es la decision `D-02` en su opcion C:
--
--   * quien tiene identidad personal, **una cartera**, y de ahi cobra y paga;
--   * quien no la tiene --una peque, una junior, una mascota, un perfil sin
--     convertir-- conserva su **saldo local** exactamente como hoy.
--
-- Y el saldo de una peque **nunca** se mezcla con la cartera de nadie.
--
-- ------------------------------------------------------------------
-- DONDE SE ENCAMINA, Y POR QUE AHI
--
-- La alternativa era tocar las ocho funciones. Es lo que la 043 ya descarto
-- para el libro de las monedas, y por el mismo motivo: hacerlo a mano funciona
-- mientras nadie se olvide, y el dia que alguien anada la novena, esa persona
-- cobra en el monedero que no es y no se entera nadie.
--
-- Asi que se encamina en un disparador `before update of coins on profiles`.
-- Las ocho funciones se quedan como estan --siguen escribiendo `coins = coins +
-- N`-- y el disparador se lleva el movimiento a la cartera cuando toca.
--
-- ------------------------------------------------------------------
-- LA EXCEPCION QUE HAY QUE ENTENDER: CUANDO CAMBIA `persona`
--
-- Hay DOS operaciones cuyo trabajo es precisamente mover el dinero de un
-- monedero al otro: la conversion (047) y el borrado de identidad (049). Las
-- dos cambian `persona` y `coins` en el MISMO `update`, y en direcciones
-- opuestas.
--
-- Si el disparador mirara `new.persona`, la conversion --que pone persona y
-- deja `coins` a cero-- se leeria como "esta persona acaba de gastar 424", y le
-- restaria de una cartera que todavia esta vacia.
--
-- Por eso la primera linea del disparador es: **si `persona` cambia en este
-- mismo update, no te metas**. Esas dos funciones saben lo que hacen y ya
-- mueven las dos partes. Todo lo demas --ganar, gastar, deshacer, devolver--
-- pasa con `persona` igual antes y despues, y ahi si se encamina.
--
-- ------------------------------------------------------------------
-- Y EL LIBRO EMPIEZA A CUADRAR
--
-- `CON-5` pide que la suma de los asientos reproduzca el saldo. Hoy no lo hace
-- para nadie, y no por un fallo: el libro nacio con la 042 y los saldos son
-- anteriores. Los cuatro perfiles con dinero (559, 424, 320 y 45) no tienen ni
-- un asiento detras.
--
-- Se les escribe uno de **apertura**, que dice la verdad: "esto es lo que habia
-- el dia que empezo a haber libro". Sin el, la comprobacion de descuadre nace
-- dando falsos positivos y nadie la mira.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · EL LIBRO SABE DE QUIEN ERA EL SALDO
--
-- `profile_id` dice sobre que personaje se movio; `persona`, de que monedero
-- salio. Nula quiere decir saldo local, que es el caso de todo el mundo hoy.
-- Sin esta columna, sumar el libro por personaje mezclaria los dos monederos en
-- cuanto alguien se convierta, y la comprobacion de descuadre dejaria de
-- significar nada.
-- ------------------------------------------------------------------

alter table public.movimientos_coins
  add column if not exists persona uuid references auth.users(id) on delete set null;

create index if not exists idx_movimientos_persona
  on public.movimientos_coins (persona, created_at desc) where persona is not null;

alter table public.movimientos_coins drop constraint if exists movimientos_coins_tipo_check;
alter table public.movimientos_coins add constraint movimientos_coins_tipo_check check (tipo in (
  'canje', 'devolucion_canje', 'mision', 'deshacer_mision',
  'bonus_diario', 'bonus_manual', 'botin_limpieza', 'racha',
  'conversion', 'devolucion_conversion',
  -- Lo que habia el dia que empezo a haber libro. Un asiento por personaje,
  -- una sola vez, y solo para los que ya tenian saldo.
  'apertura',
  'desconocido'
));

-- ------------------------------------------------------------------
-- 2 · CUANTO TIENE DE VERDAD ESTE PERSONAJE
--
-- La unica respuesta buena a "cuanto le queda", y la que tienen que usar todas
-- las funciones que decidan si algo se puede pagar. `security definer` y sin
-- conceder a nadie: la llaman otras funciones del servidor. Una persona ve su
-- cartera leyendo `carteras`, que ya tiene su politica.
-- ------------------------------------------------------------------

create or replace function public.saldo_de(p_profile uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  select case
           when p.persona is null then p.coins
           else coalesce((select c.saldo from public.carteras c where c.persona = p.persona), 0)
         end
    from public.profiles p
   where p.id = p_profile;
$fn$;

revoke all on function public.saldo_de(uuid) from public;
revoke all on function public.saldo_de(uuid) from anon;
revoke all on function public.saldo_de(uuid) from authenticated;

-- ------------------------------------------------------------------
-- 3 · EL UNICO SITIO QUE TOCA UNA CARTERA
--
-- Mover el saldo y anotarlo van juntos aqui dentro, y no hay otra puerta. Es
-- la misma decision que la 043 tomo con el libro de las monedas: si mover una
-- cartera y anotar el movimiento son dos pasos que cada funcion da por su
-- cuenta, funciona hasta que alguien da uno y olvida el otro.
--
-- Y eso ya habia pasado, sin que se viera: la conversion de la 047 pasaba el
-- saldo del personaje a la cartera anotando **solo la salida**. La entrada no
-- dejaba rastro, asi que la cartera tenia 424 y el libro decia 0. Una
-- transferencia entre dos monederos necesita DOS asientos, uno por monedero, y
-- eso es lo que hace esta funcion junto con el disparador de `profiles`.
--
-- Lo encontro `descuadre_saldos()` la primera vez que se ejecuto.
-- ------------------------------------------------------------------

create or replace function public.mover_cartera(
  p_persona uuid,
  p_profile uuid,
  p_tipo text,
  p_importe integer,
  p_referencia uuid default null,
  p_clave text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_antes integer;
  v_despues integer;
  v_family uuid;
begin
  if p_persona is null then
    raise exception 'mover_cartera sin persona';
  end if;

  -- El cerrojo es lo que impide que dos peticiones simultaneas lean el mismo
  -- saldo y escriban las dos.
  select saldo into v_antes from public.carteras where persona = p_persona for update;
  if v_antes is null then
    insert into public.carteras (persona, saldo) values (p_persona, 0)
    on conflict (persona) do nothing;
    v_antes := 0;
  end if;

  if p_importe = 0 then
    return v_antes;
  end if;

  v_despues := v_antes + p_importe;
  if v_despues < 0 then
    raise exception 'la cartera no llega: % + % (comprueba con saldo_de antes de cobrar)', v_antes, p_importe
      using errcode = 'check_violation';
  end if;

  update public.carteras set saldo = v_despues where persona = p_persona;

  select family_id into v_family from public.profiles where id = p_profile;

  insert into public.movimientos_coins
    (family_id, profile_id, persona, tipo, importe, saldo_antes, saldo_despues, resultado, referencia, clave)
  values (v_family, p_profile, p_persona,
          coalesce(nullif(p_tipo, ''), 'desconocido'),
          p_importe, v_antes, v_despues, 'ok', p_referencia, p_clave);

  return v_despues;
end $fn$;

revoke all on function public.mover_cartera(uuid, uuid, text, integer, uuid, text) from public;
revoke all on function public.mover_cartera(uuid, uuid, text, integer, uuid, text) from anon;
revoke all on function public.mover_cartera(uuid, uuid, text, integer, uuid, text) from authenticated;

-- ------------------------------------------------------------------
-- 3b · EL ENCAMINAMIENTO
-- ------------------------------------------------------------------

create or replace function public.tg_encaminar_coins()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_delta integer;
begin
  -- Si `persona` cambia en este mismo update, quien lo hace es la conversion o
  -- el borrado de identidad, y esas dos mueven las dos partes por su cuenta.
  -- Meterse aqui seria leer "acaba de gastar 424" donde pone "su saldo se ha
  -- mudado de monedero".
  if new.persona is distinct from old.persona then
    return new;
  end if;

  -- Sin persona detras, saldo local: todo sigue como siempre y el asiento lo
  -- escribe `tg_movimiento_coins` despues.
  if new.persona is null then
    return new;
  end if;

  v_delta := new.coins - old.coins;
  if v_delta = 0 then
    return new;
  end if;

  perform public.mover_cartera(
    new.persona, new.id,
    coalesce(nullif(current_setting('app.coins_tipo', true), ''), 'desconocido'),
    v_delta,
    nullif(current_setting('app.coins_ref', true), '')::uuid,
    nullif(current_setting('app.coins_clave', true), '')
  );

  -- El motivo se consume, igual que en `tg_movimiento_coins`: si el siguiente
  -- movimiento de la misma transaccion no declara el suyo, sale 'desconocido'
  -- en vez de heredar uno ajeno.
  perform set_config('app.coins_tipo', '', true);
  perform set_config('app.coins_ref', '', true);
  perform set_config('app.coins_clave', '', true);

  -- Y el saldo local NO se mueve. Al dejar `coins` como estaba,
  -- `tg_movimiento_coins` --que corre despues-- sale por su rama corta y no
  -- escribe un segundo asiento.
  new.coins := old.coins;
  return new;
end $fn$;

revoke all on function public.tg_encaminar_coins() from anon;
revoke all on function public.tg_encaminar_coins() from authenticated;

drop trigger if exists trg_encaminar_coins on public.profiles;
create trigger trg_encaminar_coins
  before update of coins on public.profiles
  for each row execute function public.tg_encaminar_coins();

-- ------------------------------------------------------------------
-- 4 · EL APUNTE DE UN INTENTO FALLIDO TAMBIEN SABE DE QUIEN ES
-- ------------------------------------------------------------------

create or replace function public.anota_coins(
  p_profile uuid,
  p_tipo text,
  p_importe integer,
  p_antes integer,
  p_despues integer,
  p_resultado text default 'ok',
  p_referencia uuid default null,
  p_clave text default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_family uuid;
  v_persona uuid;
begin
  select family_id, persona into v_family, v_persona
    from public.profiles where id = p_profile;
  if v_family is null then return; end if;
  insert into public.movimientos_coins
    (family_id, profile_id, persona, tipo, importe, saldo_antes, saldo_despues, resultado, referencia, clave)
  values
    (v_family, p_profile, v_persona, p_tipo, p_importe, p_antes, p_despues, p_resultado, p_referencia, p_clave);
end $$;

-- ------------------------------------------------------------------
-- 5 · LAS DOS FUNCIONES QUE LEEN EL SALDO PARA DECIDIR
--
-- Las otras seis solo suman, y esas no se tocan: el disparador se encarga.
-- Estas dos miraban `profiles.coins` directamente, que para un personaje
-- convertido vale cero y no es su saldo.
-- ------------------------------------------------------------------

-- `redeem_reward` deja de devolver 'saldo_en_cartera': ese codigo existia
-- mientras la cartera no podia pagar, y ahora paga. Quien no llega recibe
-- 'sin_monedas', como todo el mundo.
create or replace function public.redeem_reward(rw_id uuid, p_id uuid, p_clave text default null)
returns text
language plpgsql
security invoker
as $$
declare
  rw public.rewards%rowtype;
  p public.profiles%rowtype;
  v_previo text;
  v_saldo integer;
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

  -- El saldo de verdad: el local si no hay persona detras, y la cartera si la
  -- hay (051). Mirar `p.coins` aqui daria cero para todo el mundo convertido.
  v_saldo := public.saldo_de(p_id);

  if v_saldo < rw.cost then
    -- Un intento fallido tambien es historia: sin el, un pico de gente que
    -- no llega al premio no se ve en ninguna parte.
    perform public.anota_coins(p_id, 'canje', -rw.cost, v_saldo, v_saldo, 'sin_monedas', rw.id, p_clave);
    return 'sin_monedas';
  end if;

  perform public.motivo_coins('canje', rw.id, p_clave);
  update public.profiles set coins = coins - rw.cost where id = p_id;
  insert into public.redemptions (family_id, reward_id, profile_id, cost)
    values (rw.family_id, rw.id, p_id, rw.cost);
  return 'ok';
end $$;

-- `undo_completion` recortaba con `greatest(0, coins - c.coins)`, y ese cero es
-- el del saldo LOCAL. Para un personaje convertido eso vale cero siempre, asi
-- que deshacer una mision no le quitaba nada y la cartera se quedaba con unas
-- monedas por un trabajo que la base ya no considera hecho.
create or replace function public.undo_completion(c_id uuid)
returns text
language plpgsql
security invoker
as $$
declare
  c public.completions%rowtype;
  v_quitar integer;
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
    -- Nunca mas de lo que hay, mire donde mire el saldo. Con saldo local esto
    -- da exactamente lo mismo que el `greatest(0, ...)` de antes.
    v_quitar := least(c.coins, public.saldo_de(c.profile_id));
    perform public.motivo_coins('deshacer_mision', c.id);
    update public.profiles
      set xp = greatest(0, xp - c.xp),
          coins = coins - v_quitar
      where id = c.profile_id;
  end if;

  delete from public.completions where id = c_id;
  return 'ok';
end $$;

-- ------------------------------------------------------------------
-- 5c · LAS TRES QUE MUEVEN EL SALDO ENTRE MONEDEROS
--
-- Dejan de tocar `carteras` a mano y pasan por `mover_cartera`. Es lo que hace
-- que la ENTRADA del saldo en la cartera deje asiento: hasta ahora la
-- conversion anotaba la salida del saldo local y nada mas, y por eso el libro
-- decia que una cartera de 424 tenia 0.
-- ------------------------------------------------------------------

create or replace function public.completar_conversion(p_clave text default null)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_correo text;
  v_confirmado timestamptz;
  c public.conversiones%rowtype;
  v_saldo integer;
  v_persona_actual uuid;
  v_cartera integer;
begin
  if v_uid is null then return 'sin_sesion'; end if;

  -- Idempotencia, antes de tocar nada: mismo intento, misma respuesta.
  if p_clave is not null then
    if exists (select 1 from public.conversiones
                where clave = p_clave and estado = 'completada' and persona = v_uid) then
      return 'ok';
    end if;
  end if;

  select lower(u.email), u.email_confirmed_at into v_correo, v_confirmado
    from auth.users u where u.id = v_uid;
  if v_correo is null then return 'sin_sesion'; end if;

  -- La trampa que el proyecto ya conoce: `signUp` no falla cuando falta
  -- confirmar, solo devuelve una sesion vacia. Hasta aqui no se mueve un saldo.
  if v_confirmado is null then return 'correo_sin_confirmar'; end if;

  -- Esta cuenta no puede ser ya otra cosa. Un correo es compartida o personal,
  -- nunca las dos.
  if exists (select 1 from public.credenciales where user_id = v_uid) then
    return 'ya_clasificada';
  end if;

  select * into c from public.conversiones
   where correo = v_correo and estado = 'pendiente' and caduca_at > now()
   for update;
  if not found then return 'sin_solicitud'; end if;

  -- El personaje, otra vez y con cerrojo: entre el paso 1 y este han podido
  -- pasar tres dias.
  select p.coins, p.persona into v_saldo, v_persona_actual
    from public.profiles p where p.id = c.profile_id and p.active
   for update;
  if v_saldo is null then return 'sin_solicitud'; end if;
  if v_persona_actual is not null then return 'personaje_ocupado'; end if;

  if exists (select 1 from public.profiles p
              where p.family_id = c.family_id and p.persona = v_uid) then
    return 'ya_estas_en_el_gremio';
  end if;

  -- 1 · La identidad. Va primero porque el disparador del vinculo exige que la
  --     persona sea de clase personal antes de dejarla entrar en `profiles`.
  insert into public.credenciales (user_id, clase, family_id)
  values (v_uid, 'personal', null);

  -- 2 · La pertenencia. `reclamacion` y no `fundacion`: no crea una relacion
  --     nueva, formaliza la de quien ya operaba ese personaje, y es el unico
  --     origen que no consume llave. Y `gestor` y no `titular`: pertenecer da
  --     acceso y gestion, no la potestad de cerrar el gremio, que hoy sigue
  --     siendo de la credencial compartida que lo fundo.
  insert into public.pertenencias (persona, family_id, rol, estado, origen)
  values (v_uid, c.family_id, 'gestor', 'activa', 'reclamacion');

  -- 3 · La cartera, vacia.
  insert into public.carteras (persona, saldo) values (v_uid, 0)
  on conflict (persona) do nothing;

  -- 4 · El vinculo y la transferencia, en el mismo `update`. El disparador del
  --     libro escribe el asiento del saldo que sale; si el saldo era cero no
  --     escribe nada, que es correcto: no hubo movimiento.
  perform public.motivo_coins('conversion', c.id, p_clave);
  update public.profiles
     set persona = v_uid,
         coins = 0,
         saldo_local_cerrado = true
   where id = c.profile_id;

  -- Por la unica puerta que mueve carteras (051): asi la ENTRADA del saldo en
  -- la cartera deja su asiento, igual que la salida del saldo local lo deja
  -- arriba. Una transferencia entre dos monederos son dos apuntes, y hasta la
  -- 051 solo se anotaba uno.
  -- Sin la clave a proposito: la lleva la pata de salida, que escribe
  -- `tg_movimiento_coins` unas lineas arriba, y el indice de idempotencia es
  -- unico en todo el libro. Las dos patas de un traspaso son UNA operacion, y
  -- la garantia de "una sola vez" ya la da `conversiones.clave`.
  v_cartera := public.mover_cartera(v_uid, c.profile_id, 'conversion', v_saldo, c.id, null);

  -- 5 · El asiento de la conversion, que es esta misma fila.
  update public.conversiones
     set estado = 'completada',
         persona = v_uid,
         saldo_local_antes = v_saldo,
         importe = v_saldo,
         saldo_cartera_despues = v_cartera,
         resultado = 'ok',
         clave = p_clave,
         resuelta_at = now()
   where id = c.id;

  return 'ok';
end $fn$;

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

  -- Por la unica puerta que mueve carteras (051), igual que la conversion.
  -- Sin clave, por lo mismo que en la conversion: la lleva la pata de salida.
  v_cartera := public.mover_cartera(v_uid, m.profile_id, 'conversion', v_saldo, m.id, null);

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

create or replace function public.borrar_mi_identidad(
  p_decisiones jsonb default '[]'::jsonb,
  p_clave text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_efecto jsonb;
  g jsonb;
  v_family uuid;
  v_accion text;
  v_decision jsonb;
  v_destino uuid;
  v_saldo integer := 0;
  v_perfil uuid;
begin
  if v_uid is null then return 'sin_sesion'; end if;
  if public.clase_credencial() <> 'personal' then return 'no_es_personal'; end if;

  -- Se calcula entero aqui, otra vez, aunque el cliente ya lo haya pedido para
  -- pintarlo: entre una cosa y otra ha podido cambiar cualquier cosa, y lo que
  -- diga el cliente no autoriza nada.
  v_efecto := public.efecto_de_borrarme();

  if not (v_efecto->>'cartera_resuelta')::boolean then
    return 'varios_gremios_no_resuelto';
  end if;

  -- Primero se comprueban TODAS las decisiones. Si falta una, no se ha tocado
  -- nada todavia: quedarse a medias aqui es dejar a alguien fuera de un gremio
  -- que no llego a traspasar.
  for g in select * from jsonb_array_elements(v_efecto->'gremios') loop
    v_accion := g->>'accion';
    if v_accion = 'abandonar' then continue; end if;

    v_family := (g->>'family_id')::uuid;
    select d into v_decision
      from jsonb_array_elements(coalesce(p_decisiones, '[]'::jsonb)) d
     where (d->>'family_id')::uuid = v_family limit 1;

    if v_decision is null or (v_decision->>'accion') is distinct from v_accion then
      return 'falta_decision';
    end if;

    if v_accion = 'transferir' then
      v_destino := nullif(v_decision->>'a','')::uuid;
      if v_destino is null or v_destino = v_uid
         or not exists (select 1 from public.pertenencias o
                         where o.family_id = v_family and o.persona = v_destino
                           and o.estado = 'activa') then
        return 'destino_invalido';
      end if;
    end if;
  end loop;

  -- Y ahora si.
  for g in select * from jsonb_array_elements(v_efecto->'gremios') loop
    v_family := (g->>'family_id')::uuid;
    v_accion := g->>'accion';

    if v_accion = 'transferir' then
      select nullif(d->>'a','')::uuid into v_destino
        from jsonb_array_elements(p_decisiones) d
       where (d->>'family_id')::uuid = v_family limit 1;
      update public.pertenencias
         set rol = 'titular'
       where family_id = v_family and persona = v_destino and estado = 'activa';
    end if;

    update public.pertenencias
       set estado = 'abandonada', hasta = now()
     where family_id = v_family and persona = v_uid and estado = 'activa';

    -- Cerrar va al final del gremio y solo cuando no queda nadie: es la unica
    -- rama que borra algo, y la unica que la persona ha tenido que escribir.
    if v_accion = 'cerrar' then
      delete from public.families where id = v_family;
    end if;
  end loop;

  -- La cartera vuelve al personaje y el saldo local se reabre. Simetrico de la
  -- conversion: el dinero del juego no se evapora porque alguien borre su
  -- cuenta, y ese personaje se queda en la casa a la vista de todos.
  select coalesce(saldo, 0) into v_saldo from public.carteras where persona = v_uid;
  select id into v_perfil from public.profiles where persona = v_uid limit 1;

  if v_perfil is not null then
    if v_saldo > 0 then
      perform public.motivo_coins('devolucion_conversion', null, p_clave);
    end if;
    update public.profiles
       set coins = coins + v_saldo,
           persona = null,
           saldo_local_cerrado = false
     where id = v_perfil;
    -- Y la salida de la cartera, por su puerta y con su asiento (051): sin
    -- el, el libro diria que esa cartera sigue teniendo lo que ya no tiene.
    perform public.mover_cartera(v_uid, v_perfil, 'devolucion_conversion', -v_saldo, null, null);
  end if;

  -- Y la cuenta. La cascada se lleva su credencial, sus pertenencias y su
  -- cartera --que son suyas-- y deja en pie el gremio, los perfiles, el
  -- historial y la fila de `conversiones`, que se queda sin persona pero
  -- conserva los importes.
  delete from public.user_limits where user_id = v_uid;
  delete from auth.users where id = v_uid;

  return 'ok';
end $fn$;

-- ------------------------------------------------------------------
-- 5b · Y LA MARCA DEJA DE PODER MENTIR
--
-- `saldo_local_cerrado` la puso la 047 para que I-23 no fuera solo una frase.
-- Desde que encamina el disparador, la que manda de verdad es `persona`: si la
-- hay, el saldo vive en la cartera. Tener las dos cosas por separado es tener
-- dos fuentes de la misma verdad, que es contra lo que pelea medio esquema.
--
-- No se retira la columna --tres funciones ya en produccion la escriben-- pero
-- se le ata a la persona con un CHECK, asi que no puede desviarse.
-- ------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_marca_de_cartera;
alter table public.profiles add constraint profiles_marca_de_cartera check (
  saldo_local_cerrado = (persona is not null)
);

-- ------------------------------------------------------------------
-- 6 · LA APERTURA DEL LIBRO
--
-- Un asiento por perfil con saldo, una sola vez. A partir de aqui la suma de
-- los asientos reproduce el saldo, que es lo que pide `CON-5` y lo que permite
-- que la comprobacion de descuadre signifique algo.
-- ------------------------------------------------------------------

insert into public.movimientos_coins
  (family_id, profile_id, persona, tipo, importe, saldo_antes, saldo_despues, resultado)
select p.family_id, p.id, p.persona, 'apertura', p.coins, 0, p.coins, 'ok'
  from public.profiles p
 where p.coins <> 0
   and not exists (
     select 1 from public.movimientos_coins m
      where m.profile_id = p.id and m.tipo = 'apertura'
   );

-- ------------------------------------------------------------------
-- 7 · Y LA COMPROBACION QUE LO VIGILA
--
-- Cero filas es lo bueno. Los dos monederos se comprueban por separado, que es
-- justo para lo que sirve la columna `persona` del libro.
-- ------------------------------------------------------------------

create or replace function public.descuadre_saldos()
returns table (monedero text, quien uuid, saldo integer, segun_el_libro bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select 'personaje', p.id, p.coins,
         coalesce(sum(m.importe) filter (where m.resultado = 'ok'), 0)
    from public.profiles p
    left join public.movimientos_coins m
      on m.profile_id = p.id and m.persona is null
   group by p.id, p.coins
  having p.coins <> coalesce(sum(m.importe) filter (where m.resultado = 'ok'), 0)

  union all

  select 'cartera', c.persona, c.saldo,
         coalesce(sum(m.importe) filter (where m.resultado = 'ok'), 0)
    from public.carteras c
    left join public.movimientos_coins m on m.persona = c.persona
   group by c.persona, c.saldo
  having c.saldo <> coalesce(sum(m.importe) filter (where m.resultado = 'ok'), 0);
$fn$;

revoke all on function public.descuadre_saldos() from public;
revoke all on function public.descuadre_saldos() from anon;
revoke all on function public.descuadre_saldos() from authenticated;

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
--   select * from public.descuadre_saldos();   -- cero filas
--
--   select tipo, count(*), sum(importe)
--     from public.movimientos_coins group by tipo order by tipo;
-- ------------------------------------------------------------------
