-- ============================================================
-- Migración 033 · Contar que algo va mal
--
-- Qué añade: la tabla `informes_fallo`, el buzón de la familia.
--
-- POR QUÉ EXISTE. Hasta hoy un fallo visto un domingo por la tarde
-- llegaba —si llegaba— de viva voz y tres días después, sin versión, sin
-- pantalla y sin lo que decía la consola. `monitoring.js` ya recogía las
-- huellas de los errores, pero se quedaban en el navegador de quien los
-- sufría: nadie las leía nunca. Esto le pone al buzón un destino.
--
-- Lo que NO es: no es un sistema de tickets ni tiene estados que alguien
-- deba mantener al día. Es una libreta. `estado` existe para poder tachar
-- lo ya arreglado y que la lista no crezca sin fin, nada más.
--
-- Lo que NO se guarda: nada que no haya escrito quien informa, más la
-- versión, la pantalla, el agente del navegador (recortado) y las huellas
-- de error que ya estaban en memoria. Sin capturas, sin datos de otras
-- personas y sin lo que hubiera escrito en cualquier otro campo.
--
-- Idempotente: se puede ejecutar dos veces sin daño.
-- ============================================================

-- 1. La tabla --------------------------------------------------------

create table if not exists public.informes_fallo (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  -- Quién lo cuenta se guarda para poder preguntarle, y se pone a NULL si
  -- esa persona se retira: el informe sigue siendo válido sin ella.
  profile_id uuid references public.profiles(id) on delete set null,
  -- El tope de arriba no es decorativo: es lo que impide que un dedo
  -- apoyado en el móvil mande media novela a la base.
  texto text not null check (length(btrim(texto)) between 4 and 1000),
  pantalla text check (pantalla is null or length(pantalla) <= 40),
  -- `version_app` y no `release`: la columna de `app_logs` se llama
  -- `release` y ahí ya escuece; no hay motivo para repetirlo.
  version_app text check (version_app is null or length(version_app) <= 60),
  agente text check (agente is null or length(agente) <= 200),
  -- Las huellas de `monitoring.resumenErrores()`: [{huella, veces}]. Es
  -- justo lo que convierte «no va» en algo diagnosticable.
  huellas jsonb not null default '[]'::jsonb,
  estado text not null default 'nuevo' check (estado in ('nuevo','visto','arreglado','descartado')),
  created_at timestamptz not null default now()
);

-- Se lee siempre igual: lo del gremio, lo nuevo primero.
create index if not exists idx_informes_family on public.informes_fallo (family_id, created_at desc);

-- 2. RLS, grants y tope ----------------------------------------------

alter table public.informes_fallo enable row level security;

drop policy if exists familia_miembro on public.informes_fallo;
create policy familia_miembro on public.informes_fallo
  for all to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()))
  with check (family_id in (select id from public.families where owner = auth.uid()));

-- Las tablas nuevas ya no heredan los grants de siempre (lección de la
-- 028, §7w del arranque): sin esto, la lectura anónima da 401 en vez del
-- `[]` del RLS, y las comprobaciones externas mienten.
grant select on public.informes_fallo to anon;
grant select, insert, update, delete on public.informes_fallo to authenticated;

-- 200 informes por gremio. Un buzón sin tope es un sitio donde meter
-- 100.000 filas gratis, y aquí escribe cualquiera que tenga sesión.
drop trigger if exists tope_informes on public.informes_fallo;
create trigger tope_informes before insert on public.informes_fallo
  for each row execute function public.tg_tope_filas('200');

-- Sin realtime a propósito: nadie mira este buzón dentro de la app, y
-- suscribir una tabla que nadie escucha es pagar por nada.

-- ------------------------------------------------------------------
-- COMPROBACIÓN (pégala entera después de ejecutar; los cinco a 1)
-- ------------------------------------------------------------------
-- select
--   (select count(*) from information_schema.tables
--     where table_schema='public' and table_name='informes_fallo') as tabla,
--   (select count(*) from pg_policies
--     where schemaname='public' and tablename='informes_fallo' and policyname='familia_miembro') as rls,
--   (select count(*) from pg_trigger
--     where tgname='tope_informes' and not tgisinternal) as tope,
--   (select count(*) from information_schema.role_table_grants
--     where table_name='informes_fallo' and grantee='anon' and privilege_type='SELECT') as grant_anon,
--   (select count(*) from pg_indexes
--     where schemaname='public' and indexname='idx_informes_family') as indice;
--
-- Y que los checks MUERDEN (espera tres rechazos 23514; no deja nada):
--
-- do $v$
-- declare fam uuid;
-- begin
--   select id into fam from public.families limit 1;
--   begin
--     insert into public.informes_fallo (family_id, texto) values (fam, 'no');
--     raise exception 'MAL: acepto un texto de dos letras';
--   exception when check_violation then null;
--   end;
--   begin
--     insert into public.informes_fallo (family_id, texto) values (fam, repeat('x', 1001));
--     raise exception 'MAL: acepto mil una letras';
--   exception when check_violation then null;
--   end;
--   begin
--     insert into public.informes_fallo (family_id, texto, estado)
--       values (fam, 'ZZ prueba', 'urgentisimo');
--     raise exception 'MAL: acepto un estado inventado';
--   exception when check_violation then null;
--   end;
-- end $v$;
--
-- Y desde fuera, sin sesión (los dos como siempre):
--   informes_fallo?select=id&limit=1   → 200 y []  (RLS aguanta)
--   informes_fallo?select=inventada    → 400        (la tabla existe)

-- ------------------------------------------------------------------
-- LEER EL BUZÓN (esto es lo que se usa de verdad, cada pocos días)
-- ------------------------------------------------------------------
-- select created_at, texto, pantalla, version_app, huellas
--   from public.informes_fallo
--  where estado = 'nuevo'
--  order by created_at desc;
--
-- Y al arreglar uno:
--   update public.informes_fallo set estado = 'arreglado' where id = '…';
