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
    id: "11111111-1111-4111-8111-111111111111",
    lastSeenAt: "2026-06-01T12:00:00.000Z",
    maskedIdentifiers: { protocol: "10703030" },
    notes: "Cliente prefere contato por WhatsApp."
  }
];

describe("ContactsView", () => {
  it("renders a clickable contact list and editable details", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const selectedIds: string[] = [];
    const saved: string[] = [];
    const deleted: string[] = [];

    await act(async () => {
      root.render(
        <ContactsView
          caseDraft={{
            caseId: "22222222-2222-4222-8222-222222222222",
            protocol: "10703030",
            status: "",
            subject: ""
          }}
          customers={customers}
          deletingCustomerId={null}
          errorMessage=""
          identifierDrafts={{
            document: "",
            email: "",
            phone: "",
            protocol: "10703030"
          }}
          loading={false}
          nameDraft="Renan Devs"
          notesDraft="Cliente prefere contato por WhatsApp."
          onCaseDraftChange={(field, value) => selectedIds.push(`case:${field}:${value}`)}
          onDelete={(customer) => deleted.push(customer.id)}
          onIdentifierDraftChange={(field, value) => selectedIds.push(`identifier:${field}:${value}`)}
          onNameDraftChange={(value) => selectedIds.push(`name:${value}`)}
          onNotesDraftChange={(value) => selectedIds.push(`notes:${value}`)}
          onRefresh={() => selectedIds.push("refresh")}
          onSave={() => saved.push("save")}
          onSelect={(customerId) => selectedIds.push(customerId)}
          saving={false}
          selectedCustomerId={customers[0]?.id ?? null}
        />
      );
    });

    expect(container.textContent).toContain("Contatos");
    expect(container.textContent).toContain("Renan Devs");
    expect(container.textContent).toContain("Telefone");
    expect(container.textContent).toContain("Documento");
    expect(container.textContent).toContain("Protocolo do caso");
    expect(container.textContent).toContain("Informacoes / observacoes");

    const contactButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Renan Devs") &&
      button.textContent?.includes("10703030")
    );
    const inlineDeleteButton = container.querySelector("button[aria-label='Delete Renan Devs']");

    expect(inlineDeleteButton?.textContent).toContain("Delete");

    await act(async () => {
      contactButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Salvar informacoes")
    );
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const deleteButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.getAttribute("aria-label") === "Delete Renan Devs"
    );
    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(selectedIds).toContain(customers[0]?.id);
    expect(saved).toEqual(["save"]);
    expect(deleted).toEqual([customers[0]?.id]);
  });
});
