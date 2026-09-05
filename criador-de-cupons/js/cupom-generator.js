// -----------------------------------------------------------------------
// cupom-generator.js — port fiel de CriadorDeCupons/cupom_generator.py.
//
// Ao contrário de cupom-builder.js (que copia um cupom-modelo e só troca
// os campos do número/chave), este módulo monta o cabeçalho de largura
// fixa DO ZERO, campo a campo, seguindo o "Layout Cupom Individual -
// Versão 66". Cada campo tem (nome, tamanho, coluna, tipo N/C) exatamente
// como no arquivo Python original — ver ali os comentários de onde cada
// posição foi confirmada contra cupons reais.
//
// IMPORTANTE — nem todo campo existe no XML da NFC-e. Campos que dependem
// de estado interno do PDV são preenchidos com um valor padrão razoável e
// sempre geram um aviso — os avisos devem ser mostrados ao usuário, nunca
// escondidos, porque são exatamente os pontos que precisam de conferência
// manual.
// -----------------------------------------------------------------------
import { parseXML, localFind, localFindAll, xtext } from "../../assets/js/xml-lite.js";
import { normalizeXmlLayout } from "./cupom-builder.js";

// ---------------------------------------------------------------------
// Helpers de formatação de campo largura-fixa
// ---------------------------------------------------------------------

/** Replica o round-half-to-even ("banker's rounding") do Python: round()
 * no Python NÃO arredonda ,5 sempre pra cima (Math.round do JS arredonda),
 * arredonda pro PAR mais próximo. Como os dois lados fazem a mesma conta
 * em ponto flutuante IEEE754 (double), aplicar a mesma regra de desempate
 * aqui reproduz byte a byte o resultado do Python — importante porque isto
 * é um documento fiscal, não pode divergir por causa de arredondamento. */
function pyRound(x) {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Campo numérico: zero à esquerda, alinhado à direita. */
function N(value, width) {
  let s = String(value);
  if (s.length > width) s = s.slice(s.length - width); // mantém os dígitos menos significativos
  return s.padStart(width, "0");
}

/** Campo caractere: espaços à direita, alinhado à esquerda. */
function C(value, width) {
  let s = String(value);
  if (s.length > width) s = s.slice(0, width);
  return s.padEnd(width, " ");
}

/** Valor monetário em centavos (sem ponto/vírgula), zero à esquerda. */
function cents(value, width) {
  return N(pyRound(value * 100), width);
}

class Builder {
  constructor(totalWidth) {
    this.buf = new Array(totalWidth).fill(" ");
  }
  /** coluna1Indexed: coluna 1-indexada, como no PDF de layout. */
  put(coluna1Indexed, text) {
    const start = coluna1Indexed - 1;
    text = String(text);
    for (let i = 0; i < text.length; i++) {
      const pos = start + i;
      if (pos >= 0 && pos < this.buf.length) this.buf[pos] = text[i];
    }
  }
  render() {
    return this.buf.join("");
  }
}

// ---------------------------------------------------------------------
// Tabelas de apoio
// ---------------------------------------------------------------------

const TPAG_DESCRICAO = {
  "01": "DINHEIRO", "02": "CHEQUE", "03": "CARTAO DE CREDITO", "04": "CARTAO DE DEBITO",
  "05": "CREDITO LOJA", "10": "VALE ALIMENTACAO", "11": "VALE REFEICAO", "12": "VALE PRESENTE",
  "13": "VALE COMBUSTIVEL", "14": "DUPLICATA MERCANTIL", "15": "BOLETO BANCARIO",
  "16": "DEPOSITO BANCARIO", "17": "PIX", "18": "TRANSFERENCIA BANCARIA, CARTEIRA DIGITAL",
  "19": "PROGRAMA DE FIDELIDADE, CASHBACK", "90": "SEM PAGAMENTO", "99": "OUTROS",
};

// "Código Forma Pagto" embutido — cadastro próprio de cada loja (ver nota
// completa no .py original). A tabela "aprendida" pelo usuário na tela
// (localStorage, ver forma-pagto-store.js) tem prioridade sobre esta.
const FORMA_PAGTO_POR_LOJA = {
  "42793042000509": { // Comercial Soares e Freitas Ltda.
    "03": ["0009", "CARTAO CREDITO"],
    "04": ["0008", "CARTAO DEBITO"],
    "17": ["0010", "CARTEIRA DIGITAL"],
  },
};

const TBAND_NOME = {
  "01": "Visa", "02": "Mastercard", "03": "American Express", "04": "Sorocred",
  "05": "Diners Club", "06": "Elo", "07": "Hipercard", "08": "Aura", "09": "Cabal",
  "10": "Alelo", "11": "Banes Card", "12": "CalCard", "13": "Credz", "14": "Discover",
  "15": "GoodCard", "16": "GreenCard", "17": "Hiper", "18": "JCB", "19": "Mais!",
  "20": "MaxVan", "21": "Policard", "22": "RedeCompras", "23": "Sodexo",
  "24": "ValeCard", "25": "Verocheque", "26": "VR", "27": "Ticket", "28": "Outros",
};

const CNPJ_CREDENCIADORA = {
  "01027058000191": "VISANET", // Cielo (nome historico "VisaNet") - confirmado em cupom real
  "01425787000104": "REDE",     // Rede (Redecard)
  "16501555000157": "STONE",
  "08267057000106": "GETNET",
  "08561701000101": "PAGSEGURO",
};

const ICMS_ISENTO = new Set(["40"]);
const ICMS_NAO_TRIBUTADO = new Set(["41", "50", "51"]);
const ICMS_SUBSTITUICAO = new Set(["60"]);
// qualquer outro CST (00,10,20,30,70,90...) é tratado como "tributado" (Txx)

// tPag que representam cartão de verdade (têm bandeira/"a Vista"/"a Prazo").
const TPAG_CARTAO = new Set(["03", "04"]);

// Alíquotas aproximadas de IBPT (Lei 12.741/2012) usadas como estimativa
// fixa — ver nota completa no .py original.
const IBPT_FEDERAL_PCT = 13.45;
const IBPT_ESTADUAL_PCT = 18.0;

// ---------------------------------------------------------------------
// Tabela "aprendida" de forma de pagamento por loja (equivalente ao
// formas_pagamento_lojas.json do lado do .exe — aqui vive no localStorage
// do navegador, por não haver um arquivo/servidor comum entre máquinas).
// ---------------------------------------------------------------------

const LEARNED_KEY = "criadorDeCupons.formasPagamentoLojas";

function loadLearnedFormasPagto() {
  try {
    const raw = localStorage.getItem(LEARNED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLearnedFormaPagto(cnpj, tpag, codigo, descricao) {
  try {
    const raw = loadLearnedFormasPagto();
    raw[cnpj] = raw[cnpj] || {};
    raw[cnpj][tpag] = { codigo, descricao };
    localStorage.setItem(LEARNED_KEY, JSON.stringify(raw));
    return null;
  } catch (e) {
    return String(e && e.message ? e.message : e);
  }
}

function formaPagtoLookup(cnpj, tpag) {
  const learned = loadLearnedFormasPagto();
  if (learned[cnpj] && learned[cnpj][tpag]) {
    const v = learned[cnpj][tpag];
    return [v.codigo, v.descricao];
  }
  if (FORMA_PAGTO_POR_LOJA[cnpj] && FORMA_PAGTO_POR_LOJA[cnpj][tpag]) {
    return FORMA_PAGTO_POR_LOJA[cnpj][tpag];
  }
  return null;
}

// ---------------------------------------------------------------------
// Parsing do XML
// ---------------------------------------------------------------------

function localFloat(elem, path, dflt = "0") {
  const s = xtext(elem, path, dflt) || dflt;
  const v = parseFloat(s);
  return Number.isNaN(v) ? 0 : v;
}

function grupoValor(imposto, grupo, tag, dflt = 0.0) {
  const g = imposto ? localFind(imposto, grupo) : null;
  if (!g) return dflt;
  for (const child of g.children) {
    const e = localFind(child, tag);
    if (e && e.text && e.text.trim()) {
      const v = parseFloat(e.text);
      return Number.isNaN(v) ? dflt : v;
    }
  }
  return dflt;
}

function grupoCst(imposto, grupo) {
  const g = imposto ? localFind(imposto, grupo) : null;
  if (!g) return "";
  for (const child of g.children) {
    const e = localFind(child, "CST");
    if (e && e.text && e.text.trim()) return e.text.trim();
  }
  return "";
}

export function parseNFe(xmlText) {
  xmlText = xmlText.trim();
  if (!xmlText) {
    throw new Error("Cole o XML da NFC-e antes de gerar.");
  }

  let root;
  try {
    root = parseXML(xmlText);
  } catch (e) {
    throw new Error(`O XML colado não é um XML válido (${e.message}). Confira se copiou o texto inteiro.`);
  }

  let infNFe = localFind(root, "NFe/infNFe");
  if (!infNFe) infNFe = localFind(root, "infNFe");
  if (!infNFe && root.tag === "infNFe") infNFe = root;
  if (!infNFe) {
    throw new Error("Não encontrei <infNFe> no XML colado - confira se é o XML completo da NFC-e.");
  }

  const chaveAttr = infNFe.attrs.Id || "";
  const mChave = /^NFe(\d{44})/.exec(chaveAttr);
  const chave = mChave ? mChave[1] : "";
  if (!chave) {
    throw new Error("Não encontrei a chave de acesso (44 dígitos) no atributo Id de <infNFe>.");
  }

  const ide = localFind(infNFe, "ide");
  const serie = xtext(ide, "serie");
  const nNF = xtext(ide, "nNF");
  const dhEmi = xtext(ide, "dhEmi");

  const emit = localFind(infNFe, "emit");
  const cnpjEmit = xtext(emit, "CNPJ");
  const xNomeEmit = xtext(emit, "xNome");

  const dest = localFind(infNFe, "dest");
  let destDoc = null;
  if (dest) destDoc = xtext(dest, "CPF") || xtext(dest, "CNPJ") || null;

  const itens = [];
  for (const det of localFindAll(infNFe, "det")) {
    const prod = localFind(det, "prod");
    const imposto = localFind(det, "imposto");
    let icmsCst = null;
    let picms = 0.0;
    let predbc = 0.0;
    if (imposto) {
      const icms = localFind(imposto, "ICMS");
      if (icms) {
        for (const child of icms.children) {
          const cstE = localFind(child, "CST");
          if (cstE && cstE.text && cstE.text.trim()) icmsCst = cstE.text.trim();
          const picmsE = localFind(child, "pICMS");
          if (picmsE && picmsE.text) {
            const v = parseFloat(picmsE.text);
            if (!Number.isNaN(v)) picms = v;
          }
          const predbcE = localFind(child, "pRedBC");
          if (predbcE && predbcE.text) {
            const v = parseFloat(predbcE.text);
            if (!Number.isNaN(v)) predbc = v;
          }
        }
      }
    }
    // Alíquota efetiva: quando há redução de base de cálculo (pRedBC), o
    // cupom usa a alíquota JÁ REDUZIDA na Situação Tributária e no
    // "registrador" (ver nota completa no .py original).
    const picmsEfetiva = predbc ? picms * (1 - predbc / 100) : picms;
    let vItem = localFloat(det, "vItem", "0");

    let vicms = 0.0;
    if (imposto) {
      const icms = localFind(imposto, "ICMS");
      if (icms) {
        for (const child of icms.children) {
          const e = localFind(child, "vICMS");
          if (e && e.text) {
            const v = parseFloat(e.text);
            if (!Number.isNaN(v)) vicms = v;
          }
        }
      }
    }

    itens.push({
      nItem: det.attrs.nItem || "",
      cProd: xtext(prod, "cProd"),
      cEAN: xtext(prod, "cEAN"),
      xProd: xtext(prod, "xProd"),
      NCM: xtext(prod, "NCM"),
      CEST: xtext(prod, "CEST"),
      CFOP: xtext(prod, "CFOP"),
      uCom: xtext(prod, "uCom"),
      qCom: localFloat(prod, "qCom", "0"),
      vUnCom: localFloat(prod, "vUnCom", "0"),
      vProd: localFloat(prod, "vProd", "0"),
      vItem,
      icms_cst: icmsCst,
      picms,
      picms_efetiva: picmsEfetiva,
      vicms,
      pis_cst: grupoCst(imposto, "PIS"),
      ppis: grupoValor(imposto, "PIS", "pPIS"),
      vpis: grupoValor(imposto, "PIS", "vPIS"),
      cofins_cst: grupoCst(imposto, "COFINS"),
      pcofins: grupoValor(imposto, "COFINS", "pCOFINS"),
      vcofins: grupoValor(imposto, "COFINS", "vCOFINS"),
    });
  }
  if (!itens.length) {
    throw new Error("Não encontrei nenhum item (<det>) no XML.");
  }

  const pagamentos = [];
  const pagEl = localFind(infNFe, "pag");
  if (pagEl) {
    for (const detPag of localFindAll(pagEl, "detPag")) {
      const tPag = xtext(detPag, "tPag");
      const vPag = localFloat(detPag, "vPag", "0");
      const indPag = xtext(detPag, "indPag") || null;
      const card = localFind(detPag, "card");
      let cnpjCred = null, tband = null, caut = null, tpintegra = null;
      if (card) {
        tpintegra = xtext(card, "tpIntegra") || null;
        cnpjCred = xtext(card, "CNPJ") || null;
        tband = xtext(card, "tBand") || null;
        caut = xtext(card, "cAut") || null;
      }
      pagamentos.push({
        tPag, vPag, indPag, tpIntegra: tpintegra,
        cnpj_credenciadora: cnpjCred, tBand: tband, cAut: caut,
      });
    }
  }
  const vTroco = pagEl ? localFloat(pagEl, "vTroco", "0") : 0.0;

  const total = localFind(infNFe, "total");
  const icmsTot = total ? localFind(total, "ICMSTot") : null;
  const vNF = icmsTot ? localFloat(icmsTot, "vNF", "0") : 0.0;

  const infAdic = localFind(infNFe, "infAdic");
  const infCpl = xtext(infAdic, "infCpl");

  let m = /SEQ\.?\s*CNC:?\s*(\d+)/i.exec(infCpl);
  const seqcnc = m ? m[1].padStart(6, "0") : null;
  m = /PDV:?\s*(\d+)/i.exec(infCpl);
  const pdv = m ? m[1] : null;
  m = /Op\.?:?\s*(\d+)\s*-\s*([^\n]*?)(?:Versao|Obrigado|Valor Aprox|$)/i.exec(infCpl);
  const opCodigo = m ? m[1] : null;
  const opNome = m ? m[2].trim() : null;
  m = /Versao\.*:?\s*([\d.]+)/i.exec(infCpl);
  const versaoPdv = m ? m[1] : null;

  const dhDate = dhEmi ? dhEmi.slice(0, 10).replace(/-/g, "") : "";
  const dhHhmm = dhEmi.length >= 16 ? dhEmi.slice(11, 16).replace(/:/g, "") : "";
  const dhHhmmss = dhEmi.length >= 19 ? dhEmi.slice(11, 19).replace(/:/g, "") : "";

  const data = {
    chave, serie, nNF, dhEmi, cnpj_emit: cnpjEmit, xNome_emit: xNomeEmit, dest_doc: destDoc,
    itens, pagamentos, vNF, vTroco, infCpl, seqcnc, pdv,
    op_codigo: opCodigo, op_nome: opNome, versao_pdv: versaoPdv,
    warnings: [],
    dh_date: dhDate, dh_hhmm: dhHhmm, dh_hhmmss: dhHhmmss,
  };

  if (!data.seqcnc) data.warnings.push("Não encontrei 'SEQ. CNC:' no infCpl - o número do cupom ficará em branco.");
  if (!data.pdv) data.warnings.push("Não encontrei 'PDV:' no infCpl - o número do PDV ficará em branco.");
  if (!data.op_codigo) data.warnings.push("Não encontrei 'Op.: <código>-<nome>' no infCpl - operador ficará em branco.");

  return data;
}

// ---------------------------------------------------------------------
// Construção dos registros
// ---------------------------------------------------------------------

function sitTrib(item, warnings) {
  const cst = item.icms_cst || "";
  if (ICMS_ISENTO.has(cst)) return "I  ";
  if (ICMS_NAO_TRIBUTADO.has(cst)) return "N  ";
  if (ICMS_SUBSTITUICAO.has(cst)) return "F  ";
  const aliq = pyRound(item.picms_efetiva);
  if (!cst) {
    warnings.push(
      `Item '${item.xProd}': não achei o CST do ICMS - assumi 'tributado' para a Situação ` +
      `Tributária do cupom. Confira manualmente.`
    );
  }
  return `T${String(aliq).padStart(2, "0")}`;
}

function registradorAliq(item, warnings) {
  const cst = item.icms_cst || "";
  if (ICMS_ISENTO.has(cst)) return C("I1", 7);
  if (ICMS_NAO_TRIBUTADO.has(cst)) return C("N1", 7);
  if (ICMS_SUBSTITUICAO.has(cst)) return C("F1", 7);
  const aliq = pyRound(item.picms_efetiva * 100);
  warnings.push(
    `Item '${item.xProd}': o número do 'registrador' fiscal (2 primeiros dígitos deste campo) é ` +
    `configurado por loja e não existe no XML - usei '01' como valor padrão. Se o cupom real ` +
    `usar outro número de registrador para esta alíquota, ajuste manualmente.`
  );
  return `01T${String(aliq).padStart(4, "0")}`;
}

function buildRegistro51(data) {
  const b = new Builder(54);
  b.put(1, "51");
  b.put(3, "NFCE");
  b.put(7, data.chave);
  b.put(51, "_");
  const pdv = (data.pdv || "").padStart(3, "0").slice(0, 3);
  b.put(52, pdv);
  return b.render();
}

function buildRegistro00(data, warnings) {
  const b = new Builder(657);
  b.put(1, "00");
  b.put(3, data.dest_doc ? C(data.dest_doc, 14) : N(0, 14));
  b.put(17, N(0, 3));
  b.put(20, N(0, 9));
  b.put(29, cents(data.vNF, 12));
  b.put(41, N(data.itens.length, 3));
  b.put(44, N(0, 9));
  b.put(53, cents(data.vTroco, 9));
  b.put(62, N(0, 6));
  b.put(68, N(data.dh_date, 8));
  b.put(76, N(data.dh_hhmm, 4));
  const pdv2 = (data.pdv || "").padStart(3, "0").slice(-2);
  b.put(80, N(pdv2, 2));
  b.put(82, N(0, 9));
  b.put(91, "67");
  b.put(93, N(0, 19));
  b.put(112, N(0, 2));
  b.put(114, "N");
  b.put(115, C(data.op_codigo || "", 15));
  b.put(143, C("NFCE", 15));
  b.put(158, C("NFCE", 20));
  b.put(178, N(0, 9));
  b.put(187, C(data.versao_pdv || "", 6));
  b.put(193, C(data.op_nome || "", 15));
  b.put(228, C("", 40));
  b.put(268, N(data.dh_date, 8));
  b.put(276, N(0, 14));
  b.put(290, N(0, 10));
  b.put(300, C("", 19));
  b.put(319, N(0, 12));
  b.put(331, N(0, 9));
  b.put(340, "N");
  b.put(341, N(data.seqcnc || "0", 6));
  warnings.push(
    "'CCF do Cupom Fiscal' (posição 341) é um contador interno do PDV que não existe no XML - " +
    "usei o próprio número do cupom (SEQ. CNC) como aproximação. No cupom real esse número pode " +
    "ser ligeiramente diferente."
  );
  b.put(347, N(data.dh_hhmmss, 6));
  b.put(353, N(data.cnpj_emit, 14));
  b.put(407, C("", 11));
  b.put(476, N(0, 11));
  b.put(487, N(0, 9));
  b.put(496, N(0, 11));
  b.put(507, N(0, 14));
  b.put(521, N(0, 11));
  b.put(546, N(0, 10));
  b.put(606, "N");
  b.put(607, "N");
  return b.render();
}

function buildRegistro02(item, data, warnings) {
  // 671, não 668: há mais 3 posições depois de "Código do Garçom" que não
  // aparecem documentadas no PDF, mas existem em todo cupom real visto até
  // agora (sempre zeros) - mantidas como reserva/zero.
  const b = new Builder(671);
  b.put(1, "02");
  const serieEcf = "AV" + N(data.cnpj_emit, 15) + C(data.pdv || "", 3);
  b.put(3, C(serieEcf, 25));
  b.put(28, N(data.seqcnc || "0", 6));
  b.put(34, N(item.nItem, 3));
  const eanDigits = /^\d+$/.test(item.cEAN) && item.cEAN.length <= 14 ? item.cEAN : "";
  const codEan = eanDigits ? N(eanDigits, 14) : N(item.cProd, 14);
  b.put(37, codEan);
  b.put(51, N(pyRound(item.qCom * 1000), 8));
  b.put(59, N(pyRound(item.vUnCom * 1000), 10));
  b.put(69, cents(item.vItem || item.vProd, 13));
  b.put(82, C(sitTrib(item, warnings), 3));
  b.put(85, N(data.dh_date, 8));
  const pdv2 = (data.pdv || "").padStart(3, "0").slice(-2);
  b.put(93, N(pdv2, 2));
  b.put(95, "P");
  b.put(136, N(pyRound(item.picms * 100), 4));
  b.put(140, N(pyRound(item.picms_efetiva * 100), 4));
  b.put(144, N(item.cProd, 6));
  // "Código alternativo": ver nota completa no .py original sobre a
  // convenção (EAN sem zero à esquerda, ou zeros sem EAN).
  const ean = eanDigits;
  const alt = ean ? (ean.length === 14 && ean.startsWith("0") ? ean.slice(1) : ean) : "0".repeat(13);
  b.put(150, C(alt, 14));
  b.put(164, N(pyRound(item.vUnCom * 1000), 10));
  b.put(174, N(0, 10));
  b.put(184, "N");
  b.put(185, C(registradorAliq(item, warnings), 7));
  b.put(196, N(0, 10));
  b.put(206, C("", 10));
  b.put(216, C("", 30));
  b.put(246, N(pyRound(IBPT_FEDERAL_PCT * 100), 4));
  b.put(250, cents((item.vProd * IBPT_FEDERAL_PCT) / 100, 10));
  b.put(260, "N");
  b.put(261, "N");
  b.put(262, N(0, 6));
  b.put(268, N(0, 6));
  b.put(274, C(item.uCom, 3));
  b.put(277, N(0, 10));
  b.put(287, C(item.xProd, 20));
  b.put(307, N(1, 4));
  b.put(311, " ");
  b.put(312, C("", 4));
  b.put(316, C("", 10));
  b.put(326, C("", 30));
  b.put(356, N(0, 10));
  b.put(366, N(0, 10));
  b.put(376, cents(item.vProd, 10));
  b.put(386, cents(item.vicms, 10));
  b.put(396, cents(item.vProd, 10));
  b.put(406, N(pyRound(item.ppis * 100), 4));
  b.put(410, cents(item.vpis, 10));
  b.put(420, N(pyRound(item.pcofins * 100), 4));
  b.put(424, cents(item.vcofins, 10));
  b.put(434, C(item.CFOP, 4));
  b.put(438, C(item.pis_cst, 2));
  b.put(440, C(item.cofins_cst, 2));
  b.put(442, C(item.NCM, 8));
  b.put(450, C(item.CEST, 7));
  b.put(457, C("", 6));
  b.put(463, C("", 2));
  b.put(465, C("", 50));
  b.put(515, N(0, 20));
  b.put(535, N(pyRound(IBPT_ESTADUAL_PCT * 100), 4));
  b.put(539, cents((item.vProd * IBPT_ESTADUAL_PCT) / 100, 10));
  b.put(549, N(0, 4));
  b.put(553, N(0, 10));
  // Códigos de departamento/categoria/subcategoria/segmento/subsegmento e
  // família de preços vêm do cadastro de produtos da loja (não existem no
  // XML) - ficam zerados.
  b.put(563, N(0, 3));
  b.put(566, N(0, 3));
  b.put(569, N(0, 3));
  b.put(572, N(0, 3));
  b.put(575, N(0, 3));
  b.put(578, N(0, 5));
  b.put(583, C("", 50));
  b.put(633, C("", 14));
  b.put(647, "N");
  b.put(648, N(0, 12));
  b.put(660, N(0, 3));
  b.put(663, N(0, 6));
  b.put(669, N(0, 3));
  return b.render();
}

function titleCase(s) {
  return s.replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function modalidadeTexto(pg, desc) {
  // \bDe\b (só a palavra "De" isolada) - um replace ingênuo também trocaria
  // o "De" dentro de "Debito", virando "debito" (bug real já visto).
  const base = titleCase(desc).replace(/\bDe\b/g, "de");
  if (!TPAG_CARTAO.has(pg.tPag)) return base;
  const sufixo = pg.indPag === "1" ? "a Prazo" : "a Vista";
  return `${base} ${sufixo}`;
}

function produtoSitef(pg, modalidadeTextoStr, warnings) {
  const rede = CNPJ_CREDENCIADORA[pg.cnpj_credenciadora || ""] || "";
  if (pg.cnpj_credenciadora && !rede) {
    warnings.push(
      `Pagamento: não reconheço o CNPJ da credenciadora (${pg.cnpj_credenciadora}) - o nome da ` +
      `'rede autorizadora' no cupom ficará em branco (não existe uma tabela oficial pra isso, ` +
      `só CNPJs de grandes adquirentes que já confirmamos).`
    );
  }
  let produto = "";
  if (pg.tPag === "17") {
    produto = "PIX";
  } else if (pg.tBand) {
    const bandeiraNome = TBAND_NOME[pg.tBand];
    if (bandeiraNome) {
      const sufixo = pg.tPag === "04" ? "Debito" : "Credito";
      produto = `${bandeiraNome} ${sufixo}`;
    } else {
      warnings.push(`Pagamento: código de bandeira tBand=${pg.tBand} não está na minha tabela.`);
    }
  }
  return C(modalidadeTextoStr, 50) + C(rede, 30) + C(produto, 30);
}

function buildRegistro01(pg, data, warnings, formaPagtoManual, aprendidos) {
  const b = new Builder(921);
  b.put(1, "01");
  b.put(3, N(0, 3));
  let desc = TPAG_DESCRICAO[pg.tPag];
  if (!desc) {
    desc = "OUTROS";
    warnings.push(`Forma de pagamento tPag=${pg.tPag} não está na minha tabela - usei 'OUTROS'.`);
  }
  const conhecido = formaPagtoLookup(data.cnpj_emit, pg.tPag);
  let codigoForma, descCurta;
  if (conhecido) {
    [codigoForma, descCurta] = conhecido;
  } else if (formaPagtoManual && formaPagtoManual[0]) {
    codigoForma = formaPagtoManual[0];
    descCurta = formaPagtoManual[1] || desc;
    if (aprendidos) aprendidos.push([data.cnpj_emit, pg.tPag, codigoForma, descCurta]);
  } else {
    codigoForma = "0000";
    descCurta = desc;
    warnings.push(
      `'Código Forma Pagto' (posição 26) ficou zerado para tPag=${pg.tPag} (${desc}) - não conheço ` +
      `o código de forma de pagamento cadastrado nesta loja (CNPJ ${data.cnpj_emit}). Um código ` +
      `zerado pode causar erro de 'forma de pagamento não vinculada' no sistema que recebe o ` +
      `cupom - se souber o código certo desta loja, preencha 'Código forma pagto' na tela e ` +
      `gere de novo; o programa guarda esse código pra usar sozinho da próxima vez.`
    );
  }
  b.put(26, N(codigoForma, 4));
  b.put(30, C(descCurta, 30));
  b.put(60, N(data.dh_date, 8));
  b.put(68, cents(pg.vPag, 9));
  b.put(147, "01");
  b.put(402, N(0, 6));
  b.put(408, N(0, 10));
  const isCartao = pg.tpIntegra !== null && pg.tpIntegra !== undefined;
  if (isCartao) {
    const modalidadeTextoStr = modalidadeTexto(pg, desc);
    b.put(169, cents(pg.vPag, 11));
    b.put(180, C(modalidadeTextoStr, 50));
    b.put(257, C(pg.cAut || "", 15));
    b.put(272, produtoSitef(pg, modalidadeTextoStr, warnings));
    warnings.push(
      `Pagamento tPag=${pg.tPag} (${desc}): NSU (Sitef/Host) e BIN do cartão não existem no XML da ` +
      `NFC-e - só ficam disponíveis no sistema de TEF do PDV - e ficaram em branco. O código de ` +
      `autorização veio do XML (<cAut>) e a bandeira/rede vieram de tabelas conhecidas (tBand e ` +
      `CNPJ da credenciadora), quando reconhecidas.`
    );
    if (pg.tpIntegra === "1") {
      warnings.push(
        "Este pagamento é integrado (TEF) - o cupom real normalmente também tem uma linha de " +
        "registro 76 (Parcelamento TEF) logo antes do FIM; este programa já gera essa linha."
      );
    }
  }
  b.put(472, "N");
  b.put(473, "N");
  return b.render();
}

function buildRegistro76(pg, warnings) {
  const b = new Builder(412);
  b.put(1, "76");
  b.put(3, "01");
  const desc = TPAG_DESCRICAO[pg.tPag] || "OUTROS";
  const modalidadeTextoStr = modalidadeTexto(pg, desc);
  b.put(25, cents(pg.vPag, 11));
  b.put(36, C(modalidadeTextoStr, 50));
  b.put(113, C(pg.cAut || "", 15));
  b.put(128, produtoSitef(pg, modalidadeTextoStr, warnings));
  b.put(408, N(0, 5));
  return b.render();
}

function buildRegistro07() {
  return "07" + N(0, 11);
}

export function buildCupomCompleto(xmlText, { specialLine = null, loja = null, codigoFormaPagto = null, descFormaPagto = null } = {}) {
  const warnings = [];
  const data = parseNFe(xmlText);
  warnings.push(...data.warnings);

  const formaPagtoManual = codigoFormaPagto ? [codigoFormaPagto, descFormaPagto] : null;
  const aprendidos = [];

  const lines = [];
  if (specialLine) lines.push(specialLine);

  lines.push(buildRegistro51(data));
  lines.push(buildRegistro00(data, warnings));
  for (const pg of data.pagamentos) {
    lines.push(buildRegistro01(pg, data, warnings, formaPagtoManual, aprendidos));
  }
  if (!data.pagamentos.length) {
    warnings.push("O XML não tem nenhum <detPag> em <pag> - nenhuma linha de pagamento (01) foi gerada.");
  }
  for (const item of data.itens) {
    lines.push(buildRegistro02(item, data, warnings));
  }
  if (data.itens.length) {
    warnings.push(
      "Nos itens: os códigos de departamento/categoria/subcategoria/segmento e a descrição " +
      "resumida do produto vêm do cadastro de produtos da loja, que não existe no XML da NFC-e - " +
      "ficaram zerados. Os percentuais de IBPT usados (Federal e Estadual) são uma aproximação fixa " +
      "por loja observada em cupons reais - confirmamos que o percentual muda de loja pra loja " +
      "(13,45%/18,00% numa loja, 15,65%/18,00% noutra), então não é a tabela oficial de IBPT por " +
      "NCM e pode estar errado para lojas que ainda não vimos. O campo 'código alternativo' do " +
      "item também varia por loja - usamos EAN sem zero à esquerda (ou zero, sem EAN), que é o " +
      "padrão confirmado em mais lojas até agora; uma loja específica que já vimos usa o código " +
      "do produto em vez disso."
    );
  }
  lines.push(buildRegistro07());
  for (const pg of data.pagamentos) {
    if (pg.tpIntegra === "1") lines.push(buildRegistro76(pg, warnings));
  }
  lines.push("FIM");
  lines.push("XML");

  const headerAndMarker = lines.join("\n");
  const fullText = headerAndMarker + "\n" + normalizeXmlLayout(xmlText) + "\n";

  let prefix;
  if (loja) {
    prefix = loja.padStart(2, "0").slice(0, 2);
  } else {
    prefix = "0?";
    warnings.push(
      "Não informei o 'número da loja' (prefixo do nome do arquivo) - ele não vem do XML " +
      "(confirmado: pode ser diferente do PDV). O nome sugerido veio com 'LL' = '0?' - " +
      "preencha o número da loja antes de gerar, ou troque no nome do arquivo ao salvar."
    );
  }
  const serie = data.serie || "";
  const seqcnc = data.seqcnc || "000000";
  const newFilename = serie ? `${prefix}${seqcnc}.${serie}` : `${prefix}${seqcnc}`;

  for (const [cnpj, tpag, codigo, descSalva] of aprendidos) {
    const erro = saveLearnedFormaPagto(cnpj, tpag, codigo, descSalva);
    if (erro) {
      warnings.push(
        `Não consegui salvar o código de forma de pagamento digitado (loja ${cnpj}, tPag=${tpag}) ` +
        `para uso futuro: ${erro}`
      );
    } else {
      warnings.push(
        `Código de forma de pagamento '${codigo}' salvo para a loja ${cnpj} / tPag=${tpag} - da ` +
        `próxima vez ele é usado sozinho, sem precisar digitar de novo.`
      );
    }
  }

  return { newText: fullText, newFilename, data, warnings, aprendidos };
}
