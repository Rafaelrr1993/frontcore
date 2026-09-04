// -----------------------------------------------------------------------
// cnpj-utils.js — port fiel de ConsultaAmbiente/cnpj_utils.py.
//
// O CNPJ é tratado sempre como texto (nunca como número), pra não perder
// zeros à esquerda. Reduzimos qualquer entrada — com ou sem máscara, com
// espaços extras etc. — para uma chave canônica de 14 dígitos.
// -----------------------------------------------------------------------

export const CNPJ_DIGITS = 14;

/** Remove tudo que não for dígito. Aceita string, número ou null/undefined. */
export function onlyDigits(valor) {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor).trim();
  return texto.replace(/\D+/g, "");
}

/** Reduz o CNPJ a uma chave canônica: só dígitos, com zeros à esquerda
 * completados até 14 posições — igual dos dois lados (valor digitado
 * pelo usuário e linhas lidas da planilha), pra comparação nunca depender
 * de máscara, espaços ou tamanho do texto. */
export function normalizeCnpj(valor) {
  const digitos = onlyDigits(valor);
  if (!digitos) return "";
  return digitos.padStart(CNPJ_DIGITS, "0");
}

/** Confere só o tamanho (14 dígitos) — validação de dígito verificador
 * não é objetivo desta ferramenta, que apenas consulta uma planilha. */
export function isValidLength(cnpjNormalizado) {
  return cnpjNormalizado.length === CNPJ_DIGITS;
}

/** Aplica a máscara padrão 00.000.000/0000-00 para exibição. */
export function formatCnpj(cnpjNormalizado) {
  const d = cnpjNormalizado;
  if (d.length !== CNPJ_DIGITS) return cnpjNormalizado;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}
