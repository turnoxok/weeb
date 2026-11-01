# Biblioteca de piezas

Cada pieza = carpeta con `pieza.json` + `svg/` (las partes). Catálogo en `indice.json`.

| pieza | partes | roles de color (cambiables) |
|---|---|---|
| tobogan | 7 | rampa, cuerpo, detalle |
| puente | 9 | piso, estructura, zocalo, remaches |
| arco (final del puente) | 2 | arco, interno |
| rayuela | 5 | contorno, base, fondo_numeros, numeros_color, numeros |
| esfera | 1 | esfera (color y tamaño con --color / --escala) |

## Cómo funciona
- La pieza se inserta como **grupo**: una parte es la *madre* y las demás son *hijos* con posición relativa. En el editor, mover/escalar/girar la madre mueve todo; "Aislar" muestra solo la pieza; cada parte se puede abrir y recolorear sola.
- `roles` agrupa partes por color: `--color rampa=#e66937` recolorea todas las partes de ese rol.
- Las posiciones de la madre son de referencia; al insertar se puede pasar `--pos`, `--giro`, `--escala`.

## Crear una pieza nueva
1. Armar las partes en el editor con una madre y sus hijos (campo "Sigue a (madre)").
2. Copiar los SVG a `biblioteca/<pieza>/svg/` y definir `pieza.json` (ver los existentes: `partes[].objeto` son los parámetros del editor, `pose` la transformación; hijos relativos a la madre).
3. Convención: un solo color por SVG, solo rellenos (sin trazos), nombres con prefijo de la pieza, máximo 3–4 roles de color.

`_borradores/` = material en preparación (escena pelotero: cancha, rayuela, arco con estrellas, pelota, arbusto; capas SVG + JSON de prueba).
