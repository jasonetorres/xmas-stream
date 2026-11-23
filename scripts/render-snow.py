"""Looping snow GIFs for Starting Soon and BRB. StreamYard: under 3MB and 108 frames."""
import random
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / "public" / "overlays"
rng = random.Random(18)
flakes = [(rng.randint(0, 1270), rng.randint(0, 700), rng.choice((2, 3, 4))) for _ in range(70)]

def snow(name):
    base = Image.open(root / f"{name}.png").convert("RGBA")
    frames = []
    for step in range(16):
        frame = base.copy()
        draw = ImageDraw.Draw(frame)
        for x, y, size in flakes:
            yy = (y + step * 18) % 720
            draw.ellipse((x, yy, x + size, yy + size), fill=(245, 230, 184, 210))
        frames.append(frame.quantize(colors=32, method=Image.Quantize.FASTOCTREE))
    dest = root / f"{name}.gif"
    frames[0].save(dest, save_all=True, append_images=frames[1:], duration=140, loop=0, disposal=2, optimize=True)
    print(dest.name, dest.stat().st_size, "frames", len(frames))
    if dest.stat().st_size > 3 * 1024 * 1024 or len(frames) >= 108:
        raise SystemExit(f"{dest.name} is outside StreamYard GIF limits")

for scene in ("starting-soon", "brb"):
    snow(scene)
