# Los Talis

Canon narrativo de la divisa de El Gremio. Si vas a escribir texto que la
familia lee —una pantalla, un aviso, un correo, la narrativa pública—,
esto es lo que no se puede contradecir.

El documento largo del que sale esto vive fuera del repo. Aquí queda lo
que hace falta para no romperlo sin querer.

---

## 1. Qué es un Talis

Una **ficha de reconocimiento**, no un pago.

La mecánica no cambió cuando cambió el nombre: se gana validando misiones
y se gasta en la tienda, exactamente igual que las «monedas» de antes. Lo
que cambió es lo que el sistema dice al entregarlo.

```
Encargo → Misión → Acción → Talis → Recompensa
```

Una moneda dice «te pago por esto». Un Talis dice **«este miembro ha
cumplido»**. Es la misma columna de Postgres y un marco distinto, y el
marco es justamente lo que el resto del diseño lleva desde el principio
intentando proteger: si el motivo de hacer la misión acaba siendo el
cobro, el sistema compite con la motivación que quería crear (ver
`docs/FUNDAMENTO-CIENTIFICO.md`, Brown et al. 2018).

La frase que lo resume, y que está en la narrativa pública:

> Un Talis no vale por lo que puedes comprar con él. Vale por lo que
> hiciste para ganarlo.

---

## 2. La regla que no se toca

> **Los Talis se ganan. Las insignias se merecen.**

| | Talis | Insignias |
|---|---|---|
| Naturaleza | Fungibles: entran y salen | Permanentes |
| Camino | Misiones → Talis → recompensas | Trayectoria → hitos → insignias |
| Se compran | Sí, recompensas de la tienda | **No, con ninguna cantidad** |

El día que algo permita canjear una insignia, un rango o la meta del
gremio por Talis, esto deja de significar nada y pasa a ser una tienda de
puntos. Es la única regla de esta página que no admite excepción.

---

## 3. El nombre, y cómo se escribe

- **Invariable**: `1 Talis`, `20 Talis`. Nunca «Talises», nunca «Talis's».
- **Con mayúscula**, siempre. Es un nombre propio dentro de la ficción.
- El saldo se llama **Bolsa de Talis**.
- El catálogo de premios es la **Casa de Recompensas**.
- No hay que escribir nada de esto a mano: `src/lib/talis.js` exporta
  `TALIS`, `BOLSA`, `CASA` y el formateador `talis(n)`. La razón de que
  exista el formateador es que Talis no pluraliza y eso se olvida en la
  pantalla número catorce.

---

## 4. Dónde NO se dice Talis

Tres sitios, a propósito:

1. **El esquema.** La columna es `coins`, en `profiles`, `challenges`,
   `completions`, `rewards` y `bonuses`. **No hay migración de renombrado
   y no debe haberla.** El documento de lore separa el «concepto
   funcional» del «nombre narrativo», y esa separación es justo lo que
   permite cambiar el relato sin tocar funciones que abonan dinero de
   juego dentro de una transacción.
2. **Los códigos de retorno de Postgres.** `redeem_reward` devuelve
   `'sin_monedas'`. Renombrarlo obligaría a migrar por un motivo
   cosmético y a coordinar cliente y base en el mismo despliegue.
3. **La pantalla de la peque.** A los tres años no hay cifras: sus Talis
   se dibujan como **estrellas**, a razón de una por misión suya
   (`MONEDAS_POR_ESTRELLA = 5`). La ficha gremial es una abstracción que
   no le sirve todavía; el tarro que se llena, sí.

En las líneas de datos apretadas —el cuadro de mando, el historial, el
camino de rachas— se usa el glifo 🪙 solo, sin la palabra, igual que se
usa `XP` sin escribir «experiencia». La palabra va en rótulos, botones,
prosa y mensajes de error.

---

## 5. La historia, y por qué se cuenta a trozos

El lore no se enseña entero al empezar: soltarlo en el onboarding es la
forma más rápida de que nadie lo lea. `FRAGMENTOS`, en `src/lib/talis.js`,
lo abre en cuatro piezas, y cada una llega cuando quien la lee ya ha
vivido lo que cuenta.

| | Fragmento | Se abre con |
|---|---|---|
| I | El primer Talis | el primer Talis ganado |
| II | El valor | 100 Talis ganados |
| III | La bolsa | 500 Talis ganados |
| IV | La obra | 500 Talis **y** una insignia |

Los umbrales van sobre Talis **ganados en total**, no sobre el saldo. Si
fueran sobre el saldo, gastar en la tienda borraría la historia, que es
exactamente lo contrario de lo que estos textos dicen. El cuarto pide
además una insignia porque es el que explica por qué las insignias no se
compran, y decírselo a quien no tiene ninguna es contestar una pregunta
que nadie se ha hecho.

### Dónde se ven

En **Progreso → La crónica de los Talis**, debajo de las insignias
(`src/components/Cronica.jsx`). Tres decisiones que no conviene deshacer:

1. **Los cerrados se ven, apagados**, con lo que falta para abrirlos
   («Te faltan 380 Talis»). Un hueco vacío no se busca; es la misma
   decisión que en la tienda de la peque, donde los premios que todavía
   no alcanza se ven apagados en vez de esconderse.
2. **La pastilla de «Nuevo» dura una visita.** Qué se ha visto ya se
   guarda en `localStorage` (`gremio_cronica_<perfil>`), no en Postgres:
   es preferencia de un aparato, no un dato del gremio, y meterlo en la
   base habría pedido una migración para decidir dónde va una pastilla.
3. **Lo leído se congela en una `ref` al entrar.** El efecto que marca
   como visto escribe en el mismo sitio del que lee la pantalla; con
   estado normal se pisaba a sí mismo y la pastilla no llegaba a verse
   (StrictMode ejecuta el efecto dos veces en desarrollo). Si alguien lo
   convierte en `useState`, la marca desaparece.

---

## 6. Rigor histórico

**Los Talis son ficción.** Ningún gremio medieval pagó a nadie con Talis.

Lo que sí es real, y es de donde sale el imaginario:

- Los gremios de artesanos tuvieron mucho peso en ciudades europeas entre
  los siglos XII y XVIII: regulaban el oficio, la formación y el acceso.
- La progresión **aprendiz → oficial → maestro** aparece en varias
  tradiciones gremiales, aunque nunca fue idéntica ni universal.
- La **obra maestra** fue un requisito documentado para acceder a la
  maestría en determinados gremios.
- Los gremios usaron **símbolos y sellos corporativos**, en un mundo donde
  el sello autenticaba documentos y transacciones.

De ahí sale la forma de la ficha, la idea de la marca y la progresión.
No sale el objeto.

**Nunca escribir:** «los gremios medievales pagaban con Talis».
**Sí se puede escribir:** «los Talis forman parte del universo de El
Gremio y están inspirados en las marcas, los sellos y los sistemas de
reconocimiento de los gremios históricos».

La separación no es un escrúpulo académico: esta app la usa una niña de
once años que puede repetir en clase lo que lea aquí.

### Referencias de apoyo

- Epstein SR. *Craft Guilds, Apprenticeship, and Technological Change in
  Preindustrial Europe*. J Econ Hist. 1998;58(3):684-713.
- Prak M, Wallis P (eds). *Apprenticeship in Early Modern Europe*.
  Cambridge University Press.
- De Munck B. *Gilding golden ages: perspectives from early modern Antwerp
  on the guild debate, c. 1450-c. 1650*. Eur Rev Econ Hist.
  2011;15(2):221-253.
