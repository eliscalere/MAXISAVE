#!/usr/bin/env python3
"""Re-export Maxisave icons from the master logo, without distorting it.

The supplied icon-*.png files were force-fitted to a square canvas: the logo
artwork is 1.222:1 but the icons measured 1.000:1, a 19% horizontal squash. This
rescales the same artwork with its aspect ratio intact, and trims the large
transparent margin so the mark actually fills the icon.

    python3 store/make-icons.py

Source: store/logo-transparent.png (untouched)
Output: icons/icon-{16,32,48,128}.png, store/icon-{256,512}.png
"""

import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ICONS = os.path.join(ROOT, 'icons')
SRC = os.path.join(HERE, 'logo-transparent.png')

# Fraction of the canvas the artwork should span. The store shows the 128 on a
# white card and Chrome shows the 16 on a toolbar, so a small margin is enough.
FILL = 0.96
SIZES = {16: ICONS, 32: ICONS, 48: ICONS, 128: ICONS, 256: HERE, 512: HERE}


def master():
    im = Image.open(SRC).convert('RGBA')
    box = im.split()[3].getbbox()      # trim the transparent padding
    return im.crop(box)


def export(art, px, outdir):
    # Fit inside the square; never stretch either axis independently.
    scale = min(px * FILL / art.width, px * FILL / art.height)
    w, h = max(1, round(art.width * scale)), max(1, round(art.height * scale))
    resized = art.resize((w, h), Image.LANCZOS)

    canvas = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    canvas.paste(resized, ((px - w) // 2, (px - h) // 2), resized)

    out = os.path.join(outdir, 'icon-%d.png' % px)
    canvas.save(out)
    return out, w, h


def main():
    art = master()
    print('master artwork %dx%d  aspect %.3f' % (art.width, art.height, art.width / art.height))
    for px, outdir in sorted(SIZES.items()):
        out, w, h = export(art, px, outdir)
        print('  %-28s %3dpx canvas, art %dx%d (aspect %.3f)'
              % (os.path.relpath(out, ROOT), px, w, h, w / h))


if __name__ == '__main__':
    main()
