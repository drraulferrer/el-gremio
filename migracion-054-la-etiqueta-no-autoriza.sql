-- Migracion 054 · la etiqueta visible no autoriza nada.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Pieza 4.2 de la Fase 4. Falta la 4.4 (pais de operacion).
--
-- ------------------------------------------------------------------
-- LOS TRES EJES QUE HOY SON UNO SOLO
--
-- Con una cuenta por casa, "permiso" significa hoy una sola cosa: saberse el
-- PIN. Con varias personas, varios gremios y tres tipos hacen falta tres ejes
-- distintos, y lo importante es **no mezclarlos nunca**:
--
--   * CAPACIDAD    · la unidad de autorizacion. Nombre estable, comprobable en
--                    servidor, independiente del tipo. **Es lo unico que
--                    autoriza.**
--   * ROL INTERNO  · un paquete de capacidades. El mismo en los tres tipos.
--   * ROL VISIBLE  · la etiqueta que lee la gente. Cambia por tipo. **No
--                    autoriza nada.**
--
-- El tercero es el que trae los accidentes. Es comodisimo escribir
-- `if rol = 'gestor'` en una funcion, y el dia que un tipo llame "Organizador"
-- a otra cosa, esa linea autoriza a quien no debia. Por eso las funciones
-- preguntan por CAPACIDAD y nunca por etiqueta.
--
-- ------------------------------------------------------------------
-- COMO SE RESUELVE QUIEN PUEDE QUE
--
-- El permiso se comprueba **contra la pertenencia activa en el gremio de la
-- operacion**, nunca contra el gremio activo de la sesion: en cuanto hay dos
-- gremios son cosas distintas.
--
--   1 · Si tengo pertenencia activa en ESE gremio, mi rol es el de la
--       pertenencia (titular, gestor, miembro).
--   2 · Si no, y soy la credencial compartida de ESE gremio, el rol es el del
--       PERSONAJE que se esta operando (adulto, junior, peque, mascota). Es lo
--       que hay hoy: en una casa manda quien sabe el PIN, y las peques no.
--   3 · Si no, no soy nadie ahi. 'no'.
--
-- Devuelve tres valores y no un booleano: 'no', 'si' y **'pin'**. El PIN sigue
-- siendo una puerta de verdad --protege el panel de SU gremio, y saber el de A
-- no abre el de B-- y una capacidad que lo exige no es lo mismo que una que no.
--
-- ------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO CAMBIA
--
-- **Nada de lo que hoy puede hacer alguien.** Las tres funciones que empiezan a
-- preguntar por capacidad --el premio a mano y las dos de las campanas de
-- limpieza-- comprobaban `role = 'adulto'`, y la matriz devuelve exactamente
-- eso: un adulto con la clave de la casa puede, y una junior o una peque no.
-- La diferencia es de donde sale la respuesta.
--
-- **El PIN se sigue comprobando en el cliente**, como hasta hoy. Que la matriz
-- diga 'pin' no lo verifica: dice que hace falta. Verificarlo en servidor exige
-- que el PIN viaje en cada llamada, y eso es otra tanda.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · EL CATALOGO DE CAPACIDADES
--
-- Nombres estables. Que sean una tabla y no un `check` es a proposito: una
-- capacidad nueva es una fila, y las plantillas ya publicadas no la tienen, que
-- es exactamente lo correcto -- una plantilla no gana permisos por que alguien
-- invente una capacidad despues.
-- ------------------------------------------------------------------

create table if not exists public.capacidades (
  codigo text primary key check (codigo ~ '^CAP-[0-9]{2}$'),
  nombre text not null check (length(btrim(nombre)) between 3 and 120),
  -- Si es de PERSONA: los personajes sin identidad no la tienen nunca, porque
  -- no hay a quien cargarle el gasto.
  de_persona boolean not null default false
);

alter table public.capacidades enable row level security;
revoke all on table public.capacidades from anon;
revoke all on table public.capacidades from authenticated;

insert into public.capacidades (codigo, nombre, de_persona) values
  ('CAP-01', 'Invitar a una persona a este gremio', false),
  ('CAP-02', 'Revocar una invitacion de este gremio', false),
  ('CAP-03', 'Expulsar a una persona', false),
  ('CAP-04', 'Cambiar los ajustes del gremio', false),
  ('CAP-05', 'Crear, editar y archivar misiones', false),
  ('CAP-06', 'Asignar misiones', false),
  ('CAP-07', 'Validar misiones completadas', false),
  ('CAP-08', 'Crear, editar y retirar recompensas', false),
  ('CAP-09', 'Conceder o entregar una recompensa', false),
  ('CAP-10', 'Administrar miembros y sus roles internos', false),
  ('CAP-11', 'Consultar la actividad y los registros del gremio', false),
  ('CAP-12', 'Consultar el saldo propio y sus asientos', false),
  ('CAP-13', 'Forjar una llave desde este gremio', true),
  ('CAP-14', 'Usar una llave', true),
  ('CAP-15', 'Cerrar el gremio o traspasar la titularidad', false),
  ('CAP-16', 'Autorizar la solicitud de un junior', false),
  ('CAP-17', 'Convertirse en persona', false)
on conflict (codigo) do nothing;

-- ------------------------------------------------------------------
-- 2 · EL REPARTO, QUE ES DE LA PLANTILLA
--
-- Va colgado de (tipo, version) y no suelto: un gremio se rige por el reparto
-- con el que nacio, igual que por el resto de su plantilla.
-- ------------------------------------------------------------------

create table if not exists public.plantilla_capacidades (
  tipo text not null,
  version text not null,
  -- Los dos juegos de roles, en la misma columna a proposito: son el mismo eje
  -- --"que soy yo en este gremio"-- resuelto por dos caminos distintos.
  rol text not null check (rol in (
    'titular','gestor','miembro',            -- pertenencia de una persona
    'adulto','junior','peque','mascota'      -- personaje con credencial compartida
  )),
  capacidad text not null references public.capacidades(codigo),
  -- 'no' · 'si' · 'pin' (permitida, pero pasando por el PIN del gremio)
  permiso text not null check (permiso in ('no','si','pin')),
  primary key (tipo, version, rol, capacidad),
  foreign key (tipo, version) references public.plantillas_tipo(tipo, version) on delete restrict
);

alter table public.plantilla_capacidades enable row level security;
revoke all on table public.plantilla_capacidades from anon;
revoke all on table public.plantilla_capacidades from authenticated;

drop trigger if exists plantilla_capacidades_sellada on public.plantilla_capacidades;
create trigger plantilla_capacidades_sellada
  before update or delete on public.plantilla_capacidades
  for each row execute function public.tg_plantilla_sellada();

-- ------------------------------------------------------------------
-- 3 · LA MATRIZ
--
-- Una sola, aplicada a las cuatro plantillas. Los tres tipos comparten el
-- conjunto de capacidades y hoy tambien el reparto: lo que distingue a Equipo
-- son sus dos interruptores y su limite de contenido, que ya estan en la 053.
--
-- Lo que la especificacion deja pendiente para `miembro` --si puede crear o
-- validar misiones-- se siembra en **no**, que es la lectura conservadora: es
-- mas facil conceder despues que quitar lo que alguien ya usaba.
-- ------------------------------------------------------------------

insert into public.plantilla_capacidades (tipo, version, rol, capacidad, permiso)
select t.tipo, t.version, m.rol, m.capacidad, m.permiso
  from public.plantillas_tipo t
  cross join (values
    -- Personas con identidad · titular
    ('titular','CAP-01','si'),  ('titular','CAP-02','si'),  ('titular','CAP-03','pin'),
    ('titular','CAP-04','pin'), ('titular','CAP-05','si'),  ('titular','CAP-06','si'),
    ('titular','CAP-07','si'),  ('titular','CAP-08','si'),  ('titular','CAP-09','si'),
    ('titular','CAP-10','pin'), ('titular','CAP-11','si'),  ('titular','CAP-12','si'),
    ('titular','CAP-13','si'),  ('titular','CAP-14','si'),  ('titular','CAP-15','pin'),
    ('titular','CAP-16','pin'), ('titular','CAP-17','no'),
    -- gestor · como titular salvo cerrar o traspasar el gremio, que es de quien
    -- lo fundo y de nadie mas
    ('gestor','CAP-01','si'),   ('gestor','CAP-02','si'),   ('gestor','CAP-03','pin'),
    ('gestor','CAP-04','pin'),  ('gestor','CAP-05','si'),   ('gestor','CAP-06','si'),
    ('gestor','CAP-07','si'),   ('gestor','CAP-08','si'),   ('gestor','CAP-09','si'),
    ('gestor','CAP-10','pin'),  ('gestor','CAP-11','si'),   ('gestor','CAP-12','si'),
    ('gestor','CAP-13','si'),   ('gestor','CAP-14','si'),   ('gestor','CAP-15','no'),
    ('gestor','CAP-16','pin'),  ('gestor','CAP-17','no'),
    -- miembro · esta dentro y juega; no administra
    ('miembro','CAP-01','no'),  ('miembro','CAP-02','no'),  ('miembro','CAP-03','no'),
    ('miembro','CAP-04','no'),  ('miembro','CAP-05','no'),  ('miembro','CAP-06','no'),
    ('miembro','CAP-07','no'),  ('miembro','CAP-08','no'),  ('miembro','CAP-09','no'),
    ('miembro','CAP-10','no'),  ('miembro','CAP-11','si'),  ('miembro','CAP-12','si'),
    ('miembro','CAP-13','si'),  ('miembro','CAP-14','si'),  ('miembro','CAP-15','no'),
    ('miembro','CAP-16','no'),  ('miembro','CAP-17','no'),
    -- Personajes con credencial compartida · adulto: lo de siempre, con el PIN
    ('adulto','CAP-01','pin'),  ('adulto','CAP-02','pin'),  ('adulto','CAP-03','pin'),
    ('adulto','CAP-04','pin'),  ('adulto','CAP-05','pin'),  ('adulto','CAP-06','pin'),
    ('adulto','CAP-07','pin'),  ('adulto','CAP-08','pin'),  ('adulto','CAP-09','pin'),
    ('adulto','CAP-10','pin'),  ('adulto','CAP-11','pin'),  ('adulto','CAP-12','si'),
    -- Forjar y usar llaves son de PERSONA: una credencial compartida no puede,
    -- porque no hay a quien cargarle el gasto.
    ('adulto','CAP-13','no'),   ('adulto','CAP-14','no'),   ('adulto','CAP-15','pin'),
    ('adulto','CAP-16','pin'),  ('adulto','CAP-17','si'),
    -- junior · progresa como cualquiera y no ejecuta nada. Convertirse va
    -- detras de su revision juridica.
    ('junior','CAP-01','no'),   ('junior','CAP-02','no'),   ('junior','CAP-03','no'),
    ('junior','CAP-04','no'),   ('junior','CAP-05','no'),   ('junior','CAP-06','no'),
    ('junior','CAP-07','no'),   ('junior','CAP-08','no'),   ('junior','CAP-09','no'),
    ('junior','CAP-10','no'),   ('junior','CAP-11','no'),   ('junior','CAP-12','si'),
    ('junior','CAP-13','no'),   ('junior','CAP-14','no'),   ('junior','CAP-15','no'),
    ('junior','CAP-16','no'),   ('junior','CAP-17','no'),
    -- peque y mascota · su saldo y nada mas
    ('peque','CAP-01','no'),    ('peque','CAP-02','no'),    ('peque','CAP-03','no'),
    ('peque','CAP-04','no'),    ('peque','CAP-05','no'),    ('peque','CAP-06','no'),
    ('peque','CAP-07','no'),    ('peque','CAP-08','no'),    ('peque','CAP-09','no'),
    ('peque','CAP-10','no'),    ('peque','CAP-11','no'),    ('peque','CAP-12','si'),
    ('peque','CAP-13','no'),    ('peque','CAP-14','no'),    ('peque','CAP-15','no'),
    ('peque','CAP-16','no'),    ('peque','CAP-17','no'),
    ('mascota','CAP-01','no'),  ('mascota','CAP-02','no'),  ('mascota','CAP-03','no'),
    ('mascota','CAP-04','no'),  ('mascota','CAP-05','no'),  ('mascota','CAP-06','no'),
    ('mascota','CAP-07','no'),  ('mascota','CAP-08','no'),  ('mascota','CAP-09','no'),
    ('mascota','CAP-10','no'),  ('mascota','CAP-11','no'),  ('mascota','CAP-12','si'),
    ('mascota','CAP-13','no'),  ('mascota','CAP-14','no'),  ('mascota','CAP-15','no'),
    ('mascota','CAP-16','no'),  ('mascota','CAP-17','no')
  ) as m(rol, capacidad, permiso)
 where not exists (
   select 1 from public.plantilla_capacidades c
    where c.tipo = t.tipo and c.version = t.version
      and c.rol = m.rol and c.capacidad = m.capacidad
 );

-- ------------------------------------------------------------------
-- 4 · LA PREGUNTA
-- ------------------------------------------------------------------

create or replace function public.puede(
  p_family uuid,
  p_capacidad text,
  p_profile uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_rol text;
  v_tipo text;
  v_version text;
  v_permiso text;
begin
  if v_uid is null or p_family is null then return 'no'; end if;

  select tipo_plantilla, plantilla_version into v_tipo, v_version
    from public.families where id = p_family;
  if v_tipo is null then return 'no'; end if;

  -- 1 · Pertenencia activa EN ESE GREMIO. Nunca el gremio activo de la sesion.
  select p.rol into v_rol
    from public.pertenencias p
   where p.persona = v_uid and p.family_id = p_family and p.estado = 'activa';

  -- 2 · O la credencial compartida de ese gremio, y entonces manda el rol del
  --     personaje que se opera.
  if v_rol is null then
    if not exists (
      select 1 from public.credenciales c
       where c.user_id = v_uid and c.clase = 'compartida' and c.family_id = p_family
    ) then
      return 'no';
    end if;
    if p_profile is null then return 'no'; end if;
    select pr.role into v_rol
      from public.profiles pr
     where pr.id = p_profile and pr.family_id = p_family and pr.active;
    if v_rol is null then return 'no'; end if;
  end if;

  select c.permiso into v_permiso
    from public.plantilla_capacidades c
   where c.tipo = v_tipo and c.version = v_version
     and c.rol = v_rol and c.capacidad = p_capacidad;

  -- Lo que no esta declarado, no esta permitido. Una capacidad inventada
  -- despues de publicar una plantilla no la gana nadie por sorpresa.
  return coalesce(v_permiso, 'no');
end $fn$;

revoke all on function public.puede(uuid, text, uuid) from public;
revoke all on function public.puede(uuid, text, uuid) from anon;
grant execute on function public.puede(uuid, text, uuid) to authenticated;

-- ------------------------------------------------------------------
-- 5 · LAS TRES QUE EMPIEZAN A PREGUNTAR POR CAPACIDAD
--
-- Comprobaban `role = 'adulto'` a mano. La matriz devuelve exactamente lo
-- mismo para lo que hay hoy --un adulto con la clave de la casa puede, una
-- junior o una peque no-- asi que esto no cambia lo que nadie puede hacer. Lo
-- que cambia es de donde sale la respuesta, y que el dia que un tipo reparta
-- distinto, estas tres se enteran solas.
--
-- Se pasan TRES y no las ocho a proposito: son las que hoy tienen una
-- comprobacion de rol de verdad. Poner `puede()` donde no habia nada seria
-- inventarse un permiso, no trasladarlo.
-- ------------------------------------------------------------------

create or replace function public.grant_manual_bonus(
  p_id uuid,
  p_coins integer,
  p_motivo text,
  p_otorgado_por uuid,
  p_clave text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_tz text;
  v_rol_quien text;
  v_family_quien uuid;
begin
  -- Idempotencia. Es la UNICA de las ocho sin guarda propia: un premio a
  -- mano se puede repetir a proposito, y por eso el indice unico de bonuses
  -- excluye el tipo 'manual'. Sin clave, un doble clic regala dos veces.
  if p_clave is not null and exists (select 1 from public.movimientos_coins where clave = p_clave) then
    return 'ok';
  end if;
  -- Tope contra el dedo gordo: teclear 500 donde iban 50 descuadra la
  -- economía de un mes, y eso sí pasa. No es antifraude.
  if p_coins is null or p_coins <= 0 or p_coins > 200 then
    return 'cantidad_invalida';
  end if;

  if p_motivo is null or length(btrim(p_motivo)) < 3 then
    return 'sin_motivo';
  end if;

  select family_id into v_family from public.profiles where id = p_id and active;
  if v_family is null then
    return 'no_existe';
  end if;

  if not public.es_mi_gremio(v_family) then
    return 'no_es_tuyo';
  end if;

  select role, family_id into v_rol_quien, v_family_quien
    from public.profiles where id = p_otorgado_por and active;

  if v_rol_quien is null or v_family_quien is distinct from v_family then
    return 'quien_no_existe';
  end if;

  -- Por capacidad y no por etiqueta (054). Devuelve lo mismo que el
  -- `v_rol_quien <> 'adulto'` de antes --un adulto con la clave de la casa
  -- puede, una junior o una peque no-- pero ahora la respuesta sale de la
  -- plantilla del gremio y no de una cadena escrita aqui.
  if public.puede(v_family, 'CAP-09', p_otorgado_por) = 'no' then
    return 'no_es_adulto';
  end if;

  select timezone into v_tz from public.families where id = v_family;

  insert into public.bonuses (family_id, profile_id, tipo, coins, motivo, otorgado_por, dia)
  values (v_family, p_id, 'manual', p_coins, btrim(p_motivo), p_otorgado_por,
          (now() at time zone v_tz)::date);

  -- Solo monedas. La XP no se toca a propósito: marca el nivel y alimenta
  -- la meta, y las dos están calculadas contra un ritmo.
  perform public.motivo_coins('bonus_manual', null, p_clave);
  update public.profiles set coins = coins + p_coins where id = p_id;

  return 'ok';
end $fn$;

create or replace function public.crear_campana_limpieza(
  p_activada_por uuid,
  p_tipo text,
  p_clave text,
  p_titulo text,
  p_emoji text,
  p_dias integer,
  p_tareas jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_rol text;
  v_tz text;
  v_hoy date;
  v_campana uuid;
  t jsonb;
  v_perfil uuid;
  v_xp integer;
  v_coins integer;
  v_title text;
  v_familia_perfil uuid;
  v_rol_perfil text;
  v_activo boolean;
begin
  select family_id, role into v_family, v_rol
    from public.profiles where id = p_activada_por and active;
  if v_family is null then return 'quien_no_existe'; end if;

  if not public.es_mi_gremio(v_family) then
    return 'no_es_tuyo';
  end if;

  -- Por capacidad y no por etiqueta (054): misma respuesta, otro origen.
  if public.puede(v_family, 'CAP-05', p_activada_por) = 'no' then return 'no_es_adulto'; end if;

  if p_tipo is null or p_tipo not in ('blitz','zona','profunda') then return 'tipo_invalido'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 30 then return 'duracion_invalida'; end if;
  if p_titulo is null or length(btrim(p_titulo)) < 3 or length(p_titulo) > 120 then return 'titulo_invalido'; end if;
  if p_tareas is null or jsonb_typeof(p_tareas) <> 'array'
     or jsonb_array_length(p_tareas) < 1 or jsonb_array_length(p_tareas) > 40 then
    return 'sin_tareas';
  end if;

  -- Una operación cada vez: dos campañas solapadas dejan de ser un
  -- acontecimiento y pasan a ser el tablón de siempre con otro nombre.
  if exists (
    select 1 from public.campanas_limpieza c where c.family_id = v_family and c.estado = 'activa'
  ) then
    return 'ya_hay_activa';
  end if;

  -- Se valida TODO antes de escribir NADA: o entra la campaña entera o
  -- no entra ninguna fila. El `exception` caza un profile_id que no sea
  -- ni siquiera un uuid.
  begin
    for t in select * from jsonb_array_elements(p_tareas) loop
      v_perfil := (t->>'profile_id')::uuid;
      v_xp := (t->>'xp')::integer;
      v_coins := (t->>'coins')::integer;
      v_title := t->>'title';

      if v_title is null or length(btrim(v_title)) < 3 or length(v_title) > 120 then return 'tarea_invalida'; end if;
      -- Topes de cordura contra el dedo gordo, no antifraude: una tarea
      -- no puede pagar más que un premio a mano pequeño.
      if v_xp is null or v_xp < 1 or v_xp > 60 then return 'tarea_invalida'; end if;
      if v_coins is null or v_coins < 1 or v_coins > 40 then return 'tarea_invalida'; end if;

      select family_id, role, active into v_familia_perfil, v_rol_perfil, v_activo
        from public.profiles where id = v_perfil;
      if v_familia_perfil is distinct from v_family or not coalesce(v_activo, false)
         or v_rol_perfil = 'mascota' then
        return 'tarea_invalida';
      end if;
    end loop;
  exception
    when invalid_text_representation then return 'tarea_invalida';
    when numeric_value_out_of_range then return 'tarea_invalida';
  end;

  select timezone into v_tz from public.families where id = v_family;
  v_hoy := (now() at time zone coalesce(v_tz, 'Europe/Madrid'))::date;

  -- La carrera de dos aparatos lanzando a la vez se resuelve AQUÍ: los
  -- dos pasan la comprobación de arriba y el índice único parcial tumba
  -- al segundo. Comprobar antes con un select y capturar la violación
  -- es el mismo par que usa grant_daily_bonus con su tope diario.
  begin
    insert into public.campanas_limpieza (family_id, tipo, clave, titulo, emoji, empieza, termina, activada_por)
    values (v_family, p_tipo, left(coalesce(nullif(btrim(p_clave), ''), p_tipo), 80), btrim(p_titulo),
            coalesce(nullif(p_emoji, ''), '🧹'), v_hoy, v_hoy + (p_dias - 1), p_activada_por)
    returning id into v_campana;
  exception when unique_violation then
    return 'ya_hay_activa';
  end;

  for t in select * from jsonb_array_elements(p_tareas) loop
    insert into public.challenges (family_id, profile_id, title, emoji, xp, coins, frequency, skill, campana_id)
    values (v_family, (t->>'profile_id')::uuid, btrim(t->>'title'),
            coalesce(nullif(t->>'emoji', ''), '🧹'),
            (t->>'xp')::integer, (t->>'coins')::integer, 'unico', 'hogar', v_campana);
  end loop;

  return 'ok';
end $fn$;

create or replace function public.cerrar_campana_limpieza(p_campana uuid, p_quien uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_estado text;
  v_titulo text;
  v_termina date;
  v_rol text;
  v_family_quien uuid;
  v_tz text;
  v_hoy date;
  v_total integer;
  v_hechas integer;
  r record;
begin
  select family_id, estado, titulo, termina into v_family, v_estado, v_titulo, v_termina
    from public.campanas_limpieza where id = p_campana;
  if v_family is null then return 'no_existe'; end if;

  if not public.es_mi_gremio(v_family) then
    return 'no_es_tuyo';
  end if;

  select role, family_id into v_rol, v_family_quien
    from public.profiles where id = p_quien and active;
  if v_rol is null or v_family_quien is distinct from v_family then return 'quien_no_existe'; end if;
  -- Por capacidad y no por etiqueta (054): misma respuesta, otro origen.
  if public.puede(v_family, 'CAP-05', p_quien) = 'no' then return 'no_es_adulto'; end if;

  if v_estado <> 'activa' then return 'ya_cerrada'; end if;

  select timezone into v_tz from public.families where id = v_family;
  v_hoy := (now() at time zone coalesce(v_tz, 'Europe/Madrid'))::date;

  select count(*),
         count(*) filter (where exists (
           select 1 from public.completions co
            where co.challenge_id = ch.id and co.status = 'aprobado'))
    into v_total, v_hechas
    from public.challenges ch
   where ch.campana_id = p_campana;

  if v_total > 0 and v_hechas = v_total then
    -- La misma cuenta que botinPrevisto en src/lib/limpieza.js: si se
    -- toca un redondeo, hay que tocar los dos sitios.
    begin
      for r in
        select co.profile_id, floor(sum(co.coins) / 2.0)::integer as botin
          from public.completions co
          join public.challenges ch on ch.id = co.challenge_id
         where ch.campana_id = p_campana and co.status = 'aprobado'
         group by co.profile_id
      loop
        if r.botin > 0 then
          insert into public.bonuses (family_id, profile_id, tipo, coins, motivo, otorgado_por, dia)
          values (v_family, r.profile_id, 'limpieza:' || p_campana::text, r.botin,
                  'Botín de «' || v_titulo || '»', p_quien, v_hoy);
          perform public.motivo_coins('botin_limpieza', p_campana);
          update public.profiles set coins = coins + r.botin where id = r.profile_id;
        end if;
      end loop;

      update public.campanas_limpieza set estado = 'completada', cerrada_at = now() where id = p_campana;
    exception when unique_violation then
      -- Dos adultos cerrando a la vez: el índice de «uno al día» de
      -- bonuses tumba al segundo al pagar el mismo botín, y su
      -- transacción entera se deshace —monedas incluidas—. El primero
      -- ya cerró: esto es un 'ya_cerrada' con otra cara, no un fallo.
      return 'ya_cerrada';
    end;
    return 'ok';
  end if;

  if v_hoy > v_termina then
    -- Lo no hecho se pausa, no se borra: pausada vuelve a la biblioteca
    -- del panel, y borrarla con historial ni siquiera dejaría (029).
    update public.challenges ch set active = false
     where ch.campana_id = p_campana
       and not exists (
         select 1 from public.completions co
          where co.challenge_id = ch.id and co.status = 'aprobado'
       );
    update public.campanas_limpieza set estado = 'expirada', cerrada_at = now() where id = p_campana;
    return 'expirada';
  end if;

  return 'aun_no';
end $fn$;

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
--   select tipo, count(*) from public.plantilla_capacidades group by 1;
--   -- 119 por plantilla (7 roles x 17 capacidades)
--
-- Y con una sesion de la casa: `puede(gremio,'CAP-09',<adulto>)` = 'pin',
-- `puede(gremio,'CAP-09',<peque>)` = 'no', y `puede(<otro gremio>,...)` = 'no'.
-- ------------------------------------------------------------------
