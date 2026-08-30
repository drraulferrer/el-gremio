-- Migracion 056 · la llave se forja.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- Fase 5. Lo que trae: el nivel derivado en SERVIDOR desde la marca de agua,
-- el derecho de expansion --la llave-- con su ciclo de vida entero, y la forja
-- con todas sus comprobaciones.
--
-- ------------------------------------------------------------------
-- LA TERCERA COPIA DE LA FORMULA, Y COMO SE EVITA QUE SE SEPAREN
--
-- El nivel se calcula hoy en `src/lib/supabase.js` y en `fakeBackend.js`.
-- Aqui aparece una tercera copia, en SQL, y el plan de la Fase 1 ya avisaba de
-- que llegaria: no se hizo entonces porque no habia nadie que la llamara.
--
-- Ahora la hay --forjar exige comprobar el nivel, y `R-26` prohibe que el
-- cliente lo declare-- asi que la copia es inevitable. Lo que NO es inevitable
-- es que se separen, y por eso:
--
--   * la aritmetica esta escrita UNA vez, en `xp_de_nivel()`;
--   * `nivel_de_xp()` la recorre con el MISMO bucle que `levelFromXp`, y no
--     con una formula cerrada. Una raiz cuadrada en coma flotante devuelve el
--     nivel equivocado justo en el limite exacto, que es donde importa;
--   * `tests/llave.test.js` extrae la expresion del SQL, la evalua en JS y la
--     compara con `xpForLevel` en un rango. Si alguien toca una de las dos
--     copias, la prueba cae.
--
-- ------------------------------------------------------------------
-- EL NIVEL SALE DE LA MARCA DE AGUA, NO DE LA XP DE HOY
--
-- `E-4.5`: deshacer una mision baja la XP, y el hito alcanzado **no se
-- retira**. Un hito es algo que pasó; que la XP baje despues no lo deshace.
-- Por eso se lee `xp_maxima`, que un disparador mantiene desde la 035 y que
-- nunca baja.
--
-- Si se leyera `xp` a secas, corregir una mision mal validada le quitaria a
-- alguien una oportunidad que ya se habia ganado, y eso es exactamente el
-- "cambiar las reglas no puede perder derechos" de `R-17`.
--
-- ------------------------------------------------------------------
-- POR QUE EL LIMITE SE MIRA ANTES DE COBRAR (`R-61`, `D-06`)
--
-- La version anterior de la especificacion dejaba comprar en el limite. `D-06`
-- lo resolvio al reves, y con razon: cobrar por una llave que no se puede usar
-- es cobrar por nada. Aqui el limite se comprueba **antes** de tocar la
-- cartera, junto al saldo y al nivel, y ninguna de las tres cobra si falla.
--
-- Entre "estas en el limite" y "no te llega" se responde primero el limite: no
-- llegar es cuestion de una semana, estar en el limite es una decision --salir
-- de un gremio-- y merece decirse antes.
--
-- ------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE
--
-- **No gasta la llave.** Crear un gremio y aceptar una invitacion son la Fase
-- 6. `consumir_llave()` existe y hoy no la llama nadie, igual que
-- `exige_pais()` en la 055 y `exige_persona()` en la 044: la puerta se escribe
-- con la pieza que la define, no con la que la usa.
--
-- **No hay pantalla.** `oportunidades_expansion()` devuelve el "cuanto falta"
-- que la pantalla necesitara; pintarlo es otra tanda.
--
-- **No exige pais todavia.** `exige_pais()` sigue sin llamarse desde ningun
-- sitio. Forjar depende del nivel, del saldo y del limite, no del pais: quien
-- decide la jurisdiccion es CREAR el gremio, que es la Fase 6. Un gremio que
-- no ha declarado pais puede forjar, y eso es `R-117` deliberado.
--
-- **No caduca ninguna llave.** `T-14` recomienda no caducar en el MVP y la
-- configuracion de la 050 lo dice ya: `llave_dias` es nulo. El estado
-- 'caducado' existe en el modelo para el dia que se decida lo contrario, y
-- hoy no lo escribe nadie.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1 · EL NIVEL, EN SERVIDOR
--
-- `xp_de_nivel(1) = 0`, `xp_de_nivel(2) = 100`, `xp_de_nivel(3) = 300`. La
-- curva triangular de siempre, que aqui aparece una sola vez.
-- ------------------------------------------------------------------

create or replace function public.xp_de_nivel(p_nivel integer)
returns integer
language sql
immutable
as $fn$
  select (50 * p_nivel * (p_nivel - 1))::integer;
$fn$;

comment on function public.xp_de_nivel(integer) is
  'XP acumulada que exige un nivel. Copia en SQL de xpForLevel() de src/lib/supabase.js; tests/llave.test.js compara las dos.';

-- El MISMO bucle que `levelFromXp`, y no una formula cerrada a proposito: con
-- `floor((1 + sqrt(1 + xp/12.5)) / 2)` la coma flotante devuelve el nivel
-- anterior justo en el valor exacto de un hito, que es el unico sitio donde
-- esta funcion decide algo.
--
-- El tope de 999 no es una regla de producto: es que un bucle sin techo en una
-- funcion que llama una operacion de pago no se escribe.
create or replace function public.nivel_de_xp(p_xp integer)
returns integer
language plpgsql
immutable
as $fn$
declare
  v_nivel integer := 1;
begin
  if p_xp is null or p_xp < 0 then return 1; end if;
  while v_nivel < 999 and p_xp >= public.xp_de_nivel(v_nivel + 1) loop
    v_nivel := v_nivel + 1;
  end loop;
  return v_nivel;
end $fn$;

-- Y el nivel de un personaje concreto, que es lo que mira la forja: de la
-- MARCA DE AGUA y no de la XP de hoy (`E-4.5`, `S-06`).
create or replace function public.nivel_en_gremio(p_profile uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  select public.nivel_de_xp(greatest(coalesce(p.xp_maxima, 0), coalesce(p.xp, 0)))
    from public.profiles p
   where p.id = p_profile;
$fn$;

revoke all on function public.nivel_en_gremio(uuid) from public;
revoke all on function public.nivel_en_gremio(uuid) from anon;
grant execute on function public.nivel_en_gremio(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 2 · LA LLAVE
--
-- `R-18` enumera lo que guarda: persona, gremio de origen, personaje
-- acreditador, escalon, temporada, coste, fecha, estado y destino final.
--
-- Y una cosa que `R-18` no dice y `E-7.4` si: **el origen sigue registrado
-- aunque el gremio A se cierre**. Por eso `origen` NO tiene clave ajena --con
-- `cascade` un gremio cerrado borraria llaves pagadas, y con `set null`
-- borraria la trazabilidad que `R-22` pide-- y por eso se guarda ademas
-- `origen_nombre`: un uuid huerfano registra el origen para la base, pero no
-- para quien lee su lista de llaves. Mismo criterio que `publicada_por` en la
-- 050 y `movimientos_coins.referencia` desde la 042: un apunte tiene que
-- sobrevivir a la fila que nombra.
-- ------------------------------------------------------------------

create table if not exists public.derechos_expansion (
  id uuid primary key default gen_random_uuid(),
  persona uuid not null references auth.users(id) on delete cascade,

  -- Sin clave ajena, ver arriba.
  origen uuid not null,
  origen_nombre text not null,
  personaje uuid,

  orden integer not null check (orden >= 1),
  -- La temporada del gremio de origen en el momento de forjar (`S-05`). Se
  -- guarda y no se deriva: derivarla despues daria la de hoy, no la de
  -- entonces, que es el mismo error que la 030 corrigio con `season_number`.
  temporada integer check (temporada is null or temporada >= 1),
  coste integer not null check (coste >= 0),
  -- La version de reglas con la que se compro (`S-12`, `T-15`). Cambiar la
  -- configuracion despues no cambia nada de esta fila.
  version text not null,

  estado text not null default 'disponible'
    check (estado in ('disponible','consumido','revertido','caducado')),

  destino uuid,
  destino_nombre text,

  forjada_at timestamptz not null default now(),
  cerrada_at timestamptz,
  motivo text,

  -- Una consumida tiene destino y fecha; una disponible no tiene ninguno de
  -- los dos. Sin esto, "consumida" seria una palabra en una columna.
  constraint derecho_consumido_con_destino check (
    case estado
      when 'disponible' then destino is null and cerrada_at is null
      when 'consumido'  then destino is not null and cerrada_at is not null
      else cerrada_at is not null
    end
  )
);

-- `E-4.4` estructural: el mismo escalon del mismo gremio no se compra dos
-- veces. Con un indice y no con un `select` previo, que es el oficio de
-- `idx_bonuses_uno_al_dia`: entre el select y el insert cabe otra peticion.
--
-- PARCIAL, y ahi esta el matiz: una llave REVERTIDA no bloquea. Revertir es
-- excepcional --un cobro erroneo, una incidencia-- y devuelve el dinero
-- (`T-12`); si ademas se quedara con la oportunidad, la persona habria perdido
-- las dos cosas.
create unique index if not exists idx_derecho_escalon_una_vez
  on public.derechos_expansion (persona, origen, orden)
  where estado in ('disponible','consumido');

create index if not exists idx_derechos_persona
  on public.derechos_expansion (persona, estado);

alter table public.derechos_expansion enable row level security;

-- Lectura de lo propio, y nada mas. Escribe el servidor: crear una llave a
-- mano por la API seria crear dinero.
drop policy if exists derecho_propio on public.derechos_expansion;
create policy derecho_propio on public.derechos_expansion
  for select to authenticated
  using (persona = auth.uid());

revoke all on table public.derechos_expansion from anon;
revoke all on table public.derechos_expansion from authenticated;
grant select on table public.derechos_expansion to authenticated;

-- ------------------------------------------------------------------
-- 3 · DOS TIPOS DE MOVIMIENTO MAS
--
-- El libro de la 042 lleva un `check` con la lista de motivos, y crece cuando
-- aparece uno. Forjar saca monedas de la cartera y revertir las devuelve.
-- ------------------------------------------------------------------

alter table public.movimientos_coins drop constraint if exists movimientos_coins_tipo_check;
alter table public.movimientos_coins add constraint movimientos_coins_tipo_check check (tipo in (
  'canje', 'devolucion_canje', 'mision', 'deshacer_mision',
  'bonus_diario', 'bonus_manual', 'botin_limpieza', 'racha',
  'conversion', 'apertura', 'devolucion_conversion',
  -- Fase 5. La salida por una llave, y su devolucion excepcional (`T-12`,
  -- `I-7`): se devuelve con un asiento NUEVO, nunca borrando el original.
  'forja_llave', 'devolucion_llave',
  'desconocido'
));

-- ------------------------------------------------------------------
-- 4 · CUANTO FALTA
--
-- Lo que la pantalla necesita para el paso 2 de `F-4`: los escalones vigentes,
-- cual es el siguiente y cuanto falta. **Solo muestra** (`SEC-1`): que el
-- cliente reciba esto no le da voz en nada, porque `forjar_llave()` lo vuelve
-- a comprobar todo desde cero.
--
-- `estado` responde con la razon PRINCIPAL por la que hoy no se puede, y en
-- este orden: ya forjada, el tipo no forja, falta nivel, estas en el limite,
-- falta saldo. Es el mismo orden que la forja, para que la pantalla nunca diga
-- una cosa y el servidor otra.
-- ------------------------------------------------------------------

create or replace function public.oportunidades_expansion(p_family uuid)
returns table (
  orden integer,
  nivel_exigido integer,
  coste integer,
  nivel_actual integer,
  estado text,
  falta_xp integer,
  falta_monedas integer
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_profile uuid;
  v_nivel integer := 1;
  v_xp integer := 0;
  v_saldo integer := 0;
  v_forja boolean := false;
  v_activas integer := 0;
  v_limite integer;
begin
  if v_uid is null or p_family is null then return; end if;
  if not exists (
    select 1 from public.pertenencias p
     where p.persona = v_uid and p.family_id = p_family and p.estado = 'activa'
  ) then
    return;
  end if;

  select pr.id, greatest(coalesce(pr.xp_maxima, 0), coalesce(pr.xp, 0))
    into v_profile, v_xp
    from public.profiles pr
   where pr.family_id = p_family and pr.persona = v_uid and pr.active;
  if v_profile is null then return; end if;

  v_nivel := public.nivel_de_xp(v_xp);
  v_saldo := coalesce((select c.saldo from public.carteras c where c.persona = v_uid), 0);

  -- Por plantilla y no por `if tipo = 'equipo'`: es lo que la 053 vino a
  -- arreglar, y `R-114` lo pide con ese nombre.
  select coalesce(t.expansion_desde_tipo, false) into v_forja
    from public.families f
    join public.plantillas_tipo t
      on t.tipo = f.tipo_plantilla and t.version = f.plantilla_version
   where f.id = p_family;

  select count(*) into v_activas
    from public.pertenencias p
   where p.persona = v_uid and p.estado = 'activa';

  select pa.limite_global into v_limite from public.parametros_expansion() pa;

  return query
  select e.orden, e.nivel_exigido, e.coste, v_nivel,
         case
           when exists (
             select 1 from public.derechos_expansion d
              where d.persona = v_uid and d.origen = p_family and d.orden = e.orden
                and d.estado in ('disponible','consumido')
           ) then 'forjada'
           when not coalesce(v_forja, false) then 'tipo_no_forja'
           when v_nivel < e.nivel_exigido then 'falta_nivel'
           when v_activas >= coalesce(v_limite, 0) then 'en_el_limite'
           when v_saldo < e.coste then 'falta_monedas'
           else 'puedes'
         end,
         greatest(0, public.xp_de_nivel(e.nivel_exigido) - v_xp),
         greatest(0, e.coste - v_saldo)
    from public.escala_expansion() e
   order by e.orden;
end $fn$;

revoke all on function public.oportunidades_expansion(uuid) from public;
revoke all on function public.oportunidades_expansion(uuid) from anon;
grant execute on function public.oportunidades_expansion(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 5 · LA FORJA
--
-- El orden de las comprobaciones ES la especificacion, y por eso va escrito
-- en columna:
--
--    1 · sesion
--    2 · idempotencia            · mismo intento, misma respuesta (`R-09`)
--    3 · identidad personal      · una llave es de una persona (`R-48`)
--    4 · pertenencia y personaje en ESE gremio
--    5 · el tipo puede originar llaves (`R-111`, `R-115`)
--    6 · el escalon existe en la configuracion vigente (`CFG-6`)
--    7 · nivel, desde la marca de agua (`R-10`, `E-4.5`)
--    8 · ese escalon no se ha forjado ya desde ese gremio (`E-4.4`)
--    9 · plaza en el limite global            ANTES DE COBRAR (`R-61`)
--   10 · saldo                                ANTES DE COBRAR (`R-24`)
--   11 · cobrar y crear, en la misma transaccion
--
-- Nada de lo anterior al 11 toca la cartera. Es lo que quiere decir "no se
-- descuentan monedas por una llave que no se puede usar".
--
-- El coste lo pone el SERVIDOR desde la configuracion vigente y no se acepta
-- ninguno del cliente (`R-26`, `SEC-1`). Sin configuracion valida no hay
-- escalon, y sin escalon se deniega: `CFG-6` dice que la expansion nunca se
-- regala por ausencia de reglas.
-- ------------------------------------------------------------------

create or replace function public.forjar_llave(
  p_family uuid,
  p_orden integer,
  p_clave text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_previo text;
  v_profile uuid;
  v_xp integer;
  v_nivel integer;
  v_forja boolean;
  v_nombre text;
  v_temporada integer;
  h record;
  v_activas integer;
  v_limite integer;
  v_saldo integer;
  v_derecho uuid;
begin
  if v_uid is null then return 'sin_sesion'; end if;
  -- El libro exige entre 8 y 120 caracteres. Comprobarlo aqui devuelve una
  -- palabra; no comprobarlo revienta doce lineas mas abajo, dentro del cobro.
  if p_clave is not null and length(p_clave) not between 8 and 120 then
    return 'clave_invalida';
  end if;

  -- 2 · Idempotencia, antes de tocar nada. El mismo patron que
  --     `redeem_reward`: la clave vive en el libro, asi que un doble clic
  --     devuelve el resultado del primero y no forja dos veces.
  if p_clave is not null then
    select resultado into v_previo from public.movimientos_coins where clave = p_clave;
    if found then return case when v_previo = 'ok' then 'ok' else v_previo end; end if;
  end if;

  -- 3 · Una llave la compra una PERSONA. Una credencial compartida no forja:
  --     no hay a quien cargarle el gasto, y es lo que dice `adulto/CAP-13` en
  --     la matriz de la 054.
  if public.clase_credencial() <> 'personal' then return 'exige_identidad_personal'; end if;

  -- 4 · Pertenencia activa en ESE gremio, y su personaje.
  if not exists (
    select 1 from public.pertenencias p
     where p.persona = v_uid and p.family_id = p_family and p.estado = 'activa'
  ) then
    return 'sin_pertenencia';
  end if;

  select pr.id, greatest(coalesce(pr.xp_maxima, 0), coalesce(pr.xp, 0))
    into v_profile, v_xp
    from public.profiles pr
   where pr.family_id = p_family and pr.persona = v_uid and pr.active;
  if v_profile is null then return 'sin_personaje'; end if;

  -- 5 · Por plantilla, nunca por `if tipo = 'equipo'` (053, `R-114`).
  select coalesce(t.expansion_desde_tipo, false), f.name
    into v_forja, v_nombre
    from public.families f
    join public.plantillas_tipo t
      on t.tipo = f.tipo_plantilla and t.version = f.plantilla_version
   where f.id = p_family;
  if not coalesce(v_forja, false) then return 'tipo_no_forja'; end if;

  -- 6 · El escalon, de la configuracion vigente. Cero filas quiere decir "no
  --     hay configuracion" o "no hay tal escalon", y las dos se responden
  --     igual (`CFG-6`).
  select * into h from public.hito_expansion(p_orden);
  if not found then return 'escalon_desconocido'; end if;

  -- 7 · El nivel, de la marca de agua.
  v_nivel := public.nivel_de_xp(v_xp);
  if v_nivel < h.nivel_exigido then return 'nivel_insuficiente'; end if;

  -- 8 · Ese escalon, desde ese gremio, una sola vez. Se comprueba aqui para
  --     poder responder con una palabra, y ademas lo garantiza el indice
  --     unico: entre este `select` y el `insert` cabe otra peticion.
  if exists (
    select 1 from public.derechos_expansion d
     where d.persona = v_uid and d.origen = p_family and d.orden = p_orden
       and d.estado in ('disponible','consumido')
  ) then
    return 'ya_forjado';
  end if;

  -- 9 · El limite, ANTES de cobrar (`R-61`).
  select count(*) into v_activas
    from public.pertenencias p
   where p.persona = v_uid and p.estado = 'activa';
  select pa.limite_global into v_limite from public.parametros_expansion() pa;
  if v_limite is null then return 'escalon_desconocido'; end if;
  if v_activas >= v_limite then return 'en_el_limite'; end if;

  -- 10 · El saldo, ANTES de cobrar. Y si no llega queda asiento con el saldo
  --      igual antes y despues: un intento fallido tambien es historia
  --      (`R-08`, `F-5` paso 5).
  v_saldo := coalesce((select c.saldo from public.carteras c where c.persona = v_uid), 0);
  if v_saldo < h.coste then
    perform public.anota_coins(v_profile, 'forja_llave', -h.coste, v_saldo, v_saldo,
                               'sin_monedas', null, p_clave);
    return 'sin_monedas';
  end if;

  -- La temporada del gremio en este momento (`S-05`).
  -- La ACTUAL es la ultima cerrada mas una, que es lo que hace
  -- `temporadaActual()` en el cliente. `season_number` manda desde la 030;
  -- las metas viejas no lo tienen y ahi vale contarlas.
  select coalesce(max(g.season_number), count(*))::integer + 1
    into v_temporada
    from public.family_goals g
   where g.family_id = p_family and g.achieved;

  -- 11 · Y ahora si. Primero la llave, para que el asiento pueda referenciarla,
  --      y despues el cobro. Si el cobro fallara, la llave se va con el:
  --      es una sola transaccion.
  --      El manejador rodea SOLO al `insert`, y eso importa: puesto al final
  --      de la funcion se tragaria tambien el choque de claves del libro, y
  --      un problema de idempotencia saldria disfrazado de 'ya_forjado'.
  begin
    insert into public.derechos_expansion
      (persona, origen, origen_nombre, personaje, orden, temporada, coste, version)
    values (v_uid, p_family, v_nombre, v_profile, p_orden,
            coalesce(v_temporada, 1), h.coste, h.version)
    returning id into v_derecho;
  exception when unique_violation then
    -- Dos peticiones a la vez con el mismo escalon: la primera escribio y esta
    -- choca contra `idx_derecho_escalon_una_vez`. Es un 'ya_forjado' con otra
    -- cara, y aqui todavia no se ha cobrado nada.
    return 'ya_forjado';
  end;

  perform public.mover_cartera(v_uid, v_profile, 'forja_llave', -h.coste, v_derecho, p_clave);

  return 'ok';
end $fn$;

revoke all on function public.forjar_llave(uuid, integer, text) from public;
revoke all on function public.forjar_llave(uuid, integer, text) from anon;
grant execute on function public.forjar_llave(uuid, integer, text) to authenticated;

-- ------------------------------------------------------------------
-- 6 · LAS LLAVES QUE TENGO
--
-- Se puede leer `derechos_expansion` directamente --tiene politica-- pero esta
-- funcion es la que la pantalla debe usar: devuelve lo que hace falta enseñar
-- y deja fuera `motivo`, que es un apunte de soporte.
-- ------------------------------------------------------------------

create or replace function public.mis_llaves()
returns table (
  id uuid,
  origen uuid,
  origen_nombre text,
  orden integer,
  temporada integer,
  coste integer,
  version text,
  estado text,
  destino_nombre text,
  forjada_at timestamptz,
  cerrada_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select d.id, d.origen, d.origen_nombre, d.orden, d.temporada, d.coste,
         d.version, d.estado, d.destino_nombre, d.forjada_at, d.cerrada_at
    from public.derechos_expansion d
   where d.persona = auth.uid()
   order by d.forjada_at desc;
$fn$;

revoke all on function public.mis_llaves() from public;
revoke all on function public.mis_llaves() from anon;
grant execute on function public.mis_llaves() to authenticated;

-- ------------------------------------------------------------------
-- 7 · GASTARLA
--
-- La llama la Fase 6 DENTRO de su transaccion, no antes: `R-20` y `T-10` dicen
-- que la llave se consume solo cuando la operacion de destino ha terminado
-- bien, y la unica manera de garantizarlo es que las dos cosas se deshagan
-- juntas si algo falla.
--
-- Por eso lanza en vez de devolver un codigo: su sitio es dentro de una
-- transaccion que ya no debe continuar.
--
-- Y por eso NO se concede a `authenticated`: un cliente que pudiera llamarla
-- suelta consumiria una llave sin crear nada.
--
-- Hoy no la llama nadie, igual que `exige_pais()` en la 055.
-- ------------------------------------------------------------------

create or replace function public.consumir_llave(
  p_derecho uuid,
  p_destino uuid,
  p_destino_nombre text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_estado text;
  v_persona uuid;
begin
  select d.estado, d.persona into v_estado, v_persona
    from public.derechos_expansion d
   where d.id = p_derecho
   for update;

  if v_estado is null then
    raise exception 'llave_no_existe';
  end if;
  -- La llave es de quien la forjo y de nadie mas.
  if v_persona is distinct from auth.uid() then
    raise exception 'llave_ajena';
  end if;
  -- `E-9.12`: una llave, un uso.
  if v_estado <> 'disponible' then
    raise exception 'llave_no_disponible';
  end if;
  if p_destino is null then
    raise exception 'llave_sin_destino';
  end if;

  update public.derechos_expansion
     set estado = 'consumido',
         destino = p_destino,
         destino_nombre = p_destino_nombre,
         cerrada_at = now()
   where id = p_derecho;
end $fn$;

revoke all on function public.consumir_llave(uuid, uuid, text) from public;
revoke all on function public.consumir_llave(uuid, uuid, text) from anon;
revoke all on function public.consumir_llave(uuid, uuid, text) from authenticated;

-- ------------------------------------------------------------------
-- 8 · DEVOLVERLA
--
-- `T-12`: revertir es excepcional y manual --un cobro erroneo, una
-- incidencia-- y devuelve el importe **como asiento nuevo** (`I-7`), nunca
-- borrando el original. Por eso pasa por `mover_cartera` como todo lo demas.
--
-- `T-13`: una llave CONSUMIDA no se revierte. Habria que deshacer una
-- pertenencia y un personaje ya en uso, y eso es un caso de soporte con
-- expulsion manual, no un `update`.
--
-- Solo operadores, y con motivo obligatorio: una devolucion sin explicacion
-- escrita es indistinguible de un descuadre.
-- ------------------------------------------------------------------

create or replace function public.revertir_llave(p_derecho uuid, p_motivo text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  d public.derechos_expansion%rowtype;
  v_profile uuid;
begin
  if not public.es_operador() then return 'no_autorizado'; end if;
  if p_motivo is null or length(btrim(p_motivo)) < 10 then return 'sin_motivo'; end if;

  select * into d from public.derechos_expansion where id = p_derecho for update;
  if d.id is null then return 'no_existe'; end if;
  if d.estado = 'consumido' then return 'ya_consumida'; end if;
  if d.estado <> 'disponible' then return 'no_disponible'; end if;

  update public.derechos_expansion
     set estado = 'revertido',
         cerrada_at = now(),
         motivo = btrim(p_motivo)
   where id = p_derecho;

  -- El personaje que la acredito puede haber desaparecido; el asiento se
  -- escribe igual, contra el que quede, porque el dinero volvio de verdad.
  v_profile := coalesce(
    (select p.id from public.profiles p where p.id = d.personaje),
    (select p.id from public.profiles p where p.persona = d.persona limit 1)
  );
  if v_profile is null then return 'sin_personaje'; end if;

  perform public.mover_cartera(d.persona, v_profile, 'devolucion_llave', d.coste, d.id, null);

  return 'ok';
end $fn$;

revoke all on function public.revertir_llave(uuid, text) from public;
revoke all on function public.revertir_llave(uuid, text) from anon;
grant execute on function public.revertir_llave(uuid, text) to authenticated;

-- Y el barrido de la 021, corregido por la 046.
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
--   select public.nivel_de_xp(0), public.nivel_de_xp(99), public.nivel_de_xp(100);
--   -- 1, 1, 2 · el limite exacto es donde una formula con raiz falla
--
--   select * from public.escala_expansion();
--   select count(*) from public.derechos_expansion;   -- 0 recien aplicada
--
-- Y el ensayo, que lo deshace todo al terminar: forja una llave de verdad
-- para una persona que exista, comprueba que la segunda vez dice 'ya_forjado'
-- y que el saldo bajo exactamente el coste.
--
--   do $ensayo$
--   declare
--     v_p uuid; v_f uuid; v_r text; v_antes integer; v_despues integer;
--   begin
--     select persona, family_id into v_p, v_f
--       from public.pertenencias where estado = 'activa' limit 1;
--     if v_p is null then raise exception 'ENSAYO sin persona con pertenencia'; end if;
--     select saldo into v_antes from public.carteras where persona = v_p;
--     -- `forjar_llave` usa auth.uid(), que en el SQL Editor es nulo: aqui se
--     -- comprueban las piezas, no la funcion entera.
--     raise exception 'ENSAYO nivel=% saldo=%',
--       public.nivel_en_gremio((select id from public.profiles where persona = v_p limit 1)),
--       v_antes;
--   end $ensayo$;
-- ------------------------------------------------------------------
