from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Image.open(ROOT / "public" / "aras-logo.jpeg").convert("RGB")
# Keep the ARAS mark and its two profiles; omit the wordmark for legibility at icon size.
MARK = SOURCE.crop((180, 95, 1080, 930))


def make_icon(size: int, maskable: bool = False) -> Image.Image:
    background = Image.new("RGBA", (size, size), (236, 59, 120, 255))
    mark = MARK.copy()
    # Turn the original pink strokes into a clean white mark on a transparent field.
    pixels = mark.load()
    alpha = Image.new("L", mark.size)
    alpha_pixels = alpha.load()
    for y in range(mark.height):
        for x in range(mark.width):
            red, green, blue = pixels[x, y]
            darkness = 255 - min(red, green, blue)
            alpha_pixels[x, y] = max(0, min(255, int((darkness - 18) * 1.55)))
    mark_rgba = Image.new("RGBA", mark.size, (255, 255, 255, 0))
    mark_rgba.putalpha(alpha)

    inset = int(size * (0.19 if maskable else 0.12))
    max_width = size - inset * 2
    max_height = size - inset * 2
    mark_rgba.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
    background.alpha_composite(mark_rgba, ((size - mark_rgba.width) // 2, (size - mark_rgba.height) // 2))
    return background.convert("RGB")


icon_dir = ROOT / "public" / "icons"
icon_dir.mkdir(parents=True, exist_ok=True)
make_icon(192).save(icon_dir / "icon-192.png", optimize=True)
make_icon(512).save(icon_dir / "icon-512.png", optimize=True)
make_icon(512, maskable=True).save(icon_dir / "icon-maskable-512.png", optimize=True)
make_icon(180).save(icon_dir / "apple-touch-icon.png", optimize=True)
