// -----------------------------------------------------------------------
// help-widget.js — balão flutuante "Central de Ajuda": busca nos manuais
// (manuals-data.js) enquanto o usuário digita, sem IA e sem servidor.
// Auto-monta no <body> assim que este módulo é importado — basta incluir
// <link rel="stylesheet" href=".../help-widget.css"> e
// <script type="module" src=".../help-widget.js"></script> em qualquer
// página do FrontCore.
// -----------------------------------------------------------------------
import { MANUALS } from "./manuals-data.js";
import { searchManuals } from "./help-search.js";

const ICON_CHAT =
  '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M4 4h16v12H8l-4 4V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
  '<circle cx="8.5" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="15.5" cy="10" r="1" fill="currentColor"/>' +
  "</svg>";

function el(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

function mount() {
  if (document.getElementById("hw-button")) return; // já montado

  const button = el("button", {
    id: "hw-button",
    className: "hw-button",
    type: "button",
    title: "Central de Ajuda — buscar nos manuais",
    innerHTML: ICON_CHAT,
  });

  const input = el("input", {
    className: "hw-input",
    type: "text",
    placeholder: "Digite sua dúvida...",
    autocomplete: "off",
  });

  const results = el("div", { className: "hw-results" });
  const detail = el("div", { className: "hw-detail", hidden: true });

  const panel = el(
    "div",
    { className: "hw-panel", id: "hw-panel", hidden: true, role: "dialog", ariaLabel: "Central de Ajuda" },
    el(
      "div",
      { className: "hw-header" },
      el("strong", {}, "Central de Ajuda"),
      el("button", { className: "hw-close", type: "button", title: "Fechar", innerHTML: "✕" })
    ),
    el("div", { className: "hw-search-row" }, input),
    results,
    detail
  );

  document.body.append(button, panel);

  const closeBtn = panel.querySelector(".hw-close");

  function openPanel() {
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    input.focus();
  }
  function closePanel() {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  button.addEventListener("click", () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });
  closeBtn.addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) closePanel();
  });

  function showResultsView() {
    detail.hidden = true;
    results.hidden = false;
  }

  function renderResults(query) {
    results.innerHTML = "";
    const q = query.trim();
    if (!q) {
      results.append(el("div", { className: "hw-hint" }, "Digite uma palavra-chave (ex.: “balança”, “VPN”, “cupom”) pra buscar nos manuais."));
      return;
    }
    const matches = searchManuals(q, MANUALS);
    if (!matches.length) {
      results.append(el("div", { className: "hw-hint" }, "Nada encontrado nos manuais pra essa busca."));
      return;
    }
    for (const m of matches) {
      const card = el(
        "button",
        { className: "hw-result", type: "button" },
        el("div", { className: "hw-manual" }, m.manualTitulo),
        el("div", { className: "hw-secao" }, m.secaoTitulo),
        el("div", { className: "hw-snippet", innerHTML: m.snippetHtml })
      );
      card.addEventListener("click", () => showDetail(m));
      results.append(card);
    }
  }

  function showDetail(m) {
    results.hidden = true;
    detail.hidden = false;
    detail.innerHTML = "";
    const back = el("button", { className: "hw-back", type: "button" }, "← Voltar aos resultados");
    back.addEventListener("click", () => {
      detail.hidden = true;
      results.hidden = false;
    });
    detail.append(
      back,
      el("div", { className: "hw-manual" }, m.manualTitulo),
      el("h4", {}, m.secaoTitulo),
      el("p", {}, m.texto)
    );
  }

  input.addEventListener("input", () => {
    showResultsView();
    renderResults(input.value);
  });

  renderResults("");
}

mount();
