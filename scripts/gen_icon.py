#!/usr/bin/env python3
"""Draw monogatari's source icon (1024x1024): a candle-ember glowing on deep ink,
with the story spine running through it. `npx tauri icon` turns it into every
platform size.

Run:  python3 scripts/gen_icon.py && npx tauri icon src-tauri/icons/source.png
"""
import os

from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
OUT = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "icons", "source.png")

INK = (24, 25, 33)
EMBER = (215, 162, 75)
EMBER_SOFT = (233, 197, 132)
PAPER = (251, 249, 245)


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    # Rounded-square ground.
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle([40, 40, SIZE - 40, SIZE - 40], radius=220, fill=255)
    ground = Image.new("RGBA", (SIZE, SIZE), INK + (255,))
    img.paste(ground, (0, 0), mask)

    cx = SIZE // 2
    # Story spine: a soft vertical line fading downward.
    spine = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(spine)
    top, bottom = 200, 840
    for y in range(top, bottom):
        t = (y - top) / (bottom - top)
        alpha = int(200 * (1 - t) ** 1.4)
        sd.line([(cx - 6, y), (cx + 6, y)], fill=EMBER_SOFT + (alpha,))
    img = Image.alpha_composite(img, spine)

    # Glow halo behind the ember.
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([cx - 230, 280, cx + 230, 740], fill=EMBER + (150,))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    img = Image.alpha_composite(img, Image.composite(glow, Image.new("RGBA", glow.size), mask))

    # The ember: a ringed station on the spine, like a chapter marker.
    d = ImageDraw.Draw(img)
    r_outer, r_inner = 150, 92
    cy = 470
    d.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], fill=PAPER + (255,))
    d.ellipse([cx - r_outer + 26, cy - r_outer + 26, cx + r_outer - 26, cy + r_outer - 26], fill=EMBER + (255,))
    d.ellipse([cx - r_inner + 30, cy - r_inner + 30, cx + r_inner - 30, cy + r_inner - 30], fill=EMBER_SOFT + (255,))

    # Two smaller stations below: earlier and later chapters.
    for y, r in ((690, 34), (800, 22)):
        d.ellipse([cx - r, y - r, cx + r, y + r], fill=EMBER_SOFT + (210,))

    img.save(OUT)
    print(f"Wrote {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
