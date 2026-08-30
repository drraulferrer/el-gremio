-- Migracion 049 · borrar la identidad personal sin llevarse la casa por delante.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Pieza 2.7 de la Fase 2: el flujo F-8d. Es la que la especificacion dice que
-- **bloquea el lanzamiento**, y con razon.
--
-- ------------------------------------------------------------------
-- LO QUE HABIA, Y POR QUE NO PODIA QUEDARSE
--
-- `delete_my_account()` hacia, literalmente:
--
--     delete from public.families where owner = auth.uid();
--
-- Con una cuenta por casa eso era exactamente lo que la persona pedia: borrar
-- su cuenta es borrar su gremio, porque su gremio es suyo y no hay nadie mas.
--
-- Desde la 047 y la 048 eso deja de ser verdad. Un gremio puede tener personas
-- dentro con identidad propia, con su personaje, su historial y su cartera. Y
-- `delete from families` se lo lleva TODO por la clave ajena en cascada:
-- perfiles, misiones, canjes, insignias, reconocimientos, el historial entero
-- de gente que no ha pedido nada.
--
-- ------------------------------------------------------------------
-- LAS DOS PUERTAS, QUE NO SON LA MISMA
--
--   * **Borrar la CREDENCIAL COMPARTIDA** es borrar la casa. Sigue existiendo y
--     sigue haciendo lo de siempre, con una condicion nueva: **si hay alguna
--     persona dentro, se niega**. Que la casa se disuelva no puede ser una
--     decision que tome quien tiene la clave sin contar con quien vive dentro.
--
--   * **Borrar una IDENTIDAD PERSONAL** no borra ningun gremio. Se sale de
--     ellos, el personaje se queda, y la casa sigue exactamente igual. Es un
--     flujo propio y es el que trae esta migracion.
--
-- ------------------------------------------------------------------
-- EL EFECTO SE CALCULA EN SERVIDOR, Y ANTES DE PREGUNTAR NADA
--
-- La lista de gremios afectados NO llega del cliente. El cliente pregunta
-- `efecto_de_borrarme()`, ensena lo que responda --gremio por gremio, que se
-- abandona, que exige traspasar la administracion y que se cerraria-- y al
-- confirmar manda solo **decisiones**, nunca la lista. Y el servidor la vuelve
-- a calcular entera antes de tocar nada.
--
-- ------------------------------------------------------------------
-- POR QUE HOY NUNCA SE CIERRA UN GREMIO AL BORRARSE
--
-- La especificacion dice que quien es la ultima persona administradora tiene
-- que elegir: traspasar, cerrar, o cancelar. Pero tambien dice que **los
-- perfiles internos y la credencial compartida son entidades distintas de la
-- identidad personal y no se van con ella**.
--
-- Las dos cosas se juntan asi: **un gremio que conserva credencial compartida
-- nunca se queda sin administracion**, porque un perfil adulto con el PIN
-- administra la casa como siempre. Asi que ahi la accion es siempre
-- «abandonar», y no hay nada que traspasar ni que cerrar.
--
-- Como hoy TODOS los gremios tienen credencial compartida, hoy borrarse no
-- cierra nunca un gremio. Las otras tres ramas existen escritas y probadas
-- porque en la Fase 6 apareceran gremios fundados por una persona, sin clave
-- de casa detras, y ese dia hara falta que ya esten.
--
-- ------------------------------------------------------------------
-- Y EL DINERO DEL JUEGO NO SE EVAPORA
--
-- Al convertirse, el saldo del personaje paso a la cartera. Al borrarse, la
-- cartera **vuelve al personaje** y el saldo local se reabre, con su asiento.
-- Es la operacion simetrica de la 047 y no es un detalle: sin ella, una madre
-- que borra su cuenta se lleva por delante los Talis que su personaje habia
-- ganado, y ese personaje se queda en la casa, a la vista, con cero.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · EL LIBRO CONOCE LA VUELTA
-- ------------------------------------------------------------------

alter table public.movimientos_coins drop constraint if exists movimientos_coins_tipo_check;
alter table public.movimientos_coins add constraint movimientos_coins_tipo_check check (tipo in (
  'canje', 'devolucion_canje', 'mision', 'deshacer_mision',
  'bonus_diario', 'bonus_manual', 'botin_limpieza', 'racha',
  'conversion',
  -- La cartera vuelve al personaje cuando se borra la identidad. Simetrico de
  -- 'conversion', y por el mismo motivo: el saldo no puede evaporarse.
  'devolucion_conversion',
  'desconocido'
));

-- ------------------------------------------------------------------
-- 2 · LA HISTORIA DE LA LLAVE SOBREVIVE A QUIEN LA TUVO
--
-- `migraciones_correo.antigua` apuntaba a `auth.users` con `on delete cascade`,
-- asi que borrar esa identidad se llevaba la fila: el registro de que la llave
-- de esta casa cambio de manos tal dia. Eso es historia DEL GREMIO, no de la
-- persona, y tiene que quedarse. Se pasa a `set null`.
-- ------------------------------------------------------------------

alter table public.migraciones_correo alter column antigua drop not null;
alter table public.migraciones_correo drop constraint if exists migraciones_correo_antigua_fkey;
alter table public.migraciones_correo
  add constraint migraciones_correo_antigua_fkey
  foreign key (antigua) references auth.users(id) on delete set null;

-- ------------------------------------------------------------------
-- 2b · DOS `CHECK` QUE IMPEDIAN BORRARSE
--
-- Lo encontro el ensayo de esta misma migracion, y no lo habria encontrado
-- ningun test de los que leen el fichero: al borrar la cuenta, la clave ajena
-- pone `conversiones.persona` a null, y el CHECK de la 047 exige que una fila
-- 'completada' tenga persona. Resultado: **el borrado entero fallaba**.
--
-- La condicion correcta es la fecha, no la persona. Una conversion completada
-- es el apunte de un movimiento que ocurrio; que quien lo protagonizo haya
-- borrado su identidad despues no lo deshace. Lo mismo con `nueva` en
-- `migraciones_correo`.
--
-- Lo que si se sigue impidiendo --que una 'pendiente' traiga persona o fecha--
-- se queda como estaba: eso si seria un dato a medias.
-- ------------------------------------------------------------------

alter table public.conversiones drop constraint if exists conversiones_completada_coherente;
alter table public.conversiones add constraint conversiones_completada_coherente check (
  case
    when estado = 'completada' then resuelta_at is not null
    when estado = 'pendiente' then persona is null and resuelta_at is null
    else true
  end
);

alter table public.migraciones_correo drop constraint if exists migraciones_correo_probada_coherente;
alter table public.migraciones_correo add constraint migraciones_correo_probada_coherente check (
  case
    when estado = 'pendiente' then nueva is null and probada_at is null
    when estado in ('credencial_probada','completada') then probada_at is not null
    else true
  end
);

-- ------------------------------------------------------------------
-- 3 · QUE PASARIA SI ME BORRO
--
-- Devuelve, gremio por gremio, lo que hay que ensenar antes de preguntar nada.
-- `accion` es una de cuatro:
--
--   'abandonar'  · me salgo y ya. La casa sigue igual.
--   'transferir' · soy la ultima con administracion y queda gente dentro: hay
--                  que pasarle la administracion a alguien.
--   'cerrar'     · soy la ultima y no queda nadie. Hay que decirlo a mano.
--   (hoy solo aparece 'abandonar', ver la cabecera)
-- ------------------------------------------------------------------

create or replace function public.efecto_de_borrarme()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_clase text;
  v_gremios jsonb := '[]'::jsonb;
  v_cartera integer := 0;
  g record;
begin
  if v_uid is null then
    return jsonb_build_object('clase', 'sin_sesion', 'puede_seguir', false, 'gremios', '[]'::jsonb);
  end if;

  v_clase := public.clase_credencial();
  select coalesce(c.saldo, 0) into v_cartera from public.carteras c where c.persona = v_uid;

  for g in
    select p.family_id,
           f.name as nombre,
           p.rol,
           exists (select 1 from public.credenciales c
                    where c.family_id = p.family_id and c.clase = 'compartida') as con_clave_de_casa,
           (select count(*) from public.pertenencias o
             where o.family_id = p.family_id and o.estado = 'activa' and o.persona <> v_uid) as otras_personas,
           exists (select 1 from public.pertenencias o
                    where o.family_id = p.family_id and o.estado = 'activa'
                      and o.persona <> v_uid and o.rol in ('titular','gestor')) as otra_administracion
      from public.pertenencias p
      join public.families f on f.id = p.family_id
     where p.persona = v_uid and p.estado = 'activa'
     order by f.created_at
  loop
    v_gremios := v_gremios || jsonb_build_object(
      'family_id', g.family_id,
      'nombre', g.nombre,
      'rol', g.rol,
      'conserva_clave_de_casa', g.con_clave_de_casa,
      'otras_personas', g.otras_personas,
      'accion',
        case
          -- Un gremio con clave de casa nunca se queda sin administracion: un
          -- perfil adulto con el PIN la tiene, como siempre.
          when g.con_clave_de_casa then 'abandonar'
          when g.otra_administracion then 'abandonar'
          when g.otras_personas > 0 then 'transferir'
          else 'cerrar'
        end
    );
  end loop;

  return jsonb_build_object(
    'clase', v_clase,
    'puede_seguir', v_clase = 'personal',
    'cartera', v_cartera,
    -- Con mas de un gremio, a donde vuelve la cartera deja de tener una
    -- respuesta unica. No pasa hoy --una persona tiene un personaje-- y la
    -- funcion de borrado se niega antes que repartir a ojo. Se resuelve en la
    -- Fase 6, que es cuando puede ocurrir.
    'cartera_resuelta', jsonb_array_length(v_gremios) <= 1,
    'gremios', v_gremios
  );
end $fn$;

revoke all on function public.efecto_de_borrarme() from public;
revoke all on function public.efecto_de_borrarme() from anon;
grant execute on function public.efecto_de_borrarme() to authenticated;

-- ------------------------------------------------------------------
-- 4 · BORRARSE
--
-- `p_decisiones` es un array, y solo lleva DECISIONES, nunca la lista de
-- gremios: esa la calcula el servidor. Forma:
--
--   [{"family_id": "...", "accion": "transferir", "a": "<uuid de persona>"},
--    {"family_id": "...", "accion": "cerrar"}]
--
--   'ok'
--   'sin_sesion'
--   'no_es_personal'              usa `delete_my_account`, que es otra puerta
--   'falta_decision'              un gremio exige elegir y no viene elegido
--   'destino_invalido'            a quien se traspasa no esta dentro, o soy yo
--   'varios_gremios_no_resuelto'  ver `cartera_resuelta` arriba
-- ------------------------------------------------------------------

create or replace function public.borrar_mi_identidad(
  p_decisiones jsonb default '[]'::jsonb,
  p_clave text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_efecto jsonb;
  g jsonb;
  v_family uuid;
  v_accion text;
  v_decision jsonb;
  v_destino uuid;
  v_saldo integer := 0;
  v_perfil uuid;
begin
  if v_uid is null then return 'sin_sesion'; end if;
  if public.clase_credencial() <> 'personal' then return 'no_es_personal'; end if;

  -- Se calcula entero aqui, otra vez, aunque el cliente ya lo haya pedido para
  -- pintarlo: entre una cosa y otra ha podido cambiar cualquier cosa, y lo que
  -- diga el cliente no autoriza nada.
  v_efecto := public.efecto_de_borrarme();

  if not (v_efecto->>'cartera_resuelta')::boolean then
    return 'varios_gremios_no_resuelto';
  end if;

  -- Primero se comprueban TODAS las decisiones. Si falta una, no se ha tocado
  -- nada todavia: quedarse a medias aqui es dejar a alguien fuera de un gremio
  -- que no llego a traspasar.
  for g in select * from jsonb_array_elements(v_efecto->'gremios') loop
    v_accion := g->>'accion';
    if v_accion = 'abandonar' then continue; end if;

    v_family := (g->>'family_id')::uuid;
    select d into v_decision
      from jsonb_array_elements(coalesce(p_decisiones, '[]'::jsonb)) d
     where (d->>'family_id')::uuid = v_family limit 1;

    if v_decision is null or (v_decision->>'accion') is distinct from v_accion then
      return 'falta_decision';
    end if;

    if v_accion = 'transferir' then
      v_destino := nullif(v_decision->>'a','')::uuid;
      if v_destino is null or v_destino = v_uid
         or not exists (select 1 from public.pertenencias o
                         where o.family_id = v_family and o.persona = v_destino
                           and o.estado = 'activa') then
        return 'destino_invalido';
      end if;
    end if;
  end loop;

  -- Y ahora si.
  for g in select * from jsonb_array_elements(v_efecto->'gremios') loop
    v_family := (g->>'family_id')::uuid;
    v_accion := g->>'accion';

    if v_accion = 'transferir' then
      select nullif(d->>'a','')::uuid into v_destino
        from jsonb_array_elements(p_decisiones) d
       where (d->>'family_id')::uuid = v_family limit 1;
      update public.pertenencias
         set rol = 'titular'
       where family_id = v_family and persona = v_destino and estado = 'activa';
    end if;

    update public.pertenencias
       set estado = 'abandonada', hasta = now()
     where family_id = v_family and persona = v_uid and estado = 'activa';

    -- Cerrar va al final del gremio y solo cuando no queda nadie: es la unica
    -- rama que borra algo, y la unica que la persona ha tenido que escribir.
    if v_accion = 'cerrar' then
      delete from public.families where id = v_family;
    end if;
  end loop;

  -- La cartera vuelve al personaje y el saldo local se reabre. Simetrico de la
  -- conversion: el dinero del juego no se evapora porque alguien borre su
  -- cuenta, y ese personaje se queda en la casa a la vista de todos.
  select coalesce(saldo, 0) into v_saldo from public.carteras where persona = v_uid;
  select id into v_perfil from public.profiles where persona = v_uid limit 1;

  if v_perfil is not null then
    if v_saldo > 0 then
      perform public.motivo_coins('devolucion_conversion', null, p_clave);
    end if;
    update public.profiles
       set coins = coins + v_saldo,
           persona = null,
           saldo_local_cerrado = false
     where id = v_perfil;
    update public.carteras set saldo = 0 where persona = v_uid;
  end if;

  -- Y la cuenta. La cascada se lleva su credencial, sus pertenencias y su
  -- cartera --que son suyas-- y deja en pie el gremio, los perfiles, el
  -- historial y la fila de `conversiones`, que se queda sin persona pero
  -- conserva los importes.
  delete from public.user_limits where user_id = v_uid;
  delete from auth.users where id = v_uid;

  return 'ok';
end $fn$;

revoke all on function public.borrar_mi_identidad(jsonb, text) from public;
revoke all on function public.borrar_mi_identidad(jsonb, text) from anon;
grant execute on function public.borrar_mi_identidad(jsonb, text) to authenticated;

-- ------------------------------------------------------------------
-- 5 · Y LA PUERTA VIEJA, QUE YA NO PUEDE LLEVARSE LO DE NADIE
--
--   'ok' · 'ok_sin_gremio' · 'sin_sesion'   (como siempre)
--   'usa_borrar_identidad'  una identidad personal no borra gremios
--   'hay_personas_dentro'   el gremio tiene personas con identidad propia
-- ------------------------------------------------------------------

create or replace function public.delete_my_account()
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_gremios integer;
begin
  if v_uid is null then
    return 'sin_sesion';
  end if;

  -- Una identidad personal no borra casas. Tiene su propia puerta, que ensena
  -- antes lo que va a pasar gremio por gremio.
  if public.clase_credencial() = 'personal' then
    return 'usa_borrar_identidad';
  end if;

  -- Y la clave de la casa tampoco, si dentro vive alguien con identidad
  -- propia: su personaje, su historial y su cartera no son de quien tiene la
  -- clave. Que la casa se disuelva no puede decidirse sin contar con ellas.
  if exists (
    select 1
      from public.pertenencias p
      join public.families f on f.id = p.family_id
     where f.owner = v_uid and p.estado = 'activa'
  ) then
    return 'hay_personas_dentro';
  end if;

  delete from public.families where owner = v_uid;
  get diagnostics v_gremios = row_count;

  -- Los registros SIN familia no se tocan, y conviene saber por que: son
  -- errores anteriores a saber de que casa era la sesion, no tienen forma
  -- fiable de atribuirse a una cuenta, y borrarlos por sesion se llevaria por
  -- delante los de otra gente. Los barre `purge_logs` por antiguedad.
  delete from public.user_limits where user_id = v_uid;
  delete from auth.users where id = v_uid;

  if v_gremios = 0 then
    return 'ok_sin_gremio';
  end if;
  return 'ok';
end $fn$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

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
-- Ningun gremio puede quedarse sin nadie que lo administre. Esto tiene que dar
-- CERO filas:
--
--   select f.id, f.name
--     from public.families f
--    where not exists (select 1 from public.credenciales c
--                       where c.family_id = f.id and c.clase = 'compartida')
--      and not exists (select 1 from public.pertenencias p
--                       where p.family_id = f.id and p.estado = 'activa'
--                         and p.rol in ('titular','gestor'));
--
-- Y la suma de los asientos tiene que seguir reproduciendo cada saldo.
-- ------------------------------------------------------------------
