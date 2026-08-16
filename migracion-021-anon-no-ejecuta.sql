-- Migración 021 · el rol anónimo deja de poder llamar a las funciones.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente y no toca ni un dato.
--
-- ------------------------------------------------------------------
-- QUÉ PASABA
--
-- Todas las funciones `security definer` de este esquema terminaban con
-- el mismo par de líneas:
--
--     revoke all on function public.lo_que_sea() from public;
--     grant execute on function public.lo_que_sea() to authenticated;
--
-- Parece que eso deja la función solo para quien tiene sesión. No lo
-- hace. **Supabase concede EXECUTE a `anon` y a `authenticated` por
-- privilegios por defecto en cuanto la función se crea**, y `revoke ...
-- from public` retira el permiso del pseudo-rol PUBLIC, no los permisos
-- que ya tienen esos dos roles por su nombre. El `anon` se quedaba dentro.
--
-- Comprobado desde fuera el 16-ago, con la clave anon del bundle y sin
-- ninguna sesión:
--
--     curl -X POST "$URL/rest/v1/rpc/purge_logs" \
--       -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--       -d '{"dias":100000}'      →  HTTP 200, devuelve 0
--
-- Se pidieron 100.000 días a propósito, que no borra nada. Con `dias: 0`
-- esa misma llamada, que puede hacer cualquiera que lea la clave del
-- bundle —y la clave es pública por diseño—, hace dos cosas:
--
--  1. Borra `app_logs` ENTERA, de todas las familias. Es el único rastro
--     que queda de qué pasó cuando algo falla.
--  2. Vacía `rate_limits` y `user_limits`, que es mucho peor: los topes de
--     ritmo de la 017 se cuentan por ventana en esas tablas, así que
--     borrarlas devuelve todos los contadores a cero. Cualquiera podía
--     alternar «gasto la cuota / la reseteo» indefinidamente, y entonces
--     los topes no son topes.
--
-- Las demás `security definer` no eran explotables porque todas empiezan
-- comprobando `auth.uid()`, que sin sesión es nulo y las hace salir por la
-- rama corta. Pero eso es tener la puerta abierta y confiar en que dentro
-- hay otra: una función nueva a la que se le olvide esa comprobación, o un
-- refactor que la mueva, convierte el descuido en agujero. El permiso se
-- quita en la puerta.
--
-- LA REGLA, de aquí en adelante: al crear una función `security definer`
-- no basta con `revoke from public`. Hay que retirar `anon`
-- explícitamente. El bucle de abajo lo hace para todas de una vez, así que
-- volver a ejecutar esta migración después de añadir una función nueva es
-- la forma barata de no olvidarse.
-- ------------------------------------------------------------------

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from anon', f.firma);
  end loop;
end $$;

-- `purge_logs` además no es de nadie salvo del mantenimiento: la llama el
-- cron (que corre como dueño de la base) o el SQL Editor. Ni la app ni
-- nada con sesión tiene por qué poder vaciar el registro.
revoke all on function public.purge_logs(integer) from public;
revoke all on function public.purge_logs(integer) from anon;
revoke all on function public.purge_logs(integer) from authenticated;

-- ------------------------------------------------------------------
-- Comprobación (pégala aparte: la primera columna debe salir a 0)
-- ------------------------------------------------------------------
-- select
--   count(*) filter (where has_function_privilege('anon', p.oid, 'execute')) as anon_puede_llamar,
--   count(*) filter (where has_function_privilege('authenticated', p.oid, 'execute')) as auth_puede_llamar,
--   count(*) as definer_totales
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.prosecdef;
--
-- Y desde fuera, con la clave anon, esto debe devolver 401/403 y no 200:
--   curl -X POST "$URL/rest/v1/rpc/purge_logs" -H "apikey: $ANON" \
--     -H "Authorization: Bearer $ANON" -d '{"dias":100000}'
