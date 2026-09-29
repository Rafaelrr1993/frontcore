// -----------------------------------------------------------------------
// xlsx-lite.js — leitor mínimo de planilhas .xlsx (só a primeira aba).
// Um .xlsx é só um .zip com XMLs dentro (Office Open XML); aqui a gente
// usa o JSZip (já carregado via CDN em index.html, window.JSZip) pra abrir
// o zip e um parser manual (regex, sem DOMParser) pra ler o
// sharedStrings.xml + a planilha — mais rápido que montar uma árvore DOM
// inteira pra arquivos com dezenas de milhares de linhas.
// -----------------------------------------------------------------------

function unescapeXml(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml) {
  const strings = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = siRe.exec(xml))) {
    let text = "";
    let tm;
    tRe.lastIndex = 0;
    while ((tm = tRe.exec(m[1]))) text += tm[1];
    strings.push(unescapeXml(text));
  }
  return strings;
}

function colLetrasParaIndice(letras) {
  let n = 0;
  for (let i = 0; i < letras.length; i++) n = n * 26 + (letras.charCodeAt(i) - 64);
  return n - 1; // 0-indexado
}

function parseSheet(xml, sharedStrings) {
  const rows = [];
  // <c r="A1" s="1" t="s"><v>0</v></c>  ou  <c r="B1" s="1"/>
  const cellRe = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = cellRe.exec(xml))) {
    const [, colLetras, rowNumStr, attrs, content] = m;
    if (!content) continue; // célula vazia (só estilo, sem valor)

    const typeMatch = /\st="([a-zA-Z]+)"/.exec(attrs);
    const type = typeMatch ? typeMatch[1] : "n";

    let value = null;
    if (type === "s") {
      const vm = /<v>([\s\S]*?)<\/v>/.exec(content);
      value = vm ? sharedStrings[parseInt(vm[1], 10)] ?? null : null;
    } else if (type === "inlineStr") {
      let text = "";
      const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
      let tm;
      while ((tm = tRe.exec(content))) text += tm[1];
      value = unescapeXml(text);
    } else {
      const vm = /<v>([\s\S]*?)<\/v>/.exec(content);
      if (vm) value = type === "n" ? parseFloat(vm[1]) : unescapeXml(vm[1]);
    }

    const rowNum = parseInt(rowNumStr, 10);
    const colIdx = colLetrasParaIndice(colLetras);
    if (!rows[rowNum - 1]) rows[rowNum - 1] = [];
    rows[rowNum - 1][colIdx] = value;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

/** Lê um File .xlsx e devolve as linhas da primeira aba, como array de
 * arrays (0-indexado por linha e por coluna; célula vazia = undefined). */
export async function readXlsxRows(file) {
  const buf = await file.arrayBuffer();
  const zip = await window.JSZip.loadAsync(buf);

  const sheetNames = Object.keys(zip.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort();
  if (sheetNames.length === 0) {
    throw new Error("Não encontrei nenhuma planilha dentro desse arquivo .xlsx.");
  }

  let sharedStrings = [];
  if (zip.files["xl/sharedStrings.xml"]) {
    const sharedXml = await zip.files["xl/sharedStrings.xml"].async("string");
    sharedStrings = parseSharedStrings(sharedXml);
  }

  const sheetXml = await zip.files[sheetNames[0]].async("string");
  return parseSheet(sheetXml, sharedStrings);
}
