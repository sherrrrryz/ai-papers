// "Ask AI" panel on paper pages. Talks to an Ollama server running on the
// visitor's own computer (default http://localhost:11434), so it only works
// where Ollama is installed and running. Nothing is sent anywhere else.
window.AskAI = (function () {
  const DEFAULT_URL = "http://localhost:11434";
  const QUICK = [
    ["Summarize", "Summarize this paper in 5 bullet points."],
    ["Key methods", "What methods did the authors use? Be specific about participants, data and analysis."],
    ["Findings", "What are the main findings?"],
    ["Limitations", "What are the main limitations of this paper?"],
  ];
  const RELATE = ["Relate to my experiment", "How does this paper relate to my experiment proposal? Point to what I could use and where it differs."];

  let paper, article, tagInfo = {}, history = [], controller = null, quote = "";
  let panel, log, input, form, sendBtn, statusEl, modelSel, quoteEl, toggleBtn;

  const pref = (k, v) => {
    try { if (v === undefined) return localStorage.getItem(`askai:${k}`); localStorage.setItem(`askai:${k}`, v); } catch {}
    return null;
  };
  const baseUrl = () => (pref("url") || DEFAULT_URL).replace(/\/+$/, "");
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

  function systemPrompt() {
    const lines = [
      "You are a research assistant helping a UX researcher read academic papers.",
      "Answer questions about the paper below. Base answers on the paper text; if something isn't in it, say so and answer from general knowledge, clearly marked.",
      "Be concise. Use short paragraphs or bullet points. Use markdown.",
    ];
    const descs = [...new Set((paper.tags || []).map((t) => t.tag))]
      .map((t) => tagInfo[t] && `- ${t}: ${tagInfo[t]}`).filter(Boolean);
    if (descs.length) lines.push("", "The user's projects this paper is tagged for:", ...descs);
    lines.push("", "=== PAPER PAGE ===", `Title: ${paper.title}`, `Authors: ${paper.authors || "unknown"}`, `Year: ${paper.year || "unknown"}`, "", article.innerText.trim());
    return lines.join("\n");
  }

  async function checkConnection() {
    setStatus("Connecting…", "");
    try {
      const r = await fetch(`${baseUrl()}/api/tags`);
      if (!r.ok) throw new Error(r.status);
      const { models = [] } = await r.json();
      const saved = pref("model");
      modelSel.replaceChildren(...models.map((m) => el("option", { value: m.name, textContent: m.name })));
      if (!models.length) return setStatus("Ollama is running but has no models. Run: ollama pull qwen3:4b", "warn");
      modelSel.value = models.some((m) => m.name === saved) ? saved : models[0].name;
      setStatus("Ollama connected", "ok");
      return true;
    } catch {
      setStatus("Can't reach Ollama. See setup below.", "err");
      showSetupHelp();
      return false;
    }
  }

  function setStatus(text, kind) { statusEl.textContent = text; statusEl.dataset.kind = kind; }

  function showSetupHelp() {
    if (log.querySelector(".ai-help")) return;
    const onSite = !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    const help = el("div", { className: "ai-msg ai-help" });
    help.innerHTML = DOMPurify.sanitize(marked.parse([
      "**The AI needs Ollama running on this computer.**",
      "1. Install and open Ollama from ollama.com, then download a model, for example `ollama pull qwen3:4b`.",
      onSite ? `2. Let this site talk to Ollama (one time), then quit and reopen Ollama:\n\n   \`launchctl setenv OLLAMA_ORIGINS "${location.origin}"\`` : "",
      "Phones and other people's computers can't use your Ollama, so the panel won't work there.",
    ].filter(Boolean).join("\n\n")));
    help.append(el("button", { type: "button", textContent: "Try again", onclick: () => checkConnection().then((ok) => ok && help.remove()) }));
    log.append(help);
  }

  function addMessage(role, text) {
    const msg = el("div", { className: `ai-msg ai-${role}` });
    if (role === "user") msg.textContent = text; else msg.innerHTML = DOMPurify.sanitize(marked.parse(text));
    log.append(msg);
    log.scrollTop = log.scrollHeight;
    return msg;
  }

  async function send(text) {
    text = text.trim();
    if (!text || controller) return;
    open();
    const content = quote ? `About this passage from the page:\n> ${quote.replace(/\n+/g, " ")}\n\n${text}` : text;
    addMessage("user", quote ? `“${quote.length > 160 ? quote.slice(0, 160) + "…" : quote}”\n\n${text}` : text);
    setQuote("");
    input.value = "";
    history.push({ role: "user", content });

    const reply = addMessage("assistant", "");
    reply.classList.add("pending");
    reply.textContent = "Thinking…";
    controller = new AbortController();
    sendBtn.textContent = "Stop";
    let answer = "";
    try {
      const r = await fetch(`${baseUrl()}/api/chat`, {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          model: modelSel.value,
          messages: [{ role: "system", content: systemPrompt() }, ...history],
          think: pref("think") === "1",
          stream: true,
        }),
      });
      if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
      const reader = r.body.getReader(), dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          const chunk = JSON.parse(line);
          if (chunk.error) throw new Error(chunk.error);
          const piece = chunk.message?.content || "";
          if (!piece) continue;
          answer += piece;
          reply.classList.remove("pending");
          reply.innerHTML = DOMPurify.sanitize(marked.parse(answer));
          const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
          if (nearBottom) log.scrollTop = log.scrollHeight;
        }
      }
      if (!answer) reply.textContent = "(No answer.)";
    } catch (e) {
      reply.classList.remove("pending");
      if (e.name === "AbortError") {
        if (!answer) reply.textContent = "(Stopped.)";
      } else {
        reply.classList.add("ai-error");
        reply.textContent = `Something went wrong: ${e.message}`;
        if (e instanceof TypeError) { setStatus("Can't reach Ollama. See setup below.", "err"); showSetupHelp(); }
      }
    } finally {
      if (answer) history.push({ role: "assistant", content: answer });
      else history.pop();
      controller = null;
      sendBtn.textContent = "Send";
    }
  }

  function setQuote(text) {
    quote = text.trim();
    quoteEl.hidden = !quote;
    quoteEl.querySelector("span").textContent = quote.length > 200 ? quote.slice(0, 200) + "…" : quote;
  }

  function open() {
    if (!panel.hidden) return;
    panel.hidden = false;
    document.body.classList.add("ai-open");
    toggleBtn.setAttribute("aria-expanded", "true");
    pref("open", "1");
    if (!modelSel.options.length) checkConnection();
  }
  function close() {
    panel.hidden = true;
    document.body.classList.remove("ai-open");
    toggleBtn.setAttribute("aria-expanded", "false");
    pref("open", "0");
  }

  function build() {
    toggleBtn = el("button", { type: "button", className: "ai-toggle", textContent: "Ask AI", onclick: () => (panel.hidden ? open() : close()) });
    toggleBtn.setAttribute("aria-controls", "ai-panel");

    statusEl = el("span", { className: "ai-status" });
    modelSel = el("select", { title: "Model", onchange: () => pref("model", modelSel.value) });
    const think = el("input", { type: "checkbox", checked: pref("think") === "1", onchange: () => pref("think", think.checked ? "1" : "0") });
    const urlInput = el("input", { type: "url", value: baseUrl(), placeholder: DEFAULT_URL });
    urlInput.addEventListener("change", () => { pref("url", urlInput.value.trim() || DEFAULT_URL); checkConnection(); });

    const settings = el("details", { className: "ai-settings" },
      el("summary", { textContent: "Settings" }),
      el("label", {}, "Model ", modelSel),
      el("label", { className: "ai-check", title: "Slower, but can give better answers on reasoning models" }, think, " Let the model think first"),
      el("label", {}, "Ollama address ", urlInput),
    );

    const quick = el("div", { className: "ai-quick" });
    const quickList = (paper.tags || []).length ? [...QUICK, RELATE] : QUICK;
    quickList.forEach(([label, prompt]) => quick.append(el("button", { type: "button", textContent: label, onclick: () => send(prompt) })));

    log = el("div", { className: "ai-log", ariaLive: "polite" });
    quoteEl = el("div", { className: "ai-quote", hidden: true },
      el("span"),
      el("button", { type: "button", textContent: "×", title: "Remove passage", ariaLabel: "Remove passage", onclick: () => setQuote("") }),
    );
    input = el("textarea", { rows: 2, placeholder: "Ask about this paper…" });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
    });
    sendBtn = el("button", { type: "submit", className: "ai-send", textContent: "Send" });
    form = el("form", { className: "ai-form" }, quoteEl, input, sendBtn);
    form.addEventListener("submit", (e) => { e.preventDefault(); controller ? controller.abort() : send(input.value); });

    const clearBtn = el("button", { type: "button", textContent: "Clear chat", onclick: () => { controller?.abort(); history = []; log.replaceChildren(); } });
    const closeBtn = el("button", { type: "button", className: "ai-close", textContent: "×", title: "Close", ariaLabel: "Close", onclick: close });

    panel = el("aside", { id: "ai-panel", className: "ai-panel", hidden: true },
      el("div", { className: "ai-head" }, el("strong", { textContent: "Ask AI" }), statusEl, closeBtn),
      el("div", { className: "ai-tools" }, settings, clearBtn),
      quick, log, form,
    );
    document.body.append(panel, toggleBtn);
  }

  function init(p, art) {
    paper = p;
    article = art;
    build();
    fetch("data/tags.json").then((r) => r.json()).then((t) => {
      Object.entries(t).forEach(([name, v]) => { tagInfo[name] = v.description; });
    }).catch(() => {});
    if (pref("open") === "1") open();
  }

  // Called from the selection popup on the page.
  function askAbout(text, prompt) {
    setQuote(text);
    open();
    if (prompt) send(prompt); else input.focus();
  }

  return { init, askAbout };
})();
