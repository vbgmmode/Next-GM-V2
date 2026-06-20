#!/usr/bin/env python3
import json
import re
from collections import deque
from pathlib import Path
from typing import Iterable, Optional

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BACKGROUND_PATH = Path("/Users/vbahmad/Downloads/ChatGPT Image May 31, 2026, 11_28_42 AM.png")
ROSTER_PATH = ROOT / "data/rosters/top_200_superstar_ids.json"
PORTRAIT_DIR = ROOT / "public/superstars"
DEVIANTART_REPORT = ROOT / "public/source-portraits/deviantart/deviantart_replacement_report.json"
DEVIANTART_SOURCE_DIR = ROOT / "public/source-portraits/deviantart"
RESOLVER_PATH = ROOT / "src/game/wrestlerPortraits.ts"
OUT_SIZE = 512


def load_aliases() -> dict[str, str]:
    text = RESOLVER_PATH.read_text()
    alias_block = text.split("const availableWrestlerPortraitIds")[0]
    return dict(re.findall(r'"([^"]+)": "([^"]+)"', alias_block))


def fit_background() -> Image.Image:
    image = Image.open(BACKGROUND_PATH).convert("RGB")
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    return image.crop((left, top, left + side, top + side)).resize((OUT_SIZE, OUT_SIZE), Image.Resampling.LANCZOS)


def subject_bbox(image: Image.Image) -> Optional[tuple[int, int, int, int]]:
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    return image.getchannel("A").getbbox()


def profile_from_transparent_source(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    bbox = subject_bbox(image)
    if bbox:
        image = image.crop(bbox)

    width, height = image.size
    if height > width * 1.35:
        image = image.crop((0, 0, width, round(width * 1.35)))
        width, height = image.size

    target_width = int(OUT_SIZE * 0.94)
    target_height = int(OUT_SIZE * 0.99)
    scale = min(target_width / width, target_height / height)
    resized = image.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))
    left = (OUT_SIZE - resized.width) // 2
    top = max(0, OUT_SIZE - resized.height)
    canvas.alpha_composite(resized, (left, top))
    return canvas


def is_near_white(pixel: tuple[int, int, int], threshold: int = 244) -> bool:
    return pixel[0] >= threshold and pixel[1] >= threshold and pixel[2] >= threshold


def border_points(size: int) -> Iterable[tuple[int, int]]:
    last = size - 1
    for index in range(size):
        yield index, 0
        yield index, last
        yield 0, index
        yield last, index


def remove_connected_white_background(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB").resize((OUT_SIZE, OUT_SIZE), Image.Resampling.LANCZOS)
    pixels = rgb.load()
    visited = set()
    queue: deque[tuple[int, int]] = deque()

    for point in border_points(OUT_SIZE):
        if point not in visited and is_near_white(pixels[point]):
            visited.add(point)
            queue.append(point)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= OUT_SIZE or ny >= OUT_SIZE or (nx, ny) in visited:
                continue
            if is_near_white(pixels[nx, ny]):
                visited.add((nx, ny))
                queue.append((nx, ny))

    alpha = Image.new("L", (OUT_SIZE, OUT_SIZE), 255)
    alpha_pixels = alpha.load()
    for x, y in visited:
        alpha_pixels[x, y] = 0

    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.8))
    subject = rgb.convert("RGBA")
    subject.putalpha(alpha)
    return subject


def main() -> None:
    aliases = load_aliases()
    background = fit_background().convert("RGBA")
    deviantart_ids = set()
    if DEVIANTART_REPORT.exists():
        rows = json.loads(DEVIANTART_REPORT.read_text())
        deviantart_ids = {row["id"] for row in rows if row.get("status") == "saved"}

    roster = json.loads(ROSTER_PATH.read_text())
    restored = 0
    composited = 0

    for wrestler in roster:
        wrestler_id = wrestler["id"]
        portrait_id = aliases.get(wrestler_id, wrestler_id)
        source_path = DEVIANTART_SOURCE_DIR / f"{wrestler_id}.source.png"
        portrait_path = PORTRAIT_DIR / f"{portrait_id}.png"

        if wrestler_id in deviantart_ids and source_path.exists():
            subject = profile_from_transparent_source(Image.open(source_path))
        else:
            subject = remove_connected_white_background(Image.open(portrait_path))

        output = background.copy()
        output.alpha_composite(subject)
        output.convert("RGB").save(portrait_path)
        composited += 1

        if wrestler_id != portrait_id:
            direct_path = PORTRAIT_DIR / f"{wrestler_id}.png"
            output.convert("RGB").save(direct_path)
            restored += 1

    print(f"Composited {composited} roster portraits")
    print(f"Synced {restored} alias source files")


if __name__ == "__main__":
    main()
