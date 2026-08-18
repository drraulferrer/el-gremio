# Cambios

Qué versión trae qué. Sirve para dos cosas concretas: saber qué está
corriendo un dispositivo cuando algo falla —`app_logs.release` guarda la
versión de cada línea— y decidir a qué volver con `npm run rollback`.

## Cuándo sube cada número

| | cuándo | ejemplo |
|---|---|---|
| **MAYOR** | una migración deja al cliente viejo roto: el rollback de frontend ya no es seguro por sí solo | `target_role` → `target_roles`, que un cliente anterior lee como «para todos» |
| **MENOR** | algo nuevo que la familia ve y usa | los minijuegos, el historial semanal, el premio a mano |
| **PARCHE** | arreglos y ajustes que no cambian lo que se puede hacer | los globos de 7 s a 18 s |

Semver clásico habla de romper una API pública. Aquí no hay consumidores
externos, así que lo que se traduce como «ruptura» es lo único que de
verdad duele en esta app: que el esquema y el cliente dejen de encajar.

---

## 2.2.0 · 18 de agosto de 2026

**Recordatorio de que los avisos están sin activar.**

Sale de una medición, no de una intuición: ese día, de ocho perfiles
activos, **cinco no tenían ningún aparato registrado**. El sistema les
escribía avisos en `push_log` que no salían a ninguna parte, y no se
notaba porque la app funciona igual y el registro dice que el aviso «se
apuntó». Los tres que esa tarde tenían motivo `vuelve` —«hace días que no
apareces»— eran de los que no podían recibirlo.

- **En el Setup**, un paso nuevo explica qué son, cuándo llegan y dónde se
  activan. No los activa: durante el alta el gremio todavía no existe y el
  permiso se concede aparato por aparato.
- **En el panel parental**, un aviso arriba del todo mientras este
  dispositivo no los tenga, con el número de miembros del gremio que no
  recibirían nada. Lleva a 🔔 Avisos con la sección ya abierta.
- **Se puede callar** con «Dejar de mostrar», y entonces explica la ruta
  para activarlos más tarde. El olvido se guarda **en el aparato**, no en
  la base: una suscripción pertenece a la instalación, así que guardarlo
  por perfil lo escondería en el móvil de al lado, donde sigue haciendo
  falta.
- **No insiste cuando no serviría de nada**: si el navegador ya los
  bloqueó, si el aparato no puede o si falta la clave del despliegue, se
  calla. El botón al que llevaría tampoco funcionaría.

## 2.1.0 · 18 de agosto de 2026

Dos cosas que pidió la familia después de los primeros días de uso real.

**Encender una misión es un toque.** Antes había que abrir el lápiz,
bajar al par Activa/Pausada del final del formulario, pulsarlo y guardar:
cuatro pasos y un modal para cambiar un booleano. Ahora:

- En **Panel → Peque**, cada misión lleva su botón ▶/⏸ al lado del lápiz,
  el mismo que ya tenían los premios. Las activas suben arriba y la
  cabecera dice cuántas están en pausa.
- En **Panel → Misiones**, las pausadas dejan de estar solo detrás de la
  biblioteca: se despliegan al final de la lista, con su destino y sus
  puntos, y se reencienden con un «▶ Activar». Siguen fuera de las listas
  de cada persona a propósito —eran treinta tarjetas al 50 % de opacidad
  de cosas que no están pasando—, pero ya no hay que ir a buscarlas a un
  catálogo para volver a encender algo que ya existe.

**Premios de arranque, por debajo de 250 monedas.** El premio más barato
del catálogo cuesta 325, o sea ocho o nueve días de la junior, así que los
primeros días abría la tienda y no podía tocar nada. Seis premios nuevos
de 80 a 240 monedas —de dos a seis días— cubren ese hueco y encadenan con
las 325 del catálogo sin dejar salto.

No son un nivel nuevo, son andamio, y el código los trata como tal:

- Son **decisiones, no cosas**, igual que el nivel 1: elegir la música,
  elegir la cena, quedarse un rato más.
- **No entran en el diagnóstico de la economía.** De paso se arregló que
  los premios de la peque sí entraban: en una casa con peque, el nivel 1
  salía con un precio medio de 190 monedas y el panel avisaba de que «se
  consigue demasiado rápido» un premio de 325.
- **No suben de precio al cambiar de temporada.** Encarecerlos no les
  añade dificultad, les quita el sentido.
- **Están pensados para retirarse** cuando el hábito se sostenga solo, y
  la pantalla que los añade lo dice.

Se añaden desde **Panel → Premios**, con un aviso que solo sale si de
verdad hace falta y que lleva la cifra delante: cuántos días de la junior
cuesta lo más barato que hay. Esa misma pantalla ofrece los premios de la
peque cuando faltan, que era un pendiente conocido de los gremios creados
antes del setup de agosto.

## 2.0.0 · 17 de agosto de 2026

Todo lo que salió entre el 15 y el 17 de agosto. Fueron **55 despliegues y
102 commits con el número parado en 1.0.0**, porque la versión es un campo
a mano de `package.json` y nadie la tocó nunca; lo que identificaba cada
despliegue era el hash del commit. A partir de aquí se numera, y
`npm run deploy` avisa si se olvida.

Es MAYOR porque el criterio se cumplió varias veces: hubo migraciones tras
las cuales un cliente antiguo interpreta mal los datos, no solo se queda
sin funciones.

### La app
- Modo peque completo: pantalla propia, tarro de estrellas, tienda a su
  escala, tres minijuegos que rotan por día y fiesta al completar el día.
- Sistema de habilidades: cada misión entrena una de ocho competencias,
  con rangos y elogio específico al validar.
- Misiones dirigidas a una persona, a un rol o a un grupo; agrupadas por
  persona y frecuencia; con planificación por días de la semana.
- Validar o **no** validar con motivo, que quien la hizo ve en su tablero.
- Historial semanal navegable hacia atrás.
- Temporadas del gremio, insignias con superpoder y premio a mano.
- Concordancia de género por perfil, con forma neutra reescrita.

### La casa
- Dominio propio: **elgremioapp.com**.
- Avisos push sin servidor propio.
- Correo propio con SMTP y plantillas en español.
- Captcha de Turnstile y textos legales con aceptación en el alta.
- CSP estricta, CI en cada empujón y despliegue desde Actions.
- Licencia AGPL-3.0.
- Preparada para más de una familia.

### Economía
Recalculada de arriba abajo y con tests que la sostienen: cadencias de
premio a 15/30/45 días, meta a 60, presupuesto de 8 misiones-diarias
equivalentes por persona (7 diarias, 5 semanales, 8 mensuales) y aviso
cuando alguien se pasa.

---

## 1.0.0 · 15 de agosto de 2026

El prototipo inicial: misiones, XP, monedas, premios, insignias y meta
cooperativa, con la capa de producción y la gestión de miembros.
