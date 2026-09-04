// -----------------------------------------------------------------------
// consulta-service.js — port fiel de ConsultaAmbiente/consulta_service.py
// + excel_repository.py (aqui fundidos, já que a "planilha" virou um
// array JS estático em vez de um arquivo lido em disco — ver
// ambientes-data.js).
// -----------------------------------------------------------------------
import { normalizeCnpj, isValidLength } from "./cnpj-utils.js";
import { AMBIENTES_DATA } from "./ambientes-data.js";

export class CnpjInvalidoError extends Error {}

// Índice em memória CNPJ normalizado -> {ambiente, codigoLoja, codigoFilial},
// montado uma vez (equivalente ao ExcelAmbienteRepository do lado Python).
const _indice = new Map();
for (const linha of AMBIENTES_DATA) {
  const cnpj = normalizeCnpj(linha.cnpj);
  if (!cnpj) continue;
  _indice.set(cnpj, {
    ambiente: (linha.ambiente ?? "").toString().trim(),
    codigoLoja: (linha.loja ?? "").toString().trim(),
    codigoFilial: (linha.filial ?? "").toString().trim(),
  });
}

/** Consulta o ambiente/loja/filial de um CNPJ.
 *
 * Levanta CnpjInvalidoError se o texto informado não tiver 14 dígitos
 * depois de normalizado, ou devolve null se o CNPJ não estiver
 * cadastrado. */
export function consultarAmbiente(cnpjDigitado) {
  const cnpj = normalizeCnpj(cnpjDigitado);
  if (!isValidLength(cnpj)) {
    throw new CnpjInvalidoError("Informe um CNPJ válido (14 dígitos).");
  }

  const encontrado = _indice.get(cnpj);
  if (!encontrado) return null;

  return { cnpj, ambiente: encontrado.ambiente, codigoLoja: encontrado.codigoLoja, codigoFilial: encontrado.codigoFilial };
}
