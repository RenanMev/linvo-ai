import { act } from "react";
import { createRoot } from "react-dom/client";

import type { BulkClientIdentificationApiResponse } from "@linvo-ai/shared";

import { BulkCandidatesView } from "../src/sidepanel/bulk-candidates-view";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const bulkResponse: BulkClientIdentificationApiResponse = {
  batchId: "bulk-1",
  candidates: [
    {
      case: null,
      confidence: 0.76,
      displayName: "Giulliano",
      evidence: ["Nome visivel na linha: Giulliano"],
      maskedIdentifiers: {},
      requestId: "bulk-item-1",
      rowIndex: 0,
      rowText: "Giulliano 1 551141186267",
      saveState: "pending_confirmation",
      selectedByDefault: true,
      warnings: []
    },
    {
      case: { protocol: "48982" },
      confidence: 0.9,
      displayName: "Gunther Morais",
      evidence: ["Protocolo detectado: 48982"],
      maskedIdentifiers: { protocol: "48982" },
      requestId: "bulk-item-2",
      rowIndex: 1,
      rowText: "Gunther Morais - 48982... 1 551141186267",
      saveState: "pending_confirmation",
      selectedByDefault: true,
      warnings: []
    },
    {
      case: null,
      confidence: 0.9,
      customerId: "11111111-1111-4111-8111-111111111111",
      displayName: "Cliente salvo",
      evidence: [],
      maskedIdentifiers: { protocol: "140987001" },
      requestId: "bulk-item-known",
      rowIndex: 2,
      rowText: "Cliente salvo - 140987001",
      saveState: "known",
      selectedByDefault: false,
      warnings: []
    }
  ],
  domain: "painel.nvoip.com.br",
  recentCustomers: [],
  status: "ok"
};

describe("BulkCandidatesView", () => {
  it("renders candidates with checkboxes and emits selected ids", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const decisions: Array<{ accept: string[]; reject: string[] }> = [];
    const deletedRequestIds: string[] = [];

    await act(async () => {
      root.render(
        <BulkCandidatesView
          decisionLoading={false}
          onDeleteCandidate={(candidate) => deletedRequestIds.push(candidate.requestId)}
          onDecision={(accept, reject) => decisions.push({ accept, reject })}
          result={bulkResponse}
        />
      );
    });

    expect(container.textContent).toContain("Clientes encontrados");
    expect(container.textContent).toContain("Giulliano");
    expect(container.textContent).toContain("Ja salvo");

    const checkboxes = Array.from(container.querySelectorAll("[role='checkbox']"));
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0]?.getAttribute("aria-checked")).toBe("true");
    expect((checkboxes[2] as HTMLButtonElement).disabled).toBe(true);

    const deleteButtons = Array.from(container.querySelectorAll("button[aria-label^='Delete ']"));
    expect(deleteButtons).toHaveLength(3);
    expect(deleteButtons.every((button) => button.textContent?.includes("Delete"))).toBe(true);

    await act(async () => {
      deleteButtons[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deletedRequestIds).toEqual(["bulk-item-known"]);

    await act(async () => {
      checkboxes[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const addButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Adicionar selecionados")
    );

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(decisions).toEqual([
      {
        accept: ["bulk-item-1"],
        reject: ["bulk-item-2"]
      }
    ]);
  });
});
