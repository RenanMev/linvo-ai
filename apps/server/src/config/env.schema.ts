import { z } from "zod";

import { DEFAULT_IDENTIFICATION_CONFIDENCE_MIN } from "@linvo-ai/shared";

export const APP_CONFIG = "APP_CONFIG";

const DEFAULT_DEV_CORS_ALLOWED_ORIGINS = [
  "http://localhost:*",
  "http://127.0.0.1:*",
  "chrome-extension://*",
  "https://painel.nvoip.com.br"
];

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const envSchema = z.object({
  AI_API_KEY: z.string().trim().min(1).optional(),
  AI_BASE_URL: z.string().url().default("https://api.openai.com/v1/chat/completions"),
  AI_CHAT_API_KEY: z.string().trim().min(1).optional(),
  AI_CHAT_BASE_URL: z.string().url().optional(),
  AI_CHAT_MODEL: z.string().trim().min(1).optional(),
  AI_MODEL: z.string().trim().min(1).default("gpt-4.1-mini"),
  CORS_ALLOWED_ORIGINS: z.string().trim().optional(),
  DATABASE_URL: z.string().trim().min(1),
  IDENTITY_HASH_SECRET: z.string().trim().min(16),
  IDENTIFICATION_CONFIDENCE_MIN: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(DEFAULT_IDENTIFICATION_CONFIDENCE_MIN),
  JWT_ACCESS_SECRET: z.string().trim().min(16),
  JWT_AUDIENCE: z.string().trim().min(1).default("linvo-ai-extension"),
  JWT_ISSUER: z.string().trim().min(1).default("linvo-ai-server"),
  JWT_REFRESH_SECRET: z.string().trim().min(16),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PASSWORD_PEPPER: z.string().trim().min(16),
  PORT: z.coerce.number().int().positive().default(8791)
}).superRefine((config, context) => {
  if (config.NODE_ENV === "production" && parseCsv(config.CORS_ALLOWED_ORIGINS).length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "CORS_ALLOWED_ORIGINS must be set in production.",
      path: ["CORS_ALLOWED_ORIGINS"]
    });
  }
});

type ParsedEnv = z.infer<typeof envSchema>;

export type AppConfig = Omit<ParsedEnv, "CORS_ALLOWED_ORIGINS"> & {
  CORS_ALLOWED_ORIGINS: string[];
};

export function createAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const { CORS_ALLOWED_ORIGINS, ...config } = envSchema.parse(env);
  const configuredOrigins = parseCsv(CORS_ALLOWED_ORIGINS);

  return {
    ...config,
    CORS_ALLOWED_ORIGINS:
      configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_DEV_CORS_ALLOWED_ORIGINS
  };
}
