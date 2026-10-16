#!/usr/bin/env python3
"""Fetch citation counts from Semantic Scholar into data/citations.json.

Looks up every paper in data/papers.csv by its arXiv id, in batches of 500.
Runs in GitHub Actions (the API needs open internet). If the API fails, the
existing data/citations.json is left as it was. Standard library only.
"""
import csv
import json
import time
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_FILE = ROOT / "data" / "papers.csv"
OUT_FILE = ROOT / "data" / "citations.json"
API = "https://api.semanticscholar.org/graph/v1/paper/batch?fields=citationCount"
BATCH = 500


def fetch(ids):
    body = json.dumps({"ids": [f"ARXIV:{i}" for i in ids]}).encode()
    for attempt in range(5):
        req = urllib.request.Request(API, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.load(resp)
        except Exception as err:  # rate limits (429) and transient errors
            print(f"attempt {attempt + 1} failed: {err}")
            time.sleep(2 ** attempt * 5)
    raise RuntimeError("Semantic Scholar did not respond")


def main():
    with CSV_FILE.open(encoding="utf-8", newline="") as f:
        ids = [row["id"] for row in csv.DictReader(f)]

    counts = {}
    for start in range(0, len(ids), BATCH):
        chunk = ids[start:start + BATCH]
        for pid, result in zip(chunk, fetch(chunk)):
            if result and result.get("citationCount") is not None:
                counts[pid] = result["citationCount"]
        time.sleep(1)

    OUT_FILE.write_text(json.dumps({"updated": date.today().isoformat(), "counts": counts}, indent=1) + "\n", encoding="utf-8")
    print(f"citation counts for {len(counts)} of {len(ids)} papers -> {OUT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
