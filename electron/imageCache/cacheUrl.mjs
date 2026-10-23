/** URL scheme of the app's image cache, shared by the main process and preload. */
export const IMAGE_CACHE_SCHEME = "dosusb-image";

/** The cache URL the renderer uses for a remote image. */
export function cachedImageUrl(src) {
  return `${IMAGE_CACHE_SCHEME}://cache/?src=${encodeURIComponent(src)}`;
}
