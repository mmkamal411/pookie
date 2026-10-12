#!/usr/bin/env python3
"""Squad Mobile: generate PWA icons + iOS splash screens from the orb artwork."""
import os
from PIL import Image, ImageDraw, ImageFilter

SRC = "/home/hatch/workspace/pookie-app/pwa-assets/media-generation-pookie-orb-icon-0-7791b2a6-5ad6-4dec-84e0-9e4878f33158.webp"
OUT = "/home/hatch/workspace/pookie-app/public"
ICONS = os.path.join(OUT, "icons")
SPLASH = os.path.join(OUT, "splash")
os.makedirs(ICONS, exist_ok=True)
os.makedirs(SPLASH, exist_ok=True)

orb = Image.open(SRC).convert("RGBA")
print("source:", orb.size)

# --- Standard icons ---
orb.resize((192, 192), Image.LANCZOS).save(os.path.join(ICONS, "icon-192.png"))
orb.resize((512, 512), Image.LANCZOS).save(os.path.join(ICONS, "icon-512.png"))
print("wrote icon-192, icon-512")

# --- Maskable: orb at 80% on solid dark cosmic bg (safe zone) ---
bg = Image.new("RGBA", (512, 512), (8, 8, 20, 255))
small = orb.resize((410, 410), Image.LANCZOS)
bg.alpha_composite(small, ((512 - 410) // 2, (512 - 410) // 2))
bg.convert("RGB").save(os.path.join(ICONS, "maskable-512.png"))
print("wrote maskable-512")

# --- Apple touch icon 180 (no transparency -> flatten on dark) ---
flat = Image.new("RGB", (180, 180), (8, 8, 20))
flat.paste(orb.resize((180, 180), Image.LANCZOS), (0, 0), orb.resize((180, 180), Image.LANCZOS))
flat.save(os.path.join(ICONS, "apple-touch-icon.png"))
print("wrote apple-touch-icon")

# --- Favicon 32 ---
orb.resize((32, 32), Image.LANCZOS).save(os.path.join(OUT, "favicon-32.png"))
print("wrote favicon-32")

# --- iOS splash screens: orb on radial cosmic gradient ---
def cosmic_bg(w, h):
    base = Image.new("RGB", (w, h), (5, 5, 16))
    # vertical gradient slightly lighter at center-top
    top = Image.new("RGB", (1, h), (5, 5, 16))
    px = top.load()
    for y in range(h):
        t = y / h
        # deep space blue-black, subtly lighter toward middle
        v = int(5 + 14 * (1 - abs(t - 0.45) * 2) ** 2)
        px[0, y] = (v - 2, v - 1, v + 12)
    base = top.resize((w, h))
    # soft radial glow behind orb position
    glow = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(glow)
    cx, cy = w // 2, int(h * 0.42)
    r = int(min(w, h) * 0.45)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(r // 2))
    tint = Image.new("RGB", (w, h), (40, 60, 120))
    base = Image.composite(tint, base, glow)
    return base

orb_sq = orb  # already square
sizes = {
    "640x1136": (640, 1136),    # iPhone SE/5
    "750x1334": (750, 1334),    # iPhone 8
    "828x1792": (828, 1792),    # iPhone 11/XR
    "1125x2436": (1125, 2436),  # iPhone X/XS
    "1170x2532": (1170, 2532),  # iPhone 14/15
    "1242x2688": (1242, 2688),  # iPhone XS Max
    "1284x2778": (1284, 2778),  # iPhone 14 Pro Max
    "2048x2732": (2048, 2732),  # iPad Pro 12.9
}
for name, (w, h) in sizes.items():
    img = cosmic_bg(w, h)
    ow = int(w * 0.52)
    o = orb_sq.resize((ow, ow), Image.LANCZOS)
    img.paste(o, ((w - ow) // 2, int(h * 0.42) - ow // 2), o)
    img.save(os.path.join(SPLASH, f"splash-{name}.png"), optimize=True)
    print("wrote splash", name)

print("ALL DONE")
