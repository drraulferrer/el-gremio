-- ------------------------------------------------------------------
-- Migración 024 · Planificar las misiones por días de la semana
--
-- Lo pidió la familia: las misiones de la junior y de la peque son las
-- mismas todos los días, y hace falta poder repartirlas —días alternos,
-- lunes y jueves, lo que sea—.
--
-- LA DECISIÓN QUE SOSTIENE TODO ESTO: se planifica por DÍA DE LA SEMANA
-- y no por «semana que empieza hoy». Es la respuesta a «una semana puede
-- empezar cualquier día», y la respuesta es que entonces no hay que
-- modelar semanas. Un patrón de siete casillas NO TIENE fecha de inicio:
-- se repite solo, y empezar a usarlo un jueves no produce ninguna semana
-- parcial que haya que normalizar. El problema desaparece por
-- construcción en vez de resolverse.
--
-- Por eso no hay «cada N días»: ese sí necesitaría una fecha ancla por
-- misión, y con ancla vuelve entero el problema que el patrón semanal no
-- tiene.
--
-- Y LA SEGUNDA, que es la que impide que esto rompa otra cosa: un día sin
-- misiones asignadas es NEUTRO para la racha. Ni la rompe ni la alarga.
-- Sin eso, a quien le tocan lunes, miércoles y viernes el martes no tiene
-- nada que hacer y hoy eso le rompería la racha, o sea que la
-- funcionalidad nueva se llevaría por delante el sistema de rachas
-- entero. Por eso las dos cosas van en la misma migración.
--
-- Ojo con lo de siempre: pegar esto en el SQL Editor desde el navegador
-- destroza los acentos. Se copia pre-codificado en MacRoman:
--
--   python3 -c "import subprocess;s=open('migracion-024-dias-de-la-semana.sql',encoding='utf-8').read();subprocess.run(['pbcopy'],input=s.encode('mac_roman'))"
--
-- Y si sale el diálogo «Potential issue detected · destructive
-- operations», hay que pulsar «Run query» y esperar el «Success». Cerrarlo
-- no ejecuta nada y tampoco avisa de que no lo ha hecho.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1. La columna
--
-- 1 = lunes … 7 = domingo, el mismo número que devuelve `isodow`, que es
-- quien lo decide de este lado. `null` = todos los días, que es lo que
-- hacen hoy las 119 misiones que ya existen: nadie nota nada hasta que
-- alguien marque casillas.
--
-- El `check` prohíbe el array vacío a propósito. `{}` significaría «no
-- toca ningún día»: una misión activa que no sale nunca en ningún
-- tablero y que nadie sabría por qué no sale.
-- ------------------------------------------------------------------

alter table public.challenges
  add column if not exists days smallint[];

do $$
begin
  alter table public.challenges
    add constraint challenges_days_validos
    check (
      days is null
      or (cardinality(days) between 1 and 7
          and days <@ array[1,2,3,4,5,6,7]::smallint[])
    );
exception when duplicate_object then
  null;
end $$;

comment on column public.challenges.days is
  'Días de la semana en los que toca (1=lunes … 7=domingo). null = todos.';

-- ------------------------------------------------------------------
-- 2. ¿Tenía esta persona algo que hacer ese día?
--
-- El predicado de a quién le toca una misión vive en
-- src/lib/misiones.js y este es su espejo, que hacía falta porque la
-- racha se certifica en la base y no en el cliente. Es el único sitio de
-- Postgres donde se copia esa regla; si algún día cambia, cambia aquí.
--
-- Se mira el patrón de HOY y no el que hubiera entonces: la columna no
-- guarda historia y no va a guardarla. Reconstruir «qué días le tocaban
-- en marzo» pediría versionar la tabla entera para afinar un número que
-- ya es una aproximación amable.
--
-- La cautela importante está en la primera mitad del `and`: si no tiene
-- NINGUNA misión activa, ningún día es neutro. Sin ese corte, un perfil
-- recién creado tendría los 400 días neutros y su racha caminaría hacia
-- atrás hasta el tope sin que hubiera hecho nada.
-- ------------------------------------------------------------------

create or replace function public.sin_mision_ese_dia(p_id uuid, p_dia date)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  with yo as (
    select id, family_id, role from public.profiles where id = p_id and active
  ),
  mias as (
    select c.days
      from public.challenges c
      join yo on c.family_id = yo.family_id
     where c.active
       and (
         c.profile_id = yo.id
         or (c.profile_id is null and c.target_roles is null)
         or (c.profile_id is null and yo.role = any(c.target_roles))
       )
  )
  select exists (select 1 from mias)
     and not exists (
       select 1 from mias
        where days is null
           or extract(isodow from p_dia)::smallint = any(days)
     );
$fn$;

revoke all on function public.sin_mision_ese_dia(uuid, date) from public;
revoke all on function public.sin_mision_ese_dia(uuid, date) from anon;
grant execute on function public.sin_mision_ese_dia(uuid, date) to authenticated;

-- ------------------------------------------------------------------
-- 3. La racha, contando días CUMPLIDOS
--
-- Cambia una sola cosa respecto a la 019: un día sin nada hecho ya no
-- corta si además era un día sin misiones. Se atraviesa y se sigue
-- contando desde antes.
--
-- Un día neutro NO cuenta como día hecho. Es la diferencia con el
-- comodín, y no es un matiz: si contara, a quien solo tuviera misiones
-- los lunes le sumarían los otros seis días y llegaría a los cien días
-- sin haber hecho nada. Por eso el bucle lleva dos cuentas —la racha y
-- los pasos— y el tope de 400 es de los pasos.
-- ------------------------------------------------------------------

create or replace function public.streak_days(p_id uuid, p_tz text default 'Europe/Madrid')
returns integer
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_racha integer := 0;
  v_pasos integer := 0;
  v_hoy date := (now() at time zone p_tz)::date;
  v_dia date := (now() at time zone p_tz)::date;
  v_hay boolean;
begin
  loop
    exit when v_pasos >= 400;

    -- Un día cuenta si tiene una misión aprobada O si está tapado con un
    -- comodín, que para eso existe el comodín.
    select exists (
      select 1 from public.completions
       where profile_id = p_id and status = 'aprobado' and resolved_at is not null
         and (resolved_at at time zone p_tz)::date = v_dia
    ) or exists (
      select 1 from public.power_uses
       where profile_id = p_id and tipo = 'salva_racha'
         and (used_at at time zone p_tz)::date = v_dia
    ) into v_hay;

    if v_hay then
      v_racha := v_racha + 1;
    else
      -- Hoy sin nada no rompe: el día no ha terminado.
      -- Un día sin misiones asignadas tampoco: no había nada que hacer.
      exit when v_dia < v_hoy and not public.sin_mision_ese_dia(p_id, v_dia);
    end if;

    v_dia := v_dia - 1;
    v_pasos := v_pasos + 1;
  end loop;

  return v_racha;
end $fn$;

revoke all on function public.streak_days(uuid, text) from public;
revoke all on function public.streak_days(uuid, text) from anon;
grant execute on function public.streak_days(uuid, text) to authenticated;

-- `claim_streak` no se toca: usa `streak_days` desde la 019, que era
-- justo para esto. Si llevara su propia copia, hoy habría que acordarse
-- de las dos y el aviso diría 12 mientras el cobro pagaría por 4.

-- ------------------------------------------------------------------
-- 4. A quién se avisa: a nadie en un día sin misiones
--
-- La vista daba por hecho que todos los días son iguales. Con la
-- planificación por días eso deja de ser cierto, y avisar a la junior un
-- martes de que va a perder la racha por no hacer lo que no tiene que
-- hacer es la clase de aviso que hace que se apaguen los avisos.
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
         public.sin_mision_ese_dia(p.id, h.dia) as dia_libre
    from public.profiles p
    join public.families f on f.id = p.family_id
    join hoy h on h.family_id = p.family_id
   where p.active
     -- La peque no recibe notificaciones: a los tres años el teléfono no
     -- es suyo, y avisar al aparato compartido por ella sería avisar a un
     -- adulto de algo que no puede hacer.
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
         -- El día libre calla los dos avisos que dependen de que hoy
         -- hubiera algo que hacer. El de «sin validar» NO: quien valida
         -- es adulto y la cola de pendientes es de la casa, no suya.
         when a.dia_libre and a.role <> 'adulto' then null
         -- «Racha viva» pasa a leerse de `racha` en vez de deducirse de
         -- «ayer hizo algo». Eran lo mismo hasta hoy; con días neutros
         -- por medio, ayer puede ser un martes libre y la racha seguir
         -- entera. Una sola definición, y es la que paga los hitos.
         when not a.dia_libre and a.racha > 0 then 'racha_riesgo'
         when a.role = 'adulto' and a.por_validar > 0 then 'sin_validar'
         when a.dia_libre then null
         else 'vuelve'
       end as motivo,
       a.por_validar
  from actividad a;

grant select on public.push_pendientes to authenticated;

-- ------------------------------------------------------------------
-- COMPROBACIÓN (pégala entera después de ejecutar; los CINCO a 1)
--
-- EJECUTADA Y COMPROBADA el 16-ago-2026: los cinco dieron 1, la tabla
-- quedó con 51 misiones y CERO con patrón —o sea, nadie notó nada— y la
-- vista de avisos siguió respondiendo con `dia_libre` en false para los
-- cuatro perfiles, que es lo correcto mientras no haya patrones puestos.
-- ------------------------------------------------------------------
-- select
--   (select count(*) from information_schema.columns
--     where table_schema = 'public' and table_name = 'challenges' and column_name = 'days') as columna,
--   (select count(*) from pg_constraint where conname = 'challenges_days_validos') as restriccion,
--   (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname = 'sin_mision_ese_dia') as funcion,
--   (select count(*) from information_schema.columns
--     where table_schema = 'public' and table_name = 'push_pendientes' and column_name = 'motivo') as vista,
--   -- El quinto es el que de verdad importa: que `streak_days` sea la
--   -- NUEVA. Los otros cuatro pueden estar a 1 con la racha sin arreglar.
--   (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname = 'streak_days'
--       and pg_get_functiondef(p.oid) like '%sin_mision_ese_dia%') as racha_arreglada;
--
-- Y que el array vacío se rechace de verdad. OJO: `where false` NO sirve
-- para comprobarlo —un `check` solo se evalúa sobre las filas que se
-- tocan, así que con cero filas sale «Success» y parece que pasa—. Este
-- bloque sí toca una fila, y la deshace pase lo que pase: si la
-- restricción salta, la revierte el manejador; si no salta, la revierte
-- la excepción de la línea siguiente.
--
-- do $v$
-- begin
--   update public.challenges set days = '{}'::smallint[]
--    where id = (select id from public.challenges order by created_at limit 1);
--   raise exception 'MAL: el array vacio se acepto';
-- exception when check_violation then null;
-- end $v$;
--
-- Quién tiene patrón puesto, cuando la familia empiece a usarlo:
--
-- select title, days, frequency from public.challenges
--  where days is not null order by title;
