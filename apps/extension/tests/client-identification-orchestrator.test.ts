import type {
  ApiErrorCode,
  AuthTokens,
  AuthUser,
  ClientInfoOpenApiResponse,
  ClientInfoOpenRequest
} from "@linvo-ai/shared";

const authSessionMocks = vi.hoisted(() => ({
  clearAuthSession: vi.fn(),
  getAuthSession: vi.fn(),
  setAuthSession: vi.fn()
}));

const apiClientMocks = vi.hoisted(() => ({
  clearCustomerChat: vi.fn(),
  decideBulkClientIdentification: vi.fn(),
  decideClientIdentification: vi.fn(),
  deleteCustomer: vi.fn(),
  deleteSiteContext: vi.fn(),
  getCustomerChat: vi.fn(),
  getCustomerDetail: vi.fn(),
  getSiteContext: vi.fn(),
  identifyClient: vi.fn(),
  identifyClientsBulk: vi.fn(),
  isApiClientError: vi.fn().mockReturnValue(false),
  listCustomers: vi.fn(),
  openClientInfo: vi.fn(),
  refresh: vi.fn(),
  updateCustomer: vi.fn()
}));

vi.mock("../src/lib/auth-session", () => authSessionMocks);
vi.mock("../src/lib/api-client", () => apiClientMocks);

import { handleClientIdentificationMessage } from "../src/background/client-identification-orchestrator";

const clientInfoRequest: ClientInfoOpenRequest = {
  capturedAt: new Date().toISOString(),
  pageText: "Cliente Maria Silva em atendimento",
  pageTitle: "CRM",
  requestId: "req-1",
  url: "https://crm.example.com/tickets/123"
};

const user: AuthUser = {
  email: "renan@example.com",
  id: "f3f0a8d1-2d61-4b83-9e41-36b2e6db15d7"
};

const tokens: AuthTokens = {
  accessToken: "access-token",
  expiresIn: 900,
  refreshToken: "refresh-token"
};

const refreshedTokens: AuthTokens = {
  accessToken: "new-access-token",
  expiresIn: 900,
  refreshToken: "new-refresh-token"
};

const clientInfoNoMatchResponse: ClientInfoOpenApiResponse = {
  customers: [],
  domain: "crm.example.com",
  reason: "Nenhum cliente encontrado.",
  requestId: "req-1",
  status: "no_match"
};

function apiError(errorCode: ApiErrorCode, message: string): Error & { errorCode: ApiErrorCode } {
  return Object.assign(new Error(message), { errorCode });
}

describe("handleClientIdentificationMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClientMocks.isApiClientError.mockReturnValue(false);
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn()
      },
      sidePanel: {
        open: vi.fn().mockResolvedValue(undefined)
      },
      storage: {
        local: {
          set: vi.fn()
        }
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the sidepanel when opening client info requires login", async () => {
    authSessionMocks.getAuthSession.mockResolvedValueOnce(null);
    const sendResponse = vi.fn();

    const handled = handleClientIdentificationMessage(
      {
        request: clientInfoRequest,
        type: "assist/client-info.open.request"
      },
      {
        tab: {
          id: 321
        }
      } as chrome.runtime.MessageSender,
      sendResponse
    );

    expect(handled).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(chrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 321 });
    expect(sendResponse).toHaveBeenCalledWith({
      error: {
        errorCode: "AUTH_REQUIRED",
        message: "Entre no Linvo AI para abrir informacoes do cliente."
      },
      ok: false
    });
  });

  it("refreshes an expired access token before opening client info", async () => {
    const expiredError = apiError("AUTH_REQUIRED", "Entre novamente para continuar.");
    authSessionMocks.getAuthSession.mockResolvedValueOnce({ tokens, user });
    apiClientMocks.isApiClientError.mockImplementation((error) => error === expiredError);
    apiClientMocks.openClientInfo
      .mockRejectedValueOnce(expiredError)
      .mockResolvedValueOnce(clientInfoNoMatchResponse);
    apiClientMocks.refresh.mockResolvedValueOnce(refreshedTokens);
    const sendResponse = vi.fn();

    const handled = handleClientIdentificationMessage(
      {
        request: clientInfoRequest,
        type: "assist/client-info.open.request"
      },
      {
        tab: {
          id: 321
        }
      } as chrome.runtime.MessageSender,
      sendResponse
    );

    expect(handled).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(apiClientMocks.openClientInfo).toHaveBeenNthCalledWith(1, "access-token", clientInfoRequest);
    expect(apiClientMocks.refresh).toHaveBeenCalledWith("refresh-token");
    expect(authSessionMocks.setAuthSession).toHaveBeenCalledWith({
      tokens: refreshedTokens,
      user
    });
    expect(apiClientMocks.openClientInfo).toHaveBeenNthCalledWith(2, "new-access-token", clientInfoRequest);
    expect(authSessionMocks.clearAuthSession).not.toHaveBeenCalled();
    expect(chrome.sidePanel.open).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      response: clientInfoNoMatchResponse
    });
  });

  it("does not clear the session when loading customers fails for a non-auth reason", async () => {
    const serverError = apiError("INTERNAL_ERROR", "O servidor respondeu em um formato inesperado.");
    authSessionMocks.getAuthSession.mockResolvedValueOnce({ tokens, user });
    apiClientMocks.isApiClientError.mockImplementation((error) => error === serverError);
    apiClientMocks.listCustomers.mockRejectedValueOnce(serverError);
    const sendResponse = vi.fn();

    const handled = handleClientIdentificationMessage(
      {
        type: "assist/customers.list"
      },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    expect(handled).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(apiClientMocks.refresh).not.toHaveBeenCalled();
    expect(authSessionMocks.clearAuthSession).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      error: {
        errorCode: "INTERNAL_ERROR",
        message: "O servidor respondeu em um formato inesperado."
      },
      ok: false
    });
  });
});
