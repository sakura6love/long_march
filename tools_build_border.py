import json, io, math
from PIL import Image, ImageDraw, ImageFilter

tj = json.load(io.open('public/geo/countries-50m.json', encoding='utf-8'))
tr = tj['transform']; sx, sy = tr['scale']; tx, ty = tr['translate']

arcs = []
for arc in tj['arcs']:
    x = y = 0; pts = []
    for dx, dy in arc:
        x += dx; y += dy
        pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)

def join(idx_list):
    out = []
    for i in idx_list:
        seg = arcs[~i][::-1] if i < 0 else arcs[i]
        out.extend(seg if not out else seg[1:])
    return out

want = {'China', 'Taiwan', 'Hong Kong', 'Macao'}
polys = []
for g in tj['objects']['countries']['geometries']:
    if (g.get('properties') or {}).get('name') not in want:
        continue
    polys.extend(g['arcs'] if g['type'] != 'Polygon' else [g['arcs']])

rings = []
for poly in polys:
    for ri, ridx in enumerate(poly):
        if ri > 0:
            continue
        pts = join(ridx)
        if len(pts) >= 20:
            rings.append(pts)
print('raw rings', len(rings), 'points', sum(len(r) for r in rings))

def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    norm = math.hypot(dx, dy) or 1e-9
    dmax, idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs(dy * px - dx * py + b[0] * a[1] - b[1] * a[0]) / norm
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [a, b]

simp = []
for r in rings:
    closed = len(r) > 2 and r[0] == r[-1]
    body = r[:-1] if closed else r
    s = rdp(body, 0.02)
    if closed and s:
        s = s + [s[0]]
    if len(s) >= 8:
        simp.append(s)

out = [[[round(x, 3), round(y, 3)] for x, y in r] for r in simp]
io.open('public/geo/china-border.json', 'w', encoding='utf-8').write(
    json.dumps({'rings': out}, separators=(',', ':')))
print('rings', len(out), 'points', sum(len(r) for r in out))

W, H = 4096, 2048
img = Image.new('L', (W, H), 0)
d = ImageDraw.Draw(img)
for r in out:
    xy = [((x + 180) / 360 * W, (90 - y) / 180 * H) for x, y in r]
    d.polygon(xy, fill=255)
img.filter(ImageFilter.GaussianBlur(1.2)).save('public/bake/china.png')
print('mask saved')
