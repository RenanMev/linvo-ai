import { z } from "zod";

import {
  MAX_CUSTOMER_NOTES_CHARS,
  MAX_DOM_LABEL_CHARS,
  MAX_NAME_CHARS
} from "../limits";
import { apiErrorResponseSchema } from "./errors";

export const customerFavoriteFieldSchema = z.enum([
  "protocol",
  "phone",
  "email",
  "document",
  "caseStatus",
  "caseSubject",
  "domain",
  "lastSeenAt"
]);

export const customerFavoriteFieldsSchema = z
  .array(customerFavoriteFieldSchema)
  .max(2)
  .default([]);

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
  domain: z.string().trim().min(1).max(240).optional(),
  favoriteFields: customerFavoriteFieldsSchema,
  id: z.string().uuid(),
  isStarred: z.boolean().default(false),
  lastSeenAt: z.string().datetime(),
  maskedIdentifiers: maskedIdentifiersSchema,
  notes: z.string().max(MAX_CUSTOMER_NOTES_CHARS).optional()
});

export const customerDetailSchema = customerSummarySchema;

export const customerDetailResponseSchema = z.object({
  customer: customerDetailSchema,
  status: z.literal("ok")
});

export const customerDetailApiResponseSchema = z.union([
  customerDetailResponseSchema,
  apiErrorResponseSchema
]);

export const customersListResponseSchema = z.object({
  customers: z.array(customerSummarySchema).default([]),
  domain: z.string().trim().min(1).max(240).optional(),
  status: z.literal("ok")
});

export const customerDeleteRequestSchema = z.object({
  customerId: z.string().uuid()
});

export const customerDeleteResponseSchema = z.object({
  customerId: z.string().uuid(),
  domain: z.string().trim().min(1).max(240),
  recentCustomers: z.array(customerSummarySchema).default([]),
  status: z.literal("ok")
});

export const customerDeleteApiResponseSchema = z.union([
  customerDeleteResponseSchema,
  apiErrorResponseSchema
]);

const customerUpdateTextSchema = z.string().trim().max(MAX_DOM_LABEL_CHARS);

export const customerUpdateRequestSchema = z.object({
  customerId: z.string().uuid(),
  case: z
    .object({
      caseId: z.string().uuid().optional(),
      protocol: customerUpdateTextSchema.optional(),
      status: customerUpdateTextSchema.optional(),
      subject: z.string().trim().max(MAX_NAME_CHARS).optional()
    })
    .optional(),
  displayName: z.string().trim().max(MAX_NAME_CHARS).optional(),
  maskedIdentifiers: z
    .object({
      document: customerUpdateTextSchema.optional(),
      email: customerUpdateTextSchema.optional(),
      phone: customerUpdateTextSchema.optional(),
      protocol: customerUpdateTextSchema.optional()
    })
    .optional(),
  favoriteFields: customerFavoriteFieldsSchema.optional(),
  isStarred: z.boolean().optional(),
  notes: z.string().max(MAX_CUSTOMER_NOTES_CHARS).optional()
});

export const customerUpdateResponseSchema = z.object({
  customer: customerSummarySchema,
  customers: z.array(customerSummarySchema).default([]),
  domain: z.string().trim().min(1).max(240),
  status: z.literal("ok")
});

export const customerUpdateApiResponseSchema = z.union([
  customerUpdateResponseSchema,
  apiErrorResponseSchema
]);

export type MaskedIdentifiers = z.infer<typeof maskedIdentifiersSchema>;
export type CustomerFavoriteField = z.infer<typeof customerFavoriteFieldSchema>;
export type CustomerCaseSummary = z.infer<typeof customerCaseSummarySchema>;
export type CustomerSummary = z.infer<typeof customerSummarySchema>;
export type CustomerDetail = z.infer<typeof customerDetailSchema>;
export type CustomerDetailResponse = z.infer<typeof customerDetailResponseSchema>;
export type CustomerDetailApiResponse = z.infer<typeof customerDetailApiResponseSchema>;
export type CustomersListResponse = z.infer<typeof customersListResponseSchema>;
export type CustomerDeleteRequest = z.infer<typeof customerDeleteRequestSchema>;
export type CustomerDeleteResponse = z.infer<typeof customerDeleteResponseSchema>;
export type CustomerDeleteApiResponse = z.infer<typeof customerDeleteApiResponseSchema>;
export type CustomerUpdateRequest = z.infer<typeof customerUpdateRequestSchema>;
export type CustomerUpdateResponse = z.infer<typeof customerUpdateResponseSchema>;
export type CustomerUpdateApiResponse = z.infer<typeof customerUpdateApiResponseSchema>;
