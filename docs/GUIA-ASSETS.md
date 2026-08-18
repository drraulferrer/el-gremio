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
