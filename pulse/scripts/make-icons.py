"""Генерирует иконки Pulse: build/icon.png (512px, для .exe) и build/tray.png (32px)."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "build"
OUT.mkdir(exist_ok=True)
A, B = (0xFF, 0xC8, 0x3D), (0xFF, 0x6A, 0x3D)


def make(size: int) -> Image.Image:
    s = size * 4  # рисуем крупно и уменьшаем — так края гладкие
    grad = Image.new("RGBA", (s, s))
    px = grad.load()
    for y in range(s):
        for x in range(s):
            t = (x + y) / (2 * s)
            px[x, y] = tuple(int(A[i] + (B[i] - A[i]) * t) for i in range(3)) + (255,)
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.23), fill=255)
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    img.paste(grad, (0, 0), mask)
    # линия пульса
    pts = [(0.16, 0.54), (0.36, 0.54), (0.45, 0.30), (0.56, 0.74), (0.64, 0.46), (0.70, 0.54), (0.84, 0.54)]
    d = ImageDraw.Draw(img)
    d.line([(x * s, y * s) for x, y in pts], fill=(15, 15, 18, 255), width=int(s * 0.075), joint="curve")
    for x, y in (pts[0], pts[-1]):
        r = s * 0.0375
        d.ellipse((x * s - r, y * s - r, x * s + r, y * s + r), fill=(15, 15, 18, 255))
    return img.resize((size, size), Image.LANCZOS)


make(512).save(OUT / "icon.png")
make(32).save(OUT / "tray.png")
make(64).save(Path(__file__).resolve().parent.parent / "public" / "icon.png")
print("ok")
