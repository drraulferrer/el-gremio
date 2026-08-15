
-- Migración 005 · retirar la versión antigua de resolve_completion.
--
-- `create or replace function` NO sustituye una función cuando cambia su
-- firma: crea una sobrecarga. Al añadir praise_text en la migración 004,
-- las bases que ya existían acabaron con las dos versiones, y PostgREST
-- no puede elegir entre ellas: devuelve PGRST203 y la llamada de dos
-- argumentos (la estrella inmediata de la peque) deja de funcionar.
--
-- Ejecuta esto si tu base pasó por la 004 con la función ya creada.
-- En una base nueva desde schema.sql no hace falta: solo existe una.

drop function if exists public.resolve_completion(uuid, text);
