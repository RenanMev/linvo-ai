import type {
  AuthLoginRequest,
  AuthRegisterRequest,
  AuthSessionResponse,
  AuthUser,
  BulkClientIdentificationApiResponse,
  BulkClientIdentificationDecisionApiResponse,
  BulkClientIdentificationDecisionRequest,
  BulkClientIdentificationRequest,
  ClientIdentificationDecisionApiResponse,
  ClientIdentificationDecisionRequest,
  ClientIdentificationApiResponse,
  ClientIdentificationRequest
} from "@linvo-ai/shared";

export type RuntimeRequestMessage =
  | { type: "auth/login"; request: AuthLoginRequest }
  | { type: "auth/register"; request: AuthRegisterRequest }
  | { type: "auth/logout" }
  | { type: "auth/me" }
  | { type: "assist/client-identification.request"; request: ClientIdentificationRequest }
  | { type: "assist/client-identification.decision"; request: ClientIdentificationDecisionRequest }
  | { type: "assist/client-identification.bulk.request"; request: BulkClientIdentificationRequest }
  | { type: "assist/client-identification.bulk.decision"; request: BulkClientIdentificationDecisionRequest };

export type RuntimeResponseMessage =
  | { ok: true; response: AuthSessionResponse }
  | { ok: true; user: AuthUser | null }
  | { ok: true; response: ClientIdentificationApiResponse }
  | { ok: true; response: ClientIdentificationDecisionApiResponse }
  | { ok: true; response: BulkClientIdentificationApiResponse }
  | { ok: true; response: BulkClientIdentificationDecisionApiResponse }
  | { ok: true }
  | { error: { errorCode: string; message: string }; ok: false };

export interface IdentificationUpdatedMessage {
  response: ClientIdentificationApiResponse;
  type: "assist/client-identification.updated";
}

export interface BulkIdentificationUpdatedMessage {
  response: BulkClientIdentificationApiResponse;
  type: "assist/client-identification.bulk.updated";
}
