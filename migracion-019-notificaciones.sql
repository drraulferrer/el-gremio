-- Migración 019 · notificaciones push.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- ⚠️ Saldrá el aviso «Potential issue detected · destructive operations»
-- por los `drop policy`. No toca ni un dato: hay que pulsar «Run query» y
-- esperar el «Success. No rows returned». Cerrar ese diálogo sin pulsar NO
-- EJECUTA NADA y tampoco avisa (fue lo que pasó con la 015).
--
-- Dos tablas y un cron. Lo que hay que entender antes de tocar nada:
--
--  · `push_subs` guarda a qué APARATO se escribe, no a qué persona. Una
--    suscripción es de un navegador concreto, y por eso la clave natural
--    es el `endpoint`. El `profile_id` dice quién está usando ese aparato
--    ahora mismo y se reescribe al cambiar de perfil: en el móvil de la
--    junior siempre estará ella, y en la tablet compartida el mensaje
--    debe ir para quien la tenga abierta.
--
--  · `push_log` es el tope de una al día por persona. Vive aquí y no en
--    la función que envía porque un tope que depende de que el emisor se
--    porte bien no es un tope: si mañana el cron se dispara dos veces por
--    un reintento, el índice único es lo único que evita que la familia
--    reciba dos avisos iguales.

-- ------------------------------------------------------------------
-- 1. A qué aparatos se escribe
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
  for all
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
  for select using (family_id in (select id from public.families where owner = auth.uid()));

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

-- Comprobación de a quién se avisaría ahora mismo:
--
-- select name, role, hora, motivo from public.push_pendientes
--  where motivo is not null;
