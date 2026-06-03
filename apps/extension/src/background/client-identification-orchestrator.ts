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
  setAuthSession,
  type StoredAuthSession
} from "../lib/auth-session";
import {
  decideBulkClientIdentification,
  decideClientIdentification,
  clearCustomerChat,
  deleteCustomer,
  deleteSiteContext,
  getCustomerChat,
  getCustomerDetail,
  getSiteContext,
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

async function sendAuthRequiredResponse(input: {
  fallbackMessage: string;
  sender: chrome.runtime.MessageSender;
  sendResponse: (response: RuntimeResponseMessage) => void;
}): Promise<void> {
  await openSidePanel(input.sender);
  input.sendResponse({
    error: {
      errorCode: "AUTH_REQUIRED",
      message: input.fallbackMessage
    },
    ok: false
  });
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

async function openSidePanel(sender: chrome.runtime.MessageSender): Promise<void> {
  try {
    if (chrome.sidePanel?.open && sender.tab?.id !== undefined) {
      await chrome.sidePanel.open({ tabId: sender.tab.id });
    }
  } catch {
    // Opening the panel is best-effort; the API response still matters.
  }
}

function isAuthError(error: unknown): boolean {
  return isApiClientError(error) &&
    (error.errorCode === "AUTH_REQUIRED" || error.errorCode === "REFRESH_TOKEN_INVALID");
}

async function clearAuthSessionForAuthError(error: unknown): Promise<void> {
  if (isAuthError(error)) {
    await clearAuthSession();
  }
}

async function requestWithAuthRefresh<T>(
  session: StoredAuthSession,
  request: (accessToken: string) => Promise<T>
): Promise<T> {
  try {
    return await request(session.tokens.accessToken);
  } catch (error) {
    if (!isAuthError(error)) {
      throw error;
    }

    let tokens: StoredAuthSession["tokens"];

    try {
      tokens = await refresh(session.tokens.refreshToken);
    } catch (refreshError) {
      await clearAuthSessionForAuthError(refreshError);
      throw refreshError;
    }

    await setAuthSession({ tokens, user: session.user });

    try {
      return await request(tokens.accessToken);
    } catch (retryError) {
      await clearAuthSessionForAuthError(retryError);
      throw retryError;
    }
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
    message.type !== "assist/customer.get" &&
    message.type !== "assist/customer-chat.clear" &&
    message.type !== "assist/customer-chat.get" &&
    message.type !== "assist/customer.delete" &&
    message.type !== "assist/customer.update" &&
    message.type !== "assist/customers.list" &&
    message.type !== "assist/site-context.get" &&
    message.type !== "assist/site-context.delete"
  ) {
    return undefined;
  }

  if (message.type === "assist/client-info.open.request") {
    void (async () => {
      const session = await getAuthSession();

      if (!session) {
        await sendAuthRequiredResponse({
          fallbackMessage: "Entre no Linvo AI para abrir informacoes do cliente.",
          sender,
          sendResponse
        });
        return;
      }

      try {
        const response = await requestWithAuthRefresh(
          session,
          (accessToken) => openClientInfo(accessToken, message.request)
        );
        await publishClientInfoOpen(response, sender);
        sendResponse({ ok: true, response });
      } catch (error) {
        if (isAuthError(error)) {
          await openSidePanel(sender);
        }
        sendResponse(runtimeErrorResponse(error, "Entre novamente para abrir informacoes do cliente."));
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

      try {
        const response = await requestWithAuthRefresh(
          session,
          (accessToken) => listCustomers(accessToken, message.domain)
        );
        sendResponse({ ok: true, response });
      } catch (error) {
        sendResponse(runtimeErrorResponse(error, "Entre novamente para carregar contatos."));
      }
    })();

    return true;
  }

  if (message.type === "assist/customer.get") {
    void (async () => {
      const session = await getAuthSession();

      if (!session) {
        sendResponse({
          error: {
            errorCode: "AUTH_REQUIRED",
            message: "Entre novamente para carregar o contato."
          },
          ok: false
        });
        return;
      }

      try {
        const response = await requestWithAuthRefresh(
          session,
          (accessToken) => getCustomerDetail(accessToken, message.customerId)
        );
        sendResponse({ ok: true, response });
      } catch (error) {
        sendResponse(runtimeErrorResponse(error, "Entre novamente para carregar o contato."));
      }
    })();

    return true;
  }

  if (message.type === "assist/customer-chat.get") {
    void (async () => {
      const session = await getAuthSession();

      if (!session) {
        sendResponse({
          error: {
            errorCode: "AUTH_REQUIRED",
            message: "Entre novamente para carregar a conversa."
          },
          ok: false
        });
        return;
      }

      try {
        const response = await requestWithAuthRefresh(
          session,
          (accessToken) => getCustomerChat(accessToken, message.customerId)
        );
        sendResponse({ ok: true, response });
      } catch (error) {
        sendResponse(runtimeErrorResponse(error, "Entre novamente para carregar a conversa."));
      }
    })();

    return true;
  }

  if (message.type === "assist/customer-chat.clear") {
    void (async () => {
      const session = await getAuthSession();

      if (!session) {
        sendResponse({
          error: {
            errorCode: "AUTH_REQUIRED",
            message: "Entre novamente para limpar a conversa."
          },
          ok: false
        });
        return;
      }

      try {
        const response = await requestWithAuthRefresh(
          session,
          (accessToken) => clearCustomerChat(accessToken, message.customerId)
        );
        sendResponse({ ok: true, response });
      } catch (error) {
        sendResponse(runtimeErrorResponse(error, "Entre novamente para limpar a conversa."));
      }
    })();

    return true;
  }

  if (message.type === "assist/site-context.get") {
    void (async () => {
      const session = await getAuthSession();

      if (!session) {
        sendResponse({
          error: {
            errorCode: "AUTH_REQUIRED",
            message: "Entre novamente para carregar o contexto do site."
          },
          ok: false
        });
        return;
      }

      try {
        const response = await requestWithAuthRefresh(
          session,
          (accessToken) => getSiteContext(accessToken, message.domain)
        );
        sendResponse({ ok: true, response });
      } catch (error) {
        sendResponse(runtimeErrorResponse(error, "Entre novamente para carregar o contexto do site."));
      }
    })();

    return true;
  }

  if (message.type === "assist/site-context.delete") {
    void (async () => {
      const session = await getAuthSession();

      if (!session) {
        sendResponse({
          error: {
            errorCode: "AUTH_REQUIRED",
            message: "Entre novamente para remover o contexto do site."
          },
          ok: false
        });
        return;
      }

      try {
        const response = await requestWithAuthRefresh(
          session,
          (accessToken) => deleteSiteContext(accessToken, message.request)
        );
        sendResponse({ ok: true, response });
      } catch (error) {
        sendResponse(runtimeErrorResponse(error, "Entre novamente para remover o contexto do site."));
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

      try {
        const response = await requestWithAuthRefresh(
          session,
          (accessToken) => updateCustomer(accessToken, message.request)
        );
        sendResponse({ ok: true, response });
      } catch (error) {
        sendResponse(runtimeErrorResponse(error, "Entre novamente para atualizar contatos."));
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

      try {
        const response = await requestWithAuthRefresh(
          session,
          (accessToken) => deleteCustomer(accessToken, message.request)
        );
        sendResponse({ ok: true, response });
      } catch (error) {
        sendResponse(runtimeErrorResponse(error, "Entre novamente para apagar clientes."));
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

      try {
        const response = await requestWithAuthRefresh(
          session,
          (accessToken) => decideClientIdentification(accessToken, message.request)
        );
        sendResponse({ ok: true, response });
      } catch (error) {
        sendResponse(runtimeErrorResponse(error, "Entre novamente para atualizar clientes."));
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

      try {
        const response = await requestWithAuthRefresh(
          session,
          (accessToken) => decideBulkClientIdentification(accessToken, message.request)
        );
        sendResponse({ ok: true, response });
      } catch (error) {
        sendResponse(runtimeErrorResponse(error, "Entre novamente para atualizar clientes."));
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

    if (message.type === "assist/client-identification.bulk.request") {
      try {
        const response = await requestWithAuthRefresh(
          session,
          (accessToken) => identifyClientsBulk(accessToken, message.request)
        );
        chrome.runtime.sendMessage({
          response,
          type: "assist/client-identification.bulk.updated"
        });
        sendResponse({ ok: true, response });
      } catch (error) {
        sendResponse(runtimeErrorResponse(error, "Entre novamente para identificar clientes."));
      }

      return;
    }

    const screenshotDataUrl = await captureScreenshot(sender);
    const request = {
      ...message.request,
      ...(screenshotDataUrl ? { screenshotDataUrl } : {})
    };

    try {
      const response = await requestWithAuthRefresh(
        session,
        (accessToken) => identifyClient(accessToken, request)
      );
      chrome.runtime.sendMessage({
        response,
        type: "assist/client-identification.updated"
      });
      sendResponse({ ok: true, response });
    } catch (error) {
      sendResponse(runtimeErrorResponse(error, "Entre novamente para identificar clientes."));
    }
  })();

  return true;
}
