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
      meta.append(Object.assign(document.createElement("a"), { href: encodeURI(p.file), textContent: "PDF", target: "_blank", rel: "noopener" }));

      return fetch(`analyses/${encodeURIComponent(id)}.md`, { cache: "no-cache" }).then((r) => {
        if (!r.ok) return show("This paper has not been analyzed yet.");
        return r.text().then((md) => { article.innerHTML = DOMPurify.sanitize(marked.parse(md)); });
      });
    })
    .catch(() => show("Could not load the analysis."));
})();
