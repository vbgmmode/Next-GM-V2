#!/usr/bin/env python3
import csv
import html
import json
import re
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parents[1]
SOURCE_REPORT = Path("/Users/vbahmad/.gemini/antigravity/scratch/superstar_renders.md")
OUT_DIR = ROOT / "public/source-portraits/deviantart/approval-links"
MAX_CANDIDATES = 3


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
                    "flags": flags_for(name, title),
                }
            )
        rows.append({"name": name, "id": slug, "links": links[:MAX_CANDIDATES]})
    return rows


def flags_for(name: str, title: str) -> List[str]:
    text = f"{title} {name}".lower()
    flags = []
    if any(word in text for word in ["champion", "championship", "title", "belt"]):
        flags.append("belt/champion")
    if any(word in text for word in ["tag team", "trios", "team champion"]):
        flags.append("team/tag")
    if any(word in text for word in ["toy", "card", "merch", "shirt"]):
        flags.append("merch/card")
    if name == "PAC" and "x-pac" in title.lower():
        flags.append("wrong wrestler risk")
    if name == "Angel" and "angel garza" not in title.lower():
        flags.append("wrong wrestler risk")
    if name in {"Tate Wilder", "Tristan Angels", "Matt Cardona", "EK Prosper"}:
        flags.append("manual review")
    return flags


def candidate_rows(rows: List[Dict]) -> List[Dict]:
    candidates = []
    for row in rows:
        for link in row["links"]:
            candidates.append(
                {
                    "approve": "",
                    "name": row["name"],
                    "id": row["id"],
                    "rank": link["rank"],
                    "title": link["title"],
                    "author": link["author"],
                    "score": link["score"],
                    "flags": "; ".join(link["flags"]),
                    "url": link["url"],
                    "notes": "",
                }
            )
    return candidates


def write_csv(candidates: List[Dict]) -> None:
    with (OUT_DIR / "approval.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["approve", "name", "id", "rank", "title", "author", "score", "flags", "url", "notes"],
        )
        writer.writeheader()
        writer.writerows(candidates)


def write_manifest(rows: List[Dict], candidates: List[Dict]) -> None:
    manifest = {
        "source_report": str(SOURCE_REPORT),
        "wrestler_count": len(rows),
        "candidate_count": len(candidates),
        "instructions": "Mark one candidate per wrestler in approval.csv, or paste approved DeviantArt URLs back to Codex.",
        "rows": rows,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


def write_markdown(rows: List[Dict], candidates: List[Dict]) -> None:
    lines = [
        "# DeviantArt Approval Links",
        "",
        "This folder is a manual approval workspace only. It does not modify `public/superstars`.",
        "",
        f"- Wrestlers: {len(rows)}",
        f"- Candidates: {len(candidates)}",
        "- Preference: pick renders without belts when possible.",
        "- Approval workflow: mark `approve` in `approval.csv`, or send selected links back to Codex.",
        "",
    ]
    for row in rows:
        lines.append(f"## {row['name']}")
        lines.append("")
        lines.append(f"- ID: `{row['id']}`")
        for link in row["links"]:
            flags = f" | flags: {', '.join(link['flags'])}" if link["flags"] else ""
            lines.append(
                f"- [ ] Candidate {link['rank']}: [{link['title']}]({link['url']}) "
                f"by `{link['author']}` | score: `{link['score']}`{flags}"
            )
        lines.append("")
    (OUT_DIR / "index.md").write_text("\n".join(lines))


def write_html(rows: List[Dict], candidates: List[Dict]) -> None:
    cards = []
    for row in rows:
        links = []
        for link in row["links"]:
            flag_text = ", ".join(link["flags"])
            flag_html = f'<span class="flags">{html.escape(flag_text)}</span>' if flag_text else ""
            links.append(
                "<li>"
                f'<a href="{html.escape(link["url"])}" target="_blank" rel="noreferrer">{html.escape(link["title"])}</a>'
                f'<span class="meta">#{link["rank"]} by {html.escape(link["author"])} · score {link["score"]}</span>'
                f"{flag_html}"
                "</li>"
            )
        cards.append(
            '<section class="card">'
            f"<h2>{html.escape(row['name'])}</h2>"
            f"<p>{html.escape(row['id'])}</p>"
            f"<ol>{''.join(links)}</ol>"
            "</section>"
        )
    document = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DeviantArt Approval Links</title>
  <style>
    body {{ margin: 0; background: #10130f; color: #f4f0df; font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    header {{ position: sticky; top: 0; z-index: 1; padding: 18px 24px; background: #060806; border-bottom: 1px solid #3c341a; }}
    h1 {{ margin: 0 0 6px; font-size: 22px; }}
    header p {{ margin: 0; color: #c8c1a7; }}
    main {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; padding: 16px; }}
    .card {{ border: 1px solid #342f1d; background: #171b15; padding: 14px; border-radius: 6px; }}
    h2 {{ margin: 0; font-size: 17px; }}
    .card p {{ margin: 2px 0 12px; color: #9ca387; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }}
    ol {{ margin: 0; padding-left: 20px; }}
    li {{ margin: 0 0 10px; }}
    a {{ color: #e6c45d; text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    .meta, .flags {{ display: block; color: #aeb49e; font-size: 12px; }}
    .flags {{ color: #ffb56b; }}
  </style>
</head>
<body>
  <header>
    <h1>DeviantArt Approval Links</h1>
    <p>{len(rows)} wrestlers · {len(candidates)} candidates · mark approval.csv or send selected links back.</p>
  </header>
  <main>
    {''.join(cards)}
  </main>
</body>
</html>
"""
    (OUT_DIR / "index.html").write_text(document)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = parse_report()
    candidates = candidate_rows(rows)
    write_csv(candidates)
    write_manifest(rows, candidates)
    write_markdown(rows, candidates)
    write_html(rows, candidates)
    print(f"Wrote {len(rows)} wrestlers and {len(candidates)} candidates to {OUT_DIR}")


if __name__ == "__main__":
    main()
