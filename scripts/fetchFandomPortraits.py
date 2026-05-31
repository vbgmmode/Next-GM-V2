#!/usr/bin/env python3
import argparse
import csv
import io
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import requests
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
ROSTER_PATH = ROOT / "data/rosters/top_200_superstar_ids.json"
DEFAULT_OUT_DIR = ROOT / "public/superstars"
REPORT_DIR = ROOT / "public/source-portraits/fandom"
REPORT_JSON = REPORT_DIR / "fandom_portrait_report.json"
REPORT_CSV = REPORT_DIR / "fandom_portrait_report.csv"

FANDOM_API = "https://prowrestling.fandom.com/api.php"
USER_AGENT = "NextGMPrototype/1.0 local portrait asset research"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})

SEARCH_ALIASES: Dict[str, List[str]] = {
    '"Hangman" Adam Page': ["Adam Page"],
    '"Timeless" Toni Storm': ["Toni Storm"],
    "Axiom": ["A-Kid", "Axiom wrestler"],
    "B-Fab": ["B-Fab wrestler"],
    "Blake Monroe": ["Mariah May", "Blake Monroe wrestler"],
    "Bravo Americano": ["Tyler Bate"],
    "Buddy Matthews": ["Buddy Murphy", "Matthew Adams"],
    "Channing \"Stacks\" Lorenzo": ["Channing Lorenzo", "Stacks Lorenzo"],
    "Dr. Britt Baker, D.M.D.": ["Britt Baker"],
    "EK Prosper": ["Eli Knight"],
    "El Grande Americano": ["Chad Gable", "El Grande Americano wrestler"],
    "Finn Bálor": ["Finn Balor"],
    "Hologram": ["Aramis (luchador)", "Aramis wrestler", "Aramis luchador"],
    "IYO SKY": ["Io Shirai", "Iyo Sky"],
    "Je'Von Evans": ["Je'Von Evans", "Jevon Evans"],
    "Lizzy Rain": ["Rayne Leverkusen"],
    "Luchasaurus": ["Killswitch", "Luchasaurus wrestler"],
    "Mason Rook": ["Will Kroos"],
    "Mercedes Moné": ["Mercedes Mone", "Sasha Banks"],
    "Michin": ["Mia Yim"],
    "Myka Lockwood": ["Bayley Humphrey"],
    "Naraku": ["EVIL wrestler", "EVIL"],
    "Nattie": ["Natalya", "Natalya Neidhart"],
    "Original El Grande Americano": ["Rey Mysterio", "El Grande Americano"],
    "Penta": ["Penta El Zero Miedo", "Pentagón Jr.", "Penta wrestler"],
    "Ricky Saints": ["Ricky Starks"],
    "Rusev": ["Miro", "Rusev wrestler"],
    "Tristan Angels": ["Nathan Angel"],
    "Angel": ["Angel Garza"],
}

BAD_TITLE_PARTS = (
    "/Image gallery",
    "/Magazine covers",
    "/Merchandise",
    "/Toys",
    "(AEW Unrivaled",
    "(WWE Elite",
    "(WWE Series",
    "(Panini",
    "(No.",
    " T-Shirt",
    " Shirt",
    "Merchandise",
    "Upper Deck",
    "vs.",
)


def request_json(params: Dict[str, Any]) -> Dict[str, Any]:
    for attempt in range(5):
        response = SESSION.get(FANDOM_API, params=params, timeout=30)
        if response.status_code in (429, 502, 503, 504):
            time.sleep(2 + attempt * 3)
            continue
        response.raise_for_status()
        return response.json()
    response.raise_for_status()
    return response.json()


def clean_name(name: str) -> str:
    cleaned = re.sub(r'"([^"]+)"', r"\1", name)
    cleaned = cleaned.replace("D.M.D.", "").replace("Dr.", "")
    cleaned = cleaned.replace("é", "e").replace("á", "a").replace("ó", "o")
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,")
    return cleaned


def query_candidates(name: str) -> Iterable[str]:
    seen = set()
    for query in [name, clean_name(name), f"{name} wrestler", f"{clean_name(name)} wrestler", *SEARCH_ALIASES.get(name, [])]:
        query = query.strip()
        if query and query.lower() not in seen:
            seen.add(query.lower())
            yield query


def search_pages(query: str) -> List[Dict[str, Any]]:
    data = request_json(
        {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "format": "json",
            "srlimit": 8,
        }
    )
    return data.get("query", {}).get("search", [])


def resolve_page_title(title: str) -> Optional[str]:
    data = request_json(
        {
            "action": "query",
            "titles": title,
            "prop": "info|pageimages",
            "pithumbsize": 900,
            "inprop": "url",
            "redirects": 1,
            "format": "json",
        }
    )
    for page in data.get("query", {}).get("pages", {}).values():
        if page.get("missing") is not None or page.get("ns") != 0:
            return None
        resolved = page.get("title", "")
        if resolved and page.get("thumbnail") and not any(part in resolved for part in BAD_TITLE_PARTS):
            return resolved
    return None


def normalize_title(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", clean_name(text).lower())


def title_score(name: str, title: str, rank: int) -> int:
    if any(part in title for part in BAD_TITLE_PARTS):
        return -100
    expected = normalize_title(name)
    actual = normalize_title(title)
    aliases = [normalize_title(alias) for alias in SEARCH_ALIASES.get(name, [])]
    score = max(0, 20 - rank)
    if actual == expected or actual in aliases:
        score += 100
    elif expected and (expected in actual or actual in expected):
        score += 50
    elif any(alias and (alias in actual or actual in alias) for alias in aliases):
        score += 45
    if "(" in title:
        score -= 20
    return score


def choose_page(name: str) -> Optional[Dict[str, Any]]:
    for query in query_candidates(name):
        resolved = resolve_page_title(query)
        if resolved:
            return {"title": resolved}
        time.sleep(0.05)

    best: Optional[Dict[str, Any]] = None
    best_score = -1
    for query in query_candidates(name):
        for rank, page in enumerate(search_pages(query), start=1):
            score = title_score(name, page.get("title", ""), rank)
            if score > best_score:
                best = page
                best_score = score
        if best and best_score >= 90:
            return best
        time.sleep(0.08)
    return best if best_score >= 20 else None


def get_page_image(title: str, size: int) -> Dict[str, Any]:
    data = request_json(
        {
            "action": "query",
            "titles": title,
            "prop": "pageimages|pageprops|info",
            "pithumbsize": max(size * 3, 900),
            "inprop": "url",
            "format": "json",
        }
    )
    pages = data.get("query", {}).get("pages", {})
    page = next(iter(pages.values()), {})
    thumbnail = page.get("thumbnail") or {}
    return {
        "pageid": page.get("pageid", ""),
        "title": page.get("title", title),
        "page_url": page.get("fullurl", ""),
        "image_url": thumbnail.get("source", ""),
        "pageimage": page.get("pageimage", ""),
    }


def download_image(url: str) -> Image.Image:
    response = SESSION.get(url, timeout=45)
    response.raise_for_status()
    return Image.open(io.BytesIO(response.content)).convert("RGBA")


def subject_bbox(image: Image.Image) -> Optional[tuple[int, int, int, int]]:
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    alpha_bbox = image.getchannel("A").getbbox()
    if alpha_bbox:
        return alpha_bbox

    rgb = image.convert("RGB")
    white = Image.new("RGB", rgb.size, (255, 255, 255))
    diff = ImageChops.difference(rgb, white).convert("L")
    return diff.point(lambda value: 255 if value > 18 else 0).getbbox()


def square_profile(image: Image.Image, size: int) -> Image.Image:
    bbox = subject_bbox(image)
    if bbox:
        image = image.crop(bbox)

    width, height = image.size
    if height > width * 1.35:
        image = image.crop((0, 0, width, round(width * 1.35)))
        width, height = image.size

    target_width = int(size * 0.94)
    target_height = int(size * 0.99)
    scale = min(target_width / width, target_height / height)
    resized = image.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    left = (size - resized.width) // 2
    top = max(0, size - resized.height)
    canvas.alpha_composite(resized, (left, top))
    return canvas.convert("RGB")


def write_reports(rows: List[Dict[str, Any]]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    with REPORT_CSV.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch square wrestler portraits from Pro Wrestling Fandom.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--size", type=int, default=512)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    roster = json.loads(ROSTER_PATH.read_text())
    if args.limit:
        roster = roster[: args.limit]
    args.output_dir.mkdir(parents=True, exist_ok=True)

    rows: List[Dict[str, Any]] = []
    for index, wrestler in enumerate(roster, start=1):
        wrestler_id = wrestler["id"]
        name = wrestler["name"]
        status = "missing"
        note = ""
        page_title = ""
        page_url = ""
        image_url = ""
        pageimage = ""

        try:
            page = choose_page(name)
            if not page:
                note = "No strong Fandom page match"
            else:
                page_title = page.get("title", "")
                image_info = get_page_image(page_title, args.size)
                page_url = image_info["page_url"]
                image_url = image_info["image_url"]
                pageimage = image_info["pageimage"]
                if not image_url:
                    note = "Matched page has no page image"
                elif args.dry_run:
                    status = "dry-run"
                    note = "Matched Fandom image"
                else:
                    image = download_image(image_url)
                    square = square_profile(image, args.size)
                    square.save(args.output_dir / f"{wrestler_id}.png")
                    status = "saved"
                    note = "Saved square portrait from Pro Wrestling Fandom page image"
        except Exception as exc:
            status = "error"
            note = f"{type(exc).__name__}: {exc}"

        rows.append(
            {
                "rank": index,
                "id": wrestler_id,
                "name": name,
                "status": status,
                "matched_page": page_title,
                "page_url": page_url,
                "pageimage": pageimage,
                "image_url": image_url,
                "note": note,
            }
        )
        print(f"{index:03d}/{len(roster):03d} {status:7} {name} -> {page_title or '-'}")
        time.sleep(0.28)

    write_reports(rows)
    saved = sum(1 for row in rows if row["status"] == "saved")
    dry = sum(1 for row in rows if row["status"] == "dry-run")
    print(f"Saved {saved}/{len(rows)} portraits")
    if dry:
        print(f"Dry-run matched {dry}/{len(rows)} portraits")
    print(f"Report: {REPORT_JSON}")
    print(f"Report: {REPORT_CSV}")


if __name__ == "__main__":
    main()
