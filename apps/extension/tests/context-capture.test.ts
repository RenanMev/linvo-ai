import { buildIdentificationRequest, captureDomSummary } from "../src/content/context-capture";

describe("context capture", () => {
  it("builds a contract-compatible request from selected element", () => {
    document.body.innerHTML = `
      <main>
        <h1>Atendimento</h1>
        <section aria-label="Conversa ativa">Maria Silva TK-1048 Problema com boleto</section>
      </main>
    `;
    const element = document.querySelector("section");

    expect(element).not.toBeNull();
    const request = buildIdentificationRequest(element!, {
      selectedAt: new Date().toISOString(),
      source: "user",
      textExcerpt: "Maria Silva TK-1048"
    });

    expect(request.selectedText).toContain("Maria");
    expect(request.domSummary?.nearbyHeadings).toContain("Atendimento");
  });

  it("captures DOM role data", () => {
    document.body.innerHTML = `<article role="region" aria-label="Cliente ativo">Cliente A</article>`;
    const summary = captureDomSummary(document.querySelector("article")!);

    expect(summary.selectedRole).toBe("region");
    expect(summary.ariaLabel).toBe("Cliente ativo");
  });

  it("captures Nvoip-style sidebar and header tokens", () => {
    document.body.innerHTML = `
      <aside>
        <div role="listitem">Davi - 140987001 - Tier A</div>
        <div role="listitem">Lucidio Souza</div>
      </aside>
      <header aria-label="Chat ativo">Davi - 140987001 - Tier A Supervisor</header>
    `;
    const element = document.querySelector("header")!;
    const request = buildIdentificationRequest(element, {
      label: "Davi - 140987001 - Tier A Supervisor",
      selectedAt: new Date().toISOString(),
      source: "user",
      textExcerpt: "Davi - 140987001 - Tier A"
    });

    expect(request.selectedText).toContain("Davi");
    expect(request.domSummary?.candidateLabels.join(" ")).toContain("140987001");
    expect(request.domSummary?.candidateLabels.join(" ")).toContain("Tier A");
  });
});
