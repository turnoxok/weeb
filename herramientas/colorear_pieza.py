#!/usr/bin/env python3
"""Recolorea por rol las piezas ya insertadas en un proyecto (las identifica por el nombre: <prefijo>_<rol>_NN).
uso: colorear_pieza.py proyecto.json <prefijo> rol=#hex [rol=#hex ...]"""
import json,sys
j,pref,*cols=sys.argv[1:]; c=dict(x.split('=',1) for x in cols)
d=json.load(open(j)); n=0
for o in d['objects']:
    p=(o.get('label') or '').split('_')
    if len(p)>=3 and '_'.join(p[:-2])==pref and p[-2] in c: o['matColor']=c[p[-2]].lower(); n+=1
json.dump(d,open(j,'w'),ensure_ascii=False); print(f'{n} partes recoloreadas en {pref}')
