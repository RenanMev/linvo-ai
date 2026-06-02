import {
  DEFAULT_FLOATING_ACTION_PLACEMENT,
  installFloatingAction,
  resolveFloatingActionPosition,
  resolveFloatingActionSnap
} from "../src/content/floating-action";
import { act } from "react";

const ROOT_ID = "linvo-ai-floating-action";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe("floating action positioning", () => {
  it("pins the launcher to the bottom-right corner by default", () => {
    expect(
      resolveFloatingActionPosition({
        launcherHeight: 52,
        launcherWidth: 52,
        placement: DEFAULT_FLOATING_ACTION_PLACEMENT,
        viewportHeight: 420,
        viewportWidth: 360
      })
    ).toEqual({
      left: 290,
      top: 350
    });
  });

  it("clamps the launcher inside a small viewport", () => {
    expect(
      resolveFloatingActionPosition({
        launcherHeight: 52,
        launcherWidth: 52,
        placement: {
          edge: "bottom",
          offset: 999,
          snap: "edge"
        },
        viewportHeight: 120,
        viewportWidth: 100
      })
    ).toEqual({
      left: 30,
      top: 50
    });
  });

  it("snaps to a corner when the pointer is near two edges", () => {
    expect(
      resolveFloatingActionSnap({
        launcherHeight: 52,
        launcherWidth: 52,
        rawLeft: 286,
        rawTop: 346,
        viewportHeight: 420,
        viewportWidth: 360
      })
    ).toEqual({
      horizontal: "right",
      snap: "corner",
      vertical: "bottom"
    });
  });

  it("snaps to the nearest edge away from corners", () => {
    expect(
      resolveFloatingActionSnap({
        launcherHeight: 52,
        launcherWidth: 52,
        rawLeft: 20,
        rawTop: 190,
        viewportHeight: 420,
        viewportWidth: 360
      })
    ).toEqual({
      edge: "left",
      offset: 190,
      snap: "edge"
    });
  });

  it("preserves an edge offset after resize when it still fits", () => {
    expect(
      resolveFloatingActionPosition({
        launcherHeight: 52,
        launcherWidth: 52,
        placement: {
          edge: "left",
          offset: 112,
          snap: "edge"
        },
        viewportHeight: 240,
        viewportWidth: 320
      })
    ).toEqual({
      left: 18,
      top: 112
    });
  });
});

describe("installFloatingAction", () => {
  afterEach(() => {
    document.getElementById(ROOT_ID)?.remove();
    vi.unstubAllGlobals();
  });

  it("renders one icon-only launcher and does not duplicate it", async () => {
    await act(async () => {
      installFloatingAction();
      installFloatingAction();
    });

    const roots = document.querySelectorAll(`#${ROOT_ID}`);
    const root = roots[0];
    const shadowRoot = root?.shadowRoot;
    const launcher = shadowRoot?.querySelector("[data-linvo-role='launcher']");

    expect(roots).toHaveLength(1);
    expect(launcher).toBeInstanceOf(HTMLButtonElement);
    expect(launcher?.getAttribute("aria-label")).toBe("Abrir acoes Linvo AI");
    expect(shadowRoot?.querySelector("[role='menu']")).toBeInstanceOf(HTMLDivElement);
    expect(shadowRoot?.querySelector("[role='menu']")?.className).toContain("opacity-0");
  });

  it("expands three icon-only actions with accessible labels", async () => {
    await act(async () => {
      installFloatingAction();
    });

    const root = document.getElementById(ROOT_ID);
    const shadowRoot = root?.shadowRoot;
    const launcher = shadowRoot?.querySelector(
      "[data-linvo-role='launcher']"
    ) as HTMLButtonElement | null;

    await act(async () => {
      launcher?.click();
    });

    const menu = shadowRoot?.querySelector("[role='menu']") as HTMLDivElement | null;
    const clientAction = shadowRoot?.querySelector(
      "[aria-label='Identificar cliente']"
    ) as HTMLButtonElement | null;
    const listAction = shadowRoot?.querySelector(
      "[aria-label='Identificar lista']"
    ) as HTMLButtonElement | null;
    const infoAction = shadowRoot?.querySelector(
      "[aria-label='Abrir info']"
    ) as HTMLButtonElement | null;

    expect(menu?.className).toContain("opacity-100");
    expect(clientAction).toBeInstanceOf(HTMLButtonElement);
    expect(listAction).toBeInstanceOf(HTMLButtonElement);
    expect(infoAction).toBeInstanceOf(HTMLButtonElement);
    expect(clientAction?.getAttribute("aria-label")).toBe("Identificar cliente");
    expect(listAction?.getAttribute("aria-label")).toBe("Identificar lista");
    expect(infoAction?.getAttribute("aria-label")).toBe("Abrir info");
  });
});
