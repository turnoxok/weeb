#!/usr/bin/env python3
"""Arma proyectos/casaaventuras (demo): letras 3D del logo sobre cartel de madera, arco, casita del árbol, árboles, tobogán, puente.
Entrada: carpeta con letra-NN-X.svg (viewBox propio), mono.svg, meta.json y mono.json (salida de la vectorización del logo).
uso: crear_casaaventuras.py [carpeta_logo=/tmp/ca]"""
import re, os, json, base64, shutil, copy, sys, subprocess, math
import numpy as np, cv2
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/ca'
OUT = os.path.join(REPO, 'proyectos', 'casaaventuras'); M = os.path.join(OUT, 'assets', 'models')
os.makedirs(M, exist_ok=True)
BIB = os.path.join(REPO, 'biblioteca')

# ---------- paleta de la marca (logo + foto del escenario)
NARANJA, MARRON, MADERA, CREMA = '#F76E3F', '#A3502D', '#D9A05B', '#F6E3C3'
VERDE, VERDE_OSC, CELESTE, AMARILLO, VIOLETA = '#6FB43F', '#3E8E3A', '#7CC4F0', '#FFB52E', '#7B52AB'
PAL = [NARANJA, MARRON, MADERA, CREMA, VERDE, VERDE_OSC, CELESTE, AMARILLO, VIOLETA, '#ffffff']

# ---------- SVGs propios (solo rellenos, un color por archivo)
def svg(name, w, h, d):
    open(os.path.join(M, name), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><path fill="#cccccc" fill-rule="evenodd" d="{d}"/></svg>')
def rrect(x, y, w, h, r):
    return f'M{x+r},{y} H{x+w-r} Q{x+w},{y} {x+w},{y+r} V{y+h-r} Q{x+w},{y+h} {x+w-r},{y+h} H{x+r} Q{x},{y+h} {x},{y+h-r} V{y+r} Q{x},{y} {x+r},{y} Z'
def blob(name, circles, pad=6, S=4):
    """unión de círculos -> un solo contorno suave"""
    x0 = min(c[0] - c[2] for c in circles); y0 = min(c[1] - c[2] for c in circles); x1 = max(c[0] + c[2] for c in circles); y1 = max(c[1] + c[2] for c in circles)
    w, h = int((x1 - x0) * S) + 2 * pad, int((y1 - y0) * S) + 2 * pad
    m = np.zeros((h, w), np.uint8)
    for cx, cy, r in circles: cv2.circle(m, (int((cx - x0) * S) + pad, int((cy - y0) * S) + pad), int(r * S), 255, -1)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea); a = cv2.approxPolyDP(c, 1.2, True)[:, 0, :] / S
    d = 'M' + ' L'.join(f'{px:.2f},{py:.2f}' for px, py in a) + ' Z'
    svg(name, round(w / S, 2), round(h / S, 2), d)
    return round(w / S, 2), round(h / S, 2)

# cartel de madera: borde marrón + cara crema (con el contorno ondulado de la foto)
svg('ca-cartel-borde.svg', 100, 40, 'M4,12 Q8,2 22,4 Q50,-1 78,4 Q92,2 97,12 Q101,22 96,30 Q88,38 74,36 Q50,41 26,36 Q10,38 4,30 Q-1,21 4,12 Z')
svg('ca-cartel-cara.svg', 100, 40, 'M8,13 Q11,6 23,8 Q50,3 77,8 Q89,6 93,13 Q96,21 92,28 Q85,34 74,32 Q50,37 26,32 Q15,34 8,28 Q4,21 8,13 Z')
# casita del árbol
svg('ca-casa-cuerpo.svg', 60, 70, 'M6,70 V28 Q6,4 30,4 Q54,4 54,28 V70 Z')
svg('ca-casa-techo.svg', 80, 44, 'M4,40 Q4,34 12,30 L34,6 Q40,0 46,6 L68,30 Q76,34 76,40 Q76,44 70,44 H10 Q4,44 4,40 Z')
svg('ca-casa-ventana.svg', 20, 20, 'M10,0 A10,10 0 1 1 9.99,0 Z')
svg('ca-casa-puerta.svg', 22, 34, 'M0,34 V12 Q0,0 11,0 Q22,0 22,12 V34 Z')
svg('ca-casa-deck.svg', 110, 14, rrect(0, 0, 110, 14, 6))
svg('ca-baranda.svg', 110, 22, ''.join(rrect(4 + i * 17, 6, 6, 16, 2) + ' ' for i in range(7)) + rrect(0, 0, 110, 7, 3))
svg('ca-bandera.svg', 40, 26, 'M0,0 H3 V26 H0 Z M3,2 Q16,-2 22,4 Q30,10 40,6 Q36,12 38,18 Q28,22 20,16 Q12,12 3,16 Z')
svg('ca-tronco.svg', 30, 90, 'M6,90 Q9,60 8,30 Q8,10 12,0 H22 Q24,12 22,30 Q21,60 26,90 Z')
svg('ca-tronco-grueso.svg', 60, 90, 'M0,90 Q10,60 12,20 Q14,6 22,0 H38 Q46,6 48,20 Q50,60 60,90 Z')
svg('ca-piedra.svg', 40, 24, 'M0,24 Q0,8 14,4 Q30,-2 38,12 Q42,20 40,24 Z')
svg('ca-camino.svg', 60, 100, 'M18,0 H42 Q50,40 60,100 H0 Q10,40 18,0 Z')
svg('ca-arco.svg', 60, 60, 'M0,60 V26 Q0,0 30,0 Q60,0 60,26 V60 H44 V30 Q44,14 30,14 Q16,14 16,30 V60 Z')
svg('ca-suelo.svg', 100, 60, 'M6,30 Q4,8 30,6 Q50,3 70,6 Q96,8 94,30 Q96,52 70,54 Q50,57 30,54 Q4,52 6,30 Z')
svg('ca-tunel.svg', 50, 30, 'M0,30 V22 Q0,0 25,0 Q50,0 50,22 V30 H36 V22 Q36,12 25,12 Q14,12 14,22 V30 Z')
CW, CH = blob('ca-copa-1.svg', [(30, 40, 26), (58, 30, 30), (88, 42, 26), (60, 56, 30), (36, 62, 22), (84, 64, 22)])
CW2, CH2 = blob('ca-copa-2.svg', [(20, 26, 18), (44, 18, 22), (66, 28, 18), (44, 38, 20)])
blob('ca-arbusto.svg', [(14, 22, 12), (30, 16, 15), (46, 22, 12), (30, 28, 13)])
blob('ca-nube.svg', [(20, 30, 16), (44, 22, 22), (70, 28, 18), (92, 32, 12), (50, 38, 16)])
for f in os.listdir(SRC + '/svg'):
    if f.startswith('letra-') or f == 'mono.svg': shutil.copy(f'{SRC}/svg/{f}', os.path.join(M, 'ca-' + f))

# ---------- proyecto base = lemadavami (ajustes generales), contenido propio
src = open(os.path.join(REPO, 'proyectos', 'lemadavami', 'editor.html'), encoding='utf-8').read()
p = json.loads(base64.b64decode(re.search(r'id="embedded-project-b64"[^>]*>([^<]+)<', src).group(1)).decode())
p['brandColors'] = PAL; p['projectName'] = 'casaaventuras'; p['savedAt'] = '2026-11-13T00:00:00.000Z'
tpl = [o for o in p['objects'] if o.get('id') == 'obj-let-0'][0]
meta = json.load(open(SRC + '/meta.json')); mono_box = json.load(open(SRC + '/mono.json'))['box']
LW, LH = meta['W'], meta['H']
STAGES = ['pose-1', 'pose-2', 'pose-3', 'pose-4']
objs, T = [], {}
VBH = {}
def put(o, pos, sc, ry=0.0, raw=False, rx=0):
    if not raw: sc = sc * VBH.get(o['id'], 1)     # sc = unidades de escena por unidad del SVG; con raw=True es el alto en unidades
    if 'ext' in o: o['ext'] = round(o['ext'] / sc, 5)   # en el visor la profundidad es relativa al tamaño: aquí se piensa en unidades
    objs.append(o); T[o['id']] = {s: {'position': [round(v, 4) for v in pos], 'scale': round(sc, 5), 'rotationY': ry, 'hidden': False, 'fadeDir': 'ltr', 'sx': 1, 'sy': 1, 'rx': rx, 'rz': 0} for s in STAGES}
    return o
cnt = [0]
def img(label, fn, color, ext=0.05, bev=0.05, lit=True, **kw):
    cnt[0] += 1
    o = copy.deepcopy(tpl); o.pop('matColor', None)
    o.update(id=f'obj-ca-{cnt[0]:03d}', label=label, url='./assets/models/' + fn, ext=ext, bev=bev, litBase=0.12, lit=lit, color=color, matColor=color)
    o.update(kw); VBH[o['id']] = float(re.search(r'viewBox="[\d. -]+ ([\d.]+)"', open(os.path.join(M, fn)).read()).group(1)); return o
def flat(label, fn):
    cnt[0] += 1
    return {'id': f'obj-ca-{cnt[0]:03d}', 'label': label, 'type': 'image', 'url': './assets/models/' + fn, 'previewUrl': None, 'billboard': False, 'visible': True, 'color': '#ffffff', 'lit': False}

# --- cartel: 10 unidades de ancho para el texto del logo
X0 = min(b[0] for b in meta['letras'].values()); X1 = max(b[2] for b in meta['letras'].values())
Y0b = min(b[1] for b in meta['letras'].values()); Y1b = max(b[3] for b in meta['letras'].values())
TW = 9.0; S = TW / (X1 - X0); CXL, CYL = (X0 + X1) / 2, (Y0b + Y1b) / 2
SY0 = 8.6   # altura del centro del texto
def place(box):
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2; h = box[3] - box[1]
    return [(cx - CXL) * S, SY0 - (cy - CYL) * S, 0.5], h * S
# tablón
pl = put(img('Cartel borde', 'ca-cartel-borde.svg', MARRON, ext=0.5, bev=0.12), [0, SY0 + 0.1, -0.1], 0.108)
pl = put(img('Cartel cara', 'ca-cartel-cara.svg', '#FFF2D8', ext=0.3, bev=0.1, lit=True, litBase=0.75), [0, SY0 + 0.1, 0.25], 0.101)
for fn, bx in meta['letras'].items():
    pos, sc = place(bx)
    put(img('Letra ' + fn[-1], 'ca-' + fn + '.svg', NARANJA, ext=0.26, bev=0.12), pos, sc, raw=True)
mb = mono_box; mx = (mb[0] + mb[2]) / 2; my = (mb[1] + mb[3]) / 2
put(flat('Mono', 'ca-mono.svg'), [(mx - CXL) * S - 0.2, SY0 - (my - CYL) * S + 0.1, 0.9], (mb[3] - mb[1]) * S, raw=True)

# --- arco de piedra bajo el cartel
put(img('Suelo base', 'ca-suelo.svg', '#5E9E36', ext=0.5, bev=0.05), [0, -0.05, -5], 0.95, rx=-90)
put(img('Suelo cara', 'ca-suelo.svg', VERDE, ext=0.2, bev=0.05), [0, 0.2, -5], 0.92, rx=-90)
put(img('Arco piedra', 'ca-arco.svg', '#D8C7A6', ext=0.9, bev=0.1), [0, 3.1, -0.7], 0.105)
# --- pasto y camino

# --- casita del árbol (izquierda)
HX = -9.4
put(img('Tronco casa', 'ca-tronco-grueso.svg', MARRON, ext=0.5, bev=0.1), [HX - 1.0, 2.1, -0.8], 0.07)
put(img('Copa casa', 'ca-copa-1.svg', VERDE_OSC, ext=0.7, bev=0.25), [HX - 1.6, 7.6, -1.2], 0.085)
put(img('Casa cuerpo', 'ca-casa-cuerpo.svg', CREMA, ext=0.5, bev=0.14), [HX, 5.5, 0.2], 0.062)
put(img('Casa ventana', 'ca-casa-ventana.svg', MADERA, ext=0.1, bev=0.05), [HX - 0.7, 5.8, 0.75], 0.042)
put(img('Casa puerta', 'ca-casa-puerta.svg', MADERA, ext=0.1, bev=0.05), [HX + 0.6, 5.1, 0.75], 0.042)
put(img('Casa techo', 'ca-casa-techo.svg', NARANJA, ext=0.6, bev=0.15), [HX, 7.55, 0.25], 0.062)
put(img('Casa bandera', 'ca-bandera.svg', NARANJA, ext=0.08, bev=0.03), [HX + 0.55, 9.45, 0.2], 0.062)
put(img('Casa deck', 'ca-casa-deck.svg', MADERA, ext=0.9, bev=0.12), [HX + 0.4, 3.3, 0.3], 0.052)
put(img('Casa baranda', 'ca-baranda.svg', MADERA, ext=0.2, bev=0.06), [HX + 0.4, 4.0, 0.9], 0.052)

# --- árboles
for i, (x, z, k, col) in enumerate([(9.5, -2.0, 0.095, VERDE), (13.5, -3.0, 0.07, VERDE_OSC), (-14.5, -3.0, 0.075, VERDE), (-5.0, -4.5, 0.06, VERDE_OSC), (5.5, -4.5, 0.06, VERDE)]):
    put(img(f'Tronco {i}', 'ca-tronco.svg', MARRON, ext=0.4, bev=0.1), [x, 2.0 * (k / 0.07) * 0.5 + 0.3, z - 0.3], k * 1.05)
    put(img(f'Copa {i}', 'ca-copa-1.svg' if i % 2 == 0 else 'ca-copa-2.svg', col, ext=0.6, bev=0.22), [x, 5.2 * (k / 0.07) * 0.65 + 1.0, z], k * 1.0)
for i, (x, z, k) in enumerate([(-4.0, 3.0, 0.05), (4.5, 3.5, 0.06), (-12.0, 2.5, 0.06), (12.0, 2.5, 0.055), (-7.0, 4.5, 0.045)]):
    put(img(f'Arbusto {i}', 'ca-arbusto.svg', VERDE if i % 2 else VERDE_OSC, ext=0.5, bev=0.18), [x, 0.8, z], k * 1.0)
# --- piedras
for i, (x, z) in enumerate([(-2.2, 4.4), (3.0, 4.8), (10.5, 3.2)]):
    put(img(f'Piedra {i}', 'ca-piedra.svg', '#B9B2A4', ext=0.4, bev=0.14), [x, 0.5, z], 0.05)
# --- nubes
for i, (x, y, k) in enumerate([(-15, 13, 0.1), (6, 15, 0.075), (16, 11, 0.09)]):
    put(img(f'Nube {i}', 'ca-nube.svg', '#ffffff', ext=0.5, bev=0.25, lit=True, litBase=0.8), [x, y, -6], k)
p['objects'] = objs; p['objectTransformsByKf'] = T
zero_pose = p['posesByKf']['pose-l3']
p['stages'] = [{'id': s, 'label': f'Pose {i+1}'} for i, s in enumerate(STAGES)]
p['durationsVh'] = [100] * (len(STAGES) - 1); p['easings'] = ['smooth'] * (len(STAGES) - 1)
p['posesByKf'] = {s: zero_pose for s in STAGES}; p['movesByKf'] = {s: {'pos': [0, 0, 0], 'yaw': 0, 'pitch': 0} for s in STAGES}
CAMS = {'pose-1': ([0, 8.6, 26], [0, 8.0, 0]), 'pose-2': ([0, 8.0, 34], [0, 4.6, 0]), 'pose-3': ([-14, 6.0, 20], [-8, 5.0, 0]), 'pose-4': ([8, 5.0, 24], [3, 4.0, 0])}
p['camsByKf'] = {s: {'position': c[0], 'lookAt': c[1], 'fov': 50, 'roll': 0, 'arc': True} for s, c in CAMS.items()}
FX = {'light': {'color': '#ffffff', 'intensity': 0, 'azimuth': 330, 'elevation': 55, 'rimColor': '#ffffff', 'rimIntensity': 0, 'ambient': 0}, 'fog': {'enabled': False, 'color': '#ffffff', 'far': 20},
      'background': {'mode': 'gradient', 'from': '#6FBBEF', 'to': '#E4F4FF', 'angle': 180, 'alpha': 1, 'midOn': False}}
p['fxByKf'] = {s: copy.deepcopy(FX) for s in STAGES}
NOM = 'Casa Aventuras'
p['postFx'].update(ambIntensity=1.0, hemiIntensity=1.4, dirIntensity=0.8, exposure=2.1)
p['dock'].update(whatsappPhone='', address='')
p['fab'].update(waText='¡Hola! Quiero consultar por una reserva en Casa Aventuras.')
p['progressBar']['color'] = NARANJA; p['backTop']['color'] = NARANJA
p['site2d'].update(bg=VERDE_OSC, text='#ffffff', accent=NARANJA)
m = p['menu']; m.update(logoUrl='./assets/models/casaaventuras-logo.png', logoSize=64, autoContrast=False, btnColor=VERDE_OSC, btnBg='#ffffff', btnBgAlpha=0.75, bgColor=VERDE_OSC, bgColor2=VERDE, hoverColor=NARANJA, signUrl='', signText='')
m['items'] = [{'label': 'Inicio', 'type': 'pose', 'pose': 1, 'href': '', 'newTab': False}, {'label': 'Disponibilidad', 'type': 'url', 'href': './reservar/', 'newTab': False}, {'label': 'Instagram', 'type': 'url', 'href': 'https://www.instagram.com/casa.aventuras/', 'newTab': True}]
sec3d = p['sections'][0]; foot = [s for s in p['sections'] if s.get('type') == 'footer'][0]
foot.update(logo='./assets/models/casaaventuras-logo.png', text='Salón de fiestas y eventos infantiles. ¡Tu fiesta, una aventura!',
            col1Links='Inicio | #3d\nDisponibilidad | ./reservar/\nInstagram | https://www.instagram.com/casa.aventuras/', address='', phone='', whatsapp='', copyright='© 2026 Casa Aventuras')
p['sections'] = [sec3d, foot]
p['seo'].update(title='Casa Aventuras — Salón de fiestas infantiles', description='Salón de fiestas y eventos infantiles. Reservá tu fecha online.', siteName=NOM, lang='es-AR', url='', image='', themeColor=VERDE_OSC,
                businessType='EntertainmentBusiness', businessName=NOM, instagram='https://www.instagram.com/casa.aventuras/', favicon='./assets/models/favicon.png', imageAlt=NOM, logo='', email='', areaServed='',
                content='Casa Aventuras es un salón de fiestas y eventos infantiles.\n\n## Qué ofrece\n\n- Salón para cumpleaños y festejos infantiles.\n- Reservas online: elegí el día y el horario.\n')
LOGO_SVG = open(SRC + '/svg/logo-completo.svg', encoding='utf-8').read()
p['loader'].update(enabled=True, svg=LOGO_SVG, background='#ffffff', lineColor=NARANJA, minMs=1400)
JS = os.path.join(OUT, 'Weeb_Proyecto_Actual.json')
json.dump(p, open(JS, 'w'), ensure_ascii=False, indent=1)
AP = os.path.join(REPO, 'herramientas', 'agregar_pieza.py')
def pieza(*a): subprocess.run([sys.executable, AP, JS, *map(str, a)], check=True)
pieza('tobogan', '--pos', -4.6, 2.2, 0.9, '--escala', 1.5, '--color', 'rampa=' + AMARILLO, '--color', 'cuerpo=' + NARANJA, '--color', 'detalle=#FFD27A', '--nombre', 'Tobogán')
pieza('puente', '--pos', 1.6, 0.9, 6.0, '--escala', 1.25, '--color', 'piso=' + MADERA, '--color', 'estructura=' + MARRON, '--color', 'zocalo=#8A4A25', '--color', 'remaches=' + CREMA, '--nombre', 'Puente')
p = json.load(open(JS))
json.dump(p, open(JS, 'w'), ensure_ascii=False, indent=1)
b64 = base64.b64encode(json.dumps(p, ensure_ascii=False).encode()).decode()
new = re.sub(r'(<script id="embedded-project-b64" type="text/plain">)[^<]*(</script>)', lambda m_: m_.group(1) + b64 + m_.group(2), src, count=1)
open(os.path.join(OUT, 'editor.html'), 'w', encoding='utf-8').write(new)
print('ok objetos:', len(objs))

# ---------- reservas y panel: plantillas + tema (verde bosque + naranja del logo)
API = json.load(open(os.path.join(REPO, 'landing', 'planetaninos', 'reservar', 'config.json')))['api']   # demo: mismo servidor de prueba; el cliente real tendrá su hoja
subprocess.run([sys.executable, os.path.join(REPO, 'reservas', 'herramientas', 'armar_cliente.py'), '--api', API, '--nombre', NOM, '--color', NARANJA,
                '--logo', os.path.join(M, 'favicon.png'), '--salida', OUT], check=True, stdout=subprocess.DEVNULL)
tema = open(os.path.join(REPO, 'landing', 'planetaninos', 'reservar', 'tema.css'), encoding='utf-8').read()
MAPA = [('#406c38', '#2f6a33'), ('#386230', '#285a2c'), ('rgba(48,86,41,', 'rgba(38,84,44,'), ('rgba(44,80,38,', 'rgba(34,76,40,'), ('rgba(30,58,25,', 'rgba(26,60,32,'),
        ('rgba(14,32,11,', 'rgba(8,30,12,'), ('#477a3d', '#38803c'), ('#356030', '#2a5e2e'), ('#355c2e', '#295a2d'), ('#2f5429', '#234c27'),
        ('#b1c74d', NARANJA.lower()), ('rgba(177,199,77,', 'rgba(247,110,63,'), ('#1e3a19', '#3b1a0b'), ('Planeta Niños — tema verde: fondo verde oscuro, destacados verde claro + blanco', 'Casa Aventuras — tema: verde bosque, destacados naranja del logo + blanco'),
        ('../assets/models/planetaninos-marciano.png', '../assets/models/favicon.png')]
for a, b in MAPA: tema = tema.replace(a, b)
for sub in ('reservar', 'panel'):
    d = os.path.join(OUT, sub); open(os.path.join(d, 'tema.css'), 'w', encoding='utf-8').write(tema)
    h = open(os.path.join(d, 'index.html'), encoding='utf-8').read().replace('content="#2b1c44"', 'content="#2f6a33"')
    h = h.replace('<link rel="stylesheet" href="base.css">', '<link rel="stylesheet" href="base.css">', 1)
    if 'tema.css' not in h: h = re.sub(r'(<link rel="stylesheet" href="(?:reservar|panel)\.css">)', r'\1\n<link rel="stylesheet" href="tema.css">', h, count=1)
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(h)
sw = os.path.join(OUT, 'panel', 'sw.js'); s_ = open(sw, encoding='utf-8').read().replace("'panel.css', 'icon-192.png'", "'panel.css', 'tema.css', 'icon-192.png'").replace('weeb-panel-v1', 'weeb-panel-v2'); open(sw, 'w', encoding='utf-8').write(s_)
mf = os.path.join(OUT, 'panel', 'manifest.webmanifest'); j = json.load(open(mf)); j['background_color'] = j['theme_color'] = '#2f6a33'; json.dump(j, open(mf, 'w'), ensure_ascii=False, indent=1)
cj = os.path.join(OUT, 'reservar', 'config.json'); c = json.load(open(cj))
c['demo'] = {'nombre': NOM, 'logoUrl': '../assets/models/casaaventuras-logo.png', 'colorPrincipal': NARANJA, 'whatsapp': '', 'direccion': '', 'mapsUrl': '', 'transferAlias': '', 'transferCbu': '', 'transferTitular': ''}
c['demoAviso'] = 'Esto es una demostración: las reservas reales se activan cuando se conecta la hoja de Casa Aventuras.'
json.dump(c, open(cj, 'w'), ensure_ascii=False, indent=1)
shutil.rmtree(os.path.join(OUT, 'panel'))   # el panel usa la hoja de otro cliente: no se publica en la demo hasta tener la hoja propia
print('ok reservas')
