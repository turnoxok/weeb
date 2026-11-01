# Taller tuweeb

Backup y taller de trabajo. Lo que se publica de cada cliente va a su propio repo/sitio; acá vive todo.

```
editor/            editor.html  ← ÚLTIMA versión (la maestra)
biblioteca/        piezas reutilizables (tobogan, puente, arco…) + _borradores/
herramientas/      agregar_pieza.py (mete una pieza en un proyecto)
proyectos/tuweeb/  la web tuweeb.com (index.html, JSON, assets, editor.html copia)
proyectos/<cliente>/   un proyecto por cliente (misma estructura)
```

## Flujo para un cliente nuevo
1. Copiar `proyectos/tuweeb/` → `proyectos/<cliente>/` y cambiar textos/colores en el editor.
2. Agregar piezas: `python3 herramientas/agregar_pieza.py proyectos/<cliente>/Weeb_Proyecto_Actual.json tobogan --pos X Y Z --color rampa=#e66937`
   (copia los SVG a `assets/models` del proyecto y agrega la pieza como grupo madre→hijos).
3. Abrir el proyecto en el editor, ajustar, "Copiar index.html" y publicar solo lo necesario en el repo/sitio del cliente.

Ver `biblioteca/README.md` para crear piezas nuevas.
