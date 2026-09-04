// -----------------------------------------------------------------------
// xml-lite.js — leitor de XML mínimo, sem dependências, usado no lugar do
// xml.etree.ElementTree do Python. Só precisa do que o cupom_generator usa:
// navegar filho-a-filho por nome de tag (ignorando namespace, exatamente
// como _strip_ns/_local_find no lado Python) e ler o texto de elementos
// "folha" (sem filhos). Não é um parser XML completo (não lida com DTD,
// processing instructions incomuns, etc.) — mas cobre com folga o XML da
// NFC-e, que é sempre bem formado e sem essas complicações.
// -----------------------------------------------------------------------

function stripNs(tag) {
  const idx = tag.indexOf(":");
  return idx >= 0 ? tag.slice(idx + 1) : tag;
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Analisa um texto XML e devolve o elemento raiz como
 * { tag, attrs, text, children }. Lança Error em XML malformado. */
export function parseXML(xmlText) {
  const s = xmlText;
  let i = 0;

  function isWs(ch) {
    return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
  }
  function skipWs() {
    while (i < s.length && isWs(s[i])) i++;
  }
  function skipMisc() {
    while (true) {
      skipWs();
      if (s.startsWith("<?", i)) {
        const end = s.indexOf("?>", i);
        if (end < 0) throw new Error("Declaração <? ... ?> não fechada no XML.");
        i = end + 2;
        continue;
      }
      if (s.startsWith("<!--", i)) {
        const end = s.indexOf("-->", i);
        if (end < 0) throw new Error("Comentário <!-- ... --> não fechado no XML.");
        i = end + 3;
        continue;
      }
      if (s.startsWith("<!", i)) {
        const end = s.indexOf(">", i);
        if (end < 0) throw new Error("Declaração <! ... > não fechada no XML.");
        i = end + 1;
        continue;
      }
      break;
    }
  }
  function parseName() {
    const start = i;
    while (i < s.length && !isWs(s[i]) && s[i] !== ">" && s[i] !== "/" && s[i] !== "=") i++;
    return s.slice(start, i);
  }
  function parseAttrs() {
    const attrs = {};
    while (true) {
      skipWs();
      if (i >= s.length) throw new Error("XML termina no meio de uma tag.");
      if (s[i] === "/" || s[i] === ">") break;
      const name = parseName();
      skipWs();
      if (s[i] === "=") {
        i++;
        skipWs();
        const quote = s[i];
        if (quote !== '"' && quote !== "'") throw new Error(`Valor de atributo '${name}' sem aspas.`);
        i++;
        const start = i;
        while (i < s.length && s[i] !== quote) i++;
        if (i >= s.length) throw new Error(`Atributo '${name}' com aspas não fechadas.`);
        attrs[name] = decodeEntities(s.slice(start, i));
        i++; // fecha aspas
      } else {
        attrs[name] = "";
      }
    }
    return attrs;
  }
  function parseElement() {
    if (s[i] !== "<") throw new Error("Esperava '<' ao abrir elemento.");
    i++;
    const rawName = parseName();
    if (!rawName) throw new Error("Tag sem nome no XML.");
    const tag = stripNs(rawName);
    const attrs = parseAttrs();
    skipWs();
    if (s[i] === "/") {
      i += 2; // '/>'
      return { tag, attrs, text: "", children: [] };
    }
    if (s[i] !== ">") throw new Error(`Tag '<${rawName}>' malformada.`);
    i++;
    const children = [];
    const textParts = [];
    while (true) {
      if (i >= s.length) throw new Error(`Tag '<${rawName}>' nunca foi fechada.`);
      if (s.startsWith("<!--", i)) {
        const end = s.indexOf("-->", i);
        if (end < 0) throw new Error("Comentário não fechado no XML.");
        i = end + 3;
        continue;
      }
      if (s.startsWith("<![CDATA[", i)) {
        const end = s.indexOf("]]>", i);
        if (end < 0) throw new Error("Bloco CDATA não fechado no XML.");
        textParts.push(s.slice(i + 9, end));
        i = end + 3;
        continue;
      }
      if (s[i] === "<") {
        if (s[i + 1] === "/") {
          i += 2;
          parseName(); // nome de fechamento — não precisa validar contra o de abertura
          skipWs();
          if (s[i] !== ">") throw new Error(`Tag de fechamento de '<${rawName}>' malformada.`);
          i++;
          break;
        }
        children.push(parseElement());
        continue;
      }
      const start = i;
      while (i < s.length && s[i] !== "<") i++;
      textParts.push(s.slice(start, i));
    }
    return { tag, attrs, text: decodeEntities(textParts.join("")), children };
  }

  skipMisc();
  if (i >= s.length || s[i] !== "<") {
    throw new Error("Não encontrei nenhum elemento XML no texto colado.");
  }
  return parseElement();
}

/** Equivalente a _local_findall: navega filho-a-filho por um caminho tipo
 * "a/b/c", ignorando namespace, devolvendo TODOS os elementos que baterem
 * em cada nível (igual ao ElementTree usado no lado Python). */
export function localFindAll(elem, path) {
  const parts = path.split("/");
  let current = [elem];
  for (const part of parts) {
    const next = [];
    for (const c of current) {
      for (const child of c.children) {
        if (child.tag === part) next.push(child);
      }
    }
    current = next;
  }
  return current;
}

export function localFind(elem, path) {
  const r = localFindAll(elem, path);
  return r.length ? r[0] : null;
}

export function xtext(elem, path, dflt = "") {
  const e = localFind(elem, path);
  if (e && e.text && e.text.trim()) return e.text.trim();
  return dflt;
}
