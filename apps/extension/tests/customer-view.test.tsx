import { act } from "react";
import { createRoot } from "react-dom/client";

import type { ClientIdentificationApiResponse } from "@linvo-ai/shared";

import { CustomerView } from "../src/sidepanel/customer-view";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const pendingResponse: ClientIdentificationApiResponse = {
  activeClient: null,
  case: null,
  confidence: 0.91,
  domain: "painel.nvoip.com.br",
  evidence: ["Nome e protocolo visiveis no header."],
  pendingClient: {
    case: {
      protocol: "140987001",
      status: "Tier A",
      subject: "Atendimento"
    },
    displayName: "Davi",
    maskedIdentifiers: { protocol: "140987001" }
  },
  recentCustomers: [],
  requestId: "req-1",
  saveState: "pending_confirmation",
  saved: false,
  status: "ok",
  warnings: []
};

describe("CustomerView", () => {
  it("renders the pending confirmation card and emits accept", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const decisions: string[] = [];

    await act(async () => {
      root.render(
        <CustomerView
          decisionLoading={null}
          onDecision={(decision) => decisions.push(decision)}
          result={pendingResponse}
        />
      );
    });

    expect(container.textContent).toContain("Adicionar cliente?");
    expect(container.textContent).toContain("Davi - 140987001");

    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Adicionar"
    );

    expect(addButton).toBeTruthy();

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(decisions).toEqual(["accept"]);
  });
});
