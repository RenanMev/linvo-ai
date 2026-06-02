import type { RuntimeRequestMessage, RuntimeResponseMessage } from "../lib/runtime-messages";
import {
  clearAuthSession,
  getAuthSession,
  setAuthSession
} from "../lib/auth-session";
import {
  isApiClientError,
  login,
  logout,
  me,
  refresh,
  register,
  requestPasswordReset,
  resetPassword
} from "../lib/api-client";

function errorResponse(error: unknown): RuntimeResponseMessage {
  if (isApiClientError(error)) {
    return {
      error: {
        errorCode: error.errorCode,
        message: error.message
      },
      ok: false
    };
  }

  return {
    error: {
      errorCode: "AUTH_REQUIRED",
      message: error instanceof Error && error.message ? error.message : "Entre novamente."
    },
    ok: false
  };
}

export function handleAuthMessage(
  message: RuntimeRequestMessage,
  sendResponse: (response: RuntimeResponseMessage) => void
): boolean | undefined {
  if (!message.type.startsWith("auth/")) {
    return undefined;
  }

  void (async () => {
    try {
      if (message.type === "auth/login") {
        const response = await login(message.request);
        await setAuthSession({ tokens: response.tokens, user: response.user });
        sendResponse({ ok: true, response });
        return;
      }

      if (message.type === "auth/register") {
        const response = await register(message.request);
        await setAuthSession({ tokens: response.tokens, user: response.user });
        sendResponse({ ok: true, response });
        return;
      }

      if (message.type === "auth/password-reset.request") {
        const response = await requestPasswordReset(message.request);
        sendResponse({ ok: true, response });
        return;
      }

      if (message.type === "auth/password-reset.confirm") {
        await resetPassword(message.request);
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "auth/logout") {
        const session = await getAuthSession();
        if (session) {
          await logout(session.tokens.refreshToken);
        }
        await clearAuthSession();
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "auth/me") {
        const session = await getAuthSession();
        if (!session) {
          sendResponse({ ok: true, user: null });
          return;
        }

        try {
          const user = await me(session.tokens.accessToken);
          sendResponse({ ok: true, user });
        } catch {
          const tokens = await refresh(session.tokens.refreshToken);
          await setAuthSession({ tokens, user: session.user });
          sendResponse({ ok: true, user: session.user });
        }
      }
    } catch (error) {
      await clearAuthSession();
      sendResponse(errorResponse(error));
    }
  })();

  return true;
}
