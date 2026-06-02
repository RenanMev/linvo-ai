import { z } from "zod";

import {
  MAX_EMAIL_CHARS,
  MAX_NAME_CHARS,
  PASSWORD_RESET_CODE_CHARS,
  MIN_PASSWORD_CHARS
} from "../limits";
import { apiErrorResponseSchema } from "./errors";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(MAX_EMAIL_CHARS);

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_CHARS)
  .max(256);

export const authUserSchema = z.object({
  email: emailSchema,
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(MAX_NAME_CHARS).optional()
});

export const authTokensSchema = z.object({
  accessToken: z.string().trim().min(1),
  expiresIn: z.number().int().positive(),
  refreshToken: z.string().trim().min(1)
});

export const authRegisterRequestSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(MAX_NAME_CHARS).optional(),
  password: passwordSchema
});

export const authLoginRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

export const authRefreshRequestSchema = z.object({
  refreshToken: z.string().trim().min(1)
});

export const authLogoutRequestSchema = authRefreshRequestSchema;

export const authPasswordResetRequestSchema = z.object({
  email: emailSchema
});

export const authPasswordResetConfirmRequestSchema = z.object({
  password: passwordSchema,
  resetCode: z.string().trim().regex(/^\d{6}$/)
});

export const authSessionResponseSchema = z.object({
  status: z.literal("ok"),
  tokens: authTokensSchema,
  user: authUserSchema
});

export const authRefreshResponseSchema = z.object({
  status: z.literal("ok"),
  tokens: authTokensSchema
});

export const authMeResponseSchema = z.object({
  status: z.literal("ok"),
  user: authUserSchema
});

export const authOkResponseSchema = z.object({
  status: z.literal("ok")
});

export const authPasswordResetRequestResponseSchema = z.object({
  resetCode: z.string().trim().length(PASSWORD_RESET_CODE_CHARS).optional(),
  status: z.literal("ok")
});

export const authApiResponseSchema = z.union([
  authSessionResponseSchema,
  authRefreshResponseSchema,
  authMeResponseSchema,
  authPasswordResetRequestResponseSchema,
  authOkResponseSchema,
  apiErrorResponseSchema
]);

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type AuthRegisterRequest = z.infer<typeof authRegisterRequestSchema>;
export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;
export type AuthRefreshRequest = z.infer<typeof authRefreshRequestSchema>;
export type AuthPasswordResetRequest = z.infer<typeof authPasswordResetRequestSchema>;
export type AuthPasswordResetConfirmRequest = z.infer<
  typeof authPasswordResetConfirmRequestSchema
>;
export type AuthPasswordResetRequestResponse = z.infer<
  typeof authPasswordResetRequestResponseSchema
>;
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
export type AuthApiResponse = z.infer<typeof authApiResponseSchema>;
