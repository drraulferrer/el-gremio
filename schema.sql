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
  name text not null,
  parent_pin_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
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
  profile_id uuid references public.profiles(id) on delete cascade, -- null = para todos
  title text not null,
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
  praise text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
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
  title text not null,
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
create index if not exists idx_profiles_family on public.profiles (family_id);
create index if not exists idx_profiles_family_active on public.profiles (family_id, active);
create index if not exists idx_challenges_family on public.challenges (family_id);
create index if not exists idx_challenges_skill on public.challenges (family_id, skill);
-- Un índice por cada consulta real de src/App.jsx, ordenación incluida:
-- sin la columna de fecha en el índice, pedir "las últimas 400" obliga a
-- leer y ordenar todo el historial de la familia.
create index if not exists idx_completions_family_fecha on public.completions (family_id, requested_at desc);
create index if not exists idx_redemptions_family_fecha on public.redemptions (family_id, requested_at desc);
create index if not exists idx_rewards_family on public.rewards (family_id, created_at);
create index if not exists idx_badges_family on public.profile_badges (family_id);
create index if not exists idx_goals_family_activa on public.family_goals (family_id, achieved, starts_at desc);

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

drop policy if exists familia_owner on public.families;
create policy familia_owner on public.families
  for all using (owner = auth.uid()) with check (owner = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['profiles','challenges','completions','rewards','redemptions','family_goals','profile_badges']
  loop
    execute format('drop policy if exists familia_miembro on public.%I', t);
    execute format($f$
      create policy familia_miembro on public.%I
        for all
        using (family_id in (select id from public.families where owner = auth.uid()))
        with check (family_id in (select id from public.families where owner = auth.uid()))
    $f$, t);
  end loop;
end $$;

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
  for select using (family_id in (select id from public.families where owner = auth.uid()));

-- La escritura admite family_id nulo: hay errores que ocurren antes de
-- saber a qué familia pertenece la sesión (por ejemplo, al cargar).
drop policy if exists logs_escritura on public.app_logs;
create policy logs_escritura on public.app_logs
  for insert with check (
    auth.uid() is not null
    and (family_id is null or family_id in (select id from public.families where owner = auth.uid()))
  );

-- Retención: los logs no son un archivo histórico. Bórralos a los 30 días.
create or replace function public.purge_logs(dias integer default 30)
returns integer
language plpgsql
security invoker
as $$
declare borradas integer;
begin
  delete from public.app_logs where ts < now() - (dias || ' days')::interval;
  get diagnostics borradas = row_count;
  return borradas;
end $$;

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
  for all
  using (family_id in (select id from public.families where owner = auth.uid()))
  with check (family_id in (select id from public.families where owner = auth.uid()));

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

create or replace function public.tg_ritmo_logs()
returns trigger language plpgsql security invoker as $$
begin
  perform public.rate_guard(new.family_id, 'app_logs', 600, 3600);
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

