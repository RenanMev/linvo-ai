import type { AppConfig } from "./env.schema";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toCorsOrigin(value: string): string {
  if (value.includes("*")) {
    return value;
  }

  if (value.startsWith("chrome-extension://")) {
    const parsed = new URL(value);
    return `chrome-extension://${parsed.hostname}`;
  }

  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function originMatchesPattern(origin: string, pattern: string): boolean {
  const regex = new RegExp(`^${pattern.split("*").map(escapeRegex).join(".*")}$`);
  return regex.test(origin);
}

export function isAllowedCorsOrigin(config: AppConfig, origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = toCorsOrigin(origin);

  return config.CORS_ALLOWED_ORIGINS.some((pattern) =>
    originMatchesPattern(normalizedOrigin, toCorsOrigin(pattern))
  );
}

export function createCorsOrigin(config: AppConfig) {
  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    callback(null, isAllowedCorsOrigin(config, origin));
  };
}
