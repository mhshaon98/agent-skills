#!/usr/bin/env python3
"""Numbered figure callouts that stay readable on paper, plus the matching callout table.

Marker: yellow disc, black ring, thin white halo, bold digit. Its size comes from the figure's PRINTED
width, so it prints the same size (default 0.26 in = 6.6 mm, ~10 pt digit) on a full-width screenshot
and on a small crop. Each marker sits in clear space with a leader line that ends in a small black dot
on the EDGE of the thing it names, never on its caption or value.

  callouts.py SPEC.json                 -> annotated PNGs + Markdown callout tables
  callouts.py SPEC.json --proof DIR     -> also page-size proof sheets (every figure at its print width, 100 dpi)

SPEC.json (paths relative to "base", default the spec's folder; pixels are SOURCE-image pixels):
{"base": ".", "dot_in": 0.26,
 "figures": [{"id": "main", "image": "shots/main.png", "crop": [0, 0, 1920, 1000], "print_in": 6.5,
              "out": "figs/main.png", "table": "tables/main.md",
              "columns": ["No.", "Item", "What it does / what you see"],
              "items": [{"target": [800, 300], "marker": [850, 200], "label": "START", "text": "..."}]}]}

Leave "marker" out and it is placed in the quietest nearby spot (fewest edges), clear of the other
targets and markers. Look at every placed marker at page size and pin the ones that land on text.
"print_in" must equal the width the figure gets in the document ("![...](figs/main.png){width=6.5}").
From Python: `from callouts import annotate` (PIL image in, PIL image out).
"""
import argparse, json, math, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageStat

YELLOW, INK, FRAME = (253, 196, 24), (26, 26, 26), (150, 150, 150)
DOT_IN = 0.26
FONTS = (r"C:\Windows\Fonts\arialbd.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
         "/Library/Fonts/Arial Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVuSans-Bold.ttf")


def font(size):
    for f in FONTS:
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    return ImageFont.load_default(size)


def radius(img_w, print_in, dot_in=DOT_IN):
    """Marker radius in image pixels for a figure printed print_in inches wide."""
    return max(6, round(dot_in / 2 * img_w / print_in))


def marker(d, cx, cy, n, r):
    o = max(2, round(r / 8))     # black ring, then a thin white halo so the dot reads on dark screens and in print
    d.ellipse([cx - r - o - 2, cy - r - o - 2, cx + r + o + 2, cy + r + o + 2], fill="white")
    d.ellipse([cx - r - o, cy - r - o, cx + r + o, cy + r + o], fill=INK)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=YELLOW)
    d.text((cx, cy), str(n), fill=INK, font=font(round(r * 1.25)), anchor="mm")


def leader(d, tx, ty, cx, cy, r):
    """Small black end dot at the control, line to the marker edge (white underlay keeps it visible on dark fills)."""
    L = math.dist((tx, ty), (cx, cy)) or 1
    if L <= r:
        return
    ex, ey = cx - (cx - tx) * r / L, cy - (cy - ty) * r / L
    w = max(3, round(r / 9)); q = max(4, round(r / 6))
    d.line([(tx, ty), (ex, ey)], fill="white", width=w + 4)
    d.ellipse([tx - q - 2, ty - q - 2, tx + q + 2, ty + q + 2], fill="white")
    d.line([(tx, ty), (ex, ey)], fill=INK, width=w)
    d.ellipse([tx - q, ty - q, tx + q, ty + q], fill=INK)


def place(edges, targets, fixed, r, e, W, H):
    """Marker centre for each target without one: the quietest spot near it (fewest edges = no captions or
    values) that covers no other target and no marker already placed."""
    out = list(fixed)
    for i, (tx, ty) in enumerate(targets):
        if out[i] is not None:
            continue
        best = None
        for k in range(18, 61, 6):
            dist = r * k / 10
            for a in range(0, 360, 15):
                cx = tx + dist * math.cos(math.radians(a)); cy = ty + dist * math.sin(math.radians(a))
                if not (e <= cx <= W - e and e <= cy <= H - e):
                    continue
                if any(math.dist((cx, cy), t) < r + 14 for j, t in enumerate(targets) if j != i):
                    continue
                if any(m is not None and math.dist((cx, cy), m) < 2 * r + 12 for m in out):
                    continue
                busy = ImageStat.Stat(edges.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r)))).mean[0]
                cost = busy + 0.06 * dist
                if best is None or cost < best[0]:
                    best = (cost, cx, cy)
        out[i] = best[1:] if best else (tx, ty)
    return out


def annotate(img, items, print_in, crop=None, dot_in=DOT_IN, frame=True):
    """img: PIL image; items: dicts with target [x, y] and optional marker [x, y] in source pixels.
    Returns the cropped, framed, annotated image (markers numbered 1..n in item order)."""
    im = img.convert("RGB")
    x0, y0 = (crop[0], crop[1]) if crop else (0, 0)
    if crop:
        im = im.crop(tuple(crop))
    pad = 2 if frame else 0
    if frame:
        f = Image.new("RGB", (im.width + 4, im.height + 4), FRAME); f.paste(im, (2, 2)); im = f
    r = radius(im.width, print_in, dot_in); e = r + r // 8 + 5
    W, H = im.size
    tg = [(min(max(it["target"][0] - x0 + pad, 6), W - 6), min(max(it["target"][1] - y0 + pad, 6), H - 6)) for it in items]
    fixed = [(min(max(it["marker"][0] - x0 + pad, e), W - e), min(max(it["marker"][1] - y0 + pad, e), H - e))
             if it.get("marker") else None for it in items]
    edges = im.convert("L").filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 40 else 0)
    spots = place(edges, tg, fixed, r, e, W, H) if None in fixed else fixed
    d = ImageDraw.Draw(im)
    for (tx, ty), (cx, cy) in zip(tg, spots):
        leader(d, tx, ty, cx, cy, r)
    for n, (cx, cy) in enumerate(spots, 1):
        marker(d, cx, cy, n, r)
    return im


def table_md(items, columns=("No.", "Item", "What it does / what you see")):
    rows = ["| " + " | ".join(columns) + " |", "|" + "---|" * len(columns)]
    for n, it in enumerate(items, 1):
        rows.append(f"| {n} | {it.get('label', '')} | {it.get('text', '')} |")
    return "\n".join(rows) + "\n"


def proof(figs, out_dir, dpi=100, page=(6.5, 9.0)):
    """Contact sheets at print size: each figure scaled to print_in * dpi px, packed on text-area pages."""
    os.makedirs(out_dir, exist_ok=True)
    pw, ph = int(page[0] * dpi), int(page[1] * dpi); sheets = []; cur = None; y = 0
    lab = font(14)
    for fid, im, print_in in figs:
        w = int(print_in * dpi); h = max(1, round(im.height * w / im.width))
        tile = im.resize((w, h), Image.LANCZOS)
        if cur is None or y + h + 22 > ph:
            cur = Image.new("RGB", (pw, ph), "white"); sheets.append(cur); y = 0
        ImageDraw.Draw(cur).text((0, y), f"{fid}  ({print_in} in)", fill=INK, font=lab)
        cur.paste(tile, (0, y + 18)); y += h + 30
    paths = []
    for k, s in enumerate(sheets, 1):
        p = os.path.join(out_dir, f"proof_{k:02d}.png"); s.save(p); paths.append(p)
    return paths


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spec"); ap.add_argument("--proof", metavar="DIR")
    a = ap.parse_args()
    spec = json.load(open(a.spec, encoding="utf-8"))
    base = os.path.join(os.path.dirname(os.path.abspath(a.spec)), spec.get("base", "."))
    P = lambda p: p if os.path.isabs(p) else os.path.join(base, p)
    done = []
    for fg in spec["figures"]:
        im = annotate(Image.open(P(fg["image"])), fg["items"], fg["print_in"], fg.get("crop"),
                      spec.get("dot_in", DOT_IN), fg.get("frame", True))
        out = P(fg.get("out", f"figs/{fg['id']}.png")); os.makedirs(os.path.dirname(out), exist_ok=True); im.save(out)
        if fg.get("table", True):
            t = P(fg["table"] if isinstance(fg.get("table"), str) else f"tables/{fg['id']}.md")
            os.makedirs(os.path.dirname(t), exist_ok=True)
            open(t, "w", encoding="utf-8").write(table_md(fg["items"], fg.get("columns", ("No.", "Item", "What it does / what you see"))))
        done.append((fg["id"], im, fg["print_in"]))
        print(fg["id"], im.size, "marker r", radius(im.width, fg["print_in"], spec.get("dot_in", DOT_IN)), "px")
    if a.proof:
        for p in proof(done, a.proof):
            print("proof", p)


if __name__ == "__main__":
    sys.exit(main())
