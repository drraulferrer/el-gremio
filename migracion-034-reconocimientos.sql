-- ============================================================
-- Migración 034 · Los gracias (F2 de docs/RECONOCIMIENTOS.md)
--
-- Qué añade: la tabla `reconocimientos`, el primer canal HORIZONTAL de
-- toda la app. Hasta hoy todo lo que la app reconoce baja de arriba abajo
-- —el adulto valida y elogia— o lo dicta el motor de sellos. Nadie podía
-- reconocer a nadie, y a los adultos no los reconocía nunca nadie.
--
-- Tres tipos, y el tercero es el que la hace usable a los tres años:
--
--   'gracias'    → cuelga o no de un encargo concreto, y lleva frase.
--   'espontaneo' → lo que NADIE pidió. Frase libre. En modo piso esta es
--                  la pieza principal (§10.4 de la spec): entre
--                  convivientes adultos no hay validación jerárquica, así
--                  que el canal vertical sencillamente no existe.
--   'gesto'      → el de la peque. Sin texto: una cara y una estrella.
--
-- Lo que esta tabla NO hace, y no es un olvido: no da Talis, no da XP, no
-- toca rachas y no cuenta para la meta. En el momento en que un «gracias»
-- paga cinco Talis deja de ser un gracias y pasa a ser una misión barata.
-- Por eso aquí no hay ninguna columna de recompensa: que no exista es más
-- fuerte que acordarse de no usarla.
--
-- Idempotente: se puede ejecutar dos veces sin daño.
-- ============================================================

-- 1. La tabla --------------------------------------------------------

create table if not exists public.reconocimientos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  -- Quién lo dice. A NULL si esa persona se retira: el reconocimiento
  -- sigue siendo cierto sin ella, igual que un elogio viejo.
  de_profile uuid references public.profiles(id) on delete set null,
  a_profile uuid not null references public.profiles(id) on delete cascade,
  tipo text not null default 'gracias' check (tipo in ('gracias','espontaneo','gesto')),
  texto text check (texto is null or length(btrim(texto)) between 3 and 240),
  -- De qué encargo cuelga, si cuelga de alguno. Nulo en lo espontáneo y
  -- en el gesto.
  completion_id uuid references public.completions(id) on delete set null,
  -- El día del GREMIO, no el del reloj del aparato: lo calcula el cliente
  -- con la zona de la familia, igual que `bonuses.dia` y `plan_diario`.
  -- Es la columna sobre la que se cuenta el tope diario.
  dia date not null,
  created_at timestamptz not null default now(),

  -- Un gesto no lleva frase y todo lo demás sí. Sin esto, un 'gracias'
  -- vacío sería un 👏 mudo, que es justo lo que la spec prohíbe: el
  -- elogio genérico se gasta por repetición (Owen et al., 2012).
  constraint reconocimiento_con_forma check (
    (tipo = 'gesto' and texto is null) or (tipo <> 'gesto' and texto is not null)
  ),
  -- Nadie se reconoce a sí mismo. Es lo primero que alguien va a probar.
  constraint reconocimiento_no_a_uno_mismo check (de_profile is distinct from a_profile)
);

-- Se lee siempre igual: lo de esta persona, lo último primero.
create index if not exists idx_reconocimientos_para
  on public.reconocimientos (family_id, a_profile, created_at desc);

-- Y se cuenta siempre igual: cuántos ha dado hoy esta persona.
create index if not exists idx_reconocimientos_dados
  on public.reconocimientos (de_profile, dia);

-- 2. El tope diario, en la BASE ---------------------------------------
--
-- Tres al día por persona. Un tope que solo viva en la interfaz lo salta
-- cualquiera que recargue, y aquí el tope no es una protección técnica:
-- es la regla que sostiene el valor de la pieza. Lo que se puede dar
-- infinitas veces no vale nada, y sin tope la peque convierte el botón en
-- un juego en tarde y media.

create or replace function public.tg_tope_gracias_dia()
returns trigger language plpgsql security invoker as $$
declare
  v_max integer := 3;
  v_cuantos integer;
begin
  if new.de_profile is null then
    return new;
  end if;

  select count(*) into v_cuantos
    from public.reconocimientos
   where de_profile = new.de_profile
     and dia = new.dia;

  if v_cuantos >= v_max then
    raise exception 'tope_de_gracias: ya has dado % hoy (máximo %)', v_cuantos, v_max
      using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists tope_gracias on public.reconocimientos;
create trigger tope_gracias before insert on public.reconocimientos
  for each row execute function public.tg_tope_gracias_dia();

-- 3. RLS, grants y tope de filas --------------------------------------

alter table public.reconocimientos enable row level security;

drop policy if exists familia_miembro on public.reconocimientos;
create policy familia_miembro on public.reconocimientos
  for all to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()))
  with check (family_id in (select id from public.families where owner = auth.uid()));

-- Las tablas nuevas no heredan los grants de siempre (lección de la 028).
grant select on public.reconocimientos to anon;
grant select, insert, update, delete on public.reconocimientos to authenticated;

-- Tope general de filas, como el resto de tablas que escribe cualquiera.
drop trigger if exists tope_reconocimientos on public.reconocimientos;
create trigger tope_reconocimientos before insert on public.reconocimientos
  for each row execute function public.tg_tope_filas('4000');

-- Realtime SÍ, y aquí a diferencia del buzón de fallos sí lo escucha
-- alguien: quien recibe un gracias tiene la app abierta en la cocina.
do $$ begin alter publication supabase_realtime add table public.reconocimientos; exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------
-- COMPROBACIÓN (pégala entera después de ejecutar; los seis a 1)
-- ------------------------------------------------------------------
-- select
--   (select count(*) from information_schema.tables
--     where table_schema='public' and table_name='reconocimientos') as tabla,
--   (select count(*) from pg_policies
--     where schemaname='public' and tablename='reconocimientos' and policyname='familia_miembro') as rls,
--   (select count(*) from pg_trigger where tgname='tope_gracias' and not tgisinternal) as tope_dia,
--   (select count(*) from pg_trigger where tgname='tope_reconocimientos' and not tgisinternal) as tope_filas,
--   (select count(*) from information_schema.role_table_grants
--     where table_name='reconocimientos' and grantee='anon' and privilege_type='SELECT') as grant_anon,
--   (select count(*) from pg_indexes
--     where schemaname='public' and indexname='idx_reconocimientos_para') as indice;
--
-- Y que las reglas MUERDEN (espera cuatro rechazos; no deja nada):
--
-- do $v$
-- declare fam uuid; a uuid; b uuid; hoy date := current_date;
-- begin
--   select id into fam from public.families limit 1;
--   select id into a from public.profiles where family_id = fam limit 1;
--   select id into b from public.profiles where family_id = fam and id <> a limit 1;
--
--   begin  -- a uno mismo
--     insert into public.reconocimientos (family_id, de_profile, a_profile, texto, dia)
--       values (fam, a, a, 'ZZ prueba', hoy);
--     raise exception 'MAL: acepto un gracias a uno mismo';
--   exception when check_violation then null;
--   end;
--
--   begin  -- gracias sin frase
--     insert into public.reconocimientos (family_id, de_profile, a_profile, tipo, dia)
--       values (fam, a, b, 'gracias', hoy);
--     raise exception 'MAL: acepto un gracias mudo';
--   exception when check_violation then null;
--   end;
--
--   begin  -- gesto CON frase
--     insert into public.reconocimientos (family_id, de_profile, a_profile, tipo, texto, dia)
--       values (fam, a, b, 'gesto', 'ZZ prueba', hoy);
--     raise exception 'MAL: acepto un gesto con texto';
--   exception when check_violation then null;
--   end;
--
--   begin  -- el cuarto del día
--     insert into public.reconocimientos (family_id, de_profile, a_profile, texto, dia)
--       select fam, a, b, 'ZZ prueba ' || g, hoy from generate_series(1,4) g;
--     raise exception 'MAL: acepto el cuarto gracias del día';
--   exception when raise_exception then
--     if position('tope_de_gracias' in sqlerrm) = 0 then raise; end if;
--   end;
--
--   delete from public.reconocimientos where texto like 'ZZ prueba%';
-- end $v$;
--
-- select count(*) as debe_ser_cero from public.reconocimientos where texto like 'ZZ prueba%';
--
-- Y desde fuera, sin sesión (los dos como siempre):
--   reconocimientos?select=id&limit=1   → 200 y []  (RLS aguanta)
--   reconocimientos?select=inventada    → 400        (la tabla existe)
