import { AiClientService } from "../src/ai/ai-client.service";
import type { AppConfig } from "../src/config/env.schema";
import { ApiHttpException } from "../src/http-error";
import type { ClientIdentificationRequest } from "@linvo-ai/shared";

const config: AppConfig = {
  AI_API_KEY: "test-api-key",
  AI_BASE_URL: "https://example.test/chat",
  AI_MODEL: "test-model",
  CORS_ALLOWED_ORIGINS: ["http://localhost:*"],
  DATABASE_URL: "postgresql://example",
  IDENTIFICATION_CONFIDENCE_MIN: 0.72,
  IDENTITY_HASH_SECRET: "identity-secret-for-tests",
  JWT_ACCESS_SECRET: "access-secret-for-tests",
  JWT_AUDIENCE: "linvo-ai-extension",
  JWT_ISSUER: "linvo-ai-server",
  JWT_REFRESH_SECRET: "refresh-secret-for-tests",
  NODE_ENV: "test",
  PASSWORD_PEPPER: "password-pepper-for-tests",
  PORT: 8791
};

const request: ClientIdentificationRequest = {
  capturedAt: new Date().toISOString(),
  manualSelection: {
    selectedAt: new Date().toISOString(),
    source: "user",
    textExcerpt: "Maria Silva - 12345"
  },
  pageTitle: "CRM",
  requestId: "req-ai-1",
  selectedText: "Maria Silva - 12345",
  url: "https://crm.example.com/tickets/12345"
};

function response(ok: boolean, json: () => Promise<unknown>): Response {
  return { json, ok } as unknown as Response;
}

async function expectApiError(operation: Promise<unknown>, statusCode: number): Promise<void> {
  try {
    await operation;
    throw new Error("Expected operation to throw.");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiHttpException);
    expect((error as ApiHttpException).getStatus()).toBe(statusCode);
  }
}

describe("AiClientService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 503 when the AI key is missing", async () => {
    const { AI_API_KEY, ...configWithoutKey } = config;
    const service = new AiClientService(configWithoutKey);

    await expectApiError(service.identifyClient(request), 503);
    expect(AI_API_KEY).toBe("test-api-key");
  });

  it("wraps network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const service = new AiClientService(config);

    await expectApiError(service.identifyClient(request), 502);
  });

  it("wraps non-ok AI responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(false, async () => ({}))));
    const service = new AiClientService(config);

    await expectApiError(service.identifyClient(request), 502);
  });

  it("wraps invalid response JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(true, async () => {
      throw new Error("bad json");
    })));
    const service = new AiClientService(config);

    await expectApiError(service.identifyClient(request), 502);
  });

  it("wraps invalid AI message JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(true, async () => ({
      choices: [{ message: { content: "not-json" } }]
    }))));
    const service = new AiClientService(config);

    await expectApiError(service.identifyClient(request), 502);
  });

  it("wraps AI content outside the contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(true, async () => ({
      choices: [{ message: { content: "{}" } }]
    }))));
    const service = new AiClientService(config);

    await expectApiError(service.identifyClient(request), 502);
  });
});
