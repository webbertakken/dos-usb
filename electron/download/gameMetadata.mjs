/**
 * The `metadata.json` written beside every installed game, whether the app
 * downloaded it or a stick was assembled with it.
 */
export function gameMetadata(gameInfo) {
  return {
    title: gameInfo.title,
    description: gameInfo.description,
    year: gameInfo.year,
    category: gameInfo.category,
    thumbnail: gameInfo.thumbnail || gameInfo.image,
    downloadUrl: gameInfo.downloadUrl,
    runExe: gameInfo.runExe,
  };
}
