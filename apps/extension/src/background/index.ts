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
  return (
    handleAuthMessage(message, sendResponse) ??
    handleClientIdentificationMessage(message, sender, sendResponse)
  );
});
