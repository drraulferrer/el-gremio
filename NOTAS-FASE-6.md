# Fase 6 · inventario de los supuestos de gremio único

El plan de implementación pone una condición antes de empezar esta fase:

> **Lo que la puede tumbar.** Los supuestos de gremio único repartidos por el
> cliente: la carga (`src/App.jsx:135`), la zona horaria, el PIN y las
> notificaciones, que guardan `family_id` y `profile_id`. Hay que
> inventariarlos **antes** de empezar la fase.

Esto es ese inventario, hecho el **30 de agosto de 2026** sobre la 2.33.6.
Salieron los cuatro que el plan nombraba y **cuatro más**, uno de ellos
estructural y en la base, no en el cliente.

---

## 1. El que manda: una cuenta, un gremio, por índice único

`schema.sql:641`

```sql
create unique index if not exists idx_families_owner on public.families (owner);
```

Y su comentario, que es la mejor descripción del problema que hay escrita en
el repositorio:

> Único, además: la app carga el gremio con `limit 1` sin orden, así que una
> cuenta con dos gremios abre uno u otro según el día. **Mientras eso siga así,
> dos gremios por cuenta son un error, no una función.**

**No es teoría: se topó de frente.** El ensayo de la 056 intentó crear cuatro
gremios de mentira para llegar al límite global y falló con
`duplicate key value violates unique constraint "idx_families_owner"`. Hubo que
darle a cada gremio de ensayo una cuenta propia.

**Consecuencia para el orden de la fase.** El índice no se puede quitar antes
de que el cliente deje de cargar con `limit 1`: quitarlo antes deja a una
persona con dos gremios abriendo uno u otro «según el día». Y el cliente no
puede cambiar antes de que exista un segundo gremio que abrir. La salida es la
de siempre en este repositorio —expandir, migrar, contraer—:

1. El servidor aprende a crear un gremio con llave, y el índice **deja de ser
   único** pero sigue existiendo (lo necesita `mis_gremios()`, cuya primera
   rama es `families.owner = auth.uid()`).
2. El cliente deja de cargar con `limit 1` y pasa a cargar el **gremio activo**.
3. Hasta que (2) esté desplegado, nadie tiene dos gremios, así que (1) no puede
   romper a nadie.

**Y una pregunta que hay que responder al escribir (1):** un gremio creado con
llave, ¿quién es su `owner`? Hoy `families.owner` es la **credencial
compartida** del gremio, y `credenciales` tiene un `CHECK` que exige que una
credencial personal no lleve `family_id`. Lo que encaja sin romper nada es que
el `owner` sea la cuenta **personal** de quien lo crea y que ese gremio **nazca
sin credencial compartida**; crearle una es la Fase 7. `mis_gremios()` lo
recoge igual, por su primera rama y por la pertenencia.

---

## 2. La carga: `limit 1` y el más antiguo

`src/App.jsx:131-160`

```js
const { data: fams } = await supabase
  .from('families').select('*').order('created_at').limit(1)
```

El `order('created_at')` se puso a propósito y con buen criterio —sin él,
Postgres devolvía uno u otro—, pero fija exactamente el supuesto que esta fase
retira: **el gremio es el más antiguo de los que veo**.

Y hay un detalle que hace esto más urgente de lo que parece: desde la
migración 045 la política `familia_miembro_lee` deja leer `families` a quien
**pertenece**, no solo a la cuenta dueña. Así que en cuanto exista la primera
pertenencia en un segundo gremio, esta consulta ya devuelve varias filas y se
queda con la primera. El segundo gremio no es que se vea mal: **es invisible**.

Lo que hace falta: un **gremio activo** explícito, con su selector, y
`loadAll()` colgando de él.

---

## 3. `gremio_profile` es global y debería ser por gremio

`localStorage['gremio_profile']` guarda **el personaje elegido**, sin decir de
qué gremio es. Lo leen o escriben siete sitios:

| Fichero | Qué hace |
|---|---|
| `src/App.jsx:45` | lo lee al arrancar, para volver al personaje de la última vez |
| `src/App.jsx:551` · `:556` | lo escribe y lo borra al elegir o soltar personaje |
| `src/lib/acciones.js:640` | lo borra |
| `src/screens/Avisos.jsx:48` | de quién son los avisos |
| `src/screens/ModoLimpieza.jsx:96` | quién activa la campaña |
| `src/screens/ParentPanel.jsx:72` | quién opera el panel |

Con dos gremios, ese id pertenece a uno de ellos. Al cambiar al otro apunta a
un perfil **que no está en el gremio activo**, y cada uno de los siete sitios
falla a su manera: unos con un `undefined` y otros —los peores— cogiendo el
primero de la lista como si tal cosa.

Arreglo natural: la clave pasa a llevar el gremio dentro
(`gremio_profile:<family_id>`), y el valor viejo se lee una vez como el del
gremio inicial para no expulsar a nadie de su personaje al desplegar.

---

## 4. La zona horaria es un singleton de módulo

`src/lib/supabase.js:162` (`configurarZona`), llamada desde `src/App.jsx:158`
y `src/screens/Datos.jsx:101`.

Se fija **una vez** al cargar el gremio, y de ella cuelga `dayKey()`, que es
quien decide qué día es hoy en esta casa: la estrella diaria, las rachas y el
plan del día. La migración 018 existe justamente porque servidor y navegador
contaban días distintos.

Con dos gremios en zonas distintas, cambiar de gremio **sin volver a llamar a
`configurarZona`** deja el día contándose en la zona del gremio anterior. Una
racha viva se lee como rota. La definición de hecho de la fase ya lo pide con
todas las letras: «zona horaria y temporada **se recalculan** al cambiar de
gremio».

---

## 5. La temporada, igual

`src/lib/temporadas.js` la deriva de `family_goals` —de las metas logradas del
gremio cargado— y de ella cuelgan `rangoDeGremio()` y `precioEnTemporada()`,
que es lo que vale un premio hoy. No se guarda en ninguna parte, así que no
puede quedarse «pegada»… salvo que no se recarguen las metas al cambiar de
gremio. Va en el mismo saco que la zona: es parte de recargar entero.

**Ojo con la lectura de producto:** el nivel y la temporada son **por gremio**.
La definición de hecho lo dice como criterio de pantalla: «ninguna pantalla
sugiere que el nivel o la temporada sean globales». Hoy no hay ninguna que lo
sugiera porque no hay con qué compararlo; en cuanto haya selector, sí.

---

## 6. El PIN ya está atado al gremio, y aun así hay que mirarlo

`family.parent_pin_hash`, comparado en el cliente en `components/ui.jsx:144` y
`src/screens/Seguridad.jsx:31`.

La buena noticia: **ya cuelga de `family`**, así que en cuanto `family` sea el
gremio activo, el PIN correcto viene solo. Saber el PIN de A no abre B, que es
lo que la 054 dejó dicho.

La mala: el PIN **se sigue comprobando en el cliente** —la 054 lo dejó
anotado— y ahora eso pasa a significar algo más grande. Con un gremio, un PIN
mal comprobado deja entrar a alguien en su propia casa. Con cinco, la
comprobación es lo único que separa el panel de un gremio del de otro. **No
hace falta arreglarlo en esta fase, pero deja de ser una deuda cómoda.**

---

## 7. Las notificaciones: un aparato, un gremio

`src/lib/push.js:102` y `schema.sql` (`push_subs`)

```js
{ family_id: family.id, profile_id: profile.id, ...comoJson(sub), activa: true },
{ onConflict: 'endpoint' }
```

`push_subs.endpoint` es **único**: la identidad de la fila es el aparato. La
suscripción guarda además `family_id` y `profile_id`, y se reescribe entera al
cambiar de perfil.

Con varios gremios eso significa que **un teléfono solo puede estar suscrito a
uno**. Cambiar de gremio pisa la fila, y la persona deja de recibir los avisos
del anterior sin que nada se lo diga. Es el único punto del inventario que no
es un arreglo mecánico: **es una decisión de producto** y está anotada abajo.

---

## 8. Crear gremio, en el onboarding

`src/screens/Onboarding.jsx:159`

```js
const base = { owner: userData.user.id, name: nombre.trim(), parent_pin_hash: pinHash }
```

Crea el gremio con la cuenta como `owner`, que es el camino de fundación de
siempre (`F-1a`) y sigue siendo válido. Lo que **no** vale es reutilizarlo para
`F-6` —crear un gremio con una llave—, porque ahí la cuenta ya tiene gremio y
choca con el índice del punto 1, y porque el gremio nuevo tiene que consumir la
llave **en la misma transacción** (`R-20`, `T-10`). `F-6` es una función del
servidor, no un `insert` desde el cliente.

---

## Lo que sale de aquí

**Orden obligado**, por el punto 1:

| | |
|---|---|
| **6.1 · servidor** | invitaciones con caducidad, crear gremio con llave, aceptar con llave, abandonar y expulsar, reingreso con reactivación del personaje. El índice deja de ser único. Nada de esto rompe al cliente actual, que sigue viendo un gremio |
| **6.2 · cliente** | gremio activo y selector, `gremio_profile` por gremio, recarga completa al cambiar (zona y temporada incluidas). Es la primera pieza con **versión y despliegue** |
| **6.3 · pantallas** | forjar, mis llaves, invitar y aceptar |

**Dos decisiones que no son mías:**

1. **Las notificaciones** (punto 7). O la suscripción pasa a ser por
   `(endpoint, family_id)` —un aparato, varias filas, y los avisos siguen
   siendo de un gremio—, o los avisos se dirigen a la **persona** y el gremio
   pasa a ser un dato del mensaje. La primera es un cambio pequeño y conserva
   el modelo; la segunda es más correcta y toca la Edge Function.

2. **Cuándo se despliega 6.2.** Hay una familia real usando esto. El servidor
   se puede adelantar sin riesgo —nadie tiene dos gremios todavía—, pero el
   cliente cambia la carga, que es el camino por el que pasa todo.
