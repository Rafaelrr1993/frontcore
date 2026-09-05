// -----------------------------------------------------------------------
// help-search.js — busca simples (sem IA, sem servidor) sobre as seções
// dos manuais em manuals-data.js: pontua cada seção pela sobreposição de
// palavras com a pergunta digitada e devolve um trecho (snippet) com o
// termo em destaque.
// -----------------------------------------------------------------------

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove acentos, pra "duvida" achar "dúvida" (faixa Unicode dos acentos combinantes)
}

function tokenize(query) {
  return normalize(query)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2);
}

/** Pontua uma seção pra uma busca. 0 = não bate com nada. */
function scoreSection(queryNorm, queryWords, section) {
  const titleN = normalize(section.titulo);
  const textN = normalize(section.texto);

  let score = 0;
  if (queryNorm) {
    if (titleN.includes(queryNorm)) score += 60;
    if (textN.includes(queryNorm)) score += 35;
  }
  for (const w of queryWords) {
    if (titleN.includes(w)) score += 10;
    const occurrences = textN.split(w).length - 1;
    if (occurrences > 0) score += Math.min(occurrences, 4) * 4;
  }
  return score;
}

/** Acha a melhor posição pra centralizar o trecho mostrado: a primeira
 * ocorrência da busca inteira, ou senão da primeira palavra que bater. */
function findSnippetAnchor(queryNorm, queryWords, textN) {
  if (queryNorm) {
    const idx = textN.indexOf(queryNorm);
    if (idx !== -1) return idx;
  }
  for (const w of queryWords) {
    const idx = textN.indexOf(w);
    if (idx !== -1) return idx;
  }
  return 0;
}

function buildSnippet(query, text, anchorIdx, radius = 110) {
  const start = Math.max(0, anchorIdx - radius);
  const end = Math.min(text.length, anchorIdx + radius);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";
  return snippet;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Envolve as palavras da busca em <mark> dentro do snippet (já escapado
 * pra HTML), case/acento-insensível o bastante pro caso comum. */
function highlight(snippetHtml, queryWords) {
  if (!queryWords.length) return snippetHtml;
  const pattern = queryWords.map(escapeRegExp).join("|");
  const re = new RegExp(`(${pattern})`, "gi");
  return snippetHtml.replace(re, "<mark>$1</mark>");
}

/**
 * @param {string} query
 * @param {{id:string, titulo:string, secoes:{titulo:string, texto:string}[]}[]} manuals
 * @param {number} [limit]
 * @returns {{manualId:string, manualTitulo:string, secaoTitulo:string, snippetHtml:string, score:number}[]}
 */
export function searchManuals(query, manuals, limit = 8) {
  const queryNorm = normalize(query).trim();
  const queryWords = tokenize(query);
  if (!queryNorm && !queryWords.length) return [];

  const results = [];
  for (const manual of manuals) {
    for (const secao of manual.secoes) {
      const score = scoreSection(queryNorm, queryWords, secao);
      if (score <= 0) continue;
      const textN = normalize(secao.texto);
      const anchor = findSnippetAnchor(queryNorm, queryWords, textN);
      const snippet = buildSnippet(query, secao.texto, anchor);
      const snippetHtml = highlight(escapeHtml(snippet), queryWords);
      results.push({
        manualId: manual.id,
        manualTitulo: manual.titulo,
        secaoTitulo: secao.titulo,
        texto: secao.texto,
        snippetHtml,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
