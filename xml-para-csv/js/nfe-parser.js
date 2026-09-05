// -----------------------------------------------------------------------
// nfe-parser.js — port fiel da lógica de leitura de XML de
// XML para CSV/NFe_para_CSV_App.py (funções situacao_por_cstat, fmt_data,
// fmt_valor, extrair_doc_pdv, parse_nfe_proc, parse_evento,
// processar_arquivo_xml).
// -----------------------------------------------------------------------
import { parseXML, localFind, descendant } from "../../assets/js/xml-lite.js";

export const CSV_HEADER = [
  "NNF", "Série", "Doc. PDV", "Código Situação", "Eventos", "Situação",
  "Data de Autorização", "Nat. Op.", "Dest/Emit", "Valor Total",
  "Base ICMS", "Valor ICMS", "Valor FCP", "Descontos", "Chave",
  "Data Emissão",
];

/** Igual ao `get(el, tag)` do lado Python: texto CRU do primeiro filho
 * direto com essa tag, sem aparar espaços — "" se não existir ou vazio. */
function get(el, tag) {
  if (!el) return "";
  const found = localFind(el, tag);
  return found && found.text ? found.text : "";
}

export function situacaoPorCstat(cstat) {
  cstat = String(cstat);
  if (cstat === "100") return "Autorizada";
  if (["101", "135", "151", "155"].includes(cstat)) return "Cancelada";
  if (["110", "301", "302"].includes(cstat)) return "Denegada";
  return "Rejeição";
}

export function fmtData(dh) {
  if (!dh) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(dh);
  if (!m) return dh;
  const [, ano, mes, dia, h, mi, s] = m;
  return `${dia}/${mes}/${ano} ${h}:${mi}:${s}`;
}

export function fmtValor(v) {
  if (v === null || v === undefined || v === "") return "0";
  const f = Number(v);
  if (Number.isNaN(f)) return String(v);
  return f.toFixed(2).replace(".", ",");
}

/** Número do cupom/documento do PDV. Prioridade:
 * 1) SEQ. CNC (presente em quase toda venda: cartão, PIX ou dinheiro)
 * 2) DOC: (só em vendas no cartão)
 * 3) CV- (código da transação PIX) */
export function extrairDocPdv(infCpl) {
  if (!infCpl) return "";
  let m = /SEQ\.?\s*CNC:\s*([0-9]+)/.exec(infCpl);
  if (m) return m[1];
  m = /DOC:\s*([0-9]+)/.exec(infCpl);
  if (m) return m[1];
  m = /CV-([0-9]+)/.exec(infCpl);
  if (m) return m[1];
  return "";
}

/** Nome da pasta-pai imediata a partir de um caminho relativo tipo
 * "MinhaPasta/sub/arquivo.xml" (o que webkitRelativePath e os nomes de
 * entrada de um .zip fornecem) — equivalente a `arquivo.parent.name` no
 * lado Python. Sem caminho (arquivo solto, sem pasta), devolve "". */
function parentFolderName(relPath) {
  if (!relPath) return "";
  const parts = relPath.split("/").filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2].toLowerCase() : "";
}

export function parseNfeProc(root, relPath) {
  const infNFe = descendant(root, "infNFe");
  if (!infNFe) return null;

  let chave = infNFe.attrs.Id || "";
  if (chave.startsWith("NFe")) chave = chave.slice(3);

  const ide = localFind(infNFe, "ide");
  const dest = localFind(infNFe, "dest");
  const total = localFind(infNFe, "total/ICMSTot");
  const infAdic = localFind(infNFe, "infAdic/infCpl");
  const prot = localFind(descendant(root, "protNFe"), "infProt");

  const nnf = get(ide, "nNF");
  const serie = get(ide, "serie");
  const natOp = get(ide, "natOp");
  const dhEmi = get(ide, "dhEmi") || get(ide, "dEmi");
  const destNome = dest ? get(dest, "xNome") : "";

  const vNF = get(total, "vNF");
  const vBC = get(total, "vBC");
  const vICMS = get(total, "vICMS");
  const vFCP = get(total, "vFCP");
  const vDesc = get(total, "vDesc");

  const docPdv = extrairDocPdv(infAdic ? infAdic.text : "");

  let situacao, codigoSituacao, dhAutorizacao;
  if (prot) {
    const cstat = get(prot, "cStat");
    dhAutorizacao = get(prot, "dhRecbto");
    situacao = cstat ? situacaoPorCstat(cstat) : "";
    codigoSituacao = cstat;
  } else {
    const pasta = parentFolderName(relPath);
    dhAutorizacao = "";
    codigoSituacao = "";
    if (pasta.includes("cancel")) situacao = "Cancelada";
    else if (pasta.includes("rejeit") || pasta.includes("problema") || pasta.includes("erro")) situacao = "Rejeitada (sem retorno da SEFAZ)";
    else if (pasta.includes("deneg")) situacao = "Denegada";
    else situacao = "Sem retorno da SEFAZ";
  }

  return {
    chave,
    "NNF": nnf,
    "Série": serie,
    "Doc. PDV": docPdv,
    "Código Situação": codigoSituacao,
    "Eventos": "Não",
    "Situação": situacao,
    "Data de Autorização": fmtData(dhAutorizacao),
    "Nat. Op.": natOp,
    "Dest/Emit": destNome || "",
    "Valor Total": fmtValor(vNF),
    "Base ICMS": fmtValor(vBC),
    "Valor ICMS": fmtValor(vICMS),
    "Valor FCP": fmtValor(vFCP),
    "Descontos": fmtValor(vDesc),
    "Chave": chave,
    "Data Emissão": fmtData(dhEmi),
  };
}

export function parseEvento(root) {
  const infEvento = descendant(root, "infEvento");
  if (!infEvento) return null;

  const retEventoNFe = descendant(root, "retEventoNFe");
  const retEvento = retEventoNFe ? localFind(retEventoNFe, "infEvento") : null;

  const chave = get(infEvento, "chNFe");
  const tpEvento = get(infEvento, "tpEvento");
  const cStatEvento = retEvento ? get(retEvento, "cStat") : "";

  return { chave, tpEvento, cStatEvento };
}

/** Devolve ["nota"|"evento"|null, dados|null]. `relPath` é o caminho
 * relativo do arquivo (pasta/zip) usado só como pista de heurística
 * quando a nota não tem <protNFe> (ver parseNfeProc). */
export function processarArquivoXml(xmlText, relPath) {
  let root;
  try {
    root = parseXML(xmlText);
  } catch {
    return [null, null];
  }
  const tag = root.tag;
  if (tag === "nfeProc" || tag === "NFe") return ["nota", parseNfeProc(root, relPath)];
  if (tag === "procEventoNFe" || tag === "eventoNFe") return ["evento", parseEvento(root)];
  return [null, null];
}
