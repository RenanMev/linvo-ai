import type { ApiErrorCode, AuthTokens, AuthUser } from "@linvo-ai/shared";

const authSessionMocks = vi.hoisted(() => ({
  clearAuthSession: vi.fn(),
  getAuthSession: vi.fn(),
  setAuthSession: vi.fn()
}));

const apiClientMocks = vi.hoisted(() => ({
  isApiClientError: vi.fn().mockReturnValue(false),
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  refresh: vi.fn(),
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn()
}));

vi.mock("../src/lib/auth-session", () => authSessionMocks);
vi.mock("../src/lib/api-client", () => apiClientMocks);

import { handleAuthMessage } from "../src/background/auth-orchestrator";

const user: AuthUser = {
  email: "renan@example.com",
  id: "f3f0a8d1-2d61-4b83-9e41-36b2e6db15d7"
};

const tokens: AuthTokens = {
  accessToken: "access-token",
  expiresIn: 900,
  refreshToken: "refresh-token"
};

function apiError(errorCode: ApiErrorCode, message: string): Error & { errorCode: ApiErrorCode } {
  return Object.assign(new Error(message), { errorCode });
}

describe("handleAuthMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClientMocks.isApiClientError.mockReturnValue(false);
  });

  it("does not clear the stored session when auth/me fails for a non-auth reason", async () => {
    const serverError = apiError("INTERNAL_ERROR", "Nao foi possivel conectar ao servidor local.");
    authSessionMocks.getAuthSession.mockResolvedValueOnce({ tokens, user });
    apiClientMocks.isApiClientError.mockImplementation((error) => error === serverError);
    apiClientMocks.me.mockRejectedValueOnce(serverError);
    const sendResponse = vi.fn();

    const handled = handleAuthMessage({ type: "auth/me" }, sendResponse);

    expect(handled).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(apiClientMocks.refresh).not.toHaveBeenCalled();
    expect(authSessionMocks.clearAuthSession).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      error: {
        errorCode: "INTERNAL_ERROR",
        message: "Nao foi possivel conectar ao servidor local."
      },
      ok: false
    });
  });

  it("clears the stored session when refresh confirms the session is invalid", async () => {
    const expiredAccessError = apiError("AUTH_REQUIRED", "Entre novamente para continuar.");
    const expiredRefreshError = apiError("REFRESH_TOKEN_INVALID", "Sessao expirada. Entre novamente.");
    authSessionMocks.getAuthSession.mockResolvedValueOnce({ tokens, user });
    apiClientMocks.isApiClientError.mockImplementation((error) =>
      error === expiredAccessError || error === expiredRefreshError
    );
    apiClientMocks.me.mockRejectedValueOnce(expiredAccessError);
    apiClientMocks.refresh.mockRejectedValueOnce(expiredRefreshError);
    const sendResponse = vi.fn();

    const handled = handleAuthMessage({ type: "auth/me" }, sendResponse);

    expect(handled).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(authSessionMocks.clearAuthSession).toHaveBeenCalledOnce();
    expect(sendResponse).toHaveBeenCalledWith({
      error: {
        errorCode: "REFRESH_TOKEN_INVALID",
        message: "Sessao expirada. Entre novamente."
      },
      ok: false
    });
  });
});
