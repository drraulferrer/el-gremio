# Perfiles de mascota · spec

Estado: **escrita el 18-ago-2026. La migración 027 YA ESTÁ EJECUTADA**;
no hay código de interfaz todavía. El esquema va por delante del cliente
a propósito, que es el orden bueno (§7e del arranque).

Esto añade un tipo de perfil nuevo —perro o gato— con sus propias misiones
y premios. No es un adorno temático: el catálogo sale de literatura
concreta, y en tres puntos **esa literatura contradice el diseño actual de
la app**. Esos tres choques son la parte importante de este documento.

---

## 1. La evidencia, y qué obliga a cambiar

### 1.1 Solo refuerzo positivo. Sin excepciones y sin matices

La [AVSAB, en su declaración de 2021](https://avsab.org/wp-content/uploads/2021/08/AVSAB-Humane-Dog-Training-Position-Statement-2021.pdf),
recomienda **métodos basados en recompensa para todo el adiestramiento**,
incluida la modificación de conducta y los casos de agresividad. Dos
conclusiones suyas, literales en lo sustancial: no hay evidencia de que
los métodos aversivos sean más eficaces en ningún contexto, y sí la hay de
que dañan el bienestar del animal y el vínculo con las personas.

**Qué obliga:** ninguna misión del catálogo puede ser «corregir»,
«regañar», «decir no» ni «enseñar quién manda». Ni siquiera como opción
que una familia pueda escribirse. El catálogo que se ofrece es el que
educa: si la app sugiere una sola misión aversiva, está enseñando a la
familia a hacerle daño al animal con la coartada de un sistema de puntos.

Es la restricción más dura de todo el documento y no se negocia.

### 1.2 Entrenar a diario es PEOR que espaciarlo · choca con las rachas

[Demant et al. (2011)](https://www.sciencedirect.com/science/article/abs/pii/S016815911100181X),
en *Applied Animal Behaviour Science*, comparó frecuencias de sesión en
perros. Resultado: los entrenados **1–2 veces por semana adquirieron
significativamente mejor** que los entrenados a diario, y una sola sesión
al día fue mejor que tres seguidas. Los de una sesión diaria necesitaron
**5–8 sesiones** para aprender la tarea frente a **6–12** de los de varias
sesiones al día.

El matiz honesto, que también está en el estudio: entrenar más a menudo
llega antes **en días de calendario**, aunque cueste más sesiones. Lo que
es claramente malo es **amontonar sesiones seguidas**.

**Qué obliga, y es lo que más duele:** la mecánica de racha de esta app
premia la constancia diaria. Aplicada al adiestramiento, empujaría a la
familia justo hacia lo menos eficaz. Por eso:

- Las misiones de **truco** se crean con **patrón por días de la semana**
  (`challenges.days`, migración 024), no como diarias. Por defecto tres
  días alternos.
- El texto de la misión dice el tamaño de la sesión: **5 minutos**, y
  «mejor corta y otro día que larga y seguida».
- Las misiones de **hábito y cuidado** —comer, arenero, paseo, agua— sí
  son diarias, porque ahí la constancia diaria no es una técnica de
  aprendizaje sino una necesidad del animal. **La distinción entre truco y
  hábito es la que sostiene todo el catálogo.**

### 1.3 Para un gato, el premio por defecto no es comida

[Vitale Shreve, Mehrkam y Udell (2017)](https://pubmed.ncbi.nlm.nih.gov/28343989/),
en *Behavioural Processes*, midió preferencias en gatos de casa y de
refugio entre cuatro categorías. **El 50 % prefirió la interacción social
humana**; el 37 %, la comida; el resto, juguete u olor.

Y los gatos son adiestrables: hay [programas de clicker evaluados en
refugios](https://www.mdpi.com/2076-2615/7/10/73) y gatitos que completan
programas de seis semanas con refuerzo positivo, desde «sentado» hasta
andar con arnés.

**Qué obliga:** los premios de gato son, por defecto, **juego y atención**,
no chuches. Encaja con los niveles de premio que esta app ya tiene
(1 decidir · 2 vivir · 3 celebrar): para un gato, «diez minutos de caña
contigo» es nivel 2 y vale más que cualquier golosina.

### 1.4 Los hábitos de gato salen de las cinco columnas

Las [guías de necesidades ambientales AAFP/ISFM](https://journals.sagepub.com/doi/10.1177/1098612X13477537)
definen cinco pilares: un sitio seguro; recursos clave múltiples y
separados (comida, agua, arenero, descanso); oportunidad de juego y
conducta predatoria; interacción humana positiva y consistente; y respeto
al olfato del gato. **Son la taxonomía del catálogo de hábitos felinos**,
no una lista inventada.

### 1.5 Lo que NO se va a prometer

El beneficio para los niños de cuidar un animal es **real pero moderado, y
la evidencia es correlacional**. Los trabajos que lo revisan
—[resumen y discusión aquí](https://pmc.ncbi.nlm.nih.gov/articles/PMC9740035/)—
encuentran asociaciones positivas con empatía y competencia social, pero
señalan mucha heterogeneidad y que el efecto depende más de **la calidad
del vínculo y del grado de implicación real en el cuidado** que de tener
un animal en casa.

**Qué obliga:** la narrativa puede decir que implicarse en el cuidado se
asocia a más empatía. **No** puede decir que tener perro haga a un niño
más empático, ni citar cifras de efecto. Esta app ya tiene la costumbre de
no prometer de más y aquí toca sostenerla.

---

## 2. Las decisiones de diseño

### 2.1 El XP va SOLO al perfil de la mascota

La mascota tiene su propio perfil, su nivel y sus monedas. Quien cepilla al
perro **no se lleva XP por hacerlo**.

Es lo decidido y conviene entender qué se está comprando y qué se está
pagando. Se compra claridad: el nivel de la mascota mide **su** progreso, y
la economía de las personas —cuidadosamente calibrada en `economia.js`, con
sus bandas de precio y su carga por día— **no se toca en absoluto**. Se
paga que quien hace el trabajo no recibe nada del sistema, y son tareas que
cuestan sostener.

**Si alguna vez se quiere revisar**, la alternativa era repartir: nivel para
la mascota y XP normal para quien la cuida. Queda apuntado aquí para no
tener que volver a razonarlo desde cero.

### 2.2 La mascota no es un jugador, y el esquema tiene que saberlo

Un perro no pulsa «¡Hecho!», no elige perfil, no gasta monedas y no recibe
avisos. El perfil de mascota es un **sujeto con marcador**, no un usuario.
En concreto:

- **No aparece en el selector de perfiles.** Nadie «entra como el perro».
- **No recibe avisos push.** Igual que la peque, y por una razón aún más
  evidente. La vista `push_pendientes` tiene que excluirlo.
- **Sus misiones las registra un adulto desde el panel**, y quedan
  aprobadas en el acto: no hay a quién validarle nada, el adulto que lo
  registra es el validador.
- **Sus monedas las gasta un humano en su nombre**, en premios para ella.

### 2.3 Truco y hábito son cosas distintas

Ya justificado en §1.2. En el esquema es la diferencia entre una misión con
`days` (truco, espaciada) y una diaria (hábito). En el catálogo va marcado
para que no se confundan al editarlas.

### 2.4 Lo que el adulto sigue teniendo que hacer

Ninguna misión puede quedar delegada por completo en un menor: el animal
depende de que se haga, y un sistema de puntos no es una garantía. El
catálogo marca qué misiones requieren **supervisión adulta** —todo lo que
toque comida, medicación, salidas a la calle y manejo veterinario— y la
interfaz tendrá que enseñarlo.

---

## 3. Catálogo de misiones

Cada una lleva su tipo (**T**ruco espaciado / **H**ábito diario) y de dónde
sale.

### 3.1 Perro

| | Misión | Tipo | Fundamento |
|---|---|---|---|
| 🎯 | Sesión de clicker, 5 minutos | T | Demant 2011: corta y espaciada |
| 🐕 | Practicar la llamada («ven») en casa | T | AVSAB: solo refuerzo positivo |
| 🧎 | Sentado y tumbado, con premio | T | R+ básico |
| ✋ | Dejarse tocar patas y orejas | T | Manejo cooperativo: reduce el estrés en el veterinario |
| 👃 | Paseo de olfateo, sin prisa | H | Enriquecimiento; el olfato es su forma de leer el mundo |
| 🪥 | Cepillado | H | Cuidado + manejo cooperativo |
| 💧 | Agua limpia y fresca | H | Necesidad básica · **supervisión adulta** |
| 🧩 | Comida en comedero de puzle | H | Enriquecimiento alimentario · **supervisión adulta** |
| 🦷 | Higiene dental | H | Salud · **supervisión adulta** |

### 3.2 Gato

| | Misión | Tipo | Fundamento |
|---|---|---|---|
| 🎯 | Clicker: tocar la mano con el morro | T | Clicker validado en gatos (MDPI 2017) |
| 📦 | Entrar solo al transportín | T | Manejo cooperativo: de lo que más bienestar da |
| 🪶 | Juego con caña, dos ratos cortos | H | AAFP/ISFM pilar 3: conducta predatoria |
| 🫱 | Diez minutos de estar juntos | H | Vitale Shreve 2017: prefieren interacción social |
| 🧹 | Arenero limpio | H | AAFP/ISFM pilar 2 |
| 🍽️ | Comida y agua separadas del arenero | H | AAFP/ISFM pilar 2 · **supervisión adulta** |
| 🧗 | Dejar libre su sitio en alto | H | AAFP/ISFM pilar 1: sitio seguro |
| 👃 | Respetar su olor: no lavarlo todo a la vez | H | AAFP/ISFM pilar 5 |
| 🧩 | Comida en juguete dispensador | H | Predación + enriquecimiento · **supervisión adulta** |

---

## 4. Catálogo de premios

Con los niveles que ya usa la app. **Para gato, lo social y el juego van
primero por evidencia**, no por gusto.

### 4.1 Perro

| Nivel | Premio |
|---|---|
| 1 · decidir | Elige él la ruta del paseo |
| 2 · vivir | Paseo largo de olfateo · Sesión de juego de tirar · Juguete de puzle nuevo |
| 3 · celebrar | Excursión a un sitio nuevo · Tarde en el campo |

### 4.2 Gato

| Nivel | Premio |
|---|---|
| 1 · decidir | Elige él dónde dormir hoy: se le deja el sitio |
| 2 · vivir | Diez minutos de caña sin interrupciones · Caja nueva · Hierba gatera |
| 3 · celebrar | Rascador nuevo · Estantería alta para trepar |

**Nota deliberada:** en ninguna de las dos listas el premio principal es
comida. Para el gato lo dice el estudio de preferencias; para el perro, la
misma razón por la que esta app pone los premios de nivel 1 por encima de
las cosas: lo que sostiene el hábito es la autonomía y el rato compartido.

---

## 5. Cambios de esquema

Están en `migracion-027-mascotas.sql`, **escrita y sin ejecutar**:

1. `profiles.role` admite `'mascota'`.
2. `profiles.species` con `'perro'|'gato'`, y una restricción de coherencia:
   hay especie **si y solo si** el rol es mascota.
3. `challenges.target_roles` admite `'mascota'`.
4. `rewards.target_role`: `null` = premio de la familia, `'mascota'` =
   premio para el animal. Sin esto, los premios del perro salen en la
   tienda de la junior.
5. `completions.registrado_por`: quién apuntó la misión, porque la mascota
   no la apunta. Obligatorio cuando el perfil es una mascota.
6. `push_pendientes` recreada excluyendo a las mascotas.

---

## 6. Lo que queda por hacer

- **Ejecutar la 027** (antes de desplegar el cliente que la use: §7e).
- **Interfaz**: alta de mascota en Miembros, tablero propio de la mascota
  dentro del panel, registro de misiones por un adulto, tienda de premios
  de mascota. Y las exclusiones de §2.2, que son lo fácil de olvidar.
- **Catálogo semilla** en `src/lib/`, con el marcado de truco/hábito y de
  supervisión adulta.
- **Narrativa**: contar el perfil de mascota y, sobre todo, contar **por
  qué las misiones de truco no son diarias**. Es lo más contraintuitivo de
  toda la app y es donde la narrativa gana su sitio.
- **Tests**: que ninguna misión del catálogo sea aversiva; que los premios
  de mascota no aparezcan para personas; que la mascota no entre en
  `push_pendientes` ni en el selector de perfiles.

## 7. Preguntas abiertas

1. **¿El XP de la mascota cuenta para la meta cooperativa del gremio?**
   Argumento a favor: el trabajo lo hace la familia y es real. En contra:
   infla la meta con esfuerzo que no es de nadie en concreto. **Sin
   decidir**; hoy la migración no lo toca, así que contaría, y eso es una
   decisión por omisión que conviene tomar a conciencia.
2. **¿Racha para la mascota?** Para hábitos tiene sentido. Para trucos
   contradice §1.2 y no debería existir.
3. **¿Más de una mascota?** El esquema lo admite sin cambios. La interfaz
   habrá que ver si se le atraganta.
