"""One-off generator for site/og-image.png (Open Graph / Twitter card image).
Not part of the deploy pipeline — run manually when the branding changes.
Requires Pillow (`pip install pillow`), not a project dependency.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630

BG       = (8, 8, 16, 255)      # #080810
BG2      = (16, 16, 28, 255)    # #10101c
CYAN     = (0, 212, 255, 255)   # #00d4ff
PURPLE   = (123, 47, 212, 255)  # #7b2fd4
TEXT     = (232, 232, 240, 255) # #e8e8f0
DIMMED   = (160, 160, 184, 255) # #a0a0b8

FONTS_DIR  = r'C:\Windows\Fonts'
OUT        = os.path.join(os.path.dirname(__file__), '..', 'site', 'og-image.png')


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS_DIR, name), size)


def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def draw_crosshair_logo(layer, cx, cy, r):
    draw = ImageDraw.Draw(layer)

    steps = 120
    for i in range(steps):
        t = i / steps
        col = lerp_color(CYAN[:3], PURPLE[:3], t)
        start = i * (360 / steps)
        end = start + (360 / steps) + 1
        draw.arc([cx - r, cy - r, cx + r, cy + r], start, end, fill=(*col, 255), width=5)

    inner_r = int(r * 0.42)
    draw.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], outline=(*PURPLE[:3], 220), width=4)

    dot_r = int(r * 0.13)
    draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=CYAN)

    gap = int(r * 0.55)
    lw  = 6
    draw.rectangle([cx - r - 6, cy - lw // 2, cx - gap, cy + lw // 2], fill=CYAN)
    draw.rectangle([cx + gap,   cy - lw // 2, cx + r + 6, cy + lw // 2], fill=CYAN)
    draw.rectangle([cx - lw // 2, cy - r - 6, cx + lw // 2, cy - gap], fill=CYAN)
    draw.rectangle([cx - lw // 2, cy + gap,   cx + lw // 2, cy + r + 6], fill=CYAN)


def main():
    base = Image.new('RGBA', (W, H), BG)

    # Subtle vertical gradient wash
    grad = Image.new('RGB', (1, H))
    for y in range(H):
        grad.putpixel((0, y), lerp_color(BG[:3], BG2[:3], y / H))
    base.paste(grad.resize((W, H)), (0, 0))

    # Soft glow layer: draw the logo bigger/blurred underneath, low opacity
    cx, cy, r = 175, H // 2, 88
    glow_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    glow_draw  = ImageDraw.Draw(glow_layer)
    glow_draw.ellipse([cx - r - 30, cy - r - 30, cx + r + 30, cy + r + 30], fill=(0, 212, 255, 70))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(50))
    base.alpha_composite(glow_layer)

    # Crisp logo on top
    logo_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_crosshair_logo(logo_layer, cx, cy, r)
    base.alpha_composite(logo_layer)

    d = ImageDraw.Draw(base)
    title_font   = font('segoeuib.ttf', 60)
    tagline_font = font('segoeui.ttf', 28)
    badge_font   = font('seguisb.ttf', 21)

    tx = 340
    d.text((tx, 200), 'FiveM PvP Trainer', font=title_font, fill=TEXT)
    d.text((tx, 275), 'Train your FiveM PvP aim like a pro', font=tagline_font, fill=DIMMED)

    chips = ['3D Aim Trainer', 'Adaptive Routines', 'Free']
    ccx, ccy = tx, 335
    for chip in chips:
        bbox = d.textbbox((0, 0), chip, font=badge_font)
        w = bbox[2] - bbox[0]
        pad = 18
        d.rounded_rectangle([ccx, ccy, ccx + w + pad * 2, ccy + 42], radius=21, outline=CYAN[:3], width=2)
        d.text((ccx + pad, ccy + 9), chip, font=badge_font, fill=CYAN[:3])
        ccx += w + pad * 2 + 14

    base.convert('RGB').save(OUT, 'PNG')
    print(f'Wrote {OUT}')


if __name__ == '__main__':
    main()
