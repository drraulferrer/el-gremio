# La competencia, y qué se le roba

Repaso de Habitica, OurHome y Sweepy con una pregunta concreta: **qué
mecánica de las suyas resuelve un problema que El Gremio tiene abierto**, y
—la pregunta incómoda— **cuál es el valor diferencial el día que esto deje
de ser la app de una casa**.

Escrito el 15 de agosto de 2026. La comparativa que ya vive en
`public/narrativa/index.html` mira el mercado desde el producto; esta la
mira desde el mecanismo. Se solapan a propósito en un punto: la tabla
pública necesita un arreglo, y está al final (§6).

---

## 1. El punto de partida: el diferencial de hoy no aguanta

La última celda de la tabla pública dice, literalmente, que El Gremio se
separa del resto porque «no hay tienda de aplicaciones ni suscripción: es
una casa concreta, cuatro personas y cuatro dispositivos».

Eso no es un valor diferencial, es una **descripción del despliegue**. Y
tiene tres problemas:

1. **No es defendible.** Cualquiera puede desplegar su propia instancia de
   Habitica; es código abierto desde antes que esto.
2. **No es transferible.** Si mañana lo usan treinta familias, la frase se
   vuelve falsa y con ella se cae el argumento entero.
3. **No dice nada del producto.** Una persona que compara apps no está
   eligiendo arquitectura de despliegue.

Lo que sí aguanta, y no depende de que la familia sea esta, son tres cosas
que **ya están construidas** y que hoy no se anuncian como el eje:

| Reclamo | Por qué es defendible | Quién más lo tiene |
|---|---|---|
| **El objetivo declarado es volverse innecesaria** | Habilidades en vez de tareas, elogio específico como control primario y un andamio de Talis diseñado para retirarse. Está en el tutorial, en `docs/FUNDAMENTO-CIENTIFICO.md` y en la economía. | Nadie. El modelo de negocio de los demás exige lo contrario: Greenlight cobra por la tarjeta, BusyKid por la paga, Habitica por la suscripción de grupo. Ninguno puede prometer que sobras. |
| **De 3 años a adulto, en la misma casa, con una interfaz por edad** | `KidHome` sin una sola cifra, `FichaPeque`, tarro de estrellas, salida por pulsación mantenida — y a la vez tablero de adultos con temporadas y rachas. | Habitica pide entender un RPG. BusyKid y Greenlight empiezan a los 6-8 y son productos financieros. Sweepy es de adultos. El rango 3–adulto está vacío. |
| **Es tuya y es portátil** | Repo público, tu propia base de datos, sin dinero real, sin datos de menores en un servidor de un tercero que puede cerrar. | Habitica es abierto pero es un servicio central. Los demás son SaaS puro. Y el sector tiene un cadáver reciente que hace este argumento vendible (§3). |

Y una cuarta que no es posicionamiento sino **el momento de la demo**: al
validar, *cada sugerencia de elogio ES el botón*. En las otras tres apps
la validación existe para autorizar un pago (Homey), para controlar la
calidad del trabajo (Sweepy) o no existe (Habitica). Aquí es la
intervención. Es lo primero que hay que enseñar y hoy está enterrado en el
panel.

---

## 2. Habitica

RPG completo: personaje con vida, oro y equipo; tareas divididas en
hábitos, diarias y pendientes; grupo («party») que emprende misiones
contra un jefe. Plan de grupo de pago, 9 $ al mes más 3 $ por miembro
adicional.

### Lo que hace bien y aquí falta

**Rest in the Inn.** La posada: mientras estás dentro, las diarias no
cumplidas no te quitan vida, no rompen la racha y no dañan al grupo. Es
una funcionalidad de primera clase, no un ajuste escondido.

**Challenges.** Listas de tareas empaquetadas que cualquiera crea y
cualquiera importa a su cuenta de un toque, con un premio al terminar.
Resuelven el arranque en frío: llegas y ya tienes qué hacer, escrito por
alguien que no eres tú.

**La misión con jefe.** El progreso del grupo no es una barra: es un
relato con capítulos, y el daño al jefe lo hace el trabajo de cada uno.
La diferencia con una barra es que **pasa algo por el camino**.

### Lo que hace mal, y es la lección más cara del sector

Su mecánica más criticada es el **daño por fallar**: vuelves de una semana
mala, tienes doce diarias sin marcar, el personaje pierde vida, puede
morir y perder nivel, oro y equipo. Las reseñas repiten la misma frase con
distintas palabras: la app recrea la sensación de agobio de la que venías
huyendo. Se suma la curva de entrada: gente que dedica más tiempo a
entender el sistema que a usarlo.

**El Gremio no tiene daño, y eso es una ventaja que hoy no se defiende:**
no hay castigo, pero sí hay racha, y una racha rota es un castigo con otro
nombre. Ahí es donde entra la posada (§5, mecánica B).

---

## 3. OurHome

Tablero familiar clásico: tareas con puntos, premios, **lista de la compra
compartida** y **calendario familiar** con avisos. Fue la referencia
gratuita del sector durante años. Dejó de actualizarse en 2020 y
desapareció de Google Play en septiembre de 2023; hay usuarios que
describen no poder ni entrar a recuperar años de datos.

Dos lecturas, y las dos importan.

**La operativa:** OurHome enganchaba a los adultos porque no era una app
de tareas de niños, era **la superficie operativa de la casa**. Un adulto
abría OurHome porque necesitaba la lista de la compra. Ya que estaba,
validaba. El Gremio hoy le da al adulto exactamente **una** razón para
abrir la app: validar. Si ese toque no ocurre, la niña no ve su estrella y
el bucle entero se para. Ese es el punto de rotura real del producto, más
que el decaimiento de la semana 3.

**La estratégica:** murió por sostenibilidad, no por diseño. Sin ingresos
no hubo desarrollo, se acumularon los fallos y se apagó el servidor con
los datos dentro. Esto convierte el tercer reclamo de §1 en algo que se
puede decir en voz alta y que ninguna alternativa comercial puede
responder:

> El día que este proyecto se abandone, tu gremio sigue funcionando en tu
> base de datos y el código sigue siendo tuyo. Lo que le pasó a OurHome
> aquí no te puede pasar.

Eso hay que escribirlo en la exposición pública, no dejarlo implícito en
que el repo sea público.

---

## 4. Sweepy

Limpieza doméstica entre adultos y convivientes. Tres mecánicas propias:

**Nivel de suciedad por zona.** No hay «toca los martes»: cada zona se va
ensuciando con el tiempo desde la última vez, y el indicador te dice qué
está peor. La urgencia **se genera sola**, y con ella la rotación.

**Puntos por esfuerzo (1–3) y reparto de carga.** Cada tarea pesa según lo
que cuesta, y el reparto entre convivientes se equilibra con ese peso:
nadie se lleva tres días duros seguidos mientras otro riega una planta.

**Agenda por presupuesto de esfuerzo** (de pago). Dices cuánto puedes hoy
y te genera la lista que cabe en eso.

Y dos cosas de las que la tabla pública de El Gremio no se ha enterado:
Sweepy anuncia hoy **aprobación parental de las tareas de los niños** y un
**marcador familiar**. Es decir, ya no es solo «reparto entre adultos»: se
ha metido en el terreno de al lado.

### Lo que no se le copia

El marcador y la competición semanal entre miembros. Está descartado por
escrito y con motivo. Pero ojo con el matiz: **lo descartado es la
comparación entre hermanas**, no la comparación entre adultos. El reparto
de la carga doméstica entre dos personas adultas no es una clasificación
infantil, es la conversación de la carga mental, y es justo el terreno
donde a El Gremio le falta producto y le sobra dato: el Cuadro ya calcula
casi todo lo que hace falta.

---

## 5. Las mecánicas, por orden de lo que rinde

Cada una dice de dónde viene, qué problema abierto cierra y dónde
aterrizaría en el código.

### A · Hitos dentro de la meta del gremio — *de Habitica (misión con jefe)*

**Problema que cierra:** el riesgo número uno del producto (decaimiento de
la semana 3-4) y una consecuencia directa del reequilibrio de la economía:
la meta pasó a caer **cada 60 días**. Son dos meses de barra subiendo
despacio sin que ocurra nada. Una barra sin acontecimientos es exactamente
donde se abandona.

**Qué es:** 25 %, 50 % y 75 % dejan de ser puntos mudos. Al cruzarlos pasa
algo pequeño y visible para todos: un aviso en el estandarte, una línea de
relato, un uso extra de comodín para el gremio. Sin premio grande —eso
rompe la previsibilidad, que es uno de los siete principios— pero con
acontecimiento.

**Dónde:** `temporadas.js` ya conoce el estado de la meta; el estandarte de
`Home.jsx` ya la pinta. No hace falta esquema nuevo si los hitos se
derivan del porcentaje.

**Coste:** bajo. **Es lo primero que haría.**

### B · Modo pausa — *de Habitica (Rest in the Inn)*

**Problema que cierra:** las vacaciones, la gripe y la semana mala. Hoy la
racha se rompe, el Cuadro pinta una semana en blanco y el camino de rachas
—que se paga una vez en la vida— se vuelve inalcanzable justo cuando la
persona vuelve. Y cubre el punto 9 del backlog (ajuste estacional) por la
vía barata.

**Qué es:** pausa por gremio o por persona, con fecha de vuelta y muy
visible mientras dura. Durante la pausa: la racha no se rompe, las
misiones no cuentan como fallidas, la peque sigue teniendo su estrella
diaria si quiere.

**Cuidado:** que la pausa **no** repare el pasado ni cobre hitos. Pausa
hacia delante, nunca hacia atrás, o se convierte en el botón de hacer
trampa.

**Dónde:** una columna de estado en `families`/`profiles` y una condición
en `rachaMaxima` (`meritos.js`) y en `claim_streak` (Postgres). Las dos, o
el cliente y el servidor dirán cosas distintas.

**Coste:** bajo-medio.

### C · Packs de misiones importables y exportables — *de Habitica (Challenges)*

**Problema que cierra:** el más gordo de la expansión. Hoy el catálogo son
las tareas que escribió esta familia; una casa nueva llega a una app que
sabe de la vida de otra gente. Además cubre el punto 3 del backlog
(rotación mensual) y da un **canal de distribución que no pasa por una
tienda de aplicaciones**: un pack es un enlace.

**Qué es:** un pack es un JSON con nombre, para qué es («autonomía a los 4
años», «primera vez que ordena su cuarto», «adolescente que cocina»),
misiones con habilidad y frecuencia, y valores sugeridos. Se importa desde
el panel y se puede exportar el propio —**anonimizado**, que el repo es
público y aquí no entran nombres—.

**Por qué encaja sin pelea:** `tareas.js` ya está desacoplado de la
economía (el catálogo no lleva puntos; nacen al activar con
`DEFAULTS_ROL`). Un pack es exactamente esa estructura, servida desde
fuera.

**Cuidado:** al importar, pasar el resultado por el diagnóstico de
economía. Veinte misiones importadas de golpe disparan las cadencias
aunque cada precio sea correcto, y eso ya está medido.

**Coste:** medio. **Es lo que desbloquea todo lo demás.**

### D · Resumen semanal, con el reparto de la carga dentro — *de Sweepy (equilibrio) + backlog nº 2*

**Problema que cierra:** le da al adulto una segunda razón para abrir la
app —hoy solo tiene una— y convierte el Cuadro, que hay que ir a buscar
detrás del PIN, en algo que llega solo. Y aborda el mercado de al lado, el
de la carga mental entre adultos, que es donde El Gremio tiene datos y no
tiene producto.

**Qué es:** el domingo, una pantalla corta: qué hizo el gremio, qué
habilidad se movió y cuál no, qué porcentaje de la carga llevó cada
adulto, y una sugerencia de rotación para la semana que entra.

**Cuidado, y no es menor:** el porcentaje por persona **solo entre
adultos, solo detrás del PIN**. Entre hermanas es un ranking, y no hay
ranking. La regla ya está tomada en el Cuadro (una barra con segmentos, y
las fichas ordenadas por rol y nunca por aportación); el resumen la hereda
tal cual.

**Dónde:** `resumen.js` y `Cuadro.jsx` ya calculan casi todo.

**Coste:** medio.

### E · Aviso de validación pendiente — *las tres apps lo tienen; backlog nº 5*

**Problema que cierra:** el bucle depende de que un adulto abra la app. Si
la estrella tarda dos días, el elogio específico —que es el mecanismo
central— llega tarde, y la literatura de la que sale dice que el elogio
funciona **si es inmediato**. O sea que el fallo no es de comodidad: es de
mecanismo.

**Qué es, por orden de coste:** primero, un aviso local en el dispositivo
del adulto con la app instalada como PWA. Después, y solo si hace falta,
push real, que exige service worker, VAPID y una Edge Function.

**Coste:** medio. **Prioridad alta pese al coste**, porque toca el
mecanismo, no la comodidad.

### F · Decaimiento por tiempo sin hacerse, y presupuesto de esfuerzo — *de Sweepy*

**Problema que cierra:** la rotación manual y la lista fija que se vuelve
invisible a las tres semanas.

**Qué es:** una misión no es solo «toca hoy o no toca»; acumula urgencia
según lo que lleve sin hacerse, y el tablero se ordena por eso. Encima, un
selector de «hoy tengo poco / lo normal / hoy puedo» que recorta el
tablero a lo que cabe.

**Dos condiciones:**
- **Solo adultos y junior.** A los tres años el hábito se construye por
  repetición en un contexto estable; una rejilla que cambia de orden cada
  día rompe justo eso.
- **Se dibuja como «lo que lleva más tiempo sin hacerse», nunca como
  suciedad acumulada.** Un indicador de casa sucia es culpa, y la culpa es
  la motivación que peor envejece.

**Coste:** alto (toca el modelo de frecuencias y el orden del tablero).
Después de A–E.

### G · Multi-hogar: la misma criatura en dos casas — *hueco del sector*

Ninguna de las tres lo resuelve, y es un caso enorme y muy mal atendido
(separación, abuelos, custodia compartida). Es el diferencial más grande
disponible **y** el más caro: toca `family_id`, que es la columna sobre la
que se apoya todo el RLS. No ahora. Sí en la lista, porque condiciona
cualquier decisión futura de esquema.

---

## 6. Lo que NO se copia, y por qué

| De | Qué | Por qué no |
|---|---|---|
| Habitica | Daño y muerte por fallar | Es su mecánica más criticada, y aquí hay una criatura de 3 años. El no-castigo es un rasgo del producto, no una carencia. |
| Habitica | Profundidad de RPG (equipo, clases, mazmorras) | Compra motivación a cambio de curva de entrada. Con cuatro edades en la misma casa, la curva la paga la peque. |
| Sweepy | Marcador y competición semanal entre miembros | Entre hermanas es un ranking. Descartado por escrito y sigue descartado. Entre adultos, ver mecánica D. |
| OurHome | Calendario y lista de la compra | Enganchan al adulto, sí, pero convierten esto en un organizador familiar y diluyen la tesis. Antes de eso, agotar la vía E (avisos) y D (resumen), que le dan al adulto una razón de abrir **dentro** de la tesis. Si a los tres meses el adulto sigue sin abrirla, reabrir la discusión. |
| Todas | Dinero real por tareas | Ya está en las ausencias deliberadas, con su motivo. |
| S'moresUp y compañía | Asignación de tareas «con IA» | Aquí el reparto lo deciden dos personas adultas que conocen a sus criaturas. Automatizarlo quita justo la conversación que hace falta tener. |

---

## 7. Lo que hay que tocar en la exposición pública

Dos correcciones concretas en `public/narrativa/index.html`:

1. **La celda de Sweepy está desactualizada.** Hoy anuncia aprobación
   parental de tareas infantiles y marcador familiar; ya no es solo
   reparto entre adultos. La separación honesta es «su comparación entre
   miembros es una clasificación semanal; aquí la única comparación es
   cooperativa».
2. **La celda de El Gremio hay que reescribirla entera.** «Es una casa
   concreta, cuatro personas y cuatro dispositivos» describe el
   despliegue, no el producto. Cambio propuesto:

   > Es la única que declara como objetivo volverse innecesaria: el andamio
   > de Talis está diseñado para retirarse, y el control primario es el
   > elogio específico, no el pago. Va de los 3 años al adulto con una
   > interfaz por edad. Y vive en tu propia base de datos: si el proyecto
   > se para, tu gremio no.

Y una que no es corrección sino ausencia: **la lección OurHome merece
párrafo propio** en la exposición. Es el argumento de portabilidad
contado con un caso real, y es el único que ninguna alternativa comercial
puede responder.

---

## 8. Lo que bloquea la expansión y no es una mecánica

Por si esto se lee suelto: las mecánicas de §5 no sirven de nada mientras
sigan abiertos los puntos de `ARRANQUE-SESION.md` §7e. En orden de
bloqueo:

1. **Lo legal** (§7e.8). Datos de actividad diaria de menores. Sin
   política de privacidad, consentimiento parental y **exportar y borrar
   la cuenta desde la app**, no hay expansión que valga. Y el exportar
   sirve a la vez para el argumento de portabilidad de §3.
2. **La zona horaria clavada en `Europe/Madrid`** (§7e.6). Da resultados
   incorrectos en silencio en cuanto haya una familia fuera de España.
3. **Solo habla español** (§7e.11). Con el agravante de que el género
   gramatical está escrito a mano en tres formas: es una decisión de
   calidad que hay que rehacer en cada idioma, no un fichero de cadenas.
4. **Quién paga el Supabase.** Es la pregunta que mató a OurHome. Las dos
   respuestas honestas son «cada familia despliega la suya, y hay una guía
   para hacerlo» o «hay una instancia y cuesta dinero mantenerla». Elegir
   una, escribirla y no dejarla implícita.

---

## Fuentes

- [Rest in the Inn · Habitica Wiki](https://habitica.fandom.com/wiki/Rest_in_the_Inn) · [Parties](https://habitica.fandom.com/wiki/Party) · [Quests](https://habitica.fandom.com/wiki/Quests) · [Group Plans](https://habitica.fandom.com/wiki/Group_Plans) · [Challenges](https://habitica.fandom.com/wiki/Challenges) · [Running a Challenge](https://habitica.fandom.com/wiki/Running_a_Challenge)
- [Missed dailies do massive amounts of damage · HabitRPG/habitica#3161](https://github.com/HabitRPG/habitica/issues/3161) · [A Review of the Habitica App (Medium)](https://emilyfox.medium.com/a-review-of-the-habitica-app-1ce6a5a7da2f) · [Neurodivergent App Review: Habitica](https://bipolarcoaster.blog/2024/08/31/neurodivergent-app-review-habitica/) · [Habitica Review 2026 (Calmevo)](https://calmevo.com/habitica-review/)
- [Sweepy — sitio oficial](https://sweepy.com/) · [Sweepy en App Store](https://apps.apple.com/us/app/sweepy-home-cleaning-schedule/id1498897320) · [Sweepy en Google Play](https://play.google.com/store/apps/details?id=app.sweepy.sweepy)
- [What Happened to the OurHome App in 2026 (ChoreSplit)](https://choresplit.com/compare/ourhome) · [Best OurHome Alternatives (Sense)](https://getsense.ai/blog/posts/best-ourhome-alternatives-2025) · [OurHome App Review (Daeken)](https://www.daeken.com/blog/ourhome-app-review/)

Las fuentes sobre la muerte de OurHome son comparativas comerciales de
apps del sector, es decir, parte interesada. El hecho verificable de
primera mano es que la app no está en Google Play y que su última
actualización es de 2020.
