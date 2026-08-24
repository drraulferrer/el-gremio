-- ==================================================================
-- Migración 037 · Gafas, túnica propia y catálogo abierto
--
-- Tres cosas, y la tercera es un cambio de criterio.
--
-- NO ROMPE AL CLIENTE VIEJO: columnas nullables y CHECKs que solo se
-- ensanchan. Un cliente anterior no manda gafas ni túnica, y si LEE un
-- perfil que las tiene, `piezasDe()` no las conoce y cae al valor por
-- defecto: sale sin gafas en vez de romper.
--
-- Idempotente.
-- ==================================================================

-- ------------------------------------------------------------------
-- 1 · Dos piezas nuevas
--
-- Las gafas son la ampliación que más rinde, y no por gusto: las listas
-- dibujan solo la cabeza, así que únicamente lo que está en la cara
-- sirve para distinguir a alguien de un vistazo. Una túnica nueva no
-- ayuda a saber quién es; unas gafas, sí.
--
-- La túnica separa el color de la ropa del color del miembro, que eran
-- el mismo dato. Es la ampliación más barata que tiene este retrato:
-- multiplica las combinaciones sin dibujar una sola pieza.
-- ------------------------------------------------------------------

alter table public.profiles
  add column if not exists retrato_gafas text,
  add column if not exists retrato_tunica text;

-- ------------------------------------------------------------------
-- 2 · El catálogo deja de estar enumerado en la base
--
-- CAMBIO DE CRITERIO respecto a la 035, y conviene decir por qué.
--
-- La 035 metió los valores dentro del CHECK argumentando que así el
-- catálogo lo protegía la base y no la buena voluntad del cliente. Dos
-- días de uso han dicho lo contrario: la 036 existió solo para añadir
-- 'calvo', y esta tendría que ensanchar tres CHECK más para cuatro
-- peinados y dos tonos. Una migración por peluquería.
--
-- Y lo que se compraba con esa migración era poco: `piezasDe()` ya cae al
-- valor por defecto ante una pieza que no conoce —hace falta, porque un
-- cliente viejo lee piezas nuevas todo el rato— así que un valor raro en
-- la columna nunca llegó a poder romper nada.
--
-- Queda un CHECK de FORMA, que es lo que de verdad protegía: impide meter
-- cualquier cosa en la columna sin obligar a una migración por pieza.
-- ------------------------------------------------------------------

do $$
declare
  v_col text;
begin
  foreach v_col in array array['piel','pelo','peinado','gafas','tunica'] loop
    execute format(
      'alter table public.profiles drop constraint if exists profiles_retrato_%s_check',
      v_col);
    execute format(
      'alter table public.profiles add constraint profiles_retrato_%s_check
         check (retrato_%s is null or retrato_%s ~ ''^[a-z]{2,24}$'')',
      v_col, v_col, v_col);
  end loop;
end $$;

-- ------------------------------------------------------------------
-- 3 · Las mascotas siguen sin retrato, ahora también sin las dos nuevas
--
-- La forma `case` no es estilo: la versión obvia con `or` acepta filas
-- indebidas porque un CHECK que da NULL PASA. Es la trampa de la 027.
-- ------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_retrato_solo_personas;

alter table public.profiles
  add constraint profiles_retrato_solo_personas check (
    case
      when role = 'mascota'
        then retrato_piel is null and retrato_pelo is null and retrato_peinado is null
         and retrato_gafas is null and retrato_tunica is null
      else true
    end
  );

comment on column public.profiles.retrato_gafas is
  'Pieza del retrato. null = sin elegir. El catálogo vive en src/lib/retratos.js, no aquí: ver §2 de la 037';
comment on column public.profiles.retrato_tunica is
  'Color de la tunica, separado del color del miembro. null o ''perfil'' = usa el del miembro';
