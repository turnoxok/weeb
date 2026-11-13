#!/usr/bin/env python3
"""Arma las carpetas de un cliente: <salida>/panel (PWA del dueño) y <salida>/reservar (página de reservas).
uso: armar_cliente.py --api https://script.google.com/macros/s/.../exec --nombre "Salón Demo" --color "#8149bd" [--logo logo.png] --salida proyectos/demo
Todo lo demás (logo, colores, WhatsApp, turnos, precios) se configura desde el panel / la hoja, no acá."""
import argparse, json, os, shutil, sys
AQUI = os.path.dirname(os.path.abspath(__file__)); PL = os.path.join(AQUI, '..', 'plantillas')
ap = argparse.ArgumentParser()
ap.add_argument('--api', required=True); ap.add_argument('--nombre', required=True); ap.add_argument('--color', default='#8149bd')
ap.add_argument('--volver', default='../', help='a dónde vuelve el botón "Volver a la web" de la página de reservas (default: ../)')
ap.add_argument('--logo', help='imagen del logo para el ícono de la app (png/jpg/svg no)'); ap.add_argument('--salida', required=True)
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
    json.dump({'api': a.api, **({'volver': a.volver} if sub == 'reservar' else {})}, open(os.path.join(d, 'config.json'), 'w'), indent=1)
d = os.path.join(a.salida, 'panel')
try:
    for lado in (192, 512): icono(os.path.join(d, f'icon-{lado}.png'), lado)
except ImportError: print('AVISO: falta Pillow, sin íconos (pip install pillow)')
json.dump({'name': 'Panel ' + a.nombre, 'short_name': a.nombre[:12], 'start_url': './', 'scope': './', 'display': 'standalone', 'background_color': '#1a1026', 'theme_color': '#2b1c44',
           'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}]},
          open(os.path.join(d, 'manifest.webmanifest'), 'w'), ensure_ascii=False, indent=1)
print(f'ok: {a.salida}/panel  y  {a.salida}/reservar')
