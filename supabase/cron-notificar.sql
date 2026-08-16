-- ------------------------------------------------------------------
-- El reloj de los avisos.
--
-- Esto NO va en una migración a propósito: lleva un secreto dentro, y las
-- migraciones están en un repositorio público. Se ejecuta a mano en el
-- SQL Editor una sola vez, sustituyendo <SECRETO> por el valor de
-- GREMIO_CRON_SECRET (está en el `.env` local, fuera de git, y en los
-- secretos de la Edge Function).
--
-- Cada hora en punto. La franja de la tarde la decide la función, no el
-- cron, porque cada familia tiene su zona horaria (`families.timezone`) y
-- un cron en UTC no sabe qué hora es en casa de quién.
-- ------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Por si se vuelve a lanzar: dos trabajos con el mismo nombre duplicarían
-- los intentos (que no los avisos, que los frena `push_log`, pero sí el
-- gasto y el ruido en los logs).
select cron.unschedule('gremio-avisos') where exists (
  select 1 from cron.job where jobname = 'gremio-avisos'
);

select cron.schedule(
  'gremio-avisos',
  '0 * * * *',
  $cron$
    select net.http_post(
      url := 'https://chfbrawsoulfiywiqhpe.supabase.co/functions/v1/notificar',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-gremio-secreto', '<SECRETO>'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $cron$
);

-- Comprobaciones:
--
-- select jobname, schedule, active from cron.job;
-- select * from cron.job_run_details order by start_time desc limit 10;
--
-- Y lo que de verdad importa, que es a quién se avisó:
-- select l.dia, p.name, l.motivo, l.titulo, l.enviados
--   from public.push_log l join public.profiles p on p.id = l.profile_id
--  order by l.created_at desc limit 20;
