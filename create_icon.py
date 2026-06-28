"""Generates assets/icon.ico — a crosshair on a dark background."""
from PIL import Image, ImageDraw
import os

CYAN   = (0,   212, 255, 255)
PURPLE = (123,  47, 212, 255)
BG     = (8,     8,  16, 245)

def make_frame(size: int) -> Image.Image:
    img  = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = size // 2, size // 2
    r  = size // 2 - 1
    lw = max(1, size // 20)

    # Dark circle background
    draw.ellipse([1, 1, size - 2, size - 2], fill=BG)

    # Outer cyan ring
    draw.ellipse([1, 1, size - 2, size - 2], outline=CYAN, width=lw)

    # Inner ring (thinner, purple-ish)
    inner_r = int(r * 0.65)
    draw.ellipse(
        [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
        outline=(*PURPLE[:3], 160), width=max(1, lw - 1),
    )

    # Crosshair lines
    gap = max(3, size // 7)
    ht  = max(1, size // 18)
    pad = lw + 1

    draw.rectangle([pad,       cy - ht, cx - gap, cy + ht], fill=CYAN)  # left
    draw.rectangle([cx + gap,  cy - ht, size - pad - 1, cy + ht], fill=CYAN)  # right
    draw.rectangle([cx - ht,   pad,     cx + ht, cy - gap], fill=CYAN)  # top
    draw.rectangle([cx - ht,   cy + gap, cx + ht, size - pad - 1], fill=CYAN)  # bottom

    # Center dot (purple)
    dp = max(2, size // 10)
    draw.ellipse([cx - dp, cy - dp, cx + dp, cy + dp], fill=PURPLE)

    return img


def main():
    sizes  = [16, 24, 32, 48, 64, 128, 256]
    frames = [make_frame(s) for s in sizes]
    os.makedirs('assets', exist_ok=True)
    out = os.path.join('assets', 'icon.ico')
    frames[0].save(out, format='ICO', sizes=[(s, s) for s in sizes], append_images=frames[1:])
    print(f'Icon saved: {out}')


if __name__ == '__main__':
    main()
