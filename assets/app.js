(function () {
  const state = { papers: [], sortKey: "year", sortDir: -1 };
  const $ = (id) => document.getElementById(id);
  const els = {
    search: $("search"), year: $("filter-year"), type: $("filter-type"),
    subtype: $("filter-subtype"), important: $("filter-important"),
    body: document.querySelector("#papers tbody"), empty: $("empty"), count: $("count"),
  };

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fillSelect(select, values) {
    [...new Set(values.filter((v) => v !== "" && v != null))]
      .sort((a, b) => (typeof a === "number" ? b - a : String(a).localeCompare(String(b))))
      .forEach((v) => select.add(new Option(v, v)));
  }

  function compare(a, b) {
    const k = state.sortKey;
    const x = a[k], y = b[k];
    const empty = (v) => v === "" || v == null;
    if (empty(x) && empty(y)) return 0;
    if (empty(x)) return 1;
    if (empty(y)) return -1;
    const r = typeof x === "number" ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: "base" });
    return r * state.sortDir;
  }

  function render() {
    const q = els.search.value.trim().toLowerCase();
    const rows = state.papers.filter((p) =>
      (!q || `${p.title} ${p.authors || ""}`.toLowerCase().includes(q)) &&
      (!els.year.value || String(p.year) === els.year.value) &&
      (!els.type.value || p.type === els.type.value) &&
      (!els.subtype.value || p.sub_type === els.subtype.value) &&
      (!els.important.checked || p.has_analysis)
    ).sort(compare);

    els.body.innerHTML = rows.map((p) => {
      const badge = p.has_analysis ? ` <span class="badge">Analysis</span>` : "";
      const authors = p.authors ? `<div class="authors">${escapeHtml(p.authors)}</div>` : "";
      const title = `<a href="paper.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.title)}</a>${badge}${authors}`;
      return `<tr>
        <td class="title">${title}</td>
        <td>${escapeHtml(p.year ?? "")}</td>
        <td>${escapeHtml(p.type)}</td>
        <td>${escapeHtml(p.sub_type)}</td>
        <td class="num">${p.citations == null ? "—" : p.citations}</td>
        <td><a href="${encodeURI(p.pdf)}" target="_blank" rel="noopener">PDF</a></td>
      </tr>`;
    }).join("");

    els.count.textContent = `Showing ${rows.length} of ${state.papers.length}.`;
    els.empty.hidden = rows.length > 0;
    els.empty.textContent = state.papers.length ? "No papers match these filters." : "No papers yet.";

    document.querySelectorAll("th.sortable").forEach((th) => {
      const active = th.dataset.key === state.sortKey;
      th.setAttribute("aria-sort", active ? (state.sortDir > 0 ? "ascending" : "descending") : "none");
    });
  }

  document.querySelectorAll("th.sortable").forEach((th) => {
    th.tabIndex = 0;
    const sort = () => {
      if (state.sortKey === th.dataset.key) state.sortDir *= -1;
      else { state.sortKey = th.dataset.key; state.sortDir = ["year", "citations"].includes(th.dataset.key) ? -1 : 1; }
      render();
    };
    th.addEventListener("click", sort);
    th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sort(); } });
  });

  [els.search, els.year, els.type, els.subtype, els.important].forEach((el) => el.addEventListener("input", render));
  $("reset").addEventListener("click", () => {
    els.search.value = els.year.value = els.type.value = els.subtype.value = "";
    els.important.checked = false;
    render();
  });

  fetch("data/papers.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((papers) => {
      state.papers = papers;
      fillSelect(els.year, papers.map((p) => p.year));
      fillSelect(els.type, papers.map((p) => p.type));
      fillSelect(els.subtype, papers.map((p) => p.sub_type));
      render();
    })
    .catch(() => { els.empty.hidden = false; els.empty.textContent = "Could not load data/papers.json."; });
})();
