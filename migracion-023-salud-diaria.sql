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
