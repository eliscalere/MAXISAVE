#!/usr/bin/env python3
"""Generate Maxisave promo tiles for the Chrome Web Store, from the real logo.

Uses store/logo-transparent.png at its true aspect ratio (no re-drawing, no
distortion) on a brand-blue background. Chrome requires these WITHOUT an alpha
channel, so every output is flattened to RGB before saving.

    python3 store/make-promo.py

Writes:
  store/small-promo-440x280.png   (dashboard: "Small promo tile")
  store/marquee-1400x560.png      (dashboard: "Marquee promo tile")
"""

import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'logo-transparent.png')

BG_TOP = (18, 132, 240)
BG_BOTTOM = (8, 40, 100)


def gradient(w, h, c1, c2):
    img = Image.new('RGB', (w, h))
    px = img.load()
    span = float(w + h - 2) or 1.0
    for y in range(h):
        for x in range(w):
            t = ((w - 1 - x) + y) / span
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))
    return img


def tile(w, h, out, fill=0.72):
    logo = Image.open(SRC).convert('RGBA')
    box = logo.split()[3].getbbox()
    logo = logo.crop(box)

    scale = min(w * fill / logo.width, h * fill / logo.height)
    lw, lh = round(logo.width * scale), round(logo.height * scale)
    logo = logo.resize((lw, lh), Image.LANCZOS)

    bg = gradient(w, h, BG_TOP, BG_BOTTOM).convert('RGBA')
    bg.alpha_composite(logo, ((w - lw) // 2, (h - lh) // 2))

    # Chrome rejects promo art with an alpha channel.
    bg.convert('RGB').save(out)
    print('wrote', os.path.relpath(out, os.path.dirname(HERE)), '%dx%d' % (w, h))


def main():
    tile(440, 280, os.path.join(HERE, 'small-promo-440x280.png'))
    tile(1400, 560, os.path.join(HERE, 'marquee-1400x560.png'))


if __name__ == '__main__':
    main()
