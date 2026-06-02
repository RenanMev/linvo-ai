import {
  redactSensitiveText,
  type ClientInfoOpenRequest,
  type CustomerSummary
} from "@linvo-ai/shared";

function compact(value: string | undefined, maxChars: number): string {
  const normalized = redactSensitiveText(value ?? "").replace(/\s+/g, " ").trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function customerLine(customer: CustomerSummary): string {
  const identifiers = customer.maskedIdentifiers;
  const cases = customer.cases.map((customerCase) =>
    [
      customerCase.protocol ? `protocolo=${compact(customerCase.protocol, 80)}` : "",
      customerCase.status ? `status=${compact(customerCase.status, 80)}` : "",
      customerCase.subject ? `assunto=${compact(customerCase.subject, 120)}` : ""
    ].filter(Boolean).join("; ")
  ).filter(Boolean).slice(0, 3).join(" | ");

  return [
    `customerId=${customer.id}`,
    customer.displayName ? `nome=${compact(customer.displayName, 120)}` : "",
    customer.domain ? `dominio=${compact(customer.domain, 120)}` : "",
    identifiers.phone ? `telefone=${compact(identifiers.phone, 80)}` : "",
    identifiers.email ? `email=${compact(identifiers.email, 120)}` : "",
    identifiers.document ? `documento=${compact(identifiers.document, 80)}` : "",
    identifiers.protocol ? `protocolo=${compact(identifiers.protocol, 80)}` : "",
    cases ? `casos=${cases}` : ""
  ].filter(Boolean).join("; ");
}

export function buildClientInfoOpenUserPrompt(input: {
  customers: CustomerSummary[];
  request: ClientInfoOpenRequest;
}): string {
  return [
    "Voce precisa identificar em qual usuario abrir o menu correto, seguindo a lista de usuarios que ja foram identificados.",
    `Titulo da pagina: ${input.request.pageTitle}`,
    `URL da pagina: ${input.request.url}`,
    `Texto visivel da pagina:\n${compact(input.request.pageText, 5_500)}`,
    `Usuarios ja identificados:\n${input.customers.map(customerLine).join("\n")}`,
    "Retorne somente JSON. Use um customerId exatamente igual a um usuario da lista."
  ].join("\n\n");
}
