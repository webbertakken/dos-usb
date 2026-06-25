/**
 * Loads the store catalogue.
 *
 * Prefers the Electron-bundled catalogue (robust under file:// in the packaged
 * app); otherwise falls back to the static `/catalogue.json` asset served by
 * Next during development and in the browser.
 */

import { DosgamesListItem } from "./types";

export async function loadCatalogue(): Promise<DosgamesListItem[]> {
  if (typeof window !== "undefined" && window.electron?.getStoreCatalogue) {
    const list = await window.electron.getStoreCatalogue();
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
  }

  const response = await fetch("/catalogue.json");
  if (!response.ok) {
    throw new Error(`Failed to load catalogue: ${response.status}`);
  }
  return (await response.json()) as DosgamesListItem[];
}
