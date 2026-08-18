-- ------------------------------------------------------------------
-- Migración 027 · Perfiles de mascota (perro o gato)
--
-- La spec completa, con la literatura que justifica cada decisión, está
-- en `docs/MASCOTAS.md`. Aquí solo el esquema. Lo que hay que saber para
-- entender lo que viene:
--
-- UNA MASCOTA NO ES UN JUGADOR. No pulsa «¡Hecho!», no elige perfil, no
-- gasta monedas y no recibe avisos. Es un SUJETO CON MARCADOR: tiene
-- nivel y monedas propios —que miden SU progreso de adiestramiento— y las
-- misiones las registra un adulto en su nombre. Casi todo lo raro de esta
-- migración sale de ahí.
--
-- Y el XP de sus misiones va SOLO a la mascota: quien cepilla al perro no
-- se lleva nada. Es una decisión tomada a conciencia (§2.1 de la spec):
-- se compra que la economía de las personas no se toque, y se paga que el
-- trabajo real no puntúe a quien lo hace.
--
-- Ojo con lo de siempre: pegar esto en el SQL Editor desde el navegador
-- destroza los acentos. Se trae el fichero desde el repo con la consola
-- del editor y se coteja el SHA-256 antes de pulsar Run (ver §2 del
-- arranque).
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1. El rol nuevo
--
-- La restricción se recrea entera porque `check` no se puede ampliar.
-- Buscar el nombre real en vez de suponerlo: si la tabla se creó con
-- nombre automático, es `profiles_role_check`, pero no está garantizado.
-- ------------------------------------------------------------------

do $$
declare nombre text;
begin
  select con.conname into nombre
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
   where ns.nspname = 'public' and rel.relname = 'profiles'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%role%adulto%';
  if nombre is not null then
    execute format('alter table public.profiles drop constraint %I', nombre);
  end if;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('adulto','junior','peque','mascota'));

-- ------------------------------------------------------------------
-- 2. La especie
--
-- Solo perro o gato: son las dos para las que hay catálogo con
-- fundamento, y ofrecer «otro» sería prometer misiones que nadie ha
-- justificado. La restricción de coherencia es la que impide los dos
-- estados absurdos: una persona con especie, y una mascota sin ella.
-- ------------------------------------------------------------------

alter table public.profiles
  add column if not exists species text;

-- Se tira y se rehace SIEMPRE, en vez de crearla solo si falta: la
-- primera versión de esta restricción era incorrecta y se llegó a
-- ejecutar. Con un `if not exists` volver a pasar la migración no la
-- habría arreglado, que es justo lo que uno espera de una migración
-- idempotente.
alter table public.profiles drop constraint if exists profiles_especie_coherente;

-- La forma `case` no es estilo: es lo único que funciona. La versión
-- obvia —`(role='mascota' and species in (...)) or (role<>'mascota' and
-- species is null)`— **acepta una mascota sin especie**, y costó
-- descubrirlo el mismo día que se ejecutó la 027. Con `species` nulo esa
-- expresión da `TRUE and NULL` = NULL en la primera rama y FALSE en la
-- segunda, o sea `NULL or FALSE` = NULL. Y **un CHECK que da NULL PASA**:
-- solo rechaza cuando da FALSE. La lógica de tres valores de SQL vuelve a
-- morder justo donde uno cree que ha cubierto los dos casos.
alter table public.profiles
  add constraint profiles_especie_coherente
  check (
    case
      when role = 'mascota' then species is not null and species in ('perro','gato')
      else species is null
    end
  );

comment on column public.profiles.species is
  'perro|gato cuando role = mascota; null en las personas. Ver docs/MASCOTAS.md';

-- ------------------------------------------------------------------
-- 3. Misiones dirigidas a la mascota
--
-- `target_roles` ya existe (migración 013). Solo hay que ampliar el
-- juego de valores admitidos.
-- ------------------------------------------------------------------

do $$
declare nombre text;
begin
  select con.conname into nombre
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
   where ns.nspname = 'public' and rel.relname = 'challenges'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%target_roles%';
  if nombre is not null then
    execute format('alter table public.challenges drop constraint %I', nombre);
  end if;
end $$;

alter table public.challenges
  add constraint challenges_target_roles_check
  check (
    target_roles is null
    or (cardinality(target_roles) > 0
        and target_roles <@ array['adulto','junior','peque','mascota']::text[])
  );

-- ------------------------------------------------------------------
-- 4. Premios de mascota
--
-- Sin esto, «paseo largo de olfateo» sale en la tienda de la junior y
-- «tarde de peli» en la del perro. `null` sigue significando «premio de
-- la familia», que es lo que son todos los que ya existen: la columna
-- nace sin tocar ni una fila.
-- ------------------------------------------------------------------

alter table public.rewards
  add column if not exists target_role text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'rewards_target_role_check'
       and conrelid = 'public.rewards'::regclass
  ) then
    alter table public.rewards
      add constraint rewards_target_role_check
      check (target_role is null or target_role = 'mascota');
  end if;
end $$;

comment on column public.rewards.target_role is
  'null = premio de la familia; mascota = premio para el animal';

-- ------------------------------------------------------------------
-- 5. Quién apuntó la misión
--
-- La mascota no la apunta: lo hace un adulto en su nombre. Sin esta
-- columna, el historial de un perro con tres cuidadores no distingue
-- quién estuvo cepillándolo cada día, que es justo lo que un adulto
-- querrá mirar cuando sospeche que el trabajo lo hace siempre el mismo.
--
-- Se deja NULLABLE a propósito: todas las filas anteriores son de
-- personas que se apuntaron sus propias misiones, y rellenarlas con
-- `profile_id` sería inventarse un dato que nadie registró.
-- ------------------------------------------------------------------

alter table public.completions
  add column if not exists registrado_por uuid references public.profiles(id) on delete set null;

comment on column public.completions.registrado_por is
  'Quién apuntó la misión cuando no la apunta su propio perfil (mascotas)';

-- ------------------------------------------------------------------
-- 6. Las mascotas fuera de los avisos
--
-- Un perro no tiene móvil. La vista se recrea entera —no se puede
-- alterar un `where` suelto— cambiando solo esa línea.
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
         not exists (
           select 1 from public.plan_diario pl
            where pl.family_id = p.family_id and pl.dia = h.dia + 1
         ) as sin_plan_manana
    from public.profiles p
    join public.families f on f.id = p.family_id
    join hoy h on h.family_id = p.family_id
   where p.active
     -- La peque no recibe notificaciones: a los tres años el teléfono no
     -- es suyo, y avisar al aparato compartido por ella sería avisar a un
     -- adulto de algo que no puede hacer. Y una mascota, por razones que
     -- no hace falta explicar.
     and p.role not in ('peque','mascota')
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
-- COMPROBACIÓN (pégala entera después de ejecutar; los cinco a 1)
-- ------------------------------------------------------------------
-- select
--   (select count(*) from pg_constraint
--     where conname = 'profiles_role_check'
--       and pg_get_constraintdef(oid) ilike '%mascota%') as rol,
--   (select count(*) from information_schema.columns
--     where table_schema='public' and table_name='profiles' and column_name='species') as especie,
--   (select count(*) from pg_constraint
--     where conname = 'profiles_especie_coherente') as coherencia,
--   (select count(*) from information_schema.columns
--     where table_schema='public' and table_name='rewards' and column_name='target_role') as premios,
--   (select count(*) from information_schema.columns
--     where table_schema='public' and table_name='completions' and column_name='registrado_por') as registrado;
--
-- Y que la coherencia de especie MUERDE de verdad. Toca dos filas y las
-- deshace pase lo que pase; espera dos rechazos (23514):
--
-- do $v$
-- declare fam uuid;
-- begin
--   select id into fam from public.families limit 1;
--   begin
--     insert into public.profiles (family_id, name, role, species)
--     values (fam, 'ZZ prueba', 'junior', 'perro');
--     raise exception 'MAL: acepto una persona con especie';
--   exception when check_violation then null;
--   end;
--   begin
--     insert into public.profiles (family_id, name, role)
--     values (fam, 'ZZ prueba', 'mascota');
--     raise exception 'MAL: acepto una mascota sin especie';
--   exception when check_violation then null;
--   end;
-- end $v$;
--
-- Y que una mascota NO entra en los avisos (espera 0):
-- select count(*) from public.push_pendientes where role = 'mascota';
