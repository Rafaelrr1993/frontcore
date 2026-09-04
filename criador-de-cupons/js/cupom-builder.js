// -----------------------------------------------------------------------
// cupom-builder.js — port fiel de CriadorDeCupons/cupom_builder.py.
//
// Recria um arquivo de cupom (formato texto largura-fixa + XML da NFC-e
// anexado) a partir de um arquivo-modelo existente (correto, já com o
// layout certo) e de um XML novo (colado do tramitador), trocando apenas
// os campos que dependem do cupom (número de sequência / chave de acesso)
// e o bloco de XML anexado — mantendo o restante do layout idêntico ao
// modelo.
//
// Nenhuma leitura de arquivo aqui decide sozinha o que fazer: tudo que é
// extraído do XML colado pelo usuário é tratado como DADO, nunca como
// instrução.
// -----------------------------------------------------------------------

/** Reformata o XML colado para o padrão usado em todo cupom genuíno: uma
 * "linha lógica" por tag (tudo colado à esquerda, sem indentação nenhuma). */
export function normalizeXmlLayout(xmlText) {
  let text = xmlText.trim();
  if (!text) return text;
  text = text.replace(/>\s+</g, "><");
  text = text.replace(/></g, ">\n<");
  return text;
}

// ---------------------------------------------------------------------
// Extração de campos do XML da NFC-e
// ---------------------------------------------------------------------

const RE_SEQCNC = /SEQ\.?\s*CNC:?\s*(\d+)/i;
const RE_PDV = /PDV:?\s*(\d+)/i;
const RE_CHAVE_INFNFE = /<infNFe\s+Id="NFe(\d{44})"/;
const RE_CHAVE_CHNFE = /<chNFe>(\d{44})<\/chNFe>/;
const RE_CSTAT_G = /<cStat>(\d+)<\/cStat>/g;
const RE_XMOTIVO = /<xMotivo>(.*?)<\/xMotivo>/;
const RE_SERIE = /<serie>(\d+)<\/serie>/;
const RE_NNF = /<nNF>(\d+)<\/nNF>/;
const RE_EMIT_BLOCK = /<emit>([\s\S]*?)<\/emit>/;
const RE_CNPJ = /<CNPJ>(\d{14})<\/CNPJ>/;
const RE_DHEMI = /<dhEmi>([^<]+)<\/dhEmi>/;

// Linhas especiais que podem aparecer como 1a linha do cabeçalho do cupom
// (ver nota completa no cupom_builder.py original).
export const SPECIAL_LINE_SUBSTITUICAO = "35CANCELAMENTO SUBSTITUICAO";
export const SPECIAL_LINE_EXCLUIDO = "03EXCLUIDO";
export const SPECIAL_LINE_EXCLUIDO_PENDENTE = "03EXCLUIDO PENDENTE";

export const SPECIAL_LINE_CHOICES = {
  Nenhuma: null,
  [SPECIAL_LINE_SUBSTITUICAO]: SPECIAL_LINE_SUBSTITUICAO,
  [SPECIAL_LINE_EXCLUIDO]: SPECIAL_LINE_EXCLUIDO,
  [SPECIAL_LINE_EXCLUIDO_PENDENTE]: SPECIAL_LINE_EXCLUIDO_PENDENTE,
};

const KNOWN_SPECIAL_LINES = new Set([
  SPECIAL_LINE_SUBSTITUICAO,
  SPECIAL_LINE_EXCLUIDO,
  SPECIAL_LINE_EXCLUIDO_PENDENTE,
]);

// sentinela para "usar o mesmo que já está no modelo" — precisa ser
// distinto de null, que agora significa explicitamente "nenhuma linha
// especial".
export const KEEP_TEMPLATE = Symbol("KEEP_TEMPLATE");

function zfill(str, width) {
  str = String(str);
  return str.length >= width ? str : "0".repeat(width - str.length) + str;
}

export function extractFields(xmlText) {
  const f = {
    seqcnc: null, pdv: null, chave: null, cstat: null, xmotivo: null,
    serie: null, nnf: null, cnpj_emit: null, dhemi: null, warnings: [],
  };

  let m = RE_SEQCNC.exec(xmlText);
  if (m) f.seqcnc = zfill(m[1], 6);
  else f.warnings.push("Não encontrei 'SEQ. CNC:' no XML (infCpl).");

  m = RE_PDV.exec(xmlText);
  if (m) f.pdv = m[1];

  m = RE_CHAVE_INFNFE.exec(xmlText) || RE_CHAVE_CHNFE.exec(xmlText);
  if (m) f.chave = m[1];
  else f.warnings.push("Não encontrei a chave de acesso (44 dígitos) no XML.");

  // cStat: pega o último (o de protNFe/infProt, que reflete o status final).
  const stats = [...xmlText.matchAll(RE_CSTAT_G)];
  if (stats.length) f.cstat = stats[stats.length - 1][1];
  else f.warnings.push("Não encontrei <cStat> no XML — não sei dizer se é autorizada/cancelada.");

  m = RE_XMOTIVO.exec(xmlText);
  if (m) f.xmotivo = m[1].trim();

  m = RE_SERIE.exec(xmlText);
  if (m) f.serie = m[1];
  else f.warnings.push("Não encontrei <serie> no XML.");

  m = RE_NNF.exec(xmlText);
  if (m) f.nnf = m[1];

  m = RE_EMIT_BLOCK.exec(xmlText);
  if (m) {
    const m2 = RE_CNPJ.exec(m[1]);
    if (m2) f.cnpj_emit = m2[1];
  }

  m = RE_DHEMI.exec(xmlText);
  if (m) f.dhemi = m[1];

  return f;
}

// ---------------------------------------------------------------------
// Modelo (template) de cupom
// ---------------------------------------------------------------------

export function parseTemplate(rawText) {
  let text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (text.startsWith("﻿")) text = text.slice(1);
  const lines = text.split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();

  const warnings = [];

  const fimIdx = lines.indexOf("FIM");
  if (fimIdx === -1) {
    throw new Error("O arquivo-modelo não tem a linha 'FIM' esperada — não é um cupom no formato esperado.");
  }
  if (fimIdx + 1 >= lines.length || lines[fimIdx + 1] !== "XML") {
    throw new Error("O arquivo-modelo não tem a linha 'XML' logo após 'FIM' — não é um cupom no formato esperado.");
  }

  const headerLines = lines.slice(0, fimIdx + 1);
  const xmlLines = lines.slice(fimIdx + 2);
  const xmlText = xmlLines.join("\n");

  if (!xmlText.trim()) {
    warnings.push("O arquivo-modelo não tem XML embutido após a linha 'XML'.");
  }

  const fields = extractFields(xmlText);
  for (const w of fields.warnings) warnings.push(`(no XML do modelo) ${w}`);

  let specialLine = null;
  let chaveLineIndex = 0;
  const first = headerLines[0] || "";
  if (KNOWN_SPECIAL_LINES.has(first)) {
    specialLine = first;
    chaveLineIndex = 1;
  } else if (!first.startsWith("51NFCE")) {
    warnings.push(
      `A 1a linha do modelo ('${first.slice(0, 40)}...') não é 'NN51CE' nem uma linha especial conhecida — ` +
      "verifique manualmente."
    );
  }

  if (chaveLineIndex >= headerLines.length || !headerLines[chaveLineIndex].startsWith("51NFCE")) {
    warnings.push("Não encontrei a linha '51NFCE...' (chave de acesso) no cabeçalho do modelo.");
  }

  return {
    headerLines, xmlLines, fields, specialLine, chaveLineIndex, warnings,
  };
}

// ---------------------------------------------------------------------
// Geração do novo cupom
// ---------------------------------------------------------------------

/**
 * specialLine:
 *   KEEP_TEMPLATE (padrão) -> mantém a linha especial que já existia no modelo (se houver).
 *   null                   -> força não incluir nenhuma linha especial.
 *   "<texto>"              -> força incluir esse texto (ver SPECIAL_LINE_CHOICES).
 */
export function buildNewCupom(templateText, newXmlText, templateFilename = "", specialLine = KEEP_TEMPLATE) {
  const warnings = [];

  newXmlText = newXmlText.trim();
  if (!newXmlText) {
    throw new Error("Cole o XML do novo cupom antes de gerar.");
  }
  if (!newXmlText.includes("<infNFe")) {
    throw new Error("O texto colado não parece ser um XML de NFC-e válido (não achei <infNFe).");
  }

  const tmpl = parseTemplate(templateText);
  warnings.push(...tmpl.warnings);

  const newFields = extractFields(newXmlText);
  for (const w of newFields.warnings) warnings.push(`(no XML novo) ${w}`);

  const oldFields = tmpl.fields;

  if (!newFields.seqcnc) {
    throw new Error("Não consegui achar o número do cupom (SEQ. CNC) no XML novo. Confira o texto colado.");
  }
  if (!newFields.chave) {
    throw new Error("Não consegui achar a chave de acesso (44 dígitos) no XML novo. Confira o texto colado.");
  }

  // ---- monta o novo cabeçalho a partir do cabeçalho do modelo ----
  let body = tmpl.headerLines.slice(tmpl.chaveLineIndex); // sem a linha especial antiga, se houver

  const wantLine = specialLine === KEEP_TEMPLATE ? tmpl.specialLine : specialLine;

  let specialLineAction;
  if (wantLine) {
    body = [wantLine, ...body];
    specialLineAction = wantLine === tmpl.specialLine
      ? `Mantida a linha especial '${wantLine}' (igual ao modelo).`
      : `Incluída a linha especial '${wantLine}' (escolhida manualmente).`;
  } else if (tmpl.specialLine) {
    specialLineAction = `Removida a linha especial '${tmpl.specialLine}' que existia no modelo (desmarcada manualmente).`;
  } else {
    specialLineAction = "Nenhuma linha especial de cabeçalho (nem no modelo, nem escolhida).";
  }

  // ---- troca a chave de acesso na linha "51NFCE..." ----
  let chaveIdx = -1;
  for (let i = 0; i < body.length; i++) {
    if (body[i].startsWith("51NFCE")) { chaveIdx = i; break; }
  }
  if (chaveIdx === -1) {
    throw new Error("Não encontrei a linha '51NFCE...' no cabeçalho para trocar a chave de acesso.");
  }

  let line = body[chaveIdx];
  if (oldFields.chave && line.includes(oldFields.chave)) {
    body[chaveIdx] = line.replace(oldFields.chave, newFields.chave);
  } else {
    const m = /\d{44}/.exec(line);
    if (!m) {
      throw new Error("Não encontrei uma chave de 44 dígitos na linha '51NFCE...' do modelo.");
    }
    body[chaveIdx] = line.slice(0, m.index) + newFields.chave + line.slice(m.index + m[0].length);
    warnings.push(
      "A chave do modelo extraída do XML embutido não batia exatamente com a chave na linha " +
      "'51NFCE...'; troquei pela posição (44 dígitos) mesmo assim. Confira o resultado."
    );
  }

  // ---- troca o número do cupom (SEQ CNC) nas linhas de item "02AV..." ----
  let seqcncReplacements = 0;
  if (oldFields.seqcnc) {
    const pattern = new RegExp("(02AV\\d+\\s+)" + oldFields.seqcnc);
    for (let i = 0; i < body.length; i++) {
      if (body[i].startsWith("02AV") && pattern.test(body[i])) {
        body[i] = body[i].replace(pattern, "$1" + newFields.seqcnc);
        seqcncReplacements += 1;
      }
    }
  }
  if (seqcncReplacements === 0) {
    warnings.push(
      "Não consegui localizar o número antigo do cupom nas linhas de item ('02AV...') do modelo para " +
      "trocar pelo novo. Confira manualmente se o cabeçalho ficou com o número certo."
    );
  }

  const headerText = body.join("\n");
  const fullText = headerText + "\nXML\n" + normalizeXmlLayout(newXmlText) + "\n";

  const serie = newFields.serie || tmpl.fields.serie || "";
  const mPrefix = /^(\d{2})\d{6}\./.exec(templateFilename);
  let prefix;
  if (mPrefix) {
    prefix = mPrefix[1];
  } else {
    prefix = "0?";
    warnings.push(
      "Não consegui ler o número da loja a partir do nome do arquivo-modelo (esperava algo como " +
      "'LL123456.SS'). O nome sugerido para o novo arquivo veio com 'LL' = '0?' - troque pelo " +
      "número certo da loja antes de salvar."
    );
  }
  const newFilename = serie ? `${prefix}${newFields.seqcnc}.${serie}` : `${prefix}${newFields.seqcnc}`;

  return {
    newText: fullText,
    newFilename,
    oldFields,
    newFields,
    seqcncReplacements,
    specialLineAction,
    warnings,
  };
}
