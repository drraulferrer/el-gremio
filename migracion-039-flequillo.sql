-- ==================================================================
-- Migración 039 · Flequillo
--
-- Octava pieza: recto, cortina o sin flequillo. Es un eje aparte y no un
-- peinado más porque «con flequillo o sin él» vale para casi todos los
-- cortes: meterlo dentro de la lista de peinados la habría triplicado
-- —largo, largo con cortina, largo despejado…— para decir lo mismo.
--
-- No aplica al rapado ni a la cabeza sin pelo, pero eso lo decide el
-- cliente (`admiteFlequillo`): la base no tiene por qué saberlo, y una
-- regla así en un CHECK obligaría a migrar cada vez que se añada un corte.
--
-- NO ROMPE AL CLIENTE VIEJO: columna nullable. Sin ella, `piezasDe()`
-- pone 'recto', que es lo que se dibujaba antes de existir esta pieza.
--
-- Idempotente.
-- ==================================================================

alter table public.profiles
  add column if not exists retrato_flequillo text;

alter table public.profiles
  drop constraint if exists profiles_retrato_flequillo_check;

alter table public.profiles
  add constraint profiles_retrato_flequillo_check
    check (retrato_flequillo is null or retrato_flequillo ~ '^[a-z]{2,24}$');

-- Las mascotas siguen sin retrato. La forma `case` no es estilo: con `or`
-- un CHECK que da NULL PASA, que es la trampa que costó un día en la 027.
alter table public.profiles
  drop constraint if exists profiles_retrato_solo_personas;

alter table public.profiles
  add constraint profiles_retrato_solo_personas check (
    case
      when role = 'mascota'
        then retrato_piel is null and retrato_pelo is null and retrato_peinado is null
         and retrato_gafas is null and retrato_tunica is null and retrato_barba is null
         and retrato_flequillo is null
      else true
    end
  );

comment on column public.profiles.retrato_flequillo is
  'Pieza del retrato: recto|cortina|despejado. null = recto. Catalogo en src/lib/retratos.js';
