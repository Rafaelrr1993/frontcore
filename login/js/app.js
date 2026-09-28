// -----------------------------------------------------------------------
// app.js — protótipo visual de login + troca obrigatória de senha no
// primeiro acesso. NÃO é autenticação de verdade: as credenciais abaixo
// são fictícias e ficam visíveis no código (é um site estático, sem
// backend/banco de dados nenhum ainda). Quando existir um backend real,
// troca-se `autenticar()` por uma chamada de API de verdade — o resto do
// fluxo (telas, validação de senha nova) já fica pronto.
// -----------------------------------------------------------------------

const CREDENCIAL_EXEMPLO = {
  email: "usuario@avancoinfo.com.br",
  senha: "ExemploSenha123",
};

function autenticar(email, senha) {
  return email.trim().toLowerCase() === CREDENCIAL_EXEMPLO.email && senha === CREDENCIAL_EXEMPLO.senha;
}

const viewLogin = document.getElementById("view-login");
const viewNewpass = document.getElementById("view-newpass");
const viewDone = document.getElementById("view-done");

const formLogin = document.getElementById("form-login");
const loginError = document.getElementById("login-error");

const formNewpass = document.getElementById("form-newpass");
const newpassError = document.getElementById("newpass-error");

function showView(view) {
  for (const v of [viewLogin, viewNewpass, viewDone]) v.hidden = v !== view;
}

formLogin.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;

  if (!autenticar(email, senha)) {
    loginError.textContent = "E-mail ou senha incorretos.";
    loginError.hidden = false;
    return;
  }
  loginError.hidden = true;
  showView(viewNewpass);
});

formNewpass.addEventListener("submit", (e) => {
  e.preventDefault();
  const nova = document.getElementById("nova-senha").value;
  const confirma = document.getElementById("confirma-senha").value;

  if (nova.length < 8) {
    newpassError.textContent = "A nova senha precisa ter pelo menos 8 caracteres.";
    newpassError.hidden = false;
    return;
  }
  if (nova !== confirma) {
    newpassError.textContent = "As duas senhas digitadas não são iguais.";
    newpassError.hidden = false;
    return;
  }
  newpassError.hidden = true;
  showView(viewDone);
});
