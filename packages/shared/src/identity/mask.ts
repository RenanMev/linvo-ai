function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

export function maskPhone(value: string | null | undefined): string | undefined {
  const digits = onlyDigits(value ?? "");

  if (digits.length < 8) {
    return undefined;
  }

  const suffix = digits.slice(-4);
  const ddd = digits.length >= 10 ? digits.slice(-11, -9) : "";

  return ddd ? `(${ddd}) *****-${suffix}` : `*****-${suffix}`;
}

export function maskEmail(value: string | null | undefined): string | undefined {
  const normalized = (value ?? "").trim().toLowerCase();
  const [local, domain] = normalized.split("@");

  if (!local || !domain) {
    return undefined;
  }

  return `${local.slice(0, 2)}***@${domain}`;
}

export function maskDocument(value: string | null | undefined): string | undefined {
  const digits = onlyDigits(value ?? "");

  if (digits.length === 11) {
    return `***.***.***-${digits.slice(-2)}`;
  }

  if (digits.length === 14) {
    return `**.***.***/****-${digits.slice(-2)}`;
  }

  return undefined;
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[documento redigido]")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[documento redigido]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redigido]")
    .replace(/(?:\+\d{1,3}[\s().-]*)?(?:\(?\d{2}\)?[\s().-]*)9?\d{4}[\s.-]?\d{4}\b/g, "[telefone redigido]");
}
