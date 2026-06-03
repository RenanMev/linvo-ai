import { type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { getExtensionAssetUrl } from "@/lib/extension-assets";

export interface ShadowReactMount {
  host: HTMLElement;
  portalRoot: HTMLElement;
  render: (node: ReactNode) => void;
  shadowRoot: ShadowRoot;
  unmount: () => void;
}

export function createShadowReactMount(hostId: string): ShadowReactMount {
  const existing = document.getElementById(hostId);
  existing?.remove();

  const host = document.createElement("div");
  host.id = hostId;
  const shadowRoot = host.attachShadow({ mode: "open" });
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = getExtensionAssetUrl("linvo-ui.css");
  const mountPoint = document.createElement("div");
  const portalRoot = document.createElement("div");

  portalRoot.dataset.linvoPortalRoot = "true";

  shadowRoot.append(stylesheet, mountPoint, portalRoot);
  document.documentElement.append(host);

  const reactRoot: Root = createRoot(mountPoint);

  return {
    host,
    portalRoot,
    render: (node) => reactRoot.render(node),
    shadowRoot,
    unmount: () => {
      reactRoot.unmount();
      host.remove();
    }
  };
}
