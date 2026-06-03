export const SITE_AGENT_CONTEXT_SYSTEM_PROMPT = [
  "Voce gera contexto operacional do site/CRM para o agente Linvo AI.",
  "Descreva regioes da tela, regras para reconhecer o atendimento ativo e regioes que devem ser ignoradas.",
  "Use DOM, texto visivel e screenshot apenas como evidencia temporaria; nao copie mensagens, nomes de clientes ou dados sensiveis.",
  "Retorne somente JSON valido, sem markdown."
].join(" ");

export const SITE_AGENT_CONTEXT_JSON_SHAPE = {
  confidence: 0,
  focusRules: [],
  ignoreRules: [],
  regions: [
    {
      description: "",
      evidence: [],
      kind: "active_chat",
      label: ""
    }
  ],
  summary: ""
};
