import type { RuntimeRequestMessage, RuntimeResponseMessage } from "../lib/runtime-messages";
import { handleAuthMessage } from "./auth-orchestrator";
import { handleClientIdentificationMessage } from "./client-identification-orchestrator";

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    void chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });
  }
});

chrome.runtime.onMessage.addListener((
  message: RuntimeRequestMessage,
  sender,
  sendResponse: (response: RuntimeResponseMessage) => void
) => {
  if (message.type === "ui/open-sidepanel") {
    void (async () => {
      try {
        if (chrome.sidePanel?.open && sender.tab?.id !== undefined) {
          await chrome.sidePanel.open({ tabId: sender.tab.id });
        }
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({
          error: {
            errorCode: "INTERNAL_ERROR",
            message:
              error instanceof Error && error.message
                ? error.message
                : "Nao foi possivel abrir o Linvo AI."
          },
          ok: false
        });
      }
    })();

    return true;
  }

  return (
    handleAuthMessage(message, sendResponse) ??
    handleClientIdentificationMessage(message, sender, sendResponse)
  );
});
