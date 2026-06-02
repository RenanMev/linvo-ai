import {
  aiClientIdentificationResultSchema,
  canonicalizePhone,
  canonicalizeProtocol,
  type AiClientIdentificationResult,
  type BulkIdentificationItem
} from "@linvo-ai/shared";

export interface ParsedBulkItem {
  aiResult: AiClientIdentificationResult;
  item: BulkIdentificationItem;
}

interface PhoneMatch {
  canonical: string;
  raw: string;
}

interface ProtocolMatch {
  canonical: string;
  raw: string;
}

const LIST_NOISE_WORDS = [
  "whatsapp",
  "more_vert",
  "atender agora",
  "encerrar chat",
  "novo",
  "online"
];

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

function getPhoneMatches(text: string): PhoneMatch[] {
  const matches =
    text.match(/(?:\+?55[\s().-]*)?(?:\(?\d{2}\)?[\s().-]*)?9?\d{4}[\s.-]?\d{4}\b/g) ??
    [];
  const unique = new Map<string, PhoneMatch>();

  for (const raw of matches) {
    const digits = onlyDigits(raw);
    const canBeBrazilPhone =
      (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) ||
      digits.length === 10 ||
      digits.length === 11;

    if (!canBeBrazilPhone) {
      continue;
    }

    const canonical = canonicalizePhone(raw);

    if (canonical) {
      unique.set(canonical, { canonical, raw });
    }
  }

  return [...unique.values()];
}

function getProtocolMatch(text: string, phoneMatches: PhoneMatch[]): ProtocolMatch | null {
  const matches = text.matchAll(/(?:^|\s)[-\u2013\u2014]\s*([\p{L}\p{N}][\p{L}\p{N}._-]{2,})/gu);
  const phoneDigits = new Set(
    phoneMatches.flatMap((phone) => [onlyDigits(phone.raw), phone.canonical])
  );

  for (const match of matches) {
    const raw = match[1] ?? "";

    if (!/\d/u.test(raw)) {
      continue;
    }

    const digits = onlyDigits(raw);

    if (phoneDigits.has(digits)) {
      continue;
    }

    const canonical = canonicalizeProtocol(raw);

    if (canonical) {
      return { canonical, raw };
    }
  }

  return null;
}

function removeKnownParts(text: string, phoneMatches: PhoneMatch[], protocol: ProtocolMatch | null): string {
  let cleaned = text;

  if (protocol) {
    const protocolPattern = new RegExp(`\\s*[-\\u2013\\u2014]\\s*${escapeRegex(protocol.raw)}\\S*`, "iu");
    cleaned = cleaned.replace(protocolPattern, " ");
  }

  for (const phone of phoneMatches) {
    cleaned = cleaned.replace(new RegExp(escapeRegex(phone.raw), "gu"), " ");
  }

  for (const word of LIST_NOISE_WORDS) {
    cleaned = cleaned.replace(new RegExp(escapeRegex(word), "giu"), " ");
  }

  return compact(
    cleaned
      .replace(/\b\d{1,2}\b/gu, " ")
      .replace(/[\u2022\u00b7|]+/gu, " ")
      .replace(/\s*[-\u2013\u2014]\s*$/u, " ")
      .replace(/\.{2,}/gu, " ")
  );
}

function getName(text: string, phoneMatches: PhoneMatch[], protocol: ProtocolMatch | null): string | null {
  const protocolIndex = protocol ? text.indexOf(protocol.raw) : -1;
  const prefix = protocolIndex > 0
    ? text.slice(0, protocolIndex).replace(/\s*[-\u2013\u2014]\s*$/u, "")
    : text;
  const cleaned = removeKnownParts(prefix, phoneMatches, protocol);

  if (cleaned.length < 3) {
    return null;
  }

  return cleaned.slice(0, 160);
}

function buildConfidence(input: {
  duplicatePhone: boolean;
  hasName: boolean;
  phone: string | null;
  protocol: string | null;
}): number {
  if (input.hasName && input.protocol) {
    return 0.9;
  }

  if (input.hasName && input.phone && !input.duplicatePhone) {
    return 0.86;
  }

  if (input.hasName) {
    return 0.76;
  }

  if (input.phone && !input.duplicatePhone) {
    return 0.65;
  }

  return 0.35;
}

function parseItem(item: BulkIdentificationItem, duplicatePhones: Set<string>): ParsedBulkItem {
  const rowText = compact(item.rowText);
  const phoneMatches = getPhoneMatches(rowText);
  const primaryPhone = phoneMatches[0]?.canonical ?? null;
  const duplicatePhone = primaryPhone ? duplicatePhones.has(primaryPhone) : false;
  const protocol = getProtocolMatch(rowText, phoneMatches);
  const name = getName(rowText, phoneMatches, protocol);
  const evidence = [
    name ? `Nome visivel na linha: ${name}` : "Linha sem nome claro.",
    protocol ? `Protocolo detectado: ${protocol.canonical}` : "",
    primaryPhone && !duplicatePhone ? "Telefone unico detectado na linha." : ""
  ].filter(Boolean);
  const warnings = [
    primaryPhone && duplicatePhone
      ? "Telefone repetido na lista; tratado como numero do canal, nao do cliente."
      : "",
    !name ? "Nao foi possivel extrair um nome confiavel da linha." : "",
    name && !protocol && (!primaryPhone || duplicatePhone)
      ? "Cliente identificado por nome e contexto da linha."
      : ""
  ].filter(Boolean);
  const identifiers = primaryPhone && !duplicatePhone ? { phone: primaryPhone } : {};
  const aiResult = aiClientIdentificationResultSchema.parse({
    activeClient: name || Object.keys(identifiers).length
      ? {
          identifiers,
          name
        }
      : null,
    case: protocol
      ? {
          protocol: protocol.canonical,
          status: null,
          subject: null
        }
      : null,
    confidence: buildConfidence({
      duplicatePhone,
      hasName: Boolean(name),
      phone: primaryPhone,
      protocol: protocol?.canonical ?? null
    }),
    evidence,
    warnings
  });

  return { aiResult, item };
}

export function parseBulkIdentificationItems(items: BulkIdentificationItem[]): ParsedBulkItem[] {
  const phoneCounts = new Map<string, number>();

  for (const item of items) {
    for (const phone of getPhoneMatches(item.rowText)) {
      phoneCounts.set(phone.canonical, (phoneCounts.get(phone.canonical) ?? 0) + 1);
    }
  }

  const duplicatePhones = new Set(
    [...phoneCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([phone]) => phone)
  );

  return items.map((item) => parseItem(item, duplicatePhones));
}
