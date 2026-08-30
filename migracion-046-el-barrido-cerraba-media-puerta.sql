-- Migracion 046 · el barrido de la 021 solo cerraba media puerta.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- ------------------------------------------------------------------
-- LA REGLA YA ESTABA ESCRITA, Y AUN ASI NO SE CUMPLIA
--
-- La 021 la dejo escrita con todas las letras: "al crear una funcion
-- `security definer` no basta con `revoke from public`. Hay que retirar `anon`
-- explicitamente", y dejo un barrido al final de schema.sql que lo hace para
-- todas de una vez. La idea era la correcta y el sitio tambien.
--
-- Pero el barrido hacia SOLO `revoke ... from anon`. Y **`anon` hereda de
-- PUBLIC**: mientras PUBLIC conserve el permiso --que es el que Postgres da
-- por defecto a toda funcion nueva-- quitarselo a `anon` no cierra nada.
-- `has_function_privilege('anon', ..., 'execute')` sigue diciendo `true`, que
-- es lo unico que mira PostgREST.
--
-- Asi que el barrido llevaba desde la 021 pareciendo que funcionaba. Seis
-- funciones `security definer` contestaban sin sesion el 30-ago-2026:
-- `zona_de_perfil` y cinco disparadores.
--
-- Y hay un segundo motivo, que es el que explica por que la lista de
-- expuestas fue creciendo: **el barrido solo se ha vuelto a ejecutar dos
-- veces** (017 y 021). Cada `create or replace` posterior estrena los
-- privilegios por defecto de Supabase, que conceden a `anon`. De la 022 a la
-- 045 no se volvio a pasar, y la 021 avisaba de esto en su propio texto:
-- "volver a ejecutar esta migracion despues de anadir una funcion nueva es la
-- forma barata de no olvidarse".
--
-- ------------------------------------------------------------------
-- LO QUE NO SE PIERDE
--
-- Nada de lo que la app usa. Los `grant execute ... to authenticated` son
-- explicitos, van despues de cada funcion y sobreviven al barrido: probado en
-- un bloque que deshace al final, `authenticated` conserva las 19 que tenia y
-- las trece que llama el cliente siguen ahi. `anon` baja a CERO.
--
-- Los disparadores no necesitan permiso de ejecucion: los invoca el motor, y
-- el permiso solo hace falta para CREAR el disparador. `zona_de_perfil` no la
-- llama nadie --ni el esquema, ni el cliente, ni un script-- desde la 018:
-- merece una revision aparte para retirarla, y hasta entonces al menos deja
-- de contestar a quien no ha entrado.
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
    execute format('revoke all on function %s from public', f.firma);
    execute format('revoke all on function %s from anon', f.firma);
  end loop;
end $$;

-- ------------------------------------------------------------------
-- COMPROBACION (pegala aparte: la primera columna debe salir a 0)
--
--   select
--     count(*) filter (where has_function_privilege('anon', p.oid, 'execute')) as anon_puede_llamar,
--     count(*) filter (where has_function_privilege('authenticated', p.oid, 'execute')) as auth_puede_llamar,
--     count(*) as definer_totales
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef;
--
-- Y LA REGLA, otra vez, porque ya se olvido una vez: **toda migracion que
-- cree o reemplace una funcion `security definer` termina pegando este mismo
-- bloque.** Es idempotente, tarda nada, y es lo unico que impide que la lista
-- vuelva a crecer sola. Lo defiende `tests/permisos.test.js`.
-- ------------------------------------------------------------------
