import { z } from "zod";

import {
  MAX_DOM_LABEL_CHARS,
  MAX_REQUEST_ID_CHARS,
  MAX_SITE_CONTEXT_DESCRIPTION_CHARS,
  MAX_SITE_CONTEXT_REGIONS,
  MAX_SITE_CONTEXT_RULE_CHARS,
  MAX_SITE_CONTEXT_RULES,
  MAX_SITE_CONTEXT_SUMMARY_CHARS
} from "../limits";
import { apiErrorResponseSchema } from "./errors";

export const siteAgentContextRegionKindSchema = z.enum([
  "action_bar",
  "active_chat",
  "contact_list",
  "conversation_area",
  "header",
  "main_sidebar",
  "navigation",
  "other"
]);

export const siteAgentContextRegionSchema = z.object({
  description: z.string().trim().min(1).max(MAX_SITE_CONTEXT_DESCRIPTION_CHARS),
  evidence: z
    .array(z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS))
    .max(MAX_SITE_CONTEXT_RULES)
    .default([]),
  kind: siteAgentContextRegionKindSchema,
  label: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional()
});

export const siteAgentContextSummarySchema = z.object({
  confidence: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
  domain: z.string().trim().min(1).max(240),
  focusRules: z
    .array(z.string().trim().min(1).max(MAX_SITE_CONTEXT_RULE_CHARS))
    .min(1)
    .max(MAX_SITE_CONTEXT_RULES),
  id: z.string().uuid(),
  ignoreRules: z
    .array(z.string().trim().min(1).max(MAX_SITE_CONTEXT_RULE_CHARS))
    .min(1)
    .max(MAX_SITE_CONTEXT_RULES),
  regions: z
    .array(siteAgentContextRegionSchema)
    .min(1)
    .max(MAX_SITE_CONTEXT_REGIONS),
  sourceRequestId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS),
  summary: z.string().trim().min(1).max(MAX_SITE_CONTEXT_SUMMARY_CHARS),
  updatedAt: z.string().datetime()
});

export const siteAgentContextDraftSchema = siteAgentContextSummarySchema.omit({
  createdAt: true,
  domain: true,
  id: true,
  sourceRequestId: true,
  updatedAt: true
});

export const siteAgentContextStatusSchema = z.enum([
  "created",
  "existing",
  "missing",
  "unavailable",
  "updated"
]);

export const siteContextGetResponseSchema = z.object({
  domain: z.string().trim().min(1).max(240),
  siteContext: siteAgentContextSummarySchema.nullable(),
  status: z.literal("ok")
});

export const siteContextDeleteRequestSchema = z.object({
  domain: z.string().trim().min(1).max(240)
});

export const siteContextDeleteResponseSchema = z.object({
  deleted: z.boolean(),
  domain: z.string().trim().min(1).max(240),
  status: z.literal("ok")
});

export const siteContextGetApiResponseSchema = z.union([
  siteContextGetResponseSchema,
  apiErrorResponseSchema
]);

export const siteContextDeleteApiResponseSchema = z.union([
  siteContextDeleteResponseSchema,
  apiErrorResponseSchema
]);

export type SiteAgentContextRegionKind = z.infer<
  typeof siteAgentContextRegionKindSchema
>;
export type SiteAgentContextRegion = z.infer<typeof siteAgentContextRegionSchema>;
export type SiteAgentContextDraft = z.infer<typeof siteAgentContextDraftSchema>;
export type SiteAgentContextSummary = z.infer<typeof siteAgentContextSummarySchema>;
export type SiteAgentContextStatus = z.infer<typeof siteAgentContextStatusSchema>;
export type SiteContextGetResponse = z.infer<typeof siteContextGetResponseSchema>;
export type SiteContextGetApiResponse = z.infer<typeof siteContextGetApiResponseSchema>;
export type SiteContextDeleteRequest = z.infer<typeof siteContextDeleteRequestSchema>;
export type SiteContextDeleteResponse = z.infer<typeof siteContextDeleteResponseSchema>;
export type SiteContextDeleteApiResponse = z.infer<
  typeof siteContextDeleteApiResponseSchema
>;
