-- Migracion 061 · en Equipo no se mide a nadie.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- ------------------------------------------------------------------
-- DE DONDE SALE ESTO
--
-- La respuesta juridica del 31-ago (`specs/el-gremio-respuesta-legal.md` §2)
-- pone como criterio de salida del tipo Equipo, entre otras cosas:
--
--   "una prueba de que las APIs **tambien** bloquean toda metrica individual"
--
-- El "tambien" es la palabra importante. La plantilla de Equipo declara
-- `progreso_individual = false` desde la 053... y **no lo lee nadie**. Es una
-- casilla en una tabla: describe una intencion y no impide nada.
--
-- Un gremio de Equipo hoy no puede existir --`se_ofrece` es false y
-- `crear_gremio_con_llave` lo rechaza-- asi que esto es puramente preventivo.
-- Y por eso mismo hay que hacerlo AHORA: el dia que se encienda Equipo,
-- nadie va a repasar las quince funciones que tocan XP y monedas.
--
-- ------------------------------------------------------------------
-- POR QUE DISPARADORES Y NO UN `if` EN CADA FUNCION
--
-- Porque el criterio dice **las APIs**, no "las funciones". PostgREST expone
-- las tablas: una politica que solo viviera dentro de las RPC dejaria la
-- puerta de al lado abierta, y con RLS por gremio un miembro de Equipo podria
-- escribir su propia fila de `completions` sin pasar por ninguna funcion.
--
-- Un disparador por tabla lo cierra a la vez para la API, para las RPC y para
-- el SQL Editor. Es la misma decision que la 043 tomo con el libro de las
-- monedas: si la garantia depende de que quince sitios se acuerden, no es una
-- garantia.
--
-- ------------------------------------------------------------------
-- QUE SE BLOQUEA
--
-- Lo que la respuesta enumera: tareas asignadas a una persona, historial por
-- persona, tiempo, rachas, ranking, exportacion, analitica individual,
-- salario, descuentos, bonus, sanciones o evaluaciones. En este esquema eso
-- son siete tablas y tres columnas de `profiles`.
--
-- Lo que NO se bloquea, y es a proposito: los `insert` de `profiles` en si
-- --un gremio de Equipo tiene personajes, solo que no puntuan-- ni
-- `family_goals`, que es progreso COLECTIVO y es lo unico que Equipo si
-- tiene (`R-113`).
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · LA PREGUNTA, EN UN SITIO
--
-- Devuelve `true` cuando no se sabe: un gremio sin plantilla es de los de
-- antes de la 053, y esos miden como siempre. Negar por defecto aqui apagaria
-- la economia de una casa real por una fila que falta.
-- ------------------------------------------------------------------

create or replace function public.mide_a_las_personas(p_family uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select t.progreso_individual
       from public.families f
       join public.plantillas_tipo t
         on t.tipo = f.tipo_plantilla and t.version = f.plantilla_version
      where f.id = p_family),
    true
  );
$fn$;

revoke all on function public.mide_a_las_personas(uuid) from public;
revoke all on function public.mide_a_las_personas(uuid) from anon;
grant execute on function public.mide_a_las_personas(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 2 · EL DISPARADOR
-- ------------------------------------------------------------------

create or replace function public.tg_sin_progreso_individual()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.mide_a_las_personas(new.family_id) then
    raise exception 'en este tipo de gremio no hay progreso individual (R-110, R-114)'
      using errcode = 'restrict_violation';
  end if;
  return new;
end $fn$;

revoke all on function public.tg_sin_progreso_individual() from anon;
revoke all on function public.tg_sin_progreso_individual() from authenticated;

-- Las siete tablas que guardan algo de UNA persona. En un bucle y no a mano
-- para que anadir la octava sea una linea, y para que el test pueda comparar
-- esta lista con los disparadores que existen de verdad.
do $$
declare t text;
begin
  foreach t in array array[
    'completions',        -- historial por persona
    'bonuses',            -- bonus, premios a mano
    'profile_badges',     -- insignias
    'reconocimientos',    -- evaluaciones entre personas
    'redemptions',        -- tienda: R-112 dice que Equipo no tiene
    'movimientos_coins',  -- la economia individual entera
    'power_uses'          -- poderes gastados por una persona
  ]
  loop
    execute format('drop trigger if exists sin_progreso_individual on public.%I', t);
    execute format(
      'create trigger sin_progreso_individual before insert on public.%I
         for each row execute function public.tg_sin_progreso_individual()', t);
  end loop;
end $$;

-- Y las tres columnas de `profiles` que SON la metrica individual. Aqui no
-- vale bloquear el `insert`: un gremio de Equipo tiene personajes, solo que no
-- puntuan. Lo que se bloquea es que suban.
create or replace function public.tg_sin_puntuacion_individual()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if public.mide_a_las_personas(new.family_id) then
    return new;
  end if;
  if new.xp is distinct from old.xp
     or new.xp_maxima is distinct from old.xp_maxima
     or new.coins is distinct from old.coins then
    raise exception 'en este tipo de gremio no hay XP ni monedas por persona (R-110)'
      using errcode = 'restrict_violation';
  end if;
  return new;
end $fn$;

revoke all on function public.tg_sin_puntuacion_individual() from anon;
revoke all on function public.tg_sin_puntuacion_individual() from authenticated;

drop trigger if exists profiles_sin_puntuacion on public.profiles;
create trigger profiles_sin_puntuacion
  before update of xp, xp_maxima, coins on public.profiles
  for each row execute function public.tg_sin_puntuacion_individual();

-- Y el barrido de la 021, corregido por la 046.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public', f.firma);
    execute format('revoke all on function %s from anon', f.firma);
  end loop;
end $$;

-- ------------------------------------------------------------------
-- COMPROBACION
--
--   select tipo, progreso_individual from public.plantillas_tipo order by tipo;
--   -- equipo: false. Los demas: true.
--
--   select count(*) from pg_trigger
--    where tgname = 'sin_progreso_individual' and not tgisinternal;
--   -- 7
--
-- Y el ensayo: crear un gremio de tipo 'equipo' a mano, intentar meterle una
-- `completion` y comprobar que la rechaza. Se deshace al terminar.
-- ------------------------------------------------------------------
