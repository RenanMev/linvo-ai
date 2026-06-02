import { z } from "zod";

import {
  MAX_EVIDENCE_CHARS,
  MAX_EVIDENCE_ITEMS,
  MAX_PAGE_TITLE_CHARS,
  MAX_REQUEST_ID_CHARS,
  MAX_SURROUNDING_TEXT_CHARS,
  MAX_URL_CHARS
} from "../limits";
import { customerSummarySchema } from "./customer";
import { apiErrorResponseSchema } from "./errors";

export const CLIENT_INFO_OPEN_MIN_CONFIDENCE = 0.68;

export const clientInfoOpenRequestSchema = z.object({
  capturedAt: z.string().datetime(),
  pageText: z.string().trim().min(1).max(MAX_SURROUNDING_TEXT_CHARS),
  pageTitle: z.string().trim().min(1).max(MAX_PAGE_TITLE_CHARS),
  requestId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS),
  url: z.url().max(MAX_URL_CHARS)
});

export const clientInfoOpenSourceSchema = z.enum(["heuristic", "llm"]);

export const clientInfoOpenSuccessResponseSchema = z.object({
  confidence: z.number().min(CLIENT_INFO_OPEN_MIN_CONFIDENCE).max(1),
  customer: customerSummarySchema,
  customers: z.array(customerSummarySchema).default([]),
  domain: z.string().trim().min(1).max(240),
  evidence: z
    .array(z.string().trim().min(1).max(MAX_EVIDENCE_CHARS))
    .max(MAX_EVIDENCE_ITEMS)
    .default([]),
  requestId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS),
  source: clientInfoOpenSourceSchema,
  status: z.literal("ok")
});

export const clientInfoOpenNoMatchResponseSchema = z.object({
  customers: z.array(customerSummarySchema).default([]),
  domain: z.string().trim().min(1).max(240),
  reason: z.string().trim().min(1).max(240),
  requestId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS),
  status: z.literal("no_match")
});

export const clientInfoOpenApiResponseSchema = z.union([
  clientInfoOpenSuccessResponseSchema,
  clientInfoOpenNoMatchResponseSchema,
  apiErrorResponseSchema
]);

export type ClientInfoOpenRequest = z.infer<typeof clientInfoOpenRequestSchema>;
export type ClientInfoOpenSource = z.infer<typeof clientInfoOpenSourceSchema>;
export type ClientInfoOpenSuccessResponse = z.infer<
  typeof clientInfoOpenSuccessResponseSchema
>;
export type ClientInfoOpenNoMatchResponse = z.infer<
  typeof clientInfoOpenNoMatchResponseSchema
>;
export type ClientInfoOpenApiResponse = z.infer<
  typeof clientInfoOpenApiResponseSchema
>;
