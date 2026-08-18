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
