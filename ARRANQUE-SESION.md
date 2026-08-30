# Arranque de sesión · El Gremio

Documento de continuidad. Si abres una sesión nueva sobre este proyecto,
lee esto primero: dice dónde está todo, qué está hecho, qué falta y qué
trampas tiene.

> **Y si solo vas a leer una línea antes de ponerte:** la **2.38.0 está EN
> PRODUCCIÓN** y **la Fase 6 está cerrada**. Una persona puede tener varios
> gremios de punta a punta: forjar, gastar la llave, invitar, entrar, recibir
> avisos de todos y salir. Lo siguiente en el plan es la **Fase 7**
> (reclamación y credenciales).
>
> **Y lo primero de todo, que sigue sin hacerse:** mirar todo esto con una
> sesión real. Es lo único que no se puede comprobar desde aquí.

Última actualización: **30 de agosto de 2026**, al cierre de la
sesión de **recuperación ante desastres y terreno firme** (§7bb): migraciones
**041, 042 y 043 ejecutadas** y **2.33.3 publicada y comprobada**. Esa sesión
descubrió que **la restauración de un respaldo nunca había funcionado** y
arregló seis defectos del camino de vuelta; empieza por ahí si vas a tocar
respaldos o el esquema. La sesión anterior fue la de **limpieza de código**
(§7ba): sin cambio de
comportamiento, en una rama a la espera de revisión. La sesión del
19-ago construyó el **modo limpieza** (§7x): campañas de limpieza como
misión secundaria, con reloj por tarea y botín de cierre. Ese mismo día,
en sesiones anteriores, llegaron los sellos de oficio (§7u), su motor
(§7v) y las migraciones 028-030 (§7w).

Si solo vas a leer un párrafo: la app está **en producción y estable**, en
elgremioapp.com, servida por **Vercel**, con las cabeceras de seguridad
que antes no se podían poner y con un cron diario que impide que Supabase
se pause. **Las migraciones 028-031 se ejecutaron el 19-ago por la
tarde** (métodos y comprobaciones en §7w-§7x) y el bundle 2.9.0 está
publicado: las piezas van a la vez otra vez. El modo limpieza (§7x) está
VIVO de punta a punta. Antes de añadir nada, lee §8.

**Y lo primero que hay que saber:** publicar no es `npm run deploy`. Es
empujar y después `npm run vercel` (§7n), y SIEMPRE con la migración
ejecutada antes que el bundle.

**Lo segundo, al 21-ago:** la migración **033 está EJECUTADA y la 2.14.0
publicada** (§7z, el buzón de fallos), en ese orden. Desde ahora hay un
sitio nuevo que mirar cada pocos días: la tabla `informes_fallo`, que es
donde la familia cuenta lo que va mal (RUNBOOK §3b).

**Lo tercero, al 24-ago:** la **2.22.0** (§7aj) trae la gramática de
respuesta de Duolingo —los números suben en vez de saltar, la celebración
en tres escalones, la llama que solo se mueve el día que hay algo que
hacer y el háptico—. **Sin migración: solo bundle.** Y una nota que
ahorra media hora: sembrar `completions` en la demo con `approved_at` /
`status:'approved'` revienta la app entera; los campos buenos son
`requested_at` / `resolved_at` y el estado es `'aprobado'`.

**Y lo que hay que hacer al abrir sesión, si nadie lo ha hecho ya:** la
2.22.0 está **mezclada en `main` y sin publicar**, y con ella viajan las
copias cifradas del 23-ago, que tampoco se publicaron nunca. Producción
sigue en `754fcd2`. Una sola orden, sin migración de por medio:
`npm run vercel && npm run health` (el detalle, al final de §7aj).

**Y lo último, al 29-ago: la 2.33.2 está EN PRODUCCIÓN.** La limpieza
(§7ba) se revisó y se mezcló el 27. El intento de publicarla ese día con
`npm run vercel` desde el portátil **no llegó a Vercel** —no consta
ningún despliegue posterior al del 26, ni siquiera uno fallido; la causa
no se llegó a ver—, así que el 29 se publicó desde la sesión remota con
el truco de la bandera: dos commits seguidos que abren y cierran
`git.deploymentEnabled.main` en `vercel.json` (el porqué y las
precauciones, al final de §7ba). Comprobado desde fuera:
`version.json` del dominio responde **2.33.2 · `748701d`**, y la bandera
quedó otra vez en `false`, o sea que publicar sigue siendo un acto
deliberado (§7n). El «sin subir» de §7az también quedó resuelto: las
2.33.0 y 2.33.1 sí se habían publicado el 26.

**Si abres sesión nueva, empieza por §8.** Los **803 tests y el CI están
en verde** (el CI estuvo roto unas horas por un test que parcheaba el
cliente nulo; arreglado en `ed0a311` con inyección). Producción sirve la
**2.9.0**. Lo que queda es de uso, no código a medias.

---

## 1. Qué es

Webapp de misiones familiares con XP, niveles, monedas, premios reales,
insignias y una meta cooperativa, para una familia de cuatro (dos adultos,
una junior de 11 años y una peque de 3). La peque tiene **pantalla propia**
adaptada a su edad. Sin ranking entre miembros: la única comparación es la
meta compartida.

Nació de un prototipo que llegó en `~/Downloads/files.zip` el 15-ago-2026
(Vite + React + Supabase, 2.371 líneas) y se amplió ese mismo día con el
modo peque, la capa de producción y la gestión de miembros.

---

## 2. Estado: en producción

| Cosa | Dónde |
|---|---|
| Web | https://elgremioapp.com/ (la dirección vieja redirige sola) |
| Exposición pública | https://elgremioapp.com/narrativa/ |
| Quién sirve el sitio | **Vercel** (proyecto `el-gremio`), desde el 18-ago · §7n |
| DNS y correo | Hostinger. `A @` a las IPs de Vercel, `www` por CNAME a Vercel con 308 al ápice; MX y DKIM sin tocar |
| Repo (público) | https://github.com/drraulferrer/el-gremio |
| Código local | `~/el-gremio` |
| Supabase | proyecto `chfbrawsoulfiywiqhpe`, Postgres 17.6, región EU |
| Edge Function | `notificar`, versión 5, `verify_jwt` en false |
| Versión publicada | ver `npm run health` (lee `version.json`, que ahora se emite en el build) |
| Tests | 1.138, en 64 ficheros, todos en verde (27-ago). `npm run verify` empieza por `npm run lint` desde la 2.27.0 |

### Por dónde seguir

**Mirar todo esto con una sesión real.** Es lo único de la lista de `CLAUDE.md`
que lleva días sin hacerse, y ahora hay bastante que mirar: el botón de
Expandirse en Progreso, la bandeja de invitaciones en el selector, «Gente de
fuera» en Miembros y «Dejar este gremio» en Datos. Todo lo demás está
comprobado contra la base o contra la demo, pero el agente no introduce
contraseñas y el modo demo no toca RLS.

Lo que hay que verificar, en orden de lo que más costaría descubrir tarde:

1. Que la familia **no nota nada raro**: un solo gremio, sin selector, con su
   personaje ya elegido al entrar.
2. Que **crear una identidad funciona de punta a punta** — es lo único de toda
   la tanda que no se ha podido probar contra la base, porque necesita un
   correo de verdad y una vuelta desde el enlace.
3. Y a partir de ahí ya se puede forjar, crear un segundo gremio y ver el
   selector con dos.

Después, la **Fase 7 · reclamación y credenciales**: dar credencial compartida
a un gremio nacido con llave (hoy nacen sin ella, §7bo) y reclamar un perfil
con una identidad que ya existe.

Y dos cosas que no son de ninguna fase y siguen abiertas:

- **El catálogo del gremio nuevo.** Nace desnudo: sin misiones, sin premios,
  sin zonas y sin meta. Es `D-14`, y para Hogar vive hoy en `src/lib/setup.js`,
  o sea en el cliente. Moverlo es una pieza propia.
- **Los límites por tipo** (`R-74`: ocho humanos, mascotas solo en Hogar).
  Viven en el cliente y su sitio es `plantillas_tipo.limites`, que sigue vacío
  desde la 053. `invitar()` ya lee ese `jsonb` y no limita si está vacío.

## Lo que sigue abierto, y no es de ninguna fase

1. **Mirar la app con una sesión real.** Es lo único de las cuatro
   comprobaciones de `CLAUDE.md` que lleva todo el día sin hacerse: el agente no
   introduce contraseñas y el modo demo no toca RLS. Lo visible de hoy es el
   «te faltan N Talis» de la tienda.
2. ~~**Supabase Auth**~~ **cerrado el 30-ago.** Las Redirect URLs estaban dadas
   de alta (y se añadió `localhost:5177`, que faltaba), y la plantilla de
   confirmación se reescribió para que valga tanto al fundar un gremio como al
   crearse una identidad personal. Ver §7bq.
3. **El `truncate` para `authenticated`**, abierto desde la Fase 0.
4. **`zona_de_perfil`** es una función huérfana desde la 018: no la llama nadie.
5. **`CAP-12` vs `saldos_visibles()`**: hoy la casa ve el saldo de sus
   personajes, que es lo que sostiene `CNV-7`. En la **Fase 6**, cuando un
   gremio pueda tener personas que no viven juntas, **hay que volver ahí**.
6. **El PIN se comprueba en el cliente.** La matriz de capacidades ya dice
   cuándo hace falta; verificarlo en servidor es otra tanda.

## Tres trampas de hoy, para no repetirlas

- **`pg_proc.prosrc` guarda los comentarios.** Dos copias del esquema que solo
  difieren en un acento producen objetos distintos en la base, y comparar
  `md5(prosrc)` con el fichero —que es como se cazó que dos funciones llevaban
  semanas desviadas— deja de servir. **Dentro de `$fn$ … $fn$` mandan los
  ficheros `.sql` nuevos, sin acentos, y `schema.sql` copia ese cuerpo tal
  cual.**
- **Una migración registra lo que hizo ese día, no la versión vigente.** Cuando
  una posterior reescribe una función, la comparación «dos copias» se hace
  contra la última que la tocó. Editar una migración ya aplicada es lo que no se
  hace.
- **Los ensayos contra la base encontraron tres fallos que ningún test de los
  que leen el fichero habría visto**: un `CHECK` que impedía borrarse, una
  transferencia que solo anotaba una de sus dos patas, y un choque de clave de
  idempotencia. El patrón —un bloque que termina en `raise exception 'ENSAYO…'`
  y lo deshace todo— es lo más rentable de esta sesión.
