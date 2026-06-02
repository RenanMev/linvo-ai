import {
  CLIENT_IDENTIFICATION_JSON_SHAPE,
  type AiClientIdentificationResult,
  type ClientIdentificationRequest,
  type CustomerSummary,
  redactSensitiveText
} from "@linvo-ai/shared";

export interface ClientDuplicateValidationPromptResult {
  customerId?: string | null | undefined;
  confidence: number;
  evidence: string[];
  status: "match" | "new" | "uncertain";
  warnings: string[];
}

function formatList(values: string[] | undefined): string {
  return values?.length ? values.join(", ") : "nenhum";
}

export function buildClientIdentificationUserPrompt(
  request: ClientIdentificationRequest
): string {
  const domSummary = request.domSummary;
  const selected = redactSensitiveText(request.selectedText);
  const surrounding = request.surroundingText
    ? redactSensitiveText(request.surroundingText)
    : "";

  return [
    "Voce e um assistente de identificacao de cliente/caso.",
    "Identifique somente fatos verificaveis sobre o cliente/caso ativo a partir da selecao manual do atendente, do contexto DOM e da imagem quando enviada.",
    "Use padroes ja visiveis na tela, mas nao invente identificadores, nomes, protocolos, status ou assuntos.",
    "",
    `URL: ${request.url}`,
    `Titulo: ${request.pageTitle}`,
    `Capturado em: ${request.capturedAt}`,
    "",
    "Selecao manual (sinal principal):",
    `Label: ${request.manualSelection.label ?? "sem label"}`,
    `Texto selecionado: ${redactSensitiveText(request.manualSelection.textExcerpt)}`,
    "",
    `Texto compacto selecionado: ${selected}`,
    surrounding
      ? `Texto ao redor: ${surrounding}`
      : "Texto ao redor: nao enviado",
    "",
    "Resumo DOM:",
    domSummary
      ? [
          `Tag: ${domSummary.selectedTag}`,
          `Role: ${domSummary.selectedRole ?? "sem role"}`,
          `Aria-label: ${domSummary.ariaLabel ?? "sem aria-label"}`,
          `Headings proximos: ${formatList(domSummary.nearbyHeadings)}`,
          `Candidatos visiveis: ${formatList(domSummary.candidateLabels)}`
        ].join("\n")
      : "Nao enviado",
    "",
    `Screenshot: ${request.screenshotDataUrl ? "incluida como imagem da mensagem" : "nao enviada"}`,
    "",
    "Responda exatamente neste formato JSON, preenchendo somente fatos verificaveis:",
    JSON.stringify(CLIENT_IDENTIFICATION_JSON_SHAPE)
  ].join("\n");
}

function compactJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function summarizeCustomer(customer: CustomerSummary) {
  return {
    cases: customer.cases.slice(0, 5).map((customerCase) => ({
      ...(customerCase.protocol ? { protocol: customerCase.protocol } : {}),
      ...(customerCase.status ? { status: customerCase.status } : {}),
      ...(customerCase.subject ? { subject: customerCase.subject } : {})
    })),
    customerId: customer.id,
    ...(customer.displayName ? { displayName: customer.displayName } : {}),
    maskedIdentifiers: customer.maskedIdentifiers,
    ...(customer.notes ? { notes: customer.notes.slice(0, 240) } : {})
  };
}

export function buildClientDuplicateValidationUserPrompt(input: {
  analysisResult: AiClientIdentificationResult;
  candidates: CustomerSummary[];
  request: ClientIdentificationRequest;
}): string {
  return [
    "Voce valida duplicidade para o Linvo AI.",
    "Compare a analise da tela com os clientes ja salvos neste dominio.",
    "Marque match apenas quando houver evidencia forte: protocolo igual, telefone/documento/email compativel, ou nome + contexto/caso claramente iguais.",
    "Nao marque match usando somente um primeiro nome generico. Se estiver em duvida, use uncertain.",
    "Use customerId somente de um candidato listado.",
    "",
    `URL: ${input.request.url}`,
    `Titulo: ${input.request.pageTitle}`,
    `Selecao: ${redactSensitiveText(input.request.selectedText)}`,
    "",
    "Analise da etapa 1:",
    compactJson(input.analysisResult),
    "",
    "Clientes candidatos:",
    compactJson(input.candidates.slice(0, 25).map(summarizeCustomer)),
    "",
    "Responda exatamente neste formato JSON:",
    compactJson({
      confidence: 0,
      customerId: null,
      evidence: [],
      status: "new",
      warnings: []
    })
  ].join("\n");
}

export function buildClientIdentificationEnrichmentUserPrompt(input: {
  analysisResult: AiClientIdentificationResult;
  duplicateValidation: ClientDuplicateValidationPromptResult;
  matchedCustomer: CustomerSummary | null;
  request: ClientIdentificationRequest;
}): string {
  return [
    "Voce finaliza a identificacao do cliente para persistencia no Linvo AI.",
    "Use a analise da etapa 1 como base, a validacao de duplicidade da etapa 2 como controle, e o cliente salvo apenas quando houver match.",
    "Adicione ou refine informacoes de caso, status, assunto, nome e evidencias quando estiverem visiveis ou coerentes com o cliente salvo.",
    "Nao reconstrua telefone, email ou documento a partir de valores mascarados. Preserve dados sensiveis somente quando vierem da analise da tela.",
    "Se houver match, mantenha a identidade do cliente existente e acrescente apenas informacoes novas confiaveis.",
    "Se nao houver match confiavel, retorne um candidato novo ou reduza a confianca.",
    "",
    `URL: ${input.request.url}`,
    `Titulo: ${input.request.pageTitle}`,
    `Selecao: ${redactSensitiveText(input.request.selectedText)}`,
    "",
    "Analise da etapa 1:",
    compactJson(input.analysisResult),
    "",
    "Validacao de duplicidade da etapa 2:",
    compactJson(input.duplicateValidation),
    "",
    "Cliente salvo correspondente:",
    input.matchedCustomer ? compactJson(summarizeCustomer(input.matchedCustomer)) : "null",
    "",
    "Responda exatamente neste formato JSON, preenchendo somente fatos verificaveis:",
    compactJson(CLIENT_IDENTIFICATION_JSON_SHAPE)
  ].join("\n");
}
