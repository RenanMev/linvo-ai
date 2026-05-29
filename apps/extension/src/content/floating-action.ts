import type { RuntimeResponseMessage } from "../lib/runtime-messages";
import { buildBulkIdentificationRequest, buildIdentificationRequest } from "./context-capture";
import { startClientPicker, startListPicker } from "./client-picker";
import { showToast } from "./toast";

const BUTTON_ID = "linvo-ai-floating-action";

export function installFloatingAction(): void {
  if (document.getElementById(BUTTON_ID)) {
    return;
  }

  const root = document.createElement("div");
  root.id = BUTTON_ID;
  root.style.position = "fixed";
  root.style.right = "18px";
  root.style.bottom = "24px";
  root.style.zIndex = "2147483645";
  root.style.display = "grid";
  root.style.gap = "8px";
  root.style.justifyItems = "end";

  const clientButton = createActionButton("Identificar cliente", "#0f172a");
  const listButton = createActionButton("Identificar lista", "#f97316");

  clientButton.addEventListener("click", () => {
    void runIdentificationFlow();
  });
  listButton.addEventListener("click", () => {
    void runBulkIdentificationFlow();
  });

  root.append(clientButton, listButton);
  document.documentElement.append(root);
}

function createActionButton(label: string, background: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.border = "0";
  button.style.borderRadius = "8px";
  button.style.background = background;
  button.style.color = "#f8fafc";
  button.style.boxShadow = "0 14px 36px rgba(15, 23, 42, 0.26)";
  button.style.cursor = "pointer";
  button.style.font = "600 13px Inter, system-ui, sans-serif";
  button.style.padding = "10px 12px";

  return button;
}

async function runIdentificationFlow(): Promise<void> {
  showToast("Selecione o cliente base na pagina.");
  const picked = await startClientPicker();

  if (!picked) {
    showToast("Identificacao cancelada.");
    return;
  }

  showToast("Identificando cliente...");
  const request = buildIdentificationRequest(picked.element, picked.selection);

  try {
    const response = await chrome.runtime.sendMessage({
      request,
      type: "assist/client-identification.request"
    }) as RuntimeResponseMessage;

    if (!response.ok) {
      showToast(response.error.message, "error");
      return;
    }

    if ("response" in response && "saved" in response.response) {
      if ("saveState" in response.response && response.response.saveState === "pending_confirmation") {
        showToast("Revise no Linvo AI para adicionar.", "info");
        return;
      }

      showToast(
        response.response.saved ? "Cliente identificado." : "Cliente nao confirmado.",
        response.response.saved ? "success" : "info"
      );
      return;
    }

    showToast("Nao foi possivel identificar o cliente agora.", "error");
  } catch {
    showToast("Nao foi possivel identificar o cliente agora.", "error");
  }
}

async function runBulkIdentificationFlow(): Promise<void> {
  showToast("Selecione a lista de clientes na pagina.");
  const picked = await startListPicker();

  if (!picked) {
    showToast("Identificacao de lista cancelada.");
    return;
  }

  if (picked.items.length === 0) {
    showToast("Nenhuma linha visivel foi encontrada.", "error");
    return;
  }

  showToast(`Identificando ${picked.items.length} clientes...`);
  const request = buildBulkIdentificationRequest(picked.selection, picked.items);

  try {
    const response = await chrome.runtime.sendMessage({
      request,
      type: "assist/client-identification.bulk.request"
    }) as RuntimeResponseMessage;

    if (!response.ok) {
      showToast(response.error.message, "error");
      return;
    }

    if ("response" in response && response.response.status === "ok" && "candidates" in response.response) {
      const pendingCount = response.response.candidates.filter(
        (candidate) => candidate.saveState === "pending_confirmation"
      ).length;

      showToast(
        pendingCount
          ? `${response.response.candidates.length} clientes encontrados. Revise no Linvo AI.`
          : "Lista analisada. Revise no Linvo AI.",
        "info"
      );
      return;
    }

    showToast("Nao foi possivel identificar a lista agora.", "error");
  } catch {
    showToast("Nao foi possivel identificar a lista agora.", "error");
  }
}
