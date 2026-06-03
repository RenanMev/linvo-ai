import { act } from "react";
import { createRoot } from "react-dom/client";

import type { SiteAgentContextSummary } from "@linvo-ai/shared";

import { TooltipProvider } from "../src/components/ui/tooltip";
import { SiteContextView } from "../src/sidepanel/site-context-view";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const siteContext: SiteAgentContextSummary = {
  confidence: 0.9,
  createdAt: "2026-06-03T12:00:00.000Z",
  domain: "painel.nvoip.com.br",
  focusRules: ["Prefira o chat aberto e o header do atendimento."],
  id: "33333333-3333-4333-8333-333333333333",
  ignoreRules: ["Ignore menus de navegacao e textos da extensao."],
  regions: [
    {
      description: "Sidebar principal com navegacao do sistema.",
      evidence: [],
      kind: "main_sidebar",
      label: "Sidebar principal"
    },
    {
      description: "Lista interna de contatos.",
      evidence: [],
      kind: "contact_list",
      label: "Lista de contatos"
    },
    {
      description: "Chat aberto com o atendimento ativo.",
      evidence: [],
      kind: "active_chat",
      label: "Chat ativo"
    }
  ],
  sourceRequestId: "req-1",
  summary: "A tela possui sidebar esquerda, lista interna, chat ativo e header.",
  updatedAt: "2026-06-03T12:00:00.000Z"
};

describe("SiteContextView", () => {
  it("keeps context hidden behind an icon and emits delete", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const events: string[] = [];

    await act(async () => {
      root.render(
        <TooltipProvider>
          <SiteContextView
            errorMessage=""
            loading={false}
            onDelete={() => events.push("delete")}
            onToggle={() => events.push("toggle")}
            open={false}
            siteContext={siteContext}
          />
        </TooltipProvider>
      );
    });

    expect(container.textContent).not.toContain(siteContext.summary);

    const toggleButton = container.querySelector("button[aria-label='Contexto do site']");

    await act(async () => {
      toggleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      root.render(
        <TooltipProvider>
          <SiteContextView
            errorMessage=""
            loading={false}
            onDelete={() => events.push("delete")}
            onToggle={() => events.push("toggle")}
            open={true}
            siteContext={siteContext}
          />
        </TooltipProvider>
      );
    });

    expect(events).toContain("toggle");
    expect(container.textContent).toContain("Chat ativo");
    expect(container.textContent).toContain("Prefira o chat aberto");

    const deleteButton = container.querySelector("button[aria-label='Remover contexto do site']");

    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(events).toContain("delete");
  });
});
