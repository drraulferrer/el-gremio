-- Migracion 050 · las reglas de la expansion dejan de ser constantes.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Pieza 3.1 de la Fase 3: §11.4 de la especificacion (`R-16`, `R-66`, `D-10`,
-- `CFG-1` a `CFG-7`, `DEP-4`).
--
-- ------------------------------------------------------------------
-- QUE PROBLEMA RESUELVE
--
-- Hoy los numeros de la expansion --que nivel habilita la primera llave, que
-- cuesta, cuantos gremios puede tener una persona, cuanto duran las cosas-- no
-- viven en ningun sitio consultable. Estan en dos formas, y las dos son malas
-- para lo que viene:
--
--   * como constantes de un modulo de JavaScript, que el servidor no lee;
--   * como literales dentro de funciones SQL, que nadie puede consultar sin
--     leerse el cuerpo de la funcion.
--
-- Eso vale mientras nadie decida nada con ellos. Cuando la Fase 5 empiece a
-- cobrar 300 monedas por una llave, el numero tiene que estar donde el servidor
-- lo lea en el momento de cobrar (`CFG-2`), tiene que poder cambiar sin
-- reescribir el pasado (`CFG-3`, `CFG-5`), y tiene que quedar dicho quien lo
-- cambio y por que (`CFG-4`).
--
-- ------------------------------------------------------------------
-- LA FORMA: UNA VERSION ES UN BLOQUE, Y UN BLOQUE NO SE TOCA
--
-- Una fila de `configuracion_expansion` con los parametros globales, sus
-- escalones en `escalones_expansion` y su matriz de disponibilidad en
-- `disponibilidad_tipos`. Las tres se escriben JUNTAS, en una transaccion, y
-- despues ninguna de las tres admite `update` ni `delete`. Cambiar una regla
-- es publicar una version nueva; el pasado se queda como estaba y se puede
-- responder "que reglas regian el 12 de octubre" mirando una tabla.
--
-- Esto no es una precaucion abstracta. `CAM-1` a `CAM-6` dicen que subir un
-- umbral no retira una llave ya comprada y que subir un coste no cobra la
-- diferencia. La unica forma barata de cumplir eso es que la llave guarde la
-- version con la que se compro (`S-12`) y que esa version siga existiendo tal
-- cual. Si la configuracion se editara encima, el recibo de ayer mentiria.
--
-- ------------------------------------------------------------------
-- SIN CONFIGURACION VALIDA NO SE EXPANDE NADIE (`CFG-6`)
--
-- Es la regla que decide la forma de las funciones de lectura, y por eso
-- ninguna devuelve un numero por defecto:
--
--   * `parametros_expansion()`, `escala_expansion()` y `hito_expansion()`
--     devuelven CERO FILAS cuando no hay version vigente. Cero filas no se
--     puede confundir con un permiso ni recoger con un `coalesce` distraido;
--   * `tipo_publicado()` devuelve `false` cuando no hay version o cuando el
--     par tipo/pais no esta declarado. Lo que no esta publicado, no lo esta.
--
-- Si alguien anade manana un `coalesce(coste, 300)` en la funcion que forja,
-- esta migracion no habra servido de nada. Lo defiende `tests/configuracion.test.js`.
--
-- ------------------------------------------------------------------
-- POR QUE LOS COSTES SE GUARDAN UNO A UNO, Y NO SOLO LA FORMULA
--
-- La regla aprobada es geometrica: coste(k) = 300 x 2,5^(k-1). Guardar solo
-- `coste_base` y `factor` seria mas corto, pero obligaria a que alguien
-- calculara la potencia --el servidor al cobrar y el cliente al pintar-- y esa
-- es exactamente la segunda fuente de verdad que `CFG-1` prohibe. Es el error
-- que ya existe con la curva de nivel (`H-22`), escrita en dos sitios.
--
-- Asi que manda la fila: `escalones_expansion` guarda el coste que se cobra.
-- `coste_base`, `factor` y `regla_crecimiento` se guardan al lado porque
-- `R-66` los pide como campo minimo --son la procedencia del numero, no el
-- numero-- y un disparador comprueba que las filas siguen cuadrando con la
-- regla declarada. Declarar una cosa y guardar otra falla al publicar.
--
-- Por lo mismo, `parametros_expansion()` NO devuelve `coste_base` ni `factor`:
-- el cliente no tiene ningun motivo para recalcular un coste que ya le llega
-- hecho, y si no los recibe no puede hacerlo.
--
-- ------------------------------------------------------------------
-- LOS NUMEROS SON LOS DE LA CALIBRACION, Y NO SE ELIGEN AQUI
--
-- Nivel 6, coste base 300 Talis, factor x2,5, hitos en 6-8-10-12, limite de 5
-- pertenencias. Salen de la calibracion del 29-ago-2026 (§11.2 de la
-- especificacion, propuestas 1 a 3, `R-59`, `R-85`) hecha con los valores
-- reales del repositorio, y los defiende `tests/expansion.test.js` desde
-- entonces. Esta migracion NO los cambia: los mueve a un sitio donde el
-- servidor pueda leerlos. Ese test ahora los lee de aqui, que era su plan
-- desde que se escribio.
--
-- ------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE
--
-- **No cobra nada ni forja ninguna llave.** Eso es la Fase 5. Aqui solo se
-- crea la fuente y sus lectores. Como `exige_persona()` en la 044, las
-- funciones existen antes que su primer uso a proposito: una garantia que
-- llega despues de la operacion que tenia que guardar se le olvida a alguien y
-- no se entera nadie.
--
-- **No toca `profiles.coins` ni la cartera.** Son las piezas 3.2 y 3.3.
--
-- **No resuelve todavia la disponibilidad por jurisdiccion.** La matriz se
-- crea y se rellena porque `R-109` la pone entre los campos minimos de la
-- configuracion, y `tipo_publicado()` la responde en servidor (`R-108`,
-- `SEC-29`). Quien la consulta al crear un gremio es la Fase 4.4.
--
-- **No mueve las caducidades de la 047 y la 048.** Esas 72 horas son de la
-- conversion de identidad, no de la expansion, y siguen siendo un literal
-- dentro de sus funciones. Cambiarlas obliga a reescribir dos funciones que ya
-- estan en produccion y probadas, y eso no es de esta pieza.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · LA VERSION · los parametros globales y su auditoria
-- ------------------------------------------------------------------

create table if not exists public.configuracion_expansion (
  -- El identificador que se graba en cada llave (`I-4`, `S-12`). Legible por
  -- una persona a proposito: en un incidente se lee un recibo, no se cruza un
  -- uuid contra una tabla. Fecha mas orden dentro del dia.
  version text primary key check (version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(\.[0-9]+)?$'),
  -- Desde cuando rige. Unica, porque dos versiones que empiezan en el mismo
  -- instante dejan sin respuesta a "cual es la vigente", y la respuesta a esa
  -- pregunta es lo que se cobra.
  vigente_desde timestamptz not null,

  -- Pertenencias activas simultaneas por persona, el gremio inicial incluido
  -- (`R-23`, `R-60`). Bajarlo NO expulsa a nadie (`R-25`, `CAM-4`): quien este
  -- por encima se queda y no puede adquirir mas. Eso lo cumple quien compra,
  -- no esta tabla; aqui solo vive el numero.
  limite_global integer not null check (limite_global between 1 and 50),
  -- Cuantas oportunidades puede dar UN MISMO gremio de origen, si se quiere
  -- acotar. Con el valor puesto al numero de escalones no acota nada, que es
  -- lo decidido hoy.
  escalones_por_gremio integer not null check (escalones_por_gremio between 1 and 20),

  -- Procedencia del coste, no el coste. Ver la cabecera.
  regla_crecimiento text not null check (regla_crecimiento in ('geometrica','explicita')),
  coste_base integer not null check (coste_base > 0),
  factor numeric(6,3) check (factor > 1),

  -- Las caducidades de la expansion (`R-62`, `R-80`, `D-07`, `D-22`).
  invitacion_dias integer not null check (invitacion_dias between 1 and 365),
  -- NULO quiere decir QUE NO CADUCA, y no es un olvido: es la decision de
  -- `R-62`. Una llave comprada y caducada es dinero perdido sin haber recibido
  -- nada. Solo se revierte por soporte, nunca por un reloj.
  llave_dias integer check (llave_dias is null or llave_dias > 0),
  solicitud_junior_dias integer not null check (solicitud_junior_dias between 1 and 365),
  autorizacion_adulta_horas integer not null check (autorizacion_adulta_horas between 1 and 720),

  -- Auditoria (`CFG-4`): que se cambio, quien lo aprobo, quien lo escribio y
  -- cuando. Solo el uid admite nulos, y por el motivo que dice ahi abajo.
  motivo text not null check (length(btrim(motivo)) between 3 and 1000),
  -- Quien o QUE lo aprobo: una persona, una decision de la especificacion, un
  -- acuerdo. Es texto porque la mayoria de las veces no es una cuenta.
  aprobada_por text not null check (length(btrim(aprobada_por)) between 2 and 200),
  -- La cuenta que la escribio, cuando la escribio una cuenta. La primera
  -- version se publica desde el SQL Editor, donde `auth.uid()` es nulo: por
  -- eso admite nulos y por eso `aprobada_por` no.
  --
  -- SIN clave ajena a `auth.users`, y es deliberado. Con `on delete set null`,
  -- borrar la cuenta de quien publico dispararia un `update` sobre esta tabla
  -- --que el disparador de mas abajo prohibe, asi que el borrado fallaria-- y
  -- ademas reescribiria el rastro. Con `no action`, el borrado fallaria por la
  -- clave ajena. Un apunte de auditoria tiene que sobrevivir a la cuenta que
  -- nombra: es el mismo criterio que
  -- lleva `movimientos_coins.referencia` desde la 042.
  publicada_por uuid,
  publicada_at timestamptz not null default now(),

  constraint configuracion_factor_coherente check (
    -- En `case` y no con `and`/`or`, por lo mismo que mordio en
    -- `credenciales_alcance`: un CHECK que da NULL pasa.
    case when regla_crecimiento = 'geometrica' then factor is not null else true end
  )
);

create unique index if not exists idx_configuracion_expansion_vigencia
  on public.configuracion_expansion (vigente_desde);

comment on table public.configuracion_expansion is
  'Una fila por version de las reglas de expansion. No se edita ni se borra: publicar una regla nueva es insertar otra version (CFG-3).';

-- ------------------------------------------------------------------
-- 2 · LOS ESCALONES · la escala, un peldano por fila
-- ------------------------------------------------------------------

create table if not exists public.escalones_expansion (
  -- `restrict` y no `cascade`: borrar una version es lo que esto impide.
  version text not null references public.configuracion_expansion(version) on delete restrict,
  -- Cual es: el primer gremio extra, el segundo... Consecutivos desde 1.
  orden integer not null check (orden between 1 and 20),
  -- Nivel del personaje EN EL GREMIO DE ORIGEN que habilita el escalon
  -- (`R-10`, `R-12`). Nunca 1: `R-13` exige que no se alcance al empezar.
  nivel_exigido integer not null check (nivel_exigido between 2 and 200),
  -- Monedas que cuesta convertir la oportunidad en llave (`R-15`). Es el numero
  -- que se cobra, y el unico sitio donde vive.
  --
  -- "Monedas" y no el nombre narrativo: el esquema habla de `coins` y no dice
  -- esa otra palabra en ninguna parte. Lo defiende `tests/talis.test.js`, y no
  -- es mania: si el esquema empieza a usar el nombre de producto, el dia que el
  -- nombre cambie habra que migrar la base para arreglar un texto.
  coste integer not null check (coste > 0),
  primary key (version, orden)
);

comment on table public.escalones_expansion is
  'La escala de expansion de una version. El coste que se cobra sale de aqui, no de recalcular la formula (CFG-1).';

-- ------------------------------------------------------------------
-- 3 · LA DISPONIBILIDAD POR JURISDICCION (`R-89`, `R-94`, `R-109`)
--
-- Que tipo de gremio se puede crear en que pais. Va aqui y no en el codigo
-- porque el lanzamiento es pais a pais y cada pais repite su aprobacion: eso
-- cambia mas veces que el esquema.
--
-- Lo que no esta declarado, NO esta publicado. Una fila que falta deniega, no
-- concede: es `CFG-6` aplicado a la jurisdiccion, y evita que anadir un pais a
-- una lista en el cliente abra un tipo que no ha pasado su revision juridica.
-- ------------------------------------------------------------------

create table if not exists public.disponibilidad_tipos (
  version text not null references public.configuracion_expansion(version) on delete restrict,
  -- Los nombres de `R-68` y `TIP-9`. Los `families.tipo_gremio` que existen
  -- hoy ('familia' y 'piso') se corresponden con 'hogar' y 'hogar_compartido',
  -- y quien hace esa traduccion es la Fase 4.3, no esta tabla.
  tipo text not null check (tipo in ('hogar','amigos','equipo','hogar_compartido')),
  -- ISO 3166-1 alfa-2, en mayusculas.
  pais text not null check (pais ~ '^[A-Z]{2}$'),
  estado text not null check (estado in ('publicado','no_publicado')),
  primary key (version, tipo, pais)
);

comment on table public.disponibilidad_tipos is
  'Matriz tipo x pais x estado de publicacion de una version (R-109). Lo que no aparece, no esta publicado.';

-- ------------------------------------------------------------------
-- 4 · NADIE ENTRA POR LA API
--
-- El mismo patron que `operadores` y `salud_diaria`: RLS encendido y SIN
-- politicas. La configuracion no es de una familia, es del producto, y lo unico
-- que una familia necesita es lo que le devuelvan las funciones de lectura de
-- mas abajo, que devuelven lo justo. Asi `publicada_por` y `motivo` no salen de
-- la base por una peticion cualquiera.
-- ------------------------------------------------------------------

alter table public.configuracion_expansion enable row level security;
alter table public.escalones_expansion enable row level security;
alter table public.disponibilidad_tipos enable row level security;

revoke all on table public.configuracion_expansion from anon;
revoke all on table public.configuracion_expansion from authenticated;
revoke all on table public.escalones_expansion from anon;
revoke all on table public.escalones_expansion from authenticated;
revoke all on table public.disponibilidad_tipos from anon;
revoke all on table public.disponibilidad_tipos from authenticated;

-- ------------------------------------------------------------------
-- 5 · LA HISTORIA NO SE REESCRIBE (`CFG-3`)
--
-- Tres disparadores, y hacen falta los tres:
--
--   a) `update` y `delete` no existen para estas tres tablas. Para nadie,
--      tampoco para `postgres` desde el SQL Editor. Si alguna vez hay que
--      borrar una version de verdad, hay que retirar el disparador a mano, y
--      eso es justo lo que se quiere: que cueste y que se note.
--
--   b) `publicada_at` la pone el servidor y no se puede pasar de fuera. La usa
--      el disparador (c) para saber si una version se esta escribiendo AHORA o
--      se escribio ayer.
--
--   c) los escalones y la disponibilidad solo se pueden insertar en la misma
--      transaccion que su cabecera. Sin esto, la regla (a) no cierra nada:
--      anadir manana un escalon a la version de hoy no es un `update`, pero
--      cambia lo que cobraba una version ya usada.
-- ------------------------------------------------------------------

create or replace function public.tg_configuracion_sellada()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  raise exception
    'la configuracion de expansion no se edita ni se borra: se publica una version nueva (CFG-3)'
    using errcode = 'restrict_violation';
end $fn$;

revoke all on function public.tg_configuracion_sellada() from anon;
revoke all on function public.tg_configuracion_sellada() from authenticated;

drop trigger if exists configuracion_expansion_sellada on public.configuracion_expansion;
create trigger configuracion_expansion_sellada
  before update or delete on public.configuracion_expansion
  for each row execute function public.tg_configuracion_sellada();

drop trigger if exists escalones_expansion_sellados on public.escalones_expansion;
create trigger escalones_expansion_sellados
  before update or delete on public.escalones_expansion
  for each row execute function public.tg_configuracion_sellada();

drop trigger if exists disponibilidad_tipos_sellada on public.disponibilidad_tipos;
create trigger disponibilidad_tipos_sellada
  before update or delete on public.disponibilidad_tipos
  for each row execute function public.tg_configuracion_sellada();

create or replace function public.tg_configuracion_fechada()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- `now()` es el instante de INICIO de la transaccion, no el del reloj: por
  -- eso vale para reconocer despues "esto se escribio en la misma tanda".
  new.publicada_at := now();
  -- `coalesce` y no a secas: por PostgREST manda siempre `auth.uid()`, y desde el
  -- SQL Editor --donde es nulo-- vale lo que se declare a mano.
  new.publicada_por := coalesce(auth.uid(), new.publicada_por);
  return new;
end $fn$;

revoke all on function public.tg_configuracion_fechada() from anon;
revoke all on function public.tg_configuracion_fechada() from authenticated;

drop trigger if exists configuracion_expansion_fechada on public.configuracion_expansion;
create trigger configuracion_expansion_fechada
  before insert on public.configuracion_expansion
  for each row execute function public.tg_configuracion_fechada();

create or replace function public.tg_hija_de_version_nueva()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_publicada timestamptz;
begin
  select c.publicada_at into v_publicada
    from public.configuracion_expansion c where c.version = new.version;

  if v_publicada is null then
    raise exception 'la version % no existe: una escala no vive sin su cabecera', new.version
      using errcode = 'foreign_key_violation';
  end if;

  if v_publicada <> now() then
    raise exception
      'la version % ya esta publicada: sus escalones y su disponibilidad se escriben con ella, no despues (CFG-3)',
      new.version
      using errcode = 'restrict_violation';
  end if;

  return new;
end $fn$;

revoke all on function public.tg_hija_de_version_nueva() from anon;
revoke all on function public.tg_hija_de_version_nueva() from authenticated;

drop trigger if exists escalones_expansion_de_version_nueva on public.escalones_expansion;
create trigger escalones_expansion_de_version_nueva
  before insert on public.escalones_expansion
  for each row execute function public.tg_hija_de_version_nueva();

drop trigger if exists disponibilidad_tipos_de_version_nueva on public.disponibilidad_tipos;
create trigger disponibilidad_tipos_de_version_nueva
  before insert on public.disponibilidad_tipos
  for each row execute function public.tg_hija_de_version_nueva();

-- ------------------------------------------------------------------
-- 6 · UNA ESCALA INCOHERENTE NO LLEGA A PUBLICARSE
--
-- Lo que se comprueba, y de donde sale cada cosa:
--
--   · al menos un escalon. Una version sin escala no habilita nada y seria
--     indistinguible de no tener configuracion, que es peor: parece que hay
--     reglas (`CFG-6`);
--   · ordenes consecutivos desde 1, sin huecos. El hueco no es un detalle
--     estetico: "el escalon 3" tiene que querer decir "el tercero";
--   · nivel estrictamente creciente (`R-14`);
--   · cada coste al menos EL DOBLE del anterior. `R-15` dice
--     "significativamente mas cara" sin numero; el doble es el minimo que ya
--     fijo `tests/expansion.test.js` al aprobar la calibracion, y aqui pasa de
--     ser un test sobre unos numeros a ser un limite sobre cualquier version
--     futura. Por debajo del doble la escala deja de ser una escala;
--   · el primer escalon cuesta el coste base, y si la regla declarada es
--     geometrica, TODOS cuadran con ella. Declarar una formula y guardar otra
--     cosa es la peor version de las dos fuentes de verdad: la que miente.
--
-- Se comprueba al CERRAR la transaccion --disparador de restriccion diferido--
-- porque una escala se inserta fila a fila y a mitad de camino no cuadra.
-- ------------------------------------------------------------------

create or replace function public.valida_escala_expansion(p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_cfg public.configuracion_expansion%rowtype;
  v_n integer;
  v_min integer;
  v_max integer;
  r record;
  v_esperado integer;
begin
  select * into v_cfg from public.configuracion_expansion c where c.version = p_version;
  if v_cfg.version is null then return; end if;

  select count(*), min(orden), max(orden) into v_n, v_min, v_max
    from public.escalones_expansion e where e.version = p_version;

  if v_n = 0 then
    raise exception 'la version % no declara ni un escalon (CFG-6)', p_version;
  end if;
  if v_min <> 1 or v_max <> v_n then
    raise exception 'los escalones de la version % no son consecutivos desde 1: % filas, de % a %',
      p_version, v_n, v_min, v_max;
  end if;
  if v_cfg.escalones_por_gremio > v_n then
    raise exception 'la version % permite % escalones por gremio y solo declara %',
      p_version, v_cfg.escalones_por_gremio, v_n;
  end if;

  for r in
    select e.orden, e.nivel_exigido, e.coste,
           lag(e.nivel_exigido) over (order by e.orden) as nivel_previo,
           lag(e.coste)         over (order by e.orden) as coste_previo
      from public.escalones_expansion e
     where e.version = p_version
     order by e.orden
  loop
    if r.nivel_previo is not null and r.nivel_exigido <= r.nivel_previo then
      raise exception 'escalon % de la version %: el nivel exigido (%) no supera al del anterior (%) [R-14]',
        r.orden, p_version, r.nivel_exigido, r.nivel_previo;
    end if;

    if r.coste_previo is not null and r.coste < r.coste_previo * 2 then
      raise exception 'escalon % de la version %: % no es el doble de % [R-15]',
        r.orden, p_version, r.coste, r.coste_previo;
    end if;

    if r.orden = 1 and r.coste <> v_cfg.coste_base then
      raise exception 'la version % declara coste base % y su primer escalon cuesta %',
        p_version, v_cfg.coste_base, r.coste;
    end if;

    if v_cfg.regla_crecimiento = 'geometrica' then
      -- Al multiplo de cinco mas cercano, como el resto de la tienda. La
      -- potencia no siempre da un entero: con 300 y x2,5 el cuarto escalon
      -- sale 4687,5, y redondear a cinco evita estrenar una segunda regla de
      -- redondeo para un solo caso.
      v_esperado := (round(v_cfg.coste_base * power(v_cfg.factor, (r.orden - 1)::numeric) / 5) * 5)::integer;
      if r.coste <> v_esperado then
        raise exception 'escalon % de la version %: cuesta % y la regla geometrica declarada (% x %^k) da %',
          r.orden, p_version, r.coste, v_cfg.coste_base, v_cfg.factor, v_esperado;
      end if;
    end if;
  end loop;
end $fn$;

revoke all on function public.valida_escala_expansion(text) from public;
revoke all on function public.valida_escala_expansion(text) from anon;
revoke all on function public.valida_escala_expansion(text) from authenticated;

create or replace function public.tg_valida_escala_expansion()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.valida_escala_expansion(new.version);
  return null;
end $fn$;

revoke all on function public.tg_valida_escala_expansion() from anon;
revoke all on function public.tg_valida_escala_expansion() from authenticated;

-- Desde los dos lados: publicar una cabecera sin escala falla, y publicar una
-- escala torcida tambien. Una sola de las dos comprobaciones deja media puerta.
drop trigger if exists configuracion_expansion_coherente on public.configuracion_expansion;
create constraint trigger configuracion_expansion_coherente
  after insert on public.configuracion_expansion
  deferrable initially deferred
  for each row execute function public.tg_valida_escala_expansion();

drop trigger if exists escalones_expansion_coherentes on public.escalones_expansion;
create constraint trigger escalones_expansion_coherentes
  after insert on public.escalones_expansion
  deferrable initially deferred
  for each row execute function public.tg_valida_escala_expansion();

-- ------------------------------------------------------------------
-- 7 · LEER LA VIGENTE
--
-- `security definer` a proposito, y no por comodidad: la respuesta a "cuanto
-- cuesta la primera llave" tiene que ser la MISMA para todo el mundo y no
-- depender de que politicas alcance la sesion que pregunta. Por eso las tablas
-- no se conceden a nadie y estas funciones son la unica puerta.
--
-- La vigente es la de mayor `vigente_desde` que ya haya empezado. Una version
-- con fecha futura se puede dejar escrita y no rige hasta su dia.
-- ------------------------------------------------------------------

create or replace function public.configuracion_expansion_vigente()
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select c.version
    from public.configuracion_expansion c
   where c.vigente_desde <= now()
   order by c.vigente_desde desc
   limit 1;
$fn$;

revoke all on function public.configuracion_expansion_vigente() from public;
revoke all on function public.configuracion_expansion_vigente() from anon;
grant execute on function public.configuracion_expansion_vigente() to authenticated;

-- Los parametros globales. Cero filas si no hay version vigente, y eso es la
-- denegacion (`CFG-6`). No devuelve `coste_base` ni `factor`: el coste ya
-- viaja hecho en `escala_expansion()`, y quien no recibe la formula no la
-- puede recalcular mal.
create or replace function public.parametros_expansion()
returns table (
  version text,
  vigente_desde timestamptz,
  limite_global integer,
  escalones_por_gremio integer,
  regla_crecimiento text,
  invitacion_dias integer,
  llave_dias integer,
  solicitud_junior_dias integer,
  autorizacion_adulta_horas integer
)
language sql
stable
security definer
set search_path = public
as $fn$
  select c.version, c.vigente_desde, c.limite_global, c.escalones_por_gremio,
         c.regla_crecimiento, c.invitacion_dias, c.llave_dias,
         c.solicitud_junior_dias, c.autorizacion_adulta_horas
    from public.configuracion_expansion c
   where c.version = public.configuracion_expansion_vigente();
$fn$;

revoke all on function public.parametros_expansion() from public;
revoke all on function public.parametros_expansion() from anon;
grant execute on function public.parametros_expansion() to authenticated;

-- La escala entera, para que la pantalla pueda decir "te falta esto". El
-- cliente SOLO MUESTRA (`SEC-1`): que reciba la escala no le da voz en lo que
-- se cobra, que se decide con `hito_expansion()` en servidor.
create or replace function public.escala_expansion()
returns table (version text, orden integer, nivel_exigido integer, coste integer)
language sql
stable
security definer
set search_path = public
as $fn$
  select e.version, e.orden, e.nivel_exigido, e.coste
    from public.escalones_expansion e
   where e.version = public.configuracion_expansion_vigente()
   order by e.orden;
$fn$;

revoke all on function public.escala_expansion() from public;
revoke all on function public.escala_expansion() from anon;
grant execute on function public.escala_expansion() to authenticated;

-- Un escalon concreto de la vigente: lo que consultara la funcion que forje en
-- la Fase 5. Cero filas quiere decir "no hay configuracion o no hay tal
-- escalon", y las dos cosas se responden igual: no se puede comprar.
create or replace function public.hito_expansion(p_orden integer)
returns table (version text, orden integer, nivel_exigido integer, coste integer)
language sql
stable
security definer
set search_path = public
as $fn$
  select e.version, e.orden, e.nivel_exigido, e.coste
    from public.escalones_expansion e
   where e.version = public.configuracion_expansion_vigente()
     and e.orden = p_orden
     and p_orden <= (
       select c.escalones_por_gremio from public.configuracion_expansion c
        where c.version = public.configuracion_expansion_vigente()
     );
$fn$;

revoke all on function public.hito_expansion(integer) from public;
revoke all on function public.hito_expansion(integer) from anon;
grant execute on function public.hito_expansion(integer) to authenticated;

-- La disponibilidad, resuelta en SERVIDOR (`R-108`, `SEC-29`). Y a proposito
-- SIN conceder a `authenticated`: el pais es un parametro, y `R-108` dice que
-- un cliente no declara en que pais esta para desbloquear un tipo. Quien la
-- llama tiene que ser otra funcion del servidor --la que cree gremios, en la
-- Fase 4.4--, que sabra de donde sacar el pais de verdad.
create or replace function public.tipo_publicado(p_tipo text, p_pais text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.disponibilidad_tipos d
     where d.version = public.configuracion_expansion_vigente()
       and d.tipo = p_tipo
       and d.pais = upper(btrim(p_pais))
       and d.estado = 'publicado'
  );
$fn$;

revoke all on function public.tipo_publicado(text, text) from public;
revoke all on function public.tipo_publicado(text, text) from anon;
revoke all on function public.tipo_publicado(text, text) from authenticated;

-- ------------------------------------------------------------------
-- 8 · LA PRIMERA VERSION
--
-- En un solo `do`, y no en tres `insert` sueltos, porque los disparadores de
-- arriba exigen que cabecera, escalones y disponibilidad viajen en la MISMA
-- transaccion. Un `do` es una sentencia: si el SQL Editor va en autocommit,
-- sigue siendo una transaccion.
--
-- Idempotente por la comprobacion de la version: volver a ejecutar el fichero
-- no inserta nada, y no puede sobreescribir nada aunque quisiera.
-- ------------------------------------------------------------------

do $$
declare
  v_version text := '2026-08-30.1';
begin
  if exists (select 1 from public.configuracion_expansion where version = v_version) then
    return;
  end if;

  insert into public.configuracion_expansion (
    version, vigente_desde,
    limite_global, escalones_por_gremio,
    regla_crecimiento, coste_base, factor,
    invitacion_dias, llave_dias, solicitud_junior_dias, autorizacion_adulta_horas,
    motivo, aprobada_por
  ) values (
    v_version,
    timestamptz '2026-08-30 00:00:00+00',
    5,      -- R-60 · cinco pertenencias activas, el gremio inicial incluido
    4,      -- tantas como escalones: hoy un gremio de origen no acota nada
    'geometrica', 300, 2.5,
    14,     -- R-62 · las invitaciones caducan a los 14 dias naturales
    null,   -- R-62 · las llaves NO caducan en el MVP
    14,     -- R-80 · la solicitud de expansion de un junior, 14 dias
    72,     -- R-80 · la autorizacion adulta, 72 horas
    'Primera version. Traslada a la base los numeros de la calibracion del 29-ago-2026 (spec 11.2, propuestas 1 a 3) sin cambiar ninguno: hasta hoy vivian en tests/expansion.test.js y el servidor no podia leerlos (H-40, CFG-2).',
    'producto · D-05, D-06, D-07, D-10, D-22, R-59, R-85'
  );

  -- Hitos 6-8-10-12 y coste 300 x 2,5^(k-1). El cuarto sale 4687,5 y se
  -- redondea al multiplo de cinco: 4690.
  insert into public.escalones_expansion (version, orden, nivel_exigido, coste) values
    (v_version, 1,  6,  300),
    (v_version, 2,  8,  750),
    (v_version, 3, 10, 1875),
    (v_version, 4, 12, 4690);

  -- La matriz de §11.4. 'hogar_compartido' es el tipo legado: los `piso` que
  -- ya existen siguen funcionando --esta tabla no apaga nada-- pero no se
  -- ofrece para crear gremios nuevos (`R-78`, `TIP-9`), y eso es exactamente
  -- lo que dice 'no_publicado' aqui.
  insert into public.disponibilidad_tipos (version, tipo, pais, estado) values
    (v_version, 'hogar',            'ES', 'publicado'),
    (v_version, 'amigos',           'ES', 'publicado'),
    (v_version, 'equipo',           'ES', 'no_publicado'),
    (v_version, 'hogar_compartido', 'ES', 'no_publicado');
end $$;

-- Y el barrido de la 021, corregido por la 046: toda funcion `security
-- definer` pierde el permiso de ejecucion de PUBLIC y de `anon`. Hace falta
-- retirar los dos: `anon` HEREDA de PUBLIC, asi que quitarselo solo a `anon`
-- no cierra nada mientras PUBLIC lo conserve, que es lo que Postgres concede
-- por defecto a toda funcion nueva. Los `grant execute ... to authenticated`
-- de arriba son explicitos y sobreviven.
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
-- 1 · La version esta, con su escala y su matriz:
--
--   select
--     (select count(*) from public.configuracion_expansion)                as versiones,
--     (select count(*) from public.escalones_expansion)                    as escalones,
--     (select count(*) from public.disponibilidad_tipos)                   as disponibilidad,
--     public.configuracion_expansion_vigente()                             as vigente;
--
--   -> 1 · 4 · 4 · '2026-08-30.1'
--
-- 2 · Los numeros son los aprobados:
--
--   select * from public.escala_expansion();
--   -> 1/6/300 · 2/8/750 · 3/10/1875 · 4/12/4690
--   select limite_global, invitacion_dias, llave_dias from public.parametros_expansion();
--   -> 5 · 14 · null
--
-- 3 · La historia no se toca. Los tres tienen que fallar:
--
--   update public.configuracion_expansion set limite_global = 9;
--   delete from public.escalones_expansion where orden = 4;
--   insert into public.escalones_expansion values ('2026-08-30.1', 5, 14, 11725);
--
-- 4 · Sin configuracion vigente no hay nada que leer. En un bloque que se
--     deshace al final, como se ensayaron la 047 y la 048:
--
--   do $ensayo$
--   declare v_n integer; v_p boolean;
--   begin
--     alter table public.configuracion_expansion disable trigger configuracion_expansion_sellada;
--     update public.configuracion_expansion set vigente_desde = now() + interval '10 years';
--     select count(*) into v_n from public.escala_expansion();
--     select public.tipo_publicado('hogar','ES') into v_p;
--     raise exception 'ENSAYO escalones=% tipo_publicado=% (0 y f es lo correcto)', v_n, v_p;
--   end $ensayo$;
--
-- 5 · `anon` sigue sin poder ejecutar nada:
--
--   select count(*) as anon_puede_llamar
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.prosecdef
--      and has_function_privilege('anon', p.oid, 'execute');
--   -> 0
-- ------------------------------------------------------------------
