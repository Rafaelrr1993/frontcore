// -----------------------------------------------------------------------
// app.js — Confere Diferença. Lê os dois arquivos (papel de cada um
// escolhido pelo usuário no <select>, já que o nome do arquivo muda a
// cada exportação), cruza pela NFC-e e mostra só as diferenças.
// -----------------------------------------------------------------------
import { readXlsxRows } from "./xlsx-lite.js";
import { readCsvRows } from "./csv-lite.js";
import { parseIntegral, parseTramitador, comparar } from "./comparador.js";
import { saveCsv } from "./save-csv.js";

const input1 = document.getElementById("arquivo1");
const input2 = document.getElementById("arquivo2");
const nome1 = document.getElementById("nome1");
const nome2 = document.getElementById("nome2");
const tipo1 = document.getElementById("tipo1");
const tipo2 = document.getElementById("tipo2");
const btnComparar = document.getElementById("btn-comparar");
const statusMsg = document.getElementById("status-msg");
const resultado = document.getElementById("resultado");
const resumo = document.getElementById("resumo");
const tabelaBody = document.querySelector("#tabela-diffs tbody");
const tabelaWrap = document.getElementById("tabela-wrap");
const btnExportar = document.getElementById("btn-exportar");

function atualizarNome(input, span) {
  span.textContent = input.files[0] ? input.files[0].name : "Nenhum arquivo selecionado";
}

input1.addEventListener("change", () => atualizarNome(input1, nome1));
input2.addEventListener("change", () => atualizarNome(input2, nome2));

function mostrarStatus(msg) {
  statusMsg.hidden = false;
  statusMsg.textContent = msg;
}

async function lerLinhas(file) {
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".xlsx") || nome.endsWith(".xls")) {
    return readXlsxRows(file);
  }
  return readCsvRows(file);
}

let ultimosDiffs = [];

btnComparar.addEventListener("click", async () => {
  resultado.hidden = true;

  if (!input1.files[0] || !input2.files[0]) {
    mostrarStatus("Selecione os dois arquivos (Integral e Tramitador) antes de comparar.");
    return;
  }
  if (tipo1.value === tipo2.value) {
    mostrarStatus("Selecione um arquivo pra cada tipo — um do Integral e outro do Tramitador.");
    return;
  }

  const arquivoIntegral = tipo1.value === "integral" ? input1.files[0] : input2.files[0];
  const arquivoTramitador = tipo1.value === "tramitador" ? input1.files[0] : input2.files[0];

  btnComparar.disabled = true;
  try {
    mostrarStatus("Lendo os arquivos... em planilhas grandes isso pode levar alguns segundos.");
    // cede o controle ao navegador antes do trabalho pesado, pra mensagem acima aparecer
    await new Promise((r) => setTimeout(r, 30));

    const [linhasIntegral, linhasTramitador] = await Promise.all([
      lerLinhas(arquivoIntegral),
      lerLinhas(arquivoTramitador),
    ]);

    const integral = parseIntegral(linhasIntegral);
    const tramitador = parseTramitador(linhasTramitador);
    const diffs = comparar(integral, tramitador);
    ultimosDiffs = diffs;

    renderResultado(diffs, integral.size, tramitador.size);
    statusMsg.hidden = true;
  } catch (e) {
    mostrarStatus("Erro: " + e.message);
  } finally {
    btnComparar.disabled = false;
  }
});

function renderResultado(diffs, totalIntegral, totalTramitador) {
  resumo.textContent = diffs.length
    ? `${totalIntegral} cupons no Integral · ${totalTramitador} no Tramitador · ${diffs.length} diferença(s) encontrada(s).`
    : `${totalIntegral} cupons no Integral · ${totalTramitador} no Tramitador · nenhuma diferença encontrada — está tudo batendo.`;

  tabelaBody.innerHTML = "";
  tabelaWrap.hidden = diffs.length === 0;
  btnExportar.hidden = diffs.length === 0;

  for (const d of diffs) {
    const tr = document.createElement("tr");
    const celulas = [
      d.nfce,
      d.tipo,
      d.detalhe,
      d.valorIntegral != null ? "R$ " + d.valorIntegral.toFixed(2) : "—",
      d.valorTramitador != null ? "R$ " + d.valorTramitador.toFixed(2) : "—",
      d.docum ?? "—",
      d.data ?? "—",
    ];
    for (const texto of celulas) {
      const td = document.createElement("td");
      td.textContent = texto;
      tr.appendChild(td);
    }
    tabelaBody.appendChild(tr);
  }

  resultado.hidden = false;
}

function csvField(value) {
  const s = String(value ?? "");
  if (/[;"\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

btnExportar.addEventListener("click", async () => {
  const cabecalho = ["NFCe", "Tipo", "Detalhe", "Valor Integral", "Valor Tramitador", "Docum/Doc.PDV", "Data"];
  const linhas = [cabecalho.map(csvField).join(";")];
  for (const d of ultimosDiffs) {
    linhas.push(
      [d.nfce, d.tipo, d.detalhe, d.valorIntegral ?? "", d.valorTramitador ?? "", d.docum ?? "", d.data ?? ""]
        .map(csvField)
        .join(";")
    );
  }
  const texto = "﻿" + linhas.join("\r\n") + "\r\n";
  await saveCsv(texto, "confere-diferenca.csv");
});
