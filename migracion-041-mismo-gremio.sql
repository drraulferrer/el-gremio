-- Migracion 041 - el premio y quien lo canjea, de la misma casa.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente y no toca ni un dato.
--
-- QUE ARREGLA. `redeem_reward` recibe un premio y un perfil y no comprobaba
-- que fueran del mismo gremio. Hoy nadie puede provocarlo: el RLS solo deja
-- ver un gremio, asi que los dos identificadores salen siempre del mismo.
--
-- POR QUE AHORA, si no es explotable. Porque la garantia es del BORDE y no de
-- la funcion, y el borde esta a punto de cambiar: la especificacion de gremios
-- multiples sustituye "el gremio de mi cuenta" por "alguno de mis gremios"
-- (DEP-5). El dia que eso entre, esta funcion deja pagar un premio de una casa
-- con el saldo de otra, y sera un fallo de dinero, no de lectura.
--
-- Sale de la auditoria de la fase 1 del plan de implementacion, que reviso las
-- cinco funciones que cruzan dos identificadores. Las otras cuatro
-- —grant_manual_bonus, cerrar_campana_limpieza, crear_campana_limpieza y
-- spend_power— ya comprobaban. Esta era la unica.
--
-- Devuelve `no_disponible` en vez de un codigo nuevo: no hay que decirle a
-- quien pregunta que el premio existe en otro sitio, y anadir un codigo
-- obligaria a tocar el cliente por algo que no cambia lo que se puede hacer.

create or replace function public.redeem_reward(rw_id uuid, p_id uuid)
returns text
language plpgsql
security invoker
as $$
declare rw public.rewards%rowtype; p public.profiles%rowtype;
begin
  select * into rw from public.rewards where id = rw_id and active = true;
  if not found then return 'no_disponible'; end if;
  select * into p from public.profiles where id = p_id for update;
  if not found then return 'no_disponible'; end if;
  -- El premio y quien lo canjea tienen que ser de la MISMA casa.
  --
  -- Hoy esto no lo puede provocar nadie: el RLS solo deja ver un gremio, asi
  -- que los dos identificadores salen siempre del mismo. Se comprueba igual
  -- porque esa garantia es del borde, no de la funcion, y el dia que el RLS
  -- pase a "alguno de mis gremios" —que es a donde va el proyecto— esta
  -- funcion dejaria pagar un premio de una casa con el saldo de otra.
  --
  -- Devuelve `no_disponible` y no un codigo nuevo: no hay que decirle a quien
  -- pregunta que el premio existe en otro sitio, y los codigos de esta funcion
  -- los lee el cliente.
  if rw.family_id is distinct from p.family_id then return 'no_disponible'; end if;
  if p.coins < rw.cost then return 'sin_monedas'; end if;
  update public.profiles set coins = coins - rw.cost where id = p_id;
  insert into public.redemptions (family_id, reward_id, profile_id, cost)
    values (rw.family_id, rw.id, p_id, rw.cost);
  return 'ok';
end $$;
