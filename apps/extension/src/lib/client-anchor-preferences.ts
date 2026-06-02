export const CLIENT_ANCHOR_MENU_ENABLED_STORAGE_KEY = "linvoAiClientAnchorMenuEnabled";
export const CLIENT_ANCHOR_MENU_PLACEMENT_STORAGE_KEY = "linvoAiClientAnchorMenuPlacement";

export type ClientAnchorPlacementPreference =
  | "bottom"
  | "left"
  | "right"
  | "smart"
  | "top";

const DEFAULT_ENABLED = true;
const DEFAULT_PLACEMENT: ClientAnchorPlacementPreference = "smart";

export function normalizeClientAnchorMenuEnabled(value: unknown): boolean {
  return typeof value === "boolean" ? value : DEFAULT_ENABLED;
}

export function normalizeClientAnchorMenuPlacement(
  value: unknown
): ClientAnchorPlacementPreference {
  return value === "bottom" ||
    value === "left" ||
    value === "right" ||
    value === "smart" ||
    value === "top"
    ? value
    : DEFAULT_PLACEMENT;
}

function getSyncStorage(): chrome.storage.StorageArea | null {
  if (typeof chrome === "undefined") {
    return null;
  }

  return chrome.storage?.sync ?? null;
}

export async function getClientAnchorMenuEnabled(): Promise<boolean> {
  const storage = getSyncStorage();

  if (!storage) {
    return DEFAULT_ENABLED;
  }

  const result = await storage.get({
    [CLIENT_ANCHOR_MENU_ENABLED_STORAGE_KEY]: DEFAULT_ENABLED
  });

  return normalizeClientAnchorMenuEnabled(
    result[CLIENT_ANCHOR_MENU_ENABLED_STORAGE_KEY]
  );
}

export async function saveClientAnchorMenuEnabled(enabled: boolean): Promise<boolean> {
  const storage = getSyncStorage();

  if (!storage) {
    return enabled;
  }

  await storage.set({
    [CLIENT_ANCHOR_MENU_ENABLED_STORAGE_KEY]: enabled
  });

  return enabled;
}

export async function getClientAnchorMenuPlacement(): Promise<ClientAnchorPlacementPreference> {
  const storage = getSyncStorage();

  if (!storage) {
    return DEFAULT_PLACEMENT;
  }

  const result = await storage.get({
    [CLIENT_ANCHOR_MENU_PLACEMENT_STORAGE_KEY]: DEFAULT_PLACEMENT
  });

  return normalizeClientAnchorMenuPlacement(
    result[CLIENT_ANCHOR_MENU_PLACEMENT_STORAGE_KEY]
  );
}

export async function saveClientAnchorMenuPlacement(
  placement: ClientAnchorPlacementPreference
): Promise<ClientAnchorPlacementPreference> {
  const storage = getSyncStorage();

  if (!storage) {
    return placement;
  }

  await storage.set({
    [CLIENT_ANCHOR_MENU_PLACEMENT_STORAGE_KEY]: placement
  });

  return placement;
}
