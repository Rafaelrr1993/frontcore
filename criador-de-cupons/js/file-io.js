// -----------------------------------------------------------------------
// file-io.js — leitura/gravação de arquivos em Latin-1 (ISO-8859-1), o
// mesmo encoding que o .exe (Python, encoding="latin-1") usa pra ler o
// cupom-modelo e gravar o cupom final. Tudo roda no navegador: nenhum
// arquivo passa por um servidor.
// -----------------------------------------------------------------------

/** Lê um File (input type=file) como texto Latin-1. */
export async function readFileAsLatin1(file) {
  const buffer = await file.arrayBuffer();
  return new TextDecoder("iso-8859-1").decode(buffer);
}

/** Converte uma string JS pra bytes Latin-1 (1 char = 1 byte, código
 * 0-255). Caracteres fora desse intervalo (acentuação "estranha", símbolos
 * de outros idiomas) não existem em Latin-1 — viram '?' e são sinalizados
 * em `hadInvalidChars`, pra avisar o usuário em vez de gravar algo errado
 * silenciosamente (o programa original em Python quebraria nesse caso). */
export function encodeLatin1(str) {
  const bytes = new Uint8Array(str.length);
  let hadInvalidChars = false;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code > 0xff) {
      bytes[i] = 0x3f; // '?'
      hadInvalidChars = true;
    } else {
      bytes[i] = code;
    }
  }
  return { bytes, hadInvalidChars };
}

/** Salva `text` (usando \n internamente) como arquivo Latin-1 com quebras
 * de linha \r\n — igual ao `open(..., encoding="latin-1", newline="\r\n")`
 * do programa original. Usa a caixa de diálogo nativa "Salvar como"
 * (File System Access API) quando o navegador suporta; senão, cai para um
 * download comum (vai pra pasta Downloads com o nome sugerido). */
export async function saveTextFileLatin1(text, suggestedName) {
  const crlf = text.replace(/\n/g, "\r\n");
  const { bytes, hadInvalidChars } = encodeLatin1(crlf);
  const blob = new Blob([bytes], { type: "application/octet-stream" });

  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: "Cupom", accept: { "application/octet-stream": [] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { saved: true, cancelled: false, hadInvalidChars };
    } catch (e) {
      if (e && e.name === "AbortError") return { saved: false, cancelled: true, hadInvalidChars };
      throw e;
    }
  }

  // Fallback (Firefox/Safari): download comum via link temporário.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { saved: true, cancelled: false, hadInvalidChars };
}
