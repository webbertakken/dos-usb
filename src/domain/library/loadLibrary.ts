/**
 * Loads the aggregated library, preferring the Electron-bundled file (robust
 * under file://) with a static `/library.json` fallback for the browser.
 */

import { CanonicalGame } from "./types";

export async function loadLibrary(): Promise<CanonicalGame[]> {
  if (typeof window !== "undefined" && window.electron?.getLibrary) {
    const list = await window.electron.getLibrary();
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
  }
  const response = await fetch("/library.json");
  if (!response.ok) {
    throw new Error(`Failed to load library: ${response.status}`);
  }
  return (await response.json()) as CanonicalGame[];
}
