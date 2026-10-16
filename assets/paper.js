(function () {
  const id = new URLSearchParams(location.search).get("id");
  const article = document.getElementById("analysis");
  const show = (msg) => { article.innerHTML = `<p class="empty">${msg}</p>`; };
  if (!id) return show("No paper selected.");

  fetch("data/papers.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((papers) => {
      const p = papers.find((x) => x.id === id);
      if (!p) return show("This paper is not in the list.");
      document.title = `${p.title} · AI CHI Papers`;
      document.getElementById("title").textContent = p.title;
      const meta = document.getElementById("meta");
      [p.year, p.type, p.sub_type].filter(Boolean).forEach((v) => {
        meta.append(Object.assign(document.createElement("span"), { textContent: v }));
      });
      const link = (href, text) => Object.assign(document.createElement("a"), { href: encodeURI(href), textContent: text, target: "_blank", rel: "noopener" });
      meta.append(link(p.pdf, "PDF"));
      if (p.url) meta.append(link(p.url, "arXiv"));
      document.getElementById("authors").textContent = p.authors || "";

      const ready = () => {
        Highlighter.init(article, id);
        if (window.AskAI) AskAI.init(p, article);
      };
      const about = document.createElement("section");
      if (p.note) about.append(Object.assign(document.createElement("p"), { className: "note", textContent: p.note }));
      if ((p.tags || []).length) {
        const notes = Object.assign(document.createElement("section"), { className: "tag-notes" });
        notes.append(Object.assign(document.createElement("h2"), { textContent: "Tags" }));
        p.tags.forEach((t) => {
          const line = document.createElement("p");
          line.append(Object.assign(document.createElement("strong"), { textContent: `${t.tag} · ${t.subtag}${t.key ? " ★" : ""}: ` }), t.why);
          notes.append(line);
        });
        about.append(notes);
      }
      if (p.abstract) {
        about.append(Object.assign(document.createElement("h2"), { textContent: "Abstract" }));
        about.append(Object.assign(document.createElement("p"), { textContent: p.abstract }));
      }

      if (!p.has_analysis) {
        article.replaceChildren(about);
        article.append(Object.assign(document.createElement("p"), { className: "empty", textContent: "No in-depth analysis yet." }));
        return ready();
      }
      return fetch(`analyses/${encodeURIComponent(id)}.md`, { cache: "no-cache" }).then((r) => {
        if (!r.ok) {
          article.replaceChildren(about);
          return ready();
        }
        return r.text().then((md) => {
          const analysis = document.createElement("section");
          analysis.className = "analysis-body";
          analysis.innerHTML = DOMPurify.sanitize(marked.parse(md));
          article.replaceChildren(analysis, about);
          ready();
        });
      });
    })
    .catch(() => show("Could not load the analysis."));
})();
