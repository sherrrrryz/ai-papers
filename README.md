# AI CHI Papers

A static website listing AI-related CHI papers in one filterable, sortable table (title, year, type, sub type, PDF link, summary). Papers marked important get a second-level page with an in-depth analysis.

## Layout

| Path | What it is |
| --- | --- |
| `papers/` | The PDFs. File names follow `<year>_<type>_<sub type>_<title>.pdf` (see `papers/README.md`). |
| `data/papers.json` | The table's data, generated from the PDFs. Hand edits (summary, type, …) are kept on rebuild. |
| `analyses/<id>.md` | Analysis for one paper, shown at `paper.html?id=<id>`. |
| `scripts/build_index.py` | Syncs `data/papers.json` with `papers/`. Standard library only. |
| `index.html`, `paper.html`, `assets/` | The site. |

## Adding papers

1. Add PDFs to `papers/` and push (or upload them on GitHub).
2. The GitHub Actions workflow runs `scripts/build_index.py`, commits the updated `data/papers.json`, and deploys the site to GitHub Pages.

To run locally:

```sh
python3 scripts/build_index.py
python3 -m http.server 8000   # then open http://localhost:8000
```

## Publishing

In the repository's Settings → Pages, set Source to "GitHub Actions". The site then deploys on every push to `main`.
