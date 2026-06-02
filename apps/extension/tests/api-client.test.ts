import type { ClientIdentificationRequest } from "@linvo-ai/shared";

import {
  ApiClientError,
  identifyClient,
  login,
  requestPasswordReset,
  resetPassword
} from "../src/lib/api-client";

function mockChrome() {
  vi.stubGlobal("chrome", {
    storage: {
      sync: {
        get: vi.fn().mockResolvedValue({})
      }
    }
  });
}

function mockFetchResponse(input: {
  body: unknown;
  ok: boolean;
  status: number;
}) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: input.ok,
    status: input.status,
    text: vi.fn().mockResolvedValue(JSON.stringify(input.body))
  }));
}

const identificationRequest: ClientIdentificationRequest = {
  capturedAt: new Date().toISOString(),
  manualSelection: {
    selectedAt: new Date().toISOString(),
    source: "user",
    textExcerpt: "Maria Silva - 12345"
  },
  pageTitle: "CRM",
  requestId: "req-1",
  selectedText: "Maria Silva - 12345",
  url: "https://crm.example.com/tickets/12345"
};

describe("api-client error handling", () => {
  beforeEach(() => {
    mockChrome();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws the backend message for failed login instead of a Zod validation dump", async () => {
    mockFetchResponse({
      body: {
        errorCode: "INVALID_CREDENTIALS",
        message: "Email ou senha invalidos.",
        status: "error"
      },
      ok: false,
      status: 401
    });

    await expect(login({ email: "user@example.com", password: "wrong-pass" }))
      .rejects
      .toMatchObject({
        errorCode: "INVALID_CREDENTIALS",
        message: "Email ou senha invalidos.",
        statusCode: 401
      } satisfies Partial<ApiClientError>);
  });

  it("uses a friendly message for unexpected auth response shapes", async () => {
    mockFetchResponse({
      body: {
        status: "ok"
      },
      ok: true,
      status: 200
    });

    await expect(login({ email: "user@example.com", password: "12345678" }))
      .rejects
      .toThrow("O servidor respondeu em um formato inesperado.");
  });

  it("returns assist API error payloads for the sidepanel to render", async () => {
    mockFetchResponse({
      body: {
        errorCode: "AI_UNAVAILABLE",
        message: "A chave de IA do servidor nao esta configurada.",
        requestId: "req-1",
        status: "error"
      },
      ok: false,
      status: 503
    });

    await expect(identifyClient("access-token", identificationRequest)).resolves.toEqual({
      errorCode: "AI_UNAVAILABLE",
      message: "A chave de IA do servidor nao esta configurada.",
      requestId: "req-1",
      status: "error"
    });
  });

  it("requests password reset and returns the dev code when available", async () => {
    mockFetchResponse({
      body: {
        resetCode: "123456",
        status: "ok"
      },
      ok: true,
      status: 200
    });

    await expect(requestPasswordReset({ email: "user@example.com" })).resolves.toEqual({
      resetCode: "123456",
      status: "ok"
    });
  });

  it("confirms password reset", async () => {
    mockFetchResponse({
      body: {
        status: "ok"
      },
      ok: true,
      status: 200
    });

    await expect(resetPassword({
      password: "new-password",
      resetCode: "123456"
    })).resolves.toBeUndefined();
  });
});
