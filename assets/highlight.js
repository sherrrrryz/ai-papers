// Text highlighting on paper pages. Highlights are saved in this browser's
// localStorage, one list per paper, as character offsets into the article text
// plus the highlighted text itself so they can be found again if the page changes.
window.Highlighter = (function () {
  const SKIP_PARENTS = new Set(["TABLE", "THEAD", "TBODY", "TFOOT", "TR", "UL", "OL"]);
  let root, key, items, bar, popup;

  const load = () => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
  const save = () => {
    try { items.length ? localStorage.setItem(key, JSON.stringify(items)) : localStorage.removeItem(key); } catch {}
    updateBar();
  };

  function textNodes() {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode()); ) nodes.push(n);
    return nodes;
  }

  // Global character offset of (node, offset) within root's text.
  function offsetOf(container, offset) {
    const r = document.createRange();
    r.selectNodeContents(root);
    r.setEnd(container, offset);
    return r.toString().length;
  }

  function wrap(h) {
    let pos = 0;
    for (const node of textNodes()) {
      const len = node.data.length, start = pos, end = pos + len;
      pos = end;
      if (end <= h.start || start >= h.end) continue;
      if (!node.data.trim() || SKIP_PARENTS.has(node.parentNode.nodeName)) continue;
      let target = node;
      const a = Math.max(h.start - start, 0), b = Math.min(h.end - start, len);
      if (b < len) target.splitText(b);
      if (a > 0) target = target.splitText(a);
      const mark = Object.assign(document.createElement("mark"), { className: "hl", title: "Click to remove highlight" });
      mark.dataset.hl = h.id;
      target.parentNode.replaceChild(mark, target);
      mark.append(target);
    }
  }

  function unwrap(id) {
    root.querySelectorAll(`mark.hl[data-hl="${id}"]`).forEach((m) => {
      const parent = m.parentNode;
      m.replaceWith(...m.childNodes);
      parent.normalize();
    });
  }

  // Find a saved highlight in the current text: at its offsets, else by its text.
  function locate(h, text) {
    if (text.slice(h.start, h.end) === h.text) return h;
    const i = text.indexOf(h.text);
    return i < 0 ? null : { ...h, start: i, end: i + h.text.length };
  }

  function add(start, end) {
    // Merge with any highlights it overlaps.
    const overlapping = items.filter((h) => h.start < end && h.end > start);
    overlapping.forEach((h) => { unwrap(h.id); start = Math.min(start, h.start); end = Math.max(end, h.end); });
    items = items.filter((h) => !overlapping.includes(h));
    const text = root.textContent.slice(start, end);
    if (!text.trim()) return;
    const h = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), start, end, text };
    items.push(h);
    items.sort((x, y) => x.start - y.start);
    wrap(h);
    save();
  }

  function remove(id) {
    unwrap(id);
    items = items.filter((h) => h.id !== id);
    save();
  }

  function hidePopup() { popup.hidden = true; popup.replaceChildren(); }

  function showPopup(rect, label, onClick) {
    const btn = Object.assign(document.createElement("button"), { type: "button", textContent: label });
    btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep the selection
    btn.addEventListener("click", () => { onClick(); hidePopup(); });
    popup.replaceChildren(btn);
    popup.hidden = false;
    const top = rect.top + window.scrollY - popup.offsetHeight - 8;
    const left = rect.left + window.scrollX + rect.width / 2 - popup.offsetWidth / 2;
    popup.style.top = `${Math.max(top, window.scrollY + 4)}px`;
    popup.style.left = `${Math.max(8, Math.min(left, document.documentElement.clientWidth - popup.offsetWidth - 8))}px`;
  }

  function onSelection() {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    const start = offsetOf(range.startContainer, range.startOffset);
    const end = offsetOf(range.endContainer, range.endOffset);
    if (end <= start || !range.toString().trim()) return;
    showPopup(range.getBoundingClientRect(), "Highlight", () => { add(start, end); sel.removeAllRanges(); });
  }

  function updateBar() {
    bar.hidden = false;
    const count = items.length;
    bar.querySelector(".hl-count").textContent = count
      ? `${count} highlight${count === 1 ? "" : "s"} saved in this browser`
      : "Select text to highlight it. Highlights are saved in this browser.";
    bar.querySelector(".hl-clear").hidden = !count;
    bar.querySelector(".hl-next").hidden = !count;
  }

  let nextIndex = 0;
  function jumpToNext() {
    const ids = items.map((h) => h.id);
    if (!ids.length) return;
    const id = ids[nextIndex++ % ids.length];
    const mark = root.querySelector(`mark.hl[data-hl="${id}"]`);
    if (!mark) return;
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    root.querySelectorAll(`mark.hl[data-hl="${id}"]`).forEach((m) => {
      m.classList.remove("flash"); void m.offsetWidth; m.classList.add("flash");
    });
  }

  function init(article, paperId) {
    root = article;
    key = `highlights:${paperId}`;
    bar = document.getElementById("hl-bar");
    popup = document.getElementById("hl-popup");

    const text = root.textContent;
    items = load().map((h) => locate(h, text)).filter(Boolean);
    items.forEach(wrap);

    bar.querySelector(".hl-next").addEventListener("click", jumpToNext);
    bar.querySelector(".hl-clear").addEventListener("click", () => {
      if (!confirm("Remove all highlights on this page?")) return;
      items.forEach((h) => unwrap(h.id));
      items = [];
      save();
    });
    updateBar();

    document.addEventListener("mouseup", () => setTimeout(onSelection));
    document.addEventListener("keyup", (e) => { if (e.shiftKey) onSelection(); });
    document.addEventListener("selectionchange", () => {
      clearTimeout(init.t);
      init.t = setTimeout(() => { if (!window.getSelection().isCollapsed) onSelection(); }, 400);
    });
    document.addEventListener("mousedown", (e) => { if (!popup.contains(e.target)) hidePopup(); });
    root.addEventListener("click", (e) => {
      const mark = e.target.closest("mark.hl");
      if (!mark || !window.getSelection().isCollapsed) return;
      showPopup(mark.getBoundingClientRect(), "Remove highlight", () => remove(mark.dataset.hl));
    });
    window.addEventListener("resize", hidePopup);
  }

  return { init };
})();
