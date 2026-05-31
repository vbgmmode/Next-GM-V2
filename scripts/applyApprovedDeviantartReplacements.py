#!/usr/bin/env python3
import io
import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BACKGROUND_PATH = Path("/Users/vbahmad/Downloads/ChatGPT Image May 31, 2026, 11_28_42 AM.png")
PORTRAIT_DIR = ROOT / "public/superstars"
SOURCE_DIR = ROOT / "public/source-portraits/deviantart/approved-replacements"
RESOLVER_PATH = ROOT / "src/game/wrestlerPortraits.ts"
ATTACHMENT_BATCH_PATH = Path("/Users/vbahmad/.codex/attachments/94d0a93b-17d7-43df-bfba-cbddb305b1da/pasted-text.txt")
OUT_SIZE = 512

APPROVED = [
    ("wwe-smackdown-cody-rhodes", "Cody Rhodes", "https://www.deviantart.com/wwewomendaily/art/Cody-Rhodes-WWE-Render-PNG-1302106153"),
    ("aew-aew-kazuchika-okada", "Kazuchika Okada", "https://www.deviantart.com/mrelijahrend/art/Kazuchika-Okada-AEW-Update-Render-2026-1337199875"),
    ("aew-aew-chris-jericho", "Chris Jericho", "https://www.deviantart.com/xharlott/art/Chris-Jericho-26-Render-1316933972"),
    ("wwe-raw-cm-punk", "CM Punk", "https://www.deviantart.com/line2j/art/CM-Punk-2026-Render-WWE-1332086875"),
    ("wwe-raw-liv-morgan", "Liv Morgan", "https://www.deviantart.com/livvonce/art/Liv-Morgan-WWE-Render-by-livsriott-1240126645"),
    ("aew-aew-will-ospreay", "Will Ospreay", "https://www.deviantart.com/xcin3kk/art/Will-Ospreay-Render-2024-3-1144185096"),
    ("wwe-raw-naomi", "Naomi", "https://www.deviantart.com/yasuke4u/art/Naomi-Render-by-yasuke4u-1317865886"),
    ("wwe-raw-stephanie-vaquer", "Stephanie Vaquer", "https://www.deviantart.com/lars125/art/Stephanie-Vaquer-Render-1238293420"),
    ("wwe-raw-asuka", "Asuka", "https://www.deviantart.com/livvonce/art/Asuka-WWE-2025-Render-by-livsriott-1240018473"),
    ("wwe-raw-bron-breakker", "Bron Breakker", "https://www.deviantart.com/wweusosfans/art/Bron-breakker-render-1278314964"),
    ("aew-aew-thekla", "Thekla", "https://www.deviantart.com/kiddmoxxie/art/Thekla-2026-Render-1283711122"),
    ("aew-aew-willow-nightingale", "Willow Nightingale", "https://www.deviantart.com/wrestlerender/art/Willow-Nightingale-OFFICIAL-AEW-Render-2024-1035808359"),
    ("wwe-smackdown-jade-cargill", "Jade Cargill", "https://www.deviantart.com/yasuke4u/art/Jade-Cargill-Render-by-yasuke4u-1309841992"),
    ("aew-aew-swerve-strickland", "Swerve Strickland", "https://www.deviantart.com/wrestlerender/art/Swerve-Strickland-OFFICIAL-AEW-Render-2024-1035805412"),
    ("wwe-smackdown-jacob-fatu", "Jacob Fatu", "https://www.deviantart.com/danteofshadows/art/Jacob-Fatu-render-1219520781"),
    ("aew-aew-jay-white", "Jay White", "https://www.deviantart.com/tdg129/art/Jay-White-Bullet-Club-Render-1330602232"),
    ("aew-aew-megan-bayne", "Megan Bayne", "https://www.deviantart.com/caelaniguess/art/Megan-Bayne-AEW-Render-1158118068"),
    ("aew-aew-eddie-kingston", "Eddie Kingston", "https://www.deviantart.com/ihammertg/art/Eddie-Kingston-AEW-Render-2024-1122521655"),
    ("aew-aew-adam-copeland", "Adam Copeland", "https://www.deviantart.com/wrestlerender/art/Adam-Copeland-OFFICIAL-AEW-Render-2023-1031312574"),
    ("aew-aew-pac", "PAC", "https://www.deviantart.com/fandango18002/art/PAC-AEW-Render-1246295560"),
    ("wwe-raw-jey-uso", "Jey Uso", "https://www.deviantart.com/tribalgrafixx/art/Jey-Uso-s-Official-WWE-Render-2026-1328179242"),
    ("aew-aew-kyle-o-reilly", "Kyle O'Reilly", "https://www.deviantart.com/fandango18002/art/Kyle-O-Reilly-AEW-Render-1251263463"),
    ("aew-aew-samoa-joe", "Samoa Joe", "https://www.deviantart.com/remnant74428/art/Samoa-Joe-render-1145630064"),
    ("wwe-raw-logan-paul", "Logan Paul", "https://www.deviantart.com/yasuke4u/art/Logan-Paul-Render-by-yasuke4u-1319217947"),
    ("aew-aew-roderick-strong", "Roderick Strong", "https://www.deviantart.com/kiddmoxxie/art/Roderick-Strong-Custom-Render-1268312009"),
    ("aew-aew-bobby-lashley", "Bobby Lashley", "https://www.deviantart.com/dunktheclown/art/Bobby-Lashley-png-Render-1337202120"),
    ("wwe-smackdown-kevin-owens", "Kevin Owens", "https://www.deviantart.com/xharlott/art/Kevin-Owen-23-Render-1310573057"),
    ("aew-aew-mark-davis", "Mark Davis", "https://www.deviantart.com/sierradzn/art/Mark-Davis-AEW-Render-PNG-2024-1017787022"),
    ("wwe-raw-la-knight", "LA Knight", "https://www.deviantart.com/tdg129/art/La-Knight-Casual-Render-1336216641"),
    ("wwe-smackdown-sami-zayn", "Sami Zayn", "https://www.deviantart.com/ykprihodilo/art/Sami-Zayn-WWE-Render-2025-1249155198"),
    ("wwe-smackdown-giulia", "Giulia", "https://www.deviantart.com/yasuke4u/art/Giulia-Render-by-yasuke4u-1318937278"),
    ("wwe-raw-nattie", "Nattie", "https://www.deviantart.com/womensvengeance/art/Nattie-Render-2026-1330142789"),
    ("wwe-raw-raquel-rodriguez", "Raquel Rodriguez", "https://www.deviantart.com/xlone2k/art/WWE-2K-RENDER-RAQUEL-RODRIGUEZ-1291697151"),
    ("wwe-smackdown-damian-priest", "Damian Priest", "https://www.deviantart.com/xthawheat/art/Damian-Priest-Render-1213475622"),
    ("wwe-raw-sheamus", "Sheamus", "https://www.deviantart.com/danteofshadows/art/Sheamus-render-1157315020"),
    ("wwe-raw-finn-b-lor", "Finn Bálor", "https://www.deviantart.com/yasuke4u/art/Finn-Balor-Render-by-yasuke4u-1319217857"),
    ("wwe-raw-dominik-mysterio", "Dominik Mysterio", "https://www.deviantart.com/yasuke4u/art/Dominik-Mysterio-Render-by-yasuke4u-1319217776"),
    ("aew-aew-lena-kross", "Lena Kross", "https://www.deviantart.com/yasuke4u/art/Lena-Kross-Render-by-yasuke4u-1313984458"),
    ("wwe-smackdown-alexa-bliss", "Alexa Bliss", "https://www.deviantart.com/yasuke4u/art/Alexa-Bliss-Render-by-yasuke4u-1319364023"),
    ("wwe-raw-jimmy-uso", "Jimmy Uso", "https://www.deviantart.com/afanofbigbrojimmyuso/art/WWE-2K24-Jimmy-Uso-Render-1309402995"),
    ("wwe-smackdown-shinsuke-nakamura", "Shinsuke Nakamura", "https://www.deviantart.com/xharlott/art/Shinsuke-Nakamura-25-Render-1286229083"),
    ("wwe-smackdown-chelsea-green", "Chelsea Green", "https://www.deviantart.com/longkissgdnyt/art/Chelsea-Green-Render-1297436492"),
    ("wwe-smackdown-ilja-dragunov", "Ilja Dragunov", "https://www.deviantart.com/danteofshadows/art/Ilja-Dragunov-render-1313211020"),
    ("wwe-raw-roxanne-perez", "Roxanne Perez", "https://www.deviantart.com/livvonce/art/Roxanne-Perez-WWE-Render-PNG-by-livsriott-1326973241"),
    ("wwe-smackdown-trick-williams", "Trick Williams", "https://www.deviantart.com/dillonclay5/art/Wwe-trick-williams-render-1295215268"),
    ("aew-aew-mark-briscoe", "Mark Briscoe", "https://www.deviantart.com/wrestlerender/art/Mark-Briscoe-OFFICIAL-AEW-Render-2025-1181854703"),
    ("aew-aew-tommaso-ciampa", "Tommaso Ciampa", "https://www.deviantart.com/dmtaco/art/Tommaso-Ciampa-AEW-Render-1302850210"),
    ("aew-aew-christian-cage", "Christian Cage", "https://www.deviantart.com/goldystormwwe/art/Christian-Cage-AEW-2025-Render-1213849903"),
    ("wwe-raw-el-grande-americano", "El Grande Americano", "https://www.deviantart.com/yasuke4u/art/El-Grande-Americano-Render-by-yasuke4u-1319217895"),
    ("aew-aew-matt-jackson", "Matt Jackson", "https://www.deviantart.com/xlone2k/art/WWE-2K-RENDER-MATT-JACKSON-1291701559"),
    ("aew-aew-nick-jackson", "Nick Jackson", "https://www.deviantart.com/xlone2k/art/WWE-2K-RENDER-NICK-JACKSON-1291701783"),
    ("wwe-raw-original-el-grande-americano", "Original El Grande Americano", "https://www.deviantart.com/dunktheclown/art/Original-El-Grande-Americano-2026-png-Render-1314399551"),
    ("wwe-smackdown-solo-sikoa", "Solo Sikoa", "https://www.deviantart.com/wrestlerender/art/Solo-Sikoa-OFFICIAL-WWE-Render-2025-1203353814"),
    ("wwe-raw-rey-mysterio", "Rey Mysterio", "https://www.deviantart.com/yanrtbtn/art/WWE-Rey-Mysterio-PNG-Render-2025-1162713466"),
    ("aew-aew-athena", "Athena", "https://www.deviantart.com/yasuke4u/art/Athena-Render-by-yasuke4u-1302178687"),
    ("aew-aew-hikaru-shida", "Hikaru Shida", "https://www.deviantart.com/2kwomensrenders/art/Hikaru-Shida-WWE-2K25-Render-HQ-PNG-1284036854"),
    ("aew-aew-jamie-hayter", "Jamie Hayter", "https://www.deviantart.com/elitejoshiarchive/art/Jamie-Hayter-AEW-Render-2026-1327329873"),
    ("aew-aew-kris-statlander", "Kris Statlander", "https://www.deviantart.com/elitejoshiarchive/art/Kris-Statlander-AEW-Render-2026-1332698451"),
    ("aew-aew-thunder-rosa", "Thunder Rosa", "https://www.deviantart.com/dmtaco/art/Thunder-Rosa-New-AEW-Render-1306827521"),
    ("wwe-raw-ethan-page", "Ethan Page", "https://www.deviantart.com/yasuke4u/art/Ethan-Page-Render-by-yasuke4u-1319217973"),
    ("wwe-smackdown-carmelo-hayes", "Carmelo Hayes", "https://www.deviantart.com/1angro/art/Carmelo-Hayes-1321690877"),
    ("aew-aew-konosuke-takeshita", "Konosuke Takeshita", "https://www.deviantart.com/elkr1zbeuve/art/KONOSUKE-TAKESHITA-RENDER-2024-AEW-NJPW-DDT-1099329849"),
    ("wwe-raw-austin-theory", "Austin Theory", "https://www.deviantart.com/yasuke4u/art/Austin-Theory-Render-by-yasuke4u-1319217960"),
    ("aew-aew-kyle-fletcher", "Kyle Fletcher", "https://www.deviantart.com/yasuke4u/art/Kyle-Fletcher-Render-by-yasuke4u-1312123623"),
    ("aew-aew-shelton-benjamin", "Shelton Benjamin", "https://www.deviantart.com/fandango18002/art/Shelton-Benjamin-AEW-Render-1244491184"),
    ("wwe-smackdown-ricky-saints", "Ricky Saints", "https://www.deviantart.com/dillonclay5/art/Wwe-ricky-saints-render-1309416861"),
    ("aew-aew-adam-cole", "Adam Cole", "https://www.deviantart.com/wrestlerender/art/Adam-Cole-OFFICIAL-AEW-Render-2025-1181854659"),
    ("wwe-smackdown-michin", "Michin", "https://www.deviantart.com/livvonce/art/Michin-WWE-Render-PNG-by-livsriott-1326968660"),
    ("wwe-smackdown-r-truth", "R-Truth", "https://www.deviantart.com/vlysyuk/art/WWE-R-Truth-render-2024-1031978110"),
    ("wwe-smackdown-the-miz", "The Miz", "https://www.deviantart.com/showingoffarts/art/The-Miz-NEW-Render-2018-736444112"),
    ("wwe-smackdown-jordynne-grace", "Jordynne Grace", "https://www.deviantart.com/blacksoulp/art/Jordynne-Grace-render-1332243442"),
    ("wwe-smackdown-lash-legend", "Lash Legend", "https://www.deviantart.com/annth0nny/art/LASH-LEGEND-1287705981"),
    ("aew-aew-dr-britt-baker-d-m-d", "Dr. Britt Baker, D.M.D.", "https://www.deviantart.com/wwe2k24renders/art/AEW-Dr-Britt-Baker-D-M-D-WWE-2K23-V3-978831498"),
    ("aew-aew-timeless-toni-storm", "\"Timeless\" Toni Storm", "https://www.deviantart.com/1angro/art/Timeless-Toni-Storm-24-1299929117"),
    ("wwe-raw-montez-ford", "Montez Ford", "https://www.deviantart.com/danteofshadows/art/Montez-Ford-render-1202189023"),
    ("wwe-smackdown-jacy-jayne", "Jacy Jayne", "https://www.deviantart.com/livvonce/art/Jacy-Jayne-WWE-2026-Render-PNG-by-livsriott-1328444354"),
    ("wwe-nxt-kelani-jordan", "Kelani Jordan", "https://www.deviantart.com/babuguuscooties/art/Kelani-Jordan-NEW-NXT-render-26-1332629649"),
    ("wwe-raw-dragon-lee", "Dragon Lee", "https://www.deviantart.com/xharlott/art/Dragon-Lee-WM42-Render-1326611211"),
    ("wwe-raw-jd-mcdonagh", "JD McDonagh", "https://www.deviantart.com/yasuke4u/art/JD-McDonagh-Render-by-yasuke4u-1319217865"),
    ("wwe-nxt-tony-d-angelo", "Tony D'Angelo", "https://www.deviantart.com/babuguuscooties/art/Tony-D-Angelo-OFFICIAL-NXT-render-26-1301142405"),
    ("wwe-raw-angelo-dawkins", "Angelo Dawkins", "https://www.deviantart.com/wwewomendaily/art/Angelo-Dawkins-WWE-Render-PNG-1203827638"),
    ("wwe-raw-je-von-evans", "Je'Von Evans", "https://www.deviantart.com/secondxcity/art/Je-von-Evans-1293851671"),
    ("wwe-smackdown-blake-monroe", "Blake Monroe", "https://www.deviantart.com/yasuke4u/art/Blake-Monroe-Render-by-yasuke4u-1318413717"),
    ("wwe-smackdown-fallon-henley", "Fallon Henley", "https://www.deviantart.com/womensvengeance/art/Fallon-Henley-Render-2026-1320678131"),
    ("wwe-nxt-lola-vice", "Lola Vice", "https://www.deviantart.com/xharlott/art/Lola-Vice-26-Render-1316451404"),
    ("wwe-raw-maxxine-dupri", "Maxxine Dupri", "https://www.deviantart.com/wrestlerender/art/MAXXINE-DUPRI-OFFICIAL-WWE-Render-2025-1208964170"),
    ("wwe-nxt-hank-walker", "Hank Walker", "https://www.deviantart.com/xlone2k/art/WWE-2K-RENDER-HANK-WALKER-1291702536"),
    ("wwe-nxt-tank-ledger", "Tank Ledger", "https://www.deviantart.com/yanrtbtn/art/WWE-Tank-Ledger-PNG-Render-2026-1319649844"),
    ("wwe-raw-ivar", "Ivar", "https://www.deviantart.com/wrestlingprimespace/art/IVAR-1247854042"),
    ("wwe-nxt-jaida-parker", "Jaida Parker", "https://www.deviantart.com/wrestlerender/art/Jaida-Parker-OFFICIAL-WWE-Render-2025-1165684047"),
    ("wwe-raw-sol-ruca", "Sol Ruca", "https://www.deviantart.com/danteofshadows/art/Sol-Ruca-render-1202189058"),
    ("wwe-raw-erik", "Erik", "https://www.deviantart.com/yanrtbtn/art/WWE-Erik-Render-PNG-2025-1213618964"),
    ("wwe-nxt-noam-dar", "Noam Dar", "https://www.deviantart.com/yanrtbtn/art/WWE-Noam-Dar-PNG-Render-2026-1339094643"),
    ("wwe-raw-ivy-nile", "Ivy Nile", "https://www.deviantart.com/yasuke4u/art/Ivy-Nile-Render-by-yasuke4u-1318413788"),
    ("wwe-nxt-izzi-dame", "Izzi Dame", "https://www.deviantart.com/yasuke4u/art/Izzi-Dame-Render-by-yasuke4u-1317811313"),
]


def load_roster_name_map() -> dict[str, str]:
    roster_path = ROOT / "data/rosters/top_200_superstar_ids.json"
    rows = json.loads(roster_path.read_text())
    return {row["name"]: row["id"] for row in rows}


def load_attachment_approved() -> list[tuple[str, str, str]]:
    if not ATTACHMENT_BATCH_PATH.exists():
        return []
    name_map = load_roster_name_map()
    rows = []
    for line in ATTACHMENT_BATCH_PATH.read_text().splitlines():
        match = re.match(r"(.+?) render (https://\S+)", line.strip())
        if not match:
            continue
        name, url = match.groups()
        if name not in name_map:
            raise ValueError(f"Attachment render name is not in roster: {name}")
        rows.append((name_map[name], name, url.strip()))
    return rows


def approved_rows() -> list[tuple[str, str, str]]:
    rows = APPROVED + load_attachment_approved()
    deduped: dict[str, tuple[str, str, str]] = {}
    for wrestler_id, name, page_url in rows:
        deduped[wrestler_id] = (wrestler_id, name, page_url)
    return list(deduped.values())

SESSION = requests.Session()
SESSION.headers.update(
    {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
)


def fit_background() -> Image.Image:
    image = Image.open(BACKGROUND_PATH).convert("RGB")
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    return image.crop((left, top, left + side, top + side)).resize((OUT_SIZE, OUT_SIZE), Image.Resampling.LANCZOS)


def load_aliases() -> dict[str, str]:
    text = RESOLVER_PATH.read_text()
    alias_block = text.split("const availableWrestlerPortraitIds")[0]
    return dict(re.findall(r'"([^"]+)": "([^"]+)"', alias_block))


def page_image_url(page_url: str) -> str:
    response = SESSION.get(page_url, timeout=30)
    response.raise_for_status()
    html = response.text
    for pattern in (
        r'<meta property="og:image" content="([^"]+)"',
        r'<meta name="twitter:image" content="([^"]+)"',
        r'"prettyName":"fullview","c":"([^"]+)"',
    ):
        match = re.search(pattern, html)
        if match:
            return match.group(1).replace("\\u002F", "/").replace("&amp;", "&")
    raise RuntimeError("No DeviantArt image URL found")


def remove_flat_background(source: Image.Image) -> Image.Image:
    rgba = source.convert("RGBA")
    if rgba.getchannel("A").getextrema()[0] < 255:
        return rgba

    rgb = rgba.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    corners = [pixels[0, 0], pixels[width - 1, 0], pixels[0, height - 1], pixels[width - 1, height - 1]]
    bg = max(corners, key=corners.count)

    def close_to_bg(pixel: tuple[int, int, int]) -> bool:
        return sum(abs(pixel[i] - bg[i]) for i in range(3)) <= 42

    visited = set()
    stack = []
    for x in range(width):
        for y in (0, height - 1):
            if close_to_bg(pixels[x, y]):
                visited.add((x, y))
                stack.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if close_to_bg(pixels[x, y]) and (x, y) not in visited:
                visited.add((x, y))
                stack.append((x, y))

    while stack:
        x, y = stack.pop()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height or (nx, ny) in visited:
                continue
            if close_to_bg(pixels[nx, ny]):
                visited.add((nx, ny))
                stack.append((nx, ny))

    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    for point in visited:
        alpha_pixels[point] = 0
    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.6))
    rgba.putalpha(alpha)
    return rgba


def profile_from_source(image: Image.Image) -> Image.Image:
    image = remove_flat_background(image)
    bbox = image.getchannel("A").getbbox()
    if bbox:
        image = image.crop(bbox)

    width, height = image.size
    if height > width * 1.45:
        image = image.crop((0, 0, width, round(width * 1.45)))
        width, height = image.size

    target_width = int(OUT_SIZE * 0.94)
    target_height = int(OUT_SIZE * 0.99)
    scale = min(target_width / width, target_height / height)
    resized = image.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((OUT_SIZE - resized.width) // 2, max(0, OUT_SIZE - resized.height)))
    return canvas


def fetch_source(page_url: str, raw_path: Path) -> tuple[Optional[Image.Image], dict]:
    try:
        image_url = page_image_url(page_url)
        response = SESSION.get(image_url, timeout=45)
        response.raise_for_status()
        image = Image.open(io.BytesIO(response.content)).convert("RGBA")
        image.save(raw_path)
        return image, {"status": "saved", "image_url": image_url, "source_size": image.size}
    except Exception as exc:
        return None, {"status": "error", "error": f"{type(exc).__name__}: {exc}"}


def backup_targets() -> Path:
    aliases = load_aliases()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = ROOT / f"public/superstars.backup-before-approved-deviantart-{stamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    for wrestler_id, _, _ in approved_rows():
        for portrait_id in {wrestler_id, aliases.get(wrestler_id, wrestler_id)}:
            path = PORTRAIT_DIR / f"{portrait_id}.png"
            if path.exists():
                shutil.copy2(path, backup_dir / path.name)
    return backup_dir


def main() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    aliases = load_aliases()
    background = fit_background().convert("RGBA")
    backup_dir = backup_targets()
    report = []

    for wrestler_id, name, page_url in approved_rows():
        raw_path = SOURCE_DIR / f"{wrestler_id}.source.png"
        portrait_path = PORTRAIT_DIR / f"{wrestler_id}.png"
        item = {"id": wrestler_id, "name": name, "page_url": page_url, "raw_path": str(raw_path)}
        if not portrait_path.exists():
            item.update({"status": "error", "error": "portrait target does not exist"})
            report.append(item)
            continue

        source = Image.open(raw_path).convert("RGBA") if raw_path.exists() else None
        if source is None:
            source, fetch_report = fetch_source(page_url, raw_path)
            item.update(fetch_report)
        else:
            item.update({"status": "saved", "source_size": source.size, "cached": True})

        if source is not None:
            output = background.copy()
            output.alpha_composite(profile_from_source(source))
            output.convert("RGB").save(portrait_path)
            alias_id = aliases.get(wrestler_id)
            if alias_id and alias_id != wrestler_id:
                alias_path = PORTRAIT_DIR / f"{alias_id}.png"
                output.convert("RGB").save(alias_path)
                item["alias_portrait_path"] = str(alias_path)
            item["portrait_path"] = str(portrait_path)
        report.append(item)
        print(f"{wrestler_id}: {item['status']}")

    report_path = SOURCE_DIR / "approved_replacement_report.json"
    report_path.write_text(json.dumps({"backup_dir": str(backup_dir), "items": report}, indent=2) + "\n")
    saved = [item for item in report if item["status"] == "saved"]
    print(f"Applied {len(saved)}/{len(report)} approved replacements")
    print(f"Backup: {backup_dir}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
