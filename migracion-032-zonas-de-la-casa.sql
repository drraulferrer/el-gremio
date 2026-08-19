-- ============================================================
-- Migración 032 · Las zonas de la casa y el modo piso
--
-- Qué añade:
--   1. `families.tipo_gremio`: 'familia' (lo de siempre, y el valor de
--      todos los gremios existentes) o 'piso' (convivientes que no son
--      familia). No cambia ninguna regla de puntos ni de validación:
--      cambia el setup y cómo se leen las zonas.
--   2. Tabla `zonas_casa`: el mapa del modo limpieza. Cada gremio tiene
--      SUS zonas —los baños que tenga, la buhardilla que ningún catálogo
--      conoce— y de ellas salen las campañas de zona y de limpieza
--      profunda. `plantilla` dice qué se limpia ahí; `nombre` es cómo lo
--      llama esta casa; `tipo` 'privada' + `dueno` es la habitación de
--      cada conviviente en el modo piso.
--
-- Las plantas de un chalet NO se modelan: solo ponen nombre («Baño de
-- arriba»), igual que el patrón semanal evitó modelar semanas.
--
-- Cero backfill: sin filas, el modo limpieza cae a las zonas por
-- defecto de src/lib/zonas.js y todo se ve como antes. Un gremio solo
-- gana cuando configura las suyas.
--
-- Idempotente: se puede ejecutar dos veces sin daño.
-- ============================================================

-- 1. El tipo de gremio ----------------------------------------------

alter table public.families
  add column if not exists tipo_gremio text not null default 'familia'
  check (tipo_gremio in ('familia','piso'));

-- 2. La tabla --------------------------------------------------------

create table if not exists public.zonas_casa (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 2 and 60),
  emoji text not null default '🚪',
  plantilla text not null default 'generica' check (plantilla in (
    'cocina','bano','dormitorio','salon','entrada','lavadero','juegos','exterior','generica'
  )),
  tipo text not null default 'comun' check (tipo in ('comun','privada')),
  -- Sin CHECK que ate tipo y dueño: un dueño retirado deja la zona sin
  -- dueño, y eso es un estado legítimo que la interfaz enseña, no un
  -- error que la base deba impedir (la lección del NULL de la 027, por
  -- el camino corto: no escribir la comprobación que no hace falta).
  dueno uuid references public.profiles(id) on delete set null,
  orden smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_zonas_family on public.zonas_casa (family_id, orden);

-- 3. RLS, grants, tope y realtime ------------------------------------

alter table public.zonas_casa enable row level security;

drop policy if exists familia_miembro on public.zonas_casa;
create policy familia_miembro on public.zonas_casa
  for all to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()))
  with check (family_id in (select id from public.families where owner = auth.uid()));

-- Las tablas nuevas ya no heredan los grants de siempre (lección de la
-- 028, §7w del arranque): sin esto, la lectura anónima da 401 en vez del
-- `[]` del RLS, y las comprobaciones externas mienten.
grant select on public.zonas_casa to anon;
grant select, insert, update, delete on public.zonas_casa to authenticated;

drop trigger if exists tope_zonas on public.zonas_casa;
create trigger tope_zonas before insert on public.zonas_casa
  for each row execute function public.tg_tope_filas('40');

do $$ begin alter publication supabase_realtime add table public.zonas_casa; exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------
-- COMPROBACIÓN (pégala entera después de ejecutar; los seis a 1)
-- ------------------------------------------------------------------
-- select
--   (select count(*) from information_schema.columns
--     where table_schema='public' and table_name='families' and column_name='tipo_gremio') as tipo_gremio,
--   (select count(*) from information_schema.tables
--     where table_schema='public' and table_name='zonas_casa') as tabla,
--   (select count(*) from pg_policies
--     where schemaname='public' and tablename='zonas_casa' and policyname='familia_miembro') as rls,
--   (select count(*) from pg_trigger
--     where tgname='tope_zonas' and not tgisinternal) as tope,
--   (select count(*) from information_schema.role_table_grants
--     where table_name='zonas_casa' and grantee='anon' and privilege_type='SELECT') as grant_anon,
--   (select case when count(*) > 0 then 1 else 0 end from information_schema.role_table_grants
--     where table_name='zonas_casa' and grantee='authenticated') as grant_auth;
--
-- Y que los checks MUERDEN (espera tres rechazos 23514; no deja nada):
--
-- do $v$
-- declare fam uuid;
-- begin
--   select id into fam from public.families limit 1;
--   begin
--     insert into public.zonas_casa (family_id, nombre) values (fam, 'x');
--     raise exception 'MAL: acepto un nombre de un carácter';
--   exception when check_violation then null;
--   end;
--   begin
--     insert into public.zonas_casa (family_id, nombre, plantilla) values (fam, 'ZZ prueba', 'sotano');
--     raise exception 'MAL: acepto una plantilla inventada';
--   exception when check_violation then null;
--   end;
--   begin
--     update public.families set tipo_gremio = 'comuna' where id = fam;
--     raise exception 'MAL: acepto un tipo de gremio inventado';
--   exception when check_violation then null;
--   end;
-- end $v$;
--
-- Y desde fuera, sin sesión (los dos como siempre):
--   zonas_casa?select=id&limit=1   → 200 y []  (RLS aguanta)
--   zonas_casa?select=inventada    → 400        (la tabla existe)
