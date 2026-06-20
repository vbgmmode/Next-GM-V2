#!/usr/bin/env python3
import csv
import io
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ROSTER_PATH = ROOT / "data/rosters/top_200_superstar_ids.json"
OUT_DIR = ROOT / "public/source-portraits/wikimedia"
REPORT_JSON = OUT_DIR / "wikimedia_portrait_report.json"
REPORT_CSV = OUT_DIR / "wikimedia_portrait_report.csv"

WIKIDATA_API = "https://www.wikidata.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

USER_AGENT = "NextGMPrototype/1.0 local portrait asset research"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})

SEARCH_ALIASES: Dict[str, List[str]] = {
    '"Hangman" Adam Page': ["Adam Page wrestler", "Adam Page"],
    '"Timeless" Toni Storm': ["Toni Storm"],
    "Dr. Britt Baker, D.M.D.": ["Britt Baker", "Britt Baker wrestler"],
    "Channing \"Stacks\" Lorenzo": ["Channing Lorenzo", "Stacks Lorenzo"],
    "El Grande Americano": ["Chad Gable", "El Grande Americano"],
    "Original El Grande Americano": ["Rey Mysterio", "El Grande Americano"],
    "Nattie": ["Natalya Neidhart", "Natalya wrestler"],
    "Penta": ["Pentagón Jr.", "Penta El Zero Miedo", "Penta wrestler"],
    "Rusev": ["Miro wrestler", "Miroslav Barnyashev"],
    "Ricky Saints": ["Ricky Starks"],
    "Blake Monroe": ["Mariah May wrestler"],
    "Buddy Matthews": ["Buddy Murphy wrestler", "Matthew Adams wrestler"],
    "Luchasaurus": ["Killswitch wrestler", "Luchasaurus wrestler"],
    "Axiom": ["A-Kid wrestler", "Axiom wrestler"],
    "B-Fab": ["B-Fab wrestler"],
}


def request_json(url: str, params: Dict[str, Any]) -> Dict[str, Any]:
    for attempt in range(5):
        response = SESSION.get(url, params=params, timeout=30)
        if response.status_code == 429:
            time.sleep(2 + attempt * 3)
            continue
        response.raise_for_status()
        return response.json()
    response.raise_for_status()
    return response.json()


def clean_name(name: str) -> str:
    cleaned = re.sub(r'"([^"]+)"', r"\1", name)
    cleaned = cleaned.replace("D.M.D.", "").replace("Dr.", "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,")
    return cleaned


def query_candidates(name: str) -> Iterable[str]:
    seen = set()
    for query in [name, f"{name} wrestler", clean_name(name), f"{clean_name(name)} wrestler", *SEARCH_ALIASES.get(name, [])]:
        query = query.strip()
        if query and query not in seen:
            seen.add(query)
            yield query


def search_wikidata(query: str) -> List[Dict[str, Any]]:
    data = request_json(
        WIKIDATA_API,
        {
            "action": "wbsearchentities",
            "search": query,
            "language": "en",
            "format": "json",
            "limit": 8,
        },
    )
    return data.get("search", [])


def entity_is_wrestler(entity: Dict[str, Any]) -> bool:
    text = f"{entity.get('label', '')} {entity.get('description', '')}".lower()
    return "wrestler" in text or "professional wrestling" in text


def choose_entity(name: str) -> Optional[Dict[str, Any]]:
    fallback = None
    for query in query_candidates(name):
        for entity in search_wikidata(query):
            if fallback is None:
                fallback = entity
            if entity_is_wrestler(entity):
                return entity
        time.sleep(0.05)
    return fallback


def get_entity_image_filename(qid: str) -> Optional[str]:
    data = request_json(
        WIKIDATA_API,
        {
            "action": "wbgetentities",
            "ids": qid,
            "props": "claims",
            "format": "json",
        },
    )
    claims = data.get("entities", {}).get(qid, {}).get("claims", {})
    p18 = claims.get("P18", [])
    if not p18:
        return None
    value = p18[0].get("mainsnak", {}).get("datavalue", {}).get("value")
    return value if isinstance(value, str) else None


def get_commons_image_info(filename: str) -> Optional[Dict[str, Any]]:
    title = filename if filename.startswith("File:") else f"File:{filename}"
    data = request_json(
        COMMONS_API,
        {
            "action": "query",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|size|mime",
            "iiurlwidth": "1200",
            "format": "json",
        },
    )
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        infos = page.get("imageinfo", [])
        if infos:
            return infos[0]
    return None


def html_value(meta: Dict[str, Any], key: str) -> str:
    value = meta.get(key, {}).get("value", "")
    return re.sub(r"<[^>]+>", "", value).strip()


def download_image(url: str) -> Image.Image:
    response = SESSION.get(url, timeout=45)
    response.raise_for_status()
    return Image.open(io.BytesIO(response.content)).convert("RGB")


def square_crop_portrait(image: Image.Image, size: int = 512) -> Image.Image:
    width, height = image.size
    side = min(width, height)
    if height > width:
        # Top-biased crop keeps faces/upper bodies more often than a center crop.
        top = int((height - side) * 0.18)
        left = 0
    else:
        left = int((width - side) / 2)
        top = 0
    crop = image.crop((left, top, left + side, top + side)).resize((size, size), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(crop)
    draw.rectangle([0, 0, size - 1, size - 1], outline=(255, 209, 48), width=4)
    draw.rectangle([5, 5, size - 6, size - 6], outline=(19, 15, 8), width=2)
    return crop


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    roster = json.loads(ROSTER_PATH.read_text())
    rows: List[Dict[str, Any]] = []

    for index, wrestler in enumerate(roster, start=1):
        wrestler_id = wrestler["id"]
        name = wrestler["name"]
        status = "missing"
        note = ""
        entity = None
        qid = ""
        label = ""
        description = ""
        filename = ""
        source_url = ""
        license_short = ""
        artist = ""
        credit = ""

        try:
            entity = choose_entity(name)
            qid = entity.get("id") if entity else ""
            label = entity.get("label") if entity else ""
            description = entity.get("description") if entity else ""
            if not entity or not qid:
                note = "No Wikidata entity found"
            else:
                filename = get_entity_image_filename(qid) or ""
                if not filename:
                    note = "No Wikidata P18 image"
                else:
                    info = get_commons_image_info(filename)
                    if not info:
                        note = "No Commons imageinfo"
                    else:
                        source_url = info.get("descriptionurl") or info.get("url") or ""
                        meta = info.get("extmetadata", {})
                        license_short = html_value(meta, "LicenseShortName")
                        artist = html_value(meta, "Artist")
                        credit = html_value(meta, "Credit")
                        image_url = info.get("thumburl") or info.get("url")
                        if not image_url:
                            note = "No downloadable URL"
                        else:
                            image = download_image(image_url)
                            portrait = square_crop_portrait(image)
                            portrait.save(OUT_DIR / f"{wrestler_id}.png")
                            status = "saved"
                            note = "Saved from Wikimedia Commons P18 image"
        except Exception as exc:
            status = "error"
            note = f"{type(exc).__name__}: {exc}"

        rows.append(
            {
                "rank": index,
                "id": wrestler_id,
                "name": name,
                "status": status,
                "wikidata_qid": qid,
                "wikidata_label": label,
                "wikidata_description": description,
                "commons_file": filename,
                "source_url": source_url,
                "license": license_short,
                "artist": artist,
                "credit": credit,
                "note": note,
            }
        )
        print(f"{index:03d}/200 {status:7} {name} {qid} {filename}")
        time.sleep(0.45)

    REPORT_JSON.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    with REPORT_CSV.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    saved = sum(1 for row in rows if row["status"] == "saved")
    print(f"Saved {saved}/{len(rows)} portraits")
    print(f"Report: {REPORT_JSON}")
    print(f"Report: {REPORT_CSV}")


if __name__ == "__main__":
    main()
