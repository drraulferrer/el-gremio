-- Migracion 042 · el libro de las monedas, y la clave que evita cobrar dos veces.
--
-- Nota de nomenclatura: TALIS es el nombre narrativo, `coins` es la columna, y
-- el esquema no dice "talis" en ninguna parte. Hay un test que lo defiende
-- (tests/talis.test.js) y me pillo escribiendo movimientos_talis. Ver
-- docs/TALIS.md.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- ------------------------------------------------------------------
-- QUE FALTABA
--
-- Hoy hay libro de ALTAS pero no de BAJAS. `bonuses` guarda lo que se
-- concede, con su motivo y quien lo dio; los gastos, en cambio, se hacen
-- con un `update profiles set coins = coins - X` y lo unico que queda es
-- la fila del canje. No se puede reconstruir un saldo, ni explicar por que
-- alguien tiene los TALIS que tiene.
--
-- Y no hay nada que impida cobrar dos veces. Un doble clic, un reintento
-- por red o dos peticiones a la vez descuentan dos veces: el `for update`
-- serializa, que no es lo mismo que evitar. Serializar impide que se pisen;
-- no impide que se cobren dos.
--
-- ------------------------------------------------------------------
-- COMO SE RESUELVEN LAS DOS COSAS CON UNA SOLA TABLA
--
-- El libro ES el registro de idempotencia. Cada movimiento puede traer una
-- `clave`; la clave es unica; y antes de mover nada se mira si esa clave ya
-- tiene un asiento. Si lo tiene, se devuelve SU resultado y no se toca
-- nada. Mismo intento, misma respuesta, un solo cobro.
--
-- LA REGLA DE LA SUMA, y conviene tenerla presente al leer la tabla:
-- **la suma de los asientos con resultado 'ok' reproduce el saldo**. Los
-- intentos rechazados tambien se anotan —un intento fallido es historia, y
-- un pico de "sin_monedas" dice algo— pero llevan saldo_antes igual a
-- saldo_despues y no suman.
--
-- ------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE TODAVIA
--
-- Solo `redeem_reward` escribe en el libro. Las otras siete funciones que
-- mueven `coins` —resolve_completion, undo_completion, resolve_redemption,
-- grant_daily_bonus, grant_manual_bonus, cerrar_campana_limpieza y
-- claim_streak— siguen sin anotar. **Hasta que esten todas, este libro no
-- es la verdad del saldo y nadie debe leerlo como tal.** Se hace por partes
-- a proposito: son ocho funciones vivas de la economia de una casa real, y
-- entran revisadas de una en una, no de golpe.
-- ------------------------------------------------------------------

create table if not exists public.movimientos_coins (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- Que clase de movimiento. La lista crece segun se van enganchando las
  -- otras funciones; va en un check para que un tipo mal escrito falle al
  -- escribirlo y no dentro de seis meses al leer un informe.
  tipo text not null check (tipo in (
    'canje', 'devolucion_canje', 'mision', 'deshacer_mision',
    'bonus_diario', 'bonus_manual', 'botin_limpieza', 'racha'
  )),
  -- Con signo: positivo entra, negativo sale. En un intento rechazado es lo
  -- que se PRETENDIA mover, no lo que se movio: por eso la suma se hace
  -- filtrando por resultado.
  importe integer not null,
  saldo_antes integer not null,
  saldo_despues integer not null,
  -- 'ok' o el codigo por el que no se hizo ('sin_monedas'...). Se guarda el
  -- mismo texto que devuelve la funcion, para que el libro y la respuesta
  -- que vio la persona digan lo mismo.
  resultado text not null default 'ok',
  -- El canje, la completacion, la campana... segun el tipo. Sin clave ajena
  -- a proposito: apunta a tablas distintas y un asiento no debe morir
  -- porque se borre aquello a lo que se refiere.
  referencia uuid,
  -- Idempotencia. Nula cuando quien llama no manda ninguna, que es lo que
  -- pasa mientras el cliente no las genere.
  clave text check (clave is null or length(clave) between 8 and 120),
  created_at timestamptz not null default now()
);

-- La unicidad ES la garantia. Parcial porque hoy casi todas son nulas.
create unique index if not exists idx_movimientos_clave
  on public.movimientos_coins (clave) where clave is not null;

create index if not exists idx_movimientos_gremio
  on public.movimientos_coins (family_id, created_at desc);
create index if not exists idx_movimientos_perfil
  on public.movimientos_coins (profile_id, created_at desc);

alter table public.movimientos_coins enable row level security;

drop policy if exists familia_miembro on public.movimientos_coins;
create policy familia_miembro on public.movimientos_coins
  for all to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()))
  with check (family_id in (select id from public.families where owner = auth.uid()));

-- Como las tablas nuevas desde la 028: el grant a anon existe para que una
-- lectura sin sesion devuelva [] por RLS en vez de un 401, que es lo que
-- hace que las comprobaciones externas digan la verdad.
grant select on public.movimientos_coins to anon;
grant select, insert on public.movimientos_coins to authenticated;

-- ------------------------------------------------------------------
-- El apunte. Una sola forma de escribir en el libro, para que las ocho
-- funciones no inventen ocho maneras distintas.
--
-- `security invoker` a proposito: asi el RLS de arriba sigue mandando y una
-- casa no puede escribir un asiento en el libro de otra.
-- ------------------------------------------------------------------
create or replace function public.anota_coins(
  p_profile uuid,
  p_tipo text,
  p_importe integer,
  p_antes integer,
  p_despues integer,
  p_resultado text default 'ok',
  p_referencia uuid default null,
  p_clave text default null
)
returns void
language plpgsql
security invoker
as $$
declare v_family uuid;
begin
  select family_id into v_family from public.profiles where id = p_profile;
  if v_family is null then return; end if;
  insert into public.movimientos_coins
    (family_id, profile_id, tipo, importe, saldo_antes, saldo_despues, resultado, referencia, clave)
  values
    (v_family, p_profile, p_tipo, p_importe, p_antes, p_despues, p_resultado, p_referencia, p_clave);
end $$;

-- ------------------------------------------------------------------
-- Primera funcion enganchada: el canje, que es el gasto.
--
-- La firma cambia: llega `p_clave`. Hay que BORRAR la de dos argumentos
-- antes de crear la de tres, o Postgres se queda con las dos y una llamada
-- con dos argumentos pasa a ser ambigua ("function is not unique"). Con la
-- vieja fuera, un cliente que siga llamando con dos argumentos entra por el
-- valor por defecto y no se entera de nada.
-- ------------------------------------------------------------------
drop function if exists public.redeem_reward(uuid, uuid);

create or replace function public.redeem_reward(rw_id uuid, p_id uuid, p_clave text default null)
returns text
language plpgsql
security invoker
as $$
declare
  rw public.rewards%rowtype;
  p public.profiles%rowtype;
  v_previo text;
begin
  -- Idempotencia, antes de tocar nada. Mismo intento, misma respuesta.
  if p_clave is not null then
    select resultado into v_previo from public.movimientos_coins where clave = p_clave;
    if found then return v_previo; end if;
  end if;

  select * into rw from public.rewards where id = rw_id and active = true;
  if not found then return 'no_disponible'; end if;
  select * into p from public.profiles where id = p_id for update;
  if not found then return 'no_disponible'; end if;
  -- El premio y quien lo canjea, de la misma casa (041).
  if rw.family_id is distinct from p.family_id then return 'no_disponible'; end if;

  if p.coins < rw.cost then
    -- Un intento fallido tambien es historia: sin el, un pico de gente que
    -- no llega al premio no se ve en ninguna parte.
    perform public.anota_coins(p_id, 'canje', -rw.cost, p.coins, p.coins, 'sin_monedas', rw.id, p_clave);
    return 'sin_monedas';
  end if;

  update public.profiles set coins = coins - rw.cost where id = p_id;
  insert into public.redemptions (family_id, reward_id, profile_id, cost)
    values (rw.family_id, rw.id, p_id, rw.cost);
  perform public.anota_coins(p_id, 'canje', -rw.cost, p.coins, p.coins - rw.cost, 'ok', rw.id, p_clave);
  return 'ok';
end $$;
