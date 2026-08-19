-- ------------------------------------------------------------------
-- Migración 028 · Familias de misión (identidad estable de una actividad)
--
-- El problema que resuelve, en una frase: HOY LA VARIEDAD SE PUEDE
-- FALSIFICAR DUPLICANDO UNA MISIÓN.
--
-- Los caminos de oficio piden practicar de varias formas distintas
-- («Oficialía de Hogar» exige dos familias de misión, «Obra maestra»
-- cinco). El motor usa como familia el `challenge_id`, que es lo mejor
-- que había, pero eso significa que duplicar «Hacer la cama» en «Hacer
-- la cama II» crea variedad de la nada. Y al revés: renombrar una misión
-- no debería perder su historia, y con el id no la pierde, pero sí la
-- pierde si alguien la borra y la vuelve a crear.
--
-- Una familia es la identidad de UNA ACTIVIDAD, por encima del challenge
-- concreto que la representa hoy. Varios challenges pueden apuntar a la
-- misma familia: la de invierno y la de verano, la del peque y la de la
-- junior, la que se rehízo al cambiar de curso.
--
-- Esta migración NO cambia comportamiento. Crea la tabla, la enlaza y
-- rellena una familia por challenge existente, que es exactamente lo que
-- el motor ya asumía. A partir de aquí, agrupar dos challenges en una
-- familia es una decisión humana desde el panel, no un efecto colateral.
--
-- Ojo con lo de siempre: pegar esto en el SQL Editor desde el navegador
-- destroza los acentos. Se trae el fichero desde el repo con la consola
-- del editor y se coteja el SHA-256 antes de pulsar Run (ver §2 del
-- arranque).
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1. La tabla
--
-- `key` es el identificador estable dentro de la familia y NO se enseña:
-- existe para que un backfill o una importación puedan volver a apuntar
-- al mismo sitio sin adivinar. `label` es el nombre administrativo, y
-- ninguna regla lo lee: si una regla leyera un texto editable, cambiar
-- una palabra reescribiría el pasado, que es justo lo que se viene a
-- arreglar.
--
-- Retirar es lógico (`retired_at`) porque una familia retirada sigue
-- explicando completaciones antiguas.
-- ------------------------------------------------------------------

create table if not exists public.mission_families (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  key text not null check (length(key) between 1 and 80),
  label text not null check (length(label) between 1 and 120),
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (family_id, key)
);

create index if not exists idx_mission_families_gremio
  on public.mission_families (family_id, retired_at);

-- ------------------------------------------------------------------
-- 2. Una familia no se muda de gremio
--
-- Sin esto, un `update` que cambiara `family_id` dejaría challenges de
-- un gremio apuntando a la familia de otro, y el aislamiento por familia
-- —que es la base del RLS— se rompería por la puerta de atrás.
-- ------------------------------------------------------------------

create or replace function public.tg_mission_family_inmutable()
returns trigger language plpgsql as $$
begin
  if new.family_id is distinct from old.family_id then
    raise exception 'una familia de misión no cambia de gremio';
  end if;
  -- La clave tampoco: es la que usan los backfills para reencontrarla.
  if new.key is distinct from old.key then
    raise exception 'la clave de una familia de misión no se reescribe';
  end if;
  return new;
end $$;

drop trigger if exists tg_mission_family_inmutable on public.mission_families;
create trigger tg_mission_family_inmutable
  before update on public.mission_families
  for each row execute function public.tg_mission_family_inmutable();

-- ------------------------------------------------------------------
-- 3. Las columnas nuevas de `challenges`
--
-- `mission_family_id` queda NULLABLE a propósito, aunque la spec la
-- quiera obligatoria: un `not null` aquí obligaría a que el insert del
-- panel la rellenara ANTES de que exista el código que la rellena, y
-- durante ese rato no se podrían crear misiones. La rellena el trigger
-- del punto 5 y se puede endurecer más adelante sin prisa.
--
-- `track_assistance` habilita registrar cuánta ayuda hizo falta. Nace
-- apagada: pedir ese dato en cada validación sin haberlo pensado es
-- convertir una app de reconocimiento en un formulario.
-- ------------------------------------------------------------------

alter table public.challenges
  add column if not exists mission_family_id uuid references public.mission_families(id) on delete set null,
  add column if not exists track_assistance boolean not null default false;

create index if not exists idx_challenges_mission_family
  on public.challenges (mission_family_id);

-- ------------------------------------------------------------------
-- 4. Backfill: una familia por challenge existente
--
-- Es exactamente lo que el motor ya suponía, así que ningún progreso
-- cambia al ejecutar esto. La clave se deriva del id del challenge para
-- que sea estable y para que volver a ejecutar la migración no cree
-- duplicados.
--
-- `family_id` va explícito en el insert, como todo insert derivado de
-- `profiles`/`challenges` en este proyecto: el SQL Editor se salta el
-- RLS y un insert sin filtrar ya escribió una vez en gremios ajenos.
-- ------------------------------------------------------------------

insert into public.mission_families (family_id, key, label)
select c.family_id, 'challenge:' || c.id::text, left(c.title, 120)
  from public.challenges c
 where c.mission_family_id is null
on conflict (family_id, key) do nothing;

update public.challenges c
   set mission_family_id = mf.id
  from public.mission_families mf
 where mf.family_id = c.family_id
   and mf.key = 'challenge:' || c.id::text
   and c.mission_family_id is null;

-- ------------------------------------------------------------------
-- 5. Toda misión nueva nace con familia
--
-- En el trigger y no en la aplicación porque hay tres sitios que crean
-- challenges (panel, alta guiada y plantillas) y el día que aparezca un
-- cuarto se olvidaría. Una misión sin familia no rompe nada hoy, pero
-- deja un agujero en la variedad de mañana.
-- ------------------------------------------------------------------

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

-- ------------------------------------------------------------------
-- 6. RLS
--
-- Mismo patrón que el resto: se ve y se toca lo del propio gremio.
-- ------------------------------------------------------------------

alter table public.mission_families enable row level security;

drop policy if exists familia_miembro on public.mission_families;
create policy familia_miembro on public.mission_families
  for all to authenticated
  using (family_id in (select id from public.families where owner = auth.uid()))
  with check (family_id in (select id from public.families where owner = auth.uid()));

-- `anon` no ejecuta nada (migración 021).
revoke all on public.mission_families from anon;
