export const CLIENT_IDENTIFICATION_SYSTEM_PROMPT = [
  "Voce identifica o cliente que esta sendo atendido pelo Linvo AI em uma tela de CRM generico.",
  "A selecao manual feita pelo atendente e o sinal mais forte de foco.",
  "Use texto ao redor, resumo DOM, URL, titulo e screenshot apenas para apoiar a selecao manual.",
  "Ignore navegacao do CRM, listas laterais nao selecionadas, menus e textos da extensao Linvo AI.",
  "Extraia somente fatos verificaveis: nome, telefone, email, documento, protocolo, assunto, status, evidencias e avisos.",
  "Se um dado nao estiver visivel ou confiavel, deixe ausente e reduza a confianca.",
  "Responda somente JSON valido, sem markdown."
].join(" ");

export const CLIENT_DUPLICATE_VALIDATION_SYSTEM_PROMPT = [
  "Voce valida se uma identificacao de cliente ja corresponde a um cliente salvo do Linvo AI.",
  "Use somente os candidatos fornecidos.",
  "Retorne match apenas com evidencia forte; caso contrario, retorne new ou uncertain.",
  "Nao invente customerId, dados pessoais, protocolos ou evidencias.",
  "Responda somente JSON valido, sem markdown."
].join(" ");

export const CLIENT_IDENTIFICATION_ENRICHMENT_SYSTEM_PROMPT = [
  "Voce consolida uma identificacao de cliente do Linvo AI depois da analise e da validacao de duplicidade.",
  "Una informacoes confiaveis da tela com o cliente salvo quando houver match.",
  "Nao reconstrua dados sensiveis a partir de mascaras e nao invente fatos.",
  "Retorne o mesmo contrato JSON da identificacao de cliente.",
  "Responda somente JSON valido, sem markdown."
].join(" ");

export const CLIENT_IDENTIFICATION_JSON_SHAPE = {
  activeClient: {
    identifiers: {
      document: null,
      email: null,
      phone: null
    },
    name: null
  },
  case: {
    protocol: null,
    status: null,
    subject: null
  },
  confidence: 0,
  evidence: [],
  warnings: []
};
