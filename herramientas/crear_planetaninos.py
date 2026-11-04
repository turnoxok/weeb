#!/usr/bin/env python3
"""Arma proyectos/planetaninos: letras del cartel (posiciones sacadas del logo completo), marciano, loader, paleta, editor.html.
Parte del proyecto de lemadavami (ajustes generales) y reemplaza lo propio del cliente."""
import re, os, json, base64, shutil, copy, sys
from svgpathtools import parse_path
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/user-data/uploads/Planeta Niños'
OUT = os.path.join(REPO, 'proyectos', 'planetaninos'); M = os.path.join(OUT, 'assets', 'models')
os.makedirs(M, exist_ok=True)

def paths(f):
    s = open(os.path.join(SRC, f), encoding='utf-8').read()
    cols = dict(re.findall(r'\.(fil\d+)\s*\{fill:(#[0-9A-Fa-f]{6}|white)\}', s))
    return [(cols.get(m.group(1)), m.group(2)) for m in re.finditer(r'<path class="(fil\d+)" d="([^"]+)"', s)]
def bb(d): x0, x1, y0, y1 = parse_path(d).bbox(); return [x0, y0, x1, y1]
def union(bs): return [min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs)]

# ---- 1) letras: cada archivo de letra se empareja con su lugar en el logo por proporción (alto/ancho)
logo = paths('logo-completo.svg')
fb = {}
for ch in 'PLANETIOS':
    fb[ch] = bb(paths(ch + '.svg')[0][1])
fb['Ñ'] = bb(paths('Ñ.svg')[0][1])
asp = lambda b: (b[2] - b[0]) / (b[3] - b[1])
# lugares del texto en el logo (índices de paths) en orden de lectura: P L A N E T A N I Ñ O S
ORDER = [(7, 'P'), (10, 'L'), (4, 'A'), (1, 'N'), (8, 'E'), (9, 'T'), (5, 'A'), (0, 'N'), (11, 'I'), ((2, 12), 'Ñ'), (3, 'O'), (6, 'S')]
slots = []
for idx, ch in ORDER:
    if isinstance(idx, tuple): box = union([bb(logo[i][1]) for i in idx]); col = logo[idx[0]][1 - 1 + 0][0] if False else logo[idx[0]][0]
    else: box = bb(logo[idx][1]); col = logo[idx][0]
    own = paths(ch + '.svg')[0][0]
    assert abs(asp(box) - asp(fb[ch])) < 0.03, (ch, asp(box), asp(fb[ch]))   # el archivo es la misma letra que en el logo
    slots.append((ch, box, col, own))
names = {c: 'cartel-' + ('Enie' if c == 'Ñ' else c) + '.svg' for c in 'PLANETIOSÑ'}
for ch, n in names.items(): shutil.copy(os.path.join(SRC, ch + '.svg'), os.path.join(M, n))
shutil.copy(os.path.join(SRC, 'marciano.svg'), os.path.join(M, 'marciano.svg'))
shutil.copy(os.path.join(SRC, 'marciano.png'), os.path.join(M, 'marciano.png'))
shutil.copy(os.path.join(SRC, 'logo-completo.png'), os.path.join(M, 'planetaninos-logo.png'))
from PIL import Image
im = Image.open(os.path.join(SRC, 'marciano.png')).convert('RGBA'); L = max(im.size); sq = Image.new('RGBA', (L, L), (0, 0, 0, 0)); sq.paste(im, ((L - im.width) // 2, (L - im.height) // 2), im)
sq.resize((192, 192), Image.LANCZOS).save(os.path.join(M, 'favicon.png'))

# ---- 2) marciano: todo lo que no son letras (en unidades del logo)
mar_box = union([bb(d) for i, (c, d) in enumerate(logo) if i >= 13])
LW, LH = 11808.0, 11994.92
S = 10.0 / LW            # unidades de escena por unidad del logo (cartel de 10 de ancho)
Y0 = 6.2                 # altura del centro del cartel
def place(box):
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2; h = box[3] - box[1]
    return [round((cx - LW / 2) * S, 4), round(Y0 - (cy - LH / 2) * S, 4), 0.0], round(h * S, 4)

# ---- 3) proyecto: base de lemadavami (ajustes generales), contenido propio
src = open(os.path.join(REPO, 'proyectos', 'lemadavami', 'editor.html'), encoding='utf-8').read()
p = json.loads(base64.b64decode(re.search(r'id="embedded-project-b64"[^>]*>([^<]+)<', src).group(1)).decode())
PAL = ['#3BADE3', '#F1BC19', '#DB3C63', '#E97525', '#ACD03B', '#634D9E', '#5DB046', '#449946', '#1F7846', '#0E0F1A', '#ffffff']
p['brandColors'] = PAL; p['projectName'] = 'planetaninos'; p['savedAt'] = '2026-11-04T00:00:00.000Z'
tpl_letter = [o for o in p['objects'] if o.get('id') == 'obj-let-0'][0]
objs, T, ST = [], {}, 'pose-1'
def tf(pos, sc): return {ST: {'position': pos, 'scale': sc, 'rotationY': 0, 'hidden': False, 'fadeDir': 'ltr', 'sx': 1, 'sy': 1, 'rx': 0, 'rz': 0}}
pos, sc = place(mar_box)
mar = {'id': 'obj-pn-marciano', 'label': 'Marciano', 'type': 'image', 'url': './assets/models/marciano.svg', 'previewUrl': None, 'billboard': False, 'visible': True, 'color': '#5DB046', 'lit': False}
objs.append(mar); T[mar['id']] = tf(pos, sc)
for i, (ch, box, col, own) in enumerate(slots):
    o = copy.deepcopy(tpl_letter); o.pop('matColor', None)
    o.update(id=f'obj-pn-{i}', label=f'Letra {ch} ({i+1})', url='./assets/models/' + names[ch], ext=0.14, bev=0.16, litBase=0.12)
    if col.lower() != own.lower(): o['matColor'] = col      # la segunda A y la primera N cambian de color respecto del archivo
    objs.append(o); pos, sc = place(box); T[o['id']] = tf(pos, sc)
p['objects'] = objs; p['objectTransformsByKf'] = T
zero_pose = p['posesByKf']['pose-l3']
p['stages'] = [{'id': ST, 'label': 'Pose 1'}]; p['durationsVh'] = []; p['easings'] = []
p['posesByKf'] = {ST: zero_pose}; p['movesByKf'] = {ST: {'pos': [0, 0, 0], 'yaw': 0, 'pitch': 0}}
p['camsByKf'] = {ST: {'position': [0, Y0 + 0.4, 24], 'lookAt': [0, Y0 - 0.4, 0], 'fov': 50, 'roll': 0, 'arc': True}}
p['fxByKf'] = {ST: {'light': {'color': '#ffffff', 'intensity': 0, 'azimuth': 330, 'elevation': 55, 'rimColor': '#9977b7', 'rimIntensity': 0, 'ambient': 0}, 'fog': {'enabled': False, 'color': '#05070a', 'far': 20},
                    'background': {'mode': 'gradient', 'from': '#f6fcec', 'to': '#d3edbd', 'angle': 180, 'alpha': 1, 'midOn': False}}}
WA = '5493436222263'; DIR = 'Av. Los Cisnes 2351, Oro Verde, Entre Ríos'; NOM = 'Planeta Niños'
p['postFx'].update(ambIntensity=1.0, hemiIntensity=1.4, dirIntensity=0.8, exposure=1.55)
p['dock'].update(whatsappPhone=WA, address=DIR)
p['fab'].update(waText='¡Hola! Quiero consultar por una reserva en Planeta Niños.')
p['progressBar']['color'] = '#F1BC19'; p['backTop']['color'] = '#5DB046'
p['site2d'].update(bg='#1F7846', text='#ffffff', accent='#F1BC19')
m = p['menu']; m.update(logoUrl='./assets/models/planetaninos-logo.png', logoSize=64, autoContrast=False, btnColor='#1F7846', btnBg='#ffffff', btnBgAlpha=0.75, bgColor='#1F7846', bgColor2='#5DB046', hoverColor='#F1BC19', signUrl='', signText='')
WAL = f'https://wa.me/{WA}?text=' + 'Hola%21%20Quiero%20consultar%20por%20un%20festejo%20en%20Planeta%20Ni%C3%B1os.'
m['items'] = [{'label': 'Inicio', 'type': 'pose', 'pose': 1, 'href': '', 'newTab': False}, {'label': 'Invitaciones', 'type': 'url', 'sec': '', 'href': './invitacion.html', 'newTab': False},
              {'label': 'Disponibilidad', 'type': 'url', 'href': './reservar/', 'newTab': False}, {'label': 'Panel', 'type': 'url', 'href': './panel/', 'newTab': False},
              {'label': 'Contacto', 'type': 'url', 'href': WAL, 'newTab': True}]
sec3d = p['sections'][0]; foot = [s for s in p['sections'] if s.get('type') == 'footer'][0]
foot.update(logo='./assets/models/planetaninos-logo.png', text='Salón de fiestas y eventos infantiles en Oro Verde. ¡Tu fiesta, en otro planeta!',
            col1Links='Inicio | #3d\nInvitaciones | ./invitacion.html\nDisponibilidad | ./reservar/\nPanel | ./panel/\nContacto | ' + WAL,
            address=DIR, phone='343 622 22 63', whatsapp=WA, copyright='© 2026 Planeta Niños')
p['sections'] = [sec3d, foot]
seo = p['seo']
seo.update(title='Planeta Niños — Salón de fiestas infantiles en Oro Verde', description='Salón de fiestas y eventos infantiles en Oro Verde, Entre Ríos. Reservá tu fecha online y armá la invitación de tu fiesta.',
           siteName=NOM, lang='es-AR', url='https://www.tuweeb.com/planetaninos/', image='', themeColor='#5DB046', businessType='EntertainmentBusiness', businessName=NOM,
           instagram='', favicon='./assets/models/favicon.png', imageAlt='Planeta Niños', logo='https://www.tuweeb.com/planetaninos/assets/models/planetaninos-logo.png', email='', areaServed='Oro Verde, Entre Ríos',
           content='Planeta Niños es un salón de fiestas y eventos infantiles en Av. Los Cisnes 2351, Oro Verde, Entre Ríos.\n\n## Qué ofrece\n\n- Salón para cumpleaños y festejos infantiles.\n- Reservas online: elegí el día y el horario.\n- Invitación online para compartir por WhatsApp.\n\n## Contacto\n\nWhatsApp 343 622 22 63. Av. Los Cisnes 2351, Oro Verde.')
# loader: logo-loader.svg limpio
ls = open(os.path.join(SRC, 'logo-loader.svg'), encoding='utf-8').read()
ls = re.sub(r'<\?xml[^>]*\?>|<!DOCTYPE[^>]*>|<!--.*?-->|<metadata[^>]*/>', '', ls, flags=re.S).strip()
p['loader'].update(enabled=True, svg=ls, background='#ffffff', lineColor='#1F7846', minMs=1400)
json.dump(p, open(os.path.join(OUT, 'Weeb_Proyecto_Actual.json'), 'w'), ensure_ascii=False, indent=1)
b64 = base64.b64encode(json.dumps(p, ensure_ascii=False).encode()).decode()
new = re.sub(r'(<script id="embedded-project-b64" type="text/plain">)[^<]*(</script>)', lambda m_: m_.group(1) + b64 + m_.group(2), src, count=1)
open(os.path.join(OUT, 'editor.html'), 'w', encoding='utf-8').write(new)
print('ok letras:', [(c, [round(v) for v in b]) for c, b, _, _ in slots][:3], 'marciano', place(mar_box))
