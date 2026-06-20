#!/usr/bin/env python3
import json
import shutil
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PORTRAIT_DIR = ROOT / "public/superstars"
BACKGROUND_PATH = Path("/Users/vbahmad/Downloads/ChatGPT Image May 31, 2026, 11_28_42 AM.png")
OUT_SIZE = 512

# These were selected from public/source-portraits/white_artifact_scan_sheet.jpg.
# Excluded scan hits include legitimate white shirts, towels, face paint, wrist tape,
# silver gear, and overexposed skin.
TARGET_IDS = {
    "aew-aew-bobby-lashley",
    "aew-aew-buddy-matthews",
    "aew-aew-dr-britt-baker-d-m-d",
    "aew-aew-lena-kross",
    "aew-aew-megan-bayne",
    "aew-aew-pac",
    "aew-aew-roderick-strong",
    "aew-aew-tommaso-ciampa",
    "wwe-nxt-adriana-rizzo",
    "wwe-nxt-izzi-dame",
    "wwe-nxt-karmen-petrovic",
    "wwe-nxt-kendal-grey",
    "wwe-nxt-myka-lockwood",
    "wwe-nxt-ricky-smokes",
    "wwe-nxt-thea-hail",
    "wwe-raw-asuka",
    "wwe-raw-grayson-waller",
    "wwe-raw-roxanne-perez",
    "wwe-smackdown-alexa-bliss",
    "wwe-smackdown-blake-monroe",
    "wwe-smackdown-candice-lerae",
    "wwe-smackdown-chelsea-green",
    "wwe-smackdown-jade-cargill",
    "wwe-smackdown-kiana-james",
    "wwe-smackdown-piper-niven",
    "wwe-smackdown-r-truth",
    "wwe-smackdown-trick-williams",
}


def fit_background() -> Image.Image:
    image = Image.open(BACKGROUND_PATH).convert("RGB")
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    return image.crop((left, top, left + side, top + side)).resize((OUT_SIZE, OUT_SIZE), Image.Resampling.LANCZOS)


def is_artifact_white(pixel: tuple[int, int, int]) -> bool:
    return min(pixel) >= 248 and max(pixel) - min(pixel) <= 10


def connected_white_components(image: Image.Image, minimum_size: int = 900) -> list[dict]:
    rgb = image.convert("RGB")
    pixels = rgb.load()
    width, height = rgb.size
    seen: set[tuple[int, int]] = set()
    components = []

    for y in range(height):
        for x in range(width):
            if (x, y) in seen or not is_artifact_white(pixels[x, y]):
                continue
            queue = deque([(x, y)])
            seen.add((x, y))
            points = []
            min_x = max_x = x
            min_y = max_y = y

            while queue:
                cx, cy = queue.popleft()
                points.append((cx, cy))
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height or (nx, ny) in seen:
                        continue
                    if is_artifact_white(pixels[nx, ny]):
                        seen.add((nx, ny))
                        queue.append((nx, ny))

            if len(points) >= minimum_size:
                components.append(
                    {
                        "size": len(points),
                        "bbox": [min_x, min_y, max_x, max_y],
                        "points": points,
                    }
                )

    return components


def backup_targets(paths: Iterable[Path]) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = ROOT / f"public/superstars.backup-before-white-artifact-cleanup-{stamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    for path in paths:
        shutil.copy2(path, backup_dir / path.name)
    return backup_dir


def cleanup_image(path: Path, background: Image.Image) -> dict:
    image = Image.open(path).convert("RGB")
    components = connected_white_components(image)
    if not components:
        return {"id": path.stem, "status": "unchanged", "components": []}

    output = image.copy()
    output_pixels = output.load()
    background_pixels = background.load()
    for component in components:
        for x, y in component["points"]:
            output_pixels[x, y] = background_pixels[x, y]
        del component["points"]

    output.save(path)
    return {"id": path.stem, "status": "cleaned", "components": components}


def write_review_sheet(report: list[dict]) -> None:
    cleaned = [row for row in report if row["status"] == "cleaned"]
    if not cleaned:
        return

    thumb = 128
    label = 28
    cols = 6
    rows = (len(cleaned) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * thumb, rows * (thumb + label)), (18, 18, 18))
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(cleaned):
        image = Image.open(PORTRAIT_DIR / f"{row['id']}.png").convert("RGB").resize((thumb, thumb))
        x = (index % cols) * thumb
        y = (index // cols) * (thumb + label)
        sheet.paste(image, (x, y))
        draw.text((x + 3, y + thumb + 2), row["id"][:22], fill=(245, 245, 245))
    sheet.save(ROOT / "public/source-portraits/white_artifact_cleanup_sheet.jpg", quality=92)


def main() -> None:
    target_paths = [PORTRAIT_DIR / f"{portrait_id}.png" for portrait_id in sorted(TARGET_IDS)]
    missing = [str(path) for path in target_paths if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing target portraits: {missing}")

    backup_dir = backup_targets(target_paths)
    background = fit_background()
    report = [cleanup_image(path, background) for path in target_paths]
    report_path = ROOT / "public/source-portraits/white_artifact_cleanup_report.json"
    report_path.write_text(json.dumps({"backup_dir": str(backup_dir), "results": report}, indent=2) + "\n")
    write_review_sheet(report)

    cleaned = [row for row in report if row["status"] == "cleaned"]
    component_count = sum(len(row["components"]) for row in cleaned)
    print(f"Cleaned {len(cleaned)} portraits / {component_count} white regions")
    print(f"Backup: {backup_dir}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
