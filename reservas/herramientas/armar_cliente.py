#!/usr/bin/env python3
"""Arma las carpetas de un cliente: <salida>/panel (PWA del dueño) y <salida>/reservar (página de reservas).
uso: armar_cliente.py --api https://script.google.com/macros/s/.../exec --nombre "Salón Demo" --color "#8149bd" [--logo logo.png] --salida proyectos/demo
Todo lo demás (logo, colores, WhatsApp, turnos, precios) se configura desde el panel / la hoja, no acá."""
import argparse, json, os, re, shutil, sys
AQUI = os.path.dirname(os.path.abspath(__file__)); PL = os.path.join(AQUI, '..', 'plantillas')
ap = argparse.ArgumentParser()
ap.add_argument('--api', required=True); ap.add_argument('--nombre', required=True); ap.add_argument('--color', default='#8149bd')
ap.add_argument('--volver', default='../', help='a dónde vuelve el botón "Volver a la web" de la página de reservas (default: ../)')
ap.add_argument('--tema', help='hoja de estilos con la paleta del cliente (se copia como tema.css a panel y reservar)'); ap.add_argument('--logo', help='imagen del logo para el ícono de la app (png/jpg/svg no)'); ap.add_argument('--carga', help='imagen (png) que se muestra girando mientras cargan reservar y el panel, en lugar del isotipo de tuweeb'); ap.add_argument('--salida', required=True)
a = ap.parse_args()
if not a.api.startswith('https://script.google.com/') or not a.api.endswith('/exec'): sys.exit('--api debe ser la URL de la aplicación web (termina en /exec)')

def icono(destino, lado):
    from PIL import Image, ImageDraw, ImageFont
    c = tuple(int(a.color[i:i+2], 16) for i in (1, 3, 5))
    if a.logo or True:   # sin logo del dueño: logo de tuweeb sobre violeta
        im = Image.open(a.logo or os.path.join(PL, 'weeb-logo.png')).convert('RGBA'); fondo = Image.new('RGBA', (lado, lado), (255, 255, 255, 255) if a.logo else (76, 52, 112, 255))
        k = (lado * 0.72) / max(im.size); im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
        fondo.paste(im, ((lado - im.width) // 2, (lado - im.height) // 2), im); fondo.convert('RGB').save(destino); return
    im = Image.new('RGB', (lado, lado), c); d = ImageDraw.Draw(im); letra = (a.nombre.strip() or '?')[0].upper()
    try: f = ImageFont.truetype('DejaVuSans-Bold.ttf', int(lado * 0.55))
    except Exception: f = ImageFont.load_default()
    d.text((lado / 2, lado / 2), letra, fill=(255, 255, 255), font=f, anchor='mm'); im.save(destino)

for sub in ('panel', 'reservar'):
    d = os.path.join(a.salida, sub); os.makedirs(d, exist_ok=True)
    for f in os.listdir(os.path.join(PL, sub)): shutil.copy(os.path.join(PL, sub, f), os.path.join(d, f))
    shutil.copy(os.path.join(PL, 'base.css'), os.path.join(d, 'base.css')); shutil.copy(os.path.join(PL, 'weeb-logo.svg'), os.path.join(d, 'weeb-logo.svg'))
    if a.tema:
        shutil.copy(a.tema, os.path.join(d, 'tema.css')); ix = os.path.join(d, 'index.html'); h = open(ix, encoding='utf8').read()
        if 'tema.css' not in h:
            m = re.search(r'<link[^>]*href="(?:\./)?(?:panel|reservar)\.css[^>]*>', h)
            h = h.replace(m.group(0), m.group(0) + '\n<link rel="stylesheet" href="tema.css">', 1) if m else h.replace('</head>', '<link rel="stylesheet" href="tema.css">\n</head>', 1)
            h = h.replace('content="#2b1c44"', 'content="#1a0f3d"'); open(ix, 'w', encoding='utf8').write(h)
    json.dump({'api': a.api, **({'volver': a.volver} if sub == 'reservar' else {})}, open(os.path.join(d, 'config.json'), 'w'), indent=1)
shutil.copy(os.path.join(PL, 'juego', 'juego.js'), os.path.join(a.salida, 'juego.js'))   # hora de juego: lista, reserva y aviso emergente (la usa la web)
d = os.path.join(a.salida, 'panel')
try:
    for lado in (192, 512): icono(os.path.join(d, f'icon-{lado}.png'), lado)
except ImportError: print('AVISO: falta Pillow, sin íconos (pip install pillow)')
json.dump({'name': 'Panel ' + a.nombre, 'short_name': a.nombre[:12], 'start_url': './', 'scope': './', 'display': 'standalone', 'background_color': '#130a2e' if a.tema else '#1a1026', 'theme_color': '#1a0f3d' if a.tema else '#2b1c44',
           'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}]},
          open(os.path.join(d, 'manifest.webmanifest'), 'w'), ensure_ascii=False, indent=1)
if a.carga:   # logo propio en los cargadores
    for sub in ('panel', 'reservar'):
        dd = os.path.join(a.salida, sub); shutil.copy(a.carga, os.path.join(dd, 'carga.png'))
        for fn in os.listdir(dd):
            if fn.endswith(('.html', '.js')):
                fp = os.path.join(dd, fn); t = open(fp, encoding='utf8').read()
                if 'tuweeb-icono.svg' in t: open(fp, 'w', encoding='utf8').write(t.replace('tuweeb-icono.svg', 'carga.png').replace("alt: 'tuweeb'", "alt: ''").replace('alt="tuweeb"', 'alt=""'))
print(f'ok: {a.salida}/panel  y  {a.salida}/reservar')
try:   # foto de los datos para que la página de planes abra al instante (si el backend aún no tiene planes, se omite)
    sys.path.insert(0, AQUI); from congelar_datos import congelar; print('ok: %s (%d planes)' % congelar(api=a.api, salida=a.salida))
except Exception as e: print('AVISO: sin foto de datos (%s). Se puede hacer después con congelar_datos.py' % e)
