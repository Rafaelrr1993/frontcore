// -----------------------------------------------------------------------
// comparador.js — cruza a planilha do ERP Integral com o relatório do
// Tramitador pela coluna da NFC-e, e acha os cupons/notas que não batem.
//
// Integral: cada linha é uma venda concluída no PDV/ERP da loja.
// Tramitador: lista tudo que foi processado na SEFAZ no período — inclui
// documentos de outro modelo (NF-e, não cupom), números inutilizados,
// rejeições e reprocessamentos do mesmo número de nota. Por isso, antes
// de comparar, a gente filtra só os documentos modelo 65 (cupom fiscal /
// NFC-e — o campo "modelo" vem embutido na Chave de Acesso, posições
// 21-22) e, quando o mesmo número de nota aparece mais de uma vez
// (reprocessamento), fica com a versão autorizada.
// -----------------------------------------------------------------------

function normalizarValor(str) {
  if (str == null || str === "") return null;
  if (typeof str === "number") return str;
  const limpo = String(str).trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return Number.isNaN(n) ? null : n;
}

function normalizarChave(valor) {
  if (valor == null) return "";
  return String(valor).trim().replace(/^0+(?=\d)/, "");
}

function acharColuna(headerRow, ...nomes) {
  const alvos = nomes.map((n) => n.toLowerCase());
  for (let i = 0; i < headerRow.length; i++) {
    const cell = (headerRow[i] ?? "").toString().trim().toLowerCase();
    if (alvos.includes(cell)) return i;
  }
  return -1;
}

function acharLinhaCabecalho(rows, coluna0Esperada) {
  const alvo = coluna0Esperada.toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    const primeira = (rows[i][0] ?? "").toString().trim().toLowerCase();
    if (primeira === alvo) return i;
  }
  return -1;
}

/** Extrai as vendas do arquivo do ERP Integral, indexadas por NFC-e. */
export function parseIntegral(rows) {
  const headerIdx = acharLinhaCabecalho(rows, "lj");
  if (headerIdx === -1) {
    throw new Error(
      'Não encontrei o cabeçalho do Integral (esperava a coluna "Lj" na primeira posição). Confirma se esse é mesmo o arquivo do ERP Integral?'
    );
  }
  const header = rows[headerIdx];

  const colNfce = acharColuna(header, "NFCe");
  const colValor = acharColuna(header, "Valor");
  const colDocum = acharColuna(header, "Docum");
  const colLj = acharColuna(header, "Lj");
  const colData = acharColuna(header, "Data");
  const colHora = acharColuna(header, "Hora");
  const colTipo = acharColuna(header, "Tipo");
  const colOperador = acharColuna(header, "Operador");

  if (colNfce === -1) {
    throw new Error('Não encontrei a coluna "NFCe" no arquivo do Integral.');
  }

  const porNfce = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[colNfce]) continue;
    const nfce = normalizarChave(row[colNfce]);
    if (!nfce) continue;
    porNfce.set(nfce, {
      nfce,
      docum: colDocum >= 0 ? row[colDocum] : null,
      lj: colLj >= 0 ? row[colLj] : null,
      data: colData >= 0 ? row[colData] : null,
      hora: colHora >= 0 ? row[colHora] : null,
      valor: normalizarValor(colValor >= 0 ? row[colValor] : null),
      tipo: colTipo >= 0 ? row[colTipo] : null,
      operador: colOperador >= 0 ? row[colOperador] : null,
    });
  }
  return porNfce;
}

const SITUACOES_VALIDAS = new Set(["AUTORIZADA", "AUTORIZADA FORA DO PRAZO"]);

/** Extrai os documentos modelo 65 (cupom fiscal / NFC-e) do relatório do
 * Tramitador, indexados por número da nota (NNF) — já resolvendo
 * reprocessamentos (fica com a versão autorizada, quando existe). */
export function parseTramitador(rows) {
  const headerIdx = acharLinhaCabecalho(rows, "nnf");
  if (headerIdx === -1) {
    throw new Error(
      'Não encontrei o cabeçalho do Tramitador (esperava a coluna "NNF" na primeira posição). Confirma se esse é mesmo o relatório do Tramitador?'
    );
  }
  const header = rows[headerIdx];

  const colNnf = acharColuna(header, "NNF");
  const colDocPdv = acharColuna(header, "Doc. PDV", "Doc PDV");
  const colSituacaoCod = acharColuna(header, "Situação", "Situacao");
  const colSituacaoTexto = colSituacaoCod >= 0 ? colSituacaoCod + 1 : -1;
  const colValorTotal = acharColuna(header, "Valor Total");
  const colChave = acharColuna(header, "Chave Acesso", "Chave de Acesso");
  const colDataEmissao = acharColuna(header, "Data Emissão", "Data Emissao");

  if (colNnf === -1) {
    throw new Error('Não encontrei a coluna "NNF" no arquivo do Tramitador.');
  }
  if (colChave === -1) {
    throw new Error(
      'Não encontrei a coluna "Chave Acesso" no arquivo do Tramitador — preciso dela pra saber se o documento é NF-e ou NFC-e.'
    );
  }

  const porNnf = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row[colNnf] == null || row[colNnf] === "") continue;

    const chave = String(row[colChave] ?? "");
    const modelo = chave.length >= 22 ? chave.slice(20, 22) : "";
    if (modelo === "55") continue; // NF-e normal (não é cupom) — fora da comparação

    const nnf = normalizarChave(row[colNnf]);
    if (!nnf) continue;
    const situacao = colSituacaoTexto >= 0 ? String(row[colSituacaoTexto] ?? "").trim().toUpperCase() : "";

    const doc = {
      nnf,
      docPdv: colDocPdv >= 0 ? row[colDocPdv] : null,
      situacao,
      valor: normalizarValor(colValorTotal >= 0 ? row[colValorTotal] : null),
      chave,
      dataEmissao: colDataEmissao >= 0 ? row[colDataEmissao] : null,
    };

    const existente = porNnf.get(nnf);
    if (!existente || (!SITUACOES_VALIDAS.has(existente.situacao) && SITUACOES_VALIDAS.has(situacao))) {
      porNnf.set(nnf, doc);
    }
  }
  return porNnf;
}

const TOLERANCIA_VALOR = 0.01;

/** Cruza os dois mapas (por número da NFC-e) e devolve só as diferenças
 * — cupons/notas que não batem entre o Integral e o Tramitador. */
export function comparar(integral, tramitador) {
  const diffs = [];
  const vistos = new Set();

  for (const [nfce, venda] of integral) {
    vistos.add(nfce);
    const doc = tramitador.get(nfce);

    if (!doc) {
      diffs.push({
        nfce,
        tipo: "Não encontrado no Tramitador",
        detalhe: "Tem venda no Integral, mas essa NFC-e não aparece no relatório do Tramitador.",
        valorIntegral: venda.valor,
        valorTramitador: null,
        situacaoTramitador: null,
        docum: venda.docum,
        data: venda.data,
        hora: venda.hora,
      });
      continue;
    }

    if (!SITUACOES_VALIDAS.has(doc.situacao)) {
      diffs.push({
        nfce,
        tipo: `Situação no Tramitador: ${doc.situacao || "desconhecida"}`,
        detalhe: `O Integral registra essa venda como concluída, mas no Tramitador ela está como "${doc.situacao}".`,
        valorIntegral: venda.valor,
        valorTramitador: doc.valor,
        situacaoTramitador: doc.situacao,
        docum: venda.docum,
        data: venda.data,
        hora: venda.hora,
      });
      continue;
    }

    if (venda.valor != null && doc.valor != null && Math.abs(venda.valor - doc.valor) > TOLERANCIA_VALOR) {
      diffs.push({
        nfce,
        tipo: "Valor diferente",
        detalhe: `Integral: R$ ${venda.valor.toFixed(2)} · Tramitador: R$ ${doc.valor.toFixed(2)}`,
        valorIntegral: venda.valor,
        valorTramitador: doc.valor,
        situacaoTramitador: doc.situacao,
        docum: venda.docum,
        data: venda.data,
        hora: venda.hora,
      });
    }
  }

  // Notas autorizadas no Tramitador sem nenhum registro no Integral.
  // (Cancelada/rejeitada/inutilizada sem venda no Integral é esperado —
  // não é sinalizado como diferença.)
  for (const [nnf, doc] of tramitador) {
    if (vistos.has(nnf)) continue;
    if (!SITUACOES_VALIDAS.has(doc.situacao)) continue;
    diffs.push({
      nfce: nnf,
      tipo: "Não encontrado no Integral",
      detalhe: "Está autorizada no Tramitador, mas essa NFC-e não aparece no Integral.",
      valorIntegral: null,
      valorTramitador: doc.valor,
      situacaoTramitador: doc.situacao,
      docum: doc.docPdv,
      data: doc.dataEmissao,
      hora: null,
    });
  }

  diffs.sort((a, b) => Number(a.nfce) - Number(b.nfce));
  return diffs;
}
