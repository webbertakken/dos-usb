/**
 * The URL to render for a game image. In the app, remote images go through
 * its image cache (stored beside the games, so seen art works offline); images
 * bundled with the app, and pages outside the app, use the URL as it is.
 */
export function displayImageUrl(src: string): string {
  const cachedImageUrl =
    typeof window !== "undefined" ? window.electron?.cachedImageUrl : undefined;
  return cachedImageUrl && src.startsWith("https://") ? cachedImageUrl(src) : src;
}
