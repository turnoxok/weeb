#!/usr/bin/env python3
"""Arma proyectos/general: escenario GENERAL (para cualquier salón) a partir del de Planeta Niños: sin marciano, ovnis, torres,
logo, planeta del cartel, papelitos ni foquitos de neón. El pelotero lleva un techo de carpa de UNA sola pieza (techo-pelotero.glb)
que se recolorea con "Color" (tinte) del editor. El cartel de la nube queda vacío: ahí va el logo de cada cliente.
uso: crear_general.py"""
import re, os, json, base64, shutil, copy
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PN = os.path.join(REPO, 'proyectos', 'planetaninos')
OUT = os.path.join(REPO, 'proyectos', 'general'); M = os.path.join(OUT, 'assets', 'models')
os.makedirs(M, exist_ok=True)

src = open(os.path.join(PN, 'editor.html'), encoding='utf-8').read()
p = json.loads(base64.b64decode(re.search(r'id="embedded-project-b64"[^>]*>([^<]+)<', src).group(1)).decode())

# ---------- qué se saca
def sacar(o):
    t, l, i = o['type'], o.get('label', ''), o['id']
    if t in ('confetti',): return True                                   # papelitos en el aire
    if l.startswith('Confeti'): return True                              # estrellitas de confeti
    if i in ('obj-marciano3d', 'obj-ovni3d', 'obj-ovni2-3d', 'obj-torre3d', 'obj-1794163004943', 'obj-pn-0'): return True   # marciano, ovnis, torres y logo de PN
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
NO = {'marciano-rig.glb', 'ovni-3d.glb', 'ovni2-3d.glb', 'marciano.png', 'planetaninos-logo.png', 'planetaninos-marciano.png', 'logo-slogan.svg', 'torre-3d.glb'}
for f in os.listdir(os.path.join(PN, 'assets', 'models')):
    if f not in NO: shutil.copy(os.path.join(PN, 'assets', 'models', f), os.path.join(M, f))
LOGO = logo_placeholder()
open(os.path.join(M, 'logo-slogan.svg'), 'w').write(LOGO)
# techo del pelotero: perfil de carpa (cono apenas cóncavo), se gira como las cúpulas

# ---------- techo del pelotero: carpa de circo de UNA sola pieza (una malla, un material con textura de gajos)
# La textura es blanco / gris claro; el tinte del editor la multiplica, así el techo queda en dos tonos del color elegido.
import struct, io, math
import numpy as np
from PIL import Image
CX, CZ = -6.939, -1.590                     # centro de la plataforma del pelotero (x, z del visor)
ZL, R, HC, N, K = 7.0, 4.35, 2.5, 32, 24    # borde inferior de la carpa, radio, alto del cono, segmentos, anillos
G, UU, VV, DF = 16, 10, 4, 0.55             # festón: medios círculos, columnas, filas, profundidad
def techo_glb():
    P, NR, UV, IDX = [], [], [], []
    def quad(a, b, c, d, na, nb, nc, nd, u):
        i = len(P); P.extend([a, b, c, d]); NR.extend([na, nb, nc, nd]); UV.extend([(u, .5)] * 4); IDX.extend([i, i+1, i+2, i, i+2, i+3])
    def ver(x, y, z): return np.array([x, y, z], float)       # (x, y arriba, z): el visor es Y arriba
    # carpa: anillos (x=cos, z=sin) con radio R*t^1.18 y altura ZL+HC*(1-t)
    def rc(k, j):
        t = k / K; r = R * (t ** 1.18) if k else 1e-4; a = 2 * math.pi * j / N
        return ver(r * math.cos(a), ZL + (HC * (1 - t) if k < K else 0), -r * math.sin(a))
    def nrm(k, j):
        k1, k0 = min(k + 1, K), max(k - 1, 0); dj = rc(k, (j + 1) % N) - rc(k, (j - 1) % N); dk = rc(k1, j) - rc(k0, j)
        n = np.cross(dk, dj); n = n / (np.linalg.norm(n) or 1); return -n if n[1] < 0 and k < K else n
    for k in range(K):
        for j in range(N):
            ids = [(k, j), (k, (j + 1) % N), (k + 1, (j + 1) % N), (k + 1, j)]
            pts = [rc(*q) for q in ids]; ns = [nrm(*q) for q in ids]
            quad(pts[0], pts[3], pts[2], pts[1], ns[0], ns[3], ns[2], ns[1], .25 if (j // 2) % 2 == 0 else .75)
    # festón colgando del borde, color opuesto al gajo que tiene arriba
    RB = R * 1.005
    for g in range(G):
        a0, a1 = 2 * math.pi * g / G, 2 * math.pi * (g + 1) / G
        def fp(u, v):
            a = a0 + (a1 - a0) * u / UU; d = DF * math.sin(math.pi * u / UU) ** .7
            return ver(RB * math.cos(a), ZL - d * v / VV, -RB * math.sin(a)), ver(math.cos(a), 0, -math.sin(a))
        for u in range(UU):
            for v in range(VV):
                q = [fp(u, v), fp(u + 1, v), fp(u + 1, v + 1), fp(u, v + 1)]
                if sum(np.linalg.norm(q[i][0] - q[(i + 1) % 4][0]) < 1e-6 for i in range(4)) >= 1 and (u in (0, UU - 1) and v == VV - 0): continue
                quad(q[0][0], q[3][0], q[2][0], q[1][0], q[0][1], q[3][1], q[2][1], q[1][1], .75 if g % 2 == 0 else .25)
    # bolita de la punta
    rb, cy = 0.34, ZL + HC + 0.22
    for i in range(16):
        for j in range(24):
            def sp(ii, jj):
                th = math.pi * ii / 16; ph = 2 * math.pi * jj / 24; n = ver(math.sin(th) * math.cos(ph), math.cos(th), -math.sin(th) * math.sin(ph)); return n * rb + ver(0, cy, 0), n
            q = [sp(i, j), sp(i, j + 1), sp(i + 1, j + 1), sp(i + 1, j)]
            quad(q[0][0], q[3][0], q[2][0], q[1][0], q[0][1], q[3][1], q[2][1], q[1][1], .75)
    P = np.array(P); NR = np.array(NR); UV = np.array(UV, np.float32)
    lo, hi = P.min(0), P.max(0); ext = float((hi - lo).max())
    centro = (lo + hi) / 2; Pn = ((P - centro) / ext).astype(np.float32)            # centrado y de tamaño 1 (el visor lo escala)
    # el visor es Y arriba y mira hacia +z; quad() ya arma las caras con el frente hacia afuera
    img = Image.new('RGB', (64, 4)); px = img.load()
    for x in range(64):
        for y in range(4): px[x, y] = (255, 255, 255) if x < 32 else (214, 214, 214)
    bio = io.BytesIO(); img.save(bio, 'PNG'); png = bio.getvalue()
    pos, nor, uvb, idx = Pn.tobytes(), NR.astype(np.float32).tobytes(), UV.tobytes(), np.array(IDX, np.uint32).tobytes()
    pad = lambda b: b + b'\0' * ((4 - len(b) % 4) % 4)
    parts = [pos, nor, uvb, idx, png]; off = []; blob = b''
    for b in parts: off.append(len(blob)); blob += pad(b)
    n = len(P)
    js = {'asset': {'version': '2.0', 'generator': 'tuweeb'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'Techo pelotero'}],
          'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
          'materials': [{'name': 'Techo', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 0.45}}],
          'textures': [{'sampler': 0, 'source': 0}], 'samplers': [{'magFilter': 9728, 'minFilter': 9728, 'wrapS': 10497, 'wrapT': 10497}], 'images': [{'bufferView': 4, 'mimeType': 'image/png'}],
          'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': n, 'type': 'VEC3', 'min': Pn.min(0).tolist(), 'max': Pn.max(0).tolist()},
                        {'bufferView': 1, 'componentType': 5126, 'count': n, 'type': 'VEC3'}, {'bufferView': 2, 'componentType': 5126, 'count': n, 'type': 'VEC2'},
                        {'bufferView': 3, 'componentType': 5125, 'count': len(IDX), 'type': 'SCALAR'}],
          'bufferViews': [{'buffer': 0, 'byteOffset': off[i], 'byteLength': len(parts[i]), 'target': (34963 if i == 3 else 34962)} for i in range(4)] + [{'buffer': 0, 'byteOffset': off[4], 'byteLength': len(png)}],
          'buffers': [{'byteLength': len(blob)}]}
    jb = json.dumps(js, separators=(',', ':')).encode(); jb += b' ' * ((4 - len(jb) % 4) % 4)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(blob)) + struct.pack('<II', len(jb), 0x4E4F534A) + jb + struct.pack('<II', len(blob), 0x004E4942) + blob
    return glb, ext, centro
glb, EXT, CEN = techo_glb()
open(os.path.join(M, 'techo-pelotero.glb'), 'wb').write(glb)
O = {o['id']: o for o in p['objects']}; T = p['objectTransformsByKf']
ref_t = T['obj-1793994170674']                                   # "Pelotero columna 1": mismas etapas visibles que el pelotero
p['objects'] = [o for o in p['objects'] if o['id'] != 'obj-1793995751633-1']; T.pop('obj-1793995751633-1', None)   # el techo rojo viejo (oculto)
techo = {'id': 'obj-techo-pelotero', 'label': 'Techo pelotero', 'type': 'model', 'url': './assets/models/techo-pelotero.glb', 'previewUrl': None, 'billboard': False, 'visible': True,
         'color': '#ffffff', 'lit': True, 'shadows': True, 'shCast': True, 'folder': 'fld-13', 'tint': '#F5C93A', 'tintAmt': 1, 'hue': 0, 'sat': 1, 'light': 1}
p['objects'].append(techo)
T[techo['id']] = {st: {'position': [CX, round(float(CEN[1]), 4), CZ], 'scale': round(EXT, 4), 'rotationY': 0, 'hidden': ref_t[st]['hidden'], 'fadeDir': ref_t[st].get('fadeDir', 'ltr'), 'rx': 0, 'rz': 0, 'sx': 1, 'sy': 1} for st in ref_t}

# ---------- datos generales (neutros)
p['projectName'] = 'general'; p['savedAt'] = '2026-11-13T12:00:00.000Z'
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
