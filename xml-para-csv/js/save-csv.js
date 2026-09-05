// -----------------------------------------------------------------------
// save-csv.js — grava o texto do CSV (já com BOM UTF-8, ver csv-builder.js)
// como arquivo, usando a caixa nativa "Salvar como" quando o navegador
// suporta (File System Access API), com fallback pra download comum.
// -----------------------------------------------------------------------
export async function saveCsv(text, suggestedName) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });

  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: "Planilha CSV", accept: { "text/csv": [".csv"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { saved: true, cancelled: false };
    } catch (e) {
      if (e && e.name === "AbortError") return { saved: false, cancelled: true };
      throw e;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { saved: true, cancelled: false };
}
