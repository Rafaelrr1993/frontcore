// -----------------------------------------------------------------------
// app.js — liga a UI da página às duas bibliotecas de lógica
// (cupom-builder.js / cupom-generator.js), espelhando as duas abas do
// programa desktop original (app.py). Tudo roda no navegador.
// -----------------------------------------------------------------------
import { buildNewCupom, KEEP_TEMPLATE, SPECIAL_LINE_CHOICES } from "./cupom-builder.js";
import { buildCupomCompleto } from "./cupom-generator.js";
import { readFileAsLatin1, saveTextFileLatin1 } from "./file-io.js";

// ---- abas ----
const tabRecriar = document.getElementById("tab-recriar");
const tabGerar = document.getElementById("tab-gerar");
const panelRecriar = document.getElementById("panel-recriar");
const panelGerar = document.getElementById("panel-gerar");

function selectTab(which) {
  const onRecriar = which === "recriar";
  tabRecriar.setAttribute("aria-selected", String(onRecriar));
  tabGerar.setAttribute("aria-selected", String(!onRecriar));
  panelRecriar.hidden = !onRecriar;
  panelGerar.hidden = onRecriar;
}
tabRecriar.addEventListener("click", () => selectTab("recriar"));
tabGerar.addEventListener("click", () => selectTab("gerar"));

// ---- helpers de UI compartilhados ----

function showError(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

function renderWarnings(container, listEl, warnings) {
  listEl.innerHTML = "";
  if (!warnings || !warnings.length) {
    container.hidden = true;
    return;
  }
  for (const w of warnings) {
    const li = document.createElement("li");
    li.textContent = w;
    listEl.appendChild(li);
  }
  container.hidden = false;
}

function money(v) {
  return v.toFixed(2).replace(".", ",");
}

// =========================================================================
// Aba 1 — Recriar a partir de modelo
// =========================================================================

const rTemplateFileInput = document.getElementById("r-template-file");
const rTemplateBtn = document.getElementById("r-template-btn");
const rTemplateName = document.getElementById("r-template-name");
const rXml = document.getElementById("r-xml");
const rSpecial = document.getElementById("r-special");
const rGerarBtn = document.getElementById("r-gerar");
const rLimparBtn = document.getElementById("r-limpar");
const rSalvarBtn = document.getElementById("r-salvar");
const rError = document.getElementById("r-error");
const rSummary = document.getElementById("r-summary");
const rWarnings = document.getElementById("r-warnings");
const rWarningsList = document.getElementById("r-warnings-list");
const rPreview = document.getElementById("r-preview");

let rTemplateText = null;
let rTemplateFilename = "";
let rResult = null;

rTemplateBtn.addEventListener("click", () => rTemplateFileInput.click());

rTemplateFileInput.addEventListener("change", async () => {
  const file = rTemplateFileInput.files[0];
  if (!file) return;
  try {
    rTemplateText = await readFileAsLatin1(file);
    rTemplateFilename = file.name;
    rTemplateName.value = file.name;
    showError(rError, "");
  } catch (e) {
    showError(rError, `Não consegui ler o arquivo selecionado: ${e.message || e}`);
  }
});

function rSpecialLineValue() {
  const v = rSpecial.value;
  if (v === "keep") return KEEP_TEMPLATE;
  if (v === "none") return null;
  return SPECIAL_LINE_CHOICES[v] ?? v;
}

rGerarBtn.addEventListener("click", () => {
  showError(rError, "");
  if (!rTemplateText) {
    showError(rError, "Selecione o arquivo de cupom-modelo primeiro.");
    return;
  }
  try {
    const result = buildNewCupom(rTemplateText, rXml.value, rTemplateFilename, rSpecialLineValue());
    rResult = result;

    const of = result.oldFields;
    const nf = result.newFields;
    const summaryLines = [
      `Nº do cupom:        ${of.seqcnc || "?"}  ->  ${nf.seqcnc}`,
      `Chave de acesso:    ${of.chave || "?"}`,
      `                    -> ${nf.chave}`,
      `Status (cStat):     ${nf.cstat || "?"}  (${nf.xmotivo || "?"})`,
      `Substituições feitas nas linhas de item (02AV...): ${result.seqcncReplacements}`,
      `Linha especial de cabeçalho: ${result.specialLineAction}`,
      `Nome sugerido para o novo arquivo: ${result.newFilename}`,
    ];
    rSummary.textContent = summaryLines.join("\n");
    renderWarnings(rWarnings, rWarningsList, result.warnings);
    rPreview.textContent = result.newText;
    rSalvarBtn.disabled = false;
  } catch (e) {
    rResult = null;
    rSalvarBtn.disabled = true;
    showError(rError, e.message || String(e));
  }
});

rLimparBtn.addEventListener("click", () => {
  rTemplateText = null;
  rTemplateFilename = "";
  rTemplateName.value = "";
  rTemplateFileInput.value = "";
  rXml.value = "";
  rResult = null;
  rSummary.textContent = "";
  rPreview.textContent = "";
  renderWarnings(rWarnings, rWarningsList, []);
  showError(rError, "");
  rSalvarBtn.disabled = true;
});

rSalvarBtn.addEventListener("click", async () => {
  if (!rResult) return;
  try {
    const { cancelled, hadInvalidChars } = await saveTextFileLatin1(rResult.newText, rResult.newFilename);
    if (!cancelled && hadInvalidChars) {
      showError(rError, "Atenção: o cupom continha caracteres fora do padrão Latin-1 — eles foram trocados por '?' no arquivo salvo. Confira o texto colado.");
    }
  } catch (e) {
    showError(rError, `Não consegui salvar o arquivo: ${e.message || e}`);
  }
});

// =========================================================================
// Aba 2 — Gerar cupom completo
// =========================================================================

const gXml = document.getElementById("g-xml");
const gSpecial = document.getElementById("g-special");
const gLoja = document.getElementById("g-loja");
const gCodPagto = document.getElementById("g-cod-pagto");
const gDescPagto = document.getElementById("g-desc-pagto");
const gGerarBtn = document.getElementById("g-gerar");
const gLimparBtn = document.getElementById("g-limpar");
const gSalvarBtn = document.getElementById("g-salvar");
const gError = document.getElementById("g-error");
const gSummary = document.getElementById("g-summary");
const gWarnings = document.getElementById("g-warnings");
const gWarningsList = document.getElementById("g-warnings-list");
const gPreview = document.getElementById("g-preview");

let gResult = null;

function gSpecialLineValue() {
  const v = gSpecial.value;
  return v === "none" ? null : v;
}

gGerarBtn.addEventListener("click", () => {
  showError(gError, "");
  try {
    const result = buildCupomCompleto(gXml.value, {
      specialLine: gSpecialLineValue(),
      loja: gLoja.value.trim() || null,
      codigoFormaPagto: gCodPagto.value.trim() || null,
      descFormaPagto: gDescPagto.value.trim() || null,
    });
    gResult = result;

    if (result.aprendidos && result.aprendidos.length) {
      // já foi salvo (neste navegador) pra essa loja+forma de pagamento -
      // limpa os campos pra não confundir numa próxima geração de outra
      // forma de pagamento ainda desconhecida.
      gCodPagto.value = "";
      gDescPagto.value = "";
    }

    const d = result.data;
    const summaryLines = [
      `Chave de acesso:  ${d.chave}`,
      `Nº do cupom (SEQ CNC): ${d.seqcnc || "?"}     PDV: ${d.pdv || "?"}`,
      `Emitente: ${d.xNome_emit}  (CNPJ ${d.cnpj_emit})`,
      `Itens: ${d.itens.length}     Pagamentos: ${d.pagamentos.length}     Valor total: R$ ${money(d.vNF)}`,
      `Nome sugerido para o arquivo: ${result.newFilename}`,
    ];
    gSummary.textContent = summaryLines.join("\n");
    renderWarnings(gWarnings, gWarningsList, result.warnings);
    gPreview.textContent = result.newText;
    gSalvarBtn.disabled = false;
  } catch (e) {
    gResult = null;
    gSalvarBtn.disabled = true;
    showError(gError, e.message || String(e));
  }
});

gLimparBtn.addEventListener("click", () => {
  gXml.value = "";
  gResult = null;
  gSummary.textContent = "";
  gPreview.textContent = "";
  renderWarnings(gWarnings, gWarningsList, []);
  showError(gError, "");
  gSalvarBtn.disabled = true;
});

gSalvarBtn.addEventListener("click", async () => {
  if (!gResult) return;
  try {
    const { cancelled, hadInvalidChars } = await saveTextFileLatin1(gResult.newText, gResult.newFilename);
    if (!cancelled && hadInvalidChars) {
      showError(gError, "Atenção: o cupom continha caracteres fora do padrão Latin-1 — eles foram trocados por '?' no arquivo salvo. Confira o texto colado.");
    }
  } catch (e) {
    showError(gError, `Não consegui salvar o arquivo: ${e.message || e}`);
  }
});
