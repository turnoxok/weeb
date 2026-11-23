#!/usr/bin/env python3
"""Arma el script para pegar en Apps Script de un cliente: Codigo.gs + los datos iniciales del cliente (si los tiene) en un solo archivo.
uso: armar_script.py --cliente quokka --salida proyectos/quokka/sistema"""
import argparse, os, shutil
AQUI = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(AQUI, '..')
ap = argparse.ArgumentParser(); ap.add_argument('--cliente'); ap.add_argument('--salida', required=True); a = ap.parse_args()
os.makedirs(a.salida, exist_ok=True)
cod = open(os.path.join(R, 'backend', 'Codigo.gs'), encoding='utf8').read()
if a.cliente:
    cod += open(os.path.join(R, 'clientes', a.cliente, a.cliente.capitalize() + '.gs'), encoding='utf8').read()
open(os.path.join(a.salida, 'Codigo.gs'), 'w', encoding='utf8').write(cod)
shutil.copy(os.path.join(R, 'backend', 'appsscript.json'), os.path.join(a.salida, 'appsscript.json'))
print('ok:', a.salida, len(cod) // 1024, 'KB')
