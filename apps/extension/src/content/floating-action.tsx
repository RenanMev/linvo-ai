import type { RuntimeResponseMessage } from "../lib/runtime-messages";
import {
  buildClientInfoOpenRequest,
  buildBulkIdentificationRequest,
  buildIdentificationRequest
} from "./context-capture";
import { startClientPicker, startListPicker } from "./client-picker";
import { FloatingActionView } from "./floating-action-view";
import { createShadowReactMount } from "./shadow-ui";
import { showToast } from "./toast";
import type { PointerEvent as ReactPointerEvent } from "react";

const BUTTON_ID = "linvo-ai-floating-action";
const PLACEMENT_STORAGE_KEY = "linvoAiFloatingActionPlacement";
const DEFAULT_MARGIN = 18;
const LAUNCHER_SIZE = 52;
const DRAG_THRESHOLD_PX = 5;

type FloatingActionHorizontal = "left" | "right";
type FloatingActionVertical = "bottom" | "top";
type FloatingActionEdge = "bottom" | "left" | "right" | "top";

export type FloatingActionPlacement =
  | {
      horizontal: FloatingActionHorizontal;
      snap: "corner";
      vertical: FloatingActionVertical;
    }
  | {
      edge: FloatingActionEdge;
      offset: number;
      snap: "edge";
    };

export interface FloatingActionPosition {
  left: number;
  top: number;
}

export interface FloatingActionPositionInput {
  launcherHeight: number;
  launcherWidth: number;
  margin?: number;
  placement: FloatingActionPlacement | null;
  viewportHeight: number;
  viewportWidth: number;
}

export interface FloatingActionSnapInput {
  cornerThreshold?: number;
  launcherHeight: number;
  launcherWidth: number;
  margin?: number;
  rawLeft: number;
  rawTop: number;
  viewportHeight: number;
  viewportWidth: number;
}

export interface FloatingActionMagnetPreview
  extends FloatingActionPosition {
  magnetStrength: number;
  placement: FloatingActionPlacement;
}

export const DEFAULT_FLOATING_ACTION_PLACEMENT: FloatingActionPlacement = {
  horizontal: "right",
  snap: "corner",
  vertical: "bottom"
};

function getRuntimeOwnerId(): string {
  if (typeof chrome === "undefined") {
    return "local-preview";
  }

  return chrome.runtime?.id ?? "local-preview";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getMaxLeft(input: {
  launcherWidth: number;
  margin: number;
  viewportWidth: number;
}): number {
  return Math.max(
    input.margin,
    input.viewportWidth - input.launcherWidth - input.margin
  );
}

function getMaxTop(input: {
  launcherHeight: number;
  margin: number;
  viewportHeight: number;
}): number {
  return Math.max(
    input.margin,
    input.viewportHeight - input.launcherHeight - input.margin
  );
}

function isHorizontal(value: unknown): value is FloatingActionHorizontal {
  return value === "left" || value === "right";
}

function isVertical(value: unknown): value is FloatingActionVertical {
  return value === "bottom" || value === "top";
}

function isEdge(value: unknown): value is FloatingActionEdge {
  return (
    value === "bottom" ||
    value === "left" ||
    value === "right" ||
    value === "top"
  );
}

function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

function clampFloatingActionPoint(
  input: FloatingActionSnapInput
): FloatingActionPosition {
  const margin = input.margin ?? DEFAULT_MARGIN;
  const maxLeft = getMaxLeft({
    launcherWidth: input.launcherWidth,
    margin,
    viewportWidth: input.viewportWidth
  });
  const maxTop = getMaxTop({
    launcherHeight: input.launcherHeight,
    margin,
    viewportHeight: input.viewportHeight
  });

  return {
    left: clamp(input.rawLeft, margin, maxLeft),
    top: clamp(input.rawTop, margin, maxTop)
  };
}

export function normalizeFloatingActionPlacement(
  value: unknown
): FloatingActionPlacement {
  if (!value || typeof value !== "object") {
    return DEFAULT_FLOATING_ACTION_PLACEMENT;
  }

  const candidate = value as {
    edge?: unknown;
    horizontal?: unknown;
    offset?: unknown;
    snap?: unknown;
    vertical?: unknown;
  };

  if (
    candidate.snap === "corner" &&
    isHorizontal(candidate.horizontal) &&
    isVertical(candidate.vertical)
  ) {
    return {
      horizontal: candidate.horizontal,
      snap: "corner",
      vertical: candidate.vertical
    };
  }

  const offset = Number(candidate.offset);

  if (
    candidate.snap === "edge" &&
    isEdge(candidate.edge) &&
    Number.isFinite(offset)
  ) {
    return {
      edge: candidate.edge,
      offset,
      snap: "edge"
    };
  }

  return DEFAULT_FLOATING_ACTION_PLACEMENT;
}

export function resolveFloatingActionPosition(
  input: FloatingActionPositionInput
): FloatingActionPosition {
  const margin = input.margin ?? DEFAULT_MARGIN;
  const placement = input.placement ?? DEFAULT_FLOATING_ACTION_PLACEMENT;
  const maxLeft = getMaxLeft({
    launcherWidth: input.launcherWidth,
    margin,
    viewportWidth: input.viewportWidth
  });
  const maxTop = getMaxTop({
    launcherHeight: input.launcherHeight,
    margin,
    viewportHeight: input.viewportHeight
  });

  if (placement.snap === "corner") {
    return {
      left: placement.horizontal === "left" ? margin : maxLeft,
      top: placement.vertical === "top" ? margin : maxTop
    };
  }

  if (placement.edge === "left" || placement.edge === "right") {
    return {
      left: placement.edge === "left" ? margin : maxLeft,
      top: clamp(placement.offset, margin, maxTop)
    };
  }

  return {
    left: clamp(placement.offset, margin, maxLeft),
    top: placement.edge === "top" ? margin : maxTop
  };
}

export function resolveFloatingActionSnap(
  input: FloatingActionSnapInput
): FloatingActionPlacement {
  const margin = input.margin ?? DEFAULT_MARGIN;
  const cornerThreshold = input.cornerThreshold ?? 96;
  const point = clampFloatingActionPoint({
    ...input,
    margin
  });
  const maxLeft = getMaxLeft({
    launcherWidth: input.launcherWidth,
    margin,
    viewportWidth: input.viewportWidth
  });
  const maxTop = getMaxTop({
    launcherHeight: input.launcherHeight,
    margin,
    viewportHeight: input.viewportHeight
  });
  const leftDistance = Math.abs(point.left - margin);
  const rightDistance = Math.abs(maxLeft - point.left);
  const topDistance = Math.abs(point.top - margin);
  const bottomDistance = Math.abs(maxTop - point.top);
  const nearestHorizontal =
    leftDistance <= rightDistance
      ? { distance: leftDistance, horizontal: "left" as const }
      : { distance: rightDistance, horizontal: "right" as const };
  const nearestVertical =
    topDistance <= bottomDistance
      ? { distance: topDistance, vertical: "top" as const }
      : { distance: bottomDistance, vertical: "bottom" as const };

  if (
    nearestHorizontal.distance <= cornerThreshold &&
    nearestVertical.distance <= cornerThreshold
  ) {
    return {
      horizontal: nearestHorizontal.horizontal,
      snap: "corner",
      vertical: nearestVertical.vertical
    };
  }

  const edgeDistances: Array<{
    distance: number;
    edge: FloatingActionEdge;
  }> = [
    { distance: leftDistance, edge: "left" },
    { distance: rightDistance, edge: "right" },
    { distance: topDistance, edge: "top" },
    { distance: bottomDistance, edge: "bottom" }
  ];
  edgeDistances.sort((left, right) => left.distance - right.distance);

  const edge = edgeDistances[0]?.edge ?? "right";

  return {
    edge,
    offset: edge === "left" || edge === "right" ? point.top : point.left,
    snap: "edge"
  };
}

export function resolveFloatingActionMagnetPreview(
  input: FloatingActionSnapInput & {
    magnetThreshold?: number;
  }
): FloatingActionMagnetPreview {
  const margin = input.margin ?? DEFAULT_MARGIN;
  const magnetThreshold = input.magnetThreshold ?? 136;
  const point = clampFloatingActionPoint({
    ...input,
    margin
  });
  const placement = resolveFloatingActionSnap({
    ...input,
    margin
  });
  const snapped = resolveFloatingActionPosition({
    launcherHeight: input.launcherHeight,
    launcherWidth: input.launcherWidth,
    margin,
    placement,
    viewportHeight: input.viewportHeight,
    viewportWidth: input.viewportWidth
  });
  const distance = Math.hypot(snapped.left - point.left, snapped.top - point.top);
  const progress = 1 - Math.min(distance, magnetThreshold) / magnetThreshold;
  const magnetStrength = progress <= 0 ? 0 : smoothStep(progress);

  return {
    left: point.left + (snapped.left - point.left) * magnetStrength,
    magnetStrength,
    placement,
    top: point.top + (snapped.top - point.top) * magnetStrength
  };
}

export function installFloatingAction(): void {
  const runtimeOwnerId = getRuntimeOwnerId();
  const existingRoot = document.getElementById(BUTTON_ID);

  if (existingRoot?.dataset.linvoExtensionId === runtimeOwnerId) {
    return;
  }

  existingRoot?.remove();

  let currentPlacement = DEFAULT_FLOATING_ACTION_PLACEMENT;
  let dragCandidatePlacement: FloatingActionPlacement | null = null;
  let dragPointerId: number | null = null;
  let dragPointerOffsetX = 0;
  let dragPointerOffsetY = 0;
  let dragStarted = false;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let menuOpen = false;
  let suppressNextClick = false;
  let launcherButton: HTMLButtonElement | null = null;
  let alignRight = false;
  let openUp = false;

  const mount = createShadowReactMount(BUTTON_ID);
  const root = mount.host;
  root.dataset.linvoExtensionId = runtimeOwnerId;
  root.style.position = "fixed";
  root.style.left = `${DEFAULT_MARGIN}px`;
  root.style.top = `${DEFAULT_MARGIN}px`;
  root.style.width = `${LAUNCHER_SIZE}px`;
  root.style.height = `${LAUNCHER_SIZE}px`;
  root.style.zIndex = "2147483645";
  root.style.transition = "left 180ms ease, top 180ms ease, transform 120ms ease";
  const render = () => {
    mount.render(
      <FloatingActionView
        alignRight={alignRight}
        menuOpen={menuOpen}
        openUp={openUp}
        tooltipPortalContainer={mount.portalRoot}
        onClient={() => {
          setMenuOpen(false);
          void runIdentificationFlow();
        }}
        onInfo={() => {
          setMenuOpen(false);
          void runOpenInfoFlow();
        }}
        onLauncherClick={handleLauncherClick}
        onLauncherPointerDown={handleLauncherPointerDown}
        onList={() => {
          setMenuOpen(false);
          void runBulkIdentificationFlow();
        }}
      />
    );
  };

  function handleLauncherPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const rect = root.getBoundingClientRect();

    launcherButton = event.currentTarget;
    dragPointerId = event.pointerId;
    dragPointerOffsetX = event.clientX - rect.left;
    dragPointerOffsetY = event.clientY - rect.top;
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
    dragStarted = false;
    dragCandidatePlacement = null;
    root.style.transition = "transform 120ms ease";
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleLauncherClick() {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }

    setMenuOpen(!menuOpen);
  }

  function applyPlacement(placement: FloatingActionPlacement): void {
    const position = resolveFloatingActionPosition({
      launcherHeight: LAUNCHER_SIZE,
      launcherWidth: LAUNCHER_SIZE,
      placement,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    });

    root.style.left = `${position.left}px`;
    root.style.top = `${position.top}px`;
    root.dataset.snap = placement.snap;
    syncMenuAttachment();
  }

  function setMenuOpen(open: boolean): void {
    menuOpen = open;
    syncMenuAttachment();
  }

  function syncMenuAttachment(): void {
    const rect = root.getBoundingClientRect();
    alignRight = rect.left + rect.width / 2 > window.innerWidth / 2;
    openUp = rect.top + rect.height / 2 > window.innerHeight / 2;
    render();
  }

  document.addEventListener("pointerdown", (event) => {
    if (
      !menuOpen ||
      !(event.target instanceof Node) ||
      root.contains(event.target)
    ) {
      return;
    }

    setMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuOpen) {
      setMenuOpen(false);
    }
  });

  window.addEventListener("pointermove", (event) => {
    if (dragPointerId !== event.pointerId) {
      return;
    }

    const movedDistance = Math.hypot(
      event.clientX - pointerDownX,
      event.clientY - pointerDownY
    );

    if (!dragStarted && movedDistance < DRAG_THRESHOLD_PX) {
      return;
    }

    event.preventDefault();
    dragStarted = true;
    setMenuOpen(false);

    const preview = resolveFloatingActionMagnetPreview({
      launcherHeight: LAUNCHER_SIZE,
      launcherWidth: LAUNCHER_SIZE,
      rawLeft: event.clientX - dragPointerOffsetX,
      rawTop: event.clientY - dragPointerOffsetY,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    });

    dragCandidatePlacement = preview.placement;
    root.style.left = `${preview.left}px`;
    root.style.top = `${preview.top}px`;
    root.style.transform = `scale(${1 + preview.magnetStrength * 0.04})`;
  });

  window.addEventListener("pointerup", (event) => {
    if (dragPointerId !== event.pointerId) {
      return;
    }

    if (launcherButton?.hasPointerCapture(event.pointerId)) {
      launcherButton.releasePointerCapture(event.pointerId);
    }

    dragPointerId = null;
    root.style.transition =
      "left 180ms ease, top 180ms ease, transform 120ms ease";
    root.style.transform = "scale(1)";

    if (!dragStarted) {
      dragCandidatePlacement = null;
      return;
    }

    suppressNextClick = true;
    window.setTimeout(() => {
      suppressNextClick = false;
    }, 0);

    currentPlacement =
      dragCandidatePlacement ??
      resolveFloatingActionSnap({
        launcherHeight: LAUNCHER_SIZE,
        launcherWidth: LAUNCHER_SIZE,
        rawLeft: event.clientX - dragPointerOffsetX,
        rawTop: event.clientY - dragPointerOffsetY,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth
      });
    dragCandidatePlacement = null;
    applyPlacement(currentPlacement);
    void saveFloatingActionPlacement(currentPlacement);
  });

  window.addEventListener("pointercancel", (event) => {
    if (dragPointerId !== event.pointerId) {
      return;
    }

    if (launcherButton?.hasPointerCapture(event.pointerId)) {
      launcherButton.releasePointerCapture(event.pointerId);
    }

    dragPointerId = null;
    dragCandidatePlacement = null;
    root.style.transition =
      "left 180ms ease, top 180ms ease, transform 120ms ease";
    root.style.transform = "scale(1)";
    applyPlacement(currentPlacement);
  });

  window.addEventListener("resize", () => {
    applyPlacement(currentPlacement);
  });

  render();
  applyPlacement(currentPlacement);
  void loadFloatingActionPlacement().then((placement) => {
    if (dragPointerId !== null) {
      return;
    }

    currentPlacement = placement;
    applyPlacement(currentPlacement);
  });
}

function installFloatingActionLegacy(): void {
  if (document.getElementById(BUTTON_ID)) {
    return;
  }

  let currentPlacement = DEFAULT_FLOATING_ACTION_PLACEMENT;
  let dragCandidatePlacement: FloatingActionPlacement | null = null;
  let dragPointerId: number | null = null;
  let dragPointerOffsetX = 0;
  let dragPointerOffsetY = 0;
  let dragStarted = false;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let menuOpen = false;
  let suppressNextClick = false;

  const root = document.createElement("div");
  root.id = BUTTON_ID;
  root.style.position = "fixed";
  root.style.left = `${DEFAULT_MARGIN}px`;
  root.style.top = `${DEFAULT_MARGIN}px`;
  root.style.width = `${LAUNCHER_SIZE}px`;
  root.style.height = `${LAUNCHER_SIZE}px`;
  root.style.zIndex = "2147483645";
  root.style.fontFamily = "Merriweather, Georgia, serif";
  root.style.transition = "left 180ms ease, top 180ms ease, transform 120ms ease";

  const launcherButton = createLauncherButton();
  const menu = createActionMenu();
  const clientButton = createMenuActionButton("Identificar cliente", "client");
  const listButton = createMenuActionButton("Identificar lista", "list");
  const infoButton = createMenuActionButton("Abrir info", "info");

  menu.append(clientButton, listButton, infoButton);
  root.append(launcherButton, menu);
  document.documentElement.append(root);

  applyPlacement(currentPlacement);
  void loadFloatingActionPlacement().then((placement) => {
    if (dragPointerId !== null) {
      return;
    }

    currentPlacement = placement;
    applyPlacement(currentPlacement);
  });

  launcherButton.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const rect = root.getBoundingClientRect();

    dragPointerId = event.pointerId;
    dragPointerOffsetX = event.clientX - rect.left;
    dragPointerOffsetY = event.clientY - rect.top;
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
    dragStarted = false;
    dragCandidatePlacement = null;
    root.style.transition = "transform 120ms ease";
    launcherButton.setPointerCapture(event.pointerId);
  });

  launcherButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }

    setMenuOpen(!menuOpen);
  });

  clientButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen(false);
    void runIdentificationFlow();
  });

  listButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen(false);
    void runBulkIdentificationFlow();
  });

  infoButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen(false);
    void runOpenInfoFlow();
  });

  document.addEventListener("pointerdown", (event) => {
    if (
      !menuOpen ||
      !(event.target instanceof Node) ||
      root.contains(event.target)
    ) {
      return;
    }

    setMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuOpen) {
      setMenuOpen(false);
    }
  });

  window.addEventListener("pointermove", (event) => {
    if (dragPointerId !== event.pointerId) {
      return;
    }

    const movedDistance = Math.hypot(
      event.clientX - pointerDownX,
      event.clientY - pointerDownY
    );

    if (!dragStarted && movedDistance < DRAG_THRESHOLD_PX) {
      return;
    }

    event.preventDefault();
    dragStarted = true;
    setMenuOpen(false);

    const preview = resolveFloatingActionMagnetPreview({
      launcherHeight: LAUNCHER_SIZE,
      launcherWidth: LAUNCHER_SIZE,
      rawLeft: event.clientX - dragPointerOffsetX,
      rawTop: event.clientY - dragPointerOffsetY,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    });

    dragCandidatePlacement = preview.placement;
    root.style.left = `${preview.left}px`;
    root.style.top = `${preview.top}px`;
    root.style.transform = `scale(${1 + preview.magnetStrength * 0.04})`;
  });

  window.addEventListener("pointerup", (event) => {
    if (dragPointerId !== event.pointerId) {
      return;
    }

    if (launcherButton.hasPointerCapture(event.pointerId)) {
      launcherButton.releasePointerCapture(event.pointerId);
    }

    dragPointerId = null;
    root.style.transition =
      "left 180ms ease, top 180ms ease, transform 120ms ease";
    root.style.transform = "scale(1)";

    if (!dragStarted) {
      dragCandidatePlacement = null;
      return;
    }

    suppressNextClick = true;
    window.setTimeout(() => {
      suppressNextClick = false;
    }, 0);

    currentPlacement =
      dragCandidatePlacement ??
      resolveFloatingActionSnap({
        launcherHeight: LAUNCHER_SIZE,
        launcherWidth: LAUNCHER_SIZE,
        rawLeft: event.clientX - dragPointerOffsetX,
        rawTop: event.clientY - dragPointerOffsetY,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth
      });
    dragCandidatePlacement = null;
    applyPlacement(currentPlacement);
    void saveFloatingActionPlacement(currentPlacement);
  });

  window.addEventListener("pointercancel", (event) => {
    if (dragPointerId !== event.pointerId) {
      return;
    }

    if (launcherButton.hasPointerCapture(event.pointerId)) {
      launcherButton.releasePointerCapture(event.pointerId);
    }

    dragPointerId = null;
    dragCandidatePlacement = null;
    root.style.transition =
      "left 180ms ease, top 180ms ease, transform 120ms ease";
    root.style.transform = "scale(1)";
    applyPlacement(currentPlacement);
  });

  window.addEventListener("resize", () => {
    applyPlacement(currentPlacement);
  });

  function applyPlacement(placement: FloatingActionPlacement): void {
    const position = resolveFloatingActionPosition({
      launcherHeight: LAUNCHER_SIZE,
      launcherWidth: LAUNCHER_SIZE,
      placement,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    });

    root.style.left = `${position.left}px`;
    root.style.top = `${position.top}px`;
    root.dataset.snap = placement.snap;
    syncMenuAttachment();
  }

  function setMenuOpen(open: boolean): void {
    menuOpen = open;
    launcherButton.setAttribute("aria-expanded", open ? "true" : "false");
    menu.style.display = open ? "grid" : "none";
    menu.style.opacity = open ? "1" : "0";
    menu.style.pointerEvents = open ? "auto" : "none";
    menu.style.transform = open ? "translateY(0) scale(1)" : "translateY(4px) scale(0.94)";
    syncMenuAttachment();
  }

  function syncMenuAttachment(): void {
    const rect = root.getBoundingClientRect();
    const alignRight = rect.left + rect.width / 2 > window.innerWidth / 2;
    const openUp = rect.top + rect.height / 2 > window.innerHeight / 2;

    menu.style.left = alignRight ? "" : "0";
    menu.style.right = alignRight ? "0" : "";
    menu.style.top = openUp ? "" : "calc(100% + 10px)";
    menu.style.bottom = openUp ? "calc(100% + 10px)" : "";
  }
}

function createLauncherButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-label", "Abrir acoes Linvo AI");
  button.dataset.linvoRole = "launcher";
  button.title = "Linvo AI";
  button.innerHTML = createIconMarkup("launcher");
  button.style.alignItems = "center";
  button.style.background =
    "radial-gradient(circle at 32% 24%, rgba(255,255,255,0.2), transparent 28%), linear-gradient(145deg, #1f1f23 0%, #09090b 46%, #be123c 100%)";
  button.style.border = "1px solid rgba(255, 255, 255, 0.16)";
  button.style.borderRadius = "999px";
  button.style.boxShadow =
    "0 16px 34px rgba(0, 0, 0, 0.46), 0 0 0 5px rgba(225, 29, 72, 0.22), inset 0 1px 0 rgba(255,255,255,0.18)";
  button.style.color = "#ffffff";
  button.style.cursor = "grab";
  button.style.display = "inline-flex";
  button.style.height = `${LAUNCHER_SIZE}px`;
  button.style.justifyContent = "center";
  button.style.padding = "0";
  button.style.touchAction = "none";
  button.style.transition =
    "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease, background 160ms ease";
  button.style.width = `${LAUNCHER_SIZE}px`;

  button.addEventListener("pointerenter", () => {
    button.style.borderColor = "rgba(225, 29, 72, 0.62)";
    button.style.boxShadow =
      "0 18px 40px rgba(0, 0, 0, 0.5), 0 0 0 6px rgba(225, 29, 72, 0.22), 0 0 28px rgba(225, 29, 72, 0.45), inset 0 1px 0 rgba(255,255,255,0.22)";
    button.style.transform = "translateY(-1px) scale(1.02)";
  });
  button.addEventListener("pointerleave", () => {
    button.style.borderColor = "rgba(255, 255, 255, 0.16)";
    button.style.boxShadow =
      "0 16px 34px rgba(0, 0, 0, 0.46), 0 0 0 5px rgba(225, 29, 72, 0.22), inset 0 1px 0 rgba(255,255,255,0.18)";
    button.style.transform = "translateY(0) scale(1)";
  });

  return button;
}

function createActionMenu(): HTMLDivElement {
  const menu = document.createElement("div");
  menu.setAttribute("aria-label", "Acoes de identificacao");
  menu.setAttribute("role", "menu");
  menu.style.background = "rgba(9, 9, 11, 0.9)";
  menu.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  menu.style.borderRadius = "999px";
  menu.style.boxShadow = "0 18px 42px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255,255,255,0.08)";
  menu.style.display = "none";
  menu.style.gap = "6px";
  menu.style.gridAutoFlow = "column";
  menu.style.padding = "6px";
  menu.style.pointerEvents = "none";
  menu.style.position = "absolute";
  menu.style.transition = "opacity 180ms ease, transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)";
  menu.style.transform = "translateY(4px) scale(0.94)";

  return menu;
}

function createMenuActionButton(
  label: string,
  icon: "client" | "info" | "list"
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.setAttribute("role", "menuitem");
  button.dataset.linvoAction = icon;
  button.title = label;
  button.innerHTML = createIconMarkup(icon);
  const variant = {
    client: {
      background: "rgba(225, 29, 72, 0.18)",
      border: "1px solid rgba(225, 29, 72, 0.46)",
      color: "#fda4af"
    },
    info: {
      background: "#27272a",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      color: "#a1a1aa"
    },
    list: {
      background: "#27272a",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      color: "#a1a1aa"
    }
  }[icon];
  button.style.alignItems = "center";
  button.style.background = variant.background;
  button.style.border = variant.border;
  button.style.borderRadius = "999px";
  button.style.color = variant.color;
  button.style.cursor = "pointer";
  button.style.display = "inline-flex";
  button.style.height = "42px";
  button.style.justifyContent = "center";
  button.style.padding = "0";
  button.style.transition = "border-color 120ms ease, color 120ms ease, transform 120ms ease, background 120ms ease";
  button.style.width = "42px";

  button.addEventListener("pointerenter", () => {
    button.style.background = "rgba(225, 29, 72, 0.14)";
    button.style.borderColor = "rgba(225, 29, 72, 0.54)";
    button.style.color = "#f4f4f5";
    button.style.transform = "translateY(-1px)";
  });
  button.addEventListener("pointerleave", () => {
    button.style.background = variant.background;
    button.style.border = variant.border;
    button.style.color = variant.color;
    button.style.transform = "translateY(0)";
  });

  return button;
}

function createIconMarkup(kind: "client" | "info" | "launcher" | "list"): string {
  if (kind === "client") {
    return [
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">',
      '<path fill="currentColor" d="M12 12.25a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.8c-3.78 0-6.75 1.9-6.75 4.33 0 .76.61 1.37 1.37 1.37h10.76c.76 0 1.37-.61 1.37-1.37 0-2.43-2.97-4.33-6.75-4.33Z"/>',
      "</svg>"
    ].join("");
  }

  if (kind === "list") {
    return [
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">',
      '<path fill="currentColor" d="M5.25 6.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM7 5.35h13.25v1.8H7v-1.8Zm-1.75 6.65a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM7 11.1h13.25v1.8H7v-1.8Zm-1.75 6.65a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM7 16.85h13.25v1.8H7v-1.8Z"/>',
      "</svg>"
    ].join("");
  }

  if (kind === "info") {
    return [
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">',
      '<path fill="currentColor" d="M12 2.75a9.25 9.25 0 1 0 0 18.5 9.25 9.25 0 0 0 0-18.5Zm0 4.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Zm1.05 11.1h-2.1v-7.1h2.1v7.1Z"/>',
      "</svg>"
    ].join("");
  }

  return [
    '<svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">',
    '<path fill="currentColor" d="M12 2.75 14.1 8.3l5.65 2.2-5.65 2.2L12 18.25 9.9 12.7l-5.65-2.2L9.9 8.3 12 2.75Zm6.35 12.55.82 2.15 2.08.8-2.08.8-.82 2.2-.82-2.2-2.08-.8 2.08-.8.82-2.15Z"/>',
    "</svg>"
  ].join("");
}

function getChromeLocalStorage(): chrome.storage.StorageArea | null {
  if (typeof chrome === "undefined") {
    return null;
  }

  return chrome.storage?.local ?? null;
}

async function loadFloatingActionPlacement(): Promise<FloatingActionPlacement> {
  const storage = getChromeLocalStorage();

  if (!storage) {
    return DEFAULT_FLOATING_ACTION_PLACEMENT;
  }

  try {
    const stored = (await storage.get({
      [PLACEMENT_STORAGE_KEY]: DEFAULT_FLOATING_ACTION_PLACEMENT
    })) as Record<string, unknown>;

    return normalizeFloatingActionPlacement(stored[PLACEMENT_STORAGE_KEY]);
  } catch {
    return DEFAULT_FLOATING_ACTION_PLACEMENT;
  }
}

async function saveFloatingActionPlacement(
  placement: FloatingActionPlacement
): Promise<void> {
  const storage = getChromeLocalStorage();

  if (!storage) {
    return;
  }

  try {
    await storage.set({
      [PLACEMENT_STORAGE_KEY]: placement
    });
  } catch {
    // The launcher should keep working even if storage is unavailable.
  }
}

async function runIdentificationFlow(): Promise<void> {
  showToast("Selecione o cliente base na pagina.");
  const picked = await startClientPicker();

  if (!picked) {
    showToast("Identificacao cancelada.");
    return;
  }

  showToast("Analisando cliente na pagina...");
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

    if (
      "response" in response &&
      response.response.status === "ok" &&
      "saved" in response.response &&
      "confidence" in response.response
    ) {
      if (response.response.saveState === "pending_confirmation") {
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

async function runOpenInfoFlow(): Promise<void> {
  showToast("Abrindo informacoes do cliente...");
  const request = buildClientInfoOpenRequest();

  try {
    const response = await chrome.runtime.sendMessage({
      request,
      type: "assist/client-info.open.request"
    }) as RuntimeResponseMessage;

    if (!response.ok) {
      showToast(response.error.message, "error");
      return;
    }

    if ("response" in response && response.response.status === "ok" && "customer" in response.response) {
      showToast(
        `Info aberta: ${response.response.customer.displayName ?? "cliente"}.`,
        "success"
      );
      return;
    }

    if ("response" in response && response.response.status === "no_match") {
      showToast(response.response.reason, "info");
      return;
    }

    showToast("Nao foi possivel abrir as informacoes agora.", "error");
  } catch {
    showToast("Nao foi possivel abrir as informacoes agora.", "error");
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

  showToast(`Analisando ${picked.items.length} clientes da lista...`);
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
