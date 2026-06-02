import {
  MAX_BULK_IDENTIFICATION_ITEMS,
  MAX_BULK_ROW_TEXT_CHARS,
  type BulkIdentificationItem,
  type BulkListSelection,
  type ManualSelection
} from "@linvo-ai/shared";

import { PickerOverlayView } from "./picker-overlay-view";
import { createShadowReactMount } from "./shadow-ui";

const ROOT_ID = "linvo-ai-picker-root";
const MIN_TEXT_LENGTH = 3;
const EMPTY_HIGHLIGHT = {
  height: 0,
  left: 0,
  top: 0,
  visible: false,
  width: 0
};

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isLinvoElement(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(`#${ROOT_ID}, #linvo-ai-floating-action, #linvo-ai-toast`));
}

function getMeaningfulElement(target: EventTarget | null): Element | null {
  if (!(target instanceof Element) || isLinvoElement(target)) {
    return null;
  }

  return target.closest("article, section, [role='main'], [role='article'], [role='listitem'], [aria-label], div, li, tr") ?? target;
}

export function getElementText(element: Element): string {
  return compactText(element.textContent ?? "").slice(0, 4_000);
}

function isVisibleElement(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width >= 24 &&
    rect.height >= 12 &&
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= window.innerHeight &&
    rect.left <= window.innerWidth &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

function isLooseControl(element: Element, text: string): boolean {
  const role = element.getAttribute("role") ?? "";
  const tag = element.tagName.toLowerCase();
  const normalized = text.toLowerCase();

  return (
    tag === "button" ||
    role === "button" ||
    normalized === "identificar cliente" ||
    normalized === "identificar lista" ||
    normalized === "adicionar" ||
    normalized === "ignorar" ||
    /^[\d\s.,:;/-]+$/.test(normalized)
  );
}

function extractTokens(text: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const match of text.match(/[\p{L}\p{N}][\p{L}\p{N}._-]{1,}/gu) ?? []) {
    const token = match.replace(/[._-]+$/gu, "");
    const key = token.toLowerCase();

    if (token && !seen.has(key)) {
      seen.add(key);
      tokens.push(token.slice(0, 80));
    }

    if (tokens.length >= 24) {
      break;
    }
  }

  return tokens;
}

function getRowCandidates(container: Element): Element[] {
  const raw = Array.from(
    container.querySelectorAll("li, tr, article, [role='listitem'], [data-testid*='item' i], [class*='item' i], [class*='contact' i], [class*='conversation' i], div")
  )
    .filter((element) => !isLinvoElement(element))
    .filter(isVisibleElement)
    .map((element) => ({
      element,
      rect: element.getBoundingClientRect(),
      text: compactText(element.textContent ?? "")
    }))
    .filter(({ element, rect, text }) =>
      text.length >= MIN_TEXT_LENGTH &&
      text.length <= MAX_BULK_ROW_TEXT_CHARS &&
      rect.height >= 18 &&
      rect.height <= 140 &&
      rect.width >= 80 &&
      !isLooseControl(element, text)
    )
    .sort((left, right) => left.rect.top - right.rect.top || left.rect.left - right.rect.left);

  const byVisualLine: Array<{ element: Element; rect: DOMRect; text: string }> = [];

  for (const candidate of raw) {
    const existingIndex = byVisualLine.findIndex(
      (item) => Math.abs(item.rect.top - candidate.rect.top) <= 8
    );

    if (existingIndex === -1) {
      byVisualLine.push(candidate);
      continue;
    }

    const existing = byVisualLine[existingIndex];

    if (!existing) {
      byVisualLine.push(candidate);
      continue;
    }

    const existingScore = existing.rect.width * existing.rect.height;
    const candidateScore = candidate.rect.width * candidate.rect.height;

    if (candidateScore > existingScore) {
      byVisualLine[existingIndex] = candidate;
    }
  }

  const seenText = new Set<string>();

  return byVisualLine
    .filter(({ text }) => {
      const key = text.toLowerCase();

      if (seenText.has(key)) {
        return false;
      }

      seenText.add(key);
      return true;
    })
    .slice(0, MAX_BULK_IDENTIFICATION_ITEMS)
    .map(({ element }) => element);
}

function getListContainer(target: EventTarget | null): Element | null {
  if (!(target instanceof Element) || isLinvoElement(target)) {
    return null;
  }

  let current: Element | null = target;

  for (let depth = 0; current && depth < 8; depth += 1) {
    if (current === document.body || current === document.documentElement) {
      break;
    }

    const rows = getRowCandidates(current);

    if (rows.length >= 2) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

export function extractListItems(container: Element): BulkIdentificationItem[] {
  return getRowCandidates(container).map((element, index) => {
    const rect = element.getBoundingClientRect();
    const text = compactText(element.textContent ?? "").slice(0, MAX_BULK_ROW_TEXT_CHARS);
    const role = element.getAttribute("role") ?? undefined;
    const ariaLabel = element.getAttribute("aria-label") ?? undefined;

    return {
      ...(ariaLabel ? { ariaLabel: ariaLabel.slice(0, 160) } : {}),
      boundingBox: {
        height: rect.height,
        left: rect.left,
        top: rect.top,
        width: rect.width
      },
      requestId: crypto.randomUUID(),
      ...(role ? { role: role.slice(0, 160) } : {}),
      rowIndex: index,
      rowText: text,
      tag: element.tagName.toLowerCase(),
      tokens: extractTokens(text)
    };
  });
}

export function startClientPicker(): Promise<{ element: Element; selection: ManualSelection } | null> {
  const existing = document.getElementById(ROOT_ID);
  existing?.remove();

  return new Promise((resolve) => {
    const mount = createShadowReactMount(ROOT_ID);
    const root = mount.host;
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.zIndex = "2147483646";
    root.style.pointerEvents = "none";
    let hint = "Selecione o cliente base na pagina. Esc cancela.";
    let highlight = EMPTY_HIGHLIGHT;
    let hovered: Element | null = null;

    const render = () => {
      mount.render(
        <PickerOverlayView
          highlight={highlight}
          hint={hint}
          tone="teal"
        />
      );
    };

    const cleanup = () => {
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      mount.unmount();
    };

    const updateHighlight = (element: Element | null) => {
      hovered = element;

      if (!element) {
        highlight = EMPTY_HIGHLIGHT;
        render();
        return;
      }

      const rect = element.getBoundingClientRect();
      highlight = {
        height: rect.height,
        left: rect.left,
        top: rect.top,
        visible: true,
        width: rect.width
      };
      render();
    };

    function onPointerMove(event: PointerEvent) {
      updateHighlight(getMeaningfulElement(event.target));
    }

    function onPointerDown(event: PointerEvent) {
      if (isLinvoElement(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const element = hovered ?? getMeaningfulElement(event.target);
      const text = element ? getElementText(element) : "";

      if (!element || text.length < MIN_TEXT_LENGTH) {
        hint = "Selecione uma area com texto do cliente.";
        render();
        return;
      }

      const rect = element.getBoundingClientRect();
      cleanup();
      resolve({
        element,
        selection: {
          boundingBox: {
            height: rect.height,
            left: rect.left,
            top: rect.top,
            width: rect.width
          },
          label: text.slice(0, 160),
          selectedAt: new Date().toISOString(),
          source: "user",
          textExcerpt: text
        }
      });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      cleanup();
      resolve(null);
    }

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    render();
  });
}

export function startListPicker(): Promise<{
  element: Element;
  items: BulkIdentificationItem[];
  selection: BulkListSelection;
} | null> {
  const existing = document.getElementById(ROOT_ID);
  existing?.remove();

  return new Promise((resolve) => {
    const mount = createShadowReactMount(ROOT_ID);
    const root = mount.host;
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.zIndex = "2147483646";
    root.style.pointerEvents = "none";
    let hint = "Selecione a lista de clientes. Esc cancela.";
    let highlight = EMPTY_HIGHLIGHT;
    let hovered: Element | null = null;

    const render = () => {
      mount.render(
        <PickerOverlayView
          highlight={highlight}
          hint={hint}
          tone="amber"
        />
      );
    };

    const cleanup = () => {
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      mount.unmount();
    };

    const updateHighlight = (element: Element | null) => {
      hovered = element;

      if (!element) {
        highlight = EMPTY_HIGHLIGHT;
        render();
        return;
      }

      const rect = element.getBoundingClientRect();
      const count = extractListItems(element).length;
      hint = count
        ? `${count} clientes visiveis encontrados. Clique para confirmar.`
        : "Selecione uma area com linhas de clientes.";
      highlight = {
        height: rect.height,
        left: rect.left,
        top: rect.top,
        visible: true,
        width: rect.width
      };
      render();
    };

    function onPointerMove(event: PointerEvent) {
      updateHighlight(getListContainer(event.target));
    }

    function onPointerDown(event: PointerEvent) {
      if (isLinvoElement(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const element = hovered ?? getListContainer(event.target);
      const items = element ? extractListItems(element) : [];
      const text = element ? getElementText(element) : "";

      if (!element || items.length < 2 || text.length < MIN_TEXT_LENGTH) {
        hint = "Selecione uma lista com pelo menos 2 linhas visiveis.";
        render();
        return;
      }

      const rect = element.getBoundingClientRect();
      cleanup();
      resolve({
        element,
        items,
        selection: {
          boundingBox: {
            height: rect.height,
            left: rect.left,
            top: rect.top,
            width: rect.width
          },
          containerText: text.slice(0, 8_000),
          label: text.slice(0, 160),
          selectedAt: new Date().toISOString(),
          source: "user"
        }
      });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      cleanup();
      resolve(null);
    }

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    render();
  });
}
