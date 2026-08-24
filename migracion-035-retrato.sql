-- ==================================================================
-- Migración 035 · El retrato del gremialista
--
-- Un perfil deja de ser un emoji y pasa a ser una figura por capas que
-- gana equipo al subir de nivel. Ver docs/RETRATO.md y src/lib/retratos.js.
--
-- ESTA MIGRACIÓN NO ROMPE AL CLIENTE VIEJO. Solo añade columnas
-- nullables y `emoji` sigue donde estaba, sirviendo de respaldo: un
-- navegador con la versión anterior en caché sigue pintando su emoji sin
-- enterarse. Por eso la versión sube de MENOR y no de MAYOR, y por eso el
-- rollback de frontend sigue siendo seguro por sí solo.
--
-- Idempotente: se puede ejecutar dos veces sin daño.
-- ==================================================================

-- ------------------------------------------------------------------
-- 1 · Las piezas que elige la persona
--
-- Tres columnas en vez de un jsonb, y a propósito: son pocas, no cambian
-- a menudo, y así el catálogo queda protegido por CHECK en vez de por
-- buena voluntad del cliente. Añadir una pieza nueva ya obliga a
-- desplegar (hace falta su dibujo), así que la migración extra no cuesta
-- nada que no fuéramos a pagar igual.
--
-- Nullable a propósito: null = «no se ha elegido», y el cliente rellena
-- con los valores por defecto de piezasDe(). Eso permite desplegar el
-- cliente nuevo sin haber tocado un solo perfil.
-- ------------------------------------------------------------------

alter table public.profiles
  add column if not exists retrato_piel text,
  add column if not exists retrato_pelo text,
  add column if not exists retrato_peinado text;

-- Los tres CHECK se crean sueltos y con guarda porque `add constraint
-- if not exists` no existe en Postgres.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_retrato_piel_check') then
    alter table public.profiles add constraint profiles_retrato_piel_check
      check (retrato_piel is null or retrato_piel in
        ('clara','media','tostada','morena','oscura','profunda'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_retrato_pelo_check') then
    alter table public.profiles add constraint profiles_retrato_pelo_check
      check (retrato_pelo is null or retrato_pelo in
        ('negro','castano','rubio','pelirrojo','gris','blanco'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_retrato_peinado_check') then
    alter table public.profiles add constraint profiles_retrato_peinado_check
      check (retrato_peinado is null or retrato_peinado in ('corto','largo','rizado'));
  end if;
end $$;

-- ------------------------------------------------------------------
-- 2 · La marca de agua
--
-- `xp_maxima` guarda la XP más alta que ha tenido el perfil. La fase del
-- retrato se calcula contra ella y nunca contra `xp`.
--
-- Por qué: el README promete que todo se puede deshacer, y deshacer
-- devuelve la XP. Si el personaje se desvistiera al deshacer, un adulto
-- corrigiendo un toque equivocado le estaría quitando el manto a alguien
-- y la familia dejaría de deshacer. Mismo razonamiento que sostiene el
-- rango del Estandarte cuando se cierra una meta.
--
-- Lo mantiene un TRIGGER y no el cliente. Es deliberado: hay varios
-- caminos que tocan `xp` —validar, deshacer, retirar una misión, el
-- premio a mano— y bastaría que uno se olvidara para que una persona
-- perdiera el manto sin que nadie entendiera por qué.
-- ------------------------------------------------------------------

alter table public.profiles
  add column if not exists xp_maxima integer not null default 0;

-- Backfill: quien ya tiene XP arranca con su marca puesta, no en cero.
update public.profiles set xp_maxima = xp where xp_maxima < xp;

create or replace function public.marca_de_agua_xp()
returns trigger
language plpgsql
as $$
begin
  -- greatest() con el valor entrante cubre los tres casos de una vez:
  -- sube la XP (marca nueva), baja la XP (marca intacta) y un insert con
  -- XP inicial. `coalesce` porque en el insert new.xp_maxima trae el
  -- default 0, pero un cliente podría mandar null explícito.
  new.xp_maxima := greatest(coalesce(new.xp_maxima, 0), coalesce(new.xp, 0));
  return new;
end $$;

drop trigger if exists trg_marca_de_agua_xp on public.profiles;
create trigger trg_marca_de_agua_xp
  before insert or update of xp, xp_maxima on public.profiles
  for each row execute function public.marca_de_agua_xp();

-- ------------------------------------------------------------------
-- 3 · Las mascotas no tienen retrato
--
-- Decisión del 24-ago-2026: los perfiles de mascota se quedan con emoji.
-- No es solo que falten piezas de perro: es que un perro no tiene fase, y
-- meterlo en una escalera de aprendiz a maestra diría sobre un animal
-- algo que este proyecto no quiere decir.
--
-- La forma `case` no es estilo, es lo único que funciona: la versión
-- obvia con `or` acepta filas indebidas porque un CHECK que da NULL PASA.
-- Es exactamente la trampa que costó un día con `species` en la 027.
-- ------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_retrato_solo_personas') then
    alter table public.profiles add constraint profiles_retrato_solo_personas
      check (
        case
          when role = 'mascota'
            then retrato_piel is null and retrato_pelo is null and retrato_peinado is null
          else true
        end
      );
  end if;
end $$;

comment on column public.profiles.retrato_piel is
  'Pieza del retrato. null = sin elegir, el cliente pone el defecto. Ver src/lib/retratos.js';
comment on column public.profiles.xp_maxima is
  'XP más alta alcanzada. Manda sobre xp para la fase del retrato: deshacer no desviste. La mantiene trg_marca_de_agua_xp';
