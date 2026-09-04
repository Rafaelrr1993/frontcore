// -----------------------------------------------------------------------
// app.js — liga a UI da página ao serviço de consulta (consulta-service.js),
// espelhando o app.py original. Tudo roda no navegador.
// -----------------------------------------------------------------------
import { consultarAmbiente, CnpjInvalidoError } from "./consulta-service.js";
import { formatCnpj } from "./cnpj-utils.js";

const input = document.getElementById("cnpj-input");
const btnConsultar = document.getElementById("btn-consultar");
const message = document.getElementById("message");
const resultCard = document.getElementById("result-card");
const cnpjValue = document.getElementById("cnpj-value");
const ambienteCard = document.getElementById("ambiente-card");
const ambienteValue = document.getElementById("ambiente-value");
const lojaValue = document.getElementById("loja-value");
const filialValue = document.getElementById("filial-value");

function ambienteEProducao(texto) {
  return texto.trim().toUpperCase().includes("PROD");
}

function mostrarMensagem(texto, isError = false) {
  message.textContent = texto;
  message.hidden = !texto;
  message.classList.toggle("is-error", isError);
}

function consultar() {
  let resultado;
  try {
    resultado = consultarAmbiente(input.value);
  } catch (e) {
    if (e instanceof CnpjInvalidoError) {
      resultCard.hidden = true;
      mostrarMensagem(e.message, true);
      return;
    }
    resultCard.hidden = true;
    mostrarMensagem("Não foi possível concluir a consulta. Tente novamente.", true);
    return;
  }

  if (resultado === null) {
    resultCard.hidden = true;
    mostrarMensagem("CNPJ não encontrado.", true);
    return;
  }

  mostrarMensagem("");
  cnpjValue.textContent = formatCnpj(resultado.cnpj);
  ambienteValue.textContent = resultado.ambiente || "—";
  lojaValue.textContent = resultado.codigoLoja || "—";
  filialValue.textContent = resultado.codigoFilial || "—";
  ambienteCard.classList.toggle("is-producao", ambienteEProducao(resultado.ambiente || ""));
  resultCard.hidden = false;

  // Deixa o campo pronto pra trocar o CNPJ e consultar de novo rápido.
  input.focus();
  input.select();
}

btnConsultar.addEventListener("click", consultar);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") consultar();
});

input.focus();
