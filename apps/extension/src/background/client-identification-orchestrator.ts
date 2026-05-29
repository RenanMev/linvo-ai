import { MAX_SCREENSHOT_DATA_URL_CHARS } from "@linvo-ai/shared";

import type {
  RuntimeRequestMessage,
  RuntimeResponseMessage
} from "../lib/runtime-messages";
import {
  clearAuthSession,
  getAuthSession,
  setAuthSession
} from "../lib/auth-session";
import {
  decideBulkClientIdentification,
  decideClientIdentification,
  identifyClient,
  identifyClientsBulk,
  refresh
} from "../lib/api-client";

async function captureScreenshot(sender: chrome.runtime.MessageSender): Promise<string | undefined> {
  if (sender.tab?.windowId === undefined || !chrome.tabs.captureVisibleTab) {
    return undefined;
  }

  for (const quality of [45, 30, 20]) {
    try {
      const screenshotDataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, {
        format: "jpeg",
        quality
      });

      if (screenshotDataUrl.length <= MAX_SCREENSHOT_DATA_URL_CHARS) {
        return screenshotDataUrl;
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
}

async function getAccessToken(): Promise<string | null> {
  const session = await getAuthSession();

  if (!session) {
    return null;
  }

  try {
    return session.tokens.accessToken;
  } catch {
    return null;
  }
}

export function handleClientIdentificationMessage(
  message: RuntimeRequestMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: RuntimeResponseMessage) => void
): boolean | undefined {
  if (
    message.type !== "assist/client-identification.request" &&
    message.type !== "assist/client-identification.decision" &&
    message.type !== "assist/client-identification.bulk.request" &&
    message.type !== "assist/client-identification.bulk.decision"
  ) {
    return undefined;
  }

  if (message.type === "assist/client-identification.decision") {
    void (async () => {
      const session = await getAuthSession();

      if (!session) {
        sendResponse({
          error: {
            errorCode: "AUTH_REQUIRED",
            message: "Entre novamente para atualizar clientes."
          },
          ok: false
        });
        return;
      }

      let accessToken = await getAccessToken();

      try {
        const response = await decideClientIdentification(
          accessToken ?? session.tokens.accessToken,
          message.request
        );
        sendResponse({ ok: true, response });
      } catch {
        try {
          const tokens = await refresh(session.tokens.refreshToken);
          await setAuthSession({ tokens, user: session.user });
          accessToken = tokens.accessToken;
          const response = await decideClientIdentification(accessToken, message.request);
          sendResponse({ ok: true, response });
        } catch (error) {
          await clearAuthSession();
          sendResponse({
            error: {
              errorCode: "AUTH_REQUIRED",
              message:
                error instanceof Error && error.message
                  ? error.message
                  : "Entre novamente para atualizar clientes."
            },
            ok: false
          });
        }
      }
    })();

    return true;
  }

  if (message.type === "assist/client-identification.bulk.decision") {
    void (async () => {
      const session = await getAuthSession();

      if (!session) {
        sendResponse({
          error: {
            errorCode: "AUTH_REQUIRED",
            message: "Entre novamente para atualizar clientes."
          },
          ok: false
        });
        return;
      }

      let accessToken = await getAccessToken();

      try {
        const response = await decideBulkClientIdentification(
          accessToken ?? session.tokens.accessToken,
          message.request
        );
        sendResponse({ ok: true, response });
      } catch {
        try {
          const tokens = await refresh(session.tokens.refreshToken);
          await setAuthSession({ tokens, user: session.user });
          accessToken = tokens.accessToken;
          const response = await decideBulkClientIdentification(accessToken, message.request);
          sendResponse({ ok: true, response });
        } catch (error) {
          await clearAuthSession();
          sendResponse({
            error: {
              errorCode: "AUTH_REQUIRED",
              message:
                error instanceof Error && error.message
                  ? error.message
                  : "Entre novamente para atualizar clientes."
            },
            ok: false
          });
        }
      }
    })();

    return true;
  }

  void (async () => {
    const session = await getAuthSession();

    if (!session) {
      sendResponse({
        error: {
          errorCode: "AUTH_REQUIRED",
          message: "Entre novamente para identificar clientes."
        },
        ok: false
      });
      return;
    }

    let accessToken = await getAccessToken();

    if (message.type === "assist/client-identification.bulk.request") {
      try {
        const response = await identifyClientsBulk(
          accessToken ?? session.tokens.accessToken,
          message.request
        );
        chrome.runtime.sendMessage({
          response,
          type: "assist/client-identification.bulk.updated"
        });
        sendResponse({ ok: true, response });
      } catch {
        try {
          const tokens = await refresh(session.tokens.refreshToken);
          await setAuthSession({ tokens, user: session.user });
          accessToken = tokens.accessToken;
          const response = await identifyClientsBulk(accessToken, message.request);
          chrome.runtime.sendMessage({
            response,
            type: "assist/client-identification.bulk.updated"
          });
          sendResponse({ ok: true, response });
        } catch (error) {
          await clearAuthSession();
          sendResponse({
            error: {
              errorCode: "AUTH_REQUIRED",
              message:
                error instanceof Error && error.message
                  ? error.message
                  : "Entre novamente para identificar clientes."
            },
            ok: false
          });
        }
      }

      return;
    }

    const screenshotDataUrl = await captureScreenshot(sender);
    const request = {
      ...message.request,
      ...(screenshotDataUrl ? { screenshotDataUrl } : {})
    };

    try {
      const response = await identifyClient(accessToken ?? session.tokens.accessToken, request);
      chrome.runtime.sendMessage({
        response,
        type: "assist/client-identification.updated"
      });
      sendResponse({ ok: true, response });
    } catch {
      try {
        const tokens = await refresh(session.tokens.refreshToken);
        await setAuthSession({ tokens, user: session.user });
        accessToken = tokens.accessToken;
        const response = await identifyClient(accessToken, request);
        chrome.runtime.sendMessage({
          response,
          type: "assist/client-identification.updated"
        });
        sendResponse({ ok: true, response });
      } catch (error) {
        await clearAuthSession();
        sendResponse({
          error: {
            errorCode: "AUTH_REQUIRED",
            message:
              error instanceof Error && error.message
                ? error.message
                : "Entre novamente para identificar clientes."
          },
          ok: false
        });
      }
    }
  })();

  return true;
}
