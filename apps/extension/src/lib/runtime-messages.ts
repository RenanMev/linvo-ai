import type {
  AuthLoginRequest,
  AuthPasswordResetConfirmRequest,
  AuthPasswordResetRequest,
  AuthPasswordResetRequestResponse,
  AuthRegisterRequest,
  AuthSessionResponse,
  AuthUser,
  BulkClientIdentificationApiResponse,
  BulkClientIdentificationDecisionApiResponse,
  BulkClientIdentificationDecisionRequest,
  BulkClientIdentificationRequest,
  ClientInfoOpenApiResponse,
  ClientInfoOpenRequest,
  ClientIdentificationDecisionApiResponse,
  ClientIdentificationDecisionRequest,
  ClientIdentificationApiResponse,
  ClientIdentificationRequest,
  CustomerDeleteApiResponse,
  CustomerDeleteRequest,
  CustomerUpdateApiResponse,
  CustomerUpdateRequest,
  CustomersListResponse
} from "@linvo-ai/shared";

export const CLIENT_INFO_OPEN_SELECTION_STORAGE_KEY =
  "linvoAiClientInfoOpenSelection:v1";

export type RuntimeRequestMessage =
  | { type: "auth/login"; request: AuthLoginRequest }
  | { type: "auth/register"; request: AuthRegisterRequest }
  | { type: "auth/password-reset.request"; request: AuthPasswordResetRequest }
  | { type: "auth/password-reset.confirm"; request: AuthPasswordResetConfirmRequest }
  | { type: "auth/logout" }
  | { type: "auth/me" }
  | { type: "ui/open-sidepanel" }
  | { type: "assist/client-info.open.request"; request: ClientInfoOpenRequest }
  | { type: "assist/client-identification.request"; request: ClientIdentificationRequest }
  | { type: "assist/client-identification.decision"; request: ClientIdentificationDecisionRequest }
  | { type: "assist/client-identification.bulk.request"; request: BulkClientIdentificationRequest }
  | { type: "assist/client-identification.bulk.decision"; request: BulkClientIdentificationDecisionRequest }
  | { type: "assist/customer.delete"; request: CustomerDeleteRequest }
  | { type: "assist/customer.update"; request: CustomerUpdateRequest }
  | { type: "assist/customers.list"; domain?: string };

export type RuntimeResponseMessage =
  | { ok: true; response: AuthSessionResponse }
  | { ok: true; response: AuthPasswordResetRequestResponse }
  | { ok: true; user: AuthUser | null }
  | { ok: true; response: ClientInfoOpenApiResponse }
  | { ok: true; response: ClientIdentificationApiResponse }
  | { ok: true; response: ClientIdentificationDecisionApiResponse }
  | { ok: true; response: BulkClientIdentificationApiResponse }
  | { ok: true; response: BulkClientIdentificationDecisionApiResponse }
  | { ok: true; response: CustomerDeleteApiResponse }
  | { ok: true; response: CustomerUpdateApiResponse }
  | { ok: true; response: CustomersListResponse }
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

export interface ClientInfoOpenedMessage {
  response: ClientInfoOpenApiResponse;
  type: "assist/client-info.opened";
}
