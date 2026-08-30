-- Migracion 052 · el saldo que ve la tienda.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Pieza 3.3 de la Fase 3, y la ultima. Es pequena, y conviene decir por que.
--
-- ------------------------------------------------------------------
-- EL PRECIO YA ES EL DEL GREMIO DONDE SE GASTA
--
-- `R-53` pide que los TALIS personales se gasten "siempre al precio vigente del
-- gremio donde se gasta, con su temporada y sus reglas". Eso **ya pasa**, y no
-- por casualidad:
--
--   * cada premio es de un gremio (`rewards.family_id`), y la 041 comprueba que
--     el premio y quien lo canjea sean de la misma casa;
--   * `redeem_reward` cobra `rw.cost`, del premio, y nada mas: el cliente no
--     tiene por donde declarar un coste, asi que no puede declarar uno menor;
--   * y la temporada ya esta dentro de ese numero. La subida del 30 % no se
--     calcula al cobrar: la escribe un adulto sobre `rewards.cost` al abrir
--     temporada (`precioSiguienteTemporada`, en ParentPanel). El precio guardado
--     ES el vigente.
--
-- Asi que aqui no hay nada que arreglar. Lo que si hay son pruebas que lo
-- sujeten, porque es facil romperlo sin querer el dia que alguien anada un
-- parametro de coste "para la vista previa".
--
-- ------------------------------------------------------------------
-- LO QUE SI FALTABA, Y ES CONSECUENCIA DE LA 051
--
-- La tienda lee `profiles.coins`. Desde la 051, para un personaje convertido
-- eso vale **cero**: su dinero esta en la cartera. La tienda le ensenaria cero
-- Talis y todos los premios en gris, con 429 en el bolsillo.
--
-- No lo puede ver nadie hoy --nadie puede convertirse-- pero es una averia
-- servida para el dia que exista la pantalla. Esta funcion es lo que la evita:
-- devuelve, para cada personaje de mis gremios, **lo que de verdad puede
-- gastar**, mire donde mire su saldo.
--
-- ------------------------------------------------------------------
-- QUIEN PUEDE VER EL SALDO DE QUIEN, Y UNA DECISION QUE HAY QUE REVISAR
--
-- Devuelve el saldo de los personajes de los gremios a los que llego. Es lo que
-- hace falta para que la casa siga viendo su tienda como siempre, y es
-- coherente con `CNV-7`: convertirse no saca al personaje del selector de la
-- casa, que lo sigue viendo y operando igual que antes.
--
-- Pero `CAP-12` dice que el saldo es "solo propio". Hoy no chocan, porque un
-- gremio es una casa y quien opera ese personaje ya veia su saldo ayer. En la
-- Fase 6, cuando un gremio pueda tener personas que no viven juntas, **hay que
-- volver aqui**: ensenarle a un desconocido cuanto tiene en la cartera alguien
-- de su gremio de amigos no es lo mismo que ensenarselo a su madre.
-- ------------------------------------------------------------------

create or replace function public.saldos_visibles()
returns table (profile_id uuid, saldo integer)
language sql
stable
security definer
set search_path = public
as $fn$
  select p.id,
         case
           when p.persona is null then p.coins
           else coalesce((select c.saldo from public.carteras c where c.persona = p.persona), 0)
         end
    from public.profiles p
   where p.family_id in (select public.mis_gremios());
$fn$;

revoke all on function public.saldos_visibles() from public;
revoke all on function public.saldos_visibles() from anon;
grant execute on function public.saldos_visibles() to authenticated;

-- ------------------------------------------------------------------
-- El barrido de la 021, corregido por la 046.
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
-- COMPROBACION
--
-- Mientras no se convierta nadie, esto tiene que dar CERO filas: lo que ve la
-- tienda y lo que dice `profiles.coins` son el mismo numero.
--
--   select v.profile_id, v.saldo, p.coins
--     from public.saldos_visibles() v
--     join public.profiles p on p.id = v.profile_id
--    where v.saldo <> p.coins;
-- ------------------------------------------------------------------
