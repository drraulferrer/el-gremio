-- ------------------------------------------------------------------
-- Migración 029 · Congelar el contexto de cada completación
--
-- EL AGUJERO QUE CIERRA. Una insignia concedida no se quita, pero la
-- prueba de por qué se concedió sí se podía borrar. Dos maneras:
--
--   1. Editar la habilidad de una misión reescribía el pasado. «Hacer la
--      cama» pasa de Hogar a Responsabilidad y, de golpe, las cuarenta
--      veces que se hizo el año pasado dejan de haber entrenado Hogar.
--      La «Maestría de Hogar» sigue en el perfil, sin nada detrás.
--   2. Borrar una misión se llevaba sus completaciones por cascada, y
--      con ellas los días activos, la racha y la variedad que
--      sostenían media biografía. El botón del panel incluso lo
--      anunciaba: «¿Borrar … y su historial?».
--
-- A partir de aquí cada completación guarda, en el momento de crearse,
-- qué entrenó: habilidad, frecuencia, título, familia y valores. Eso es
-- lo que leen las reglas. Editar la misión de mañana no toca el trabajo
-- de ayer, que es como debe ser: el trabajo de ayer ya ocurrió.
--
-- `snapshot_quality` dice de dónde salió cada snapshot, y es importante
-- no barrerlo bajo la alfombra:
--   · `native`                → se capturó al crear la completación. Fiel.
--   · `legacy_current_state`  → se dedujo AHORA del challenge que existe
--                               hoy. Es lo mejor recuperable para las
--                               filas viejas, y puede no ser lo que
--                               realmente entrenó si alguien editó la
--                               misión por el camino.
-- Ninguna regla nueva debe tratar las dos como equivalentes sin decirlo.
--
-- Ojo con lo de siempre: pegar esto en el SQL Editor desde el navegador
-- destroza los acentos. Se trae el fichero desde el repo con la consola
-- del editor y se coteja el SHA-256 antes de pulsar Run (ver §2 del
-- arranque).
--
-- Requiere la migración 028.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1. Las columnas
--
-- Todas nullable: hay filas antiguas y no puede haber un instante en que
-- la tabla rechace lo que ya tiene guardado.
--
-- `assistance_level` es el dato que le falta a los cuatro sellos de
-- Autonomía. Se guarda aquí, en la completación concreta, y no en el
-- perfil ni en la misión, porque la autonomía no es un rasgo de la
-- persona: es algo que pasó ESTA vez. Alguien puede hacer sola la cama
-- el martes y necesitar ayuda el jueves porque está malita, y eso no la
-- vuelve menos autónoma.
-- ------------------------------------------------------------------

alter table public.completions
  add column if not exists snapshot_title text,
  add column if not exists snapshot_skill text,
  add column if not exists snapshot_frequency text,
  add column if not exists snapshot_mission_family_id uuid references public.mission_families(id) on delete set null,
  add column if not exists snapshot_xp integer,
  add column if not exists snapshot_coins integer,
  add column if not exists snapshot_quality text
    check (snapshot_quality is null or snapshot_quality in ('native','legacy_current_state')),
  add column if not exists assistance_level text
    check (assistance_level is null or assistance_level in ('guided','prompted','independent'));

-- ------------------------------------------------------------------
-- 2. Se captura al crear, no al validar
--
-- Al CREAR, porque es cuando la persona hizo la cosa. Si se capturara al
-- validar, una misión pedida el lunes y aprobada el jueves guardaría la
-- habilidad que tuviera la misión el jueves, que es exactamente el fallo
-- que se viene a cerrar.
-- ------------------------------------------------------------------

create or replace function public.tg_completion_snapshot()
returns trigger language plpgsql security definer set search_path = public as $$
declare reto public.challenges%rowtype;
begin
  select * into reto from public.challenges where id = new.challenge_id;

  if not found then
    -- No debería pasar: hay FK. Pero si pasara, es preferible una fila
    -- con snapshot pobre que un insert caído en la cara de una criatura
    -- que acaba de hacer la cama.
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

  -- El nivel de ayuda solo se acepta si esa misión lo pide. Sin esto, un
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

-- ------------------------------------------------------------------
-- 3. Un snapshot no se reescribe
--
-- Si se pudiera actualizar, no sería un snapshot: sería una copia del
-- estado actual con pasos extra. Lo único que se deja mover es
-- `assistance_level`, porque quien valida puede querer anotarlo después
-- de haber visto cómo fue.
-- ------------------------------------------------------------------

create or replace function public.tg_completion_snapshot_inmutable()
returns trigger language plpgsql as $$
begin
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

-- ------------------------------------------------------------------
-- 4. Backfill de lo que ya había
--
-- Se marca `legacy_current_state` sin disimulo: se está deduciendo del
-- challenge que existe HOY. Para la inmensa mayoría será correcto —casi
-- ninguna misión ha cambiado de habilidad— pero el dato dice la verdad
-- sobre sí mismo, y una regla futura que necesite precisión sabrá que
-- aquí no la tiene garantizada.
--
-- Va en lotes para no tener la tabla bloqueada mientras dure: en una
-- familia con años de historia esto son decenas de miles de filas, y el
-- SQL Editor tiene su propio tiempo de espera.
-- ------------------------------------------------------------------

do $$
declare tocadas integer;
begin
  loop
    update public.completions c
       set snapshot_title = left(ch.title, 160),
           snapshot_skill = ch.skill,
           snapshot_frequency = ch.frequency,
           snapshot_mission_family_id = ch.mission_family_id,
           snapshot_xp = c.xp,
           snapshot_coins = c.coins,
           snapshot_quality = 'legacy_current_state'
      from public.challenges ch
     where ch.id = c.challenge_id
       and c.snapshot_quality is null
       and c.id in (
         select id from public.completions
          where snapshot_quality is null
          limit 5000
       );
    get diagnostics tocadas = row_count;
    exit when tocadas = 0;
  end loop;
end $$;

-- ------------------------------------------------------------------
-- 5. Borrar una misión ya no borra su historia
--
-- Pasa de `cascade` a `restrict`. Es el cambio con más consecuencias de
-- esta migración: el botón «Borrar» del panel deja de funcionar sobre
-- misiones con historial y la app pasa a ofrecer retirarla
-- (`active = false`), que es el flujo ordinario desde siempre.
--
-- El motivo es que las dos cosas no pueden ser verdad a la vez: «una
-- insignia ganada no se pierde» y «cualquiera puede borrar la prueba de
-- que se ganó». Una misión sin historia se sigue pudiendo borrar, que es
-- el caso de haberla creado mal hace dos minutos.
-- ------------------------------------------------------------------

do $$
declare nombre text;
begin
  select con.conname into nombre
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
   where ns.nspname = 'public' and rel.relname = 'completions'
     and con.contype = 'f'
     and pg_get_constraintdef(con.oid) ilike '%challenges%';
  if nombre is not null then
    execute format('alter table public.completions drop constraint %I', nombre);
  end if;
end $$;

alter table public.completions
  add constraint completions_challenge_id_fkey
  foreign key (challenge_id) references public.challenges(id) on delete restrict;

-- ------------------------------------------------------------------
-- 6. Índices para las preguntas que hacen las reglas
--
-- Las tres consultas del motor son «días distintos de esta persona»,
-- «por habilidad» y «por familia de misión». Parciales sobre aprobadas
-- porque ninguna regla mira lo pendiente ni lo rechazado, y así el
-- índice ocupa lo que ocupa el trabajo hecho, no el intentado.
-- ------------------------------------------------------------------

create index if not exists idx_completions_sellos_habilidad
  on public.completions (profile_id, snapshot_skill, requested_at)
  where status = 'aprobado';

create index if not exists idx_completions_sellos_familia
  on public.completions (profile_id, snapshot_mission_family_id, requested_at)
  where status = 'aprobado';
