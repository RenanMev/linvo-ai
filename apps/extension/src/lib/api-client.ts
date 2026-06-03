import {
  apiErrorResponseSchema,
  authApiResponseSchema,
  authMeResponseSchema,
  authOkResponseSchema,
  authPasswordResetRequestResponseSchema,
  authRefreshResponseSchema,
  authSessionResponseSchema,
  bulkClientIdentificationDecisionApiResponseSchema,
  bulkClientIdentificationApiResponseSchema,
  clientInfoOpenApiResponseSchema,
  clientIdentificationDecisionApiResponseSchema,
  clientIdentificationApiResponseSchema,
  customerDeleteApiResponseSchema,
  customerUpdateApiResponseSchema,
  customersListResponseSchema,
  siteContextDeleteApiResponseSchema,
  siteContextGetApiResponseSchema,
  type ApiErrorCode,
  type AuthLoginRequest,
  type AuthPasswordResetConfirmRequest,
  type AuthPasswordResetRequest,
  type AuthPasswordResetRequestResponse,
  type AuthRegisterRequest,
  type AuthSessionResponse,
  type AuthTokens,
  type AuthUser,
  type BulkClientIdentificationDecisionApiResponse,
  type BulkClientIdentificationDecisionRequest,
  type BulkClientIdentificationApiResponse,
  type BulkClientIdentificationRequest,
  type ClientInfoOpenApiResponse,
  type ClientInfoOpenRequest,
  type ClientIdentificationDecisionApiResponse,
  type ClientIdentificationDecisionRequest,
  type ClientIdentificationApiResponse,
  type ClientIdentificationRequest,
  type CustomerDeleteApiResponse,
  type CustomerDeleteRequest,
  type CustomerUpdateApiResponse,
  type CustomerUpdateRequest,
  type CustomersListResponse,
  type SiteContextDeleteApiResponse,
  type SiteContextDeleteRequest,
  type SiteContextGetApiResponse
} from "@linvo-ai/shared";

const BACKEND_URL_KEY = "linvo-ai.backend-url";
const DEFAULT_BACKEND_URL = "http://127.0.0.1:8791";

interface JsonHttpResponse {
  body: unknown;
  ok: boolean;
  status: number;
}

type Schema<T> = {
  safeParse: (value: unknown) => { data: T; success: true } | { success: false };
};

export class ApiClientError extends Error {
  constructor(
    readonly errorCode: ApiErrorCode,
    message: string,
    readonly statusCode?: number
  ) {
    super(message);
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

function isAuthErrorCode(errorCode: ApiErrorCode): boolean {
  return errorCode === "AUTH_REQUIRED" || errorCode === "REFRESH_TOKEN_INVALID";
}

export async function getBackendUrl(): Promise<string> {
  const stored = await chrome.storage.sync.get(BACKEND_URL_KEY);
  const value = stored[BACKEND_URL_KEY];
  return typeof value === "string" && value.trim() ? value : DEFAULT_BACKEND_URL;
}

function buildUrl(baseUrl: string, path: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), normalized).toString();
}

function apiErrorFromBody(body: unknown, statusCode: number): ApiClientError | null {
  const parsed = apiErrorResponseSchema.safeParse(body);

  if (!parsed.success) {
    return null;
  }

  return new ApiClientError(parsed.data.errorCode, parsed.data.message, statusCode);
}

function unexpectedResponse(statusCode?: number): ApiClientError {
  return new ApiClientError(
    "INTERNAL_ERROR",
    "O servidor respondeu em um formato inesperado. Tente novamente em instantes.",
    statusCode
  );
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiClientError(
      "INTERNAL_ERROR",
      "O servidor respondeu com dados invalidos. Tente novamente em instantes.",
      response.status
    );
  }
}

async function requestJson(
  method: "GET" | "POST",
  baseUrl: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<JsonHttpResponse> {
  let response: Response;

  try {
    response = await fetch(buildUrl(baseUrl, path), {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: {
        accept: "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" })
      },
      method
    });
  } catch {
    throw new ApiClientError(
      "INTERNAL_ERROR",
      "Nao foi possivel conectar ao servidor local. Verifique se o Linvo AI Server esta aberto."
    );
  }

  return {
    body: await readJson(response),
    ok: response.ok,
    status: response.status
  };
}

async function postJson(baseUrl: string, path: string, body: unknown, token?: string): Promise<JsonHttpResponse> {
  return requestJson("POST", baseUrl, path, body, token);
}

async function getJson(baseUrl: string, path: string, token?: string): Promise<JsonHttpResponse> {
  return requestJson("GET", baseUrl, path, undefined, token);
}

function parseSchema<T>(
  schema: Schema<T>,
  response: JsonHttpResponse,
  options: { throwApiError?: boolean; throwAuthError?: boolean } = {}
): T {
  const apiError = apiErrorFromBody(response.body, response.status);

  if (
    apiError &&
    (
      options.throwApiError !== false ||
      (options.throwAuthError !== false && isAuthErrorCode(apiError.errorCode))
    )
  ) {
    throw apiError;
  }

  const parsed = schema.safeParse(response.body);

  if (parsed.success) {
    return parsed.data;
  }

  if (!response.ok) {
    throw unexpectedResponse(response.status);
  }

  throw unexpectedResponse(response.status);
}

function parseAuthSessionResponse(response: JsonHttpResponse): AuthSessionResponse {
  const parsed = parseSchema(authApiResponseSchema, response);

  if (parsed.status === "error") {
    throw new ApiClientError(parsed.errorCode, parsed.message, response.status);
  }

  const session = authSessionResponseSchema.safeParse(parsed);

  if (!session.success) {
    throw unexpectedResponse(response.status);
  }

  return session.data;
}

export async function login(request: AuthLoginRequest): Promise<AuthSessionResponse> {
  return parseAuthSessionResponse(await postJson(await getBackendUrl(), "/auth/login", request));
}

export async function register(request: AuthRegisterRequest): Promise<AuthSessionResponse> {
  return parseAuthSessionResponse(await postJson(await getBackendUrl(), "/auth/register", request));
}

export async function requestPasswordReset(
  request: AuthPasswordResetRequest
): Promise<AuthPasswordResetRequestResponse> {
  return parseSchema(
    authPasswordResetRequestResponseSchema,
    await postJson(await getBackendUrl(), "/auth/password-reset/request", request)
  );
}

export async function resetPassword(request: AuthPasswordResetConfirmRequest): Promise<void> {
  parseSchema(
    authOkResponseSchema,
    await postJson(await getBackendUrl(), "/auth/password-reset/confirm", request)
  );
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const parsed = parseSchema(authApiResponseSchema, await postJson(await getBackendUrl(), "/auth/refresh", { refreshToken }));

  if (parsed.status === "error") {
    throw new ApiClientError(parsed.errorCode, parsed.message);
  }

  const refreshResponse = authRefreshResponseSchema.safeParse(parsed);

  if (!refreshResponse.success) {
    throw unexpectedResponse();
  }

  return refreshResponse.data.tokens;
}

export async function logout(refreshToken: string): Promise<void> {
  await postJson(await getBackendUrl(), "/auth/logout", { refreshToken });
}

export async function me(accessToken: string): Promise<AuthUser> {
  const parsed = parseSchema(authApiResponseSchema, await getJson(await getBackendUrl(), "/auth/me", accessToken));

  if (parsed.status === "error") {
    throw new ApiClientError(parsed.errorCode, parsed.message);
  }

  const meResponse = authMeResponseSchema.safeParse(parsed);

  if (!meResponse.success) {
    throw unexpectedResponse();
  }

  return meResponse.data.user;
}

export async function identifyClient(
  accessToken: string,
  request: ClientIdentificationRequest
): Promise<ClientIdentificationApiResponse> {
  return parseSchema(
    clientIdentificationApiResponseSchema,
    await postJson(await getBackendUrl(), "/assist/client-identification", request, accessToken),
    { throwApiError: false }
  );
}

export async function openClientInfo(
  accessToken: string,
  request: ClientInfoOpenRequest
): Promise<ClientInfoOpenApiResponse> {
  return parseSchema(
    clientInfoOpenApiResponseSchema,
    await postJson(await getBackendUrl(), "/assist/client-info/open", request, accessToken),
    { throwApiError: false }
  );
}

export async function decideClientIdentification(
  accessToken: string,
  request: ClientIdentificationDecisionRequest
): Promise<ClientIdentificationDecisionApiResponse> {
  return parseSchema(
    clientIdentificationDecisionApiResponseSchema,
    await postJson(
      await getBackendUrl(),
      "/assist/client-identification/decision",
      request,
      accessToken
    ),
    { throwApiError: false }
  );
}

export async function identifyClientsBulk(
  accessToken: string,
  request: BulkClientIdentificationRequest
): Promise<BulkClientIdentificationApiResponse> {
  return parseSchema(
    bulkClientIdentificationApiResponseSchema,
    await postJson(await getBackendUrl(), "/assist/client-identification/bulk", request, accessToken),
    { throwApiError: false }
  );
}

export async function decideBulkClientIdentification(
  accessToken: string,
  request: BulkClientIdentificationDecisionRequest
): Promise<BulkClientIdentificationDecisionApiResponse> {
  return parseSchema(
    bulkClientIdentificationDecisionApiResponseSchema,
    await postJson(
      await getBackendUrl(),
      "/assist/client-identification/bulk/decision",
      request,
      accessToken
    ),
    { throwApiError: false }
  );
}

export async function listCustomers(
  accessToken: string,
  domain?: string
): Promise<CustomersListResponse> {
  const query = domain ? `?domain=${encodeURIComponent(domain)}` : "";

  return parseSchema(
    customersListResponseSchema,
    await getJson(
      await getBackendUrl(),
      `/assist/customers${query}`,
      accessToken
    )
  );
}

export async function getSiteContext(
  accessToken: string,
  domain: string
): Promise<SiteContextGetApiResponse> {
  return parseSchema(
    siteContextGetApiResponseSchema,
    await getJson(
      await getBackendUrl(),
      `/assist/site-context?domain=${encodeURIComponent(domain)}`,
      accessToken
    ),
    { throwApiError: false }
  );
}

export async function deleteSiteContext(
  accessToken: string,
  request: SiteContextDeleteRequest
): Promise<SiteContextDeleteApiResponse> {
  return parseSchema(
    siteContextDeleteApiResponseSchema,
    await postJson(await getBackendUrl(), "/assist/site-context/delete", request, accessToken),
    { throwApiError: false }
  );
}

export async function deleteCustomer(
  accessToken: string,
  request: CustomerDeleteRequest
): Promise<CustomerDeleteApiResponse> {
  return parseSchema(
    customerDeleteApiResponseSchema,
    await postJson(await getBackendUrl(), "/assist/customers/delete", request, accessToken),
    { throwApiError: false }
  );
}

export async function updateCustomer(
  accessToken: string,
  request: CustomerUpdateRequest
): Promise<CustomerUpdateApiResponse> {
  return parseSchema(
    customerUpdateApiResponseSchema,
    await postJson(await getBackendUrl(), "/assist/customers/update", request, accessToken),
    { throwApiError: false }
  );
}
