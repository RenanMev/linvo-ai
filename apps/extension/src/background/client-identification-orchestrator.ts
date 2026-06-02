import {
  MAX_SCREENSHOT_DATA_URL_CHARS,
  type ClientInfoOpenApiResponse
} from "@linvo-ai/shared";

import type {
  RuntimeRequestMessage,
  RuntimeResponseMessage
} from "../lib/runtime-messages";
import { CLIENT_INFO_OPEN_SELECTION_STORAGE_KEY } from "../lib/runtime-messages";
import {
  clearAuthSession,
  getAuthSession,
  setAuthSession
} from "../lib/auth-session";
import {
  decideBulkClientIdentification,
  decideClientIdentification,
  deleteCustomer,
  identifyClient,
  identifyClientsBulk,
  isApiClientError,
  listCustomers,
  openClientInfo,
  refresh,
  updateCustomer
} from "../lib/api-client";

function runtimeErrorResponse(error: unknown, fallbackMessage: string): RuntimeResponseMessage {
  return {
    error: {
      errorCode: isApiClientError(error) ? error.errorCode : "AUTH_REQUIRED",
      message:
        error instanceof Error && error.message
          ? error.message
          : fallbackMessage
    },
    ok: false
  };
}

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

async function openSidePanel(sender: chrome.runtime.MessageSender): Promise<void> {
  try {
    if (chrome.sidePanel?.open && sender.tab?.id !== undefined) {
      await chrome.sidePanel.open({ tabId: sender.tab.id });
    }
  } catch {
    // Opening the panel is best-effort; the API response still matters.
  }
}

async function publishClientInfoOpen(
  response: ClientInfoOpenApiResponse,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  if (response.status !== "ok") {
    return;
  }

  await chrome.storage.local?.set({
    [CLIENT_INFO_OPEN_SELECTION_STORAGE_KEY]: {
      customerId: response.customer.id,
      requestedAt: new Date().toISOString()
    }
  });
  chrome.runtime.sendMessage({
    response,
    type: "assist/client-info.opened"
  });
  await openSidePanel(sender);
}

export function handleClientIdentificationMessage(
  message: RuntimeRequestMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: RuntimeResponseMessage) => void
): boolean | undefined {
  if (
    message.type !== "assist/client-info.open.request" &&
    message.type !== "assist/client-identification.request" &&
    message.type !== "assist/client-identification.decision" &&
    message.type !== "assist/client-identification.bulk.request" &&
    message.type !== "assist/client-identification.bulk.decision" &&
    message.type !== "assist/customer.delete" &&
    message.type !== "assist/customer.update" &&
    message.type !== "assist/customers.list"
  ) {
    return undefined;
  }

  if (message.type === "assist/client-info.open.request") {
    void (async () => {
      const session = await getAuthSession();

      if (!session) {
        sendResponse({
          error: {
            errorCode: "AUTH_REQUIRED",
            message: "Entre novamente para abrir informacoes do cliente."
          },
          ok: false
        });
        return;
      }

      let accessToken = await getAccessToken();

      try {
        const response = await openClientInfo(
          accessToken ?? session.tokens.accessToken,
          message.request
        );
        await publishClientInfoOpen(response, sender);
        sendResponse({ ok: true, response });
      } catch {
        try {
          const tokens = await refresh(session.tokens.refreshToken);
          await setAuthSession({ tokens, user: session.user });
          accessToken = tokens.accessToken;
          const response = await openClientInfo(accessToken, message.request);
          await publishClientInfoOpen(response, sender);
          sendResponse({ ok: true, response });
        } catch (error) {
          await clearAuthSession();
          sendResponse(runtimeErrorResponse(error, "Entre novamente para abrir informacoes do cliente."));
        }
      }
    })();

    return true;
  }

  if (message.type === "assist/customers.list") {
    void (async () => {
      const session = await getAuthSession();

      if (!session) {
        sendResponse({
          error: {
            errorCode: "AUTH_REQUIRED",
            message: "Entre novamente para carregar contatos."
          },
          ok: false
        });
        return;
      }

      let accessToken = await getAccessToken();

      try {
        const response = await listCustomers(
          accessToken ?? session.tokens.accessToken,
          message.domain
        );
        sendResponse({ ok: true, response });
      } catch {
        try {
          const tokens = await refresh(session.tokens.refreshToken);
          await setAuthSession({ tokens, user: session.user });
          accessToken = tokens.accessToken;
          const response = await listCustomers(accessToken, message.domain);
          sendResponse({ ok: true, response });
        } catch (error) {
          await clearAuthSession();
          sendResponse(runtimeErrorResponse(error, "Entre novamente para carregar contatos."));
        }
      }
    })();

    return true;
  }

  if (message.type === "assist/customer.update") {
    void (async () => {
      const session = await getAuthSession();

      if (!session) {
        sendResponse({
          error: {
            errorCode: "AUTH_REQUIRED",
            message: "Entre novamente para atualizar contatos."
          },
          ok: false
        });
        return;
      }

      let accessToken = await getAccessToken();

      try {
        const response = await updateCustomer(
          accessToken ?? session.tokens.accessToken,
          message.request
        );
        sendResponse({ ok: true, response });
      } catch {
        try {
          const tokens = await refresh(session.tokens.refreshToken);
          await setAuthSession({ tokens, user: session.user });
          accessToken = tokens.accessToken;
          const response = await updateCustomer(accessToken, message.request);
          sendResponse({ ok: true, response });
        } catch (error) {
          await clearAuthSession();
          sendResponse(runtimeErrorResponse(error, "Entre novamente para atualizar contatos."));
        }
      }
    })();

    return true;
  }

  if (message.type === "assist/customer.delete") {
    void (async () => {
      const session = await getAuthSession();

      if (!session) {
        sendResponse({
          error: {
            errorCode: "AUTH_REQUIRED",
            message: "Entre novamente para apagar clientes."
          },
          ok: false
        });
        return;
      }

      let accessToken = await getAccessToken();

      try {
        const response = await deleteCustomer(
          accessToken ?? session.tokens.accessToken,
          message.request
        );
        sendResponse({ ok: true, response });
      } catch {
        try {
          const tokens = await refresh(session.tokens.refreshToken);
          await setAuthSession({ tokens, user: session.user });
          accessToken = tokens.accessToken;
          const response = await deleteCustomer(accessToken, message.request);
          sendResponse({ ok: true, response });
        } catch (error) {
          await clearAuthSession();
          sendResponse(runtimeErrorResponse(error, "Entre novamente para apagar clientes."));
        }
      }
    })();

    return true;
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
          sendResponse(runtimeErrorResponse(error, "Entre novamente para atualizar clientes."));
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
          sendResponse(runtimeErrorResponse(error, "Entre novamente para atualizar clientes."));
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
          sendResponse(runtimeErrorResponse(error, "Entre novamente para identificar clientes."));
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
        sendResponse(runtimeErrorResponse(error, "Entre novamente para identificar clientes."));
      }
    }
  })();

  return true;
}
