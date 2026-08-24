-- ==================================================================
-- Migración 036 · «Sin pelo» como peinado
--
-- Amplía el CHECK de `retrato_peinado` para aceptar 'calvo'. Es lo que
-- cuesta añadir una pieza al retrato cuando el catálogo va protegido por
-- CHECK en vez de por buena voluntad del cliente (ver la 035, §1): una
-- migración de tres líneas y el dibujo.
--
-- NO ROMPE AL CLIENTE VIEJO: solo ensancha lo que se acepta. Un cliente
-- anterior nunca mandará 'calvo', y si LEE un perfil que lo tenga,
-- `piezasDe()` no lo encuentra en su catálogo y cae al valor por defecto.
-- Sale con pelo corto en vez de romper, que es el fallo bueno.
--
-- Idempotente: se puede ejecutar dos veces sin daño.
-- ==================================================================

alter table public.profiles
  drop constraint if exists profiles_retrato_peinado_check;

alter table public.profiles
  add constraint profiles_retrato_peinado_check
    check (retrato_peinado is null or retrato_peinado in
      ('corto','largo','rizado','calvo'));
