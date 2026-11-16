#!/usr/bin/env python3
"""Guarda una "foto" de los datos públicos del cliente (planes, precios, textos) como <salida>/planes-datos.json.
La página de planes la muestra al instante y después se actualiza sola con lo que haya en el panel.
uso: congelar_datos.py --api https://script.google.com/macros/s/.../exec --salida proyectos/demo
     congelar_datos.py --desde respuesta.json --salida proyectos/demo   (si la consola no llega a Google: la respuesta se baja desde un navegador)"""
import argparse, json, os, sys, urllib.request

def congelar(api=None, desde=None, salida='.'):
    if desde: j = json.load(open(desde, encoding='utf-8'))
    else:
        with urllib.request.urlopen(api + ('&' if '?' in api else '?') + 'action=config', timeout=30) as r: j = json.loads(r.read().decode('utf-8'))
    d = j.get('data') if isinstance(j, dict) and 'ok' in j else j
    if not isinstance(j, dict) or ('ok' in j and not j['ok']) or not d or not d.get('planes'): raise ValueError('la respuesta no trae planes')
    os.makedirs(salida, exist_ok=True); ruta = os.path.join(salida, 'planes-datos.json')
    json.dump(d, open(ruta, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':')); return ruta, len(d['planes'])

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--api'); ap.add_argument('--desde'); ap.add_argument('--salida', required=True); a = ap.parse_args()
    if not (a.api or a.desde): sys.exit('falta --api o --desde')
    try: ruta, n = congelar(a.api, a.desde, a.salida); print(f'ok: {ruta} ({n} planes)')
    except Exception as e: sys.exit(f'No se pudo guardar la foto de datos: {e}')
