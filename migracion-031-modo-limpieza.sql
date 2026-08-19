-- ============================================================
-- Migración 031 · Modo limpieza: campañas acotadas de limpieza
--
-- Qué añade:
--   1. Tabla `campanas_limpieza`: una "operación" que lanza UN ADULTO
--      desde el panel (relámpago / zona de la semana / estancia a
--      fondo), con fechas, estado y quién la activó.
--   2. `challenges.campana_id`: el enganche de una misión a su campaña.
--      Las misiones de campaña son challenges normales (frequency
--      'unico', skill 'hogar'): completar y validar pasan por el mismo
--      camino auditado de siempre.
--   3. `crear_campana_limpieza`: crea campaña y misiones EN LA MISMA
--      transacción, y garantiza en la base las dos reglas del modo:
--      solo adultos, y una campaña activa por gremio.
--   4. `cerrar_campana_limpieza`: decide el desenlace (botín si está
--      completa, expiración si venció, nada si aún está en plazo) y
--      paga el botín por `bonuses` con tipo 'limpieza:<id>'.
--
-- No depende de las migraciones 028-030: solo toca families, profiles,
-- challenges, completions y bonuses, que existen desde la 014.
--
-- Idempotente: se puede ejecutar dos veces sin daño.
-- ============================================================

-- 1. La tabla ------------------------------------------------------

create table if not exists public.campanas_limpieza (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  tipo text not null check (tipo in ('blitz','zona','profunda')),
  -- La clave del catálogo ('zona_cocina', 'blitz_30'…). Informativa: si
  -- el catálogo cambia, la campaña guardada no cambia con él.
  clave text not null check (length(clave) between 1 and 80),
  titulo text not null check (length(titulo) between 3 and 120),
  emoji text not null default '🧹',
  empieza date not null,
  -- Inclusive: el día de fin todavía cuenta.
  termina date not null,
  estado text not null default 'activa' check (estado in ('activa','completada','expirada')),
  activada_por uuid references public.profiles(id) on delete set null,
  cerrada_at timestamptz,
  created_at timestamptz not null default now(),
  constraint campanas_fechas_coherentes check (termina >= empieza and termina <= empieza + 30)
);

create index if not exists idx_campanas_family on public.campanas_limpieza (family_id, created_at desc);

-- 2. El enganche en challenges --------------------------------------
-- `restrict`: una campaña con misiones no se borra, igual que una
-- misión con historial (029). null = misión normal, que es lo que son
-- todas las que ya existen: cero backfill.

alter table public.challenges
  add column if not exists campana_id uuid references public.campanas_limpieza(id) on delete restrict;

create index if not exists idx_challenges_campana on public.challenges (campana_id) where campana_id is not null;

-- 3. RLS, tope de filas y realtime ----------------------------------

alter table public.campanas_limpieza enable row level security;

drop policy if exists familia_miembro on public.campanas_limpieza;
create policy familia_miembro on public.campanas_limpieza
  for all to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()))
  with check (family_id in (select id from public.families where owner = auth.uid()));

drop trigger if exists tope_campanas on public.campanas_limpieza;
create trigger tope_campanas before insert on public.campanas_limpieza
  for each row execute function public.tg_tope_filas('60');

do $$ begin alter publication supabase_realtime add table public.campanas_limpieza; exception when duplicate_object then null; end $$;

-- 4. Lanzar ----------------------------------------------------------
-- `p_tareas` es un array JSON de { profile_id, title, emoji, xp, coins }
-- con los puntos ya calculados por src/lib/limpieza.js; aquí solo se
-- comprueba que estén dentro de los topes de cordura, porque un tope
-- que solo vive en el cliente no es un tope.

create or replace function public.crear_campana_limpieza(
  p_activada_por uuid,
  p_tipo text,
  p_clave text,
  p_titulo text,
  p_emoji text,
  p_dias integer,
  p_tareas jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_rol text;
  v_tz text;
  v_hoy date;
  v_campana uuid;
  t jsonb;
  v_perfil uuid;
  v_xp integer;
  v_coins integer;
  v_title text;
  v_familia_perfil uuid;
  v_rol_perfil text;
  v_activo boolean;
begin
  select family_id, role into v_family, v_rol
    from public.profiles where id = p_activada_por and active;
  if v_family is null then return 'quien_no_existe'; end if;

  if not exists (
    select 1 from public.families f where f.id = v_family and f.owner = auth.uid()
  ) then
    return 'no_es_tuyo';
  end if;

  if v_rol <> 'adulto' then return 'no_es_adulto'; end if;

  if p_tipo is null or p_tipo not in ('blitz','zona','profunda') then return 'tipo_invalido'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 30 then return 'duracion_invalida'; end if;
  if p_titulo is null or length(btrim(p_titulo)) < 3 or length(p_titulo) > 120 then return 'titulo_invalido'; end if;
  if p_tareas is null or jsonb_typeof(p_tareas) <> 'array'
     or jsonb_array_length(p_tareas) < 1 or jsonb_array_length(p_tareas) > 40 then
    return 'sin_tareas';
  end if;

  -- Una operación cada vez: dos campañas solapadas dejan de ser un
  -- acontecimiento y pasan a ser el tablón de siempre con otro nombre.
  if exists (
    select 1 from public.campanas_limpieza c where c.family_id = v_family and c.estado = 'activa'
  ) then
    return 'ya_hay_activa';
  end if;

  -- Se valida TODO antes de escribir NADA: o entra la campaña entera o
  -- no entra ninguna fila. El `exception` caza un profile_id que no sea
  -- ni siquiera un uuid.
  begin
    for t in select * from jsonb_array_elements(p_tareas) loop
      v_perfil := (t->>'profile_id')::uuid;
      v_xp := (t->>'xp')::integer;
      v_coins := (t->>'coins')::integer;
      v_title := t->>'title';

      if v_title is null or length(btrim(v_title)) < 3 or length(v_title) > 120 then return 'tarea_invalida'; end if;
      -- Topes de cordura contra el dedo gordo, no antifraude.
      if v_xp is null or v_xp < 1 or v_xp > 60 then return 'tarea_invalida'; end if;
      if v_coins is null or v_coins < 1 or v_coins > 40 then return 'tarea_invalida'; end if;

      select family_id, role, active into v_familia_perfil, v_rol_perfil, v_activo
        from public.profiles where id = v_perfil;
      if v_familia_perfil is distinct from v_family or not coalesce(v_activo, false)
         or v_rol_perfil = 'mascota' then
        return 'tarea_invalida';
      end if;
    end loop;
  exception when invalid_text_representation then
    return 'tarea_invalida';
  end;

  select timezone into v_tz from public.families where id = v_family;
  v_hoy := (now() at time zone coalesce(v_tz, 'Europe/Madrid'))::date;

  insert into public.campanas_limpieza (family_id, tipo, clave, titulo, emoji, empieza, termina, activada_por)
  values (v_family, p_tipo, left(coalesce(nullif(btrim(p_clave), ''), p_tipo), 80), btrim(p_titulo),
          coalesce(nullif(p_emoji, ''), '🧹'), v_hoy, v_hoy + (p_dias - 1), p_activada_por)
  returning id into v_campana;

  for t in select * from jsonb_array_elements(p_tareas) loop
    insert into public.challenges (family_id, profile_id, title, emoji, xp, coins, frequency, skill, campana_id)
    values (v_family, (t->>'profile_id')::uuid, btrim(t->>'title'),
            coalesce(nullif(t->>'emoji', ''), '🧹'),
            (t->>'xp')::integer, (t->>'coins')::integer, 'unico', 'hogar', v_campana);
  end loop;

  return 'ok';
end $fn$;

revoke all on function public.crear_campana_limpieza(uuid, text, text, text, text, integer, jsonb) from public;
grant execute on function public.crear_campana_limpieza(uuid, text, text, text, text, integer, jsonb) to authenticated;

-- 5. Cerrar ----------------------------------------------------------
-- El desenlace lo decide la base, no el botón: 'ok' con botín si está
-- completa, 'expirada' si venció sin completarse (pausa lo no hecho),
-- 'aun_no' si sigue en plazo. El botín es la mitad de lo ganado por
-- cada participante, hacia abajo, la MISMA cuenta que botinPrevisto en
-- src/lib/limpieza.js. Solo monedas, nada de XP: la regla del premio a
-- mano, y por lo mismo.

create or replace function public.cerrar_campana_limpieza(p_campana uuid, p_quien uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_estado text;
  v_titulo text;
  v_termina date;
  v_rol text;
  v_family_quien uuid;
  v_tz text;
  v_hoy date;
  v_total integer;
  v_hechas integer;
  r record;
begin
  select family_id, estado, titulo, termina into v_family, v_estado, v_titulo, v_termina
    from public.campanas_limpieza where id = p_campana;
  if v_family is null then return 'no_existe'; end if;

  if not exists (
    select 1 from public.families f where f.id = v_family and f.owner = auth.uid()
  ) then
    return 'no_es_tuyo';
  end if;

  select role, family_id into v_rol, v_family_quien
    from public.profiles where id = p_quien and active;
  if v_rol is null or v_family_quien is distinct from v_family then return 'quien_no_existe'; end if;
  if v_rol <> 'adulto' then return 'no_es_adulto'; end if;

  if v_estado <> 'activa' then return 'ya_cerrada'; end if;

  select timezone into v_tz from public.families where id = v_family;
  v_hoy := (now() at time zone coalesce(v_tz, 'Europe/Madrid'))::date;

  select count(*),
         count(*) filter (where exists (
           select 1 from public.completions co
            where co.challenge_id = ch.id and co.status = 'aprobado'))
    into v_total, v_hechas
    from public.challenges ch
   where ch.campana_id = p_campana;

  if v_total > 0 and v_hechas = v_total then
    for r in
      select co.profile_id, floor(sum(co.coins) / 2.0)::integer as botin
        from public.completions co
        join public.challenges ch on ch.id = co.challenge_id
       where ch.campana_id = p_campana and co.status = 'aprobado'
       group by co.profile_id
    loop
      if r.botin > 0 then
        insert into public.bonuses (family_id, profile_id, tipo, coins, motivo, otorgado_por, dia)
        values (v_family, r.profile_id, 'limpieza:' || p_campana::text, r.botin,
                'Botín de «' || v_titulo || '»', p_quien, v_hoy);
        update public.profiles set coins = coins + r.botin where id = r.profile_id;
      end if;
    end loop;

    update public.campanas_limpieza set estado = 'completada', cerrada_at = now() where id = p_campana;
    return 'ok';
  end if;

  if v_hoy > v_termina then
    -- Lo no hecho se pausa, no se borra: pausada vuelve a la biblioteca
    -- del panel, y borrarla con historial ni siquiera dejaría (029).
    update public.challenges ch set active = false
     where ch.campana_id = p_campana
       and not exists (
         select 1 from public.completions co
          where co.challenge_id = ch.id and co.status = 'aprobado'
       );
    update public.campanas_limpieza set estado = 'expirada', cerrada_at = now() where id = p_campana;
    return 'expirada';
  end if;

  return 'aun_no';
end $fn$;

revoke all on function public.cerrar_campana_limpieza(uuid, uuid) from public;
grant execute on function public.cerrar_campana_limpieza(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------
-- COMPROBACIÓN (pégala entera después de ejecutar; los seis a 1)
-- ------------------------------------------------------------------
-- select
--   (select count(*) from information_schema.tables
--     where table_schema='public' and table_name='campanas_limpieza') as tabla,
--   (select count(*) from information_schema.columns
--     where table_schema='public' and table_name='challenges' and column_name='campana_id') as enganche,
--   (select count(*) from pg_policies
--     where schemaname='public' and tablename='campanas_limpieza' and policyname='familia_miembro') as rls,
--   (select count(*) from pg_trigger
--     where tgname='tope_campanas' and not tgisinternal) as tope,
--   (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and p.proname='crear_campana_limpieza') as crear,
--   (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and p.proname='cerrar_campana_limpieza') as cerrar;
--
-- Y que las reglas MUERDEN de verdad. No escribe nada que se quede:
-- espera dos rechazos (23514) y los deshace pase lo que pase:
--
-- do $v$
-- declare fam uuid;
-- begin
--   select id into fam from public.families limit 1;
--   begin
--     insert into public.campanas_limpieza (family_id, tipo, clave, titulo, empieza, termina)
--     values (fam, 'inventado', 'zz', 'ZZ prueba', current_date, current_date);
--     raise exception 'MAL: acepto un tipo inventado';
--   exception when check_violation then null;
--   end;
--   begin
--     insert into public.campanas_limpieza (family_id, tipo, clave, titulo, empieza, termina)
--     values (fam, 'blitz', 'zz', 'ZZ prueba', current_date, current_date - 1);
--     raise exception 'MAL: acepto una campaña que termina antes de empezar';
--   exception when check_violation then null;
--   end;
-- end $v$;
--
-- Y desde fuera, sin sesión (los dos como siempre):
--   campanas_limpieza?select=id&limit=1  → 200 y []  (RLS aguanta)
--   campanas_limpieza?select=inventada   → 400        (la tabla existe)
