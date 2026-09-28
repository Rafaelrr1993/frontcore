// -----------------------------------------------------------------------
// app.js — Confere Diferença. Por enquanto só a interface (seleção de
// arquivo + qual é qual). A comparação de verdade entra assim que
// tivermos exemplos reais do Integral e do Tramitador pra mapear as
// colunas certas de cada layout.
// -----------------------------------------------------------------------

const input1 = document.getElementById("arquivo1");
const input2 = document.getElementById("arquivo2");
const nome1 = document.getElementById("nome1");
const nome2 = document.getElementById("nome2");
const btnComparar = document.getElementById("btn-comparar");
const statusMsg = document.getElementById("status-msg");

function atualizarNome(input, span) {
  span.textContent = input.files[0] ? input.files[0].name : "Nenhum arquivo selecionado";
}

input1.addEventListener("change", () => atualizarNome(input1, nome1));
input2.addEventListener("change", () => atualizarNome(input2, nome2));

btnComparar.addEventListener("click", () => {
  statusMsg.hidden = false;
  if (!input1.files[0] || !input2.files[0]) {
    statusMsg.textContent = "Selecione os dois arquivos (Integral e Tramitador) antes de comparar.";
    return;
  }
  statusMsg.textContent =
    "Ainda estou aguardando os arquivos de exemplo do Integral e do Tramitador pra mapear as colunas certas de cada layout. Assim que eu tiver isso, essa comparação já roda de verdade aqui — sem precisar conferir na mão.";
});
