# Rotación de credenciales · cada 90 días

Las claves y contraseñas no deberían durar para siempre. Este es el
calendario y el procedimiento, pensado para que rotar **no implique dejar
la app caída** en ningún momento.

Comprobar en cualquier momento cuánto queda:

```bash
npm run secrets:check
```

Lee `VITE_SECRETS_ROTATED_AT` de `.env`, avisa a partir de 90 días, y de
paso revisa que `.env` no esté versionado y que no haya nada con pinta de
secreto en los ficheros del repositorio.

---

## Inventario: qué hay y qué riesgo tiene

| Credencial | Dónde vive | ¿Secreta? | Rotar |
|---|---|---|---|
| Clave `anon` de Supabase | En el bundle publicado | **No.** Es pública por diseño | Solo si se rota el JWT del proyecto |
| Clave `service_role` | Solo en el panel de Supabase | **Sí, crítica.** Se salta RLS | Cada 90 días o ante cualquier sospecha |
| Contraseña de la base | Panel de Supabase | Sí | Cada 90 días |
| Contraseña de la cuenta familiar | Gestor de contraseñas | Sí | Cada 90 días |
| PIN parental | Hash en la tabla `families` | Doméstico | Cuando alguien lo aprenda |
| Token de GitHub (`gh`) | Llavero de macOS | Sí | Cada 90 días |
| DSN de Sentry (si se activa) | En el bundle | No | No hace falta |

La confusión clásica: ver la clave `anon` en el código fuente publicado y
pensar que hay una fuga. No la hay. Esa clave solo permite hablar con la
API; lo que decide qué filas se ven es Row Level Security. La que sí es
una llave maestra es la `service_role`, y por eso **nunca** debe salir del
panel de Supabase, ni al `.env`, ni al repositorio, ni a un mensaje.

---

## Procedimiento, sin caída

### 1. Contraseña de la base de datos (2 minutos)

Supabase → *Project Settings → Database → Reset database password*.

No afecta a la app: el cliente del navegador usa la API REST con la clave
anon, no una conexión directa a Postgres. Solo hay que actualizarla donde
se use un cliente SQL de escritorio.

### 2. Clave `service_role` (2 minutos)

Supabase → *Project Settings → API → Legacy API keys → Rotate*.

La app no la usa en ninguna parte. Si algún script tuyo la usara, hay una
ventana en la que la vieja deja de valer: actualiza primero el script y
rota después.

### 3. Contraseña de la cuenta familiar (5 minutos, con aviso)

Es la única rotación que **sí se nota**, porque cierra sesión en todos los
dispositivos y hay que volver a entrar en cada uno.

1. Avisar a la familia (es literalmente todo el censo de personas usuarias).
2. Supabase → *Authentication → Users* → cambiar la contraseña.
3. Guardarla en el gestor de contraseñas.
4. Volver a entrar en cada dispositivo. El perfil elegido se recuerda, así
   que solo hay que teclear email y contraseña una vez por aparato.

Hacerlo un sábado por la mañana, no un martes a las once de la noche.

### 4. PIN parental (1 minuto)

No hay pantalla para cambiarlo todavía (está en el backlog). Mientras
tanto, desde el SQL Editor, calculando antes el hash en la consola del
navegador con la app abierta:

```js
// En la consola del navegador, con la app abierta:
const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('gremio:NUEVO_PIN'))
console.log([...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''))
```

```sql
update families set parent_pin_hash = 'EL_HASH_QUE_SALIÓ' where id = 'TU_FAMILY_ID';
```

### 5. Token de GitHub (1 minuto)

```bash
gh auth refresh
```

### 6. Cerrar la rotación

Actualizar la fecha en `.env`:

```
VITE_SECRETS_ROTATED_AT=2026-08-15
```

Y comprobar:

```bash
npm run secrets:check
```

La fecha aparece también en **Panel parental → ⚙️ → Rotación de
credenciales** después del siguiente despliegue.

---

## Si sospechas que algo se ha filtrado

No esperes al calendario. En este orden:

1. Rotar la `service_role` **primero**: es la única que se salta RLS.
2. Cambiar la contraseña de la cuenta familiar.
3. Revisar `app_logs` y el panel de Supabase (*Logs → API*) por accesos raros.
4. Si el secreto llegó a estar en un commit, rotarlo igualmente aunque
   borres el commit: el historial de git y los mirrors de GitHub conservan
   copias durante bastante tiempo.

---

## Recordatorio automático

`npm run secrets:check` avisa, pero solo si alguien lo ejecuta. Va incluido
en `npm run verify`, que conviene correr antes de cada despliegue.

Para un recordatorio de verdad, poner una tarea recurrente cada 90 días en
el calendario apuntando a este documento. Es lo más fiable que hay sin
montar infraestructura para cuatro personas.
