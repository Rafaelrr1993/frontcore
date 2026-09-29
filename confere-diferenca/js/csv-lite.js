// -----------------------------------------------------------------------
// csv-lite.js — leitor de CSV com delimitador ";" e decodificação Latin-1
// (ISO-8859-1), o encoding usado pelas exportações do ERP Integral.
// -----------------------------------------------------------------------
export async function readCsvRows(file, delimiter = ";") {
  const buf = await file.arrayBuffer();
  const text = new TextDecoder("iso-8859-1").decode(buf);
  const linhas = text.split(/\r\n|\n|\r/).filter((l) => l.length > 0);
  return linhas.map((linha) => linha.split(delimiter).map((c) => c.trim()));
}
