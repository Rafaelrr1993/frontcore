// -----------------------------------------------------------------------
// ambientes-data.js — dados de ConsultaAmbiente/Ambientes.xlsx, copiados
// diretamente pra esta página (aprovado pelo usuário em 04/09/2026 pra
// este momento do projeto).
//
// ATENÇÃO — isto é dado interno (CNPJ de cliente -> ambiente/loja/filial),
// e este repositório é PÚBLICO. Antes de considerar esta ferramenta
// "oficial" (fora deste exercício), a forma de acesso a estes dados
// precisa mudar pra algo restrito — por exemplo, hospedada no GitHub
// profissional da Avanço com o repositório privado, ou servida por uma
// API/backend com autenticação, em vez de um arquivo público de dados
// dentro do próprio site. Não adicione dados reais de produção aqui sem
// repetir essa conversa.
//
// Formato: cnpj já como veio da planilha (normalizado só na hora da
// consulta, em cnpj-utils.js — igual o programa original fazia).
// -----------------------------------------------------------------------

export const AMBIENTES_DATA = [
  { cnpj: "42793042000177", ambiente: "MG0", loja: "1", filial: "1" },
  { cnpj: "1097800000135", ambiente: "MG1", loja: "3", filial: "3" },
  { cnpj: "66338096000100", ambiente: "MG1", loja: "1", filial: "1" },
  { cnpj: "21988468000106", ambiente: "UDI", loja: "1", filial: "1" },
];
