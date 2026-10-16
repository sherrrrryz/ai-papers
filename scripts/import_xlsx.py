#!/usr/bin/env python3
"""Convert a paper spreadsheet (.xlsx) into data/papers.csv.

Usage: python3 scripts/import_xlsx.py path/to/papers.xlsx

Expects the columns Year, Title, Authors, arXiv ID, Published, Abstract,
PDF Link, Abstract URL and CHI Note. Type is inferred from the CHI Note,
sub type (topic) from keywords in the title, then the abstract. Rows already
in data/papers.csv keep their type and sub type, so hand corrections stick.
Needs openpyxl (pip install openpyxl).
"""
import csv
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
CSV_FILE = ROOT / "data" / "papers.csv"
FIELDS = ["id", "year", "title", "authors", "type", "sub_type", "pdf", "url", "published", "note", "abstract"]

TYPE_RULES = [
    ("Workshop Paper", r"workshop"),
    ("Late-Breaking Work", r"\blbw\b|late[- ]breaking"),
    ("Poster", r"poster"),
    ("Demo", r"\bdemo"),
    ("Doctoral Consortium", r"doctoral"),
    ("Case Study", r"case stud"),
    ("Extended Abstract", r"extended abstract"),
    ("Preprint", r"under review|submitted to"),
]

TOPIC_RULES = [
    ("Agents", r"\bagent(s|ic)?\b|multi-agent"),
    ("Explainable AI", r"explainab|\bxai\b|interpretab"),
    ("Trust & Reliance", r"\btrust|relian"),
    ("Accessibility", r"accessib|blind|visually impaired|disabilit|\bdeaf|sign language"),
    ("Children & Youth", r"\bchild|\bteen|adolescen|\bkids?\b|\byouth"),
    ("Health & Wellbeing", r"health|mental|clinic|patient|medical|well-?being|therap"),
    ("Education", r"educat|student|teacher|classroom|tutor|learner"),
    ("Creativity & Writing", r"creativ|writing|writer|story|storytell|\bart(ist)?s?\b|music|ideation"),
    ("Ethics, Safety & Fairness", r"ethic|fairness|\bbias|safety|harm|privacy|misinformation|deceptive"),
    ("Programming & Data", r"\bcode\b|coding|programm|developer|software|data analy|visuali[sz]ation"),
    ("Conversational AI", r"chatbot|conversational|voice assistant|dialog"),
    ("Design & Prototyping", r"\bdesign(er)?s?\b|prototyp|\bui\b|interface"),
    ("Collaboration & Work", r"collaborat|workplace|worker|team|productivity"),
    ("Generative AI & LLMs", r"\bllms?\b|language model|generative|chatgpt|\bgpt|\bgenai\b"),
]


def clean_text(text):
    text = re.sub(r"\$\\unicode\{x([0-9a-fA-F]+)\}\$", lambda m: chr(int(m.group(1), 16)), text)
    return re.sub(r"\s+", " ", text).strip()


def infer_type(note):
    note = (note or "").lower()
    for label, pattern in TYPE_RULES:
        if re.search(pattern, note):
            return label
    return "Full Paper"


def infer_topic(title, abstract):
    for text in (title, abstract):
        text = (text or "").lower()
        for label, pattern in TOPIC_RULES:
            if re.search(pattern, text):
                return label
    return "Other"


def main(path):
    kept = {}
    if CSV_FILE.exists():
        with CSV_FILE.open(encoding="utf-8", newline="") as f:
            kept = {row["id"]: row for row in csv.DictReader(f)}

    ws = openpyxl.load_workbook(path, read_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [str(h).strip() for h in next(rows)]
    out = []
    for values in rows:
        r = {h: ("" if v is None else str(v).strip()) for h, v in zip(header, values)}
        if not r.get("Title"):
            continue
        pid = re.sub(r"v\d+$", "", r["arXiv ID"]) or re.sub(r"[^a-z0-9]+", "-", r["Title"].lower()).strip("-")
        prev = kept.get(pid, {})
        out.append({
            "id": pid,
            "year": r["Year"],
            "title": clean_text(r["Title"]),
            "authors": r["Authors"],
            "type": prev.get("type") or infer_type(r["CHI Note"]),
            "sub_type": prev.get("sub_type") or infer_topic(r["Title"], r["Abstract"]),
            "pdf": r["PDF Link"],
            "url": r["Abstract URL"],
            "published": r["Published"][:10],
            "note": r["CHI Note"],
            "abstract": clean_text(r["Abstract"]),
        })

    CSV_FILE.parent.mkdir(parents=True, exist_ok=True)
    with CSV_FILE.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(out)
    print(f"{len(out)} papers -> {CSV_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
