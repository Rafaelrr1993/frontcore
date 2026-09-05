// -----------------------------------------------------------------------
// file-sources.js — port de coletar_xmls() de NFe_para_CSV_App.py.
//
// No programa original isso lê caminhos de disco (pasta -> rglob, zip ->
// zipfile, arquivo solto -> ele mesmo). Aqui não existe acesso a disco:
// cada "entrada" já é um File (ou lista de File, no caso de pasta) que o
// próprio navegador entregou via <input type="file">, e um .zip é lido
// com JSZip (carregado via CDN em index.html, window.JSZip).
// -----------------------------------------------------------------------

/** Detecta o encoding declarado no prólogo do XML (<?xml ... encoding="X"?>)
 * e decodifica os bytes com ele — igual o ElementTree faz sozinho ao
 * abrir um arquivo. Sem declaração, assume UTF-8 (padrão da especificação
 * XML e o mais comum em NFe/NFC-e). */
function decodeXmlBytes(buffer) {
  const head = new TextDecoder("iso-8859-1").decode(buffer.slice(0, 200));
  const m = /<\?xml[^>]*encoding=["']([^"']+)["']/i.exec(head);
  let enc = m ? m[1].toLowerCase() : "utf-8";
  if (enc !== "utf-8" && enc !== "iso-8859-1" && enc !== "utf-16") enc = "utf-8";
  try {
    return new TextDecoder(enc).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function isXmlName(name) {
  return /\.xml$/i.test(name);
}

/**
 * @param {{kind: "xml"|"folder"|"zip", payload: File|File[]}[]} entries
 * @param {(msg: string) => void} [statusCb]
 * @returns {Promise<{relPath: string, text: string}[]>}
 */
export async function collectXmls(entries, statusCb) {
  const xmls = [];

  for (const entry of entries) {
    if (entry.kind === "xml") {
      const file = entry.payload;
      const buf = await file.arrayBuffer();
      xmls.push({ relPath: file.webkitRelativePath || file.name, text: decodeXmlBytes(buf) });
    } else if (entry.kind === "folder") {
      const files = [...entry.payload]
        .filter((f) => isXmlName(f.name))
        .sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name));
      for (const file of files) {
        const buf = await file.arrayBuffer();
        xmls.push({ relPath: file.webkitRelativePath || file.name, text: decodeXmlBytes(buf) });
      }
    } else if (entry.kind === "zip") {
      const file = entry.payload;
      if (statusCb) statusCb(`Extraindo ${file.name}...`);
      const buf = await file.arrayBuffer();
      const zip = await window.JSZip.loadAsync(buf);
      const names = Object.keys(zip.files)
        .filter((n) => isXmlName(n) && !zip.files[n].dir)
        .sort();
      for (const name of names) {
        const ab = await zip.files[name].async("arraybuffer");
        xmls.push({ relPath: name, text: decodeXmlBytes(ab) });
      }
    }
  }

  return xmls;
}
