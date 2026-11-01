import json,os,shutil,sys,math
sys.path.insert(0,'herramientas')
import numpy as np
from pieza_lib import tf_matrix,mat_to_tf
src=json.load(open('/home/claude/weeb/out/landing_actual.json'))
objs={o['id']:o for o in src['objects']}; tr=src['objectTransformsByKf']
MOD='/home/claude/disenoweeb/landing/assets/models'
PIEZAS={
 'tobogan':dict(titulo='Tobogán',madre='obj-tw-113',partes=['obj-tw-113','obj-tw-114','obj-tw-115','obj-tw-116','obj-tw-117','obj-tw-118','obj-tw-119'],
   roles={'rampa':['obj-tw-113'],'cuerpo':['obj-tw-114','obj-tw-115','obj-tw-117','obj-tw-118'],'detalle':['obj-tw-116','obj-tw-119']}),
 'puente':dict(titulo='Puente',madre='obj-tw-104',partes=['obj-tw-%d'%i for i in range(104,113)],
   roles={'piso':['obj-tw-104'],'estructura':['obj-tw-105','obj-tw-108','obj-tw-109','obj-tw-112'],'zocalo':['obj-tw-106','obj-tw-110'],'remaches':['obj-tw-107','obj-tw-111']}),
 'arco':dict(titulo='Arco (final del puente)',madre='obj-tw-015',partes=['obj-tw-015','obj-tw-016','obj-tw-017','obj-tw-018'],
   roles={'arco':['obj-tw-015','obj-tw-017'],'neon':['obj-tw-016'],'detalle':['obj-tw-018']}),
}
os.makedirs('biblioteca',exist_ok=True)
indice=[]
for nombre,P in PIEZAS.items():
    d=f'biblioteca/{nombre}'; os.makedirs(d+'/svg',exist_ok=True)
    Mm=tf_matrix(tr[P['madre']]['pose-f00']); Minv=np.linalg.inv(Mm)
    partes=[]
    for i,pid in enumerate(P['partes']):
        o=dict(objs[pid]); fn=o['url'].split('/')[-1]
        shutil.copy(f'{MOD}/{fn}',f'{d}/svg/{fn}')
        t=tr[pid]['pose-f00']
        rol=[r for r,l in P['roles'].items() if pid in l][0]
        if pid==P['madre']: local=dict(t)
        else: local=mat_to_tf(Minv@tf_matrix(t),t)
        for k in ('id','parent'): o.pop(k,None)
        partes.append(dict(clave=f'{nombre}_{i:02d}',rol=rol,esMadre=pid==P['madre'],objeto=o,pose=local))
    roles={}
    for r,l in P['roles'].items():
        roles[r]=objs[l[0]].get('matColor')
    pj=dict(nombre=nombre,titulo=P['titulo'],version=1,origen='tuweeb 2026-10-30',madre=f'{nombre}_{P["partes"].index(P["madre"]):02d}',
        nota='La madre guarda su pose absoluta de referencia; los hijos son RELATIVOS a la madre (como en el editor). Al insertar se puede mover/escalar/girar solo la madre.',
        roles=roles,partes=partes)
    json.dump(pj,open(d+'/pieza.json','w'),ensure_ascii=False,indent=1)
    indice.append(dict(nombre=nombre,titulo=P['titulo'],partes=len(partes),roles=list(roles)))
json.dump(indice,open('biblioteca/indice.json','w'),ensure_ascii=False,indent=1)
print(indice)
