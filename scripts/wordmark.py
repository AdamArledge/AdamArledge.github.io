#!/usr/bin/env python3
"""Generate the AAhairartistry wordmark as SVG.

A custom, heavy, forward-slanted wordmark with soft, rounded contours, small
counters and tight spacing where neighbouring letters touch and flow together.
It starts from Unbounded Black (SIL Open Font License, which allows modified
versions such as this) and reshapes it:

1. Each line is set glyph by glyph with tightened tracking, so some letters
   touch (AA, rt, st...).
2. The line is slanted forward.
3. Morphology on a high-resolution raster: an opening (shrink, then grow by
   the same radius) rounds every outer corner; a closing (grow, then shrink)
   fills the inside corners and joins with soft fillets, so touching letters
   flow into each other.
4. The outline is traced at sub-pixel precision and written as smooth cubic
   curves.

    python3 scripts/wordmark.py --font path/to/Unbounded-Black.ttf

Needs Python 3 with Pillow, numpy, scipy and scikit-image. Unbounded is free
from Google Fonts (use the weight 900 instance). Only runs when the wordmark's
design changes; scripts/build.mjs reads the output:

    assets/wordmark/<variant>.svg            standalone files (burgundy)
    templates/partials/wordmark-symbols.svg  <symbol>s the page reuses (currentColor)
"""

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
from skimage import measure

ROOT = Path(__file__).resolve().parent.parent
BURGUNDY = "#4A1C24"
SIZE = 800  # font size for the raster; the output is vector

# Per variant (lengths in em):
#   lines     text, one entry per line (stacked lines are left-aligned)
#   joins     letter pairs that fuse into one shape; every other pair keeps
#             an even, clear gap (no near-misses, which read as notches)
#   gap       the clear distance between letters that don't join
#   overlap   how far joined letters run into each other
#   slant     forward slant in degrees
#   round     outer-corner radius
#   fillet    radius of the soft inside corners where joined letters meet
#             (applied only around joins, so narrow openings such as the s's stay open)
# "small" is the header/footer version: wider gaps and smaller radii, so the
# counters and spaces stay open at 20px tall.
JOINS = {"AA", "ha", "rt"}
VARIANTS = {
    "line": dict(lines=["AAhairartistry"], joins=JOINS, gap=0.05, overlap=0.05, slant=14, round=0.045, fillet=0.022),
    "stack": dict(lines=["AAhair", "artistry"], joins=JOINS, gap=0.05, overlap=0.05, slant=14, round=0.045, fillet=0.022),
    "small": dict(lines=["AAhairartistry"], joins={"AA", "rt"}, gap=0.075, overlap=0.05, slant=14, round=0.03, fillet=0.015),
}
LINE_GAP = 0.16     # space between stacked lines, in em
MIN_COUNTER = 0.05  # enclosed openings smaller than this square (em) are filled
SMOOTH = 0.004      # edge smoothing before tracing, in em (removes raster ripples)
SOFTEN = 0.012      # inside-corner radius within each letter (softens counters), in em


def glyph(c, font, degrees, r_round):
    """One letter: rasterised, slanted forward, outer corners rounded and
    inside corners (counters, crotches) softened.
    Returns (mask, baseline row)."""
    asc, desc = font.getmetrics()
    pad = SIZE // 2
    img = Image.new("L", (int(font.getlength(c)) + pad * 2, asc + desc + pad * 2), 0)
    ImageDraw.Draw(img).text((pad, pad), c, font=font, fill=255)
    m = slant(np.asarray(img) > 127, pad + asc, degrees)
    m = grow(shrink(m, r_round), r_round)  # opening: round every outer corner
    r = SOFTEN * SIZE
    m = shrink(grow(np.pad(m, int(r) + 2), r), r)  # closing: soften inside corners
    ys, xs = np.nonzero(m)
    return m[ys.min():ys.max() + 1, xs.min():xs.max() + 1], pad + asc - ys.min()


def set_line(text, font, v):
    """Place the letters one at a time against what's already set: a pair in
    joins overlaps by a fixed amount; any other pair is pushed apart until its
    nearest points are exactly the gap apart. Returns the line's mask and
    the zones around each join, where fillets may be added."""
    asc, desc = font.getmetrics()
    glyphs = [glyph(c, font, v["slant"], v["round"] * SIZE) for c in text]
    height = asc + desc + SIZE
    top = SIZE // 2 + asc  # baseline row on the line canvas
    width = sum(g.shape[1] for g, _ in glyphs) + SIZE * 2
    line = np.zeros((height, width), bool)
    zones = np.zeros_like(line)
    reach = int(v["fillet"] * SIZE * 3)
    x = SIZE // 2
    for i, (g, base) in enumerate(glyphs):
        y0 = top - base
        if i:
            rows = slice(y0, y0 + g.shape[0])
            canvas = line[rows]
            right = np.where(canvas.any(1), canvas.shape[1] - 1 - np.argmax(canvas[:, ::-1], 1), -10**9)
            left = np.where(g.any(1), np.argmax(g, 1), 10**9)
            joined = text[i - 1] + text[i] in v["joins"]
            if joined:
                # Overlap: the deepest row runs `overlap` into the letter before
                x = int(np.max(right - left)) + 1 - int(v["overlap"] * SIZE)
            else:
                # True (Euclidean) clearance, found by bisection on the offset;
                # the distance map only needs the stretch near the new letter
                lo, hi = int(np.max(right - left)), int(np.max(right - left) + v["gap"] * SIZE * 3)
                c0 = max(0, lo - SIZE)
                dist = ndi.distance_transform_edt(~line[:, c0:hi + g.shape[1]])
                gy, gx = np.nonzero(g)
                while hi - lo > 1:
                    mid = (lo + hi) // 2
                    if dist[gy + y0, gx + mid - c0].min() >= v["gap"] * SIZE:
                        hi = mid
                    else:
                        lo = mid
                x = hi
        if i and joined:
            placed = np.zeros_like(line)
            placed[y0:y0 + g.shape[0], x:x + g.shape[1]] = g
            c0, c1 = max(0, x - SIZE), x + g.shape[1] + reach
            zones[:, c0:c1] |= grow(line[:, c0:c1], reach) & grow(placed[:, c0:c1], reach)
        line[y0:y0 + g.shape[0], x:x + g.shape[1]] |= g
    return line, zones


def slant(mask, baseline, degrees):
    """Shear forward around the baseline (tops move right)."""
    k = math.tan(math.radians(degrees))
    img = Image.fromarray(mask.astype(np.uint8) * 255)
    out = img.transform(img.size, Image.AFFINE, (1, k, -k * baseline, 0, 1, 0), resample=Image.BICUBIC)
    return np.asarray(out) > 127


def grow(mask, r):
    return ndi.distance_transform_edt(~mask) <= r


def shrink(mask, r):
    return ndi.distance_transform_edt(mask) > r


def crop(mask):
    ys, xs = np.nonzero(mask)
    return mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def build(variant, font_path):
    v = VARIANTS[variant]
    font = ImageFont.truetype(str(font_path), SIZE)
    hb = font.getbbox("H")
    cap = hb[3] - hb[1]

    lines = []
    for t in v["lines"]:
        m, z = set_line(t, font, v)
        ys, xs = np.nonzero(m)
        box = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
        lines.append((m[box], z[box]))
    gap = int(LINE_GAP * SIZE)
    width = max(m.shape[1] for m, _ in lines)
    height = sum(m.shape[0] for m, _ in lines) + gap * (len(lines) - 1)
    pad = int(SIZE * 0.2)
    mask = np.zeros((height + pad * 2, width + pad * 2), bool)
    zones = np.zeros_like(mask)
    y = pad
    for m, z in lines:
        mask[y:y + m.shape[0], pad:pad + m.shape[1]] = m
        zones[y:y + m.shape[0], pad:pad + m.shape[1]] = z
        y += m.shape[0] + gap

    r_fillet = v["fillet"] * SIZE
    # Closing (grow, then shrink): soft fillets, kept only where letters join
    mask |= shrink(grow(mask, r_fillet), r_fillet) & zones
    # Drop pinholes the closing leaves where letters meet (real counters are far larger)
    holes = ndi.binary_fill_holes(mask) & ~mask
    labels, n = ndi.label(holes)
    sizes = ndi.sum(holes, labels, range(1, n + 1))
    mask |= np.isin(labels, 1 + np.flatnonzero(sizes < (MIN_COUNTER * SIZE) ** 2))

    # Trace at sub-pixel precision on a lightly smoothed field
    field = ndi.gaussian_filter(mask.astype(np.float32), SMOOTH * SIZE)
    contours = measure.find_contours(np.pad(field, 1), 0.5)
    scale = 100.0 / cap  # 100 viewBox units per capital height
    paths = []
    for c in contours:
        pts = np.fliplr(c - 1) * scale  # (row, col) -> (x, y)
        if len(pts) < 8:
            continue
        paths.append(smooth_path(pts))
    ys, xs = np.nonzero(mask)
    margin = 2.0
    minx, miny = xs.min() * scale - margin, ys.min() * scale - margin
    maxx, maxy = (xs.max() + 1) * scale + margin, (ys.max() + 1) * scale + margin
    d = "".join(p(minx, miny) for p in paths)
    return f"0 0 {fmt(maxx - minx)} {fmt(maxy - miny)}", d


def fmt(n):
    s = f"{n:.1f}"
    s = s[:-2] if s.endswith(".0") else s
    return "0" if s == "-0" else s


def simplify(pts, tol):
    """Ramer-Douglas-Peucker on a closed polyline."""
    def rdp(p):
        if len(p) < 3:
            return p
        a, b = p[0], p[-1]
        ab = b - a
        n = np.hypot(*ab) or 1e-9
        dist = np.abs(ab[0] * (p[:, 1] - a[1]) - ab[1] * (p[:, 0] - a[0])) / n
        i = int(np.argmax(dist))
        if dist[i] > tol:
            return np.vstack([rdp(p[:i + 1])[:-1], rdp(p[i:])])
        return np.vstack([a, b])
    # Split the loop at its farthest pair so both halves are open curves
    far = int(np.argmax(np.hypot(*(pts - pts[0]).T)))
    return np.vstack([rdp(pts[:far + 1])[:-1], rdp(np.vstack([pts[far:], pts[:1]]))[:-1]])


def smooth_path(pts):
    """Closed contour -> smooth cubic path (centripetal Catmull-Rom through
    simplified points). Returns a function of the viewBox offset."""
    if np.allclose(pts[0], pts[-1]):
        pts = pts[:-1]
    p = simplify(pts, 0.18)
    n = len(p)
    segs = []
    for i in range(n):
        p0, p1, p2, p3 = p[i - 1], p[i], p[(i + 1) % n], p[(i + 2) % n]
        d1 = max(np.hypot(*(p1 - p0)) ** 0.5, 1e-6)
        d2 = max(np.hypot(*(p2 - p1)) ** 0.5, 1e-6)
        d3 = max(np.hypot(*(p3 - p2)) ** 0.5, 1e-6)
        # Centripetal Catmull-Rom tangents, converted to cubic control points
        t1 = (p2 - p1) / d2 - (p2 - p0) / (d1 + d2) + (p1 - p0) / d1
        t2 = (p3 - p2) / d3 - (p3 - p1) / (d2 + d3) + (p2 - p1) / d2
        c1 = p1 + t1 * d2 / 3
        c2 = p2 - t2 * d2 / 3
        segs.append((c1, c2, p2))

    def at(ox, oy):
        o = np.array([ox, oy])
        q = lambda a: f"{fmt(a[0])} {fmt(a[1])}"
        out = [f"M{q(p[0] - o)}"]
        prev = p[0] - o
        for c1, c2, e in segs:
            c1, c2, e = c1 - o, c2 - o, e - o
            # Relative coordinates keep the path data short
            out.append(f"c{q(c1 - prev)} {q(c2 - prev)} {q(e - prev)}")
            prev = e
        return ("".join(out) + "z").replace(" -", "-")
    return at


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--font", required=True, help="Unbounded weight 900 (Black) TTF")
    args = ap.parse_args()

    out_dir = ROOT / "assets" / "wordmark"
    out_dir.mkdir(parents=True, exist_ok=True)
    symbols = []
    for name in VARIANTS:
        view_box, d = build(name, args.font)
        (out_dir / f"{name}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" role="img" aria-label="AAhairartistry">'
            f'<path fill="{BURGUNDY}" fill-rule="evenodd" d="{d}"/></svg>\n')
        symbols.append(f'<symbol id="wordmark-{name}" viewBox="{view_box}"><path fill-rule="evenodd" d="{d}"/></symbol>')
        print(f"{name}: viewBox {view_box}, {len(d) / 1024:.1f} KB of path data")

    partial = ROOT / "templates" / "partials" / "wordmark-symbols.svg"
    partial.parent.mkdir(parents=True, exist_ok=True)
    partial.write_text("<!-- Generated by scripts/wordmark.py -->\n" + "\n".join(symbols) + "\n")


if __name__ == "__main__":
    main()
