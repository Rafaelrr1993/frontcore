// -----------------------------------------------------------------------
// csv-builder.js — port fiel de gerar_linhas()/escrever_csv() de
// XML para CSV/NFe_para_CSV_App.py: junta o resultado de todos os XMLs
// processados (notas + eventos), aplica os eventos de cancelamento nas
// notas correspondentes, ordena e monta o texto CSV final.
//
// Diferença em relação ao original: aqui quem entrega os XMLs já
// decodificados é `file-sources.js` (pasta/zip/arquivos soltos do
// navegador, sem acesso a disco) — este módulo só recebe uma lista de
// {relPath, text} e não sabe de onde veio cada um.
// -----------------------------------------------------------------------
import { CSV_HEADER, processarArquivoXml } from "./nfe-parser.js";

/**
 * @param {{relPath: string, text: string}[]} xmls
 * @param {(atual: number, total: number, msg: string) => void} [progressCb]
 * @returns {Promise<object[]>} linhas (uma por nota), já ordenadas
 */
export async function gerarLinhas(xmls, progressCb) {
  const total = xmls.length;
  if (total === 0) return [];

  const notas = new Map();
  const eventos = [];

  for (let i = 0; i < total; i++) {
    const { relPath, text } = xmls[i];
    const [tipo, dados] = processarArquivoXml(text, relPath);
    if (tipo === "nota" && dados) {
      notas.set(dados.chave, dados);
    } else if (tipo === "evento" && dados) {
      eventos.push(dados);
    }
    if (progressCb) progressCb(i + 1, total, `Processando ${i + 1} de ${total} XML...`);
    // cede o controle pro navegador a cada 25 arquivos, pra barra de
    // progresso e a aba não travarem em lotes grandes.
    if (i % 25 === 24) await new Promise((r) => setTimeout(r, 0));
  }

  for (const ev of eventos) {
    const nota = notas.get(ev.chave);
    if (!nota) continue;
    nota["Eventos"] = "Sim";
    if (ev.tpEvento === "110111" && ["135", "155"].includes(ev.cStatEvento)) {
      nota["Situação"] = "Cancelada";
      nota["Código Situação"] = ev.cStatEvento;
    }
  }

  const linhas = [...notas.values()];

  function chaveOrdenacao(linha) {
    const serie = parseInt(linha["Série"], 10);
    const nnf = parseInt(linha["NNF"], 10);
    if (Number.isNaN(serie) || Number.isNaN(nnf)) return [0, 0];
    return [serie, nnf];
  }

  linhas.sort((a, b) => {
    const [as_, an] = chaveOrdenacao(a);
    const [bs, bn] = chaveOrdenacao(b);
    return as_ - bs || an - bn;
  });

  return linhas;
}

function csvField(value) {
  const s = String(value ?? "");
  if (/[;"\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Monta o texto do CSV (delimitador ";", BOM UTF-8, quebra \r\n) — igual
 * ao csv.DictWriter(..., delimiter=";") + encoding="utf-8-sig" do original. */
export function gerarCsvTexto(linhas) {
  const rows = [CSV_HEADER.map(csvField).join(";")];
  for (const linha of linhas) {
    rows.push(CSV_HEADER.map((h) => csvField(linha[h] ?? "")).join(";"));
  }
  return "﻿" + rows.join("\r\n") + "\r\n";
}
