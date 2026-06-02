import type { ClientIdentificationApiResponse } from "@linvo-ai/shared";

import {
  getClientAnchorMenuEnabled,
  getClientAnchorMenuPlacement,
  type ClientAnchorPlacementPreference
} from "../lib/client-anchor-preferences";
import { ClientAnchorMenuView } from "./client-anchor-menu-view";
import { createShadowReactMount, type ShadowReactMount } from "./shadow-ui";

const ROOT_ID = "linvo-ai-client-anchor-menu";
const BUTTON_SIZE = 40;
const GAP = 8;

interface ClientAnchorMenuControls {
  onIdentifyClient: () => void;
  onIdentifyList: () => void;
  onOpenInfo: () => void;
}

let controls: ClientAnchorMenuControls | null = null;
let mount: ShadowReactMount | null = null;
let currentResponse: ClientIdentificationApiResponse | null = null;
let menuOpen = false;

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

function getAnchorLabel(response: ClientIdentificationApiResponse): string | null {
  if (response.status !== "ok") {
    return null;
  }

  return response.activeClient?.displayName ??
    response.pendingClient?.displayName ??
    response.case?.protocol ??
    response.pendingClient?.case?.protocol ??
    null;
}

function findAnchorElement(response: ClientIdentificationApiResponse): Element | null {
  const label = getAnchorLabel(response);

  if (!label || label.length < 3) {
    return null;
  }

  const labelKey = compactText(label).toLowerCase();
  const candidates = Array.from(
    document.querySelectorAll("article, section, [role='listitem'], [aria-label], li, tr, div")
  )
    .filter((element) => !element.closest(`#${ROOT_ID}, #linvo-ai-floating-action, #linvo-ai-toast`))
    .filter(isVisibleElement);

  return candidates.find((element) =>
    compactText(element.textContent ?? "").toLowerCase().includes(labelKey)
  ) ?? null;
}

function positionFor(
  rect: DOMRect,
  placement: ClientAnchorPlacementPreference
): { left: number; top: number } {
  const maxLeft = Math.max(GAP, window.innerWidth - BUTTON_SIZE - GAP);
  const maxTop = Math.max(GAP, window.innerHeight - BUTTON_SIZE - GAP);
  const normalized = placement === "smart"
    ? rect.right + BUTTON_SIZE + GAP < window.innerWidth
      ? "right"
      : rect.left - BUTTON_SIZE - GAP > 0
        ? "left"
        : "bottom"
    : placement;
  const raw = {
    bottom: {
      left: rect.left + rect.width / 2 - BUTTON_SIZE / 2,
      top: rect.bottom + GAP
    },
    left: {
      left: rect.left - BUTTON_SIZE - GAP,
      top: rect.top + rect.height / 2 - BUTTON_SIZE / 2
    },
    right: {
      left: rect.right + GAP,
      top: rect.top + rect.height / 2 - BUTTON_SIZE / 2
    },
    top: {
      left: rect.left + rect.width / 2 - BUTTON_SIZE / 2,
      top: rect.top - BUTTON_SIZE - GAP
    }
  }[normalized];

  return {
    left: Math.min(maxLeft, Math.max(GAP, raw.left)),
    top: Math.min(maxTop, Math.max(GAP, raw.top))
  };
}

function removeAnchorMenu(): void {
  mount?.unmount();
  mount = null;
  menuOpen = false;
}

function renderAnchorMenu(): void {
  if (!mount || !controls) {
    return;
  }

  mount.render(
    <ClientAnchorMenuView
      menuOpen={menuOpen}
      onIdentifyClient={() => {
        menuOpen = false;
        renderAnchorMenu();
        controls?.onIdentifyClient();
      }}
      onIdentifyList={() => {
        menuOpen = false;
        renderAnchorMenu();
        controls?.onIdentifyList();
      }}
      onOpenInfo={() => {
        menuOpen = false;
        renderAnchorMenu();
        controls?.onOpenInfo();
      }}
      onToggleMenu={() => {
        menuOpen = !menuOpen;
        renderAnchorMenu();
      }}
    />
  );
}

export async function syncClientAnchorMenu(
  response: ClientIdentificationApiResponse | null = currentResponse
): Promise<void> {
  currentResponse = response;

  if (!response || response.status !== "ok" || !(await getClientAnchorMenuEnabled())) {
    removeAnchorMenu();
    return;
  }

  const element = findAnchorElement(response);

  if (!element) {
    removeAnchorMenu();
    return;
  }

  if (!mount) {
    mount = createShadowReactMount(ROOT_ID);
    mount.host.style.position = "fixed";
    mount.host.style.zIndex = "2147483644";
    mount.host.style.width = `${BUTTON_SIZE}px`;
    mount.host.style.height = `${BUTTON_SIZE}px`;
  }

  const placement = await getClientAnchorMenuPlacement();
  const position = positionFor(element.getBoundingClientRect(), placement);
  mount.host.style.left = `${Math.round(position.left)}px`;
  mount.host.style.top = `${Math.round(position.top)}px`;
  renderAnchorMenu();
}

export function installClientAnchorMenu(input: ClientAnchorMenuControls): void {
  controls = input;

  document.addEventListener("pointerdown", (event) => {
    if (
      !menuOpen ||
      !(event.target instanceof Node) ||
      mount?.host.contains(event.target)
    ) {
      return;
    }

    menuOpen = false;
    renderAnchorMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuOpen) {
      menuOpen = false;
      renderAnchorMenu();
    }
  });

  window.addEventListener("resize", () => {
    void syncClientAnchorMenu();
  });
}
