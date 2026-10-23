/**
 * Internet Archive downloads. An item holds files with names of their own, so
 * the zip to download is read from the item's metadata rather than guessed.
 */

const ARCHIVE = "https://archive.org";

/** The item identifier of an `archive.org/download/<item>/...` URL, or null. */
export function archiveItemId(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const match = pathname.match(/^\/download\/([^/]+)/);
    return hostname === "archive.org" && match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/** The item's original zip (the largest, when there are several), or null. */
export function pickArchiveZip(files) {
  const zips = (files ?? []).filter(
    (file) => file.source === "original" && /\.zip$/i.test(file.name),
  );
  if (zips.length === 0) {
    return null;
  }
  return zips.reduce((largest, zip) => (Number(zip.size) > Number(largest.size) ? zip : largest))
    .name;
}

const downloadUrl = (item, name) =>
  `${ARCHIVE}/download/${encodeURIComponent(item)}/${name.split("/").map(encodeURIComponent).join("/")}`;

/**
 * The direct zip URL for an Internet Archive download URL, or null for other
 * sites. Throws when the item has no zip to download.
 * @param {string} url
 * @param {(url: string) => Promise<{ files?: Array<{ name: string, size?: string, source?: string }> }>} fetchJson
 */
export async function resolveArchiveDownload(url, fetchJson) {
  const item = archiveItemId(url);
  if (!item) {
    return null;
  }
  const metadata = await fetchJson(`${ARCHIVE}/metadata/${encodeURIComponent(item)}`);
  const requested = decodeURIComponent(new URL(url).pathname.split("/").slice(3).join("/"));
  const files = metadata.files ?? [];
  const named = files.find((file) => file.source === "original" && file.name === requested);
  const zip = named && /\.zip$/i.test(named.name) ? named.name : pickArchiveZip(files);
  if (!zip) {
    throw new Error(`The Internet Archive item ${item} has no zip to download`);
  }
  return downloadUrl(item, zip);
}
