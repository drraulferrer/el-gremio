# El Gremio · instrucciones para el agente

Lee `ARRANQUE-SESION.md` antes de tocar nada. Dice dónde está todo, qué
está hecho, qué falta y qué trampas tiene.

## Regla de cierre de sesión (obligatoria)

**Al llegar al 90 % de la ventana de contexto:**

1. **Termina la microtarea en curso.** No dejes código a medias, tests en
   rojo ni una migración escrita sin ejecutar. Si algo no cabe, no lo
   empieces.
2. **Actualiza `ARRANQUE-SESION.md`** con lo que ha cambiado: estado del
   esquema, migraciones ejecutadas y pendientes, decisiones tomadas con su
   porqué, y lo que queda abierto.
3. **Avisa a la persona** de que hay que abrir sesión nueva, y dile en una
   línea por dónde seguir.

No esperes a que se agote el contexto. Un cierre ordenado a tiempo vale
más que dos tareas más apuradas: lo que no queda escrito en el arranque se
pierde, y esta app se construye en sesiones largas y espaciadas.

## Cómo se trabaja aquí

- **Verifica en el navegador, no solo compilando.** `npm run dev:demo` y
  mira la pantalla. Los tres bugs más caros de este proyecto (el fondo que
  parpadeaba, los globos que se resucitaban, el `ReferenceError` en el
  tablero de la junior) pasaron el build y los tests y solo se vieron
  abriendo la app.
- **Cada cambio de esquema se escribe dos veces**: en `schema.sql` y en un
  `migracion-0NN-<tema>.sql` idempotente. Las dos, siempre.
- **Todo `insert` derivado de `profiles` lleva `family_id` explícito.** El
  SQL Editor se salta el RLS: un insert sin filtrar escribió una vez en
  familias que no eran la nuestra.
- **Antes de dar algo por terminado**: `npm run verify`, luego
  `npm run deploy`, luego `npm run health`.
- **Los tests fijan decisiones, no implementaciones.** Si uno falla al
  cambiar un número, léelo: casi siempre está defendiendo algo que se
  razonó en su día (la peque esperando 18 días por un premio, las bandas
  de precio solapándose). Cambiar el test es a veces lo correcto, pero
  nunca antes de entender qué defendía.
- **Nunca metas datos reales de la familia en el repo**, que es público:
  ni nombres, ni en fixtures, ni en ejemplos de documentación.
