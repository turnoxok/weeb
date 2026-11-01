#!/usr/bin/env python3
"""Agrega una pieza de la biblioteca a un proyecto Weeb (JSON).
uso: agregar_pieza.py proyecto.json tobogan [--pos X Y Z] [--giro GRADOS] [--escala K]
        [--color rol=#hex ...] [--nombre prefijo] [--assets carpeta/assets/models] [--salida otro.json]
La pieza entra como GRUPO: una madre + hijos relativos (el editor los mueve en bloque; 'Aislar' los muestra solos)."""
import argparse,json,os,shutil,sys,time
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
BIB=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','biblioteca')
ap=argparse.ArgumentParser(); ap.add_argument('proyecto'); ap.add_argument('pieza')
ap.add_argument('--pos',nargs=3,type=float); ap.add_argument('--giro',type=float,default=0); ap.add_argument('--escala',type=float,default=1)
ap.add_argument('--color',action='append',default=[]); ap.add_argument('--nombre'); ap.add_argument('--assets'); ap.add_argument('--salida')
a=ap.parse_args()
P=json.load(open(f'{BIB}/{a.pieza}/pieza.json')); proy=json.load(open(a.proyecto))
stages=[s['id'] for s in proy['stages']]; nom=a.nombre or a.pieza
cols=dict(c.split('=',1) for c in a.color)
bad=[r for r in cols if r not in P['roles']]
if bad: sys.exit(f"rol(es) desconocido(s): {bad}. Roles de {a.pieza}: {list(P['roles'])}")
assets=a.assets or os.path.join(os.path.dirname(os.path.abspath(a.proyecto)),'assets','models'); os.makedirs(assets,exist_ok=True)
falt=[p['objeto']['url'].split('/')[-1] for p in P['partes'] if not os.path.exists(f"{BIB}/{a.pieza}/svg/"+p['objeto']['url'].split('/')[-1])]
if falt: sys.exit(f"faltan SVG en biblioteca/{a.pieza}/svg/: {falt}")
base=int(time.time()*1000); ids={p['clave']:f'obj-{base}-{i}' for i,p in enumerate(P['partes'])}
usados={o['label'] for o in proy['objects']}
for i,p in enumerate(P['partes']):
    o=dict(p['objeto']); o['id']=ids[p['clave']]
    fn=o['url'].split('/')[-1]; shutil.copy(f'{BIB}/{a.pieza}/svg/{fn}',os.path.join(assets,fn))
    o['label']=f"{nom}_{p['rol']}_{i:02d}"
    if p['rol'] in cols: o['matColor']=cols[p['rol']].lower()
    pose=dict(p['pose'])
    if p['esMadre']:
        if a.pos: pose['position']=a.pos
        pose['rotationY']=round((pose.get('rotationY') or 0)+a.giro,4); pose['scale']=round(pose['scale']*a.escala,5)
    else: o['parent']=ids[P['madre']]
    proy['objects'].append(o)
    proy['objectTransformsByKf'][o['id']]={k:{**pose,'hidden':False,'fadeDir':'ltr'} for k in stages}
json.dump(proy,open(a.salida or a.proyecto,'w'),ensure_ascii=False)
print(f"ok: {len(P['partes'])} partes de '{a.pieza}' agregadas ({ids[P['madre']]} es la madre)")
