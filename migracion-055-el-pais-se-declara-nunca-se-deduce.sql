-- Migracion 055 · el pais de operacion se declara, nunca se deduce.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Pieza 4.4 de la Fase 4, y con ella la Fase 4 queda cerrada.
--
-- ------------------------------------------------------------------
-- QUE HAY YA, Y QUE FALTABA
--
-- La matriz tipo x pais x estado existe desde la 050
-- (`disponibilidad_tipos`) y `tipo_publicado()` la contesta en servidor. Lo
-- que no habia era **el pais**: la matriz sabia responder "que tipos hay
-- publicados en ES" y no habia forma de saber si un gremio opera en ES.
--
-- Por eso `tipo_publicado()` se dejo SIN conceder a `authenticated` en la
-- 050: el pais es un parametro suyo, y `R-108`/`SEC-29` dicen que un cliente
-- no declara en que pais esta para desbloquear un tipo. Quien la llame tiene
-- que ser otra funcion del servidor que sepa de donde sacar el pais de
-- verdad. Esa funcion es la de aqui abajo, y el pais de verdad es
-- `families.pais`.
--
-- ------------------------------------------------------------------
-- NADIE RECIBE UN PAIS POR INFERENCIA (`R-102`)
--
-- Ni por idioma, ni por zona horaria, ni por IP, ni por correo, ni por
-- dispositivo. **Y `timezone` es la tentacion**: la columna esta ahi desde la
-- 018, dice 'Europe/Madrid' para todos los gremios que existen, y sacar 'ES'
-- de ahi es una linea. Seria un pais inventado por el servidor con apariencia
-- de dato declarado, y el dia que alguien opere desde Madrid para un gremio
-- de otra jurisdiccion, esa linea habria decidido su regimen legal sola.
--
-- La columna nace NULA para todos, y nula quiere decir "sin declarar", que es
-- la verdad. Es el mismo criterio que `legal_version` en la 022: los gremios
-- anteriores a la casilla la tienen a null, y esa es la consulta que los
-- encuentra.
--
-- ------------------------------------------------------------------
-- Y NO SE BLOQUEA A NADIE (`R-117`)
--
-- Los gremios que existen hoy siguen haciendo **exactamente todo lo que
-- hacian**. No hay `not null`, no hay valor por defecto, y **ninguna de las
-- funciones que hoy se llaman empieza a exigir un pais**. `exige_pais()`
-- existe y no la llama nadie todavia, igual que `exige_persona()` en la 044
-- existio antes que su primer uso: se le pedira el pais al gremio la primera
-- vez que intente algo que dependa de el, y eso es la Fase 5.
--
-- La declaracion la puede hacer un **perfil adulto con el PIN**, ademas de
-- una persona con administracion. No es una concesion: los gremios que
-- existen hoy pueden no tener **ninguna** identidad personal dentro (`R-46`),
-- y una regla que exigiera identidad personal seria inaplicable justo en los
-- gremios para los que esta escrita.
--
-- ------------------------------------------------------------------
-- POR QUE `CAP-04` Y NO UNA CAPACIDAD NUEVA
--
-- Declarar el pais es cambiar un ajuste del gremio, y `CAP-04` es
-- exactamente eso. Inventar `CAP-18` tendria ademas un efecto que solo se ve
-- leyendo la 054: **lo que no esta declarado, no esta permitido**, asi que
-- una capacidad nueva no la tendria ninguna plantilla ya publicada y no la
-- ganaria nadie. La declaracion seria imposible para todos.
--
-- `CAP-04` reparte hoy 'pin' a titular, gestor y adulto, y 'no' al resto. Es
-- palabra por palabra lo que pide `R-117`.
--
-- ------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE
--
-- **No declara el pais de ningun gremio.** Ni el de la casa real. Eso es una
-- decision de quien opera el gremio, tomada desde la aplicacion, y hacerla
-- aqui seria la inferencia por otro camino.
--
-- **No hay pantalla.** El cliente sigue en la 2.33.6. Lo que hay es la puerta
-- y sus lectores, para que la pantalla que la use tenga contra que hablar.
--
-- **No cambia `tipos_ofrecidos()`.** Un gremio que se esta creando todavia no
-- tiene pais --lo elige en ese mismo momento (`R-102`)-- asi que el cruce con
-- la matriz es de la creacion de gremios, que es la Fase 6. Anadirle hoy un
-- parametro `pais` seria darle al cliente justo la palanca que `R-108`
-- prohibe, y sin nadie detras que la comprobara.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · LA COLUMNA, Y SUS DOS DE AUDITORIA
--
-- `pais_declarado_por` NO tiene clave ajena a `auth.users`, y es deliberado,
-- por lo mismo que `configuracion_expansion.publicada_por` en la 050: con
-- `on delete set null`, borrar la cuenta de quien declaro disparara un
-- `update` sobre `families` que el disparador de mas abajo rechaza, y **el
-- borrado de la cuenta fallaria**. Un apunte de auditoria tiene que
-- sobrevivir a la cuenta que nombra.
-- ------------------------------------------------------------------

alter table public.families
  add column if not exists pais text
    check (pais is null or pais ~ '^[A-Z]{2}$');
alter table public.families
  add column if not exists pais_declarado_at timestamptz;
alter table public.families
  add column if not exists pais_declarado_por uuid;

comment on column public.families.pais is
  'Pais de operacion, ISO 3166-1 alfa-2. Declarado explicitamente y nunca inferido (R-102). Nulo = creado antes de la 055 y sin declarar, que no le impide nada (R-117).';
comment on column public.families.pais_declarado_at is
  'Cuando se declaro. Nulo mientras no haya pais.';
comment on column public.families.pais_declarado_por is
  'La cuenta que lo declaro. Sin clave ajena a proposito: el apunte sobrevive a la cuenta.';

-- ------------------------------------------------------------------
-- 2 · SE DECLARA UNA VEZ, Y POR LA PUERTA
--
-- Dos cosas, y hacen falta las dos:
--
--   a) Una vez declarado, no se cambia (`R-102`). Cambiar de pais es cambiar
--      de regimen legal aplicable, y eso pide una migracion explicita, no un
--      `update`.
--
--   b) Declararlo la primera vez solo se puede hacer llamando a
--      `declarar_pais()`. Sin esto la comprobacion de capacidad seria
--      decorativa: la politica `familia_owner` es `for all`, asi que la
--      cuenta del gremio puede escribir en `families` por la API y se
--      pondria el pais a mano sin pasar por `CAP-04`. Es la leccion de la
--      054 aplicada aqui -- si la unica guarda esta en una funcion que se
--      puede rodear, no es una guarda.
--
-- El pestillo es una variable de TRANSACCION (`set_config(..., true)`), el
-- mismo mecanismo que `motivo_coins` usa desde la 043, y lleva el id del
-- gremio dentro: un pestillo abierto para el gremio A no abre el B.
-- ------------------------------------------------------------------

create or replace function public.tg_pais_inmutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.pais is distinct from old.pais then
    if old.pais is not null then
      raise exception 'el pais de operacion de un gremio no se cambia (R-102)'
        using errcode = 'restrict_violation';
    end if;
    if new.pais is null then
      raise exception 'el pais de operacion no se retira una vez declarado (R-102)'
        using errcode = 'restrict_violation';
    end if;
    if coalesce(nullif(current_setting('app.declarando_pais', true), ''), '') <> new.id::text then
      raise exception 'el pais se declara con declarar_pais(), no con un update (R-117)'
        using errcode = 'restrict_violation';
    end if;
  elsif new.pais_declarado_at is distinct from old.pais_declarado_at
     or new.pais_declarado_por is distinct from old.pais_declarado_por then
    raise exception 'el apunte de la declaracion de pais no se reescribe'
      using errcode = 'restrict_violation';
  end if;
  return new;
end $fn$;

revoke all on function public.tg_pais_inmutable() from anon;
revoke all on function public.tg_pais_inmutable() from authenticated;

drop trigger if exists families_pais_inmutable on public.families;
create trigger families_pais_inmutable
  before update on public.families
  for each row execute function public.tg_pais_inmutable();

-- ------------------------------------------------------------------
-- 3 · LA PUERTA
--
-- Devuelve un codigo y no lanza, como el resto de las funciones que llama el
-- cliente: 'ok', 'sin_sesion', 'no_existe', 'no_es_tuyo', 'no_puede',
-- 'pais_invalido' y 'ya_declarado'.
--
-- Declarar dos veces el MISMO pais devuelve 'ok'. Un doble clic no es un
-- error, y el estado final es el que se pedia.
--
-- Declarar uno DISTINTO devuelve 'ya_declarado' y **no cambia nada**: el
-- servidor ignora lo que llega y se queda con lo que tiene (`E-12.6`). El
-- intento se anota en `app_logs` como aviso, que es donde vive en esta casa
-- lo que hay que mirar y no lo que hay que guardar para siempre; el apunte
-- permanente --quien declaro, cuando y que-- esta en `families` y no caduca.
-- ------------------------------------------------------------------

create or replace function public.declarar_pais(
  p_family uuid,
  p_pais text,
  p_profile uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_pais text := upper(btrim(coalesce(p_pais, '')));
  v_actual text;
  v_hay boolean := false;
begin
  if auth.uid() is null then return 'sin_sesion'; end if;
  if p_family is null then return 'no_existe'; end if;

  select f.pais, true into v_actual, v_hay
    from public.families f where f.id = p_family;
  -- `coalesce` y no `not v_hay` a secas: un `select into` sin filas deja las
  -- variables a NULL, y `not null` no es `true`, asi que el gremio inexistente
  -- se habria colado hasta la comprobacion siguiente.
  if not coalesce(v_hay, false) then return 'no_existe'; end if;

  if not public.es_mi_gremio(p_family) then return 'no_es_tuyo'; end if;

  -- Por capacidad y no por etiqueta (054). `CAP-04` es "cambiar los ajustes
  -- del gremio", y hoy reparte 'pin' a titular, gestor y adulto: el perfil
  -- adulto con el PIN y la persona con administracion de `R-117`, sin
  -- inventar ninguna capacidad que ninguna plantilla publicada tendria.
  if public.puede(p_family, 'CAP-04', p_profile) = 'no' then return 'no_puede'; end if;

  -- ISO 3166-1 alfa-2, y nada mas. No se traduce, no se adivina y no se
  -- acepta un nombre de pais: dos letras o no hay declaracion.
  if v_pais !~ '^[A-Z]{2}$' then return 'pais_invalido'; end if;

  if v_actual is not null then
    if v_actual = v_pais then return 'ok'; end if;
    -- El personaje se anota solo si es de este gremio. `app_logs.profile_id`
    -- tiene clave ajena, y un id inventado tumbaria la transaccion entera:
    -- el intento quedaria sin registrar por culpa del propio registro.
    insert into public.app_logs (family_id, profile_id, nivel, evento, datos)
    values (p_family,
            (select pr.id from public.profiles pr
              where pr.id = p_profile and pr.family_id = p_family),
            'warn', 'pais_ya_declarado',
            jsonb_build_object('declarado', v_actual, 'intentado', v_pais));
    return 'ya_declarado';
  end if;

  -- El pestillo dura lo que la transaccion y lleva el gremio dentro.
  perform set_config('app.declarando_pais', p_family::text, true);
  update public.families
     set pais = v_pais,
         pais_declarado_at = now(),
         pais_declarado_por = auth.uid()
   where id = p_family;
  perform set_config('app.declarando_pais', '', true);

  return 'ok';
end $fn$;

revoke all on function public.declarar_pais(uuid, text, uuid) from public;
revoke all on function public.declarar_pais(uuid, text, uuid) from anon;
grant execute on function public.declarar_pais(uuid, text, uuid) to authenticated;

-- ------------------------------------------------------------------
-- 4 · LO QUE PUEDE LEER EL CLIENTE
--
-- Con esto la pantalla sabe si tiene que preguntar, y no tiene que mirar
-- `families` ni saber que la columna existe. `pais_declarado_por` NO sale:
-- mismo criterio que `publicada_por` y `motivo` en la 050 -- la auditoria se
-- guarda, no se publica.
-- ------------------------------------------------------------------

create or replace function public.pais_de_gremio()
returns table (family_id uuid, pais text, declarado_at timestamptz)
language sql
stable
security definer
set search_path = public
as $fn$
  select f.id, f.pais, f.pais_declarado_at
    from public.families f
   where f.id in (select public.mis_gremios());
$fn$;

revoke all on function public.pais_de_gremio() from public;
revoke all on function public.pais_de_gremio() from anon;
grant execute on function public.pais_de_gremio() to authenticated;

-- ------------------------------------------------------------------
-- 5 · LA MATRIZ, RESUELTA EN SERVIDOR
--
-- Fijate en lo que NO tiene esta funcion: un parametro `pais`. Recibe el
-- gremio, y el pais lo saca ella de la base. Eso es `R-108` y `SEC-29`
-- escritos en la firma, y es la razon de que se pueda conceder a
-- `authenticated` lo que `tipo_publicado()` no podia.
--
-- Tres respuestas y no un booleano, porque 'sin_pais' NO es 'no':
--
--   'si'       · publicado para el pais de este gremio
--   'no'       · no publicado ahi, o el gremio no es mio
--   'sin_pais' · **hay que preguntar**, y esto es `R-117` entero: no es una
--                negativa, es lo unico que dispara la pregunta. Quien la
--                reciba pide el pais; quien la trate como un 'no' esta
--                bloqueando un gremio por no haber declarado, que es
--                exactamente lo que la regla prohibe.
-- ------------------------------------------------------------------

create or replace function public.disponibilidad_de_tipo(p_family uuid, p_tipo text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_pais text;
begin
  if p_family is null or p_tipo is null then return 'no'; end if;
  if not public.es_mi_gremio(p_family) then return 'no'; end if;

  select f.pais into v_pais from public.families f where f.id = p_family;
  if v_pais is null then return 'sin_pais'; end if;

  if public.tipo_publicado(p_tipo, v_pais) then return 'si'; end if;
  return 'no';
end $fn$;

revoke all on function public.disponibilidad_de_tipo(uuid, text) from public;
revoke all on function public.disponibilidad_de_tipo(uuid, text) from anon;
grant execute on function public.disponibilidad_de_tipo(uuid, text) to authenticated;

-- ------------------------------------------------------------------
-- 6 · LA PUERTA QUE TODAVIA NO ABRE NADIE
--
-- Lo que llamara una operacion que SI dependa del pais --forjar una llave,
-- crear un gremio-- cuando exista. Lanza en vez de devolver un codigo porque
-- su sitio es la primera linea de una funcion que ya no debe continuar.
--
-- Hoy no la llama nadie, y eso es la parte importante: mientras nadie la
-- llame, ningun gremio esta bloqueado por no haber declarado (`R-117`).
-- Existe antes que su primer uso a proposito, igual que `exige_persona()` en
-- la 044.
-- ------------------------------------------------------------------

create or replace function public.exige_pais(p_family uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_pais text;
begin
  if not public.es_mi_gremio(p_family) then
    raise exception 'no_es_tuyo';
  end if;
  select f.pais into v_pais from public.families f where f.id = p_family;
  if v_pais is null then
    -- No es un fallo: es la senal de que hay que preguntar. Quien la reciba
    -- pide el pais y reintenta.
    raise exception 'pais_sin_declarar';
  end if;
  return v_pais;
end $fn$;

revoke all on function public.exige_pais(uuid) from public;
revoke all on function public.exige_pais(uuid) from anon;
grant execute on function public.exige_pais(uuid) to authenticated;

-- Y el barrido de la 021, corregido por la 046: toda funcion `security
-- definer` pierde el permiso de ejecucion de PUBLIC y de `anon`. Hace falta
-- retirar los dos: `anon` HEREDA de PUBLIC, asi que quitarselo solo a `anon`
-- no cierra nada mientras PUBLIC lo conserve.
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
--   select count(*) filter (where pais is null) as sin_declarar,
--          count(*) filter (where pais is not null) as declarados
--     from public.families;
--   -- lo correcto tras ejecutar este fichero es: TODOS sin declarar
--
-- Y el ensayo, que lo deshace todo al terminar:
--
--   do $ensayo$
--   declare
--     v_f uuid;
--     v_r text;
--   begin
--     select id into v_f from public.families limit 1;
--     -- a) un update a mano NO puede poner el pais
--     begin
--       update public.families set pais = 'ES' where id = v_f;
--       raise exception 'ENSAYO MAL: el update a mano ha colado';
--     exception when restrict_violation then null;
--     end;
--     -- b) por la puerta si (desde el SQL Editor `auth.uid()` es nulo, asi
--     --    que declarar_pais devuelve 'sin_sesion'; esto escribe como lo
--     --    haria ella, con el pestillo puesto)
--     perform set_config('app.declarando_pais', v_f::text, true);
--     update public.families set pais = 'ES', pais_declarado_at = now() where id = v_f;
--     perform set_config('app.declarando_pais', '', true);
--     -- c) y ya no se cambia
--     begin
--       perform set_config('app.declarando_pais', v_f::text, true);
--       update public.families set pais = 'FR' where id = v_f;
--       raise exception 'ENSAYO MAL: el pais ha cambiado';
--     exception when restrict_violation then null;
--     end;
--     raise exception 'ENSAYO OK · el pais se declara una vez y por la puerta';
--   end $ensayo$;
-- ------------------------------------------------------------------
