-- ------------------------------------------------------------------
-- Migración 025 · Programar las diarias del día siguiente
--
-- Lo pidió la familia (17-ago): poder decidir cada noche qué harán al día
-- siguiente la junior y la peque. Hoy las diarias salen por el patrón
-- semanal (`challenges.days`, migración 024) y un adulto no puede afinar
-- UN día concreto sin cambiar el patrón para siempre.
--
-- LA DECISIÓN QUE SOSTIENE TODO: el plan es una CAPA por fecha ENCIMA del
-- patrón, no un requisito. Si nadie programa, manda el patrón y el día
-- sale normal —olvidarlo no rompe nada y la racha tampoco sufre—. Y la
-- sustitución es SOLO para ese día: el plan es por fecha, así que la
-- sustituta sale mañana y pasado vuelve el patrón, sin activar ni pausar
-- nada de forma permanente.
--
-- Solo aplica a las DIARIAS. Semanales, mensuales y únicas ya tienen su
-- cadencia y no se tocan: el cliente las resuelve por su vía de siempre.
--
-- Ojo con lo de siempre: pegar esto en el SQL Editor desde el navegador
-- destroza los acentos. Se trae el fichero desde el repo (público) con la
-- consola del editor, o se copia pre-codificado en MacRoman:
--
--   python3 -c "import subprocess;s=open('migracion-025-plan-diario.sql',encoding='utf-8').read();subprocess.run(['pbcopy'],input=s.encode('mac_roman'))"
--
-- Y si sale el diálogo «Potential issue detected · destructive
-- operations», hay que pulsar «Run query» y esperar el «Success».
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1. La tabla
--
-- Una fila por (familia, día, misión diaria planificada). «Hay plan para
-- (familia, dia)» = existe al menos una fila con ese `dia`. La
-- confirmación escribe las filas de golpe; si no hay ninguna para ese
-- día, no hay plan y manda el patrón.
--
-- `profile_id` va desnormalizado a propósito: es a quién le sale la misión
-- ese día, y es la columna por la que lee el tablero. El `challenge_id`
-- podría dar el perfil, pero una misión de rol (`profile_id null` en
-- challenges) no tiene uno solo, y el plan sí apunta a una persona.
--
-- `origen`: 'patron' = venía preseleccionada por el patrón; 'sustituta' =
-- la metió un adulto a mano para ese día. No cambia la lógica, explica la
-- fila cuando alguien mira la tabla.
-- ------------------------------------------------------------------

create table if not exists public.plan_diario (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  dia date not null,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  origen text not null default 'patron' check (origen in ('patron','sustituta')),
  created_at timestamptz not null default now(),
  -- Qué adulto confirmó. `set null` porque si ese adulto se da de baja, el
  -- plan del día no tiene por qué irse con él.
  created_by uuid references public.profiles(id) on delete set null,
  -- Una misión no puede estar dos veces en el plan del mismo día.
  unique (family_id, dia, challenge_id)
);

-- El tablero lee por aquí: «el plan de esta familia para este día».
create index if not exists idx_plan_diario_dia
  on public.plan_diario (family_id, dia);

-- ------------------------------------------------------------------
-- 2. Tope de cordura: solo se programa cerca
--
-- El `unique` limita las filas por día al número de misiones distintas
-- (≤ 600 por el tope de challenges), pero `dia` es un eje libre: una
-- cuenta podría insertar filas para diez mil fechas y llenar la base de la
-- que dependen las demás casas. Esto lo ataja y de paso ES la regla de
-- producto —solo se programa el día de hoy o el de mañana—. La fecha del
-- servidor basta para un guardarraíl; la exactitud de zona la pone el
-- cliente al elegir el día.
-- ------------------------------------------------------------------

create or replace function public.tg_plan_dia_cercano()
returns trigger language plpgsql security invoker as $$
begin
  if new.dia < current_date - 1 or new.dia > current_date + 2 then
    raise exception 'plan_dia_fuera_de_rango: % no está entre ayer y pasado mañana', new.dia
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists plan_dia_cercano on public.plan_diario;
create trigger plan_dia_cercano before insert on public.plan_diario
  for each row execute function public.tg_plan_dia_cercano();

-- ------------------------------------------------------------------
-- 3. RLS: cada quien ve y escribe lo de su familia
--
-- `to authenticated` como todas: sin eso Postgres evalúa la política
-- también para el rol anónimo, y la clave anon es pública. Misma forma que
-- `familia_miembro` del resto de tablas.
-- ------------------------------------------------------------------

alter table public.plan_diario enable row level security;

drop policy if exists familia_miembro on public.plan_diario;
create policy familia_miembro on public.plan_diario
  for all to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()))
  with check (family_id in (select id from public.families where owner = auth.uid()));

-- ------------------------------------------------------------------
-- 4. Realtime: que un tablero abierto vea el plan en cuanto se confirma
-- ------------------------------------------------------------------

do $$ begin
  alter publication supabase_realtime add table public.plan_diario;
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------
-- 5. Retención: el plan de ayer no sirve para nada
--
-- Sin purga crece sin límite. Se barre lo anterior a hace 7 días —margen
-- para mirar atrás un par de días sin acumular— en el mismo cron de las
-- 4:10 que ya limpia logs. `security definer` para que corra sin sesión.
-- ------------------------------------------------------------------

create or replace function public.purge_planes(dias integer default 7)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare borradas integer;
begin
  delete from public.plan_diario where dia < current_date - dias;
  get diagnostics borradas = row_count;
  return borradas;
end $$;

revoke all on function public.purge_planes(integer) from public;
revoke all on function public.purge_planes(integer) from anon;
revoke all on function public.purge_planes(integer) from authenticated;

-- A las 4:12, justo después de la purga de logs (4:10) y antes de la de
-- salud (4:20). Idempotente: unschedule primero por si ya existía.
do $$
begin
  perform cron.unschedule('purga-planes');
exception when others then
  null;
end $$;

select cron.schedule('purga-planes', '12 4 * * *', $c$ select public.purge_planes(7) $c$);

-- ------------------------------------------------------------------
-- COMPROBACIÓN (pégala entera después de ejecutar; los cinco a 1)
-- ------------------------------------------------------------------
-- select
--   (select count(*) from information_schema.tables
--     where table_schema = 'public' and table_name = 'plan_diario') as tabla,
--   (select count(*) from pg_indexes
--     where schemaname = 'public' and indexname = 'idx_plan_diario_dia') as indice,
--   (select count(*) from pg_policies
--     where schemaname = 'public' and tablename = 'plan_diario' and policyname = 'familia_miembro') as rls,
--   (select count(*) from pg_publication_tables
--     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plan_diario') as realtime,
--   (select count(*) from cron.job where jobname = 'purga-planes') as cron;
--
-- Y que el guardarraíl de fecha rechaza una fecha lejana (espera P0001).
-- Toca una fila y la deshace pase lo que pase:
--
-- do $v$
-- declare fam uuid; ch uuid; pr uuid;
-- begin
--   select id into fam from public.families limit 1;
--   select id, profile_id into ch, pr from public.challenges where family_id = fam and profile_id is not null limit 1;
--   insert into public.plan_diario (family_id, dia, challenge_id, profile_id)
--   values (fam, current_date + 30, ch, pr);
--   raise exception 'MAL: acepto una fecha a 30 dias';
-- exception when sqlstate 'P0001' then
--   if position('fuera_de_rango' in sqlerrm) = 0 then raise; end if;
-- end $v$;
