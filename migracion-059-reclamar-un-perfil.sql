-- Migracion 059 · reclamar un perfil que ya era tuyo.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Pieza 7.1 de la Fase 7 (`F-11`, `R-81`). Falta la 7.2, desactivar y volver
-- a crear la credencial compartida.
--
-- ------------------------------------------------------------------
-- EL CASO QUE FALTABA
--
-- Alguien que **ya es persona** en el gremio A y que ademas lleva meses
-- siendo un perfil interno del gremio B. No deberia tener que empezar de
-- cero en B ni pagar una llave por algo que ya era suyo: **el perfil, su
-- historial y su relacion con el gremio existian antes** de que esa persona
-- activara su identidad.
--
-- ------------------------------------------------------------------
-- NO CUESTA LLAVE, PERO OCUPA PLAZA (`R-86`, `D-28`)
--
-- Las dos mitades importan y tiran en direcciones distintas:
--
--   * **No cuesta llave** porque no se esta creando una relacion nueva. Se
--     formaliza una que ya existia. Cobrarla seria cobrar por la historia
--     que esa persona ya tenia.
--   * **Ocupa plaza** porque el limite mide *gremios a los que se pertenece
--     de forma activa*, no la via por la que se llego. Si no ocupara, los
--     perfiles internos serian la manera de eludir la progresion, las llaves
--     y el coste de expansion. La aprobacion del gremio de destino reduce el
--     abuso, pero no lo cierra.
--
-- Y la comprobacion del limite va **dentro de la transaccion que aprueba**,
-- no en la que solicita: entre pedirlo y aprobarlo pueden pasar dias.
--
-- ------------------------------------------------------------------
-- POR QUE HACEN FALTA DOS PASOS
--
-- Porque **lo aprueba el gremio de destino**, no quien reclama. Sin eso,
-- cualquiera con el identificador de un perfil podria apropiarselo, y ese
-- identificador viaja en cuanto alguien lo comparte por un chat.
--
-- ------------------------------------------------------------------
-- LO QUE NO SE REVELA (`SEC-9`)
--
-- `solicitar_reclamacion` devuelve **el mismo codigo** cuando el perfil no
-- existe y cuando existe pero no se puede reclamar. Distinguirlos convertiria
-- esta funcion en un detector de perfiles: se prueban identificadores hasta
-- que uno responde distinto, y eso dice quien esta en que gremio.
--
-- Quien reclama tampoco puede LISTAR perfiles ajenos: la politica de
-- `profiles` es por gremio propio desde siempre. El identificador llega de
-- fuera, de alguien de ese gremio, que es justo como debe ser.
--
-- ------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE
--
-- **Los juniors no se reclaman.** `R-81` exige autorizacion adulta concreta
-- (`R-57`) para un perfil junior, y eso es la Fase 8a, que sigue bloqueada
-- por su revision juridica. Se rechaza con su propio codigo en vez de
-- colarlo: un permiso que no existe no se da por supuesto.
--
-- **No hay pantalla.** Es otra tanda.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · LA SOLICITUD
--
-- Caduca, como la conversion y la invitacion, y por lo mismo: una peticion
-- sin fecha se queda para siempre en la bandeja de alguien y un dia se
-- aprueba sin que nadie recuerde de que iba.
-- ------------------------------------------------------------------

create table if not exists public.reclamaciones (
  id uuid primary key default gen_random_uuid(),
  persona uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,

  estado text not null default 'pendiente'
    check (estado in ('pendiente','aprobada','rechazada','caducada')),

  -- Quien la aprobo o rechazo, y con que personaje. Sin clave ajena a
  -- `auth.users`: un apunte de auditoria sobrevive a la cuenta que nombra.
  resuelta_por uuid,
  resuelta_por_personaje uuid,

  solicitada_at timestamptz not null default now(),
  caduca_at timestamptz not null,
  resuelta_at timestamptz,

  constraint reclamacion_resuelta_fechada check (
    case when estado = 'pendiente' then resuelta_at is null else resuelta_at is not null end
  )
);

-- Una pendiente por persona y perfil. Y ademas: un perfil no puede tener dos
-- pendientes de personas DISTINTAS, porque aprobar la segunda despues de la
-- primera seria aprobar algo que ya no se puede hacer. Se resuelve con el
-- indice de abajo y con el `for update` de la aprobacion.
create unique index if not exists idx_reclamacion_pendiente
  on public.reclamaciones (profile_id) where estado = 'pendiente';

create index if not exists idx_reclamaciones_persona
  on public.reclamaciones (persona, estado);

alter table public.reclamaciones enable row level security;

-- RLS encendido y sin politicas: lo que sale, sale por las lectoras. Aqui
-- ademas es parte de `SEC-9`: una politica que dejara leer por `profile_id`
-- convertiria la tabla en el detector que la funcion evita.
revoke all on table public.reclamaciones from anon;
revoke all on table public.reclamaciones from authenticated;

-- ------------------------------------------------------------------
-- 2 · PEDIRLO
-- ------------------------------------------------------------------

create or replace function public.solicitar_reclamacion(p_profile uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  pr public.profiles%rowtype;
  v_dias integer;
begin
  if v_uid is null then return 'sin_sesion'; end if;
  if public.clase_credencial() <> 'personal' then return 'exige_identidad_personal'; end if;
  if p_profile is null then return 'no_reclamable'; end if;

  select * into pr from public.profiles where id = p_profile;

  -- `SEC-9`: el mismo codigo para "no existe" y para "existe y no se puede".
  -- Distinguirlos convertiria esto en un detector de perfiles.
  if pr.id is null or not pr.active or pr.persona is not null or pr.role = 'mascota' then
    return 'no_reclamable';
  end if;

  -- Los juniors exigen autorizacion adulta concreta (`R-57`), que es la Fase
  -- 8a y sigue bloqueada. Se dice con su propio codigo porque aqui no hay
  -- nada que ocultar: quien reclama sabe que ese perfil existe.
  if pr.role = 'junior' then return 'junior_bloqueado'; end if;

  if exists (
    select 1 from public.profiles p where p.family_id = pr.family_id and p.persona = v_uid
  ) then
    return 'ya_tienes_personaje';
  end if;

  if exists (
    select 1 from public.pertenencias p
     where p.persona = v_uid and p.family_id = pr.family_id and p.estado = 'activa'
  ) then
    return 'ya_estas_dentro';
  end if;

  select pa.invitacion_dias into v_dias from public.parametros_expansion() pa;
  if v_dias is null then return 'sin_configuracion'; end if;

  begin
    insert into public.reclamaciones (persona, profile_id, family_id, caduca_at)
    values (v_uid, p_profile, pr.family_id, now() + make_interval(days => v_dias));
  exception when unique_violation then
    -- Ya hay una pendiente sobre ese perfil. Se responde igual sea mia o de
    -- otra persona: decir "la ha pedido alguien" tambien es revelar.
    return 'ya_solicitada';
  end;

  return 'ok';
end $fn$;

revoke all on function public.solicitar_reclamacion(uuid) from public;
revoke all on function public.solicitar_reclamacion(uuid) from anon;
grant execute on function public.solicitar_reclamacion(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 3 · LAS DOS LECTURAS
-- ------------------------------------------------------------------

create or replace function public.mis_reclamaciones()
returns table (
  id uuid,
  family_id uuid,
  gremio text,
  personaje text,
  estado text,
  solicitada_at timestamptz,
  caduca_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select r.id, r.family_id, f.name, pr.name,
         case when r.estado = 'pendiente' and r.caduca_at <= now()
              then 'caducada' else r.estado end,
         r.solicitada_at, r.caduca_at
    from public.reclamaciones r
    join public.families f on f.id = r.family_id
    join public.profiles pr on pr.id = r.profile_id
   where r.persona = auth.uid()
   order by r.solicitada_at desc;
$fn$;

revoke all on function public.mis_reclamaciones() from public;
revoke all on function public.mis_reclamaciones() from anon;
grant execute on function public.mis_reclamaciones() to authenticated;

-- Las que esperan aprobacion en un gremio. Solo para quien esta dentro.
create or replace function public.reclamaciones_del_gremio(p_family uuid)
returns table (
  id uuid,
  personaje uuid,
  personaje_nombre text,
  correo text,
  estado text,
  solicitada_at timestamptz,
  caduca_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select r.id, r.profile_id, pr.name,
         (select lower(u.email) from auth.users u where u.id = r.persona),
         case when r.estado = 'pendiente' and r.caduca_at <= now()
              then 'caducada' else r.estado end,
         r.solicitada_at, r.caduca_at
    from public.reclamaciones r
    join public.profiles pr on pr.id = r.profile_id
   where r.family_id = p_family
     and public.es_mi_gremio(p_family)
   order by r.solicitada_at desc;
$fn$;

revoke all on function public.reclamaciones_del_gremio(uuid) from public;
revoke all on function public.reclamaciones_del_gremio(uuid) from anon;
grant execute on function public.reclamaciones_del_gremio(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 4 · APROBARLO
--
-- Todo lo que decide pasa DENTRO de esta transaccion, y el orden es la
-- garantia:
--
--   1 · quien aprueba tiene `CAP-10` en ese gremio
--   2 · la solicitud esta pendiente y no ha caducado
--   3 · **el perfil, con `for update`** -- es lo que serializa dos
--       aprobaciones simultaneas del mismo perfil (`E-11.4`)
--   4 · sigue activo y sin vincular
--   5 · plaza en el limite global, AHORA y no cuando se pidio (`R-86`)
--   6 · y entonces: pertenencia, vinculo y saldo, una sola vez
--
-- La transferencia del saldo local es la misma que la conversion de la 047:
-- el personaje se queda a cero, la cartera recibe, y el libro anota las dos
-- patas. Una transferencia entre monederos son dos asientos, y eso ya costo
-- un descuadre una vez.
-- ------------------------------------------------------------------

create or replace function public.aprobar_reclamacion(
  p_reclamacion uuid,
  p_profile uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r public.reclamaciones%rowtype;
  pr public.profiles%rowtype;
  v_activas integer;
  v_limite integer;
  v_correo text;
  v_cartera integer;
begin
  if auth.uid() is null then return 'sin_sesion'; end if;

  select * into r from public.reclamaciones where id = p_reclamacion for update;
  if r.id is null then return 'no_existe'; end if;
  if not public.es_mi_gremio(r.family_id) then return 'no_es_tuyo'; end if;
  -- `CAP-10`: administrar miembros. Y no la etiqueta (054).
  if public.puede(r.family_id, 'CAP-10', p_profile) = 'no' then return 'no_puede'; end if;

  if r.estado <> 'pendiente' then return 'ya_resuelta'; end if;
  if r.caduca_at <= now() then
    update public.reclamaciones set estado = 'caducada', resuelta_at = now() where id = r.id;
    return 'caducada';
  end if;

  -- El cerrojo. Dos aprobaciones a la vez sobre el mismo perfil se ordenan
  -- aqui: la segunda espera, y cuando entra ve `persona` puesta.
  select * into pr from public.profiles where id = r.profile_id for update;
  if pr.id is null or not pr.active then return 'perfil_no_disponible'; end if;
  if pr.persona is not null then return 'ya_reclamado'; end if;

  select count(*) into v_activas
    from public.pertenencias p where p.persona = r.persona and p.estado = 'activa';
  select pa.limite_global into v_limite from public.parametros_expansion() pa;
  if v_limite is null then return 'sin_configuracion'; end if;
  -- `R-86`: ocupa plaza. Y se mira ahora, no cuando se pidio.
  if v_activas + 1 > v_limite then return 'en_el_limite'; end if;

  select lower(u.email) into v_correo from auth.users u where u.id = r.persona;
  if v_correo is null then return 'sin_cuenta'; end if;

  -- 1 · La pertenencia. `reclamacion` es el unico origen que no consume
  --     llave (`T-8b`), y `gestor` y no `titular` por lo mismo que en la
  --     conversion: pertenecer da acceso y gestion, no la potestad de cerrar
  --     el gremio.
  insert into public.pertenencias (persona, family_id, rol, estado, origen)
  values (r.persona, r.family_id, 'gestor', 'activa', 'reclamacion');

  insert into public.carteras (persona, saldo) values (r.persona, 0)
  on conflict (persona) do nothing;

  -- 2 · El vinculo, SIN reiniciar el progreso. El personaje se queda con su
  --     nivel, su marca de agua, sus insignias y su historial: es lo que
  --     esta funcion viene a respetar.
  perform public.motivo_coins('conversion', r.id, null);
  update public.profiles
     set persona = r.persona,
         coins = 0,
         saldo_local_cerrado = true
   where id = pr.id;

  -- 3 · Y el saldo, por la unica puerta que mueve carteras (051), para que
  --     la ENTRADA deje su asiento igual que la salida.
  v_cartera := public.mover_cartera(r.persona, pr.id, 'conversion', pr.coins, r.id, null);

  -- 4 · El asiento de la conversion va donde van todos.
  insert into public.conversiones
    (profile_id, family_id, correo, estado, persona,
     saldo_local_antes, importe, saldo_cartera_despues, resultado,
     caduca_at, resuelta_at)
  values (pr.id, r.family_id, v_correo, 'completada', r.persona,
          pr.coins, pr.coins, v_cartera, 'ok', now(), now());

  update public.reclamaciones
     set estado = 'aprobada', resuelta_at = now(),
         resuelta_por = auth.uid(), resuelta_por_personaje = p_profile
   where id = r.id;

  return 'ok';
end $fn$;

revoke all on function public.aprobar_reclamacion(uuid, uuid) from public;
revoke all on function public.aprobar_reclamacion(uuid, uuid) from anon;
grant execute on function public.aprobar_reclamacion(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------
-- 5 · RECHAZARLO
-- ------------------------------------------------------------------

create or replace function public.rechazar_reclamacion(
  p_reclamacion uuid,
  p_profile uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r public.reclamaciones%rowtype;
begin
  if auth.uid() is null then return 'sin_sesion'; end if;

  select * into r from public.reclamaciones where id = p_reclamacion for update;
  if r.id is null then return 'no_existe'; end if;

  -- La puede retirar quien la pidio, o rechazarla la administracion del
  -- gremio. Las dos cosas dejan la misma fila resuelta.
  if r.persona is distinct from auth.uid() then
    if not public.es_mi_gremio(r.family_id) then return 'no_es_tuyo'; end if;
    if public.puede(r.family_id, 'CAP-10', p_profile) = 'no' then return 'no_puede'; end if;
  end if;

  if r.estado <> 'pendiente' then return 'ya_resuelta'; end if;

  update public.reclamaciones
     set estado = 'rechazada', resuelta_at = now(),
         resuelta_por = auth.uid(), resuelta_por_personaje = p_profile
   where id = r.id;

  return 'ok';
end $fn$;

revoke all on function public.rechazar_reclamacion(uuid, uuid) from public;
revoke all on function public.rechazar_reclamacion(uuid, uuid) from anon;
grant execute on function public.rechazar_reclamacion(uuid, uuid) to authenticated;

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
--   select count(*) from public.reclamaciones;   -- 0 recien aplicada
--
-- El ensayo interesante es el de la concurrencia (`E-11.4`): dos
-- aprobaciones a la vez sobre el mismo perfil tienen que dejar UNA
-- pertenencia y UNA transferencia. Se comprueba con dos sesiones, o
-- confiando en el `for update` del paso 3 y en que la segunda ve
-- `persona is not null`.
-- ------------------------------------------------------------------
