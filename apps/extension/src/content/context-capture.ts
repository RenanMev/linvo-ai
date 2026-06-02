import type {
  ClientIdentificationRequest,
  ClientInfoOpenRequest,
  BulkClientIdentificationRequest,
  BulkIdentificationItem,
  BulkListSelection,
  DomSummary,
  ManualSelection
} from "@linvo-ai/shared";

function compactText(value: string, max = 8_000): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function textFromElements(selector: string, root: ParentNode = document): string[] {
  return Array.from(root.querySelectorAll(selector))
    .map((element) => compactText(element.textContent ?? "", 160))
    .filter(Boolean)
    .slice(0, 12);
}

export function captureDomSummary(element: Element): DomSummary {
  const role = element.getAttribute("role") ?? undefined;
  const ariaLabel = element.getAttribute("aria-label") ?? undefined;

  return {
    ...(ariaLabel ? { ariaLabel } : {}),
    candidateLabels: textFromElements("[aria-label], [role='listitem'], article, li").filter(
      (value) => value !== compactText(element.textContent ?? "", 160)
    ),
    nearbyHeadings: textFromElements("h1,h2,h3,h4,h5,h6", document),
    ...(role ? { selectedRole: role } : {}),
    selectedTag: element.tagName.toLowerCase()
  };
}

export function captureSurroundingText(element: Element): string {
  const parent = element.parentElement ?? document.body;
  return compactText(parent.textContent ?? document.body.innerText ?? "", 8_000);
}

export function captureVisiblePageText(): string {
  return compactText(
    document.body?.innerText ||
      document.body?.textContent ||
      document.documentElement.textContent ||
      document.title ||
      window.location.href,
    8_000
  );
}

export function buildIdentificationRequest(
  element: Element,
  manualSelection: ManualSelection
): ClientIdentificationRequest {
  return {
    capturedAt: new Date().toISOString(),
    domSummary: captureDomSummary(element),
    manualSelection,
    pageTitle: document.title || "Pagina sem titulo",
    requestId: crypto.randomUUID(),
    selectedText: manualSelection.textExcerpt,
    surroundingText: captureSurroundingText(element),
    url: window.location.href
  };
}

export function buildClientInfoOpenRequest(): ClientInfoOpenRequest {
  return {
    capturedAt: new Date().toISOString(),
    pageText: captureVisiblePageText() || "Pagina sem texto visivel.",
    pageTitle: document.title || "Pagina sem titulo",
    requestId: crypto.randomUUID(),
    url: window.location.href
  };
}

export function buildBulkIdentificationRequest(
  listSelection: BulkListSelection,
  items: BulkIdentificationItem[]
): BulkClientIdentificationRequest {
  return {
    capturedAt: new Date().toISOString(),
    items,
    listSelection,
    pageTitle: document.title || "Pagina sem titulo",
    requestId: crypto.randomUUID(),
    url: window.location.href
  };
}
