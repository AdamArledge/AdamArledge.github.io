#!/usr/bin/env python3
"""Generate the banded AAhairartistry wordmark as SVG.

The letters are drawn in a heavy geometric font, sliced into thick horizontal
bands with narrow gaps, and every piece of band that falls inside a letter
becomes a capsule (a bar with fully rounded ends). Each capsule is then bent
by a gentle travelling wave, so the bands flow through the word and the
letter edges come out soft and wavy, like the "tones" type specimen.

    python3 scripts/wordmark.py --font path/to/Poppins-ExtraBold.ttf

Needs Python 3 with Pillow and numpy. Poppins ExtraBold (SIL Open Font
License) is free from Google Fonts. This only has to run when the wordmark's
design changes; the site build (scripts/build.mjs) just reads the output:

    assets/wordmark/<variant>.svg            standalone files (burgundy)
    templates/partials/wordmark-symbols.svg  <symbol>s the page reuses (currentColor)
"""

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BURGUNDY = "#4A1C24"

# Each variant: the lines of text, how many bands fit in a capital letter,
# the gap as a share of each band's pitch, and the wave's height and length
# (as fractions of the capital height).
VARIANTS = {
    # One line, used for the hero on wide screens
    "line": dict(lines=["AAhairartistry"], bands=7, gap=0.18, amp=0.08, wavelength=2.4),
    # Two lines, used for the hero on phones
    "stack": dict(lines=["AAhair", "artistry"], bands=7, gap=0.18, amp=0.08, wavelength=2.0),
    # (Header and footer use plain text: below ~300px wide the bands blur together.)
}

RENDER_SIZE = 600  # font size used for rasterising; output is vector anyway


def render_mask(lines, font, line_pitch):
    """Rasterise the text; returns (mask 0..1, list of (baseline_y, cap_top_y)).
    line_pitch is the baseline-to-baseline distance for stacked lines."""
    asc, desc = font.getmetrics()
    cap_top = font.getbbox("H")[1]  # distance from the ascender line to the top of a capital
    widths = [font.getbbox(t)[2] for t in lines]
    pad = RENDER_SIZE // 2
    W = max(widths) + pad * 2
    H = int(asc + desc + line_pitch * (len(lines) - 1)) + pad * 2
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    rows = []
    for i, t in enumerate(lines):
        y = pad + int(i * line_pitch)
        d.text((pad, y), t, font=font, fill=255)
        rows.append((y + asc, y + cap_top))  # baseline, top of capitals
    return np.asarray(img, dtype=np.float32) / 255.0, rows


def runs(cov, threshold=0.5):
    on = cov > threshold
    edges = np.flatnonzero(np.diff(on.astype(np.int8)))
    starts = list(edges[~on[edges]] + 1) if len(edges) else []
    ends = list(edges[on[edges]] + 1) if len(edges) else []
    if on[0]:
        starts = [0] + starts
    if on[-1]:
        ends = ends + [len(on)]
    return list(zip(starts, ends))


def capsule(x0, x1, yc, r, step):
    """Outline points of a horizontal capsule, clockwise."""
    rx = min(r, (x1 - x0) / 2)
    pts = []
    a, b = x0 + rx, x1 - rx
    n = max(1, int(math.ceil((b - a) / step)))
    for i in range(n + 1):
        pts.append((a + (b - a) * i / n, yc - r))
    for i in range(1, 10):
        t = -math.pi / 2 + math.pi * i / 10
        pts.append((b + rx * math.cos(t), yc + r * math.sin(t)))
    for i in range(n + 1):
        pts.append((b - (b - a) * i / n, yc + r))
    for i in range(1, 10):
        t = math.pi / 2 + math.pi * i / 10
        pts.append((a + rx * math.cos(t), yc + r * math.sin(t)))
    return pts


def build(variant, font_path):
    v = VARIANTS[variant]
    font = ImageFont.truetype(str(font_path), RENDER_SIZE)
    cap = font.getbbox("H")[3] - font.getbbox("H")[1]
    # Stacked lines sit close: one capital height plus a little air, so the
    # second line's ascenders tuck under the first line's baseline.
    mask, rows = render_mask(v["lines"], font, line_pitch=cap * 1.32)
    H, W = mask.shape

    pitch = cap / v["bands"]
    thick = pitch * (1 - v["gap"])
    r = thick / 2
    amp = cap * v["amp"]
    lam = cap * v["wavelength"]

    def wave(x, y):
        # Two slow sines: bands rise and fall through the word, and the phase
        # drifts with height so neighbouring bands don't move in lockstep.
        return (amp * math.sin(2 * math.pi * x / lam + y / cap * 1.3)
                + amp * 0.45 * math.sin(2 * math.pi * x / (lam * 0.47) + 1.7 + y / cap * 0.6))

    shapes = []
    smooth = max(1, int(thick * 0.25))
    kernel = np.ones(smooth) / smooth
    for baseline, cap_top in rows:
        # Bands are laid out from the baseline up (and down into descenders),
        # so the bottom band sits exactly on the baseline.
        k_top = int(math.ceil((baseline - (cap_top - pitch * 2)) / pitch))
        k_bot = -int(math.ceil(cap * 0.35 / pitch))
        for k in range(k_bot, k_top):
            y1 = baseline - k * pitch
            y0 = y1 - thick
            iy0, iy1 = int(round(y0)), int(round(y1))
            if iy1 <= 0 or iy0 >= H:
                continue
            cov = mask[max(0, iy0):min(H, iy1)].mean(axis=0)
            cov = np.convolve(cov, kernel, mode="same")
            for s, e in runs(cov):
                if e - s < thick * 0.7:  # drop specks smaller than a dot
                    continue
                shapes.append(capsule(float(s), float(e), (y0 + y1) / 2, r, step=thick * 0.45))

    # Bend everything by the wave
    bent = [[(x, y + wave(x, y)) for x, y in pts] for pts in shapes]
    xs = [x for s in bent for x, _ in s]
    ys = [y for s in bent for _, y in s]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    margin = r * 0.5
    scale = 100.0 / cap  # 100 viewBox units per capital height
    vw = (maxx - minx + 2 * margin) * scale
    vh = (maxy - miny + 2 * margin) * scale

    def fmt(n):
        s = f"{n:.1f}"
        return s[:-2] if s.endswith(".0") else s

    parts = []
    for pts in bent:
        coords = [((x - minx + margin) * scale, (y - miny + margin) * scale) for x, y in pts]
        parts.append("M" + " ".join(f"{fmt(x)} {fmt(y)}" for x, y in coords) + "Z")
    return f"0 0 {fmt(vw)} {fmt(vh)}", "".join(parts)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--font", required=True, help="heavy geometric TTF, e.g. Poppins ExtraBold")
    args = ap.parse_args()

    out_dir = ROOT / "assets" / "wordmark"
    out_dir.mkdir(parents=True, exist_ok=True)
    symbols = []
    for name in VARIANTS:
        view_box, d = build(name, args.font)
        (out_dir / f"{name}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" role="img" aria-label="AAHairArtistry">'
            f'<path fill="{BURGUNDY}" d="{d}"/></svg>\n')
        symbols.append(f'<symbol id="wordmark-{name}" viewBox="{view_box}"><path d="{d}"/></symbol>')
        print(f"{name}: viewBox {view_box}, {len(d) / 1024:.0f} KB of path data")

    partial = ROOT / "templates" / "partials" / "wordmark-symbols.svg"
    partial.parent.mkdir(parents=True, exist_ok=True)
    partial.write_text("<!-- Generated by scripts/wordmark.py -->\n" + "\n".join(symbols) + "\n")


if __name__ == "__main__":
    main()
