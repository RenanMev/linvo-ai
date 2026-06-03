import { z } from "zod";

import {
  MAX_CUSTOMER_CHAT_MESSAGE_CHARS,
  MAX_CUSTOMER_CHAT_SUMMARY_CHARS
} from "../limits";
import { apiErrorResponseSchema } from "./errors";

export const customerChatRoleSchema = z.enum(["user", "assistant"]);

export const customerChatMessageStatusSchema = z.enum([
  "completed",
  "streaming",
  "interrupted",
  "error"
]);

export const customerChatMessageSchema = z.object({
  content: z.string().max(MAX_CUSTOMER_CHAT_MESSAGE_CHARS),
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
  role: customerChatRoleSchema,
  sequence: z.number().int().nonnegative(),
  status: customerChatMessageStatusSchema
});

export const customerChatThreadResponseSchema = z.object({
  customerId: z.string().uuid(),
  messages: z.array(customerChatMessageSchema).default([]),
  status: z.literal("ok"),
  summary: z.string().max(MAX_CUSTOMER_CHAT_SUMMARY_CHARS).nullable().default(null)
});

export const customerChatThreadApiResponseSchema = z.union([
  customerChatThreadResponseSchema,
  apiErrorResponseSchema
]);

export const customerChatStreamRequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_CUSTOMER_CHAT_MESSAGE_CHARS)
});

export const customerChatClearResponseSchema = z.object({
  customerId: z.string().uuid(),
  deletedMessages: z.number().int().nonnegative(),
  status: z.literal("ok")
});

export const customerChatClearApiResponseSchema = z.union([
  customerChatClearResponseSchema,
  apiErrorResponseSchema
]);

export const customerChatStreamStartEventSchema = z.object({
  messageId: z.string().uuid()
});

export const customerChatStreamDeltaEventSchema = z.object({
  text: z.string()
});

export const customerChatStreamCompleteEventSchema = z.object({
  message: customerChatMessageSchema,
  summary: z.string().max(MAX_CUSTOMER_CHAT_SUMMARY_CHARS).nullable().default(null)
});

export const customerChatStreamErrorEventSchema = z.object({
  message: z.string().trim().min(1).max(240)
});

export type CustomerChatRole = z.infer<typeof customerChatRoleSchema>;
export type CustomerChatMessageStatus = z.infer<typeof customerChatMessageStatusSchema>;
export type CustomerChatMessage = z.infer<typeof customerChatMessageSchema>;
export type CustomerChatThreadResponse = z.infer<typeof customerChatThreadResponseSchema>;
export type CustomerChatThreadApiResponse = z.infer<typeof customerChatThreadApiResponseSchema>;
export type CustomerChatStreamRequest = z.infer<typeof customerChatStreamRequestSchema>;
export type CustomerChatClearResponse = z.infer<typeof customerChatClearResponseSchema>;
export type CustomerChatClearApiResponse = z.infer<typeof customerChatClearApiResponseSchema>;
export type CustomerChatStreamStartEvent = z.infer<typeof customerChatStreamStartEventSchema>;
export type CustomerChatStreamDeltaEvent = z.infer<typeof customerChatStreamDeltaEventSchema>;
export type CustomerChatStreamCompleteEvent = z.infer<typeof customerChatStreamCompleteEventSchema>;
export type CustomerChatStreamErrorEvent = z.infer<typeof customerChatStreamErrorEventSchema>;
