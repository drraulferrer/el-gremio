-- ------------------------------------------------------------------
-- Migración 030 · Sellos que se repiten por temporada
--
-- `profile_badges` tiene `unique (profile_id, code)`, y esa línea es la
-- que impide que existan dos de los sellos del catálogo:
--
--   · «Sello de la temporada»    → uno por cada meta que el gremio cierra
--   · «Formé parte de esta obra» → uno por cada temporada en la que
--                                  alguien aportó algo
--
-- Los dos son repetibles POR DISEÑO. Una familia que cierra su quinta
-- meta no vuelve a ganar el mismo sello: gana el de la temporada 5, con
-- su número y su fecha, y el de la 1 se queda donde está. Con la
-- restricción actual, el segundo choca contra el primero y se pierde en
-- silencio.
--
-- La solución es una clave de instancia. `instance_key` vacío significa
-- «este sello es único en la vida», que es como se comportan los 16
-- viejos y los 66 del catálogo que no son de temporada. Poniendo el
-- `goal_id` dentro, la misma persona puede tener el sello tantas veces
-- como temporadas haya vivido.
--
-- Ojo con lo de siempre: pegar esto en el SQL Editor desde el navegador
-- destroza los acentos. Se trae el fichero desde el repo con la consola
-- del editor y se coteja el SHA-256 antes de pulsar Run (ver §2 del
-- arranque).
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1. La clave de instancia
--
-- Cadena vacía y no NULL a propósito: en Postgres, `unique` con NULL
-- deja pasar duplicados, porque NULL no es igual a NULL. Con NULL, la
-- restricción de abajo NO protegería precisamente el caso de siempre
-- —los sellos de una sola vez— que es el que más importa.
-- ------------------------------------------------------------------

alter table public.profile_badges
  add column if not exists instance_key text not null default '';

-- ------------------------------------------------------------------
-- 2. El contexto del logro
--
-- Hasta ahora una fila decía «tienes esta insignia» y nada más. Sin
-- número de temporada, la vitrina no puede distinguir el sello de la
-- temporada 2 del de la 5, y sin `earned_context` una concesión
-- retroactiva no se puede contar como lo que fue.
-- ------------------------------------------------------------------

alter table public.profile_badges
  add column if not exists season_number integer check (season_number is null or season_number >= 1),
  add column if not exists earned_context text
    check (earned_context is null or earned_context in ('directo','retroactivo','legado'));

-- ------------------------------------------------------------------
-- 3. La restricción nueva
--
-- Se sustituye `(profile_id, code)` por `(profile_id, code, instance_key)`.
-- Con `instance_key = ''` el comportamiento es EXACTAMENTE el de antes,
-- así que nada de lo ya concedido cambia ni se duplica.
--
-- El índice parcial de las tres únicas por gremio (migración 015) no se
-- toca: `primer_nivel10`, `mano_derecha` y `coleccionista` siguen siendo
-- de una sola persona, y ninguna de ellas es de temporada.
-- ------------------------------------------------------------------

do $$
declare nombre text;
begin
  select con.conname into nombre
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
   where ns.nspname = 'public' and rel.relname = 'profile_badges'
     and con.contype = 'u'
     and pg_get_constraintdef(con.oid) ilike '%profile_id%code%'
     and pg_get_constraintdef(con.oid) not ilike '%instance_key%';
  if nombre is not null then
    execute format('alter table public.profile_badges drop constraint %I', nombre);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public' and rel.relname = 'profile_badges'
       and con.conname = 'profile_badges_perfil_code_instancia'
  ) then
    alter table public.profile_badges
      add constraint profile_badges_perfil_code_instancia
      unique (profile_id, code, instance_key);
  end if;
end $$;

-- ------------------------------------------------------------------
-- 4. El número de temporada de cada meta
--
-- La temporada se venía DERIVANDO de cuántas metas cerradas había. Eso
-- funciona mientras nadie reabra ni corrija nada, y deja de funcionar en
-- cuanto pasa. Un sello que dice «temporada 3» tiene que seguir diciendo
-- 3 dentro de cinco años, así que el número se guarda.
-- ------------------------------------------------------------------

alter table public.family_goals
  add column if not exists season_number integer check (season_number is null or season_number >= 1);

-- Backfill por orden de inicio, que es el orden en que se vivieron.
with numeradas as (
  select id,
         row_number() over (partition by family_id order by starts_at, id) as n
    from public.family_goals
)
update public.family_goals g
   set season_number = numeradas.n
  from numeradas
 where numeradas.id = g.id
   and g.season_number is null;

create unique index if not exists idx_family_goals_temporada
  on public.family_goals (family_id, season_number)
  where season_number is not null;
