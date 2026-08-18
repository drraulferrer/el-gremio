-- ------------------------------------------------------------------
-- Migración 026 · La franja de noche y el aviso de programar
--
-- La programación diaria (025) trae un recordatorio para el adulto a eso
-- de las 21:00: registrar lo suyo y dejar programado mañana. Choca con lo
-- que ya había: `push_log` tenía tope de UN aviso por persona y día, así
-- que el de la noche se comía al de la tarde (o al revés).
--
-- LA DECISIÓN: el tope pasa de «uno al día» a «uno por FRANJA». Tarde
-- (hacer misiones) y noche (programar) son dos trabajos distintos y no se
-- pisan. Máximo dos avisos por persona y día.
--
-- Y un motivo nuevo, `sin_programar`, que la vista de avisos no calcula a
-- ojo: expone `sin_plan_manana` (si el gremio no tiene plan para mañana) y
-- la función de envío decide, según la franja de la hora, si toca.
--
-- Ojo con los acentos al pegar (MacRoman); traer el fichero del repo con
-- la consola del SQL Editor es más seguro. Ver migración 025.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1. push_log: una columna de franja y el tope por (perfil, dia, franja)
--
-- El backfill pone 'tarde' en lo que ya había, que es lo que eran: todos
-- los avisos anteriores a esto salían en la franja de tarde. Primero la
-- columna con su defecto (rellena las filas viejas), luego el índice
-- nuevo, y solo entonces se retira el viejo: si se quitara antes, entre
-- una cosa y otra se podrían colar duplicados.
-- ------------------------------------------------------------------

alter table public.push_log
  add column if not exists franja text not null default 'tarde'
  check (franja in ('tarde','noche'));

create unique index if not exists idx_push_log_uno_por_franja
  on public.push_log (profile_id, dia, franja);

drop index if exists idx_push_log_uno_al_dia;

-- ------------------------------------------------------------------
-- 2. La vista: expone `sin_plan_manana`, no decide la franja
--
-- La franja la pone la función de envío a partir de la hora, para que el
-- `?forzar` de prueba siga sirviendo a cualquier hora. Aquí solo se añade
-- la señal cruda: ¿tiene el gremio algún plan para mañana? Se mira a nivel
-- de familia —cualquier fila del día siguiente cuenta como «ya han
-- programado»—, y solo la usa el adulto en la franja de noche.
--
-- Es un `create or replace` con las MISMAS columnas de antes más una al
-- final. El resto de la lógica (racha_riesgo, sin_validar, vuelve, día
-- libre) no cambia.
-- ------------------------------------------------------------------

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
         (select count(*) from public.completions c
           where c.profile_id = p.id and c.status = 'aprobado' and c.resolved_at is not null
             and (c.resolved_at at time zone f.timezone)::date = h.dia) as hechas_hoy,
         (select max((c.resolved_at at time zone f.timezone)::date) from public.completions c
           where c.profile_id = p.id and c.status = 'aprobado' and c.resolved_at is not null) as ultimo_dia,
         (select count(*) from public.completions c
           where c.family_id = p.family_id and c.status = 'pendiente') as por_validar,
         public.streak_days(p.id, f.timezone) as racha,
         public.sin_mision_ese_dia(p.id, h.dia) as dia_libre,
         -- ¿El gremio ya ha programado mañana? Si no hay ninguna fila para
         -- el día siguiente, el adulto recibe el recordatorio de noche.
         not exists (
           select 1 from public.plan_diario pl
            where pl.family_id = p.family_id and pl.dia = h.dia + 1
         ) as sin_plan_manana
    from public.profiles p
    join public.families f on f.id = p.family_id
    join hoy h on h.family_id = p.family_id
   where p.active
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
         when a.dia_libre and a.role <> 'adulto' then null
         when not a.dia_libre and a.racha > 0 then 'racha_riesgo'
         when a.role = 'adulto' and a.por_validar > 0 then 'sin_validar'
         when a.dia_libre then null
         else 'vuelve'
       end as motivo,
       a.por_validar,
       a.sin_plan_manana
  from actividad a;

grant select on public.push_pendientes to authenticated;

-- ------------------------------------------------------------------
-- COMPROBACIÓN (pégala después de ejecutar; los tres a 1)
-- ------------------------------------------------------------------
-- select
--   (select count(*) from information_schema.columns
--     where table_schema='public' and table_name='push_log' and column_name='franja') as columna,
--   (select count(*) from pg_indexes
--     where schemaname='public' and indexname='idx_push_log_uno_por_franja') as indice_nuevo,
--   (select count(*) from information_schema.columns
--     where table_schema='public' and table_name='push_pendientes' and column_name='sin_plan_manana') as vista;
--
-- Y que el índice viejo YA NO está (espera 0):
-- select count(*) from pg_indexes where indexname='idx_push_log_uno_al_dia';
