import type {
  CustomerChatMessage,
  CustomerSummary,
  SiteAgentContextSummary
} from "@linvo-ai/shared";

interface CustomerChatPromptInput {
  customer: CustomerSummary;
  messages: CustomerChatMessage[];
  siteContext?: SiteAgentContextSummary | null;
  summary?: string | null;
  userMessage: string;
}

interface CustomerChatSummaryPromptInput {
  customer: CustomerSummary;
  existingSummary?: string | null;
  messages: CustomerChatMessage[];
}

function compactCustomer(customer: CustomerSummary) {
  const latestCase = customer.cases[0] ?? null;

  return {
    cases: customer.cases.slice(0, 5),
    displayName: customer.displayName ?? null,
    domain: customer.domain ?? null,
    favoriteFields: customer.favoriteFields,
    isStarred: customer.isStarred,
    latestCase,
    maskedIdentifiers: customer.maskedIdentifiers,
    notes: customer.notes ?? null
  };
}

export function buildCustomerChatUserPrompt(input: CustomerChatPromptInput): string {
  return [
    "Contexto do cliente:",
    JSON.stringify(compactCustomer(input.customer), null, 2),
    "",
    "Contexto operacional do site:",
    input.siteContext
      ? JSON.stringify({
          focusRules: input.siteContext.focusRules,
          ignoreRules: input.siteContext.ignoreRules,
          regions: input.siteContext.regions,
          summary: input.siteContext.summary
        }, null, 2)
      : "Nao ha contexto operacional salvo para este dominio.",
    "",
    "Resumo duravel da conversa:",
    input.summary?.trim() ? input.summary.trim() : "Sem resumo salvo.",
    "",
    "Mensagens recentes:",
    input.messages.length
      ? JSON.stringify(
          input.messages.map((message) => ({
            content: message.content,
            role: message.role,
            status: message.status
          })),
          null,
          2
        )
      : "Sem mensagens anteriores.",
    "",
    "Pergunta atual do atendente:",
    input.userMessage
  ].join("\n");
}

export function buildCustomerChatSummaryUserPrompt(
  input: CustomerChatSummaryPromptInput
): string {
  return [
    "Cliente:",
    JSON.stringify(compactCustomer(input.customer), null, 2),
    "",
    "Resumo anterior:",
    input.existingSummary?.trim() ? input.existingSummary.trim() : "Sem resumo anterior.",
    "",
    "Mensagens para incorporar ao resumo:",
    JSON.stringify(
      input.messages.map((message) => ({
        content: message.content,
        role: message.role,
        status: message.status
      })),
      null,
      2
    )
  ].join("\n");
}
