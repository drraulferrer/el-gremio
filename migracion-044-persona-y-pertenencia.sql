-- Migracion 044 · la persona, la pertenencia, y las dos clases de credencial.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Primer paso de la Fase 2 del plan (identidad y pertenencia). Es el paso
-- AMPLIAR de "ampliar -> convivir -> contraer": aqui se crean las tablas y se
-- rellenan con lo que ya hay, pero **nadie las lee todavia**. El aislamiento
-- sigue siendo exactamente el de ayer hasta la 045.
--
-- ------------------------------------------------------------------
-- POR QUE HACEN FALTA
--
-- Hoy el aislamiento de datos es PROPIEDAD: "este gremio es de mi cuenta"
-- (`families.owner = auth.uid()`). Eso funciona mientras una cuenta tenga
-- exactamente un gremio y un gremio exactamente una cuenta, que es lo que
-- fuerza `idx_families_owner`.
--
-- Con gremios multiples el sujeto pasa a ser PERTENENCIA: "pertenezco a este
-- gremio". Y para poder decir eso hace falta antes decir QUIEN pertenece, que
-- hoy no existe: un `profiles` no sabe de quien es, y la cuenta de la casa no
-- es una persona, es una llave que comparten seis.
--
-- ------------------------------------------------------------------
-- LA DECISION QUE ORDENA TODO LO DEMAS: DOS CLASES DE CREDENCIAL
--
-- Un correo es una cosa **o** la otra, nunca las dos:
--
--   * COMPARTIDA · el correo de la casa. Da acceso a UN gremio y a su selector
--     de perfiles. No representa a nadie. Es lo que hay hoy, todo lo que hay
--     hoy, y no se toca.
--   * PERSONAL · el correo de UNA persona. Da acceso a sus pertenencias, a su
--     cartera y a sus llaves. Todavia no existe ninguna.
--
-- La tabla `credenciales` tiene UNA fila por cuenta y una columna `clase`: la
-- exclusion no es una comprobacion que alguien tenga que acordarse de hacer,
-- es la clave primaria. Y el alcance de una sesion lo decide el servidor
-- leyendo esa fila, nunca un parametro que mande el cliente.
--
-- ------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE
--
-- No crea ninguna persona. Las cuentas que existen hoy son credenciales
-- compartidas y se quedan como estan: convertirse es un acto explicito de
-- alguien, con su correo propio, y llega en el paso 2.5 de la fase.
--
-- No crea ninguna pertenencia. Una pertenencia es de una persona, y hoy no hay
-- ninguna. La casa entra por su credencial compartida, que es la fila de
-- `credenciales` que si se rellena aqui.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · CREDENCIALES · de que clase es cada cuenta
-- ------------------------------------------------------------------

create table if not exists public.credenciales (
  -- Una fila por cuenta, y la cuenta es la clave: por construccion no puede
  -- haber un correo que sea las dos cosas.
  user_id uuid primary key references auth.users(id) on delete cascade,
  clase text not null check (clase in ('compartida','personal')),
  -- El gremio al que da acceso, y solo lo tiene la compartida: una credencial
  -- personal no vive atada a un gremio, sus gremios son sus pertenencias.
  family_id uuid references public.families(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- En `case` y no en la forma obvia con `and`/`or`, por lo que ya mordio en
  -- `profiles_especie_coherente`: con un nulo por medio esa expresion da NULL,
  -- y **un CHECK que da NULL pasa**. Solo rechaza cuando da FALSE.
  constraint credenciales_alcance check (
    case
      when clase = 'compartida' then family_id is not null
      else family_id is null
    end
  )
);

create index if not exists idx_credenciales_gremio
  on public.credenciales (family_id) where family_id is not null;

alter table public.credenciales enable row level security;

-- Se lee la propia y nada mas. Saber de que clase es la sesion es lo que la
-- interfaz necesita para decidir que ensena; saber la de otro no le hace falta
-- a nadie y diria a que gremio pertenece un correo.
drop policy if exists credencial_propia on public.credenciales;
create policy credencial_propia on public.credenciales
  for select to authenticated
  using (user_id = auth.uid());

-- Escribe el servidor, siempre. Clasificarse a si misma seria justamente el
-- parametro del cliente que esto viene a impedir.
revoke all on table public.credenciales from anon;
revoke all on table public.credenciales from authenticated;
grant select on table public.credenciales to authenticated;

-- ------------------------------------------------------------------
-- 2 · PERTENENCIAS · quien esta en que gremio
-- ------------------------------------------------------------------

create table if not exists public.pertenencias (
  id uuid primary key default gen_random_uuid(),
  -- La persona. Apunta a `auth.users` y no a `credenciales` para que el
  -- borrado en cascada siga la misma linea que el resto del esquema; que sea
  -- de clase personal lo defiende el disparador de mas abajo.
  persona uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  -- Vocabulario de la especificacion (§9.2). El reparto de capacidades por rol
  -- llega con la plantilla de tipo (Fase 4); aqui el rol solo se guarda.
  rol text not null default 'miembro' check (rol in ('titular','gestor','miembro')),
  -- Nada se borra: salir es un estado, no una fila menos. Y ninguna transicion
  -- a abandonada o expulsada puede dispararse por un cambio de configuracion,
  -- solo por un acto humano.
  estado text not null default 'activa' check (estado in ('activa','abandonada','expulsada')),
  -- Como se entro. Los cuatro caminos posibles, y ninguno se infiere.
  origen text not null check (origen in ('fundacion','llave','invitacion','reclamacion')),
  desde timestamptz not null default now(),
  hasta timestamptz,
  constraint pertenencias_baja_fechada check (
    case when estado = 'activa' then hasta is null else hasta is not null end
  )
);

-- Una pertenencia ACTIVA por persona y gremio, con un indice y no con un
-- `select` previo: entre el select y el insert cabe otra peticion. Es el mismo
-- oficio que hace `idx_bonuses_uno_al_dia`. Parcial, porque abandonar y volver
-- a entrar tiene que poder dejar dos filas.
create unique index if not exists idx_pertenencia_activa
  on public.pertenencias (persona, family_id) where estado = 'activa';

create index if not exists idx_pertenencias_gremio
  on public.pertenencias (family_id, estado);

alter table public.pertenencias enable row level security;

revoke all on table public.pertenencias from anon;
revoke all on table public.pertenencias from authenticated;
grant select on table public.pertenencias to authenticated;

-- ------------------------------------------------------------------
-- 3 · EL VINCULO PERSONAJE <-> PERSONA
-- ------------------------------------------------------------------

-- Nullable a proposito, y lo normal es que sea nulo: una peque de tres anos no
-- tiene correo, una junior no deberia necesitarlo para pedir su estrella, y
-- una mascota no lo va a tener nunca. La identidad se gana cuando hace falta
-- cruzar el limite de un gremio, no antes.
alter table public.profiles
  add column if not exists persona uuid references auth.users(id) on delete set null;

comment on column public.profiles.persona is
  'Identidad personal detras de este personaje, si la tiene. Nunca se infiere: se elige, se confirma y queda auditado.';

-- Un personaje, una persona (lo garantiza la columna: es una sola). Y una
-- persona, un personaje por gremio (lo garantiza este indice).
create unique index if not exists idx_profiles_persona_unica
  on public.profiles (family_id, persona) where persona is not null;

-- Una credencial COMPARTIDA no puede quedar detras de un personaje: no
-- representa a nadie, y si se pudiera vincular, la clave de la casa se
-- convertiria en la identidad de quien la usara primero.
create or replace function public.tg_persona_es_personal()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.persona is null then
    return new;
  end if;
  if not exists (
    select 1 from public.credenciales c
     where c.user_id = new.persona and c.clase = 'personal'
  ) then
    raise exception 'la persona de un personaje tiene que ser una identidad personal';
  end if;
  return new;
end $fn$;

drop trigger if exists profiles_persona_personal on public.profiles;
create trigger profiles_persona_personal
  before insert or update of persona on public.profiles
  for each row execute function public.tg_persona_es_personal();

-- Un disparador no necesita que nadie tenga permiso de ejecucion: lo invoca
-- el motor, y el permiso solo hace falta para CREAR el disparador. Sin este
-- revoke, los privilegios por defecto de Supabase dejan la funcion colgando
-- de /rest/v1/rpc/ para cualquiera, con o sin sesion. Las tres tg_* que ya
-- existian tienen el mismo problema y se quedan como estan: son de otra
-- revision (la de grants que dejo abierta la Fase 0), no de esta.
revoke all on function public.tg_persona_es_personal() from anon;
revoke all on function public.tg_persona_es_personal() from authenticated;

-- ------------------------------------------------------------------
-- 4 · MIS GREMIOS · el predicado del aislamiento, en un solo sitio
-- ------------------------------------------------------------------

-- Aqui se responde "a que gremios llego yo", y lo responde el servidor. Las
-- politicas de la 045 preguntan a esta funcion y a nadie mas: el dia que haya
-- que retirar la propiedad (paso CONTRAER) se borra una rama de aqui y no se
-- tocan catorce politicas.
--
-- Las tres ramas, y el orden importa para entender el despliegue:
--
--   1 · PROPIEDAD · `families.owner = auth.uid()`. Es lo de hoy. **Es
--       temporal**: se retira cuando no quede ningun cliente viejo en la
--       calle. Retirarla antes de tiempo deja a esas casas viendo su gremio
--       vacio y creyendo que han perdido el historial, que es exactamente el
--       fallo que documenta la migracion 017.
--   2 · CREDENCIAL COMPARTIDA · lo mismo que la 1, pero dicho por la tabla
--       nueva. Convive con ella a proposito durante todo el paso CONVIVIR.
--   3 · PERTENENCIA ACTIVA · el sujeto de verdad, el que todavia no tiene
--       ninguna fila.
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
  union
  select p.family_id from public.pertenencias p
   where p.persona = auth.uid() and p.estado = 'activa';
$fn$;

revoke all on function public.mis_gremios() from public;
revoke all on function public.mis_gremios() from anon;
grant execute on function public.mis_gremios() to authenticated;

-- La misma pregunta en booleano, para las funciones que ya reciben un gremio y
-- tienen que decidir si lo dejan pasar.
create or replace function public.es_mi_gremio(p_family uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select p_family is not null
     and exists (select 1 from public.mis_gremios() g where g = p_family);
$fn$;

revoke all on function public.es_mi_gremio(uuid) from public;
revoke all on function public.es_mi_gremio(uuid) from anon;
grant execute on function public.es_mi_gremio(uuid) to authenticated;

-- La propia siempre; las del gremio, quien esta dentro. `mis_gremios()` es
-- security definer y por eso no vuelve a entrar por esta politica.
drop policy if exists pertenencia_visible on public.pertenencias;
create policy pertenencia_visible on public.pertenencias
  for select to authenticated
  using (persona = auth.uid() or family_id in (select public.mis_gremios()));

-- ------------------------------------------------------------------
-- 5 · LA CLASE DE LA SESION, resuelta en servidor
-- ------------------------------------------------------------------

-- Una cuenta sin fila devuelve 'sin_clasificar': existe, no ha fundado nada y
-- todavia no es nada. Es el estado de quien se acaba de registrar.
create or replace function public.clase_credencial()
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select c.clase from public.credenciales c where c.user_id = auth.uid()),
    'sin_clasificar'
  );
$fn$;

revoke all on function public.clase_credencial() from public;
revoke all on function public.clase_credencial() from anon;
grant execute on function public.clase_credencial() to authenticated;

-- La puerta que tendran que cruzar las operaciones de persona: forjar una
-- llave, usarla, ver la cartera, cambiar de gremio, aceptar una invitacion.
-- Hoy no la llama nadie porque ninguna de esas operaciones existe todavia.
-- Existe desde ya, y con su prueba, porque la garantia que da solo vale si
-- esta escrita ANTES que la primera operacion que la necesita: si aparece
-- despues, se le olvida a alguien y no se entera nadie.
create or replace function public.exige_persona()
returns void
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'sin_sesion';
  end if;
  if public.clase_credencial() <> 'personal' then
    -- El mensaje no dice quien es ni de que gremio: solo que esta puerta no es
    -- la suya.
    raise exception 'exige_identidad_personal';
  end if;
end $fn$;

revoke all on function public.exige_persona() from public;
revoke all on function public.exige_persona() from anon;
grant execute on function public.exige_persona() to authenticated;

-- ------------------------------------------------------------------
-- 6 · CLASIFICAR LO QUE YA EXISTE, y lo que venga
-- ------------------------------------------------------------------

-- Cada gremio que existe hoy tiene detras una cuenta que es su credencial
-- compartida. Se dice aqui, una vez.
--
-- `on conflict do nothing` y no `do update`: si una cuenta ya estuviera
-- clasificada como personal, reescribirla a compartida seria justo el
-- accidente que la clave primaria intenta impedir.
insert into public.credenciales (user_id, clase, family_id)
select f.owner, 'compartida', f.id
  from public.families f
on conflict (user_id) do nothing;

-- Y lo mismo para el gremio que se funde manana, sin tocar el cliente: quien
-- funda con una cuenta sin clasificar se queda con la credencial compartida de
-- esa casa. Si ya tuviera identidad personal no se le cambia nada; su acceso
-- sera la pertenencia que le cree la funcion de creacion (Fase 6).
create or replace function public.tg_credencial_de_gremio()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.credenciales (user_id, clase, family_id)
  values (new.owner, 'compartida', new.id)
  on conflict (user_id) do nothing;
  return new;
end $fn$;

drop trigger if exists families_credencial on public.families;
create trigger families_credencial
  after insert on public.families
  for each row execute function public.tg_credencial_de_gremio();

revoke all on function public.tg_credencial_de_gremio() from anon;
revoke all on function public.tg_credencial_de_gremio() from authenticated;

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
-- Tras ejecutar, esto tiene que dar una fila por gremio y ninguna huerfana:
--
--   select
--     (select count(*) from public.families)                                  as gremios,
--     (select count(*) from public.credenciales where clase = 'compartida')    as compartidas,
--     (select count(*) from public.credenciales where clase = 'personal')      as personales,
--     (select count(*) from public.pertenencias)                              as pertenencias,
--     (select count(*) from public.profiles where persona is not null)        as vinculados;
--
-- personales, pertenencias y vinculados en cero es lo correcto hoy: esta
-- migracion no convierte a nadie.
-- ------------------------------------------------------------------
