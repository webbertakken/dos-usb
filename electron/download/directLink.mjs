/**
 * Whether a download URL is the game file itself (case-insensitive: catalogue
 * URLs use .ZIP) rather than a page that links to it.
 */
export function isDirectFileLink(url) {
  const lower = url.toLowerCase();
  return lower.endsWith(".zip") || lower.endsWith(".exe") || lower.includes("file=");
}
