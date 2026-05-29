export type CanonicalIdentityKind =
  | "document"
  | "email"
  | "name_context"
  | "phone"
  | "protocol"
  | "unknown";

export interface CanonicalIdentity {
  kind: CanonicalIdentityKind;
  value: string;
}

function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function canonicalizePhone(value: string | null | undefined): string | null {
  const digits = onlyDigits(value ?? "");

  if (digits.length < 8) {
    return null;
  }

  if (digits.startsWith("55") && digits.length > 11) {
    return digits.slice(2);
  }

  return digits;
}

export function canonicalizeEmail(value: string | null | undefined): string | null {
  const normalized = compact(value ?? "").toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function canonicalizeDocument(value: string | null | undefined): string | null {
  const digits = onlyDigits(value ?? "");

  if (digits.length !== 11 && digits.length !== 14) {
    return null;
  }

  return digits;
}

export function canonicalizeProtocol(value: string | null | undefined): string | null {
  const normalized = compact(value ?? "").toUpperCase();

  if (normalized.length < 3) {
    return null;
  }

  return normalized.replace(/[^\p{L}\p{N}-]+/gu, "");
}

export function canonicalizeNameContext(
  name: string | null | undefined,
  context: string | null | undefined
): string | null {
  const normalizedName = compact(name ?? "").toLowerCase();
  const normalizedContext = compact(context ?? "").toLowerCase();

  if (normalizedName.length < 3 || normalizedContext.length < 8) {
    return null;
  }

  return `${normalizedName}|${normalizedContext.slice(0, 180)}`;
}

export function chooseCanonicalIdentity(input: {
  context?: string | null;
  document?: string | null;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  protocol?: string | null;
}): CanonicalIdentity {
  const phone = canonicalizePhone(input.phone);

  if (phone) {
    return { kind: "phone", value: phone };
  }

  const email = canonicalizeEmail(input.email);

  if (email) {
    return { kind: "email", value: email };
  }

  const document = canonicalizeDocument(input.document);

  if (document) {
    return { kind: "document", value: document };
  }

  const protocol = canonicalizeProtocol(input.protocol);

  if (protocol) {
    return { kind: "protocol", value: protocol };
  }

  const nameContext = canonicalizeNameContext(input.name, input.context);

  if (nameContext) {
    return { kind: "name_context", value: nameContext };
  }

  return { kind: "unknown", value: "" };
}
