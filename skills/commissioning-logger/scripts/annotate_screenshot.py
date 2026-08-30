#!/usr/bin/env python3
"""Annotate a screenshot/photo with boxes, arrows, and text callouts to highlight
which control/setting/item was changed during a logged procedure.

Usage:
  python3 annotate_screenshot.py INPUT OUTPUT \
     --box "x,y,w,h,color,label" \
     --arrow "x1,y1,x2,y2,color" \
     --label "x,y,color,text"

- Multiple --box / --arrow / --label allowed.
- color: any PIL color name or #hex (default red).
- Coordinates are pixels on the INPUT image.
Requires Pillow: pip install pillow
"""
import argparse
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("ERROR: Pillow is not installed for this Python.\n"
             "Fix: %s -m pip install pillow" % sys.executable)

# Bold-ish system fonts across Windows / macOS / Linux; first hit wins.
_FONT_PATHS = (
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
)


def _font(size):
    for p in _FONT_PATHS:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    try:  # Pillow >= 9.2 can scale the default bitmap font
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def _clamp_text_origin(x, y, tw, th, img_w, img_h):
    """Keep a text background rect of size (tw, th) fully inside the image."""
    x = max(0, min(x, img_w - tw))
    y = max(0, min(y, img_h - th))
    return x, y


def _bad_spec(kind, spec, err):
    sys.exit('ERROR: bad --%s spec "%s" (%s).\n'
             "Expected: --box x,y,w,h[,color[,label]]  "
             "--arrow x1,y1,x2,y2[,color]  --label x,y[,color],text" % (kind, spec, err))


def draw_box(d, spec, w, h):
    p = spec.split(",")
    try:
        x, y, bw, bh = map(int, p[:4])
    except ValueError as e:
        _bad_spec("box", spec, e)
    color = p[4] if len(p) > 4 and p[4] else "red"
    label = ",".join(p[5:]) if len(p) > 5 else ""
    lw = max(3, w // 400)
    d.rectangle([x, y, x + bw, y + bh], outline=color, width=lw)
    if label:
        f = _font(max(16, w // 70))
        tb = d.textbbox((0, 0), label, font=f)
        tw, th = tb[2] - tb[0], tb[3] - tb[1]
        ly = y - th - 8 if y - th - 8 > 0 else y + bh + 4
        lx, ly = _clamp_text_origin(x, ly, tw + 10, th + 8, w, h)
        d.rectangle([lx, ly, lx + tw + 10, ly + th + 8], fill=color)
        d.text((lx + 5, ly + 4), label, fill="white", font=f)


def draw_arrow(d, spec, w):
    p = spec.split(",")
    try:
        x1, y1, x2, y2 = map(int, p[:4])
    except ValueError as e:
        _bad_spec("arrow", spec, e)
    color = p[4] if len(p) > 4 and p[4] else "red"
    lw = max(3, w // 400)
    d.line([x1, y1, x2, y2], fill=color, width=lw)
    import math
    ang = math.atan2(y2 - y1, x2 - x1)
    hl = max(14, w // 90)
    for s in (-0.4, 0.4):
        d.line([x2, y2,
                x2 - hl * math.cos(ang - s),
                y2 - hl * math.sin(ang - s)], fill=color, width=lw)


def draw_label(d, spec, w, h):
    p = spec.split(",")
    try:
        x, y = int(p[0]), int(p[1])
    except (ValueError, IndexError) as e:
        _bad_spec("label", spec, e)
    color = p[2] if len(p) > 2 and p[2] else "red"
    text = ",".join(p[3:])
    f = _font(max(18, w // 60))
    tb = d.textbbox((0, 0), text, font=f)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    x, y = _clamp_text_origin(x, y, tw + 12, th + 10, w, h)
    d.rectangle([x, y, x + tw + 12, y + th + 10], fill=color)
    d.text((x + 6, y + 5), text, fill="white", font=f)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inp")
    ap.add_argument("out")
    ap.add_argument("--box", action="append", default=[])
    ap.add_argument("--arrow", action="append", default=[])
    ap.add_argument("--label", action="append", default=[])
    a = ap.parse_args()
    try:
        img = Image.open(a.inp).convert("RGB")
    except FileNotFoundError:
        sys.exit("ERROR: input image not found: %s" % a.inp)
    except Exception as e:
        sys.exit("ERROR: cannot open %s as an image (%s)" % (a.inp, e))
    d = ImageDraw.Draw(img)
    w, h = img.width, img.height
    for s in a.box:
        draw_box(d, s, w, h)
    for s in a.arrow:
        draw_arrow(d, s, w)
    for s in a.label:
        draw_label(d, s, w, h)
    img.save(a.out)
    print("wrote", a.out)


if __name__ == "__main__":
    sys.exit(main())
