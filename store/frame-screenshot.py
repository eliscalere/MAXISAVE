#!/usr/bin/env python3
"""Fit real screenshots to Chrome Web Store dimensions.

The store wants 1280x800 (or 640x400). Raw Mac screenshots are neither, and
stretching them looks bad, so this scales each image to fit and centres it on a
brand-blue canvas with a soft shadow.

    python3 store/frame-screenshot.py ~/Desktop/Screenshot*.png

Writes store/screenshot-N-1280x800.png for each input.
"""

import os
import sys
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))

W, H = 1280, 800
MARGIN = 48
BG_TOP = (12, 108, 200)
BG_BOTTOM = (8, 46, 110)


def canvas():
    img = Image.new('RGB', (W, H))
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        row = tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM))
        for x in range(W):
            px[x, y] = row
    return img


def frame(path, index):
    shot = Image.open(path).convert('RGB')
    max_w, max_h = W - 2 * MARGIN, H - 2 * MARGIN
    scale = min(max_w / shot.width, max_h / shot.height)
    if scale < 1:
        shot = shot.resize((round(shot.width * scale), round(shot.height * scale)),
                           Image.LANCZOS)

    bg = canvas()
    x = (W - shot.width) // 2
    y = (H - shot.height) // 2

    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 130), (x, y + 8, x + shot.width, y + shot.height + 8))
    bg = Image.alpha_composite(bg.convert('RGBA'),
                               shadow.filter(ImageFilter.GaussianBlur(14)))

    bg.paste(shot, (x, y))
    out = os.path.join(HERE, 'screenshot-%d-1280x800.png' % index)
    bg.convert('RGB').save(out)
    print('wrote', os.path.basename(out), '<-', os.path.basename(path))


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        raise SystemExit(1)
    for i, path in enumerate(args[:5], start=1):
        frame(path, i)


if __name__ == '__main__':
    main()
