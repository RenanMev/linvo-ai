import {
  SITE_AGENT_CONTEXT_JSON_SHAPE,
  redactSensitiveText,
  type AiClientIdentificationResult,
  type ClientIdentificationRequest,
  type SiteAgentContextDraft
} from "@linvo-ai/shared";

function compact(value: string | undefined, maxChars: number): string {
  const cleaned = redactSensitiveText(value ?? "").replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  return `${cleaned.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

export function buildSiteContextUserPrompt(input: {
  analysisResult: AiClientIdentificationResult;
  fallbackDraft: SiteAgentContextDraft;
  request: ClientIdentificationRequest;
}): string {
  return [
    "Gere ou refine o contexto operacional do site para uso futuro do agente.",
    "O contexto deve explicar mapa da tela, onde esta o atendimento ativo e o que deve ser ignorado.",
    "Nao salve nomes/mensagens reais de clientes como exemplo. Prefira labels de UI e descricoes genericas.",
    "",
    `URL: ${input.request.url}`,
    `Titulo: ${input.request.pageTitle}`,
    `Capturado em: ${input.request.capturedAt}`,
    `Screenshot temporaria: ${input.request.screenshotDataUrl ? "incluida para analise visual" : "nao enviada"}`,
    "",
    "Selecao manual redigida:",
    compact(input.request.selectedText, 900),
    "",
    "Texto ao redor redigido:",
    compact(input.request.surroundingText, 3_500) || "nao enviado",
    "",
    "Resumo DOM:",
    JSON.stringify(input.request.domSummary ?? {}, null, 2),
    "",
    "Identificacao do cliente/caso redigida:",
    JSON.stringify({
      case: input.analysisResult.case,
      confidence: input.analysisResult.confidence,
      evidence: input.analysisResult.evidence.map((item) => redactSensitiveText(item)),
      warnings: input.analysisResult.warnings.map((item) => redactSensitiveText(item))
    }, null, 2),
    "",
    "Rascunho heuristico permitido para apoiar a resposta:",
    JSON.stringify(input.fallbackDraft, null, 2),
    "",
    "Responda exatamente neste formato JSON:",
    JSON.stringify(SITE_AGENT_CONTEXT_JSON_SHAPE, null, 2)
  ].join("\n");
}
