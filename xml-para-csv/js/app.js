// -----------------------------------------------------------------------
// app.js — liga a UI da página à lógica de conversão (nfe-parser.js +
// file-sources.js + csv-builder.js), espelhando o app.py original.
// -----------------------------------------------------------------------
import { collectXmls } from "./file-sources.js";
import { gerarLinhas, gerarCsvTexto } from "./csv-builder.js";
import { saveCsv } from "./save-csv.js";

const inputZip = document.getElementById("input-zip");
const inputFolder = document.getElementById("input-folder");
const inputXml = document.getElementById("input-xml");
const btnZip = document.getElementById("btn-zip");
const btnFolder = document.getElementById("btn-folder");
const btnXml = document.getElementById("btn-xml");
const listEl = document.getElementById("entry-list");
const btnRemover = document.getElementById("btn-remover");
const btnLimpar = document.getElementById("btn-limpar");
const btnConverter = document.getElementById("btn-converter");
const progress = document.getElementById("progress");
const statusLabel = document.getElementById("status-label");

let entries = []; // {id, kind, label, payload}
let nextId = 1;
let selectedId = null;

function statusPadrao() {
  return entries.length ? `${entries.length} item(ns) selecionado(s).` : "Aguardando seleção de arquivos...";
}

function render() {
  listEl.innerHTML = "";
  for (const entry of entries) {
    const li = document.createElement("li");
    li.textContent = entry.label;
    li.dataset.id = String(entry.id);
    li.className = entry.id === selectedId ? "selected" : "";
    li.addEventListener("click", () => {
      selectedId = entry.id;
      render();
    });
    listEl.appendChild(li);
  }
  statusLabel.textContent = statusPadrao();
  btnConverter.disabled = entries.length === 0;
}

function addEntry(kind, label, payload) {
  entries.push({ id: nextId++, kind, label, payload });
  render();
}

btnZip.addEventListener("click", () => inputZip.click());
btnFolder.addEventListener("click", () => inputFolder.click());
btnXml.addEventListener("click", () => inputXml.click());

inputZip.addEventListener("change", () => {
  for (const file of inputZip.files) addEntry("zip", `📦 ${file.name}`, file);
  inputZip.value = "";
});

inputFolder.addEventListener("change", () => {
  const files = [...inputFolder.files];
  if (!files.length) return;
  const first = files[0].webkitRelativePath || files[0].name;
  const pastaNome = first.split("/")[0];
  const xmlCount = files.filter((f) => /\.xml$/i.test(f.name)).length;
  addEntry("folder", `📁 ${pastaNome}/ (${xmlCount} arquivo(s) XML)`, files);
  inputFolder.value = "";
});

inputXml.addEventListener("change", () => {
  for (const file of inputXml.files) addEntry("xml", `📄 ${file.name}`, file);
  inputXml.value = "";
});

btnRemover.addEventListener("click", () => {
  if (selectedId === null) return;
  entries = entries.filter((e) => e.id !== selectedId);
  selectedId = null;
  render();
});

btnLimpar.addEventListener("click", () => {
  entries = [];
  selectedId = null;
  render();
});

function setProgressIndeterminate(msg) {
  progress.removeAttribute("value");
  progress.hidden = false;
  statusLabel.textContent = msg;
}

function setProgressValue(atual, total, msg) {
  progress.hidden = false;
  progress.max = total;
  progress.value = atual;
  statusLabel.textContent = msg;
}

btnConverter.addEventListener("click", async () => {
  if (!entries.length) {
    alert("Selecione ao menos um arquivo ZIP, uma pasta ou arquivos XML antes de converter.");
    return;
  }

  btnConverter.disabled = true;
  setProgressIndeterminate("Lendo arquivos, aguarde...");

  try {
    const xmls = await collectXmls(entries, (msg) => setProgressIndeterminate(msg));
    const linhas = await gerarLinhas(xmls, (atual, total, msg) => setProgressValue(atual, total, msg));

    if (!linhas.length) {
      progress.hidden = true;
      statusLabel.textContent = "Nenhuma nota encontrada nos arquivos selecionados.";
      alert("Não foi encontrado nenhum XML de NF-e válido nos itens selecionados.");
      return;
    }

    statusLabel.textContent = `${linhas.length} nota(s) processada(s). Escolha onde salvar...`;
    const csvTexto = gerarCsvTexto(linhas);
    const { cancelled } = await saveCsv(csvTexto, "notas.csv");

    if (cancelled) {
      statusLabel.textContent = `${linhas.length} nota(s) prontas. Conversão não foi salva.`;
    } else {
      statusLabel.textContent = `Concluído! ${linhas.length} nota(s) salvas.`;
    }
  } catch (e) {
    statusLabel.textContent = "Ocorreu um erro.";
    alert(`Erro ao converter: ${e.message || e}`);
  } finally {
    progress.hidden = true;
    btnConverter.disabled = entries.length === 0;
  }
});

render();
