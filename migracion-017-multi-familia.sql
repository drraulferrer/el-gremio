-- Migración 017 · lo que hace falta para que quepan MUCHAS familias.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- ⚠️ El editor levantará el aviso «Potential issue detected · destructive
-- operations» por los `drop policy` y los `revoke`. No toca ni un dato:
-- hay que pulsar «Run query» y esperar el «Success. No rows returned». Si
-- se cierra ese diálogo sin pulsar, NO SE EJECUTA NADA y tampoco avisa.
--
-- Hasta hoy la base ha alojado UNA familia. Todo lo de aquí abajo es lo
-- que se rompe —o se puede reventar desde fuera— cuando hay diez mil.
-- Ninguna de estas seis cosas se nota con una sola familia dentro, y por
-- eso ninguna se había visto.

-- ------------------------------------------------------------------
-- 0. Antes de nada: ¿hay alguna cuenta con dos gremios?
--
-- El paso 2 crea un índice ÚNICO por `owner` y fallaría con un mensaje
-- ilegible. Esto lo dice claro y para la migración entera antes de
-- cambiar nada.
-- ------------------------------------------------------------------

do $$
declare v_duplicados integer;
begin
  select count(*) into v_duplicados from (
    select owner from public.families group by owner having count(*) > 1
  ) d;
  if v_duplicados > 0 then
    raise exception
      'Hay % cuenta(s) con más de un gremio. Mira cuáles con: select owner, count(*) from public.families group by owner having count(*) > 1; y borra o traspasa el sobrante ANTES de ejecutar esta migración.',
      v_duplicados;
  end if;
end $$;

-- ------------------------------------------------------------------
-- 1. El índice que sostiene TODAS las lecturas de TODAS las familias
--
-- Cada política RLS de este esquema termina en el mismo subconsulta:
--
--     family_id in (select id from public.families where owner = auth.uid())
--
-- `families` no tenía un solo índice por `owner`, así que esa subconsulta
-- se resolvía recorriendo la tabla entera. Con una familia dentro cuesta
-- cero y por eso nunca se notó; con cien mil, cada petición de cada
-- dispositivo de cada casa recorre cien mil filas antes de mirar sus
-- propios datos. Es el cuello de botella número uno del día que esto
-- deje de ser una app doméstica, y se arregla con una línea.
--
-- Va ÚNICO a propósito: ver el paso siguiente.
-- ------------------------------------------------------------------

create unique index if not exists idx_families_owner on public.families (owner);

-- ------------------------------------------------------------------
-- 2. Una cuenta, un gremio
--
-- No es una restricción nueva, es la que la app ya daba por supuesta sin
-- decirlo: `loadFamily` hace `select * from families limit 1` SIN ORDEN.
-- Una cuenta con dos gremios abre uno u otro según le parezca a Postgres,
-- y la familia ve su gremio vacío y cree que ha perdido el historial.
--
-- Pasa de verdad: el alta son cinco inserts encadenados (familia, luego
-- perfiles, misiones, premios y meta). Si el tercero falla y la persona
-- vuelve a empezar, ya hay dos gremios en la base y solo uno tiene datos.
-- El índice único de arriba convierte ese segundo intento en un error
-- claro en vez de en un gremio fantasma.
--
-- Si algún día una cuenta necesita dos gremios (dos casas, custodia
-- compartida), esto se sustituye por una tabla de pertenencia y un
-- selector de gremio. Mientras la app cargue con `limit 1`, dos gremios
-- por cuenta son un error, no una función.
-- ------------------------------------------------------------------

-- (el índice único del paso 1 es la restricción; no hace falta nada más)

-- ------------------------------------------------------------------
-- 3. Las políticas se declaran para `authenticated`
--
-- Sin `to authenticated`, Postgres evalúa la política —y con ella la
-- subconsulta a `families`— también para el rol anónimo, que nunca va a
-- cumplirla porque `auth.uid()` es nulo. Es trabajo garantizado a cambio
-- de nada en cada petición sin sesión, y la clave anon es pública: las
-- peticiones sin sesión las puede hacer cualquiera, tantas como quiera.
--
-- No cambia lo que ve nadie. Cambia lo que cuesta decir que no.
-- ------------------------------------------------------------------

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

drop policy if exists ritmo_familia on public.rate_limits;
create policy ritmo_familia on public.rate_limits
  for all to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()))
  with check (family_id in (select id from public.families where owner = auth.uid()));

drop policy if exists logs_lectura on public.app_logs;
create policy logs_lectura on public.app_logs
  for select to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()));

drop policy if exists bonuses_lectura on public.bonuses;
create policy bonuses_lectura on public.bonuses
  for select to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()));

drop policy if exists power_uses_lectura on public.power_uses;
create policy power_uses_lectura on public.power_uses
  for select to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()));

-- La de escritura de logs es la ÚNICA que no se puede olvidar aquí: es la
-- que admite `family_id` nulo, o sea la puerta del paso 4. (Se olvidó en el
-- primer pase de esta migración y lo cazó el `select` de comprobación del
-- final, que cuenta las políticas sin rol declarado. Para eso está.)
drop policy if exists logs_escritura on public.app_logs;
create policy logs_escritura on public.app_logs
  for insert to authenticated
  with check (
    auth.uid() is not null
    and (family_id is null or family_id in (select id from public.families where owner = auth.uid()))
  );

-- ------------------------------------------------------------------
-- 4. El agujero del límite de ritmo: los logs sin familia
--
-- `rate_guard` empieza por `if p_family is null then return; end if;` y la
-- política de escritura de `app_logs` admite `family_id` nulo a propósito
-- (hay errores que ocurren antes de saber de qué casa es la sesión).
-- Juntas, las dos decisiones razonables dejan un hueco: cualquier cuenta
-- registrada puede insertar filas sin familia SIN NINGÚN LÍMITE, con el
-- `datos jsonb` que quiera dentro.
--
-- Y lo peor no es que entren: es que no salen. `purge_logs` corría con
-- RLS, así que solo borraba lo que su familia podía ver, y una fila sin
-- familia no la ve nadie. Entran sin tope, no las lee nadie y no las
-- borra nadie.
--
-- La cuenta de esas filas no puede llevarse en `rate_limits`, que está
-- indexada por familia. Se lleva por cuenta, que es lo único que se sabe
-- de quien escribe cuando aún no hay gremio.
-- ------------------------------------------------------------------

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

  -- Limpieza perezosa, igual que en rate_guard.
  if random() < 0.01 then
    delete from public.user_limits where window_start < now() - interval '2 days';
  end if;

  if actual > p_max then
    raise exception 'limite_de_ritmo:%: % en % s (máximo %)', p_bucket, actual, p_window_seconds, p_max
      using errcode = 'P0001';
  end if;
end $$;

-- El disparador de los logs, ahora con las dos ramas cubiertas.
-- De paso recorta el `datos` desmesurado: el registro es para diagnosticar
-- un fallo, no un sitio donde dejar ficheros.
create or replace function public.tg_ritmo_logs()
returns trigger language plpgsql security invoker as $$
begin
  if new.family_id is null then
    -- Mucho más estrecho que el de familia (600/h): sin gremio, un cliente
    -- honrado escribe cuatro líneas de arranque y ya.
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

-- ------------------------------------------------------------------
-- 5. La retención deja de depender de que alguien se acuerde
--
-- `purge_logs` era `security invoker`: borraba lo que veía quien la
-- llamaba, es decir, los logs de su propia familia y ninguno más. Con una
-- familia dentro eso parecía «borra los logs viejos». Con muchas, cada
-- casa tendría que llamarla por su cuenta, y las filas sin familia del
-- paso 4 no las purga nadie nunca.
--
-- Ahora es `security definer` —barre la tabla entera, huérfanas incluidas—
-- y por eso mismo NO la puede llamar la app: se le retira el permiso a
-- `authenticated`. La ejecuta el SQL Editor (que entra como dueño) o un
-- cron con la clave de servicio.
-- ------------------------------------------------------------------

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

  -- Las ventanas de ritmo caducadas se van con ellos: la limpieza
  -- perezosa del 1 % puede no llegar nunca en una base poco visitada.
  delete from public.rate_limits where window_start < now() - interval '2 days';
  delete from public.user_limits where window_start < now() - interval '2 days';

  return borradas;
end $$;

revoke all on function public.purge_logs(integer) from public;
revoke all on function public.purge_logs(integer) from authenticated;

-- Si el proyecto tiene pg_cron disponible, esto lo deja programado y ya
-- nadie tiene que acordarse. Descoméntalo si quieres automatizarlo:
--
--   create extension if not exists pg_cron;
--   select cron.schedule('purga-logs', '0 4 * * *', $c$ select public.purge_logs(30) $c$);

-- ------------------------------------------------------------------
-- 6. Topes de cordura
--
-- Solo `completions`, `redemptions`, `challenges` y `app_logs` tenían
-- límite de ritmo. `profiles`, `rewards` y `family_goals` se podían
-- insertar sin freno con la clave anon y una cuenta recién registrada,
-- que se crea sola desde la propia app.
--
-- Esto no es antifraude: es lo que evita que una cuenta cualquiera llene
-- la base de la que dependen todas las demás casas. Los números son
-- absurdamente altos para una familia real —el catálogo entero son 119
-- misiones y la casa más poblada que se ha visto tiene cinco personas— y
-- ridículamente bajos para un script.
--
-- Y con ellos, un tope de longitud a lo que escribe el cliente. Sin él,
-- un título es tan largo como quiera quien lo mande.
-- ------------------------------------------------------------------

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

-- Longitudes. Van como `check` porque son invariantes de la fila, no
-- reglas de negocio, y así valen también para lo que entre por SQL.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'families_name_corto') then
    alter table public.families add constraint families_name_corto check (length(name) <= 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_name_corto') then
    alter table public.profiles add constraint profiles_name_corto check (length(name) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'challenges_title_corto') then
    alter table public.challenges add constraint challenges_title_corto check (length(title) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rewards_title_corto') then
    alter table public.rewards add constraint rewards_title_corto check (length(title) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goals_title_corto') then
    alter table public.family_goals add constraint goals_title_corto check (length(title) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'completions_praise_corto') then
    alter table public.completions add constraint completions_praise_corto check (praise is null or length(praise) <= 400);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bonuses_motivo_corto') then
    alter table public.bonuses add constraint bonuses_motivo_corto check (motivo is null or length(motivo) <= 300);
  end if;
end $$;

-- ------------------------------------------------------------------
-- Comprobación (pégala aparte cuando termine; debe salir todo a 1)
-- ------------------------------------------------------------------
-- select
--   (select count(*) from pg_indexes where indexname = 'idx_families_owner') as indice_owner,
--   (select count(*) from pg_tables where tablename = 'user_limits' and rowsecurity) as user_limits_rls,
--   (select count(*) from pg_proc where proname = 'rate_guard_user') as guard_por_cuenta,
--   (select count(*) from pg_proc where proname = 'purge_logs' and prosecdef) as purga_definer,
--   (select count(*) from pg_trigger where tgname = 'tope_profiles') as tope_perfiles,
--   (select count(*) from pg_policies where tablename = 'profiles' and 'authenticated' = any(roles)) as politica_con_rol;
