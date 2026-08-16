-- Migración 020 · tres cosas que solo duelen cuando la base crece.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- ⚠️ Saldrá el aviso «Potential issue detected · destructive operations»
-- por los `drop policy`. No toca ni un dato: pulsa «Run query» y espera el
-- «Success. No rows returned».
--
-- Las tres salieron de una auditoría del 16-ago contra la base real, no de
-- leer el código. Ninguna se nota con una familia y 1,3 MB dentro.

-- ------------------------------------------------------------------
-- 1. Siete claves ajenas sin índice
--
-- Postgres NO indexa solo el lado hijo de una clave ajena. Mientras nadie
-- borre nada da igual; el día que se borra una fila del padre, la base
-- tiene que recorrer la tabla hija ENTERA para encontrar a los huérfanos,
-- y con `on delete cascade` eso se encadena.
--
-- Aquí se borra más de lo que parece: retirar una misión, un premio, y
-- sobre todo **borrar una cuenta**, que es justo lo que el RGPD obliga a
-- ofrecer y lo que más filas arrastra. Con dos años de historial, ese
-- borrado pasa de instantáneo a bloquear la tabla.
--
-- Los siete salieron de esta consulta, que conviene repetir cada vez que
-- se añada una tabla:
--
--   select t.relname||'.'||a.attname from pg_constraint k
--   join pg_class t on t.oid=k.conrelid
--   join pg_namespace n on n.oid=t.relnamespace
--   join pg_attribute a on a.attrelid=t.oid and a.attnum=k.conkey[1]
--   where k.contype='f' and n.nspname='public' and array_length(k.conkey,1)=1
--     and not exists (select 1 from pg_index i
--                     where i.indrelid=t.oid and i.indkey[0]=k.conkey[1]);
-- ------------------------------------------------------------------

create index if not exists idx_app_logs_profile     on public.app_logs (profile_id);
create index if not exists idx_bonuses_otorgado_por on public.bonuses (otorgado_por);
create index if not exists idx_challenges_profile   on public.challenges (profile_id);
create index if not exists idx_completions_challenge on public.completions (challenge_id);
create index if not exists idx_power_uses_target    on public.power_uses (target_id);
create index if not exists idx_redemptions_profile  on public.redemptions (profile_id);
create index if not exists idx_redemptions_reward   on public.redemptions (reward_id);

-- ------------------------------------------------------------------
-- 2. Las dos políticas de la 019, con su rol
--
-- La 017 dejó TODAS las políticas declaradas `to authenticated`, y la 019
-- —los avisos— añadió dos nuevas sin él. No es un agujero: el predicado
-- sigue filtrando por familia y un anónimo no cumple ninguna. Es trabajo
-- regalado, porque Postgres evalúa la política —y con ella la subconsulta
-- a `families`— también para el rol anónimo, que nunca va a pasarla.
--
-- Se arregla en diez segundos y se detecta en uno, con el contador que ya
-- está en la comprobación de la 017:
--
--   select count(*) from pg_policies
--   where schemaname='public' and not ('authenticated' = any(roles));
--
-- Ese contador tiene que dar CERO. Que hoy diera dos es la prueba de que
-- una convención sin comprobación automática dura exactamente una
-- migración.
-- ------------------------------------------------------------------

drop policy if exists push_subs_familia on public.push_subs;
create policy push_subs_familia on public.push_subs
  for all to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()))
  with check (family_id in (select id from public.families where owner = auth.uid()));

drop policy if exists push_log_lectura on public.push_log;
create policy push_log_lectura on public.push_log
  for select to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()));

-- ------------------------------------------------------------------
-- 3. La purga de logs deja de depender de que alguien se acuerde
--
-- `purge_logs` existe desde la 002 y es `security definer` desde la 017,
-- pero **nadie la ha llamado nunca**: no estaba programada. En un día de
-- uso normal la tabla juntó 625 filas; a ese ritmo, y multiplicado por
-- cada familia que entre, es la tabla que más crece de todo el esquema y
-- la única cuyo contenido no le importa a nadie pasadas dos semanas.
--
-- Ya no hay excusa para dejarlo a mano: `pg_cron` está instalado y en uso
-- desde la 019 (el reparto de avisos). Esto es una línea más en el mismo
-- planificador.
--
-- A las 4:10, y no en punto: a las 4:00 ya corre el reparto de avisos, y
-- dos trabajos a la misma hora sobre la misma base es pelearse por nada.
-- ------------------------------------------------------------------

do $$
begin
  perform cron.unschedule('purga-logs');
exception when others then
  null;  -- no existía; es el caso normal la primera vez
end $$;

select cron.schedule('purga-logs', '10 4 * * *', $c$ select public.purge_logs(30) $c$);

-- ------------------------------------------------------------------
-- Comprobación (pégala aparte; las tres líneas deben salir a cero/dos)
-- ------------------------------------------------------------------
-- select
--   (select count(*) from pg_constraint k
--      join pg_class t on t.oid=k.conrelid
--      join pg_namespace n on n.oid=t.relnamespace
--      join pg_attribute a on a.attrelid=t.oid and a.attnum=k.conkey[1]
--     where k.contype='f' and n.nspname='public' and array_length(k.conkey,1)=1
--       and not exists (select 1 from pg_index i
--                       where i.indrelid=t.oid and i.indkey[0]=k.conkey[1])) as fk_sin_indice,
--   (select count(*) from pg_policies
--     where schemaname='public' and not ('authenticated' = any(roles))) as politicas_sin_rol,
--   (select count(*) from cron.job) as trabajos_cron;
