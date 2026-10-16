# AI CHI Papers

A static website listing AI-related CHI papers in one filterable, sortable table (title, year, type, sub type, PDF link). Papers marked important get a second-level page with an in-depth analysis.

## Layout

| Path | What it is |
| --- | --- |
| `data/papers.csv` | The paper list imported from the spreadsheet. Edit it to fix a type or sub type. |
| `papers/` | Optional extra PDFs. File names follow `<year>_<type>_<sub type>_<title>.pdf` (see `papers/README.md`). |
| `data/tags.json` | Tags grouping papers (for example "Experiment proposal" with sub tags per research question), each with a note on why the paper belongs. Shown as chips in the table, as a Tag filter, and on each paper's page. |
| `data/papers.json` | The table's data, generated from the CSV and the PDFs. Don't edit by hand. |
| `analyses/<id>.md` | Analysis for one paper, shown at `paper.html?id=<id>`. On that page you can select text and click Highlight; click a highlight to remove it. Highlights are kept in your browser's local storage, so they stay on that browser only. |
| `assets/ask-ai.js` | The "Ask AI" panel on paper pages: chat about the paper, quick prompts, and Explain / Ask AI on selected text. It talks to [Ollama](https://ollama.com) running on your own computer (`http://localhost:11434`), so it works only on a computer with Ollama running. To use it from the live site, allow the site once with `launchctl setenv OLLAMA_ORIGINS "https://<user>.github.io"` and restart Ollama. |
| `scripts/import_xlsx.py` | Imports a spreadsheet into `data/papers.csv`. Needs `openpyxl`. |
| `scripts/fetch_citations.py` | Fetches citation counts from Semantic Scholar into `data/citations.json`. Runs in GitHub Actions on every deploy and every Monday. |
| `scripts/build_index.py` | Builds `data/papers.json`. Standard library only. |
| `index.html`, `paper.html`, `assets/` | The site. |

## Adding papers

- **From a spreadsheet:** `python3 scripts/import_xlsx.py papers.xlsx`. Type is inferred from the CHI note (workshop, LBW, poster, …) and sub type from topic keywords in the title and abstract. Rows already in the CSV keep their type and sub type.
- **Single PDFs:** add them to `papers/`.

Then push. The GitHub Actions workflow runs `scripts/build_index.py`, commits the updated `data/papers.json`, and deploys the site to GitHub Pages.

To run locally:

```sh
python3 scripts/build_index.py
python3 -m http.server 8000   # then open http://localhost:8000
```

## Publishing

In the repository's Settings → Pages, set Source to "GitHub Actions". The site then deploys on every push to `main`.
