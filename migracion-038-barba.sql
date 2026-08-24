-- ==================================================================
-- Migración 038 · Barba
--
-- Séptima pieza del retrato. Va del color del pelo, así que no trae
-- columna de color propia: una barba de un color distinto al pelo se ve
-- rara casi siempre y añadiría un mando más a un formulario que ya tiene
-- seis.
--
-- Esta es la primera pieza que se añade con el criterio de la 037: el
-- CHECK es de FORMA, así que los valores —ninguna, bigote, perilla,
-- corta, larga— viven en `src/lib/retratos.js` y no aquí. Añadir una
-- barba nueva mañana ya no pide migración; esta existe solo porque hace
-- falta la columna.
--
-- NO ROMPE AL CLIENTE VIEJO: columna nullable. Un cliente anterior no la
-- manda, y si lee un perfil que la tiene, `piezasDe()` no la conoce y no
-- la dibuja.
--
-- Idempotente.
-- ==================================================================

alter table public.profiles
  add column if not exists retrato_barba text;

alter table public.profiles
  drop constraint if exists profiles_retrato_barba_check;

alter table public.profiles
  add constraint profiles_retrato_barba_check
    check (retrato_barba is null or retrato_barba ~ '^[a-z]{2,24}$');

-- Las mascotas siguen sin retrato, ahora también sin barba. La forma
-- `case` no es estilo: con `or` un CHECK que da NULL PASA (trampa de la 027).
alter table public.profiles
  drop constraint if exists profiles_retrato_solo_personas;

alter table public.profiles
  add constraint profiles_retrato_solo_personas check (
    case
      when role = 'mascota'
        then retrato_piel is null and retrato_pelo is null and retrato_peinado is null
         and retrato_gafas is null and retrato_tunica is null and retrato_barba is null
      else true
    end
  );

comment on column public.profiles.retrato_barba is
  'Pieza del retrato, del color del pelo. null = sin elegir. Catalogo en src/lib/retratos.js';
