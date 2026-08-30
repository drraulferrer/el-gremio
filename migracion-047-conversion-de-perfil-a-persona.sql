-- Migracion 047 · convertir un perfil en persona, sin que se reinicie nada.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Pieza 2.5 de la Fase 2: el flujo F-9 de la especificacion.
--
-- ------------------------------------------------------------------
-- LO QUE ES, Y LO QUE LA GENTE TEME QUE SEA
--
-- Convertirse NO crea un personaje nuevo: **vincula una identidad al que ya
-- existe**. Se conserva todo --nivel, XP, marca de agua, insignias,
-- reconocimientos, historial-- y el personaje **sigue en el selector de la
-- casa**, operable con la clave compartida como hasta ahora. Nadie mas pierde
-- nada. Eso es lo que hay que decir en pantalla el dia que haya pantalla,
-- porque es exactamente lo que la gente teme al ver la palabra "cuenta".
--
-- ------------------------------------------------------------------
-- POR QUE SON DOS PASOS Y NO UNO
--
-- Porque `signUp` devuelve `error: null` y `session: null` cuando el proyecto
-- pide confirmar el correo. La identidad no es buena hasta que ese correo esta
-- confirmado, y **hasta entonces no se transfiere ni un Talis ni se crea
-- ninguna pertenencia**: un correo mal escrito dejaria el saldo en una
-- identidad que no controla nadie.
--
-- Y hay un segundo motivo, que es el que decide el diseno: la sesion nueva
-- --la del correo personal-- **no tiene forma de demostrar que operaba ese
-- personaje**. Son dos sesiones distintas. Por eso:
--
--   1 · `solicitar_conversion` se llama DESDE LA SESION COMPARTIDA, que si
--       puede demostrarlo, y con el PIN, que es la unica puerta que demuestra
--       que hay una persona adulta delante. Deja una fila con el correo
--       elegido y una caducidad de 72 horas.
--   2 · La persona se da de alta con ese correo y lo confirma.
--   3 · `completar_conversion` se llama DESDE LA SESION NUEVA. El enlace entre
--       las dos es el correo: lo eligio a mano quien estaba dentro del gremio,
--       y haberlo confirmado demuestra que ese buzon es suyo. No hace falta
--       ningun secreto que pasar de una sesion a la otra.
--
-- ------------------------------------------------------------------
-- EL VINCULO NUNCA SE INFIERE
--
-- Ni por nombre, ni por edad, ni por orden de creacion, ni por parecido de
-- correo. Vincular a la persona equivocada es el fallo mas dificil de deshacer
-- de todo este modelo. El personaje se elige a mano en el paso 1, dentro del
-- gremio y con el PIN.
--
-- ------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE, Y HAY QUE LEERLO ENTERO
--
-- **No hay pantalla, y no es un olvido.** La identidad personal aparece solo
-- cuando alguien necesita cruzar el limite de su gremio: forjar una llave
-- (Fase 5), aceptar una invitacion o cambiar de gremio (Fase 6). Nada de eso
-- existe todavia, asi que **no hay disparo** y ofrecerla "por si acaso" seria
-- justo lo que la especificacion prohibe. Estas funciones existen, estan
-- probadas, y no las llama nadie.
--
-- **La cartera recibe el saldo, pero todavia no lo gasta ni lo llena.** Las
-- ocho funciones que mueven monedas siguen escribiendo en `profiles.coins`, y
-- encaminarlas a la cartera es la Fase 3. Mientras tanto, un personaje
-- convertido tendria su saldo en la cartera y sus ganancias nuevas cayendo en
-- un saldo local ya cerrado. **Por eso la Fase 3 tiene que llegar ANTES que la
-- Fase 5**, que es el orden que el plan ya tiene (0-1-2-3-5-6). Si alguien se
-- salta ese orden, el primer gremialista que se convierta se queda con dos
-- monederos y ninguno completo.
--
-- **No convierte juniors.** Un junior alcanza hitos como cualquiera, pero
-- crear un correo y una contrasena para una menor tiene requisitos legales que
-- este proyecto no ha mirado: edad minima de consentimiento digital,
-- verificacion y responsabilidad. Va detras de su revision juridica (Fase 8a).
-- Peques y mascotas no se convierten nunca: no son personas con correo.
--
-- **No migra el correo compartido.** Quien fundo la casa con su correo
-- personal se choca con `correo_es_la_clave_de_casa`, y eso es la pieza 2.6
-- (F-13, ocho pasos). Es el caso MAS FRECUENTE, asi que la 2.6 no es opcional:
-- sin ella, la pantalla estrella devuelve un error a casi todo el mundo.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · LA CARTERA
--
-- Saldo unico por persona, independiente del gremio. Se crea vacia en la
-- conversion y se llena con la transferencia de ese mismo momento: no hay
-- relleno masivo, y quien no se convierte conserva su saldo local tal cual.
-- ------------------------------------------------------------------

create table if not exists public.carteras (
  persona uuid primary key references auth.users(id) on delete cascade,
  -- Sin negativos: un saldo negativo en una economia de casa no significa
  -- "debe", significa "hay un fallo".
  saldo integer not null default 0 check (saldo >= 0),
  created_at timestamptz not null default now()
);

alter table public.carteras enable row level security;

drop policy if exists cartera_propia on public.carteras;
create policy cartera_propia on public.carteras
  for select to authenticated
  using (persona = auth.uid());

revoke all on table public.carteras from anon;
revoke all on table public.carteras from authenticated;
grant select on table public.carteras to authenticated;

-- ------------------------------------------------------------------
-- 2 · EL SALDO LOCAL, CERRADO
--
-- Tras la transferencia, el saldo del personaje deja de ser una SEGUNDA
-- fuente gastable. No se borra la columna --el historial de asientos apunta a
-- ella-- se marca.
-- ------------------------------------------------------------------

alter table public.profiles
  add column if not exists saldo_local_cerrado boolean not null default false;

comment on column public.profiles.saldo_local_cerrado is
  'Su saldo vive en la cartera de su persona desde la conversion. `coins` deja de ser gastable.';

-- ------------------------------------------------------------------
-- 3 · EL LIBRO CONOCE UN MOTIVO MAS
-- ------------------------------------------------------------------

alter table public.movimientos_coins drop constraint if exists movimientos_coins_tipo_check;
alter table public.movimientos_coins add constraint movimientos_coins_tipo_check check (tipo in (
  'canje', 'devolucion_canje', 'mision', 'deshacer_mision',
  'bonus_diario', 'bonus_manual', 'botin_limpieza', 'racha',
  -- La salida del saldo local hacia la cartera. Una sola vez por personaje.
  'conversion',
  'desconocido'
));

-- ------------------------------------------------------------------
-- 4 · LA SOLICITUD, QUE ES TAMBIEN EL ASIENTO DE LA CONVERSION
--
-- Guarda lo que exige el requisito: personaje, gremio, correo, saldo local
-- antes, importe transferido, saldo de la cartera despues, fecha, resultado y
-- clave de idempotencia. No hace falta un libro aparte para la cartera: esta
-- fila ES el apunte de la unica operacion que la llena.
-- ------------------------------------------------------------------

create table if not exists public.conversiones (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  -- En minusculas siempre: el correo que se compara con `auth.users` y el que
  -- se tecleo tienen que ser el mismo aunque uno lleve mayusculas.
  correo text not null check (correo = lower(correo) and correo like '%_@_%'),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','completada','caducada','cancelada')),
  persona uuid references auth.users(id) on delete set null,
  saldo_local_antes integer,
  importe integer,
  saldo_cartera_despues integer,
  resultado text,
  clave text check (clave is null or length(clave) between 8 and 120),
  solicitada_at timestamptz not null default now(),
  caduca_at timestamptz not null,
  resuelta_at timestamptz,
  -- Una completada tiene persona y fecha; una pendiente, ninguna de las dos.
  constraint conversiones_completada_coherente check (
    case
      when estado = 'completada' then persona is not null and resuelta_at is not null
      when estado = 'pendiente' then persona is null and resuelta_at is null
      else true
    end
  )
);

-- Una pendiente por personaje y una por correo. Con indices y no con un
-- `select` previo: entre el select y el insert cabe otra peticion.
create unique index if not exists idx_conversion_pendiente_perfil
  on public.conversiones (profile_id) where estado = 'pendiente';
create unique index if not exists idx_conversion_pendiente_correo
  on public.conversiones (correo) where estado = 'pendiente';
create index if not exists idx_conversiones_gremio
  on public.conversiones (family_id, solicitada_at desc);

alter table public.conversiones enable row level security;

-- La ve el gremio donde se pidio --que es quien la pidio-- y la persona a la
-- que acabo perteneciendo.
drop policy if exists conversion_visible on public.conversiones;
create policy conversion_visible on public.conversiones
  for select to authenticated
  using (family_id in (select public.mis_gremios()) or persona = auth.uid());

revoke all on table public.conversiones from anon;
revoke all on table public.conversiones from authenticated;
grant select on table public.conversiones to authenticated;

-- ------------------------------------------------------------------
-- 5 · PASO 1 · SOLICITAR, DESDE LA SESION COMPARTIDA
--
-- Codigos que devuelve, y cada uno dice algo distinto en pantalla:
--   'ok'
--   'sin_sesion'
--   'no_existe'                  el personaje no esta o esta retirado
--   'no_es_tuyo'                 no es un gremio al que llegue esta sesion
--   'pin_incorrecto'
--   'solo_adulto'                peque o mascota: no se convierten nunca
--   'junior_bloqueado'           va detras de su revision juridica (Fase 8a)
--   'ya_es_persona'              ese personaje ya tiene identidad detras
--   'ya_tienes_solicitud'        hay una pendiente para este personaje
--   'correo_invalido'
--   'correo_es_la_clave_de_casa' el caso mas frecuente -> F-13, pieza 2.6
--   'correo_no_disponible'       ese correo ya tiene cuenta, y no se dice mas
-- ------------------------------------------------------------------

create or replace function public.solicitar_conversion(
  p_profile uuid,
  p_correo text,
  p_pin_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_correo text := lower(btrim(p_correo));
  v_family uuid;
  v_rol text;
  v_persona uuid;
  v_pin text;
  v_otro uuid;
begin
  if auth.uid() is null then return 'sin_sesion'; end if;

  if v_correo is null or v_correo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or length(v_correo) > 254 then
    return 'correo_invalido';
  end if;

  select p.family_id, p.role, p.persona into v_family, v_rol, v_persona
    from public.profiles p where p.id = p_profile and p.active;
  if v_family is null then return 'no_existe'; end if;

  if not public.es_mi_gremio(v_family) then return 'no_es_tuyo'; end if;

  -- El PIN, que es lo unico que demuestra que hay una persona adulta delante.
  -- Llega ya resumido: lo calcula el cliente con SHA-256, como todo el resto
  -- del proyecto (`hashPin` en src/lib/supabase.js).
  select f.parent_pin_hash into v_pin from public.families f where f.id = v_family;
  if v_pin is null or p_pin_hash is null or p_pin_hash <> v_pin then
    return 'pin_incorrecto';
  end if;

  if v_rol = 'junior' then return 'junior_bloqueado'; end if;
  if v_rol <> 'adulto' then return 'solo_adulto'; end if;
  if v_persona is not null then return 'ya_es_persona'; end if;

  -- El correo, contra las dos clases de credencial. El caso frecuente --el de
  -- quien fundo la casa con su correo personal-- se dice con su nombre y no
  -- como "ese correo ya existe": es SU casa y su correo, y merece saber que la
  -- salida es la migracion guiada y no inventarse otro correo.
  select c.user_id into v_otro
    from public.credenciales c
    join auth.users u on u.id = c.user_id
   where lower(u.email) = v_correo and c.clase = 'compartida';
  if v_otro is not null then return 'correo_es_la_clave_de_casa'; end if;

  -- Cualquier otra cuenta: no se dice de quien ni de que. Un mensaje mas
  -- concreto convierte esta pantalla en un comprobador de que correos estan
  -- dados de alta.
  if exists (select 1 from auth.users u where lower(u.email) = v_correo) then
    return 'correo_no_disponible';
  end if;

  -- Las caducadas se retiran de en medio antes de mirar si hay una viva, o el
  -- indice unico parcial deja atrapado a quien se equivoco de correo hace una
  -- semana.
  update public.conversiones
     set estado = 'caducada', resultado = 'caducada'
   where estado = 'pendiente' and caduca_at < now();

  begin
    insert into public.conversiones (profile_id, family_id, correo, caduca_at)
    values (p_profile, v_family, v_correo, now() + interval '72 hours');
  exception when unique_violation then
    return 'ya_tienes_solicitud';
  end;

  return 'ok';
end $fn$;

revoke all on function public.solicitar_conversion(uuid, text, text) from public;
revoke all on function public.solicitar_conversion(uuid, text, text) from anon;
grant execute on function public.solicitar_conversion(uuid, text, text) to authenticated;

-- Retirar la propia solicitud, desde el mismo gremio. Existe porque el indice
-- de "una pendiente por personaje" es una trampa sin esto: quien escriba mal
-- el correo se queda esperando 72 horas.
create or replace function public.cancelar_conversion(p_conversion uuid, p_pin_hash text)
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
    from public.conversiones where id = p_conversion;
  if v_family is null then return 'no_existe'; end if;
  if not public.es_mi_gremio(v_family) then return 'no_es_tuyo'; end if;

  select f.parent_pin_hash into v_pin from public.families f where f.id = v_family;
  if v_pin is null or p_pin_hash is null or p_pin_hash <> v_pin then
    return 'pin_incorrecto';
  end if;

  if v_estado <> 'pendiente' then return 'ya_resuelta'; end if;

  update public.conversiones
     set estado = 'cancelada', resultado = 'cancelada'
   where id = p_conversion;
  return 'ok';
end $fn$;

revoke all on function public.cancelar_conversion(uuid, text) from public;
revoke all on function public.cancelar_conversion(uuid, text) from anon;
grant execute on function public.cancelar_conversion(uuid, text) to authenticated;

-- ------------------------------------------------------------------
-- 6 · PASO 2 · COMPLETAR, DESDE LA SESION NUEVA
--
-- Todo en UNA transaccion: identidad, vinculo, pertenencia, cartera,
-- transferencia y cierre del saldo local se mueven juntos o no se mueve nada.
--
-- Codigos:
--   'ok'
--   'sin_sesion'
--   'correo_sin_confirmar'   la identidad no es buena hasta entonces
--   'sin_solicitud'          ninguna viva para este correo
--   'ya_clasificada'         esta cuenta ya es compartida o ya es personal
--   'personaje_ocupado'      alguien se vinculo a ese personaje mientras tanto
--   'ya_estas_en_el_gremio'  esta persona ya tiene personaje ahi
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

  update public.carteras set saldo = saldo + v_saldo where persona = v_uid
    returning saldo into v_cartera;

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

revoke all on function public.completar_conversion(text) from public;
revoke all on function public.completar_conversion(text) from anon;
grant execute on function public.completar_conversion(text) to authenticated;

-- ------------------------------------------------------------------
-- 7 · UN SALDO CERRADO NO SE GASTA
--
-- `redeem_reward` queda identica salvo esta comprobacion. Sin ella, la marca
-- del punto 2 no marcaria nada: seria una columna que nadie lee. Hoy no la
-- puede provocar nadie --tras la transferencia el saldo queda a cero y el
-- canje fallaria igual por falta de monedas-- pero decir 'sin_monedas' a quien
-- tiene 300 en la cartera es mentir, y en la Fase 3 esa rama sera la normal.
-- ------------------------------------------------------------------

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

  -- El saldo de este personaje vive en la cartera de su persona desde que se
  -- convirtió (047). `coins` ya no es una segunda fuente gastable, y decir
  -- «no tienes suficientes» a quien tiene 300 en la cartera sería mentir.
  if p.saldo_local_cerrado then return 'saldo_en_cartera'; end if;

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
-- Tras ejecutar, y mientras no se convierta nadie, esto tiene que dar ceros:
--
--   select
--     (select count(*) from public.carteras)                              as carteras,
--     (select count(*) from public.conversiones)                          as conversiones,
--     (select count(*) from public.credenciales where clase = 'personal') as personales,
--     (select count(*) from public.pertenencias)                          as pertenencias,
--     (select count(*) from public.profiles where saldo_local_cerrado)    as cerrados;
--
-- Y la regla del libro, que tiene que seguir cuadrando para todo el mundo:
--
--   select p.id, p.coins,
--          coalesce(sum(m.importe) filter (where m.resultado = 'ok'), 0) as segun_el_libro
--     from public.profiles p
--     left join public.movimientos_coins m on m.profile_id = p.id
--    group by p.id, p.coins;
-- ------------------------------------------------------------------
