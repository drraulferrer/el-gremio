# Reconocimientos

**Estado: F1 EN PRODUCCIÓN desde la 2.19.0 (22-ago).** F2 y F3 sin
empezar. Las cuatro decisiones de §10 están cerradas.

De qué va: El Gremio sabe **recompensar** y apenas sabe **reconocer**.
Son cosas distintas y hoy la app solo tiene una de las dos montada de
verdad. Esto especifica la otra.

---

## 1. La distinción, que es todo el documento

Una **recompensa** es una transacción: haces algo, cobras algo. Talis,
tienda, premios. La app la tiene resuelta y con modelo de economía
detrás.

Un **reconocimiento** es un acto de atención: alguien ha visto lo que
hiciste y lo dice. No se cobra. Su valor está exactamente en que no se
cobra — el segundo en que un «gracias» paga cinco Talis deja de ser un
gracias y pasa a ser una misión más barata.

La evidencia que ya cita `docs/FUNDAMENTO-CIENTIFICO.md` va en esa
dirección y el proyecto la aplicó a medias: las recompensas son un
**andamio** con efecto pequeño (Brown et al., 2018) y el elogio
específico está entre los componentes de más efecto de los programas de
crianza (Leijten et al., 2019; Owen et al., 2012). La app montó el
andamio entero —tres niveles de premios, bandas de precio, temporadas— y
del elogio hizo un campo de texto en la pantalla de validación.

---

## 2. Qué reconoce la app hoy

| Pieza | Quién reconoce | A quién | ¿Se conserva? |
|---|---|---|---|
| Elogio al validar (`completions.praise`) | Adulto | Quien hizo la misión | Sí, pero disperso en el historial |
| Sellos y oficios (73) | El motor | Cualquiera | Sí, permanente |
| XP, niveles, rachas | El motor | Cualquiera | Sí |
| Meta cumplida → insignia 🏰 | Adulto (al cerrarla) | Todo el gremio | Sí |
| «Mano derecha» | El motor, al cerrar meta | Quien más aportó | Sí, hasta la meta siguiente |
| Talis a mano | Adulto | Quien elija | Como moneda, no como frase |

Léela por la columna de la izquierda y sale el diagnóstico solo:
**todo baja de arriba abajo o lo dicta el motor.** No hay una sola pieza
horizontal.

### Los tres agujeros

1. **Nadie puede reconocer a nadie, salvo el adulto que valida.** La
   junior no puede decirle nada a la peque. La peque no puede decirle
   nada a nadie. Y a los adultos —que son los que validan, cocinan y
   llevan la carga— **no los reconoce nunca nadie**: la app no tiene ni
   el gesto ni el sitio.

2. **Solo existe lo que se pidió.** Lo que está en el catálogo de
   misiones se reconoce; lo espontáneo, lo que a nadie se le ocurrió
   poner y la carga que no se ve, no existen para el sistema. Un gremio
   que solo mira su propia lista de encargos enseña que lo que no está en
   la lista no cuenta.

3. **El elogio se dice y se dispersa.** Se guarda —bien— pero vive
   colgado de cada completación: sale en la celebración, en «Conseguidas
   hoy» y en la semana en curso, y cuando la semana rueda, deja de estar
   a la vista. **Nadie puede leer de una vez todo lo bueno que le han
   dicho.** El dato ya está en la base; lo que falta es la pantalla.

### Y un detalle que conviene mirar de frente

En el catálogo de premios de arranque está esto:

```js
{ title: 'Elogio específico delante de la familia', emoji: '📣', cost: 325, tier: 1 }
```

**El reconocimiento está dentro de la tienda, con precio.** Son ocho o
nueve días de la junior para que alguien diga en voz alta algo bueno de
ella. Es coherente con una app que solo sabía cobrar, y es justo lo que
esta spec viene a deshacer.

Tercera ironía, esta pequeña: la biblioteca de tareas incluye la misión
**«Dar las gracias»** (`amabilidad`). La app pide a las niñas que den las
gracias y no tiene ningún sitio donde puedan darlas.

---

## 3. Decisiones cerradas

Estas no se negocian al implementar. Si una estorba, se discute aquí y se
cambia aquí, no en el código.

1. **Un reconocimiento no da Talis, no da XP y no cuesta Talis.** Ni al
   que lo da ni al que lo recibe. Pagar por reconocer lo convierte en
   trabajo y desplaza el motivo (es el mismo argumento por el que un
   sello no da ventaja, §13.1 de INSIGNIAS-01).
2. **Sin ranking, nunca, y sin contadores de recibidos.** No existe
   «quién recibe más» ni ningún número de reconocimientos recibidos en
   ninguna pantalla (ver §10.1, que lo afina). Se puede contar lo que **yo
   he dado** hoy —anima a dar, no compara a nadie, y hace falta para el
   tope—. Es la misma regla que ya prohíbe el ranking entre miembros.
3. **Específico o no es.** Un botón de 👏 suelto es el «muy bien»
   genérico que Owen et al. mide como gastado por repetición. **Todo
   reconocimiento nombra un hecho**, aunque el hecho lo elija de una
   lista.
4. **Escaso a propósito.** Tope diario por persona (arranque: **3**). Lo
   que se puede dar infinitas veces no vale nada, y sin tope la peque
   convierte el botón en un juego en tarde y media.
5. **La peque tiene que poder dar y recibir sin leer.** Si una pieza solo
   funciona escribiendo, no está terminada.
6. **Cero trabajo nuevo para quien valida.** El adulto ya valida y ya
   escribe elogios; esto no puede añadirle una segunda cola de tareas.
7. **Nada anónimo.** Esto es una casa. Quien dice algo, lo firma.
8. **Nada de esto genera aviso push.** Un móvil que vibra por cada
   «gracias» convierte el gesto en ruido y el ruido en que se apaguen los
   avisos, incluidos los que sí importan.

---

## 4. Las piezas

### P1 · El Muro (leer lo que ya se dijo)

**Qué:** una pantalla por persona con todo lo bueno que le han dicho, en
orden, sin caducar: los elogios de validación que ya están en
`completions.praise` y —cuando exista P2— los gracias recibidos.

**Por qué primero:** no necesita migración ni dato nuevo. El elogio ya se
escribe y ya se guarda; lo único que hace la app hoy es **dejar de
enseñarlo** cuando pasa la semana. Es la pieza de mejor relación entre
valor y coste de toda la spec.

**Dónde:** dentro de la ficha de cada persona (la que ya abre el avatar),
como una sección más junto a los sellos. En la de la peque, con su
formato: la cara de quien se lo dijo, grande, y la frase pequeña debajo
para el adulto que pase (§10.2 · la app no la lee en voz alta, la lee una
persona, que es mejor).

**Cómo se entera alguien de que hay algo nuevo**, sin avisos push: su
avatar late la próxima vez que entra (§10.1).

**Reglas:**
- Orden inverso, lo último arriba.
- Se ve **quién lo dijo** y **cuándo**. ⚠️ **Corregido al implementar:**
  `completions` no guarda quién validó, así que un elogio no se puede
  firmar. En la F1 se enseña con su encargo y su fecha. La firma llega
  con los gracias de la F2, que sí tienen remitente; si se quiere firmar
  también los elogios, `resolved_by` entra en la migración 034.
- La propia persona ve el suyo entero. El resto del gremio también: esto
  no es un diario privado, es memoria común.
- Sin contadores a la vista. Un número al lado convierte el muro en
  marcador y activa exactamente la comparación que la decisión 2 prohíbe.

### P2 · Gracias (reconocimiento entre iguales)

**Qué:** cualquier miembro reconoce a cualquier otro, en cualquier
dirección: junior → adulto, adulto → adulto, peque → quien sea.

**Cómo se compone**, en dos toques y sin folio en blanco:
1. A quién.
2. Por qué: una lista corta de hechos **sacados de lo que esa persona ha
   hecho estos días** (sus completaciones recientes, sus zonas, su
   oficio) más la opción de escribirlo. El folio en blanco es lo que hace
   que no se use; la misma lección que el elogio, donde *cada sugerencia
   ES el botón*.

**Para la peque:** las caras del gremio y una **estrella de gracias** de
otro color que la suya. Toca la cara y suelta la estrella. Sin texto.
Genera un reconocimiento de tipo `gesto`, sin frase, que en el muro del
destinatario se lee «⭐ Prueba3 te dio las gracias».

**Tope:** 3 al día por persona, sin acumular de un día para otro.

**Lo que NO hace:** no da Talis, no da XP, no sube rachas, no cuenta para
la meta, no despierta el móvil de nadie.

### P3 · Lo que nadie pidió

**Qué:** reconocer algo que **no era una misión**. Un campo de texto y
listo, con el mismo tope y las mismas reglas.

**Por qué separado de P2:** porque la frase es distinta. P2 es «gracias
por X». Esto es «nadie te lo pidió y lo hiciste», que es el único sitio
donde la app puede ver la carga invisible —la que se lleva quien piensa
las cosas antes de que existan—.

**Nota de diseño:** ya existe `premioAMano` para dar Talis fuera del
sistema. Son cosas distintas y **no deben fusionarse**: una paga, la otra
nombra. Pueden ofrecerse juntas en la misma pantalla del panel, con la
frase primero y el Talis como opción, nunca al revés.

### P4 · Retrato (identidad, sin dato nuevo)

**Qué:** una frase derivada, en la ficha: «Esta semana el gremio te ha
visto sobre todo en **Hogar** y **Amabilidad**», compuesta de las
completaciones validadas y de los gracias recibidos.

**Por qué:** los sellos ya dan identidad a largo plazo (73 piezas, cuatro
grados por oficio). Falta el corto plazo: quién has sido esta semana. Se
calcula, no se guarda.

### P5 · Sacar el elogio de la tienda

Retirar «Elogio específico delante de la familia» del catálogo de
arranque y de `PREMIOS_DE_ARRANQUE`. Sustituirlo, si hace falta llenar el
hueco de precio, por un premio que sí sea un premio.

**Coste real de quitarlo: ninguno, comprobado.** En la base de producción
no hay **ni una fila** en `rewards` cuyo título mencione el elogio: está
en el catálogo que se ofrece, pero ningún gremio llegó a crearlo. Sale
del catálogo y no hay nada que migrar.

Aun así, la spec **no borra filas de `rewards`** por si algún gremio
futuro lo hubiera creado: se retira del catálogo y, si aparece creado, el
panel sugiere pausarlo. Que un premio desaparezca de la tienda de alguien
sin avisar es peor que la incoherencia que arregla.

---

## 5. Modelo de datos

Una tabla nueva. Migración **034**, con la convención de siempre: escrita
dos veces (`schema.sql` + `migracion-034-reconocimientos.sql`),
idempotente, RLS por gremio, `grant` explícito de `anon` y tope de filas.

```sql
create table if not exists public.reconocimientos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  de_profile uuid references public.profiles(id) on delete set null,
  a_profile  uuid not null references public.profiles(id) on delete cascade,
  tipo text not null default 'gracias'
    check (tipo in ('gracias','espontaneo','gesto')),
  -- 'gesto' es el de la peque: sin texto, por eso el check admite vacío
  -- solo en ese caso.
  texto text check (texto is null or length(btrim(texto)) between 3 and 240),
  -- De qué hecho cuelga, si cuelga de alguno. Nulo en lo espontáneo.
  completion_id uuid references public.completions(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint reconocimiento_con_forma check (
    (tipo = 'gesto' and texto is null) or (tipo <> 'gesto' and texto is not null)
  ),
  -- Nadie se reconoce a sí mismo. Es la primera cosa que alguien probará.
  constraint reconocimiento_no_a_uno_mismo check (de_profile is distinct from a_profile)
);

create index if not exists idx_reconocimientos_para
  on public.reconocimientos (family_id, a_profile, created_at desc);
```

**El tope diario va en la base, no en la interfaz.** Un tope que solo
vive en el cliente lo salta cualquiera que recargue: trigger `before
insert` que cuenta los de `de_profile` en el día del gremio (su
`timezone`, como el resto) y rechaza con un error propio, igual que
`tg_tope_filas` y `limite_de_ritmo`.

**Nada de esto viaja a `app_logs` con texto.** Se registra el evento
(`reconocimiento.dado`, con tipo y si llevaba frase), nunca el contenido;
misma regla que ya cumple el buzón de fallos.

---

## 6. Lo que NO entra, y por qué

- **Ranking de reconocimientos.** Decisión 2.
- **Puntos, Talis o XP por dar o recibir.** Decisión 1. Además haría que
  la gente reconociera para cobrar, que es la forma más rápida de vaciar
  de sentido la palabra.
- **Rachas de reconocimiento** («llevas 5 días dando las gracias»).
  Gamificar el gracias lo mata: pasa a ser una casilla diaria.
- **Emojis sueltos como reacción.** Decisión 3.
- **Anónimo.** Decisión 7.
- **Push por cada reconocimiento.** Decisión 8.
- **Reconocimiento del sistema al usuario** («¡Bien hecho!» automático).
  Eso ya lo hacen los sellos, y ahí sí tiene sentido porque acredita una
  regla. Una frase cálida generada por la app no es que alguien te haya
  visto: es una animación.

---

## 7. Fases

| Fase | Qué | Migración | Por qué en este orden |
|---|---|---|---|
| ~~**F1**~~ | ~~P1 · El Muro~~ · **HECHA** (2.19.0) | **No** | Valor inmediato con datos que ya existen. Si el muro se lee, el resto tiene sentido; si no se lee, hay que replantear antes de escribir una tabla |
| **F2** | P2 · Gracias (con la variante de la peque). **En modo piso, también P3** (§10.4) | 034 | El corazón de la spec |
| **F3** | P3 · Lo espontáneo + P4 · Retrato + P5 · Sacar el elogio de la tienda | No | Pulido y coherencia |

F1 es deliberadamente una **prueba barata de la hipótesis** entera: que
en esta casa el reconocimiento se lee y se echa de menos. Cuesta una
pantalla y no compromete el esquema.

---

## 8. Criterios de aceptación

Medibles con lo que ya hay (`app_logs`, `reconocimientos`,
`completions`), sin analítica de terceros:

1. **F1**: la ficha de cada persona muestra sus elogios recibidos desde
   siempre, no solo los de la semana en curso. Verificado en la peque con
   lectura en voz alta.
2. **F2**: existe al menos un reconocimiento **de una persona que no es
   adulto** en la primera semana. Es *el* indicador: si solo reconocen
   los adultos, se ha construido otro canal de arriba abajo.
3. **F2**: al menos un reconocimiento **dirigido a un adulto**. Si esto no
   pasa, la pieza no ha cambiado nada de lo que se propuso cambiar.
4. **Invariante, con test**: ningún reconocimiento modifica `xp`, `coins`
   ni el progreso de la meta. Se comprueba en el modelo, no de palabra.
5. **Invariante, con test**: el tope diario lo impone la base. Se prueba
   intentando el cuarto del día contra Postgres.
6. **No regresión**: el porcentaje de validaciones con elogio
   (`historial.conElogio`) no baja tras F2. Si baja, los gracias están
   canibalizando el elogio en vez de sumarse, y hay que revisar.

---

## 9. Riesgos

- **Inflación.** Se combate con el tope (decisión 4) y con que sea
  específico (decisión 3). Es el riesgo más probable.
- **Performatividad** («dame las gracias por esto»). No se puede impedir
  con código. Se mitiga sin contadores públicos: si no hay marcador que
  subir, pedirlo no lleva a ninguna parte.
- **El adulto acaparando.** Si de veinte reconocimientos diecinueve los
  da el mismo adulto, esto es el elogio de siempre con otro nombre. El
  criterio 2 existe para detectarlo pronto.
- **Que la peque lo use como juego.** Lo va a hacer, y en parte está
  bien. El tope de 3 lo acota. Si el gesto pierde sentido, se le sube el
  precio en atención (una animación más larga), nunca en Talis.
- **Que nadie lo use.** El escenario más probable de todos. Por eso F1 va
  primero y es barata: enseñar lo que ya se dijo cuesta una pantalla, y
  si eso no engancha, escribir la tabla 034 habría sido trabajo tirado.

---

## 10. Las cuatro decisiones

Estaban abiertas y las cierra el autor de la spec a petición del autor
del proyecto (22-ago). **Ninguna ata la F1**: si alguna se quiere del
revés, se cambia aquí antes de tocar código de la F2.

### 10.1 · Los gracias los ve todo el gremio, pero no hay contadores

**Decisión: públicos.** Un reconocimiento privado protege de la
comparación y a cambio pierde lo único que hace que estas cosas arraiguen
en una casa: que se vea que aquí esto se hace. Los niños aprenden lo que
ven hacer, no lo que reciben en un sobre cerrado. Y el Muro (P1) ya se
definió como memoria común y no como diario.

**El riesgo real no es la visibilidad: son los totales.** Ver «Ana le dio
las gracias a papá por acordarse de la mochila» es memoria. Ver «Ana 7 ·
papá 2» es un marcador, y activa exactamente la comparación que prohíbe
la decisión 2.

De modo que se afina la decisión 2 con una regla operativa:

> **En ningún sitio de la app aparece un número de reconocimientos
> recibidos.** Ni en la ficha, ni en el selector, ni en el Cuadro del
> panel, ni sumado por semana. El único contador que puede existir es el
> de los que YO he dado hoy, y existe solo porque hace falta para el tope.

**Cómo se entera alguien de que le han dicho algo**, ya que no hay avisos
push (decisión 8): su avatar **late** la próxima vez que entra, igual que
late hoy la ficha cuando hay algo que no ha visto. Se reutiliza la
animación de `latido.js`, no su lógica —aquella cuenta aperturas para
enseñar dónde está la ficha; esta mira si hay algo posterior a su última
visita al Muro—.

### 10.2 · La peque recibe reconocimientos con texto, pero para ella el mensaje no es el texto

**Decisión: los recibe, y la app NO se los lee en voz alta.**

Su pantalla ya tiene resuelta esta pregunta desde el primer día, y la
respuesta está escrita en la cabecera de `KidHome.jsx`: *«No sabe leer:
manda el dibujo. El texto está para el adulto que pasa»*. Un
reconocimiento para ella es **la cara de quien se lo manda** y una pieza
que se queda; la frase va debajo, pequeña, para quien pase por allí y se
la lea. Que se la lea una persona es mejor que cualquier síntesis de voz:
el reconocimiento leído por el padre EN VOZ ALTA es, de hecho, la versión
buena de esto.

**Descartado el `speechSynthesis`** del navegador: mete una dependencia
de voces, permisos y calidad que varía por aparato, para resolver algo
que ya resuelve la persona que está al lado. Si algún día se quiere voz,
su sitio es el botón de sonido que ya existe en su cabecera, y es otra
conversación.

### 10.3 · No se reconoce dos veces el mismo hecho (y quién validó da igual)

La pregunta era si un adulto puede reconocer una misión que él mismo
validó. **La pregunta estaba mal planteada, y por eso no tenía respuesta
buena: lo que importa no es quién validó, sino si ese hecho YA tiene
palabras.**

**Decisión:** la lista de hechos que propone el flujo de gracias (P2)
**no ofrece completaciones que ya lleven elogio** (`praise is not null`).
Da igual quién lo escribiera. Y no se bloquea nada más: el gracias libre
y lo espontáneo (P3) siguen abiertos hacia esa misma persona, porque son
un acto distinto y no el mismo repetido.

Ventaja lateral que decide el empate: **no hace falta migración.**
`completions` guarda `resolved_at` y `praise`, pero **no guarda quién
resolvió** —comprobado en `schema.sql`—, así que la regla por autor
habría exigido una columna nueva y un relleno inventado para las filas
viejas. La regla por «ya tiene palabras» se puede aplicar hoy con lo que
hay, y además es la regla correcta.

### 10.4 · El modo piso lo hereda entero, y ahí P3 sube de fase

**Decisión: sí, entero. Y en piso, «lo que nadie pidió» (P3) entra en la
F2, no en la F3.**

El motivo no es de producto, es estructural: en una familia el
reconocimiento vertical ya existe y funciona —el adulto valida y elogia—,
así que los gracias entre iguales llegan a una casa donde ya se reconoce
algo. **En un piso compartido no hay nadie por encima**: todos son
adultos, nadie valida a nadie, y ese canal vertical sencillamente no
existe. Si en piso solo se monta P2, se monta la mitad de un sistema
sobre un vacío.

Y lo que se reparte mal en un piso no son las tareas del catálogo: es lo
que nadie apuntó. Reponer el papel, darse cuenta de que faltaba leche,
llamar al fontanero. **P3 es ahí la pieza principal**, y su frase —«nadie
te lo pidió y lo hiciste»— está escrita para ese caso.

Consecuencia práctica para quien implemente: la F2 tiene dos alcances
según `families.tipo_gremio`, y el de piso incluye P3.

## 11. De dónde sale esto

- `docs/FUNDAMENTO-CIENTIFICO.md` — Brown et al. (2018) sobre el efecto
  pequeño de las recompensas; Owen et al. (2012) y Leijten et al. (2019)
  sobre el elogio específico.
- `src/lib/elogio.js` — la pieza que ya hace bien el reconocimiento
  vertical, y de la que P2 copia el patrón de «cada sugerencia ES el
  botón».
- `SPEC.md` §5 (insignias) y el catálogo de sellos — el reconocimiento
  automático que ya existe y que esta spec **no toca**.
- `ARRANQUE-SESION.md` §7z — el buzón de fallos, del que se copia la
  convención de no registrar nunca el contenido escrito por nadie.
