-- =====================================================================
-- EL GREMIO · esquema de base de datos para Supabase
-- Pega este fichero completo en el SQL Editor de tu proyecto y ejecútalo.
-- =====================================================================

-- Las funciones `language sql` se validan al crearlas, y `zona_de_perfil()`
-- consulta public.profiles unas líneas antes de que la tabla exista. Sobre una
-- base que ya tiene las tablas da igual; sobre una VACÍA, que es el caso de
-- reconstruir tras un desastre, aborta el fichero entero. Visto el 29-ago-2026,
-- la primera vez que se aplicó este fichero de cero.
set check_function_bodies = off;

create extension if not exists pgcrypto;
-- Hace falta para el cron.schedule() del final. No estaba, así que este fichero
-- tampoco se podía aplicar de cero por aquí: «schema "cron" does not exist».
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) <= 60),
  parent_pin_hash text not null,
  -- Migración 018. El día de esta casa se calcula aquí y en el navegador
  -- con la MISMA zona: si el servidor cuenta en Madrid y el móvil en la
  -- hora del aparato, la estrella diaria se puede pedir dos veces o
  -- ninguna y una racha viva se lee como rota.
  timezone text not null default 'Europe/Madrid',
  -- Migración 022. Qué versión de los textos legales se aceptó al fundar
  -- el gremio, y cuándo. Se guarda la VERSIÓN y no un `true` porque
  -- «aceptó las condiciones» no dice nada si nadie sabe qué decían
  -- entonces. Los gremios anteriores a la casilla lo tienen a null, que
  -- es la verdad, y esa es la consulta que los encuentra.
  legal_version text,
  legal_at timestamptz,
  -- Migración 032. Qué clase de gremio es: 'familia' (lo de siempre) o
  -- 'piso' (convivientes que no son familia). No cambia ninguna regla de
  -- puntos ni de validación: cambia el setup (una habitación privada por
  -- conviviente) y cómo se leen las zonas de la casa.
  tipo_gremio text not null default 'familia' check (tipo_gremio in ('familia','piso')),
  -- El tipo, con el vocabulario de la especificación (migración 053), y la
  -- versión de plantilla con la que este gremio nació. `tipo_gremio` sigue
  -- existiendo: es lo que lee el cliente viejo, y retirarla es el paso
  -- «contraer» de otra tanda.
  --
  -- Una plantilla mejorada NO reescribe gremios existentes: estaría pisando
  -- decisiones que ya no son suyas. Por eso cada gremio guarda su versión.
  tipo_plantilla text
    check (tipo_plantilla is null or tipo_plantilla in ('hogar','amigos','equipo','hogar_compartido')),
  plantilla_version text,
  created_at timestamptz not null default now()
);

-- Se valida contra el catálogo de Postgres, no contra una lista escrita a
-- mano: una lista propia envejece cada vez que un país cambia de horario.
-- Va en disparador porque un `check` no puede consultar una tabla.
create or replace function public.zona_valida()
returns trigger
language plpgsql
as $fn$
begin
  if new.timezone is null
     or not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'zona horaria desconocida: %', new.timezone;
  end if;
  return new;
end $fn$;

drop trigger if exists families_zona_valida on public.families;
create trigger families_zona_valida
  before insert or update of timezone on public.families
  for each row execute function public.zona_valida();

create or replace function public.zona_de_perfil(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select f.timezone
       from public.profiles p
       join public.families f on f.id = p.family_id
      where p.id = p_id),
    'Europe/Madrid'
  );
$fn$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (length(name) <= 40),
  role text not null check (role in ('adulto','junior','peque','mascota')),
  -- Perro o gato cuando el perfil es una mascota; null en las personas.
  -- Solo esas dos especies: son para las que hay catálogo con fundamento,
  -- y ofrecer «otro» sería prometer misiones que nadie ha justificado.
  -- Ver docs/MASCOTAS.md.
  species text,
  emoji text not null default '🙂',
  color text not null default '#a78bfa',
  xp integer not null default 0,
  coins integer not null default 0,
  -- Género con el que la app se dirige a esta persona. 'neutro' no es un
  -- tercer sexo: significa "no se ha dicho", y hace que se usen frases
  -- reescritas que no necesitan marca (ver src/lib/genero.js).
  gender text not null default 'neutro' check (gender in ('femenino','masculino','neutro')),
  -- Retirar en lugar de borrar: un perfil inactivo sale del selector pero
  -- conserva su historial y la XP que aportó a las metas ya cerradas.
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Las piezas del retrato (migración 035). Tres columnas y no un jsonb
  -- porque son pocas y así el catálogo lo protege un CHECK. Nullable =
  -- «sin elegir»: el cliente rellena con los defectos de piezasDe(), que
  -- es lo que permite desplegar sin tocar un solo perfil.
  -- El CHECK es de FORMA y no de catálogo, y es un cambio de criterio de
  -- la 037: enumerar los valores aquí obligaba a una migración por cada
  -- peinado nuevo, y no compraba casi nada, porque `piezasDe()` ya cae al
  -- valor por defecto ante una pieza que no conoce —hace falta, porque un
  -- cliente viejo lee piezas nuevas todo el rato—. El catálogo vive en
  -- src/lib/retratos.js.
  retrato_piel text check (retrato_piel is null or retrato_piel ~ '^[a-z]{2,24}$'),
  retrato_pelo text check (retrato_pelo is null or retrato_pelo ~ '^[a-z]{2,24}$'),
  retrato_peinado text check (retrato_peinado is null or retrato_peinado ~ '^[a-z]{2,24}$'),
  retrato_gafas text check (retrato_gafas is null or retrato_gafas ~ '^[a-z]{2,24}$'),
  -- Color de la túnica, separado del color del miembro: eran el mismo
  -- dato y por eso el aro y la ropa iban siempre a juego.
  retrato_tunica text check (retrato_tunica is null or retrato_tunica ~ '^[a-z]{2,24}$'),
  -- Del color del pelo: no lleva columna de color propia a propósito.
  retrato_barba text check (retrato_barba is null or retrato_barba ~ '^[a-z]{2,24}$'),
  -- Eje aparte del peinado: «con flequillo o sin él» vale para casi todos
  -- los cortes, y meterlo dentro los habría triplicado.
  retrato_flequillo text check (retrato_flequillo is null or retrato_flequillo ~ '^[a-z]{2,24}$'),
  -- La XP más alta alcanzada. La FASE del retrato se calcula contra esto
  -- y nunca contra `xp`: deshacer devuelve la XP, y si el personaje se
  -- desvistiera al deshacer, deshacer se sentiría como un castigo y la
  -- familia dejaría de hacerlo. Lo mantiene trg_marca_de_agua_xp, no el
  -- cliente: hay cuatro caminos que tocan `xp` y bastaría que uno se
  -- olvidara para que alguien perdiera el manto sin explicación.
  xp_maxima integer not null default 0,
  -- La forma `case` no es estilo: es lo único que funciona. La versión
  -- obvia —`(role='mascota' and species in (...)) or (role<>'mascota' and
  -- species is null)`— **acepta una mascota sin especie**, y costó
  -- descubrirlo el mismo día que se ejecutó la 027. Con `species` nulo esa
  -- expresión da `TRUE and NULL` = NULL en la primera rama y FALSE en la
  -- segunda, o sea `NULL or FALSE` = NULL. Y **un CHECK que da NULL PASA**:
  -- solo rechaza cuando da FALSE. La lógica de tres valores de SQL vuelve a
  -- morder justo donde uno cree que ha cubierto los dos casos.
  -- Su saldo vive en la cartera de su persona desde la conversión
  -- (migración 047): `coins` deja de ser una segunda fuente gastable. No se
  -- borra la columna porque el historial de asientos apunta a ella; se marca.
  saldo_local_cerrado boolean not null default false,
  -- El vínculo opcional con una identidad personal (migración 044). Lo
  -- normal es que sea nulo: una peque de tres años no tiene correo, una
  -- junior no debería necesitarlo para pedir su estrella, y una mascota
  -- no lo va a tener nunca. La identidad se gana cuando hace falta cruzar
  -- el límite de un gremio, y nunca se infiere por nombre, edad ni orden
  -- de creación: se elige, se confirma y queda auditada.
  persona uuid references auth.users(id) on delete set null,
  -- La marca no puede desviarse de la persona (migración 051): quien manda
  -- es `persona`, y esto impide que las dos digan cosas distintas.
  constraint profiles_marca_de_cartera check (
    saldo_local_cerrado = (persona is not null)
  ),
  constraint profiles_especie_coherente check (
    case
      when role = 'mascota' then species is not null and species in ('perro','gato')
      else species is null
    end
  ),
  -- Una mascota no tiene retrato: se queda con emoji (24-ago-2026). No es
  -- solo que falten piezas de perro, es que un perro no tiene fase y
  -- meterlo en una escalera de aprendiz a maestra diría sobre un animal
  -- algo que este proyecto no quiere decir.
  constraint profiles_retrato_solo_personas check (
    case
      when role = 'mascota'
        then retrato_piel is null and retrato_pelo is null and retrato_peinado is null
         and retrato_gafas is null and retrato_tunica is null and retrato_barba is null
         and retrato_flequillo is null
      else true
    end
  )
);

-- La marca de agua de la XP. Ver el comentario de `xp_maxima` arriba.
create or replace function public.marca_de_agua_xp()
returns trigger
language plpgsql
as $$
begin
  -- greatest() cubre los tres casos de una vez: sube la XP (marca nueva),
  -- baja la XP (marca intacta) e insert con XP inicial.
  new.xp_maxima := greatest(coalesce(new.xp_maxima, 0), coalesce(new.xp, 0));
  return new;
end $$;

drop trigger if exists trg_marca_de_agua_xp on public.profiles;
create trigger trg_marca_de_agua_xp
  before insert or update of xp, xp_maxima on public.profiles
  for each row execute function public.marca_de_agua_xp();

-- La identidad estable de una ACTIVIDAD (migración 028), por encima del
-- challenge concreto que la representa hoy.
--
-- `key` no se enseña nunca: existe para que un backfill o una
-- importación vuelvan a apuntar al mismo sitio sin adivinar. `label` es
-- administrativo y NINGUNA regla lo lee: si una regla leyera un texto
-- editable, cambiar una palabra reescribiría el pasado.
create table if not exists public.mission_families (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  key text not null check (length(key) between 1 and 80),
  label text not null check (length(label) between 1 and 120),
  created_at timestamptz not null default now(),
  -- Retiro lógico: una familia retirada sigue explicando completaciones
  -- antiguas.
  retired_at timestamptz,
  unique (family_id, key)
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade, -- null = no es de una persona concreta
  -- A quién va dirigida cuando no es de una persona: un rol entero, o el
  -- gremio al completo si también esto es null. Existe porque «Planificar
  -- el menú semanal» la hacen los dos adultos, y sin esto había que
  -- duplicar la misión —dos filas que editar y un historial partido—;
  -- marcarla para todos tampoco valía, porque se la comía la peque de tres
  -- años en su pantalla. El predicado vive en src/lib/misiones.js.
  target_roles text[] check (
    target_roles is null
    or (cardinality(target_roles) > 0 and target_roles <@ array['adulto','junior','peque','mascota']::text[])
  ),
  title text not null check (length(title) <= 120),
  emoji text not null default '⭐',
  xp integer not null default 10,
  coins integer not null default 5,
  frequency text not null default 'diario' check (frequency in ('diario','semanal','mensual','unico')),
  -- Habilidad que entrena esta misión. El sistema no premia tareas,
  -- entrena competencias: ver src/lib/habilidades.js.
  skill text check (skill is null or skill in (
    'hogar','salud','aprendizaje','amabilidad',
    'responsabilidad','cooperacion','creatividad','autonomia'
  )),
  -- Qué días de la semana toca (1 = lunes … 7 = domingo, el mismo número
  -- que `isodow`). null = todos los días, que es lo que hacen todas las
  -- misiones mientras nadie marque casillas.
  --
  -- Se planifica por DÍA DE LA SEMANA y no por «semana que empieza hoy»:
  -- un patrón de siete casillas no tiene fecha de inicio, así que se
  -- repite solo y empezar a usarlo un jueves no deja ninguna semana a
  -- medias. Por eso tampoco hay «cada N días», que sí necesitaría un
  -- ancla. El predicado vive en src/lib/misiones.js y su espejo, en
  -- `sin_mision_ese_dia`.
  --
  -- El array vacío está prohibido: significaría «no toca ningún día», o
  -- sea una misión activa que no sale nunca y que nadie sabría por qué.
  days smallint[] check (
    days is null
    or (cardinality(days) between 1 and 7 and days <@ array[1,2,3,4,5,6,7]::smallint[])
  ),
  active boolean not null default true,
  -- La identidad estable de la ACTIVIDAD, por encima de este challenge
  -- concreto (migración 028). Varios challenges pueden compartirla: el de
  -- invierno y el de verano, el del peque y el de la junior. Sin esto,
  -- duplicar una misión fabricaba variedad de la nada y los caminos de
  -- oficio —que piden practicar de varias formas— se podían comprar.
  mission_family_id uuid references public.mission_families(id) on delete set null,
  -- ¿Se anota cuánta ayuda hizo falta en cada validación? Apagado por
  -- defecto: pedir ese dato sin haberlo pensado convierte una app de
  -- reconocimiento en un formulario.
  track_assistance boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  -- `restrict`, no `cascade` (migración 029): borrar una misión ya no se
  -- lleva su historial por delante. No pueden ser verdad a la vez «una
  -- insignia ganada no se pierde» y «cualquiera puede borrar la prueba de
  -- que se ganó». Una misión SIN historia se sigue pudiendo borrar.
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pendiente' check (status in ('pendiente','aprobado','rechazado')),
  xp integer not null,
  coins integer not null,
  -- Elogio concreto de quien valida. Es el componente con más respaldo
  -- del sistema; el "muy bien" genérico pierde efecto por repetición.
  praise text check (praise is null or length(praise) <= 400),
  -- Quién apuntó la misión cuando no la apunta su propio perfil: una
  -- mascota no pulsa «¡Hecho!», lo hace un adulto en su nombre. Null en
  -- todo lo anterior, que eran personas apuntándose lo suyo.
  registrado_por uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- ------------------------------------------------------------------
  -- El contexto CONGELADO de lo que se hizo (migración 029).
  --
  -- Se captura al crear la completación, no al validarla: es cuando la
  -- persona hizo la cosa. Editar la misión mañana no toca el trabajo de
  -- ayer, porque el trabajo de ayer ya ocurrió. Las reglas de los sellos
  -- leen esto, no `challenges`.
  --
  -- `snapshot_quality` no se barre bajo la alfombra: `native` se capturó
  -- en su momento y es fiel; `legacy_current_state` se dedujo en el
  -- backfill del challenge que existía ese día, y puede no ser lo que
  -- realmente se entrenó si alguien lo editó por el camino.
  -- ------------------------------------------------------------------
  snapshot_title text,
  snapshot_skill text,
  snapshot_frequency text,
  snapshot_mission_family_id uuid references public.mission_families(id) on delete set null,
  snapshot_xp integer,
  snapshot_coins integer,
  snapshot_quality text check (snapshot_quality is null or snapshot_quality in ('native','legacy_current_state')),
  -- Cuánta ayuda hizo falta ESTA vez. Va en la completación y no en el
  -- perfil porque la autonomía no es un rasgo de la persona: alguien
  -- puede vestirse sola el martes y necesitar ayuda el jueves porque
  -- está malita, y eso no la vuelve menos autónoma. Solo se acepta si la
  -- misión tiene `track_assistance`.
  assistance_level text check (assistance_level is null or assistance_level in ('guided','prompted','independent'))
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (length(title) <= 120),
  emoji text not null default '🎁',
  cost integer not null default 50,
  -- 1 decidir · 2 vivir · 3 celebrar. Los de nivel 1 son los que mejor
  -- sostienen el hábito porque premian con autonomía, no con cosas.
  tier integer not null default 2 check (tier between 1 and 3),
  -- null = premio de la familia; 'mascota' = premio para el animal. Sin
  -- esto, «paseo largo de olfateo» sale en la tienda de la junior.
  target_role text check (target_role is null or target_role = 'mascota'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  cost integer not null,
  status text not null default 'pendiente' check (status in ('pendiente','entregado','cancelado')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.family_goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (length(title) <= 120),
  emoji text not null default '🏆',
  target_xp integer not null default 1000,
  achieved boolean not null default false,
  starts_at timestamptz not null default now(),
  achieved_at timestamptz,
  -- El número de temporada se GUARDA (migración 030). Venía derivándose
  -- de cuántas metas cerradas había, y eso deja de funcionar en cuanto
  -- alguien reabre o corrige una. Un sello que dice «temporada 3» tiene
  -- que seguir diciendo 3 dentro de cinco años.
  season_number integer check (season_number is null or season_number >= 1)
);

create table if not exists public.profile_badges (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  earned_at timestamptz not null default now(),
  -- Qué instancia de un sello repetible es esta (migración 030). Vacío =
  -- «este sello es único en la vida», que es como se comportan los 16
  -- viejos y los 66 del catálogo que no son de temporada. Con el
  -- `goal_id` dentro, el sello de la temporada 5 convive con el de la 1.
  --
  -- Vacío y NO null: en Postgres un `unique` con NULL deja pasar
  -- duplicados, porque NULL no es igual a NULL, y entonces la
  -- restricción no protegería justo el caso de siempre.
  instance_key text not null default '',
  season_number integer check (season_number is null or season_number >= 1),
  earned_context text check (earned_context is null or earned_context in ('directo','retroactivo','legado')),
  constraint profile_badges_perfil_code_instancia unique (profile_id, code, instance_key)
);

-- Plan diario: qué diarias se han programado para un día concreto.
--
-- Una CAPA por fecha encima del patrón semanal (migración 024). «Hay plan
-- para (familia, dia)» = existe al menos una fila con ese `dia`; si no hay
-- ninguna, manda el patrón. Solo aplica a las DIARIAS: semanales,
-- mensuales y únicas se resuelven por su vía de siempre. Detalle y porqué
-- en migracion-025-plan-diario.sql y en el predicado de src/lib/misiones.js.
create table if not exists public.plan_diario (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  dia date not null,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  -- Desnormalizado: a quién le sale ese día. Es la columna por la que lee
  -- el tablero, y una misión de rol no tiene un solo perfil.
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- 'patron' = venía preseleccionada; 'sustituta' = la metió un adulto.
  origen text not null default 'patron' check (origen in ('patron','sustituta')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique (family_id, dia, challenge_id)
);

create index if not exists idx_plan_diario_dia on public.plan_diario (family_id, dia);

-- ------------------------------------------------------------------
-- Modo limpieza (migración 031): campañas acotadas de limpieza.
--
-- Una campaña es una "operación" que lanza UN ADULTO desde el panel:
-- un formato del catálogo (relámpago / zona de la semana / estancia a
-- fondo), unas fechas y un puñado de misiones únicas repartidas entre
-- quienes participan. Las misiones son `challenges` normales
-- (frequency 'unico', skill 'hogar') enganchadas por `campana_id`, así
-- que completar y validar pasan por el mismo camino auditado de
-- siempre; lo único nuevo es el agrupador y el botín de cierre.
--
-- Solo se escribe por `crear_campana_limpieza` y se cierra por
-- `cerrar_campana_limpieza` (las dos security definer, más abajo):
-- la regla de «solo adultos» y la de «una activa por gremio» viven
-- aquí, no en el navegador. El catálogo y el reparto, en
-- src/lib/limpieza.js.
-- ------------------------------------------------------------------
create table if not exists public.campanas_limpieza (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  tipo text not null check (tipo in ('blitz','zona','profunda')),
  -- La clave del catálogo ('zona_cocina', 'blitz_30'…). Informativa: si
  -- el catálogo cambia, la campaña guardada no cambia con él.
  clave text not null check (length(clave) between 1 and 80),
  titulo text not null check (length(titulo) between 3 and 120),
  emoji text not null default '🧹',
  empieza date not null,
  -- Inclusive: el día de fin todavía cuenta. Acotada por construcción:
  -- una campaña no puede durar más de un mes.
  termina date not null,
  estado text not null default 'activa' check (estado in ('activa','completada','expirada')),
  activada_por uuid references public.profiles(id) on delete set null,
  cerrada_at timestamptz,
  created_at timestamptz not null default now(),
  -- `case`, no `and`: un CHECK que evalúa a NULL no rechaza nada (la
  -- lección de la 027). Aquí las dos columnas son not null, pero el
  -- rango se escribe igual de explícito.
  constraint campanas_fechas_coherentes check (termina >= empieza and termina <= empieza + 30)
);

create index if not exists idx_campanas_family on public.campanas_limpieza (family_id, created_at desc);

-- La regla «una operación activa por gremio» tiene respaldo FÍSICO,
-- como todos los «solo una vez» del proyecto (idx_bonuses_uno_al_dia y
-- compañía). Sin esto, dos aparatos lanzando a la vez pasaban los dos
-- la comprobación de la función y quedaban DOS campañas activas: una
-- invisible para siempre —campanaActiva() coge la primera— y bloqueando
-- cualquier lanzamiento nuevo. Lo cazó la revisión de código de la
-- 2.9.0 antes de ejecutar la migración.
create unique index if not exists idx_campanas_una_activa
  on public.campanas_limpieza (family_id) where estado = 'activa';

-- El enganche de una misión a su campaña. `restrict`: una campaña con
-- misiones no se borra, igual que una misión con historial (029). null =
-- misión normal, que es lo que son todas las que ya existen.
alter table public.challenges
  add column if not exists campana_id uuid references public.campanas_limpieza(id) on delete restrict;

create index if not exists idx_challenges_campana on public.challenges (campana_id) where campana_id is not null;

-- ------------------------------------------------------------------
-- Las zonas de la casa (migración 032): el mapa del modo limpieza.
--
-- Cada gremio tiene SUS zonas —cocina, los baños que tenga, la
-- buhardilla que ningún catálogo conoce— y de ellas salen las campañas
-- de zona y de limpieza profunda. Se siembran en el setup con la
-- pregunta de la vivienda y se editan en ⚙️ → Casa. Sin filas, el modo
-- limpieza cae a las zonas por defecto de src/lib/zonas.js: un gremio
-- anterior a esta migración no pierde nada.
--
-- `plantilla` dice QUÉ SE LIMPIA ahí (las tareas salen de ella);
-- `nombre` es cómo lo llama esta casa. Las plantas de un chalet no se
-- modelan: solo ponen nombre («Baño de arriba»), igual que el patrón
-- semanal evitó modelar semanas.
--
-- `tipo` 'privada' + `dueno` es la habitación de cada conviviente en el
-- modo piso (families.tipo_gremio). Sin CHECK que los ate: un dueño
-- retirado deja la zona sin dueño y eso es un estado legítimo que la
-- interfaz enseña, no un error que la base deba impedir.
-- ------------------------------------------------------------------
create table if not exists public.zonas_casa (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 2 and 60),
  emoji text not null default '🚪',
  plantilla text not null default 'generica' check (plantilla in (
    'cocina','bano','dormitorio','salon','entrada','lavadero','juegos','exterior','generica'
  )),
  tipo text not null default 'comun' check (tipo in ('comun','privada')),
  dueno uuid references public.profiles(id) on delete set null,
  orden smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_zonas_family on public.zonas_casa (family_id, orden);

-- Las tablas nuevas ya no heredan los grants de siempre (lección de la
-- 028, §7w del arranque): sin esto, la lectura anónima da 401 en vez del
-- `[]` del RLS, y las comprobaciones externas mienten.
grant select on public.zonas_casa to anon;
grant select, insert, update, delete on public.zonas_casa to authenticated;

-- ------------------------------------------------------------------
-- El buzón de fallos (migración 033).
--
-- Lo que escribe la familia cuando algo va mal, con la versión, la
-- pantalla y las huellas que `monitoring.js` ya tenía en memoria. No es
-- un sistema de tickets: es una libreta, y `estado` solo existe para
-- tachar lo ya arreglado.
-- ------------------------------------------------------------------
create table if not exists public.informes_fallo (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  texto text not null check (length(btrim(texto)) between 4 and 1000),
  pantalla text check (pantalla is null or length(pantalla) <= 40),
  -- `version_app` y no `release`: `app_logs.release` ya escuece por
  -- llamarse como una palabra de SQL; no hay motivo para repetirlo.
  version_app text check (version_app is null or length(version_app) <= 60),
  agente text check (agente is null or length(agente) <= 200),
  huellas jsonb not null default '[]'::jsonb,
  estado text not null default 'nuevo' check (estado in ('nuevo','visto','arreglado','descartado')),
  created_at timestamptz not null default now()
);

create index if not exists idx_informes_family on public.informes_fallo (family_id, created_at desc);

grant select on public.informes_fallo to anon;
grant select, insert, update, delete on public.informes_fallo to authenticated;

-- ------------------------------------------------------------------
-- Los reconocimientos (migración 034).
--
-- El primer canal HORIZONTAL de la app: cualquiera reconoce a cualquiera,
-- incluidos los adultos, a quienes hasta ahora no reconocía nadie. Tres
-- tipos: 'gracias' (con frase, cuelgue o no de un encargo), 'espontaneo'
-- (lo que nadie pidió; la pieza principal del modo piso) y 'gesto' (el de
-- la peque: una cara y una estrella, sin texto).
--
-- No hay ninguna columna de recompensa y es deliberado: un reconocimiento
-- no da monedas ni XP. Que la columna no exista es más fuerte que
-- acordarse de no usarla.
-- ------------------------------------------------------------------
create table if not exists public.reconocimientos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  de_profile uuid references public.profiles(id) on delete set null,
  a_profile uuid not null references public.profiles(id) on delete cascade,
  tipo text not null default 'gracias' check (tipo in ('gracias','espontaneo','gesto')),
  texto text check (texto is null or length(btrim(texto)) between 3 and 240),
  completion_id uuid references public.completions(id) on delete set null,
  -- El día del gremio, puesto por el cliente con la zona de la familia,
  -- igual que `bonuses.dia`. Es sobre lo que cuenta el tope diario.
  dia date not null,
  created_at timestamptz not null default now(),
  constraint reconocimiento_con_forma check (
    (tipo = 'gesto' and texto is null) or (tipo <> 'gesto' and texto is not null)
  ),
  constraint reconocimiento_no_a_uno_mismo check (de_profile is distinct from a_profile)
);

create index if not exists idx_reconocimientos_para
  on public.reconocimientos (family_id, a_profile, created_at desc);
create index if not exists idx_reconocimientos_dados
  on public.reconocimientos (de_profile, dia);

grant select on public.reconocimientos to anon;
grant select, insert, update, delete on public.reconocimientos to authenticated;

create index if not exists idx_completions_family_status on public.completions (family_id, status);
create index if not exists idx_completions_profile on public.completions (profile_id, requested_at desc);
create index if not exists idx_redemptions_family_status on public.redemptions (family_id, status);
-- Aquí hubo dos índices de más, `idx_profiles_family (family_id)` e
-- `idx_challenges_family (family_id)`. Un índice cuyas columnas son el
-- prefijo exacto de otro no se usa nunca: Postgres resuelve con el largo
-- lo mismo que resolvía con el corto, así que el corto solo cobra su
-- mantenimiento en cada insert y cada update. Retirados de la base el
-- 15-ago-2026 con migracion-009-indices-redundantes.sql.
--
-- ⚠️ Los dos que quedan aquí abajo son, desde entonces, los ÚNICOS índices
-- por `family_id` de `profiles` y `challenges`. Sus nombres suenan
-- específicos —«active», «skill»— pero lo que sostienen es el filtrado de
-- la política RLS `familia_miembro`, es decir, todas las lecturas de la
-- app. Antes de quitar cualquiera de los dos hay que crear el índice
-- simple por `family_id`; primero el create, después el drop.
create index if not exists idx_profiles_family_active on public.profiles (family_id, active);
create index if not exists idx_challenges_skill on public.challenges (family_id, skill);
-- Un índice por cada consulta real de src/App.jsx, ordenación incluida:
-- sin la columna de fecha en el índice, pedir "las últimas 400" obliga a
-- leer y ordenar todo el historial de la familia.
create index if not exists idx_completions_family_fecha on public.completions (family_id, requested_at desc);
create index if not exists idx_redemptions_family_fecha on public.redemptions (family_id, requested_at desc);
create index if not exists idx_rewards_family on public.rewards (family_id, created_at);
create index if not exists idx_badges_family on public.profile_badges (family_id);
create index if not exists idx_goals_family_activa on public.family_goals (family_id, achieved, starts_at desc);

-- ⚠️ El índice más importante del fichero, y el último en llegar
-- (migración 017). Cada política de aquí abajo pregunta a `mis_gremios()`,
-- y la primera rama de esa función es `families.owner = auth.uid()`, así
-- que sin este índice CADA petición de CADA casa recorre la tabla de
-- familias entera. Con una familia dentro no se nota; es justo el tipo de
-- cosa que solo aparece cuando ya hay gente usándolo.
--
-- Único, además: la app carga el gremio con `limit 1` sin orden, así que
-- una cuenta con dos gremios abre uno u otro según el día. Mientras eso
-- siga así, dos gremios por cuenta son un error, no una función.
create unique index if not exists idx_families_owner on public.families (owner);

-- ---------------------------------------------------------------------
-- Persona, pertenencia y las dos clases de credencial (migración 044).
--
-- Hoy el aislamiento es PROPIEDAD: «este gremio es de mi cuenta». Con
-- gremios múltiples el sujeto pasa a ser PERTENENCIA: «pertenezco a este
-- gremio». Para poder decir eso hace falta antes decir QUIÉN pertenece,
-- que es lo que estas dos tablas traen: un `profiles` no sabe de quién
-- es, y la cuenta de la casa no es una persona, es una llave que
-- comparten seis.
--
-- Razonamiento completo en migracion-044-persona-y-pertenencia.sql.
-- ---------------------------------------------------------------------

-- Una fila por cuenta, y la cuenta es la clave primaria: por construcción
-- un correo no puede ser credencial compartida e identidad personal a la
-- vez. La exclusión no es una comprobación que alguien tenga que
-- acordarse de hacer.
create table if not exists public.credenciales (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- 'compartida' es el correo de la casa: da acceso a UN gremio y a su
  -- selector de perfiles, y no representa a nadie. Es lo que hay hoy y
  -- todo lo que hay hoy. 'personal' es el correo de UNA persona: da
  -- acceso a sus pertenencias, a su cartera y a sus llaves.
  clase text not null check (clase in ('compartida','personal')),
  -- Solo lo tiene la compartida: una credencial personal no vive atada a
  -- un gremio, sus gremios son sus pertenencias.
  family_id uuid references public.families(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- En `case` y no en la forma obvia con `and`/`or`, por lo mismo que
  -- mordió en `profiles_especie_coherente`: con un nulo por medio esa
  -- expresión da NULL, y un CHECK que da NULL PASA.
  constraint credenciales_alcance check (
    case
      when clase = 'compartida' then family_id is not null
      else family_id is null
    end
  )
);

create index if not exists idx_credenciales_gremio
  on public.credenciales (family_id) where family_id is not null;

alter table public.credenciales enable row level security;

-- Escribe el servidor, siempre. Que una sesión pudiera clasificarse a sí
-- misma sería justo el parámetro del cliente que esto viene a impedir.
revoke all on table public.credenciales from anon;
revoke all on table public.credenciales from authenticated;
grant select on table public.credenciales to authenticated;

-- El vínculo que hoy no existe. Guarda rol, estado, cuándo y **cómo se
-- obtuvo**, y es el nuevo sujeto del aislamiento de datos.
create table if not exists public.pertenencias (
  id uuid primary key default gen_random_uuid(),
  -- Apunta a `auth.users` y no a `credenciales` para que la cascada siga
  -- la misma línea que el resto del esquema; que sea de clase personal lo
  -- defiende `tg_persona_es_personal` sobre `profiles`, y las funciones
  -- que crean pertenencias.
  persona uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  -- Vocabulario de la especificación (§9.2). El reparto de capacidades
  -- por rol llega con la plantilla de tipo; aquí el rol solo se guarda.
  rol text not null default 'miembro' check (rol in ('titular','gestor','miembro')),
  -- Nada se borra: salir es un estado, no una fila menos. Y ninguna
  -- transición a abandonada o expulsada puede dispararse por un cambio de
  -- configuración, solo por un acto humano explícito.
  estado text not null default 'activa' check (estado in ('activa','abandonada','expulsada')),
  origen text not null check (origen in ('fundacion','llave','invitacion','reclamacion')),
  desde timestamptz not null default now(),
  hasta timestamptz,
  constraint pertenencias_baja_fechada check (
    case when estado = 'activa' then hasta is null else hasta is not null end
  )
);

-- Una pertenencia ACTIVA por persona y gremio, con un índice y no con un
-- `select` previo: entre el select y el insert cabe otra petición. Es el
-- mismo oficio que hace `idx_bonuses_uno_al_dia`. Parcial, porque
-- abandonar y volver a entrar tiene que poder dejar dos filas.
create unique index if not exists idx_pertenencia_activa
  on public.pertenencias (persona, family_id) where estado = 'activa';

create index if not exists idx_pertenencias_gremio
  on public.pertenencias (family_id, estado);

alter table public.pertenencias enable row level security;

revoke all on table public.pertenencias from anon;
revoke all on table public.pertenencias from authenticated;
grant select on table public.pertenencias to authenticated;

-- Un personaje, una persona (lo garantiza la columna, que es una sola). Y
-- una persona, un personaje por gremio (lo garantiza este índice).
create unique index if not exists idx_profiles_persona_unica
  on public.profiles (family_id, persona) where persona is not null;

-- Una credencial COMPARTIDA no puede quedar detrás de un personaje: no
-- representa a nadie, y si se pudiera vincular, la clave de la casa se
-- convertiría en la identidad de quien la usara primero.
create or replace function public.tg_persona_es_personal()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.persona is null then
    return new;
  end if;
  if not exists (
    select 1 from public.credenciales c
     where c.user_id = new.persona and c.clase = 'personal'
  ) then
    raise exception 'la persona de un personaje tiene que ser una identidad personal';
  end if;
  return new;
end $fn$;

drop trigger if exists profiles_persona_personal on public.profiles;
create trigger profiles_persona_personal
  before insert or update of persona on public.profiles
  for each row execute function public.tg_persona_es_personal();

-- Un disparador no necesita que nadie tenga permiso de ejecucion: lo invoca
-- el motor, y el permiso solo hace falta para CREAR el disparador. Sin este
-- revoke, los privilegios por defecto de Supabase dejan la funcion colgando
-- de /rest/v1/rpc/ para cualquiera, con o sin sesion. Las tres tg_* que ya
-- existian tienen el mismo problema y se quedan como estan: son de otra
-- revision (la de grants que dejo abierta la Fase 0), no de esta.
revoke all on function public.tg_persona_es_personal() from anon;
revoke all on function public.tg_persona_es_personal() from authenticated;

-- ---------------------------------------------------------------------
-- «A qué gremios llego yo», en un solo sitio.
--
-- Todas las políticas de aquí abajo preguntan a esta función y a nadie
-- más: el día que haya que retirar la propiedad (paso «contraer») se
-- borra una rama de aquí y no se tocan catorce políticas.
--
--   1 · PROPIEDAD · lo de hoy. Es TEMPORAL: se retira cuando no quede
--       ningún cliente viejo en la calle. Retirarla antes de tiempo deja
--       a esas casas viendo su gremio vacío y creyendo que han perdido el
--       historial, que es el fallo que documenta la migración 017.
--   2 · CREDENCIAL COMPARTIDA · lo mismo que la 1, dicho por la tabla
--       nueva. Conviven a propósito durante todo el paso «convivir».
--   3 · PERTENENCIA ACTIVA · el sujeto de verdad.
-- ---------------------------------------------------------------------
create or replace function public.mis_gremios()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select f.id from public.families f where f.owner = auth.uid()
  union
  select c.family_id from public.credenciales c
   where c.user_id = auth.uid() and c.clase = 'compartida' and c.family_id is not null
  union
  select p.family_id from public.pertenencias p
   where p.persona = auth.uid() and p.estado = 'activa';
$fn$;

revoke all on function public.mis_gremios() from public;
revoke all on function public.mis_gremios() from anon;
grant execute on function public.mis_gremios() to authenticated;

-- La misma pregunta en booleano, para las funciones que ya reciben un
-- gremio y tienen que decidir si lo dejan pasar.
create or replace function public.es_mi_gremio(p_family uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select p_family is not null
     and exists (select 1 from public.mis_gremios() g where g = p_family);
$fn$;

revoke all on function public.es_mi_gremio(uuid) from public;
revoke all on function public.es_mi_gremio(uuid) from anon;
grant execute on function public.es_mi_gremio(uuid) to authenticated;

-- La propia siempre; las del gremio, quien está dentro. `mis_gremios()`
-- es security definer y por eso no vuelve a entrar por esta política.
drop policy if exists pertenencia_visible on public.pertenencias;
create policy pertenencia_visible on public.pertenencias
  for select to authenticated
  using (persona = auth.uid() or family_id in (select public.mis_gremios()));

-- Se lee la propia y nada más. De qué clase es la sesión lo necesita la
-- interfaz para decidir qué enseña; la de otro no le hace falta a nadie y
-- diría a qué gremio pertenece un correo.
drop policy if exists credencial_propia on public.credenciales;
create policy credencial_propia on public.credenciales
  for select to authenticated
  using (user_id = auth.uid());

-- Una cuenta sin fila devuelve 'sin_clasificar': existe, no ha fundado
-- nada y todavía no es nada. Es el estado de quien se acaba de registrar.
create or replace function public.clase_credencial()
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select c.clase from public.credenciales c where c.user_id = auth.uid()),
    'sin_clasificar'
  );
$fn$;

revoke all on function public.clase_credencial() from public;
revoke all on function public.clase_credencial() from anon;
grant execute on function public.clase_credencial() to authenticated;

-- La puerta que tienen que cruzar las operaciones de persona: forjar una
-- llave, usarla, ver la cartera, cambiar de gremio, aceptar una
-- invitación. Existe antes que la primera operación que la necesita a
-- propósito: una garantía que llega después se le olvida a alguien y no
-- se entera nadie.
create or replace function public.exige_persona()
returns void
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'sin_sesion';
  end if;
  if public.clase_credencial() <> 'personal' then
    -- El mensaje no dice quién es ni de qué gremio: solo que esta puerta
    -- no es la suya.
    raise exception 'exige_identidad_personal';
  end if;
end $fn$;

revoke all on function public.exige_persona() from public;
revoke all on function public.exige_persona() from anon;
grant execute on function public.exige_persona() to authenticated;

-- Cada gremio que existe tiene detrás una cuenta que es su credencial
-- compartida. Se dice aquí, una vez. `do nothing` y no `do update`: si
-- una cuenta ya estuviera clasificada como personal, reescribirla a
-- compartida sería justo el accidente que la clave primaria impide.
insert into public.credenciales (user_id, clase, family_id)
select f.owner, 'compartida', f.id
  from public.families f
on conflict (user_id) do nothing;

-- Y lo mismo para el gremio que se funde mañana, sin tocar el cliente.
create or replace function public.tg_credencial_de_gremio()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.credenciales (user_id, clase, family_id)
  values (new.owner, 'compartida', new.id)
  on conflict (user_id) do nothing;
  return new;
end $fn$;

drop trigger if exists families_credencial on public.families;
create trigger families_credencial
  after insert on public.families
  for each row execute function public.tg_credencial_de_gremio();

revoke all on function public.tg_credencial_de_gremio() from anon;
revoke all on function public.tg_credencial_de_gremio() from authenticated;


-- ---------------------------------------------------------------------
-- Seguridad por filas (RLS): todo queda aislado por familia.
-- Modelo: una única cuenta de autenticación por familia (la del padre/madre).
-- ---------------------------------------------------------------------

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.completions enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.family_goals enable row level security;
alter table public.profile_badges enable row level security;
alter table public.plan_diario enable row level security;
-- La 028 la enciende (su línea 168) y producción la tiene. Aquí faltaba, y eso
-- significa que CUALQUIER base creada desde este fichero nacía con la tabla sin
-- RLS y con `grant select` para anon: expuesta. La política ya estaba —está en
-- el bucle de abajo—, pero una política sin RLS no se aplica. Encontrado al
-- reconstruir la base de cero por primera vez, el 29-ago-2026.
alter table public.mission_families enable row level security;
alter table public.campanas_limpieza enable row level security;
alter table public.zonas_casa enable row level security;
alter table public.informes_fallo enable row level security;
alter table public.reconocimientos enable row level security;

-- Todas van declaradas `to authenticated`. Sin eso Postgres evalúa la
-- política —y con ella la subconsulta a `families`— también para el rol
-- anónimo, que no va a cumplirla nunca porque `auth.uid()` es nulo. La
-- clave anon es pública: las peticiones sin sesión las puede hacer
-- cualquiera y tantas como quiera, así que decir que no tiene que ser
-- barato.
drop policy if exists familia_owner on public.families;
create policy familia_owner on public.families
  for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- Y quien pertenece al gremio LO LEE, aunque la cuenta no sea suya
-- (migración 045). Va aparte y solo para `select` a propósito: pertenecer
-- da acceso a los datos, no da la potestad de renombrar el gremio,
-- cambiarle la zona horaria ni borrarlo. Eso sigue siendo de la cuenta
-- que lo fundó hasta que exista el modelo de capacidades.
--
-- Las dos políticas son permisivas y se suman: quien es dueña conserva
-- todo lo que tenía. Y hoy, sin ninguna pertenencia creada, esta política
-- no añade ni una fila a nadie: es exactamente el paso «convivir».
drop policy if exists familia_miembro_lee on public.families;
create policy familia_miembro_lee on public.families
  for select to authenticated
  using (id in (select public.mis_gremios()));

do $$
declare t text;
begin
  foreach t in array array['profiles','challenges','completions','rewards','redemptions','family_goals','profile_badges','plan_diario','mission_families','campanas_limpieza','zonas_casa','informes_fallo','reconocimientos']
  loop
    execute format('drop policy if exists familia_miembro on public.%I', t);
    execute format($f$
      create policy familia_miembro on public.%I
        for all to authenticated
        using (family_id in (select public.mis_gremios()))
        with check (family_id in (select public.mis_gremios()))
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Topes de cordura (migración 017)
--
-- Solo `completions`, `redemptions`, `challenges` y `app_logs` tenían
-- límite de ritmo; `profiles`, `rewards` y `family_goals` se podían
-- insertar sin freno desde una cuenta recién registrada, y registrarse lo
-- hace cualquiera desde la propia app. Esto no es antifraude: es lo que
-- evita que una cuenta llene la base de la que dependen las demás casas.
-- Los números son absurdos para una familia real y ridículos para un
-- script, que es exactamente donde tiene que caer un tope así.
-- ---------------------------------------------------------------------

create or replace function public.tg_tope_filas()
returns trigger language plpgsql security invoker as $$
declare
  v_max integer := tg_argv[0]::integer;
  v_cuantas integer;
begin
  execute format('select count(*) from public.%I where family_id = $1', tg_table_name)
    into v_cuantas using new.family_id;

  if v_cuantas >= v_max then
    raise exception 'tope_de_filas:%: el gremio ya tiene % (máximo %)', tg_table_name, v_cuantas, v_max
      using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists tope_profiles on public.profiles;
create trigger tope_profiles before insert on public.profiles
  for each row execute function public.tg_tope_filas('15');

drop trigger if exists tope_rewards on public.rewards;
create trigger tope_rewards before insert on public.rewards
  for each row execute function public.tg_tope_filas('120');

drop trigger if exists tope_goals on public.family_goals;
create trigger tope_goals before insert on public.family_goals
  for each row execute function public.tg_tope_filas('500');

drop trigger if exists tope_challenges on public.challenges;
create trigger tope_challenges before insert on public.challenges
  for each row execute function public.tg_tope_filas('600');

drop trigger if exists tope_campanas on public.campanas_limpieza;
create trigger tope_campanas before insert on public.campanas_limpieza
  for each row execute function public.tg_tope_filas('60');

drop trigger if exists tope_zonas on public.zonas_casa;
create trigger tope_zonas before insert on public.zonas_casa
  for each row execute function public.tg_tope_filas('40');

-- Un buzón sin tope es un sitio donde meter 100.000 filas gratis.
drop trigger if exists tope_informes on public.informes_fallo;
create trigger tope_informes before insert on public.informes_fallo
  for each row execute function public.tg_tope_filas('200');

drop trigger if exists tope_reconocimientos on public.reconocimientos;
create trigger tope_reconocimientos before insert on public.reconocimientos
  for each row execute function public.tg_tope_filas('4000');

-- Tres al día por persona, y el tope vive AQUÍ y no en la interfaz: uno
-- que solo viva en el cliente lo salta cualquiera que recargue, y este
-- tope no es una protección técnica sino la regla que sostiene el valor
-- de la pieza (§3.4 de docs/RECONOCIMIENTOS.md).
create or replace function public.tg_tope_gracias_dia()
returns trigger language plpgsql security invoker as $$
declare
  v_max integer := 3;
  v_cuantos integer;
begin
  if new.de_profile is null then
    return new;
  end if;

  select count(*) into v_cuantos
    from public.reconocimientos
   where de_profile = new.de_profile
     and dia = new.dia;

  if v_cuantos >= v_max then
    raise exception 'tope_de_gracias: ya has dado % hoy (máximo %)', v_cuantos, v_max
      using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists tope_gracias on public.reconocimientos;
create trigger tope_gracias before insert on public.reconocimientos
  for each row execute function public.tg_tope_gracias_dia();

-- El plan solo se programa cerca: hoy o mañana. El `unique` limita las
-- filas por día, pero `dia` es un eje libre y una cuenta podría insertar
-- para diez mil fechas. Esto lo ataja y ES la regla de producto.
create or replace function public.tg_plan_dia_cercano()
returns trigger language plpgsql security invoker as $$
begin
  if new.dia < current_date - 1 or new.dia > current_date + 2 then
    raise exception 'plan_dia_fuera_de_rango: % no está entre ayer y pasado mañana', new.dia
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists plan_dia_cercano on public.plan_diario;
create trigger plan_dia_cercano before insert on public.plan_diario
  for each row execute function public.tg_plan_dia_cercano();

-- ---------------------------------------------------------------------
-- Funciones atómicas (evitan puntos duplicados o saldos negativos)
-- ---------------------------------------------------------------------

-- Aprobar o rechazar una misión pendiente. Al aprobar, abona XP y monedas.
create or replace function public.resolve_completion(
  c_id uuid,
  new_status text,
  praise_text text default null
)
returns void
language plpgsql
security invoker
as $$
declare c public.completions%rowtype;
begin
  if new_status not in ('aprobado','rechazado') then
    raise exception 'estado no válido';
  end if;
  select * into c from public.completions where id = c_id and status = 'pendiente' for update;
  if not found then return; end if;

  update public.completions
    set status = new_status,
        resolved_at = now(),
        praise = nullif(btrim(coalesce(praise_text, '')), '')
    where id = c_id;

  if new_status = 'aprobado' then
    perform public.motivo_coins('mision', c.id);
    update public.profiles set xp = xp + c.xp, coins = coins + c.coins where id = c.profile_id;
  end if;
end $$;

-- Deshacer una misión: lo contrario exacto de resolve_completion.
-- Un toque equivocado (o una validación de más) tiene que poder revertirse
-- sin entrar en la base de datos. Si las monedas ya se gastaron, el saldo
-- se queda en cero en lugar de irse a negativo.
create or replace function public.undo_completion(c_id uuid)
returns text
language plpgsql
security invoker
as $$
declare
  c public.completions%rowtype;
  v_quitar integer;
begin
  select * into c from public.completions where id = c_id for update;
  if not found then return 'no_existe'; end if;

  -- Una tarea de una operación de limpieza ya COMPLETADA no se deshace
  -- (migración 031): su botín se repartió contando esta tarea, y
  -- deshacerla dejaría monedas pagadas por trabajo que la base ya no
  -- considera hecho. Las de operaciones activas o expiradas se deshacen
  -- como siempre, que ahí no hay botín que descuadrar.
  if exists (
    select 1
      from public.challenges ch
      join public.campanas_limpieza ca on ca.id = ch.campana_id
     where ch.id = c.challenge_id and ca.estado = 'completada'
  ) then
    return 'campana_cerrada';
  end if;

  if c.status = 'aprobado' then
    -- Nunca mas de lo que hay, mire donde mire el saldo. Con saldo local esto
    -- da exactamente lo mismo que el `greatest(0, ...)` de antes.
    v_quitar := least(c.coins, public.saldo_de(c.profile_id));
    perform public.motivo_coins('deshacer_mision', c.id);
    update public.profiles
      set xp = greatest(0, xp - c.xp),
          coins = coins - v_quitar
      where id = c.profile_id;
  end if;

  delete from public.completions where id = c_id;
  return 'ok';
end $$;

-- Canjear un premio: descuenta monedas y crea el canje pendiente de entrega.
create or replace function public.redeem_reward(rw_id uuid, p_id uuid, p_clave text default null)
returns text
language plpgsql
security invoker
as $$
declare
  rw public.rewards%rowtype;
  p public.profiles%rowtype;
  v_previo text;
  v_saldo integer;
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

  -- El saldo de verdad: el local si no hay persona detras, y la cartera si la
  -- hay (051). Mirar `p.coins` aqui daria cero para todo el mundo convertido.
  v_saldo := public.saldo_de(p_id);

  if v_saldo < rw.cost then
    -- Un intento fallido tambien es historia: sin el, un pico de gente que
    -- no llega al premio no se ve en ninguna parte.
    perform public.anota_coins(p_id, 'canje', -rw.cost, v_saldo, v_saldo, 'sin_monedas', rw.id, p_clave);
    return 'sin_monedas';
  end if;

  perform public.motivo_coins('canje', rw.id, p_clave);
  update public.profiles set coins = coins - rw.cost where id = p_id;
  insert into public.redemptions (family_id, reward_id, profile_id, cost)
    values (rw.family_id, rw.id, p_id, rw.cost);
  return 'ok';
end $$;

-- Entregar o cancelar un canje. Al cancelar, devuelve las monedas.
create or replace function public.resolve_redemption(r_id uuid, new_status text)
returns void
language plpgsql
security invoker
as $$
declare r public.redemptions%rowtype;
begin
  if new_status not in ('entregado','cancelado') then
    raise exception 'estado no válido';
  end if;
  select * into r from public.redemptions where id = r_id and status = 'pendiente' for update;
  if not found then return; end if;
  update public.redemptions set status = new_status, resolved_at = now() where id = r_id;
  if new_status = 'cancelado' then
    perform public.motivo_coins('devolucion_canje', r.id);
    update public.profiles set coins = coins + r.cost where id = r.profile_id;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Realtime: para que las validaciones aparezcan al instante en los
-- dispositivos de las niñas sin recargar.
-- ---------------------------------------------------------------------

do $$ begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.challenges; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.completions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.rewards; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.redemptions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.family_goals; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.profile_badges; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.plan_diario; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.campanas_limpieza; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.zonas_casa; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.reconocimientos; exception when duplicate_object then null; end $$;

-- =====================================================================
-- CAPA DE PRODUCCIÓN
-- Registro estructurado, límite de ritmo y comprobación de salud.
-- Si ya tenías el esquema creado, ejecuta migracion-002-produccion.sql
-- en lugar de este fichero entero.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Logs estructurados
-- Una fila por línea de log de nivel warn o error (el cliente descarta
-- los informativos salvo que se active la bandera logsInfo).
-- ---------------------------------------------------------------------

create table if not exists public.app_logs (
  id bigint generated always as identity primary key,
  family_id uuid references public.families(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  ts timestamptz not null default now(),
  nivel text not null check (nivel in ('debug','info','warn','error')),
  evento text not null,
  release text,
  sesion_id text,
  request_id text,
  datos jsonb not null default '{}'::jsonb
);

create index if not exists idx_app_logs_ts on public.app_logs (ts desc);
create index if not exists idx_app_logs_family_nivel on public.app_logs (family_id, nivel, ts desc);

alter table public.app_logs enable row level security;

drop policy if exists logs_lectura on public.app_logs;
create policy logs_lectura on public.app_logs
  for select to authenticated
  using (family_id in (select public.mis_gremios()));

-- La escritura admite family_id nulo: hay errores que ocurren antes de
-- saber a qué familia pertenece la sesión (por ejemplo, al cargar).
drop policy if exists logs_escritura on public.app_logs;
create policy logs_escritura on public.app_logs
  for insert to authenticated
  with check (
    auth.uid() is not null
    and (family_id is null or family_id in (select public.mis_gremios()))
  );

-- Retención: los logs no son un archivo histórico. Bórralos a los 30 días.
--
-- `security definer` desde la migración 017, y no es un detalle. Cuando
-- era `security invoker` borraba solo lo que veía quien la llamaba, o sea
-- los logs de su propia familia: con una familia dentro eso PARECÍA «borra
-- los logs viejos». Con muchas, cada casa tendría que acordarse, y las
-- filas con `family_id` nulo —que existen a propósito, ver la política de
-- arriba— no las ve nadie y no las borraba nadie nunca.
--
-- Por eso mismo la app no la puede llamar: se le retira el permiso a
-- `authenticated`. La ejecuta el SQL Editor o un cron con clave de
-- servicio.
create or replace function public.purge_logs(dias integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare borradas integer;
begin
  delete from public.app_logs where ts < now() - (dias || ' days')::interval;
  get diagnostics borradas = row_count;

  -- Las ventanas de ritmo caducadas se van con ellos: la limpieza perezosa
  -- del 1 % puede no llegar nunca en una base poco visitada.
  delete from public.rate_limits where window_start < now() - interval '2 days';
  delete from public.user_limits where window_start < now() - interval '2 days';

  return borradas;
end $$;

revoke all on function public.purge_logs(integer) from public;
revoke all on function public.purge_logs(integer) from authenticated;

-- El plan de ayer no sirve para nada. Se barre lo anterior a hace 7 días
-- en el cron de las 4:12 (ver más abajo). `security definer` para correr
-- sin sesión y `revoke` a todos: no la llama el cliente.
create or replace function public.purge_planes(dias integer default 7)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare borradas integer;
begin
  delete from public.plan_diario where dia < current_date - dias;
  get diagnostics borradas = row_count;
  return borradas;
end $$;

revoke all on function public.purge_planes(integer) from public;
revoke all on function public.purge_planes(integer) from anon;
revoke all on function public.purge_planes(integer) from authenticated;

-- ---------------------------------------------------------------------
-- 2. Límite de ritmo (rate limiting)
-- Se aplica en la base de datos, no en el cliente: es el único punto que
-- no se puede saltar desde la consola del navegador. Protege contra el
-- bucle accidental (un dedo de tres años sobre el mismo botón) y contra
-- el uso indebido de la clave anon, que es pública por diseño.
-- El inicio de sesión y el alta los limita Supabase Auth; esos ajustes
-- viven en el panel (Authentication → Rate Limits), ver docs/RUNBOOK.md.
-- ---------------------------------------------------------------------

create table if not exists public.rate_limits (
  family_id uuid not null references public.families(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (family_id, bucket, window_start)
);

alter table public.rate_limits enable row level security;

drop policy if exists ritmo_familia on public.rate_limits;
create policy ritmo_familia on public.rate_limits
  for all to authenticated
  using (family_id in (select public.mis_gremios()))
  with check (family_id in (select public.mis_gremios()));

-- La misma cuenta, pero por CUENTA y no por familia (migración 017).
-- Existe por un hueco concreto: `rate_guard` se rinde cuando la familia es
-- nula y la escritura de `app_logs` admite familia nula a propósito, así
-- que entre las dos decisiones razonables cualquier cuenta registrada
-- podía escribir filas sin límite. Cuando aún no hay gremio, la cuenta es
-- lo único que se sabe de quien escribe.
create table if not exists public.user_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket, window_start)
);

alter table public.user_limits enable row level security;

drop policy if exists ritmo_cuenta on public.user_limits;
create policy ritmo_cuenta on public.user_limits
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.rate_guard_user(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
  ventana timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  actual integer;
begin
  if v_user is null then return; end if;

  insert into public.user_limits (user_id, bucket, window_start, count)
  values (v_user, p_bucket, ventana, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = public.user_limits.count + 1
  returning count into actual;

  if random() < 0.01 then
    delete from public.user_limits where window_start < now() - interval '2 days';
  end if;

  if actual > p_max then
    raise exception 'limite_de_ritmo:%: % en % s (máximo %)', p_bucket, actual, p_window_seconds, p_max
      using errcode = 'P0001';
  end if;
end $$;

create or replace function public.rate_guard(
  p_family uuid,
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
returns void
language plpgsql
security invoker
as $$
declare
  ventana timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  actual integer;
begin
  if p_family is null then return; end if;

  insert into public.rate_limits (family_id, bucket, window_start, count)
  values (p_family, p_bucket, ventana, 1)
  on conflict (family_id, bucket, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into actual;

  -- Limpieza perezosa: sin esto la tabla crece para siempre.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  if actual > p_max then
    raise exception 'limite_de_ritmo:%: % en % s (máximo %)', p_bucket, actual, p_window_seconds, p_max
      using errcode = 'P0001';
  end if;
end $$;

create or replace function public.tg_ritmo_completions()
returns trigger language plpgsql security invoker as $$
begin
  perform public.rate_guard(new.family_id, 'completions', 120, 3600);
  return new;
end $$;

create or replace function public.tg_ritmo_redemptions()
returns trigger language plpgsql security invoker as $$
begin
  perform public.rate_guard(new.family_id, 'redemptions', 30, 3600);
  return new;
end $$;

create or replace function public.tg_ritmo_challenges()
returns trigger language plpgsql security invoker as $$
begin
  perform public.rate_guard(new.family_id, 'challenges', 300, 3600);
  return new;
end $$;

-- Las dos ramas cubiertas: con gremio se cuenta por gremio, sin gremio se
-- cuenta por cuenta y mucho más estrecho (un cliente honrado escribe
-- cuatro líneas de arranque antes de saber de qué casa es). De paso
-- recorta el `datos` desmesurado: el registro es para diagnosticar un
-- fallo, no un sitio donde dejar ficheros.
create or replace function public.tg_ritmo_logs()
returns trigger language plpgsql security invoker as $$
begin
  if new.family_id is null then
    perform public.rate_guard_user('app_logs_sin_familia', 60, 3600);
  else
    perform public.rate_guard(new.family_id, 'app_logs', 600, 3600);
  end if;

  if length(new.datos::text) > 8192 then
    new.datos := jsonb_build_object(
      'truncado', true,
      'bytes', length(new.datos::text),
      'evento', new.evento
    );
  end if;

  return new;
end $$;

drop trigger if exists ritmo_completions on public.completions;
create trigger ritmo_completions before insert on public.completions
  for each row execute function public.tg_ritmo_completions();

drop trigger if exists ritmo_redemptions on public.redemptions;
create trigger ritmo_redemptions before insert on public.redemptions
  for each row execute function public.tg_ritmo_redemptions();

drop trigger if exists ritmo_challenges on public.challenges;
create trigger ritmo_challenges before insert on public.challenges
  for each row execute function public.tg_ritmo_challenges();

drop trigger if exists ritmo_logs on public.app_logs;
create trigger ritmo_logs before insert on public.app_logs
  for each row execute function public.tg_ritmo_logs();

-- ---------------------------------------------------------------------
-- 3. Comprobación de salud
-- Devuelve un JSON con el estado de la base y sus dependencias. La llaman
-- la pantalla de estado de la app y scripts/health-check.mjs (que sirve
-- para un monitor externo tipo UptimeRobot o para el CI).
-- Funciona con la clave anon sin sesión: los contadores saldrán a cero
-- por RLS, y precisamente eso demuestra que RLS está vivo.
-- ---------------------------------------------------------------------

create or replace function public.health()
returns json
language sql
security invoker
stable
as $$
  select json_build_object(
    'status', 'ok',
    'ts', now(),
    'postgres', current_setting('server_version'),
    'familias_visibles', (select count(*) from public.families),
    'pendientes', (select count(*) from public.completions where status = 'pendiente'),
    'errores_24h', (select count(*) from public.app_logs where nivel = 'error' and ts > now() - interval '24 hours')
  );
$$;



-- ------------------------------------------------------------------
-- Bonus: monedas que NO vienen de una misión.
--
-- Dos orígenes con la misma forma: el juego diario de la peque (una vez
-- al día, tipo 'globos') y el premio a mano de un adulto por algo
-- excepcional (tipo 'manual', varias veces al día si hace falta). Tenerlos
-- en la misma tabla hace que «de dónde salieron estas monedas» se lea de
-- una sola consulta.
-- ------------------------------------------------------------------

create table if not exists public.bonuses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  dia date not null default (now() at time zone 'Europe/Madrid')::date,
  tipo text not null default 'globos',
  coins integer not null default 5,
  -- Obligatorio para los manuales: sin motivo, dentro de un mes nadie
  -- recuerda por qué esa persona tiene monedas de más.
  motivo text check (motivo is null or length(motivo) <= 300),
  -- Qué adulto lo concedió. Si mañana hay que explicar el saldo, la
  -- respuesta tiene que existir en algún sitio.
  otorgado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- El tope de «uno al día» es del juego. Los manuales quedan fuera: la vida
-- no viene de uno en uno.
create unique index if not exists idx_bonuses_uno_al_dia
  on public.bonuses (profile_id, dia, tipo) where tipo <> 'manual';
create index if not exists idx_bonuses_family_dia on public.bonuses (family_id, dia desc);

alter table public.bonuses enable row level security;

drop policy if exists bonuses_lectura on public.bonuses;
create policy bonuses_lectura on public.bonuses
  for select to authenticated
  using (family_id in (select public.mis_gremios()));

-- Sin política de insert a propósito: solo se entra por las dos funciones
-- de abajo, que son `security definer`. Con insert abierto, cualquiera con
-- la consola del navegador se regala monedas escribiendo en la tabla.

do $$ begin alter publication supabase_realtime add table public.bonuses; exception when duplicate_object then null; end $$;

-- El juego diario de la peque. Devuelve texto, como el resto de RPC:
--   'ok' · 'ya_hoy' (caso normal, no error) · 'no_existe' · 'no_es_tuyo'
create or replace function public.grant_daily_bonus(p_id uuid, p_tipo text default 'globos')
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_tz text;
  v_coins integer := 5;   -- una estrella exacta (MONEDAS_POR_ESTRELLA)
begin
  select family_id into v_family from public.profiles where id = p_id and active;
  if v_family is null then
    return 'no_existe';
  end if;

  if not public.es_mi_gremio(v_family) then
    return 'no_es_tuyo';
  end if;

  select timezone into v_tz from public.families where id = v_family;

  -- La carrera se resuelve aquí: dos toques simultáneos entran los dos al
  -- insert y uno se lleva la violación de unicidad. Comprobar antes con un
  -- select y luego insertar dejaría la ventana abierta.
  begin
    insert into public.bonuses (family_id, profile_id, tipo, coins, dia)
    values (v_family, p_id, p_tipo, v_coins, (now() at time zone v_tz)::date);
  exception when unique_violation then
    return 'ya_hoy';
  end;

  perform public.motivo_coins('bonus_diario');
  update public.profiles set coins = coins + v_coins where id = p_id;
  return 'ok';
end $fn$;

revoke all on function public.grant_daily_bonus(uuid, text) from public;
revoke all on function public.grant_daily_bonus(uuid, text) from anon;
grant execute on function public.grant_daily_bonus(uuid, text) to authenticated;

-- El premio a mano. Tres reglas que se garantizan AQUÍ y no solo en el
-- formulario, porque una regla que solo vive en el navegador no es regla:
-- no da XP, el motivo es obligatorio, y lo concede un adulto identificado.
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

  if v_rol_quien <> 'adulto' then
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

-- La firma lleva CINCO argumentos desde la 042, que le añadió `p_clave`.
-- Estas dos líneas se quedaron con la de cuatro, y una firma que no existe no
-- es un aviso: `revoke` falla con "function does not exist" y **corta la
-- reconstrucción de la base ahi mismo**. Encontrado el 30-ago-2026 al
-- comparar el fichero con producción, donde ademas se veia el efecto: es la
-- única de las seis con PUBLIC todavia en la lista de permisos, justo porque
-- ese `revoke` nunca llego a ejecutarse.
revoke all on function public.grant_manual_bonus(uuid, integer, text, uuid, text) from public;
revoke all on function public.grant_manual_bonus(uuid, integer, text, uuid, text) from anon;
grant execute on function public.grant_manual_bonus(uuid, integer, text, uuid, text) to authenticated;

-- ------------------------------------------------------------------
-- Modo limpieza (migración 031): lanzar y cerrar campañas.
--
-- Las dos reglas que hacen que esto sea una función y no dos inserts
-- desde el navegador:
--
--  1. SOLO UN ADULTO lanza y cierra. Igual que el premio a mano: la
--     comprobación del cliente da el mensaje, esta es la que manda.
--  2. Campaña y misiones nacen EN LA MISMA TRANSACCIÓN. En dos
--     llamadas, un fallo de red por medio dejaría una campaña vacía o
--     misiones huérfanas, que es la misma razón por la que la voz de
--     mando crea su misión dentro de spend_power.
-- ------------------------------------------------------------------

-- Lanza una campaña. `p_tareas` es un array JSON de
--   { profile_id, title, emoji, xp, coins }
-- con los puntos ya calculados por src/lib/limpieza.js; aquí solo se
-- comprueba que estén dentro de los topes de cordura, porque un tope
-- que solo vive en el cliente no es un tope. Devuelve texto:
--   'ok' · 'quien_no_existe' · 'no_es_tuyo' · 'no_es_adulto' ·
--   'tipo_invalido' · 'duracion_invalida' · 'titulo_invalido' ·
--   'sin_tareas' · 'tarea_invalida' · 'ya_hay_activa'
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

  if v_rol <> 'adulto' then return 'no_es_adulto'; end if;

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

revoke all on function public.crear_campana_limpieza(uuid, text, text, text, text, integer, jsonb) from public;
revoke all on function public.crear_campana_limpieza(uuid, text, text, text, text, integer, jsonb) from anon;
grant execute on function public.crear_campana_limpieza(uuid, text, text, text, text, integer, jsonb) to authenticated;

-- Cierra una campaña, y el desenlace lo decide la base, no el botón:
--
--  · todo aprobado           → 'ok': botín (la mitad de lo ganado por
--    cada participante, hacia abajo) y estado 'completada'.
--  · sin completar y vencida → 'expirada': las misiones sin hacer se
--    pausan y no hay botín.
--  · sin completar y en plazo → 'aun_no', y no toca nada.
--
-- El botín entra por `bonuses` con tipo 'limpieza:<id de campaña>'
-- —el mismo patrón que 'racha:N'— y por eso el índice de «uno al día»
-- no lo estorba aunque el mismo día se cierren dos campañas. Solo
-- monedas, nada de XP: la misma regla que el premio a mano, y por lo
-- mismo. Devuelve además 'no_existe' · 'no_es_tuyo' · 'quien_no_existe'
-- · 'no_es_adulto' · 'ya_cerrada'.
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
  if v_rol <> 'adulto' then return 'no_es_adulto'; end if;

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

revoke all on function public.cerrar_campana_limpieza(uuid, uuid) from public;
revoke all on function public.cerrar_campana_limpieza(uuid, uuid) from anon;
grant execute on function public.cerrar_campana_limpieza(uuid, uuid) to authenticated;


-- ------------------------------------------------------------------
-- Poderes de las insignias (migración 015).
--
-- Un poder gastable (comodín, voz de mando) tiene usos contados, y la
-- cuenta la lleva Postgres: si viviera en el navegador, recargar la
-- página devolvería los usos. Mismo bug que tuvo el juego de globos.
-- ------------------------------------------------------------------

create table if not exists public.power_uses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- La insignia que da el poder. Los usos se cuentan POR INSIGNIA y no por
  -- tipo: dos insignias distintas que den comodín dan sus usos cada una.
  code text not null,
  tipo text not null check (tipo in ('salva_racha', 'asigna_tarea')),
  -- A quién se le encarga la misión (voz de mando). Nulo en los demás.
  target_id uuid references public.profiles(id) on delete set null,
  nota text,
  used_at timestamptz not null default now()
);

create index if not exists idx_power_uses_profile on public.power_uses (profile_id, code);
create index if not exists idx_power_uses_family on public.power_uses (family_id, used_at desc);

alter table public.power_uses enable row level security;

drop policy if exists power_uses_lectura on public.power_uses;
create policy power_uses_lectura on public.power_uses
  for select to authenticated
  using (family_id in (select public.mis_gremios()));

-- Sin política de insert: se entra por la función, que es la que cuenta.

do $$ begin alter publication supabase_realtime add table public.power_uses; exception when duplicate_object then null; end $$;

-- Las insignias `unica` las tiene UNA persona del gremio. Los códigos van
-- escritos a mano porque la alternativa (una columna `clase` en la tabla)
-- sería el mismo catálogo duplicado y además desincronizable fila a fila.
-- Si se añade una única nueva en src/lib/insignias.js, hay que añadirla
-- aquí: tests/insignias.test.js recuerda esa deuda.
create unique index if not exists idx_badges_unica_por_gremio
  on public.profile_badges (family_id, code)
  where code in ('primer_nivel10', 'mano_derecha', 'coleccionista');

-- ------------------------------------------------------------------
-- Sellos de oficio: familias de misión y contexto congelado
-- (migraciones 028 y 029). El porqué de cada pieza está en sus ficheros.
-- ------------------------------------------------------------------

create index if not exists idx_mission_families_gremio
  on public.mission_families (family_id, retired_at);
create index if not exists idx_challenges_mission_family
  on public.challenges (mission_family_id);

-- Las tres preguntas que hacen las reglas: días distintos, por habilidad
-- y por familia de misión. Parciales sobre aprobadas porque ninguna
-- regla mira lo pendiente ni lo rechazado.
create index if not exists idx_completions_sellos_habilidad
  on public.completions (profile_id, snapshot_skill, requested_at)
  where status = 'aprobado';
create index if not exists idx_completions_sellos_familia
  on public.completions (profile_id, snapshot_mission_family_id, requested_at)
  where status = 'aprobado';

create unique index if not exists idx_family_goals_temporada
  on public.family_goals (family_id, season_number)
  where season_number is not null;

-- Una familia de misión no se muda de gremio ni cambia de clave: sin
-- esto, un `update` dejaría challenges de un gremio apuntando a la
-- familia de otro y el aislamiento se rompería por la puerta de atrás.
create or replace function public.tg_mission_family_inmutable()
returns trigger language plpgsql as $$
begin
  if new.family_id is distinct from old.family_id then
    raise exception 'una familia de misión no cambia de gremio';
  end if;
  if new.key is distinct from old.key then
    raise exception 'la clave de una familia de misión no se reescribe';
  end if;
  return new;
end $$;

drop trigger if exists tg_mission_family_inmutable on public.mission_families;
create trigger tg_mission_family_inmutable
  before update on public.mission_families
  for each row execute function public.tg_mission_family_inmutable();

-- Toda misión nueva nace con familia. En el trigger y no en la app
-- porque hay tres sitios que crean challenges y el día que aparezca un
-- cuarto se olvidaría.
create or replace function public.tg_challenge_familia()
returns trigger language plpgsql security definer set search_path = public as $$
declare nueva uuid;
begin
  if new.mission_family_id is not null then
    return new;
  end if;
  insert into public.mission_families (family_id, key, label)
  values (new.family_id, 'challenge:' || new.id::text, left(new.title, 120))
  on conflict (family_id, key) do update set label = excluded.label
  returning id into nueva;
  new.mission_family_id := nueva;
  return new;
end $$;

drop trigger if exists tg_challenge_familia on public.challenges;
create trigger tg_challenge_familia
  before insert on public.challenges
  for each row execute function public.tg_challenge_familia();

-- El contexto se captura al CREAR, no al validar: una misión pedida el
-- lunes y aprobada el jueves debe guardar lo que era el lunes.
create or replace function public.tg_completion_snapshot()
returns trigger language plpgsql security definer set search_path = public as $$
declare reto public.challenges%rowtype;
begin
  select * into reto from public.challenges where id = new.challenge_id;
  if not found then
    new.snapshot_quality := coalesce(new.snapshot_quality, 'legacy_current_state');
    return new;
  end if;
  new.snapshot_title := coalesce(new.snapshot_title, left(reto.title, 160));
  new.snapshot_skill := coalesce(new.snapshot_skill, reto.skill);
  new.snapshot_frequency := coalesce(new.snapshot_frequency, reto.frequency);
  new.snapshot_mission_family_id := coalesce(new.snapshot_mission_family_id, reto.mission_family_id);
  new.snapshot_xp := coalesce(new.snapshot_xp, new.xp);
  new.snapshot_coins := coalesce(new.snapshot_coins, new.coins);
  new.snapshot_quality := coalesce(new.snapshot_quality, 'native');
  -- El nivel de ayuda solo se acepta si esa misión lo pide: si no, un
  -- cliente podría marcar «independiente» en cualquier cosa y abrir los
  -- sellos de Autonomía sin que nadie lo haya observado.
  if new.assistance_level is not null and not coalesce(reto.track_assistance, false) then
    new.assistance_level := null;
  end if;
  return new;
end $$;

drop trigger if exists tg_completion_snapshot on public.completions;
create trigger tg_completion_snapshot
  before insert on public.completions
  for each row execute function public.tg_completion_snapshot();

-- Si se pudiera actualizar no sería un snapshot, sería una copia del
-- estado actual con pasos extra. `assistance_level` sí se deja mover:
-- quien valida puede anotarlo después de haber visto cómo fue.
create or replace function public.tg_completion_snapshot_inmutable()
returns trigger language plpgsql as $$
begin
  -- La PRIMERA escritura se permite: es el backfill de la 029 (o una
  -- reparación) poniendo contexto donde no lo había. Sin esta rama, el
  -- propio backfill de la migración chocaba contra este trigger y la
  -- 029 no se podía ejecutar NUNCA: en una base nueva no salta (cero
  -- filas que rellenar), así que el fallo solo apareció contra la base
  -- real. La puerta no se puede reabrir: quitar `snapshot_quality` una
  -- vez puesto cae en la comprobación de abajo.
  if old.snapshot_quality is null then
    return new;
  end if;
  if new.snapshot_title is distinct from old.snapshot_title
     or new.snapshot_skill is distinct from old.snapshot_skill
     or new.snapshot_frequency is distinct from old.snapshot_frequency
     or new.snapshot_mission_family_id is distinct from old.snapshot_mission_family_id
     or new.snapshot_xp is distinct from old.snapshot_xp
     or new.snapshot_coins is distinct from old.snapshot_coins
     or new.snapshot_quality is distinct from old.snapshot_quality then
    raise exception 'el contexto histórico de una completación no se reescribe';
  end if;
  return new;
end $$;

drop trigger if exists tg_completion_snapshot_inmutable on public.completions;
create trigger tg_completion_snapshot_inmutable
  before update on public.completions
  for each row execute function public.tg_completion_snapshot_inmutable();

-- Gastar un uso. Devuelve 'ok' · 'sin_usos' · 'no_la_tienes' ·
-- 'poder_no_gastable' · 'sin_destino' · 'destino_no_existe' · 'a_ti_no' ·
-- 'no_existe' · 'no_es_tuyo'. Detalle del reparto de responsabilidades
-- entre Postgres y el cliente en migracion-015-poderes-y-unicas.sql.
create or replace function public.spend_power(
  p_id uuid,
  p_code text,
  p_tipo text,
  p_usos integer,
  p_dias integer default null,
  p_target uuid default null,
  p_nota text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_earned timestamptz;
  v_gastados integer;
  v_tope constant integer := 5;
  v_max_dias constant integer := 90;
begin
  if p_tipo is null or p_tipo not in ('salva_racha', 'asigna_tarea') then
    return 'poder_no_gastable';
  end if;

  select family_id into v_family from public.profiles where id = p_id and active;
  if v_family is null then
    return 'no_existe';
  end if;

  if not public.es_mi_gremio(v_family) then
    return 'no_es_tuyo';
  end if;

  -- El `for update` serializa dos gastos simultáneos de la misma insignia.
  select earned_at into v_earned
    from public.profile_badges
   where profile_id = p_id and code = p_code
   for update;

  if v_earned is null then
    return 'no_la_tienes';
  end if;

  if p_dias is not null and now() > v_earned + least(p_dias, v_max_dias) * interval '1 day' then
    return 'sin_usos';
  end if;

  select count(*) into v_gastados
    from public.power_uses
   where profile_id = p_id and code = p_code;

  if v_gastados >= least(coalesce(p_usos, 0), v_tope) then
    return 'sin_usos';
  end if;

  if p_tipo = 'asigna_tarea' then
    if p_target is null then
      return 'sin_destino';
    end if;
    if p_target = p_id then
      return 'a_ti_no';
    end if;
    if not exists (
      select 1 from public.profiles
       where id = p_target and active and family_id = v_family
    ) then
      return 'destino_no_existe';
    end if;
    if p_nota is null or length(btrim(p_nota)) < 3 then
      return 'sin_encargo';
    end if;
  end if;

  insert into public.power_uses (family_id, profile_id, code, tipo, target_id, nota)
  values (v_family, p_id, p_code, p_tipo, p_target, nullif(btrim(p_nota), ''));

  -- La voz de mando CREA la misión, en la misma transacción que el gasto
  -- del uso: en dos llamadas, un fallo de red entre medias dejaría el uso
  -- gastado y a nadie encargado de nada. Aparece en el tablero de quien la
  -- recibe como una misión única más, sin interfaz nueva.
  if p_tipo = 'asigna_tarea' then
    insert into public.challenges (family_id, profile_id, title, emoji, xp, coins, frequency, skill)
    values (v_family, p_target, left(btrim(p_nota), 80), '📣', 10, 5, 'unico', 'cooperacion');
  end if;

  return 'ok';
end $fn$;

revoke all on function public.spend_power(uuid, text, text, integer, integer, uuid, text) from public;
revoke all on function public.spend_power(uuid, text, text, integer, integer, uuid, text) from anon;
grant execute on function public.spend_power(uuid, text, text, integer, integer, uuid, text) to authenticated;


-- ------------------------------------------------------------------
-- El camino de la racha (migración 016).
--
-- Cada hito se paga UNA VEZ EN LA VIDA, no una por racha: si no, romper
-- la racha a propósito cada semana sería la forma más rentable de jugar.
-- Y la racha se comprueba AQUÍ: quien pide el cobro es la misma pantalla
-- que dibuja el contador, así que no puede ser también quien lo certifique.
-- Razonamiento completo en migracion-016-camino-de-rachas.sql.
-- ------------------------------------------------------------------

create unique index if not exists idx_bonuses_hito_una_vez
  on public.bonuses (profile_id, tipo)
  where tipo like 'racha:%';

-- ------------------------------------------------------------------
-- 2. El cobro, con la racha verificada
--
-- Devuelve texto, como el resto de RPC:
--   'ok'          → cobrado, monedas abonadas
--   'ya_cobrado'  → ese hito ya se pagó. NO es un error: es el caso normal
--                   de volver a abrir la pantalla
--   'aun_no'      → la racha real no llega a ese hito
--   'hito_invalido' · 'no_existe' · 'no_es_tuyo'
-- ------------------------------------------------------------------

-- ⚠️ La definición de `claim_streak` está MÁS ABAJO, en el bloque de la
-- migración 019: desde entonces delega la cuenta de la racha en
-- `streak_days` en vez de llevar su propia copia. Aquí quedaba la versión
-- de la 016, y tener las dos en el mismo fichero dejaba al lector
-- adivinando cuál manda; un test lo cazó.

-- ------------------------------------------------------------------
-- Borrar la cuenta entera desde la app (migración 018).
--
-- Se lleva por delante el gremio —y con él, en cascada, perfiles,
-- misiones, historial, premios, insignias, bonus, poderes y registros— y
-- después la propia cuenta de `auth.users`. Sin esto último quedaría un
-- correo huérfano que nadie puede quitar desde la app.
--
-- Va en la base y no en una Edge Function a propósito: una Edge Function
-- exige la CLI de Supabase y una clave de servicio guardada en algún
-- sitio. Aquí el permiso lo da ser `security definer` con dueño
-- `postgres`, y la única fila que puede tocar es la de `auth.uid()`: no
-- acepta ningún identificador desde fuera, así que no hay forma de pedir
-- el borrado de otra cuenta.
--
-- La confirmación (escribir el nombre del gremio) vive en la interfaz,
-- que es donde se puede leer lo que se va a perder.
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
grant execute on function public.delete_my_account() to authenticated;


-- ------------------------------------------------------------------
-- Notificaciones push (migración 019).
--
-- `push_subs` guarda APARATOS, no personas: la suscripción pertenece a la
-- instalación del navegador y por eso la clave natural es el endpoint.
-- `push_log` es el tope de una al día, y vive aquí porque un tope que
-- depende de que el emisor se porte bien no es un tope.
-- Razonamiento completo en migracion-019-notificaciones.sql.
-- ------------------------------------------------------------------

create table if not exists public.push_subs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  -- Quién está usando ESTE aparato. Se actualiza al cambiar de perfil.
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- La URL que da el navegador. Es la identidad del aparato: si se
  -- reinstala la app o se limpia el sitio, cambia y entra como nueva.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- Para poder retirar sin borrar, igual que con los perfiles: una baja
  -- por fallos no debería perder el rastro de que ese aparato existió.
  activa boolean not null default true,
  fallos integer not null default 0,
  ultimo_ok timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subs_family on public.push_subs (family_id, activa);
create index if not exists idx_push_subs_profile on public.push_subs (profile_id, activa);

alter table public.push_subs enable row level security;

drop policy if exists push_subs_familia on public.push_subs;
create policy push_subs_familia on public.push_subs
  for all to authenticated
  using (family_id in (select public.mis_gremios()))
  with check (family_id in (select public.mis_gremios()));

-- ------------------------------------------------------------------
-- 2. El tope de una al día
-- ------------------------------------------------------------------

create table if not exists public.push_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  dia date not null,
  -- Dos franjas al día como mucho: tarde (hacer misiones) y noche
  -- (programar). El tope es por franja, no por día (migración 026).
  franja text not null default 'tarde' check (franja in ('tarde','noche')),
  motivo text not null,
  titulo text not null,
  cuerpo text not null,
  enviados integer not null default 0,
  created_at timestamptz not null default now()
);

-- ESTA línea es el tope: una persona, un día, una FRANJA, un aviso. Dos
-- como mucho al día (tarde y noche), que son dos trabajos distintos.
create unique index if not exists idx_push_log_uno_por_franja
  on public.push_log (profile_id, dia, franja);
create index if not exists idx_push_log_family on public.push_log (family_id, dia desc);

alter table public.push_log enable row level security;

drop policy if exists push_log_lectura on public.push_log;
create policy push_log_lectura on public.push_log
  for select to authenticated
  using (family_id in (select public.mis_gremios()));

-- Sin política de insert: solo escribe la función de envío, que es
-- `security definer`. Que el navegador pueda marcar un día como «ya
-- avisado» sería regalarle el silenciador a quien no debe tenerlo.

-- ------------------------------------------------------------------
-- 3. La racha, con UNA sola definición en toda la base
--
-- La 016 la contaba dentro de `claim_streak`. Ahora hace falta también
-- para el aviso («tu racha de 12 días»), y dos copias de la misma cuenta
-- acaban discrepando el día que alguien toque una: el aviso diría 12 y el
-- cobro pagaría por 11. Se extrae aquí y `claim_streak` pasa a usarla.
-- ------------------------------------------------------------------

-- Antes de la racha, el espejo del predicado de misiones.js: ¿tenía esta
-- persona algo que hacer ese día? Es el único sitio de Postgres donde se
-- copia esa regla, y existe porque la racha se certifica aquí y no en el
-- cliente.
--
-- Se mira el patrón de HOY, no el que hubiera entonces: la columna no
-- guarda historia y no va a guardarla.
--
-- La cautela está en la primera mitad del `and`: si no tiene NINGUNA
-- misión activa, ningún día es neutro. Sin ese corte, un perfil recién
-- creado tendría los 400 días neutros y su racha caminaría hacia atrás
-- hasta el tope sin que hubiera hecho nada.
create or replace function public.sin_mision_ese_dia(p_id uuid, p_dia date)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  with yo as (
    select id, family_id, role from public.profiles where id = p_id and active
  ),
  mias as (
    select c.days
      from public.challenges c
      join yo on c.family_id = yo.family_id
     where c.active
       and (
         c.profile_id = yo.id
         or (c.profile_id is null and c.target_roles is null)
         or (c.profile_id is null and yo.role = any(c.target_roles))
       )
  )
  select exists (select 1 from mias)
     and not exists (
       select 1 from mias
        where days is null
           or extract(isodow from p_dia)::smallint = any(days)
     );
$fn$;

revoke all on function public.sin_mision_ese_dia(uuid, date) from public;
revoke all on function public.sin_mision_ese_dia(uuid, date) from anon;
grant execute on function public.sin_mision_ese_dia(uuid, date) to authenticated;

-- La racha cuenta días CUMPLIDOS. Dos clases de día no la rompen y solo
-- una de ellas la alarga:
--
--   · el comodín TAPA Y SUMA: cuenta como día hecho, y ese es todo su
--     efecto;
--   · un día sin misiones asignadas SOLO TAPA. Si sumara, a quien solo
--     tuviera misiones los lunes le contarían los otros seis días y
--     llegaría a los cien días sin haber hecho nada.
--
-- Por eso el bucle lleva dos cuentas, la racha y los pasos, y el tope de
-- 400 es de los pasos.
create or replace function public.streak_days(p_id uuid, p_tz text default 'Europe/Madrid')
returns integer
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_racha integer := 0;
  v_pasos integer := 0;
  v_hoy date := (now() at time zone p_tz)::date;
  v_dia date := (now() at time zone p_tz)::date;
  v_hay boolean;
begin
  loop
    exit when v_pasos >= 400;

    -- Un día cuenta si tiene una misión aprobada O si está tapado con un
    -- comodín, que para eso existe el comodín.
    select exists (
      select 1 from public.completions
       where profile_id = p_id and status = 'aprobado' and resolved_at is not null
         and (resolved_at at time zone p_tz)::date = v_dia
    ) or exists (
      select 1 from public.power_uses
       where profile_id = p_id and tipo = 'salva_racha'
         and (used_at at time zone p_tz)::date = v_dia
    ) into v_hay;

    if v_hay then
      v_racha := v_racha + 1;
    else
      -- Hoy sin nada no rompe: el día no ha terminado.
      -- Un día sin misiones asignadas tampoco: no había nada que hacer.
      exit when v_dia < v_hoy and not public.sin_mision_ese_dia(p_id, v_dia);
    end if;

    v_dia := v_dia - 1;
    v_pasos := v_pasos + 1;
  end loop;

  return v_racha;
end $fn$;

revoke all on function public.streak_days(uuid, text) from public;
grant execute on function public.streak_days(uuid, text) to authenticated;

-- `claim_streak` pasa a usarla en vez de su copia. Es un `create or
-- replace` con la MISMA firma, así que no deja sobrecargas sueltas —el
-- problema que dio `resolve_completion` en la 005— y la tabla de importes
-- se queda donde estaba, que es lo que compara el test contra el
-- catálogo de JavaScript.
create or replace function public.claim_streak(p_id uuid, p_hito integer)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_tz text;
  v_coins integer;
  v_racha integer;
begin
  v_coins := case p_hito
    when 3 then 5
    when 7 then 15
    when 14 then 25
    when 21 then 40
    when 30 then 60
    when 50 then 100
    when 100 then 200
    else null
  end;

  if v_coins is null then
    return 'hito_invalido';
  end if;

  select p.family_id, f.timezone into v_family, v_tz
    from public.profiles p join public.families f on f.id = p.family_id
   where p.id = p_id and p.active;

  if v_family is null then
    return 'no_existe';
  end if;

  if not public.es_mi_gremio(v_family) then
    return 'no_es_tuyo';
  end if;

  v_racha := public.streak_days(p_id, coalesce(v_tz, 'Europe/Madrid'));

  if v_racha < p_hito then
    return 'aun_no';
  end if;

  begin
    insert into public.bonuses (family_id, profile_id, tipo, coins, motivo)
    values (v_family, p_id, 'racha:' || p_hito, v_coins, 'Racha de ' || p_hito || ' días');
  exception when unique_violation then
    return 'ya_cobrado';
  end;

  perform public.motivo_coins('racha');
  update public.profiles set coins = coins + v_coins where id = p_id;

  return 'ok';
end $fn$;

revoke all on function public.claim_streak(uuid, integer) from public;
revoke all on function public.claim_streak(uuid, integer) from anon;
grant execute on function public.claim_streak(uuid, integer) to authenticated;

-- ------------------------------------------------------------------
-- 5. A quién toca avisar y por qué
--
-- Toda la decisión vive en esta vista, y eso es deliberado: la función
-- que envía solo tiene que saber firmar y hablar HTTP. Así el «a quién y
-- por qué» se puede mirar, probar y corregir desde el SQL Editor sin
-- volver a desplegar nada.
--
-- Los motivos, por orden de prioridad:
--   racha_riesgo → tiene racha viva y hoy aún no ha validado nada
--   sin_validar  → adulto con misiones esperando (es el cuello de botella
--                  real: si nadie valida, el gremio se para)
--   vuelve       → lleva 2 días o más sin aparecer
--
-- Quien ya ha hecho algo hoy NO recibe nada: ya está dentro, y avisar a
-- quien acaba de cumplir es la forma más rápida de que silencie la app.
-- Por lo mismo, quien hoy no tenía ninguna misión asignada tampoco
-- recibe nada: avisar de que se va a perder la racha por no hacer lo que
-- no hay que hacer es la clase de aviso que hace que se apaguen todos.
-- ------------------------------------------------------------------

-- `security_invoker = true` NO es opcional. Desde Postgres 15 una vista se
-- ejecuta por defecto con los permisos de su DUEÑO, así que sin esta línea
-- la vista se saltaría el RLS de las tablas de abajo y cualquier cuenta
-- autenticada vería a las familias de las demás. Con ella, cada quien ve
-- lo suyo; la función de envío usa la clave de servicio y las ve todas,
-- que es justo lo que necesita y por el camino que corresponde.
create or replace view public.push_pendientes
with (security_invoker = true) as
with hoy as (
  select f.id as family_id,
         (now() at time zone f.timezone)::date as dia,
         extract(hour from now() at time zone f.timezone)::int as hora
    from public.families f
),
actividad as (
  select p.id as profile_id,
         p.family_id,
         p.name,
         p.role,
         h.dia,
         h.hora,
         -- Días seguidos hasta ayer: si la racha fuese cero no hay nada
         -- que salvar y el aviso de racha no aplica.
         (select count(*) from public.completions c
           where c.profile_id = p.id and c.status = 'aprobado' and c.resolved_at is not null
             and (c.resolved_at at time zone f.timezone)::date = h.dia) as hechas_hoy,
         (select max((c.resolved_at at time zone f.timezone)::date) from public.completions c
           where c.profile_id = p.id and c.status = 'aprobado' and c.resolved_at is not null) as ultimo_dia,
         (select count(*) from public.completions c
           where c.family_id = p.family_id and c.status = 'pendiente') as por_validar,
         public.streak_days(p.id, f.timezone) as racha,
         -- ¿Hoy no le tocaba nada? Entonces no hay de qué avisarle.
         public.sin_mision_ese_dia(p.id, h.dia) as dia_libre,
         -- ¿El gremio ya ha programado mañana? Si no hay ninguna fila para
         -- el día siguiente, el adulto recibe el recordatorio de noche. La
         -- franja la decide la función de envío, no la vista.
         not exists (
           select 1 from public.plan_diario pl
            where pl.family_id = p.family_id and pl.dia = h.dia + 1
         ) as sin_plan_manana
    from public.profiles p
    join public.families f on f.id = p.family_id
    join hoy h on h.family_id = p.family_id
   where p.active
     -- La peque no recibe notificaciones: a los tres años el teléfono no
     -- es suyo, y avisar al aparato compartido por ella sería avisar a un
     -- adulto de algo que no puede hacer. Y una mascota, por razones que
     -- no hace falta explicar.
     and p.role not in ('peque','mascota')
)
select a.profile_id,
       a.family_id,
       a.name,
       a.role,
       a.dia,
       a.hora,
       a.racha,
       case
         when a.hechas_hoy > 0 then null
         -- El día libre calla los dos avisos que dependen de que hoy
         -- hubiera algo que hacer. El de «sin validar» NO: quien valida
         -- es adulto y la cola de pendientes es de la casa, no suya.
         when a.dia_libre and a.role <> 'adulto' then null
         -- «Racha viva» se lee de `racha` en vez de deducirse de «ayer
         -- hizo algo». Eran lo mismo hasta que hubo días neutros por
         -- medio: ayer puede ser un martes libre y la racha seguir
         -- entera. Una sola definición, y es la que paga los hitos.
         when not a.dia_libre and a.racha > 0 then 'racha_riesgo'
         when a.role = 'adulto' and a.por_validar > 0 then 'sin_validar'
         when a.dia_libre then null
         else 'vuelve'
       end as motivo,
       a.por_validar,
       a.sin_plan_manana
  from actividad a;

grant select on public.push_pendientes to authenticated;

-- =====================================================================
-- ÚLTIMO PASO, Y NO ES OPCIONAL (migración 021)
--
-- El rol `anon` no puede llamar a ninguna función `security definer`.
--
-- Cada `revoke ... from public` de este fichero parece dejar la función
-- solo para quien tiene sesión, y NO lo hace: Supabase concede EXECUTE a
-- `anon` y a `authenticated` por privilegios por defecto en cuanto la
-- función se crea, y `revoke from public` retira el pseudo-rol PUBLIC, no
-- los permisos que esos dos roles ya tienen por su nombre.
--
-- Con `purge_logs` eso era explotable de verdad: cualquiera con la clave
-- anon —que es pública por diseño y va en el bundle— podía vaciar
-- `app_logs` y, de paso, `rate_limits` y `user_limits`, o sea poner a
-- cero todos los contadores de ritmo a voluntad. Comprobado con curl el
-- 16-ago-2026.
--
-- Va al FINAL a propósito: tiene que ejecutarse después de la última
-- función del fichero. Si añades una nueva, añádela antes de esto o
-- vuelve a lanzar este bloque.
-- =====================================================================

-- Migración 023 · un sitio donde mirar cómo va esto.
--
-- Ejecuta este fichero en el SQL Editor de Supabase. Si empiezas de cero,
-- schema.sql ya lo incluye. Es idempotente.
--
-- ------------------------------------------------------------------
-- EL PROBLEMA QUE RESUELVE
--
-- `app_logs` está bajo RLS por familia, que es lo correcto para la
-- privacidad y deja a quien mantiene esto sin una sola consulta que
-- responda «¿cuántas altas fallaron ayer?». Se puede mirar desde el SQL
-- Editor, que entra como dueño y ve todo, pero eso significa que hay que
-- acordarse, escribir la consulta y hacerlo antes de 30 días, que es
-- cuando la purga se lleva los logs.
--
-- El 16-ago pasó exactamente eso: los avisos push llevaban un día
-- montados con CERO suscripciones y no había forma de saber si era que
-- nadie los había activado o que fallaban en silencio. La respuesta
-- llegó por casualidad.
--
-- Esto guarda una fila al día con los números agregados. Ocupa nada,
-- **sobrevive a la purga de logs** y convierte «¿esto va bien?» en una
-- consulta de una línea.
--
-- SIN DATOS DE NADIE: solo cuentas. Ni family_id, ni nombres, ni
-- correos. Lo que se quiere saber es si el sistema funciona, no qué hace
-- cada familia, y una tabla que no guarda lo segundo no se puede usar
-- para lo segundo.
-- ------------------------------------------------------------------

create table if not exists public.salud_diaria (
  dia date primary key,
  cuentas integer not null default 0,
  gremios integer not null default 0,
  perfiles integer not null default 0,
  altas_del_dia integer not null default 0,
  misiones_validadas integer not null default 0,
  errores integer not null default 0,
  gremios_activos integer not null default 0,
  suscripciones_push integer not null default 0,
  avisos_enviados integer not null default 0,
  calculado_en timestamptz not null default now()
);

-- RLS encendido y SIN políticas: nadie llega por la API, ni con sesión ni
-- sin ella. Se consulta desde el SQL Editor o con la clave de servicio.
alter table public.salud_diaria enable row level security;

revoke all on table public.salud_diaria from anon;
revoke all on table public.salud_diaria from authenticated;

create or replace function public.registrar_salud(p_dia date default (now() at time zone 'Europe/Madrid')::date)
returns public.salud_diaria
language plpgsql
security definer
set search_path = public
as $fn$
declare fila public.salud_diaria;
begin
  insert into public.salud_diaria as s (
    dia, cuentas, gremios, perfiles, altas_del_dia, misiones_validadas,
    errores, gremios_activos, suscripciones_push, avisos_enviados
  )
  values (
    p_dia,
    (select count(*) from auth.users),
    (select count(*) from public.families),
    (select count(*) from public.profiles where active),
    (select count(*) from auth.users where created_at::date = p_dia),
    (select count(*) from public.completions
      where status = 'aprobado' and resolved_at::date = p_dia),
    (select count(*) from public.app_logs where nivel = 'error' and ts::date = p_dia),
    -- Un gremio cuenta como activo si alguien validó algo ese día. Es la
    -- señal honesta: abrir la app no es usarla.
    (select count(distinct family_id) from public.completions
      where status = 'aprobado' and resolved_at::date = p_dia),
    (select count(*) from public.push_subs where activa),
    (select coalesce(sum(enviados), 0) from public.push_log where dia = p_dia)
  )
  on conflict (dia) do update set
    cuentas = excluded.cuentas,
    gremios = excluded.gremios,
    perfiles = excluded.perfiles,
    altas_del_dia = excluded.altas_del_dia,
    misiones_validadas = excluded.misiones_validadas,
    errores = excluded.errores,
    gremios_activos = excluded.gremios_activos,
    suscripciones_push = excluded.suscripciones_push,
    avisos_enviados = excluded.avisos_enviados,
    calculado_en = now()
  returning * into fila;

  return fila;
end $fn$;

-- La lección de la 021: `revoke from public` NO quita el permiso que
-- Supabase concede a `anon` y `authenticated` por privilegios por
-- defecto. Hay que nombrarlos.
revoke all on function public.registrar_salud(date) from public;
revoke all on function public.registrar_salud(date) from anon;
revoke all on function public.registrar_salud(date) from authenticated;

-- A las 4:20, después de la purga de logs (4:10) para que el recuento de
-- errores del día ya cerrado se calcule sobre lo que queda, y después del
-- reparto de avisos (4:00).
do $$
begin
  perform cron.unschedule('salud-diaria');
exception when others then
  null;
end $$;

select cron.schedule('salud-diaria', '20 4 * * *', $c$ select public.registrar_salud((now() at time zone 'Europe/Madrid')::date - 1) $c$);

-- El plan de más de 7 días atrás, a la basura. 4:12, entre la purga de
-- logs (4:10) y la de salud (4:20).
do $$ begin perform cron.unschedule('purga-planes'); exception when others then null; end $$;
select cron.schedule('purga-planes', '12 4 * * *', $c$ select public.purge_planes(7) $c$);

-- Y la de hoy, para no empezar con la tabla vacía.
select public.registrar_salud();

-- ------------------------------------------------------------------
-- CÓMO SE MIRA (pégalo en el SQL Editor cuando quieras saber cómo va)
-- ------------------------------------------------------------------
-- select * from public.salud_diaria order by dia desc limit 30;
--
-- Y para el detalle de un día malo, mientras los logs sigan ahí:
--
-- select evento, count(*) as veces, max(ts) as ultima
-- from public.app_logs
-- where nivel = 'error' and ts > now() - interval '24 hours'
-- group by evento order by veces desc;

-- ------------------------------------------------------------------
-- Migración 040 · quién puede ver la actividad, sin salir de casa.
--
-- EL PROBLEMA QUE RESUELVE
--
-- `salud_diaria` ya lleva el registro diario, pero solo se puede leer
-- desde el SQL Editor: RLS sin políticas a propósito, así que ni `anon`
-- ni `authenticated` llegan a ella por la API.
--
-- La tentación es un lector de analítica externo (tipo PostHog), pero
-- `legal/privacidad.html` §2 dice, sin matices, que esta app no usa
-- «herramientas de analítica o seguimiento de ningún tipo», y §5 cierra
-- la lista de proveedores que tratan datos. Meter uno nuevo ahí es
-- reescribir un texto que familias con menores ya aceptaron, no marcar
-- una casilla. Igual que con Sentry (docs/RUNBOOK.md §3): es una
-- decisión legal, no un interruptor.
--
-- Esto no manda un solo byte fuera de Supabase. Añade una forma de que
-- SOLO quien mantiene la app lea `salud_diaria` desde la propia interfaz,
-- con el mismo modelo de permisos que ya usa todo lo demás aquí (RLS +
-- función `security definer`). No hay tercero ni herramienta de
-- seguimiento nueva: es una consulta más, con una puerta más estrecha.
-- ------------------------------------------------------------------

-- Lista de quién es «operador» (mantiene la app, no una familia más).
-- Vacía por defecto: se rellena a mano desde el SQL Editor con
-- `insert into public.operadores values ('<tu-auth-uid>')`, nunca desde
-- una migración — así el UUID de quien administra no queda en un
-- repositorio público.
create table if not exists public.operadores (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.operadores enable row level security;

-- Mismo patrón que salud_diaria: RLS encendido y SIN políticas. Nadie
-- llega por la API; se rellena a mano desde el SQL Editor.
revoke all on table public.operadores from anon;
revoke all on table public.operadores from authenticated;

-- Para que la interfaz sepa si le enseña la pestaña a quien ha entrado,
-- sin filtrar nunca quién más está en la lista.
create or replace function public.es_operador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.operadores where user_id = auth.uid());
$$;

revoke all on function public.es_operador() from public;
revoke all on function public.es_operador() from anon;
grant execute on function public.es_operador() to authenticated;

-- La propia salud_diaria, pero solo para quien está en `operadores`.
-- Cualquier otra cuenta autenticada recibe cero filas: la función no
-- lanza error porque no hay nada que ocultar en ese caso, es solo que no
-- hay nada que enseñar.
create or replace function public.actividad_reciente(p_dias integer default 30)
returns setof public.salud_diaria
language sql
stable
security definer
set search_path = public
as $$
  select s.* from public.salud_diaria s
  where public.es_operador()
  order by s.dia desc
  limit greatest(p_dias, 0);
$$;

revoke all on function public.actividad_reciente(integer) from public;
revoke all on function public.actividad_reciente(integer) from anon;
grant execute on function public.actividad_reciente(integer) to authenticated;

-- ------------------------------------------------------------------
-- CÓMO TE DAS DE ALTA COMO OPERADOR (una vez, a mano, en el SQL Editor)
-- ------------------------------------------------------------------
-- select id, email from auth.users;                          -- busca el tuyo
-- insert into public.operadores values ('<tu-uuid-de-ahí>');

-- ------------------------------------------------------------------
-- El libro de las monedas (migración 042).
--
-- Hasta aquí había libro de ALTAS (`bonuses`) pero no de BAJAS: los gastos
-- se hacían con un `update` y lo único que quedaba era la fila del canje.
-- Y nada impedía cobrar dos veces: el `for update` serializa, que no es lo
-- mismo que evitar.
--
-- El libro ES el registro de idempotencia: cada movimiento puede traer una
-- `clave` única, y antes de mover nada se mira si esa clave ya tiene
-- asiento. Si lo tiene, se devuelve SU resultado y no se toca nada.
--
-- LA REGLA DE LA SUMA: la suma de los asientos con resultado 'ok'
-- reproduce el saldo. Los intentos rechazados también se anotan —un pico
-- de «sin_monedas» dice algo— pero llevan saldo_antes = saldo_después.
--
-- ⚠ DE MOMENTO SOLO `redeem_reward` ESCRIBE AQUÍ. Las otras siete
-- funciones que mueven `coins` todavía no anotan, así que **este libro no
-- es la verdad del saldo y nadie debe leerlo como tal** hasta que estén
-- todas. Se enganchan de una en una a propósito: son ocho funciones vivas
-- de la economía de una casa real.
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
    'bonus_diario', 'bonus_manual', 'botin_limpieza', 'racha',
    -- La salida del saldo local hacia la cartera (047). Una sola vez por
    -- personaje, y nunca vuelve.
    'conversion',
    -- Lo que había el día que empezó a haber libro (051). Un asiento por
    -- personaje, una sola vez, y solo para los que ya tenían saldo: sin él la
    -- comprobación de descuadre nace dando falsos positivos.
    'apertura',
    -- La cartera vuelve al personaje cuando se borra la identidad (049).
    -- Simetrico de 'conversion', y por el mismo motivo: el saldo no puede
    -- evaporarse porque alguien borre su cuenta.
    'devolucion_conversion',
    -- Lo que mueva `coins` sin declarar su motivo. No deberia pasar, y por
    -- eso existe: un asiento raro es una pista; ningun asiento es un agujero.
    'desconocido'
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
  -- De qué monedero salió (migración 051). `profile_id` dice sobre qué
  -- personaje se movió; esto, de quién era el saldo. Nula quiere decir saldo
  -- local. Sin ella, sumar el libro por personaje mezclaría los dos monederos
  -- en cuanto alguien se convierta.
  persona uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_movimientos_persona
  on public.movimientos_coins (persona, created_at desc) where persona is not null;

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
  using (family_id in (select public.mis_gremios()))
  with check (family_id in (select public.mis_gremios()));

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
-- El motivo del movimiento que viene a continuacion, para la transaccion en
-- curso. Lo declara cada funcion justo antes de tocar `coins`, y lo consume el
-- disparador de abajo.
create or replace function public.motivo_coins(
  p_tipo text,
  p_ref uuid default null,
  p_clave text default null
)
returns void
language plpgsql
as $$
begin
  perform set_config('app.coins_tipo', coalesce(p_tipo, ''), true);
  perform set_config('app.coins_ref', coalesce(p_ref::text, ''), true);
  perform set_config('app.coins_clave', coalesce(p_clave, ''), true);
end $$;

-- ------------------------------------------------------------------
-- El disparador, que es lo que hace que esto sea una garantia y no una
-- costumbre.
--
-- La alternativa era llamar al libro a mano en las ocho funciones que mueven
-- `coins`. Funciona mientras nadie se olvide, y el dia que alguien anada la
-- novena el saldo deja de cuadrar sin que nadie se entere. Asi, en cambio, no
-- hay forma de mover una moneda sin dejar asiento: si la funcion no declaro su
-- motivo, el asiento sale como 'desconocido', que es ruidoso y localizable.
--
-- `security definer` a proposito: escribir en el libro no puede fallar por los
-- permisos de quien llama.
-- ------------------------------------------------------------------
create or replace function public.tg_movimiento_coins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_ref text;
begin
  if new.coins is not distinct from old.coins then return new; end if;
  v_ref := nullif(current_setting('app.coins_ref', true), '');

  insert into public.movimientos_coins
    (family_id, profile_id, tipo, importe, saldo_antes, saldo_despues, resultado, referencia, clave)
  values (
    new.family_id, new.id,
    coalesce(nullif(current_setting('app.coins_tipo', true), ''), 'desconocido'),
    new.coins - old.coins, old.coins, new.coins, 'ok',
    v_ref::uuid,
    nullif(current_setting('app.coins_clave', true), '')
  );

  -- El motivo se consume. Si el siguiente movimiento de la misma transaccion
  -- no declara el suyo, sale 'desconocido' en vez de heredar uno ajeno.
  perform set_config('app.coins_tipo', '', true);
  perform set_config('app.coins_ref', '', true);
  perform set_config('app.coins_clave', '', true);
  return new;
end $$;

drop trigger if exists trg_movimiento_coins on public.profiles;
create trigger trg_movimiento_coins
  after update of coins on public.profiles
  for each row execute function public.tg_movimiento_coins();

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
declare
  v_family uuid;
  v_persona uuid;
begin
  select family_id, persona into v_family, v_persona
    from public.profiles where id = p_profile;
  if v_family is null then return; end if;
  insert into public.movimientos_coins
    (family_id, profile_id, persona, tipo, importe, saldo_antes, saldo_despues, resultado, referencia, clave)
  values
    (v_family, p_profile, v_persona, p_tipo, p_importe, p_antes, p_despues, p_resultado, p_referencia, p_clave);
end $$;

-- ---------------------------------------------------------------------
-- Convertir un perfil en persona (migración 047).
--
-- Convertirse NO crea un personaje nuevo: **vincula una identidad al que ya
-- existe**. Se conserva todo —nivel, XP, marca de agua, insignias,
-- reconocimientos, historial— y el personaje sigue en el selector de la
-- casa, operable con la clave compartida como hasta ahora.
--
-- Son dos pasos porque `signUp` devuelve `error: null` y `session: null`
-- cuando falta confirmar el correo, y porque la sesión nueva no tiene forma
-- de demostrar que operaba ese personaje. El enlace entre las dos es el
-- correo: se eligió a mano dentro del gremio y con el PIN, y haberlo
-- confirmado demuestra que ese buzón es suyo.
--
-- Razonamiento completo en migracion-047-conversion-de-perfil-a-persona.sql,
-- incluido lo que NO hace y por qué la Fase 3 tiene que llegar antes que la 5.
-- ---------------------------------------------------------------------

-- Saldo único por persona, independiente del gremio. Se crea vacía en la
-- conversión y se llena con la transferencia de ese mismo momento: no hay
-- relleno masivo, y quien no se convierte conserva su saldo local tal cual.
create table if not exists public.carteras (
  persona uuid primary key references auth.users(id) on delete cascade,
  -- Sin negativos: un saldo negativo en la economía de una casa no significa
  -- «debe», significa que hay un fallo.
  saldo integer not null default 0 check (saldo >= 0),
  created_at timestamptz not null default now()
);

alter table public.carteras enable row level security;

drop policy if exists cartera_propia on public.carteras;
create policy cartera_propia on public.carteras
  for select to authenticated
  using (persona = auth.uid());

revoke all on table public.carteras from anon;
revoke all on table public.carteras from authenticated;
grant select on table public.carteras to authenticated;

-- La solicitud, que es también el asiento de la conversión: personaje,
-- gremio, correo, saldo local antes, importe transferido, saldo de la cartera
-- después, fecha, resultado y clave de idempotencia. No hace falta un libro
-- aparte para la cartera: esta fila es el apunte de la única operación que la
-- llena.
create table if not exists public.conversiones (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  -- En minúsculas siempre: el correo que se compara con `auth.users` y el que
  -- se tecleó tienen que ser el mismo aunque uno lleve mayúsculas.
  correo text not null check (correo = lower(correo) and correo like '%_@_%'),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','completada','caducada','cancelada')),
  persona uuid references auth.users(id) on delete set null,
  saldo_local_antes integer,
  importe integer,
  saldo_cartera_despues integer,
  resultado text,
  clave text check (clave is null or length(clave) between 8 and 120),
  solicitada_at timestamptz not null default now(),
  caduca_at timestamptz not null,
  resuelta_at timestamptz,
  -- Una completada tiene fecha; una pendiente no tiene ni fecha ni persona.
  --
  -- Y **una completada puede quedarse sin persona**, aunque suene raro: si esa
  -- identidad se borra después (migración 049), la clave ajena pone `persona`
  -- a null y la fila se queda como lo que es, el apunte de un movimiento que
  -- ocurrió. Pedir aquí `persona is not null` hacía **fallar el borrado
  -- entero**: lo descubrió el ensayo de la 049, no un test.
  constraint conversiones_completada_coherente check (
    case
      when estado = 'completada' then resuelta_at is not null
      when estado = 'pendiente' then persona is null and resuelta_at is null
      else true
    end
  )
);

-- Una pendiente por personaje y una por correo. Con índices y no con un
-- `select` previo: entre el select y el insert cabe otra petición.
create unique index if not exists idx_conversion_pendiente_perfil
  on public.conversiones (profile_id) where estado = 'pendiente';
create unique index if not exists idx_conversion_pendiente_correo
  on public.conversiones (correo) where estado = 'pendiente';
create index if not exists idx_conversiones_gremio
  on public.conversiones (family_id, solicitada_at desc);

alter table public.conversiones enable row level security;

-- La ve el gremio donde se pidió —que es quien la pidió— y la persona a la
-- que acabó perteneciendo.
drop policy if exists conversion_visible on public.conversiones;
create policy conversion_visible on public.conversiones
  for select to authenticated
  using (family_id in (select public.mis_gremios()) or persona = auth.uid());

revoke all on table public.conversiones from anon;
revoke all on table public.conversiones from authenticated;
grant select on table public.conversiones to authenticated;

create or replace function public.solicitar_conversion(
  p_profile uuid,
  p_correo text,
  p_pin_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_correo text := lower(btrim(p_correo));
  v_family uuid;
  v_rol text;
  v_persona uuid;
  v_pin text;
  v_otro uuid;
begin
  if auth.uid() is null then return 'sin_sesion'; end if;

  if v_correo is null or v_correo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or length(v_correo) > 254 then
    return 'correo_invalido';
  end if;

  select p.family_id, p.role, p.persona into v_family, v_rol, v_persona
    from public.profiles p where p.id = p_profile and p.active;
  if v_family is null then return 'no_existe'; end if;

  if not public.es_mi_gremio(v_family) then return 'no_es_tuyo'; end if;

  -- El PIN, que es lo unico que demuestra que hay una persona adulta delante.
  -- Llega ya resumido: lo calcula el cliente con SHA-256, como todo el resto
  -- del proyecto (`hashPin` en src/lib/supabase.js).
  select f.parent_pin_hash into v_pin from public.families f where f.id = v_family;
  if v_pin is null or p_pin_hash is null or p_pin_hash <> v_pin then
    return 'pin_incorrecto';
  end if;

  if v_rol = 'junior' then return 'junior_bloqueado'; end if;
  if v_rol <> 'adulto' then return 'solo_adulto'; end if;
  if v_persona is not null then return 'ya_es_persona'; end if;

  -- El correo, contra las dos clases de credencial. El caso frecuente --el de
  -- quien fundo la casa con su correo personal-- se dice con su nombre y no
  -- como "ese correo ya existe": es SU casa y su correo, y merece saber que la
  -- salida es la migracion guiada y no inventarse otro correo.
  select c.user_id into v_otro
    from public.credenciales c
    join auth.users u on u.id = c.user_id
   where lower(u.email) = v_correo and c.clase = 'compartida';
  if v_otro is not null then return 'correo_es_la_clave_de_casa'; end if;

  -- Cualquier otra cuenta: no se dice de quien ni de que. Un mensaje mas
  -- concreto convierte esta pantalla en un comprobador de que correos estan
  -- dados de alta.
  if exists (select 1 from auth.users u where lower(u.email) = v_correo) then
    return 'correo_no_disponible';
  end if;

  -- Las caducadas se retiran de en medio antes de mirar si hay una viva, o el
  -- indice unico parcial deja atrapado a quien se equivoco de correo hace una
  -- semana.
  update public.conversiones
     set estado = 'caducada', resultado = 'caducada'
   where estado = 'pendiente' and caduca_at < now();

  begin
    insert into public.conversiones (profile_id, family_id, correo, caduca_at)
    values (p_profile, v_family, v_correo, now() + interval '72 hours');
  exception when unique_violation then
    return 'ya_tienes_solicitud';
  end;

  return 'ok';
end $fn$;

revoke all on function public.solicitar_conversion(uuid, text, text) from public;
revoke all on function public.solicitar_conversion(uuid, text, text) from anon;
grant execute on function public.solicitar_conversion(uuid, text, text) to authenticated;

-- Retirar la propia solicitud, desde el mismo gremio. Existe porque el indice
-- de "una pendiente por personaje" es una trampa sin esto: quien escriba mal
-- el correo se queda esperando 72 horas.
create or replace function public.cancelar_conversion(p_conversion uuid, p_pin_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_estado text;
  v_pin text;
begin
  if auth.uid() is null then return 'sin_sesion'; end if;

  select family_id, estado into v_family, v_estado
    from public.conversiones where id = p_conversion;
  if v_family is null then return 'no_existe'; end if;
  if not public.es_mi_gremio(v_family) then return 'no_es_tuyo'; end if;

  select f.parent_pin_hash into v_pin from public.families f where f.id = v_family;
  if v_pin is null or p_pin_hash is null or p_pin_hash <> v_pin then
    return 'pin_incorrecto';
  end if;

  if v_estado <> 'pendiente' then return 'ya_resuelta'; end if;

  update public.conversiones
     set estado = 'cancelada', resultado = 'cancelada'
   where id = p_conversion;
  return 'ok';
end $fn$;

revoke all on function public.cancelar_conversion(uuid, text) from public;
revoke all on function public.cancelar_conversion(uuid, text) from anon;
grant execute on function public.cancelar_conversion(uuid, text) to authenticated;

-- ------------------------------------------------------------------
-- 6 · PASO 2 · COMPLETAR, DESDE LA SESION NUEVA
--
-- Todo en UNA transaccion: identidad, vinculo, pertenencia, cartera,
-- transferencia y cierre del saldo local se mueven juntos o no se mueve nada.
--
-- Codigos:
--   'ok'
--   'sin_sesion'
--   'correo_sin_confirmar'   la identidad no es buena hasta entonces
--   'sin_solicitud'          ninguna viva para este correo
--   'ya_clasificada'         esta cuenta ya es compartida o ya es personal
--   'personaje_ocupado'      alguien se vinculo a ese personaje mientras tanto
--   'ya_estas_en_el_gremio'  esta persona ya tiene personaje ahi
-- ------------------------------------------------------------------

create or replace function public.completar_conversion(p_clave text default null)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_correo text;
  v_confirmado timestamptz;
  c public.conversiones%rowtype;
  v_saldo integer;
  v_persona_actual uuid;
  v_cartera integer;
begin
  if v_uid is null then return 'sin_sesion'; end if;

  -- Idempotencia, antes de tocar nada: mismo intento, misma respuesta.
  if p_clave is not null then
    if exists (select 1 from public.conversiones
                where clave = p_clave and estado = 'completada' and persona = v_uid) then
      return 'ok';
    end if;
  end if;

  select lower(u.email), u.email_confirmed_at into v_correo, v_confirmado
    from auth.users u where u.id = v_uid;
  if v_correo is null then return 'sin_sesion'; end if;

  -- La trampa que el proyecto ya conoce: `signUp` no falla cuando falta
  -- confirmar, solo devuelve una sesion vacia. Hasta aqui no se mueve un saldo.
  if v_confirmado is null then return 'correo_sin_confirmar'; end if;

  -- Esta cuenta no puede ser ya otra cosa. Un correo es compartida o personal,
  -- nunca las dos.
  if exists (select 1 from public.credenciales where user_id = v_uid) then
    return 'ya_clasificada';
  end if;

  select * into c from public.conversiones
   where correo = v_correo and estado = 'pendiente' and caduca_at > now()
   for update;
  if not found then return 'sin_solicitud'; end if;

  -- El personaje, otra vez y con cerrojo: entre el paso 1 y este han podido
  -- pasar tres dias.
  select p.coins, p.persona into v_saldo, v_persona_actual
    from public.profiles p where p.id = c.profile_id and p.active
   for update;
  if v_saldo is null then return 'sin_solicitud'; end if;
  if v_persona_actual is not null then return 'personaje_ocupado'; end if;

  if exists (select 1 from public.profiles p
              where p.family_id = c.family_id and p.persona = v_uid) then
    return 'ya_estas_en_el_gremio';
  end if;

  -- 1 · La identidad. Va primero porque el disparador del vinculo exige que la
  --     persona sea de clase personal antes de dejarla entrar en `profiles`.
  insert into public.credenciales (user_id, clase, family_id)
  values (v_uid, 'personal', null);

  -- 2 · La pertenencia. `reclamacion` y no `fundacion`: no crea una relacion
  --     nueva, formaliza la de quien ya operaba ese personaje, y es el unico
  --     origen que no consume llave. Y `gestor` y no `titular`: pertenecer da
  --     acceso y gestion, no la potestad de cerrar el gremio, que hoy sigue
  --     siendo de la credencial compartida que lo fundo.
  insert into public.pertenencias (persona, family_id, rol, estado, origen)
  values (v_uid, c.family_id, 'gestor', 'activa', 'reclamacion');

  -- 3 · La cartera, vacia.
  insert into public.carteras (persona, saldo) values (v_uid, 0)
  on conflict (persona) do nothing;

  -- 4 · El vinculo y la transferencia, en el mismo `update`. El disparador del
  --     libro escribe el asiento del saldo que sale; si el saldo era cero no
  --     escribe nada, que es correcto: no hubo movimiento.
  perform public.motivo_coins('conversion', c.id, p_clave);
  update public.profiles
     set persona = v_uid,
         coins = 0,
         saldo_local_cerrado = true
   where id = c.profile_id;

  -- Por la unica puerta que mueve carteras (051): asi la ENTRADA del saldo en
  -- la cartera deja su asiento, igual que la salida del saldo local lo deja
  -- arriba. Una transferencia entre dos monederos son dos apuntes, y hasta la
  -- 051 solo se anotaba uno.
  -- Sin la clave a proposito: la lleva la pata de salida, que escribe
  -- `tg_movimiento_coins` unas lineas arriba, y el indice de idempotencia es
  -- unico en todo el libro. Las dos patas de un traspaso son UNA operacion, y
  -- la garantia de "una sola vez" ya la da `conversiones.clave`.
  v_cartera := public.mover_cartera(v_uid, c.profile_id, 'conversion', v_saldo, c.id, null);

  -- 5 · El asiento de la conversion, que es esta misma fila.
  update public.conversiones
     set estado = 'completada',
         persona = v_uid,
         saldo_local_antes = v_saldo,
         importe = v_saldo,
         saldo_cartera_despues = v_cartera,
         resultado = 'ok',
         clave = p_clave,
         resuelta_at = now()
   where id = c.id;

  return 'ok';
end $fn$;

revoke all on function public.completar_conversion(text) from public;
revoke all on function public.completar_conversion(text) from anon;
grant execute on function public.completar_conversion(text) to authenticated;

-- ---------------------------------------------------------------------
-- El correo de la casa se hace tuyo (migración 048, flujo F-13).
--
-- Es el caso más frecuente de todos: quien fundó la casa usó SU correo
-- personal como clave compartida, y ahora lo necesita para ser ella misma.
-- Un correo es credencial compartida **o** identidad personal, nunca las
-- dos, así que la salida es mover la llave de la casa a otro correo y
-- dejar el antiguo en manos de su dueña.
--
-- Lo único que hay que proteger es que **la casa no se quede sin llave**:
-- ese correo lo tienen abierto el móvil de quien lo fundó y las tabletas
-- de las peques. Por eso son tres llamadas y la del medio no escribe nada
-- —solo demuestra que se puede entrar con la credencial nueva—, y por eso
-- el cambio de llave entero ocurre dentro de una transacción.
--
-- Razonamiento completo, y por qué esto es más fuerte que los ocho pasos
-- que describe la especificación, en
-- migracion-048-el-correo-de-la-casa-se-hace-tuyo.sql.
-- ---------------------------------------------------------------------

-- Los importes NO viven aquí: viven en `conversiones`, que es donde vive
-- cualquier conversión venga por donde venga. Esta tabla cuenta cómo
-- cambió de manos la llave de la casa, y nada más.
create table if not exists public.migraciones_correo (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  -- La cuenta que hoy es la llave de la casa y mañana será una persona.
  -- `set null` y no `cascade` (migración 049): que esa persona borre su
  -- identidad no puede llevarse el registro de que la llave de esta casa
  -- cambió de manos tal día. Eso es historia DEL GREMIO, no suya.
  antigua uuid references auth.users(id) on delete set null,
  -- El personaje al que se vincula. Se elige a mano, como en toda conversión.
  profile_id uuid not null references public.profiles(id) on delete cascade,
  correo_nuevo text not null check (correo_nuevo = lower(correo_nuevo) and correo_nuevo like '%_@_%'),
  -- La cuenta nueva, cuando se ha demostrado que se puede entrar con ella.
  nueva uuid references auth.users(id) on delete set null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','credencial_probada','completada','caducada','cancelada')),
  resultado text,
  clave text check (clave is null or length(clave) between 8 and 120),
  solicitada_at timestamptz not null default now(),
  probada_at timestamptz,
  caduca_at timestamptz not null,
  resuelta_at timestamptz,
  -- Probada quiere decir que hubo una cuenta detrás, y de eso da fe la fecha.
  -- `nueva` puede quedarse en null si esa cuenta se borra después: mismo caso
  -- que `conversiones`, y por el mismo motivo, exigirlo aquí haría fallar el
  -- borrado en vez de impedir un dato malo.
  constraint migraciones_correo_probada_coherente check (
    case
      when estado = 'pendiente' then nueva is null and probada_at is null
      when estado in ('credencial_probada','completada') then probada_at is not null
      else true
    end
  )
);

-- Una viva por gremio y una por correo nuevo. Con índices y no con un
-- `select` previo: entre el select y el insert cabe otra petición.
create unique index if not exists idx_migracion_correo_viva_gremio
  on public.migraciones_correo (family_id) where estado in ('pendiente','credencial_probada');
create unique index if not exists idx_migracion_correo_viva_correo
  on public.migraciones_correo (correo_nuevo) where estado in ('pendiente','credencial_probada');

alter table public.migraciones_correo enable row level security;

drop policy if exists migracion_correo_visible on public.migraciones_correo;
create policy migracion_correo_visible on public.migraciones_correo
  for select to authenticated
  using (family_id in (select public.mis_gremios()) or antigua = auth.uid());

revoke all on table public.migraciones_correo from anon;
revoke all on table public.migraciones_correo from authenticated;
grant select on table public.migraciones_correo to authenticated;

create or replace function public.solicitar_migracion_correo(
  p_profile uuid,
  p_correo_nuevo text,
  p_pin_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_correo text := lower(btrim(p_correo_nuevo));
  v_family uuid;
  v_family_perfil uuid;
  v_rol text;
  v_persona uuid;
  v_pin text;
  v_correo_actual text;
begin
  if v_uid is null then return 'sin_sesion'; end if;

  -- Solo migra quien ES la llave de la casa. Una identidad personal no tiene
  -- nada que mover, y una cuenta sin clasificar tampoco.
  select c.family_id into v_family
    from public.credenciales c
   where c.user_id = v_uid and c.clase = 'compartida';
  if v_family is null then return 'no_es_compartida'; end if;

  if v_correo is null or v_correo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or length(v_correo) > 254 then
    return 'correo_invalido';
  end if;

  select lower(u.email) into v_correo_actual from auth.users u where u.id = v_uid;
  if v_correo = v_correo_actual then return 'correo_es_el_de_ahora'; end if;

  select f.parent_pin_hash into v_pin from public.families f where f.id = v_family;
  if v_pin is null or p_pin_hash is null or p_pin_hash <> v_pin then
    return 'pin_incorrecto';
  end if;

  select p.family_id, p.role, p.persona into v_family_perfil, v_rol, v_persona
    from public.profiles p where p.id = p_profile and p.active;
  if v_family_perfil is null then return 'no_existe'; end if;
  if v_family_perfil is distinct from v_family then return 'no_es_tuyo'; end if;
  if v_rol = 'junior' then return 'junior_bloqueado'; end if;
  if v_rol <> 'adulto' then return 'solo_adulto'; end if;
  if v_persona is not null then return 'ya_es_persona'; end if;

  -- El correo nuevo tiene que estar libre. Aqui se puede ser vago sin coste:
  -- lo esta eligiendo quien pregunta, y decirle "elige otro" le vale.
  if exists (select 1 from auth.users u where lower(u.email) = v_correo) then
    return 'correo_no_disponible';
  end if;

  update public.migraciones_correo
     set estado = 'caducada', resultado = 'caducada', resuelta_at = now()
   where estado in ('pendiente','credencial_probada') and caduca_at < now();

  begin
    insert into public.migraciones_correo (family_id, antigua, profile_id, correo_nuevo, caduca_at)
    values (v_family, v_uid, p_profile, v_correo, now() + interval '72 hours');
  exception when unique_violation then
    return 'ya_hay_una_en_marcha';
  end;

  return 'ok';
end $fn$;

revoke all on function public.solicitar_migracion_correo(uuid, text, text) from public;
revoke all on function public.solicitar_migracion_correo(uuid, text, text) from anon;
grant execute on function public.solicitar_migracion_correo(uuid, text, text) to authenticated;

-- ------------------------------------------------------------------
-- 3 · PASO 2 · PROBAR LA LLAVE NUEVA, DESDE LA SESION NUEVA
--
-- Que esta llamada llegue ya lo demuestra todo: hay cuenta, el correo esta
-- confirmado y se ha podido entrar. **No escribe nada en el gremio**, y esa es
-- toda su gracia: hasta el paso 3 no hay forma de que la casa se quede sin
-- llave, porque la llave no se ha tocado.
--
--   'ok' · 'sin_sesion' · 'correo_sin_confirmar' · 'ya_clasificada'
--   'sin_solicitud'
-- ------------------------------------------------------------------

create or replace function public.probar_credencial_nueva()
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_correo text;
  v_confirmado timestamptz;
  v_id uuid;
begin
  if v_uid is null then return 'sin_sesion'; end if;

  select lower(u.email), u.email_confirmed_at into v_correo, v_confirmado
    from auth.users u where u.id = v_uid;
  if v_correo is null then return 'sin_sesion'; end if;
  if v_confirmado is null then return 'correo_sin_confirmar'; end if;

  -- Una cuenta que ya es algo no puede ser ademas la llave de otra casa.
  if exists (select 1 from public.credenciales where user_id = v_uid) then
    return 'ya_clasificada';
  end if;

  update public.migraciones_correo
     set estado = 'credencial_probada', nueva = v_uid, probada_at = now()
   where correo_nuevo = v_correo and estado = 'pendiente' and caduca_at > now()
  returning id into v_id;

  if v_id is null then return 'sin_solicitud'; end if;
  return 'ok';
end $fn$;

revoke all on function public.probar_credencial_nueva() from public;
revoke all on function public.probar_credencial_nueva() from anon;
grant execute on function public.probar_credencial_nueva() to authenticated;

-- ------------------------------------------------------------------
-- 4 · PASO 3 · EL CAMBIO DE LLAVE, EN UNA SOLA TRANSACCION
--
--   'ok' · 'sin_sesion' · 'sin_solicitud' · 'aun_sin_probar'
--   'credencial_nueva_no_vale'  la cuenta nueva ya no sirve (se clasifico,
--                               se borro, o dejo de estar confirmada)
--   'personaje_ocupado'
-- ------------------------------------------------------------------

create or replace function public.completar_migracion_correo(p_clave text default null)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  m public.migraciones_correo%rowtype;
  v_saldo integer;
  v_persona_actual uuid;
  v_cartera integer;
  v_correo_antiguo text;
  v_confirmado timestamptz;
begin
  if v_uid is null then return 'sin_sesion'; end if;

  -- Idempotencia, antes de tocar nada.
  if p_clave is not null then
    if exists (select 1 from public.migraciones_correo
                where clave = p_clave and estado = 'completada' and antigua = v_uid) then
      return 'ok';
    end if;
  end if;

  select * into m from public.migraciones_correo
   where antigua = v_uid and estado in ('pendiente','credencial_probada')
     and caduca_at > now()
   for update;
  if not found then return 'sin_solicitud'; end if;
  if m.estado <> 'credencial_probada' then return 'aun_sin_probar'; end if;

  -- La llave nueva, otra vez y entera: entre el paso 2 y este han podido pasar
  -- tres dias. Si algo de esto ha cambiado, la casa se quedaria sin llave.
  select u.email_confirmed_at into v_confirmado from auth.users u where u.id = m.nueva;
  if v_confirmado is null
     or exists (select 1 from public.credenciales where user_id = m.nueva) then
    return 'credencial_nueva_no_vale';
  end if;

  select p.coins, p.persona into v_saldo, v_persona_actual
    from public.profiles p where p.id = m.profile_id and p.active
   for update;
  if v_saldo is null then return 'sin_solicitud'; end if;
  if v_persona_actual is not null then return 'personaje_ocupado'; end if;

  select lower(u.email) into v_correo_antiguo from auth.users u where u.id = v_uid;

  -- 1 · La llave pasa de mano. Primero la antigua deja de serlo --el CHECK de
  --     `credenciales` exige que una personal no lleve gremio-- y despues entra
  --     la nueva. Las dos dentro de la misma transaccion: en ningun instante
  --     visible hay dos llaves ni ninguna.
  update public.credenciales
     set clase = 'personal', family_id = null
   where user_id = v_uid;

  insert into public.credenciales (user_id, clase, family_id)
  values (m.nueva, 'compartida', m.family_id);

  update public.families set owner = m.nueva where id = m.family_id;

  -- 2 · Y quien era la llave pasa a estar dentro por pertenencia, como en
  --     cualquier otra conversion: reclamacion, y rol gestor.
  insert into public.pertenencias (persona, family_id, rol, estado, origen)
  values (v_uid, m.family_id, 'gestor', 'activa', 'reclamacion');

  insert into public.carteras (persona, saldo) values (v_uid, 0)
  on conflict (persona) do nothing;

  perform public.motivo_coins('conversion', m.id, p_clave);
  update public.profiles
     set persona = v_uid,
         coins = 0,
         saldo_local_cerrado = true
   where id = m.profile_id;

  -- Por la unica puerta que mueve carteras (051), igual que la conversion.
  -- Sin clave, por lo mismo que en la conversion: la lleva la pata de salida.
  v_cartera := public.mover_cartera(v_uid, m.profile_id, 'conversion', v_saldo, m.id, null);

  -- 3 · El asiento de la conversion va donde van todos, y no aqui.
  insert into public.conversiones
    (profile_id, family_id, correo, estado, persona,
     saldo_local_antes, importe, saldo_cartera_despues, resultado, clave,
     caduca_at, resuelta_at)
  values
    (m.profile_id, m.family_id, v_correo_antiguo, 'completada', v_uid,
     v_saldo, v_saldo, v_cartera, 'ok', p_clave,
     now(), now());

  update public.migraciones_correo
     set estado = 'completada', resultado = 'ok', clave = p_clave, resuelta_at = now()
   where id = m.id;

  -- 4 · Y se caen todas las sesiones de la cuenta antigua, esta incluida. Sin
  --     esto, la tableta de una peque que estaba dentro con la llave de la casa
  --     se convierte en una sesion personal de otra persona. Va en el servidor
  --     y no fiado a que el cliente llame a `signOut`, por lo mismo que el
  --     libro de las monedas lo escribe un disparador y no ocho funciones.
  if to_regclass('auth.sessions') is not null then
    delete from auth.sessions where user_id = v_uid;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    delete from auth.refresh_tokens where user_id = v_uid::text;
  end if;

  return 'ok';
end $fn$;

revoke all on function public.completar_migracion_correo(text) from public;
revoke all on function public.completar_migracion_correo(text) from anon;
grant execute on function public.completar_migracion_correo(text) to authenticated;

-- ------------------------------------------------------------------
-- 5 · RETIRARLA
--
-- Mientras no se haya completado no hay nada que deshacer en el gremio: se
-- marca y ya. Existe porque el indice de "una viva por gremio" es una trampa
-- sin esto.
-- ------------------------------------------------------------------

create or replace function public.cancelar_migracion_correo(p_migracion uuid, p_pin_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family uuid;
  v_estado text;
  v_pin text;
begin
  if auth.uid() is null then return 'sin_sesion'; end if;

  select family_id, estado into v_family, v_estado
    from public.migraciones_correo where id = p_migracion;
  if v_family is null then return 'no_existe'; end if;
  if not public.es_mi_gremio(v_family) then return 'no_es_tuyo'; end if;

  select f.parent_pin_hash into v_pin from public.families f where f.id = v_family;
  if v_pin is null or p_pin_hash is null or p_pin_hash <> v_pin then
    return 'pin_incorrecto';
  end if;

  if v_estado not in ('pendiente','credencial_probada') then return 'ya_resuelta'; end if;

  update public.migraciones_correo
     set estado = 'cancelada', resultado = 'cancelada', resuelta_at = now()
   where id = p_migracion;
  return 'ok';
end $fn$;

revoke all on function public.cancelar_migracion_correo(uuid, text) from public;
revoke all on function public.cancelar_migracion_correo(uuid, text) from anon;
grant execute on function public.cancelar_migracion_correo(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Borrar la identidad personal sin llevarse la casa por delante
-- (migración 049, flujo F-8d).
--
-- Son dos puertas distintas y conviene no confundirlas: borrar la
-- **credencial compartida** es borrar la casa —y ahora se niega si dentro
-- vive alguien con identidad propia—; borrar una **identidad personal** no
-- borra ningún gremio, se sale de ellos, y el personaje se queda donde
-- estaba, operable por la casa como antes de convertirse.
--
-- El efecto lo calcula el servidor entero, antes de preguntar nada: el
-- cliente enseña lo que responde `efecto_de_borrarme()` y al confirmar
-- manda solo DECISIONES, nunca la lista de gremios.
--
-- Razonamiento completo —incluido por qué hoy borrarse no cierra nunca un
-- gremio— en migracion-049-borrar-mi-identidad-sin-borrar-la-casa.sql.
-- ---------------------------------------------------------------------

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
    -- Y la salida de la cartera, por su puerta y con su asiento (051): sin
    -- el, el libro diria que esa cartera sigue teniendo lo que ya no tiene.
    perform public.mover_cartera(v_uid, v_perfil, 'devolucion_conversion', -v_saldo, null, null);
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
-- La configuración de la expansión (migración 050).
--
-- Pieza 3.1 de la Fase 3 · especificación §11.4, `R-16`, `R-66`, `D-10`,
-- `CFG-1` a `CFG-7`, `DEP-4`.
--
-- Hasta aquí los números de la expansión —qué nivel habilita la primera
-- llave, cuánto cuesta, cuántos gremios puede tener una persona, cuánto
-- duran las cosas— no vivían en ningún sitio consultable: constantes de un
-- módulo de JavaScript que el servidor no lee, y literales dentro de
-- funciones SQL que nadie puede consultar sin leerse el cuerpo. Eso vale
-- mientras nadie decida nada con ellos; cuando la Fase 5 empiece a cobrar
-- 300 monedas por una llave, el número tiene que estar donde el servidor lo
-- lea al cobrar (`CFG-2`), poder cambiar sin reescribir el pasado (`CFG-3`,
-- `CFG-5`) y dejar dicho quién lo cambió y por qué (`CFG-4`).
--
-- LA FORMA · una versión es un bloque, y un bloque no se toca. Cabecera,
-- escalones y matriz de disponibilidad se escriben JUNTOS, en una
-- transacción, y después ninguna de las tres tablas admite `update` ni
-- `delete`. Cambiar una regla es publicar otra versión. `CAM-1` a `CAM-6`
-- dicen que subir un umbral no retira una llave comprada y que subir un
-- coste no cobra la diferencia: la forma barata de cumplirlo es que la
-- llave guarde su versión (`S-12`) y que esa versión siga existiendo tal
-- cual. Si la configuración se editara encima, el recibo de ayer mentiría.
--
-- SIN CONFIGURACIÓN VÁLIDA NO SE EXPANDE NADIE (`CFG-6`). Por eso ninguna
-- función de lectura devuelve un valor por defecto: `parametros_expansion`,
-- `escala_expansion` y `hito_expansion` devuelven CERO FILAS, y
-- `tipo_publicado` devuelve `false`. Cero filas no se confunde con un
-- permiso ni se recoge con un `coalesce` distraído.
--
-- POR QUÉ LOS COSTES SE GUARDAN UNO A UNO. La regla aprobada es geométrica
-- (300 x 2,5^(k-1)), pero guardar solo la fórmula obligaría a calcular la
-- potencia dos veces —el servidor al cobrar, el cliente al pintar— y esa es
-- la segunda fuente de verdad que `CFG-1` prohíbe; es el error que ya
-- existe con la curva de nivel. Manda la fila: `escalones_expansion` guarda
-- el coste que se cobra. `coste_base`, `factor` y `regla_crecimiento` se
-- guardan al lado porque `R-66` los pide como campo mínimo —son la
-- procedencia del número, no el número— y un disparador comprueba que las
-- filas siguen cuadrando con la regla declarada.
--
-- LOS NÚMEROS son los de la calibración del 29-ago-2026 (§11.2, `R-59`,
-- `R-85`), que ya defendía `tests/expansion.test.js`. Este bloque no los
-- cambia: los mueve a donde el servidor pueda leerlos, y ese test los lee
-- ahora de aquí.
-- ------------------------------------------------------------------

create table if not exists public.configuracion_expansion (
  -- El identificador que se graba en cada llave (`I-4`, `S-12`). Legible
  -- por una persona a propósito: en un incidente se lee un recibo, no se
  -- cruza un uuid contra una tabla.
  version text primary key check (version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(\.[0-9]+)?$'),
  -- Desde cuándo rige. Única, porque dos versiones que empiezan en el mismo
  -- instante dejan sin respuesta a «cuál es la vigente», y esa respuesta es
  -- lo que se cobra.
  vigente_desde timestamptz not null,

  -- Pertenencias activas simultáneas por persona, el gremio inicial
  -- incluido (`R-23`, `R-60`). Bajarlo NO expulsa a nadie (`R-25`,
  -- `CAM-4`): quien esté por encima se queda y no puede adquirir más. Eso
  -- lo cumple quien compra; aquí solo vive el número.
  limite_global integer not null check (limite_global between 1 and 50),
  -- Cuántas oportunidades puede dar UN MISMO gremio de origen, si se quiere
  -- acotar. Puesto al número de escalones no acota nada, que es lo decidido.
  escalones_por_gremio integer not null check (escalones_por_gremio between 1 and 20),

  -- Procedencia del coste, no el coste.
  regla_crecimiento text not null check (regla_crecimiento in ('geometrica','explicita')),
  coste_base integer not null check (coste_base > 0),
  factor numeric(6,3) check (factor > 1),

  -- Las caducidades de la expansión (`R-62`, `R-80`, `D-07`, `D-22`).
  invitacion_dias integer not null check (invitacion_dias between 1 and 365),
  -- NULO quiere decir QUE NO CADUCA, y no es un olvido: es la decisión de
  -- `R-62`. Una llave comprada y caducada es dinero perdido sin haber
  -- recibido nada. Solo se revierte por soporte, nunca por un reloj.
  llave_dias integer check (llave_dias is null or llave_dias > 0),
  solicitud_junior_dias integer not null check (solicitud_junior_dias between 1 and 365),
  autorizacion_adulta_horas integer not null check (autorizacion_adulta_horas between 1 and 720),

  -- Auditoría (`CFG-4`): qué se cambió, quién lo aprobó, quién lo escribió
  -- y cuándo. Solo el uid admite nulos.
  motivo text not null check (length(btrim(motivo)) between 3 and 1000),
  -- Quién o QUÉ lo aprobó: una persona, una decisión de la especificación,
  -- un acuerdo. Es texto porque la mayoría de las veces no es una cuenta.
  aprobada_por text not null check (length(btrim(aprobada_por)) between 2 and 200),
  -- SIN clave ajena a `auth.users`, y es deliberado. Con `on delete set
  -- null`, borrar la cuenta de quien publicó dispararía un `update` sobre
  -- esta tabla —que el disparador de abajo prohíbe, así que el borrado
  -- fallaría— y además reescribiría el rastro. Con `no action` fallaría el
  -- borrado por la clave ajena. Un apunte de auditoría tiene que sobrevivir
  -- a la cuenta que nombra: mismo criterio que `movimientos_coins.referencia`.
  publicada_por uuid,
  publicada_at timestamptz not null default now(),

  constraint configuracion_factor_coherente check (
    -- En `case` y no con `and`/`or`, por lo mismo que mordió en
    -- `credenciales_alcance`: un CHECK que da NULL PASA.
    case when regla_crecimiento = 'geometrica' then factor is not null else true end
  )
);

create unique index if not exists idx_configuracion_expansion_vigencia
  on public.configuracion_expansion (vigente_desde);

comment on table public.configuracion_expansion is
  'Una fila por version de las reglas de expansion. No se edita ni se borra: publicar una regla nueva es insertar otra version (CFG-3).';

create table if not exists public.escalones_expansion (
  -- `restrict` y no `cascade`: borrar una versión es lo que esto impide.
  version text not null references public.configuracion_expansion(version) on delete restrict,
  -- Cuál es: el primer gremio extra, el segundo… Consecutivos desde 1.
  orden integer not null check (orden between 1 and 20),
  -- Nivel del personaje EN EL GREMIO DE ORIGEN que habilita el escalón
  -- (`R-10`, `R-12`). Nunca 1: `R-13` exige que no se alcance al empezar.
  nivel_exigido integer not null check (nivel_exigido between 2 and 200),
  -- Monedas que cuesta convertir la oportunidad en llave (`R-15`). Es el
  -- número que se cobra, y el único sitio donde vive.
  coste integer not null check (coste > 0),
  primary key (version, orden)
);

comment on table public.escalones_expansion is
  'La escala de expansion de una version. El coste que se cobra sale de aqui, no de recalcular la formula (CFG-1).';

-- La matriz tipo x país x estado de publicación (`R-89`, `R-94`, `R-109`).
-- Va aquí y no en el código porque el lanzamiento es país a país y cada
-- país repite su aprobación: eso cambia más veces que el esquema. Lo que no
-- está declarado NO está publicado: una fila que falta deniega, no concede.
create table if not exists public.disponibilidad_tipos (
  version text not null references public.configuracion_expansion(version) on delete restrict,
  -- Los nombres de `R-68` y `TIP-9`. Los `families.tipo_gremio` de hoy
  -- ('familia' y 'piso') se corresponden con 'hogar' y 'hogar_compartido',
  -- y quien hace esa traducción es la Fase 4.3, no esta tabla.
  tipo text not null check (tipo in ('hogar','amigos','equipo','hogar_compartido')),
  pais text not null check (pais ~ '^[A-Z]{2}$'),
  estado text not null check (estado in ('publicado','no_publicado')),
  primary key (version, tipo, pais)
);

comment on table public.disponibilidad_tipos is
  'Matriz tipo x pais x estado de publicacion de una version (R-109). Lo que no aparece, no esta publicado.';

-- Mismo patrón que `operadores` y `salud_diaria`: RLS encendido y SIN
-- políticas. La configuración no es de una familia, es del producto, y lo
-- único que una familia necesita es lo que devuelvan las funciones de
-- lectura de abajo. Así `publicada_por` y `motivo` no salen de la base por
-- una petición cualquiera.
alter table public.configuracion_expansion enable row level security;
alter table public.escalones_expansion enable row level security;
alter table public.disponibilidad_tipos enable row level security;

revoke all on table public.configuracion_expansion from anon;
revoke all on table public.configuracion_expansion from authenticated;
revoke all on table public.escalones_expansion from anon;
revoke all on table public.escalones_expansion from authenticated;
revoke all on table public.disponibilidad_tipos from anon;
revoke all on table public.disponibilidad_tipos from authenticated;

-- La historia no se reescribe (`CFG-3`). Tres disparadores, y hacen falta
-- los tres:
--   a) `update` y `delete` no existen para estas tres tablas, tampoco para
--      `postgres` desde el SQL Editor. Si alguna vez hay que borrar una
--      versión de verdad hay que retirar el disparador a mano, y eso es lo
--      que se quiere: que cueste y que se note.
--   b) `publicada_at` la pone el servidor y no se puede pasar de fuera. La
--      usa (c) para saber si una versión se está escribiendo AHORA.
--   c) los escalones y la disponibilidad solo se insertan en la misma
--      transacción que su cabecera. Sin esto (a) no cierra nada: añadir
--      mañana un escalón a la versión de hoy no es un `update`, pero cambia
--      lo que cobraba una versión ya usada.
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

-- Una escala incoherente no llega a publicarse. Lo que se comprueba:
--   · al menos un escalón —una versión sin escala parece que tiene reglas y
--     no habilita nada, que es peor que no tenerla (`CFG-6`)—;
--   · órdenes consecutivos desde 1, sin huecos: «el escalón 3» tiene que
--     querer decir «el tercero»;
--   · nivel estrictamente creciente (`R-14`);
--   · cada coste al menos EL DOBLE del anterior. `R-15` dice
--     «significativamente más cara» sin número; el doble es el mínimo que
--     fijó `tests/expansion.test.js` al aprobar la calibración, y aquí pasa
--     de ser un test sobre unos números a ser un límite sobre cualquier
--     versión futura;
--   · el primer escalón cuesta el coste base y, si la regla declarada es
--     geométrica, todos cuadran con ella. Declarar una fórmula y guardar
--     otra cosa es la peor versión de las dos fuentes de verdad: la que
--     miente.
-- Se comprueba al CERRAR la transacción —disparador de restricción
-- diferido— porque una escala se inserta fila a fila y a mitad no cuadra.
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

-- Desde los dos lados: publicar una cabecera sin escala falla, y publicar
-- una escala torcida también. Una sola de las dos deja media puerta.
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

-- Leer la vigente. `security definer` a propósito y no por comodidad: la
-- respuesta a «cuánto cuesta la primera llave» tiene que ser la MISMA para
-- todo el mundo y no depender de qué políticas alcance la sesión que
-- pregunta. Por eso las tablas no se conceden a nadie y estas funciones son
-- la única puerta. La vigente es la de mayor `vigente_desde` que ya haya
-- empezado: una versión con fecha futura se deja escrita y no rige hasta su día.
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

-- Los parámetros globales. Cero filas si no hay versión vigente, y eso es
-- la denegación (`CFG-6`). No devuelve `coste_base` ni `factor`: el coste ya
-- viaja hecho en `escala_expansion()`, y quien no recibe la fórmula no la
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

-- La escala entera, para que la pantalla pueda decir «te falta esto». El
-- cliente SOLO MUESTRA (`SEC-1`): que reciba la escala no le da voz en lo
-- que se cobra, que se decide con `hito_expansion()` en servidor.
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

-- Un escalón concreto de la vigente: lo que consultará la función que forje
-- en la Fase 5. Cero filas quiere decir «no hay configuración o no hay tal
-- escalón», y las dos cosas se responden igual: no se puede comprar.
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

-- La disponibilidad, resuelta en SERVIDOR (`R-108`, `SEC-29`). Y a
-- propósito SIN conceder a `authenticated`: el país es un parámetro, y
-- `R-108` dice que un cliente no declara en qué país está para desbloquear
-- un tipo. Quien la llame tiene que ser otra función del servidor —la que
-- cree gremios, en la Fase 4.4—, que sabrá de dónde sacar el país de verdad.
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

-- La primera versión. En un solo `do` y no en tres `insert` sueltos porque
-- los disparadores de arriba exigen que cabecera, escalones y
-- disponibilidad viajen en la MISMA transacción; un `do` es una sentencia.
-- Idempotente por la comprobación de la versión.
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
  -- redondea al múltiplo de cinco: 4690.
  insert into public.escalones_expansion (version, orden, nivel_exigido, coste) values
    (v_version, 1,  6,  300),
    (v_version, 2,  8,  750),
    (v_version, 3, 10, 1875),
    (v_version, 4, 12, 4690);

  -- La matriz de §11.4. 'hogar_compartido' es el tipo legado: los `piso`
  -- que ya existen siguen funcionando —esta tabla no apaga nada— pero no se
  -- ofrece para crear gremios nuevos (`R-78`, `TIP-9`), y eso es lo que
  -- dice 'no_publicado' aquí.
  insert into public.disponibilidad_tipos (version, tipo, pais, estado) values
    (v_version, 'hogar',            'ES', 'publicado'),
    (v_version, 'amigos',           'ES', 'publicado'),
    (v_version, 'equipo',           'ES', 'no_publicado'),
    (v_version, 'hogar_compartido', 'ES', 'no_publicado');
end $$;

-- ---------------------------------------------------------------------
-- El saldo de quien tiene identidad vive en su cartera (migración 051).
--
-- `D-02` en su opción C: quien tiene identidad personal cobra y paga de su
-- **cartera**; quien no la tiene —una peque, una junior, una mascota, un
-- perfil sin convertir— conserva su **saldo local** exactamente como hoy. Y
-- el saldo de una peque nunca se mezcla con la cartera de nadie.
--
-- Se encamina en un disparador y no tocando las ocho funciones que mueven
-- monedas, por lo mismo que el libro lo escribe un disparador desde la 043:
-- hacerlo a mano funciona mientras nadie se olvide.
--
-- Razonamiento completo, y la excepción de cuando cambia `persona`, en
-- migracion-051-la-cartera-cobra-y-paga.sql.
-- ---------------------------------------------------------------------

create or replace function public.saldo_de(p_profile uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  select case
           when p.persona is null then p.coins
           else coalesce((select c.saldo from public.carteras c where c.persona = p.persona), 0)
         end
    from public.profiles p
   where p.id = p_profile;
$fn$;

revoke all on function public.saldo_de(uuid) from public;
revoke all on function public.saldo_de(uuid) from anon;
revoke all on function public.saldo_de(uuid) from authenticated;

create or replace function public.mover_cartera(
  p_persona uuid,
  p_profile uuid,
  p_tipo text,
  p_importe integer,
  p_referencia uuid default null,
  p_clave text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_antes integer;
  v_despues integer;
  v_family uuid;
begin
  if p_persona is null then
    raise exception 'mover_cartera sin persona';
  end if;

  -- El cerrojo es lo que impide que dos peticiones simultaneas lean el mismo
  -- saldo y escriban las dos.
  select saldo into v_antes from public.carteras where persona = p_persona for update;
  if v_antes is null then
    insert into public.carteras (persona, saldo) values (p_persona, 0)
    on conflict (persona) do nothing;
    v_antes := 0;
  end if;

  if p_importe = 0 then
    return v_antes;
  end if;

  v_despues := v_antes + p_importe;
  if v_despues < 0 then
    raise exception 'la cartera no llega: % + % (comprueba con saldo_de antes de cobrar)', v_antes, p_importe
      using errcode = 'check_violation';
  end if;

  update public.carteras set saldo = v_despues where persona = p_persona;

  select family_id into v_family from public.profiles where id = p_profile;

  insert into public.movimientos_coins
    (family_id, profile_id, persona, tipo, importe, saldo_antes, saldo_despues, resultado, referencia, clave)
  values (v_family, p_profile, p_persona,
          coalesce(nullif(p_tipo, ''), 'desconocido'),
          p_importe, v_antes, v_despues, 'ok', p_referencia, p_clave);

  return v_despues;
end $fn$;

revoke all on function public.mover_cartera(uuid, uuid, text, integer, uuid, text) from public;
revoke all on function public.mover_cartera(uuid, uuid, text, integer, uuid, text) from anon;
revoke all on function public.mover_cartera(uuid, uuid, text, integer, uuid, text) from authenticated;

create or replace function public.tg_encaminar_coins()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_delta integer;
begin
  -- Si `persona` cambia en este mismo update, quien lo hace es la conversion o
  -- el borrado de identidad, y esas dos mueven las dos partes por su cuenta.
  -- Meterse aqui seria leer "acaba de gastar 424" donde pone "su saldo se ha
  -- mudado de monedero".
  if new.persona is distinct from old.persona then
    return new;
  end if;

  -- Sin persona detras, saldo local: todo sigue como siempre y el asiento lo
  -- escribe `tg_movimiento_coins` despues.
  if new.persona is null then
    return new;
  end if;

  v_delta := new.coins - old.coins;
  if v_delta = 0 then
    return new;
  end if;

  perform public.mover_cartera(
    new.persona, new.id,
    coalesce(nullif(current_setting('app.coins_tipo', true), ''), 'desconocido'),
    v_delta,
    nullif(current_setting('app.coins_ref', true), '')::uuid,
    nullif(current_setting('app.coins_clave', true), '')
  );

  -- El motivo se consume, igual que en `tg_movimiento_coins`: si el siguiente
  -- movimiento de la misma transaccion no declara el suyo, sale 'desconocido'
  -- en vez de heredar uno ajeno.
  perform set_config('app.coins_tipo', '', true);
  perform set_config('app.coins_ref', '', true);
  perform set_config('app.coins_clave', '', true);

  -- Y el saldo local NO se mueve. Al dejar `coins` como estaba,
  -- `tg_movimiento_coins` --que corre despues-- sale por su rama corta y no
  -- escribe un segundo asiento.
  new.coins := old.coins;
  return new;
end $fn$;

revoke all on function public.tg_encaminar_coins() from anon;
revoke all on function public.tg_encaminar_coins() from authenticated;

drop trigger if exists trg_encaminar_coins on public.profiles;
create trigger trg_encaminar_coins
  before update of coins on public.profiles
  for each row execute function public.tg_encaminar_coins();

create or replace function public.descuadre_saldos()
returns table (monedero text, quien uuid, saldo integer, segun_el_libro bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select 'personaje', p.id, p.coins,
         coalesce(sum(m.importe) filter (where m.resultado = 'ok'), 0)
    from public.profiles p
    left join public.movimientos_coins m
      on m.profile_id = p.id and m.persona is null
   group by p.id, p.coins
  having p.coins <> coalesce(sum(m.importe) filter (where m.resultado = 'ok'), 0)

  union all

  select 'cartera', c.persona, c.saldo,
         coalesce(sum(m.importe) filter (where m.resultado = 'ok'), 0)
    from public.carteras c
    left join public.movimientos_coins m on m.persona = c.persona
   group by c.persona, c.saldo
  having c.saldo <> coalesce(sum(m.importe) filter (where m.resultado = 'ok'), 0);
$fn$;

revoke all on function public.descuadre_saldos() from public;
revoke all on function public.descuadre_saldos() from anon;
revoke all on function public.descuadre_saldos() from authenticated;

-- ---------------------------------------------------------------------
-- El saldo que ve la tienda (migración 052).
--
-- La tienda lee `profiles.coins`, y desde la 051 eso vale cero para un
-- personaje convertido: su dinero está en la cartera. Esta función devuelve
-- lo que de verdad puede gastar cada personaje de mis gremios, mire donde
-- mire su saldo.
--
-- El alcance —los personajes de mis gremios, no solo el propio— sostiene
-- `CNV-7`: convertirse no saca al personaje del selector de la casa. Choca
-- de lado con `CAP-12` («solo propio»), y hoy no importa porque un gremio es
-- una casa. **Hay que volver aquí en la Fase 6**, cuando un gremio pueda
-- tener personas que no viven juntas.
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- El tipo de gremio deja de ser un `if` repetido (migración 053).
--
-- El tipo decide **cómo nace** un gremio y qué tiene encendido; lo que el
-- grupo edita después es suyo. Por eso una plantilla mejorada no reescribe
-- gremios existentes, y cada gremio guarda la versión con la que nació.
--
-- Los ejes van en `jsonb` porque se leen enteros al abrir el gremio y nadie
-- los consulta por campo; lo que hace falta —que no cambien por detrás— lo
-- da el mismo sello que la 050, no un `check`.
--
-- Razonamiento completo en migracion-053-el-tipo-deja-de-ser-un-if.sql.
-- ---------------------------------------------------------------------

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

-- Y el barrido final de la 021, que tiene que quedarse SIEMPRE el último del
-- fichero: retira el permiso de ejecución de toda función `security definer`,
-- incluidas las que se añadan por debajo de aquí. Nada de esto se pierde para
-- quien lo necesita: los `grant execute ... to authenticated` de arriba son
-- explícitos y sobreviven al barrido.
--
-- **Retira PUBLIC además de `anon`, y eso es un arreglo de la 046.** Tal como
-- la escribió la 021, el barrido solo quitaba `anon`, y `anon` HEREDA de
-- PUBLIC: mientras PUBLIC conservara el permiso —que es el que Postgres da
-- por defecto a toda función nueva—, quitárselo a `anon` no cerraba nada.
-- Seis funciones seguían contestando sin sesión con el barrido puesto.
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
