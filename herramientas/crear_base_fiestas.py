#!/usr/bin/env python3
"""Arma proyectos/basefiestas: escenario NEUTRAL a partir del de Planeta Niños (sin marciano, ovnis, logo, planeta del cartel,
papelitos ni foquitos de neón; pelotero con techo propio). El logo del cartel es un archivo único (assets/models/logo-slogan.svg):
para otro cliente se reemplaza ese SVG (mismo alto/ancho aproximado) y se recolorea con la paleta del cliente.
uso: crear_base_fiestas.py"""
import re, os, json, base64, shutil, copy
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PN = os.path.join(REPO, 'proyectos', 'planetaninos')
OUT = os.path.join(REPO, 'proyectos', 'basefiestas'); M = os.path.join(OUT, 'assets', 'models')
os.makedirs(M, exist_ok=True)

src = open(os.path.join(PN, 'editor.html'), encoding='utf-8').read()
p = json.loads(base64.b64decode(re.search(r'id="embedded-project-b64"[^>]*>([^<]+)<', src).group(1)).decode())

# ---------- qué se saca
def sacar(o):
    t, l, i = o['type'], o.get('label', ''), o['id']
    if t in ('confetti',): return True                                   # papelitos en el aire
    if l.startswith('Confeti'): return True                              # estrellitas de confeti
    if i in ('obj-marciano3d', 'obj-ovni3d', 'obj-ovni2-3d'): return True   # marciano y ovnis
    if l in ('Planeta', 'Planeta anillo'): return True                   # planeta del cartel
    if l.startswith('Arco foconeon') or l.startswith('Puerta neon'): return True   # foquitos de neón
    return False
quitar = {o['id'] for o in p['objects'] if sacar(o)}
p['objects'] = [o for o in p['objects'] if o['id'] not in quitar]
for i in quitar: p['objectTransformsByKf'].pop(i, None)
for o in p['objects']:
    if o.get('parent') in quitar: o['parent'] = None

# ---------- logo del cartel: SVG de reemplazo ("TU LOGO"), mismo recuadro que el de Planeta Niños
VB_W, VB_H = 1307.58, 260.76
def logo_placeholder(texto='TU LOGO', colores=('#3FB9EA', '#F79A2E', '#E9468F', '#B3DD5E', '#7343C4', '#F5C93A')):
    f = TTFont('/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf'); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm
    xs, anch = [], 0
    for ch in texto: anch += gs[cmap[ord(ch)]].width
    k = VB_H * 0.78 / (upm * 0.74)       # alto de mayúscula ~ 0.74 em
    x0 = (VB_W - anch * k) / 2; y0 = VB_H * 0.88
    paths, x, c = [], x0, 0
    for ch in texto:
        g = gs[cmap[ord(ch)]]
        if ch != ' ':
            pen = SVGPathPen(gs); g.draw(TransformPen(pen, (k, 0, 0, -k, x, y0)))
            paths.append(f'<path fill="{colores[c % len(colores)]}" d="{pen.getCommands()}"/>'); c += 1
        x += g.width * k
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VB_W} {VB_H}" width="{VB_W}" height="{VB_H}">{"".join(paths)}</svg>'

# ---------- assets: solo lo que usa la escena neutral
shutil.rmtree(M); os.makedirs(M)
NO = {'marciano-rig.glb', 'ovni-3d.glb', 'ovni2-3d.glb', 'marciano.png', 'planetaninos-logo.png', 'planetaninos-marciano.png', 'logo-slogan.svg'}
for f in os.listdir(os.path.join(PN, 'assets', 'models')):
    if f not in NO: shutil.copy(os.path.join(PN, 'assets', 'models', f), os.path.join(M, f))
LOGO = logo_placeholder()
open(os.path.join(M, 'logo-slogan.svg'), 'w').write(LOGO)
# techo del pelotero: perfil de carpa (cono apenas cóncavo), se gira como las cúpulas
open(os.path.join(M, 'tw_cono.svg'), 'w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="50" height="50"><path fill="#cccccc" d="M0,0 ' + ' '.join(f'L{50*(k/40)**1.18:.3f},{50*k/40:.3f}' for k in range(1, 41)) + ' L0,50 Z"/></svg>')

# ---------- techo neutral del pelotero (en el lugar del ovni): falda + carpa + bolita
O = {o['id']: o for o in p['objects']}
T = p['objectTransformsByKf']
ref_t = T['obj-1793994170674']                               # "Pelotero columna 1": mismas etapas visibles que el pelotero
techo = O['obj-1793995751633-1']                             # "Pelotero techo rojo" (estaba oculto): se reutiliza
bola = copy.deepcopy(techo)
CX, CZ, BASE = -6.939, -1.590, 6.56                          # centro de la plataforma y tope de las columnas
C_CONO, C_FALDA, C_BOLA = '#F5C93A', '#E9468F', '#3FB9EA'
def trans(pos, scale, sx, sy):
    return {st: {'position': pos, 'scale': scale, 'rotationY': 0, 'hidden': ref_t[st]['hidden'], 'fadeDir': ref_t[st].get('fadeDir', 'ltr'), 'rx': 0, 'rz': 0, 'sx': sx, 'sy': sy} for st in ref_t}
RAD, H_CONO, H_FALDA, D_BOLA = 4.45, 2.5, 0.42, 0.75
techo.update(url='./assets/models/tw_cono.svg', label='Pelotero techo', matColor=C_CONO, mat='matte', matRough=0.45, visible=True, shadows=True, lit=True, shCast=True, bev=0.0)
T[techo['id']] = trans([CX, CZ_y := BASE + H_FALDA + H_CONO / 2 - 0.05, CZ], RAD, 1.0, H_CONO / RAD)
falda = copy.deepcopy(techo); falda.update(id='obj-techo-falda', label='Pelotero techo falda', matColor=C_FALDA, url='./assets/models/tw_cono.svg')
T[falda['id']] = trans([CX, BASE + H_FALDA / 2, CZ], RAD * 1.08, 1.0, H_FALDA / (RAD * 1.08))
bola.update(id='obj-techo-bola', label='Pelotero techo bolita', url='./assets/models/tw_esfera.svg', matColor=C_BOLA, mat='matte', matRough=0.3, visible=True, shadows=True, lit=True, shCast=True, bev=0.3, ext=0.01)
T[bola['id']] = trans([CX, BASE + H_FALDA + H_CONO + D_BOLA / 2 - 0.2, CZ], D_BOLA, 1.0, 1.0)
p['objects'] += [falda, bola]

# ---------- datos generales (neutros)
p['projectName'] = 'basefiestas'; p['savedAt'] = '2026-11-13T12:00:00.000Z'
p['seo'].update(title='Salón de fiestas infantiles', siteName='Tu salón', businessName='Tu salón', description='Salón de fiestas y eventos infantiles. Reservá tu fecha online.', logo='', url='', content='', imageAlt='Tu salón', areaServed='')
p['loader']['svg'] = LOGO
# logo en PNG (dock / pie / favicon) y textos de contacto neutros
from PIL import Image, ImageDraw, ImageFont
im = Image.new('RGBA', (512, 512), (0, 0, 0, 0)); d = ImageDraw.Draw(im); fnt = ImageFont.truetype('/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf', 150)
d.rounded_rectangle((16, 16, 496, 496), 110, fill='#3FB9EA'); d.text((256, 190), 'TU', font=fnt, fill='white', anchor='mm'); d.text((256, 340), 'LOGO', font=fnt, fill='white', anchor='mm')
im.save(os.path.join(M, 'logo-placeholder.png')); shutil.copy(os.path.join(M, 'logo-placeholder.png'), os.path.join(M, 'favicon.png'))
txt = json.dumps(p, ensure_ascii=False)
for a, b in [('./assets/models/planetaninos-marciano.png', './assets/models/logo-placeholder.png'), ('Av. Los Cisnes 2351, Oro Verde, Entre Ríos', 'Tu dirección, tu ciudad'), ('Av. Los Cisnes 2351', 'Tu dirección'),
             ('343 622 22 63', 'Tu teléfono'), ('5493436222263', ''), ('Planeta%20Ni%C3%B1os', 'tu%20sal%C3%B3n'), ('Planeta Ni%C3%B1os', 'tu%20sal%C3%B3n'), ('Planeta Niños', 'Tu salón'), ('Av.%20Los%20Cisnes%202351%2C%20Oro%20Verde%2C%20Entre%20R%C3%ADos', 'Tu%20direcci%C3%B3n'),
             ('Salón de fiestas y eventos infantiles en Oro Verde. ¡Tu fiesta, en otro planeta!', 'Salón de fiestas y eventos infantiles. ¡Tu fiesta, a lo grande!'), ('Oro Verde', 'tu ciudad')]:
    txt = txt.replace(a, b)
p = json.loads(txt)
json.dump(p, open(os.path.join(OUT, 'Weeb_Proyecto_Actual.json'), 'w'), ensure_ascii=False, indent=1)
b64 = base64.b64encode(json.dumps(p, ensure_ascii=False).encode()).decode()
new = re.sub(r'(<script id="embedded-project-b64" type="text/plain">)[^<]*(</script>)', lambda m_: m_.group(1) + b64 + m_.group(2), src, count=1)
open(os.path.join(OUT, 'editor.html'), 'w', encoding='utf-8').write(new)
print('ok: quitados', len(quitar), 'objetos', len(p['objects']))
