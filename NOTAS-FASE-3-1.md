# Fase 3.1 · la configuración de la expansión deja de ser una constante

*30 de agosto de 2026 · rama `fase-3-1` · migración **050**, escrita y **no ejecutada***

Esta es la pieza **3.1** del plan de implementación: configuración versionada,
histórica y auditable, legible por el servidor. Sale de la especificación
`el-gremio-gremios-multiples.md` §11.4 (`R-16`, `R-66`, `D-10`, `CFG-1` a
`CFG-7`, `DEP-4`) y de §11.1, §11.3 y §11.5.

**No incluye 3.2 (cartera híbrida) ni 3.3 (el precio es el del gremio donde se
gasta).** Esas tocan las ocho funciones que mueven monedas y se estaban
haciendo en paralelo.

---

## 1 · Qué hay ahora

### Tres tablas, que son **una sola cosa**

| Tabla | Qué guarda |
|---|---|
| `configuracion_expansion` | Una fila por versión: identificador, vigencia, límite global, escalones por gremio, regla de crecimiento, caducidades y auditoría. |
| `escalones_expansion` | Un peldaño por fila: `orden`, `nivel_exigido`, `coste`. **El coste que se cobra sale de aquí.** |
| `disponibilidad_tipos` | La matriz tipo × país × estado de publicación (`R-109`). |

Se escriben **juntas, en una transacción**, y después ninguna admite `update`
ni `delete`. Publicar una regla nueva es insertar otra versión.

### Cinco funciones de lectura

| Función | Devuelve | Sin configuración vigente |
|---|---|---|
| `configuracion_expansion_vigente()` | El identificador de versión | `null` |
| `parametros_expansion()` | Límite global, escalones por gremio, caducidades | **cero filas** |
| `escala_expansion()` | La escala entera, para pintarla | **cero filas** |
| `hito_expansion(k)` | El escalón `k`: lo que consultará quien forje | **cero filas** |
| `tipo_publicado(tipo, pais)` | Si ese tipo está publicado en ese país | `false` |

### La primera versión, `2026-08-30.1`

Son **exactamente** los números de la calibración del 29-ago-2026, sin retocar
ninguno:

| | |
|---|---|
| Hitos | nivel **6**, 8, 10, 12 |
| Costes | **300**, 750, 1875, 4690 |
| Regla | geométrica, factor **×2,5** |
| Límite global | 5 pertenencias activas (`R-60`) |
| Invitaciones | caducan a los 14 días (`R-62`) |
| Llaves | **no caducan** (`R-62`) |
| Solicitud de junior / autorización adulta | 14 días / 72 horas (`R-80`) |
| Publicado en España | Hogar y Amigos. Equipo y Hogar compartido, no |

### Ficheros

- `migracion-050-las-reglas-dejan-de-ser-constantes.sql` — idempotente, sin
  acentos, con el barrido de la 021 pegado al final.
- `schema.sql` — el mismo bloque, **justo antes** del barrido final. No se ha
  tocado ni una línea del resto del fichero.
- `tests/configuracion.test.js` — **30 tests nuevos**.
- `tests/expansion.test.js` — **+1 test**, y ahora **lee los números de la
  migración** en vez de tenerlos escritos.

`npm run verify`: **1271 tests en 72 ficheros, en verde** (venía de 1240 en 71).

---

## 2 · Las decisiones, y por qué

### Los costes se guardan uno a uno, no la fórmula

La regla es geométrica y cabría en dos columnas (`coste_base`, `factor`). Pero
entonces alguien tendría que calcular la potencia —el servidor al cobrar y el
cliente al pintar— y eso son **dos fuentes de verdad**, que es justo lo que
`CFG-1` prohíbe y el error que ya existe con la curva de nivel (`H-22`).

Manda la fila. `coste_base`, `factor` y `regla_crecimiento` se guardan al lado
porque `R-66` los pide como campo mínimo —son la **procedencia** del número, no
el número— y un disparador comprueba al publicar que las filas siguen cuadrando
con la regla declarada. Declarar una fórmula y guardar otra cosa es la peor
versión de las dos fuentes: la que miente.

Por lo mismo, **`parametros_expansion()` no devuelve `coste_base` ni `factor`**.
Quien no recibe la fórmula no la puede recalcular mal.

### El cuarto escalón cuesta 4690 y no 4687,5

`300 × 2,5³ = 4687,5`. El coste es un entero, así que hay que redondear, y se
redondea **al múltiplo de cinco más cercano** porque es lo que ya hace el resto
de la tienda y lo que defendía `expansion.test.js` para los tres primeros. No se
estrena una segunda regla de redondeo para un solo caso.

### Una versión publicada no se toca, y hacen falta **tres** disparadores

1. `update` y `delete` fallan en las tres tablas. Para todo el mundo, `postgres`
   incluido. Si algún día hay que borrar una versión de verdad, hay que retirar
   el disparador a mano — y eso es lo que se quiere: que cueste y que se note.
2. `publicada_at` la pone el servidor y no se puede pasar de fuera.
3. **Los escalones y la disponibilidad solo se insertan en la misma transacción
   que su cabecera.** Sin esto el sello no cierra nada: añadir mañana un quinto
   escalón a la versión de hoy no es un `update`, pero cambia lo que cobraba una
   versión que ya se usó.

Sin esto, `CAM-1` a `CAM-6` —subir un umbral no retira una llave comprada,
subir un coste no cobra la diferencia— dejarían de cumplirse solas: el recibo de
ayer mentiría en cuanto alguien tocara un precio.

### La ausencia de configuración **deniega**, y por eso la forma es «cero filas»

Un `null` se recoge con un `coalesce` distraído; una excepción se captura. Cero
filas no se confunde con un permiso. `tipo_publicado()` es un `exists`: lo que
no está declarado, no está publicado — así, añadir un país a una lista del
cliente no puede abrir un tipo que no ha pasado su revisión jurídica.

El validador defiende además, **al publicar**: al menos un escalón, órdenes
consecutivos desde 1, nivel estrictamente creciente (`R-14`) y cada coste al
menos **el doble** del anterior (`R-15`). Ese «doble» era hasta hoy un número
dentro de `expansion.test.js`; ahora es un límite sobre cualquier versión futura.

### Las tablas no se conceden a nadie; las funciones sí

Mismo patrón que `operadores` y `salud_diaria`: **RLS encendido y sin
políticas**. La configuración no es de una familia, es del producto. Lo único
que sale por la API es lo que devuelven las lectoras, que devuelven lo justo:
`motivo` y `publicada_por` no salen nunca.

Las lectoras son `security definer` **a propósito**: la respuesta a «cuánto
cuesta la primera llave» tiene que ser la misma para todo el mundo y no depender
de qué políticas alcance la sesión que pregunta.

### `tipo_publicado()` **no** se concede a `authenticated`

Es la única. El país es un parámetro suyo, y `R-108`/`SEC-29` dicen que un
cliente no declara en qué país está para desbloquear un tipo. Quien la llame
tiene que ser otra función del servidor —la creación de gremios de la Fase 4.4—,
que sabrá de dónde sacar el país de verdad.

### `publicada_por` no tiene clave ajena a `auth.users`

Deliberado. Con `on delete set null`, borrar la cuenta de quien publicó
dispararía un `update` sobre una tabla que prohíbe los `update`: **el borrado de
la cuenta fallaría**, y además reescribiría el rastro. Con `no action` fallaría
por la clave ajena. Un apunte de auditoría tiene que sobrevivir a la cuenta que
nombra — mismo criterio que `movimientos_coins.referencia` desde la 042.

### El esquema no dice «Talis»

`tests/talis.test.js` lo caza, y con razón: el esquema habla de `coins` y el
nombre narrativo vive en el cliente. Los comentarios del bloque dicen
«monedas». Me pilló al primer `npm run verify`, exactamente igual que a quien
escribió la 042.

### `expansion.test.js` ahora lee de la migración

Su propio comentario lo pedía desde el 29-ago: «cuando exista la configuración
versionada que pide `R-66`, el test los leerá de ahí». Se ha hecho. Las trece
comprobaciones siguen intactas —el hito hacia el día 30, poder forjar **y** usar
la llave, el crecimiento no lineal, la junior que llega antes— y una más
comprueba que el parseo del SQL ha leído los cuatro escalones, para que un
parseo roto no deje pasar todo comparando `undefined` con `undefined`.

---

## 3 · Lo que **no** hace

- **No cobra nada ni forja ninguna llave.** Eso es la Fase 5. Aquí solo está la
  fuente y sus lectores. Como `exige_persona()` en la 044, las funciones existen
  antes que su primer uso a propósito.
- **No toca `profiles.coins`, ni la cartera, ni ninguna de las ocho funciones
  que mueven monedas.** Son 3.2 y 3.3.
- **No resuelve todavía la disponibilidad por jurisdicción.** La matriz existe y
  `tipo_publicado()` la contesta; quien la consulte al crear un gremio es la
  Fase 4.4.
- **No hay pantalla.** No hay nada que enseñar hasta que exista el hito de
  expansión.
- **No cambia ni una línea de `src/`.** No hay versión nueva que subir ni nada
  que desplegar por esta pieza.

---

## 4 · Lo que queda abierto

### Cosas que me paré a escribir aquí en vez de hacerlas

1. **Las 72 horas de la 047 y la 048 siguen siendo un literal.** `interval '72
   hours'` está escrito dentro de `solicitar_conversion` y de
   `solicitar_migracion_correo`. Son caducidades de la **conversión de
   identidad**, no de la expansión, así que **no** se han duplicado en esta
   configuración: meterlas aquí sin redirigir las funciones habría creado
   exactamente la segunda fuente que `CFG-1` prohíbe. Redirigirlas obliga a
   reescribir dos funciones que ya están en producción y ensayadas, y eso no es
   de esta pieza. **Hacerlo la próxima vez que se toquen esas dos funciones**, y
   entonces añadir sus columnas a `configuracion_expansion` (o a una tabla
   hermana, si se prefiere separar los dominios).
2. **Los límites por tipo (`MAX_PERFILES`, mascotas, misiones activas) no se han
   movido.** §11.6 los pone en la **plantilla de tipo** (Fase 4.1), no en la
   configuración de expansión, y ponerlos aquí ahora obligaría a moverlos otra
   vez dentro de dos fases.
3. **No hay función de publicación.** Una versión nueva se inserta desde el SQL
   Editor. Cuando exista pantalla de operador, lo natural es una RPC
   `publicar_configuracion_expansion(...)` con `es_operador()` por delante; las
   comprobaciones ya están en disparadores, así que esa función no tendría que
   repetir ninguna. **No se ha escrito porque hoy no la llamaría nadie.**
4. **`publicada_por` de la primera versión es nulo**, porque el SQL Editor no
   tiene `auth.uid()`. La auditoría de esa fila vive en `aprobada_por` y en
   `motivo`, que sí son obligatorios.

### Deuda que hereda la Fase 4

- Los nombres de tipo de `disponibilidad_tipos` son los de la especificación
  (`hogar`, `amigos`, `equipo`, `hogar_compartido`) y los de la base son
  `families.tipo_gremio in ('familia','piso')`. **La traducción es la 4.3**, y
  hasta que exista nadie consulta esa matriz.
- `escalones_por_gremio` está puesto a 4, igual que el número de escalones: hoy
  **no acota nada**. `hito_expansion(k)` ya devuelve cero filas si `k` lo supera,
  así que el día que se quiera acotar basta con publicar otra versión.

### Choques posibles con la sesión paralela

- **La 049 la estaba escribiendo la otra sesión.** Esta es la 050 y no depende
  de aquélla.
- **`schema.sql`**: el bloque nuevo va **justo antes** del barrido final, que es
  el sitio donde todo el mundo añade. Si la 049 hizo lo mismo, habrá conflicto
  ahí y solo ahí: los dos bloques son independientes y se quedan los dos, en
  cualquier orden, antes del barrido.
- `tests/expansion.test.js` referencia el nombre del fichero de la migración. Si
  se renombra, ese test se cae en seco (y dirá por qué).

---

## 5 · Qué comprobar al aplicarlo

**Nada de esto se ha ejecutado contra ninguna base.** La migración está escrita
y probada como texto; no se ha tocado producción.

1. **`npm run respaldo` antes de nada.** No toca datos existentes —solo crea
   tablas, disparadores y funciones nuevas— pero la regla es la regla, y el
   barrido del final sí toca los permisos de todas las funciones `security
   definer` que existan.
2. **Ejecutar el fichero entero en el SQL Editor**, no con `supabase db query
   -f`: es multi-sentencia (§7bb del arranque).
3. **Correr la sección `COMPROBACIÓN` del final del fichero**, que trae los
   cinco bloques con sus resultados esperados:
   - 1 versión, 4 escalones, 4 filas de disponibilidad, vigente `2026-08-30.1`;
   - la escala devuelve 6/300, 8/750, 10/1875, 12/4690 y el límite es 5;
   - **los tres intentos de reescribir la historia fallan** (`update`, `delete`
     y añadir un quinto escalón a la versión de hoy);
   - **sin versión vigente, cero escalones y `tipo_publicado` en falso** — el
     ensayo va en un bloque que se deshace al final, como los de la 047 y la 048;
   - `anon_puede_llamar` sigue en **cero**.
4. **Comprobar que las trece funciones que llama el cliente conservan su
   `grant` a `authenticated`** después del barrido. El barrido solo retira
   PUBLIC y `anon`, así que no debería mover nada, pero es la comprobación que
   la 046 enseñó a hacer.
5. **`get_advisors`**: no debería aparecer ninguna alerta nueva. Las tres tablas
   llevan RLS encendido.
6. **Mirar la pantalla** no hace falta esta vez: `src/` no cambia. Si aun así se
   abre la app, nada debería ser distinto.
7. Cuando esto se aplique, **anotar la 050 en `ARRANQUE-SESION.md` y en el
   registro de progreso del plan** (Fase 3, pieza 3.1). Esta sesión no ha tocado
   `ARRANQUE-SESION.md`, `CHANGELOG.md` ni `package.json` a propósito.
