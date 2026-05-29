import { z } from "zod";

import { DEFAULT_IDENTIFICATION_CONFIDENCE_MIN } from "@linvo-ai/shared";

export const APP_CONFIG = "APP_CONFIG";

const envSchema = z.object({
  AI_API_KEY: z.string().trim().min(1).optional(),
  AI_BASE_URL: z.string().url().default("https://api.openai.com/v1/chat/completions"),
  AI_MODEL: z.string().trim().min(1).default("gpt-4.1-mini"),
  DATABASE_URL: z.string().trim().min(1),
  IDENTITY_HASH_SECRET: z.string().trim().min(16),
  IDENTIFICATION_CONFIDENCE_MIN: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(DEFAULT_IDENTIFICATION_CONFIDENCE_MIN),
  JWT_ACCESS_SECRET: z.string().trim().min(16),
  JWT_REFRESH_SECRET: z.string().trim().min(16),
  PASSWORD_PEPPER: z.string().trim().min(16),
  PORT: z.coerce.number().int().positive().default(8791)
});

export type AppConfig = z.infer<typeof envSchema>;

export function createAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  return envSchema.parse(env);
}
