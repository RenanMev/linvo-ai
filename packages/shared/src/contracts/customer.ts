import { z } from "zod";

import {
  MAX_DOM_LABEL_CHARS,
  MAX_NAME_CHARS
} from "../limits";

export const maskedIdentifiersSchema = z
  .object({
    document: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
    email: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
    phone: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
    protocol: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional()
  })
  .default({});

export const customerCaseSummarySchema = z.object({
  id: z.string().uuid(),
  lastSeenAt: z.string().datetime(),
  protocol: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
  status: z.string().trim().min(1).max(MAX_DOM_LABEL_CHARS).optional(),
  subject: z.string().trim().min(1).max(MAX_NAME_CHARS).optional()
});

export const customerSummarySchema = z.object({
  cases: z.array(customerCaseSummarySchema).default([]),
  displayName: z.string().trim().min(1).max(MAX_NAME_CHARS).optional(),
  id: z.string().uuid(),
  lastSeenAt: z.string().datetime(),
  maskedIdentifiers: maskedIdentifiersSchema
});

export const customersListResponseSchema = z.object({
  customers: z.array(customerSummarySchema).default([]),
  domain: z.string().trim().min(1).max(240),
  status: z.literal("ok")
});

export type MaskedIdentifiers = z.infer<typeof maskedIdentifiersSchema>;
export type CustomerCaseSummary = z.infer<typeof customerCaseSummarySchema>;
export type CustomerSummary = z.infer<typeof customerSummarySchema>;
export type CustomersListResponse = z.infer<typeof customersListResponseSchema>;
