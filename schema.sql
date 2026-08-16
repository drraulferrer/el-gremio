-- =====================================================================
-- EL GREMIO · esquema de base de datos para Supabase
-- Pega este fichero completo en el SQL Editor de tu proyecto y ejecútalo.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) <= 60),
  parent_pin_hash text not null,
  -- Migración 018. El día de esta casa se calcula aquí y en el navegador
  -- con la MISMA zona: si el servidor cuenta en Madrid y el móvil en la
  -- hora del aparato, la estrella diaria se puede pedir dos veces o
  -- ninguna y una racha viva se lee como rota.
  timezone text not null default 'Europe/Madrid',
  -- Migración 022. Qué versión de los textos legales se aceptó al fundar
  -- el gremio, y cuándo. Se guarda la VERSIÓN y no un `true` porque
  -- «aceptó las condiciones» no dice nada si nadie sabe qué decían
  -- entonces. Los gremios anteriores a la casilla lo tienen a null, que
  -- es la verdad, y esa es la consulta que los encuentra.
  legal_version text,
  legal_at timestamptz,
  created_at timestamptz not null default now()
);

-- Se valida contra el catálogo de Postgres, no contra una lista escrita a
-- mano: una lista propia envejece cada vez que un país cambia de horario.
-- Va en disparador porque un `check` no puede consultar una tabla.
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

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (length(name) <= 40),
  role text not null check (role in ('adulto','junior','peque')),
  emoji text not null default '🙂',
  color text not null default '#a78bfa',
  xp integer not null default 0,
  coins integer not null default 0,
  -- Género con el que la app se dirige a esta persona. 'neutro' no es un
  -- tercer sexo: significa "no se ha dicho", y hace que se usen frases
  -- reescritas que no necesitan marca (ver src/lib/genero.js).
  gender text not null default 'neutro' check (gender in ('femenino','masculino','neutro')),
  -- Retirar en lugar de borrar: un perfil inactivo sale del selector pero
  -- conserva su historial y la XP que aportó a las metas ya cerradas.
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade, -- null = no es de una persona concreta
  -- A quién va dirigida cuando no es de una persona: un rol entero, o el
  -- gremio al completo si también esto es null. Existe porque «Planificar
  -- el menú semanal» la hacen los dos adultos, y sin esto había que
  -- duplicar la misión —dos filas que editar y un historial partido—;
  -- marcarla para todos tampoco valía, porque se la comía la peque de tres
  -- años en su pantalla. El predicado vive en src/lib/misiones.js.
  target_roles text[] check (
    target_roles is null
    or (cardinality(target_roles) > 0 and target_roles <@ array['adulto','junior','peque']::text[])
  ),
  title text not null check (length(title) <= 120),
  emoji text not null default '⭐',
  xp integer not null default 10,
  coins integer not null default 5,
  frequency text not null default 'diario' check (frequency in ('diario','semanal','mensual','unico')),
  -- Habilidad que entrena esta misión. El sistema no premia tareas,
  -- entrena competencias: ver src/lib/habilidades.js.
  skill text check (skill is null or skill in (
    'hogar','salud','aprendizaje','amabilidad',
    'responsabilidad','cooperacion','creatividad','autonomia'
  )),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pendiente' check (status in ('pendiente','aprobado','rechazado')),
  xp integer not null,
  coins integer not null,
  -- Elogio concreto de quien valida. Es el componente con más respaldo
  -- del sistema; el "muy bien" genérico pierde efecto por repetición.
  praise text check (praise is null or length(praise) <= 400),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (length(title) <= 120),
  emoji text not null default '🎁',
  cost integer not null default 50,
  -- 1 decidir · 2 vivir · 3 celebrar. Los de nivel 1 son los que mejor
  -- sostienen el hábito porque premian con autonomía, no con cosas.
  tier integer not null default 2 check (tier between 1 and 3),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  cost integer not null,
  status text not null default 'pendiente' check (status in ('pendiente','entregado','cancelado')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.family_goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (length(title) <= 120),
  emoji text not null default '🏆',
  target_xp integer not null default 1000,
  achieved boolean not null default false,
  starts_at timestamptz not null default now(),
  achieved_at timestamptz
);

create table if not exists public.profile_badges (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  earned_at timestamptz not null default now(),
  unique (profile_id, code)
);

create index if not exists idx_completions_family_status on public.completions (family_id, status);
create index if not exists idx_completions_profile on public.completions (profile_id, requested_at desc);
create index if not exists idx_redemptions_family_status on public.redemptions (family_id, status);
-- Aquí hubo dos índices de más, `idx_profiles_family (family_id)` e
-- `idx_challenges_family (family_id)`. Un índice cuyas columnas son el
-- prefijo exacto de otro no se usa nunca: Postgres resuelve con el largo
-- lo mismo que resolvía con el corto, así que el corto solo cobra su
-- mantenimiento en cada insert y cada update. Retirados de la base el
-- 15-ago-2026 con migracion-009-indices-redundantes.sql.
--
-- ⚠️ Los dos que quedan aquí abajo son, desde entonces, los ÚNICOS índices
-- por `family_id` de `profiles` y `challenges`. Sus nombres suenan
-- específicos —«active», «skill»— pero lo que sostienen es el filtrado de
-- la política RLS `familia_miembro`, es decir, todas las lecturas de la
-- app. Antes de quitar cualquiera de los dos hay que crear el índice
-- simple por `family_id`; primero el create, después el drop.
create index if not exists idx_profiles_family_active on public.profiles (family_id, active);
create index if not exists idx_challenges_skill on public.challenges (family_id, skill);
-- Un índice por cada consulta real de src/App.jsx, ordenación incluida:
-- sin la columna de fecha en el índice, pedir "las últimas 400" obliga a
-- leer y ordenar todo el historial de la familia.
create index if not exists idx_completions_family_fecha on public.completions (family_id, requested_at desc);
create index if not exists idx_redemptions_family_fecha on public.redemptions (family_id, requested_at desc);
create index if not exists idx_rewards_family on public.rewards (family_id, created_at);
create index if not exists idx_badges_family on public.profile_badges (family_id);
create index if not exists idx_goals_family_activa on public.family_goals (family_id, achieved, starts_at desc);

-- ⚠️ El índice más importante del fichero, y el último en llegar
-- (migración 017). Cada política de aquí abajo termina en la misma
-- subconsulta —`select id from families where owner = auth.uid()`—, así
-- que sin este índice CADA petición de CADA casa recorre la tabla de
-- familias entera. Con una familia dentro no se nota; es justo el tipo de
-- cosa que solo aparece cuando ya hay gente usándolo.
--
-- Único, además: la app carga el gremio con `limit 1` sin orden, así que
-- una cuenta con dos gremios abre uno u otro según el día. Mientras eso
-- siga así, dos gremios por cuenta son un error, no una función.
create unique index if not exists idx_families_owner on public.families (owner);

-- ---------------------------------------------------------------------
-- Seguridad por filas (RLS): todo queda aislado por familia.
-- Modelo: una única cuenta de autenticación por familia (la del padre/madre).
-- ---------------------------------------------------------------------

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.completions enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.family_goals enable row level security;
alter table public.profile_badges enable row level security;

-- Todas van declaradas `to authenticated`. Sin eso Postgres evalúa la
-- política —y con ella la subconsulta a `families`— también para el rol
-- anónimo, que no va a cumplirla nunca porque `auth.uid()` es nulo. La
-- clave anon es pública: las peticiones sin sesión las puede hacer
-- cualquiera y tantas como quiera, así que decir que no tiene que ser
-- barato.
drop policy if exists familia_owner on public.families;
create policy familia_owner on public.families
  for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['profiles','challenges','completions','rewards','redemptions','family_goals','profile_badges']
  loop
    execute format('drop policy if exists familia_miembro on public.%I', t);
    execute format($f$
      create policy familia_miembro on public.%I
        for all to authenticated
        using (family_id in (select id from public.families where owner = auth.uid()))
        with check (family_id in (select id from public.families where owner = auth.uid()))
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Topes de cordura (migración 017)
--
-- Solo `completions`, `redemptions`, `challenges` y `app_logs` tenían
-- límite de ritmo; `profiles`, `rewards` y `family_goals` se podían
-- insertar sin freno desde una cuenta recién registrada, y registrarse lo
-- hace cualquiera desde la propia app. Esto no es antifraude: es lo que
-- evita que una cuenta llene la base de la que dependen las demás casas.
-- Los números son absurdos para una familia real y ridículos para un
-- script, que es exactamente donde tiene que caer un tope así.
-- ---------------------------------------------------------------------

create or replace function public.tg_tope_filas()
returns trigger language plpgsql security invoker as $$
declare
  v_max integer := tg_argv[0]::integer;
  v_cuantas integer;
begin
  execute format('select count(*) from public.%I where family_id = $1', tg_table_name)
    into v_cuantas using new.family_id;

  if v_cuantas >= v_max then
    raise exception 'tope_de_filas:%: el gremio ya tiene % (máximo %)', tg_table_name, v_cuantas, v_max
      using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists tope_profiles on public.profiles;
create trigger tope_profiles before insert on public.profiles
  for each row execute function public.tg_tope_filas('15');

drop trigger if exists tope_rewards on public.rewards;
create trigger tope_rewards before insert on public.rewards
  for each row execute function public.tg_tope_filas('120');

drop trigger if exists tope_goals on public.family_goals;
create trigger tope_goals before insert on public.family_goals
  for each row execute function public.tg_tope_filas('500');

drop trigger if exists tope_challenges on public.challenges;
create trigger tope_challenges before insert on public.challenges
  for each row execute function public.tg_tope_filas('600');

-- ---------------------------------------------------------------------
-- Funciones atómicas (evitan puntos duplicados o saldos negativos)
-- ---------------------------------------------------------------------

-- Aprobar o rechazar una misión pendiente. Al aprobar, abona XP y monedas.
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
    update public.profiles set xp = xp + c.xp, coins = coins + c.coins where id = c.profile_id;
  end if;
end $$;

-- Deshacer una misión: lo contrario exacto de resolve_completion.
-- Un toque equivocado (o una validación de más) tiene que poder revertirse
-- sin entrar en la base de datos. Si las monedas ya se gastaron, el saldo
-- se queda en cero en lugar de irse a negativo.
create or replace function public.undo_completion(c_id uuid)
returns text
language plpgsql
security invoker
as $$
declare c public.completions%rowtype;
begin
  select * into c from public.completions where id = c_id for update;
  if not found then return 'no_existe'; end if;

  if c.status = 'aprobado' then
    update public.profiles
      set xp = greatest(0, xp - c.xp),
          coins = greatest(0, coins - c.coins)
      where id = c.profile_id;
  end if;

  delete from public.completions where id = c_id;
  return 'ok';
end $$;

-- Canjear un premio: descuenta monedas y crea el canje pendiente de entrega.
create or replace function public.redeem_reward(rw_id uuid, p_id uuid)
returns text
language plpgsql
security invoker
as $$
declare rw public.rewards%rowtype; p public.profiles%rowtype;
begin
  select * into rw from public.rewards where id = rw_id and active = true;
  if not found then return 'no_disponible'; end if;
  select * into p from public.profiles where id = p_id for update;
  if not found then return 'no_disponible'; end if;
  if p.coins < rw.cost then return 'sin_monedas'; end if;
  update public.profiles set coins = coins - rw.cost where id = p_id;
  insert into public.redemptions (family_id, reward_id, profile_id, cost)
    values (rw.family_id, rw.id, p_id, rw.cost);
  return 'ok';
end $$;

-- Entregar o cancelar un canje. Al cancelar, devuelve las monedas.
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
    update public.profiles set coins = coins + r.cost where id = r.profile_id;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Realtime: para que las validaciones aparezcan al instante en los
-- dispositivos de las niñas sin recargar.
-- ---------------------------------------------------------------------

do $$ begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.challenges; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.completions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.rewards; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.redemptions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.family_goals; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.profile_badges; exception when duplicate_object then null; end $$;

-- =====================================================================
-- CAPA DE PRODUCCIÓN
-- Registro estructurado, límite de ritmo y comprobación de salud.
-- Si ya tenías el esquema creado, ejecuta migracion-002-produccion.sql
-- en lugar de este fichero entero.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Logs estructurados
-- Una fila por línea de log de nivel warn o error (el cliente descarta
-- los informativos salvo que se active la bandera logsInfo).
-- ---------------------------------------------------------------------

create table if not exists public.app_logs (
  id bigint generated always as identity primary key,
  family_id uuid references public.families(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  ts timestamptz not null default now(),
  nivel text not null check (nivel in ('debug','info','warn','error')),
  evento text not null,
  release text,
  sesion_id text,
  request_id text,
  datos jsonb not null default '{}'::jsonb
);

create index if not exists idx_app_logs_ts on public.app_logs (ts desc);
create index if not exists idx_app_logs_family_nivel on public.app_logs (family_id, nivel, ts desc);

alter table public.app_logs enable row level security;

drop policy if exists logs_lectura on public.app_logs;
create policy logs_lectura on public.app_logs
  for select to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()));

-- La escritura admite family_id nulo: hay errores que ocurren antes de
-- saber a qué familia pertenece la sesión (por ejemplo, al cargar).
drop policy if exists logs_escritura on public.app_logs;
create policy logs_escritura on public.app_logs
  for insert to authenticated
  with check (
    auth.uid() is not null
    and (family_id is null or family_id in (select id from public.families where owner = auth.uid()))
  );

-- Retención: los logs no son un archivo histórico. Bórralos a los 30 días.
--
-- `security definer` desde la migración 017, y no es un detalle. Cuando
-- era `security invoker` borraba solo lo que veía quien la llamaba, o sea
-- los logs de su propia familia: con una familia dentro eso PARECÍA «borra
-- los logs viejos». Con muchas, cada casa tendría que acordarse, y las
-- filas con `family_id` nulo —que existen a propósito, ver la política de
-- arriba— no las ve nadie y no las borraba nadie nunca.
--
-- Por eso mismo la app no la puede llamar: se le retira el permiso a
-- `authenticated`. La ejecuta el SQL Editor o un cron con clave de
-- servicio.
create or replace function public.purge_logs(dias integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare borradas integer;
begin
  delete from public.app_logs where ts < now() - (dias || ' days')::interval;
  get diagnostics borradas = row_count;

  -- Las ventanas de ritmo caducadas se van con ellos: la limpieza perezosa
  -- del 1 % puede no llegar nunca en una base poco visitada.
  delete from public.rate_limits where window_start < now() - interval '2 days';
  delete from public.user_limits where window_start < now() - interval '2 days';

  return borradas;
end $$;

revoke all on function public.purge_logs(integer) from public;
revoke all on function public.purge_logs(integer) from authenticated;

-- ---------------------------------------------------------------------
-- 2. Límite de ritmo (rate limiting)
-- Se aplica en la base de datos, no en el cliente: es el único punto que
-- no se puede saltar desde la consola del navegador. Protege contra el
-- bucle accidental (un dedo de tres años sobre el mismo botón) y contra
-- el uso indebido de la clave anon, que es pública por diseño.
-- El inicio de sesión y el alta los limita Supabase Auth; esos ajustes
-- viven en el panel (Authentication → Rate Limits), ver docs/RUNBOOK.md.
-- ---------------------------------------------------------------------

create table if not exists public.rate_limits (
  family_id uuid not null references public.families(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (family_id, bucket, window_start)
);

alter table public.rate_limits enable row level security;

drop policy if exists ritmo_familia on public.rate_limits;
create policy ritmo_familia on public.rate_limits
  for all to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()))
  with check (family_id in (select id from public.families where owner = auth.uid()));

-- La misma cuenta, pero por CUENTA y no por familia (migración 017).
-- Existe por un hueco concreto: `rate_guard` se rinde cuando la familia es
-- nula y la escritura de `app_logs` admite familia nula a propósito, así
-- que entre las dos decisiones razonables cualquier cuenta registrada
-- podía escribir filas sin límite. Cuando aún no hay gremio, la cuenta es
-- lo único que se sabe de quien escribe.
create table if not exists public.user_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket, window_start)
);

alter table public.user_limits enable row level security;

drop policy if exists ritmo_cuenta on public.user_limits;
create policy ritmo_cuenta on public.user_limits
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.rate_guard_user(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
  ventana timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  actual integer;
begin
  if v_user is null then return; end if;

  insert into public.user_limits (user_id, bucket, window_start, count)
  values (v_user, p_bucket, ventana, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = public.user_limits.count + 1
  returning count into actual;

  if random() < 0.01 then
    delete from public.user_limits where window_start < now() - interval '2 days';
  end if;

  if actual > p_max then
    raise exception 'limite_de_ritmo:%: % en % s (máximo %)', p_bucket, actual, p_window_seconds, p_max
      using errcode = 'P0001';
  end if;
end $$;

create or replace function public.rate_guard(
  p_family uuid,
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
returns void
language plpgsql
security invoker
as $$
declare
  ventana timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  actual integer;
begin
  if p_family is null then return; end if;

  insert into public.rate_limits (family_id, bucket, window_start, count)
  values (p_family, p_bucket, ventana, 1)
  on conflict (family_id, bucket, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into actual;

  -- Limpieza perezosa: sin esto la tabla crece para siempre.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  if actual > p_max then
    raise exception 'limite_de_ritmo:%: % en % s (máximo %)', p_bucket, actual, p_window_seconds, p_max
      using errcode = 'P0001';
  end if;
end $$;

create or replace function public.tg_ritmo_completions()
returns trigger language plpgsql security invoker as $$
begin
  perform public.rate_guard(new.family_id, 'completions', 120, 3600);
  return new;
end $$;

create or replace function public.tg_ritmo_redemptions()
returns trigger language plpgsql security invoker as $$
begin
  perform public.rate_guard(new.family_id, 'redemptions', 30, 3600);
  return new;
end $$;

create or replace function public.tg_ritmo_challenges()
returns trigger language plpgsql security invoker as $$
begin
  perform public.rate_guard(new.family_id, 'challenges', 300, 3600);
  return new;
end $$;

-- Las dos ramas cubiertas: con gremio se cuenta por gremio, sin gremio se
-- cuenta por cuenta y mucho más estrecho (un cliente honrado escribe
-- cuatro líneas de arranque antes de saber de qué casa es). De paso
-- recorta el `datos` desmesurado: el registro es para diagnosticar un
-- fallo, no un sitio donde dejar ficheros.
create or replace function public.tg_ritmo_logs()
returns trigger language plpgsql security invoker as $$
begin
  if new.family_id is null then
    perform public.rate_guard_user('app_logs_sin_familia', 60, 3600);
  else
    perform public.rate_guard(new.family_id, 'app_logs', 600, 3600);
  end if;

  if length(new.datos::text) > 8192 then
    new.datos := jsonb_build_object(
      'truncado', true,
      'bytes', length(new.datos::text),
      'evento', new.evento
    );
  end if;

  return new;
end $$;

drop trigger if exists ritmo_completions on public.completions;
create trigger ritmo_completions before insert on public.completions
  for each row execute function public.tg_ritmo_completions();

drop trigger if exists ritmo_redemptions on public.redemptions;
create trigger ritmo_redemptions before insert on public.redemptions
  for each row execute function public.tg_ritmo_redemptions();

drop trigger if exists ritmo_challenges on public.challenges;
create trigger ritmo_challenges before insert on public.challenges
  for each row execute function public.tg_ritmo_challenges();

drop trigger if exists ritmo_logs on public.app_logs;
create trigger ritmo_logs before insert on public.app_logs
  for each row execute function public.tg_ritmo_logs();

-- ---------------------------------------------------------------------
-- 3. Comprobación de salud
-- Devuelve un JSON con el estado de la base y sus dependencias. La llaman
-- la pantalla de estado de la app y scripts/health-check.mjs (que sirve
-- para un monitor externo tipo UptimeRobot o para el CI).
-- Funciona con la clave anon sin sesión: los contadores saldrán a cero
-- por RLS, y precisamente eso demuestra que RLS está vivo.
-- ---------------------------------------------------------------------

create or replace function public.health()
returns json
language sql
security invoker
stable
as $$
  select json_build_object(
    'status', 'ok',
    'ts', now(),
    'postgres', current_setting('server_version'),
    'familias_visibles', (select count(*) from public.families),
    'pendientes', (select count(*) from public.completions where status = 'pendiente'),
    'errores_24h', (select count(*) from public.app_logs where nivel = 'error' and ts > now() - interval '24 hours')
  );
$$;



-- ------------------------------------------------------------------
-- Bonus: monedas que NO vienen de una misión.
--
-- Dos orígenes con la misma forma: el juego diario de la peque (una vez
-- al día, tipo 'globos') y el premio a mano de un adulto por algo
-- excepcional (tipo 'manual', varias veces al día si hace falta). Tenerlos
-- en la misma tabla hace que «de dónde salieron estas monedas» se lea de
-- una sola consulta.
-- ------------------------------------------------------------------

create table if not exists public.bonuses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  dia date not null default (now() at time zone 'Europe/Madrid')::date,
  tipo text not null default 'globos',
  coins integer not null default 5,
  -- Obligatorio para los manuales: sin motivo, dentro de un mes nadie
  -- recuerda por qué esa persona tiene monedas de más.
  motivo text check (motivo is null or length(motivo) <= 300),
  -- Qué adulto lo concedió. Si mañana hay que explicar el saldo, la
  -- respuesta tiene que existir en algún sitio.
  otorgado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- El tope de «uno al día» es del juego. Los manuales quedan fuera: la vida
-- no viene de uno en uno.
create unique index if not exists idx_bonuses_uno_al_dia
  on public.bonuses (profile_id, dia, tipo) where tipo <> 'manual';
create index if not exists idx_bonuses_family_dia on public.bonuses (family_id, dia desc);

alter table public.bonuses enable row level security;

drop policy if exists bonuses_lectura on public.bonuses;
create policy bonuses_lectura on public.bonuses
  for select to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()));

-- Sin política de insert a propósito: solo se entra por las dos funciones
-- de abajo, que son `security definer`. Con insert abierto, cualquiera con
-- la consola del navegador se regala monedas escribiendo en la tabla.

do $$ begin alter publication supabase_realtime add table public.bonuses; exception when duplicate_object then null; end $$;

-- El juego diario de la peque. Devuelve texto, como el resto de RPC:
--   'ok' · 'ya_hoy' (caso normal, no error) · 'no_existe' · 'no_es_tuyo'
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

-- El premio a mano. Tres reglas que se garantizan AQUÍ y no solo en el
-- formulario, porque una regla que solo vive en el navegador no es regla:
-- no da XP, el motivo es obligatorio, y lo concede un adulto identificado.
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
-- Poderes de las insignias (migración 015).
--
-- Un poder gastable (comodín, voz de mando) tiene usos contados, y la
-- cuenta la lleva Postgres: si viviera en el navegador, recargar la
-- página devolvería los usos. Mismo bug que tuvo el juego de globos.
-- ------------------------------------------------------------------

create table if not exists public.power_uses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- La insignia que da el poder. Los usos se cuentan POR INSIGNIA y no por
  -- tipo: dos insignias distintas que den comodín dan sus usos cada una.
  code text not null,
  tipo text not null check (tipo in ('salva_racha', 'asigna_tarea')),
  -- A quién se le encarga la misión (voz de mando). Nulo en los demás.
  target_id uuid references public.profiles(id) on delete set null,
  nota text,
  used_at timestamptz not null default now()
);

create index if not exists idx_power_uses_profile on public.power_uses (profile_id, code);
create index if not exists idx_power_uses_family on public.power_uses (family_id, used_at desc);

alter table public.power_uses enable row level security;

drop policy if exists power_uses_lectura on public.power_uses;
create policy power_uses_lectura on public.power_uses
  for select to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()));

-- Sin política de insert: se entra por la función, que es la que cuenta.

do $$ begin alter publication supabase_realtime add table public.power_uses; exception when duplicate_object then null; end $$;

-- Las insignias `unica` las tiene UNA persona del gremio. Los códigos van
-- escritos a mano porque la alternativa (una columna `clase` en la tabla)
-- sería el mismo catálogo duplicado y además desincronizable fila a fila.
-- Si se añade una única nueva en src/lib/insignias.js, hay que añadirla
-- aquí: tests/insignias.test.js recuerda esa deuda.
create unique index if not exists idx_badges_unica_por_gremio
  on public.profile_badges (family_id, code)
  where code in ('primer_nivel10', 'mano_derecha', 'coleccionista');

-- Gastar un uso. Devuelve 'ok' · 'sin_usos' · 'no_la_tienes' ·
-- 'poder_no_gastable' · 'sin_destino' · 'destino_no_existe' · 'a_ti_no' ·
-- 'no_existe' · 'no_es_tuyo'. Detalle del reparto de responsabilidades
-- entre Postgres y el cliente en migracion-015-poderes-y-unicas.sql.
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

  if not exists (
    select 1 from public.families f where f.id = v_family and f.owner = auth.uid()
  ) then
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

revoke all on function public.spend_power(uuid, text, text, integer, integer, uuid, text) from public;
grant execute on function public.spend_power(uuid, text, text, integer, integer, uuid, text) to authenticated;


-- ------------------------------------------------------------------
-- El camino de la racha (migración 016).
--
-- Cada hito se paga UNA VEZ EN LA VIDA, no una por racha: si no, romper
-- la racha a propósito cada semana sería la forma más rentable de jugar.
-- Y la racha se comprueba AQUÍ: quien pide el cobro es la misma pantalla
-- que dibuja el contador, así que no puede ser también quien lo certifique.
-- Razonamiento completo en migracion-016-camino-de-rachas.sql.
-- ------------------------------------------------------------------

create unique index if not exists idx_bonuses_hito_una_vez
  on public.bonuses (profile_id, tipo)
  where tipo like 'racha:%';

-- ------------------------------------------------------------------
-- 2. El cobro, con la racha verificada
--
-- Devuelve texto, como el resto de RPC:
--   'ok'          → cobrado, monedas abonadas
--   'ya_cobrado'  → ese hito ya se pagó. NO es un error: es el caso normal
--                   de volver a abrir la pantalla
--   'aun_no'      → la racha real no llega a ese hito
--   'hito_invalido' · 'no_existe' · 'no_es_tuyo'
-- ------------------------------------------------------------------

-- ⚠️ La definición de `claim_streak` está MÁS ABAJO, en el bloque de la
-- migración 019: desde entonces delega la cuenta de la racha en
-- `streak_days` en vez de llevar su propia copia. Aquí quedaba la versión
-- de la 016, y tener las dos en el mismo fichero dejaba al lector
-- adivinando cuál manda; un test lo cazó.

-- ------------------------------------------------------------------
-- Borrar la cuenta entera desde la app (migración 018).
--
-- Se lleva por delante el gremio —y con él, en cascada, perfiles,
-- misiones, historial, premios, insignias, bonus, poderes y registros— y
-- después la propia cuenta de `auth.users`. Sin esto último quedaría un
-- correo huérfano que nadie puede quitar desde la app.
--
-- Va en la base y no en una Edge Function a propósito: una Edge Function
-- exige la CLI de Supabase y una clave de servicio guardada en algún
-- sitio. Aquí el permiso lo da ser `security definer` con dueño
-- `postgres`, y la única fila que puede tocar es la de `auth.uid()`: no
-- acepta ningún identificador desde fuera, así que no hay forma de pedir
-- el borrado de otra cuenta.
--
-- La confirmación (escribir el nombre del gremio) vive en la interfaz,
-- que es donde se puede leer lo que se va a perder.
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
  -- por delante los de otra gente. Los barre `purge_logs` por antigüedad.
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
-- Notificaciones push (migración 019).
--
-- `push_subs` guarda APARATOS, no personas: la suscripción pertenece a la
-- instalación del navegador y por eso la clave natural es el endpoint.
-- `push_log` es el tope de una al día, y vive aquí porque un tope que
-- depende de que el emisor se porte bien no es un tope.
-- Razonamiento completo en migracion-019-notificaciones.sql.
-- ------------------------------------------------------------------

create table if not exists public.push_subs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  -- Quién está usando ESTE aparato. Se actualiza al cambiar de perfil.
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- La URL que da el navegador. Es la identidad del aparato: si se
  -- reinstala la app o se limpia el sitio, cambia y entra como nueva.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- Para poder retirar sin borrar, igual que con los perfiles: una baja
  -- por fallos no debería perder el rastro de que ese aparato existió.
  activa boolean not null default true,
  fallos integer not null default 0,
  ultimo_ok timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subs_family on public.push_subs (family_id, activa);
create index if not exists idx_push_subs_profile on public.push_subs (profile_id, activa);

alter table public.push_subs enable row level security;

drop policy if exists push_subs_familia on public.push_subs;
create policy push_subs_familia on public.push_subs
  for all to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()))
  with check (family_id in (select id from public.families where owner = auth.uid()));

-- ------------------------------------------------------------------
-- 2. El tope de una al día
-- ------------------------------------------------------------------

create table if not exists public.push_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  dia date not null,
  motivo text not null,
  titulo text not null,
  cuerpo text not null,
  enviados integer not null default 0,
  created_at timestamptz not null default now()
);

-- ESTA línea es el tope. Una persona, un día, un aviso.
create unique index if not exists idx_push_log_uno_al_dia
  on public.push_log (profile_id, dia);
create index if not exists idx_push_log_family on public.push_log (family_id, dia desc);

alter table public.push_log enable row level security;

drop policy if exists push_log_lectura on public.push_log;
create policy push_log_lectura on public.push_log
  for select to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()));

-- Sin política de insert: solo escribe la función de envío, que es
-- `security definer`. Que el navegador pueda marcar un día como «ya
-- avisado» sería regalarle el silenciador a quien no debe tenerlo.

-- ------------------------------------------------------------------
-- 3. La racha, con UNA sola definición en toda la base
--
-- La 016 la contaba dentro de `claim_streak`. Ahora hace falta también
-- para el aviso («tu racha de 12 días»), y dos copias de la misma cuenta
-- acaban discrepando el día que alguien toque una: el aviso diría 12 y el
-- cobro pagaría por 11. Se extrae aquí y `claim_streak` pasa a usarla.
-- ------------------------------------------------------------------

create or replace function public.streak_days(p_id uuid, p_tz text default 'Europe/Madrid')
returns integer
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_racha integer := 0;
  v_dia date := (now() at time zone p_tz)::date;
  v_hay boolean;
begin
  -- Un día cuenta si tiene una misión aprobada O si está tapado con un
  -- comodín, que para eso existe el comodín.
  loop
    select exists (
      select 1 from public.completions
       where profile_id = p_id and status = 'aprobado' and resolved_at is not null
         and (resolved_at at time zone p_tz)::date = v_dia
    ) or exists (
      select 1 from public.power_uses
       where profile_id = p_id and tipo = 'salva_racha'
         and (used_at at time zone p_tz)::date = v_dia
    ) into v_hay;

    -- Hoy sin nada no rompe la racha: el día no ha terminado. Se salta al
    -- de ayer y se sigue contando desde ahí.
    if not v_hay then
      exit when v_racha > 0 or v_dia < (now() at time zone p_tz)::date;
      v_dia := v_dia - 1;
      continue;
    end if;

    v_racha := v_racha + 1;
    v_dia := v_dia - 1;
    exit when v_racha >= 400;
  end loop;

  return v_racha;
end $fn$;

revoke all on function public.streak_days(uuid, text) from public;
grant execute on function public.streak_days(uuid, text) to authenticated;

-- `claim_streak` pasa a usarla en vez de su copia. Es un `create or
-- replace` con la MISMA firma, así que no deja sobrecargas sueltas —el
-- problema que dio `resolve_completion` en la 005— y la tabla de importes
-- se queda donde estaba, que es lo que compara el test contra el
-- catálogo de JavaScript.
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

  update public.profiles set coins = coins + v_coins where id = p_id;

  return 'ok';
end $fn$;

revoke all on function public.claim_streak(uuid, integer) from public;
grant execute on function public.claim_streak(uuid, integer) to authenticated;

-- ------------------------------------------------------------------
-- 5. A quién toca avisar y por qué
--
-- Toda la decisión vive en esta vista, y eso es deliberado: la función
-- que envía solo tiene que saber firmar y hablar HTTP. Así el «a quién y
-- por qué» se puede mirar, probar y corregir desde el SQL Editor sin
-- volver a desplegar nada.
--
-- Los motivos, por orden de prioridad:
--   racha_riesgo → tiene racha viva y hoy aún no ha validado nada
--   sin_validar  → adulto con misiones esperando (es el cuello de botella
--                  real: si nadie valida, el gremio se para)
--   vuelve       → lleva 2 días o más sin aparecer
--
-- Quien ya ha hecho algo hoy NO recibe nada: ya está dentro, y avisar a
-- quien acaba de cumplir es la forma más rápida de que silencie la app.
-- ------------------------------------------------------------------

-- `security_invoker = true` NO es opcional. Desde Postgres 15 una vista se
-- ejecuta por defecto con los permisos de su DUEÑO, así que sin esta línea
-- la vista se saltaría el RLS de las tablas de abajo y cualquier cuenta
-- autenticada vería a las familias de las demás. Con ella, cada quien ve
-- lo suyo; la función de envío usa la clave de servicio y las ve todas,
-- que es justo lo que necesita y por el camino que corresponde.
create or replace view public.push_pendientes
with (security_invoker = true) as
with hoy as (
  select f.id as family_id,
         (now() at time zone f.timezone)::date as dia,
         extract(hour from now() at time zone f.timezone)::int as hora
    from public.families f
),
actividad as (
  select p.id as profile_id,
         p.family_id,
         p.name,
         p.role,
         h.dia,
         h.hora,
         -- Días seguidos hasta ayer: si la racha fuese cero no hay nada
         -- que salvar y el aviso de racha no aplica.
         (select count(*) from public.completions c
           where c.profile_id = p.id and c.status = 'aprobado' and c.resolved_at is not null
             and (c.resolved_at at time zone f.timezone)::date = h.dia) as hechas_hoy,
         (select max((c.resolved_at at time zone f.timezone)::date) from public.completions c
           where c.profile_id = p.id and c.status = 'aprobado' and c.resolved_at is not null) as ultimo_dia,
         (select count(*) from public.completions c
           where c.family_id = p.family_id and c.status = 'pendiente') as por_validar,
         public.streak_days(p.id, f.timezone) as racha
    from public.profiles p
    join public.families f on f.id = p.family_id
    join hoy h on h.family_id = p.family_id
   where p.active
     -- La peque no recibe notificaciones: a los tres años el teléfono no
     -- es suyo, y avisar al aparato compartido por ella sería avisar a un
     -- adulto de algo que no puede hacer.
     and p.role <> 'peque'
)
select a.profile_id,
       a.family_id,
       a.name,
       a.role,
       a.dia,
       a.hora,
       a.racha,
       case
         when a.hechas_hoy > 0 then null
         when a.ultimo_dia = a.dia - 1 then 'racha_riesgo'
         when a.role = 'adulto' and a.por_validar > 0 then 'sin_validar'
         when a.ultimo_dia is null or a.ultimo_dia < a.dia - 1 then 'vuelve'
         else null
       end as motivo,
       a.por_validar
  from actividad a;

grant select on public.push_pendientes to authenticated;

-- =====================================================================
-- ÚLTIMO PASO, Y NO ES OPCIONAL (migración 021)
--
-- El rol `anon` no puede llamar a ninguna función `security definer`.
--
-- Cada `revoke ... from public` de este fichero parece dejar la función
-- solo para quien tiene sesión, y NO lo hace: Supabase concede EXECUTE a
-- `anon` y a `authenticated` por privilegios por defecto en cuanto la
-- función se crea, y `revoke from public` retira el pseudo-rol PUBLIC, no
-- los permisos que esos dos roles ya tienen por su nombre.
--
-- Con `purge_logs` eso era explotable de verdad: cualquiera con la clave
-- anon —que es pública por diseño y va en el bundle— podía vaciar
-- `app_logs` y, de paso, `rate_limits` y `user_limits`, o sea poner a
-- cero todos los contadores de ritmo a voluntad. Comprobado con curl el
-- 16-ago-2026.
--
-- Va al FINAL a propósito: tiene que ejecutarse después de la última
-- función del fichero. Si añades una nueva, añádela antes de esto o
-- vuelve a lanzar este bloque.
-- =====================================================================

-- Migración 023 · un sitio donde mirar cómo va esto.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- ------------------------------------------------------------------
-- EL PROBLEMA QUE RESUELVE
--
-- `app_logs` está bajo RLS por familia, que es lo correcto para la
-- privacidad y deja a quien mantiene esto sin una sola consulta que
-- responda «¿cuántas altas fallaron ayer?». Se puede mirar desde el SQL
-- Editor, que entra como dueño y ve todo, pero eso significa que hay que
-- acordarse, escribir la consulta y hacerlo antes de 30 días, que es
-- cuando la purga se lleva los logs.
--
-- El 16-ago pasó exactamente eso: los avisos push llevaban un día
-- montados con CERO suscripciones y no había forma de saber si era que
-- nadie los había activado o que fallaban en silencio. La respuesta
-- llegó por casualidad.
--
-- Esto guarda una fila al día con los números agregados. Ocupa nada,
-- **sobrevive a la purga de logs** y convierte «¿esto va bien?» en una
-- consulta de una línea.
--
-- SIN DATOS DE NADIE: solo cuentas. Ni family_id, ni nombres, ni
-- correos. Lo que se quiere saber es si el sistema funciona, no qué hace
-- cada familia, y una tabla que no guarda lo segundo no se puede usar
-- para lo segundo.
-- ------------------------------------------------------------------

create table if not exists public.salud_diaria (
  dia date primary key,
  cuentas integer not null default 0,
  gremios integer not null default 0,
  perfiles integer not null default 0,
  altas_del_dia integer not null default 0,
  misiones_validadas integer not null default 0,
  errores integer not null default 0,
  gremios_activos integer not null default 0,
  suscripciones_push integer not null default 0,
  avisos_enviados integer not null default 0,
  calculado_en timestamptz not null default now()
);

-- RLS encendido y SIN políticas: nadie llega por la API, ni con sesión ni
-- sin ella. Se consulta desde el SQL Editor o con la clave de servicio.
alter table public.salud_diaria enable row level security;

revoke all on table public.salud_diaria from anon;
revoke all on table public.salud_diaria from authenticated;

create or replace function public.registrar_salud(p_dia date default (now() at time zone 'Europe/Madrid')::date)
returns public.salud_diaria
language plpgsql
security definer
set search_path = public
as $fn$
declare fila public.salud_diaria;
begin
  insert into public.salud_diaria as s (
    dia, cuentas, gremios, perfiles, altas_del_dia, misiones_validadas,
    errores, gremios_activos, suscripciones_push, avisos_enviados
  )
  values (
    p_dia,
    (select count(*) from auth.users),
    (select count(*) from public.families),
    (select count(*) from public.profiles where active),
    (select count(*) from auth.users where created_at::date = p_dia),
    (select count(*) from public.completions
      where status = 'aprobado' and resolved_at::date = p_dia),
    (select count(*) from public.app_logs where nivel = 'error' and ts::date = p_dia),
    -- Un gremio cuenta como activo si alguien validó algo ese día. Es la
    -- señal honesta: abrir la app no es usarla.
    (select count(distinct family_id) from public.completions
      where status = 'aprobado' and resolved_at::date = p_dia),
    (select count(*) from public.push_subs where activa),
    (select coalesce(sum(enviados), 0) from public.push_log where dia = p_dia)
  )
  on conflict (dia) do update set
    cuentas = excluded.cuentas,
    gremios = excluded.gremios,
    perfiles = excluded.perfiles,
    altas_del_dia = excluded.altas_del_dia,
    misiones_validadas = excluded.misiones_validadas,
    errores = excluded.errores,
    gremios_activos = excluded.gremios_activos,
    suscripciones_push = excluded.suscripciones_push,
    avisos_enviados = excluded.avisos_enviados,
    calculado_en = now()
  returning * into fila;

  return fila;
end $fn$;

-- La lección de la 021: `revoke from public` NO quita el permiso que
-- Supabase concede a `anon` y `authenticated` por privilegios por
-- defecto. Hay que nombrarlos.
revoke all on function public.registrar_salud(date) from public;
revoke all on function public.registrar_salud(date) from anon;
revoke all on function public.registrar_salud(date) from authenticated;

-- A las 4:20, después de la purga de logs (4:10) para que el recuento de
-- errores del día ya cerrado se calcule sobre lo que queda, y después del
-- reparto de avisos (4:00).
do $$
begin
  perform cron.unschedule('salud-diaria');
exception when others then
  null;
end $$;

select cron.schedule('salud-diaria', '20 4 * * *', $c$ select public.registrar_salud((now() at time zone 'Europe/Madrid')::date - 1) $c$);

-- Y la de hoy, para no empezar con la tabla vacía.
select public.registrar_salud();

-- ------------------------------------------------------------------
-- CÓMO SE MIRA (pégalo en el SQL Editor cuando quieras saber cómo va)
-- ------------------------------------------------------------------
-- select * from public.salud_diaria order by dia desc limit 30;
--
-- Y para el detalle de un día malo, mientras los logs sigan ahí:
--
-- select evento, count(*) as veces, max(ts) as ultima
-- from public.app_logs
-- where nivel = 'error' and ts > now() - interval '24 hours'
-- group by evento order by veces desc;

-- Y el barrido final de la 021, que tiene que quedarse SIEMPRE el último
-- del fichero: retira `anon` de toda función `security definer`, incluidas
-- las que se añadan por debajo de aquí.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from anon', f.firma);
  end loop;
end $$;
