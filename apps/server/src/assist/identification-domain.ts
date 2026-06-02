import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";

import {
  aiClientIdentificationResultSchema,
  chooseCanonicalIdentity,
  maskDocument,
  maskEmail,
  maskPhone,
  maskedIdentifiersSchema,
  redactSensitiveText,
  type AiClientIdentificationResult,
  type ClientIdentificationRequest,
  type CustomerCaseSummary,
  type CustomerSummary,
  type MaskedIdentifiers,
  type PendingClientSummary
} from "@linvo-ai/shared";

export interface DomSignature {
  anchorText?: string;
  ariaLabel?: string;
  candidateLabels: string[];
  identifierText?: string;
  nameText?: string;
  nearbyHeadings: string[];
  selectedRole?: string;
  selectedTag: string;
  tokens: string[];
}

export type ConfirmationStatusValue =
  | "accepted"
  | "known"
  | "low_confidence"
  | "not_required"
  | "pending_confirmation"
  | "rejected";

const DECIDABLE_CONFIRMATION_STATUSES = new Set<ConfirmationStatusValue>([
  "low_confidence",
  "pending_confirmation"
]);

export function isDecidableConfirmationStatus(value: string): value is ConfirmationStatusValue {
  return DECIDABLE_CONFIRMATION_STATUSES.has(value as ConfirmationStatusValue);
}

export function hashWithSecret(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value) ?? "null") as Prisma.InputJsonValue;
}

export function parseAiIdentificationResult(value: unknown): AiClientIdentificationResult {
  return aiClientIdentificationResultSchema.parse(value);
}

export function parseMaskedIdentifiers(value: unknown): MaskedIdentifiers {
  return maskedIdentifiersSchema.parse(value);
}

export function buildMaskedIdentifiers(aiResult: AiClientIdentificationResult): MaskedIdentifiers {
  const document = maskDocument(aiResult.activeClient?.identifiers.document);
  const email = maskEmail(aiResult.activeClient?.identifiers.email);
  const phone = maskPhone(aiResult.activeClient?.identifiers.phone);

  return {
    ...(document ? { document } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(aiResult.case?.protocol ? { protocol: aiResult.case.protocol } : {})
  };
}

export function toPendingClient(aiResult: AiClientIdentificationResult): PendingClientSummary | null {
  if (!aiResult.activeClient) {
    return null;
  }

  const maskedIdentifiers = buildMaskedIdentifiers(aiResult);
  const pendingCase = aiResult.case
    ? {
        ...(aiResult.case.protocol ? { protocol: aiResult.case.protocol } : {}),
        ...(aiResult.case.status ? { status: aiResult.case.status } : {}),
        ...(aiResult.case.subject ? { subject: aiResult.case.subject } : {})
      }
    : null;

  return {
    case: pendingCase && Object.keys(pendingCase).length ? pendingCase : null,
    ...(aiResult.activeClient.name ? { displayName: aiResult.activeClient.name } : {}),
    maskedIdentifiers
  };
}

export function buildDomSignature(
  request: ClientIdentificationRequest,
  aiResult: AiClientIdentificationResult
): DomSignature {
  const maskedIdentifiers = buildMaskedIdentifiers(aiResult);
  const anchorText = compact(request.manualSelection.label ?? request.selectedText, 240);
  const nameText = compact(aiResult.activeClient?.name ?? request.manualSelection.label, 160);
  const identifierText = compact(
    firstValue([
      maskedIdentifiers.protocol,
      maskedIdentifiers.phone,
      maskedIdentifiers.email,
      maskedIdentifiers.document
    ]),
    160
  );
  const candidateLabels = (request.domSummary?.candidateLabels ?? [])
    .map((value) => compact(value, 160))
    .filter((value): value is string => Boolean(value))
    .slice(0, 12);
  const nearbyHeadings = (request.domSummary?.nearbyHeadings ?? [])
    .map((value) => compact(value, 160))
    .filter((value): value is string => Boolean(value))
    .slice(0, 12);

  return {
    ...(anchorText ? { anchorText } : {}),
    ...(request.domSummary?.ariaLabel ? { ariaLabel: request.domSummary.ariaLabel } : {}),
    candidateLabels,
    ...(identifierText ? { identifierText } : {}),
    ...(nameText ? { nameText } : {}),
    nearbyHeadings,
    ...(request.domSummary?.selectedRole ? { selectedRole: request.domSummary.selectedRole } : {}),
    selectedTag: request.domSummary?.selectedTag ?? "unknown",
    tokens: extractTokens([
      anchorText,
      nameText,
      identifierText,
      ...candidateLabels,
      ...nearbyHeadings
    ])
  };
}

export function parseDomSignature(value: unknown): DomSignature {
  const raw = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

  return {
    ...(typeof raw.anchorText === "string" ? { anchorText: raw.anchorText } : {}),
    ...(typeof raw.ariaLabel === "string" ? { ariaLabel: raw.ariaLabel } : {}),
    candidateLabels: Array.isArray(raw.candidateLabels)
      ? raw.candidateLabels.filter((item): item is string => typeof item === "string")
      : [],
    ...(typeof raw.identifierText === "string" ? { identifierText: raw.identifierText } : {}),
    ...(typeof raw.nameText === "string" ? { nameText: raw.nameText } : {}),
    nearbyHeadings: Array.isArray(raw.nearbyHeadings)
      ? raw.nearbyHeadings.filter((item): item is string => typeof item === "string")
      : [],
    ...(typeof raw.selectedRole === "string" ? { selectedRole: raw.selectedRole } : {}),
    selectedTag: typeof raw.selectedTag === "string" ? raw.selectedTag : "unknown",
    tokens: Array.isArray(raw.tokens)
      ? raw.tokens.filter((item): item is string => typeof item === "string")
      : []
  };
}

export function resolveIdentity(aiResult: AiClientIdentificationResult, context: string) {
  return chooseCanonicalIdentity({
    context: redactSensitiveText(context),
    ...(aiResult.activeClient?.identifiers.document
      ? { document: aiResult.activeClient.identifiers.document }
      : {}),
    ...(aiResult.activeClient?.identifiers.email
      ? { email: aiResult.activeClient.identifiers.email }
      : {}),
    ...(aiResult.activeClient?.name ? { name: aiResult.activeClient.name } : {}),
    ...(aiResult.activeClient?.identifiers.phone
      ? { phone: aiResult.activeClient.identifiers.phone }
      : {}),
    ...(aiResult.case?.protocol ? { protocol: aiResult.case.protocol } : {})
  });
}

export function toCustomerSummary(customer: {
  cases: Array<{
    id: string;
    lastSeenAt: Date;
    protocolDisplay: string | null;
    statusDisplay: string | null;
    subjectDisplay: string | null;
  }>;
  displayName: string | null;
  domain?: string;
  id: string;
  lastSeenAt: Date;
  maskedIdentifiers: unknown;
  notes?: string | null;
}): CustomerSummary {
  return {
    cases: customer.cases.map((customerCase) => toCaseSummary(customerCase)),
    ...(customer.displayName ? { displayName: customer.displayName } : {}),
    ...(customer.domain ? { domain: customer.domain } : {}),
    id: customer.id,
    lastSeenAt: customer.lastSeenAt.toISOString(),
    maskedIdentifiers: parseMaskedIdentifiers(customer.maskedIdentifiers),
    ...(customer.notes ? { notes: customer.notes } : {})
  };
}

export function toCaseSummary(customerCase: {
  id: string;
  lastSeenAt: Date;
  protocolDisplay: string | null;
  statusDisplay: string | null;
  subjectDisplay: string | null;
}): CustomerCaseSummary {
  return {
    id: customerCase.id,
    lastSeenAt: customerCase.lastSeenAt.toISOString(),
    ...(customerCase.protocolDisplay ? { protocol: customerCase.protocolDisplay } : {}),
    ...(customerCase.statusDisplay ? { status: customerCase.statusDisplay } : {}),
    ...(customerCase.subjectDisplay ? { subject: customerCase.subjectDisplay } : {})
  };
}

function compact(value: string | null | undefined, max: number): string | undefined {
  const cleaned = redactSensitiveText(value ?? "").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function extractTokens(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const value of values) {
    const matches = value?.match(/[\p{L}\p{N}][\p{L}\p{N}._-]{2,}/gu) ?? [];

    for (const match of matches) {
      const token = match.trim();
      const key = token.toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        tokens.push(token.slice(0, 60));
      }

      if (tokens.length >= 18) {
        return tokens;
      }
    }
  }

  return tokens;
}

function firstValue(values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim());
}
