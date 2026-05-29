import {
  CLIENT_IDENTIFICATION_JSON_SHAPE,
  type ClientIdentificationRequest,
  redactSensitiveText
} from "@linvo-ai/shared";

function formatList(values: string[] | undefined): string {
  return values?.length ? values.join(", ") : "nenhum";
}

export function buildClientIdentificationUserPrompt(request: ClientIdentificationRequest): string {
  const domSummary = request.domSummary;
  const selected = redactSensitiveText(request.selectedText);
  const surrounding = request.surroundingText
    ? redactSensitiveText(request.surroundingText)
    : "";

  return [
    "Identifique o cliente/caso ativo a partir da selecao manual do atendente.",
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
    surrounding ? `Texto ao redor: ${surrounding}` : "Texto ao redor: nao enviado",
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
