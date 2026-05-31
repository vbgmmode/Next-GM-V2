#!/usr/bin/env python3
import io
import json
import re
import time
from pathlib import Path
from typing import Dict, List

import requests
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE_REPORT = Path("/Users/vbahmad/.gemini/antigravity/scratch/superstar_renders.md")
OUT_DIR = ROOT / "public/source-portraits/deviantart/approval-candidates"
BACKGROUND_PATH = Path("/Users/vbahmad/Downloads/ChatGPT Image May 31, 2026, 11_28_42 AM.png")
MAX_CANDIDATES = 3

SESSION = requests.Session()
SESSION.headers.update(
    {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    }
)


def parse_report() -> List[Dict]:
    text = SOURCE_REPORT.read_text()
    line_re = re.compile(r"^\| \*\*(.*?)\*\* \| `([^`]+)` \| (.*?) \|$")
    link_re = re.compile(
        r"\[(\d+)\. ([^\]]+)\]\((https://www\.deviantart\.com/[^)]+)\) by ([^(<]+?) \(Score: (\d+)\)"
    )
    rows = []
    for line in text.splitlines():
        line_match = line_re.match(line)
        if not line_match:
            continue
        name, slug, links_html = line_match.groups()
        links = []
        for link_match in link_re.finditer(links_html):
            rank, title, url, author, score = link_match.groups()
            links.append(
                {
                    "rank": int(rank),
                    "title": title.strip(),
                    "url": url,
                    "author": author.strip(),
                    "score": int(score),
                }
            )
        if links:
            rows.append({"name": name, "slug": slug, "links": links[:MAX_CANDIDATES]})
    return rows


def flags_for(name: str, title: str) -> List[str]:
    text = f"{title} {name}".lower()
    flags = []
    if any(word in text for word in ["champion", "championship", "title", "belt"]):
        flags.append("belt-champion")
    if any(word in text for word in ["tag team", "trios", "team champion"]):
        flags.append("team-tag")
    if any(word in text for word in ["toy", "card", "merch", "shirt"]):
        flags.append("merch-card")
    if name == "PAC" and "x-pac" in title.lower():
        flags.append("wrong-wrestler-risk")
    if name == "Angel" and "angel garza" not in title.lower():
        flags.append("wrong-wrestler-risk")
    if name in {"Tate Wilder", "Tristan Angels", "Matt Cardona", "EK Prosper"}:
        flags.append("manual-review")
    return flags


def page_image_url(page_url: str) -> str:
    response = SESSION.get(page_url, timeout=30)
    response.raise_for_status()
    html = response.text
    match = re.search(r'<meta property="og:image" content="([^"]+)"', html)
    if not match:
        match = re.search(r'<meta name="twitter:image" content="([^"]+)"', html)
    if not match:
        raise RuntimeError("No DeviantArt preview image found")
    return match.group(1).replace("&amp;", "&")


def fit_background() -> Image.Image:
    image = Image.open(BACKGROUND_PATH).convert("RGB")
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    return image.crop((left, top, left + side, top + side)).resize((512, 512), Image.Resampling.LANCZOS)


def transparent_profile(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if bbox:
        image = image.crop(bbox)
    width, height = image.size
    if height > width * 1.35:
        image = image.crop((0, 0, width, round(width * 1.35)))
        width, height = image.size
    scale = min((512 * 0.94) / width, (512 * 0.99) / height)
    resized = image.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((512 - resized.width) // 2, max(0, 512 - resized.height)))
    return canvas


def make_preview(source: Image.Image, background: Image.Image) -> Image.Image:
    preview = background.convert("RGBA")
    preview.alpha_composite(transparent_profile(source))
    return preview.convert("RGB")


def safe_text(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", text.strip()).strip("-").lower()


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    raw_dir = OUT_DIR / "raw"
    preview_dir = OUT_DIR / "previews"
    sheet_dir = OUT_DIR / "sheets"
    raw_dir.mkdir(exist_ok=True)
    preview_dir.mkdir(exist_ok=True)
    sheet_dir.mkdir(exist_ok=True)

    rows = parse_report()
    background = fit_background()
    manifest = []

    for row_index, row in enumerate(rows, start=1):
        print(f"{row_index:03d}/{len(rows):03d} {row['name']}")
        for link in row["links"]:
            base = f"{row['slug']}__{link['rank']}__{safe_text(link['author'])}"
            raw_path = raw_dir / f"{base}.png"
            preview_path = preview_dir / f"{base}.jpg"
            item = {
                "name": row["name"],
                "id": row["slug"],
                "rank": link["rank"],
                "title": link["title"],
                "author": link["author"],
                "score": link["score"],
                "page_url": link["url"],
                "raw_path": str(raw_path.relative_to(OUT_DIR)),
                "preview_path": str(preview_path.relative_to(OUT_DIR)),
                "flags": flags_for(row["name"], link["title"]),
                "status": "pending",
            }
            try:
                if not raw_path.exists():
                    image_url = page_image_url(link["url"])
                    item["image_url"] = image_url
                    response = SESSION.get(image_url, timeout=45)
                    response.raise_for_status()
                    source = Image.open(io.BytesIO(response.content)).convert("RGBA")
                    source.save(raw_path)
                    time.sleep(0.2)
                else:
                    source = Image.open(raw_path).convert("RGBA")
                make_preview(source, background).save(preview_path, quality=92)
                item["status"] = "saved"
                item["source_size"] = source.size
            except Exception as exc:
                item["status"] = "error"
                item["error"] = f"{type(exc).__name__}: {exc}"
            manifest.append(item)

    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    write_approval_csv(manifest)
    write_contact_sheets(manifest, sheet_dir)
    write_index(manifest)
    errors = [item for item in manifest if item["status"] != "saved"]
    print(f"Saved {len(manifest) - len(errors)}/{len(manifest)} candidates")
    print(f"Errors: {len(errors)}")
    print(f"Output: {OUT_DIR}")


def write_approval_csv(manifest: List[Dict]) -> None:
    path = OUT_DIR / "approval.csv"
    with path.open("w") as handle:
        handle.write("approve,name,id,rank,title,author,score,flags,page_url,preview_path,raw_path,status,error\n")
        for item in manifest:
            values = [
                "",
                item["name"],
                item["id"],
                item["rank"],
                item["title"],
                item["author"],
                item["score"],
                ";".join(item["flags"]),
                item["page_url"],
                item["preview_path"],
                item["raw_path"],
                item["status"],
                item.get("error", ""),
            ]
            handle.write(",".join(csv_quote(value) for value in values) + "\n")


def csv_quote(value) -> str:
    text = str(value).replace('"', '""')
    return f'"{text}"'


def write_contact_sheets(manifest: List[Dict], sheet_dir: Path) -> None:
    saved = [item for item in manifest if item["status"] == "saved"]
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 12)
    except Exception:
        font = ImageFont.load_default()
    thumb = 128
    label_h = 44
    cols = 5
    rows = 4
    per_sheet = cols * rows
    for sheet_index in range((len(saved) + per_sheet - 1) // per_sheet):
        chunk = saved[sheet_index * per_sheet : (sheet_index + 1) * per_sheet]
        sheet = Image.new("RGB", (cols * thumb, rows * (thumb + label_h)), (18, 18, 18))
        draw = ImageDraw.Draw(sheet)
        for index, item in enumerate(chunk):
            x = (index % cols) * thumb
            y = (index // cols) * (thumb + label_h)
            preview = Image.open(OUT_DIR / item["preview_path"]).convert("RGB").resize((thumb, thumb))
            sheet.paste(preview, (x, y))
            draw.rectangle([x, y + thumb, x + thumb, y + thumb + label_h], fill=(0, 0, 0))
            flags = ",".join(item["flags"]) or "clean"
            draw.text((x + 3, y + thumb + 3), f"{item['name'][:18]} #{item['rank']}", fill=(235, 235, 235), font=font)
            draw.text((x + 3, y + thumb + 18), flags[:20], fill=(255, 205, 80), font=font)
            draw.text((x + 3, y + thumb + 31), item["id"][-20:], fill=(170, 170, 170), font=font)
        sheet.save(sheet_dir / f"sheet_{sheet_index + 1:02d}.jpg", quality=92)


def write_index(manifest: List[Dict]) -> None:
    path = OUT_DIR / "index.md"
    with path.open("w") as handle:
        handle.write("# DeviantArt Manual Approval Candidates\n\n")
        handle.write("Mark approved rows in `approval.csv`, or send back chosen page URLs/IDs.\n\n")
        handle.write("| Name | ID | Rank | Preview | Flags | Page |\n")
        handle.write("|---|---|---:|---|---|---|\n")
        for item in manifest:
            preview = item["preview_path"] if item["status"] == "saved" else ""
            preview_link = f"[preview]({preview})" if preview else item["status"]
            flags = ", ".join(item["flags"]) or "-"
            handle.write(
                f"| {item['name']} | `{item['id']}` | {item['rank']} | {preview_link} | {flags} | [{item['title']}]({item['page_url']}) |\n"
            )


if __name__ == "__main__":
    main()
