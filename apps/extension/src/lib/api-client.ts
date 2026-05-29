import {
  authApiResponseSchema,
  authSessionResponseSchema,
  authMeResponseSchema,
  authRefreshResponseSchema,
  bulkClientIdentificationDecisionApiResponseSchema,
  bulkClientIdentificationApiResponseSchema,
  clientIdentificationDecisionApiResponseSchema,
  clientIdentificationApiResponseSchema,
  customersListResponseSchema,
  type AuthLoginRequest,
  type AuthRegisterRequest,
  type AuthSessionResponse,
  type AuthTokens,
  type AuthUser,
  type BulkClientIdentificationDecisionApiResponse,
  type BulkClientIdentificationDecisionRequest,
  type BulkClientIdentificationApiResponse,
  type BulkClientIdentificationRequest,
  type ClientIdentificationDecisionApiResponse,
  type ClientIdentificationDecisionRequest,
  type ClientIdentificationApiResponse,
  type ClientIdentificationRequest,
  type CustomersListResponse
} from "@linvo-ai/shared";

const BACKEND_URL_KEY = "linvo-ai.backend-url";
const DEFAULT_BACKEND_URL = "http://127.0.0.1:8791";

export async function getBackendUrl(): Promise<string> {
  const stored = await chrome.storage.sync.get(BACKEND_URL_KEY);
  const value = stored[BACKEND_URL_KEY];
  return typeof value === "string" && value.trim() ? value : DEFAULT_BACKEND_URL;
}

function buildUrl(baseUrl: string, path: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), normalized).toString();
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function postJson(baseUrl: string, path: string, body: unknown, token?: string): Promise<unknown> {
  const response = await fetch(buildUrl(baseUrl, path), {
    body: JSON.stringify(body),
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json"
    },
    method: "POST"
  });
  return readJson(response);
}

export async function login(request: AuthLoginRequest): Promise<AuthSessionResponse> {
  const parsed = authApiResponseSchema.parse(
    await postJson(await getBackendUrl(), "/auth/login", request)
  );

  return authSessionResponseSchema.parse(parsed);
}

export async function register(request: AuthRegisterRequest): Promise<AuthSessionResponse> {
  const parsed = authApiResponseSchema.parse(
    await postJson(await getBackendUrl(), "/auth/register", request)
  );

  return authSessionResponseSchema.parse(parsed);
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const parsed = authRefreshResponseSchema.parse(
    await postJson(await getBackendUrl(), "/auth/refresh", { refreshToken })
  );

  return parsed.tokens;
}

export async function logout(refreshToken: string): Promise<void> {
  await postJson(await getBackendUrl(), "/auth/logout", { refreshToken });
}

export async function me(accessToken: string): Promise<AuthUser> {
  const response = await fetch(buildUrl(await getBackendUrl(), "/auth/me"), {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`
    }
  });

  return authMeResponseSchema.parse(await readJson(response)).user;
}

export async function identifyClient(
  accessToken: string,
  request: ClientIdentificationRequest
): Promise<ClientIdentificationApiResponse> {
  return clientIdentificationApiResponseSchema.parse(
    await postJson(await getBackendUrl(), "/assist/client-identification", request, accessToken)
  );
}

export async function decideClientIdentification(
  accessToken: string,
  request: ClientIdentificationDecisionRequest
): Promise<ClientIdentificationDecisionApiResponse> {
  return clientIdentificationDecisionApiResponseSchema.parse(
    await postJson(
      await getBackendUrl(),
      "/assist/client-identification/decision",
      request,
      accessToken
    )
  );
}

export async function identifyClientsBulk(
  accessToken: string,
  request: BulkClientIdentificationRequest
): Promise<BulkClientIdentificationApiResponse> {
  return bulkClientIdentificationApiResponseSchema.parse(
    await postJson(await getBackendUrl(), "/assist/client-identification/bulk", request, accessToken)
  );
}

export async function decideBulkClientIdentification(
  accessToken: string,
  request: BulkClientIdentificationDecisionRequest
): Promise<BulkClientIdentificationDecisionApiResponse> {
  return bulkClientIdentificationDecisionApiResponseSchema.parse(
    await postJson(
      await getBackendUrl(),
      "/assist/client-identification/bulk/decision",
      request,
      accessToken
    )
  );
}

export async function listCustomers(
  accessToken: string,
  domain: string
): Promise<CustomersListResponse> {
  const response = await fetch(
    buildUrl(await getBackendUrl(), `/assist/customers?domain=${encodeURIComponent(domain)}`),
    {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`
      }
    }
  );

  return customersListResponseSchema.parse(await readJson(response));
}
