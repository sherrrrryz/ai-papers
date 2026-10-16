#!/usr/bin/env python3
"""Build data/papers.json from data/papers.csv and the PDFs in papers/.

data/papers.csv holds the papers imported from the spreadsheet (see
scripts/import_xlsx.py); edit it to correct a type or sub type.
PDFs dropped into papers/ are added too: new ones get an entry parsed from
their file name, and existing entries keep fields edited by hand in
data/papers.json. Only the standard library is used.

File name convention (see papers/README.md):
    <year>_<type>_<sub type>_<title>.pdf
Anything that does not match still gets an entry, with the year found
anywhere in the name and the rest used as the title.
"""
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAPERS_DIR = ROOT / "papers"
DATA_FILE = ROOT / "data" / "papers.json"
CSV_FILE = ROOT / "data" / "papers.csv"
ANALYSES_DIR = ROOT / "analyses"

YEAR_RE = re.compile(r"(?<!\d)(19|20)\d{2}(?!\d)")


def slugify(text):
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "paper"


def clean(text):
    text = re.sub(r"\s+", " ", text).strip()
    return re.sub(r"^[\s\-–—:,]+|[\s\-–—:,]+$", "", text)


def parse_name(stem):
    """Return year, type, sub_type and title parsed from a file name stem."""
    parts = [p.strip() for p in stem.split("_") if p.strip()]
    if len(parts) >= 4 and YEAR_RE.fullmatch(parts[0]):
        return {
            "year": int(parts[0]),
            "type": clean(parts[1]),
            "sub_type": clean(parts[2]),
            "title": clean(" ".join(parts[3:])),
        }
    if len(parts) == 3 and YEAR_RE.fullmatch(parts[0]):
        return {"year": int(parts[0]), "type": clean(parts[1]), "sub_type": "", "title": clean(parts[2])}

    match = YEAR_RE.search(stem)
    year = int(match.group(0)) if match else None
    rest = stem if not match else (stem[: match.start()] + " " + stem[match.end():])
    rest = re.sub(r"\bCHI\b", " ", rest.replace("_", " "), flags=re.IGNORECASE)
    title = clean(re.sub(r"\s[\-–—]\s", " ", " " + rest + " ")) or stem
    return {"year": year, "type": "", "sub_type": "", "title": title}


def main():
    existing = []
    if DATA_FILE.exists():
        existing = json.loads(DATA_FILE.read_text(encoding="utf-8") or "[]")
    by_file = {p["file"]: p for p in existing if p.get("file")}

    papers, used_ids = [], set()
    if CSV_FILE.exists():
        with CSV_FILE.open(encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                row["year"] = int(row["year"]) if row.get("year", "").isdigit() else None
                papers.append(row)
                used_ids.add(row["id"])
    from_csv = len(papers)

    pdfs = sorted(p for p in PAPERS_DIR.rglob("*") if p.suffix.lower() == ".pdf")
    added = 0
    for pdf in pdfs:
        rel = pdf.relative_to(ROOT).as_posix()
        entry = by_file.get(rel)
        if entry is None:
            added += 1
            parsed = parse_name(pdf.stem)
            entry = {
                "id": slugify(pdf.stem),
                "file": rel,
                "pdf": rel,
                **parsed,
            }
        entry.setdefault("pdf", rel)
        base, n = entry["id"], 2
        while entry["id"] in used_ids:
            entry["id"] = f"{base}-{n}"
            n += 1
        used_ids.add(entry["id"])
        papers.append(entry)

    for entry in papers:
        entry["has_analysis"] = (ANALYSES_DIR / f"{entry['id']}.md").exists()

    removed = len(by_file) - (len(papers) - from_csv - added)
    papers.sort(key=lambda p: (-(p.get("year") or 0), p["title"].lower()))
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(papers, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(papers)} papers ({from_csv} from CSV, {added} new PDFs, {removed} PDFs removed) -> {DATA_FILE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
