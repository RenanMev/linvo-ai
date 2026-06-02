export function getExtensionAssetUrl(path: string): string {
  if (typeof chrome === "undefined" || !chrome.runtime?.getURL) {
    return path;
  }

  return chrome.runtime.getURL(path);
}
