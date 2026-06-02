import { z } from "zod";

import {
  MAX_REQUEST_ID_CHARS,
  MAX_WARNING_CHARS
} from "../limits";

export const apiErrorCodeSchema = z.enum([
  "AI_UNAVAILABLE",
  "AUTH_REQUIRED",
  "EMAIL_ALREADY_EXISTS",
  "FORBIDDEN",
  "IDENTIFICATION_FAILED",
  "INTERNAL_ERROR",
  "INVALID_CREDENTIALS",
  "INVALID_REQUEST",
  "PASSWORD_RESET_TOKEN_INVALID",
  "RATE_LIMITED",
  "REFRESH_TOKEN_INVALID",
  "USER_DISABLED"
]);

export const apiErrorResponseSchema = z.object({
  errorCode: apiErrorCodeSchema,
  message: z.string().trim().min(1).max(MAX_WARNING_CHARS),
  requestId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS).optional(),
  status: z.literal("error")
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
