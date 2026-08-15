-- Migración 002 · capa de producción (logs, límite de ritmo, health).
-- Solo hace falta si ya habías ejecutado una versión anterior de schema.sql.
-- Si empiezas de cero, schema.sql ya lo incluye todo. Es idempotente.

-- =====================================================================
-- CAPA DE PRODUCCIÓN
-- Registro estructurado, límite de ritmo y comprobación de salud.
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

