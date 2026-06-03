import { act } from "react";
import { createRoot } from "react-dom/client";

import type { CustomerSummary } from "@linvo-ai/shared";

import { ContactsView } from "../src/sidepanel/contacts-view";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const customers: CustomerSummary[] = [
  {
    cases: [{ id: "22222222-2222-4222-8222-222222222222", lastSeenAt: "2026-06-01T12:00:00.000Z", protocol: "10703030" }],
    displayName: "Renan Devs",
    domain: "painel.nvoip.com.br",
    favoriteFields: ["protocol", "phone"],
    id: "11111111-1111-4111-8111-111111111111",
    isStarred: true,
    lastSeenAt: "2026-06-01T12:00:00.000Z",
    maskedIdentifiers: { phone: "(55) *****-3122", protocol: "10703030" },
    notes: "Cliente prefere contato por WhatsApp."
  }
];

describe("ContactsView", () => {
  it("renders a clickable domain contact list with favorites", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const selectedIds: string[] = [];
    const searched: string[] = [];

    await act(async () => {
      root.render(
        <ContactsView
          activeDomain="painel.nvoip.com.br"
          customers={customers}
          errorMessage=""
          loading={false}
          onRefresh={() => selectedIds.push("refresh")}
          onSearchQueryChange={(value) => searched.push(value)}
          onSelect={(customerId) => selectedIds.push(customerId)}
          searchQuery=""
        />
      );
    });

    expect(container.textContent).toContain("Contatos");
    expect(container.textContent).toContain("painel.nvoip.com.br");
    expect(container.textContent).toContain("Renan Devs");
    expect(container.textContent).toContain("Protocolo: 10703030");
    expect(container.textContent).toContain("Telefone: (55) *****-3122");
    expect(container.textContent).not.toContain("Salvar informacoes");
    expect(container.querySelector("button[aria-label='Delete Renan Devs']")).toBeNull();

    const contactButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Renan Devs")
    );

    await act(async () => {
      contactButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(selectedIds).toContain(customers[0]?.id);
    expect(searched).toEqual([]);
  });
});
