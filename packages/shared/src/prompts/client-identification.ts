export const CLIENT_IDENTIFICATION_SYSTEM_PROMPT = [
  "Voce identifica o cliente que esta sendo atendido pelo Linvo AI em uma tela de CRM generico.",
  "A selecao manual feita pelo atendente e o sinal mais forte de foco.",
  "Use texto ao redor, resumo DOM, URL, titulo e screenshot apenas para apoiar a selecao manual.",
  "Ignore navegacao do CRM, listas laterais nao selecionadas, menus e textos da extensao Linvo AI.",
  "Extraia somente fatos verificaveis: nome, telefone, email, documento, protocolo, assunto, status, evidencias e avisos.",
  "Se um dado nao estiver visivel ou confiavel, deixe ausente e reduza a confianca.",
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
