"""Generate Ralts PWA icons from scratch.

Produces a Ralts brand mark that:

  * fills the canvas with a deep dark navy (#09090b) so the PWA splash screen
    on Android looks intentional instead of black,
  * carries a centered "R" mark sized so it sits comfortably in the safe
    zone of a maskable adaptive icon (logo in the centre 80% of the canvas),
  * uses three accent shades so the mark reads at every density (16x16
    favicon through 512x512 home-screen icon) without muddying.

Outputs (under public/icons/):

  android-chrome-192x192.png         regular icon
  android-chrome-512x512.png         regular icon
  android-chrome-192x192-maskable.png  safe-zone icon
  android-chrome-512x512-maskable.png  safe-zone icon
  apple-touch-icon.png               180x180 iOS icon
  favicon-16x16.png
  favicon-32x32.png
  favicon.ico                        multi-size ICO
  ralts-logo-1024.png                master asset
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Brand palette — kept in sync with src/app/globals.css and manifest.json.
BG = (9, 9, 11, 255)                # #09090b
BG_2 = (24, 24, 27, 255)            # #18181b (slightly lighter for a soft top glow)
ACCENT = (79, 140, 255, 255)        # #4f8cff Ralts primary accent
ACCENT_DARK = (49, 96, 196, 255)    # #3160c4 Ralts accent shadow
ACCENT_LIGHT = (138, 180, 255, 255) # #8ab4ff Ralts accent highlight


def make_logo(size: int, *, safe_zone: bool = False) -> Image.Image:
    """Render the Ralts R-mark on a square canvas.

    `safe_zone=True` keeps the mark inside the centre 80% so the result is
    suitable as a maskable (Android adaptive) icon — anything outside that
    inner circle may be cropped by launchers that apply rounded/squircle
    masks.
    """
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)

    # Subtle vertical gradient background (BG → BG_2 top-to-bottom) so the
    # splash screen doesn't look flat black on Android.
    for y in range(size):
        t = y / max(1, size - 1)
        r = int(BG[0] + (BG_2[0] - BG[0]) * t)
        g = int(BG[1] + (BG_2[1] - BG[1]) * t)
        b = int(BG[2] + (BG_2[2] - BG[2]) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Geometry — sized so the mark stays inside the safe zone.
    pad = int(size * (0.24 if safe_zone else 0.20))
    s = size - pad * 2
    cx = size / 2.0
    top = pad
    bot = pad + s

    # Stem width — gives the R a solid presence even at 16x16.
    stem_w = s * 0.24
    stem_left = cx - s * 0.34
    stem_right = stem_left + stem_w

    # Bowl — rounded top loop of the R.
    bowl_top = top
    bowl_bot = top + s * 0.50
    bowl_right = cx + s * 0.34
    bowl_radius = (bowl_bot - bowl_top) / 2

    # 1) Bowl outer (filled accent).
    bowl_box = (stem_right - 2, bowl_top, bowl_right, bowl_bot)
    draw.rounded_rectangle(bowl_box, radius=bowl_radius, fill=ACCENT)

    # 2) Bowl inner cutout to make the loop hollow — slightly taller than
    #    wide so the visible "hole" reads as a R bowl, not a coin slot.
    inner_w = (bowl_box[2] - bowl_box[0]) * 0.42
    inner_h = (bowl_box[3] - bowl_box[1]) * 0.58
    inner_box = (
        bowl_box[0] + (bowl_box[2] - bowl_box[0] - inner_w) / 2,
        bowl_box[1] + (bowl_box[3] - bowl_box[1] - inner_h) / 2,
        bowl_box[0] + (bowl_box[2] - bowl_box[0] + inner_w) / 2,
        bowl_box[1] + (bowl_box[3] - bowl_box[1] + inner_h) / 2,
    )
    inner_radius = min(inner_w, inner_h) / 2
    draw.rounded_rectangle(inner_box, radius=inner_radius, fill=BG)

    # 3) Vertical stem (dark accent for contrast against the bowl).
    stem_box = (stem_left, top, stem_right, top + s * 0.95)
    draw.rounded_rectangle(stem_box, radius=stem_w / 2, fill=ACCENT_DARK)

    # 4) Leg of the R — diagonal slab from the bottom of the bowl to the
    #    bottom-right corner (light accent for visual separation).
    leg_top_y = bowl_bot - stem_w * 0.05
    leg_bot_y = bot - s * 0.02
    leg_top_left = stem_right - stem_w * 0.25
    leg_top_right = stem_right + s * 0.02
    leg_bot_left = stem_left + s * 0.18
    leg_bot_right = stem_left + s * 0.18 + stem_w * 1.1
    draw.polygon(
        [
            (leg_top_left, leg_top_y),
            (leg_top_right, leg_top_y),
            (leg_bot_right, leg_bot_y),
            (leg_bot_left, leg_bot_y),
        ],
        fill=ACCENT_LIGHT,
    )

    # 5) Tiny accent dot above the leg's start to suggest the diagonal
    #    foot — purely decorative and only visible at large sizes.
    if size >= 128:
        dot_r = max(2, int(stem_w * 0.08))
        dot_cx = stem_right - stem_w * 0.5
        dot_cy = bowl_bot + (leg_top_y - bowl_bot) * 0.5
        draw.ellipse(
            (dot_cx - dot_r, dot_cy - dot_r, dot_cx + dot_r, dot_cy + dot_r),
            fill=ACCENT_LIGHT,
        )

    return img


def write_master() -> Image.Image:
    master = make_logo(1024, safe_zone=False)
    master.save(OUT_DIR / "ralts-logo-1024.png")
    return master


def write_at(size: int, name: str, *, maskable: bool = False) -> None:
    img = make_logo(size, safe_zone=maskable)
    img.save(OUT_DIR / name)


def main() -> None:
    write_master()
    write_at(192, "android-chrome-192x192.png")
    write_at(512, "android-chrome-512x512.png")
    write_at(192, "android-chrome-192x192-maskable.png", maskable=True)
    write_at(512, "android-chrome-512x512-maskable.png", maskable=True)
    write_at(180, "apple-touch-icon.png")
    write_at(16, "favicon-16x16.png")
    write_at(32, "favicon-32x32.png")

    # Multi-size favicon.ico (16 + 32 + 48 inside one file).
    base = Image.new("RGBA", (64, 64), BG)
    base.paste(make_logo(16), (0, 0))
    base.paste(make_logo(32), (16, 0))
    base.paste(make_logo(48), (16, 16))
    base.save(OUT_DIR / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == "__main__":
    main()