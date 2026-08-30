-- Migracion 053 · el tipo de gremio deja de ser un `if` repetido.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Piezas 4.1 y 4.3 de la Fase 4. Faltan la 4.2 (capacidades por rol) y la 4.4
-- (pais de operacion).
--
-- ------------------------------------------------------------------
-- POR QUE, Y ES LA MISMA RAZON DE SIEMPRE
--
-- El tipo de gremio ya existe: `families.tipo_gremio` vale 'familia' o 'piso'
-- desde la 032, y ya cambia el comportamiento. Pero esta implementado como
-- **condicionales sueltos**: `tipo_gremio === 'piso'` escrito a mano donde hizo
-- falta. Hoy quedan dos vivos --el texto del mapa de zonas y si dar las gracias
-- exige un encargo previo-- y los dos estan en el cliente.
--
-- Con dos valores y dos efectos se aguanta. Con los tres tipos que vienen
-- --Hogar, Amigos, Equipo-- y siete ejes de efecto, eso son decenas de `if` en
-- sitios que nadie recuerda. Es exactamente el mismo problema que la 050
-- resolvio con los numeros de la expansion: **el tipo tiene que ser una
-- plantilla, no una condicion**.
--
-- ------------------------------------------------------------------
-- LAS TRES CAPAS, Y CUAL ES ESTA
--
--   1 · NUCLEO COMUN     · lo que ningun tipo puede quitar. No se toca.
--   2 · POLITICA DE TIPO · esta plantilla. Decide **como nace** un gremio y
--                          que tiene encendido. Se aplica UNA VEZ, al crear.
--   3 · CONFIGURACION    · lo que cada grupo edita despues, y es suyo.
--
-- La distincion que hace que esto funcione: una plantilla mejorada **no puede
-- reescribir gremios existentes**, porque estaria pisando decisiones que ya no
-- son suyas. Por eso cada gremio guarda **la version con la que nacio** y la
-- conserva aunque la plantilla evolucione.
--
-- ------------------------------------------------------------------
-- POR QUE LOS EJES VAN EN `jsonb` Y NO EN SIETE TABLAS
--
-- Porque se leen **enteros y de una vez**, al abrir el gremio, y no se consulta
-- ninguno por campo: nadie va a preguntar "que gremios tienen los encargos
-- apagados". Siete tablas para eso serian siete `join` y ningun `check` que
-- valga la pena.
--
-- Lo que si hace falta --que no puedan cambiar por detras-- no lo da un `check`:
-- lo da el mismo sello que la 050, un disparador que prohibe `update` y
-- `delete`. Una plantilla publicada es historia.
--
-- ------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE
--
-- **No cambia ni un gremio de los que existen.** Los 'familia' pasan a 'hogar'
-- y los 'piso' a 'hogar_compartido', que es como se llaman los mismos tipos en
-- la especificacion, y sus catalogos, roles, permisos y datos se quedan
-- exactamente igual. `tipo_gremio` no se retira: sigue siendo la columna que
-- lee el cliente viejo, y quitarla es el paso "contraer" de otra tanda.
--
-- **No trae las capacidades por rol** (4.2): eso es un modelo aparte y hoy la
-- unica puerta sigue siendo el PIN, como siempre.
--
-- **No publica Equipo.** Su plantilla existe y esta apagada, que es justo lo
-- que pide la especificacion: especificado y sin publicar hasta su revision
-- juridica.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · LA PLANTILLA
-- ------------------------------------------------------------------

create table if not exists public.plantillas_tipo (
  -- Los cuatro nombres de `R-68` y `TIP-9`. 'hogar_compartido' es el tipo
  -- LEGADO: son los 'piso' que ya existen, siguen funcionando igual, y no se
  -- ofrece al crear un gremio nuevo.
  tipo text not null check (tipo in ('hogar','amigos','equipo','hogar_compartido')),
  -- Misma forma que la version de la configuracion de expansion: legible por
  -- una persona, fecha mas orden dentro del dia.
  version text not null check (version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(\.[0-9]+)?$'),

  nombre_visible text not null check (length(btrim(nombre_visible)) between 2 and 40),
  -- Si se ofrece al crear un gremio. El legado dice que no; Equipo tampoco,
  -- hasta su revision juridica. Y no publicar NO apaga a nadie: los que ya
  -- existen siguen funcionando.
  se_ofrece boolean not null default false,

  -- Los ejes. Se leen enteros al abrir el gremio; ver la cabecera.
  vocabulario jsonb not null default '{}'::jsonb,
  roles jsonb not null default '{}'::jsonb,
  funciones jsonb not null default '{}'::jsonb,
  limites jsonb not null default '{}'::jsonb,

  -- Los dos interruptores que la especificacion pide explicitos y no metidos
  -- en un jsonb, porque de ellos depende la economia entera: en Equipo el
  -- progreso individual esta APAGADO y forjar llaves desde ahi esta PROHIBIDO.
  -- Un gremio de trabajo no puede ser la via barata de subir de nivel.
  progreso_individual boolean not null default true,
  expansion_desde_tipo boolean not null default true,

  motivo text not null check (length(btrim(motivo)) between 3 and 1000),
  aprobada_por text not null check (length(btrim(aprobada_por)) between 2 and 200),
  publicada_at timestamptz not null default now(),

  primary key (tipo, version)
);

comment on table public.plantillas_tipo is
  'Como NACE un gremio de cada tipo. Una fila por tipo y version; no se edita ni se borra, se publica otra version (TIP-3).';

alter table public.plantillas_tipo enable row level security;

-- Mismo patron que `configuracion_expansion`: RLS encendido y sin politicas.
-- La plantilla no es de una familia, es del producto, y lo unico que hace
-- falta fuera es lo que devuelva la funcion de lectura.
revoke all on table public.plantillas_tipo from anon;
revoke all on table public.plantillas_tipo from authenticated;

-- ------------------------------------------------------------------
-- 2 · UNA PLANTILLA PUBLICADA ES HISTORIA
-- ------------------------------------------------------------------

create or replace function public.tg_plantilla_sellada()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  raise exception
    'una plantilla de tipo no se edita ni se borra: se publica una version nueva (TIP-3)'
    using errcode = 'restrict_violation';
end $fn$;

revoke all on function public.tg_plantilla_sellada() from anon;
revoke all on function public.tg_plantilla_sellada() from authenticated;

drop trigger if exists plantillas_tipo_sellada on public.plantillas_tipo;
create trigger plantillas_tipo_sellada
  before update or delete on public.plantillas_tipo
  for each row execute function public.tg_plantilla_sellada();

-- ------------------------------------------------------------------
-- 3 · CADA GREMIO RECUERDA CON QUE NACIO
--
-- Las dos columnas admiten nulos a proposito y por poco tiempo: el relleno de
-- mas abajo las pone a todos los gremios que existen. Un gremio nuevo las
-- recibe del disparador. Nulo quiere decir "creado antes de la 053 y todavia
-- sin clasificar", que no puede pasar despues de ejecutar este fichero.
-- ------------------------------------------------------------------

alter table public.families
  add column if not exists tipo_plantilla text
    check (tipo_plantilla is null or tipo_plantilla in ('hogar','amigos','equipo','hogar_compartido'));
alter table public.families
  add column if not exists plantilla_version text;

comment on column public.families.tipo_plantilla is
  'El tipo, con el vocabulario de la especificacion. `tipo_gremio` sigue existiendo para el cliente viejo.';
comment on column public.families.plantilla_version is
  'La version de plantilla con la que nacio este gremio. Una plantilla mejorada no reescribe gremios existentes (R-44).';

-- El tipo es inmutable, y hasta hoy lo era solo de hecho --no habia pantalla
-- que lo tocara--. Ahora lo es por decision, y se comprueba: no existe ninguna
-- via legitima de cambiarlo en el MVP.
create or replace function public.tg_tipo_inmutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if old.tipo_plantilla is not null and new.tipo_plantilla is distinct from old.tipo_plantilla then
    raise exception 'el tipo de un gremio no se cambia (TIP-2)'
      using errcode = 'restrict_violation';
  end if;
  if old.plantilla_version is not null and new.plantilla_version is distinct from old.plantilla_version then
    raise exception 'un gremio conserva la version de plantilla con la que nacio (TIP-3)'
      using errcode = 'restrict_violation';
  end if;
  -- Y el tipo viejo tampoco, que hasta hoy nadie lo defendia.
  if new.tipo_gremio is distinct from old.tipo_gremio then
    raise exception 'el tipo de un gremio no se cambia (TIP-2)'
      using errcode = 'restrict_violation';
  end if;
  return new;
end $fn$;

revoke all on function public.tg_tipo_inmutable() from anon;
revoke all on function public.tg_tipo_inmutable() from authenticated;

drop trigger if exists families_tipo_inmutable on public.families;
create trigger families_tipo_inmutable
  before update on public.families
  for each row execute function public.tg_tipo_inmutable();

-- ------------------------------------------------------------------
-- 4 · LA PLANTILLA QUE LE TOCA A CADA GREMIO
--
-- Devuelve la de MIS gremios, entera, para que el cliente la lea una vez al
-- abrir y no vuelva a preguntar. Es lo que sustituye a los `if` por tipo.
-- ------------------------------------------------------------------

create or replace function public.plantilla_de_gremio()
returns table (
  family_id uuid,
  tipo text,
  version text,
  nombre_visible text,
  vocabulario jsonb,
  roles jsonb,
  funciones jsonb,
  limites jsonb,
  progreso_individual boolean,
  expansion_desde_tipo boolean
)
language sql
stable
security definer
set search_path = public
as $fn$
  select f.id, t.tipo, t.version, t.nombre_visible,
         t.vocabulario, t.roles, t.funciones, t.limites,
         t.progreso_individual, t.expansion_desde_tipo
    from public.families f
    join public.plantillas_tipo t
      on t.tipo = f.tipo_plantilla and t.version = f.plantilla_version
   where f.id in (select public.mis_gremios());
$fn$;

revoke all on function public.plantilla_de_gremio() from public;
revoke all on function public.plantilla_de_gremio() from anon;
grant execute on function public.plantilla_de_gremio() to authenticated;

-- Y que tipos se pueden ofrecer al crear un gremio. Lo decide el servidor: un
-- cliente que pinte un tipo de mas no consigue nada, porque quien crea el
-- gremio mira esto.
create or replace function public.tipos_ofrecidos()
returns table (tipo text, version text, nombre_visible text)
language sql
stable
security definer
set search_path = public
as $fn$
  select t.tipo, t.version, t.nombre_visible
    from public.plantillas_tipo t
   where t.se_ofrece
     and t.version = (select max(v.version) from public.plantillas_tipo v where v.tipo = t.tipo)
   order by t.tipo;
$fn$;

revoke all on function public.tipos_ofrecidos() from public;
revoke all on function public.tipos_ofrecidos() from anon;
grant execute on function public.tipos_ofrecidos() to authenticated;

-- ------------------------------------------------------------------
-- 5 · LAS CUATRO PLANTILLAS
--
-- Los textos son EXACTAMENTE los que hoy estan escritos a mano en el cliente.
-- Ese es el criterio de esta migracion: ningun gremio cambia de nada, solo
-- cambia de donde sale el texto.
-- ------------------------------------------------------------------

insert into public.plantillas_tipo
  (tipo, version, nombre_visible, se_ofrece, vocabulario, roles, funciones, limites,
   progreso_individual, expansion_desde_tipo, motivo, aprobada_por)
select * from (values
  ('hogar', '2026-08-30.1', 'Hogar', true,
   jsonb_build_object(
     'zonas_intro', 'El mapa del modo limpieza: de estas zonas salen las campañas de zona y de limpieza profunda.'),
   jsonb_build_object('visibles', jsonb_build_array('adulto','junior','peque','mascota'),
                      'al_fundar', 'adulto'),
   -- `encargos`: si dar las gracias parte de una tarea encargada. En una casa
   -- con adultos y criaturas hay quien reparte; en un piso o entre amigos, no.
   jsonb_build_object('encargos', true, 'zonas_privadas', false),
   jsonb_build_object(), true, true,
   'Primera version. Es el tipo ''familia'' de la 032 con el nombre de R-68, y sin un solo cambio de comportamiento.',
   'producto · R-68, TIP-9'),

  ('hogar_compartido', '2026-08-30.1', 'Hogar compartido', false,
   jsonb_build_object(
     'zonas_intro', 'Este gremio es de compañeros de piso: cada habitación tiene su dueño, y las campañas se la sugieren a esa persona.'),
   jsonb_build_object('visibles', jsonb_build_array('adulto'), 'al_fundar', 'adulto'),
   jsonb_build_object('encargos', false, 'zonas_privadas', true),
   jsonb_build_object(), true, true,
   'Tipo LEGADO: son los ''piso'' que ya existen. Siguen funcionando exactamente igual y no se ofrece al crear (R-78, TIP-9).',
   'producto · R-78, TIP-9'),

  ('amigos', '2026-08-30.1', 'Amigos', false,
   jsonb_build_object(
     'zonas_intro', 'Las zonas de este grupo: de aquí salen las campañas compartidas.'),
   jsonb_build_object('visibles', jsonb_build_array('adulto'), 'al_fundar', 'adulto'),
   jsonb_build_object('encargos', false, 'zonas_privadas', false),
   jsonb_build_object(), true, true,
   'Escrita pero SIN OFRECER: su catalogo de misiones y recompensas todavia esta sin validar con un grupo real, y un tipo que nace vacio es peor que un tipo que no esta.',
   'producto · R-68'),

  ('equipo', '2026-08-30.1', 'Equipo', false,
   jsonb_build_object('zonas_intro', 'Las zonas de este equipo.'),
   jsonb_build_object('visibles', jsonb_build_array('adulto'), 'al_fundar', 'adulto'),
   jsonb_build_object('encargos', true, 'zonas_privadas', false),
   jsonb_build_object(),
   -- Los dos interruptores de TIP-13, y el motivo importa: si el progreso de un
   -- equipo contara y se pudiera forjar desde ahi, un gremio de trabajo seria
   -- la via mas barata de subir de nivel y ganar monedas para gastarlas fuera.
   false, false,
   'Especificada y APAGADA hasta su revision juridica (R-77). Progreso individual apagado y expansion prohibida (TIP-13, R-114).',
   'producto · R-77, R-114, TIP-10')
) as v(tipo, version, nombre_visible, se_ofrece, vocabulario, roles, funciones, limites,
       progreso_individual, expansion_desde_tipo, motivo, aprobada_por)
where not exists (
  select 1 from public.plantillas_tipo p where p.tipo = v.tipo and p.version = v.version
);

-- ------------------------------------------------------------------
-- 6 · LOS GREMIOS QUE YA EXISTEN
--
-- 'familia' -> 'hogar' y 'piso' -> 'hogar_compartido'. Es un cambio de nombre,
-- no de comportamiento: mismos catalogos, mismos roles, mismos permisos, mismos
-- datos.
-- ------------------------------------------------------------------

-- El disparador de inmutabilidad deja pasar el relleno porque solo se queja
-- cuando el valor ANTERIOR no era nulo.
update public.families
   set tipo_plantilla = case tipo_gremio when 'piso' then 'hogar_compartido' else 'hogar' end,
       plantilla_version = '2026-08-30.1'
 where tipo_plantilla is null;

-- Y el gremio que se funde manana, sin tocar el cliente: recibe la plantilla
-- que corresponda a su `tipo_gremio`, en su version mas reciente.
create or replace function public.tg_plantilla_de_gremio_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tipo text;
  v_version text;
begin
  if new.tipo_plantilla is not null and new.plantilla_version is not null then
    return new;
  end if;
  v_tipo := coalesce(new.tipo_plantilla,
                     case new.tipo_gremio when 'piso' then 'hogar_compartido' else 'hogar' end);
  select max(version) into v_version from public.plantillas_tipo where tipo = v_tipo;
  if v_version is null then
    raise exception 'no hay plantilla publicada para el tipo %', v_tipo;
  end if;
  new.tipo_plantilla := v_tipo;
  new.plantilla_version := v_version;
  return new;
end $fn$;

revoke all on function public.tg_plantilla_de_gremio_nuevo() from anon;
revoke all on function public.tg_plantilla_de_gremio_nuevo() from authenticated;

drop trigger if exists families_plantilla on public.families;
create trigger families_plantilla
  before insert on public.families
  for each row execute function public.tg_plantilla_de_gremio_nuevo();

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
--   select tipo_gremio, tipo_plantilla, plantilla_version, count(*)
--     from public.families group by 1,2,3;
--   -- ningun nulo, y 'piso' <-> 'hogar_compartido'
--
--   select * from public.tipos_ofrecidos();   -- solo Hogar
--
-- Y los tres que tienen que fallar: cambiar el tipo de un gremio, editar una
-- plantilla publicada, y borrarla.
-- ------------------------------------------------------------------
