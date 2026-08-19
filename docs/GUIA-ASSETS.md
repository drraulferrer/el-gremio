# El Gremio — Guía de assets del dashboard

Set completo de imágenes independientes para construir el dashboard «Tablero nocturno»,
con las especificaciones exactas para regenerarlos o crear nuevos con el mismo estilo.

## Inventario

| Archivo | Uso | Fondo | Tamaño origen | Tamaño en pantalla |
|---|---|---|---|---|
| `emblema-gremio.png` | Logo de cabecera (laurel + estrella) | Transparente | 1024×1024 | 40–48 px (header), 96 px (login) |
| `talis.png` | Contador de Talis (chip dorado) | Transparente | 1024×1024 | 20–24 px en chip, 48 px en tienda |
| `gema-nivel.png` | Indicador de nivel (cristal teal con aro dorado) | Transparente | 1024×1024 | 56–64 px |
| `icono-hogar.png` … `icono-autonomia.png` | Las 8 barras de habilidad | Transparente | 1024×1024 | 24–32 px por barra |
| `banner-meta.png` | Adorno sobre la barra de meta compartida | Transparente | 1536×1024 | ancho de la tarjeta, 60–80 px alto |
| `estrella-llena.png` / `estrella-vacia.png` | Tarro de estrellas de la peque | Transparente | 1024×1024 | 32–40 px |
| `fondo-nocturno.png` | Fondo del tablero (índigo con viñeta cálida) | Opaco | 2048×1152 | `background-size: cover`, fijo |
| `textura-pergamino.png` | Tarjetas de misión (sutil, al 8–12 % de opacidad sobre #1D1D36) | Opaco | 1024×1024 | repetición tile |

## Paleta obligatoria

- Fondo: `#141428` · Superficies/tarjetas: `#1D1D36`
- Oro Talis (gradiente): `#F2B33D → #FFD77A` — solo para reconocimiento (XP, Talis, insignias, meta)
- Teal habilidad: `#4FC4B5` — progreso (las barras degradan teal→oro)
- Pergamino: `#F5EFE0` · Estrella: `#FFC24B → #FF9F43` · Coral: `#FF7A6E` · Menta: `#9FE3D8`

## Prompts maestros (estilo consistente)

Todos los iconos de habilidad usan la misma plantilla, cambiando solo el sujeto:

```
Minimal game UI icon of {SUJETO}, golden gradient line art (#F2B33D to #FFD77A),
thick rounded strokes, soft glow, premium flat icon style, transparent background, centered
```

Sujetos: casa acogedora con ventana-corazón (hogar) · brazo con chispa (salud) ·
libro abierto con chispa (aprendizaje) · corazón con línea de pulso (amabilidad) ·
brote de dos hojas (responsabilidad) · apretón de manos (cooperación) ·
pincel con estrella (creatividad) · cerebro con rayo (autonomía).

Otros prompts base:

- **Emblema**: `Guild emblem logo: golden laurel wreath encircling a four-pointed star, engraved metal style, warm amber gold gradient, subtle glow, flat premium game logo, transparent background`
- **Gema de nivel**: `Glowing faceted gem orb, deep teal crystal (#4FC4B5) with golden metal rim ring, soft inner glow, premium game UI asset, transparent background`
- **Talis**: `Golden guild token coin engraved with a laurel wreath and a four-pointed star, hammered metal texture, soft glow at edges, slightly tilted 3D coin, transparent background`
- **Estrellas peque**: estilo «chunky rounded points, cartoon sticker» — llena en `#FFC24B → #FF9F43`; vacía solo con contorno `#E8DCC2` y centro transparente
- **Banner**: `Ornamental guild banner ribbon, deep indigo fabric with golden trim and tassels, horizontal, transparent background`
- **Texturas**: pergaminio crema con grano muy sutil / índigo `#141428` con trama de tejido casi imperceptible y viñeta cálida superior

## Reglas de uso

1. El dorado nunca decora: solo acompaña a XP, Talis, insignias y meta.
2. La meta compartida es UNA barra con segmentos por miembro, nunca barras enfrentadas.
3. Las estrellas de la peque sustituyen a las cifras: sin números en su pantalla.
4. Los iconos siempre sobre fondo oscuro del tablero; nunca sobre pergamino claro.
5. Tipografía: Fraunces (títulos y rangos) · Inter (UI y cifras) · Baloo 2 (mundo peque).

## Sellos de oficio (insignias v1, 73 piezas)

Sistema visual generado para el catálogo de `docs/INSIGNIAS-03-CATALOGO.md`.

**80 piezas**: las 73 del catálogo v1 más 7 de legado. Viven en
`public/assets/insignias/*.webp` (transparente, 192×192, ~12 KB de media, 976 KB en
total) y el catálogo que las nombra es `src/lib/sellos.js`, que además dice qué sello
le toca a cada una de las 16 insignias que hoy se conceden.

Se generaron a 1254×1254 PNG: a ese tamaño cada pieza pesaba ~2,7 MB y el set entero
206 MB. En WebP a 192 px pesan trece veces menos y siguen nítidas al tamaño al que se
ven (64 px, o 40 px en la fila de poderes). El tope está en `tests/sellos.test.js`.

A diferencia de los iconos de habilidad (línea dorada plana), un sello es una
**medalla gremial grabada**: un sello de lacre/metal con relieve, no una insignia
de puntos ni una medalla genérica. El motivo interior siempre es concreto y sin
texto —ni letras, ni números, ni cifras—; el número de temporada, el "siguiente"
o el progreso los pinta la interfaz encima, nunca la imagen.

### Escalera de materiales

El material comunica el grado dentro de una serie, igual en las 23 series
(cada serie recorre un subconjunto de esta escalera según su longitud):

| Material | Uso | Tratamiento |
|---|---|---|
| `bronze` | primeros escalones | bronce cobrizo cálido (`#C9821F → #F2B33D`), mate |
| `silver` | escalones intermedios | plata cepillada + esmalte teal (`#4FC4B5`) |
| `gold` | escalones avanzados | oro radiante (`#F2B33D → #FFD77A`), el oro premium de la app |
| `gold_masterwork` | grados «especiales» tope de serie (Obra maestra de oficio, sello de temporada, obra común 10, autonomía 4, regreso 3, equilibrio 6) | oro + gema teal engastada + laurel grabado |
| `legendary` | las 4 legendarias del catálogo: `ritmo_08` (1.000 días), `trayectoria_08` (5.000 misiones), `equilibrio_08` (8 caminos), `obra_comun_25` | oro + gema teal grande + laurel completo + halo radiante — el más ornamentado de toda la colección |
| `discovery` | los 3 descubrimientos secretos | plata pulida + chispa teal, tono juguetón |

### Prompt maestro

```
Premium flat game-icon illustration of a circular engraved guild seal / stamped
medallion, for a cozy warm family app called 'El Gremio'. {material}, with a
raised ornate rim shaped like a wax-seal border with small tick marks, soft
outer glow, thick rounded engraved linework, perfectly centered and symmetrical
composition. In the middle of the seal: {motivo}. Flat solid uniform magenta
background color #FF00FF, absolutely no gradient, texture, shadow or vignette
on the background. No text, no letters, no numbers, no watermark, no signature.
Icon only, square 1:1 composition, clean vector-like premium mobile game asset.
```

Generado con **GPT Image 2** (Kie.ai), fondo magenta plano y recorte por chroma-key.

Dos cosas del recorte que costaron un intento cada una y conviene no repetir:

1. La clave NO puede ser distancia euclídea al magenta puro. Los sellos legendarios
   llevan un halo cálido que se funde con el fondo, y esa métrica les dejaba una
   aureola rosa. Lo que sí funciona es clasificar por TONO: `min(R,B) − G`. El fondo
   y su resplandor tienen G bajo frente a R/B; el oro, la plata, el bronce y el teal
   no. Umbrales 10 → 45.
2. El CDN que sirve las imágenes generadas devuelve **403 al User-Agent por defecto
   de Python**. Hay que mandar uno de navegador o parece un fallo de la API.

### Motivos por familia

- **Primeros encargos** (1): martillo cruzado con una chispa — la primera marca de aprendiz.
- **Ritmo** (8): rastro de huellas en espiral, como una rosa de los vientos.
- **Trayectoria** (8): un camino que serpentea hacia una estrella en el horizonte.
- **Caminos de oficio** (32 = 8 habilidades × 4 grados): reutiliza el sujeto exacto de cada
  icono de habilidad ya existente (casa+corazón, brazo+chispa, libro+chispa, corazón+pulso,
  brote, apretón de manos, pincel+estrella, cerebro+rayo), ahora grabado como sello.
- **Exploración** (6): rosa de los vientos parcial/completa (habilidades) · fardo de
  herramientas variadas (familias) · cruz de sol/semana/luna/estrella (frecuencias).
- **Equilibrio** (3): mesa de cuatro patas → mesa de seis patas → rosa de los vientos
  de ocho puntas — literal a la copy del catálogo ("Mesa de cuatro patas").
- **Autonomía** (4): una mano soltando otra → una mano sola con una herramienta →
  tres herramientas con su huella → una mano estampando su propia marca.
- **Obra común** (5): laurel + estrella con cinta para el número de temporada (sello
  colectivo) · huella humilde (participación) · cajas/archivo creciente (5/10/25).
- **Regreso al taller** (3): farol junto a una puerta entreabierta → puerta abierta con
  luz cálida → taller iluminado por completo. Nunca cuenta atrás ni puerta cerrada.
- **Descubrimientos** (3, secretos): reloj de herramientas variadas · compás de ritmos ·
  mesa vista desde arriba con varias manos — juguetones, sin condición central oculta.

### Sellos de legado

Siete insignias vivas que el catálogo v1 **no** sucede —nivel general, canje, hora de
validación y las tres competitivas— tienen su propio sello `legado-*.webp`. No es un
capricho: sin ellos la rejilla mezclaría sellos y emoji, que se ve peor que cualquiera
de las dos cosas por separado. Que el catálogo retire una regla no borra a quien la
ganó.

### Reglas de uso del sello

1. El sello nunca lleva cifras, letras ni número de temporada grabados: eso es capa de UI.
2. El material indica grado dentro de la app (bronce→plata→oro→oro+gema→legendaria);
   no reinventar una escalera de color distinta para una serie nueva.
3. Los 32 de Caminos de oficio comparten sujeto con `icono-{habilidad}.png`: si se
   redibuja un icono de habilidad, sus 4 sellos de oficio deben rehacerse a la vez.
4. `silhouette` (Obra maestra antes de Maestría, Regreso antes de aplicar) no es una
   imagen aparte: es este mismo WebP con tratamiento CSS, nunca una segunda generación.
5. Fondo siempre transparente sobre el tablero oscuro; igual que el resto de assets.
6. **Dos insignias visibles a la vez no comparten metal.** Cuando una serie presta un
   peldaño a una regla vieja, se salta al siguiente material en vez de coger el
   contiguo: `x10`/`x25`/`x50` usan Trayectoria 01/03/06 —bronce, plata, oro— porque
   con 01/02/03 las tres salían en bronce y en la rejilla parecían la misma insignia.
   Lo fija `tests/sellos.test.js`.
7. **El estado no vive solo en el color.** El sello pendiente se atenúa, pero quien la
   tiene y quién no lo dice además una palabra («Conseguida» / «Aún no»). El texto de
   una tarjeta pendiente va a opacidad completa: bajarlo al 72 % dejaba la descripción
   en 3,8:1 y AA pide 4,5:1.
