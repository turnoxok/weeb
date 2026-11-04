#!/usr/bin/env python3
"""Arma la carpeta MÍNIMA para publicar un cliente como landing (ej.: tuweeb.com/lemadavami/).

Uso:  python3 herramientas/armar_landing.py lemadavami [nombre-de-carpeta]
Resultado: landing/<nombre>/ con solo lo que el sitio usa de verdad:
  index.html, invitacion.html, reservar/ y los archivos de assets/ que se nombran en esas páginas.
NO se copia: editor.html, panel/, el proyecto .json ni los archivos que no usa nadie.
Todas las rutas del sitio son relativas, así que la carpeta funciona colgada de cualquier dirección.
"""
import os, re, shutil, sys

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    cli = sys.argv[1]; name = sys.argv[2] if len(sys.argv) > 2 else cli
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = os.path.join(root, 'proyectos', cli); dst = os.path.join(root, 'landing', name)
    if not os.path.isdir(src): sys.exit('No existe ' + src)
    if os.path.isdir(dst): shutil.rmtree(dst)
    os.makedirs(dst)
    pages = []
    for f in ('index.html', 'invitacion.html'):
        if os.path.isfile(os.path.join(src, f)): shutil.copy2(os.path.join(src, f), dst); pages.append(os.path.join(dst, f))
    if os.path.isdir(os.path.join(src, 'reservar')):
        shutil.copytree(os.path.join(src, 'reservar'), os.path.join(dst, 'reservar'))
        for dp, _, fs in os.walk(os.path.join(dst, 'reservar')):
            pages += [os.path.join(dp, x) for x in fs if x.endswith(('.html', '.js', '.json', '.css'))]
    text = ''
    for p in pages: text += open(p, encoding='utf-8', errors='ignore').read() + '\n'
    sa = os.path.join(src, 'assets'); kept = skipped = 0; size = 0
    for dp, _, fs in os.walk(sa):
        for x in fs:
            rel = os.path.relpath(os.path.join(dp, x), src)
            # assets/inv lo arma invitacion.html con nombres sueltos: va completa. El resto, solo si alguna página nombra el archivo.
            if rel.startswith('assets/inv/') or x in text or rel in text:
                o = os.path.join(dst, rel); os.makedirs(os.path.dirname(o), exist_ok=True); shutil.copy2(os.path.join(dp, x), o)
                kept += 1; size += os.path.getsize(o)
            else: skipped += 1
    tot = sum(os.path.getsize(os.path.join(dp, x)) for dp, _, fs in os.walk(dst) for x in fs)
    print('Listo: landing/%s  (%.1f MB en total, %d archivos de assets; %d sin uso quedaron afuera)' % (name, tot / 1e6, kept, skipped))

main()
