-- Migración 040 · quién puede ver la actividad, sin salir de casa.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- ------------------------------------------------------------------
-- EL PROBLEMA QUE RESUELVE
--
-- `salud_diaria` (migración 023) ya lleva un registro diario de cuentas,
-- gremios, altas, misiones validadas y errores, pero solo se puede leer
-- desde el SQL Editor: la tabla tiene RLS sin políticas a propósito, así
-- que ni `anon` ni `authenticated` llegan a ella por la API. Verla hoy
-- significa abrir Supabase y pegar una consulta cada vez.
--
-- La tentación es un lector de analítica externo (tipo PostHog), pero
-- `legal/privacidad.html` §2 dice, sin matices, que esta app no usa
-- «herramientas de analítica o seguimiento de ningún tipo», y §5 cierra
-- la lista de proveedores que tratan datos. Meter uno nuevo ahí significa
-- reescribir un texto que familias con menores ya aceptaron, no marcar
-- una casilla de configuración. Igual que se decidió con Sentry
-- (docs/RUNBOOK.md §3): es una decisión legal, no un interruptor.
--
-- Esto no manda un solo byte fuera de Supabase. Añade una forma de que
-- SOLO quien mantiene la app pueda leer `salud_diaria` desde la propia
-- interfaz, con el mismo modelo de permisos que ya usa todo lo demás
-- aquí (RLS + función `security definer`), sin tocar la política de
-- privacidad porque no hay tercero ni herramienta de seguimiento nueva:
-- es una consulta más, con una puerta más estrecha.
-- ------------------------------------------------------------------

-- Lista de quién es «operador» (mantiene la app, no una familia más).
-- Vacía por defecto: se rellena a mano desde el SQL Editor con
-- `insert into public.operadores values ('<tu-auth-uid>')`, nunca desde
-- una migración — así el UUID de quien administra no queda en un
-- repositorio público.
create table if not exists public.operadores (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.operadores enable row level security;

-- Mismo patrón que salud_diaria: RLS encendido y SIN políticas. Nadie
-- llega por la API; se rellena a mano desde el SQL Editor.
revoke all on table public.operadores from anon;
revoke all on table public.operadores from authenticated;

-- Para que la interfaz sepa si le enseña la pestaña a quien ha entrado,
-- sin filtrar nunca quién más está en la lista.
create or replace function public.es_operador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.operadores where user_id = auth.uid());
$$;

revoke all on function public.es_operador() from public;
revoke all on function public.es_operador() from anon;
grant execute on function public.es_operador() to authenticated;

-- La propia salud_diaria, pero solo para quien está en `operadores`.
-- Cualquier otra cuenta autenticada recibe cero filas: la función no
-- lanza error porque no hay nada que ocultar en ese caso, es solo que no
-- hay nada que enseñar.
create or replace function public.actividad_reciente(p_dias integer default 30)
returns setof public.salud_diaria
language sql
stable
security definer
set search_path = public
as $$
  select s.* from public.salud_diaria s
  where public.es_operador()
  order by s.dia desc
  limit greatest(p_dias, 0);
$$;

revoke all on function public.actividad_reciente(integer) from public;
revoke all on function public.actividad_reciente(integer) from anon;
grant execute on function public.actividad_reciente(integer) to authenticated;

-- La 021 revoca `anon` de toda función `security definer` en un barrido
-- final, pero ese barrido vive solo en schema.sql (es el cierre del
-- fichero completo). Aquí, migración suelta, hay que nombrar `anon` a
-- mano — la lección de la propia 021 es que ni `revoke ... from public`
-- ni ese barrido de otro fichero lo hacen por ti.

-- ------------------------------------------------------------------
-- CÓMO TE DAS DE ALTA COMO OPERADOR (una vez, a mano, en el SQL Editor)
-- ------------------------------------------------------------------
-- select id, email from auth.users;                          -- busca el tuyo
-- insert into public.operadores values ('<tu-uuid-de-ahí>');
--
-- CÓMO SE MIRA, si algún día hace falta sin pasar por la interfaz:
-- select * from public.actividad_reciente(30);
