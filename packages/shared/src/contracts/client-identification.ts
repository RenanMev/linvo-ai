import { z } from "zod";

import {
  MAX_DOM_LABEL_CHARS,
  MAX_DOM_SUMMARY_ITEMS,
  MAX_EVIDENCE_CHARS,
  MAX_EVIDENCE_ITEMS,
  MAX_BULK_CONTAINER_TEXT_CHARS,
  MAX_BULK_IDENTIFICATION_ITEMS,
  MAX_BULK_ROW_TEXT_CHARS,
  MAX_PAGE_TITLE_CHARS,
  MAX_REQUEST_ID_CHARS,
  MAX_SCREENSHOT_DATA_URL_CHARS,
  MAX_SELECTED_TEXT_CHARS,
  MAX_SURROUNDING_TEXT_CHARS,
  MAX_URL_CHARS,
  MAX_WARNING_CHARS,
  MAX_WARNING_ITEMS
} from "../limits";
import { customerCaseSummarySchema, customerSummarySchema } from "./customer";
import { apiErrorResponseSchema } from "./errors";

const imageDataUrlSchema = z
  .string()
  .max(MAX_SCREENSHOT_DATA_URL_CHARS)
  .regex(/^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i);

export const manualSelectionSchema = z.object({
  boundingBox: z
    .object({
      height: z.number().nonnegative(),
      left: z.number(),
      top: z.number(),
      width: z.number().nonnegative()
    })
    .optional(),
  label: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
  selectedAt: z.string().datetime(),
  source: z.literal("user"),
  textExcerpt: z.string().trim().min(3).max(MAX_SELECTED_TEXT_CHARS)
});

export const domSummarySchema = z.object({
  ariaLabel: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
  candidateLabels: z
    .array(z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS))
    .max(MAX_DOM_SUMMARY_ITEMS)
    .default([]),
  nearbyHeadings: z
    .array(z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS))
    .max(MAX_DOM_SUMMARY_ITEMS)
    .default([]),
  selectedRole: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
  selectedTag: z.string().trim().min(1).max(40)
});

export const clientIdentificationRequestSchema = z.object({
  capturedAt: z.string().datetime(),
  domSummary: domSummarySchema.optional(),
  manualSelection: manualSelectionSchema,
  pageTitle: z.string().trim().min(1).max(MAX_PAGE_TITLE_CHARS),
  requestId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS),
  screenshotDataUrl: imageDataUrlSchema.optional(),
  selectedText: z.string().trim().min(3).max(MAX_SELECTED_TEXT_CHARS),
  surroundingText: z
    .string()
    .trim()
    .min(1)
    .max(MAX_SURROUNDING_TEXT_CHARS)
    .optional(),
  url: z.url().max(MAX_URL_CHARS)
});

const boundingBoxSchema = z.object({
  height: z.number().nonnegative(),
  left: z.number(),
  top: z.number(),
  width: z.number().nonnegative()
});

export const bulkListSelectionSchema = z.object({
  boundingBox: boundingBoxSchema.optional(),
  containerText: z.string().trim().min(1).max(MAX_BULK_CONTAINER_TEXT_CHARS),
  label: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
  selectedAt: z.string().datetime(),
  source: z.literal("user")
});

export const bulkIdentificationItemSchema = z.object({
  ariaLabel: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
  boundingBox: boundingBoxSchema.optional(),
  requestId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS),
  role: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
  rowIndex: z.number().int().nonnegative(),
  rowText: z.string().trim().min(3).max(MAX_BULK_ROW_TEXT_CHARS),
  tag: z.string().trim().min(1).max(40),
  tokens: z.array(z.string().trim().min(1).max(80)).max(24).default([])
});

export const bulkClientIdentificationRequestSchema = z.object({
  capturedAt: z.string().datetime(),
  items: z
    .array(bulkIdentificationItemSchema)
    .min(1)
    .max(MAX_BULK_IDENTIFICATION_ITEMS),
  listSelection: bulkListSelectionSchema,
  pageTitle: z.string().trim().min(1).max(MAX_PAGE_TITLE_CHARS),
  requestId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS),
  url: z.url().max(MAX_URL_CHARS)
});

export const aiClientIdentifiersSchema = z.object({
  document: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  phone: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).nullable().optional()
});

export const aiClientIdentificationResultSchema = z.object({
  activeClient: z
    .object({
      identifiers: aiClientIdentifiersSchema.default({}),
      name: z.string().trim().min(1).max(160).nullable().optional()
    })
    .nullable(),
  case: z
    .object({
      protocol: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).nullable().optional(),
      status: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).nullable().optional(),
      subject: z.string().trim().min(1).max(160).nullable().optional()
    })
    .nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z
    .array(z.string().trim().min(1).max(MAX_EVIDENCE_CHARS))
    .max(MAX_EVIDENCE_ITEMS)
    .default([]),
  warnings: z
    .array(z.string().trim().min(1).max(MAX_WARNING_CHARS))
    .max(MAX_WARNING_ITEMS)
    .default([])
});

export const clientIdentificationSaveStateSchema = z.enum([
  "known",
  "pending_confirmation",
  "low_confidence"
]);

export const pendingClientCaseSchema = z
  .object({
    protocol: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
    status: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
    subject: z.string().trim().min(1).max(160).optional()
  })
  .nullable();

export const pendingClientSummarySchema = z.object({
  case: pendingClientCaseSchema,
  displayName: z.string().trim().min(1).max(160).optional(),
  maskedIdentifiers: z
    .object({
      document: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
      email: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
      phone: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
      protocol: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional()
    })
    .default({})
});

export const bulkClientIdentificationCandidateSchema = z.object({
  case: pendingClientCaseSchema,
  confidence: z.number().min(0).max(1),
  displayName: z.string().trim().min(1).max(160).optional(),
  evidence: z.array(z.string().trim().min(1).max(MAX_EVIDENCE_CHARS)).default([]),
  maskedIdentifiers: pendingClientSummarySchema.shape.maskedIdentifiers,
  requestId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS),
  rowIndex: z.number().int().nonnegative(),
  rowText: z.string().trim().min(3).max(MAX_BULK_ROW_TEXT_CHARS),
  saveState: clientIdentificationSaveStateSchema,
  selectedByDefault: z.boolean(),
  warnings: z.array(z.string().trim().min(1).max(MAX_WARNING_CHARS)).default([])
});

export const clientIdentificationSuccessResponseSchema = z.object({
  activeClient: customerSummarySchema.nullable(),
  case: customerCaseSummarySchema.nullable(),
  confidence: z.number().min(0).max(1),
  domain: z.string().trim().min(1).max(240),
  evidence: z.array(z.string().trim().min(1).max(MAX_EVIDENCE_CHARS)).default([]),
  pendingClient: pendingClientSummarySchema.nullable().default(null),
  recentCustomers: z.array(customerSummarySchema).default([]),
  requestId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS),
  saveState: clientIdentificationSaveStateSchema,
  saved: z.boolean(),
  status: z.literal("ok"),
  warnings: z.array(z.string().trim().min(1).max(MAX_WARNING_CHARS)).default([])
});

export const clientIdentificationDecisionRequestSchema = z.object({
  decision: z.enum(["accept", "reject"]),
  requestId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS)
});

export const clientIdentificationDecisionResponseSchema = z.object({
  activeClient: customerSummarySchema.nullable(),
  decision: z.enum(["accept", "reject"]),
  domain: z.string().trim().min(1).max(240),
  recentCustomers: z.array(customerSummarySchema).default([]),
  requestId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS),
  saved: z.boolean(),
  status: z.literal("ok")
});

export const bulkClientIdentificationResponseSchema = z.object({
  batchId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS),
  candidates: z.array(bulkClientIdentificationCandidateSchema).default([]),
  domain: z.string().trim().min(1).max(240),
  recentCustomers: z.array(customerSummarySchema).default([]),
  status: z.literal("ok")
});

export const bulkClientIdentificationDecisionRequestSchema = z.object({
  acceptRequestIds: z.array(z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS)).default([]),
  batchId: z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS),
  rejectRequestIds: z.array(z.string().trim().min(1).max(MAX_REQUEST_ID_CHARS)).default([])
});

export const bulkClientIdentificationDecisionResponseSchema = z.object({
  acceptedCount: z.number().int().nonnegative(),
  domain: z.string().trim().min(1).max(240),
  recentCustomers: z.array(customerSummarySchema).default([]),
  rejectedCount: z.number().int().nonnegative(),
  savedCustomers: z.array(customerSummarySchema).default([]),
  status: z.literal("ok")
});

export const clientIdentificationApiResponseSchema = z.union([
  clientIdentificationSuccessResponseSchema,
  apiErrorResponseSchema
]);

export const clientIdentificationDecisionApiResponseSchema = z.union([
  clientIdentificationDecisionResponseSchema,
  apiErrorResponseSchema
]);

export const bulkClientIdentificationApiResponseSchema = z.union([
  bulkClientIdentificationResponseSchema,
  apiErrorResponseSchema
]);

export const bulkClientIdentificationDecisionApiResponseSchema = z.union([
  bulkClientIdentificationDecisionResponseSchema,
  apiErrorResponseSchema
]);

export type ManualSelection = z.infer<typeof manualSelectionSchema>;
export type DomSummary = z.infer<typeof domSummarySchema>;
export type ClientIdentificationRequest = z.infer<
  typeof clientIdentificationRequestSchema
>;
export type BulkListSelection = z.infer<typeof bulkListSelectionSchema>;
export type BulkIdentificationItem = z.infer<typeof bulkIdentificationItemSchema>;
export type BulkClientIdentificationRequest = z.infer<
  typeof bulkClientIdentificationRequestSchema
>;
export type AiClientIdentificationResult = z.infer<
  typeof aiClientIdentificationResultSchema
>;
export type ClientIdentificationSuccessResponse = z.infer<
  typeof clientIdentificationSuccessResponseSchema
>;
export type ClientIdentificationApiResponse = z.infer<
  typeof clientIdentificationApiResponseSchema
>;
export type ClientIdentificationDecisionRequest = z.infer<
  typeof clientIdentificationDecisionRequestSchema
>;
export type ClientIdentificationDecisionResponse = z.infer<
  typeof clientIdentificationDecisionResponseSchema
>;
export type ClientIdentificationDecisionApiResponse = z.infer<
  typeof clientIdentificationDecisionApiResponseSchema
>;
export type ClientIdentificationSaveState = z.infer<
  typeof clientIdentificationSaveStateSchema
>;
export type PendingClientSummary = z.infer<typeof pendingClientSummarySchema>;
export type BulkClientIdentificationCandidate = z.infer<
  typeof bulkClientIdentificationCandidateSchema
>;
export type BulkClientIdentificationResponse = z.infer<
  typeof bulkClientIdentificationResponseSchema
>;
export type BulkClientIdentificationApiResponse = z.infer<
  typeof bulkClientIdentificationApiResponseSchema
>;
export type BulkClientIdentificationDecisionRequest = z.infer<
  typeof bulkClientIdentificationDecisionRequestSchema
>;
export type BulkClientIdentificationDecisionResponse = z.infer<
  typeof bulkClientIdentificationDecisionResponseSchema
>;
export type BulkClientIdentificationDecisionApiResponse = z.infer<
  typeof bulkClientIdentificationDecisionApiResponseSchema
>;
