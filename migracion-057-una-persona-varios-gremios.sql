-- Migracion 057 · una persona, varios gremios.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Pieza 6.1 de la Fase 6: el SERVIDOR. Invitaciones con caducidad, crear un
-- gremio con llave, aceptar con llave, abandonar, expulsar y reingresar.
--
-- **No toca el cliente**, y eso es deliberado: mientras nadie tenga dos
-- gremios, nada de esto cambia lo que ve la familia que usa la app hoy. El
-- selector de gremio y la carga son la 6.2, que si lleva version y despliegue.
--
-- ------------------------------------------------------------------
-- EL INDICE QUE HABIA QUE QUITAR, Y POR QUE NO ANTES
--
-- `idx_families_owner` era UNICO desde la 017, y su comentario decia por que:
--
--   "la app carga el gremio con `limit 1` sin orden, asi que una cuenta con
--    dos gremios abre uno u otro segun el dia. Mientras eso siga asi, dos
--    gremios por cuenta son un error, no una funcion."
--
-- Sigue siendo verdad, asi que el orden importa: aqui el indice deja de ser
-- unico --y NO desaparece, porque la primera rama de `mis_gremios()` es
-- `families.owner = auth.uid()` y sin el cada peticion recorreria la tabla
-- entera-- pero **nadie tiene dos gremios hasta que la 6.2 este desplegada**.
-- Expandir, migrar, contraer, como siempre en esta casa.
--
-- ------------------------------------------------------------------
-- QUIEN ES EL `owner` DE UN GREMIO CREADO CON LLAVE
--
-- Hasta hoy `families.owner` era la **credencial compartida** del gremio: la
-- cuenta de la casa. Un gremio creado con llave lo crea una PERSONA, cuya
-- credencial es 'personal', y `credenciales` tiene un `check` que prohibe que
-- una personal lleve `family_id`.
--
-- Asi que ese gremio **nace sin credencial compartida**, y su `owner` es la
-- cuenta personal de quien lo crea. `mis_gremios()` lo recoge igual, por su
-- primera rama y por la pertenencia. Crearle una credencial compartida --para
-- que entre gente sin cuenta, como en una casa-- es la Fase 7.
--
-- Y hay una funcion que esto podria haber convertido en un desastre:
-- `delete_my_account()` borra los gremios de los que la cuenta es duena. Con
-- una persona duena de tres, eso seria borrar tres casas. **Ya estaba
-- cerrado**: la 049 le puso por delante `if clase_credencial() = 'personal'
-- then return 'usa_borrar_identidad'`. Se comprueba en los tests.
--
-- ------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE
--
-- **El gremio nuevo nace desnudo.** Sin misiones, sin premios, sin zonas y sin
-- meta. Lo que lleva cada catalogo es `D-14`, sigue sin resolver para Amigos, y
-- para Hogar vive hoy en `src/lib/setup.js`, o sea en el cliente. Moverlo es
-- una pieza propia; inventarlo aqui seria decidir producto desde una migracion.
--
-- **No hay limite de miembros por gremio.** `R-74` dice ocho humanos activos, y
-- ese numero vive hoy en el cliente (`MAX_PERFILES`). Su sitio es
-- `plantillas_tipo.limites`, que sigue vacio desde la 053. La invitacion lee
-- ese `jsonb` y, si no dice nada, no limita: escribir un 8 aqui seria repetir
-- exactamente la constante repartida que la 050 y la 053 vinieron a retirar.
--
-- **No toca los avisos.** Un aparato sigue teniendo una fila por `endpoint` con
-- su `family_id`. Con varios gremios eso significa que un telefono solo recibe
-- de uno; la decision es de la 6.3, con la pantalla delante.
--
-- **No ofrece Amigos.** No porque falte codigo, sino por una columna: el
-- `check` de `families.tipo_gremio` solo conoce 'familia' y 'piso', que es lo
-- que lee el cliente viejo. Un gremio de Amigos no tiene valor ahi. Ensanchar
-- esa columna --o retirarla, que es el paso "contraer" que la 053 dejo
-- anotado-- es requisito para publicar Amigos, y hoy `se_ofrece` ya dice que no.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · UNA CUENTA PUEDE TENER VARIOS GREMIOS
-- ------------------------------------------------------------------

drop index if exists public.idx_families_owner;
create index if not exists idx_families_owner on public.families (owner);

-- ------------------------------------------------------------------
-- 2 · LA INVITACION
--
-- Se dirige a un CORREO y no a una cuenta, porque a quien se invita puede
-- todavia no tener ninguna: es el mismo criterio que `conversiones.correo`
-- desde la 047. La cuenta se resuelve al aceptar, comparando con
-- `auth.users.email`.
--
-- `caduca_at` se guarda, pero la caducidad **se evalua al usarla** (`T-3`): no
-- hay reloj que la mueva sola, y un proceso que marcara caducadas por su cuenta
-- seria una transicion disparada por el tiempo y no por una persona. Cuando
-- alguien intenta usar una vencida, ESE intento la cierra.
-- ------------------------------------------------------------------

create table if not exists public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  correo text not null check (correo = lower(correo) and correo like '%_@_%'),

  -- Quien la emitio: la cuenta y, si fue con la credencial compartida, el
  -- personaje que la opero. Sin clave ajena a `auth.users`, como el resto de
  -- los apuntes de auditoria: sobrevive a la cuenta que nombra.
  emitida_por uuid,
  emitida_por_personaje uuid,

  estado text not null default 'pendiente'
    check (estado in ('pendiente','aceptada','rechazada','revocada','caducada')),
  -- Quien la acepto. Nula mientras no se acepte.
  persona uuid references auth.users(id) on delete set null,

  emitida_at timestamptz not null default now(),
  caduca_at timestamptz not null,
  resuelta_at timestamptz,

  constraint invitacion_resuelta_fechada check (
    case when estado = 'pendiente' then resuelta_at is null and persona is null
         else resuelta_at is not null end
  )
);

-- Una pendiente por gremio y correo. `T-5` dice que puede haber varias
-- pendientes de gremios DISTINTOS para la misma persona, y este indice no lo
-- impide: solo prohibe que un mismo gremio invite dos veces a la vez.
create unique index if not exists idx_invitacion_pendiente
  on public.invitaciones (family_id, correo) where estado = 'pendiente';

create index if not exists idx_invitacion_correo
  on public.invitaciones (correo, estado);

alter table public.invitaciones enable row level security;

-- RLS encendido y SIN politicas, como `configuracion_expansion`. Aqui hay un
-- motivo extra: la politica natural --"la ve quien pertenece al gremio o quien
-- tiene ese correo"-- necesitaria leer `auth.users` desde dentro de la
-- politica, y eso no lo puede hacer la sesion. Lo que sale de aqui sale por las
-- dos funciones de lectura de mas abajo, que devuelven lo justo.
revoke all on table public.invitaciones from anon;
revoke all on table public.invitaciones from authenticated;

-- ------------------------------------------------------------------
-- 3 · ENTRAR EN UN GREMIO
--
-- Lo comun a crear con llave y a aceptar una invitacion, escrito una vez.
--
-- Y aqui vive `R-63`, que es la regla menos evidente de la fase: al REINGRESAR
-- **no se crea un personaje nuevo, se reactiva el anterior** con su XP, su
-- marca de agua, sus insignias y su historial. "Empezar desde cero en cada
-- gremio" es la primera vez que entras, no cada vez (`R-64`, `D-08`). Sin esto,
-- volver a casa te costaria el historial, que es un castigo por marcharse.
--
-- Interna: la llaman las dos funciones de abajo dentro de su transaccion.
-- ------------------------------------------------------------------

create or replace function public.entrar_en_gremio(
  p_family uuid,
  p_rol text,
  p_origen text,
  p_personaje text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_profile uuid;
  v_rol_personaje text;
begin
  -- El rol del personaje lo declara la plantilla, no una cadena escrita aqui.
  select coalesce(t.roles->>'al_fundar', 'adulto') into v_rol_personaje
    from public.families f
    join public.plantillas_tipo t
      on t.tipo = f.tipo_plantilla and t.version = f.plantilla_version
   where f.id = p_family;

  -- `R-63`: si ya hubo un personaje mio aqui, vuelve; no nace otro.
  select p.id into v_profile
    from public.profiles p
   where p.family_id = p_family and p.persona = v_uid;

  if v_profile is not null then
    update public.profiles set active = true where id = v_profile;
  else
    insert into public.profiles
      (family_id, name, role, xp, xp_maxima, coins, persona, saldo_local_cerrado, active)
    -- `left(...,40)` porque `profiles.name` no admite mas, y un nombre largo
    -- tiene que quedarse corto, no tumbar la entrada al gremio.
    values (p_family, left(coalesce(nullif(btrim(p_personaje), ''), 'Yo'), 40),
            coalesce(v_rol_personaje, 'adulto'),
            0, 0, 0, v_uid, true, true)
    returning id into v_profile;
  end if;

  insert into public.pertenencias (persona, family_id, rol, estado, origen)
  values (v_uid, p_family, p_rol, 'activa', p_origen);

  return v_profile;
end $fn$;

revoke all on function public.entrar_en_gremio(uuid, text, text, text) from public;
revoke all on function public.entrar_en_gremio(uuid, text, text, text) from anon;
revoke all on function public.entrar_en_gremio(uuid, text, text, text) from authenticated;

-- ------------------------------------------------------------------
-- 4 · INVITAR
-- ------------------------------------------------------------------

create or replace function public.invitar(
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
  v_dias integer;
  v_invitado uuid;
  v_tope integer;
  v_dentro integer;
begin
  if v_uid is null then return 'sin_sesion'; end if;
  if not public.es_mi_gremio(p_family) then return 'no_es_tuyo'; end if;
  -- `CAP-01`, y no una etiqueta (054).
  if public.puede(p_family, 'CAP-01', p_profile) = 'no' then return 'no_puede'; end if;
  if v_correo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then return 'correo_invalido'; end if;

  -- Si ese correo ya tiene cuenta y ya esta dentro, no se invita.
  select u.id into v_invitado from auth.users u where lower(u.email) = v_correo;
  if v_invitado is not null and exists (
    select 1 from public.pertenencias p
     where p.persona = v_invitado and p.family_id = p_family and p.estado = 'activa'
  ) then
    return 'ya_esta_dentro';
  end if;

  -- El tope de gente sale de la PLANTILLA. Si no lo declara, no hay tope: un 8
  -- escrito aqui seria otra constante repartida, que es justo lo que la 053
  -- vino a retirar. Ver la cabecera.
  select (t.limites->>'miembros_humanos')::integer into v_tope
    from public.families f
    join public.plantillas_tipo t
      on t.tipo = f.tipo_plantilla and t.version = f.plantilla_version
   where f.id = p_family;
  if v_tope is not null then
    select count(*) into v_dentro
      from public.profiles p
     where p.family_id = p_family and p.active and p.role <> 'mascota';
    if v_dentro >= v_tope then return 'gremio_lleno'; end if;
  end if;

  select pa.invitacion_dias into v_dias from public.parametros_expansion() pa;
  if v_dias is null then return 'sin_configuracion'; end if;

  begin
    insert into public.invitaciones
      (family_id, correo, emitida_por, emitida_por_personaje, caduca_at)
    values (p_family, v_correo, v_uid, p_profile,
            now() + make_interval(days => v_dias));
  exception when unique_violation then
    -- Ya hay una pendiente para ese correo en este gremio. No es un fallo: el
    -- estado que se pedia ya existe.
    return 'ya_invitada';
  end;

  return 'ok';
end $fn$;

revoke all on function public.invitar(uuid, text, uuid) from public;
revoke all on function public.invitar(uuid, text, uuid) from anon;
grant execute on function public.invitar(uuid, text, uuid) to authenticated;

-- ------------------------------------------------------------------
-- 5 · LAS DOS LECTURAS
--
-- La bandeja es DE LA PERSONA y no del gremio activo (`F-2` paso 3): se ven
-- desde cualquier sitio, y cada una dice de que tipo es el gremio al que
-- invitan, porque entrar en un equipo de trabajo y entrar en una casa no son
-- la misma decision.
--
-- El estado que se devuelve es el VIVO: una pendiente que ya venció se lee como
-- caducada aunque su fila siga diciendo 'pendiente', porque la fila solo se
-- cierra cuando alguien intenta usarla (`T-3`).
-- ------------------------------------------------------------------

create or replace function public.mis_invitaciones()
returns table (
  id uuid,
  family_id uuid,
  gremio text,
  tipo text,
  tipo_visible text,
  estado text,
  emitida_at timestamptz,
  caduca_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select i.id, i.family_id, f.name, f.tipo_plantilla, t.nombre_visible,
         case when i.estado = 'pendiente' and i.caduca_at <= now()
              then 'caducada' else i.estado end,
         i.emitida_at, i.caduca_at
    from public.invitaciones i
    join public.families f on f.id = i.family_id
    left join public.plantillas_tipo t
      on t.tipo = f.tipo_plantilla and t.version = f.plantilla_version
   where i.correo = (select lower(u.email) from auth.users u where u.id = auth.uid())
   order by i.emitida_at desc;
$fn$;

revoke all on function public.mis_invitaciones() from public;
revoke all on function public.mis_invitaciones() from anon;
grant execute on function public.mis_invitaciones() to authenticated;

-- Y las que ha emitido un gremio, para quien lo administra.
create or replace function public.invitaciones_del_gremio(p_family uuid)
returns table (
  id uuid,
  correo text,
  estado text,
  emitida_at timestamptz,
  caduca_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select i.id, i.correo,
         case when i.estado = 'pendiente' and i.caduca_at <= now()
              then 'caducada' else i.estado end,
         i.emitida_at, i.caduca_at
    from public.invitaciones i
   where i.family_id = p_family
     and public.es_mi_gremio(p_family)
   order by i.emitida_at desc;
$fn$;

revoke all on function public.invitaciones_del_gremio(uuid) from public;
revoke all on function public.invitaciones_del_gremio(uuid) from anon;
grant execute on function public.invitaciones_del_gremio(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 6 · RECHAZAR Y REVOCAR
--
-- `T-2`: **ninguna** transicion de invitacion toca una llave. Rechazar,
-- revocar y caducar cambian el estado de la invitacion y nada mas (`R-21`).
-- ------------------------------------------------------------------

create or replace function public.rechazar_invitacion(p_invitacion uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  i public.invitaciones%rowtype;
  v_correo text;
begin
  if auth.uid() is null then return 'sin_sesion'; end if;
  select lower(u.email) into v_correo from auth.users u where u.id = auth.uid();

  select * into i from public.invitaciones where id = p_invitacion for update;
  if i.id is null then return 'no_existe'; end if;
  if i.correo is distinct from v_correo then return 'no_es_tuya'; end if;
  if i.estado <> 'pendiente' then return 'ya_resuelta'; end if;

  update public.invitaciones
     set estado = 'rechazada', resuelta_at = now()
   where id = p_invitacion;
  return 'ok';
end $fn$;

revoke all on function public.rechazar_invitacion(uuid) from public;
revoke all on function public.rechazar_invitacion(uuid) from anon;
grant execute on function public.rechazar_invitacion(uuid) to authenticated;

create or replace function public.revocar_invitacion(
  p_invitacion uuid,
  p_profile uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  i public.invitaciones%rowtype;
begin
  if auth.uid() is null then return 'sin_sesion'; end if;

  select * into i from public.invitaciones where id = p_invitacion for update;
  if i.id is null then return 'no_existe'; end if;
  if not public.es_mi_gremio(i.family_id) then return 'no_es_tuyo'; end if;
  -- `CAP-02`, la capacidad de revocar.
  if public.puede(i.family_id, 'CAP-02', p_profile) = 'no' then return 'no_puede'; end if;
  -- `T-4`: revocar una ya aceptada no existe. Para eso esta expulsar.
  if i.estado <> 'pendiente' then return 'ya_resuelta'; end if;

  update public.invitaciones
     set estado = 'revocada', resuelta_at = now()
   where id = p_invitacion;
  return 'ok';
end $fn$;

revoke all on function public.revocar_invitacion(uuid, uuid) from public;
revoke all on function public.revocar_invitacion(uuid, uuid) from anon;
grant execute on function public.revocar_invitacion(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------
-- 7 · ACEPTAR
--
-- El orden vuelve a ser la especificacion:
--
--   1 · sesion e identidad personal
--   2 · la invitacion es mia y esta pendiente
--   3 · no ha caducado -- y si caduco, ESTE intento la cierra (`T-3`)
--   4 · no estoy ya dentro
--   5 · plaza en el limite global (`R-23`)
--   6 · llave, salvo que sea mi PRIMERA pertenencia (`S-10`)
--   7 · y ahora si, todo en una transaccion
--
-- Si algo falla, **la invitacion no se acepta y la llave sigue disponible**
-- (`R-21`). Eso no es una comprobacion: es que las dos escrituras viven en la
-- misma transaccion y se deshacen juntas.
-- ------------------------------------------------------------------

create or replace function public.aceptar_invitacion(
  p_invitacion uuid,
  p_llave uuid default null,
  p_personaje text default null
)
returns table (resultado text, family_id uuid)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_correo text;
  i public.invitaciones%rowtype;
  v_activas integer;
  v_limite integer;
  v_estado_llave text;
  v_persona_llave uuid;
  v_nombre text;
begin
  family_id := null;
  if v_uid is null then resultado := 'sin_sesion'; return next; return; end if;
  if public.clase_credencial() <> 'personal' then
    resultado := 'exige_identidad_personal'; return next; return;
  end if;

  select lower(u.email) into v_correo from auth.users u where u.id = v_uid;

  select * into i from public.invitaciones where id = p_invitacion for update;
  if i.id is null then resultado := 'no_existe'; return next; return; end if;
  if i.correo is distinct from v_correo then resultado := 'no_es_tuya'; return next; return; end if;
  if i.estado <> 'pendiente' then resultado := 'ya_resuelta'; return next; return; end if;

  -- La caducidad se evalua al usarla, y usarla es lo que la cierra.
  if i.caduca_at <= now() then
    update public.invitaciones set estado = 'caducada', resuelta_at = now() where id = i.id;
    resultado := 'caducada'; return next; return;
  end if;

  if exists (
    select 1 from public.pertenencias p
     where p.persona = v_uid and p.family_id = i.family_id and p.estado = 'activa'
  ) then
    resultado := 'ya_estas_dentro'; return next; return;
  end if;

  select count(*) into v_activas
    from public.pertenencias p where p.persona = v_uid and p.estado = 'activa';
  select pa.limite_global into v_limite from public.parametros_expansion() pa;
  if v_limite is null then resultado := 'sin_configuracion'; return next; return; end if;
  if v_activas + 1 > v_limite then resultado := 'en_el_limite'; return next; return; end if;

  -- `S-10`: la primera pertenencia no cuesta llave. Todo lo demas, si.
  if v_activas > 0 then
    if p_llave is null then resultado := 'hace_falta_llave'; return next; return; end if;
    select d.estado, d.persona into v_estado_llave, v_persona_llave
      from public.derechos_expansion d where d.id = p_llave;
    if v_estado_llave is null then resultado := 'llave_no_existe'; return next; return; end if;
    if v_persona_llave is distinct from v_uid then resultado := 'llave_ajena'; return next; return; end if;
    if v_estado_llave <> 'disponible' then resultado := 'llave_no_disponible'; return next; return; end if;
  end if;

  select f.name into v_nombre from public.families f where f.id = i.family_id;

  perform public.entrar_en_gremio(i.family_id, 'miembro', 'invitacion', p_personaje);

  update public.invitaciones
     set estado = 'aceptada', persona = v_uid, resuelta_at = now()
   where id = i.id;

  -- La llave se consume DENTRO de esta transaccion y despues de que la entrada
  -- haya funcionado (`R-20`, `T-10`). Si `consumir_llave` lanzara --una carrera
  -- con otra peticion usando la misma llave-- se deshace todo: la pertenencia,
  -- la invitacion y el consumo. Es exactamente lo que pide `R-21`.
  if v_activas > 0 then
    perform public.consumir_llave(p_llave, i.family_id, v_nombre);
  end if;

  resultado := 'ok';
  family_id := i.family_id;
  return next;
end $fn$;

revoke all on function public.aceptar_invitacion(uuid, uuid, text) from public;
revoke all on function public.aceptar_invitacion(uuid, uuid, text) from anon;
grant execute on function public.aceptar_invitacion(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------------
-- 8 · CREAR UN GREMIO CON LLAVE (`F-1b`, `F-6`)
--
-- **No cobra nada.** El pago fue al forjar (`F-4`); cobrar aqui seria cobrar
-- dos veces.
--
-- **Nada del gremio de origen se copia**: ni nivel, ni misiones, ni premios, ni
-- insignias, ni saldo de personaje (`R-03`, `I-11`). El personaje nace a cero.
--
-- Y el pais: aqui SI llega como parametro, y no contradice `R-108`. `R-102`
-- dice que el pais se elige explicitamente al crear; lo que `R-108` prohibe es
-- que un pais declarado por el cliente **autorice** algo, y por eso la
-- eleccion se cruza contra `tipo_publicado()`, que es la matriz del servidor.
-- Hoy solo hay tipos publicados en ES, asi que declarar otro pais no desbloquea
-- nada: deniega. Esta es la primera funcion que llama a `tipo_publicado()`,
-- que la 050 escribio para este momento.
-- ------------------------------------------------------------------

create or replace function public.crear_gremio_con_llave(
  p_llave uuid,
  p_nombre text,
  p_tipo text,
  p_pais text,
  p_pin_hash text,
  p_personaje text default null
)
returns table (resultado text, family_id uuid)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_pais text := upper(btrim(coalesce(p_pais, '')));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_activas integer;
  v_limite integer;
  v_estado_llave text;
  v_persona_llave uuid;
  v_version text;
  v_tipo_gremio text;
  v_nuevo uuid;
begin
  family_id := null;
  if v_uid is null then resultado := 'sin_sesion'; return next; return; end if;
  if public.clase_credencial() <> 'personal' then
    resultado := 'exige_identidad_personal'; return next; return;
  end if;

  if length(v_nombre) < 2 or length(v_nombre) > 60 then
    resultado := 'nombre_invalido'; return next; return;
  end if;
  if p_pin_hash is null or length(btrim(p_pin_hash)) < 8 then
    resultado := 'pin_invalido'; return next; return;
  end if;
  if v_pais !~ '^[A-Z]{2}$' then resultado := 'pais_invalido'; return next; return; end if;

  -- El tipo tiene que estar OFRECIDO y ademas PUBLICADO para ese pais.
  select o.version into v_version from public.tipos_ofrecidos() o where o.tipo = p_tipo;
  if v_version is null then resultado := 'tipo_no_ofrecido'; return next; return; end if;
  if not public.tipo_publicado(p_tipo, v_pais) then
    resultado := 'tipo_no_publicado_ahi'; return next; return;
  end if;

  -- La columna vieja, que solo conoce dos valores. Ver la cabecera: mientras
  -- `tipo_gremio` exista, un tipo sin equivalente ahi no se puede crear.
  v_tipo_gremio := case p_tipo when 'hogar' then 'familia'
                               when 'hogar_compartido' then 'piso' end;
  if v_tipo_gremio is null then resultado := 'tipo_no_ofrecido'; return next; return; end if;

  select count(*) into v_activas
    from public.pertenencias p where p.persona = v_uid and p.estado = 'activa';
  select pa.limite_global into v_limite from public.parametros_expansion() pa;
  if v_limite is null then resultado := 'sin_configuracion'; return next; return; end if;
  if v_activas + 1 > v_limite then resultado := 'en_el_limite'; return next; return; end if;

  select d.estado, d.persona into v_estado_llave, v_persona_llave
    from public.derechos_expansion d where d.id = p_llave;
  if v_estado_llave is null then resultado := 'llave_no_existe'; return next; return; end if;
  if v_persona_llave is distinct from v_uid then resultado := 'llave_ajena'; return next; return; end if;
  if v_estado_llave <> 'disponible' then resultado := 'llave_no_disponible'; return next; return; end if;

  -- El pais va en el `insert`, que es la eleccion explicita de `R-102`. El
  -- disparador de la 055 vigila los `update`, no los nacimientos.
  insert into public.families
    (owner, name, parent_pin_hash, tipo_gremio, tipo_plantilla, plantilla_version,
     pais, pais_declarado_at, pais_declarado_por)
  values (v_uid, v_nombre, p_pin_hash, v_tipo_gremio, p_tipo, v_version,
          v_pais, now(), v_uid)
  returning id into v_nuevo;

  -- Titular: lo fundo esta persona, y cerrar o traspasar es suyo (`CAP-15`).
  perform public.entrar_en_gremio(v_nuevo, 'titular', 'llave', p_personaje);

  perform public.consumir_llave(p_llave, v_nuevo, v_nombre);

  resultado := 'ok';
  family_id := v_nuevo;
  return next;
end $fn$;

revoke all on function public.crear_gremio_con_llave(uuid, text, text, text, text, text) from public;
revoke all on function public.crear_gremio_con_llave(uuid, text, text, text, text, text) from anon;
grant execute on function public.crear_gremio_con_llave(uuid, text, text, text, text, text) to authenticated;

-- ------------------------------------------------------------------
-- 9 · SALIR
--
-- Sin salida el limite global es una trampa (`R-23`), y `R-25` prohibe que
-- nadie salga solo: abandonar y expulsar son actos humanos explicitos.
--
-- El personaje **se retira, no se borra** (`H-14`, `T-9`): conserva historial y
-- la XP que aporto a metas ya cerradas, y es lo que permite que el reingreso
-- devuelva a la misma persona su progreso.
--
-- La cartera **no se toca**: es de la persona, no del gremio (`R-06`).
-- ------------------------------------------------------------------

create or replace function public.abandonar_gremio(p_family uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_rol text;
  v_otros integer;
begin
  if v_uid is null then return 'sin_sesion'; end if;

  select p.rol into v_rol
    from public.pertenencias p
   where p.persona = v_uid and p.family_id = p_family and p.estado = 'activa'
   for update;
  if v_rol is null then return 'no_estas_dentro'; end if;

  -- `I-12`: quien titula no puede limitarse a salir. O traspasa, o cierra.
  select count(*) into v_otros
    from public.pertenencias p
   where p.family_id = p_family and p.estado = 'activa'
     and p.persona <> v_uid and p.rol in ('titular','gestor');

  if v_rol = 'titular' and v_otros = 0 then
    return 'eres_quien_titula';
  end if;

  update public.pertenencias
     set estado = 'abandonada', hasta = now()
   where persona = v_uid and family_id = p_family and estado = 'activa';

  update public.profiles set active = false
   where family_id = p_family and persona = v_uid;

  return 'ok';
end $fn$;

revoke all on function public.abandonar_gremio(uuid) from public;
revoke all on function public.abandonar_gremio(uuid) from anon;
grant execute on function public.abandonar_gremio(uuid) to authenticated;

create or replace function public.expulsar_de_gremio(
  p_family uuid,
  p_persona uuid,
  p_profile uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_rol text;
  v_otros integer;
begin
  if v_uid is null then return 'sin_sesion'; end if;
  if p_persona is null then return 'no_estaba_dentro'; end if;
  if p_persona = v_uid then return 'usa_abandonar'; end if;
  if not public.es_mi_gremio(p_family) then return 'no_es_tuyo'; end if;
  -- `CAP-03`.
  if public.puede(p_family, 'CAP-03', p_profile) = 'no' then return 'no_puede'; end if;

  select p.rol into v_rol
    from public.pertenencias p
   where p.persona = p_persona and p.family_id = p_family and p.estado = 'activa'
   for update;
  if v_rol is null then return 'no_estaba_dentro'; end if;

  -- No se puede dejar el gremio sin nadie que lo administre (`I-12`).
  select count(*) into v_otros
    from public.pertenencias p
   where p.family_id = p_family and p.estado = 'activa'
     and p.persona <> p_persona and p.rol in ('titular','gestor');
  if v_rol in ('titular','gestor') and v_otros = 0 then
    return 'dejaria_sin_administracion';
  end if;

  update public.pertenencias
     set estado = 'expulsada', hasta = now()
   where persona = p_persona and family_id = p_family and estado = 'activa';

  update public.profiles set active = false
   where family_id = p_family and persona = p_persona;

  return 'ok';
end $fn$;

revoke all on function public.expulsar_de_gremio(uuid, uuid, uuid) from public;
revoke all on function public.expulsar_de_gremio(uuid, uuid, uuid) from anon;
grant execute on function public.expulsar_de_gremio(uuid, uuid, uuid) to authenticated;

-- ------------------------------------------------------------------
-- 10 · MIS GREMIOS, PARA EL SELECTOR
--
-- Lo que la 6.2 pintara: cada pertenencia activa con SU tipo, SU personaje y SU
-- nivel. `F-3` paso 2 lo pide asi por un motivo: son progresos distintos y la
-- pantalla no debe sugerir lo contrario (`R-03`).
-- ------------------------------------------------------------------

create or replace function public.mis_pertenencias()
returns table (
  family_id uuid,
  gremio text,
  tipo text,
  tipo_visible text,
  zona text,
  rol text,
  origen text,
  desde timestamptz,
  personaje uuid,
  personaje_nombre text,
  nivel integer
)
language sql
stable
security definer
set search_path = public
as $fn$
  select f.id, f.name, f.tipo_plantilla, t.nombre_visible, f.timezone,
         p.rol, p.origen, p.desde,
         pr.id, pr.name,
         public.nivel_de_xp(greatest(coalesce(pr.xp_maxima, 0), coalesce(pr.xp, 0)))
    from public.pertenencias p
    join public.families f on f.id = p.family_id
    left join public.plantillas_tipo t
      on t.tipo = f.tipo_plantilla and t.version = f.plantilla_version
    left join public.profiles pr
      on pr.family_id = f.id and pr.persona = p.persona and pr.active
   where p.persona = auth.uid() and p.estado = 'activa'
   order by p.desde;
$fn$;

revoke all on function public.mis_pertenencias() from public;
revoke all on function public.mis_pertenencias() from anon;
grant execute on function public.mis_pertenencias() to authenticated;

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
--   select indexdef from pg_indexes where indexname = 'idx_families_owner';
--   -- ya NO dice UNIQUE
--
--   select count(*) from public.invitaciones;   -- 0 recien aplicada
--
-- El ensayo completo --invitar, aceptar con llave, abandonar, reingresar y
-- comprobar que el personaje vuelve con su XP-- va contra la base con
-- `request.jwt.claims` puesto a mano, y termina en `raise exception` para
-- deshacerlo todo.
-- ------------------------------------------------------------------
