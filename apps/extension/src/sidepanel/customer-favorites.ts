import type { CustomerFavoriteField, CustomerSummary } from "@linvo-ai/shared";

export const FAVORITE_FIELD_OPTIONS: Array<{
  label: string;
  value: CustomerFavoriteField;
}> = [
  { label: "Protocolo", value: "protocol" },
  { label: "Telefone", value: "phone" },
  { label: "Email", value: "email" },
  { label: "Documento", value: "document" },
  { label: "Status do caso", value: "caseStatus" },
  { label: "Assunto do caso", value: "caseSubject" },
  { label: "Dominio", value: "domain" },
  { label: "Ultimo contato", value: "lastSeenAt" }
];

const DEFAULT_FAVORITE_FIELDS: CustomerFavoriteField[] = [
  "protocol",
  "phone",
  "email",
  "document",
  "caseStatus",
  "caseSubject",
  "domain",
  "lastSeenAt"
];

export interface ResolvedFavoriteField {
  field: CustomerFavoriteField;
  label: string;
  value: string;
}

function labelForField(field: CustomerFavoriteField): string {
  return FAVORITE_FIELD_OPTIONS.find((option) => option.value === field)?.label ?? field;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit"
  });
}

export function valueForFavoriteField(
  customer: CustomerSummary,
  field: CustomerFavoriteField
): string {
  const latestCase = customer.cases[0];

  switch (field) {
    case "protocol":
      return customer.maskedIdentifiers.protocol ?? latestCase?.protocol ?? "";
    case "phone":
      return customer.maskedIdentifiers.phone ?? "";
    case "email":
      return customer.maskedIdentifiers.email ?? "";
    case "document":
      return customer.maskedIdentifiers.document ?? "";
    case "caseStatus":
      return latestCase?.status ?? "";
    case "caseSubject":
      return latestCase?.subject ?? "";
    case "domain":
      return customer.domain ?? "";
    case "lastSeenAt":
      return formatDate(customer.lastSeenAt);
  }
}

export function resolveFavoriteFields(customer: CustomerSummary): ResolvedFavoriteField[] {
  const fields = Array.from(new Set([
    ...customer.favoriteFields,
    ...DEFAULT_FAVORITE_FIELDS
  ]));
  const resolved: ResolvedFavoriteField[] = [];

  for (const field of fields) {
    const value = valueForFavoriteField(customer, field).trim();

    if (!value) {
      continue;
    }

    resolved.push({
      field,
      label: labelForField(field),
      value
    });

    if (resolved.length >= 2) {
      break;
    }
  }

  return resolved;
}

export function customerSearchText(customer: CustomerSummary): string {
  return [
    customer.displayName,
    customer.domain,
    customer.maskedIdentifiers.document,
    customer.maskedIdentifiers.email,
    customer.maskedIdentifiers.phone,
    customer.maskedIdentifiers.protocol,
    customer.notes,
    ...customer.cases.flatMap((customerCase) => [
      customerCase.protocol,
      customerCase.status,
      customerCase.subject
    ]),
    ...resolveFavoriteFields(customer).map((item) => `${item.label} ${item.value}`)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
